/* =========================
   RICH BIZNESS MOBILE
   /core/pages/auth.js

   AUTH PAGE CONTROLLER
========================= */

import {
  initAuthUI
} from "/core/features/auth/auth-ui.js";

import {
  blockSession
} from "/core/features/auth/session-guard.js";

/* =========================
   BOOT
========================= */

async function bootAuthPage() {
  await blockSession({
    redirectTo: "/"
  });

  await initAuthUI();

  document.body.classList.add("rb-auth-ready");

  console.log("RB AUTH PAGE READY");
}

bootAuthPage();
