/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-tv-orbit.js

   ROTATING HD TV ORBIT ENGINE
========================= */

const orbit = document.querySelector("#rb-tv-orbit");
const screens = [...document.querySelectorAll(".rb-tv-screen")];

if (!orbit || !screens.length) {
  console.warn("RB TV ORBIT: missing orbit/screens");
}

let angleOffset = 0;
let speed = 0.045;
let paused = false;

function setScreenPosition(screen, index) {
  const total = screens.length;
  const angle = (360 / total) * index + angleOffset;
  const radius = window.innerWidth <= 420 ? 210 : window.innerWidth <= 720 ? 235 : 285;

  const depth = Math.sin((angle * Math.PI) / 180);
  const scale = 0.82 + (depth + 1) * 0.12;
  const opacity = 0.55 + (depth + 1) * 0.22;
  const z = Math.round((depth + 1) * 100);

  screen.style.transform = `
    translate(-50%, -50%)
    rotate(${angle}deg)
    translateY(-${radius}px)
    rotate(${-angle}deg)
    rotateX(${8 + depth * 8}deg)
    rotateY(${depth * -18}deg)
    scale(${scale})
  `;

  screen.style.opacity = opacity;
  screen.style.zIndex = z;
  screen.style.filter = `brightness(${0.85 + (depth + 1) * 0.18}) saturate(${1.1 + (depth + 1) * 0.15})`;
}

function orbitLoop() {
  if (!paused) {
    angleOffset += speed;
  }

  screens.forEach(setScreenPosition);

  requestAnimationFrame(orbitLoop);
}

screens.forEach((screen) => {
  screen.addEventListener("mouseenter", () => {
    paused = true;
    screen.classList.add("is-focused");
  });

  screen.addEventListener("mouseleave", () => {
    paused = false;
    screen.classList.remove("is-focused");
  });

  screen.addEventListener("touchstart", () => {
    paused = true;
    screen.classList.add("is-focused");
  }, { passive: true });

  screen.addEventListener("touchend", () => {
    paused = false;
    screen.classList.remove("is-focused");
  }, { passive: true });
});

orbitLoop();

document.body.classList.add("rb-tv-orbit-loaded");

console.log("RB TV ORBIT ENGINE READY");
