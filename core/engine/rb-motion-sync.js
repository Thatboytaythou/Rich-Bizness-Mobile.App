/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-motion-sync.js

   MOTION SYNC ENGINE
   Owns movement only
   Orbit depth clamped
========================= */

const portal = document.querySelector(".rb-core-portal");
const stage = document.querySelector(".rb-portal-stage");

let mouseX = 0;
let mouseY = 0;
let smoothX = 0;
let smoothY = 0;
let orbitRotation = 0;

function getScreens() {
  return [...document.querySelectorAll(".rb-tv-screen")];
}

function updatePointer(x, y) {
  mouseX = x / window.innerWidth - 0.5;
  mouseY = y / window.innerHeight - 0.5;
}

window.addEventListener("mousemove", (e) => {
  updatePointer(e.clientX, e.clientY);
});

window.addEventListener("touchmove", (e) => {
  const touch = e.touches?.[0];
  if (!touch) return;

  updatePointer(touch.clientX, touch.clientY);
}, { passive: true });

function animate() {
  const screens = getScreens();

  smoothX += (mouseX - smoothX) * 0.045;
  smoothY += (mouseY - smoothY) * 0.045;

  orbitRotation += 0.065;

  if (stage) {
    stage.style.transform = `
      perspective(1600px)
      rotateX(${smoothY * -3}deg)
      rotateY(${smoothX * 5}deg)
      translate3d(${smoothX * 6}px, ${smoothY * 5}px, 0)
    `;
  }

  if (portal) {
    const portalFloat = Math.sin(orbitRotation * 0.014) * 6;

    portal.style.transform = `
      translate(-50%, -50%)
      translate3d(${smoothX * -10}px, calc(${portalFloat}px + ${smoothY * -8}px), 0)
      scale(${1 + Math.sin(orbitRotation * 0.012) * 0.014})
    `;
  }

  screens.forEach((screen, index) => {
    const total = screens.length || 1;
    const angle = (360 / total) * index + orbitRotation;
    const radians = angle * (Math.PI / 180);

    const isMobile = window.innerWidth <= 720;

    const radiusX = isMobile ? 138 : 230;
    const radiusY = isMobile ? 58 : 96;

    const x = Math.cos(radians) * radiusX;
    const y = Math.sin(radians) * radiusY;

    const depth = Math.sin(radians);

    const frontAmount = Math.max(0, depth);
    const backAmount = Math.max(0, -depth);

    const scale =
      0.72 +
      frontAmount * 0.22 -
      backAmount * 0.04;

    const opacity =
      0.08 +
      frontAmount * 0.72;

    const brightness =
      0.58 +
      frontAmount * 0.52;

    const blur =
      backAmount * 3.6 +
      (1 - frontAmount) * 0.6;

    const zDepth =
      frontAmount * 90 -
      backAmount * 120;

    screen.style.zIndex = String(
      Math.floor(frontAmount * 100)
    );

    screen.style.opacity = String(opacity);

    screen.style.filter = `
      brightness(${brightness})
      blur(${blur}px)
      saturate(${1.05 + frontAmount * 0.28})
    `;

    screen.style.transform = `
      translate(-50%, -50%)
      translate3d(
        calc(${x}px + ${smoothX * 10}px),
        calc(${y}px + ${smoothY * 8}px),
        ${zDepth}px
      )
      rotateY(${depth * -12}deg)
      rotateX(${smoothY * -5}deg)
      scale(${scale})
    `;
  });

  requestAnimationFrame(animate);
}

animate();

document.body.classList.add("rb-motion-sync-loaded");

console.log("RB MOTION SYNC READY");
