/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js

   HOME PAGE CONTROLLER
   SAFE INDEX RESTORE
   Clicks + Identity + Portal Locked
========================= */

import {
  getAuthState,
  bootAuth,
  refreshProfile
} from "/core/shared/rb-auth.js";

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

function getEls() {
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
  if (!route) return;
  window.location.assign(route);
}

function isAuthedNow() {
  return !!getAuthState()?.authed;
}

function ensureOrbitScreens() {
  const els = getEls();
  if (!els.orbit) return;

  const existingScreens = [
    ...els.orbit.querySelectorAll(".rb-tv-screen")
  ];

  if (!existingScreens.length) {
    getSections().forEach((section) => {
      const screen = document.createElement("button");

      screen.type = "button";
      screen.className = "rb-tv-screen";
      screen.dataset.rbSection = section.key;

      screen.innerHTML = `
        <img
          src="/images/sections/${section.key}.jpg"
          alt="${section.title}"
        />

        <div class="rb-tv-overlay">
          <span>${section.label}</span>
          <h3>${section.title}</h3>
        </div>
      `;

      els.orbit.appendChild(screen);
    });

    return;
  }

  existingScreens.forEach((screen) => {
    const section = getSections().find(
      (item) => item.key === screen.dataset.rbSection
    );

    if (!section) return;

    const label =
      screen.querySelector(".rb-tv-label") ||
      screen.querySelector(".rb-tv-overlay span");

    const title =
      screen.querySelector("strong") ||
      screen.querySelector(".rb-tv-overlay h3");

    const meta =
      screen.querySelector("small");

    if (label) label.textContent = section.label;
    if (title) title.textContent = section.title;
    if (meta) meta.textContent = section.meta;
  });
}

function paintSection(section = getActiveSection()) {
  const els = getEls();
  if (!section) return;

  document.body.dataset.activeSection = section.key;

  if (els.label) els.label.textContent = section.label;
  if (els.title) els.title.textContent = section.title;
  if (els.meta) els.meta.textContent = section.meta;

  document.querySelectorAll("[data-rb-route]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.rbRoute === section.key
    );
  });

  document.querySelectorAll(".rb-tv-screen").forEach((screen) => {
    screen.classList.toggle(
      "is-active",
      screen.dataset.rbSection === section.key
    );
  });
}

function hydrateIdentity() {
  const els = getEls();
  const state = getAuthState();
  const profile = state?.profile || null;
  const authed = !!state?.authed;

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

async function syncIdentity() {
  try {
    await bootAuth();
    await refreshProfile();
  } catch (error) {
    console.warn("[RB INDEX AUTH WARNING]", error?.message || error);
  }

  hydrateIdentity();
}

function bindActions() {
  if (actionsBound) return;
  actionsBound = true;

  document.addEventListener("click", (event) => {
    const clickable = event.target.closest("button, a, .rb-tv-screen");
    if (!clickable) return;

    if (clickable.id === "rb-rotate-next") {
      event.preventDefault();
      paintSection(nextSection());
      return;
    }

    if (clickable.id === "rb-rotate-prev") {
      event.preventDefault();
      paintSection(prevSection());
      return;
    }

    if (clickable.id === "rb-launch-section") {
      event.preventDefault();
      safeGo(getActiveSection().route);
      return;
    }

    if (clickable.id === "rb-open-upload") {
      event.preventDefault();
      safeGo("/upload");
      return;
    }

    if (
      clickable.id === "rb-open-auth" ||
      clickable.id === "rb-open-profile"
    ) {
      event.preventDefault();
      safeGo(isAuthedNow() ? "/profile" : "/auth");
      return;
    }

    if (clickable.dataset?.rbRoute) {
      event.preventDefault();
      paintSection(setActiveSection(clickable.dataset.rbRoute));
      return;
    }

    const screen = clickable.closest(".rb-tv-screen");

    if (screen?.dataset?.rbSection) {
      event.preventDefault();
      paintSection(setActiveSection(screen.dataset.rbSection));
    }
  });
}

async function bootHome() {
  ensureOrbitScreens();

  const startSection = setActiveSection(
    document.body.dataset.activeSection || "live"
  );

  paintSection(startSection);

  bindActions();

  await syncIdentity();

  window.addEventListener("focus", syncIdentity);
  window.addEventListener("pageshow", syncIdentity);

  document.body.classList.add("rb-home-ready");

  console.log("RB INDEX READY");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootHome);
} else {
  bootHome();
}
