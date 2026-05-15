 /* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-dom.js

   DOM + UI HELPERS
========================= */

export const $ = (selector, root = document) =>
  root.querySelector(selector);

export const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

export const byId = (id) =>
  document.getElementById(id);

export function exists(selector, root = document) {
  return !!$(selector, root);
}

export function setText(target, value = "") {
  const el = typeof target === "string" ? $(target) : target;
  if (!el) return;
  el.textContent = value ?? "";
}

export function setHTML(target, value = "") {
  const el = typeof target === "string" ? $(target) : target;
  if (!el) return;
  el.innerHTML = value ?? "";
}

export function setValue(target, value = "") {
  const el = typeof target === "string" ? $(target) : target;
  if (!el) return;
  el.value = value ?? "";
}

export function getValue(target, fallback = "") {
  const el = typeof target === "string" ? $(target) : target;
  return el?.value?.trim() || fallback;
}

export function show(target) {
  const el = typeof target === "string" ? $(target) : target;
  if (!el) return;
  el.hidden = false;
  el.classList.remove("is-hidden", "hidden");
}

export function hide(target) {
  const el = typeof target === "string" ? $(target) : target;
  if (!el) return;
  el.hidden = true;
  el.classList.add("is-hidden");
}

export function toggle(target, force) {
  const el = typeof target === "string" ? $(target) : target;
  if (!el) return;
  el.classList.toggle("is-active", force);
}

export function addClass(target, className) {
  const el = typeof target === "string" ? $(target) : target;
  if (!el || !className) return;
  el.classList.add(className);
}

export function removeClass(target, className) {
  const el = typeof target === "string" ? $(target) : target;
  if (!el || !className) return;
  el.classList.remove(className);
}

export function on(target, event, handler, options = {}) {
  const el = typeof target === "string" ? $(target) : target;
  if (!el || !event || typeof handler !== "function") return null;

  el.addEventListener(event, handler, options);

  return () => el.removeEventListener(event, handler, options);
}

export function onAll(selector, event, handler, options = {}) {
  const els = $$(selector);
  const cleanups = els.map((el) => on(el, event, handler, options)).filter(Boolean);

  return () => cleanups.forEach((cleanup) => cleanup());
}

export function createElement(tag = "div", options = {}) {
  const el = document.createElement(tag);

  if (options.className) el.className = options.className;
  if (options.text != null) el.textContent = options.text;
  if (options.html != null) el.innerHTML = options.html;

  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => {
      if (value != null) el.setAttribute(key, value);
    });
  }

  if (options.dataset) {
    Object.entries(options.dataset).forEach(([key, value]) => {
      if (value != null) el.dataset[key] = value;
    });
  }

  return el;
}

export function clearChildren(target) {
  const el = typeof target === "string" ? $(target) : target;
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function renderList(target, items = [], renderer) {
  const el = typeof target === "string" ? $(target) : target;
  if (!el || typeof renderer !== "function") return;

  clearChildren(el);

  items.forEach((item, index) => {
    const node = renderer(item, index);
    if (node) el.appendChild(node);
  });
}

export function safeImage(url, fallback = "/images/brand/rb-placeholder.png") {
  return url || fallback;
}

export function lockBodyScroll() {
  document.documentElement.classList.add("rb-scroll-lock");
  document.body.classList.add("rb-scroll-lock");
}

export function unlockBodyScroll() {
  document.documentElement.classList.remove("rb-scroll-lock");
  document.body.classList.remove("rb-scroll-lock");
}

export function setPageReady() {
  document.documentElement.classList.add("rb-ready");
  document.body.classList.add("rb-ready");
}

export function setPageLoading() {
  document.documentElement.classList.add("rb-loading");
  document.body.classList.add("rb-loading");
}

export function clearPageLoading() {
  document.documentElement.classList.remove("rb-loading");
  document.body.classList.remove("rb-loading");
}
