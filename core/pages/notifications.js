/* =========================
   RICH BIZNESS MOBILE
   /core/pages/notifications.js

   NOTIFICATIONS PAGE CONTROLLER
   Direct Supabase Notifications
   Profile Lock + Realtime Alerts

   Flow:
   - Notifications reads current user/profile directly
   - No feature engine dependency
   - Realtime watches rich_notifications + notification_reads + profiles
   - Mark read / mark seen updates Supabase directly
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

import {
  RB_TABLES,
  RB_ROUTES,
  RB_PROFILE_KEYS
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  getUser,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  profileName,
  bindProfileShell
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
  empty: $("notifications-empty"),
  latest: $("notifications-latest"),
  refreshBtn: $("notifications-refresh-btn"),
  readAllBtn: $("notifications-read-all-btn"),
  seenBtn: $("notifications-seen-btn"),
  unreadCount: $("notifications-unread-count"),
  syncStatus: $("notifications-sync-status"),
  identityStatus: $("notifications-identity-status")
};

let supabase = null;
let channel = null;
let actionsBound = false;
let currentUser = null;
let currentProfile = null;

const notificationState = {
  loading: false,
  ready: false,
  error: null,
  notifications: [],
  latest: null,
  unreadCount: 0
};

function table(key, fallback) {
  return RB_TABLES?.[key] || fallback || key;
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value = "") {
  const url = String(value || "").trim();

  if (!url) return "";

  if (
    url.startsWith("/") ||
    url.startsWith("https://") ||
    url.startsWith("http://")
  ) {
    return url;
  }

  return "";
}

function formatDate(value) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}

function setText(el, value) {
  if (el) el.textContent = value ?? "";
}

function syncState() {
  const appState = getCurrentUserState?.() || {};

  currentUser = appState.user || getUser?.() || null;
  currentProfile = appState.profile || currentProfile || null;
}

async function fetchMyProfile() {
  const user = getUser?.() || currentUser;

  if (!user?.id) {
    currentUser = null;
    currentProfile = null;
    return null;
  }

  const { data, error } = await supabase
    .from(table("profiles", "profiles"))
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  currentUser = user;
  currentProfile = data || null;

  return currentProfile;
}

function paintIdentity() {
  const user = currentUser || getUser?.();
  const profile = currentProfile || {};

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
    profile?.id
      ? `Profile locked through ${RB_PROFILE_KEYS?.identitySource || "profiles"}`
      : "Waiting for profile lock"
  );

  bindProfileShell?.();
}

function paintNotificationState() {
  const unread = Number(notificationState.unreadCount || 0);

  setText(
    els.unreadCount,
    `${unread} unread alert${unread === 1 ? "" : "s"}`
  );

  if (els.syncStatus) {
    if (notificationState.loading) {
      els.syncStatus.textContent = "Syncing alerts...";
    } else if (notificationState.error) {
      els.syncStatus.textContent =
        notificationState.error?.message || "Notification sync warning";
    } else if (notificationState.ready) {
      els.syncStatus.textContent = "Notifications synced";
    } else {
      els.syncStatus.textContent = "Notification system starting";
    }
  }

  renderNotificationList();
  renderLatestNotification();
}

function notificationTitle(notification = {}) {
  return (
    notification.title ||
    notification.type ||
    "Rich Bizness Alert"
  );
}

function notificationBody(notification = {}) {
  return (
    notification.body ||
    notification.message ||
    notification.action_label ||
    "New Rich Bizness activity."
  );
}

function renderNotificationList() {
  if (!els.list) return;

  const notifications = notificationState.notifications || [];

  if (!notifications.length) {
    els.list.innerHTML = "";

    if (els.empty) {
      els.empty.style.display = "block";
      els.empty.textContent = "No Rich Bizness alerts yet.";
    }

    return;
  }

  if (els.empty) {
    els.empty.style.display = "none";
  }

  els.list.innerHTML = notifications
    .map((item) => {
      const title = notificationTitle(item);
      const body = notificationBody(item);
      const emoji = item.emoji || "💨";
      const priority = item.priority || "normal";
      const created = formatDate(item.created_at);
      const targetUrl = safeUrl(item.action_url || item.target_url || "");

      return `
        <article
          class="rb-notification-card ${item.is_read ? "" : "is-unread"}"
          data-notification-id="${escapeHtml(item.id)}"
          data-target-url="${escapeHtml(targetUrl)}"
        >
          <div class="rb-notification-icon">${escapeHtml(emoji)}</div>

          <div class="rb-notification-body">
            <p class="rb-kicker">${escapeHtml(priority)}</p>
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(body)}</span>
            ${created ? `<small>${escapeHtml(created)}</small>` : ""}
          </div>

          ${
            item.is_read
              ? `<button class="rb-btn ghost" type="button" data-open-notification="${escapeHtml(item.id)}">OPEN</button>`
              : `<button class="rb-btn gold" type="button" data-read-notification="${escapeHtml(item.id)}">READ</button>`
          }
        </article>
      `;
    })
    .join("");
}

function renderLatestNotification() {
  if (!els.latest) return;

  const latest = notificationState.latest;

  if (!latest) {
    els.latest.innerHTML = `
      <article class="rb-notification-card">
        <div class="rb-notification-icon">💨</div>
        <div class="rb-notification-body">
          <p class="rb-kicker">LATEST</p>
          <strong>No alerts yet</strong>
          <span>Your newest Rich Bizness alert will show here.</span>
        </div>
      </article>
    `;
    return;
  }

  els.latest.innerHTML = `
    <article class="rb-notification-card ${latest.is_read ? "" : "is-unread"}">
      <div class="rb-notification-icon">${escapeHtml(latest.emoji || "💨")}</div>
      <div class="rb-notification-body">
        <p class="rb-kicker">LATEST</p>
        <strong>${escapeHtml(notificationTitle(latest))}</strong>
        <span>${escapeHtml(notificationBody(latest))}</span>
      </div>
    </article>
  `;
}

/* =========================
   DATA
========================= */

async function refreshNotifications({ silent = false } = {}) {
  const user = currentUser || getUser?.();

  if (!user?.id) {
    notificationState.notifications = [];
    notificationState.latest = null;
    notificationState.unreadCount = 0;
    notificationState.ready = false;
    notificationState.loading = false;
    notificationState.error = null;

    paintNotificationState();
    return;
  }

  notificationState.loading = true;
  notificationState.error = null;
  paintNotificationState();

  try {
    const { data, error } = await supabase
      .from(table("richNotifications", "rich_notifications"))
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const rows = data || [];

    notificationState.notifications = rows;
    notificationState.latest = rows[0] || null;
    notificationState.unreadCount = rows.filter((item) => !item.is_read).length;
    notificationState.ready = true;
    notificationState.loading = false;
    notificationState.error = null;

    paintNotificationState();

    if (!silent) {
      toastInfo("Alerts refreshed.", "Rich Bizness");
    }
  } catch (error) {
    notificationState.loading = false;
    notificationState.error = error;
    paintNotificationState();

    throw error;
  }
}

async function markNotificationRead(notificationId) {
  const user = currentUser || getUser?.();

  if (!user?.id || !notificationId) return;

  const { error } = await supabase
    .from(table("richNotifications", "rich_notifications"))
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) throw error;

  await supabase
    .from(table("notificationReads", "notification_reads"))
    .upsert(
      {
        notification_id: notificationId,
        user_id: user.id,
        read_at: new Date().toISOString()
      },
      {
        onConflict: "notification_id,user_id"
      }
    );

  await refreshNotifications({ silent: true });
}

async function markAllRead() {
  const user = currentUser || getUser?.();

  if (!user?.id) return;

  const now = new Date().toISOString();

  const unreadIds = notificationState.notifications
    .filter((item) => !item.is_read)
    .map((item) => item.id);

  const { error } = await supabase
    .from(table("richNotifications", "rich_notifications"))
    .update({
      is_read: true,
      read_at: now,
      updated_at: now
    })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) throw error;

  if (unreadIds.length) {
    await supabase
      .from(table("notificationReads", "notification_reads"))
      .upsert(
        unreadIds.map((id) => ({
          notification_id: id,
          user_id: user.id,
          read_at: now
        })),
        {
          onConflict: "notification_id,user_id"
        }
      );
  }

  await refreshNotifications({ silent: true });
}

async function markAllSeen() {
  const user = currentUser || getUser?.();

  if (!user?.id) return;

  const now = new Date().toISOString();

  const { error } = await supabase
    .from(table("richNotifications", "rich_notifications"))
    .update({
      is_seen: true,
      seen_at: now,
      updated_at: now
    })
    .eq("user_id", user.id)
    .eq("is_seen", false);

  if (error) throw error;

  await refreshNotifications({ silent: true });
}

function openNotification(notificationId) {
  const item = notificationState.notifications.find(
    (notification) => String(notification.id) === String(notificationId)
  );

  if (!item) return;

  const targetUrl = safeUrl(item.action_url || item.target_url || "");

  if (targetUrl) {
    window.location.href = targetUrl;
    return;
  }

  toastInfo(notificationBody(item), notificationTitle(item));
}

/* =========================
   REALTIME
========================= */

function clearRealtime() {
  if (!channel || !supabase) return;

  supabase.removeChannel(channel);
  channel = null;
}

function bindRealtime() {
  const user = currentUser || getUser?.();

  if (!user?.id || !supabase) return;

  clearRealtime();

  channel = supabase
    .channel(`rb-notifications-${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("richNotifications", "rich_notifications"),
        filter: `user_id=eq.${user.id}`
      },
      async () => {
        await refreshNotifications({ silent: true });
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("notificationReads", "notification_reads"),
        filter: `user_id=eq.${user.id}`
      },
      async () => {
        await refreshNotifications({ silent: true });
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("profiles", "profiles"),
        filter: `id=eq.${user.id}`
      },
      async () => {
        await refreshAppIdentity();
        syncState();
        await fetchMyProfile();
        paintIdentity();
      }
    )
    .subscribe();
}

/* =========================
   ACTIONS
========================= */

function bindNotificationActions() {
  if (actionsBound) return;
  actionsBound = true;

  els.refreshBtn?.addEventListener("click", async () => {
    els.refreshBtn.disabled = true;

    try {
      await refreshNotifications();
    } catch (error) {
      console.warn("[RB NOTIFICATIONS REFRESH FAILED]", error?.message || error);
      toastError(error?.message || "Alerts refresh failed.");
    } finally {
      els.refreshBtn.disabled = false;
    }
  });

  els.readAllBtn?.addEventListener("click", async () => {
    els.readAllBtn.disabled = true;

    try {
      await markAllRead();
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
      await markAllSeen();
      toastInfo("Alerts marked seen.", "Rich Bizness");
    } catch (error) {
      toastError(error?.message || "Could not mark alerts seen.");
    } finally {
      els.seenBtn.disabled = false;
    }
  });

  document.addEventListener("click", async (event) => {
    const readBtn = event.target.closest("[data-read-notification]");
    const openBtn = event.target.closest("[data-open-notification]");
    const card = event.target.closest("[data-notification-id]");

    try {
      if (readBtn) {
        await markNotificationRead(readBtn.dataset.readNotification);
        return;
      }

      if (openBtn) {
        openNotification(openBtn.dataset.openNotification);
        return;
      }

      if (card && card.dataset.notificationId) {
        await markNotificationRead(card.dataset.notificationId);
        openNotification(card.dataset.notificationId);
      }
    } catch (error) {
      toastError(error?.message || "Notification action failed.");
    }
  });

  window.addEventListener("rb:notifications-refresh-request", async () => {
    await refreshNotifications({
      silent: true
    });
  });

  window.addEventListener("beforeunload", clearRealtime);
}

/* =========================
   BOOT
========================= */

async function bootNotificationsPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false,
      ensureProfile: true
    });

    supabase = getSupabase();

    await ensureMyProfile();
    await refreshAppIdentity();

    syncState();
    await fetchMyProfile();

    paintIdentity();
    bindNotificationActions();

    await refreshNotifications({ silent: true });
    bindRealtime();

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
