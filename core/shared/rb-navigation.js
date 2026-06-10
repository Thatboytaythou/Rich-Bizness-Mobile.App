/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-navigation.js

   GLOBAL NAVIGATION ENGINE

   Locked purpose:
   - resolve route keys
   - support data-route buttons
   - support href links
   - support query strings
   - protect secret routes
   - update active states
   - keep Index/Profile/Meta path clean

   Supports:
   - data-route="profile"
   - data-route="/profile"
   - data-route="upload?section=music"
   - data-route="/upload?section=music"
   - href="/profile"
   - href="/upload?section=music"

   Does not hijack:
   - external links
   - hash links
   - mail/tel/sms links
   - target="_blank"
   - downloads
   - data-nav-ignore="true"
========================= */

import {
  RB_MODULES = [],
  RB_ROUTES = {},
  RB_PROFILE_KEYS = {}
} from "/core/shared/rb-config.js";

import {
  getProfile
} from "/core/shared/rb-supabase.js";

const SAFE_PAGE_ROUTES = Object.freeze({
  home: "/",
  portal: "/",
  index: "/",

  auth: "/auth",
  login: "/auth",
  signup: "/auth",

  feed: "/feed",
  live: "/live",
  watch: "/watch",

  music: "/music",
  podcast: "/podcast",
  radio: "/radio",

  gaming: "/gaming",
  games: "/gaming",
  sports: "/sports",
  gallery: "/gallery",

  upload: "/upload",
  store: "/store",
  meta: "/meta",

  avatar: "/avatar",
  profile: "/profile",
  edit: "/edit",
  settings: "/settings",

  messages: "/messages",
  inbox: "/messages",
  notifications: "/notifications",
  alerts: "/notifications",

  admin: "/admin",
  creator: "/creator",

  search: "/feed",
  monetization: "/store",
  xp: "/profile",

  secretDoor: "/rb-secret-door",
  secretMeta2: "/rb-secret-meta2",
  secretMeta3: "/rb-secret-meta3",

  "rb-secret-door": "/rb-secret-door",
  "rb-secret-meta2": "/rb-secret-meta2",
  "rb-secret-meta3": "/rb-secret-meta3",

  "games/rich-chess": "/games/rich-chess",
  "games/money-road-runner": "/games/money-road-runner",
  "games/smoke-city-hustle": "/games/smoke-city-hustle",
  "games/studio-showdown": "/games/studio-showdown"
});

let activeRoute = normalizePath(window.location.pathname || "/");
let activeModule = null;

/* =========================
   NORMALIZE
========================= */

function splitPathAndSearch(value = "") {
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

export function normalizePath(path = "") {
  if (!path) return "/";

  const { pathname } = splitPathAndSearch(path);

  const clean = String(pathname || "/")
    .trim()
    .replace(window.location.origin, "")
    .replace(/\/index\.html$/, "/")
    .replace(/\.html$/, "")
    .replace(/\/+$/, "");

  return clean || "/";
}

export function normalizeRoute(path = "") {
  if (!path) return "/";

  const raw = String(path || "").trim();

  if (!raw) return "/";

  const { pathname, search, hash } = splitPathAndSearch(raw);
  const cleanPath = normalizePath(pathname);

  return `${cleanPath}${search || ""}${hash || ""}` || "/";
}

function getRouteKey(rawValue = "") {
  const raw = String(rawValue || "").trim();

  const { pathname } = splitPathAndSearch(raw);

  return String(pathname || raw)
    .trim()
    .replace(window.location.origin, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.html$/, "");
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
    raw.startsWith("javascript:") ||
    (
      (raw.startsWith("http://") || raw.startsWith("https://")) &&
      !raw.startsWith(window.location.origin)
    )
  );
}

export function resolveRoute(value = "") {
  const raw = String(value || "").trim();

  if (!raw) return "/";

  if (
    raw.startsWith("#") ||
    raw.startsWith("mailto:") ||
    raw.startsWith("tel:") ||
    raw.startsWith("sms:") ||
    raw.startsWith("javascript:")
  ) {
    return raw;
  }

  if (
    (raw.startsWith("http://") || raw.startsWith("https://")) &&
    !raw.startsWith(window.location.origin)
  ) {
    return raw;
  }

  const { search, hash } = splitPathAndSearch(raw);
  const key = getRouteKey(raw);

  if (raw.startsWith("/")) {
    return normalizeRoute(raw);
  }

  if (SAFE_PAGE_ROUTES[key]) {
    return normalizeRoute(`${SAFE_PAGE_ROUTES[key]}${search || ""}${hash || ""}`);
  }

  if (RB_ROUTES?.[key]) {
    const route = RB_ROUTES[key];

    if (typeof route === "string") {
      return normalizeRoute(`${route}${search || ""}${hash || ""}`);
    }
  }

  const module = getModule(key);

  if (module?.route) {
    return normalizeRoute(`${module.route}${search || ""}${hash || ""}`);
  }

  const secretRoute = RB_PROFILE_KEYS?.secretRoutes?.[key];

  if (secretRoute) {
    return normalizeRoute(`${secretRoute}${search || ""}${hash || ""}`);
  }

  return normalizeRoute(`/${key}${search || ""}${hash || ""}`);
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
  const resolved = normalizePath(resolveRoute(route));

  if (
    Object.values(SAFE_PAGE_ROUTES).some(
      (value) => normalizePath(value) === resolved
    )
  ) {
    return true;
  }

  return Object.values(RB_ROUTES || {}).some((value) => {
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
  return Array.isArray(RB_MODULES) &&
    RB_MODULES.some((module) => module.key === key);
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
  return getModuleByRoute(window.location.pathname);
}

/* =========================
   SECRET ROUTES
========================= */

export function isSecretRoute(route = "") {
  const resolved = normalizePath(resolveRoute(route));
  const secrets = RB_PROFILE_KEYS?.secretRoutes || {};

  return Object.values(secrets).some(
    (secret) => normalizePath(secret) === resolved
  );
}

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

    window.dispatchEvent(
      new CustomEvent("rb:secret-route-blocked", {
        detail: {
          route: resolved
        }
      })
    );

    return false;
  }

  window.dispatchEvent(
    new CustomEvent("rb:route-before-change", {
      detail: {
        from: normalizeRoute(
          window.location.pathname +
            window.location.search +
            window.location.hash
        ),
        to: resolved
      }
    })
  );

  window.location.assign(resolved);
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
  updateActiveRoute();
  bindNavigation(options);
  bindActiveNavigation(options);

  document.body?.classList.add("rb-navigation-bound");

  window.dispatchEvent(
    new CustomEvent("rb:navigation-bound", {
      detail: {
        route: activeRoute,
        module: activeModule
      }
    })
  );
}

/* =========================
   MODULE MENU
========================= */

export function buildModuleMenu() {
  const current = normalizePath(window.location.pathname);

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
   STARTUP
========================= */

window.addEventListener("popstate", () => {
  updateActiveRoute();
  bindActiveNavigation();
});

window.addEventListener("pageshow", () => {
  updateActiveRoute();
  bindActiveNavigation();
});

updateActiveRoute();

console.log("RB NAVIGATION READY");
