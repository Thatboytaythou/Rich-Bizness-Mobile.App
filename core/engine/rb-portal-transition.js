/* =========================
   RICH BIZNESS MOBILE
   PORTAL TRANSITION ENGINE
   /core/engine/rb-portal-transition.js
========================= */

const body = document.body;

const portal = document.querySelector(".rb-core-portal");
const stage = document.querySelector(".rb-portal-stage");

const title = document.getElementById("rb-active-title");
const label = document.getElementById("rb-active-label");
const meta = document.getElementById("rb-active-meta");

const navButtons = [
  ...document.querySelectorAll("[data-rb-route]")
];

const sectionData = {
  feed: {
    label: "FEED",
    title: "Global Feed",
    meta: "Posts • Drops • Community",
    mood: "feed"
  },

  live: {
    label: "LIVE",
    title: "Go Live",
    meta: "Broadcast • VIP • Realtime",
    mood: "live"
  },

  music: {
    label: "MUSIC",
    title: "Music Universe",
    meta: "Tracks • Podcast • Radio",
    mood: "music"
  },

  gaming: {
    label: "GAMES",
    title: "Arcade District",
    meta: "Chess • Runner • Scores",
    mood: "gaming"
  },

  meta: {
    label: "META",
    title: "Meta World",
    meta: "Avatars • Worlds • Portals",
    mood: "meta"
  }
};

let activeRoute = "live";

/* =========================
   TV REACTION
========================= */

function pulseScreens() {
  document
    .querySelectorAll(".rb-tv-screen")
    .forEach((screen, i) => {
      setTimeout(() => {
        screen.classList.add("rb-tv-react");

        setTimeout(() => {
          screen.classList.remove("rb-tv-react");
        }, 700);
      }, i * 60);
    });
}

/* =========================
   PORTAL FLASH
========================= */

function flashPortal() {
  portal?.classList.add("rb-portal-transition");

  setTimeout(() => {
    portal?.classList.remove("rb-portal-transition");
  }, 900);
}

/* =========================
   STAGE WAVE
========================= */

function waveStage() {
  stage?.classList.add("rb-stage-wave");

  setTimeout(() => {
    stage?.classList.remove("rb-stage-wave");
  }, 1400);
}

/* =========================
   SWITCH SECTION
========================= */

function setSection(route) {
  const data = sectionData[route];
  if (!data) return;

  activeRoute = route;

  body.dataset.activeSection = data.mood;

  title.classList.add("rb-text-switch");
  meta.classList.add("rb-text-switch");

  setTimeout(() => {
    label.textContent = data.label;
    title.textContent = data.title;
    meta.textContent = data.meta;

    title.classList.remove("rb-text-switch");
    meta.classList.remove("rb-text-switch");
  }, 220);

  navButtons.forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.dataset.rbRoute === route
    );
  });

  flashPortal();
  waveStage();
  pulseScreens();
}

/* =========================
   NAV EVENTS
========================= */

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const route = btn.dataset.rbRoute;

    if (route === activeRoute) return;

    setSection(route);
  });
});

/* =========================
   AUTO WORLD SHIFT
========================= */

const autoModes = [
  "live",
  "music",
  "gaming",
  "meta",
  "feed"
];

let autoIndex = 0;

setInterval(() => {
  autoIndex++;

  if (autoIndex >= autoModes.length) {
    autoIndex = 0;
  }

  setSection(autoModes[autoIndex]);
}, 14000);

/* =========================
   INIT
========================= */

setSection("live");

console.log(
  "RB PORTAL TRANSITION ENGINE READY"
);
