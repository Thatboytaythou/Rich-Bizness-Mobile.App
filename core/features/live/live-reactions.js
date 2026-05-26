/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-reactions.js

   LIVE REACTIONS ENGINE
   Hearts + Emoji Burst + Realtime
========================= */

import { getSupabase } from "/core/shared/rb-supabase.js";

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

  listeners: new Set(),
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
  "🎵",
];

function emitReactions() {
  const snapshot = getLiveReactionState();

  REACTIONS.listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn(
        "[RB LIVE REACTION LISTENER]",
        error
      );
    }
  });

  window.dispatchEvent(
    new CustomEvent(
      "rb-live-reactions",
      {
        detail: snapshot,
      }
    )
  );
}

export function getLiveReactionState() {
  return {
    stream: REACTIONS.stream,
    user: REACTIONS.user,
    profile: REACTIONS.profile,

    reactions: [...REACTIONS.reactions],

    burstQueue: [
      ...REACTIONS.burstQueue,
    ],
  };
}

export function onLiveReactions(
  listener
) {
  if (typeof listener !== "function") {
    return () => {};
  }

  REACTIONS.listeners.add(listener);

  listener(getLiveReactionState());

  return () => {
    REACTIONS.listeners.delete(
      listener
    );
  };
}

export function getReactionPalette() {
  return [...DEFAULT_REACTIONS];
}

export async function loadLiveReactions(
  streamId = REACTIONS.stream?.id
) {
  if (!streamId) return [];

  const supabase = getSupabase();

  const { data, error } =
    await supabase
      .from(
        RB_TABLES.liveReactions
      )
      .select("*")
      .eq("stream_id", streamId)
      .order("created_at", {
        ascending: false,
      })
      .limit(150);

  if (error) {
    console.warn(
      "[RB LIVE REACTIONS LOAD]",
      error
    );

    return [];
  }

  REACTIONS.reactions = data || [];

  emitReactions();

  return REACTIONS.reactions;
}

export async function sendLiveReaction(
  reaction = "🔥"
) {
  if (!REACTIONS.stream?.id) {
    throw new Error(
      "No active live stream."
    );
  }

  const emoji =
    String(reaction).trim() ||
    "🔥";

  const supabase = getSupabase();

  const payload = {
    stream_id:
      REACTIONS.stream.id,

    user_id:
      REACTIONS.user?.id ||
      null,

    reaction: emoji,

    metadata: {
      source:
        "live-reactions.js",

      username:
        REACTIONS.profile
          ?.username || null,

      display_name:
        REACTIONS.profile
          ?.display_name ||
        null,
    },
  };

  const { data, error } =
    await supabase
      .from(
        RB_TABLES.liveReactions
      )
      .insert(payload)
      .select("*")
      .single();

  if (error) {
    console.warn(
      "[RB LIVE REACTION SEND]",
      error
    );

    throw error;
  }

  REACTIONS.reactions.unshift(
    data
  );

  REACTIONS.burstQueue.push({
    id:
      data.id ||
      crypto.randomUUID(),

    reaction: emoji,

    created_at:
      data.created_at ||
      new Date().toISOString(),
  });

  if (
    REACTIONS.burstQueue.length > 40
  ) {
    REACTIONS.burstQueue.shift();
  }

  emitReactions();

  await incrementReactionCount();

  return data;
}

async function incrementReactionCount() {
  if (!REACTIONS.stream?.id) return;

  const supabase = getSupabase();

  const total =
    Number(
      REACTIONS.stream
        ?.total_reactions || 0
    ) + 1;

  REACTIONS.stream.total_reactions =
    total;

  await supabase
    .from(
      RB_TABLES.liveStreams
    )
    .update({
      total_reactions: total,

      last_activity_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      REACTIONS.stream.id
    );
}

export function clearReactionBurst(
  id
) {
  REACTIONS.burstQueue =
    REACTIONS.burstQueue.filter(
      (item) => item.id !== id
    );

  emitReactions();
}

export function clearLiveReactionRealtime() {
  const supabase =
    getSupabase();

  if (
    REACTIONS.channel &&
    supabase
  ) {
    supabase.removeChannel(
      REACTIONS.channel
    );
  }

  REACTIONS.channel = null;
}

export function bindLiveReactionRealtime(
  streamId =
    REACTIONS.stream?.id
) {
  if (!streamId) return null;

  const supabase =
    getSupabase();

  clearLiveReactionRealtime();

  REACTIONS.channel =
    supabase
      .channel(
        `rb-live-reactions-${streamId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            RB_TABLES.liveReactions,

          filter: `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          const item =
            payload.new;

          if (item?.id) {
            REACTIONS.reactions.unshift(
              item
            );

            REACTIONS.burstQueue.push({
              id:
                item.id,

              reaction:
                item.reaction,

              created_at:
                item.created_at,
            });

            if (
              REACTIONS.burstQueue
                .length > 40
            ) {
              REACTIONS.burstQueue.shift();
            }

            emitReactions();
          } else {
            await loadLiveReactions(
              streamId
            );
          }
        }
      )
      .subscribe();

  return REACTIONS.channel;
}

export async function initLiveReactions(
  {
    stream,
    user = null,
    profile = null,
    realtime = true,
  } = {}
) {
  REACTIONS.stream =
    stream || null;

  REACTIONS.user =
    user || null;

  REACTIONS.profile =
    profile || null;

  REACTIONS.reactions = [];
  REACTIONS.burstQueue = [];

  if (!stream?.id) {
    return getLiveReactionState();
  }

  await loadLiveReactions(
    stream.id
  );

  if (realtime) {
    bindLiveReactionRealtime(
      stream.id
    );
  }

  return getLiveReactionState();
}

window.addEventListener(
  "beforeunload",
  clearLiveReactionRealtime
);

console.log(
  "RB LIVE REACTIONS READY"
);
