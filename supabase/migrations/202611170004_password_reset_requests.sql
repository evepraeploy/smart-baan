create type public.password_reset_status as enum ('open', 'resolved', 'dismissed');

create table public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_phone text,
  note text,
  status public.password_reset_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create unique index password_reset_requests_one_open_idx
  on public.password_reset_requests (user_id) where status = 'open';
create index password_reset_requests_status_created_idx
  on public.password_reset_requests (status, created_at desc);

create function public.request_password_reset(
  p_identifier text,
  p_contact_phone text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identifier text := btrim(coalesce(p_identifier, ''));
  v_digits text := regexp_replace(btrim(coalesce(p_identifier, '')), '[^0-9]', '', 'g');
  v_user_id uuid;
begin
  if length(v_identifier) = 0 or length(v_identifier) > 50 then
    raise exception 'IDENTIFIER_REQUIRED';
  end if;

  select p.id into v_user_id
  from public.profiles p
  where p.is_active
    and (
      lower(p.login_identifier) = lower(v_identifier)
      or (
        v_digits ~ '^0[0-9]{8,9}$'
        and regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g') = v_digits
      )
    )
  limit 1;

  if v_user_id is null then
    return;
  end if;

  insert into public.password_reset_requests (user_id, contact_phone, note)
  values (
    v_user_id,
    nullif(left(btrim(coalesce(p_contact_phone, '')), 20), ''),
    nullif(left(btrim(coalesce(p_note, '')), 500), '')
  )
  on conflict (user_id) where status = 'open' do nothing;
end;
$$;

create function public.list_password_reset_requests()
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  login_identifier text,
  phone text,
  house_no text,
  contact_phone text,
  note text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select r.id,
         r.user_id,
         p.display_name,
         p.login_identifier,
         p.phone,
         h.house_no,
         r.contact_phone,
         r.note,
         r.created_at
  from public.password_reset_requests r
  join public.profiles p on p.id = r.user_id
  left join public.house_members hm on hm.user_id = r.user_id
  left join public.houses h on h.id = hm.house_id
  where r.status = 'open'
  order by r.created_at;
end;
$$;

create function public.close_password_reset_request(
  p_request_id uuid,
  p_status public.password_reset_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if p_status is null or p_status = 'open' then
    raise exception 'INVALID_STATUS';
  end if;

  update public.password_reset_requests
  set status = p_status, resolved_at = now(), resolved_by = auth.uid()
  where id = p_request_id and status = 'open';

  if not found then
    raise exception 'REQUEST_NOT_OPEN';
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'close_password_reset_request', 'password_reset_request', p_request_id, jsonb_build_object('status', p_status));
end;
$$;

revoke all on function public.request_password_reset(text, text, text) from public;
revoke all on function public.list_password_reset_requests() from public, anon;
revoke all on function public.close_password_reset_request(uuid, public.password_reset_status) from public, anon;

grant execute on function public.request_password_reset(text, text, text) to authenticated, anon;
grant execute on function public.list_password_reset_requests() to authenticated;
grant execute on function public.close_password_reset_request(uuid, public.password_reset_status) to authenticated;

alter table public.password_reset_requests enable row level security;
