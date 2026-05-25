/* =========================================
   RICH BIZNESS LLC
   /core/pages/settings.js

   SETTINGS PAGE CONTROLLER
   Synced with auth + profile-state
========================================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  rbSignOut,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  refreshProfileState,
  onProfileState
} from "/core/features/profile/profile-state.js";

import {
  profileName,
  profileHandle,
  profileAvatar,
  profileBadge
} from "/core/shared/rb-profile.js";

import {
  toastInfo,
  toastError
} from "/core/shared/rb-toast.js";

const $ = (id) => document.getElementById(id);

const els = {
  email: $("settings-email"),
  role: $("settings-role"),
  status: $("settings-status"),
  name: $("settings-name"),
  handle: $("settings-handle"),
  avatar: $("settings-avatar"),
  badge: $("settings-badge"),
  editBtn: $("settings-edit-btn"),
  profileBtn: $("settings-profile-btn"),
  signOutBtn: $("settings-signout-btn")
};

let actionsBound = false;

/* ======================
   RENDERING
====================== */

function paintSettings() {
  const state = getCurrentUserState();
  const user = state?.user || null;
  const profile = state?.profile || null;

  if (els.email) {
    els.email.textContent = user?.email || "Guest Mode";
  }

  if (els.name) {
    els.name.textContent = profileName(profile);
  }

  if (els.handle) {
    els.handle.textContent = profileHandle(profile);
  }

  if (els.avatar) {
    const avatarUrl = profileAvatar(profile);

    if (els.avatar.tagName === "IMG") {
      els.avatar.src = avatarUrl;
      els.avatar.alt = profileName(profile);
    } else {
      els.avatar.style.backgroundImage = `url("${avatarUrl}")`;
    }
  }

  if (els.badge) {
    els.badge.textContent = profileBadge(profile);
  }

  if (els.role) {
    els.role.textContent = String(profile?.role || "user").toUpperCase();
  }

  if (els.status) {
    const role = profile?.role || "user";

    if (profile?.is_verified) {
      els.status.textContent = "✅ Verified";
      els.status.style.color = "#66ff99";
    } else if (profile?.is_creator || profile?.is_artist || profile?.is_seller) {
      els.status.textContent = "Creator Access";
      els.status.style.color = "";
    } else if (["admin", "owner", "super_admin", "founder", "rich_admin"].includes(role)) {
      els.status.textContent = "Admin Access";
      els.status.style.color = "#ffd86b";
    } else {
      els.status.textContent = "Standard Member";
      els.status.style.color = "";
    }
  }
}

/* ======================
   ACTIONS
====================== */

function bindSettingsActions() {
  if (actionsBound) return;
  actionsBound = true;

  els.editBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.edit || "/edit";
  });

  els.profileBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.profile || "/profile";
  });

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
      console.error("[RB SETTINGS SIGNOUT FAILED]", error);
      toastError(error?.message || "Sign out failed.");

      els.signOutBtn.disabled = false;
      els.signOutBtn.textContent = "Sign Out";
    }
  });
}

/* ======================
   BOOT
====================== */

async function bootSettingsPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    await ensureMyProfile();
    await refreshProfileState();
    await refreshAppIdentity();

    paintSettings();
    bindSettingsActions();

    onProfileState((profileState) => {
      if (!profileState.ready) return;
      paintSettings();
    });

    document.body.classList.add("rb-settings-ready");

    markPageReady("settings");

    console.log("RB SETTINGS PAGE READY");
  } catch (error) {
    console.error("[RB SETTINGS BOOT FAILED]", error);
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSettingsPage);
} else {
  bootSettingsPage();
}
