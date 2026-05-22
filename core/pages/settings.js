/* =========================
   RICH BIZNESS MOBILE
   /core/pages/settings.js
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import { rbSignOut } from "/core/shared/rb-auth.js";

import { RB_ROUTES } from "/core/shared/rb-config.js";

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

function paintSettings() {
  const state = getCurrentUserState();
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
    window.location.href = RB_ROUTES.edit || "/edit";
  });

  els.profileBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.profile || "/profile";
  });

  els.signOutBtn?.addEventListener("click", async () => {
    try {
      await rbSignOut({
        redirectTo: RB_ROUTES.auth || "/auth"
      });

      toastInfo("Signed out.");
    } catch (error) {
      console.error("[settings.js]", error);
      toastError(error?.message || "Sign out failed.");
    }
  });
}

async function bootSettingsPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    paintSettings();
    bindSettingsActions();

    document.body.classList.add("rb-settings-ready");

    markPageReady("settings");

    console.log("RB SETTINGS READY");
  } catch (error) {
    console.error("[settings.js]", error);
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSettingsPage);
} else {
  bootSettingsPage();
}
