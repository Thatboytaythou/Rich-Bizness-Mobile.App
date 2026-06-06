/* =========================
   RICH BIZNESS MOBILE
   /core/pages/notifications.js

   NOTIFICATIONS PAGE CONTROLLER
   Synced with auth + profile-state
   Uses notification state/render/actions/realtime engines
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

import {
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  refreshProfileState,
  onProfileState
} from "/core/features/profile/profile-state.js";

import {
  profileName
} from "/core/shared/rb-profile.js";

import {
  toastInfo,
  toastError
} from "/core/shared/rb-toast.js";

import {
  initNotificationState,
  refreshNotifications,
  getNotificationState,
  onNotificationState,
  readAllNotifications,
  seenNotifications
} from "/core/features/notifications/notification-state.js";

import {
  renderNotificationList,
  renderLatestNotification,
  bindNotificationShell,
  bindNotificationClicks
} from "/core/features/notifications/notification-render.js";

import {
  startNotificationRealtime,
  stopNotificationRealtime
} from "/core/features/notifications/notification-realtime.js";

const $ = (id) => document.getElementById(id);

const els = {
  title: $("notifications-title"),
  status: $("notifications-status"),
  list: $("notifications-list"),
  empty: $("notifications-empty"),
  latest: $("notifications-latest"),
  refreshBtn: $("notifications-refresh-btn"),
  readAllBtn: $("notifications-read-all-btn"),
  seenBtn: $("notifications-seen-btn"),
  unreadCount: $("notifications-unread-count"),
  syncStatus: $("notifications-sync-status"),
  identityStatus: $("notifications-identity-status")
};

let actionsBound = false;
let unsubscribeNotificationState = null;
let unsubscribeProfileState = null;

function currentState() {
  return getCurrentUserState?.() || {};
}

function currentUser() {
  return currentState().user || null;
}

function currentProfile() {
  return currentState().profile || null;
}

function setText(el, value) {
  if (el) el.textContent = value ?? "";
}

function paintIdentity() {
  const user = currentUser();
  const profile = currentProfile();

  setText(
    els.title,
    `${profileName(profile)} Notifications`
  );

  setText(
    els.status,
    user?.id
      ? "Notification center connected to your Rich Bizness identity."
      : "Sign in to load notifications."
  );

  setText(
    els.identityStatus,
    profile?.id ? "Profile synced" : "Waiting for profile"
  );
}

function paintNotificationState(state = getNotificationState()) {
  const unread = Number(state.unreadCount || 0);

  if (els.unreadCount) {
    els.unreadCount.textContent =
      `${unread} unread alert${unread === 1 ? "" : "s"}`;
  }

  if (els.syncStatus) {
    if (state.loading) {
      els.syncStatus.textContent = "Syncing alerts...";
    } else if (state.error) {
      els.syncStatus.textContent =
        state.error?.message || "Notification sync warning";
    } else if (state.ready) {
      els.syncStatus.textContent = "Notifications synced";
    } else {
      els.syncStatus.textContent = "Notification system starting";
    }
  }

  if (els.list) {
    renderNotificationList({
      target: els.list,
      emptyTarget: els.empty,
      notifications: state.notifications,
      emptyText: "No Rich Bizness alerts yet."
    });
  }

  if (els.latest) {
    renderLatestNotification({
      target: els.latest,
      notification: state.latest
    });
  }

  bindNotificationClicks(els.list || document);
}

async function refreshAllNotifications({ silent = false } = {}) {
  try {
    await refreshNotifications({
      limit: 50
    });

    paintNotificationState();

    if (!silent) {
      toastInfo("Alerts refreshed.", "Rich Bizness");
    }
  } catch (error) {
    console.warn("[RB NOTIFICATIONS REFRESH FAILED]", error?.message || error);
    toastError(error?.message || "Alerts refresh failed.");
  }
}

function bindNotificationActions() {
  if (actionsBound) return;
  actionsBound = true;

  els.refreshBtn?.addEventListener("click", async () => {
    els.refreshBtn.disabled = true;

    try {
      await refreshAllNotifications();
    } finally {
      els.refreshBtn.disabled = false;
    }
  });

  els.readAllBtn?.addEventListener("click", async () => {
    els.readAllBtn.disabled = true;

    try {
      await readAllNotifications();
      toastInfo("All alerts marked read.", "Rich Bizness");
    } catch (error) {
      toastError(error?.message || "Could not mark alerts read.");
    } finally {
      els.readAllBtn.disabled = false;
    }
  });

  els.seenBtn?.addEventListener("click", async () => {
    els.seenBtn.disabled = true;

    try {
      await seenNotifications();
      toastInfo("Alerts marked seen.", "Rich Bizness");
    } catch (error) {
      toastError(error?.message || "Could not mark alerts seen.");
    } finally {
      els.seenBtn.disabled = false;
    }
  });

  window.addEventListener("rb:notifications-refresh-request", async () => {
    await refreshAllNotifications({
      silent: true
    });
  });

  window.addEventListener("beforeunload", cleanupNotificationsPage);
}

function bindStateWatchers() {
  if (!unsubscribeNotificationState) {
    unsubscribeNotificationState = onNotificationState((state) => {
      paintNotificationState(state);
    });
  }

  if (!unsubscribeProfileState) {
    unsubscribeProfileState = onProfileState((profileState) => {
      if (!profileState?.ready) return;
      paintIdentity();
    });
  }
}

async function cleanupNotificationsPage() {
  try {
    unsubscribeNotificationState?.();
    unsubscribeProfileState?.();

    unsubscribeNotificationState = null;
    unsubscribeProfileState = null;

    await stopNotificationRealtime();
  } catch (error) {
    console.warn("[RB NOTIFICATIONS CLEANUP SKIPPED]", error?.message || error);
  }
}

async function bootNotificationsPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    await ensureMyProfile();
    await refreshProfileState();
    await refreshAppIdentity();

    paintIdentity();
    bindNotificationActions();
    bindStateWatchers();

    bindNotificationShell({
      listSelector: "[data-notification-list]",
      emptySelector: "[data-notification-empty]",
      latestSelector: "[data-notification-latest-card]",
      countSelector: "[data-rb-notification-count]",
      dotSelector: "[data-rb-notification-dot]"
    });

    await initNotificationState({
      limit: 50,
      realtime: false
    });

    await startNotificationRealtime({
      refreshOnStart: false
    });

    paintNotificationState();

    document.body.dataset.rbPage = "notifications";
    document.body.dataset.rbRoute = "notifications";
    document.body.dataset.rbProfileLock = "true";
    document.body.classList.add("rb-notifications-ready");

    markPageReady("notifications");

    console.log("RB NOTIFICATIONS PAGE READY");
  } catch (error) {
    console.error("[RB NOTIFICATIONS BOOT FAILED]", error);
    markPageError(error);
    toastError(error?.message || "Notifications failed to load.");

    if (els.syncStatus) {
      els.syncStatus.textContent = error?.message || "Notifications failed";
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootNotificationsPage);
} else {
  bootNotificationsPage();
}
