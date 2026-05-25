/* =========================
   RICH BIZNESS MOBILE
   /core/pages/notifications.js

   NOTIFICATIONS PAGE CONTROLLER
   Synced with auth + profile-state
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

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

let supabase = null;
let channel = null;
let actionsBound = false;

function notificationsTable() {
  return RB_TABLES.richNotifications || RB_TABLES.notifications;
}

function currentState() {
  return getCurrentUserState() || {};
}

function currentUser() {
  return currentState().user || null;
}

function currentProfile() {
  return currentState().profile || null;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function notificationTitle(item) {
  return item?.title || item?.type || "Rich Bizness Alert";
}

function notificationBody(item) {
  return item?.body || item?.message || "New activity in your Rich Bizness universe.";
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
      return `
        <article class="rb-notification-card ${item.is_read ? "" : "is-unread"}">
          <strong>${escapeHtml(notificationTitle(item))}</strong>
          <span>${escapeHtml(notificationBody(item))}</span>
          <small>${escapeHtml(item.priority || item.type || "normal")}</small>
        </article>
      `;
    })
    .join("");
}

function paintNotifications() {
  const user = currentUser();
  const profile = currentProfile();

  if (els.title) {
    els.title.textContent = `${profileName(profile)} Notifications`;
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
  const user = currentUser();

  if (!user?.id) {
    renderEmpty();

    if (els.unreadCount) {
      els.unreadCount.textContent = "0 unread alerts";
    }

    if (els.syncStatus) {
      els.syncStatus.textContent = "Sign in required";
    }

    return;
  }

  try {
    const { data, error } = await supabase
      .from(notificationsTable())
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw error;

    const items = data || [];
    const unread = items.filter((item) => !item.is_read).length;

    renderNotifications(items);

    if (els.unreadCount) {
      els.unreadCount.textContent = `${unread} unread alerts`;
    }

    if (els.syncStatus) {
      els.syncStatus.textContent = "Notifications synced";
    }
  } catch (error) {
    console.warn("[RB NOTIFICATIONS LOAD WARNING]", error.message);

    renderEmpty();

    if (els.unreadCount) {
      els.unreadCount.textContent = "0 unread alerts";
    }

    if (els.syncStatus) {
      els.syncStatus.textContent = "Notification table waiting";
    }
  }
}

function clearRealtime() {
  if (channel) {
    supabase?.removeChannel(channel);
    channel = null;
  }
}

function bindRealtime() {
  const user = currentUser();

  if (!user?.id || !supabase) return;

  clearRealtime();

  channel = supabase
    .channel(`rb-notifications-${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: notificationsTable(),
        filter: `user_id=eq.${user.id}`
      },
      loadNotifications
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.profiles,
        filter: `id=eq.${user.id}`
      },
      async () => {
        await refreshProfileState();
        await refreshAppIdentity();
        paintNotifications();
      }
    )
    .subscribe();
}

function bindNotificationActions() {
  if (actionsBound) return;
  actionsBound = true;

  els.refreshBtn?.addEventListener("click", async () => {
    await loadNotifications();
    toastInfo("Alerts refreshed.", "Rich Bizness");
  });

  window.addEventListener("beforeunload", clearRealtime);
}

async function bootNotificationsPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    await ensureMyProfile();
    await refreshProfileState();
    await refreshAppIdentity();

    paintNotifications();
    bindNotificationActions();

    onProfileState((profileState) => {
      if (!profileState.ready) return;
      paintNotifications();
    });

    await loadNotifications();
    bindRealtime();

    document.body.classList.add("rb-notifications-ready");

    markPageReady("notifications");

    console.log("RB NOTIFICATIONS READY");
  } catch (error) {
    console.error("[RB NOTIFICATIONS BOOT FAILED]", error);
    markPageError(error);
    toastError(error?.message || "Notifications failed to load.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootNotificationsPage);
} else {
  bootNotificationsPage();
}
