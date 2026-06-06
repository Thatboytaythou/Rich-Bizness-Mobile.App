/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-notifications.js

   NOTIFICATIONS ENGINE
   Rich Alerts + Reads + Realtime Ready

   Locked:
   - Uses rich_notifications / notifications from rb-config
   - Actor identity comes from profiles only
   - Supports target_url + action_url
   - Safe realtime subscription helper included
========================= */

import {
  RB_ROUTES,
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  getProfileIdentity,
  rbInsert,
  rbUpdate,
  createRealtimeChannel,
  removeRealtimeChannel
} from "/core/shared/rb-supabase.js";

const supabase = getSupabase();

function now() {
  return new Date().toISOString();
}

function notifyTable() {
  return (
    RB_TABLES.richNotifications ||
    RB_TABLES.notifications ||
    "rich_notifications"
  );
}

function safeText(value = "", fallback = "") {
  return String(value || fallback || "").trim();
}

function safeUrl(value = null, fallback = null) {
  if (!value) return fallback;

  const raw = String(value).trim();

  if (
    raw.startsWith("/") ||
    raw.startsWith("http://") ||
    raw.startsWith("https://")
  ) {
    return raw;
  }

  return fallback;
}

function cleanPayload(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
}

export async function createNotification({
  userId,
  actorId = null,
  type = "general",
  title = "",
  body = "",
  targetTable = null,
  targetType = null,
  targetId = null,
  targetUrl = null,
  emoji = "💨",
  priority = "normal",
  actionLabel = null,
  actionUrl = null,
  metadata = {}
}) {
  if (!userId) throw new Error("Missing notification userId.");

  const identity = getProfileIdentity?.() || {};

  const values = cleanPayload({
    user_id: userId,
    actor_id: actorId || identity.user_id || null,

    type: safeText(type, "general"),
    title: safeText(title, "Rich Bizness Alert"),
    body: safeText(body, ""),

    target_table: targetTable,
    target_type: targetType,
    target_id: targetId,
    target_url: safeUrl(targetUrl, null),

    emoji: emoji || notificationIcon(type),
    priority: priority || "normal",

    action_label: actionLabel,
    action_url: safeUrl(actionUrl, null),

    is_read: false,
    is_seen: false,
    is_silent: false,

    metadata: {
      source: "rb-notifications.js",
      actor_username: identity.username || null,
      actor_display_name: identity.display_name || null,
      actor_avatar_url: identity.avatar_url || null,
      ...metadata
    },

    created_at: now(),
    updated_at: now()
  });

  const data = await rbInsert({
    table: notifyTable(),
    values
  });

  return data?.[0] || null;
}

export async function notifySelf(payload = {}) {
  const user = getUser();
  if (!user?.id) return null;

  return await createNotification({
    userId: user.id,
    ...payload
  });
}

export async function notifyLiveStarted({
  creatorId,
  streamId,
  streamSlug = null,
  title = "WE LIT 🔥",
  body = "A Rich Bizness live room just started.",
  metadata = {}
}) {
  return await createNotification({
    userId: creatorId,
    type: "live_started",
    title,
    body,
    targetTable: RB_TABLES.liveStreams,
    targetType: "live",
    targetId: streamId,
    targetUrl: `${RB_ROUTES.watch}?stream=${encodeURIComponent(streamSlug || streamId)}`,
    emoji: "🔥",
    priority: "high",
    metadata
  });
}

export async function notifyLiveCreated({
  creatorId,
  streamId,
  streamSlug = null,
  title = "Live studio created",
  body = "Your live studio is ready.",
  metadata = {}
}) {
  return await createNotification({
    userId: creatorId,
    type: "live_created",
    title,
    body,
    targetTable: RB_TABLES.liveStreams,
    targetType: "live",
    targetId: streamId,
    targetUrl: `${RB_ROUTES.watch}?stream=${encodeURIComponent(streamSlug || streamId)}`,
    emoji: "📺",
    priority: "normal",
    metadata
  });
}

export async function notifyFollow({
  userId,
  actorId,
  title = "New follower",
  body = "Someone followed you.",
  metadata = {}
}) {
  return await createNotification({
    userId,
    actorId,
    type: "follow",
    title,
    body,
    targetTable: RB_TABLES.followers,
    targetType: "profile",
    targetId: actorId,
    targetUrl: `${RB_ROUTES.profile}?id=${encodeURIComponent(actorId)}`,
    emoji: "👑",
    priority: "normal",
    metadata
  });
}

export async function notifyMessage({
  userId,
  actorId,
  threadId,
  title = "New message",
  body = "You have a new Rich DM.",
  metadata = {}
}) {
  return await createNotification({
    userId,
    actorId,
    type: "dm_message",
    title,
    body,
    targetTable: RB_TABLES.dmThreads,
    targetType: "message",
    targetId: threadId,
    targetUrl: `${RB_ROUTES.messages}?thread=${encodeURIComponent(threadId)}`,
    emoji: "💬",
    priority: "normal",
    metadata
  });
}

export async function notifyUploadProcessed({
  userId,
  uploadId,
  title = "Upload ready",
  body = "Your upload is live on Rich Bizness.",
  targetUrl = RB_ROUTES.upload,
  metadata = {}
}) {
  return await createNotification({
    userId,
    type: "upload_ready",
    title,
    body,
    targetTable: RB_TABLES.uploads,
    targetType: "upload",
    targetId: uploadId,
    targetUrl,
    emoji: "⬆️",
    priority: "normal",
    metadata
  });
}

export async function notifyStoreOrder({
  userId,
  actorId = null,
  orderId,
  title = "New store order",
  body = "A Rich Bizness store order came in.",
  metadata = {}
}) {
  return await createNotification({
    userId,
    actorId,
    type: "store_order",
    title,
    body,
    targetTable: RB_TABLES.storeOrders,
    targetType: "store",
    targetId: orderId,
    targetUrl: RB_ROUTES.store,
    emoji: "🛒",
    priority: "high",
    metadata
  });
}

export async function notifyTip({
  userId,
  actorId = null,
  targetId = null,
  title = "New tip",
  body = "You received a Rich Bizness tip.",
  metadata = {}
}) {
  return await createNotification({
    userId,
    actorId,
    type: "tip",
    title,
    body,
    targetTable: "tips",
    targetType: "money",
    targetId,
    targetUrl: RB_ROUTES.monetization || RB_ROUTES.profile,
    emoji: "💸",
    priority: "high",
    metadata
  });
}

export async function loadMyNotifications({
  limit = 50,
  unreadOnly = false,
  unseenOnly = false
} = {}) {
  const user = getUser();
  if (!user?.id) return [];

  let query = supabase
    .from(notifyTable())
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) query = query.eq("is_read", false);
  if (unseenOnly) query = query.eq("is_seen", false);

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

export async function countUnreadNotifications() {
  const user = getUser();
  if (!user?.id) return 0;

  const { count, error } = await supabase
    .from(notifyTable())
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) throw error;
  return count || 0;
}

export async function countUnseenNotifications() {
  const user = getUser();
  if (!user?.id) return 0;

  const { count, error } = await supabase
    .from(notifyTable())
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_seen", false);

  if (error) throw error;
  return count || 0;
}

export async function markNotificationRead(notificationId) {
  if (!notificationId) throw new Error("Missing notification id.");

  const stamp = now();

  const data = await rbUpdate({
    table: notifyTable(),
    match: { id: notificationId },
    values: {
      is_read: true,
      is_seen: true,
      read_at: stamp,
      seen_at: stamp,
      updated_at: stamp
    }
  });

  return data?.[0] || null;
}

export async function markNotificationSeen(notificationId) {
  if (!notificationId) throw new Error("Missing notification id.");

  const stamp = now();

  const data = await rbUpdate({
    table: notifyTable(),
    match: { id: notificationId },
    values: {
      is_seen: true,
      seen_at: stamp,
      updated_at: stamp
    }
  });

  return data?.[0] || null;
}

export async function markAllNotificationsRead() {
  const user = getUser();
  if (!user?.id) return [];

  const stamp = now();

  const { data, error } = await supabase
    .from(notifyTable())
    .update({
      is_read: true,
      is_seen: true,
      read_at: stamp,
      seen_at: stamp,
      updated_at: stamp
    })
    .eq("user_id", user.id)
    .eq("is_read", false)
    .select("*");

  if (error) throw error;
  return data || [];
}

export async function markNotificationsSeen() {
  const user = getUser();
  if (!user?.id) return [];

  const stamp = now();

  const { data, error } = await supabase
    .from(notifyTable())
    .update({
      is_seen: true,
      seen_at: stamp,
      updated_at: stamp
    })
    .eq("user_id", user.id)
    .eq("is_seen", false)
    .select("*");

  if (error) throw error;
  return data || [];
}

export function subscribeMyNotifications(callback) {
  const user = getUser();

  if (!user?.id || typeof callback !== "function") {
    return null;
  }

  const channel = createRealtimeChannel(`rb-notifications-${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: notifyTable(),
        filter: `user_id=eq.${user.id}`
      },
      callback
    )
    .subscribe();

  return channel;
}

export async function unsubscribeNotifications(channel) {
  return await removeRealtimeChannel(channel);
}

export function notificationIcon(type = "", fallback = "💨") {
  const icons = {
    general: "💨",
    live_created: "📺",
    live_started: "🔥",
    live_ban: "🚫",
    follow: "👑",
    dm_message: "💬",
    upload_ready: "⬆️",
    store_order: "🛒",
    tip: "💸",
    music: "🎵",
    gaming: "🎮",
    sports: "🏆",
    meta: "🌌",
    avatar: "🧍",
    xp: "⚡",
    monetization: "💰"
  };

  return icons[type] || fallback;
}

export function renderNotificationText(notification = {}) {
  const type = notification.type || "general";

  return {
    icon: notification.emoji || notificationIcon(type),
    title: notification.title || "Rich Bizness Alert",
    body: notification.body || "",
    url:
      notification.action_url ||
      notification.target_url ||
      RB_ROUTES.notifications
  };
}

console.log("RB NOTIFICATIONS READY");
