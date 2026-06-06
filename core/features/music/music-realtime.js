/* =========================
   RICH BIZNESS MOBILE
   /core/features/music/music-realtime.js

   MUSIC REALTIME ENGINE
   Tracks + Podcast + Radio realtime sync
   Listens only, updates music-state
========================= */

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  loadRadioStations,
  loadMyRadioLikes
} from "/core/features/music/radio-engine.js";

import {
  loadPodcastEpisodes,
  loadMyPodcastLikes
} from "/core/features/music/podcast-engine.js";

import {
  setTracks,
  upsertMusicItem,
  removeMusicItem,
  setMusicError,
  setMusicLoading,
  setMusicCollections
} from "/core/features/music/music-state.js";

const supabase = getSupabase();

const MUSIC_REALTIME = {
  channel: null,
  refreshHandler: null,
  listeners: new Set(),
  loading: false
};

function tracksTable() {
  return RB_TABLES.musicTracks || "music_tracks";
}

function podcastTable() {
  return RB_TABLES.podcastEpisodes || "podcast_episodes";
}

function radioTable() {
  return RB_TABLES.radioStations || "radio_stations";
}

function musicLikesTable() {
  return RB_TABLES.musicLikes || "music_likes";
}

function podcastLikesTable() {
  return RB_TABLES.podcastLikes || "podcast_likes";
}

function radioLikesTable() {
  return RB_TABLES.radioLikes || "radio_likes";
}

function normalizeTrack(row = {}) {
  const audioUrl =
    row.audio_url ||
    row.stream_url ||
    row.file_url ||
    row.media_url ||
    row.url ||
    "";

  return {
    ...row,
    title: row.title || row.name || "Untitled Track",
    name: row.name || row.title || "Untitled Track",
    audio_url: audioUrl,
    stream_url: row.stream_url || audioUrl,
    cover_url:
      row.cover_url ||
      row.image_url ||
      row.thumbnail_url ||
      "/images/brand/hero-banner.png",
    artist:
      row.artist ||
      row.artist_name ||
      row.creator_name ||
      row.display_name ||
      row.username ||
      "Rich Bizness",
    like_count: Number(row.like_count || 0),
    play_count: Number(row.play_count || 0),
    status: row.status || "published",
    visibility: row.visibility || "public"
  };
}

function publicFilter(query) {
  return query
    .in("status", ["active", "published", "live"])
    .or("visibility.eq.public,is_public.eq.true,visibility.is.null");
}

function emitMusicRealtime(payload = {}) {
  MUSIC_REALTIME.listeners.forEach((callback) => {
    try {
      callback(payload);
    } catch (error) {
      console.warn("[RB MUSIC REALTIME LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:music-realtime", {
      detail: payload
    })
  );
}

export function onMusicRealtime(callback) {
  if (typeof callback !== "function") return () => {};

  MUSIC_REALTIME.listeners.add(callback);

  return () => {
    MUSIC_REALTIME.listeners.delete(callback);
  };
}

/* =========================
   LOADERS
========================= */

export async function loadMusicTracks({
  limit = 50,
  publicOnly = true,
  search = "",
  genre = ""
} = {}) {
  let query = supabase
    .from(tracksTable())
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (publicOnly) {
    query = publicFilter(query);
  }

  if (genre) {
    query = query.eq("genre", genre);
  }

  if (search) {
    query = query.or(
      `title.ilike.%${search}%,name.ilike.%${search}%,artist.ilike.%${search}%,artist_name.ilike.%${search}%,description.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) throw error;

  const tracks = (data || []).map(normalizeTrack);

  setTracks(tracks);

  return tracks;
}

export async function loadMusicCollections({
  limit = 50,
  publicOnly = true
} = {}) {
  if (MUSIC_REALTIME.loading) return null;

  MUSIC_REALTIME.loading = true;
  setMusicLoading(true);

  try {
    const [tracks, podcasts, radio] = await Promise.allSettled([
      loadMusicTracks({
        limit,
        publicOnly
      }),
      loadPodcastEpisodes({
        limit,
        publicOnly
      }),
      loadRadioStations({
        limit,
        publicOnly
      })
    ]);

    const finalTracks =
      tracks.status === "fulfilled" ? tracks.value : [];

    const finalPodcasts =
      podcasts.status === "fulfilled" ? podcasts.value : [];

    const finalRadio =
      radio.status === "fulfilled" ? radio.value : [];

    setMusicCollections({
      tracks: finalTracks,
      podcasts: finalPodcasts,
      radioStations: finalRadio
    });

    await Promise.allSettled([
      loadMyMusicLikes(),
      loadMyPodcastLikes(),
      loadMyRadioLikes()
    ]);

    setMusicLoading(false);

    return {
      tracks: finalTracks,
      podcasts: finalPodcasts,
      radioStations: finalRadio
    };
  } catch (error) {
    setMusicError(error);
    throw error;
  } finally {
    MUSIC_REALTIME.loading = false;
  }
}

export async function loadMyMusicLikes() {
  const { getUser } = await import("/core/shared/rb-supabase.js");
  const { setLikedIds } = await import("/core/features/music/music-state.js");

  const user = getUser();

  if (!user?.id) {
    setLikedIds({
      type: "track",
      ids: []
    });

    return [];
  }

  const { data, error } = await supabase
    .from(musicLikesTable())
    .select("track_id,music_track_id")
    .eq("user_id", user.id);

  if (error) {
    console.warn("[RB MUSIC LIKES LOAD WARNING]", error.message);
    return [];
  }

  const ids = (data || [])
    .map((row) => row.track_id || row.music_track_id)
    .filter(Boolean);

  setLikedIds({
    type: "track",
    ids
  });

  return ids;
}

/* =========================
   CHANGE HANDLERS
========================= */

async function handleTrackChange(payload) {
  const event = payload.eventType;

  if (event === "DELETE") {
    const id = payload.old?.id;
    if (id) removeMusicItem(id, "track");
    return;
  }

  if (payload.new?.id) {
    upsertMusicItem(normalizeTrack(payload.new), "track");
  }
}

async function handlePodcastChange(payload) {
  const event = payload.eventType;

  if (event === "DELETE") {
    const id = payload.old?.id;
    if (id) removeMusicItem(id, "podcast");
    return;
  }

  if (payload.new?.id) {
    upsertMusicItem(payload.new, "podcast");
  }
}

async function handleRadioChange(payload) {
  const event = payload.eventType;

  if (event === "DELETE") {
    const id = payload.old?.id;
    if (id) removeMusicItem(id, "radio");
    return;
  }

  if (payload.new?.id) {
    upsertMusicItem(payload.new, "radio");
  }
}

async function refreshSafe(reason = "manual") {
  emitMusicRealtime({
    type: "refresh",
    reason
  });

  if (typeof MUSIC_REALTIME.refreshHandler === "function") {
    try {
      await MUSIC_REALTIME.refreshHandler(reason);
      return;
    } catch (error) {
      console.warn("[RB MUSIC CUSTOM REFRESH FAILED]", error);
    }
  }

  await loadMusicCollections();
}

/* =========================
   REALTIME BIND
========================= */

export function bindMusicRealtime({
  channelName = "rb-music-realtime",
  onRefresh = null,
  autoLoad = true
} = {}) {
  clearMusicRealtime();

  MUSIC_REALTIME.refreshHandler =
    typeof onRefresh === "function" ? onRefresh : null;

  MUSIC_REALTIME.channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: tracksTable()
      },
      async (payload) => {
        emitMusicRealtime({
          type: "tracks",
          payload
        });

        await handleTrackChange(payload);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: podcastTable()
      },
      async (payload) => {
        emitMusicRealtime({
          type: "podcasts",
          payload
        });

        await handlePodcastChange(payload);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: radioTable()
      },
      async (payload) => {
        emitMusicRealtime({
          type: "radio",
          payload
        });

        await handleRadioChange(payload);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: musicLikesTable()
      },
      async (payload) => {
        emitMusicRealtime({
          type: "music_likes",
          payload
        });

        await loadMyMusicLikes();
        await refreshSafe("music_likes");
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: podcastLikesTable()
      },
      async (payload) => {
        emitMusicRealtime({
          type: "podcast_likes",
          payload
        });

        await loadMyPodcastLikes();
        await refreshSafe("podcast_likes");
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: radioLikesTable()
      },
      async (payload) => {
        emitMusicRealtime({
          type: "radio_likes",
          payload
        });

        await loadMyRadioLikes();
        await refreshSafe("radio_likes");
      }
    )
    .subscribe((status) => {
      emitMusicRealtime({
        type: "status",
        status
      });

      console.log(`[RB MUSIC REALTIME] ${status}`);
    });

  if (autoLoad) {
    loadMusicCollections().catch((error) => {
      console.warn("[RB MUSIC INITIAL LOAD FAILED]", error);
      setMusicError(error);
    });
  }

  return MUSIC_REALTIME.channel;
}

export function clearMusicRealtime() {
  if (MUSIC_REALTIME.channel) {
    supabase.removeChannel(MUSIC_REALTIME.channel);
  }

  MUSIC_REALTIME.channel = null;
  MUSIC_REALTIME.refreshHandler = null;
}

export async function refreshMusicRealtime() {
  return await refreshSafe("manual");
}

window.addEventListener("beforeunload", () => {
  clearMusicRealtime();
});

console.log("RB MUSIC REALTIME READY");
