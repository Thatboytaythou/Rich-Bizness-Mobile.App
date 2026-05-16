/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-depth.js

   TRUE DEPTH ENGINE
========================= */

const stage = document.querySelector(".rb-portal-stage");

if (!stage) {
  console.warn("RB DEPTH: stage missing");
}

const depthLayers = [
  ...document.querySelectorAll(".rb-tv-screen"),
  document.querySelector(".rb-core-portal"),
  document.querySelector(".rb-portal-ring"),
  document.querySelector(".rb-portal-ring-two"),
  document.querySelector(".rb-portal-copy")
].filter(Boolean);

let pointerX = 0;
let pointerY = 0;

let currentX = 0;
let currentY = 0;

const isMobile =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/* =========================
   POINTER DEPTH
========================= */

function updatePointer(clientX, clientY) {
  const x = clientX / window.innerWidth - 0.5;
  const y = clientY / window.innerHeight - 0.5;

  pointerX = x;
  pointerY = y;
}

window.addEventListener("mousemove", (e) => {
  updatePointer(e.clientX, e.clientY);
});

/* =========================
   MOBILE GYRO
========================= */

if (isMobile && window.DeviceOrientationEvent) {
  window.addEventListener("deviceorientation", (e) => {
    const gamma = (e.gamma || 0) / 45;
    const beta = (e.beta || 0) / 45;

    pointerX = gamma * 0.55;
    pointerY = beta * 0.28;
  });
}

/* =========================
   DEPTH LOOP
========================= */

function depthLoop() {
  currentX += (pointerX - currentX) * 0.055;
  currentY += (pointerY - currentY) * 0.055;

  depthLayers.forEach((layer, index) => {
    const depth = (index + 1) * 10;

    const rotateY = currentX * depth;
    const rotateX = currentY * depth * -1;

    const moveX = currentX * depth * 1.4;
    const moveY = currentY * depth * 1.2;

    layer.style.transform += `
      translate3d(${moveX}px, ${moveY}px, 0)
      rotateY(${rotateY}deg)
      rotateX(${rotateX}deg)
    `;
  });

  requestAnimationFrame(depthLoop);
}

depthLoop();

/* =========================
   CINEMATIC CAMERA SHAKE
========================= */

const shell = document.querySelector(".rb-home-shell");

let drift = 0;

function ambientDrift() {
  drift += 0.0035;

  const driftX = Math.sin(drift) * 4;
  const driftY = Math.cos(drift * 0.7) * 3;

  if (shell) {
    shell.style.transform = `
      translate3d(${driftX}px, ${driftY}px, 0)
    `;
  }

  requestAnimationFrame(ambientDrift);
}

ambientDrift();

/* =========================
   LIGHT REACTION
========================= */

const portal = document.querySelector(".rb-core-portal");

function updateLighting() {
  if (!portal) return;

  const glowX = 50 + currentX * 40;
  const glowY = 50 + currentY * 40;

  portal.style.background = `
    radial-gradient(
      circle at ${glowX}% ${glowY}%,
      rgba(255,215,106,.28),
      rgba(0,255,136,.18) 28%,
      rgba(0,0,0,.92) 75%
    )
  `;

  requestAnimationFrame(updateLighting);
}

updateLighting();

/* =========================
   TV SCREEN DEPTH STAGGER
========================= */

document.querySelectorAll(".rb-tv-screen").forEach((screen, i) => {
  screen.style.zIndex = 10 + i;

  const randomDelay = i * 0.18;

  screen.animate(
    [
      {
        transform: `
          translateY(0px)
          scale(1)
        `
      },
      {
        transform: `
          translateY(-8px)
          scale(1.025)
        `
      },
      {
        transform: `
          translateY(0px)
          scale(1)
        `
      }
    ],
    {
      duration: 4000 + i * 250,
      iterations: Infinity,
      easing: "ease-in-out",
      delay: randomDelay * 1000
    }
  );
});

/* =========================
   DEPTH READY
========================= */

document.body.classList.add("rb-depth-loaded");

console.log("RB TRUE DEPTH ENGINE READY");
