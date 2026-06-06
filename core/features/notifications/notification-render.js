/* =========================
   RICH BIZNESS MOBILE
   /core/features/notifications/notification-render.js

   NOTIFICATION RENDER ENGINE
   Cards + badges + clicks + realtime UI
========================= */

import {
  renderNotificationText
} from "/core/shared/rb-notifications.js";

import {
  getNotificationState,
  onNotificationState,
  readNotification,
  readAllNotifications,
  seenNotifications,
  bindNotificationBadges,
  renderNotificationItem
} from "/core/features/notifications/notification-state.js";

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timeAgo(value) {
  if (!value) return "";

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";

  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric"
  });
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

function notificationClass(notification = {}) {
  const parts = ["rb-notification-card"];

  if (!notification.is_read) parts.push("is-unread");
  if (!notification.is_seen) parts.push("is-unseen");
  if (notification.priority) parts.push(`is-${String(notification.priority).toLowerCase()}`);
  if (notification.type) parts.push(`type-${String(notification.type).toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`);

  return parts.join(" ");
}

export function notificationCardHtml(notification = {}) {
  const item = renderNotificationItem(notification);
  const url = targetUrl(notification);

  return `
    <article
      class="${notificationClass(notification)}"
      data-notification-id="${escapeHtml(item.id)}"
      data-notification-url="${escapeHtml(url)}"
      data-read="${item.is_read ? "true" : "false"}"
      role="button"
      tabindex="0"
    >
      <div class="rb-notification-icon">
        ${escapeHtml(item.icon || "💨")}
      </div>

      <div class="rb-notification-copy">
        <div class="rb-notification-line">
          <h3>${escapeHtml(item.title || "Rich Bizness Alert")}</h3>
          <time>${escapeHtml(timeAgo(item.created_at))}</time>
        </div>

        ${
          item.body
            ? `<p>${escapeHtml(item.body)}</p>`
            : ""
        }

        <div class="rb-notification-meta">
          <span>${escapeHtml(notification.type || "alert")}</span>
          ${
            notification.priority
              ? `<span>${escapeHtml(notification.priority)}</span>`
              : ""
          }
        </div>
      </div>

      <button
        class="rb-notification-read"
        type="button"
        data-notification-read="${escapeHtml(item.id)}"
        aria-label="Mark notification as read"
      >
        ${item.is_read ? "✓" : "●"}
      </button>
    </article>
  `;
}

export function renderNotificationList({
  target,
  emptyTarget = null,
  notifications = null,
  emptyText = "No Rich Bizness alerts yet."
} = {}) {
  const el = typeof target === "string"
    ? document.querySelector(target)
    : target;

  if (!el) return;

  const emptyEl = typeof emptyTarget === "string"
    ? document.querySelector(emptyTarget)
    : emptyTarget;

  const state = getNotificationState();
  const rows = Array.isArray(notifications)
    ? notifications
    : state.notifications;

  if (!rows.length) {
    el.innerHTML = "";

    if (emptyEl) {
      emptyEl.style.display = "block";
      emptyEl.textContent = emptyText;
    } else {
      el.innerHTML = `<p class="rb-empty">${escapeHtml(emptyText)}</p>`;
    }

    return;
  }

  if (emptyEl) emptyEl.style.display = "none";

  el.innerHTML = rows
    .map(notificationCardHtml)
    .join("");

  bindNotificationClicks(el);
}

export function renderLatestNotification({
  target,
  notification = null
} = {}) {
  const el = typeof target === "string"
    ? document.querySelector(target)
    : target;

  if (!el) return;

  const latest = notification || getNotificationState().latest;

  if (!latest) {
    el.innerHTML = `
      <div class="rb-notification-latest is-empty">
        <strong>No alerts</strong>
        <span>Rich Bizness notifications will show here.</span>
      </div>
    `;
    return;
  }

  const display = renderNotificationText(latest);

  el.innerHTML = `
    <div
      class="rb-notification-latest ${latest.is_read ? "" : "is-unread"}"
      data-notification-id="${escapeHtml(latest.id || "")}"
      data-notification-url="${escapeHtml(targetUrl(latest))}"
      role="button"
      tabindex="0"
    >
      <span class="rb-notification-icon">${escapeHtml(display.icon || "💨")}</span>

      <div>
        <strong>${escapeHtml(display.title || "Rich Bizness Alert")}</strong>
        <small>${escapeHtml(display.body || timeAgo(latest.created_at))}</small>
      </div>
    </div>
  `;

  bindNotificationClicks(el);
}

export function renderNotificationCount({
  target,
  count = null
} = {}) {
  const el = typeof target === "string"
    ? document.querySelector(target)
    : target;

  if (!el) return;

  const finalCount =
    count === null || count === undefined
      ? getNotificationState().unreadCount
      : Number(count || 0);

  el.textContent = String(finalCount);
  el.dataset.count = String(finalCount);
  el.classList.toggle("is-active", finalCount > 0);
}

export function bindNotificationClicks(root = document) {
  if (!root) return;

  root.querySelectorAll("[data-notification-id]").forEach((card) => {
    if (card.dataset.rbNotificationClickBound === "true") return;
    card.dataset.rbNotificationClickBound = "true";

    const open = async () => {
      const id = card.dataset.notificationId;
      const url = card.dataset.notificationUrl || RB_ROUTES.notifications || "/notifications";

      if (id) {
        try {
          await readNotification(id);
        } catch (error) {
          console.warn("[RB NOTIFICATION READ SKIPPED]", error?.message || error);
        }
      }

      if (url && url !== window.location.pathname) {
        window.location.href = url;
      }
    };

    card.addEventListener("click", (event) => {
      if (event.target.closest("[data-notification-read]")) return;
      open();
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    });
  });

  root.querySelectorAll("[data-notification-read]").forEach((button) => {
    if (button.dataset.rbNotificationReadBound === "true") return;
    button.dataset.rbNotificationReadBound = "true";

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const id = button.dataset.notificationRead;
      if (!id) return;

      button.disabled = true;

      try {
        await readNotification(id);
      } catch (error) {
        console.warn("[RB NOTIFICATION READ FAILED]", error?.message || error);
      } finally {
        button.disabled = false;
      }
    });
  });
}

export function bindNotificationActions({
  readAllSelector = "[data-notifications-read-all]",
  seenSelector = "[data-notifications-seen]",
  refreshSelector = "[data-notifications-refresh]",
  onRefresh = null
} = {}) {
  document.querySelectorAll(readAllSelector).forEach((button) => {
    if (button.dataset.rbReadAllBound === "true") return;
    button.dataset.rbReadAllBound = "true";

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await readAllNotifications();
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll(seenSelector).forEach((button) => {
    if (button.dataset.rbSeenBound === "true") return;
    button.dataset.rbSeenBound = "true";

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        await seenNotifications();
      } finally {
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll(refreshSelector).forEach((button) => {
    if (button.dataset.rbRefreshNotificationsBound === "true") return;
    button.dataset.rbRefreshNotificationsBound = "true";

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        if (typeof onRefresh === "function") {
          await onRefresh();
        }

        window.dispatchEvent(
          new CustomEvent("rb:notifications-refresh-request")
        );
      } finally {
        button.disabled = false;
      }
    });
  });
}

export function bindNotificationShell({
  listSelector = "[data-notification-list]",
  emptySelector = "[data-notification-empty]",
  latestSelector = "[data-notification-latest-card]",
  countSelector = "[data-rb-notification-count]",
  dotSelector = "[data-rb-notification-dot]"
} = {}) {
  bindNotificationBadges({
    badgeSelector: countSelector,
    dotSelector
  });

  bindNotificationActions();

  return onNotificationState((state) => {
    document.querySelectorAll(listSelector).forEach((list) => {
      renderNotificationList({
        target: list,
        emptyTarget: emptySelector
          ? document.querySelector(emptySelector)
          : null,
        notifications: state.notifications
      });
    });

    document.querySelectorAll(latestSelector).forEach((target) => {
      renderLatestNotification({
        target,
        notification: state.latest
      });
    });

    document.querySelectorAll(countSelector).forEach((target) => {
      renderNotificationCount({
        target,
        count: state.unreadCount
      });
    });
  });
}

export function notificationToastHtml(notification = {}) {
  const display = renderNotificationText(notification);

  return `
    <div class="rb-notification-toast-copy">
      <strong>${escapeHtml(display.icon || "💨")} ${escapeHtml(display.title || "Rich Bizness Alert")}</strong>
      ${
        display.body
          ? `<span>${escapeHtml(display.body)}</span>`
          : ""
      }
    </div>
  `;
}

export function showNotificationToast(notification = {}) {
  const display = renderNotificationText(notification);

  window.dispatchEvent(
    new CustomEvent("rb:toast", {
      detail: {
        type: "info",
        title: display.title || "Rich Bizness Alert",
        message: display.body || "",
        icon: display.icon || "💨",
        url: targetUrl(notification),
        notification
      }
    })
  );
}

export function bootNotificationRender(options = {}) {
  bindNotificationShell(options);

  window.addEventListener("rb:notification-new", (event) => {
    const notification = event.detail?.notification;
    if (!notification) return;

    showNotificationToast(notification);
  });

  console.log("RB NOTIFICATION RENDER READY");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => bootNotificationRender());
} else {
  bootNotificationRender();
}
