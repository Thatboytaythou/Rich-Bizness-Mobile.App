/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-realtime.js

   REALTIME CHANNEL ENGINE
========================= */

import {
  getSupabase,
  createRealtimeChannel
} from "/core/shared/rb-supabase.js";

/* =========================
   CHANNEL REGISTRY
========================= */

const activeChannels = new Map();

/* =========================
   CHANNEL NAMES
========================= */

export function rbChannelName(...parts) {
  return parts
    .filter(Boolean)
    .join(":")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

/* =========================
   SUBSCRIBE TO TABLE
========================= */

export function subscribeToTable({
  key,
  table,
  event = "*",
  schema = "public",
  filter = null,
  onChange
}) {
  if (!key || !table || typeof onChange !== "function") {
    throw new Error("Missing realtime subscription info.");
  }

  unsubscribeChannel(key);

  const channel = createRealtimeChannel(key);

  const config = {
    event,
    schema,
    table
  };

  if (filter) {
    config.filter = filter;
  }

  channel.on(
    "postgres_changes",
    config,
    (payload) => {
      onChange(payload);
    }
  );

  channel.subscribe((status) => {
    console.log(`[RB REALTIME] ${key}: ${status}`);
  });

  activeChannels.set(key, channel);

  return channel;
}

/* =========================
   PRESENCE CHANNEL
========================= */

export function subscribeToPresence({
  key,
  user,
  onSync,
  onJoin,
  onLeave
}) {
  if (!key) {
    throw new Error("Missing presence channel key.");
  }

  unsubscribeChannel(key);

  const channel = getSupabase().channel(key, {
    config: {
      presence: {
        key: user?.id || crypto.randomUUID()
      }
    }
  });

  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    if (typeof onSync === "function") onSync(state);
  });

  channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
    if (typeof onJoin === "function") {
      onJoin({ key, newPresences });
    }
  });

  channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
    if (typeof onLeave === "function") {
      onLeave({ key, leftPresences });
    }
  });

  channel.subscribe(async (status) => {
    console.log(`[RB PRESENCE] ${key}: ${status}`);

    if (status === "SUBSCRIBED" && user) {
      await channel.track({
        id: user.id,
        email: user.email || "",
        online_at: new Date().toISOString()
      });
    }
  });

  activeChannels.set(key, channel);

  return channel;
}

/* =========================
   BROADCAST CHANNEL
========================= */

export function subscribeToBroadcast({
  key,
  event = "message",
  onMessage
}) {
  if (!key || typeof onMessage !== "function") {
    throw new Error("Missing broadcast subscription info.");
  }

  unsubscribeChannel(key);

  const channel = getSupabase().channel(key);

  channel.on("broadcast", { event }, (payload) => {
    onMessage(payload);
  });

  channel.subscribe((status) => {
    console.log(`[RB BROADCAST] ${key}: ${status}`);
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

export function unsubscribeChannel(key) {
  const channel = activeChannels.get(key);

  if (!channel) return;

  getSupabase().removeChannel(channel);
  activeChannels.delete(key);
}

export function unsubscribeAllChannels() {
  activeChannels.forEach((channel) => {
    getSupabase().removeChannel(channel);
  });

  activeChannels.clear();
}

/* =========================
   PAGE CLEANUP
========================= */

window.addEventListener("beforeunload", () => {
  unsubscribeAllChannels();
});
