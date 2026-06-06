/* =========================================
   RICH BIZNESS LLC
   /core/pages/settings.js

   SETTINGS PAGE CONTROLLER
   Profile Lock + Auth + Realtime Settings
   Uses locked rb-supabase.js client
========================================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

import {
  RB_ROUTES,
  RB_TABLES,
  RB_PROFILE_KEYS
} from "/core/shared/rb-config.js";

import {
  createRealtimeChannel,
  removeRealtimeChannel
} from "/core/shared/rb-supabase.js";

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
  signOutBtn: $("settings-signout-btn"),
  syncStatus: $("settings-sync-status"),
  profileLock: $("settings-profile-lock")
};

let channel = null;
let actionsBound = false;

function state() {
  return getCurrentUserState?.() || {};
}

function currentUser() {
  return state().user || null;
}

function currentProfile() {
  return state().profile || null;
}

function setText(el, value) {
  if (el) el.textContent = value ?? "";
}

function setImage(el, url, alt = "") {
  if (!el || !url) return;

  if (el.tagName === "IMG") {
    el.src = url;
    el.alt = alt;
    return;
  }

  el.style.backgroundImage = `url("${url}")`;
}

function paintSettings() {
  const user = currentUser();
  const profile = currentProfile();

  setText(els.email, user?.email || "Guest Mode");
  setText(els.name, profileName(profile));
  setText(els.handle, profileHandle(profile));
  setText(els.badge, profileBadge(profile));
  setText(els.role, String(profile?.role || "user").toUpperCase());

  setImage(
    els.avatar,
    profileAvatar(profile),
    profileName(profile)
  );

  if (els.status) {
    const role = profile?.role || "user";

    els.status.style.color = "";

    if (profile?.is_verified) {
      els.status.textContent = "✅ Verified";
      els.status.style.color = "#66ff99";
    } else if (
      ["admin", "owner", "super_admin", "founder", "rich_admin"].includes(role)
    ) {
      els.status.textContent = "Admin Access";
      els.status.style.color = "#ffd86b";
    } else if (profile?.is_creator || profile?.is_artist || profile?.is_seller) {
      els.status.textContent = "Creator Access";
    } else {
      els.status.textContent = "Standard Member";
    }
  }

  setText(
    els.syncStatus,
    profile?.id ? "Settings synced" : "Waiting for profile"
  );

  setText(
    els.profileLock,
    profile?.id
      ? `Profile locked through ${RB_PROFILE_KEYS?.identitySource || "profiles"}`
      : "Profile lock required"
  );
}

async function refreshSettingsIdentity() {
  await refreshProfileState();
  await refreshAppIdentity();
  paintSettings();
}

async function clearRealtime() {
  if (!channel) return;

  await removeRealtimeChannel(channel);
  channel = null;
}

function bindRealtime() {
  const user = currentUser();
  if (!user?.id) return;

  clearRealtime();

  channel = createRealtimeChannel(`rb-settings-${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.profiles,
        filter: `id=eq.${user.id}`
      },
      refreshSettingsIdentity
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.userSettings,
        filter: `user_id=eq.${user.id}`
      },
      refreshSettingsIdentity
    )
    .subscribe();
}

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
    const confirmSignOut = window.confirm("Are you sure you want to sign out?");
    if (!confirmSignOut) return;

    try {
      els.signOutBtn.disabled = true;
      els.signOutBtn.textContent = "Signing out...";

      await clearRealtime();

      await rbSignOut({
        redirectTo: RB_ROUTES.auth || "/auth"
      });
    } catch (error) {
      console.error("[RB SETTINGS SIGNOUT FAILED]", error);
      toastError(error?.message || "Sign out failed.");

      els.signOutBtn.disabled = false;
      els.signOutBtn.textContent = "Sign Out";
    }
  });

  window.addEventListener("beforeunload", clearRealtime);
}

async function bootSettingsPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false,
      ensureProfile: true,
      profileState: true
    });

    await ensureMyProfile();
    await refreshProfileState();
    await refreshAppIdentity();

    paintSettings();
    bindSettingsActions();

    onProfileState((profileState) => {
      if (!profileState?.ready) return;
      paintSettings();
    });

    bindRealtime();

    document.body.dataset.rbPage = "settings";
    document.body.dataset.rbRoute = "settings";
    document.body.dataset.rbProfileLock = "true";
    document.body.classList.add("rb-settings-ready");

    markPageReady("settings");

    console.log("RB SETTINGS PAGE READY");
  } catch (error) {
    console.error("[RB SETTINGS BOOT FAILED]", error);
    markPageError(error);
    toastError(error?.message || "Settings failed to load.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSettingsPage);
} else {
  bootSettingsPage();
}
