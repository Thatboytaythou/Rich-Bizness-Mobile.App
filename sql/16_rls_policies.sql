-- =========================
-- RICH BIZNESS MOBILE
-- 16_rls_policies.sql
-- Row Level Security Policies
-- =========================

-- =========================
-- ENABLE RLS
-- =========================

alter table public.profiles enable row level security;
alter table public.feed_posts enable row level security;
alter table public.feed_likes enable row level security;
alter table public.feed_comments enable row level security;
alter table public.feed_reposts enable row level security;
alter table public.uploads enable row level security;

alter table public.music_tracks enable row level security;
alter table public.music_likes enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.artist_channels enable row level security;

alter table public.podcast_shows enable row level security;
alter table public.podcast_episodes enable row level security;
alter table public.radio_stations enable row level security;

alter table public.live_streams enable row level security;
alter table public.live_chat_messages enable row level security;
alter table public.live_view_sessions enable row level security;
alter table public.live_stream_purchases enable row level security;
alter table public.live_stream_bans enable row level security;
alter table public.live_reactions enable row level security;

alter table public.games enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_scores enable row level security;
alter table public.game_clips enable row level security;
alter table public.game_challenges enable row level security;

alter table public.chess_matches enable row level security;
alter table public.chess_moves enable row level security;
alter table public.chess_rankings enable row level security;

alter table public.sports_profiles enable row level security;
alter table public.sports_posts enable row level security;
alter table public.sports_picks enable row level security;
alter table public.sports_brackets enable row level security;
alter table public.sports_broadcasts enable row level security;

alter table public.artworks enable row level security;
alter table public.artwork_likes enable row level security;
alter table public.artwork_comments enable row level security;
alter table public.artwork_purchases enable row level security;

alter table public.products enable row level security;
alter table public.store_orders enable row level security;
alter table public.user_product_unlocks enable row level security;
alter table public.store_seller_profiles enable row level security;

alter table public.meta_avatars enable row level security;
alter table public.meta_worlds enable row level security;
alter table public.meta_visits enable row level security;

alter table public.dm_threads enable row level security;
alter table public.dm_thread_members enable row level security;
alter table public.dm_messages enable row level security;
alter table public.dm_message_reactions enable row level security;

alter table public.notifications enable row level security;
alter table public.user_wallets enable row level security;
alter table public.payout_requests enable row level security;

-- =========================
-- CLEAN OLD POLICIES
-- =========================

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname,
      r.schemaname,
      r.tablename
    );
  end loop;
end $$;

-- =========================
-- PROFILES
-- =========================

create policy "profiles public read"
on public.profiles for select
using (true);

create policy "profiles owner insert"
on public.profiles for insert
with check (auth.uid() = id);

create policy "profiles owner update"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- =========================
-- PUBLIC CONTENT READ
-- =========================

create policy "feed public read"
on public.feed_posts for select
using (visibility = 'public' or user_id = auth.uid());

create policy "music public read"
on public.music_tracks for select
using (is_published = true or creator_id = auth.uid());

create policy "playlists public read"
on public.playlists for select
using (is_public = true or creator_id = auth.uid());

create policy "playlist tracks public read"
on public.playlist_tracks for select
using (true);

create policy "artist channels public read"
on public.artist_channels for select
using (true);

create policy "podcast shows public read"
on public.podcast_shows for select
using (is_published = true or creator_id = auth.uid());

create policy "podcast episodes public read"
on public.podcast_episodes for select
using (is_published = true or creator_id = auth.uid());

create policy "radio public read"
on public.radio_stations for select
using (is_public = true or creator_id = auth.uid());

create policy "live public read"
on public.live_streams for select
using (status in ('live','ended') or creator_id = auth.uid());

create policy "games public read"
on public.games for select
using (is_active = true);

create policy "sports public read"
on public.sports_posts for select
using (true);

create policy "sports broadcasts public read"
on public.sports_broadcasts for select
using (true);

create policy "gallery public read"
on public.artworks for select
using (is_public = true or creator_id = auth.uid());

create policy "products public read"
on public.products for select
using (is_public = true or creator_id = auth.uid());

create policy "meta worlds public read"
on public.meta_worlds for select
using (is_public = true or creator_id = auth.uid());

-- =========================
-- OWNER CONTENT WRITE
-- =========================

create policy "feed owner all"
on public.feed_posts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "uploads owner all"
on public.uploads for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "music owner all"
on public.music_tracks for all
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "playlists owner all"
on public.playlists for all
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "artist channels owner all"
on public.artist_channels for all
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "podcast shows owner all"
on public.podcast_shows for all
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "podcast episodes owner all"
on public.podcast_episodes for all
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "radio owner all"
on public.radio_stations for all
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "live owner all"
on public.live_streams for all
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "game clips owner all"
on public.game_clips for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "sports profiles owner all"
on public.sports_profiles for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "sports posts owner all"
on public.sports_posts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "sports picks owner all"
on public.sports_picks for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "sports brackets owner all"
on public.sports_brackets for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "sports broadcasts owner all"
on public.sports_broadcasts for all
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "artworks owner all"
on public.artworks for all
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "products owner all"
on public.products for all
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

create policy "seller profile owner all"
on public.store_seller_profiles for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "meta avatars owner all"
on public.meta_avatars for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "meta worlds owner all"
on public.meta_worlds for all
using (auth.uid() = creator_id)
with check (auth.uid() = creator_id);

-- =========================
-- SOCIAL ACTIONS
-- =========================

create policy "feed likes user all"
on public.feed_likes for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "feed comments user all"
on public.feed_comments for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "feed reposts user all"
on public.feed_reposts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "music likes user all"
on public.music_likes for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "artwork likes user all"
on public.artwork_likes for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "artwork comments user all"
on public.artwork_comments for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- =========================
-- LIVE VIEWER ACTIONS
-- =========================

create policy "live chat user all"
on public.live_chat_messages for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "live view sessions user all"
on public.live_view_sessions for all
using (auth.uid() = user_id or user_id is null)
with check (auth.uid() = user_id or user_id is null);

create policy "live reactions user all"
on public.live_reactions for all
using (auth.uid() = user_id or user_id is null)
with check (auth.uid() = user_id or user_id is null);

create policy "live purchases owner read"
on public.live_stream_purchases for select
using (auth.uid() = user_id);

create policy "live bans owner read"
on public.live_stream_bans for select
using (auth.uid() = user_id or auth.uid() = banned_by);

-- =========================
-- GAMING / CHESS
-- =========================

create policy "game sessions user all"
on public.game_sessions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "game scores public read"
on public.game_scores for select
using (true);

create policy "game scores user insert"
on public.game_scores for insert
with check (auth.uid() = user_id);

create policy "game challenges player read"
on public.game_challenges for select
using (auth.uid() = challenger_id or auth.uid() = opponent_id);

create policy "game challenges creator insert"
on public.game_challenges for insert
with check (auth.uid() = challenger_id);

create policy "chess matches player read"
on public.chess_matches for select
using (auth.uid() = white_player_id or auth.uid() = black_player_id);

create policy "chess matches player update"
on public.chess_matches for update
using (auth.uid() = white_player_id or auth.uid() = black_player_id);

create policy "chess moves player all"
on public.chess_moves for all
using (auth.uid() = player_id)
with check (auth.uid() = player_id);

create policy "chess rankings public read"
on public.chess_rankings for select
using (true);

create policy "chess rankings owner insert"
on public.chess_rankings for insert
with check (auth.uid() = user_id);

-- =========================
-- PRIVATE USER DATA
-- =========================

create policy "orders buyer creator read"
on public.store_orders for select
using (auth.uid() = buyer_id or auth.uid() = creator_id);

create policy "unlocks owner read"
on public.user_product_unlocks for select
using (auth.uid() = user_id);

create policy "art purchases buyer read"
on public.artwork_purchases for select
using (auth.uid() = buyer_id);

create policy "wallet owner read"
on public.user_wallets for select
using (auth.uid() = user_id);

create policy "payout owner read"
on public.payout_requests for select
using (auth.uid() = user_id);

create policy "payout owner insert"
on public.payout_requests for insert
with check (auth.uid() = user_id);

create policy "notifications owner all"
on public.notifications for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- =========================
-- MESSAGES
-- =========================

create policy "dm thread member read"
on public.dm_threads for select
using (
  exists (
    select 1 from public.dm_thread_members m
    where m.thread_id = dm_threads.id
    and m.user_id = auth.uid()
  )
);

create policy "dm thread creator insert"
on public.dm_threads for insert
with check (auth.uid() = created_by);

create policy "dm members self read"
on public.dm_thread_members for select
using (auth.uid() = user_id);

create policy "dm members self insert"
on public.dm_thread_members for insert
with check (auth.uid() = user_id);

create policy "dm messages member read"
on public.dm_messages for select
using (
  exists (
    select 1 from public.dm_thread_members m
    where m.thread_id = dm_messages.thread_id
    and m.user_id = auth.uid()
  )
);

create policy "dm messages sender insert"
on public.dm_messages for insert
with check (auth.uid() = sender_id);

create policy "dm reactions owner all"
on public.dm_message_reactions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
