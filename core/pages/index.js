import RB_CONFIG from "/core/shared/rb-config.js";

const quickRoutes = {
  profile: RB_CONFIG.routes.profile,
  admin: "/admin",
  creator: "/creator",
  watch: RB_CONFIG.routes.watch,
  alerts: RB_CONFIG.routes.notifications,
  settings: RB_CONFIG.routes.settings,
  edit: RB_CONFIG.routes.edit,
  messages: RB_CONFIG.routes.messages,
};

function goToRoute(route) {
  if (!route) return;
  window.location.href = route;
}

function goToSection(sectionKey) {
  const route = RB_CONFIG.routes[sectionKey];

  if (!route) {
    console.warn("Missing route:", sectionKey);
    return;
  }

  goToRoute(route);
}

window.addEventListener("rb:module-select", (event) => {
  const mod = event.detail;

  if (!mod?.key) return;

  goToSection(mod.key);
});

window.RB_GO = goToSection;
window.RB_ROUTE = goToRoute;

document.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-route]");

  if (!btn) return;

  const routeKey = btn.dataset.route;
  const route = quickRoutes[routeKey] || RB_CONFIG.routes[routeKey];

  goToRoute(route);
});

console.log("RB INDEX READY");
