/* =========================
   RICH BIZNESS MOBILE
   /core/engine/world-engine.js

   World Engine
   - Handles route clicks only
   - Does NOT force hotspot positions
   - Does NOT fight portrait-fit CSS
   - Does NOT render Three.js portal
========================= */

const ROUTES = {
  home: "./index.html",
  portal: "./index.html",
  index: "./index.html",

  auth: "./auth.html",
  login: "./auth.html",
  signup: "./auth.html",

  feed: "./feed.html",
  live: "./live.html",
  music: "./music.html",
  podcast: "./music.html?tab=podcast",
  radio: "./music.html?tab=radio",
  gallery: "./gallery.html",
  gaming: "./gaming.html",
  sports: "./sports.html",
  store: "./store.html",
  upload: "./upload.html",
  meta: "./meta.html",
  profile: "./profile.html",
  messages: "./messages.html",
  notifications: "./notifications.html",
  search: "./feed.html",
  watch: "./watch.html",
  settings: "./settings.html",
  creator: "./creator.html",
  admin: "./admin.html"
};

let worldEngineBooted = false;

function hasDOM() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function shouldIgnoreRoute(raw = "") {
  return (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("mailto:") ||
    raw.startsWith("tel:") ||
    raw.startsWith("sms:") ||
    raw.startsWith("#")
  );
}

function getRouteHref(routeKey) {
  const raw = String(routeKey || "").trim();

  if (!raw) return null;

  if (shouldIgnoreRoute(raw)) {
    return raw;
  }

  return ROUTES[raw] || raw;
}

function goToRoute(routeKey) {
  const href = getRouteHref(routeKey);

  if (!href) return false;

  window.location.href = href;
  return true;
}

function bindRoutes() {
  if (!hasDOM()) return;

  document.querySelectorAll("[data-route]").forEach((element) => {
    if (element.dataset.routeBound === "true") {
      return;
    }

    element.dataset.routeBound = "true";

    element.addEventListener("click", (event) => {
      const routeKey = element.dataset.route;
      const href = getRouteHref(routeKey);

      if (!href) return;

      event.preventDefault();
      goToRoute(routeKey);
    });
  });
}

function bindKeyboardRoutes() {
  if (!hasDOM()) return;

  document.querySelectorAll("button[data-route]").forEach((element) => {
    if (element.dataset.keyboardBound === "true") {
      return;
    }

    element.dataset.keyboardBound = "true";

    element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const routeKey = element.dataset.route;
      const href = getRouteHref(routeKey);

      if (!href) return;

      event.preventDefault();
      goToRoute(routeKey);
    });
  });
}

function setWorldMode() {
  if (!hasDOM()) return;

  const portrait =
    window.innerWidth <= 900 ||
    window.matchMedia("(orientation: portrait)").matches;

  document.body.dataset.worldMode = portrait ? "portrait" : "desktop";
}

function bootWorldEngine() {
  if (!hasDOM()) return;
  if (worldEngineBooted) return;

  worldEngineBooted = true;

  bindRoutes();
  bindKeyboardRoutes();
  setWorldMode();

  window.addEventListener(
    "resize",
    () => {
      setWorldMode();
    },
    { passive: true }
  );

  window.addEventListener(
    "orientationchange",
    () => {
      window.setTimeout(setWorldMode, 180);
    },
    { passive: true }
  );

  console.log("RB WORLD ENGINE READY");
}

if (hasDOM()) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootWorldEngine);
  } else {
    bootWorldEngine();
  }
}
