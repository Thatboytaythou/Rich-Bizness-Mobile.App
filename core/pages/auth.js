/* =========================
   RICH BIZNESS MOBILE
   /core/pages/auth.js

   AUTH PAGE CONTROLLER
   No redirect fight
========================= */

import {
  initAuthUI
} from "/core/features/auth/auth-ui.js";

async function bootAuthPage() {
  await initAuthUI();

  document.body.classList.add("rb-auth-ready");

  console.log("RB AUTH PAGE READY");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootAuthPage);
} else {
  bootAuthPage();
}
