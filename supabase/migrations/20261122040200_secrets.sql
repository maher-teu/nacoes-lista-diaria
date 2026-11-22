-- Segredos das edge functions ficam numa tabela fora da API (schema private).
-- As funções conferem o segredo com check_secret(), que só o service role pode chamar.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.config (
  key text primary key,
  value text not null
);
revoke all on private.config from public, anon, authenticated;

create or replace function public.check_secret(p_name text, p_value text) returns boolean
language sql stable security definer set search_path = public, private as $$
  select coalesce(p_value, '') <> ''
     and exists (select 1 from private.config where key = p_name and value = p_value)
$$;

revoke execute on function public.check_secret(text, text) from public, anon, authenticated;
grant execute on function public.check_secret(text, text) to service_role;
