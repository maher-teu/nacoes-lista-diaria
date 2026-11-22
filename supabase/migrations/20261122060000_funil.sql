-- Funil (pipeline, estilo quadro): em que etapa está cada cliente, pela última tentativa de contato.
-- funil() devolve as contagens e os primeiros cards de cada etapa.
-- funil('conversa', 30) devolve mais cards daquela etapa (para "Ver mais").
drop function if exists public.funil(text);
create or replace function public.funil(p_stage text default null, p_offset int default 0, p_limit int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  perform public.require_staff();
  with last as (
    select distinct on (customer_code) customer_code, status, close_reason, list_date, updated_at,
           sale_value, reasons, followups_done
      from public.cycles
     order by customer_code, list_date desc, id desc
  ), st as (
    select c.code, c.name, c.phone, c.cidade, c.total_spent, c.last_items[1] as last_item,
           l.updated_at, l.sale_value, l.close_reason, l.reasons, l.followups_done,
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
  ), ranked as (
    select st.*, row_number() over (partition by stage order by updated_at desc nulls last, total_spent desc) as rn
      from st
     where p_stage is null or stage = p_stage
  )
  select jsonb_build_object(
    'counts', (select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb) from (select stage, count(*) n from st group by stage) x),
    'values', (select coalesce(jsonb_object_agg(stage, v), '{}'::jsonb) from (select stage, sum(sale_value) v from st where sale_value is not null group by stage) y),
    'items', (select coalesce(jsonb_object_agg(stage, cards), '{}'::jsonb) from (
       select stage, jsonb_agg(jsonb_build_object(
                'code', code, 'name', name, 'phone', phone, 'cidade', cidade, 'total_spent', total_spent,
                'last_item', last_item, 'updated_at', updated_at, 'sale_value', sale_value,
                'close_reason', close_reason, 'reasons', reasons, 'followups_done', followups_done) order by rn) as cards
         from ranked
        where rn > greatest(p_offset, 0) and rn <= greatest(p_offset, 0) + least(greatest(p_limit, 1), 100)
        group by stage) z))
  into res;
  return res;
end $$;

revoke all on function public.funil(text, int, int) from public, anon;
grant execute on function public.funil(text, int, int) to authenticated;
