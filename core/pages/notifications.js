/* =========================
   RICH BIZNESS MOBILE
   /core/pages/notifications.js
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import { getSupabase } from "/core/shared/rb-supabase.js";

import { profileName } from "/core/shared/rb-profile.js";

import { RB_TABLES } from "/core/shared/rb-config.js";

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

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

  els.list.innerHTML = items.map((item) => `
    <article class="rb-notification-card ${item.is_read ? "" : "is-unread"}">
      <strong>${escapeHtml(notificationTitle(item))}</strong>
      <span>${escapeHtml(notificationBody(item))}</span>
      <small>${escapeHtml(item.priority || item.type || "normal")}</small>
    </article>
  `).join("");
}

function paintNotifications() {
  const state = getCurrentUserState();
  const user = state?.user || null;
  const profile = state?.profile || null;

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
  const state = getCurrentUserState();
  const user = state?.user || null;

  if (!user?.id) {
    renderEmpty();
    return;
  }

  try {
    const { data, error } = await supabase
      .from(RB_TABLES.richNotifications || RB_TABLES.notifications)
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
    console.warn("[notifications.js]", error.message);

    renderEmpty();

    if (els.syncStatus) {
      els.syncStatus.textContent = "Notification table waiting";
    }
  }
}

function bindRealtime() {
  const state = getCurrentUserState();
  const user = state?.user || null;

  if (!user?.id) return;

  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }

  channel = supabase
    .channel(`rb-notifications-${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.richNotifications || RB_TABLES.notifications,
        filter: `user_id=eq.${user.id}`
      },
      loadNotifications
    )
    .subscribe();
}

function bindNotificationActions() {
  els.refreshBtn?.addEventListener("click", async () => {
    await loadNotifications();
    toastInfo("Alerts refreshed.", "Rich Bizness");
  });

  window.addEventListener("beforeunload", () => {
    if (channel) supabase.removeChannel(channel);
  });
}

async function bootNotificationsPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    paintNotifications();
    bindNotificationActions();

    await loadNotifications();
    bindRealtime();

    document.body.classList.add("rb-notifications-ready");
    markPageReady("notifications");

    console.log("RB NOTIFICATIONS READY");
  } catch (error) {
    console.error("[notifications.js]", error);
    markPageError(error);
    toastError(error?.message || "Notifications failed to load.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootNotificationsPage);
} else {
  bootNotificationsPage();
}
