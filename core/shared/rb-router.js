/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-router.js

   ROUTER CORE
   FINAL LOCKED VERSION
   Synced with rb-navigation.js
========================= */

import {
  RB_ROUTES,
  RB_PROFILE_KEYS
} from "/core/shared/rb-config.js";

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

export function resolveRoute(route = "/") {
  const raw = String(route || "").trim();

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

  if (RB_ROUTES?.[raw] && typeof RB_ROUTES[raw] === "string") {
    return normalizePath(RB_ROUTES[raw]);
  }

  if (RB_PROFILE_KEYS?.secretRoutes?.[raw]) {
    return normalizePath(RB_PROFILE_KEYS.secretRoutes[raw]);
  }

  return normalizePath(`/${raw}`);
}

export function goTo(route = "/") {
  const resolved = resolveRoute(route);

  window.dispatchEvent(
    new CustomEvent("rb:route-before-change", {
      detail: {
        from: normalizePath(window.location.pathname),
        to: resolved
      }
    })
  );

  window.location.href = resolved;
}

export function replaceTo(route = "/") {
  window.location.replace(resolveRoute(route));
}

export function reloadPage() {
  window.location.reload();
}

export function goBack() {
  window.history.back();
}

export function openExternal(url = "") {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

export function getAllQueryParams() {
  return Object.fromEntries(
    new URLSearchParams(window.location.search)
  );
}

export function setQueryParam(key, value) {
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

  window.history.replaceState({}, "", url.toString());

  window.dispatchEvent(
    new CustomEvent("rb:route-query-change", {
      detail: getAllQueryParams()
    })
  );

  return url.toString();
}

export function removeQueryParam(key) {
  const url = new URL(window.location.href);
  url.searchParams.delete(key);
  window.history.replaceState({}, "", url.toString());

  window.dispatchEvent(
    new CustomEvent("rb:route-query-change", {
      detail: getAllQueryParams()
    })
  );

  return url.toString();
}

export function clearQueryParams() {
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url.toString());

  window.dispatchEvent(
    new CustomEvent("rb:route-query-change", {
      detail: {}
    })
  );

  return url.toString();
}

export function getWatchUrl(slug = "") {
  if (!slug) return RB_ROUTES.watch;
  return `${RB_ROUTES.watch}?stream=${encodeURIComponent(slug)}`;
}

export function getProfileUrl(username = "") {
  if (!username) return RB_ROUTES.profile;
  return `${RB_ROUTES.profile}?u=${encodeURIComponent(username)}`;
}

export function getProfileIdUrl(userId = "") {
  if (!userId) return RB_ROUTES.profile;
  return `${RB_ROUTES.profile}?id=${encodeURIComponent(userId)}`;
}

export function getEditUrl(userId = "") {
  if (!userId) return RB_ROUTES.edit;
  return `${RB_ROUTES.edit}?id=${encodeURIComponent(userId)}`;
}

export function getMessageThreadUrl(threadId = "") {
  if (!threadId) return RB_ROUTES.messages;
  return `${RB_ROUTES.messages}?thread=${encodeURIComponent(threadId)}`;
}

export function getLiveUrl(streamId = "") {
  if (!streamId) return RB_ROUTES.live;
  return `${RB_ROUTES.live}?stream=${encodeURIComponent(streamId)}`;
}

export function getUploadUrl(section = "") {
  if (!section) return RB_ROUTES.upload;
  return `${RB_ROUTES.upload}?section=${encodeURIComponent(section)}`;
}

export function getGameUrl(slug = "") {
  if (!slug) return RB_ROUTES.gaming;
  return `/games/${encodeURIComponent(slug)}`;
}

export function getChessUrl() {
  return RB_ROUTES.games?.richChess || "/games/rich-chess";
}

export function getMoneyRoadRunnerUrl() {
  return RB_ROUTES.games?.moneyRoadRunner || "/games/money-road-runner";
}

export function getSmokeCityHustleUrl() {
  return RB_ROUTES.games?.smokeCityHustle || "/games/smoke-city-hustle";
}

export function getStudioShowdownUrl() {
  return RB_ROUTES.games?.studioShowdown || "/games/studio-showdown";
}

export function getCurrentPath() {
  return normalizePath(window.location.pathname);
}

export function getCurrentPage() {
  const path = getCurrentPath();

  if (path === "/") return "index";

  return path
    .split("/")
    .filter(Boolean)
    .pop()
    ?.replace(".html", "") || "index";
}

export function isPage(page = "") {
  return getCurrentPage() === String(page).replace(".html", "").replace("/", "");
}

export function getHash() {
  return window.location.hash.replace("#", "");
}

export function setHash(hash = "") {
  window.location.hash = hash;
}

export function clearHash() {
  history.pushState(
    "",
    document.title,
    window.location.pathname + window.location.search
  );
}

export function scrollTopSmooth() {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

export function scrollBottomSmooth() {
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth"
  });
}

export const RB_ROUTE_ACCESS = Object.freeze({
  public: [
    "/",
    "/auth",
    "/feed",
    "/watch",
    "/live",
    "/music",
    "/podcast",
    "/radio",
    "/gaming",
    "/sports",
    "/gallery",
    "/store",
    "/meta",
    "/avatar"
  ],

  protected: [
    "/upload",
    "/messages",
    "/notifications",
    "/profile",
    "/edit",
    "/settings"
  ],

  creator: [
    "/creator"
  ],

  seller: [
    "/store/manage",
    "/seller"
  ],

  artist: [
    "/artist",
    "/artist/upload",
    "/artist/manage",
    "/artist/analytics"
  ],

  admin: [
    "/admin"
  ],

  secret: [
    "/rb-secret-door",
    "/rb-secret-meta2",
    "/rb-secret-meta3"
  ]
});

function inRouteList(list = [], path = getCurrentPath()) {
  const current = normalizePath(path);

  return list.some((route) => {
    const normalized = normalizePath(route);
    return normalized === current;
  });
}

export function isProtectedRoute(path = getCurrentPath()) {
  return (
    inRouteList(RB_ROUTE_ACCESS.protected, path) ||
    inRouteList(RB_ROUTE_ACCESS.creator, path) ||
    inRouteList(RB_ROUTE_ACCESS.seller, path) ||
    inRouteList(RB_ROUTE_ACCESS.artist, path) ||
    inRouteList(RB_ROUTE_ACCESS.admin, path) ||
    inRouteList(RB_ROUTE_ACCESS.secret, path)
  );
}

export function isPublicRoute(path = getCurrentPath()) {
  return inRouteList(RB_ROUTE_ACCESS.public, path);
}

export function isCreatorRoute(path = getCurrentPath()) {
  return inRouteList(RB_ROUTE_ACCESS.creator, path);
}

export function isSellerRoute(path = getCurrentPath()) {
  return inRouteList(RB_ROUTE_ACCESS.seller, path);
}

export function isArtistRoute(path = getCurrentPath()) {
  return inRouteList(RB_ROUTE_ACCESS.artist, path);
}

export function isAdminRoute(path = getCurrentPath()) {
  return inRouteList(RB_ROUTE_ACCESS.admin, path);
}

export function isSecretRoute(path = getCurrentPath()) {
  return inRouteList(RB_ROUTE_ACCESS.secret, path);
}

export function safeRedirect(route, delay = 0) {
  window.setTimeout(() => {
    goTo(route);
  }, delay);
}

export function preloadRoute(route = "") {
  if (!route) return;

  const resolved = resolveRoute(route);

  if (
    resolved.startsWith("http://") ||
    resolved.startsWith("https://") ||
    resolved.startsWith("#")
  ) {
    return;
  }

  const exists = document.querySelector(
    `link[rel="prefetch"][href="${resolved}"]`
  );

  if (exists) return;

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = resolved;

  document.head.appendChild(link);
}

export function preloadCoreRoutes() {
  [
    RB_ROUTES.feed,
    RB_ROUTES.watch,
    RB_ROUTES.live,
    RB_ROUTES.music,
    RB_ROUTES.gaming,
    RB_ROUTES.profile
  ].filter(Boolean).forEach(preloadRoute);
}

console.log("RB ROUTER READY");
