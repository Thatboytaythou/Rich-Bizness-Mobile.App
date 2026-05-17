/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-motion-sync.js

   STABLE ORBIT ENGINE
   Movement only
========================= */

import {
  getActiveSectionKey,
  onSectionChange
} from "/core/shared/rb-section-state.js";

const screens = [...document.querySelectorAll(".rb-tv-screen")];

let currentRotation = 0;
let targetRotation = 0;

function isMobile(){
  return window.innerWidth <= 720;
}

function getRadius(){
  return isMobile() ? 150 : 270;
}

function rotateToSection(key){
  const index = screens.findIndex(
    (screen) => screen.dataset.rbSection === key
  );

  if (index < 0 || !screens.length) return;

  targetRotation =
    -((Math.PI * 2) / screens.length) * index;
}

function updateOrbit(){
  const radius = getRadius();
  const total = screens.length || 1;

  screens.forEach((screen, index) => {
    const angle =
      ((Math.PI * 2) / total) * index + currentRotation;

    const x = Math.sin(angle) * radius;
    const y = Math.cos(angle) * radius * 0.32;
    const depth = Math.cos(angle);
    const front = (depth + 1) / 2;

    const scale = isMobile()
      ? 0.58 + front * 0.34
      : 0.62 + front * 0.38;

    const opacity = 0.28 + front * 0.62;

    screen.style.transform = `
      translate3d(${x}px, ${y}px, 0)
      scale(${scale})
    `;

    screen.style.opacity = String(opacity);
    screen.style.zIndex = String(Math.floor(front * 4) + 1);

    screen.style.filter = `
      brightness(${0.72 + front * 0.38})
      saturate(${1.05 + front * 0.22})
      blur(${(1 - front) * 1.1}px)
    `;
  });
}

function animate(){
  currentRotation +=
    (targetRotation - currentRotation) * 0.075;

  updateOrbit();
  requestAnimationFrame(animate);
}

onSectionChange((section) => {
  rotateToSection(section.key);
});

rotateToSection(getActiveSectionKey());
updateOrbit();
animate();

document.body.classList.add("rb-motion-ready");

console.log("RB MOTION SYNC READY");
