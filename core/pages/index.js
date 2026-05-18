/* =========================
   RICH BIZNESS MOBILE
   /core/pages/index.js

   INDEX FUNCTION TEST LOCK
   No imports. No Supabase. No engine.
   Purpose: prove clicks + routes work.
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

let activeIndex = Math.max(
  0,
  SECTIONS.findIndex(
    (section) =>
      section.key === document.body.dataset.activeSection
  )
);

function activeSection() {
  return SECTIONS[activeIndex] || SECTIONS[1];
}

function paintSection() {
  const section = activeSection();

  document.body.dataset.activeSection = section.key;

  const label = $("rb-active-label");
  const title = $("rb-active-title");
  const meta = $("rb-active-meta");

  if (label) label.textContent = section.label;
  if (title) title.textContent = section.title;
  if (meta) meta.textContent = section.meta;

  document.querySelectorAll("[data-rb-route]").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.dataset.rbRoute === section.key
    );
  });

  document.querySelectorAll("[data-rb-section]").forEach((card) => {
    card.classList.toggle(
      "is-active",
      card.dataset.rbSection === section.key
    );
  });
}

function go(route) {
  if (!route) return;
  window.location.href = route;
}

function bindClicks() {
  document.body.addEventListener("click", (event) => {
    const target = event.target.closest("button, a");
    if (!target) return;

    console.log("RB CLICK:", target.id || target.dataset.rbRoute || target.dataset.rbSection);

    if (target.id === "rb-rotate-next") {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % SECTIONS.length;
      paintSection();
      return;
    }

    if (target.id === "rb-rotate-prev") {
      event.preventDefault();
      activeIndex =
        (activeIndex - 1 + SECTIONS.length) % SECTIONS.length;
      paintSection();
      return;
    }

    if (target.id === "rb-launch-section") {
      event.preventDefault();
      go(activeSection().route);
      return;
    }

    if (target.id === "rb-open-upload") {
      event.preventDefault();
      go("/upload");
      return;
    }

    if (
      target.id === "rb-open-auth" ||
      target.id === "rb-open-profile"
    ) {
      event.preventDefault();
      go("/auth");
      return;
    }

    if (target.dataset.rbRoute) {
      event.preventDefault();

      const index = SECTIONS.findIndex(
        (section) => section.key === target.dataset.rbRoute
      );

      if (index >= 0) {
        activeIndex = index;
        paintSection();
      }

      return;
    }

    if (target.dataset.rbSection) {
      event.preventDefault();

      const index = SECTIONS.findIndex(
        (section) => section.key === target.dataset.rbSection
      );

      if (index >= 0) {
        activeIndex = index;
        paintSection();
      }
    }
  });
}

function boot() {
  paintSection();
  bindClicks();

  document.body.classList.add("rb-index-function-ready");

  console.log("RB INDEX FUNCTION TEST READY");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
