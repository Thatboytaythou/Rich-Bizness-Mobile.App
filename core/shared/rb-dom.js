/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-dom.js

   DOM + UI HELPERS

   Rule:
   - Pure DOM utilities only
   - No auth/profile/router/Supabase/XP imports
========================= */

const hasDOM = () =>
  typeof window !== "undefined" && typeof document !== "undefined";

const getRoot = (root = null) => {
  if (!hasDOM()) return null;
  return root || document;
};

const resolve = (target, root = null) => {
  const base = getRoot(root);
  if (!base) return null;
  if (!target) return null;

  return typeof target === "string" ? base.querySelector(target) : target;
};

export const $ = (selector, root = null) => {
  const base = getRoot(root);
  return base && selector ? base.querySelector(selector) : null;
};

export const $$ = (selector, root = null) => {
  const base = getRoot(root);
  return base && selector ? Array.from(base.querySelectorAll(selector)) : [];
};

export const byId = (id) =>
  hasDOM() && id ? document.getElementById(id) : null;

export function exists(selector, root = null) {
  return !!$(selector, root);
}

export function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function setText(target, value = "") {
  const el = resolve(target);
  if (!el) return;
  el.textContent = value ?? "";
}

export function setHTML(target, value = "") {
  const el = resolve(target);
  if (!el) return;
  el.innerHTML = value ?? "";
}

export function setSafeHTML(target, value = "") {
  const el = resolve(target);
  if (!el) return;
  el.innerHTML = escapeHtml(value);
}

export function setValue(target, value = "") {
  const el = resolve(target);
  if (!el) return;
  el.value = value ?? "";
}

export function getValue(target, fallback = "") {
  const el = resolve(target);
  return el?.value?.trim?.() || fallback;
}

export function setAttr(target, key, value) {
  const el = resolve(target);
  if (!el || !key) return;

  if (value === null || value === undefined) {
    el.removeAttribute(key);
    return;
  }

  el.setAttribute(key, String(value));
}

export function getAttr(target, key, fallback = "") {
  const el = resolve(target);
  if (!el || !key) return fallback;
  return el.getAttribute(key) || fallback;
}

export function setData(target, key, value) {
  const el = resolve(target);
  if (!el || !key) return;

  if (value === null || value === undefined) {
    delete el.dataset[key];
    return;
  }

  el.dataset[key] = String(value);
}

export function getData(target, key, fallback = "") {
  const el = resolve(target);
  if (!el || !key) return fallback;
  return el.dataset[key] || fallback;
}

export function show(target) {
  const el = resolve(target);
  if (!el) return;

  el.hidden = false;
  el.classList.remove("is-hidden", "hidden");
  el.setAttribute("aria-hidden", "false");
}

export function hide(target) {
  const el = resolve(target);
  if (!el) return;

  el.hidden = true;
  el.classList.add("is-hidden");
  el.setAttribute("aria-hidden", "true");
}

export function toggle(target, force) {
  const el = resolve(target);
  if (!el) return;
  el.classList.toggle("is-active", force);
}

export function addClass(target, className) {
  const el = resolve(target);
  if (!el || !className) return;
  el.classList.add(...String(className).split(" ").filter(Boolean));
}

export function removeClass(target, className) {
  const el = resolve(target);
  if (!el || !className) return;
  el.classList.remove(...String(className).split(" ").filter(Boolean));
}

export function toggleClass(target, className, force) {
  const el = resolve(target);
  if (!el || !className) return;
  el.classList.toggle(className, force);
}

export function on(target, event, handler, options = {}) {
  const el = resolve(target);
  if (!el || !event || typeof handler !== "function") return null;

  el.addEventListener(event, handler, options);

  return () => el.removeEventListener(event, handler, options);
}

export function onAll(selector, event, handler, options = {}) {
  const els = $$(selector);

  const cleanups = els
    .map((el) => on(el, event, handler, options))
    .filter(Boolean);

  return () => cleanups.forEach((cleanup) => cleanup());
}

export function delegate(root, selector, event, handler, options = {}) {
  const base = resolve(root);
  if (!base || !selector || !event || typeof handler !== "function") return null;

  const listener = (e) => {
    const source = e.target?.nodeType === 1 ? e.target : e.target?.parentElement;
    const target = source?.closest?.(selector);

    if (!target || !base.contains(target)) return;

    handler(e, target);
  };

  base.addEventListener(event, listener, options);

  return () => base.removeEventListener(event, listener, options);
}

export function createElement(tag = "div", options = {}) {
  if (!hasDOM()) return null;

  const el = document.createElement(tag);

  if (options.className) {
    el.className = options.className;
  }

  if (options.text != null) {
    el.textContent = options.text;
  }

  if (options.html != null) {
    el.innerHTML = options.html;
  }

  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => {
      if (value != null) el.setAttribute(key, String(value));
    });
  }

  if (options.dataset) {
    Object.entries(options.dataset).forEach(([key, value]) => {
      if (value != null) el.dataset[key] = String(value);
    });
  }

  if (options.children) {
    options.children.filter(Boolean).forEach((child) => {
      el.appendChild(child);
    });
  }

  return el;
}

export function clearChildren(target) {
  const el = resolve(target);
  if (!el) return;
  el.replaceChildren();
}

export function renderList(target, items = [], renderer) {
  const el = resolve(target);
  if (!el || typeof renderer !== "function") return;

  const fragment = document.createDocumentFragment();

  items.forEach((item, index) => {
    const node = renderer(item, index);
    if (node) fragment.appendChild(node);
  });

  el.replaceChildren(fragment);
}

export function safeImage(
  url,
  fallback = "/images/brand/Avatar-hero-Banner.png.jpeg"
) {
  const src = String(url || "").trim();

  if (
    !src ||
    src.includes("project-avatar")
  ) {
    return fallback;
  }

  return src;
}

export function lockBodyScroll() {
  if (!hasDOM()) return;

  document.documentElement.classList.add("rb-scroll-lock");
  document.body.classList.add("rb-scroll-lock");
}

export function unlockBodyScroll() {
  if (!hasDOM()) return;

  document.documentElement.classList.remove("rb-scroll-lock");
  document.body.classList.remove("rb-scroll-lock");
}

export function setPageReady() {
  if (!hasDOM()) return;

  document.documentElement.classList.add("rb-ready");
  document.body.classList.add("rb-ready");
}

export function setPageLoading() {
  if (!hasDOM()) return;

  document.documentElement.classList.add("rb-loading");
  document.body.classList.add("rb-loading");
}

export function clearPageLoading() {
  if (!hasDOM()) return;

  document.documentElement.classList.remove("rb-loading");
  document.body.classList.remove("rb-loading");
}

export function setPageError() {
  if (!hasDOM()) return;

  document.documentElement.classList.add("rb-error");
  document.body.classList.add("rb-error");
}

export function clearPageError() {
  if (!hasDOM()) return;

  document.documentElement.classList.remove("rb-error");
  document.body.classList.remove("rb-error");
}

console.log("RB DOM READY");
