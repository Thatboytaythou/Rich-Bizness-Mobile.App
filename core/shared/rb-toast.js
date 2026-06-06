/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-toast.js

   GLOBAL TOAST / ALERT ENGINE
   FINAL LOCKED VERSION
========================= */

let toastRoot = null;

const ACTIVE_TOASTS = new Set();
const MAX_TOASTS = 5;

/* =========================
   ESCAPE
========================= */

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   ROOT
========================= */

function ensureToastRoot() {
  if (toastRoot?.isConnected) return toastRoot;

  toastRoot = document.getElementById("rb-toast-root");

  if (toastRoot) return toastRoot;

  toastRoot = document.createElement("div");
  toastRoot.id = "rb-toast-root";
  toastRoot.className = "rb-toast-root";

  toastRoot.setAttribute("aria-live", "polite");
  toastRoot.setAttribute("aria-atomic", "true");

  const mount = document.body || document.documentElement;
  mount.appendChild(toastRoot);

  return toastRoot;
}

/* =========================
   REMOVE EXCESS
========================= */

function trimToasts() {
  const active = Array.from(ACTIVE_TOASTS);

  if (active.length <= MAX_TOASTS) return;

  const overflow = active.length - MAX_TOASTS;

  for (let i = 0; i < overflow; i += 1) {
    active[i]?.close?.();
  }
}

/* =========================
   MAIN TOAST
========================= */

export function toast({
  title = "Rich Bizness",
  message = "",
  type = "info",
  duration = 3200
} = {}) {
  const root = ensureToastRoot();
  const item = document.createElement("div");

  const cleanType = String(type || "info").replace(/[^a-z0-9_-]/gi, "");

  item.className = `rb-toast rb-toast-${cleanType}`;
  item.setAttribute("data-toast-type", cleanType);
  item.setAttribute("role", cleanType === "error" ? "alert" : "status");

  item.innerHTML = `
    <div class="rb-toast-orb" aria-hidden="true"></div>

    <div class="rb-toast-copy">
      <strong>${escapeHtml(title)}</strong>

      ${
        message
          ? `<span>${escapeHtml(message)}</span>`
          : ""
      }
    </div>

    <button
      class="rb-toast-close"
      type="button"
      aria-label="Close"
    >
      ×
    </button>
  `;

  root.appendChild(item);

  requestAnimationFrame(() => {
    item.classList.add("is-visible");
  });

  let closed = false;
  let timer = null;

  const api = {
    element: item,
    close: () => {}
  };

  const close = () => {
    if (closed) return;

    closed = true;

    if (timer) {
      window.clearTimeout(timer);
      timer = null;
    }

    ACTIVE_TOASTS.delete(api);

    item.classList.remove("is-visible");
    item.classList.add("is-leaving");

    window.setTimeout(() => {
      item.remove();
    }, 260);
  };

  api.close = close;

  item
    .querySelector(".rb-toast-close")
    ?.addEventListener("click", close);

  if (duration > 0) {
    timer = window.setTimeout(close, duration);
  }

  ACTIVE_TOASTS.add(api);
  trimToasts();

  return close;
}

/* =========================
   TYPES
========================= */

export function toastSuccess(message, title = "Success") {
  return toast({
    title,
    message,
    type: "success",
    duration: 3200
  });
}

export function toastError(message, title = "Error") {
  return toast({
    title,
    message,
    type: "error",
    duration: 5200
  });
}

export function toastInfo(message, title = "Rich Bizness") {
  return toast({
    title,
    message,
    type: "info",
    duration: 3200
  });
}

export function toastWarn(message, title = "Heads up") {
  return toast({
    title,
    message,
    type: "warning",
    duration: 4200
  });
}

export function toastLoading(message = "Loading...", title = "Rich Bizness") {
  return toast({
    title,
    message,
    type: "loading",
    duration: 0
  });
}

/* =========================
   CLEAR ALL
========================= */

export function clearToasts() {
  Array.from(ACTIVE_TOASTS).forEach((toastRef) => {
    toastRef.close();
  });

  ACTIVE_TOASTS.clear();
}

window.RBToast = toast;
window.RBToastSuccess = toastSuccess;
window.RBToastError = toastError;
window.RBToastInfo = toastInfo;
window.RBToastWarn = toastWarn;
window.RBClearToasts = clearToasts;

console.log("RB TOAST ENGINE READY");
