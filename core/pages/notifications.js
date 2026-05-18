/* =========================
   RICH BIZNESS MOBILE
   /core/pages/notifications.js

   NOTIFICATIONS PAGE CONTROLLER
   Locked To Current Auth/Profile Chain
========================= */

import {
  autoGuardCurrentPage
} from "/core/features/auth/session-guard.js";

import {
  initAuthState,
  onAuthState
} from "/core/features/auth/auth-state.js";

import {
  profileName
} from "/core/shared/rb-profile.js";

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser
} from "/core/shared/rb-supabase.js";

import {
  toastInfo,
  toastError
} from "/core/shared/rb-toast.js";

const $ = (id) => document.getElementById(id);

const els = {
  title: $("notifications-title"),
  status: $("notifications-status"),
  list: $("notifications-list"),
  refreshBtn: $("notifications-refresh-btn"),
  unreadCount: $("notifications-unread-count"),
  syncStatus: $("notifications-sync-status"),
  identityStatus: $("notifications-identity-status")
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function notificationTitle(item) {
  return (
    item?.title ||
    item?.type ||
    "Rich Bizness Alert"
  );
}

function notificationBody(item) {
  return (
    item?.body ||
    item?.message ||
    "New activity in your Rich Bizness universe."
  );
}

function renderEmpty() {
  if (!els.list) return;

  els.list.innerHTML = `
    <article class="rb-notification-card">
      <strong>No alerts yet</strong>
      <span>Your notification center is ready.</span>
    </article>
  `;
}

function renderNotifications(items = []) {
  if (!els.list) return;

  if (!items.length) {
    renderEmpty();
    return;
  }

  els.list.innerHTML = items
    .map((item) => {
      const title = escapeHtml(notificationTitle(item));
      const body = escapeHtml(notificationBody(item));
      const priority = escapeHtml(item?.priority || "normal");

      return `
        <article class="rb-notification-card">
          <strong>${title}</strong>
          <span>${body}</span>
          <small>${priority}</small>
        </article>
      `;
    })
    .join("");
}

function paintNotifications(state) {
  const user = state?.user || null;
  const profile = state?.profile || null;

  if (els.title) {
    els.title.textContent =
      `${profileName(profile)} Notifications`;
  }

  if (els.status) {
    els.status.textContent = user?.id
      ? "Notification center connected to your Rich Bizness identity."
      : "Sign in to load notifications.";
  }

  if (els.identityStatus) {
    els.identityStatus.textContent = profile?.id
      ? "Profile synced"
      : "Waiting for profile";
  }
}

async function loadNotifications() {
  const user = getUser();

  if (!user?.id) {
    renderEmpty();
    return;
  }

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from(RB_TABLES.richNotifications || RB_TABLES.notifications)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) throw error;

    const items = data || [];

    renderNotifications(items);

    const unread = items.filter((item) => !item.is_read).length;

    if (els.unreadCount) {
      els.unreadCount.textContent =
        `${unread} unread alerts`;
    }

    if (els.syncStatus) {
      els.syncStatus.textContent = "Notifications synced";
    }
  } catch (error) {
    console.warn("[RB NOTIFICATIONS WARNING]", error.message);

    renderEmpty();

    if (els.syncStatus) {
      els.syncStatus.textContent = "Notification table waiting";
    }
  }
}

function bindNotificationActions() {
  els.refreshBtn?.addEventListener("click", async () => {
    await loadNotifications();

    toastInfo(
      "Alerts refreshed.",
      "Rich Bizness"
    );
  });
}

async function bootNotificationsPage() {
  try {
    await autoGuardCurrentPage();

    const state = await initAuthState();

    paintNotifications(state);

    await loadNotifications();

    onAuthState(async (nextState) => {
      paintNotifications(nextState);
      await loadNotifications();
    });

    bindNotificationActions();

    document.body.classList.add("rb-notifications-ready");

    console.log("RB NOTIFICATIONS READY");
  } catch (error) {
    console.error(error);

    toastError(
      error?.message ||
        "Notifications failed to load."
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    bootNotificationsPage
  );
} else {
  bootNotificationsPage();
}
