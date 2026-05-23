/* =========================================
   RICH BIZNESS LLC
   /core/pages/index.js
   INDEX UNIVERSE CONTROLLER
   No imports. No Supabase. No freeze.
========================================= */

const RB_SECTIONS = [
  {
    key: "feed",
    label: "FEED",
    title: "Global Feed",
    meta: "DISCOVER",
    route: "/feed"
  },
  {
    key: "live",
    label: "LIVE",
    title: "Go Live",
    meta: "LIVE STREAM",
    route: "/live"
  },
  {
    key: "music",
    label: "MUSIC",
    title: "Music",
    meta: "UNIVERSE",
    route: "/music"
  },
  {
    key: "gaming",
    label: "GAMING",
    title: "Gaming",
    meta: "PLAY",
    route: "/gaming"
  },
  {
    key: "sports",
    label: "SPORTS",
    title: "Sports",
    meta: "ACTION",
    route: "/sports"
  },
  {
    key: "gallery",
    label: "GALLERY",
    title: "Gallery",
    meta: "SHOWCASE",
    route: "/gallery"
  },
  {
    key: "store",
    label: "STORE",
    title: "The Store",
    meta: "SHOP",
    route: "/store"
  },
  {
    key: "meta",
    label: "META",
    title: "Meta",
    meta: "WORLD",
    route: "/meta"
  },
  {
    key: "upload",
    label: "UPLOAD",
    title: "Upload Content",
    meta: "SHARE YOUR WORLD",
    route: "/upload"
  }
];

const $ = (id) => document.getElementById(id);

let activeKey = document.body.dataset.activeSection || "live";

function getSection(key = activeKey) {
  return RB_SECTIONS.find((section) => section.key === key) || RB_SECTIONS[1];
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function setActiveSection(key) {
  const section = getSection(key);

  activeKey = section.key;
  document.body.dataset.activeSection = section.key;

  document.querySelectorAll("[data-section]").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.section === section.key);
  });

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === section.key);
  });

  setText("rb-active-label", section.label);
  setText("rb-active-title", section.title);
  setText("rb-active-meta", section.meta);
  setText("rb-launch-section", `ENTER ${section.label} →`);
}

function goTo(path) {
  if (!path) return;
  window.location.href = path;
}

function launchActiveSection() {
  goTo(getSection().route);
}

function bindIndexClicks() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;

    if (target.dataset.section) {
      event.preventDefault();
      setActiveSection(target.dataset.section);
      return;
    }

    if (target.dataset.route) {
      event.preventDefault();
      setActiveSection(target.dataset.route);
      return;
    }

    if (target.id === "rb-launch-section") {
      event.preventDefault();
      launchActiveSection();
      return;
    }

    if (target.id === "rb-open-upload") {
      event.preventDefault();
      setActiveSection("upload");
      return;
    }

    if (target.id === "rb-create-channel") {
      event.preventDefault();
      goTo("/profile");
      return;
    }

    if (target.id === "rb-open-profile") {
      event.preventDefault();
      goTo("/auth");
    }
  });
}

function bindKeyboard() {
  document.addEventListener("keydown", (event) => {
    const currentIndex = RB_SECTIONS.findIndex((section) => section.key === activeKey);

    if (event.key === "ArrowRight") {
      const next = RB_SECTIONS[(currentIndex + 1) % RB_SECTIONS.length];
      setActiveSection(next.key);
    }

    if (event.key === "ArrowLeft") {
      const prev = RB_SECTIONS[(currentIndex - 1 + RB_SECTIONS.length) % RB_SECTIONS.length];
      setActiveSection(prev.key);
    }

    if (event.key === "Enter") {
      launchActiveSection();
    }
  });
}

function paintStats() {
  setText("rb-stat-members", "10M+");
  setText("rb-stat-creators", "500K+");
  setText("rb-stat-live", "100K+");
  setText("rb-stat-active", "1M+");
}

function bootIndex() {
  setActiveSection(activeKey);
  paintStats();
  bindIndexClicks();
  bindKeyboard();

  document.body.classList.add("rb-index-ready");
  console.log("RB INDEX READY");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootIndex);
} else {
  bootIndex();
}
