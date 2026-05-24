/* =========================================
   RICH BIZNESS MOBILE
   /core/pages/index.js
========================================= */

import "../engine/universe-preview.js";

/* =========================================
   ROUTES
========================================= */

window.RB_ROUTES = Object.freeze({
  feed: "/feed.html",
  music: "/music.html",
  live: "/live.html",
  gallery: "/gallery.html",
  podcast: "/podcast.html",
  radio: "/radio.html",
  gaming: "/gaming.html",
  upload: "/upload.html",
  sports: "/sports.html",
  meta: "/meta.html",
  store: "/store.html",

  profile: "/profile.html",

  admin: "/admin.html",
  creator: "/creator.html",
  watch: "/watch.html",
  alerts: "/notifications.html",
  settings: "/settings.html",
  edit: "/edit.html",
  notifications: "/notifications.html"
});

/* =========================================
   ORBIT TV CARDS
========================================= */

const ORBIT_SECTIONS = [
  {
    key: "music",
    title: "MUSIC",
    sub: "TRACKS",
    icon: "fa-solid fa-music",
    color: "#c084fc"
  },

  {
    key: "live",
    title: "LIVE",
    sub: "STREAM",
    icon: "fa-solid fa-broadcast-tower",
    color: "#ef4444"
  },

  {
    key: "gallery",
    title: "GALLERY",
    sub: "MEDIA",
    icon: "fa-solid fa-image",
    color: "#f472b6"
  },

  {
    key: "podcast",
    title: "PODCAST",
    sub: "SHOWS",
    icon: "fa-solid fa-microphone-lines",
    color: "#ec4899"
  },

  {
    key: "radio",
    title: "RADIO",
    sub: "STATION",
    icon: "fa-solid fa-radio",
    color: "#2dd4bf"
  },

  {
    key: "gaming",
    title: "GAMING",
    sub: "ARCADE",
    icon: "fa-solid fa-gamepad",
    color: "#22d3ee"
  },

  {
    key: "upload",
    title: "UPLOAD",
    sub: "CREATE",
    icon: "fa-solid fa-cloud-arrow-up",
    color: "#22c55e"
  },

  {
    key: "sports",
    title: "SPORTS",
    sub: "ZONE",
    icon: "fa-solid fa-football",
    color: "#fb923c"
  },

  {
    key: "feed",
    title: "FEED",
    sub: "SOCIAL",
    icon: "fa-solid fa-fire",
    color: "#4ade80"
  },

  {
    key: "meta",
    title: "META",
    sub: "WORLD",
    icon: "fa-solid fa-globe",
    color: "#38bdf8"
  },

  {
    key: "store",
    title: "STORE",
    sub: "MARKET",
    icon: "fa-solid fa-store",
    color: "#fbbf24"
  }
];

/* =========================================
   CREATE ORBIT
========================================= */

const orbitTrack = document.querySelector(".rb-orbit-track");

let orbitRotation = 0;

function createOrbitCards() {
  if (!orbitTrack) return;

  ORBIT_SECTIONS.forEach((section, index) => {
    const card = document.createElement("button");

    card.className = "rb-tv-card";
    card.type = "button";

    card.dataset.section = section.key;
    card.dataset.index = index;
    card.dataset.orbitReady = "true";

    card.innerHTML = `
      <div class="rb-tv-screen">
        <strong>${section.sub}</strong>

        <div class="rb-tv-icon">
          <i class="${section.icon}"></i>
        </div>

        <h2>${section.title}</h2>

        <p>RICH BIZNESS</p>
      </div>
    `;

    card.querySelector(".rb-tv-icon").style.boxShadow =
      `0 0 34px ${section.color}`;

    card.addEventListener("click", () => {
      navigate(section.key);
    });

    orbitTrack.appendChild(card);
  });
}

/* =========================================
   ORBIT ENGINE
========================================= */

function updateOrbit() {
  const cards = [...document.querySelectorAll(".rb-tv-card")];

  if (!cards.length) return;

  const radiusX =
    window.innerWidth <= 640
      ? 210
      : window.innerWidth <= 980
        ? 290
        : 420;

  const radiusY =
    window.innerWidth <= 640
      ? 180
      : window.innerWidth <= 980
        ? 240
        : 330;

  cards.forEach((card, index) => {
    const angle =
      ((Math.PI * 2) / cards.length) * index + orbitRotation;

    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;

    const scale =
      ((Math.sin(angle - Math.PI / 2) + 1) / 2) * 0.55 + 0.52;

    const depth =
      ((Math.sin(angle - Math.PI / 2) + 1) / 2);

    const opacity =
      0.32 + depth * 0.88;

    card.style.left = "50%";
    card.style.top = "50%";

    card.style.transform = `
      translate3d(
        calc(-50% + ${x}px),
        calc(-50% + ${y}px),
        0
      )
      scale(${scale})
    `;

    card.style.zIndex = Math.floor(depth * 100);

    card.style.opacity = opacity;

    card.style.filter = `
      blur(${(1 - depth) * 2}px)
      brightness(${0.6 + depth * 0.5})
    `;

    if (depth > 0.9) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });

  orbitRotation += 0.0028;

  requestAnimationFrame(updateOrbit);
}

/* =========================================
   NAVIGATION
========================================= */

function navigate(section) {
  const route = window.RB_ROUTES?.[section];

  if (!route) {
    console.warn("Missing route:", section);
    return;
  }

  window.location.href = route;
}

window.navigateUniverse = navigate;

/* =========================================
   SIDE TAB ACTIONS
========================================= */

document.querySelectorAll("[data-route]").forEach((button) => {
  button.addEventListener("click", () => {
    navigate(button.dataset.route);
  });
});

/* =========================================
   PARALLAX
========================================= */

const portal = document.querySelector(".rb-main-portal");

window.addEventListener("pointermove", (event) => {
  if (!portal) return;

  const x =
    (event.clientX / window.innerWidth - 0.5) * 12;

  const y =
    (event.clientY / window.innerHeight - 0.5) * 12;

  portal.style.transform = `
    translate3d(${x}px, ${y}px, 0)
  `;
}, { passive: true });

/* =========================================
   MOBILE SWIPE
========================================= */

let touchStartX = 0;

window.addEventListener("touchstart", (event) => {
  touchStartX = event.touches[0].clientX;
}, { passive: true });

window.addEventListener("touchmove", (event) => {
  const currentX = event.touches[0].clientX;

  const diff = currentX - touchStartX;

  orbitRotation += diff * 0.00002;

  touchStartX = currentX;
}, { passive: true });

/* =========================================
   LIVE PULSE
========================================= */

setInterval(() => {
  const activeCard =
    document.querySelector(".rb-tv-card.active");

  if (!activeCard) return;

  activeCard.animate(
    [
      {
        transform:
          activeCard.style.transform + " scale(1)"
      },

      {
        transform:
          activeCard.style.transform + " scale(1.04)"
      },

      {
        transform:
          activeCard.style.transform + " scale(1)"
      }
    ],
    {
      duration: 1200,
      easing: "ease-in-out"
    }
  );
}, 2600);

/* =========================================
   INIT
========================================= */

window.addEventListener("DOMContentLoaded", () => {
  createOrbitCards();
  updateOrbit();
});
