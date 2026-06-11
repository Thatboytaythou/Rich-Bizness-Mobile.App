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
  podcast: "/podcast.html",
  radio: "/radio.html",
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
    gallery: [29, 26],
    podcast: [14, 38],
    live: [16, 57],
    music: [32, 49],
    meta: [50, 18],
    gaming: [72, 26],
    sports: [88, 34],
    store: [72, 52],
    upload: [87, 63]
  },

  portrait: {
    gallery: [20, 32],
    podcast: [42, 37],
    live: [76, 45],
    gaming: [38, 66],
    music: [34, 50],
    meta: [50, 20],
    sports: [84, 35],
    store: [70, 55],
    upload: [82, 63]
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
    el.addEventListener("click", () => {
      const key = el.dataset.route;
      const href = ROUTES[key] || "/";
      window.location.href = href;
    });
  });
}

function bootWorldEngine() {
  bindRoutes();
  applyWorldLayout();

  window.addEventListener("resize", applyWorldLayout);
  window.addEventListener("orientationchange", () => {
    setTimeout(applyWorldLayout, 120);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootWorldEngine);
} else {
  bootWorldEngine();
}
