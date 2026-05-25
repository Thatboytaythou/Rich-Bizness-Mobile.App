import RB_CONFIG from "/core/shared/rb-config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =========================
   RICH BIZNESS MOBILE
   REALTIME NOTIFICATION ENGINE
========================= */

const supabase = createClient(
  RB_CONFIG.supabase.url,
  RB_CONFIG.supabase.publishableKey
);

const queue = [];

function ensureNotificationRoot() {
  let root = document.getElementById("rb-notify-root");

  if (root) return root;

  root = document.createElement("div");
  root.id = "rb-notify-root";

  document.body.appendChild(root);

  return root;
}

function createToast(payload) {
  const root = ensureNotificationRoot();

  const toast = document.createElement("div");
  toast.className = "rb-notify-toast";

  toast.innerHTML = `
    <div class="rb-notify-glow"></div>

    <div class="rb-notify-icon">
      ${payload.icon || "⚡"}
    </div>

    <div class="rb-notify-copy">
      <strong>${payload.title}</strong>
      <span>${payload.message}</span>
    </div>
  `;

  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  setTimeout(() => {
    toast.classList.remove("is-visible");

    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 4200);
}

function pushNotification(payload) {
  queue.push(payload);

  if (queue.length > 12) {
    queue.shift();
  }

  createToast(payload);
}

function bindRealtimeNotifications() {
  supabase
    .channel("rb-global-notifications")

    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "live_streams",
      },
      (payload) => {
        pushNotification({
          icon: "🔴",
          title: "LIVE NOW",
          message:
            payload.new?.title ||
            "A creator just started streaming",
        });
      }
    )

    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "uploads",
      },
      () => {
        pushNotification({
          icon: "⬆️",
          title: "NEW UPLOAD",
          message: "Fresh content was uploaded",
        });
      }
    )

    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "dm_messages",
      },
      () => {
        pushNotification({
          icon: "💬",
          title: "NEW MESSAGE",
          message: "You received a new message",
        });
      }
    )

    .subscribe();
}

bindRealtimeNotifications();

window.RBNotify = pushNotification;
