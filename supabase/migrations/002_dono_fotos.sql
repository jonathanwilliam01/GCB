-- Dono, e-mail dos membros (para listar e remover) e fotos no Storage
alter table bebe_membros
  add column email text not null default '',
  add column papel text not null default 'membro' check (papel in ('dono', 'membro'));

update bebe_membros m set email = u.email from auth.users u where u.id = m.user_id;
update bebe_membros m set papel = 'dono'
where m.user_id = (select user_id from bebe_membros x where x.bebe_id = m.bebe_id order by criado_em limit 1);

create or replace function e_dono(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from bebe_membros where bebe_id = b and user_id = auth.uid() and papel = 'dono');
$$;

create or replace function criar_bebe(p_dados jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  bid uuid;
begin
  insert into bebes (dados) values (p_dados) returning id into bid;
  insert into bebe_membros (bebe_id, user_id, email, papel) values (bid, auth.uid(), coalesce(auth.jwt() ->> 'email', ''), 'dono');
  return bid;
end $$;

create or replace function entrar_bebe(p_codigo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  bid uuid;
begin
  if (select count(*) from convite_tentativas where user_id = auth.uid() and em > now() - interval '15 minutes') >= 10 then
    raise exception 'Muitas tentativas. Aguarde alguns minutos.';
  end if;
  select id into bid from bebes where codigo = upper(replace(trim(p_codigo), ' ', ''));
  if bid is null then
    insert into convite_tentativas default values;
    return null;
  end if;
  insert into bebe_membros (bebe_id, user_id, email) values (bid, auth.uid(), coalesce(auth.jwt() ->> 'email', ''))
  on conflict do nothing;
  return bid;
end $$;

create or replace function novo_codigo(p_bebe uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  cod text;
begin
  if not e_dono(p_bebe) then
    raise exception 'Só o dono pode trocar o código';
  end if;
  update bebes set codigo = gerar_codigo() where id = p_bebe returning codigo into cod;
  return cod;
end $$;

-- Último a sair apaga o bebê; dono saindo passa o posto ao membro mais antigo
create or replace function sair_bebe(p_bebe uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  era_dono boolean;
begin
  delete from bebe_membros where bebe_id = p_bebe and user_id = auth.uid()
  returning papel = 'dono' into era_dono;
  if era_dono is null then
    raise exception 'Você não acompanha este bebê';
  end if;
  if not exists (select 1 from bebe_membros where bebe_id = p_bebe) then
    delete from bebes where id = p_bebe;
  elsif era_dono and not exists (select 1 from bebe_membros where bebe_id = p_bebe and papel = 'dono') then
    update bebe_membros set papel = 'dono'
    where bebe_id = p_bebe
      and user_id = (select user_id from bebe_membros where bebe_id = p_bebe order by criado_em limit 1);
  end if;
end $$;

create or replace function remover_membro(p_bebe uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not e_dono(p_bebe) then
    raise exception 'Só o dono pode remover quem acompanha';
  end if;
  if p_user = auth.uid() then
    raise exception 'Para sair use Deixar de acompanhar';
  end if;
  delete from bebe_membros where bebe_id = p_bebe and user_id = p_user;
end $$;

create or replace function excluir_bebe(p_bebe uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not e_dono(p_bebe) then
    raise exception 'Só o dono pode excluir o bebê';
  end if;
  delete from bebes where id = p_bebe;
end $$;

revoke execute on function remover_membro, excluir_bebe from public, anon;
grant execute on function remover_membro, excluir_bebe to authenticated;

-- Fotos em fotos/<bebe_id>/; bucket público para exibir pela URL (id do bebê no caminho), gravação só por membros
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true) on conflict (id) do nothing;

create policy fotos_ler on storage.objects for select
  using (bucket_id = 'fotos' and public.is_membro(((storage.foldername(name))[1])::uuid));
create policy fotos_inserir on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.is_membro(((storage.foldername(name))[1])::uuid));
create policy fotos_atualizar on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and public.is_membro(((storage.foldername(name))[1])::uuid));
create policy fotos_excluir on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and public.is_membro(((storage.foldername(name))[1])::uuid));

alter publication supabase_realtime add table bebe_membros;
