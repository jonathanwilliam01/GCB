-- Aviso na hora para os outros aparelhos do bebê (dormiu/acordou)
create or replace function push_evento(p_bebe uuid, p_titulo text, p_corpo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_membro(p_bebe) then
    raise exception 'Você não acompanha este bebê';
  end if;
  insert into push_agenda (inscricao_id, chave, em, ate, titulo, corpo)
  select id, to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') || '-ev-' || extract(epoch from now())::bigint, now(), now() + interval '15 minutes', p_titulo, p_corpo
  from push_inscricoes
  where bebe_id = p_bebe and user_id <> auth.uid() and coalesce((config->>'events')::boolean, true)
  on conflict do nothing;
  if found then
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'push_url'),
      headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'push_secret'))
    );
  end if;
end $$;

revoke execute on function push_evento from public, anon;
grant execute on function push_evento to authenticated;

-- push_agendar não apaga os eventos ainda não enviados
create or replace function push_agendar(p_bebe uuid, p_itens jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_membro(p_bebe) then
    raise exception 'Você não acompanha este bebê';
  end if;
  delete from push_agenda a
  using push_inscricoes i
  where i.id = a.inscricao_id and i.bebe_id = p_bebe and a.enviado_em is null
    and substr(a.chave, 12, 3) <> 'ev-'
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
