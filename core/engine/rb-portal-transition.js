/* =========================
   RICH BIZNESS MOBILE
   /core/engine/rb-portal-transition.js

   PORTAL TRANSITION ENGINE
   Owns:
   - portal text updates
   - nav active states
   - TV active class
   - transition reaction classes

   Does NOT own:
   - TV movement
   - orbit math
   - portal positioning
   - route navigation
========================= */

import {
  getActiveSection,
  onSectionChange
} from "/core/shared/rb-section-state.js";

/* =========================
   ELEMENTS
========================= */

const body = document.body;

const portal =
  document.querySelector(
    ".rb-core-portal"
  );

const stage =
  document.querySelector(
    ".rb-portal-stage"
  );

const label =
  document.getElementById(
    "rb-active-label"
  );

const title =
  document.getElementById(
    "rb-active-title"
  );

const meta =
  document.getElementById(
    "rb-active-meta"
  );

/* =========================
   HELPERS
========================= */

function getScreens() {
  return [
    ...document.querySelectorAll(
      ".rb-tv-screen"
    )
  ];
}

function getNavButtons() {
  return [
    ...document.querySelectorAll(
      "[data-rb-route]"
    )
  ];
}

function setText(section) {
  if (!section) return;

  label?.classList.add(
    "rb-text-switch"
  );

  title?.classList.add(
    "rb-text-switch"
  );

  meta?.classList.add(
    "rb-text-switch"
  );

  window.setTimeout(() => {
    if (label) {
      label.textContent =
        section.label;
    }

    if (title) {
      title.textContent =
        section.title;
    }

    if (meta) {
      meta.textContent =
        section.meta;
    }

    label?.classList.remove(
      "rb-text-switch"
    );

    title?.classList.remove(
      "rb-text-switch"
    );

    meta?.classList.remove(
      "rb-text-switch"
    );
  }, 160);
}

function setNavActive(section) {
  if (!section) return;

  getNavButtons().forEach(
    (button) => {
      button.classList.toggle(
        "active",
        button.dataset.rbRoute ===
          section.key
      );
    }
  );
}

function setScreenActive(section) {
  if (!section) return;

  getScreens().forEach((screen) => {
    screen.classList.toggle(
      "is-active",
      screen.dataset.rbSection ===
        section.key
    );
  });
}

function flashPortal() {
  if (!portal) return;

  portal.classList.add(
    "rb-portal-transition"
  );

  window.setTimeout(() => {
    portal.classList.remove(
      "rb-portal-transition"
    );
  }, 900);
}

function waveStage() {
  if (!stage) return;

  stage.classList.add(
    "rb-stage-wave"
  );

  window.setTimeout(() => {
    stage.classList.remove(
      "rb-stage-wave"
    );
  }, 1200);
}

function pulseScreens() {
  getScreens().forEach(
    (screen, index) => {
      window.setTimeout(() => {
        screen.classList.add(
          "rb-tv-react"
        );

        window.setTimeout(() => {
          screen.classList.remove(
            "rb-tv-react"
          );
        }, 650);
      }, index * 55);
    }
  );
}

/* =========================
   PAINT
========================= */

function paintSection(section) {
  if (!section) return;

  body.dataset.activeSection =
    section.key;

  setText(section);
  setNavActive(section);
  setScreenActive(section);

  flashPortal();
  waveStage();
  pulseScreens();
}

/* =========================
   LISTEN
========================= */

onSectionChange((section) => {
  paintSection(section);
});

/* =========================
   INIT
========================= */

paintSection(
  getActiveSection()
);

document.body.classList.add(
  "rb-portal-transition-loaded"
);

console.log(
  "RB PORTAL TRANSITION READY"
);
