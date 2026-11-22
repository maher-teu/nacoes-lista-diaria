-- Catálogo da semana: fotos, vídeos e PDF que a dona sobe e a loja envia no WhatsApp.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogo', 'catalogo', true, 20971520, array['image/jpeg','image/png','image/webp','image/heic','application/pdf','video/mp4'])
on conflict (id) do nothing;
grant execute on function public.my_role() to authenticated;
create policy "catalogo ver" on storage.objects for select to authenticated
  using (bucket_id = 'catalogo' and public.my_role() in ('loja', 'dona'));
create policy "catalogo dona envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'catalogo' and public.my_role() = 'dona');
create policy "catalogo dona apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'catalogo' and public.my_role() = 'dona');
