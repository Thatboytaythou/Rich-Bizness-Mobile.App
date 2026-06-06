/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-state.js

   GLOBAL LIVE STATE
   Live status + active stream sync
   Safe Loader + Realtime Enabled
========================= */

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

const LIVE_STATE = {
  ready: false,
  loading: false,
  activeStreams: [],
  featuredStream: null,
  liveCount: 0,
  channel: null,
  listeners: new Set(),
  error: null
};

function cloneState() {
  return {
    ready: LIVE_STATE.ready,
    loading: LIVE_STATE.loading,
    activeStreams: [...LIVE_STATE.activeStreams],
    featuredStream: LIVE_STATE.featuredStream,
    liveCount: LIVE_STATE.liveCount,
    error: LIVE_STATE.error
  };
}

function normalizeStream(stream = {}) {
  const profile = Array.isArray(stream.profiles)
    ? stream.profiles[0]
    : stream.profiles;

  return {
    ...stream,
    creator_profile: profile || null,
    title: stream.title || "Rich Bizness Live",
    description: stream.description || "",
    thumbnail_url:
      stream.thumbnail_url ||
      stream.cover_url ||
      "/images/brand/hero-banner.png",
    cover_url:
      stream.cover_url ||
      stream.thumbnail_url ||
      "/images/brand/hero-banner.png",
    viewer_count: Number(stream.viewer_count || 0),
    peak_viewers: Number(stream.peak_viewers || 0),
    total_chat_messages: Number(stream.total_chat_messages || 0),
    total_reactions: Number(stream.total_reactions || 0),
    total_revenue_cents: Number(stream.total_revenue_cents || 0)
  };
}

function emitLiveState() {
  const snapshot = getLiveState();

  LIVE_STATE.listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn("[RB LIVE STATE LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:live-state", {
      detail: snapshot
    })
  );

  window.dispatchEvent(
    new CustomEvent("rb:activity-update", {
      detail: {
        live: {
          active: snapshot.liveCount > 0,
          count: snapshot.liveCount,
          featuredStream: snapshot.featuredStream,
          featured: snapshot.featuredStream,
          streams: snapshot.activeStreams
        }
      }
    })
  );
}

export function getLiveState() {
  return cloneState();
}

export function onLiveState(listener) {
  if (typeof listener !== "function") return () => {};

  LIVE_STATE.listeners.add(listener);

  try {
    listener(getLiveState());
  } catch (error) {
    console.warn("[RB LIVE STATE LISTENER]", error);
  }

  return () => {
    LIVE_STATE.listeners.delete(listener);
  };
}

export function setLiveLoading(value = true) {
  LIVE_STATE.loading = Boolean(value);
  emitLiveState();
}

export function setLiveError(error = null) {
  LIVE_STATE.error = error;
  LIVE_STATE.loading = false;
  emitLiveState();
}

export function setActiveStreams(streams = []) {
  const rows = Array.isArray(streams)
    ? streams.map(normalizeStream)
    : [];

  LIVE_STATE.activeStreams = rows;
  LIVE_STATE.featuredStream = rows[0] || null;
  LIVE_STATE.liveCount = rows.length;
  LIVE_STATE.ready = true;
  LIVE_STATE.loading = false;
  LIVE_STATE.error = null;

  emitLiveState();
}

async function safeLoadLiveStreams() {
  const supabase = getSupabase();

  const attempts = [
    {
      name: "full_profiles_join",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreams)
          .select(`
            id,
            creator_id,
            slug,
            title,
            description,
            category,
            status,
            access_type,
            price_cents,
            currency,
            thumbnail_url,
            cover_url,
            viewer_count,
            peak_viewers,
            total_chat_messages,
            total_reactions,
            total_revenue_cents,
            is_featured,
            started_at,
            created_at,
            profiles:creator_id (
              username,
              display_name,
              avatar_url
            )
          `)
          .eq("status", "live")
          .order("is_featured", { ascending: false })
          .order("viewer_count", { ascending: false })
          .order("started_at", { ascending: false })
          .limit(12)
    },
    {
      name: "no_profile_join",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreams)
          .select("*")
          .eq("status", "live")
          .order("viewer_count", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(12)
    },
    {
      name: "status_active_fallback",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreams)
          .select("*")
          .in("status", ["live", "active"])
          .order("created_at", { ascending: false })
          .limit(12)
    },
    {
      name: "latest_no_filter",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreams)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(12)
    }
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const { data, error } = await attempt.run();

      if (error) throw error;

      const rows = data || [];

      if (attempt.name === "latest_no_filter") {
        return rows.filter((item) => item.status === "live");
      }

      return rows;
    } catch (error) {
      lastError = error;
      console.warn(`[RB LIVE STATE QUERY SKIPPED: ${attempt.name}]`, error?.message || error);
    }
  }

  throw lastError || new Error("Live streams failed to load.");
}

export async function refreshLiveState() {
  const supabase = getSupabase();

  if (!supabase || !RB_TABLES.liveStreams) {
    setActiveStreams([]);
    return getLiveState();
  }

  LIVE_STATE.loading = true;
  emitLiveState();

  try {
    const streams = await safeLoadLiveStreams();
    setActiveStreams(streams);
  } catch (error) {
    console.warn("[RB LIVE STATE REFRESH]", error?.message || error);

    LIVE_STATE.activeStreams = [];
    LIVE_STATE.featuredStream = null;
    LIVE_STATE.liveCount = 0;
    LIVE_STATE.ready = true;
    LIVE_STATE.error = error;
  } finally {
    LIVE_STATE.loading = false;
    emitLiveState();
  }

  return getLiveState();
}

export function clearLiveStateRealtime() {
  const supabase = getSupabase();

  if (LIVE_STATE.channel && supabase) {
    supabase.removeChannel(LIVE_STATE.channel);
  }

  LIVE_STATE.channel = null;
}

export function bindLiveStateRealtime() {
  const supabase = getSupabase();

  if (!supabase || !RB_TABLES.liveStreams) return null;

  clearLiveStateRealtime();

  const channel = supabase
    .channel("rb-global-live-state")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.liveStreams
      },
      () => refreshLiveState().catch(console.error)
    );

  if (RB_TABLES.liveViewSessions) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.liveViewSessions
      },
      () => refreshLiveState().catch(console.error)
    );
  }

  LIVE_STATE.channel = channel.subscribe((status) => {
    window.dispatchEvent(
      new CustomEvent("rb:live-state-realtime-status", {
        detail: {
          status
        }
      })
    );
  });

  return LIVE_STATE.channel;
}

export async function initLiveState({
  realtime = true
} = {}) {
  await refreshLiveState();

  if (realtime) {
    bindLiveStateRealtime();
  }

  return getLiveState();
}

export function getFeaturedLiveStream() {
  return LIVE_STATE.featuredStream;
}

export function getActiveLiveStreams() {
  return [...LIVE_STATE.activeStreams];
}

export function hasLiveStreams() {
  return LIVE_STATE.liveCount > 0;
}

export function resetLiveState() {
  LIVE_STATE.ready = false;
  LIVE_STATE.loading = false;
  LIVE_STATE.activeStreams = [];
  LIVE_STATE.featuredStream = null;
  LIVE_STATE.liveCount = 0;
  LIVE_STATE.error = null;

  clearLiveStateRealtime();
  emitLiveState();
}

window.addEventListener("beforeunload", clearLiveStateRealtime);

console.log("RB LIVE STATE READY");
