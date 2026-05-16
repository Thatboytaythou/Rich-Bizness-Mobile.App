/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js

   CINEMATIC HOME CONTROLLER
   Identity Hydration Locked
========================= */

import {
  initAuthState,
  onAuthState
} from "/core/features/auth/auth-state.js";

import {
  profileAvatar,
  profileName,
  profileBadge
} from "/core/shared/rb-profile.js";

import {
  setActiveSection
} from "/core/shared/rb-section-state.js";

const $ = (id) => document.getElementById(id);

/* =========================
   ELEMENTS
========================= */

const els = {
  avatar: $("rb-home-avatar"),
  name: $("rb-home-name"),
  badge: $("rb-home-badge"),

  profileBtn: $("rb-open-profile"),

  uploadBtn: $("rb-open-upload"),
  authBtn: $("rb-open-auth"),

  launchBtn: $("rb-launch-section"),

  prevBtn: $("rb-rotate-prev"),
  nextBtn: $("rb-rotate-next")
};

/* =========================
   ROUTES
========================= */

const SECTION_ROUTES = {
  feed: "/feed",
  live: "/live",
  music: "/music",
  gaming: "/gaming",
  meta: "/meta"
};

const sections = [
  "feed",
  "live",
  "music",
  "gaming",
  "meta"
];

let activeIndex = 1;

/* =========================
   IDENTITY HYDRATION
========================= */

function hydrateIdentity(state) {
  const authed = !!state?.isAuthed;
  const profile = state?.profile || null;

  if (els.avatar) {
    els.avatar.src = authed
      ? profileAvatar(profile)
      : "/images/profile/default-avatar.png";
  }

  if (els.name) {
    els.name.textContent = authed
      ? profileName(profile)
      : "Guest Mode";
  }

  if (els.badge) {
    els.badge.textContent = authed
      ? profileBadge(profile)
      : "SIGN IN";
  }

  if (els.authBtn) {
    els.authBtn.textContent = authed
      ? "PROFILE"
      : "ENTER";
  }
}

/* =========================
   SECTION CONTROL
========================= */

function currentSection() {
  return sections[activeIndex];
}

function syncSection() {
  const section = currentSection();

  setActiveSection(section);

  document.body.dataset.activeSection = section;
}

function rotateNext() {
  activeIndex++;

  if (activeIndex >= sections.length) {
    activeIndex = 0;
  }

  syncSection();
}

function rotatePrev() {
  activeIndex--;

  if (activeIndex < 0) {
    activeIndex = sections.length - 1;
  }

  syncSection();
}

/* =========================
   ACTIONS
========================= */

function bindActions() {
  els.nextBtn?.addEventListener("click", rotateNext);

  els.prevBtn?.addEventListener("click", rotatePrev);

  els.launchBtn?.addEventListener("click", () => {
    const route = SECTION_ROUTES[currentSection()] || "/";
    window.location.href = route;
  });

  els.uploadBtn?.addEventListener("click", () => {
    window.location.href = "/upload";
  });

  els.authBtn?.addEventListener("click", () => {
    const authed =
      document.body.classList.contains("is-authed");

    window.location.href = authed
      ? "/profile"
      : "/auth";
  });

  els.profileBtn?.addEventListener("click", () => {
    const authed =
      document.body.classList.contains("is-authed");

    window.location.href = authed
      ? "/profile"
      : "/auth";
  });
}

/* =========================
   INIT
========================= */

async function bootHome() {
  const state = await initAuthState();

  hydrateIdentity(state);

  onAuthState((nextState) => {
    hydrateIdentity(nextState);
  });

  bindActions();

  syncSection();

  document.body.classList.add("rb-home-ready");

  console.log("RB HOME READY");
}

bootHome();
