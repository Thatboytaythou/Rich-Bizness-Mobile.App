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

import { RB_VISUALS } from "/core/shared/rb-config.js";

let toastRoot = null;
let modalRoot = null;
let drawerRoot = null;
let loaderRoot = null;

function hasDOM() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeType(type = "default") {
  return String(type || "default")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32) || "default";
}

function getOrCreateRoot(id) {
  if (!hasDOM()) return null;

  let root = document.getElementById(id);

  if (!root) {
    root = document.createElement("div");
    root.id = id;
    document.body.appendChild(root);
  }

  return root;
}

function ensureRoots() {
  if (!hasDOM()) return;

  toastRoot = toastRoot || getOrCreateRoot("rb-toast-root");
  modalRoot = modalRoot || getOrCreateRoot("rb-modal-root");
  drawerRoot = drawerRoot || getOrCreateRoot("rb-drawer-root");
  loaderRoot = loaderRoot || getOrCreateRoot("rb-loader-root");
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
  if (!toastRoot) return null;

  const node = document.createElement("div");
  const cleanType = safeType(type);

  node.className = `rb-toast rb-toast-${cleanType}`;
  node.setAttribute("role", cleanType === "error" ? "alert" : "status");
  node.setAttribute("aria-live", cleanType === "error" ? "assertive" : "polite");

  node.innerHTML = `
    <span class="rb-toast-icon">${escapeHtml(icon)}</span>
    <span class="rb-toast-message">${escapeHtml(message)}</span>
  `;

  toastRoot.appendChild(node);

  requestAnimationFrame(() => {
    node.classList.add("show", "is-visible");
  });

  const timeout = Math.max(800, Number(duration || 3500));

  setTimeout(() => {
    node.classList.remove("show", "is-visible");

    setTimeout(() => {
      node.remove();
    }, 250);
  }, timeout);

  return node;
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

export function showLoader(text = "Loading...") {
  ensureRoots();
  if (!loaderRoot) return;

  loaderRoot.innerHTML = `
    <div class="rb-loader-backdrop">
      <div class="rb-loader-card" role="status" aria-live="polite">
        <div class="rb-loader-spinner" aria-hidden="true"></div>
        <div class="rb-loader-text">${escapeHtml(text)}</div>
      </div>
    </div>
  `;

  loaderRoot.classList.add("active", "is-active");
  document.body.classList.add("rb-loader-open");
}

export function hideLoader() {
  if (!loaderRoot) return;

  loaderRoot.classList.remove("active", "is-active");
  loaderRoot.innerHTML = "";

  if (hasDOM()) {
    document.body.classList.remove("rb-loader-open");
  }
}

/* =========================
   MODAL
========================= */

export function openModal({
  title = "",
  content = "",
  footer = "",
  unsafeHtml = false,
  closeOnBackdrop = true
} = {}) {
  ensureRoots();
  if (!modalRoot) return null;

  const safeTitle = unsafeHtml ? title : escapeHtml(title);
  const safeContent = unsafeHtml ? content : escapeHtml(content);
  const safeFooter = unsafeHtml ? footer : footer;

  modalRoot.innerHTML = `
    <div class="rb-modal-backdrop" data-rb-modal-backdrop>
      <div class="rb-modal-card" role="dialog" aria-modal="true">
        <button class="rb-modal-close" type="button" data-rb-modal-close aria-label="Close">×</button>

        <div class="rb-modal-header">
          ${safeTitle}
        </div>

        <div class="rb-modal-body">
          ${safeContent}
        </div>

        <div class="rb-modal-footer">
          ${safeFooter}
        </div>
      </div>
    </div>
  `;

  modalRoot.classList.add("active", "is-active");
  document.body.classList.add("rb-modal-open");

  modalRoot.querySelector("[data-rb-modal-close]")?.addEventListener("click", closeModal);

  if (closeOnBackdrop) {
    modalRoot.querySelector("[data-rb-modal-backdrop]")?.addEventListener("click", (event) => {
      if (event.target?.dataset?.rbModalBackdrop !== undefined) {
        closeModal();
      }
    });
  }

  return modalRoot;
}

export function closeModal() {
  if (!modalRoot) return;

  modalRoot.classList.remove("active", "is-active");
  modalRoot.innerHTML = "";

  if (hasDOM()) {
    document.body.classList.remove("rb-modal-open");
  }
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
      content: `<p>${escapeHtml(message)}</p>`,
      footer: `
        <button id="rb-alert-ok" class="rb-main-launch" type="button">
          OK
        </button>
      `,
      unsafeHtml: true,
      closeOnBackdrop: false
    });

    document.getElementById("rb-alert-ok")?.addEventListener("click", () => {
      closeModal();
      resolve(true);
    });
  });
}

/* =========================
   CONFIRM
========================= */

export function confirmModal({
  title = "Confirm",
  message = "",
  confirmText = "Confirm",
  cancelText = "Cancel"
} = {}) {
  return new Promise((resolve) => {
    openModal({
      title,
      content: `<p>${escapeHtml(message)}</p>`,
      footer: `
        <button id="rb-confirm-no" class="rb-btn ghost" type="button">
          ${escapeHtml(cancelText)}
        </button>

        <button id="rb-confirm-yes" class="rb-main-launch" type="button">
          ${escapeHtml(confirmText)}
        </button>
      `,
      unsafeHtml: true,
      closeOnBackdrop: false
    });

    document.getElementById("rb-confirm-no")?.addEventListener("click", () => {
      closeModal();
      resolve(false);
    });

    document.getElementById("rb-confirm-yes")?.addEventListener("click", () => {
      closeModal();
      resolve(true);
    });
  });
}

/* =========================
   DRAWERS
========================= */

export function openDrawer({
  content = "",
  unsafeHtml = false,
  closeOnBackdrop = true
} = {}) {
  ensureRoots();
  if (!drawerRoot) return null;

  drawerRoot.innerHTML = `
    <div class="rb-drawer-backdrop" data-rb-drawer-backdrop>
      <aside class="rb-drawer" role="dialog" aria-modal="true">
        <button class="rb-drawer-close" type="button" data-rb-drawer-close aria-label="Close">×</button>
        ${unsafeHtml ? content : escapeHtml(content)}
      </aside>
    </div>
  `;

  drawerRoot.classList.add("active", "is-active");
  document.body.classList.add("rb-drawer-open");

  drawerRoot.querySelector("[data-rb-drawer-close]")?.addEventListener("click", closeDrawer);

  if (closeOnBackdrop) {
    drawerRoot.querySelector("[data-rb-drawer-backdrop]")?.addEventListener("click", (event) => {
      if (event.target?.dataset?.rbDrawerBackdrop !== undefined) {
        closeDrawer();
      }
    });
  }

  return drawerRoot;
}

export function closeDrawer() {
  if (!drawerRoot) return;

  drawerRoot.classList.remove("active", "is-active");
  drawerRoot.innerHTML = "";

  if (hasDOM()) {
    document.body.classList.remove("rb-drawer-open");
  }
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
      <div class="rb-empty-icon">${escapeHtml(icon)}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
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
      <p>${escapeHtml(message)}</p>
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
      <div class="rb-loader-spinner" aria-hidden="true"></div>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

/* =========================
   STATUS BADGES
========================= */

export function statusBadge(text = "", type = "default") {
  const cleanType = safeType(type);

  return `
    <span class="rb-status-badge rb-status-${cleanType}">
      ${escapeHtml(text)}
    </span>
  `;
}

/* =========================
   COPY
========================= */

export async function copyText(text = "") {
  const value = String(text || "");

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "true");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }

    success("Copied");
    return true;
  } catch {
    error("Copy failed");
    return false;
  }
}

/* =========================
   SHARE
========================= */

export async function share({
  title = "",
  text = "",
  url = hasDOM() ? window.location.href : ""
} = {}) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return true;
    }

    return await copyText(url);
  } catch {
    return false;
  }
}

/* =========================
   SOUND FX
========================= */

export function playClick() {
  if (!hasDOM()) return;
  document.dispatchEvent(new CustomEvent("rb-click"));
}

export function playSuccess() {
  if (!hasDOM()) return;
  document.dispatchEvent(new CustomEvent("rb-success"));
}

export function playError() {
  if (!hasDOM()) return;
  document.dispatchEvent(new CustomEvent("rb-error"));
}

/* =========================
   BOOT
========================= */

if (hasDOM()) {
  window.addEventListener("DOMContentLoaded", ensureRoots);
}

console.log("RB UI READY", RB_VISUALS?.brandMood || "");
