/* =========================
   RICH BIZNESS MOBILE
   /core/pages/messages.js

   MESSAGES FOUNDATION CONTROLLER
   Correct Guard Import Locked
========================= */

import {
  autoGuardCurrentPage
} from "/core/features/auth/session-guard.js";

import {
  initAuthState,
  onAuthState
} from "/core/features/auth/auth-state.js";

import {
  profileName,
  profileAvatar
} from "/core/shared/rb-profile.js";

const $ = (id) => document.getElementById(id);

const els = {
  name: $("messages-user-name"),
  avatar: $("messages-user-avatar"),
  status: $("messages-status")
};

/* =========================
   PAINT
========================= */

function paintMessages(state) {
  const profile = state?.profile || null;

  if (els.name) {
    els.name.textContent = profileName(profile);
  }

  if (els.avatar) {
    els.avatar.src = profileAvatar(profile);
  }

  if (els.status) {
    els.status.textContent =
      "Messages foundation online.";
  }
}

/* =========================
   BOOT
========================= */

async function bootMessagesPage() {
  await autoGuardCurrentPage();

  const state = await initAuthState();

  paintMessages(state);

  onAuthState((nextState) => {
    paintMessages(nextState);
  });

  document.body.classList.add(
    "rb-messages-ready"
  );

  console.log(
    "RB MESSAGES FOUNDATION READY"
  );
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    bootMessagesPage
  );
} else {
  bootMessagesPage();
}
