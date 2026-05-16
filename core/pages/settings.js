/* =========================
   RICH BIZNESS MOBILE
   /core/pages/settings.js

   SETTINGS FOUNDATION CONTROLLER
========================= */

import {
  autoGuardCurrentPage
} from "/core/shared/rb-guards.js";

import {
  initAuthState,
  getAuthState,
  onAuthState
} from "/core/features/auth/auth-state.js";

import {
  rbSignOut
} from "/core/shared/rb-auth.js";

import {
  toastInfo,
  toastError
} from "/core/shared/rb-toast.js";

const $ = (id) => document.getElementById(id);

const els = {
  email: $("settings-email"),
  role: $("settings-role"),
  status: $("settings-status"),
  editBtn: $("settings-edit-btn"),
  profileBtn: $("settings-profile-btn"),
  signOutBtn: $("settings-signout-btn")
};

function paintSettings(state) {
  const user = state?.user;
  const profile = state?.profile;

  if (els.email) {
    els.email.textContent = user?.email || "Guest";
  }

  if (els.role) {
    els.role.textContent = profile?.role || "user";
  }

  if (els.status) {
    els.status.textContent = profile?.is_verified
      ? "Verified"
      : "Standard";
  }
}

function bindSettingsActions() {
  els.editBtn?.addEventListener("click", () => {
    window.location.href = "/edit";
  });

  els.profileBtn?.addEventListener("click", () => {
    window.location.href = "/profile";
  });

  els.signOutBtn?.addEventListener("click", async () => {
    try {
      await rbSignOut({ redirectTo: "/auth" });
      toastInfo("Signed out.");
    } catch (error) {
      toastError(error.message || "Sign out failed.");
    }
  });
}

async function bootSettingsPage() {
  await autoGuardCurrentPage();

  const state = await initAuthState();

  paintSettings(state);

  onAuthState((nextState) => {
    paintSettings(nextState);
  });

  bindSettingsActions();

  document.body.classList.add("rb-settings-ready");

  console.log("RB SETTINGS FOUNDATION READY");
}

bootSettingsPage();
