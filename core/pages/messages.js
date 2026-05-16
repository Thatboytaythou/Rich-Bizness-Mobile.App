/* =========================
   RICH BIZNESS MOBILE
   /core/pages/messages.js

   MESSAGES FOUNDATION CONTROLLER
========================= */

import {
  autoGuardCurrentPage
} from "/core/shared/rb-guards.js";

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

function paintMessages(state) {
  const profile = state?.profile;

  if (els.name) {
    els.name.textContent = profileName(profile);
  }

  if (els.avatar) {
    els.avatar.src = profileAvatar(profile);
  }

  if (els.status) {
    els.status.textContent = "Messages foundation online.";
  }
}

async function bootMessagesPage() {
  await autoGuardCurrentPage();

  const state = await initAuthState();

  paintMessages(state);

  onAuthState((nextState) => {
    paintMessages(nextState);
  });

  document.body.classList.add("rb-messages-ready");

  console.log("RB MESSAGES FOUNDATION READY");
}

bootMessagesPage();
