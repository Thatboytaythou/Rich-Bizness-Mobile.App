/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-rail.js

   LIVE RAIL ENGINE
   Watch rail + homepage live cards + realtime discovery
========================= */

import { getSupabase } from "/core/shared/rb-supabase.js";

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

const RAIL = {
  streams: [],
  featured: [],
  cards: [],

  channel: null,
  listeners: new Set(),

  limit: 20,
  statusFilter: ["live", "scheduled"]
};

const DEFAULT_THUMBNAIL = "/images/brand/Avatar-hero-Banner.png.jpeg";

function emitRail() {
  const state = getLiveRailState();

  RAIL.listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      console.warn("[RB LIVE RAIL LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-live-rail-update", {
      detail: state
    })
  );
}

function watchUrl(stream) {
  if (!stream) return RB_ROUTES.watch || "/watch";

  return `${RB_ROUTES.watch || "/watch"}?stream=${encodeURIComponent(
    stream.slug || stream.id
  )}`;
}

function normalizeStream(row = {}) {
  const profile = row.profiles || row.profile || null;

  return {
    ...row,

    display_name:
      row.display_name ||
      profile?.display_name ||
      profile?.full_name ||
      profile?.username ||
      "Rich Creator",

    username:
      row.username ||
      profile?.username ||
      "creator",

    avatar_url:
      row.avatar_url ||
      profile?.avatar_url ||
      DEFAULT_THUMBNAIL,

    thumbnail_url:
      row.thumbnail_url ||
      row.cover_url ||
      DEFAULT_THUMBNAIL,

    cover_url:
      row.cover_url ||
      row.thumbnail_url ||
      DEFAULT_THUMBNAIL,

    target_url:
      row.target_url ||
      watchUrl(row)
  };
}

function normalizeCard(row = {}) {
  return {
    ...row,
    thumbnail_url:
      row.thumbnail_url ||
      row.cover_url ||
      DEFAULT_THUMBNAIL,

    cover_url:
      row.cover_url ||
      row.thumbnail_url ||
      DEFAULT_THUMBNAIL,

    target_url:
      row.target_url ||
      watchUrl(row)
  };
}

export function getLiveRailState() {
  return {
    streams: [...RAIL.streams],
    featured: [...RAIL.featured],
    cards: [...RAIL.cards],
    limit: RAIL.limit,
    statusFilter: [...RAIL.statusFilter]
  };
}

export function onLiveRail(listener) {
  if (typeof listener !== "function") return () => {};

  RAIL.listeners.add(listener);
  listener(getLiveRailState());

  return () => {
    RAIL.listeners.delete(listener);
  };
}

export async function loadLiveRail({
  limit = RAIL.limit,
  statusFilter = RAIL.statusFilter
} = {}) {
  const supabase = getSupabase();

  RAIL.limit = limit;
  RAIL.statusFilter = statusFilter;

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreams)
    .select(`
      *,
      profiles:creator_id (
        username,
        display_name,
        full_name,
        avatar_url,
        banner_url
      )
    `)
    .in("status", statusFilter)
    .order("status", { ascending: true })
    .order("is_featured", { ascending: false })
    .order("viewer_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[RB LIVE RAIL LOAD]", error);
    RAIL.streams = [];
    RAIL.featured = [];
    emitRail();
    return [];
  }

  RAIL.streams = (data || []).map(normalizeStream);

  RAIL.featured = RAIL.streams.filter(
    (stream) => stream.is_featured || stream.status === "live"
  );

  emitRail();

  return RAIL.streams;
}

export async function loadLiveCards({
  limit = 20,
  activeOnly = true
} = {}) {
  const supabase = getSupabase();

  let query = supabase
    .from(RB_TABLES.liveStreamCards)
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[RB LIVE CARDS LOAD]", error);
    RAIL.cards = [];
    emitRail();
    return [];
  }

  RAIL.cards = (data || []).map(normalizeCard);
  emitRail();

  return RAIL.cards;
}

export async function loadFeaturedLiveRail(limit = 8) {
  await loadLiveRail({
    limit,
    statusFilter: ["live", "scheduled"]
  });

  return RAIL.featured.slice(0, limit);
}

export async function loadCreatorLiveRail(creatorId, limit = 12) {
  if (!creatorId) return [];

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreams)
    .select("*")
    .eq("creator_id", creatorId)
    .in("status", ["live", "scheduled", "draft", "ended"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[RB CREATOR LIVE RAIL]", error);
    return [];
  }

  return (data || []).map(normalizeStream);
}

export async function searchLiveRail(queryText = "", limit = 20) {
  const q = String(queryText || "").trim();

  if (!q) {
    return loadLiveRail({ limit });
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreams)
    .select(`
      *,
      profiles:creator_id (
        username,
        display_name,
        full_name,
        avatar_url,
        banner_url
      )
    `)
    .or(
      `title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%,display_slug.ilike.%${q}%`
    )
    .in("status", ["live", "scheduled"])
    .order("viewer_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[RB LIVE RAIL SEARCH]", error);
    return [];
  }

  RAIL.streams = (data || []).map(normalizeStream);
  RAIL.featured = RAIL.streams.filter((stream) => stream.status === "live");

  emitRail();

  return RAIL.streams;
}

export async function upsertLiveRailCard(stream) {
  if (!stream?.id) return null;

  const supabase = getSupabase();

  const payload = {
    stream_id: stream.id,
    creator_id: stream.creator_id,
    title: stream.title,
    subtitle: stream.description,
    card_type: stream.status === "live" ? "live" : "highlight",
    thumbnail_url: stream.thumbnail_url,
    cover_url: stream.cover_url,
    target_url: watchUrl(stream),
    is_active: ["live", "scheduled", "draft"].includes(stream.status),
    metadata: {
      source: "live-rail.js",
      status: stream.status,
      slug: stream.slug
    },
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreamCards)
    .upsert(payload, {
      onConflict: "stream_id"
    })
    .select("*")
    .single();

  if (error) {
    console.warn("[RB LIVE RAIL CARD UPSERT]", error);
    throw error;
  }

  await loadLiveCards();

  return data;
}

export function clearLiveRailRealtime() {
  const supabase = getSupabase();

  if (RAIL.channel) {
    supabase.removeChannel(RAIL.channel);
  }

  RAIL.channel = null;
}

export function bindLiveRailRealtime() {
  const supabase = getSupabase();

  clearLiveRailRealtime();

  RAIL.channel = supabase
    .channel("rb-live-rail")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.liveStreams
      },
      async (payload) => {
        if (payload.new?.id) {
          await upsertLiveRailCard(payload.new);
        }

        await loadLiveRail();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.liveStreamCards
      },
      () => loadLiveCards()
    )
    .subscribe();

  return RAIL.channel;
}

export async function initLiveRail({
  limit = 20,
  realtime = true,
  loadCards = true
} = {}) {
  await loadLiveRail({ limit });

  if (loadCards) {
    await loadLiveCards({ limit });
  }

  if (realtime) {
    bindLiveRailRealtime();
  }

  return getLiveRailState();
}

window.addEventListener("beforeunload", clearLiveRailRealtime);

console.log("RB LIVE RAIL READY");
