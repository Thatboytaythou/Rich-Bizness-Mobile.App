/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-state.js

   GLOBAL LIVE STATE
   Live status + active stream sync
========================= */

import { getSupabase } from "/core/shared/rb-supabase.js";
import { RB_TABLES } from "/core/shared/rb-config.js";

const LIVE_STATE = {
  ready: false,
  loading: false,
  activeStreams: [],
  featuredStream: null,
  liveCount: 0,
  channel: null,
  listeners: new Set(),
};

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
    new CustomEvent("rb:activity-update", {
      detail: {
        live: {
          active: snapshot.liveCount > 0,
          count: snapshot.liveCount,
          featuredStream: snapshot.featuredStream,
          streams: snapshot.activeStreams,
        },
      },
    })
  );
}

export function getLiveState() {
  return {
    ready: LIVE_STATE.ready,
    loading: LIVE_STATE.loading,
    activeStreams: [...LIVE_STATE.activeStreams],
    featuredStream: LIVE_STATE.featuredStream,
    liveCount: LIVE_STATE.liveCount,
  };
}

export function onLiveState(listener) {
  if (typeof listener !== "function") return () => {};

  LIVE_STATE.listeners.add(listener);
  listener(getLiveState());

  return () => {
    LIVE_STATE.listeners.delete(listener);
  };
}

export async function refreshLiveState() {
  const supabase = getSupabase();
  if (!supabase) return getLiveState();

  LIVE_STATE.loading = true;
  emitLiveState();

  try {
    const { data, error } = await supabase
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
      .limit(12);

    if (error) throw error;

    LIVE_STATE.activeStreams = data || [];
    LIVE_STATE.featuredStream = LIVE_STATE.activeStreams[0] || null;
    LIVE_STATE.liveCount = LIVE_STATE.activeStreams.length;
    LIVE_STATE.ready = true;
  } catch (error) {
    console.warn("[RB LIVE STATE REFRESH]", error?.message || error);

    LIVE_STATE.activeStreams = [];
    LIVE_STATE.featuredStream = null;
    LIVE_STATE.liveCount = 0;
    LIVE_STATE.ready = false;
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
  if (!supabase) return null;

  clearLiveStateRealtime();

  LIVE_STATE.channel = supabase
    .channel("rb-global-live-state")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.liveStreams,
      },
      refreshLiveState
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.liveViewSessions,
      },
      refreshLiveState
    )
    .subscribe();

  return LIVE_STATE.channel;
}

export async function initLiveState({ realtime = true } = {}) {
  await refreshLiveState();

  if (realtime) {
    bindLiveStateRealtime();
  }

  return getLiveState();
}

window.addEventListener("beforeunload", clearLiveStateRealtime);

console.log("RB LIVE STATE READY");
