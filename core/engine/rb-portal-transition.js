/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-portal-transition.js

   PORTAL TRANSITION ENGINE
   Reacts to rb-section-state only
========================= */

import {
  getActiveSection,
  onSectionChange
} from "/core/shared/rb-section-state.js";

const portal = document.querySelector(".rb-core-portal");
const stage = document.querySelector(".rb-portal-stage");

const title = document.getElementById("rb-active-title");
const label = document.getElementById("rb-active-label");
const meta = document.getElementById("rb-active-meta");

function getScreens() {
  return [...document.querySelectorAll(".rb-tv-screen")];
}

function pulseScreens() {
  getScreens().forEach((screen, index) => {
    setTimeout(() => {
      screen.classList.add("rb-tv-react");

      setTimeout(() => {
        screen.classList.remove("rb-tv-react");
      }, 700);
    }, index * 60);
  });
}

function flashPortal() {
  if (!portal) return;

  portal.classList.add("rb-portal-transition");

  setTimeout(() => {
    portal.classList.remove("rb-portal-transition");
  }, 900);
}

function waveStage() {
  if (!stage) return;

  stage.classList.add("rb-stage-wave");

  setTimeout(() => {
    stage.classList.remove("rb-stage-wave");
  }, 1400);
}

function paintSection(section) {
  if (!section) return;

  document.body.dataset.activeSection = section.key;

  title?.classList.add("rb-text-switch");
  meta?.classList.add("rb-text-switch");

  setTimeout(() => {
    if (label) label.textContent = section.label;
    if (title) title.textContent = section.title;
    if (meta) meta.textContent = section.meta;

    title?.classList.remove("rb-text-switch");
    meta?.classList.remove("rb-text-switch");
  }, 180);

  document.querySelectorAll("[data-rb-route]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.rbRoute === section.key
    );
  });

  document.querySelectorAll(".rb-tv-screen").forEach((screen) => {
    screen.classList.toggle(
      "is-active",
      screen.dataset.rbSection === section.key
    );
  });

  flashPortal();
  waveStage();
  pulseScreens();
}

onSectionChange((section) => {
  paintSection(section);
});

paintSection(getActiveSection());

document.body.classList.add("rb-portal-transition-loaded");

console.log("RB PORTAL TRANSITION ENGINE READY");
