/* =========================
   RICH BIZNESS MOBILE
   /core/pages/notifications.js

   NOTIFICATIONS FOUNDATION CONTROLLER
========================= */

import {
  autoGuardCurrentPage
} from "/core/shared/rb-guards.js";

import {
  initAuthState,
  onAuthState
} from "/core/features/auth/auth-state.js";

import {
  profileName
} from "/core/shared/rb-profile.js";

const $ = (id) => document.getElementById(id);

const els = {
  title: $("notifications-title"),
  status: $("notifications-status"),
  list: $("notifications-list")
};

function paintNotifications(state) {
  const profile = state?.profile;

  if (els.title) {
    els.title.textContent =
      `${profileName(profile)} Notifications`;
  }

  if (els.status) {
    els.status.textContent =
      "Realtime notification system foundation online.";
  }

  if (els.list) {
    els.list.innerHTML = `
      <article class="rb-notification-card">
        <strong>System Ready</strong>
        <p>
          Your Rich Bizness notification engine
          is connected to the identity layer.
        </p>
      </article>
    `;
  }
}

async function bootNotificationsPage() {
  await autoGuardCurrentPage();

  const state = await initAuthState();

  paintNotifications(state);

  onAuthState((nextState) => {
    paintNotifications(nextState);
  });

  document.body.classList.add("rb-notifications-ready");

  console.log("RB NOTIFICATIONS FOUNDATION READY");
}

bootNotificationsPage();
