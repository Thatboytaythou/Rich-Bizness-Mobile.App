/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js

   INDEX OWNER LOCK
   Owns:
   - home clicks
   - identity paint
   - active section paint
   - rotating TV orbit

   No extra engine JS needed.
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
  getActiveSection,
  setActiveSection,
  nextSection,
  prevSection
} from "/core/shared/rb-section-state.js";

const $ = (id) => document.getElementById(id);

const ROUTES = {
  feed: "/feed",
  live: "/live",
  music: "/music",
  gaming: "/gaming",
  sports: "/sports",
  gallery: "/gallery",
  store: "/store",
  meta: "/meta",
  upload: "/upload",
  auth: "/auth",
  profile: "/profile"
};

let actionsBound = false;
let orbitStarted = false;
let currentRotation = 0;
let targetRotation = 0;
let activeKey = "live";

function els() {
  return {
    orbit: $("rb-tv-orbit"),
    avatar: $("rb-home-avatar"),
    name: $("rb-home-name"),
    badge: $("rb-home-badge"),
    authBtn: $("rb-open-auth"),
    label: $("rb-active-label"),
    title: $("rb-active-title"),
    meta: $("rb-active-meta")
  };
}

function screens() {
  return [...document.querySelectorAll(".rb-tv-screen")];
}

function isMobile() {
  return window.innerWidth <= 720;
}

function getRadius() {
  return isMobile() ? 150 : 270;
}

function safeGo(route) {
  if (!route) return;
  window.location.href = route;
}

function routeFor(section) {
  return section?.route || ROUTES[section?.key] || "/";
}

function paintIdentity() {
  const state = getAuthState() || {};
  const profile = state.profile || null;
  const authed = !!state.isAuthed;
  const e = els();

  document.body.classList.toggle("is-authed", authed);
  document.body.classList.toggle("is-guest", !authed);

  if (e.avatar) {
    e.avatar.src = authed
      ? profileAvatar(profile)
      : "/images/brand/Avatar-hero-Banner.png.jpeg";
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

function rotateToKey(key) {
  const allScreens = screens();
  const index = allScreens.findIndex(
    (screen) => screen.dataset.rbSection === key
  );

  if (index < 0 || !allScreens.length) return;

  targetRotation = -((Math.PI * 2) / allScreens.length) * index;
}

function paintOrbit() {
  const allScreens = screens();
  const total = allScreens.length || 1;
  const radius = getRadius();

  allScreens.forEach((screen, index) => {
    const angle = ((Math.PI * 2) / total) * index + currentRotation;

    const x = Math.sin(angle) * radius;
    const y = Math.cos(angle) * radius * 0.32;
    const depth = Math.cos(angle);
    const front = (depth + 1) / 2;

    const scale = isMobile()
      ? 0.58 + front * 0.34
      : 0.62 + front * 0.38;

    const opacity = 0.28 + front * 0.68;
    const z = Math.floor(front * 40) + 20;

    screen.style.transform = `
      translate3d(${x}px, ${y}px, 0)
      scale(${scale})
    `;

    screen.style.opacity = String(opacity);
    screen.style.zIndex = String(z);

    screen.style.filter = `
      brightness(${0.74 + front * 0.42})
      saturate(${1.05 + front * 0.25})
      blur(${(1 - front) * 0.9}px)
    `;

    screen.classList.toggle("is-front", front > 0.92);
  });
}

function animateOrbit() {
  currentRotation += (targetRotation - currentRotation) * 0.075;
  paintOrbit();
  requestAnimationFrame(animateOrbit);
}

function startOrbit() {
  if (orbitStarted) return;
  orbitStarted = true;

  rotateToKey(activeKey);
  paintOrbit();
  animateOrbit();

  window.addEventListener("resize", () => {
    paintOrbit();
  });

  document.body.classList.add("rb-motion-ready");
}

function paintSection(section = getActiveSection()) {
  if (!section) return;

  activeKey = section.key;

  const e = els();

  document.body.dataset.activeSection = section.key;

  if (e.label) e.label.textContent = section.label;
  if (e.title) e.title.textContent = section.title;
  if (e.meta) e.meta.textContent = section.meta;

  document.querySelectorAll("[data-rb-route]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.rbRoute === section.key
    );
  });

  screens().forEach((screen) => {
    screen.classList.toggle(
      "is-active",
      screen.dataset.rbSection === section.key
    );
  });

  rotateToKey(section.key);
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
      safeGo(routeFor(getActiveSection()));
      return;
    }

    if (target.id === "rb-open-upload") {
      event.preventDefault();
      safeGo(ROUTES.upload);
      return;
    }

    if (target.id === "rb-open-auth" || target.id === "rb-open-profile") {
      event.preventDefault();
      safeGo(getAuthState()?.isAuthed ? ROUTES.profile : ROUTES.auth);
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
    startOrbit();

    window.addEventListener("focus", paintIdentity);
    window.addEventListener("pageshow", paintIdentity);

    document.body.classList.add("rb-home-ready");

    markPageReady("index");

    console.log("RB INDEX READY");
  } catch (error) {
    console.error("RB INDEX ERROR", error);
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootHome);
} else {
  bootHome();
}
