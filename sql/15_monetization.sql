-- =========================
-- RICH BIZNESS MOBILE
-- 15_monetization.sql
-- Earnings / Wallets / Payouts
-- =========================

-- Each user gets a wallet to track earnings and withdrawals
create table if not exists public.user_wallets (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,

  -- funds available to withdraw
  available_cents integer default 0,

  -- funds pending settlement (e.g. from recent sales, LiveKit streams)
  pending_cents integer default 0,

  -- lifetime totals
  total_earned_cents integer default 0,
  total_withdrawn_cents integer default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id)
);

-- Requests to cash out earnings to Stripe Connect
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,

  amount_cents integer default 0,
  currency text default 'usd',

  status text default 'pending',       -- pending, processing, paid, failed
  reason text,

  stripe_account_id text,
  stripe_payout_id text,

  requested_at timestamptz default now(),
  processed_at timestamptz,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger to keep wallets.updated_at current
drop trigger if exists set_wallets_updated_at on public.user_wallets;
create trigger set_wallets_updated_at
before update on public.user_wallets
for each row
execute procedure public.handle_updated_at();

-- Trigger to keep payout_requests.updated_at current
drop trigger if exists set_payout_requests_updated_at on public.payout_requests;
create trigger set_payout_requests_updated_at
before update on public.payout_requests
for each row
execute procedure public.handle_updated_at();

-- Helpful indexes
create index if not exists wallet_user_idx
  on public.user_wallets(user_id);

create index if not exists payout_requests_user_idx
  on public.payout_requests(user_id);

create index if not exists payout_requests_status_idx
  on public.payout_requests(status);
