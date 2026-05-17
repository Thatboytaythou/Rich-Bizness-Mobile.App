/* =========================
   /core/pages/auth.js
========================= */

import {
  initAuthUI
} from "/core/features/auth/auth-ui.js";

import {
  blockSession
} from "/core/features/auth/session-guard.js";

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);

  const next =
    params.get("next") ||
    params.get("redirect") ||
    "/profile";

  if (next.startsWith("http")) {
    return "/profile";
  }

  return next;
}

async function bootAuthPage() {
  const redirectTo = getRedirectTarget();

  /* TEMP DISABLE SESSION BLOCK */
  // await blockSession({
  //   redirectTo
  // });

  await initAuthUI();

  document.body.classList.add("rb-auth-ready");

  console.log("RB AUTH PAGE READY");
}

bootAuthPage();
