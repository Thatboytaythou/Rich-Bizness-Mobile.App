/* =========================
   RICH BIZNESS MOBILE
   /core/pages/profile.js

   PROFILE PAGE FOUNDATION CONTROLLER
========================= */

import {
  autoGuardCurrentPage
} from "/core/shared/rb-guards.js";

import {
  initAuthState,
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

/* =========================
   ELEMENTS
========================= */

const $ = (id) => document.getElementById(id);

const els = {
  avatar: $("profile-avatar"),
  banner: $("profile-banner"),
  name: $("profile-name"),
  handle: $("profile-handle"),
  badge: $("profile-badge"),
  bio: $("profile-bio"),
  editBtn: $("profile-edit-btn")
};

/* =========================
   PAINT
========================= */

function paintProfile(state) {
  const profile = state?.profile;
  if (!profile) return;

  if (els.avatar) {
    els.avatar.src = profileAvatar(profile);
  }

  if (els.banner) {
    els.banner.style.backgroundImage =
      `url("${profileBanner(profile)}")`;
  }

  if (els.name) {
    els.name.textContent = profileName(profile);
  }

  if (els.handle) {
    els.handle.textContent = profileHandle(profile);
  }

  if (els.badge) {
    els.badge.textContent = profileBadge(profile);
  }

  if (els.bio) {
    els.bio.textContent =
      profile.bio || "No bio yet. Build your Rich Bizness identity.";
  }
}

/* =========================
   ACTIONS
========================= */

function bindProfileActions() {
  els.editBtn?.addEventListener("click", () => {
    window.location.href = "/edit";
  });
}

/* =========================
   BOOT
========================= */

async function bootProfilePage() {
  await autoGuardCurrentPage();

  const state = await initAuthState();

  paintProfile(state);

  onAuthState((nextState) => {
    paintProfile(nextState);
  });

  bindProfileActions();

  document.body.classList.add("rb-profile-ready");

  console.log("RB PROFILE FOUNDATION READY");
}

bootProfilePage();
