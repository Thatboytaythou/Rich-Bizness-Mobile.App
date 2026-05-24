const RB_ROUTES = Object.freeze({
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
  notifications: "/notifications.html",
  settings: "/settings.html",
  edit: "/edit.html",
  auth: "/auth.html"
});

window.RB_ROUTES = RB_ROUTES;

function goToSection(key) {
  const route = RB_ROUTES[key];

  if (!route) {
    console.warn("Missing Rich Bizness route:", key);
    return;
  }

  window.location.href = route;
}

window.goToSection = goToSection;

document.querySelectorAll("[data-route]").forEach((button) => {
  button.addEventListener("click", () => {
    goToSection(button.dataset.route);
  });
});

const orbitTrack = document.getElementById("rbOrbitTrack");
let orbitAngle = 0;
let dragStartX = 0;
let isDragging = false;

function updateOrbit() {
  if (!orbitTrack) return;

  const cards = Array.from(orbitTrack.querySelectorAll(".rb-tv-card"));
  const count = cards.length;

  const stageWidth = orbitTrack.offsetWidth || window.innerWidth;
  const isPhone = window.innerWidth <= 520;
  const isTablet = window.innerWidth > 520 && window.innerWidth <= 900;

  const radiusX = isPhone ? 150 : isTablet ? 235 : 340;
  const radiusY = isPhone ? 92 : isTablet ? 126 : 168;

  cards.forEach((card, index) => {
    const angle = orbitAngle + (index / count) * Math.PI * 2;

    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;

    const frontDepth = (Math.sin(angle) + 1) / 2;
    const scale = 0.64 + frontDepth * 0.44;
    const opacity = 0.42 + frontDepth * 0.58;
    const blur = (1 - frontDepth) * 1.1;

    card.style.left = "50%";
    card.style.top = "50%";
    card.style.transform = `
      translate(-50%, -50%)
      translate(${x}px, ${y}px)
      scale(${scale})
    `;
    card.style.zIndex = String(Math.round(frontDepth * 100));
    card.style.opacity = String(opacity);
    card.style.filter = `blur(${blur}px) brightness(${0.72 + frontDepth * 0.48})`;

    if (frontDepth > 0.88) {
      card.classList.add("is-front");
    } else {
      card.classList.remove("is-front");
    }
  });

  orbitAngle += 0.0022;
  requestAnimationFrame(updateOrbit);
}

function setupSwipeOrbit() {
  window.addEventListener(
    "pointerdown",
    (event) => {
      isDragging = true;
      dragStartX = event.clientX;
    },
    { passive: true }
  );

  window.addEventListener(
    "pointermove",
    (event) => {
      if (!isDragging) return;

      const diff = event.clientX - dragStartX;
      orbitAngle += diff * 0.0025;
      dragStartX = event.clientX;
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerup",
    () => {
      isDragging = false;
    },
    { passive: true }
  );

  window.addEventListener(
    "pointercancel",
    () => {
      isDragging = false;
    },
    { passive: true }
  );
}

window.addEventListener("DOMContentLoaded", () => {
  setupSwipeOrbit();
  updateOrbit();
});
