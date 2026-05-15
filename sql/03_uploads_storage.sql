-- =========================
-- RICH BIZNESS MOBILE
-- 03_uploads_storage.sql
-- Universal Upload Registry + Storage Buckets
-- =========================

create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references public.profiles(id) on delete cascade,

  bucket text not null,
  file_path text not null,
  public_url text,

  original_name text,
  mime_type text,
  file_size bigint,

  media_type text,
  section text default 'general',

  visibility text default 'public',
  processing_status text default 'ready',

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(bucket, file_path)
);

drop trigger if exists set_uploads_updated_at on public.uploads;

create trigger set_uploads_updated_at
before update on public.uploads
for each row
execute procedure public.handle_updated_at();

create index if not exists uploads_user_idx on public.uploads(user_id);
create index if not exists uploads_bucket_idx on public.uploads(bucket);
create index if not exists uploads_section_idx on public.uploads(section);
create index if not exists uploads_created_idx on public.uploads(created_at desc);

-- =========================
-- STORAGE BUCKETS
-- Safe to run even if you already made them manually
-- =========================

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('profile-banners', 'profile-banners', true),
  ('meta-avatars', 'meta-avatars', true),

  ('general-uploads', 'general-uploads', true),

  ('music-audio', 'music-audio', true),
  ('music-covers', 'music-covers', true),

  ('podcast-audio', 'podcast-audio', true),
  ('podcast-covers', 'podcast-covers', true),
  ('radio-covers', 'radio-covers', true),

  ('live-thumbnails', 'live-thumbnails', true),
  ('live-recordings', 'live-recordings', false),

  ('game-assets', 'game-assets', true),
  ('game-clips', 'game-clips', true),
  ('game-covers', 'game-covers', true),

  ('sports-media', 'sports-media', true),
  ('sports-clips', 'sports-clips', true),
  ('sports-covers', 'sports-covers', true),

  ('gallery-media', 'gallery-media', true),

  ('store-products', 'store-products', true),
  ('store-digital', 'store-digital', false),
  ('store-seller-media', 'store-seller-media', true),

  ('meta-worlds', 'meta-worlds', true)
on conflict (id) do update
set public = excluded.public;

-- =========================
-- OPTIONAL: BUCKET SIZE LIMITS
-- Leaving MIME unrestricted for now
-- =========================

update storage.buckets
set file_size_limit = 52428800
where id in (
  'avatars',
  'profile-banners',
  'meta-avatars',
  'music-covers',
  'podcast-covers',
  'radio-covers',
  'live-thumbnails',
  'game-covers',
  'sports-covers',
  'gallery-media',
  'store-products',
  'store-seller-media',
  'meta-worlds'
);

update storage.buckets
set file_size_limit = 314572800
where id in (
  'general-uploads',
  'music-audio',
  'podcast-audio',
  'game-clips',
  'sports-media',
  'sports-clips',
  'live-recordings'
);

update storage.buckets
set file_size_limit = 1073741824
where id in (
  'store-digital',
  'game-assets'
);
