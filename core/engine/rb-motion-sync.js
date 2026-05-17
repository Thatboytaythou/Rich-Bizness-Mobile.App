/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-motion-sync.js

   MOTION SYNC ENGINE
   Safe Orbit Version
   Owns movement only
   No active-section locking
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

  smoothX += (mouseX - smoothX) * 0.035;
  smoothY += (mouseY - smoothY) * 0.035;

  orbitRotation += 0.025;

  if (stage) {
    stage.style.transform = `
      perspective(1600px)
      rotateX(${smoothY * -1.4}deg)
      rotateY(${smoothX * 2.2}deg)
      translate3d(${smoothX * 2}px, ${smoothY * 2}px, 0)
    `;
  }

  if (portal) {
    const portalFloat = Math.sin(Date.now() * 0.001) * 3;

    portal.style.transform = `
      translate(-50%, -50%)
      translate3d(
        ${smoothX * -4}px,
        calc(${portalFloat}px + ${smoothY * -3}px),
        0
      )
      scale(${1 + Math.sin(Date.now() * 0.0009) * 0.008})
    `;
  }

  screens.forEach((screen, index) => {
    const total = screens.length || 1;
    const angle = (360 / total) * index + orbitRotation;
    const radians = angle * (Math.PI / 180);

    const isMobile = window.innerWidth <= 720;

    const radiusX = isMobile ? 82 : 170;
    const radiusY = isMobile ? 34 : 82;

    const centerX = 0;
    const centerY = isMobile ? -105 : -82;

    const x = centerX + Math.cos(radians) * radiusX;
    const y = centerY + Math.sin(radians) * radiusY;

    const depth = Math.sin(radians);
    const frontAmount = (depth + 1) / 2;

    const scale = isMobile
      ? 0.48 + frontAmount * 0.12
      : 0.58 + frontAmount * 0.16;

    const opacity = 0.18 + frontAmount * 0.46;
    const brightness = 0.64 + frontAmount * 0.34;
    const blur = (1 - frontAmount) * 1.8;
    const zDepth = depth * 22;

    screen.style.zIndex = String(Math.floor(frontAmount * 40) + 4);
    screen.style.opacity = String(Math.min(opacity, 0.82));

    screen.style.filter = `
      brightness(${brightness})
      blur(${blur}px)
      saturate(${1.05 + frontAmount * 0.18})
    `;

    screen.style.transform = `
      translate(-50%, -50%)
      translate3d(
        calc(${x}px + ${smoothX * 3}px),
        calc(${y}px + ${smoothY * 2}px),
        ${zDepth}px
      )
      rotateY(${depth * -7}deg)
      rotateX(${smoothY * -2}deg)
      scale(${scale})
    `;
  });

  requestAnimationFrame(animate);
}

animate();

document.body.classList.add("rb-motion-sync-loaded");

console.log("RB MOTION SYNC SAFE ORBIT READY");
