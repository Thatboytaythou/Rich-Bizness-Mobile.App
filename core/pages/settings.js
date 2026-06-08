/* =========================================
   RICH BIZNESS LLC
   /core/pages/settings.js

   SETTINGS PAGE CONTROLLER
   Direct Supabase Settings Render
   Profile Lock + Auth + Realtime Settings

   Flow:
   - Settings reads current user/profile
   - Settings does not depend on profile-state feature
   - Realtime watches profiles + optional user_settings
   - Sign out clears realtime first
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
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  rbSignOut,
  getUser,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  profileName,
  profileHandle,
  profileAvatar,
  profileBadge,
  bindProfileShell
} from "/core/shared/rb-profile.js";

import {
  toastError
} from "/core/shared/rb-toast.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";

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

let supabase = null;
let channel = null;
let actionsBound = false;
let currentUser = null;
let currentProfile = null;

function table(key, fallback) {
  return RB_TABLES?.[key] || fallback || key;
}

function safeImage(value = "", fallback = DEFAULT_AVATAR) {
  const src = String(value || "").trim();

  if (!src || src.includes("project-avatar")) return fallback;

  if (
    src.startsWith("/") ||
    src.startsWith("https://") ||
    src.startsWith("http://") ||
    src.startsWith("blob:")
  ) {
    return src;
  }

  return fallback;
}

function setText(el, value) {
  if (el) el.textContent = value ?? "";
}

function setImage(el, url, alt = "") {
  if (!el) return;

  const finalUrl = safeImage(url, DEFAULT_AVATAR);

  if (el.tagName === "IMG") {
    el.src = finalUrl;
    el.alt = alt || "Settings avatar";
    return;
  }

  el.style.backgroundImage = `url("${finalUrl}")`;
}

function syncState() {
  const appState = getCurrentUserState?.() || {};

  currentUser = appState.user || getUser?.() || null;
  currentProfile = appState.profile || currentProfile || null;
}

async function fetchMyProfile() {
  const user = getUser?.() || currentUser;

  if (!user?.id) {
    currentUser = null;
    currentProfile = null;
    return null;
  }

  const { data, error } = await supabase
    .from(table("profiles", "profiles"))
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  currentUser = user;
  currentProfile = data || null;

  return currentProfile;
}

function paintSettings() {
  const user = currentUser || getUser?.();
  const profile = currentProfile || {};

  const role = profile?.role || "user";
  const displayName = profileName(profile);
  const handle = profileHandle(profile);
  const avatar = safeImage(profileAvatar(profile), DEFAULT_AVATAR);

  setText(els.email, user?.email || "Guest Mode");
  setText(els.name, displayName);
  setText(els.handle, handle);
  setText(els.badge, profileBadge(profile));
  setText(els.role, String(role).toUpperCase());

  setImage(els.avatar, avatar, displayName);

  if (els.status) {
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

  bindProfileShell?.();
}

async function refreshSettingsIdentity() {
  await refreshAppIdentity();
  syncState();
  await fetchMyProfile();
  paintSettings();
}

function clearRealtime() {
  if (!channel || !supabase) return;

  supabase.removeChannel(channel);
  channel = null;
}

function bindRealtime() {
  const user = currentUser || getUser?.();

  if (!user?.id || !supabase) return;

  clearRealtime();

  channel = supabase
    .channel(`rb-settings-${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("profiles", "profiles"),
        filter: `id=eq.${user.id}`
      },
      refreshSettingsIdentity
    );

  const userSettingsTable = table("userSettings", "user_settings");

  if (userSettingsTable) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: userSettingsTable,
        filter: `user_id=eq.${user.id}`
      },
      refreshSettingsIdentity
    );
  }

  channel.subscribe();
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

      clearRealtime();

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
      ensureProfile: true
    });

    supabase = getSupabase();

    await ensureMyProfile();
    await refreshAppIdentity();

    syncState();
    await fetchMyProfile();

    paintSettings();
    bindSettingsActions();
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
