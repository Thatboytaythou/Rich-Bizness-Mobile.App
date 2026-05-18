/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js

   HOME PAGE CONTROLLER
   LOCKED TO /core/app.js
========================= */

import {
  initApp,
  markPageReady,
  markPageError
} from "/core/app.js";

import {
  getAuthState
} from "/core/features/auth/auth-state.js";

import {
  profileAvatar,
  profileName,
  profileBadge
} from "/core/shared/rb-profile.js";

import {
  getSections,
  getActiveSection,
  setActiveSection,
  nextSection,
  prevSection
} from "/core/shared/rb-section-state.js";

const $ = (id) => document.getElementById(id);

let actionsBound = false;

function els() {
  return {
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
}

function safeGo(route) {
  if (route) window.location.href = route;
}

function paintIdentity() {
  const state = getAuthState();
  const profile = state.profile;
  const authed = state.isAuthed;
  const e = els();

  document.body.classList.toggle("is-authed", authed);
  document.body.classList.toggle("is-guest", !authed);

  if (e.avatar) {
    e.avatar.src = authed
      ? profileAvatar(profile)
      : "/images/brand/project-avatar.png.jpeg";
  }

  if (e.name) {
    e.name.textContent = authed ? profileName(profile) : "Guest Mode";
  }

  if (e.badge) {
    e.badge.textContent = authed ? profileBadge(profile) : "SIGN IN";
  }

  if (e.authBtn) {
    e.authBtn.textContent = authed ? "Profile" : "Enter";
  }
}

function paintSection(section = getActiveSection()) {
  if (!section) return;

  const e = els();

  document.body.dataset.activeSection = section.key;

  if (e.label) e.label.textContent = section.label;
  if (e.title) e.title.textContent = section.title;
  if (e.meta) e.meta.textContent = section.meta;

  document.querySelectorAll("[data-rb-route]").forEach((button) => {
    button.classList.toggle("active", button.dataset.rbRoute === section.key);
  });

  document.querySelectorAll(".rb-tv-screen").forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.rbSection === section.key);
  });
}

function bindActions() {
  if (actionsBound) return;
  actionsBound = true;

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button, a, .rb-tv-screen");
    if (!target) return;

    if (target.id === "rb-rotate-next") {
      event.preventDefault();
      paintSection(nextSection());
      return;
    }

    if (target.id === "rb-rotate-prev") {
      event.preventDefault();
      paintSection(prevSection());
      return;
    }

    if (target.id === "rb-launch-section") {
      event.preventDefault();
      safeGo(getActiveSection()?.route);
      return;
    }

    if (target.id === "rb-open-upload") {
      event.preventDefault();
      safeGo("/upload");
      return;
    }

    if (target.id === "rb-open-auth" || target.id === "rb-open-profile") {
      event.preventDefault();
      safeGo(getAuthState().isAuthed ? "/profile" : "/auth");
      return;
    }

    if (target.dataset?.rbRoute) {
      event.preventDefault();
      paintSection(setActiveSection(target.dataset.rbRoute));
      return;
    }

    const screen = target.closest(".rb-tv-screen");

    if (screen?.dataset?.rbSection) {
      event.preventDefault();
      paintSection(setActiveSection(screen.dataset.rbSection));
    }
  });
}

async function bootHome() {
  try {
    await initApp({
      guard: false,
      bindProfile: false,
      toast: false
    });

    const startSection = setActiveSection(
      document.body.dataset.activeSection || "live"
    );

    paintSection(startSection);
    paintIdentity();
    bindActions();

    window.addEventListener("focus", paintIdentity);
    window.addEventListener("pageshow", paintIdentity);

    document.body.classList.add("rb-home-ready");
    markPageReady("index");

    console.log("RB INDEX READY");
  } catch (error) {
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootHome);
} else {
  bootHome();
}
