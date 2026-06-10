/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js

   INDEX CONTROL
   Portal City Home Screen

   Locked purpose:
   - route all data-route buttons
   - load auth/profile identity
   - paint profile avatar/name
   - paint XP/level/rank
   - paint live/online placeholders safely
   - connect portal/district clicks
   - no heavy page engines
========================= */

import RB_CONFIG from "/core/shared/rb-config.js";

import {
  bootAuth,
  getUser,
  getProfile,
  refreshProfile,
  rbSignOut
} from "/core/shared/rb-auth.js";

import {
  getProfileIdentity,
  bindProfileShell,
  buildProfileUrl
} from "/core/shared/rb-profile.js";

const DEFAULT_PROFILE_AVATAR =
  RB_CONFIG?.brandAssets?.defaultProfileAvatar ||
  "/images/brand/Avatar-hero-Banner.png.jpeg";

const DEFAULT_NAME = "Rich Bizness Elite";

let indexBooted = false;
let profileIdentity = null;

const quickRoutes = {
  home: RB_CONFIG?.routes?.home || "/",
  auth: RB_CONFIG?.routes?.auth || "/auth",

  feed: RB_CONFIG?.routes?.feed || "/feed",
  watch: RB_CONFIG?.routes?.watch || "/watch",
  live: RB_CONFIG?.routes?.live || "/live",
  music: RB_CONFIG?.routes?.music || "/music",
  podcast: RB_CONFIG?.routes?.podcast || "/podcast",
  radio: RB_CONFIG?.routes?.radio || "/radio",
  gaming: RB_CONFIG?.routes?.gaming || "/gaming",
  sports: RB_CONFIG?.routes?.sports || "/sports",
  gallery: RB_CONFIG?.routes?.gallery || "/gallery",
  store: RB_CONFIG?.routes?.store || "/store",
  upload: RB_CONFIG?.routes?.upload || "/upload",
  meta: RB_CONFIG?.routes?.meta || "/meta",

  avatar: RB_CONFIG?.routes?.avatar || "/avatar",
  profile: RB_CONFIG?.routes?.profile || "/profile",
  edit: RB_CONFIG?.routes?.edit || "/edit",
  settings: RB_CONFIG?.routes?.settings || "/settings",
  messages: RB_CONFIG?.routes?.messages || "/messages",
  notifications: RB_CONFIG?.routes?.notifications || "/notifications",
  alerts: RB_CONFIG?.routes?.notifications || "/notifications",

  creator: RB_CONFIG?.routes?.creator || "/creator",
  admin: RB_CONFIG?.routes?.admin || "/admin",

  secretDoor: RB_CONFIG?.routes?.secretDoor || "/rb-secret-door",
  secretMeta2: RB_CONFIG?.routes?.secretMeta2 || "/rb-secret-meta2",
  secretMeta3: RB_CONFIG?.routes?.secretMeta3 || "/rb-secret-meta3",

  search: RB_CONFIG?.routes?.search || "/feed"
};

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function cleanRoute(route) {
  const value = String(route || "/").trim();
  return value || "/";
}

function safeImage(value = "", fallback = DEFAULT_PROFILE_AVATAR) {
  const src = String(value || "").trim();

  if (!src || src.includes("project-avatar")) {
    return fallback;
  }

  if (
    src.startsWith("/") ||
    src.startsWith("https://") ||
    src.startsWith("http://") ||
    src.startsWith("blob:")
  ) {
    return src;
  }

  return fallback;
}

function goToRoute(route) {
  const nextRoute = cleanRoute(route);

  document.body.classList.add("rb-page-transition");

  window.setTimeout(() => {
    window.location.href = nextRoute;
  }, 180);
}

function goToSection(sectionKey) {
  const route =
    quickRoutes?.[sectionKey] ||
    RB_CONFIG?.routes?.[sectionKey];

  if (!route) {
    console.warn("[RB INDEX] Missing route:", sectionKey);
    return;
  }

  goToRoute(route);
}

function pulseButton(button) {
  if (!button) return;

  button.classList.add("is-active");

  window.setTimeout(() => {
    button.classList.remove("is-active");
  }, 260);
}

function getProfileName(profile, user) {
  return (
    profile?.display_name ||
    profile?.full_name ||
    profile?.username ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")?.[0] ||
    DEFAULT_NAME
  );
}

function getProfileAvatar(profile, user) {
  return safeImage(
    profile?.avatar_url ||
      profile?.profile_avatar_url ||
      profile?.photo_url ||
      user?.user_metadata?.avatar_url ||
      user?.user_metadata?.picture,
    DEFAULT_PROFILE_AVATAR
  );
}

/* =========================
   XP MODEL
========================= */

function getProfileXpModel(profile = {}, identity = {}) {
  const rawXp =
    profile?.xp ??
    profile?.rich_points ??
    profile?.points ??
    identity?.xp ??
    identity?.rich_points ??
    0;

  const rawLevel =
    profile?.rich_level ??
    profile?.level ??
    identity?.rich_level ??
    identity?.level ??
    1;

  const rank =
    profile?.rank_title ||
    profile?.rank ||
    identity?.rankTitle ||
    identity?.rank_title ||
    identity?.rank ||
    "Biz Legend";

  const xp = Math.max(0, Number(rawXp) || 0);
  const level = Math.max(1, Number(rawLevel) || 1);

  const levelBase = Math.max(0, (level - 1) * 1000);
  const nextLevel = level * 1000;
  const span = Math.max(1, nextLevel - levelBase);
  const currentIntoLevel = Math.max(0, xp - levelBase);
  const percent = Math.max(0, Math.min(100, (currentIntoLevel / span) * 100));
  const remaining = Math.max(0, nextLevel - xp);

  return {
    xp,
    level,
    rank,
    nextLevel,
    remaining,
    percent
  };
}

function paintText(selector, value) {
  $all(selector).forEach((el) => {
    el.textContent = value;
  });
}

function paintAvatar(selector, src, name) {
  $all(selector).forEach((el) => {
    const tag = el.tagName?.toLowerCase();

    if (tag === "img") {
      el.src = src;
      el.alt = name;
      el.dataset.lockedProfileSrc = src;
      return;
    }

    el.style.backgroundImage = `url("${src}")`;
  });
}

function renderIndexXpGauge() {
  const profile = getProfile?.() || {};
  profileIdentity = getProfileIdentity?.(profile) || profileIdentity || {};

  const model = getProfileXpModel(profile, profileIdentity);

  document.documentElement.style.setProperty(
    "--rb-xp-percent",
    `${model.percent}%`
  );

  document.body.dataset.rbXp = String(model.xp);
  document.body.dataset.rbLevel = String(model.level);
  document.body.dataset.rbRank = model.rank;
  document.body.dataset.rbXpPercent = String(Math.round(model.percent));

  paintText("[data-rb-xp]", model.xp.toLocaleString());
  paintText("[data-rb-xp-next]", model.nextLevel.toLocaleString());
  paintText("[data-rb-level]", String(model.level));
  paintText("[data-rb-rank]", model.rank);

  $all("[data-rb-xp-gauge-fill], .rb-xp-gauge-fill").forEach((fill) => {
    fill.style.width = `${model.percent}%`;
  });

  window.dispatchEvent(
    new CustomEvent("rb:xp-gauge-update", {
      detail: {
        route: "index",
        xp: model.xp,
        level: model.level,
        rank: model.rank,
        nextLevel: model.nextLevel,
        remaining: model.remaining,
        percent: model.percent
      }
    })
  );
}

/* =========================
   PROFILE / AVATAR PAINT
========================= */

function syncIndexProfileKeys() {
  const user = getUser?.() || null;
  const profile = getProfile?.() || null;

  profileIdentity = getProfileIdentity?.(profile) || null;

  document.body.dataset.rbPage = "index";
  document.body.dataset.rbRoute = "index";
  document.body.dataset.rbUserId = user?.id || "";
  document.body.dataset.rbProfileId = profileIdentity?.id || profile?.id || "";
  document.body.dataset.rbProfileLocked =
    profileIdentity?.id || profile?.id ? "true" : "false";

  bindProfileShell?.();

  const profileUrl =
    buildProfileUrl?.(profile) ||
    quickRoutes.profile ||
    "/profile";

  $all("[data-rb-profile-link]").forEach((el) => {
    el.href = profileUrl;
  });

  renderIndexXpGauge();
}

function updateProfileChip() {
  const user = getUser?.() || null;
  const profile = getProfile?.() || null;

  const authed = Boolean(user?.id);
  const name = authed ? getProfileName(profile, user) : "Tap In";
  const avatar = authed
    ? getProfileAvatar(profile, user)
    : DEFAULT_PROFILE_AVATAR;

  $all("[data-rb-name]").forEach((el) => {
    el.textContent = name;
  });

  paintAvatar("[data-rb-avatar]", avatar, name);
  paintAvatar("[data-rb-profile-avatar]", avatar, name);
  paintAvatar("[data-rb-current-avatar]", avatar, name);

  $all(".rb-profile-chip").forEach((chip) => {
    chip.dataset.route = authed ? "profile" : "auth";
    chip.classList.toggle("rb-profile-authed", authed);
  });

  syncIndexProfileKeys();
}

async function bootIndexAuth() {
  try {
    await bootAuth?.();

    if (getUser?.()?.id) {
      await refreshProfile?.();
    }

    updateProfileChip();
  } catch (error) {
    console.warn("[RB INDEX AUTH WARNING]", error?.message || error);
    updateProfileChip();
  }
}

/* =========================
   LIVE / ONLINE PLACEHOLDERS
========================= */

function setCounter(selector, value) {
  $all(selector).forEach((el) => {
    el.textContent = value;
  });
}

function renderIndexCounters() {
  const liveCount =
    window.RB_LIVE_COUNT ||
    document.body.dataset.rbLiveCount ||
    "1,248";

  const onlineCount =
    window.RB_ONLINE_COUNT ||
    document.body.dataset.rbOnlineCount ||
    "24,893";

  setCounter("[data-rb-live-count]", liveCount);
  setCounter("[data-rb-live-channels]", liveCount);
  setCounter("[data-rb-online-count]", onlineCount);
  setCounter("[data-rb-active-users]", onlineCount);
}

/* =========================
   ROUTE EVENTS
========================= */

function bindRouteClicks() {
  document.addEventListener("click", async (event) => {
    const target = event.target;
    const routeEl = target.closest("[data-route]");
    if (!routeEl) return;

    const routeKey = routeEl.dataset.route;

    if (!routeKey) return;

    if (routeKey === "logout") {
      event.preventDefault();
      await rbSignOut?.();
      goToRoute(quickRoutes.auth || "/auth");
      return;
    }

    const route =
      quickRoutes?.[routeKey] ||
      RB_CONFIG?.routes?.[routeKey];

    if (!route) {
      console.warn("[RB INDEX] Missing quick route:", routeKey);
      return;
    }

    event.preventDefault();
    pulseButton(routeEl);
    goToRoute(route);
  });
}

function bindPortalKeyboard() {
  $all("[role='button'][tabindex='0']").forEach((el) => {
    el.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();

      const routeKey = el.dataset.route;
      if (!routeKey) return;

      goToSection(routeKey);
    });
  });
}

function bindUniverseEvents() {
  window.addEventListener("rb:module-select", (event) => {
    const mod = event.detail;
    if (!mod?.key) return;

    goToSection(mod.key);
  });

  window.addEventListener("rb:profile-updated", updateProfileChip);
  window.addEventListener("rb:app-identity-refreshed", updateProfileChip);

  window.addEventListener("rb:rich-action", () => {
    renderIndexXpGauge();
  });

  window.addEventListener("rb:live-count-update", (event) => {
    if (event?.detail?.liveCount != null) {
      document.body.dataset.rbLiveCount = String(event.detail.liveCount);
    }

    if (event?.detail?.onlineCount != null) {
      document.body.dataset.rbOnlineCount = String(event.detail.onlineCount);
    }

    renderIndexCounters();
  });

  window.addEventListener("focus", async () => {
    if (getUser?.()?.id) {
      await refreshProfile?.();
    }

    updateProfileChip();
    renderIndexCounters();
  });
}

/* =========================
   VIEWPORT
========================= */

function updateViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--rb-vh", `${vh}px`);
}

function revealHubUI() {
  document.body.classList.add("rb-loaded");

  window.requestAnimationFrame(() => {
    document.body.classList.add("rb-index-ready");
  });
}

/* =========================
   BOOT
========================= */

async function bootIndexPage() {
  if (indexBooted) return;

  indexBooted = true;

  updateViewportHeight();
  bindRouteClicks();
  bindPortalKeyboard();
  bindUniverseEvents();
  renderIndexCounters();
  revealHubUI();

  await bootIndexAuth();

  document.body.dataset.rbPage = "index";
  document.body.dataset.rbRoute = "index";
  document.body.dataset.rbProfileLock =
    profileIdentity?.id ? "true" : "false";

  console.log("RB INDEX PORTAL CITY READY", {
    profileLocked: Boolean(profileIdentity?.id),
    route: "index",
    xpGauge: true,
    cinematicHubOnly: true
  });
}

window.RB_GO = goToSection;
window.RB_ROUTE = goToRoute;
window.RB_UPDATE_PROFILE_CHIP = updateProfileChip;
window.RB_UPDATE_INDEX_XP = renderIndexXpGauge;
window.RB_UPDATE_INDEX_COUNTERS = renderIndexCounters;

window.addEventListener("resize", updateViewportHeight, { passive: true });
window.addEventListener("orientationchange", updateViewportHeight, {
  passive: true
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootIndexPage);
} else {
  bootIndexPage();
}
