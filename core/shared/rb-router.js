/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-router.js

   ROUTER + PROTECTION CORE
   FINAL LOCKED VERSION
========================= */

import { RB_ROUTES } from "/core/shared/rb-config.js";

export function goTo(route = "/") {
  window.location.href = route;
}

export function replaceTo(route = "/") {
  window.location.replace(route);
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
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

export function setQueryParam(key, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.replaceState({}, "", url);
}

export function removeQueryParam(key) {
  const url = new URL(window.location.href);
  url.searchParams.delete(key);
  window.history.replaceState({}, "", url);
}

export function clearQueryParams() {
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, "", url);
}

export function getWatchUrl(slug = "") {
  if (!slug) return RB_ROUTES.watch;
  return `${RB_ROUTES.watch}?stream=${encodeURIComponent(slug)}`;
}

export function getProfileUrl(username = "") {
  if (!username) return RB_ROUTES.profile;
  return `${RB_ROUTES.profile}?user=${encodeURIComponent(username)}`;
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
  return `/games/${slug}`;
}

export function getChessUrl() {
  return RB_ROUTES.games.richChess;
}

export function getMoneyRoadRunnerUrl() {
  return RB_ROUTES.games.moneyRoadRunner;
}

export function getSmokeCityHustleUrl() {
  return RB_ROUTES.games.smokeCityHustle;
}

export function getStudioShowdownUrl() {
  return RB_ROUTES.games.studioShowdown;
}

export function getCurrentPath() {
  return window.location.pathname;
}

export function getCurrentPage() {
  const path = getCurrentPath();

  if (path === "/") return "index";

  return path
    .split("/")
    .pop()
    .replace(".html", "");
}

export function isPage(page = "") {
  return getCurrentPage() === page.replace(".html", "");
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
    "/auth.html",

    "/feed",
    "/feed.html",

    "/watch",
    "/watch.html",

    "/live",
    "/live.html",

    "/music",
    "/music.html",

    "/gaming",
    "/gaming.html",

    "/sports",
    "/sports.html",

    "/gallery",
    "/gallery.html",

    "/store",
    "/store.html",

    "/meta",
    "/meta.html"
  ],

  protected: [
    "/upload",
    "/upload.html",

    "/messages",
    "/messages.html",

    "/notifications",
    "/notifications.html",

    "/profile",
    "/profile.html",

    "/edit",
    "/edit.html",

    "/settings",
    "/settings.html"
  ],

  creator: [
    "/live",
    "/live.html",

    "/upload",
    "/upload.html"
  ],

  seller: [
    "/store",
    "/store.html"
  ],

  artist: [
    "/music",
    "/music.html"
  ]
});

export function isProtectedRoute(path = getCurrentPath()) {
  return RB_ROUTE_ACCESS.protected.includes(path);
}

export function isPublicRoute(path = getCurrentPath()) {
  return RB_ROUTE_ACCESS.public.includes(path);
}

export function isCreatorRoute(path = getCurrentPath()) {
  return RB_ROUTE_ACCESS.creator.includes(path);
}

export function isSellerRoute(path = getCurrentPath()) {
  return RB_ROUTE_ACCESS.seller.includes(path);
}

export function isArtistRoute(path = getCurrentPath()) {
  return RB_ROUTE_ACCESS.artist.includes(path);
}

export function safeRedirect(route, delay = 0) {
  window.setTimeout(() => {
    goTo(route);
  }, delay);
}

export function preloadRoute(route = "") {
  if (!route) return;

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = route;

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
  ].forEach(preloadRoute);
}

console.log("RB ROUTER READY");
