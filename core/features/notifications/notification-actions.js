/* =========================
   RICH BIZNESS MOBILE
   /core/features/notifications/notification-actions.js

   NOTIFICATION ACTION ENGINE
   Create + read + route + realtime refresh helpers
========================= */

import {
  RB_ROUTES,
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getUser,
  getProfileIdentity
} from "/core/shared/rb-supabase.js";

import {
  createNotification,
  notifySelf,
  notifyLiveCreated,
  notifyLiveStarted,
  notifyFollow,
  notifyMessage,
  notifyUploadProcessed,
  markNotificationRead,
  markAllNotificationsRead,
  markNotificationsSeen,
  renderNotificationText
} from "/core/shared/rb-notifications.js";

import {
  refreshNotifications,
  refreshUnreadCount,
  readNotification,
  readAllNotifications,
  seenNotifications,
  upsertNotification
} from "/core/features/notifications/notification-state.js";

function now() {
  return new Date().toISOString();
}

function cleanText(value = "", fallback = "") {
  return String(value || fallback || "").trim();
}

function signInUrl() {
  return `${RB_ROUTES.auth || "/auth"}?next=${encodeURIComponent(
    window.location.pathname + window.location.search
  )}`;
}

function requireSignedIn() {
  const user = getUser();

  if (!user?.id) {
    window.location.href = signInUrl();
    throw new Error("Sign in required.");
  }

  return user;
}

function targetUrl(notification = {}) {
  const display = renderNotificationText(notification);

  return (
    notification.action_url ||
    notification.target_url ||
    display.url ||
    RB_ROUTES.notifications ||
    "/notifications"
  );
}

/* =========================
   CREATE ACTIONS
========================= */

export async function sendNotification(payload = {}) {
  requireSignedIn();

  const row = await createNotification({
    ...payload,
    metadata: {
      source: "notification-actions.js",
      ...(payload.metadata || {})
    }
  });

  if (row?.id) {
    upsertNotification(row);
    await refreshUnreadCount();
  }

  return row;
}

export async function sendSelfNotification(payload = {}) {
  const row = await notifySelf({
    ...payload,
    metadata: {
      source: "notification-actions.js",
      ...(payload.metadata || {})
    }
  });

  if (row?.id) {
    upsertNotification(row);
    await refreshUnreadCount();
  }

  return row;
}

export async function sendLiveCreatedNotification(payload = {}) {
  const row = await notifyLiveCreated({
    ...payload,
    metadata: {
      source: "notification-actions.js",
      ...(payload.metadata || {})
    }
  });

  if (row?.id) {
    upsertNotification(row);
    await refreshUnreadCount();
  }

  return row;
}

export async function sendLiveStartedNotification(payload = {}) {
  const row = await notifyLiveStarted({
    ...payload,
    metadata: {
      source: "notification-actions.js",
      ...(payload.metadata || {})
    }
  });

  if (row?.id) {
    upsertNotification(row);
    await refreshUnreadCount();
  }

  return row;
}

export async function sendFollowNotification(payload = {}) {
  const row = await notifyFollow({
    ...payload,
    metadata: {
      source: "notification-actions.js",
      ...(payload.metadata || {})
    }
  });

  if (row?.id) {
    upsertNotification(row);
    await refreshUnreadCount();
  }

  return row;
}

export async function sendMessageNotification(payload = {}) {
  const row = await notifyMessage({
    ...payload,
    metadata: {
      source: "notification-actions.js",
      ...(payload.metadata || {})
    }
  });

  if (row?.id) {
    upsertNotification(row);
    await refreshUnreadCount();
  }

  return row;
}

export async function sendUploadProcessedNotification(payload = {}) {
  const row = await notifyUploadProcessed({
    ...payload,
    metadata: {
      source: "notification-actions.js",
      ...(payload.metadata || {})
    }
  });

  if (row?.id) {
    upsertNotification(row);
    await refreshUnreadCount();
  }

  return row;
}

/* =========================
   QUICK BUILDERS
========================= */

export async function notifyRichAction({
  userId,
  type = "general",
  title = "Rich Bizness Alert",
  body = "",
  emoji = "💨",
  targetUrl = RB_ROUTES.notifications,
  targetTable = null,
  targetType = null,
  targetId = null,
  priority = "normal",
  metadata = {}
} = {}) {
  if (!userId) throw new Error("Missing notification userId.");

  const identity = getProfileIdentity?.() || {};

  return await sendNotification({
    userId,
    actorId: identity.user_id || null,
    type,
    title,
    body,
    emoji,
    targetUrl,
    targetTable,
    targetType,
    targetId,
    priority,
    metadata: {
      actor_username: identity.username || null,
      actor_display_name: identity.display_name || null,
      actor_avatar_url: identity.avatar_url || null,
      ...metadata
    }
  });
}

export async function notifyProfileViewed({
  userId,
  viewerId = null,
  metadata = {}
} = {}) {
  if (!userId || userId === viewerId) return null;

  return await notifyRichAction({
    userId,
    type: "profile_view",
    title: "Profile viewed",
    body: "Someone tapped into your Rich Bizness profile.",
    emoji: "👤",
    targetUrl: `${RB_ROUTES.profile}?id=${encodeURIComponent(viewerId || userId)}`,
    targetTable: RB_TABLES.profiles,
    targetType: "profile",
    targetId: viewerId,
    metadata
  });
}

export async function notifyContentLiked({
  userId,
  actorId = null,
  targetTable = RB_TABLES.feedPosts,
  targetId = null,
  targetUrl = RB_ROUTES.feed,
  section = "feed",
  metadata = {}
} = {}) {
  if (!userId) throw new Error("Missing notification userId.");

  return await notifyRichAction({
    userId,
    type: `${section}_like`,
    title: "New like",
    body: "Someone liked your Rich Bizness drop.",
    emoji: "💚",
    targetUrl,
    targetTable,
    targetType: section,
    targetId,
    metadata: {
      actor_id: actorId,
      section,
      ...metadata
    }
  });
}

export async function notifyContentCommented({
  userId,
  actorId = null,
  targetTable = RB_TABLES.feedPosts,
  targetId = null,
  targetUrl = RB_ROUTES.feed,
  section = "feed",
  body = "Someone commented on your Rich Bizness drop.",
  metadata = {}
} = {}) {
  if (!userId) throw new Error("Missing notification userId.");

  return await notifyRichAction({
    userId,
    type: `${section}_comment`,
    title: "New comment",
    body,
    emoji: "💬",
    targetUrl,
    targetTable,
    targetType: section,
    targetId,
    metadata: {
      actor_id: actorId,
      section,
      ...metadata
    }
  });
}

export async function notifyStoreOrder({
  sellerId,
  orderId,
  title = "New store order",
  body = "You received a new Rich Bizness order.",
  metadata = {}
} = {}) {
  if (!sellerId) throw new Error("Missing sellerId.");

  return await notifyRichAction({
    userId: sellerId,
    type: "store_order",
    title,
    body,
    emoji: "🛒",
    priority: "high",
    targetTable: RB_TABLES.storeOrders,
    targetType: "store_order",
    targetId: orderId,
    targetUrl: `${RB_ROUTES.store}?order=${encodeURIComponent(orderId || "")}`,
    metadata
  });
}

export async function notifyTipReceived({
  userId,
  tipId,
  amountCents = 0,
  streamId = null,
  metadata = {}
} = {}) {
  if (!userId) throw new Error("Missing userId.");

  const amount = `$${(Number(amountCents || 0) / 100).toFixed(2)}`;

  return await notifyRichAction({
    userId,
    type: "tip",
    title: "New tip received",
    body: `You received a ${amount} tip.`,
    emoji: "💸",
    priority: "high",
    targetTable: RB_TABLES.liveTips,
    targetType: "tip",
    targetId: tipId,
    targetUrl: streamId
      ? `${RB_ROUTES.watch}?stream=${encodeURIComponent(streamId)}`
      : RB_ROUTES.notifications,
    metadata: {
      amount_cents: amountCents,
      stream_id: streamId,
      ...metadata
    }
  });
}

/* =========================
   READ / SEEN ACTIONS
========================= */

export async function markRead(notificationId) {
  if (!notificationId) throw new Error("Missing notification id.");

  const row = await readNotification(notificationId);
  await refreshUnreadCount();

  return row;
}

export async function markReadDirect(notificationId) {
  if (!notificationId) throw new Error("Missing notification id.");

  const row = await markNotificationRead(notificationId);

  if (row?.id) {
    upsertNotification(row);
  }

  await refreshUnreadCount();

  return row;
}

export async function markAllRead() {
  const rows = await readAllNotifications();
  await refreshUnreadCount();

  return rows;
}

export async function markAllReadDirect() {
  const rows = await markAllNotificationsRead();

  if (rows?.length) {
    rows.forEach(upsertNotification);
  }

  await refreshUnreadCount();

  return rows || [];
}

export async function markSeen() {
  const rows = await seenNotifications();
  return rows;
}

export async function markSeenDirect() {
  const rows = await markNotificationsSeen();

  if (rows?.length) {
    rows.forEach(upsertNotification);
  }

  return rows || [];
}

/* =========================
   OPEN / ROUTE ACTIONS
========================= */

export async function openNotification(notification = {}) {
  if (!notification) return false;

  if (notification.id && !notification.is_read) {
    try {
      await markRead(notification.id);
    } catch (error) {
      console.warn("[RB OPEN NOTIFICATION READ SKIPPED]", error?.message || error);
    }
  }

  const url = targetUrl(notification);

  if (url) {
    window.location.href = url;
    return true;
  }

  return false;
}

export async function openNotificationById(notificationId) {
  if (!notificationId) return false;

  await markRead(notificationId);
  await refreshNotifications();

  return true;
}

export function getNotificationDisplay(notification = {}) {
  return {
    ...renderNotificationText(notification),
    id: notification.id || "",
    url: targetUrl(notification),
    read: !!notification.is_read,
    seen: !!notification.is_seen,
    type: notification.type || "general",
    priority: notification.priority || "normal",
    created_at: notification.created_at || now()
  };
}

/* =========================
   UI BINDERS
========================= */

export function bindNotificationActionButtons({
  readSelector = "[data-notification-read]",
  openSelector = "[data-notification-open]",
  readAllSelector = "[data-notifications-read-all]",
  seenSelector = "[data-notifications-seen]",
  refreshSelector = "[data-notifications-refresh]"
} = {}) {
  document.querySelectorAll(readSelector).forEach((button) => {
    if (button.dataset.rbNotificationActionBound === "true") return;
    button.dataset.rbNotificationActionBound = "true";

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const id = button.dataset.notificationRead || button.dataset.notificationId;
      if (!id) return;

      button.disabled = true;

      try {
        await markRead(id);
      } catch (error) {
        console.warn("[RB NOTIFICATION READ ACTION FAILED]", error?.message || error);
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll(openSelector).forEach((button) => {
    if (button.dataset.rbNotificationOpenBound === "true") return;
    button.dataset.rbNotificationOpenBound = "true";

    button.addEventListener("click", async (event) => {
      event.preventDefault();

      const id = button.dataset.notificationOpen || button.dataset.notificationId;
      const url = button.dataset.notificationUrl;

      if (id) {
        await markRead(id).catch(() => {});
      }

      if (url) {
        window.location.href = url;
      }
    });
  });

  document.querySelectorAll(readAllSelector).forEach((button) => {
    if (button.dataset.rbNotificationReadAllBound === "true") return;
    button.dataset.rbNotificationReadAllBound = "true";

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await markAllRead();
      } catch (error) {
        console.warn("[RB NOTIFICATION READ ALL FAILED]", error?.message || error);
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll(seenSelector).forEach((button) => {
    if (button.dataset.rbNotificationSeenBound === "true") return;
    button.dataset.rbNotificationSeenBound = "true";

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await markSeen();
      } catch (error) {
        console.warn("[RB NOTIFICATION SEEN FAILED]", error?.message || error);
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll(refreshSelector).forEach((button) => {
    if (button.dataset.rbNotificationRefreshBound === "true") return;
    button.dataset.rbNotificationRefreshBound = "true";

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await refreshNotifications();
      } catch (error) {
        console.warn("[RB NOTIFICATION REFRESH FAILED]", error?.message || error);
      } finally {
        button.disabled = false;
      }
    });
  });
}

export function bootNotificationActions() {
  bindNotificationActionButtons();

  window.addEventListener("rb:notifications-refresh-request", async () => {
    await refreshNotifications().catch((error) => {
      console.warn("[RB NOTIFICATION REFRESH REQUEST FAILED]", error?.message || error);
    });
  });

  console.log("RB NOTIFICATION ACTIONS READY");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootNotificationActions);
} else {
  bootNotificationActions();
}
