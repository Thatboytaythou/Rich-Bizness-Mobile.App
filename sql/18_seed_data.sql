-- =========================
-- RICH BIZNESS MOBILE
-- 18_seed_data.sql
-- Starter Data
-- =========================

insert into public.games (
  slug,
  title,
  description,
  genre,
  cover_url,
  thumbnail_url,
  is_active,
  is_featured,
  metadata
)
values
  (
    'rich-chess',
    'Rich Chess',
    'Elite Rich Bizness chess with rankings, matches, and real-time play.',
    'strategy',
    '/images/gaming/rich-chess-cover.png',
    '/images/gaming/rich-chess-thumb.png',
    true,
    true,
    '{"route":"/games/rich-chess/","engine":"chess"}'::jsonb
  ),
  (
    'money-road-runner',
    'Money Road Runner',
    'Fast arcade runner built for Rich Bizness scores and leaderboards.',
    'arcade',
    '/images/gaming/money-road-runner-cover.png',
    '/images/gaming/money-road-runner-thumb.png',
    true,
    true,
    '{"route":"/games/money-road-runner/","engine":"runner"}'::jsonb
  ),
  (
    'smoke-city-hustle',
    'Smoke City Hustle',
    'Side-scrolling Rich Bizness arcade world with clips and score tracking.',
    'arcade',
    '/images/gaming/smoke-city-hustle-cover.png',
    '/images/gaming/smoke-city-hustle-thumb.png',
    true,
    true,
    '{"route":"/games/smoke-city-hustle/","engine":"platformer"}'::jsonb
  ),
  (
    'studio-showdown',
    'Studio Showdown',
    'Creator battle game for the Rich Bizness arcade.',
    'battle',
    '/images/gaming/studio-showdown-cover.png',
    '/images/gaming/studio-showdown-thumb.png',
    true,
    true,
    '{"route":"/games/studio-showdown/","engine":"battle"}'::jsonb
  )
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  genre = excluded.genre,
  cover_url = excluded.cover_url,
  thumbnail_url = excluded.thumbnail_url,
  is_active = excluded.is_active,
  is_featured = excluded.is_featured,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.radio_stations (
  station_name,
  description,
  cover_url,
  stream_url,
  genre,
  is_live,
  is_featured,
  is_public,
  metadata
)
values
  (
    'Rich Bizness Radio',
    'Main Rich Bizness radio station for music, creators, and live drops.',
    '/images/music/radio-cover.png',
    '',
    'hip-hop',
    false,
    true,
    true,
    '{"section":"music","route":"/music.html"}'::jsonb
  )
on conflict do nothing;
