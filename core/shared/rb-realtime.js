/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-realtime.js

   REALTIME CHANNEL ENGINE
   Synced To rb-config.js
   Table Channels + Presence + Broadcast
   Uses locked rb-supabase.js client only

   Rule:
   - Realtime subscribes + dispatches only
   - No XP writes here
   - No profile writes here
   - No duplicate identity state here
========================= */

import {
  RB_REALTIME,
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  getProfile,
  createRealtimeChannel,
  removeRealtimeChannel
} from "/core/shared/rb-supabase.js";

const supabase = getSupabase();

const activeChannels = new Map();

/* =========================
   HELPERS
========================= */

export function rbChannelName(...parts) {
  return parts
    .filter(Boolean)
    .join(":")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9:_-]/g, "")
    .toLowerCase();
}

export function getActiveRealtimeChannels() {
  return Array.from(activeChannels.keys());
}

export function getActiveRealtimeChannel(key) {
  return activeChannels.get(key) || null;
}

export function hasActiveChannel(key) {
  return activeChannels.has(key);
}

export function isRealtimeEnabled() {
  return RB_REALTIME?.enabled !== false;
}

export function isRealtimeTable(table) {
  if (!table) return false;
  if (!RB_REALTIME?.tables?.length) return true;

  return RB_REALTIME.tables.includes(table);
}

function safeStatusLog(type, key, status) {
  console.log(`[RB ${type}] ${key}: ${status}`);
}

function safeRandomId(prefix = "guest") {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dispatchRealtimeEvent(name, detail = {}) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(name, {
      detail
    })
  );
}

function buildPostgresConfig({
  event = "*",
  schema = "public",
  table,
  filter = null
}) {
  const config = {
    event,
    schema,
    table
  };

  if (filter) {
    config.filter = filter;
  }

  return config;
}

function assertTable(table, label = "realtime table") {
  if (!table) {
    throw new Error(`Missing ${label}.`);
  }

  return table;
}

/* =========================
   TABLE SUBSCRIPTIONS
========================= */

export function subscribeToTable({
  key,
  table,
  event = "*",
  schema = "public",
  filter = null,
  onChange,
  onStatus = null
}) {
  if (!key || !table || typeof onChange !== "function") {
    throw new Error("Missing realtime subscription info.");
  }

  if (!isRealtimeEnabled()) {
    console.warn("[RB REALTIME DISABLED]");
    return null;
  }

  if (!isRealtimeTable(table)) {
    console.warn(`[RB REALTIME TABLE NOT REGISTERED] ${table}`);
  }

  unsubscribeChannel(key);

  const channel = createRealtimeChannel(key);

  channel.on(
    "postgres_changes",
    buildPostgresConfig({
      event,
      schema,
      table,
      filter
    }),
    (payload) => {
      try {
        dispatchRealtimeEvent("rb:realtime-change", {
          key,
          table,
          event,
          filter,
          payload
        });

        onChange(payload);
      } catch (error) {
        console.warn(`[RB REALTIME HANDLER ERROR: ${key}]`, error);
      }
    }
  );

  channel.subscribe((status) => {
    safeStatusLog("REALTIME", key, status);

    dispatchRealtimeEvent("rb:realtime-status", {
      key,
      table,
      status
    });

    if (typeof onStatus === "function") {
      onStatus(status);
    }
  });

  activeChannels.set(key, channel);

  return channel;
}

export function subscribeToTableById({
  key,
  table,
  id,
  idColumn = "id",
  event = "*",
  onChange,
  onStatus = null
}) {
  if (!id) throw new Error("Missing realtime row id.");

  return subscribeToTable({
    key,
    table,
    event,
    filter: `${idColumn}=eq.${id}`,
    onChange,
    onStatus
  });
}

export function subscribeToUserRows({
  key,
  table,
  userId = null,
  userColumn = "user_id",
  event = "*",
  onChange,
  onStatus = null
}) {
  const activeUserId = userId || getUser()?.id;

  if (!activeUserId) {
    throw new Error("Missing realtime user id.");
  }

  return subscribeToTable({
    key,
    table,
    event,
    filter: `${userColumn}=eq.${activeUserId}`,
    onChange,
    onStatus
  });
}

/* =========================
   FEATURE CHANNELS
========================= */

export function subscribeToStream({
  streamId,
  onChange,
  onStatus = null
}) {
  return subscribeToTableById({
    key: rbChannelName("live-stream", streamId),
    table: assertTable(RB_TABLES.liveStreams, "live streams table"),
    id: streamId,
    onChange,
    onStatus
  });
}

export function subscribeToLiveChat({
  streamId,
  onChange,
  onStatus = null
}) {
  return subscribeToTable({
    key: rbChannelName("live-chat", streamId),
    table: assertTable(RB_TABLES.liveChatMessages, "live chat messages table"),
    event: "*",
    filter: `stream_id=eq.${streamId}`,
    onChange,
    onStatus
  });
}

export function subscribeToLiveReactions({
  streamId,
  onChange,
  onStatus = null
}) {
  return subscribeToTable({
    key: rbChannelName("live-reactions", streamId),
    table: assertTable(RB_TABLES.liveReactions, "live reactions table"),
    event: "INSERT",
    filter: `stream_id=eq.${streamId}`,
    onChange,
    onStatus
  });
}

export function subscribeToLiveTips({
  streamId,
  onChange,
  onStatus = null
}) {
  return subscribeToTable({
    key: rbChannelName("live-tips", streamId),
    table: assertTable(RB_TABLES.liveTips, "live tips table"),
    event: "*",
    filter: `stream_id=eq.${streamId}`,
    onChange,
    onStatus
  });
}

export function subscribeToMessagesThread({
  threadId,
  onChange,
  onStatus = null
}) {
  return subscribeToTable({
    key: rbChannelName("dm-thread", threadId),
    table: assertTable(RB_TABLES.dmMessages, "dm messages table"),
    event: "*",
    filter: `thread_id=eq.${threadId}`,
    onChange,
    onStatus
  });
}

export function subscribeToNotifications({
  userId = null,
  onChange,
  onStatus = null
}) {
  const activeUserId = userId || getUser()?.id;
  const table = RB_TABLES.richNotifications || RB_TABLES.notifications;

  return subscribeToUserRows({
    key: rbChannelName("notifications", activeUserId),
    table: assertTable(table, "notifications table"),
    userId: activeUserId,
    userColumn: "user_id",
    event: "*",
    onChange,
    onStatus
  });
}

export function subscribeToFeed({
  section = null,
  onChange,
  onStatus = null
}) {
  return subscribeToTable({
    key: rbChannelName("feed-posts", section || "all"),
    table: assertTable(RB_TABLES.feedPosts, "feed posts table"),
    event: "*",
    filter: section ? `section=eq.${section}` : null,
    onChange,
    onStatus
  });
}

export function subscribeToProfile({
  userId = null,
  onChange,
  onStatus = null
}) {
  const activeUserId = userId || getUser()?.id;

  if (!activeUserId) {
    throw new Error("Missing realtime profile id.");
  }

  return subscribeToTableById({
    key: rbChannelName("profile", activeUserId),
    table: assertTable(RB_TABLES.profiles, "profiles table"),
    id: activeUserId,
    onChange,
    onStatus
  });
}

export function subscribeToUserLevel({
  userId = null,
  onChange,
  onStatus = null
}) {
  return subscribeToUserRows({
    key: rbChannelName("user-level", userId || getUser()?.id),
    table: assertTable(RB_TABLES.userLevels, "user levels table"),
    userId,
    userColumn: "user_id",
    event: "*",
    onChange,
    onStatus
  });
}

export function subscribeToMetaAvatar({
  userId = null,
  onChange,
  onStatus = null
}) {
  return subscribeToUserRows({
    key: rbChannelName("meta-avatar", userId || getUser()?.id),
    table: assertTable(RB_TABLES.metaAvatars, "meta avatars table"),
    userId,
    userColumn: "user_id",
    event: "*",
    onChange,
    onStatus
  });
}

export function subscribeToUploads({
  userId = null,
  onChange,
  onStatus = null
}) {
  return subscribeToUserRows({
    key: rbChannelName("uploads", userId || getUser()?.id),
    table: assertTable(RB_TABLES.uploads, "uploads table"),
    userId,
    userColumn: "user_id",
    event: "*",
    onChange,
    onStatus
  });
}

/* =========================
   PRESENCE
========================= */

export function subscribeToPresence({
  key,
  user = null,
  metadata = {},
  onSync,
  onJoin,
  onLeave,
  onStatus = null
}) {
  if (!key) throw new Error("Missing presence channel key.");

  unsubscribeChannel(key);

  const activeUser = user || getUser();
  const profile = getProfile();

  const presenceKey =
    activeUser?.id ||
    safeRandomId("guest");

  const channel = supabase.channel(key, {
    config: {
      presence: {
        key: presenceKey
      }
    }
  });

  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();

    dispatchRealtimeEvent("rb:presence-sync", {
      key,
      state
    });

    if (typeof onSync === "function") {
      onSync(state);
    }
  });

  channel.on("presence", { event: "join" }, ({ key: joinedKey, newPresences }) => {
    dispatchRealtimeEvent("rb:presence-join", {
      key,
      joinedKey,
      newPresences
    });

    if (typeof onJoin === "function") {
      onJoin({ key: joinedKey, newPresences });
    }
  });

  channel.on("presence", { event: "leave" }, ({ key: leftKey, leftPresences }) => {
    dispatchRealtimeEvent("rb:presence-leave", {
      key,
      leftKey,
      leftPresences
    });

    if (typeof onLeave === "function") {
      onLeave({ key: leftKey, leftPresences });
    }
  });

  channel.subscribe(async (status) => {
    safeStatusLog("PRESENCE", key, status);

    dispatchRealtimeEvent("rb:presence-status", {
      key,
      status
    });

    if (typeof onStatus === "function") {
      onStatus(status);
    }

    if (status === "SUBSCRIBED") {
      await channel.track({
        id: activeUser?.id || null,
        email: activeUser?.email || "",
        username: profile?.username || null,
        display_name: profile?.display_name || null,
        avatar_url: profile?.avatar_url || null,
        online_at: new Date().toISOString(),
        ...metadata
      });
    }
  });

  activeChannels.set(key, channel);

  return channel;
}

/* =========================
   BROADCAST
========================= */

export function subscribeToBroadcast({
  key,
  event = "message",
  onMessage,
  onStatus = null
}) {
  if (!key || typeof onMessage !== "function") {
    throw new Error("Missing broadcast subscription info.");
  }

  unsubscribeChannel(key);

  const channel = createRealtimeChannel(key);

  channel.on("broadcast", { event }, (payload) => {
    try {
      dispatchRealtimeEvent("rb:broadcast-message", {
        key,
        event,
        payload
      });

      onMessage(payload);
    } catch (error) {
      console.warn(`[RB BROADCAST HANDLER ERROR: ${key}]`, error);
    }
  });

  channel.subscribe((status) => {
    safeStatusLog("BROADCAST", key, status);

    dispatchRealtimeEvent("rb:broadcast-status", {
      key,
      event,
      status
    });

    if (typeof onStatus === "function") {
      onStatus(status);
    }
  });

  activeChannels.set(key, channel);

  return channel;
}

export async function sendBroadcast({
  key,
  event = "message",
  payload = {}
}) {
  const channel = activeChannels.get(key);

  if (!channel) {
    throw new Error(`No active broadcast channel: ${key}`);
  }

  return await channel.send({
    type: "broadcast",
    event,
    payload
  });
}

/* =========================
   UNSUBSCRIBE
========================= */

export async function unsubscribeChannel(key) {
  const channel = activeChannels.get(key);

  if (!channel) return;

  try {
    await removeRealtimeChannel(channel);
  } finally {
    activeChannels.delete(key);
  }
}

export async function unsubscribeAllChannels() {
  const channels = Array.from(activeChannels.entries());

  await Promise.allSettled(
    channels.map(async ([key, channel]) => {
      try {
        await removeRealtimeChannel(channel);
      } finally {
        activeChannels.delete(key);
      }
    })
  );

  activeChannels.clear();
}

/* =========================
   GLOBAL DEBUG HOOK
========================= */

if (typeof window !== "undefined") {
  window.RBRealtime = {
    rbChannelName,
    getActiveRealtimeChannels,
    getActiveRealtimeChannel,
    hasActiveChannel,
    subscribeToTable,
    subscribeToTableById,
    subscribeToUserRows,
    subscribeToStream,
    subscribeToLiveChat,
    subscribeToLiveReactions,
    subscribeToLiveTips,
    subscribeToMessagesThread,
    subscribeToNotifications,
    subscribeToFeed,
    subscribeToProfile,
    subscribeToUserLevel,
    subscribeToMetaAvatar,
    subscribeToUploads,
    subscribeToPresence,
    subscribeToBroadcast,
    sendBroadcast,
    unsubscribeChannel,
    unsubscribeAllChannels
  };

  window.addEventListener("beforeunload", () => {
    unsubscribeAllChannels();
  });
}

console.log("RB REALTIME READY");
