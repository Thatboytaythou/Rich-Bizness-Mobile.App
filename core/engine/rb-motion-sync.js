/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-motion-sync.js

   MOTION SYNC ENGINE
   Owns movement only
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

  orbitRotation += 0.08;

  if (stage) {
    stage.style.transform = `
      perspective(1600px)
      rotateX(${smoothY * -4}deg)
      rotateY(${smoothX * 6}deg)
      translate3d(${smoothX * 8}px, ${smoothY * 6}px, 0)
    `;
  }

  if (portal) {
    const portalFloat = Math.sin(orbitRotation * 0.012) * 8;

    portal.style.transform = `
      translate(-50%, -50%)
      translate3d(${smoothX * -12}px, calc(${portalFloat}px + ${smoothY * -10}px), 0)
      scale(${1 + Math.sin(orbitRotation * 0.01) * 0.018})
    `;
  }

  screens.forEach((screen, index) => {
    const total = screens.length || 1;
    const angle = (360 / total) * index + orbitRotation;
    const radians = angle * (Math.PI / 180);

    const radius = window.innerWidth <= 720 ? 185 : 260;

    const x = Math.cos(radians) * radius;
    const y = Math.sin(radians) * radius * 0.52;
    const depth = Math.sin(radians);

    const scale = 0.72 + (depth + 1) * 0.18;
    const brightness = 0.72 + (depth + 1) * 0.22;
    const blur = Math.max(0, (1 - depth) * 0.85);

    screen.style.zIndex = Math.floor((depth + 1) * 100);
    screen.style.opacity = 0.45 + (depth + 1) * 0.32;

    screen.style.filter = `
      brightness(${brightness})
      blur(${blur}px)
      saturate(${1.12 + depth * 0.14})
    `;

    screen.style.transform = `
      translate(-50%, -50%)
      translate3d(
        calc(${x}px + ${smoothX * 14}px),
        calc(${y}px + ${smoothY * 10}px),
        ${depth * 80}px
      )
      rotateY(${depth * -16}deg)
      rotateX(${smoothY * -7}deg)
      scale(${scale})
    `;
  });

  requestAnimationFrame(animate);
}

animate();

document.body.classList.add("rb-motion-sync-loaded");

console.log("RB MOTION SYNC READY");
