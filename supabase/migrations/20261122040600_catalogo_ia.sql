-- Catálogo semanal lido pelo app + mensagens escritas pela IA com peças do catálogo.

create table if not exists public.catalog_items (
  ref text primary key,
  week date not null,
  page int,
  price numeric(12, 2),
  description text,
  category text,
  metal text,
  image_path text,
  source text,                 -- 'linx' (descrição veio das vendas) | 'ia' (lida da foto)
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.catalog_items enable row level security;
revoke all on public.catalog_items from anon, authenticated;

alter table public.cycles add column if not exists catalog_ref text;
alter table public.cycles add column if not exists ai boolean not null default false;

-- A dona troca o catálogo da semana (o app manda referência, preço, página e foto).
create or replace function public.catalog_replace(p_week date, p_items jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  perform public.require_staff(true);
  update public.catalog_items set active = false, updated_at = now() where active;
  insert into public.catalog_items (ref, week, page, price, image_path, active, updated_at)
  select x.ref, p_week, x.page, x.price, x.image_path, true, now()
    from jsonb_to_recordset(p_items) as x(ref text, page int, price numeric, image_path text)
   where coalesce(x.ref, '') <> ''
  on conflict (ref) do update set week = excluded.week, page = excluded.page, price = excluded.price,
     image_path = excluded.image_path, active = true, updated_at = now();
  -- descrição pelas vendas da Linx quando a peça já foi vendida
  update public.catalog_items ci set
      description = d.description,
      category = split_part(public.norm_txt(d.description), ' ', 1),
      metal = case
        when d.description ~* 'PRATA 925' then 'silver 925'
        when d.description ~* 'FOLPR|FOLHEADO PRATA' then 'silver-filled'
        when d.description ~* 'BANPR|BANHADO PRATA' then 'silver-plated'
        when d.description ~* 'OURO FOLHEADO|FOLHEADO OURO' then 'gold-filled'
        when d.description ~* 'OURO BANHADO|BANHADO OURO' then 'gold-plated'
        when d.description ~* 'OURO 18|OURO 750' then 'gold 18k'
        when d.description ~* 'AÇO|\mACO\M' then 'steel'
        else 'other' end,
      source = 'linx'
    from (select distinct on (product_code) product_code, description
            from public.purchases where product_code is not null order by product_code, id desc) d
   where ci.active and ci.description is null and d.product_code = ci.ref;
  select count(*) into n from public.catalog_items where active;
  return jsonb_build_object('items', n,
    'sem_descricao', (select count(*) from public.catalog_items where active and description is null));
end $$;

create or replace function public.catalog_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff();
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.page) from public.catalog_items c where c.active), '[]'::jsonb);
end $$;

-- Mostra a peça sugerida junto com o card.
create or replace function public.cycle_json(y public.cycles) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(y) || jsonb_build_object('customer', (
    select jsonb_build_object(
      'code', c.code, 'name', c.name, 'first_name', c.first_name, 'phone', c.phone,
      'cidade', c.cidade, 'bairro', c.bairro, 'total_spent', c.total_spent,
      'last_period', c.last_period, 'last_items', c.last_items, 'birth_date', c.birth_date,
      'seller', c.seller, 'n_periods', c.n_periods, 'do_not_contact', c.do_not_contact)
    from public.customers c where c.code = y.customer_code),
    'item', (select jsonb_build_object('ref', i.ref, 'description', i.description, 'price', i.price, 'image_path', i.image_path)
               from public.catalog_items i where i.ref = y.catalog_ref))
$$;

revoke execute on function public.catalog_replace(date, jsonb), public.catalog_list(), public.cycle_json(public.cycles)
  from public, anon, authenticated;
grant execute on function public.catalog_replace(date, jsonb), public.catalog_list() to authenticated;

-- Depois da lista das 7h, a IA reescreve as mensagens (7h05).
create extension if not exists pg_net;
