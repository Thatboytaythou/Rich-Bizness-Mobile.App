/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-reactions.js

   LIVE REACTIONS ENGINE
   Hearts + Emoji Burst + Realtime
   Safe Count Sync + UI Events
========================= */

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

const REACTIONS = {
  stream: null,
  user: null,
  profile: null,

  reactions: [],
  burstQueue: [],

  channel: null,

  ready: false,
  loading: false,
  error: null,

  listeners: new Set()
};

const DEFAULT_REACTIONS = [
  "🔥",
  "💨",
  "💚",
  "⚡",
  "👑",
  "🚀",
  "💸",
  "🎮",
  "🏆",
  "🎵"
];

function emitReactions() {
  const snapshot = getLiveReactionState();

  REACTIONS.listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn("[RB LIVE REACTION LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-live-reactions", {
      detail: snapshot
    })
  );

  window.dispatchEvent(
    new CustomEvent("rb:live-reaction-state", {
      detail: snapshot
    })
  );
}

function username() {
  return (
    REACTIONS.profile?.username ||
    REACTIONS.user?.email?.split("@")[0] ||
    "guest"
  );
}

function displayName() {
  return (
    REACTIONS.profile?.display_name ||
    REACTIONS.profile?.full_name ||
    REACTIONS.profile?.username ||
    REACTIONS.user?.email?.split("@")[0] ||
    "Rich Viewer"
  );
}

function avatarUrl() {
  return (
    REACTIONS.profile?.avatar_url ||
    "/images/brand/Avatar-hero-Banner.png.jpeg"
  );
}

function normalizeReaction(row = {}) {
  return {
    ...row,
    reaction: row.reaction || row.emoji || "🔥",
    emoji: row.emoji || row.reaction || "🔥",
    username: row.username || row.metadata?.username || "guest",
    display_name:
      row.display_name ||
      row.metadata?.display_name ||
      row.username ||
      "Rich Viewer",
    avatar_url:
      row.avatar_url ||
      row.metadata?.avatar_url ||
      "/images/brand/Avatar-hero-Banner.png.jpeg"
  };
}

function pushBurst(item = {}) {
  const burst = {
    id: item.id || crypto.randomUUID(),
    reaction: item.reaction || item.emoji || "🔥",
    emoji: item.emoji || item.reaction || "🔥",
    created_at: item.created_at || new Date().toISOString()
  };

  REACTIONS.burstQueue.push(burst);

  if (REACTIONS.burstQueue.length > 40) {
    REACTIONS.burstQueue.shift();
  }

  return burst;
}

function upsertReaction(row = {}) {
  const item = normalizeReaction(row);

  if (!item?.id) {
    REACTIONS.reactions.unshift(item);
    pushBurst(item);
    emitReactions();
    return item;
  }

  const exists = REACTIONS.reactions.some(
    (reaction) => String(reaction.id) === String(item.id)
  );

  if (!exists) {
    REACTIONS.reactions.unshift(item);
    REACTIONS.reactions = REACTIONS.reactions.slice(0, 150);
    pushBurst(item);
  }

  emitReactions();

  return item;
}

export function getLiveReactionState() {
  return {
    ready: REACTIONS.ready,
    loading: REACTIONS.loading,
    error: REACTIONS.error,

    stream: REACTIONS.stream,
    user: REACTIONS.user,
    profile: REACTIONS.profile,

    reactions: [...REACTIONS.reactions],
    burstQueue: [...REACTIONS.burstQueue],
    palette: getReactionPalette()
  };
}

export function onLiveReactions(listener) {
  if (typeof listener !== "function") return () => {};

  REACTIONS.listeners.add(listener);

  try {
    listener(getLiveReactionState());
  } catch (error) {
    console.warn("[RB LIVE REACTION LISTENER]", error);
  }

  return () => {
    REACTIONS.listeners.delete(listener);
  };
}

export function getReactionPalette() {
  return [...DEFAULT_REACTIONS];
}

export async function loadLiveReactions(streamId = REACTIONS.stream?.id) {
  if (!streamId || !RB_TABLES.liveReactions) {
    REACTIONS.reactions = [];
    REACTIONS.ready = true;
    REACTIONS.loading = false;
    emitReactions();
    return [];
  }

  const supabase = getSupabase();

  REACTIONS.loading = true;
  REACTIONS.error = null;
  emitReactions();

  try {
    const { data, error } = await supabase
      .from(RB_TABLES.liveReactions)
      .select("*")
      .eq("stream_id", streamId)
      .order("created_at", {
        ascending: false
      })
      .limit(150);

    if (error) throw error;

    REACTIONS.reactions = (data || []).map(normalizeReaction);
    REACTIONS.ready = true;
    REACTIONS.error = null;

    emitReactions();

    return REACTIONS.reactions;
  } catch (error) {
    REACTIONS.error = error;
    REACTIONS.ready = true;

    console.warn("[RB LIVE REACTIONS LOAD]", error?.message || error);

    emitReactions();

    return [];
  } finally {
    REACTIONS.loading = false;
    emitReactions();
  }
}

export async function sendLiveReaction(reaction = "🔥") {
  if (!REACTIONS.stream?.id) {
    throw new Error("No active live stream.");
  }

  if (!RB_TABLES.liveReactions) {
    throw new Error("Live reactions table not configured.");
  }

  const emoji = String(reaction || "").trim() || "🔥";
  const supabase = getSupabase();

  const payload = {
    stream_id: REACTIONS.stream.id,
    user_id: REACTIONS.user?.id || null,
    reaction: emoji,
    emoji,
    username: username(),
    display_name: displayName(),
    avatar_url: avatarUrl(),
    metadata: {
      source: "live-reactions.js",
      username: username(),
      display_name: displayName(),
      avatar_url: avatarUrl()
    }
  };

  const { data, error } = await supabase
    .from(RB_TABLES.liveReactions)
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error) {
    console.warn("[RB LIVE REACTION SEND]", error?.message || error);
    throw error;
  }

  const item = upsertReaction(data || payload);

  await syncReactionCount();

  window.dispatchEvent(
    new CustomEvent("rb:live-reaction-sent", {
      detail: {
        reaction: item,
        stream: REACTIONS.stream
      }
    })
  );

  return item;
}

export async function syncReactionCount(streamId = REACTIONS.stream?.id) {
  if (!streamId || !RB_TABLES.liveStreams) return null;

  const supabase = getSupabase();

  let total = Number(REACTIONS.stream?.total_reactions || 0);

  try {
    if (RB_TABLES.liveReactions) {
      const { count, error } = await supabase
        .from(RB_TABLES.liveReactions)
        .select("id", {
          count: "exact",
          head: true
        })
        .eq("stream_id", streamId);

      if (error) throw error;

      total = count || 0;
    } else {
      total += 1;
    }

    const { data, error: updateError } = await supabase
      .from(RB_TABLES.liveStreams)
      .update({
        total_reactions: total,
        last_activity_at: new Date().toISOString()
      })
      .eq("id", streamId)
      .select("*")
      .maybeSingle();

    if (updateError) throw updateError;

    if (data) {
      REACTIONS.stream = {
        ...REACTIONS.stream,
        ...data
      };
    } else if (REACTIONS.stream?.id === streamId) {
      REACTIONS.stream = {
        ...REACTIONS.stream,
        total_reactions: total
      };
    }

    emitReactions();

    return REACTIONS.stream;
  } catch (error) {
    console.warn("[RB LIVE REACTION COUNT SYNC]", error?.message || error);
    return REACTIONS.stream;
  }
}

export function clearReactionBurst(id) {
  if (!id) {
    REACTIONS.burstQueue = [];
  } else {
    REACTIONS.burstQueue = REACTIONS.burstQueue.filter(
      (item) => String(item.id) !== String(id)
    );
  }

  emitReactions();
}

export function clearLiveReactionRealtime() {
  const supabase = getSupabase();

  if (REACTIONS.channel && supabase) {
    supabase.removeChannel(REACTIONS.channel);
  }

  REACTIONS.channel = null;
}

export function bindLiveReactionRealtime(streamId = REACTIONS.stream?.id) {
  if (!streamId || !RB_TABLES.liveReactions) return null;

  const supabase = getSupabase();

  clearLiveReactionRealtime();

  REACTIONS.channel = supabase
    .channel(`rb-live-reactions-${streamId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.liveReactions,
        filter: `stream_id=eq.${streamId}`
      },
      async (payload) => {
        if (payload.eventType === "DELETE") {
          const oldId = payload.old?.id;

          if (oldId) {
            REACTIONS.reactions = REACTIONS.reactions.filter(
              (item) => String(item.id) !== String(oldId)
            );

            emitReactions();
          }

          await syncReactionCount(streamId);
          return;
        }

        const item = payload.new;

        if (item?.id) {
          upsertReaction(item);
          await syncReactionCount(streamId);
          return;
        }

        await loadLiveReactions(streamId);
      }
    )
    .subscribe((status) => {
      window.dispatchEvent(
        new CustomEvent("rb:live-reaction-realtime-status", {
          detail: {
            status,
            streamId
          }
        })
      );
    });

  return REACTIONS.channel;
}

export async function initLiveReactions({
  stream,
  user = null,
  profile = null,
  realtime = true
} = {}) {
  clearLiveReactionRealtime();

  REACTIONS.stream = stream || null;
  REACTIONS.user = user || null;
  REACTIONS.profile = profile || null;

  REACTIONS.reactions = [];
  REACTIONS.burstQueue = [];
  REACTIONS.ready = false;
  REACTIONS.loading = false;
  REACTIONS.error = null;

  if (!REACTIONS.stream?.id) {
    REACTIONS.ready = true;
    emitReactions();
    return getLiveReactionState();
  }

  await loadLiveReactions(REACTIONS.stream.id);

  if (realtime) {
    bindLiveReactionRealtime(REACTIONS.stream.id);
  }

  return getLiveReactionState();
}

export function resetLiveReactions() {
  clearLiveReactionRealtime();

  REACTIONS.stream = null;
  REACTIONS.user = null;
  REACTIONS.profile = null;
  REACTIONS.reactions = [];
  REACTIONS.burstQueue = [];
  REACTIONS.ready = false;
  REACTIONS.loading = false;
  REACTIONS.error = null;

  emitReactions();
}

window.addEventListener(
  "beforeunload",
  clearLiveReactionRealtime
);

console.log("RB LIVE REACTIONS READY");
