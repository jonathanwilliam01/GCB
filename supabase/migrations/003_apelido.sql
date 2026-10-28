-- Nome que aparece para quem acompanha (ex.: Mamãe), igual em todos os bebês do usuário
alter table bebe_membros add column apelido text not null default '';

create or replace function copiar_apelido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select apelido into new.apelido from bebe_membros where user_id = new.user_id and apelido <> '' limit 1;
  new.apelido := coalesce(new.apelido, '');
  return new;
end $$;

create trigger bebe_membros_apelido before insert on bebe_membros
for each row execute function copiar_apelido();

create or replace function definir_apelido(p_apelido text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update bebe_membros set apelido = left(trim(p_apelido), 30) where user_id = auth.uid();
end $$;

revoke execute on function definir_apelido from public, anon;
grant execute on function definir_apelido to authenticated;
