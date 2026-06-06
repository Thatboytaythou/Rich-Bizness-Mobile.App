/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-navigation.js

   GLOBAL NAVIGATION ENGINE
   Route Lock
   Secret Routes
   Active Module Tracking

   Supports:
   - data-route="profile"
   - data-route="/profile"
   - href="/profile"

   Does not hijack:
   - external links
   - hash links
   - mail/tel links
   - target="_blank"
   - data-nav-ignore="true"
========================= */

import {
  RB_MODULES,
  RB_ROUTES,
  RB_PROFILE_KEYS
} from "/core/shared/rb-config.js";

import {
  getProfile
} from "/core/shared/rb-supabase.js";

let activeRoute = normalizePath(window.location.pathname || "/");
let activeModule = null;

/* =========================
   NORMALIZE
========================= */

export function normalizePath(path = "") {
  if (!path) return "/";

  const clean = String(path).trim();

  if (!clean) return "/";
  if (clean === "/index.html") return "/";

  return (
    clean
      .replace(window.location.origin, "")
      .replace(/\/index\.html$/, "/")
      .replace(/\.html$/, "")
      .replace(/\/$/, "") || "/"
  );
}

export function shouldIgnoreNavigation(value = "", element = null) {
  const raw = String(value || "").trim();

  if (!raw) return true;

  if (element?.dataset?.navIgnore === "true") return true;
  if (element?.getAttribute?.("target") === "_blank") return true;
  if (element?.hasAttribute?.("download")) return true;

  return (
    raw.startsWith("#") ||
    raw.startsWith("mailto:") ||
    raw.startsWith("tel:") ||
    raw.startsWith("sms:") ||
    raw.startsWith("http://") ||
    raw.startsWith("https://")
  );
}

export function resolveRoute(value = "") {
  const raw = String(value || "").trim();

  if (!raw) return "/";

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("#") ||
    raw.startsWith("mailto:") ||
    raw.startsWith("tel:") ||
    raw.startsWith("sms:")
  ) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return normalizePath(raw);
  }

  if (RB_ROUTES?.[raw]) {
    const route = RB_ROUTES[raw];

    if (typeof route === "string") {
      return normalizePath(route);
    }
  }

  const module = getModule(raw);

  if (module?.route) {
    return normalizePath(module.route);
  }

  const secretRoute = RB_PROFILE_KEYS?.secretRoutes?.[raw];

  if (secretRoute) {
    return normalizePath(secretRoute);
  }

  return normalizePath(`/${raw}`);
}

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
  const resolved = resolveRoute(route);

  return Object.values(RB_ROUTES).some((value) => {
    if (typeof value === "string") {
      return normalizePath(value) === resolved;
    }

    if (value && typeof value === "object") {
      return Object.values(value).some(
        (nested) => normalizePath(nested) === resolved
      );
    }

    return false;
  });
}

export function moduleExists(key = "") {
  return RB_MODULES.some((module) => module.key === key);
}

/* =========================
   MODULE LOOKUPS
========================= */

export function getModule(key = "") {
  return RB_MODULES.find((module) => module.key === key) || null;
}

export function getModuleByRoute(route = "") {
  const resolved = resolveRoute(route);

  return (
    RB_MODULES.find(
      (module) => normalizePath(module.route) === resolved
    ) || null
  );
}

export function getActiveModule() {
  return getModuleByRoute(window.location.pathname);
}

/* =========================
   SECRET ROUTES
========================= */

export function isSecretRoute(route = "") {
  const resolved = resolveRoute(route);
  const secrets = RB_PROFILE_KEYS?.secretRoutes || {};

  return Object.values(secrets).some(
    (secret) => normalizePath(secret) === resolved
  );
}

export function canAccessSecretRoute(route = "") {
  const profile = getProfile();

  if (!isSecretRoute(route)) return true;

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
  const resolved = resolveRoute(route);

  if (!resolved) return false;

  if (
    isSecretRoute(resolved) &&
    !canAccessSecretRoute(resolved)
  ) {
    console.warn("[RB NAV] Secret route blocked:", resolved);
    return false;
  }

  window.dispatchEvent(
    new CustomEvent("rb:route-before-change", {
      detail: {
        from: normalizePath(window.location.pathname),
        to: resolved
      }
    })
  );

  window.location.href = resolved;
  return true;
}

export function replace(route = "/") {
  const resolved = resolveRoute(route);

  if (!resolved) return false;

  if (
    isSecretRoute(resolved) &&
    !canAccessSecretRoute(resolved)
  ) {
    console.warn("[RB NAV] Secret route blocked:", resolved);
    return false;
  }

  window.location.replace(resolved);
  return true;
}

export function openModule(moduleKey = "") {
  const module = getModule(moduleKey);

  if (!module) {
    console.warn(`[RB NAV] Unknown module: ${moduleKey}`);
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
  return new URLSearchParams(window.location.search).get(key);
}

export function getAllQueryParams() {
  return Object.fromEntries(
    new URLSearchParams(window.location.search)
  );
}

export function setQueryParam(key, value, replaceState = true) {
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
    window.history.replaceState({}, "", url.toString());
  } else {
    window.history.pushState({}, "", url.toString());
  }

  updateActiveRoute();
  bindActiveNavigation();

  return url.toString();
}

/* =========================
   ACTIVE STATE
========================= */

export function updateActiveRoute() {
  activeRoute = normalizePath(window.location.pathname || "/");
  activeModule = getModuleByRoute(activeRoute);

  window.dispatchEvent(
    new CustomEvent("rb:route-change", {
      detail: {
        route: activeRoute,
        module: activeModule
      }
    })
  );

  return {
    route: activeRoute,
    module: activeModule
  };
}

export function isRoute(route = "") {
  return currentRoute() === resolveRoute(route);
}

export function isModule(moduleKey = "") {
  return currentModule()?.key === moduleKey;
}

/* =========================
   NAV UI BINDING
========================= */

export function bindNavigation({
  selector = "[data-route], a[href]"
} = {}) {
  document.querySelectorAll(selector).forEach((element) => {
    if (element.dataset.rbNavBound === "true") return;

    const rawRoute =
      element.dataset.route ||
      element.getAttribute("href") ||
      "";

    if (shouldIgnoreNavigation(rawRoute, element)) return;

    element.dataset.rbNavBound = "true";

    element.addEventListener("click", (event) => {
      const route =
        element.dataset.route ||
        element.getAttribute("href");

      if (shouldIgnoreNavigation(route, element)) return;

      event.preventDefault();
      go(route);
    });
  });
}

export function bindActiveNavigation({
  selector = "[data-route], a[href]",
  activeClass = "is-active"
} = {}) {
  const current = normalizePath(window.location.pathname);

  document.querySelectorAll(selector).forEach((element) => {
    const rawRoute =
      element.dataset.route ||
      element.getAttribute("href") ||
      "";

    if (shouldIgnoreNavigation(rawRoute, element)) return;

    const resolved = resolveRoute(rawRoute);
    const active = resolved === current;

    element.classList.toggle(activeClass, active);
    element.classList.toggle("active", active);

    if (active) {
      element.setAttribute("aria-current", "page");
    } else {
      element.removeAttribute("aria-current");
    }
  });
}

export function bindGlobalNavigation(options = {}) {
  bindNavigation(options);
  bindActiveNavigation(options);

  document.body?.classList.add("rb-navigation-bound");
}

/* =========================
   MODULE MENU
========================= */

export function buildModuleMenu() {
  const current = normalizePath(window.location.pathname);

  return RB_MODULES.map((module) => ({
    key: module.key,
    label: module.label,
    icon: module.icon,
    route: normalizePath(module.route),
    color: module.color,
    active: normalizePath(module.route) === current
  }));
}

/* =========================
   STARTUP
========================= */

window.addEventListener("popstate", () => {
  updateActiveRoute();
  bindActiveNavigation();
});

updateActiveRoute();

console.log("RB NAVIGATION READY");
