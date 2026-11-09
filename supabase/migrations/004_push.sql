-- Web Push: lembretes chegam com o app fechado
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- config = lembretes ligados no aparelho (NotifySettings)
create table push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  bebe_id uuid not null references bebes on delete cascade,
  config jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- chave = data + lembrete; só envia entre em e ate
create table push_agenda (
  inscricao_id uuid not null references push_inscricoes on delete cascade,
  chave text not null,
  em timestamptz not null,
  ate timestamptz not null,
  titulo text not null,
  corpo text not null,
  enviado_em timestamptz,
  primary key (inscricao_id, chave)
);
create index on push_agenda (em) where enviado_em is null;

-- Sem policy: acesso só pelas funções abaixo
alter table push_inscricoes enable row level security;
alter table push_agenda enable row level security;

create or replace function push_inscrever(p_endpoint text, p_p256dh text, p_auth text, p_bebe uuid, p_config jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  iid uuid;
begin
  if not is_membro(p_bebe) then
    raise exception 'Você não acompanha este bebê';
  end if;
  insert into push_inscricoes (endpoint, p256dh, auth, user_id, bebe_id, config)
  values (p_endpoint, p_p256dh, p_auth, auth.uid(), p_bebe, p_config)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id,
        bebe_id = excluded.bebe_id, config = excluded.config, atualizado_em = now()
  returning id into iid;
  -- trocou de bebê ou de config: a próxima agenda refaz
  delete from push_agenda where inscricao_id = iid and enviado_em is null;
end $$;

create or replace function push_cancelar(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_inscricoes where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- Qualquer membro monta a agenda de todos os aparelhos do bebê ao registrar algo
create or replace function push_configs(p_bebe uuid) returns table (id uuid, config jsonb)
language sql stable security definer set search_path = public as $$
  select id, config from push_inscricoes where bebe_id = p_bebe and is_membro(p_bebe);
$$;

-- Troca os pendentes do bebê pela lista nova; já enviados não repetem
create or replace function push_agendar(p_bebe uuid, p_itens jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_membro(p_bebe) then
    raise exception 'Você não acompanha este bebê';
  end if;
  delete from push_agenda a
  using push_inscricoes i
  where i.id = a.inscricao_id and i.bebe_id = p_bebe and a.enviado_em is null
    and not exists (
      select 1 from jsonb_to_recordset(p_itens) x(inscricao_id uuid, chave text)
      where x.inscricao_id = a.inscricao_id and x.chave = a.chave
    );
  insert into push_agenda (inscricao_id, chave, em, ate, titulo, corpo)
  select x.inscricao_id, x.chave, x.em, x.ate, x.titulo, x.corpo
  from jsonb_to_recordset(p_itens) x(inscricao_id uuid, chave text, em timestamptz, ate timestamptz, titulo text, corpo text)
  join push_inscricoes i on i.id = x.inscricao_id and i.bebe_id = p_bebe
  on conflict (inscricao_id, chave) do update
    set em = excluded.em, ate = excluded.ate, titulo = excluded.titulo, corpo = excluded.corpo
    where push_agenda.enviado_em is null;
  delete from push_agenda where em < now() - interval '2 days';
end $$;

-- Usada pela edge function: marca como enviados e devolve o que vence agora
create or replace function push_pendentes() returns table (endpoint text, p256dh text, auth text, chave text, titulo text, corpo text)
language sql security definer set search_path = public as $$
  update push_agenda a set enviado_em = now()
  from push_inscricoes i
  where i.id = a.inscricao_id and a.enviado_em is null and a.em <= now() and a.ate > now()
  returning i.endpoint, i.p256dh, i.auth, a.chave, a.titulo, a.corpo;
$$;

revoke execute on function push_inscrever, push_cancelar, push_configs, push_agendar, push_pendentes from public, anon;
grant execute on function push_inscrever, push_cancelar, push_configs, push_agendar to authenticated;
revoke execute on function push_pendentes from authenticated;
grant execute on function push_pendentes to service_role;

-- A cada minuto, se houver lembrete vencendo, chama a edge function push (URL e segredo no Vault, ver README)
select cron.schedule('push', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_url'),
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'push_secret'))
  )
  where exists (select 1 from public.push_agenda where enviado_em is null and em <= now() and ate > now());
$$);
