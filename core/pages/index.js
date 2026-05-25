/* =========================
   RICH BIZNESS MOBILE
   core/pages/index.js
========================= */

import RB_CONFIG from "/core/shared/rb-config.js";

function goToSection(section) {
  const key = String(section || "").toLowerCase();
  const route = RB_CONFIG.routes?.[key];

  if (!route) {
    console.warn("Missing route for section:", key);
    return;
  }

  document.body.dataset.activeSection = key;
  window.location.href = route;
}

function bootIndexPage() {
  window.RB_CONFIG = RB_CONFIG;
  window.goToSection = goToSection;
}

document.addEventListener("DOMContentLoaded", bootIndexPage);

export { goToSection };
