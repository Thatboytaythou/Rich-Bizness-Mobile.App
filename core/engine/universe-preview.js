import RB_CONFIG from "/core/shared/rb-config.js";

/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js

   UNIVERSE ROUTING LAYER
   - Orbit card routing
   - Quick tab routing
   - Profile chip routing
   - Smooth navigation hooks
========================= */

const quickRoutes = {
  profile: RB_CONFIG.routes.profile,

  admin: "/admin",
  creator: "/creator",

  watch: RB_CONFIG.routes.watch,

  alerts: RB_CONFIG.routes.notifications,
  notifications: RB_CONFIG.routes.notifications,

  settings: RB_CONFIG.routes.settings,
  edit: RB_CONFIG.routes.edit,
  messages: RB_CONFIG.routes.messages,
};

/* =========================
   NAVIGATION
========================= */

function goToRoute(route) {
  if (!route) return;

  document.body.classList.add("rb-page-transition");

  setTimeout(() => {
    window.location.href = route;
  }, 180);
}

function goToSection(sectionKey) {
  if (!sectionKey) return;

  const route = RB_CONFIG.routes[sectionKey];

  if (!route) {
    console.warn("[RB] Missing section route:", sectionKey);
    return;
  }

  goToRoute(route);
}

/* =========================
   ORBIT CARD CLICK
========================= */

window.addEventListener("rb:module-select", (event) => {
  const mod = event.detail;

  if (!mod?.key) return;

  goToSection(mod.key);
});

/* =========================
   QUICK BUTTON ROUTING
========================= */

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-route]");

  if (!button) return;

  const routeKey = button.dataset.route;

  const route =
    quickRoutes[routeKey] ||
    RB_CONFIG.routes[routeKey];

  if (!route) {
    console.warn("[RB] Missing quick route:", routeKey);
    return;
  }

  button.classList.add("is-active");

  setTimeout(() => {
    button.classList.remove("is-active");
  }, 220);

  goToRoute(route);
});

/* =========================
   GLOBAL HELPERS
========================= */

window.RB_GO = goToSection;
window.RB_ROUTE = goToRoute;

/* =========================
   INTRO FX
========================= */

window.addEventListener("load", () => {
  document.body.classList.add("rb-loaded");

  const profileChip = document.querySelector(".rb-profile-chip");

  if (profileChip) {
    profileChip.classList.add("is-visible");
  }

  const tabs = document.querySelectorAll(".rb-side-tabs button");

  tabs.forEach((tab, index) => {
    setTimeout(() => {
      tab.classList.add("is-visible");
    }, 100 + index * 70);
  });
});

/* =========================
   KEYBOARD SUPPORT
========================= */

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.activeElement?.blur?.();
  }

  if (event.key === "m") {
    goToSection("messages");
  }

  if (event.key === "l") {
    goToSection("live");
  }

  if (event.key === "g") {
    goToSection("gaming");
  }
});

/* =========================
   MOBILE SAFE HEIGHT
========================= */

function updateViewportHeight() {
  const vh = window.innerHeight * 0.01;

  document.documentElement.style.setProperty(
    "--rb-vh",
    `${vh}px`
  );
}

updateViewportHeight();

window.addEventListener(
  "resize",
  updateViewportHeight,
  { passive: true }
);

window.addEventListener(
  "orientationchange",
  updateViewportHeight,
  { passive: true }
);

console.log("RB INDEX READY");
