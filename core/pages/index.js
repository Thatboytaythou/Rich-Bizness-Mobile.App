/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js
   CINEMATIC HOME CONTROLLER
========================= */

import { initAuthState, onAuthState } from "/core/features/auth/auth-state.js";
import { profileAvatar, profileName, profileBadge } from "/core/shared/rb-profile.js";
import { setActiveSection } from "/core/shared/rb-section-state.js";

const $ = (id) => document.getElementById(id);

const SECTIONS = [
  { key: "feed", label: "FEED", title: "Global Feed", meta: "Posts • Drops • Community", route: "/feed" },
  { key: "live", label: "LIVE", title: "Go Live", meta: "Broadcast • VIP • Realtime", route: "/live" },
  { key: "music", label: "MUSIC", title: "Music Universe", meta: "Tracks • Podcast • Radio", route: "/music" },
  { key: "gaming", label: "GAMES", title: "Arcade District", meta: "Chess • Runner • Scores", route: "/gaming" },
  { key: "meta", label: "META", title: "Meta World", meta: "Avatars • Worlds • Portals", route: "/meta" }
];

let activeIndex = 1;

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

function renderScreens() {
  if (!els.orbit) return;

  els.orbit.innerHTML = "";

  SECTIONS.forEach((section, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "rb-tv-screen";
    card.dataset.section = section.key;
    card.dataset.index = String(index);

    card.innerHTML = `
      <span class="rb-tv-glare"></span>
      <span class="rb-tv-label">${section.label}</span>
      <strong>${section.title}</strong>
      <small>${section.meta}</small>
    `;

    card.addEventListener("click", () => {
      activeIndex = index;
      syncSection();
    });

    els.orbit.appendChild(card);
  });
}

function currentSection() {
  return SECTIONS[activeIndex];
}

function syncSection() {
  const section = currentSection();

  setActiveSection(section.key);
  document.body.dataset.activeSection = section.key;

  if (els.label) els.label.textContent = section.label;
  if (els.title) els.title.textContent = section.title;
  if (els.meta) els.meta.textContent = section.meta;

  document.querySelectorAll("[data-rb-route]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.rbRoute === section.key);
  });

  document.querySelectorAll(".rb-tv-screen").forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.section === section.key);
  });
}

function hydrateIdentity(state) {
  const authed = !!state?.isAuthed;
  const profile = state?.profile || null;

  if (els.avatar) {
    els.avatar.src = authed ? profileAvatar(profile) : "/images/profile/default-avatar.png";
  }

  if (els.name) {
    els.name.textContent = authed ? profileName(profile) : "Guest Mode";
  }

  if (els.badge) {
    els.badge.textContent = authed ? profileBadge(profile) : "SIGN IN";
  }

  if (els.authBtn) {
    els.authBtn.textContent = authed ? "PROFILE" : "ENTER";
  }
}

function rotateNext() {
  activeIndex = (activeIndex + 1) % SECTIONS.length;
  syncSection();
}

function rotatePrev() {
  activeIndex = activeIndex === 0 ? SECTIONS.length - 1 : activeIndex - 1;
  syncSection();
}

function bindActions() {
  els.nextBtn?.addEventListener("click", rotateNext);
  els.prevBtn?.addEventListener("click", rotatePrev);

  els.launchBtn?.addEventListener("click", () => {
    window.location.href = currentSection().route;
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

  document.querySelectorAll("[data-rb-route]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = SECTIONS.findIndex((s) => s.key === btn.dataset.rbRoute);
      if (index >= 0) {
        activeIndex = index;
        syncSection();
      }
    });
  });
}

async function bootHome() {
  renderScreens();
  syncSection();
  bindActions();

  const state = await initAuthState();
  hydrateIdentity(state);

  onAuthState(hydrateIdentity);

  document.body.classList.add("rb-home-ready");

  console.log("RB HOME READY");
}

bootHome();
