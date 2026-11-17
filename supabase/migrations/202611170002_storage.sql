insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slips', 'slips', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy slips_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'slips'
  and (storage.foldername(name))[1] = public.my_house_id()::text
);

create policy slips_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'slips'
  and (
    (storage.foldername(name))[1] = public.my_house_id()::text
    or public.is_committee()
  )
);
