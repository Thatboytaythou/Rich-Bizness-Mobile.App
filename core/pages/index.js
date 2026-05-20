/* =========================================
   RICH BIZNESS LLC
   /core/pages/index.js
   FINAL OMNI INDEX CONTROLLER
   No Supabase. No imports. No freeze.
========================================= */

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
    meta: "Tracks • Radio • Podcasts",
    route: "/music"
  },
  {
    key: "gaming",
    label: "GAMES",
    title: "Arcade District",
    meta: "Play • Scores • Challenges",
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
    meta: "Art • Visuals • Showcase",
    route: "/gallery"
  },
  {
    key: "store",
    label: "STORE",
    title: "Creator Market",
    meta: "Products • Drops • Unlocks",
    route: "/store"
  },
  {
    key: "meta",
    label: "META",
    title: "Meta World",
    meta: "Worlds • Avatars • Portals",
    route: "/meta"
  }
];

const $ = (id) => document.getElementById(id);

let activeIndex = SECTIONS.findIndex(
  (section) => section.key === document.body.dataset.activeSection
);

if (activeIndex < 0) activeIndex = 1;

function getActiveSection() {
  return SECTIONS[activeIndex] || SECTIONS[1];
}

function setOrbitRotation() {
  const orbit = $("rb-tv-orbit");
  if (!orbit) return;

  const angle = activeIndex * -45;
  orbit.style.setProperty("--rb-orbit-rotation", `${angle}deg`);
}

function paintSection() {
  const section = getActiveSection();

  document.body.dataset.activeSection = section.key;

  const label = $("rb-active-label");
  const title = $("rb-active-title");
  const meta = $("rb-active-meta");
  const launch = $("rb-launch-section");

  if (label) label.textContent = section.label;
  if (title) title.textContent = section.title;
  if (meta) meta.textContent = section.meta;
  if (launch) launch.textContent = `ENTER ${section.label}`;

  document.querySelectorAll("[data-rb-section]").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.rbSection === section.key);
  });

  document.querySelectorAll("[data-rb-route]").forEach((button) => {
    button.classList.toggle("active", button.dataset.rbRoute === section.key);
  });

  setOrbitRotation();
}

function moveNext() {
  activeIndex = (activeIndex + 1) % SECTIONS.length;
  paintSection();
}

function movePrev() {
  activeIndex = (activeIndex - 1 + SECTIONS.length) % SECTIONS.length;
  paintSection();
}

function setActiveByKey(key) {
  const nextIndex = SECTIONS.findIndex((section) => section.key === key);
  if (nextIndex < 0) return;

  activeIndex = nextIndex;
  paintSection();
}

function goTo(route) {
  if (!route) return;
  window.location.href = route;
}

function bindClicks() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("button,a");
    if (!target) return;

    if (target.id === "rb-rotate-next") {
      event.preventDefault();
      moveNext();
      return;
    }

    if (target.id === "rb-rotate-prev") {
      event.preventDefault();
      movePrev();
      return;
    }

    if (target.id === "rb-launch-section") {
      event.preventDefault();
      goTo(getActiveSection().route);
      return;
    }

    if (target.id === "rb-open-upload") {
      event.preventDefault();
      goTo("/upload");
      return;
    }

    if (target.id === "rb-open-auth" || target.id === "rb-open-profile") {
      event.preventDefault();
      goTo("/auth");
      return;
    }

    if (target.dataset.rbSection) {
      event.preventDefault();
      setActiveByKey(target.dataset.rbSection);
      return;
    }

    if (target.dataset.rbRoute) {
      event.preventDefault();
      setActiveByKey(target.dataset.rbRoute);
    }
  });
}

function bindKeyboard() {
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") moveNext();
    if (event.key === "ArrowLeft") movePrev();
    if (event.key === "Enter") goTo(getActiveSection().route);
  });
}

function boot() {
  paintSection();
  bindClicks();
  bindKeyboard();
  document.body.classList.add("rb-index-ready");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
