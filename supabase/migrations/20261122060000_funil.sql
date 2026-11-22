-- Funil (pipeline): em que etapa cada cliente está, pela última tentativa de contato.
-- funil(null) devolve só as contagens; funil('conversa') devolve também as clientes daquela etapa.
create or replace function public.funil(p_stage text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  perform public.require_staff();
  with last as (
    select distinct on (customer_code) customer_code, status, close_reason, list_date, updated_at, sale_value
      from public.cycles
     order by customer_code, list_date desc, id desc
  ), st as (
    select c.code, c.name, c.phone, c.cidade, c.total_spent, l.updated_at, l.sale_value, l.close_reason,
           case when c.do_not_contact then 'nao_quer'
                when l.status is null then 'nunca'
                when l.status = 'pendente' then 'hoje'
                when l.status = 'enviada' then 'aguardando'
                when l.status = 'respondeu' then 'conversa'
                when l.status = 'vendeu' then 'vendeu'
                else 'encerrada' end as stage
      from public.customers c
      left join last l on l.customer_code = c.code
     where (c.phone is not null and c.excluded_reason is null) or c.do_not_contact or l.status is not null
  )
  select jsonb_build_object(
    'counts', (select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb) from (select stage, count(*) n from st group by stage) x),
    'stage', p_stage,
    'items', case when p_stage is null then '[]'::jsonb else coalesce((
      select jsonb_agg(t) from (
        select code, name, phone, cidade, total_spent, updated_at, sale_value, close_reason
          from st where stage = p_stage
         order by updated_at desc nulls last, total_spent desc
         limit 200) t), '[]'::jsonb) end)
  into res;
  return res;
end $$;

revoke all on function public.funil(text) from public, anon;
grant execute on function public.funil(text) to authenticated;
