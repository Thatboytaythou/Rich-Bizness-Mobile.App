/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js

   HOME OMNI PORTAL CONTROLLER
========================= */

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  bootAuth,
  getUser,
  getProfile
} from "/core/shared/rb-supabase.js";

import {
  profileName,
  profileAvatar,
  profileBadge
} from "/core/shared/rb-profile.js";

import {
  $,
  $$,
  setText
} from "/core/shared/rb-dom.js";

const SECTIONS = [
  {
    key: "live",
    label: "LIVE",
    title: "Go Live",
    route: RB_ROUTES.live,
    meta: "Broadcast • VIP • Realtime"
  },
  {
    key: "music",
    label: "MUSIC",
    title: "Music Universe",
    route: RB_ROUTES.music,
    meta: "Tracks • Podcast • Radio"
  },
  {
    key: "gaming",
    label: "GAMES",
    title: "Arcade District",
    route: RB_ROUTES.gaming,
    meta: "Chess • Runner • Scores"
  },
  {
    key: "sports",
    label: "SPORTS",
    title: "Sports Arena",
    route: RB_ROUTES.sports,
    meta: "Picks • Clips • Broadcasts"
  },
  {
    key: "gallery",
    label: "ART",
    title: "Gallery Vault",
    route: RB_ROUTES.gallery,
    meta: "Artwork • Collect • Showcase"
  },
  {
    key: "store",
    label: "STORE",
    title: "Creator Market",
    route: RB_ROUTES.store,
    meta: "Products • Unlocks • Sellers"
  },
  {
    key: "meta",
    label: "META",
    title: "Meta World",
    route: RB_ROUTES.meta,
    meta: "Avatars • Worlds • Portals"
  },
  {
    key: "feed",
    label: "FEED",
    title: "Global Feed",
    route: RB_ROUTES.feed,
    meta: "Posts • Drops • Community"
  }
];

let activeIndex = 0;
let rotateTimer = null;

function renderScreens() {
  const orbit = $("#rb-tv-orbit");
  if (!orbit) return;

  orbit.innerHTML = "";

  SECTIONS.forEach((section, index) => {
    const card = document.createElement("button");

    card.type = "button";
    card.className = "rb-tv-screen";
    card.dataset.index = String(index);
    card.dataset.section = section.key;

    card.style.setProperty("--i", index);
    card.style.setProperty("--total", SECTIONS.length);

    card.innerHTML = `
      <span class="rb-tv-glare"></span>
      <span class="rb-tv-label">${section.label}</span>
      <strong>${section.title}</strong>
      <small>${section.meta}</small>
    `;

    card.addEventListener("click", () => {
      setActiveSection(index);
    });

    orbit.appendChild(card);
  });
}

function setActiveSection(index) {
  activeIndex = index;
  const active = SECTIONS[activeIndex];

  $$(".rb-tv-screen").forEach((screen) => {
    screen.classList.toggle(
      "is-active",
      Number(screen.dataset.index) === activeIndex
    );
  });

  setText("#rb-active-title", active.title);
  setText("#rb-active-meta", active.meta);
  setText("#rb-active-label", active.label);

  const launch = $("#rb-launch-section");
  if (launch) {
    launch.dataset.route = active.route;
  }

  document.body.dataset.activeSection = active.key;
}

function rotateNext() {
  const next = (activeIndex + 1) % SECTIONS.length;
  setActiveSection(next);
}

function bindControls() {
  $("#rb-launch-section")?.addEventListener("click", (event) => {
    const route = event.currentTarget.dataset.route || RB_ROUTES.feed;
    window.location.href = route;
  });

  $("#rb-open-upload")?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.upload;
  });

  $("#rb-open-profile")?.addEventListener("click", () => {
    window.location.href = getUser() ? RB_ROUTES.profile : RB_ROUTES.auth;
  });

  $("#rb-open-auth")?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.auth;
  });

  $("#rb-rotate-prev")?.addEventListener("click", () => {
    const prev =
      activeIndex === 0
        ? SECTIONS.length - 1
        : activeIndex - 1;

    setActiveSection(prev);
  });

  $("#rb-rotate-next")?.addEventListener("click", () => {
    rotateNext();
  });
}

function bindBottomNav() {
  $$("[data-rb-route]").forEach((button) => {
    button.addEventListener("click", () => {
      const routeKey = button.dataset.rbRoute;
      const route = RB_ROUTES[routeKey];

      if (route) {
        window.location.href = route;
      }
    });
  });
}

function hydrateIdentity() {
  const user = getUser();
  const profile = getProfile();

  const name = profileName(profile);
  const avatar = profileAvatar(profile);
  const badge = profileBadge(profile);

  setText("#rb-home-name", user ? name : "Guest Mode");
  setText("#rb-home-badge", user ? badge : "SIGN IN");

  const avatarEl = $("#rb-home-avatar");
  if (avatarEl) {
    avatarEl.src = user ? avatar : "/images/profile/default-avatar.png";
  }

  const authBtn = $("#rb-open-auth");
  if (authBtn) {
    authBtn.textContent = user ? "Dashboard" : "Enter";
  }
}

function startRotation() {
  stopRotation();

  rotateTimer = window.setInterval(() => {
    rotateNext();
  }, 4200);
}

function stopRotation() {
  if (rotateTimer) {
    window.clearInterval(rotateTimer);
    rotateTimer = null;
  }
}

async function bootHome() {
  await bootAuth();

  renderScreens();
  bindControls();
  bindBottomNav();
  hydrateIdentity();

  setActiveSection(0);
  startRotation();

  document.body.classList.add("rb-home-ready");
}

bootHome();

window.addEventListener("beforeunload", stopRotation);
