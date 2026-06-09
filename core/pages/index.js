/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js

   INDEX CONTROL + AUTH PROFILE CHIP
   One Identity Image Source Only
   XP Gauge Enabled
   Cinematic Hub Only — No Heavy Page Engines
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
  RB_CONFIG.brandAssets?.defaultProfileAvatar ||
  "/images/brand/Avatar-hero-Banner.png.jpeg";

let indexBooted = false;
let profileChipPainted = false;
let profileIdentity = null;

const quickRoutes = {
  home: RB_CONFIG.routes.home || "/",
  auth: RB_CONFIG.routes.auth || "/auth",

  feed: RB_CONFIG.routes.feed,
  watch: RB_CONFIG.routes.watch,
  live: RB_CONFIG.routes.live,
  music: RB_CONFIG.routes.music,
  podcast: RB_CONFIG.routes.podcast,
  radio: RB_CONFIG.routes.radio,
  gaming: RB_CONFIG.routes.gaming,
  sports: RB_CONFIG.routes.sports,
  gallery: RB_CONFIG.routes.gallery,
  store: RB_CONFIG.routes.store,
  upload: RB_CONFIG.routes.upload,
  meta: RB_CONFIG.routes.meta,
  avatar: RB_CONFIG.routes.avatar,

  profile: RB_CONFIG.routes.profile,
  edit: RB_CONFIG.routes.edit,
  settings: RB_CONFIG.routes.settings,
  messages: RB_CONFIG.routes.messages,
  notifications: RB_CONFIG.routes.notifications,
  alerts: RB_CONFIG.routes.notifications,

  creator: RB_CONFIG.routes.creator || "/creator",
  admin: RB_CONFIG.routes.admin || "/admin",

  secretDoor: RB_CONFIG.routes.secretDoor,
  secretMeta2: RB_CONFIG.routes.secretMeta2,
  secretMeta3: RB_CONFIG.routes.secretMeta3
};

function cleanRoute(route) {
  return route || "/";
}

function safeImage(value = "", fallback = DEFAULT_PROFILE_AVATAR) {
  const src = String(value || "").trim();

  if (!src || src.includes("project-avatar")) return fallback;

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
    RB_CONFIG.routes?.[sectionKey] ||
    quickRoutes[sectionKey];

  if (!route) {
    console.warn("[RB INDEX] Missing route:", sectionKey);
    return;
  }

  goToRoute(route);
}

function getProfileName(profile, user) {
  return (
    profile?.display_name ||
    profile?.full_name ||
    profile?.username ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Profile"
  );
}

function getProfileAvatar(profile, user) {
  return safeImage(
    profile?.avatar_url ||
      user?.user_metadata?.avatar_url ||
      user?.user_metadata?.picture,
    DEFAULT_PROFILE_AVATAR
  );
}

/* =========================
   XP GAUGE
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

function renderIndexXpGauge() {
  const profile = getProfile();
  profileIdentity = getProfileIdentity?.(profile) || profileIdentity || null;

  const model = getProfileXpModel(profile, profileIdentity);

  const gauge = document.getElementById("index-xp-gauge");
  const fill = document.getElementById("index-xp-gauge-fill");
  const text = document.getElementById("index-xp-gauge-text");
  const next = document.getElementById("index-xp-gauge-next");
  const level = document.getElementById("index-xp-level");
  const rank = document.getElementById("index-xp-rank");

  if (gauge) {
    gauge.dataset.level = String(model.level);
    gauge.dataset.rank = model.rank;
    gauge.dataset.xp = String(model.xp);
  }

  if (fill) {
    fill.style.width = `${model.percent}%`;
  }

  if (text) {
    text.textContent = `${model.xp.toLocaleString()} XP`;
  }

  if (next) {
    next.textContent = `${model.remaining.toLocaleString()} XP TO LVL ${model.level + 1}`;
  }

  if (level) {
    level.textContent = `LVL ${model.level}`;
  }

  if (rank) {
    rank.textContent = model.rank;
  }

  document.body.dataset.rbXp = String(model.xp);
  document.body.dataset.rbLevel = String(model.level);
  document.body.dataset.rbRank = model.rank;
  document.body.dataset.rbXpPercent = String(Math.round(model.percent));

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
   PROFILE CHIP
========================= */

function setChipImage(img, src, alt) {
  if (!img || !src) return;

  const finalSrc = safeImage(src, DEFAULT_PROFILE_AVATAR);

  if (img.dataset.lockedProfileSrc === finalSrc) return;

  img.dataset.lockedProfileSrc = finalSrc;
  img.src = finalSrc;
  img.alt = alt || "Profile";
}

function syncIndexProfileKeys() {
  const user = getUser();
  const profile = getProfile();

  profileIdentity = getProfileIdentity?.(profile) || null;

  document.body.dataset.rbPage = "index";
  document.body.dataset.rbRoute = "index";
  document.body.dataset.rbUserId = user?.id || "";
  document.body.dataset.rbProfileId = profileIdentity?.id || "";
  document.body.dataset.rbProfileLocked = profileIdentity?.id ? "true" : "false";

  bindProfileShell?.();

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl?.(profile) || quickRoutes.profile || "/profile";
  });

  document.querySelectorAll("[data-rb-current-avatar]").forEach((el) => {
    const avatar = getProfileAvatar(profile, user);
    const name = getProfileName(profile, user);

    if (el.tagName === "IMG") {
      el.src = avatar;
      el.alt = name;
    } else {
      el.style.backgroundImage = `url("${avatar}")`;
    }
  });

  renderIndexXpGauge();
}

function updateProfileChip() {
  const chip = document.querySelector(".rb-profile-chip");
  if (!chip) {
    syncIndexProfileKeys();
    return;
  }

  const img = chip.querySelector("img");
  const label = chip.querySelector("span");

  const user = getUser();
  const profile = getProfile();

  if (!user?.id) {
    chip.dataset.route = "auth";
    chip.classList.remove("rb-profile-authed");

    setChipImage(img, DEFAULT_PROFILE_AVATAR, "Sign in");

    if (label) {
      label.textContent = "Tap In";
    }

    profileChipPainted = true;
    syncIndexProfileKeys();
    return;
  }

  const name = getProfileName(profile, user);
  const avatar = getProfileAvatar(profile, user);

  chip.dataset.route = "profile";
  chip.classList.add("rb-profile-authed");

  setChipImage(img, avatar, name);

  if (label) {
    label.textContent = name;
  }

  profileChipPainted = true;
  syncIndexProfileKeys();
}

async function bootIndexAuth() {
  try {
    await bootAuth();

    if (getUser()?.id) {
      await refreshProfile();
    }

    updateProfileChip();
  } catch (error) {
    console.warn("[RB INDEX AUTH WARNING]", error?.message || error);

    if (!profileChipPainted) {
      updateProfileChip();
    }
  }
}

/* =========================
   ROUTES + EVENTS
========================= */

function pulseButton(button) {
  if (!button) return;

  button.classList.add("is-active");

  window.setTimeout(() => {
    button.classList.remove("is-active");
  }, 220);
}

function bindRouteClicks() {
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-route]");
    if (!button) return;

    const routeKey = button.dataset.route;

    if (routeKey === "logout") {
      await rbSignOut();
      return;
    }

    const route =
      quickRoutes[routeKey] ||
      RB_CONFIG.routes?.[routeKey];

    if (!route) {
      console.warn("[RB INDEX] Missing quick route:", routeKey);
      return;
    }

    pulseButton(button);
    goToRoute(route);
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

  window.addEventListener("focus", async () => {
    if (getUser()?.id) {
      await refreshProfile();
    }

    updateProfileChip();
  });
}

function revealHubUI() {
  document.body.classList.add("rb-loaded");

  const profileChip = document.querySelector(".rb-profile-chip");
  if (profileChip) {
    profileChip.classList.add("is-visible");
  }

  document.querySelectorAll(".rb-side-tabs button").forEach((tab, index) => {
    window.setTimeout(() => {
      tab.classList.add("is-visible");
    }, 100 + index * 70);
  });
}

function updateViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--rb-vh", `${vh}px`);
}

/* =========================
   BOOT
========================= */

async function bootIndexPage() {
  if (indexBooted) return;

  indexBooted = true;

  updateViewportHeight();
  bindRouteClicks();
  bindUniverseEvents();
  revealHubUI();

  await bootIndexAuth();

  document.body.dataset.rbPage = "index";
  document.body.dataset.rbRoute = "index";
  document.body.dataset.rbProfileLock = profileIdentity?.id ? "true" : "false";
  document.body.classList.add("rb-index-ready");

  console.log("RB INDEX HUB READY", {
    profileLocked: !!profileIdentity?.id,
    route: "index",
    xpGauge: true,
    cinematicHubOnly: true
  });
}

window.RB_GO = goToSection;
window.RB_ROUTE = goToRoute;
window.RB_UPDATE_PROFILE_CHIP = updateProfileChip;
window.RB_UPDATE_INDEX_XP = renderIndexXpGauge;

window.addEventListener("resize", updateViewportHeight, { passive: true });
window.addEventListener("orientationchange", updateViewportHeight, { passive: true });

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootIndexPage);
} else {
  bootIndexPage();
}
