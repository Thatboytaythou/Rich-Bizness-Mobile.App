/* =========================
   RICH BIZNESS ROUTER CORE
   /core/shared/rb-router.js
========================= */

/* =========================
   ROUTE MAP
========================= */
export const RB_ROUTES = {
  home: "/",
  auth: "/auth.html",

  feed: "/feed.html",
  watch: "/watch.html",
  live: "/live.html",

  music: "/music.html",
  gaming: "/gaming.html",
  sports: "/sports.html",

  gallery: "/gallery.html",
  store: "/store.html",
  meta: "/meta.html",

  upload: "/upload.html",

  messages: "/messages.html",
  notifications: "/notifications.html",

  profile: "/profile.html",
  edit: "/edit.html",
  settings: "/settings.html"
};

/* =========================
   NAVIGATE
========================= */
export function goTo(route = "/") {
  window.location.href = route;
}

/* =========================
   RELOAD
========================= */
export function reloadPage() {
  window.location.reload();
}

/* =========================
   BACK
========================= */
export function goBack() {
  window.history.back();
}

/* =========================
   OPEN NEW TAB
========================= */
export function openExternal(url = "") {
  if (!url) return;

  window.open(url, "_blank");
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

/* =========================
   SET QUERY PARAM
========================= */
export function setQueryParam(
  key,
  value
) {
  const url = new URL(window.location);

  url.searchParams.set(key, value);

  window.history.replaceState(
    {},
    "",
    url
  );
}

/* =========================
   REMOVE QUERY PARAM
========================= */
export function removeQueryParam(key) {
  const url = new URL(window.location);

  url.searchParams.delete(key);

  window.history.replaceState(
    {},
    "",
    url
  );
}

/* =========================
   STREAM URL
========================= */
export function getWatchUrl(slug = "") {
  return `/watch.html?slug=${slug}`;
}

/* =========================
   PROFILE URL
========================= */
export function getProfileUrl(
  username = ""
) {
  return `/profile.html?user=${username}`;
}

/* =========================
   EDIT URL
========================= */
export function getEditUrl(
  userId = ""
) {
  return `/edit.html?id=${userId}`;
}

/* =========================
   ACTIVE PAGE
========================= */
export function getCurrentPage() {
  const path = window.location.pathname;

  return path.split("/").pop();
}

/* =========================
   PAGE CHECK
========================= */
export function isPage(page = "") {
  return getCurrentPage() === page;
}

/* =========================
   HASH
========================= */
export function getHash() {
  return window.location.hash.replace(
    "#",
    ""
  );
}

/* =========================
   SCROLL TOP
========================= */
export function scrollTopSmooth() {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =========================
   SAFE REDIRECT
========================= */
export function safeRedirect(
  route,
  delay = 0
) {
  setTimeout(() => {
    goTo(route);
  }, delay);
}
