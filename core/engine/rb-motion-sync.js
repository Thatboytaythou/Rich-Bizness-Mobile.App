/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-motion-sync.js

   MOTION SYNC ENGINE
   Stage-size math version
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updatePointer(x, y) {
  mouseX = x / window.innerWidth - 0.5;
  mouseY = y / window.innerHeight - 0.5;
}

function getOrbitMath() {
  const rect = stage?.getBoundingClientRect();

  const width = rect?.width || window.innerWidth;
  const height = rect?.height || window.innerHeight;

  const isMobile = window.innerWidth <= 720;

  return {
    radiusX: isMobile
      ? clamp(width * 0.24, 118, 148)
      : clamp(width * 0.22, 170, 240),

    radiusY: isMobile
      ? clamp(height * 0.075, 58, 82)
      : clamp(height * 0.095, 76, 120),

    centerX: 0,

    centerY: isMobile
      ? clamp(height * -0.145, -112, -82)
      : clamp(height * -0.12, -104, -68),

    baseScale: isMobile ? 0.56 : 0.62,
    scaleRange: isMobile ? 0.16 : 0.18,

    zRange: isMobile ? 36 : 52
  };
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
  const orbit = getOrbitMath();

  smoothX += (mouseX - smoothX) * 0.035;
  smoothY += (mouseY - smoothY) * 0.035;

  orbitRotation += 0.032;

  if (stage) {
    stage.style.transform = `
      perspective(1600px)
      rotateX(${smoothY * -1.6}deg)
      rotateY(${smoothX * 2.4}deg)
      translate3d(${smoothX * 2.5}px, ${smoothY * 2}px, 0)
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

    const depth = Math.sin(radians);
    const frontAmount = (depth + 1) / 2;

    const x = orbit.centerX + Math.cos(radians) * orbit.radiusX;
    const y = orbit.centerY + Math.sin(radians) * orbit.radiusY;

    const scale = orbit.baseScale + frontAmount * orbit.scaleRange;
    const opacity = 0.24 + frontAmount * 0.56;
    const brightness = 0.68 + frontAmount * 0.36;
    const blur = (1 - frontAmount) * 1.35;
    const zDepth = depth * orbit.zRange;

    screen.style.zIndex = String(Math.floor(frontAmount * 60) + 6);
    screen.style.opacity = String(Math.min(opacity, 0.9));

    screen.style.filter = `
      brightness(${brightness})
      blur(${blur}px)
      saturate(${1.05 + frontAmount * 0.2})
    `;

    screen.style.transform = `
      translate(-50%, -50%)
      translate3d(
        calc(${x}px + ${smoothX * 3}px),
        calc(${y}px + ${smoothY * 2}px),
        ${zDepth}px
      )
      rotateY(${depth * -8}deg)
      rotateX(${smoothY * -2}deg)
      scale(${scale})
    `;
  });

  requestAnimationFrame(animate);
}

animate();

document.body.classList.add("rb-motion-sync-loaded");

console.log("RB MOTION SYNC STAGE-MATH READY");
