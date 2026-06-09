/* =========================================
   RICH BIZNESS LLC
   /core/pages/settings.js

   SETTINGS PAGE CONTROLLER
   Direct Supabase Settings Render
   Profile Lock + Auth + Realtime Settings
   XP Gauge Enabled

   Flow:
   - Settings reads current user/profile
   - Settings does not depend on profile-state feature
   - Realtime watches profiles + optional user_settings
   - Sign out clears realtime first
   - No project-avatar fallback
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
  getProfileIdentity,
  bindProfileShell,
  buildProfileUrl
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
  profileLock: $("settings-profile-lock"),

  xpGauge: $("settings-xp-gauge"),
  xpFill: $("settings-xp-gauge-fill"),
  xpText: $("settings-xp-gauge-text"),
  xpNext: $("settings-xp-gauge-next"),
  xpLevel: $("settings-xp-level"),
  xpRank: $("settings-xp-rank")
};

let supabase = null;
let channel = null;
let actionsBound = false;
let currentUser = null;
let currentProfile = null;
let identity = null;

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

/* =========================
   XP GAUGE
========================= */

function getProfileXpModel(profile = {}, profileIdentity = {}) {
  const rawXp =
    profile?.xp ??
    profile?.rich_points ??
    profile?.points ??
    profileIdentity?.xp ??
    profileIdentity?.rich_points ??
    0;

  const rawLevel =
    profile?.rich_level ??
    profile?.level ??
    profileIdentity?.rich_level ??
    profileIdentity?.level ??
    1;

  const rank =
    profile?.rank_title ||
    profile?.rank ||
    profileIdentity?.rankTitle ||
    profileIdentity?.rank_title ||
    profileIdentity?.rank ||
    "Member";

  const xp = Math.max(0, Number(rawXp) || 0);
  const level = Math.max(1, Number(rawLevel) || 1);

  const levelBase = Math.max(0, (level - 1) * 1000);
  const nextLevel = level * 1000;
  const span = Math.max(1, nextLevel - levelBase);
  const currentIntoLevel = Math.max(0, xp - levelBase);
  const percent = Math.max(0, Math.min(100, (currentIntoLevel / span) * 100));
  const remaining = Math.max(0, nextLevel - xp);

  return {
    xp,
    level,
    rank,
    nextLevel,
    remaining,
    percent
  };
}

function renderXpGauge() {
  const model = getProfileXpModel(currentProfile, identity);

  if (els.xpGauge) {
    els.xpGauge.dataset.level = String(model.level);
    els.xpGauge.dataset.rank = model.rank;
    els.xpGauge.dataset.xp = String(model.xp);
  }

  if (els.xpFill) {
    els.xpFill.style.width = `${model.percent}%`;
  }

  setText(els.xpText, `${model.xp.toLocaleString()} XP`);
  setText(els.xpNext, `${model.remaining.toLocaleString()} XP TO LVL ${model.level + 1}`);
  setText(els.xpLevel, `LVL ${model.level}`);
  setText(els.xpRank, model.rank);

  window.dispatchEvent(
    new CustomEvent("rb:xp-gauge-update", {
      detail: {
        route: "settings",
        xp: model.xp,
        level: model.level,
        rank: model.rank,
        nextLevel: model.nextLevel,
        remaining: model.remaining,
        percent: model.percent
      }
    })
  );
}

/* =========================
   IDENTITY
========================= */

function syncState() {
  const appState = getCurrentUserState?.() || {};

  currentUser = appState.user || getUser?.() || null;
  currentProfile = appState.profile || currentProfile || null;
  identity = getProfileIdentity(currentProfile);

  document.body.dataset.rbRoute = "settings";
  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = identity?.id || "";
  document.body.dataset.rbProfileLocked = identity?.id ? "true" : "false";
}

async function fetchMyProfile() {
  const user = getUser?.() || currentUser;

  if (!user?.id) {
    currentUser = null;
    currentProfile = null;
    identity = null;
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
  identity = getProfileIdentity(currentProfile);

  return currentProfile;
}

function paintSettings() {
  const user = currentUser || getUser?.();
  const profile = currentProfile || {};
  identity = getProfileIdentity(profile);

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

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl(currentProfile);
  });

  document.querySelectorAll("[data-rb-current-avatar]").forEach((el) => {
    setImage(el, avatar, displayName);
  });

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

  document.body.dataset.rbRoute = "settings";
  document.body.dataset.rbUserId = user?.id || "";
  document.body.dataset.rbProfileId = identity?.id || "";
  document.body.dataset.rbProfileLocked = identity?.id ? "true" : "false";

  bindProfileShell?.();
  renderXpGauge();
}

async function refreshSettingsIdentity() {
  await refreshAppIdentity();
  syncState();
  await fetchMyProfile();
  paintSettings();
}

/* =========================
   REALTIME
========================= */

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

/* =========================
   ACTIONS
========================= */

function bindSettingsActions() {
  if (actionsBound) return;
  actionsBound = true;

  els.editBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.edit || "/edit";
  });

  els.profileBtn?.addEventListener("click", () => {
    window.location.href = buildProfileUrl(currentProfile) || RB_ROUTES.profile || "/profile";
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

/* =========================
   BOOT
========================= */

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

    console.log("RB SETTINGS PAGE READY", {
      profileLocked: !!identity?.id,
      route: "settings",
      xpGauge: true
    });
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
