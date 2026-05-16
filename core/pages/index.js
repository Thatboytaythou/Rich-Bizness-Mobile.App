/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js

   HOME BRAIN ONLY
   Uses rb-section-state as section source
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
  getSections,
  setActiveSection
} from "/core/shared/rb-section-state.js";

const $ = (id) => document.getElementById(id);

const SECTIONS = getSections();

let activeIndex = Math.max(
  0,
  SECTIONS.findIndex((section) => section.key === "live")
);

const els = {
  orbit: $("rb-tv-orbit"),

  avatar: $("rb-home-avatar"),
  name: $("rb-home-name"),
  badge: $("rb-home-badge"),

  profileBtn: $("rb-open-profile"),
  uploadBtn: $("rb-open-upload"),
  authBtn: $("rb-open-auth"),

  launchBtn: $("rb-launch-section"),
  prevBtn: $("rb-rotate-prev"),
  nextBtn: $("rb-rotate-next"),

  label: $("rb-active-label"),
  title: $("rb-active-title"),
  meta: $("rb-active-meta")
};

/* =========================
   TV CARD CREATION
========================= */

function renderOrbitCards() {
  if (!els.orbit) return;

  els.orbit.innerHTML = "";

  SECTIONS.forEach((section, index) => {
    const card = document.createElement("button");

    card.type = "button";
    card.className = "rb-tv-screen";
    card.dataset.rbSection = section.key;
    card.dataset.rbIndex = String(index);

    card.innerHTML = `
      <span class="rb-tv-glare"></span>
      <span class="rb-tv-label">${section.label}</span>
      <strong>${section.title}</strong>
      <small>${section.meta}</small>
    `;

    card.addEventListener("click", () => {
      activeIndex = index;
      syncActiveSection();
    });

    els.orbit.appendChild(card);
  });
}

/* =========================
   SECTION STATE
========================= */

function getActiveSection() {
  return SECTIONS[activeIndex] || SECTIONS[0];
}

function syncActiveSection() {
  const section = getActiveSection();
  const syncedSection = setActiveSection(section.key);

  document.body.dataset.activeSection = syncedSection.key;

  if (els.label) els.label.textContent = syncedSection.label;
  if (els.title) els.title.textContent = syncedSection.title;
  if (els.meta) els.meta.textContent = syncedSection.meta;

  document.querySelectorAll("[data-rb-route]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.rbRoute === syncedSection.key
    );
  });

  document.querySelectorAll(".rb-tv-screen").forEach((card) => {
    card.classList.toggle(
      "is-active",
      card.dataset.rbSection === syncedSection.key
    );
  });
}

function rotateNext() {
  activeIndex = (activeIndex + 1) % SECTIONS.length;
  syncActiveSection();
}

function rotatePrev() {
  activeIndex =
    activeIndex === 0
      ? SECTIONS.length - 1
      : activeIndex - 1;

  syncActiveSection();
}

/* =========================
   IDENTITY HYDRATION
========================= */

function hydrateIdentity(state) {
  const authed = !!state?.isAuthed;
  const profile = state?.profile || null;

  document.body.classList.toggle("is-authed", authed);
  document.body.classList.toggle("is-guest", !authed);

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
    els.authBtn.textContent = authed ? "Profile" : "Enter";
  }
}

/* =========================
   ACTIONS
========================= */

function bindActions() {
  els.nextBtn?.addEventListener("click", rotateNext);
  els.prevBtn?.addEventListener("click", rotatePrev);

  els.launchBtn?.addEventListener("click", () => {
    window.location.href = getActiveSection().route;
  });

  els.uploadBtn?.addEventListener("click", () => {
    window.location.href = "/upload";
  });

  els.authBtn?.addEventListener("click", () => {
    window.location.href = document.body.classList.contains("is-authed")
      ? "/profile"
      : "/auth";
  });

  els.profileBtn?.addEventListener("click", () => {
    window.location.href = document.body.classList.contains("is-authed")
      ? "/profile"
      : "/auth";
  });

  document.querySelectorAll("[data-rb-route]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = SECTIONS.findIndex(
        (section) => section.key === button.dataset.rbRoute
      );

      if (index < 0) return;

      activeIndex = index;
      syncActiveSection();
    });
  });
}

/* =========================
   INIT
========================= */

async function bootHome() {
  renderOrbitCards();
  syncActiveSection();
  bindActions();

  const state = await initAuthState();

  hydrateIdentity(state);

  onAuthState((nextState) => {
    hydrateIdentity(nextState);
  });

  document.body.classList.add("rb-home-ready");

  console.log("RB HOME BRAIN READY");
}

bootHome();
