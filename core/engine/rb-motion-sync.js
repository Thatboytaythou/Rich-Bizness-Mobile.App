/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-motion-sync.js

   MOTION SYNC ENGINE
   Owns movement only
   Synced to rb-section-state
========================= */

import {
  getActiveSection,
  onSectionChange
} from "/core/shared/rb-section-state.js";

const portal = document.querySelector(".rb-core-portal");
const stage = document.querySelector(".rb-portal-stage");

let mouseX = 0;
let mouseY = 0;
let smoothX = 0;
let smoothY = 0;

let orbitRotation = 0;
let targetRotation = 0;

let activeSectionKey = getActiveSection()?.key || "live";

function getScreens() {
  return [...document.querySelectorAll(".rb-tv-screen")];
}

function updatePointer(x, y) {
  mouseX = x / window.innerWidth - 0.5;
  mouseY = y / window.innerHeight - 0.5;
}

function syncTargetRotation() {
  const screens = getScreens();
  const activeIndex = screens.findIndex(
    (screen) => screen.dataset.rbSection === activeSectionKey
  );

  if (activeIndex < 0 || !screens.length) return;

  const step = 360 / screens.length;

  targetRotation = 90 - activeIndex * step;
}

window.addEventListener("mousemove", (event) => {
  updatePointer(event.clientX, event.clientY);
});

window.addEventListener("touchmove", (event) => {
  const touch = event.touches?.[0];
  if (!touch) return;

  updatePointer(touch.clientX, touch.clientY);
}, { passive: true });

onSectionChange((section) => {
  activeSectionKey = section.key;
  syncTargetRotation();
});

function animate() {
  const screens = getScreens();

  smoothX += (mouseX - smoothX) * 0.04;
  smoothY += (mouseY - smoothY) * 0.04;

  orbitRotation += (targetRotation - orbitRotation) * 0.055;

  if (stage) {
    stage.style.transform = `
      perspective(1600px)
      rotateX(${smoothY * -2.5}deg)
      rotateY(${smoothX * 4}deg)
      translate3d(${smoothX * 5}px, ${smoothY * 4}px, 0)
    `;
  }

  if (portal) {
    const portalFloat = Math.sin(Date.now() * 0.0012) * 5;

    portal.style.transform = `
      translate(-50%, -50%)
      translate3d(
        ${smoothX * -8}px,
        calc(${portalFloat}px + ${smoothY * -6}px),
        0
      )
      scale(${1 + Math.sin(Date.now() * 0.001) * 0.012})
    `;
  }

  screens.forEach((screen, index) => {
    const total = screens.length || 1;
    const angle = (360 / total) * index + orbitRotation;
    const radians = angle * (Math.PI / 180);

    const isMobile = window.innerWidth <= 720;

    const radiusX = isMobile ? 105 : 210;
    const radiusY = isMobile ? 70 : 120;

    const x = Math.cos(radians) * radiusX;
    const y = Math.sin(radians) * radiusY;

    const depth = Math.sin(radians);
    const frontAmount = (depth + 1) / 2;

    const isActive = screen.dataset.rbSection === activeSectionKey;

    const scale =
      0.62 +
      frontAmount * 0.14 +
      (isActive ? 0.03 : 0);

    const opacity =
      0.26 +
      frontAmount * 0.42 +
      (isActive ? 0.22 : 0);

    const brightness =
      0.7 +
      frontAmount * 0.34 +
      (isActive ? 0.16 : 0);

    const blur = isActive ? 0 : (1 - frontAmount) * 1.7;
    const zDepth = depth * 45 + (isActive ? 8 : 0);

    screen.style.zIndex = String(
      Math.floor(frontAmount * 100) + (isActive ? 100 : 0)
    );

    screen.style.opacity = String(Math.min(opacity, 1));

    screen.style.filter = `
      brightness(${brightness})
      blur(${blur}px)
      saturate(${1.08 + frontAmount * 0.2})
    `;

    screen.style.transform = `
      translate(-50%, -50%)
      translate3d(
        calc(${x}px + ${smoothX * 8}px),
        calc(${y}px + ${smoothY * 6}px),
        ${zDepth}px
      )
      rotateY(${depth * -10}deg)
      rotateX(${smoothY * -4}deg)
      scale(${scale})
    `;
  });

  requestAnimationFrame(animate);
}

syncTargetRotation();
animate();

document.body.classList.add("rb-motion-sync-loaded");

console.log("RB MOTION SYNC READY");
