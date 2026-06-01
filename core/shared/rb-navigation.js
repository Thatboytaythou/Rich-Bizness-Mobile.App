/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-navigation.js

   GLOBAL NAVIGATION ENGINE
   Route Lock
   Secret Routes
   Active Module Tracking
========================= */

import {
  RB_MODULES,
  RB_ROUTES,
  RB_PROFILE_KEYS
} from "/core/shared/rb-config.js";

import {
  getProfile
} from "/core/shared/rb-supabase.js";

let activeRoute = window.location.pathname || "/";
let activeModule = null;

/* =========================
   ROUTE HELPERS
========================= */

export function currentRoute() {
  return activeRoute;
}

export function currentModule() {
  return activeModule;
}

export function routeExists(route = "") {
  return Object.values(RB_ROUTES).some((value) => {
    if (typeof value === "string") {
      return value === route;
    }

    if (typeof value === "object") {
      return Object.values(value).includes(route);
    }

    return false;
  });
}

export function moduleExists(key = "") {
  return RB_MODULES.some(
    (module) => module.key === key
  );
}

/* =========================
   MODULE LOOKUPS
========================= */

export function getModule(key = "") {
  return (
    RB_MODULES.find(
      (module) => module.key === key
    ) || null
  );
}

export function getModuleByRoute(route = "") {
  return (
    RB_MODULES.find(
      (module) => module.route === route
    ) || null
  );
}

export function getActiveModule() {
  return (
    getModuleByRoute(window.location.pathname) ||
    null
  );
}

/* =========================
   SECRET ROUTES
========================= */

export function isSecretRoute(route = "") {
  const secrets =
    RB_PROFILE_KEYS?.secretRoutes || {};

  return Object.values(secrets).includes(route);
}

export function canAccessSecretRoute(route = "") {
  const profile = getProfile();

  if (!isSecretRoute(route)) {
    return true;
  }

  return !!(
    profile?.role === "founder" ||
    profile?.role === "admin" ||
    profile?.role === "rich_admin" ||
    profile?.is_creator ||
    profile?.is_verified
  );
}

/* =========================
   NAVIGATION
========================= */

export function go(route = "/") {
  if (!route) return;

  if (
    isSecretRoute(route) &&
    !canAccessSecretRoute(route)
  ) {
    console.warn(
      "[RB NAV] Secret route blocked:",
      route
    );

    return false;
  }

  window.location.href = route;
  return true;
}

export function replace(route = "/") {
  if (!route) return;

  if (
    isSecretRoute(route) &&
    !canAccessSecretRoute(route)
  ) {
    return false;
  }

  window.location.replace(route);
  return true;
}

export function openModule(moduleKey = "") {
  const module = getModule(moduleKey);

  if (!module) {
    console.warn(
      `[RB NAV] Unknown module: ${moduleKey}`
    );

    return false;
  }

  return go(module.route);
}

export function back() {
  window.history.back();
}

export function forward() {
  window.history.forward();
}

export function reload() {
  window.location.reload();
}

/* =========================
   QUERY PARAMS
========================= */

export function getQueryParam(key) {
  const params = new URLSearchParams(
    window.location.search
  );

  return params.get(key);
}

export function getAllQueryParams() {
  return Object.fromEntries(
    new URLSearchParams(
      window.location.search
    )
  );
}

export function setQueryParam(
  key,
  value,
  replaceState = true
) {
  const url = new URL(window.location.href);

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }

  if (replaceState) {
    window.history.replaceState(
      {},
      "",
      url.toString()
    );
  } else {
    window.history.pushState(
      {},
      "",
      url.toString()
    );
  }

  return url.toString();
}

/* =========================
   ACTIVE STATE
========================= */

export function updateActiveRoute() {
  activeRoute =
    window.location.pathname || "/";

  activeModule =
    getModuleByRoute(activeRoute);

  return {
    route: activeRoute,
    module: activeModule
  };
}

export function isRoute(route = "") {
  return currentRoute() === route;
}

export function isModule(moduleKey = "") {
  return (
    currentModule()?.key === moduleKey
  );
}

/* =========================
   NAV UI BINDING
========================= */

export function bindNavigation({
  selector = "[data-route]"
} = {}) {
  document
    .querySelectorAll(selector)
    .forEach((element) => {
      element.addEventListener(
        "click",
        (event) => {
          event.preventDefault();

          const route =
            element.dataset.route;

          if (route) {
            go(route);
          }
        }
      );
    });
}

export function bindActiveNavigation({
  selector = "[data-route]"
} = {}) {
  const current =
    window.location.pathname;

  document
    .querySelectorAll(selector)
    .forEach((element) => {
      const route =
        element.dataset.route;

      element.classList.toggle(
        "active",
        route === current
      );
    });
}

/* =========================
   MODULE MENU
========================= */

export function buildModuleMenu() {
  return RB_MODULES.map((module) => ({
    key: module.key,
    label: module.label,
    icon: module.icon,
    route: module.route,
    color: module.color,
    active:
      module.route ===
      window.location.pathname
  }));
}

/* =========================
   STARTUP
========================= */

window.addEventListener(
  "popstate",
  updateActiveRoute
);

updateActiveRoute();

console.log(
  "RB NAVIGATION READY"
);
