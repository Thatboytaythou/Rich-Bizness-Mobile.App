/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-motion-sync.js

   FINAL LOCKED ORBIT ENGINE
   Stable Mobile Math
========================= */

import {
  getSections,
  getActiveSectionKey,
  setActiveSection
} from "/core/shared/rb-section-state.js";

const orbit =
  document.getElementById("rb-tv-orbit");

if (!orbit) {
  console.warn(
    "[RB MOTION] Missing #rb-tv-orbit"
  );
}

const screens = [
  ...document.querySelectorAll(".rb-tv-screen")
];

const MOBILE_BREAKPOINT = 768;

let currentRotation = 0;
let targetRotation = 0;
let animationFrame = null;

/* =========================
   MOBILE DETECTION
========================= */

function isMobile() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

/* =========================
   RADIUS
========================= */

function getRadius() {
  if (isMobile()) {
    return Math.min(
      window.innerWidth * 0.38,
      170
    );
  }

  return Math.min(
    window.innerWidth * 0.24,
    320
  );
}

/* =========================
   SCREEN SIZE
========================= */

function getScreenSize() {
  if (isMobile()) {
    return {
      width: 108,
      height: 132
    };
  }

  return {
    width: 180,
    height: 220
  };
}

/* =========================
   POSITION ORBIT
========================= */

function updateOrbit() {
  if (!orbit) return;

  const radius = getRadius();

  const {
    width,
    height
  } = getScreenSize();

  const total = screens.length;

  screens.forEach((screen, index) => {
    const angle =
      ((Math.PI * 2) / total) * index +
      currentRotation;

    const x =
      Math.sin(angle) * radius;

    const y =
      Math.cos(angle) * radius * 0.28;

    const depth =
      Math.cos(angle);

    const scale =
      0.72 + ((depth + 1) / 2) * 0.48;

    const opacity =
      0.22 + ((depth + 1) / 2) * 0.78;

    const zIndex =
      Math.floor((depth + 1) * 100);

    screen.style.width =
      `${width}px`;

    screen.style.height =
      `${height}px`;

    screen.style.transform = `
      translate3d(
        ${x}px,
        ${y}px,
        0
      )
      scale(${scale})
    `;

    screen.style.opacity =
      opacity;

    screen.style.zIndex =
      zIndex;

    screen.style.filter = `
      blur(${(1 - depth) * 1.2}px)
      brightness(${0.75 + ((depth + 1) / 2) * 0.4})
    `;

    screen.classList.toggle(
      "is-front",
      depth > 0.92
    );
  });
}

/* =========================
   ACTIVE SECTION
========================= */

function syncActiveSection() {
  let bestScreen = null;
  let bestDepth = -999;

  screens.forEach((screen, index) => {
    const angle =
      ((Math.PI * 2) / screens.length) * index +
      currentRotation;

    const depth =
      Math.cos(angle);

    if (depth > bestDepth) {
      bestDepth = depth;
      bestScreen = screen;
    }
  });

  if (!bestScreen) return;

  const key =
    bestScreen.dataset.rbSection;

  setActiveSection(key);

  screens.forEach((screen) => {
    screen.classList.toggle(
      "is-active",
      screen === bestScreen
    );
  });
}

/* =========================
   ROTATION ENGINE
========================= */

function animate() {
  currentRotation +=
    (targetRotation - currentRotation) *
    0.08;

  updateOrbit();
  syncActiveSection();

  animationFrame =
    requestAnimationFrame(animate);
}

/* =========================
   ROTATE TO SCREEN
========================= */

function rotateToSection(key) {
  const index =
    screens.findIndex(
      (screen) =>
        screen.dataset.rbSection === key
    );

  if (index === -1) return;

  const total = screens.length;

  targetRotation =
    -((Math.PI * 2) / total) * index;
}

/* =========================
   BUTTON EVENTS
========================= */

function bindButtons() {
  screens.forEach((screen) => {
    screen.addEventListener(
      "click",
      () => {
        const key =
          screen.dataset.rbSection;

        rotateToSection(key);
      }
    );
  });

  const nextBtn =
    document.getElementById(
      "rb-rotate-next"
    );

  const prevBtn =
    document.getElementById(
      "rb-rotate-prev"
    );

  nextBtn?.addEventListener(
    "click",
    () => {
      targetRotation -=
        (Math.PI * 2) /
        screens.length;
    }
  );

  prevBtn?.addEventListener(
    "click",
    () => {
      targetRotation +=
        (Math.PI * 2) /
        screens.length;
    }
  );

  document.querySelectorAll(
    "[data-rb-route]"
  ).forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        rotateToSection(
          button.dataset.rbRoute
        );
      }
    );
  });
}

/* =========================
   RESIZE
========================= */

window.addEventListener(
  "resize",
  () => {
    updateOrbit();
  }
);

/* =========================
   INITIAL
========================= */

rotateToSection(
  getActiveSectionKey()
);

bindButtons();
updateOrbit();

cancelAnimationFrame(
  animationFrame
);

animate();

document.body.classList.add(
  "rb-motion-ready"
);

console.log(
  "RB MOTION SYNC READY"
);
