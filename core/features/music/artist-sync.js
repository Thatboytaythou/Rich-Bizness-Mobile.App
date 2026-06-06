/* =========================
   RICH BIZNESS MOBILE
   /core/features/music/artist-sync.js

   ARTIST SYNC ENGINE
   Keeps music creator identity synced
   profiles -> music_tracks / podcast_episodes / radio_stations
========================= */

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  getProfile,
  rbUpdate
} from "/core/shared/rb-supabase.js";

import {
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  getProfileIdentity,
  refreshMyProfile
} from "/core/shared/rb-profile.js";

import {
  refreshProfileState
} from "/core/features/profile/profile-state.js";

import {
  setTracks,
  setPodcasts,
  setRadioStations
} from "/core/features/music/music-state.js";

const supabase = getSupabase();

function requireUser() {
  const user = getUser();

  if (!user?.id) {
    throw new Error("You must be signed in.");
  }

  return user;
}

function now() {
  return new Date().toISOString();
}

function tracksTable() {
  return RB_TABLES.musicTracks || "music_tracks";
}

function podcastTable() {
  return RB_TABLES.podcastEpisodes || "podcast_episodes";
}

function radioTable() {
  return RB_TABLES.radioStations || "radio_stations";
}

function artistPayload(profile = getProfile()) {
  const identity = getProfileIdentity(profile);

  return {
    artist_user_id: identity.user_id,
    creator_id: identity.user_id,
    user_id: identity.user_id,

    username: identity.username || null,
    display_name: identity.display_name || null,
    artist_name: identity.display_name || identity.username || "Rich Artist",
    creator_name: identity.display_name || identity.username || "Rich Creator",
    avatar_url: identity.avatar_url || null,

    updated_at: now()
  };
}

function removeUnsafeIdentityKeys(payload = {}) {
  const clean = { ...payload };

  delete clean.id;
  delete clean.created_at;

  return clean;
}

async function updateByPossibleOwnerColumns({
  table,
  userId,
  values
}) {
  const ownerColumns = [
    "artist_user_id",
    "creator_id",
    "user_id"
  ];

  const results = [];

  for (const column of ownerColumns) {
    try {
      const data = await rbUpdate({
        table,
        match: {
          [column]: userId
        },
        values
      });

      results.push({
        table,
        column,
        count: Array.isArray(data) ? data.length : 0,
        data
      });
    } catch (error) {
      console.warn(
        `[RB ARTIST SYNC SKIPPED: ${table}.${column}]`,
        error?.message || error
      );
    }
  }

  return results;
}

/* =========================
   TRACK SYNC
========================= */

export async function syncArtistTracks(profileOverride = null) {
  const user = requireUser();
  const profile = profileOverride || getProfile() || await ensureMyProfile();

  const values = removeUnsafeIdentityKeys({
    ...artistPayload(profile),
    metadata: {
      source: "artist-sync.js",
      synced_at: now(),
      sync_type: "music_tracks"
    }
  });

  const results = await updateByPossibleOwnerColumns({
    table: tracksTable(),
    userId: user.id,
    values
  });

  await refreshMyTracks();

  return results;
}

export async function refreshMyTracks() {
  const user = getUser();
  if (!user?.id) return [];

  const { data, error } = await supabase
    .from(tracksTable())
    .select("*")
    .or(`artist_user_id.eq.${user.id},creator_id.eq.${user.id},user_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[RB ARTIST TRACK REFRESH WARNING]", error.message);
    return [];
  }

  setTracks(data || []);
  return data || [];
}

/* =========================
   PODCAST SYNC
========================= */

export async function syncArtistPodcasts(profileOverride = null) {
  const user = requireUser();
  const profile = profileOverride || getProfile() || await ensureMyProfile();

  const values = removeUnsafeIdentityKeys({
    ...artistPayload(profile),
    metadata: {
      source: "artist-sync.js",
      synced_at: now(),
      sync_type: "podcast_episodes"
    }
  });

  const results = await updateByPossibleOwnerColumns({
    table: podcastTable(),
    userId: user.id,
    values
  });

  await refreshMyPodcasts();

  return results;
}

export async function refreshMyPodcasts() {
  const user = getUser();
  if (!user?.id) return [];

  const { data, error } = await supabase
    .from(podcastTable())
    .select("*")
    .or(`artist_user_id.eq.${user.id},creator_id.eq.${user.id},user_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[RB ARTIST PODCAST REFRESH WARNING]", error.message);
    return [];
  }

  setPodcasts(data || []);
  return data || [];
}

/* =========================
   RADIO SYNC
========================= */

export async function syncArtistRadio(profileOverride = null) {
  const user = requireUser();
  const profile = profileOverride || getProfile() || await ensureMyProfile();

  const values = removeUnsafeIdentityKeys({
    ...artistPayload(profile),
    metadata: {
      source: "artist-sync.js",
      synced_at: now(),
      sync_type: "radio_stations"
    }
  });

  const results = await updateByPossibleOwnerColumns({
    table: radioTable(),
    userId: user.id,
    values
  });

  await refreshMyRadio();

  return results;
}

export async function refreshMyRadio() {
  const user = getUser();
  if (!user?.id) return [];

  const { data, error } = await supabase
    .from(radioTable())
    .select("*")
    .or(`artist_user_id.eq.${user.id},creator_id.eq.${user.id},user_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[RB ARTIST RADIO REFRESH WARNING]", error.message);
    return [];
  }

  setRadioStations(data || []);
  return data || [];
}

/* =========================
   FULL SYNC
========================= */

export async function syncArtistIdentity(profileOverride = null) {
  const user = requireUser();

  await ensureMyProfile();
  await refreshMyProfile();
  await refreshProfileState();

  const profile = profileOverride || getProfile() || await ensureMyProfile();

  const [tracks, podcasts, radio] = await Promise.allSettled([
    syncArtistTracks(profile),
    syncArtistPodcasts(profile),
    syncArtistRadio(profile)
  ]);

  const result = {
    user_id: user.id,
    profile,
    tracks,
    podcasts,
    radio,
    synced_at: now()
  };

  window.dispatchEvent(
    new CustomEvent("rb:artist-sync", {
      detail: result
    })
  );

  return result;
}

export async function refreshArtistMusicState() {
  const [tracks, podcasts, radio] = await Promise.allSettled([
    refreshMyTracks(),
    refreshMyPodcasts(),
    refreshMyRadio()
  ]);

  return {
    tracks,
    podcasts,
    radio
  };
}

/* =========================
   AUTO BIND
========================= */

export function bindArtistSyncEvents() {
  if (window.__RB_ARTIST_SYNC_BOUND__) return;

  window.__RB_ARTIST_SYNC_BOUND__ = true;

  window.addEventListener("rb:profile-updated", async () => {
    if (!getUser()?.id) return;

    try {
      await syncArtistIdentity();
    } catch (error) {
      console.warn("[RB ARTIST AUTO SYNC SKIPPED]", error?.message || error);
    }
  });

  window.addEventListener("rb:app-identity-refreshed", async () => {
    if (!getUser()?.id) return;

    try {
      await refreshArtistMusicState();
    } catch (error) {
      console.warn("[RB ARTIST MUSIC REFRESH SKIPPED]", error?.message || error);
    }
  });
}

bindArtistSyncEvents();

console.log("RB ARTIST SYNC READY");
