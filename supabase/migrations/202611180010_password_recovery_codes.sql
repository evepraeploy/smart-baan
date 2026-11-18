create extension if not exists pgcrypto;

create table public.password_recovery_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  failed_attempts integer not null default 0,
  locked_until timestamptz
);

alter table public.password_recovery_codes enable row level security;
revoke all on table public.password_recovery_codes from public, anon, authenticated;
grant all on table public.password_recovery_codes to service_role;

create function public.set_recovery_code(p_user_id uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_user_id is null or p_code is null or length(p_code) <> 10 then
    raise exception 'INVALID_RECOVERY_CODE';
  end if;
  insert into public.password_recovery_codes (user_id, code_hash, created_at, failed_attempts, locked_until)
  values (p_user_id, crypt(p_code, gen_salt('bf')), now(), 0, null)
  on conflict (user_id) do update
    set code_hash = excluded.code_hash,
        created_at = excluded.created_at,
        failed_attempts = 0,
        locked_until = null;
end;
$$;

create function public.verify_recovery_code(p_identifier text, p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_hash text;
  v_failed_attempts integer;
  v_locked_until timestamptz;
  v_identifier_digits text := regexp_replace(btrim(coalesce(p_identifier, '')), '[^0-9]', '', 'g');
begin
  select p.id, c.code_hash, c.failed_attempts, c.locked_until
  into v_user_id, v_hash, v_failed_attempts, v_locked_until
  from public.profiles p
  join public.password_recovery_codes c on c.user_id = p.id
  where p.is_active
    and (
      lower(p.login_identifier) = lower(btrim(coalesce(p_identifier, '')))
      or (
        v_identifier_digits ~ '^0[0-9]{8,9}$'
        and regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g') = v_identifier_digits
      )
    )
  limit 1
  for update of c;

  if not found then
    return null;
  end if;
  if v_locked_until is not null and v_locked_until > now() then
    raise exception 'RECOVERY_LOCKED';
  end if;
  if p_code is not null and crypt(p_code, v_hash) = v_hash then
    return v_user_id;
  end if;

  v_failed_attempts := v_failed_attempts + 1;
  update public.password_recovery_codes
  set failed_attempts = v_failed_attempts,
      locked_until = case when v_failed_attempts >= 5 then now() + interval '15 minutes' else null end
  where user_id = v_user_id;
  return null;
end;
$$;

revoke all on function public.set_recovery_code(uuid, text) from public, anon, authenticated;
revoke all on function public.verify_recovery_code(text, text) from public, anon, authenticated;
grant execute on function public.set_recovery_code(uuid, text) to service_role;
grant execute on function public.verify_recovery_code(text, text) to service_role;
