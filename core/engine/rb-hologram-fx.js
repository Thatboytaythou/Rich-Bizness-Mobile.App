/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-hologram-fx.js

   HOLOGRAM FX ENGINE
   Owns FX only.
   No movement.
   No routing.
   No section state.
========================= */

const stage = document.querySelector(".rb-portal-stage");
const portal = document.querySelector(".rb-core-portal");

function getScreens() {
  return [
    ...document.querySelectorAll(".rb-tv-screen")
  ];
}

function createFxLayer(className) {
  if (!stage) return null;

  const existing = stage.querySelector(`.${className}`);
  if (existing) return existing;

  const layer = document.createElement("div");
  layer.className = className;
  layer.setAttribute("aria-hidden", "true");

  stage.appendChild(layer);

  return layer;
}

const sparkLayer = createFxLayer("rb-holo-spark-layer");

createFxLayer("rb-holo-scan-layer");
createFxLayer("rb-holo-fog-layer");

function spawnSpark() {
  if (!sparkLayer) return;

  const spark = document.createElement("span");
  spark.className = "rb-holo-spark";

  const x = 35 + Math.random() * 30;
  const y = 22 + Math.random() * 58;
  const size = 2 + Math.random() * 5;

  spark.style.left = `${x}%`;
  spark.style.top = `${y}%`;
  spark.style.width = `${size}px`;
  spark.style.height = `${size}px`;
  spark.style.animationDuration = `${1.4 + Math.random() * 1.8}s`;

  sparkLayer.appendChild(spark);

  window.setTimeout(() => {
    spark.remove();
  }, 3200);
}

function pulseScreens() {
  getScreens().forEach((screen, index) => {
    window.setTimeout(() => {
      screen.classList.add("rb-holo-pulse");

      window.setTimeout(() => {
        screen.classList.remove("rb-holo-pulse");
      }, 600);
    }, index * 140);
  });
}

function randomGlitch() {
  const screens = getScreens();

  if (!screens.length) return;

  const screen =
    screens[Math.floor(Math.random() * screens.length)];

  screen.classList.add("rb-holo-glitch");

  window.setTimeout(() => {
    screen.classList.remove("rb-holo-glitch");
  }, 360);
}

function portalFlash() {
  if (!portal) return;

  portal.classList.add("rb-portal-flash");

  window.setTimeout(() => {
    portal.classList.remove("rb-portal-flash");
  }, 520);
}

window.setInterval(spawnSpark, 260);
window.setInterval(randomGlitch, 4200);
window.setInterval(pulseScreens, 6800);
window.setInterval(portalFlash, 5600);

document.body.classList.add("rb-hologram-loaded");

console.log("RB HOLOGRAM FX READY");
