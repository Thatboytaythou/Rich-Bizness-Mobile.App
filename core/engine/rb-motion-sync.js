/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-motion-sync.js

   MOTION SYNC ENGINE
   Owns movement only
   Balanced visible orbit
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

window.addEventListener("mousemove", (event) => {
  updatePointer(event.clientX, event.clientY);
});

window.addEventListener("touchmove", (event) => {
  const touch = event.touches?.[0];
  if (!touch) return;

  updatePointer(touch.clientX, touch.clientY);
}, { passive: true });

function animate() {
  const screens = getScreens();

  smoothX += (mouseX - smoothX) * 0.04;
  smoothY += (mouseY - smoothY) * 0.04;

  orbitRotation += 0.045;

  if (stage) {
    stage.style.transform = `
      perspective(1600px)
      rotateX(${smoothY * -2.5}deg)
      rotateY(${smoothX * 4}deg)
      translate3d(${smoothX * 5}px, ${smoothY * 4}px, 0)
    `;
  }

  if (portal) {
    const portalFloat = Math.sin(orbitRotation * 0.014) * 5;

    portal.style.transform = `
      translate(-50%, -50%)
      translate3d(
        ${smoothX * -8}px,
        calc(${portalFloat}px + ${smoothY * -6}px),
        0
      )
      scale(${1 + Math.sin(orbitRotation * 0.012) * 0.012})
    `;
  }

  screens.forEach((screen, index) => {
    const total = screens.length || 1;
    const angle = (360 / total) * index + orbitRotation;
    const radians = angle * (Math.PI / 180);

    const isMobile = window.innerWidth <= 720;

    const radiusX = isMobile ? 135 : 280;
    const radiusY = isMobile ? 92 : 155;

    const x = Math.cos(radians) * radiusX;
    const y = Math.sin(radians) * radiusY;

    const depth = Math.sin(radians);

    const frontAmount = (depth + 1) / 2;

    const scale = 0.72 + frontAmount * 0.22;
    const opacity = 0.34 + frontAmount * 0.46;
    const brightness = 0.72 + frontAmount * 0.38;
    const blur = (1 - frontAmount) * 1.8;
    const zDepth = depth * 85;

    screen.style.zIndex = String(
      Math.floor(frontAmount * 100)
    );

    screen.style.opacity = String(opacity);

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

animate();

document.body.classList.add("rb-motion-sync-loaded");

console.log("RB MOTION SYNC READY");
