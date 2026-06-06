/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js

   INDEX CONTROL + AUTH PROFILE CHIP
   One Identity Image Source Only
========================= */

import RB_CONFIG from "/core/shared/rb-config.js";

import {
  bootAuth,
  getUser,
  getProfile,
  refreshProfile,
  rbSignOut
} from "/core/shared/rb-auth.js";

const DEFAULT_PROFILE_AVATAR =
  RB_CONFIG.brandAssets?.defaultProfileAvatar ||
  "/images/brand/Avatar-hero-Banner.png.jpeg";

let indexBooted = false;
let profileChipPainted = false;

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
  return (
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    DEFAULT_PROFILE_AVATAR
  );
}

function setChipImage(img, src, alt) {
  if (!img || !src) return;

  if (img.dataset.lockedProfileSrc === src) return;

  img.dataset.lockedProfileSrc = src;
  img.src = src;
  img.alt = alt || "Profile";
}

function updateProfileChip() {
  const chip = document.querySelector(".rb-profile-chip");
  if (!chip) return;

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

async function bootIndexPage() {
  if (indexBooted) return;

  indexBooted = true;

  updateViewportHeight();
  bindRouteClicks();
  bindUniverseEvents();
  revealHubUI();

  await bootIndexAuth();

  document.body.classList.add("rb-index-ready");

  console.log("RB INDEX HUB READY");
}

window.RB_GO = goToSection;
window.RB_ROUTE = goToRoute;
window.RB_UPDATE_PROFILE_CHIP = updateProfileChip;

window.addEventListener("resize", updateViewportHeight, { passive: true });
window.addEventListener("orientationchange", updateViewportHeight, { passive: true });

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootIndexPage);
} else {
  bootIndexPage();
}
