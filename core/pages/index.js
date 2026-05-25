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
========================= */

const DEFAULT_AVATAR = "/images/brand/project-avatar.png.jpeg";

const quickRoutes = {
  profile: RB_CONFIG.routes.profile,
  admin: "/admin",
  creator: "/creator",
  watch: RB_CONFIG.routes.watch,
  alerts: RB_CONFIG.routes.notifications,
  notifications: RB_CONFIG.routes.notifications,
  settings: RB_CONFIG.routes.settings,
  edit: RB_CONFIG.routes.edit,
  messages: RB_CONFIG.routes.messages,
};

function goToRoute(route) {
  if (!route) return;

  document.body.classList.add("rb-page-transition");

  setTimeout(() => {
    window.location.href = route;
  }, 180);
}

function goToSection(sectionKey) {
  const route = RB_CONFIG.routes[sectionKey];

  if (!route) {
    console.warn("[RB] Missing route:", sectionKey);
    return;
  }

  goToRoute(route);
}

function getProfileName(profile, user) {
  return (
    profile?.display_name ||
    profile?.username ||
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "Profile"
  );
}

function updateProfileChip() {
  const chip = document.querySelector(".rb-profile-chip");
  if (!chip) return;

  const img = chip.querySelector("img");
  const label = chip.querySelector("span");

  const user = getUser();
  const profile = getProfile();

  if (!user) {
    chip.dataset.route = "auth";
    chip.classList.remove("rb-profile-authed");

    if (img) img.src = DEFAULT_AVATAR;
    if (label) label.textContent = "Sign In";
    return;
  }

  chip.dataset.route = "profile";
  chip.classList.add("rb-profile-authed");

  if (img) {
    img.src =
      profile?.avatar_url ||
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      DEFAULT_AVATAR;
  }

  if (label) {
    label.textContent = getProfileName(profile, user);
  }
}

async function bootIndexAuth() {
  await bootAuth();

  if (getUser()?.id) {
    await refreshProfile();
  }

  updateProfileChip();
}

window.addEventListener("rb:module-select", (event) => {
  const mod = event.detail;
  if (!mod?.key) return;
  goToSection(mod.key);
});

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
    RB_CONFIG.routes[routeKey];

  if (!route) {
    console.warn("[RB] Missing quick route:", routeKey);
    return;
  }

  button.classList.add("is-active");

  setTimeout(() => {
    button.classList.remove("is-active");
  }, 220);

  goToRoute(route);
});

window.addEventListener("rb:profile-updated", updateProfileChip);
window.addEventListener("focus", updateProfileChip);

window.RB_GO = goToSection;
window.RB_ROUTE = goToRoute;
window.RB_UPDATE_PROFILE_CHIP = updateProfileChip;

window.addEventListener("load", async () => {
  document.body.classList.add("rb-loaded");

  const profileChip = document.querySelector(".rb-profile-chip");
  if (profileChip) profileChip.classList.add("is-visible");

  const tabs = document.querySelectorAll(".rb-side-tabs button");

  tabs.forEach((tab, index) => {
    setTimeout(() => {
      tab.classList.add("is-visible");
    }, 100 + index * 70);
  });

  await bootIndexAuth();
});

function updateViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--rb-vh", `${vh}px`);
}

updateViewportHeight();

window.addEventListener("resize", updateViewportHeight, { passive: true });
window.addEventListener("orientationchange", updateViewportHeight, { passive: true });

console.log("RB INDEX AUTH CONNECTED");
