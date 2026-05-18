/* =========================
   RICH BIZNESS MOBILE
   /core/pages/settings.js

   SETTINGS CONTROLLER
   LOCKED TO /core/app.js
========================= */

import {
  initApp,
  markPageReady,
  markPageError
} from "/core/app.js";

import {
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

function paintSettings(state = getAuthState()) {
  const user = state?.user || null;
  const profile = state?.profile || null;

  if (els.email) {
    els.email.textContent = user?.email || "Guest";
  }

  if (els.role) {
    els.role.textContent = profile?.role || "user";
  }

  if (els.status) {
    if (profile?.is_verified) {
      els.status.textContent = "Verified";
    } else if (profile?.is_creator || profile?.is_artist || profile?.is_seller) {
      els.status.textContent = "Creator Access";
    } else {
      els.status.textContent = "Standard";
    }
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
      await rbSignOut({
        redirectTo: "/auth"
      });

      toastInfo("Signed out.");
    } catch (error) {
      console.error(error);

      toastError(
        error?.message ||
          "Sign out failed."
      );
    }
  });
}

async function bootSettingsPage() {
  try {
    const appState = await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    paintSettings(appState.auth);

    onAuthState((nextState) => {
      paintSettings(nextState);
    });

    bindSettingsActions();

    document.body.classList.add("rb-settings-ready");

    markPageReady("settings");

    console.log("RB SETTINGS READY");
  } catch (error) {
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSettingsPage);
} else {
  bootSettingsPage();
}
