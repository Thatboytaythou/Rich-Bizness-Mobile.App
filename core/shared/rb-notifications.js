/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-notifications.js

   NOTIFICATIONS ENGINE
   Rich Alerts + Reads + Realtime Ready
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
  rbUpdate
} from "/core/shared/rb-supabase.js";

const supabase = getSupabase();

function now() {
  return new Date().toISOString();
}

function notifyTable() {
  return RB_TABLES.richNotifications || RB_TABLES.notifications;
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

  const data = await rbInsert({
    table: notifyTable(),
    values: {
      user_id: userId,
      actor_id: actorId || identity.user_id || null,
      type,
      title,
      body,
      target_table: targetTable,
      target_type: targetType,
      target_id: targetId,
      target_url: targetUrl,
      emoji,
      priority,
      action_label: actionLabel,
      action_url: actionUrl,
      is_read: false,
      is_seen: false,
      is_silent: false,
      metadata: {
        source: "rb-notifications.js",
        actor_username: identity.username || null,
        actor_display_name: identity.display_name || null,
        actor_avatar_url: identity.avatar_url || null,
        ...metadata
      }
    }
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

export async function loadMyNotifications({
  limit = 50,
  unreadOnly = false
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

export async function markNotificationRead(notificationId) {
  if (!notificationId) throw new Error("Missing notification id.");

  const data = await rbUpdate({
    table: notifyTable(),
    match: { id: notificationId },
    values: {
      is_read: true,
      is_seen: true,
      read_at: now(),
      seen_at: now(),
      updated_at: now()
    }
  });

  return data?.[0] || null;
}

export async function markAllNotificationsRead() {
  const user = getUser();
  if (!user?.id) return [];

  const { data, error } = await supabase
    .from(notifyTable())
    .update({
      is_read: true,
      is_seen: true,
      read_at: now(),
      seen_at: now(),
      updated_at: now()
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

  const { data, error } = await supabase
    .from(notifyTable())
    .update({
      is_seen: true,
      seen_at: now(),
      updated_at: now()
    })
    .eq("user_id", user.id)
    .eq("is_seen", false)
    .select("*");

  if (error) throw error;
  return data || [];
}

export function notificationIcon(type = "", fallback = "💨") {
  const icons = {
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
    meta: "🌌"
  };

  return icons[type] || fallback;
}

export function renderNotificationText(notification = {}) {
  return {
    icon: notification.emoji || notificationIcon(notification.type),
    title: notification.title || "Rich Bizness Alert",
    body: notification.body || "",
    url:
      notification.action_url ||
      notification.target_url ||
      RB_ROUTES.notifications
  };
}

console.log("RB NOTIFICATIONS READY");
