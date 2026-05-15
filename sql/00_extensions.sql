-- =========================
-- RICH BIZNESS MOBILE
-- 00_extensions.sql
-- Core Extensions
-- =========================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- =========================
-- AUTO UPDATED_AT FUNCTION
-- =========================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- GENERIC TIMESTAMP TRIGGER
-- =========================

create or replace function public.set_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- PROFILE AUTO CREATION
-- =========================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  insert into public.profiles (
    id,
    username,
    display_name,
    avatar_url,
    created_at,
    updated_at
  )
  values (
    new.id,
    lower(
      regexp_replace(
        coalesce(split_part(new.email, '@', 1), 'user'),
        '[^a-zA-Z0-9_]',
        '',
        'g'
      )
    ),
    split_part(new.email, '@', 1),
    '',
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;

end;
$$;

-- =========================
-- AUTH USER TRIGGER
-- =========================

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();
