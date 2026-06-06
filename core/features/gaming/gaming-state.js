/* =========================
   RICH BIZNESS MOBILE
   /core/features/gaming/gaming-state.js

   GLOBAL GAMING STATE
   Games + Clips + Gamer Profiles
   Profile Keys Locked
   Realtime Ready
========================= */

import { getSupabase } from "/core/shared/rb-supabase.js";
import { RB_TABLES, RB_ROUTES } from "/core/shared/rb-config.js";

const GAMING_STATE = {
  ready: false,
  loading: false,

  games: [],
  clips: [],
  uploads: [],
  featuredGame: null,
  featuredClip: null,

  gamerProfile: null,

  gameCount: 0,
  clipCount: 0,
  uploadCount: 0,
  featuredCount: 0,

  channels: [],
  listeners: new Set()
};

const FALLBACK_GAME_COVER = "/images/brand/gaming-hero.png.jpeg";
const FALLBACK_CLIP_COVER = "/images/brand/hero-banner.png";

function emitGamingState() {
  const snapshot = getGamingState();

  GAMING_STATE.listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn("[RB GAMING STATE LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:gaming-state-update", {
      detail: snapshot
    })
  );

  window.dispatchEvent(
    new CustomEvent("rb:activity-update", {
      detail: {
        gaming: {
          active: snapshot.clipCount > 0 || snapshot.gameCount > 0,
          gameCount: snapshot.gameCount,
          clipCount: snapshot.clipCount,
          featuredGame: snapshot.featuredGame,
          featuredClip: snapshot.featuredClip
        }
      }
    })
  );
}

function normalizeGame(row = {}) {
  return {
    ...row,

    title:
      row.title ||
      row.name ||
      row.game_name ||
      "Rich Bizness Game",

    slug:
      row.slug ||
      row.game_slug ||
      row.id,

    cover_url:
      row.cover_url ||
      row.thumbnail_url ||
      row.image_url ||
      FALLBACK_GAME_COVER,

    thumbnail_url:
      row.thumbnail_url ||
      row.cover_url ||
      row.image_url ||
      FALLBACK_GAME_COVER,

    target_url:
      row.target_url ||
      `${RB_ROUTES.gaming || "/gaming"}?game=${encodeURIComponent(
        row.slug || row.game_slug || row.id || ""
      )}`
  };
}

function normalizeClip(row = {}) {
  const profile = row.profiles || row.profile || null;

  return {
    ...row,

    title:
      row.title ||
      row.clip_title ||
      row.caption ||
      "Rich Bizness Clip",

    cover_url:
      row.cover_url ||
      row.thumbnail_url ||
      row.image_url ||
      FALLBACK_CLIP_COVER,

    thumbnail_url:
      row.thumbnail_url ||
      row.cover_url ||
      row.image_url ||
      FALLBACK_CLIP_COVER,

    media_url:
      row.media_url ||
      row.video_url ||
      row.file_url ||
      row.clip_url ||
      row.public_url ||
      "",

    display_name:
      row.display_name ||
      profile?.display_name ||
      profile?.full_name ||
      profile?.username ||
      "Rich Gamer",

    username:
      row.username ||
      profile?.username ||
      "gamer",

    avatar_url:
      row.avatar_url ||
      profile?.avatar_url ||
      "/images/brand/Avatar-hero-Banner.png.jpeg",

    target_url:
      row.target_url ||
      `${RB_ROUTES.gaming || "/gaming"}?clip=${encodeURIComponent(row.id || "")}`
  };
}

function tableExists(key) {
  return Boolean(RB_TABLES?.[key]);
}

export function getGamingState() {
  return {
    ready: GAMING_STATE.ready,
    loading: GAMING_STATE.loading,

    games: [...GAMING_STATE.games],
    clips: [...GAMING_STATE.clips],
    uploads: [...GAMING_STATE.uploads],

    featuredGame: GAMING_STATE.featuredGame,
    featuredClip: GAMING_STATE.featuredClip,
    gamerProfile: GAMING_STATE.gamerProfile,

    gameCount: GAMING_STATE.gameCount,
    clipCount: GAMING_STATE.clipCount,
    uploadCount: GAMING_STATE.uploadCount,
    featuredCount: GAMING_STATE.featuredCount
  };
}

export function onGamingState(listener) {
  if (typeof listener !== "function") return () => {};

  GAMING_STATE.listeners.add(listener);
  listener(getGamingState());

  return () => {
    GAMING_STATE.listeners.delete(listener);
  };
}

export async function loadGames({ limit = 30 } = {}) {
  const supabase = getSupabase();
  if (!supabase || !tableExists("games")) return [];

  const { data, error } = await supabase
    .from(RB_TABLES.games)
    .select("*")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const games = (data || []).map(normalizeGame);

  GAMING_STATE.games = games;
  GAMING_STATE.gameCount = games.length;
  GAMING_STATE.featuredGame = games.find((item) => item.is_featured) || games[0] || null;

  return games;
}

export async function loadGameClips({ limit = 40 } = {}) {
  const supabase = getSupabase();
  if (!supabase || !tableExists("gameClips")) return [];

  const { data, error } = await supabase
    .from(RB_TABLES.gameClips)
    .select(`
      *,
      profiles:user_id (
        username,
        display_name,
        full_name,
        avatar_url,
        banner_url
      )
    `)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const clips = (data || []).map(normalizeClip);

  GAMING_STATE.clips = clips;
  GAMING_STATE.clipCount = clips.length;
  GAMING_STATE.featuredClip = clips.find((item) => item.is_featured) || clips[0] || null;
  GAMING_STATE.featuredCount = clips.filter((item) => item.is_featured).length;

  return clips;
}

export async function loadGamingUploads({ limit = 30 } = {}) {
  const supabase = getSupabase();
  if (!supabase || !tableExists("gamingUploads")) return [];

  const { data, error } = await supabase
    .from(RB_TABLES.gamingUploads)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  GAMING_STATE.uploads = data || [];
  GAMING_STATE.uploadCount = GAMING_STATE.uploads.length;

  return GAMING_STATE.uploads;
}

export async function loadMyGamerProfile(userId) {
  const supabase = getSupabase();

  if (!supabase || !userId || !tableExists("gamerProfiles")) {
    GAMING_STATE.gamerProfile = null;
    return null;
  }

  const { data, error } = await supabase
    .from(RB_TABLES.gamerProfiles)
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  GAMING_STATE.gamerProfile = data || null;

  return GAMING_STATE.gamerProfile;
}

export async function refreshGamingState({
  userId = null,
  limit = 40,
  includeUploads = true
} = {}) {
  const supabase = getSupabase();

  if (!supabase) {
    GAMING_STATE.ready = false;
    GAMING_STATE.loading = false;
    emitGamingState();
    return getGamingState();
  }

  GAMING_STATE.loading = true;
  emitGamingState();

  try {
    await Promise.all([
      loadGames({ limit: 30 }),
      loadGameClips({ limit }),
      includeUploads ? loadGamingUploads({ limit: 30 }) : Promise.resolve([]),
      userId ? loadMyGamerProfile(userId) : Promise.resolve(null)
    ]);

    GAMING_STATE.ready = true;
  } catch (error) {
    console.warn("[RB GAMING STATE REFRESH]", error?.message || error);

    GAMING_STATE.ready = false;
    GAMING_STATE.games = [];
    GAMING_STATE.clips = [];
    GAMING_STATE.uploads = [];
    GAMING_STATE.featuredGame = null;
    GAMING_STATE.featuredClip = null;
    GAMING_STATE.gameCount = 0;
    GAMING_STATE.clipCount = 0;
    GAMING_STATE.uploadCount = 0;
    GAMING_STATE.featuredCount = 0;
  } finally {
    GAMING_STATE.loading = false;
    emitGamingState();
  }

  return getGamingState();
}

export async function loadCreatorGameClips(creatorId, limit = 24) {
  if (!creatorId || !tableExists("gameClips")) return [];

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.gameClips)
    .select("*")
    .eq("user_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[RB CREATOR GAME CLIPS]", error);
    return [];
  }

  return (data || []).map(normalizeClip);
}

export async function searchGaming(queryText = "", limit = 30) {
  const q = String(queryText || "").trim();

  if (!q) {
    await refreshGamingState({ limit });
    return getGamingState();
  }

  const supabase = getSupabase();

  const safeQ = q.replaceAll(",", " ").replaceAll("%", "");

  const tasks = [];

  if (tableExists("games")) {
    tasks.push(
      supabase
        .from(RB_TABLES.games)
        .select("*")
        .or(`title.ilike.%${safeQ}%,name.ilike.%${safeQ}%,description.ilike.%${safeQ}%,category.ilike.%${safeQ}%`)
        .order("created_at", { ascending: false })
        .limit(limit)
    );
  }

  if (tableExists("gameClips")) {
    tasks.push(
      supabase
        .from(RB_TABLES.gameClips)
        .select(`
          *,
          profiles:user_id (
            username,
            display_name,
            full_name,
            avatar_url
          )
        `)
        .or(`title.ilike.%${safeQ}%,caption.ilike.%${safeQ}%,description.ilike.%${safeQ}%,game_slug.ilike.%${safeQ}%`)
        .order("created_at", { ascending: false })
        .limit(limit)
    );
  }

  const results = await Promise.allSettled(tasks);

  const gameRes = results[0]?.status === "fulfilled" ? results[0].value : null;
  const clipRes = results[1]?.status === "fulfilled" ? results[1].value : null;

  if (gameRes?.error) console.warn("[RB GAMING SEARCH GAMES]", gameRes.error);
  if (clipRes?.error) console.warn("[RB GAMING SEARCH CLIPS]", clipRes.error);

  GAMING_STATE.games = (gameRes?.data || []).map(normalizeGame);
  GAMING_STATE.clips = (clipRes?.data || []).map(normalizeClip);

  GAMING_STATE.gameCount = GAMING_STATE.games.length;
  GAMING_STATE.clipCount = GAMING_STATE.clips.length;

  GAMING_STATE.featuredGame = GAMING_STATE.games[0] || null;
  GAMING_STATE.featuredClip = GAMING_STATE.clips[0] || null;
  GAMING_STATE.ready = true;

  emitGamingState();

  return getGamingState();
}

export function clearGamingRealtime() {
  const supabase = getSupabase();

  GAMING_STATE.channels.forEach((channel) => {
    supabase?.removeChannel(channel);
  });

  GAMING_STATE.channels = [];
}

export function bindGamingRealtime({
  userId = null,
  includeUploads = true
} = {}) {
  const supabase = getSupabase();
  if (!supabase) return [];

  clearGamingRealtime();

  const reload = () => {
    refreshGamingState({
      userId,
      includeUploads
    }).catch((error) => {
      console.warn("[RB GAMING REALTIME REFRESH]", error);
    });
  };

  const tables = [
    tableExists("games") ? RB_TABLES.games : null,
    tableExists("gameClips") ? RB_TABLES.gameClips : null,
    includeUploads && tableExists("gamingUploads") ? RB_TABLES.gamingUploads : null,
    userId && tableExists("gamerProfiles") ? RB_TABLES.gamerProfiles : null
  ].filter(Boolean);

  GAMING_STATE.channels = tables.map((table) =>
    supabase
      .channel(`rb-gaming-${table}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table
        },
        reload
      )
      .subscribe()
  );

  return GAMING_STATE.channels;
}

export async function initGamingState({
  userId = null,
  realtime = true,
  includeUploads = true,
  limit = 40
} = {}) {
  await refreshGamingState({
    userId,
    includeUploads,
    limit
  });

  if (realtime) {
    bindGamingRealtime({
      userId,
      includeUploads
    });
  }

  return getGamingState();
}

window.addEventListener("beforeunload", clearGamingRealtime);

console.log("RB GAMING STATE READY");
