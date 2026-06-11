/* =========================
   RICH BIZNESS MOBILE
   /core/engine/world-engine.js

   Controls:
   - route clicks
   - iPhone portrait world coordinates
   - desktop world coordinates
   - resize/orientation relayout
========================= */

const ROUTES = {
  home: "/",
  feed: "/feed.html",
  live: "/live.html",
  music: "/music.html",
  podcast: "/music.html?tab=podcast",
  radio: "/music.html?tab=radio",
  gaming: "/gaming.html",
  sports: "/sports.html",
  store: "/store.html",
  meta: "/meta.html",
  profile: "/profile.html",
  messages: "/messages.html",
  notifications: "/notifications.html",
  watch: "/watch.html",
  settings: "/settings.html",
  creator: "/creator.html",
  admin: "/admin.html",
  upload: "/upload.html",
  gallery: "/gallery.html",
  search: "/feed.html"
};

const WORLD_LAYOUTS = {
  desktop: {
    gallery: [16.2, 36.4],
    music: [31.8, 49.4],
    live: [50, 48.2],
    gaming: [67.8, 36.6],
    sports: [84.2, 36.4],
    store: [24.5, 56.2],
    upload: [70.8, 56.3],
    meta: [84.4, 63.8],
    podcast: [50, 48]
  },

  portrait: {
    gallery: [18.8, 36.7],
    music: [34, 52.5],
    live: [50, 50.4],
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
  const el = document.querySelector(`[data-world="${key}"]`);
  if (!el) return;

  el.style.setProperty("--x", String(x));
  el.style.setProperty("--y", String(y));
}

function applyWorldLayout() {
  const portrait = isPortraitView();
  const layout = portrait ? WORLD_LAYOUTS.portrait : WORLD_LAYOUTS.desktop;

  document.body.dataset.worldMode = portrait ? "portrait" : "desktop";

  Object.entries(layout).forEach(([key, point]) => {
    setWorldPoint(key, point[0], point[1]);
  });
}

function bindRoutes() {
  document.querySelectorAll("[data-route]").forEach((el) => {
    if (el.dataset.routeBound === "true") return;

    el.dataset.routeBound = "true";

    el.addEventListener("click", (event) => {
      const key = el.dataset.route;
      const href = ROUTES[key];

      if (!href) return;

      event.preventDefault();
      window.location.href = href;
    });
  });
}

function bootWorldEngine() {
  bindRoutes();
  applyWorldLayout();

  window.addEventListener("resize", applyWorldLayout);

  window.addEventListener("orientationchange", () => {
    setTimeout(applyWorldLayout, 160);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootWorldEngine);
} else {
  bootWorldEngine();
}
