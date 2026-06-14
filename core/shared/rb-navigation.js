/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-navigation.js

   GLOBAL NAVIGATION ENGINE

   Locked purpose:
   - bind data-route buttons
   - bind safe href links
   - update active navigation states
   - build module menu UI data
   - keep Index/Profile/Meta path clean

   Source-of-truth rule:
   - rb-router.js owns route resolving + query helpers + route access
   - rb-navigation.js owns UI navigation binding only
========================= */

import {
  RB_MODULES = []
} from "/core/shared/rb-config.js";

import {
  normalizePath,
  normalizeRoute,
  resolveRoute,
  goTo,
  getCurrentPath,
  isSecretRoute
} from "/core/shared/rb-router.js";

import {
  getProfile
} from "/core/shared/rb-supabase.js";

let activeRoute = normalizePath(
  typeof window !== "undefined" ? window.location.pathname || "/" : "/"
);

let activeModule = null;

/* =========================
   HELPERS
========================= */

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function splitPathAndSearch(value = "") {
  if (!isBrowser()) {
    return {
      pathname: "/",
      search: "",
      hash: ""
    };
  }

  const raw = String(value || "").trim();

  if (!raw) {
    return {
      pathname: "/",
      search: "",
      hash: ""
    };
  }

  try {
    const url =
      raw.startsWith("http://") || raw.startsWith("https://")
        ? new URL(raw)
        : new URL(raw, window.location.origin);

    return {
      pathname: url.pathname || "/",
      search: url.search || "",
      hash: url.hash || ""
    };
  } catch {
    const hashIndex = raw.indexOf("#");
    const queryIndex = raw.indexOf("?");

    let pathname = raw;
    let search = "";
    let hash = "";

    if (hashIndex >= 0) {
      hash = raw.slice(hashIndex);
      pathname = raw.slice(0, hashIndex);
    }

    if (queryIndex >= 0) {
      search = pathname.slice(queryIndex);
      pathname = pathname.slice(0, queryIndex);
    }

    return {
      pathname: pathname || "/",
      search,
      hash
    };
  }
}

export function shouldIgnoreNavigation(value = "", element = null) {
  if (!isBrowser()) return true;

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
    raw.startsWith("javascript:") ||
    (
      (raw.startsWith("http://") || raw.startsWith("https://")) &&
      !raw.startsWith(window.location.origin)
    )
  );
}

function dispatchNavigationEvent(name, detail = {}) {
  if (!isBrowser()) return;

  window.dispatchEvent(
    new CustomEvent(name, {
      detail
    })
  );
}

/* =========================
   MODULE LOOKUPS
========================= */

export function getModule(key = "") {
  if (!Array.isArray(RB_MODULES)) return null;

  return RB_MODULES.find((module) => module.key === key) || null;
}

export function getModuleByRoute(route = "") {
  const resolved = normalizePath(resolveRoute(route));

  if (!Array.isArray(RB_MODULES)) return null;

  return (
    RB_MODULES.find(
      (module) => normalizePath(module.route) === resolved
    ) || null
  );
}

export function getActiveModule() {
  if (!isBrowser()) return null;
  return getModuleByRoute(window.location.pathname);
}

export function moduleExists(key = "") {
  return Array.isArray(RB_MODULES) &&
    RB_MODULES.some((module) => module.key === key);
}

/* =========================
   SECRET ROUTE UI CHECK
========================= */

export function canAccessSecretRoute(route = "") {
  let profile = null;

  try {
    profile = getProfile();
  } catch {
    profile = null;
  }

  if (!isSecretRoute(route)) {
    return true;
  }

  return Boolean(
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
  if (!isBrowser()) return false;

  const resolved = resolveRoute(route);

  if (!resolved) return false;

  if (shouldIgnoreNavigation(resolved)) {
    window.location.href = resolved;
    return true;
  }

  if (
    isSecretRoute(resolved) &&
    !canAccessSecretRoute(resolved)
  ) {
    console.warn("[RB NAV] Secret route blocked:", resolved);

    dispatchNavigationEvent("rb:secret-route-blocked", {
      route: resolved
    });

    return false;
  }

  goTo(resolved);
  return true;
}

export function replace(route = "/") {
  if (!isBrowser()) return false;

  const resolved = resolveRoute(route);

  if (!resolved) return false;

  if (
    isSecretRoute(resolved) &&
    !canAccessSecretRoute(resolved)
  ) {
    console.warn("[RB NAV] Secret route blocked:", resolved);

    dispatchNavigationEvent("rb:secret-route-blocked", {
      route: resolved
    });

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
  if (!isBrowser()) return;
  window.history.back();
}

export function forward() {
  if (!isBrowser()) return;
  window.history.forward();
}

export function reload() {
  if (!isBrowser()) return;
  window.location.reload();
}

/* =========================
   ACTIVE STATE
========================= */

export function currentRoute() {
  return activeRoute;
}

export function currentModule() {
  return activeModule;
}

export function updateActiveRoute() {
  if (!isBrowser()) {
    return {
      route: activeRoute,
      module: activeModule
    };
  }

  activeRoute = getCurrentPath();
  activeModule = getModuleByRoute(activeRoute);

  document.documentElement?.setAttribute?.(
    "data-rb-current-route",
    activeRoute
  );

  document.body?.setAttribute?.(
    "data-rb-current-route",
    activeRoute
  );

  if (activeModule?.key) {
    document.documentElement?.setAttribute?.(
      "data-rb-current-module",
      activeModule.key
    );

    document.body?.setAttribute?.(
      "data-rb-current-module",
      activeModule.key
    );
  } else {
    document.documentElement?.removeAttribute?.("data-rb-current-module");
    document.body?.removeAttribute?.("data-rb-current-module");
  }

  dispatchNavigationEvent("rb:route-change", {
    route: activeRoute,
    module: activeModule
  });

  return {
    route: activeRoute,
    module: activeModule
  };
}

export function isRoute(route = "") {
  return currentRoute() === normalizePath(resolveRoute(route));
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
  if (!isBrowser()) return;

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
        element.getAttribute("href") ||
        "";

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
  if (!isBrowser()) return;

  const current = normalizePath(window.location.pathname);

  document.querySelectorAll(selector).forEach((element) => {
    const rawRoute =
      element.dataset.route ||
      element.getAttribute("href") ||
      "";

    if (shouldIgnoreNavigation(rawRoute, element)) return;

    const resolved = normalizePath(resolveRoute(rawRoute));
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
  if (!isBrowser()) return;

  updateActiveRoute();
  bindNavigation(options);
  bindActiveNavigation(options);

  document.body?.classList.add("rb-navigation-bound");

  dispatchNavigationEvent("rb:navigation-bound", {
    route: activeRoute,
    module: activeModule
  });
}

/* =========================
   MODULE MENU
========================= */

export function buildModuleMenu() {
  const current = isBrowser()
    ? normalizePath(window.location.pathname)
    : activeRoute;

  if (!Array.isArray(RB_MODULES)) return [];

  return RB_MODULES.map((module) => ({
    key: module.key,
    label: module.label,
    district: module.district || module.label,
    icon: module.icon,
    route: normalizePath(module.route),
    color: module.color,
    active: normalizePath(module.route) === current,
    xpAction: module.xpAction || null,
    storeLinked: Boolean(module.storeLinked),
    protected: Boolean(module.protected)
  }));
}

/* =========================
   ROUTE PREVIEW HELPERS
========================= */

export function previewRoute(value = "") {
  return resolveRoute(value);
}

export function routePathOnly(value = "") {
  const { pathname } = splitPathAndSearch(resolveRoute(value));
  return normalizePath(pathname);
}

/* =========================
   STARTUP
   Safe import only.
   Pages call bindGlobalNavigation() when ready.
========================= */

if (isBrowser() && !window.__RB_NAVIGATION_EVENTS_BOUND__) {
  window.__RB_NAVIGATION_EVENTS_BOUND__ = true;

  window.addEventListener("popstate", () => {
    updateActiveRoute();
    bindActiveNavigation();
  });

  window.addEventListener("pageshow", () => {
    updateActiveRoute();
    bindActiveNavigation();
  });
}

console.log("RB NAVIGATION READY");
