/* =========================
   RICH BIZNESS MOBILE
   /core/features/music/radio-engine.js

   RADIO ENGINE
   Radio station CRUD + playback helpers
   Uses shared Supabase client
========================= */

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  rbSelect,
  rbInsert,
  rbUpdate,
  rbDelete
} from "/core/shared/rb-supabase.js";

import {
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  getProfileIdentity
} from "/core/shared/rb-profile.js";

import {
  setRadioStations,
  upsertMusicItem,
  removeMusicItem,
  setLiked,
  setLikedIds
} from "/core/features/music/music-state.js";

import {
  playTrack
} from "/core/features/music/track-player.js";

const supabase = getSupabase();

function radioTable() {
  return RB_TABLES.radioStations || "radio_stations";
}

function radioLikesTable() {
  return RB_TABLES.radioLikes || "radio_likes";
}

function radioSessionsTable() {
  return RB_TABLES.radioSessions || "radio_sessions";
}

function requireUser() {
  const user = getUser();

  if (!user?.id) {
    throw new Error("You must be signed in.");
  }

  return user;
}

function cleanText(value = "", fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeStation(row = {}) {
  const streamUrl =
    row.stream_url ||
    row.audio_url ||
    row.url ||
    row.media_url ||
    "";

  return {
    ...row,
    title: row.title || row.name || "Rich Bizness Radio",
    name: row.name || row.title || "Rich Bizness Radio",
    stream_url: streamUrl,
    audio_url: row.audio_url || streamUrl,
    cover_url:
      row.cover_url ||
      row.image_url ||
      row.thumbnail_url ||
      "/images/brand/hero-banner.png",
    status: row.status || "active",
    genre: row.genre || row.category || "radio",
    like_count: Number(row.like_count || 0),
    listener_count: Number(row.listener_count || row.listeners || 0)
  };
}

function publicStationFilter(query) {
  return query
    .in("status", ["active", "live", "published"])
    .or("visibility.eq.public,is_public.eq.true,visibility.is.null");
}

/* =========================
   LOAD
========================= */

export async function loadRadioStations({
  limit = 50,
  publicOnly = true,
  genre = "",
  search = ""
} = {}) {
  let query = supabase
    .from(radioTable())
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (publicOnly) {
    query = publicStationFilter(query);
  }

  if (genre) {
    query = query.eq("genre", genre);
  }

  if (search) {
    query = query.or(
      `title.ilike.%${search}%,name.ilike.%${search}%,description.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) throw error;

  const stations = (data || []).map(normalizeStation);

  setRadioStations(stations);

  return stations;
}

export async function loadMyRadioStations({
  limit = 50
} = {}) {
  const user = requireUser();

  const rows = await rbSelect({
    table: radioTable(),
    select: "*",
    match: {
      user_id: user.id
    },
    orderBy: "created_at",
    ascending: false,
    limit
  });

  const stations = (rows || []).map(normalizeStation);

  setRadioStations(stations);

  return stations;
}

export async function getRadioStationById(stationId) {
  if (!stationId) return null;

  const row = await rbSelect({
    table: radioTable(),
    select: "*",
    match: {
      id: stationId
    },
    maybeSingle: true
  });

  return row ? normalizeStation(row) : null;
}

/* =========================
   CREATE / UPDATE
========================= */

export async function createRadioStation({
  title = "",
  name = "",
  description = "",
  streamUrl = "",
  audioUrl = "",
  coverUrl = "",
  genre = "",
  category = "",
  visibility = "public",
  status = "active",
  metadata = {}
} = {}) {
  const user = requireUser();
  const profile = await ensureMyProfile();
  const identity = getProfileIdentity(profile);

  const finalTitle = cleanText(title || name, "Rich Bizness Radio");
  const finalStreamUrl = cleanText(streamUrl || audioUrl);

  if (!finalStreamUrl) {
    throw new Error("Radio stream URL required.");
  }

  const rows = await rbInsert({
    table: radioTable(),
    values: {
      user_id: user.id,
      creator_id: user.id,
      username: identity.username || null,
      display_name: identity.display_name || null,
      avatar_url: identity.avatar_url || null,

      title: finalTitle,
      name: finalTitle,
      description: cleanText(description),
      stream_url: finalStreamUrl,
      audio_url: finalStreamUrl,
      cover_url: cleanText(coverUrl) || null,

      genre: cleanText(genre || category, "radio"),
      category: cleanText(category || genre, "radio"),
      visibility,
      is_public: visibility === "public",
      status,

      like_count: 0,
      listener_count: 0,

      metadata: {
        source: "radio-engine.js",
        profile_avatar: identity.avatar_url || null,
        ...metadata
      },
      updated_at: new Date().toISOString()
    }
  });

  const station = normalizeStation(rows?.[0] || {});

  upsertMusicItem(station, "radio");

  return station;
}

export async function updateRadioStation({
  stationId,
  values = {}
} = {}) {
  const user = requireUser();

  if (!stationId) {
    throw new Error("Missing radio station id.");
  }

  const cleanValues = {
    ...values,
    updated_at: new Date().toISOString()
  };

  delete cleanValues.id;
  delete cleanValues.user_id;
  delete cleanValues.creator_id;
  delete cleanValues.created_at;

  if (cleanValues.streamUrl && !cleanValues.stream_url) {
    cleanValues.stream_url = cleanValues.streamUrl;
    delete cleanValues.streamUrl;
  }

  if (cleanValues.audioUrl && !cleanValues.audio_url) {
    cleanValues.audio_url = cleanValues.audioUrl;
    delete cleanValues.audioUrl;
  }

  if (cleanValues.coverUrl && !cleanValues.cover_url) {
    cleanValues.cover_url = cleanValues.coverUrl;
    delete cleanValues.coverUrl;
  }

  if (cleanValues.title && !cleanValues.name) {
    cleanValues.name = cleanValues.title;
  }

  if (cleanValues.name && !cleanValues.title) {
    cleanValues.title = cleanValues.name;
  }

  if (cleanValues.visibility) {
    cleanValues.is_public = cleanValues.visibility === "public";
  }

  const rows = await rbUpdate({
    table: radioTable(),
    match: {
      id: stationId,
      user_id: user.id
    },
    values: cleanValues
  });

  const station = rows?.[0] ? normalizeStation(rows[0]) : null;

  if (station) {
    upsertMusicItem(station, "radio");
  }

  return station;
}

export async function deleteRadioStation(stationId) {
  const user = requireUser();

  if (!stationId) {
    throw new Error("Missing radio station id.");
  }

  await rbDelete({
    table: radioTable(),
    match: {
      id: stationId,
      user_id: user.id
    }
  });

  removeMusicItem(stationId, "radio");

  return true;
}

/* =========================
   PLAYBACK
========================= */

export async function playRadioStation(stationOrId) {
  const station =
    typeof stationOrId === "string"
      ? await getRadioStationById(stationOrId)
      : normalizeStation(stationOrId || {});

  if (!station?.id && !station?.stream_url) {
    throw new Error("Radio station not found.");
  }

  if (!station.stream_url && !station.audio_url) {
    throw new Error("Radio station has no stream URL.");
  }

  await trackRadioSession({
    stationId: station.id,
    action: "play"
  });

  return await playTrack(station, {
    type: "radio",
    autoplay: true
  });
}

export async function trackRadioSession({
  stationId,
  action = "play",
  metadata = {}
} = {}) {
  if (!stationId) return null;

  const user = getUser();

  try {
    const rows = await rbInsert({
      table: radioSessionsTable(),
      values: {
        station_id: stationId,
        user_id: user?.id || null,
        action,
        session_id:
          localStorage.getItem("rb_session_id") ||
          crypto.randomUUID(),
        metadata: {
          source: "radio-engine.js",
          ...metadata
        }
      }
    });

    await syncRadioListenerCount(stationId);

    return rows?.[0] || null;
  } catch (error) {
    console.warn("[RB RADIO SESSION SKIPPED]", error?.message || error);
    return null;
  }
}

export async function syncRadioListenerCount(stationId) {
  if (!stationId) return 0;

  const { count, error } = await supabase
    .from(radioSessionsTable())
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("station_id", stationId)
    .eq("action", "play");

  if (error) {
    console.warn("[RB RADIO LISTENER COUNT WARNING]", error.message);
    return 0;
  }

  const finalCount = count || 0;

  await rbUpdate({
    table: radioTable(),
    match: {
      id: stationId
    },
    values: {
      listener_count: finalCount,
      updated_at: new Date().toISOString()
    }
  });

  return finalCount;
}

/* =========================
   LIKES
========================= */

export async function loadMyRadioLikes() {
  const user = getUser();

  if (!user?.id) {
    setLikedIds({
      type: "radio",
      ids: []
    });

    return [];
  }

  const rows = await rbSelect({
    table: radioLikesTable(),
    select: "station_id,radio_station_id",
    match: {
      user_id: user.id
    }
  });

  const ids = (rows || [])
    .map((row) => row.station_id || row.radio_station_id)
    .filter(Boolean);

  setLikedIds({
    type: "radio",
    ids
  });

  return ids;
}

export async function toggleRadioLike(stationId) {
  const user = requireUser();

  if (!stationId) {
    throw new Error("Missing radio station id.");
  }

  const { data: existing } = await supabase
    .from(radioLikesTable())
    .select("id")
    .eq("user_id", user.id)
    .or(`station_id.eq.${stationId},radio_station_id.eq.${stationId}`)
    .maybeSingle();

  let liked = false;

  if (existing?.id) {
    const { error } = await supabase
      .from(radioLikesTable())
      .delete()
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from(radioLikesTable())
      .insert({
        user_id: user.id,
        station_id: stationId,
        radio_station_id: stationId
      });

    if (error) throw error;

    liked = true;
  }

  const count = await syncRadioLikeCount(stationId);

  setLiked("radio", stationId, liked);

  return {
    liked,
    count
  };
}

export async function syncRadioLikeCount(stationId) {
  if (!stationId) return 0;

  const { count, error } = await supabase
    .from(radioLikesTable())
    .select("id", {
      count: "exact",
      head: true
    })
    .or(`station_id.eq.${stationId},radio_station_id.eq.${stationId}`);

  if (error) throw error;

  const finalCount = count || 0;

  const rows = await rbUpdate({
    table: radioTable(),
    match: {
      id: stationId
    },
    values: {
      like_count: finalCount,
      updated_at: new Date().toISOString()
    }
  });

  if (rows?.[0]) {
    upsertMusicItem(normalizeStation(rows[0]), "radio");
  }

  return finalCount;
}

/* =========================
   BOOT
========================= */

export async function initRadioEngine() {
  const stations = await loadRadioStations();
  await loadMyRadioLikes();

  console.log("RB RADIO ENGINE READY");

  return stations;
}

console.log("RB RADIO ENGINE LOADED");
