/* =========================
   RICH BIZNESS MOBILE
   /core/features/notifications/notification-state.js

   NOTIFICATION STATE ENGINE
   Rich alerts + unread counts + realtime bridge
========================= */

import {
  loadMyNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  markNotificationsSeen,
  renderNotificationText
} from "/core/shared/rb-notifications.js";

import {
  getUser
} from "/core/shared/rb-supabase.js";

import {
  subscribeToNotifications,
  unsubscribeChannel,
  rbChannelName
} from "/core/shared/rb-realtime.js";

const NOTIFICATION_STATE = {
  ready: false,
  loading: false,
  unreadCount: 0,
  notifications: [],
  latest: null,
  error: null,
  channelKey: null
};

const listeners = new Set();

function cloneState() {
  return {
    ready: NOTIFICATION_STATE.ready,
    loading: NOTIFICATION_STATE.loading,
    unreadCount: NOTIFICATION_STATE.unreadCount,
    notifications: [...NOTIFICATION_STATE.notifications],
    latest: NOTIFICATION_STATE.latest,
    error: NOTIFICATION_STATE.error,
    channelKey: NOTIFICATION_STATE.channelKey
  };
}

export function getNotificationState() {
  return cloneState();
}

export function onNotificationState(callback) {
  if (typeof callback !== "function") return () => {};

  listeners.add(callback);

  try {
    callback(getNotificationState());
  } catch (error) {
    console.warn("[RB NOTIFICATION LISTENER ERROR]", error);
  }

  return () => {
    listeners.delete(callback);
  };
}

function emitNotificationState() {
  const state = getNotificationState();

  listeners.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
      console.warn("[RB NOTIFICATION LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:notification-state", {
      detail: state
    })
  );
}

export function setNotificationLoading(value = true) {
  NOTIFICATION_STATE.loading = Boolean(value);
  emitNotificationState();
}

export function setNotificationError(error = null) {
  NOTIFICATION_STATE.error = error;
  NOTIFICATION_STATE.loading = false;
  emitNotificationState();
}

export function setNotifications(notifications = []) {
  NOTIFICATION_STATE.notifications = Array.isArray(notifications)
    ? notifications
    : [];

  NOTIFICATION_STATE.latest =
    NOTIFICATION_STATE.notifications[0] || null;

  NOTIFICATION_STATE.ready = true;
  NOTIFICATION_STATE.loading = false;
  NOTIFICATION_STATE.error = null;

  emitNotificationState();
}

export function setUnreadCount(count = 0) {
  NOTIFICATION_STATE.unreadCount = Number(count || 0);
  emitNotificationState();
}

export function upsertNotification(notification = {}) {
  if (!notification?.id) return;

  const index = NOTIFICATION_STATE.notifications.findIndex(
    (item) => item.id === notification.id
  );

  if (index >= 0) {
    NOTIFICATION_STATE.notifications[index] = {
      ...NOTIFICATION_STATE.notifications[index],
      ...notification
    };
  } else {
    NOTIFICATION_STATE.notifications.unshift(notification);
  }

  NOTIFICATION_STATE.latest = NOTIFICATION_STATE.notifications[0] || null;

  NOTIFICATION_STATE.unreadCount =
    NOTIFICATION_STATE.notifications.filter((item) => !item.is_read).length;

  emitNotificationState();

  window.dispatchEvent(
    new CustomEvent("rb:notification-new", {
      detail: {
        notification,
        display: renderNotificationText(notification)
      }
    })
  );
}

export function removeNotification(notificationId) {
  if (!notificationId) return;

  NOTIFICATION_STATE.notifications =
    NOTIFICATION_STATE.notifications.filter((item) => item.id !== notificationId);

  NOTIFICATION_STATE.latest = NOTIFICATION_STATE.notifications[0] || null;

  NOTIFICATION_STATE.unreadCount =
    NOTIFICATION_STATE.notifications.filter((item) => !item.is_read).length;

  emitNotificationState();
}

export async function refreshNotifications({
  limit = 50,
  unreadOnly = false
} = {}) {
  const user = getUser();

  if (!user?.id) {
    resetNotificationState();
    NOTIFICATION_STATE.ready = true;
    emitNotificationState();
    return getNotificationState();
  }

  NOTIFICATION_STATE.loading = true;
  emitNotificationState();

  try {
    const [notifications, unreadCount] = await Promise.all([
      loadMyNotifications({
        limit,
        unreadOnly
      }),
      countUnreadNotifications()
    ]);

    NOTIFICATION_STATE.notifications = notifications || [];
    NOTIFICATION_STATE.unreadCount = unreadCount || 0;
    NOTIFICATION_STATE.latest = NOTIFICATION_STATE.notifications[0] || null;
    NOTIFICATION_STATE.ready = true;
    NOTIFICATION_STATE.error = null;
  } catch (error) {
    NOTIFICATION_STATE.error = error;
    console.warn("[RB NOTIFICATIONS REFRESH FAILED]", error?.message || error);
  } finally {
    NOTIFICATION_STATE.loading = false;
    emitNotificationState();
  }

  return getNotificationState();
}

export async function initNotificationState({
  limit = 50,
  realtime = true
} = {}) {
  await refreshNotifications({
    limit
  });

  if (realtime) {
    bindNotificationRealtime();
  }

  return getNotificationState();
}

export async function readNotification(notificationId) {
  if (!notificationId) return null;

  const updated = await markNotificationRead(notificationId);

  if (updated?.id) {
    upsertNotification(updated);
  } else {
    const existing = NOTIFICATION_STATE.notifications.find(
      (item) => item.id === notificationId
    );

    if (existing) {
      upsertNotification({
        ...existing,
        is_read: true,
        is_seen: true,
        read_at: new Date().toISOString(),
        seen_at: new Date().toISOString()
      });
    }
  }

  await refreshUnreadCount();

  return updated;
}

export async function readAllNotifications() {
  const rows = await markAllNotificationsRead();

  if (rows?.length) {
    rows.forEach(upsertNotification);
  } else {
    NOTIFICATION_STATE.notifications = NOTIFICATION_STATE.notifications.map((item) => ({
      ...item,
      is_read: true,
      is_seen: true,
      read_at: item.read_at || new Date().toISOString(),
      seen_at: item.seen_at || new Date().toISOString()
    }));
  }

  NOTIFICATION_STATE.unreadCount = 0;
  emitNotificationState();

  return rows || [];
}

export async function seenNotifications() {
  const rows = await markNotificationsSeen();

  if (rows?.length) {
    rows.forEach(upsertNotification);
  } else {
    NOTIFICATION_STATE.notifications = NOTIFICATION_STATE.notifications.map((item) => ({
      ...item,
      is_seen: true,
      seen_at: item.seen_at || new Date().toISOString()
    }));
  }

  emitNotificationState();

  return rows || [];
}

export async function refreshUnreadCount() {
  const user = getUser();

  if (!user?.id) {
    NOTIFICATION_STATE.unreadCount = 0;
    emitNotificationState();
    return 0;
  }

  try {
    const count = await countUnreadNotifications();
    NOTIFICATION_STATE.unreadCount = count || 0;
    emitNotificationState();
    return NOTIFICATION_STATE.unreadCount;
  } catch (error) {
    console.warn("[RB NOTIFICATION COUNT FAILED]", error?.message || error);
    return NOTIFICATION_STATE.unreadCount;
  }
}

export function bindNotificationBadges({
  badgeSelector = "[data-rb-notification-count]",
  dotSelector = "[data-rb-notification-dot]",
  latestSelector = "[data-rb-notification-latest]"
} = {}) {
  return onNotificationState((state) => {
    document.querySelectorAll(badgeSelector).forEach((el) => {
      el.textContent = String(state.unreadCount || 0);
      el.dataset.count = String(state.unreadCount || 0);
      el.classList.toggle("is-active", Number(state.unreadCount || 0) > 0);
    });

    document.querySelectorAll(dotSelector).forEach((el) => {
      el.classList.toggle("is-active", Number(state.unreadCount || 0) > 0);
    });

    document.querySelectorAll(latestSelector).forEach((el) => {
      const latest = state.latest
        ? renderNotificationText(state.latest)
        : null;

      el.textContent = latest
        ? `${latest.icon} ${latest.title}`
        : "No alerts";
    });
  });
}

export function bindNotificationRealtime() {
  const user = getUser();

  if (!user?.id) return null;

  clearNotificationRealtime();

  const key = rbChannelName("notifications", user.id);

  NOTIFICATION_STATE.channelKey = key;

  const channel = subscribeToNotifications({
    userId: user.id,
    onChange: async (payload) => {
      const eventType = payload?.eventType;

      if (eventType === "DELETE") {
        removeNotification(payload?.old?.id);
        await refreshUnreadCount();
        return;
      }

      if (payload?.new?.id) {
        upsertNotification(payload.new);
        await refreshUnreadCount();
        return;
      }

      await refreshNotifications();
    },
    onStatus: (status) => {
      window.dispatchEvent(
        new CustomEvent("rb:notification-realtime-status", {
          detail: {
            status,
            channelKey: key
          }
        })
      );
    }
  });

  emitNotificationState();

  return channel;
}

export async function clearNotificationRealtime() {
  if (!NOTIFICATION_STATE.channelKey) return;

  await unsubscribeChannel(NOTIFICATION_STATE.channelKey);

  NOTIFICATION_STATE.channelKey = null;
  emitNotificationState();
}

export function resetNotificationState() {
  NOTIFICATION_STATE.ready = false;
  NOTIFICATION_STATE.loading = false;
  NOTIFICATION_STATE.unreadCount = 0;
  NOTIFICATION_STATE.notifications = [];
  NOTIFICATION_STATE.latest = null;
  NOTIFICATION_STATE.error = null;

  emitNotificationState();
}

export function renderNotificationItem(notification = {}) {
  const display = renderNotificationText(notification);

  return {
    id: notification.id || "",
    icon: display.icon,
    title: display.title,
    body: display.body,
    url: display.url,
    is_read: !!notification.is_read,
    is_seen: !!notification.is_seen,
    created_at: notification.created_at || null,
    raw: notification
  };
}

window.addEventListener("beforeunload", () => {
  clearNotificationRealtime();
});

console.log("RB NOTIFICATION STATE READY");
