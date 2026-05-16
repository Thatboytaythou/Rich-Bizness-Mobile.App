/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-camera-parallax.js

   CINEMATIC CAMERA PARALLAX
========================= */

const shell = document.querySelector(".rb-home-shell");
const stage = document.querySelector(".rb-portal-stage");
const portal = document.querySelector(".rb-core-portal");
const orbit = document.querySelector("#rb-tv-orbit");
const screens = [...document.querySelectorAll(".rb-tv-screen")];

let targetX = 0;
let targetY = 0;

let currentX = 0;
let currentY = 0;

function setTargetFromPoint(x, y) {
  targetX = (x / window.innerWidth - 0.5) * 2;
  targetY = (y / window.innerHeight - 0.5) * 2;
}

window.addEventListener("pointermove", (event) => {
  setTargetFromPoint(event.clientX, event.clientY);
});

window.addEventListener("touchmove", (event) => {
  const touch = event.touches?.[0];
  if (!touch) return;

  setTargetFromPoint(touch.clientX, touch.clientY);
}, { passive: true });

function parallaxLoop() {
  currentX += (targetX - currentX) * 0.045;
  currentY += (targetY - currentY) * 0.045;

  const camX = currentX * 10;
  const camY = currentY * 8;

  if (shell) {
    shell.style.setProperty("--rb-cam-x", `${camX}px`);
    shell.style.setProperty("--rb-cam-y", `${camY}px`);
  }

  if (stage) {
    stage.style.transform = `
      perspective(1200px)
      rotateX(${currentY * -3}deg)
      rotateY(${currentX * 4}deg)
      translate3d(${currentX * 4}px, ${currentY * 3}px, 0)
    `;
  }

  if (portal) {
    portal.style.setProperty("--rb-parallax-x", `${currentX * 16}px`);
    portal.style.setProperty("--rb-parallax-y", `${currentY * 14}px`);
  }

  if (orbit) {
    orbit.style.setProperty("--rb-orbit-x", `${currentX * -10}px`);
    orbit.style.setProperty("--rb-orbit-y", `${currentY * -8}px`);
  }

  screens.forEach((screen, index) => {
    screen.style.setProperty("--rb-depth-x", `${currentX * (index + 2)}px`);
    screen.style.setProperty("--rb-depth-y", `${currentY * (index + 2)}px`);
  });

  requestAnimationFrame(parallaxLoop);
}

parallaxLoop();

document.body.classList.add("rb-camera-parallax-loaded");

console.log("RB CAMERA PARALLAX READY");
