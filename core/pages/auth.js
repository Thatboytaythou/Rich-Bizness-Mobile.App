/* =========================
   RICH BIZNESS MOBILE
   /core/pages/auth.js

   AUTH PAGE CONTROLLER
   Confirmation + Redirect Locked
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
    "/";

  if (!next || next.startsWith("http")) {
    return "/";
  }

  return next;
}

function isAuthCallback() {
  const params = new URLSearchParams(window.location.search);

  return (
    params.has("code") ||
    params.has("token_hash") ||
    params.has("access_token") ||
    params.has("refresh_token") ||
    params.has("type")
  );
}

async function bootAuthPage() {
  const redirectTo = getRedirectTarget();

  await initAuthUI();

  if (!isAuthCallback()) {
    await blockSession({
      redirectTo
    });
  }

  if (isAuthCallback()) {
    window.setTimeout(() => {
      window.location.href = redirectTo;
    }, 900);
  }

  document.body.classList.add("rb-auth-ready");

  console.log("RB AUTH PAGE READY");
}

bootAuthPage();
