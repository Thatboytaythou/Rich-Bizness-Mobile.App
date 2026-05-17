/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js

   HOME PAGE CONTROLLER
   Auth Paint + Click Lock Fixed
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

import {
  goTo
} from "/core/shared/rb-router.js";

const $ = (id) => document.getElementById(id);

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

let actionsBound = false;

function getAuthed() {
  return !!getAuthState()?.authed;
}

function ensureOrbitScreens() {
  if (!els.orbit) return;

  const sections = getSections();
  const existingScreens = [
    ...els.orbit.querySelectorAll(".rb-tv-screen")
  ];

  if (!existingScreens.length) {
    sections.forEach((section) => {
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
    const section = sections.find(
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

function safeGo(route) {
  if (!route) return;
  window.location.href = route;
}

function bindActions() {
  if (actionsBound) return;
  actionsBound = true;

  els.nextBtn?.addEventListener("click", () => {
    const section = nextSection();
    paintSection(section);
  });

  els.prevBtn?.addEventListener("click", () => {
    const section = prevSection();
    paintSection(section);
  });

  els.launchBtn?.addEventListener("click", () => {
    safeGo(getActiveSection().route);
  });

  els.uploadBtn?.addEventListener("click", () => {
    safeGo("/upload");
  });

  els.authBtn?.addEventListener("click", () => {
    safeGo(getAuthed() ? "/profile" : "/auth");
  });

  els.profileBtn?.addEventListener("click", () => {
    safeGo(getAuthed() ? "/profile" : "/auth");
  });

  document.querySelectorAll("[data-rb-route]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.rbRoute;
      const section = setActiveSection(key);
      paintSection(section);
    });
  });

  document.querySelectorAll(".rb-tv-screen").forEach((screen) => {
    screen.addEventListener("click", () => {
      const key = screen.dataset.rbSection;
      const section = setActiveSection(key);
      paintSection(section);
    });
  });
}

async function syncIdentity() {
  await bootAuth();
  await refreshProfile();
  hydrateIdentity();
}

async function bootHome() {
  ensureOrbitScreens();

  const section = setActiveSection(
    document.body.dataset.activeSection || "live"
  );

  paintSection(section);

  bindActions();

  await syncIdentity();

  window.addEventListener("focus", async () => {
    await syncIdentity();
  });

  document.body.classList.add("rb-home-ready");

  console.log("RB INDEX READY");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootHome);
} else {
  bootHome();
}
