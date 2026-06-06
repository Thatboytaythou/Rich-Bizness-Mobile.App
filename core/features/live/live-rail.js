/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-rail.js

   LIVE RAIL ENGINE
   Watch rail + homepage live cards + realtime discovery
   Safe Loader + Card Sync
========================= */

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

const DEFAULT_THUMBNAIL = "/images/brand/Avatar-hero-Banner.png.jpeg";

const RAIL = {
  streams: [],
  featured: [],
  cards: [],
  channel: null,
  listeners: new Set(),
  limit: 20,
  statusFilter: ["live", "scheduled"],
  ready: false,
  loading: false,
  error: null
};

function watchUrl(stream = {}) {
  const base = RB_ROUTES.watch || "/watch";
  const key = stream.slug || stream.display_slug || stream.id || stream.stream_id;

  if (!key) return base;

  return `${base}?stream=${encodeURIComponent(key)}`;
}

function normalizeProfile(profile) {
  if (Array.isArray(profile)) return profile[0] || null;
  return profile || null;
}

function normalizeStream(row = {}) {
  const profile = normalizeProfile(row.profiles || row.profile);

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

    viewer_count: Number(row.viewer_count || 0),
    peak_viewers: Number(row.peak_viewers || 0),

    target_url:
      row.target_url ||
      watchUrl(row)
  };
}

function normalizeCard(row = {}) {
  return {
    ...row,

    title:
      row.title ||
      "Rich Bizness Live",

    subtitle:
      row.subtitle ||
      row.description ||
      "",

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

  window.dispatchEvent(
    new CustomEvent("rb:live-rail-state", {
      detail: state
    })
  );
}

export function getLiveRailState() {
  return {
    ready: RAIL.ready,
    loading: RAIL.loading,
    error: RAIL.error,
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

  try {
    listener(getLiveRailState());
  } catch (error) {
    console.warn("[RB LIVE RAIL LISTENER]", error);
  }

  return () => {
    RAIL.listeners.delete(listener);
  };
}

async function safeLoadStreams({
  limit = RAIL.limit,
  statusFilter = RAIL.statusFilter
} = {}) {
  const supabase = getSupabase();

  const attempts = [
    {
      name: "full_join",
      run: () =>
        supabase
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
          .limit(limit)
    },
    {
      name: "no_join",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreams)
          .select("*")
          .in("status", statusFilter)
          .order("viewer_count", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(limit)
    },
    {
      name: "live_only",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreams)
          .select("*")
          .eq("status", "live")
          .order("created_at", { ascending: false })
          .limit(limit)
    },
    {
      name: "latest_filter_client",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreams)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit)
    }
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const { data, error } = await attempt.run();

      if (error) throw error;

      const rows = data || [];

      if (attempt.name === "latest_filter_client") {
        return rows.filter((row) => statusFilter.includes(row.status));
      }

      return rows;
    } catch (error) {
      lastError = error;
      console.warn(`[RB LIVE RAIL QUERY SKIPPED: ${attempt.name}]`, error?.message || error);
    }
  }

  throw lastError || new Error("Live rail failed to load.");
}

export async function loadLiveRail({
  limit = RAIL.limit,
  statusFilter = RAIL.statusFilter
} = {}) {
  RAIL.loading = true;
  RAIL.error = null;
  RAIL.limit = limit;
  RAIL.statusFilter = statusFilter;

  emitRail();

  try {
    const rows = await safeLoadStreams({
      limit,
      statusFilter
    });

    RAIL.streams = rows.map(normalizeStream);

    RAIL.featured = RAIL.streams.filter(
      (stream) => stream.is_featured || stream.status === "live"
    );

    if (!RAIL.featured.length) {
      RAIL.featured = RAIL.streams.slice(0, Math.min(8, RAIL.streams.length));
    }

    RAIL.ready = true;
    RAIL.error = null;
  } catch (error) {
    console.warn("[RB LIVE RAIL LOAD]", error?.message || error);

    RAIL.streams = [];
    RAIL.featured = [];
    RAIL.ready = true;
    RAIL.error = error;
  } finally {
    RAIL.loading = false;
    emitRail();
  }

  return RAIL.streams;
}

export async function loadLiveCards({
  limit = 20,
  activeOnly = true
} = {}) {
  if (!RB_TABLES.liveStreamCards) {
    RAIL.cards = [];
    emitRail();
    return [];
  }

  const supabase = getSupabase();

  const attempts = [
    {
      name: "active_sort",
      run: () => {
        let query = supabase
          .from(RB_TABLES.liveStreamCards)
          .select("*")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(limit);

        if (activeOnly) query = query.eq("is_active", true);

        return query;
      }
    },
    {
      name: "active_created",
      run: () => {
        let query = supabase
          .from(RB_TABLES.liveStreamCards)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (activeOnly) query = query.eq("is_active", true);

        return query;
      }
    },
    {
      name: "no_filter",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreamCards)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit)
    }
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const { data, error } = await attempt.run();

      if (error) throw error;

      RAIL.cards = (data || []).map(normalizeCard);
      emitRail();

      return RAIL.cards;
    } catch (error) {
      lastError = error;
      console.warn(`[RB LIVE CARDS QUERY SKIPPED: ${attempt.name}]`, error?.message || error);
    }
  }

  console.warn("[RB LIVE CARDS LOAD]", lastError?.message || lastError);

  RAIL.cards = [];
  emitRail();

  return [];
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

  const attempts = [
    {
      name: "creator_status",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreams)
          .select("*")
          .eq("creator_id", creatorId)
          .in("status", ["live", "scheduled", "draft", "ended"])
          .order("created_at", { ascending: false })
          .limit(limit)
    },
    {
      name: "creator_only",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreams)
          .select("*")
          .eq("creator_id", creatorId)
          .order("created_at", { ascending: false })
          .limit(limit)
    }
  ];

  for (const attempt of attempts) {
    try {
      const { data, error } = await attempt.run();
      if (error) throw error;

      return (data || []).map(normalizeStream);
    } catch (error) {
      console.warn(`[RB CREATOR LIVE RAIL SKIPPED: ${attempt.name}]`, error?.message || error);
    }
  }

  return [];
}

export async function searchLiveRail(queryText = "", limit = 20) {
  const q = String(queryText || "").trim();

  if (!q) {
    return loadLiveRail({ limit });
  }

  const supabase = getSupabase();
  const safeQ = q.replaceAll(",", " ").replaceAll("%", "");

  const attempts = [
    {
      name: "search_with_display_slug",
      run: () =>
        supabase
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
            `title.ilike.%${safeQ}%,description.ilike.%${safeQ}%,category.ilike.%${safeQ}%,display_slug.ilike.%${safeQ}%`
          )
          .in("status", ["live", "scheduled"])
          .order("viewer_count", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(limit)
    },
    {
      name: "search_basic",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreams)
          .select("*")
          .or(
            `title.ilike.%${safeQ}%,description.ilike.%${safeQ}%,category.ilike.%${safeQ}%`
          )
          .in("status", ["live", "scheduled"])
          .order("created_at", { ascending: false })
          .limit(limit)
    }
  ];

  for (const attempt of attempts) {
    try {
      const { data, error } = await attempt.run();

      if (error) throw error;

      RAIL.streams = (data || []).map(normalizeStream);
      RAIL.featured = RAIL.streams.filter((stream) => stream.status === "live");

      emitRail();

      return RAIL.streams;
    } catch (error) {
      console.warn(`[RB LIVE RAIL SEARCH SKIPPED: ${attempt.name}]`, error?.message || error);
    }
  }

  return [];
}

export async function upsertLiveRailCard(stream) {
  if (!stream?.id || !RB_TABLES.liveStreamCards) return null;

  const supabase = getSupabase();

  const payload = {
    stream_id: stream.id,
    creator_id: stream.creator_id || null,
    title: stream.title || "Family Bizness",
    subtitle: stream.description || null,
    card_type: stream.status === "live" ? "live" : "highlight",
    thumbnail_url: stream.thumbnail_url || stream.cover_url || null,
    cover_url: stream.cover_url || stream.thumbnail_url || null,
    target_url: watchUrl(stream),
    is_active: ["live", "scheduled", "draft"].includes(stream.status),
    metadata: {
      source: "live-rail.js",
      status: stream.status || null,
      slug: stream.slug || null,
      livekit_room_name: stream.livekit_room_name || null
    },
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from(RB_TABLES.liveStreamCards)
      .upsert(payload, {
        onConflict: "stream_id"
      })
      .select("*")
      .maybeSingle();

    if (error) throw error;

    await loadLiveCards();

    return data || null;
  } catch (error) {
    console.warn("[RB LIVE RAIL CARD UPSERT]", error?.message || error);
    return null;
  }
}

export function clearLiveRailRealtime() {
  const supabase = getSupabase();

  if (RAIL.channel && supabase) {
    supabase.removeChannel(RAIL.channel);
  }

  RAIL.channel = null;
}

export function bindLiveRailRealtime() {
  const supabase = getSupabase();

  if (!supabase || !RB_TABLES.liveStreams) return null;

  clearLiveRailRealtime();

  const channel = supabase
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
    );

  if (RB_TABLES.liveStreamCards) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.liveStreamCards
      },
      () => loadLiveCards()
    );
  }

  RAIL.channel = channel.subscribe((status) => {
    window.dispatchEvent(
      new CustomEvent("rb:live-rail-realtime-status", {
        detail: {
          status
        }
      })
    );
  });

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

export function resetLiveRail() {
  RAIL.streams = [];
  RAIL.featured = [];
  RAIL.cards = [];
  RAIL.ready = false;
  RAIL.loading = false;
  RAIL.error = null;

  clearLiveRailRealtime();
  emitRail();
}

window.addEventListener("beforeunload", clearLiveRailRealtime);

console.log("RB LIVE RAIL READY");
