-- =========================
-- RICH BIZNESS MOBILE
-- 14_notifications.sql
-- Notifications System
-- =========================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,

  actor_id uuid references public.profiles(id) on delete set null,

  type text not null,
  title text,
  body text,

  target_type text,
  target_id uuid,

  is_read boolean default false,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now()
);

create index if not exists notifications_user_idx
on public.notifications(user_id);

create index if not exists notifications_user_unread_idx
on public.notifications(user_id, is_read);

create index if not exists notifications_created_idx
on public.notifications(created_at desc);
