/* =========================
   RICH BIZNESS MOBILE
   /core/features/music/playlist-engine.js

   PLAYLIST ENGINE
   Playlist CRUD + Track Ordering
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

const supabase = getSupabase();

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

function cleanVisibility(value = "public") {
  const clean = cleanText(value, "public").toLowerCase();

  return ["public", "private", "followers", "unlisted"].includes(clean)
    ? clean
    : "public";
}

function playlistTable() {
  return RB_TABLES.playlists || "playlists";
}

function playlistTracksTable() {
  return RB_TABLES.playlistTracks || "playlist_tracks";
}

function tracksTable() {
  return RB_TABLES.musicTracks || "music_tracks";
}

function normalizePlaylist(row = {}) {
  return {
    ...row,
    title: row.title || row.name || "Untitled Playlist",
    name: row.name || row.title || "Untitled Playlist",
    visibility: row.visibility || "public",
    track_count: Number(row.track_count || 0)
  };
}

function normalizePlaylistTrack(row = {}) {
  return {
    ...row,
    position: Number(row.position || row.sort_order || 0),
    sort_order: Number(row.sort_order || row.position || 0)
  };
}

/* =========================
   PLAYLISTS
========================= */

export async function createPlaylist({
  title = "",
  name = "",
  description = "",
  coverUrl = "",
  visibility = "public",
  metadata = {}
} = {}) {
  const user = requireUser();
  const profile = await ensureMyProfile();
  const identity = getProfileIdentity(profile);

  const finalTitle = cleanText(title || name, "New Playlist");

  const rows = await rbInsert({
    table: playlistTable(),
    values: {
      user_id: user.id,
      creator_id: user.id,
      username: identity.username || null,
      display_name: identity.display_name || null,

      title: finalTitle,
      name: finalTitle,
      description: cleanText(description),
      cover_url: cleanText(coverUrl) || null,
      visibility: cleanVisibility(visibility),

      track_count: 0,
      is_public: cleanVisibility(visibility) === "public",

      metadata: {
        source: "playlist-engine.js",
        profile_avatar: identity.avatar_url || null,
        ...metadata
      },
      updated_at: new Date().toISOString()
    }
  });

  return normalizePlaylist(rows?.[0] || {});
}

export async function updatePlaylist({
  playlistId,
  values = {}
} = {}) {
  const user = requireUser();

  if (!playlistId) {
    throw new Error("Missing playlist id.");
  }

  const cleanValues = {
    ...values,
    updated_at: new Date().toISOString()
  };

  delete cleanValues.id;
  delete cleanValues.user_id;
  delete cleanValues.creator_id;
  delete cleanValues.created_at;

  if (cleanValues.title && !cleanValues.name) {
    cleanValues.name = cleanValues.title;
  }

  if (cleanValues.name && !cleanValues.title) {
    cleanValues.title = cleanValues.name;
  }

  if (cleanValues.visibility) {
    cleanValues.visibility = cleanVisibility(cleanValues.visibility);
    cleanValues.is_public = cleanValues.visibility === "public";
  }

  const rows = await rbUpdate({
    table: playlistTable(),
    match: {
      id: playlistId,
      user_id: user.id
    },
    values: cleanValues
  });

  return rows?.[0] ? normalizePlaylist(rows[0]) : null;
}

export async function deletePlaylist(playlistId) {
  const user = requireUser();

  if (!playlistId) {
    throw new Error("Missing playlist id.");
  }

  await rbDelete({
    table: playlistTracksTable(),
    match: {
      playlist_id: playlistId
    }
  });

  await rbDelete({
    table: playlistTable(),
    match: {
      id: playlistId,
      user_id: user.id
    }
  });

  return true;
}

export async function loadMyPlaylists({
  limit = 50
} = {}) {
  const user = requireUser();

  const rows = await rbSelect({
    table: playlistTable(),
    select: "*",
    match: {
      user_id: user.id
    },
    orderBy: "updated_at",
    ascending: false,
    limit
  });

  return (rows || []).map(normalizePlaylist);
}

export async function loadPublicPlaylists({
  limit = 50
} = {}) {
  const { data, error } = await supabase
    .from(playlistTable())
    .select("*")
    .or("visibility.eq.public,is_public.eq.true")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map(normalizePlaylist);
}

export async function getPlaylistById(playlistId) {
  if (!playlistId) return null;

  const row = await rbSelect({
    table: playlistTable(),
    select: "*",
    match: {
      id: playlistId
    },
    maybeSingle: true
  });

  return row ? normalizePlaylist(row) : null;
}

/* =========================
   PLAYLIST TRACKS
========================= */

export async function loadPlaylistTracks(playlistId) {
  if (!playlistId) return [];

  const { data, error } = await supabase
    .from(playlistTracksTable())
    .select(`
      *,
      track:${tracksTable()}(*)
    `)
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  if (error) {
    console.warn("[RB PLAYLIST TRACK LOAD WARNING]", error.message);

    const fallback = await rbSelect({
      table: playlistTracksTable(),
      select: "*",
      match: {
        playlist_id: playlistId
      },
      orderBy: "position",
      ascending: true
    });

    return (fallback || []).map(normalizePlaylistTrack);
  }

  return (data || []).map(normalizePlaylistTrack);
}

export async function getNextPlaylistPosition(playlistId) {
  if (!playlistId) return 0;

  const { data, error } = await supabase
    .from(playlistTracksTable())
    .select("position,sort_order")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return 0;

  return Number(data.position || data.sort_order || 0) + 1;
}

export async function addTrackToPlaylist({
  playlistId,
  trackId,
  position = null,
  metadata = {}
} = {}) {
  const user = requireUser();

  if (!playlistId) {
    throw new Error("Missing playlist id.");
  }

  if (!trackId) {
    throw new Error("Missing track id.");
  }

  const finalPosition =
    position === null || position === undefined
      ? await getNextPlaylistPosition(playlistId)
      : Number(position || 0);

  const { data, error } = await supabase
    .from(playlistTracksTable())
    .upsert(
      {
        playlist_id: playlistId,
        track_id: trackId,
        user_id: user.id,
        position: finalPosition,
        sort_order: finalPosition,
        metadata: {
          source: "playlist-engine.js",
          ...metadata
        },
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "playlist_id,track_id"
      }
    )
    .select("*")
    .maybeSingle();

  if (error) throw error;

  await syncPlaylistTrackCount(playlistId);

  return normalizePlaylistTrack(data || {});
}

export async function removeTrackFromPlaylist({
  playlistId,
  trackId
} = {}) {
  requireUser();

  if (!playlistId || !trackId) {
    throw new Error("Missing playlist id or track id.");
  }

  await rbDelete({
    table: playlistTracksTable(),
    match: {
      playlist_id: playlistId,
      track_id: trackId
    }
  });

  await syncPlaylistTrackCount(playlistId);

  return true;
}

export async function reorderPlaylistTracks({
  playlistId,
  orderedTrackIds = []
} = {}) {
  requireUser();

  if (!playlistId) {
    throw new Error("Missing playlist id.");
  }

  if (!Array.isArray(orderedTrackIds)) {
    throw new Error("orderedTrackIds must be an array.");
  }

  const updates = orderedTrackIds.map((trackId, index) => {
    return supabase
      .from(playlistTracksTable())
      .update({
        position: index,
        sort_order: index,
        updated_at: new Date().toISOString()
      })
      .eq("playlist_id", playlistId)
      .eq("track_id", trackId);
  });

  await Promise.allSettled(updates);

  return await loadPlaylistTracks(playlistId);
}

export async function syncPlaylistTrackCount(playlistId) {
  if (!playlistId) return null;

  const { count, error } = await supabase
    .from(playlistTracksTable())
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("playlist_id", playlistId);

  if (error) {
    console.warn("[RB PLAYLIST COUNT WARNING]", error.message);
    return null;
  }

  const rows = await rbUpdate({
    table: playlistTable(),
    match: {
      id: playlistId
    },
    values: {
      track_count: count || 0,
      updated_at: new Date().toISOString()
    }
  });

  return rows?.[0] ? normalizePlaylist(rows[0]) : null;
}

/* =========================
   QUICK HELPERS
========================= */

export async function toggleTrackInPlaylist({
  playlistId,
  trackId
} = {}) {
  if (!playlistId || !trackId) {
    throw new Error("Missing playlist id or track id.");
  }

  const existing = await rbSelect({
    table: playlistTracksTable(),
    select: "*",
    match: {
      playlist_id: playlistId,
      track_id: trackId
    },
    maybeSingle: true
  });

  if (existing?.id) {
    await removeTrackFromPlaylist({
      playlistId,
      trackId
    });

    return {
      added: false,
      removed: true
    };
  }

  const row = await addTrackToPlaylist({
    playlistId,
    trackId
  });

  return {
    added: true,
    removed: false,
    row
  };
}

export async function createPlaylistAndAddTrack({
  title = "New Playlist",
  trackId,
  visibility = "public"
} = {}) {
  const playlist = await createPlaylist({
    title,
    visibility
  });

  if (trackId) {
    await addTrackToPlaylist({
      playlistId: playlist.id,
      trackId
    });
  }

  return {
    playlist,
    tracks: playlist.id ? await loadPlaylistTracks(playlist.id) : []
  };
}

console.log("RB PLAYLIST ENGINE READY");
