/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-ui.js

   UI ENGINE
   Toasts
   Modals
   Drawers
   Loaders
   Alerts
   Confirmations
   Status System
========================= */

import {
  RB_VISUALS
} from "/core/shared/rb-config.js";

/* =========================
   INTERNAL STATE
========================= */

let toastRoot = null;
let modalRoot = null;
let drawerRoot = null;
let loaderRoot = null;

/* =========================
   ROOTS
========================= */

function ensureRoots() {
  if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.id = "rb-toast-root";
    document.body.appendChild(toastRoot);
  }

  if (!modalRoot) {
    modalRoot = document.createElement("div");
    modalRoot.id = "rb-modal-root";
    document.body.appendChild(modalRoot);
  }

  if (!drawerRoot) {
    drawerRoot = document.createElement("div");
    drawerRoot.id = "rb-drawer-root";
    document.body.appendChild(drawerRoot);
  }

  if (!loaderRoot) {
    loaderRoot = document.createElement("div");
    loaderRoot.id = "rb-loader-root";
    document.body.appendChild(loaderRoot);
  }
}

/* =========================
   TOASTS
========================= */

export function toast(
  message = "",
  {
    icon = "💨",
    duration = 3500,
    type = "default"
  } = {}
) {
  ensureRoots();

  const toast = document.createElement("div");

  toast.className = `
    rb-toast
    rb-toast-${type}
  `;

  toast.innerHTML = `
    <span>${icon}</span>
    <span>${message}</span>
  `;

  toastRoot.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");

    setTimeout(() => {
      toast.remove();
    }, 250);
  }, duration);

  return toast;
}

export function success(message) {
  return toast(message, {
    icon: "✅",
    type: "success"
  });
}

export function error(message) {
  return toast(message, {
    icon: "❌",
    type: "error"
  });
}

export function warning(message) {
  return toast(message, {
    icon: "⚠️",
    type: "warning"
  });
}

export function info(message) {
  return toast(message, {
    icon: "ℹ️",
    type: "info"
  });
}

/* =========================
   LOADER
========================= */

export function showLoader(
  text = "Loading..."
) {
  ensureRoots();

  loaderRoot.innerHTML = `
    <div class="rb-loader-backdrop">
      <div class="rb-loader-card">
        <div class="rb-loader-spinner"></div>
        <div class="rb-loader-text">
          ${text}
        </div>
      </div>
    </div>
  `;

  loaderRoot.classList.add("active");
}

export function hideLoader() {
  if (!loaderRoot) return;

  loaderRoot.classList.remove("active");
  loaderRoot.innerHTML = "";
}

/* =========================
   MODAL
========================= */

export function openModal({
  title = "",
  content = "",
  footer = ""
} = {}) {
  ensureRoots();

  modalRoot.innerHTML = `
    <div class="rb-modal-backdrop">
      <div class="rb-modal-card">

        <div class="rb-modal-header">
          ${title}
        </div>

        <div class="rb-modal-body">
          ${content}
        </div>

        <div class="rb-modal-footer">
          ${footer}
        </div>

      </div>
    </div>
  `;

  modalRoot.classList.add("active");

  return modalRoot;
}

export function closeModal() {
  if (!modalRoot) return;

  modalRoot.classList.remove("active");
  modalRoot.innerHTML = "";
}

/* =========================
   ALERT
========================= */

export function alertModal({
  title = "Alert",
  message = ""
} = {}) {
  return new Promise((resolve) => {
    openModal({
      title,
      content: `
        <p>${message}</p>
      `,
      footer: `
        <button id="rb-alert-ok">
          OK
        </button>
      `
    });

    setTimeout(() => {
      document
        .getElementById("rb-alert-ok")
        ?.addEventListener(
          "click",
          () => {
            closeModal();
            resolve(true);
          }
        );
    }, 25);
  });
}

/* =========================
   CONFIRM
========================= */

export function confirmModal({
  title = "Confirm",
  message = ""
} = {}) {
  return new Promise((resolve) => {
    openModal({
      title,
      content: `
        <p>${message}</p>
      `,
      footer: `
        <button id="rb-confirm-no">
          Cancel
        </button>

        <button id="rb-confirm-yes">
          Confirm
        </button>
      `
    });

    setTimeout(() => {
      document
        .getElementById("rb-confirm-no")
        ?.addEventListener(
          "click",
          () => {
            closeModal();
            resolve(false);
          }
        );

      document
        .getElementById("rb-confirm-yes")
        ?.addEventListener(
          "click",
          () => {
            closeModal();
            resolve(true);
          }
        );
    }, 25);
  });
}

/* =========================
   DRAWERS
========================= */

export function openDrawer({
  content = ""
} = {}) {
  ensureRoots();

  drawerRoot.innerHTML = `
    <div class="rb-drawer-backdrop">
      <div class="rb-drawer">
        ${content}
      </div>
    </div>
  `;

  drawerRoot.classList.add("active");
}

export function closeDrawer() {
  if (!drawerRoot) return;

  drawerRoot.classList.remove("active");
  drawerRoot.innerHTML = "";
}

/* =========================
   PAGE STATES
========================= */

export function setEmptyState(
  element,
  {
    icon = "🌌",
    title = "Nothing here yet",
    message = ""
  } = {}
) {
  if (!element) return;

  element.innerHTML = `
    <div class="rb-empty-state">
      <div class="rb-empty-icon">
        ${icon}
      </div>

      <h3>${title}</h3>

      <p>${message}</p>
    </div>
  `;
}

export function setErrorState(
  element,
  message = "Something went wrong."
) {
  if (!element) return;

  element.innerHTML = `
    <div class="rb-error-state">
      <div>❌</div>
      <p>${message}</p>
    </div>
  `;
}

export function setLoadingState(
  element,
  message = "Loading..."
) {
  if (!element) return;

  element.innerHTML = `
    <div class="rb-loading-state">
      <div class="rb-loader-spinner"></div>
      <p>${message}</p>
    </div>
  `;
}

/* =========================
   STATUS BADGES
========================= */

export function statusBadge(
  text = "",
  type = "default"
) {
  return `
    <span class="
      rb-status-badge
      rb-status-${type}
    ">
      ${text}
    </span>
  `;
}

/* =========================
   COPY
========================= */

export async function copyText(
  text = ""
) {
  await navigator.clipboard.writeText(
    String(text || "")
  );

  success("Copied");
}

/* =========================
   SHARE
========================= */

export async function share({
  title = "",
  text = "",
  url = window.location.href
}) {
  if (navigator.share) {
    return navigator.share({
      title,
      text,
      url
    });
  }

  await copyText(url);
}

/* =========================
   SOUND FX
========================= */

export function playClick() {
  document.dispatchEvent(
    new CustomEvent("rb-click")
  );
}

export function playSuccess() {
  document.dispatchEvent(
    new CustomEvent("rb-success")
  );
}

export function playError() {
  document.dispatchEvent(
    new CustomEvent("rb-error")
  );
}

/* =========================
   BOOT
========================= */

window.addEventListener(
  "DOMContentLoaded",
  ensureRoots
);

console.log(
  "RB UI READY",
  RB_VISUALS?.brandMood || ""
);
