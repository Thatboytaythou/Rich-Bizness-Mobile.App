/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-motion-sync.js
   MOTION SYNC ENGINE
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
      rotateX(${smoothY * -5}deg)
      rotateY(${smoothX * 8}deg)
      translate3d(${smoothX * 10}px, ${smoothY * 8}px, 0)
    `;
  }

  if (portal) {
    const portalFloat = Math.sin(orbitRotation * 0.012) * 8;

    portal.style.transform = `
      translate3d(${smoothX * -16}px, calc(${portalFloat}px + ${smoothY * -12}px), 0)
      scale(${1 + Math.sin(orbitRotation * 0.01) * 0.02})
    `;
  }

  screens.forEach((screen, index) => {
    const total = screens.length || 1;
    const angle = (360 / total) * index + orbitRotation;
    const radians = angle * (Math.PI / 180);
    const radius = window.innerWidth <= 720 ? 215 : 285;

    const x = Math.cos(radians) * radius;
    const y = Math.sin(radians) * radius * 0.48;
    const depth = Math.sin(radians);

    const scale = 0.72 + (depth + 1) * 0.22;
    const brightness = 0.65 + (depth + 1) * 0.28;
    const blur = Math.max(0, (1 - depth) * 1.2);

    screen.style.zIndex = Math.floor((depth + 1) * 100);
    screen.style.opacity = 0.42 + (depth + 1) * 0.38;

    screen.style.filter = `
      brightness(${brightness})
      blur(${blur}px)
      saturate(${1.15 + depth * 0.18})
    `;

    screen.style.transform = `
      translate3d(
        calc(${x}px + ${smoothX * 18}px),
        calc(${y}px + ${smoothY * 14}px),
        ${depth * 180}px
      )
      rotateY(${depth * -28}deg)
      rotateX(${smoothY * -12}deg)
      scale(${scale})
    `;
  });

  requestAnimationFrame(animate);
}

animate();

document.body.classList.add("rb-motion-sync-loaded");

console.log("RB MOTION SYNC READY");
