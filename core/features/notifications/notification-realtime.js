/* =========================
   RICH BIZNESS MOBILE
   /core/features/notifications/notification-realtime.js

   NOTIFICATION REALTIME ENGINE
   Supabase channel bridge + toast dispatch
========================= */

import {
  getUser
} from "/core/shared/rb-supabase.js";

import {
  subscribeToNotifications,
  unsubscribeChannel,
  rbChannelName
} from "/core/shared/rb-realtime.js";

import {
  refreshNotifications,
  refreshUnreadCount,
  upsertNotification,
  removeNotification,
  bindNotificationRealtime,
  clearNotificationRealtime,
  getNotificationState
} from "/core/features/notifications/notification-state.js";

import {
  renderNotificationText
} from "/core/shared/rb-notifications.js";

const NOTIFICATION_REALTIME = {
  ready: false,
  running: false,
  channel: null,
  channelKey: null,
  userId: null,
  lastPayload: null,
  error: null,
  listeners: new Set()
};

function cloneState() {
  return {
    ready: NOTIFICATION_REALTIME.ready,
    running: NOTIFICATION_REALTIME.running,
    channelKey: NOTIFICATION_REALTIME.channelKey,
    userId: NOTIFICATION_REALTIME.userId,
    lastPayload: NOTIFICATION_REALTIME.lastPayload,
    error: NOTIFICATION_REALTIME.error
  };
}

export function getNotificationRealtimeState() {
  return cloneState();
}

export function onNotificationRealtime(callback) {
  if (typeof callback !== "function") return () => {};

  NOTIFICATION_REALTIME.listeners.add(callback);

  try {
    callback(getNotificationRealtimeState());
  } catch (error) {
    console.warn("[RB NOTIFICATION REALTIME LISTENER ERROR]", error);
  }

  return () => {
    NOTIFICATION_REALTIME.listeners.delete(callback);
  };
}

function emitRealtimeState() {
  const state = getNotificationRealtimeState();

  NOTIFICATION_REALTIME.listeners.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
      console.warn("[RB NOTIFICATION REALTIME LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:notification-realtime-state", {
      detail: state
    })
  );
}

function dispatchRealtimeEvent(name, detail = {}) {
  window.dispatchEvent(
    new CustomEvent(name, {
      detail
    })
  );
}

function displayPayload(notification = {}) {
  const display = renderNotificationText(notification);

  return {
    id: notification.id || "",
    icon: display.icon || notification.emoji || "💨",
    title: display.title || notification.title || "Rich Bizness Alert",
    body: display.body || notification.body || "",
    url:
      notification.action_url ||
      notification.target_url ||
      display.url ||
      "/notifications",
    notification
  };
}

function dispatchToast(notification = {}) {
  const display = displayPayload(notification);

  dispatchRealtimeEvent("rb:notification-toast", display);

  dispatchRealtimeEvent("rb:toast", {
    type: "info",
    title: display.title,
    message: display.body,
    icon: display.icon,
    url: display.url,
    notification
  });
}

async function handleNotificationPayload(payload = {}) {
  NOTIFICATION_REALTIME.lastPayload = payload;
  NOTIFICATION_REALTIME.error = null;

  const eventType =
    payload.eventType ||
    payload.type ||
    "";

  const oldRow = payload.old || null;
  const newRow = payload.new || null;

  try {
    if (eventType === "DELETE") {
      if (oldRow?.id) {
        removeNotification(oldRow.id);
      }

      await refreshUnreadCount();

      dispatchRealtimeEvent("rb:notification-deleted", {
        payload,
        notification: oldRow
      });

      emitRealtimeState();
      return;
    }

    if (newRow?.id) {
      upsertNotification(newRow);

      await refreshUnreadCount();

      dispatchRealtimeEvent("rb:notification-upserted", {
        payload,
        notification: newRow,
        display: displayPayload(newRow)
      });

      if (eventType === "INSERT" && !newRow.is_read) {
        dispatchToast(newRow);
      }

      emitRealtimeState();
      return;
    }

    await refreshNotifications();

    dispatchRealtimeEvent("rb:notification-refreshed", {
      payload,
      state: getNotificationState()
    });
  } catch (error) {
    NOTIFICATION_REALTIME.error = error;
    console.warn("[RB NOTIFICATION REALTIME HANDLE FAILED]", error?.message || error);
  } finally {
    emitRealtimeState();
  }
}

export async function startNotificationRealtime({
  userId = null,
  refreshOnStart = true,
  useStateBridge = false
} = {}) {
  const user = getUser();
  const activeUserId = userId || user?.id;

  if (!activeUserId) {
    await stopNotificationRealtime();

    NOTIFICATION_REALTIME.ready = true;
    NOTIFICATION_REALTIME.running = false;
    NOTIFICATION_REALTIME.userId = null;
    NOTIFICATION_REALTIME.error = null;

    emitRealtimeState();
    return null;
  }

  await stopNotificationRealtime();

  NOTIFICATION_REALTIME.running = true;
  NOTIFICATION_REALTIME.ready = false;
  NOTIFICATION_REALTIME.userId = activeUserId;
  NOTIFICATION_REALTIME.error = null;

  emitRealtimeState();

  try {
    if (refreshOnStart) {
      await refreshNotifications();
    }

    if (useStateBridge) {
      const channel = bindNotificationRealtime();

      NOTIFICATION_REALTIME.channel = channel;
      NOTIFICATION_REALTIME.channelKey =
        rbChannelName("notifications", activeUserId);
      NOTIFICATION_REALTIME.ready = true;

      emitRealtimeState();
      return channel;
    }

    const key = rbChannelName("notifications", activeUserId);

    NOTIFICATION_REALTIME.channelKey = key;

    const channel = subscribeToNotifications({
      userId: activeUserId,
      onChange: handleNotificationPayload,
      onStatus: (status) => {
        dispatchRealtimeEvent("rb:notification-realtime-status", {
          status,
          channelKey: key,
          userId: activeUserId
        });

        if (status === "SUBSCRIBED") {
          NOTIFICATION_REALTIME.ready = true;
          NOTIFICATION_REALTIME.running = true;
          NOTIFICATION_REALTIME.error = null;
          emitRealtimeState();
        }
      }
    });

    NOTIFICATION_REALTIME.channel = channel;
    NOTIFICATION_REALTIME.ready = true;

    emitRealtimeState();

    return channel;
  } catch (error) {
    NOTIFICATION_REALTIME.ready = false;
    NOTIFICATION_REALTIME.running = false;
    NOTIFICATION_REALTIME.error = error;

    console.warn("[RB NOTIFICATION REALTIME START FAILED]", error?.message || error);

    emitRealtimeState();

    return null;
  }
}

export async function stopNotificationRealtime() {
  try {
    if (NOTIFICATION_REALTIME.channelKey) {
      await unsubscribeChannel(NOTIFICATION_REALTIME.channelKey);
    }

    await clearNotificationRealtime();
  } catch (error) {
    console.warn("[RB NOTIFICATION REALTIME STOP SKIPPED]", error?.message || error);
  }

  NOTIFICATION_REALTIME.channel = null;
  NOTIFICATION_REALTIME.channelKey = null;
  NOTIFICATION_REALTIME.running = false;
  NOTIFICATION_REALTIME.ready = true;

  emitRealtimeState();
}

export async function restartNotificationRealtime(options = {}) {
  await stopNotificationRealtime();
  return await startNotificationRealtime(options);
}

export function bindNotificationRealtimeStatus({
  target = "[data-rb-notification-realtime-status]"
} = {}) {
  return onNotificationRealtime((state) => {
    document.querySelectorAll(target).forEach((el) => {
      if (state.error) {
        el.textContent = state.error?.message || "Realtime error";
        el.dataset.status = "error";
        return;
      }

      if (state.running && state.ready) {
        el.textContent = "Realtime synced";
        el.dataset.status = "ready";
        return;
      }

      if (state.running) {
        el.textContent = "Connecting realtime...";
        el.dataset.status = "connecting";
        return;
      }

      el.textContent = "Realtime idle";
      el.dataset.status = "idle";
    });
  });
}

export function bindNotificationToastBridge() {
  if (window.__RB_NOTIFICATION_TOAST_BRIDGE_BOUND__) return;

  window.__RB_NOTIFICATION_TOAST_BRIDGE_BOUND__ = true;

  window.addEventListener("rb:notification-upserted", (event) => {
    const notification = event.detail?.notification;
    if (!notification || notification.is_read) return;

    if (event.detail?.payload?.eventType !== "INSERT") return;

    dispatchToast(notification);
  });
}

export async function bootNotificationRealtime(options = {}) {
  bindNotificationRealtimeStatus();
  bindNotificationToastBridge();

  const user = getUser();

  if (!user?.id) {
    NOTIFICATION_REALTIME.ready = true;
    NOTIFICATION_REALTIME.running = false;
    emitRealtimeState();
    console.log("RB NOTIFICATION REALTIME READY — GUEST");
    return null;
  }

  const channel = await startNotificationRealtime(options);

  console.log("RB NOTIFICATION REALTIME READY");
  return channel;
}

window.addEventListener("rb:auth-state", async (event) => {
  const state = event.detail;

  if (!state?.ready) return;

  if (state?.user?.id) {
    await restartNotificationRealtime({
      userId: state.user.id,
      refreshOnStart: true
    });
    return;
  }

  await stopNotificationRealtime();
});

window.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;

  const user = getUser();
  if (!user?.id) return;

  await refreshUnreadCount().catch((error) => {
    console.warn("[RB NOTIFICATION VISIBILITY COUNT SKIPPED]", error?.message || error);
  });
});

window.addEventListener("beforeunload", () => {
  stopNotificationRealtime();
});

console.log("RB NOTIFICATION REALTIME MODULE LOADED");
