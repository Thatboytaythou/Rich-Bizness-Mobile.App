/* =========================
   RICH BIZNESS MOBILE
   /core/pages/realtime-notifications.js

   REALTIME NOTIFICATION ENGINE
   Uses locked rb-supabase.js client
   No duplicate Supabase client

   Updates:
   - Safe table fallbacks
   - No duplicate channels on reboot
   - No project-avatar fallback
   - Realtime cleanup locked
   - Notification badge sync protected
========================= */

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  bootAuth,
  getUser,
  createRealtimeChannel,
  removeRealtimeChannel
} from "/core/shared/rb-supabase.js";

import {
  notificationIcon,
  renderNotificationText,
  countUnreadNotifications
} from "/core/shared/rb-notifications.js";

const supabase = getSupabase();

const queue = [];
const channels = [];

let booted = false;

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

function safeUrl(value = "", fallback = "") {
  const url = String(value || "").trim();

  if (!url || url.includes("project-avatar")) return fallback;

  if (
    url.startsWith("/") ||
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("blob:")
  ) {
    return url;
  }

  return fallback;
}

function notifyTable() {
  return table("richNotifications", table("notifications", "rich_notifications"));
}

function ensureNotificationRoot() {
  let root = document.getElementById("rb-notify-root");

  if (root) return root;

  root = document.createElement("div");
  root.id = "rb-notify-root";
  root.setAttribute("aria-live", "polite");
  root.setAttribute("aria-label", "Rich Bizness notifications");

  document.body.appendChild(root);

  return root;
}

function createToast(payload = {}) {
  const root = ensureNotificationRoot();

  const toast = document.createElement("button");
  toast.className = "rb-notify-toast";
  toast.type = "button";

  const icon = payload.icon || "⚡";
  const title = payload.title || "Rich Bizness Alert";
  const message = payload.message || payload.body || "";
  const url = safeUrl(payload.url || "", "");

  toast.innerHTML = `
    <div class="rb-notify-glow"></div>

    <div class="rb-notify-icon">
      ${escapeHtml(icon)}
    </div>

    <div class="rb-notify-copy">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;

  if (url) {
    toast.addEventListener("click", () => {
      window.location.href = url;
    });
  }

  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  window.setTimeout(() => {
    toast.classList.remove("is-visible");

    window.setTimeout(() => {
      toast.remove();
    }, 400);
  }, 4200);
}

function pushNotification(payload = {}) {
  queue.push(payload);

  if (queue.length > 12) {
    queue.shift();
  }

  createToast(payload);

  window.dispatchEvent(
    new CustomEvent("rb:toast-notification", {
      detail: payload
    })
  );
}

async function updateUnreadBadge() {
  try {
    const count = await countUnreadNotifications();

    document.querySelectorAll("[data-rb-notification-count]").forEach((el) => {
      el.textContent = count > 99 ? "99+" : String(count);
      el.hidden = count <= 0;
    });

    document.body.dataset.rbUnreadNotifications = String(count);

    window.dispatchEvent(
      new CustomEvent("rb:notification-count-update", {
        detail: {
          unread: count
        }
      })
    );
  } catch (error) {
    console.warn("[RB NOTIFICATION COUNT WARNING]", error?.message || error);
  }
}

function bindRichNotifications() {
  const user = getUser();
  if (!user?.id) return;

  const channel = createRealtimeChannel(`rb-user-notifications-${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: notifyTable(),
        filter: `user_id=eq.${user.id}`
      },
      async (payload) => {
        const notification = payload.new || {};
        const rendered = renderNotificationText(notification);

        pushNotification({
          id: notification.id,
          icon: rendered.icon,
          title: rendered.title,
          message: rendered.body,
          url: rendered.url,
          raw: notification
        });

        await updateUnreadBadge();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: notifyTable(),
        filter: `user_id=eq.${user.id}`
      },
      updateUnreadBadge
    )
    .subscribe();

  channels.push(channel);
}

function bindGlobalActivityNotifications() {
  const liveStreamsTable = table("liveStreams", "live_streams");
  const uploadsTable = table("uploads", "uploads");

  if (liveStreamsTable) {
    const liveChannel = createRealtimeChannel("rb-global-live-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: liveStreamsTable
        },
        (payload) => {
          pushNotification({
            icon: "🔴",
            title: "LIVE NOW",
            message:
              payload.new?.title ||
              "A creator just started streaming",
            url: "/watch"
          });
        }
      )
      .subscribe();

    channels.push(liveChannel);
  }

  if (uploadsTable) {
    const uploadChannel = createRealtimeChannel("rb-global-upload-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: uploadsTable
        },
        (payload) => {
          const section = payload.new?.section || "feed";

          pushNotification({
            icon: "⬆️",
            title: "NEW UPLOAD",
            message: "Fresh content was uploaded",
            url:
              section === "music"
                ? "/music"
                : section === "gallery"
                  ? "/gallery"
                  : section === "sports"
                    ? "/sports"
                    : section === "gaming"
                      ? "/gaming"
                      : "/feed"
          });
        }
      )
      .subscribe();

    channels.push(uploadChannel);
  }
}

function bindDirectMessageNotifications() {
  const user = getUser();
  const dmMessagesTable = table("dmMessages", "dm_messages");

  if (!user?.id || !dmMessagesTable) return;

  const dmChannel = createRealtimeChannel(`rb-dm-notifications-${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: dmMessagesTable
      },
      (payload) => {
        const message = payload.new || {};

        if (message.sender_id === user.id) return;

        pushNotification({
          icon: notificationIcon("dm_message"),
          title: "NEW MESSAGE",
          message: "You received a new Rich DM.",
          url: "/messages"
        });
      }
    )
    .subscribe();

  channels.push(dmChannel);
}

export async function bootRealtimeNotifications() {
  if (booted) return;

  booted = true;

  try {
    await bootAuth();

    await destroyRealtimeNotifications();

    booted = true;

    bindRichNotifications();
    bindDirectMessageNotifications();
    bindGlobalActivityNotifications();

    await updateUnreadBadge();

    document.body.classList.add("rb-realtime-notifications-ready");

    console.log("RB REALTIME NOTIFICATIONS READY");
  } catch (error) {
    booted = false;
    console.warn("[RB REALTIME NOTIFICATIONS FAILED]", error?.message || error);
  }
}

export async function destroyRealtimeNotifications() {
  await Promise.allSettled(
    channels.map((channel) => removeRealtimeChannel(channel))
  );

  channels.length = 0;
  booted = false;
}

window.RBNotify = pushNotification;
window.RBUpdateNotificationBadge = updateUnreadBadge;
window.RBBootRealtimeNotifications = bootRealtimeNotifications;
window.RBDestroyRealtimeNotifications = destroyRealtimeNotifications;

window.addEventListener("beforeunload", destroyRealtimeNotifications);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootRealtimeNotifications);
} else {
  bootRealtimeNotifications();
}
