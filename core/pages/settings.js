/* =========================================
   RICH BIZNESS LLC
   /core/pages/settings.js
   SETTINGS PAGE CONTROLLER - POLISHED
========================================= */

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

/* ====================== RENDERING ====================== */

function paintSettings() {
  const state = getCurrentUserState();
  const user = state?.user || null;
  const profile = state?.profile || null;

  if (els.email) {
    els.email.textContent = user?.email || "Guest Mode";
  }

  if (els.role) {
    els.role.textContent = (profile?.role || "user").toUpperCase();
  }

  if (els.status) {
    if (profile?.is_verified) {
      els.status.textContent = "✅ Verified";
      els.status.style.color = "#66ff99";
    } else if (profile?.is_creator || profile?.is_artist || profile?.is_seller) {
      els.status.textContent = "Creator Access";
    } else {
      els.status.textContent = "Standard Member";
    }
  }
}

/* ====================== ACTIONS ====================== */

function bindSettingsActions() {
  // Edit Profile
  els.editBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.edit || "/edit";
  });

  // View Profile
  els.profileBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.profile || "/profile";
  });

  // Sign Out
  els.signOutBtn?.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to sign out?")) return;

    try {
      els.signOutBtn.disabled = true;
      els.signOutBtn.textContent = "Signing out...";

      await rbSignOut({
        redirectTo: RB_ROUTES.auth || "/auth"
      });

      toastInfo("Signed out successfully.");
    } catch (error) {
      console.error("[settings.js]", error);
      toastError(error?.message || "Sign out failed.");
      els.signOutBtn.disabled = false;
      els.signOutBtn.textContent = "Sign Out";
    }
  });
}

/* ====================== BOOT ====================== */

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

    console.log("🚀 RB SETTINGS PAGE READY");
  } catch (error) {
    console.error("[settings.js] Boot failed:", error);
    markPageError(error);
  }
}

// Initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSettingsPage);
} else {
  bootSettingsPage();
}
