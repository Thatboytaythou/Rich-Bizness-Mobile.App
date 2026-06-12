/* =========================
   RICH BIZNESS MOBILE
   /core/engine/world-engine.js

   World Engine
   - Handles route clicks
   - Handles hotspot positions
   - Handles resize/orientation layout
   - Does NOT render Three.js portal
========================= */

const ROUTES = {
  home: "/",
  feed: "/feed.html",
  live: "/live.html",
  music: "/music.html",
  podcast: "/music.html?tab=podcast",
  radio: "/music.html?tab=radio",
  gallery: "/gallery.html",
  gaming: "/gaming.html",
  sports: "/sports.html",
  store: "/store.html",
  upload: "/upload.html",
  meta: "/meta.html",
  profile: "/profile.html",
  messages: "/messages.html",
  notifications: "/notifications.html",
  search: "/search.html",
  watch: "/watch.html",
  settings: "/settings.html",
  creator: "/creator.html",
  admin: "/admin.html"
};

const WORLD_LAYOUTS = {
  desktop: {
    gallery: [16.2, 36.4],
    music: [31.8, 46.8],
    live: [50, 45.7],
    gaming: [67.8, 36.6],
    sports: [84.2, 36.4],
    store: [24.5, 56.2],
    upload: [70.8, 56.3],
    meta: [84.4, 63.8],
    podcast: [50, 48]
  },

  portrait: {
    gallery: [18.8, 36.7],
    music: [34, 49.5],
    live: [50, 47.4],
    gaming: [68.8, 37.3],
    sports: [84.4, 36.8],
    store: [25.5, 56.8],
    upload: [71, 56.8],
    meta: [84.2, 64.2],
    podcast: [50, 49]
  }
};

function isPortraitView() {
  return (
    window.innerWidth <= 900 ||
    window.matchMedia("(orientation: portrait)").matches
  );
}

function setWorldPoint(key, x, y) {
  const element = document.querySelector(`[data-world="${key}"]`);

  if (!element) {
    return;
  }

  element.style.setProperty("--x", String(x));
  element.style.setProperty("--y", String(y));
}

function applyWorldLayout() {
  const portrait = isPortraitView();
  const layout = portrait ? WORLD_LAYOUTS.portrait : WORLD_LAYOUTS.desktop;

  document.body.dataset.worldMode = portrait ? "portrait" : "desktop";

  Object.entries(layout).forEach(([key, point]) => {
    setWorldPoint(key, point[0], point[1]);
  });
}

function getRouteHref(routeKey) {
  if (!routeKey) {
    return null;
  }

  return ROUTES[routeKey] || null;
}

function goToRoute(routeKey) {
  const href = getRouteHref(routeKey);

  if (!href) {
    return;
  }

  window.location.href = href;
}

function bindRoutes() {
  document.querySelectorAll("[data-route]").forEach((element) => {
    if (element.dataset.routeBound === "true") {
      return;
    }

    element.dataset.routeBound = "true";

    element.addEventListener("click", (event) => {
      const routeKey = element.dataset.route;
      const href = getRouteHref(routeKey);

      if (!href) {
        return;
      }

      event.preventDefault();
      goToRoute(routeKey);
    });
  });
}

function bindKeyboardRoutes() {
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

      if (!href) {
        return;
      }

      event.preventDefault();
      goToRoute(routeKey);
    });
  });
}

function bootWorldEngine() {
  bindRoutes();
  bindKeyboardRoutes();
  applyWorldLayout();

  window.addEventListener(
    "resize",
    () => {
      applyWorldLayout();
    },
    { passive: true }
  );

  window.addEventListener(
    "orientationchange",
    () => {
      setTimeout(applyWorldLayout, 180);
    },
    { passive: true }
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootWorldEngine);
} else {
  bootWorldEngine();
}
