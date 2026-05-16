/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js

   HOME BRAIN ONLY
   Creates TV cards + routes + identity
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
   SECTION SOURCE
========================= */

const SECTIONS = [
  {
    key: "feed",
    label: "FEED",
    title: "Global Feed",
    meta: "Posts • Drops • Community",
    route: "/feed"
  },
  {
    key: "live",
    label: "LIVE",
    title: "Go Live",
    meta: "Broadcast • VIP • Realtime",
    route: "/live"
  },
  {
    key: "music",
    label: "MUSIC",
    title: "Music Universe",
    meta: "Tracks • Podcast • Radio",
    route: "/music"
  },
  {
    key: "gaming",
    label: "GAMES",
    title: "Arcade District",
    meta: "Chess • Runner • Scores",
    route: "/gaming"
  },
  {
    key: "sports",
    label: "SPORTS",
    title: "Sports Arena",
    meta: "Picks • Clips • Broadcasts",
    route: "/sports"
  },
  {
    key: "gallery",
    label: "ART",
    title: "Gallery Vault",
    meta: "Artwork • Collect • Showcase",
    route: "/gallery"
  },
  {
    key: "store",
    label: "STORE",
    title: "Creator Market",
    meta: "Products • Unlocks • Sellers",
    route: "/store"
  },
  {
    key: "meta",
    label: "META",
    title: "Meta World",
    meta: "Avatars • Worlds • Portals",
    route: "/meta"
  }
];

let activeIndex = 1;

/* =========================
   ELEMENTS
========================= */

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

  setActiveSection(section.key);

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

  document.querySelectorAll(".rb-tv-screen").forEach((card) => {
    card.classList.toggle(
      "is-active",
      card.dataset.rbSection === section.key
    );
  });

  window.dispatchEvent(
    new CustomEvent("rb:section-change", {
      detail: section
    })
  );
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
    els.authBtn.textContent = authed
      ? "Profile"
      : "Enter";
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
