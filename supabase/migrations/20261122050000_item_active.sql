-- Só mostra a foto da peça se ela ainda estiver no catálogo atual (catálogo novo apaga as fotos antigas).
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
               from public.catalog_items i where i.ref = y.catalog_ref and i.active))
$$;
