/* =========================
   RICH BIZNESS MOBILE
   /core/pages/profile.js

   PROFILE PAGE CONTROLLER
   LOCKED TO /core/app.js
========================= */

import {
  initApp,
  markPageReady,
  markPageError
} from "/core/app.js";

import {
  getAuthState,
  onAuthState
} from "/core/features/auth/auth-state.js";

import {
  profileAvatar,
  profileBanner,
  profileName,
  profileHandle,
  profileBadge
} from "/core/shared/rb-profile.js";

import {
  bindSignOutButtons
} from "/core/features/auth/auth-ui.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_AVATAR =
  "/images/brand/project-avatar.png.jpeg";

const DEFAULT_BANNER =
  "/images/brand/Avatar-hero-Banner.png.jpeg";

const els = {
  avatar: $("profile-avatar"),
  banner: $("profile-banner"),
  name: $("profile-name"),
  handle: $("profile-handle"),
  badge: $("profile-badge"),
  bio: $("profile-bio"),
  editBtn: $("profile-edit-btn")
};

function paintProfile(state = getAuthState()) {
  const profile = state?.profile || null;

  if (!profile) return;

  if (els.avatar) {
    els.avatar.src =
      profileAvatar(profile) ||
      DEFAULT_AVATAR;
  }

  if (els.banner) {
    els.banner.style.backgroundImage =
      `url("${profileBanner(profile) || DEFAULT_BANNER}")`;
  }

  if (els.name) {
    els.name.textContent =
      profileName(profile);
  }

  if (els.handle) {
    els.handle.textContent =
      profileHandle(profile);
  }

  if (els.badge) {
    els.badge.textContent =
      profileBadge(profile);
  }

  if (els.bio) {
    els.bio.textContent =
      profile.bio ||
      "No bio yet. Build your Rich Bizness identity.";
  }
}

function bindProfileActions() {
  els.editBtn?.addEventListener("click", () => {
    window.location.href = "/edit";
  });

  bindSignOutButtons();
}

async function bootProfilePage() {
  try {
    const appState = await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    paintProfile(appState.auth);

    onAuthState((nextState) => {
      paintProfile(nextState);
    });

    bindProfileActions();

    document.body.classList.add("rb-profile-ready");

    markPageReady("profile");

    console.log("RB PROFILE READY");
  } catch (error) {
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootProfilePage);
} else {
  bootProfilePage();
}
