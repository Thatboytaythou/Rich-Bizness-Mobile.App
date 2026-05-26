import RB_CONFIG from "/core/shared/rb-config.js";

import {
  bootAuth,
  getUser,
  getProfile,
  refreshProfile,
  rbSignOut
} from "/core/shared/rb-auth.js";

/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js

   INDEX CONTROL + AUTH PROFILE CHIP
   Locked to 1-8 Hub Stack
========================= */

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";

let indexBooted = false;

const quickRoutes = {
  profile: RB_CONFIG.routes.profile,
  admin: RB_CONFIG.routes.admin || "/admin",
  creator: RB_CONFIG.routes.creator || "/creator",
  watch: RB_CONFIG.routes.watch,
  alerts: RB_CONFIG.routes.notifications,
  notifications: RB_CONFIG.routes.notifications,
  settings: RB_CONFIG.routes.settings,
  edit: RB_CONFIG.routes.edit,
  messages: RB_CONFIG.routes.messages,
  auth: RB_CONFIG.routes.auth || "/auth"
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
  const route = RB_CONFIG.routes?.[sectionKey] || quickRoutes[sectionKey];

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
    DEFAULT_AVATAR
  );
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

    if (img) {
      img.src = DEFAULT_AVATAR;
      img.alt = "Sign in";
    }

    if (label) {
      label.textContent = "Sign In";
    }

    return;
  }

  chip.dataset.route = "profile";
  chip.classList.add("rb-profile-authed");

  if (img) {
    img.src = getProfileAvatar(profile, user);
    img.alt = getProfileName(profile, user);
  }

  if (label) {
    label.textContent = getProfileName(profile, user);
  }
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
    updateProfileChip();
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

    const route = quickRoutes[routeKey] || RB_CONFIG.routes?.[routeKey];

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
  window.addEventListener("focus", updateProfileChip);
}

function revealHubUI() {
  document.body.classList.add("rb-loaded");

  const profileChip = document.querySelector(".rb-profile-chip");
  if (profileChip) profileChip.classList.add("is-visible");

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
