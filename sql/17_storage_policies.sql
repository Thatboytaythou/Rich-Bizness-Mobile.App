-- =========================
-- RICH BIZNESS MOBILE
-- 17_storage_policies.sql
-- Storage Bucket Policies
-- =========================

-- Clean old storage policies
drop policy if exists "public read public buckets" on storage.objects;
drop policy if exists "authenticated upload public buckets" on storage.objects;
drop policy if exists "owner update own files" on storage.objects;
drop policy if exists "owner delete own files" on storage.objects;
drop policy if exists "private store digital owner read" on storage.objects;
drop policy if exists "private store digital owner upload" on storage.objects;

-- PUBLIC READ BUCKETS
create policy "public read public buckets"
on storage.objects for select
using (
  bucket_id in (
    'avatars',
    'profile-banners',
    'meta-avatars',
    'general-uploads',
    'music-audio',
    'music-covers',
    'podcast-audio',
    'podcast-covers',
    'radio-covers',
    'live-thumbnails',
    'game-assets',
    'game-clips',
    'game-covers',
    'sports-media',
    'sports-clips',
    'sports-covers',
    'gallery-media',
    'store-products',
    'store-seller-media',
    'meta-worlds'
  )
);

-- AUTH USERS CAN UPLOAD TO PUBLIC BUCKETS
create policy "authenticated upload public buckets"
on storage.objects for insert
with check (
  auth.role() = 'authenticated'
  and bucket_id in (
    'avatars',
    'profile-banners',
    'meta-avatars',
    'general-uploads',
    'music-audio',
    'music-covers',
    'podcast-audio',
    'podcast-covers',
    'radio-covers',
    'live-thumbnails',
    'game-assets',
    'game-clips',
    'game-covers',
    'sports-media',
    'sports-clips',
    'sports-covers',
    'gallery-media',
    'store-products',
    'store-seller-media',
    'meta-worlds'
  )
);

-- USERS CAN UPDATE THEIR OWN FILES
create policy "owner update own files"
on storage.objects for update
using (
  auth.role() = 'authenticated'
  and owner = auth.uid()
)
with check (
  auth.role() = 'authenticated'
  and owner = auth.uid()
);

-- USERS CAN DELETE THEIR OWN FILES
create policy "owner delete own files"
on storage.objects for delete
using (
  auth.role() = 'authenticated'
  and owner = auth.uid()
);

-- PRIVATE STORE DIGITAL READ
-- Buyers get actual access later through signed URLs/server API.
create policy "private store digital owner read"
on storage.objects for select
using (
  bucket_id = 'store-digital'
  and auth.role() = 'authenticated'
  and owner = auth.uid()
);

-- PRIVATE STORE DIGITAL UPLOAD
create policy "private store digital owner upload"
on storage.objects for insert
with check (
  bucket_id = 'store-digital'
  and auth.role() = 'authenticated'
);
