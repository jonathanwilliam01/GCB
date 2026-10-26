create extension if not exists pgcrypto;

-- Código de 8 caracteres sem ambíguos (0/O, 1/I)
create or replace function gerar_codigo() returns text
language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + get_byte(uuid_send(gen_random_uuid()), 0) % 32, 1), '')
  from generate_series(1, 8);
$$;

-- dados = { baby, appName }
create table bebes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default gerar_codigo(),
  dados jsonb not null,
  criado_em timestamptz not null default now()
);

create table bebe_membros (
  bebe_id uuid not null references bebes on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (bebe_id, user_id)
);

-- days (chave = data), foods e measures (chave = id)
create table registros (
  bebe_id uuid not null references bebes on delete cascade,
  colecao text not null check (colecao in ('days', 'foods', 'measures')),
  chave text not null,
  dado jsonb not null,
  criado_em timestamptz not null default now(),
  primary key (bebe_id, colecao, chave)
);

create or replace function is_membro(b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from bebe_membros where bebe_id = b and user_id = auth.uid());
$$;

alter table bebes enable row level security;
alter table bebe_membros enable row level security;
alter table registros enable row level security;

create policy bebes_ler on bebes for select using (is_membro(id));
create policy bebes_editar on bebes for update using (is_membro(id));
create policy membros_ler on bebe_membros for select using (is_membro(bebe_id));
create policy registros_todos on registros for all using (is_membro(bebe_id)) with check (is_membro(bebe_id));

-- Código e membros só pelas funções abaixo
revoke insert, update, delete on bebes, bebe_membros from anon, authenticated;
grant update (dados) on bebes to authenticated;

-- Sem policy: só as funções security definer leem e gravam
create table convite_tentativas (
  user_id uuid not null default auth.uid(),
  em timestamptz not null default now()
);
create index on convite_tentativas (user_id, em);
alter table convite_tentativas enable row level security;

create or replace function criar_bebe(p_dados jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  bid uuid;
begin
  insert into bebes (dados) values (p_dados) returning id into bid;
  insert into bebe_membros (bebe_id, user_id) values (bid, auth.uid());
  return bid;
end $$;

-- Código errado devolve null (um raise desfaria o registro da tentativa); 10 erros em 15 min bloqueiam
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
  insert into bebe_membros (bebe_id, user_id) values (bid, auth.uid()) on conflict do nothing;
  return bid;
end $$;

create or replace function novo_codigo(p_bebe uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  cod text;
begin
  if not is_membro(p_bebe) then
    raise exception 'Você não participa deste bebê';
  end if;
  update bebes set codigo = gerar_codigo() where id = p_bebe returning codigo into cod;
  return cod;
end $$;

-- Último a sair apaga o bebê e os registros
create or replace function sair_bebe(p_bebe uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from bebe_membros where bebe_id = p_bebe and user_id = auth.uid();
  if not found then
    raise exception 'Você não participa deste bebê';
  end if;
  if not exists (select 1 from bebe_membros where bebe_id = p_bebe) then
    delete from bebes where id = p_bebe;
  end if;
end $$;

revoke execute on function criar_bebe, entrar_bebe, novo_codigo, sair_bebe from public, anon;
grant execute on function criar_bebe, entrar_bebe, novo_codigo, sair_bebe to authenticated;

alter publication supabase_realtime add table bebes, registros;
