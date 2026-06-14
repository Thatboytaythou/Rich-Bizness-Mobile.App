/* =========================
   RICH BIZNESS MOBILE
   /core/features/profile/profile-state.js

   PROFILE STATE ENGINE
   Compatibility profile-state wrapper

   Source-of-truth rule:
   - rb-supabase.js owns current auth/profile identity
   - rb-profile.js owns profile helper/loading utilities
   - rb-realtime.js owns realtime channels
   - profile-state.js mirrors active profile state for pages
========================= */

import {
  bootAuth,
  getUser,
  getProfile,
  getProfileIdentity as getSupabaseProfileIdentity,
  refreshProfile
} from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity,
  getProfileById,
  getProfileByUsername,
  refreshMyProfile
} from "/core/shared/rb-profile.js";

import {
  subscribeToProfile,
  unsubscribeChannel,
  rbChannelName
} from "/core/shared/rb-realtime.js";

let profileReady = false;
let activeProfile = null;
let activeIdentity = null;
let activeProfileMode = "guest";
let activeProfileChannelKey = null;
let profileLoading = false;
let profileRefreshingFromRealtime = false;
let profileBooting = null;

const listeners = new Set();

/* =========================
   HELPERS
========================= */

function hasWindow() {
  return typeof window !== "undefined";
}

function getSearchParams() {
  if (!hasWindow()) return new URLSearchParams("");
  return new URLSearchParams(window.location.search);
}

function currentUserId() {
  return getUser?.()?.id || null;
}

function buildIdentity(profile = activeProfile) {
  return profile
    ? getProfileIdentity(profile)
    : getSupabaseProfileIdentity?.() || getProfileIdentity(null);
}

function dispatchProfileState() {
  if (!hasWindow()) return;

  window.dispatchEvent(
    new CustomEvent("rb:profile-state", {
      detail: getProfileState()
    })
  );
}

/* =========================
   INIT
========================= */

export async function initProfileState({
  mode = "auto",
  userId = null,
  username = null,
  realtime = true
} = {}) {
  if (profileBooting) {
    await profileBooting;
    return getProfileState();
  }

  profileBooting = (async () => {
    await bootAuth?.();

    activeProfileMode = resolveProfileMode({
      mode,
      userId,
      username
    });

    activeProfile = await loadActiveProfile({
      mode: activeProfileMode,
      userId,
      username
    });

    activeIdentity = buildIdentity(activeProfile);
    profileReady = true;

    if (realtime) {
      bindProfileRealtime(activeProfile?.id || currentUserId());
    }

    notifyProfileListeners();

    return getProfileState();
  })();

  try {
    await profileBooting;
    return getProfileState();
  } finally {
    profileBooting = null;
  }
}

/* =========================
   STATE
========================= */

export function getProfileState() {
  return {
    ready: profileReady,
    loading: profileLoading,
    mode: activeProfileMode,
    user: getUser?.() || null,
    authProfile: getProfile?.() || null,
    profile: activeProfile,
    identity: activeIdentity || buildIdentity(activeProfile),
    isMine: isMyProfile(activeProfile)
  };
}

export async function refreshProfileState() {
  if (profileLoading) return getProfileState();

  profileLoading = true;
  notifyProfileListeners();

  try {
    if (activeProfileMode === "me") {
      activeProfile =
        await refreshMyProfile?.() ||
        await refreshProfile?.() ||
        getProfile?.() ||
        null;
    } else if (activeProfile?.username) {
      activeProfile = await getProfileByUsername(activeProfile.username);
    } else if (activeProfile?.id) {
      activeProfile = await getProfileById(activeProfile.id);
    } else {
      activeProfile = await loadActiveProfile({
        mode: activeProfileMode
      });
    }

    activeIdentity = buildIdentity(activeProfile);
    profileReady = true;

    notifyProfileListeners();
    return getProfileState();
  } catch (error) {
    console.warn("[RB PROFILE REFRESH WARNING]", error?.message || error);
    return getProfileState();
  } finally {
    profileLoading = false;
    notifyProfileListeners();
  }
}

export async function loadProfileByRoute() {
  const params = getSearchParams();

  const username =
    params.get("u") ||
    params.get("username");

  const userId =
    params.get("id") ||
    params.get("user");

  return await initProfileState({
    mode: username || userId ? "public" : "me",
    username,
    userId,
    realtime: true
  });
}

export async function setActiveProfile(profile) {
  activeProfile = profile || null;
  activeIdentity = buildIdentity(activeProfile);
  activeProfileMode = isMyProfile(activeProfile) ? "me" : activeProfile ? "public" : "guest";
  profileReady = true;

  bindProfileRealtime(activeProfile?.id);
  notifyProfileListeners();

  return getProfileState();
}

/* =========================
   LISTENERS
========================= */

export function onProfileState(callback) {
  if (typeof callback !== "function") return () => {};

  listeners.add(callback);

  try {
    callback(getProfileState());
  } catch (error) {
    console.warn("[RB PROFILE LISTENER ERROR]", error?.message || error);
  }

  return () => listeners.delete(callback);
}

export function notifyProfileListeners() {
  const state = getProfileState();

  listeners.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
      console.warn("[RB PROFILE LISTENER ERROR]", error?.message || error);
    }
  });

  dispatchProfileState();

  return state;
}

/* =========================
   GETTERS
========================= */

export function isMyProfile(profile = activeProfile) {
  const userId = currentUserId();
  return Boolean(profile?.id && userId && profile.id === userId);
}

export function getActiveProfile() {
  return activeProfile;
}

export function getActiveIdentity() {
  return activeIdentity || buildIdentity(activeProfile);
}

export function profileStateIsReady() {
  return profileReady;
}

export function getProfileMode() {
  return activeProfileMode;
}

/* =========================
   LOADERS
========================= */

function resolveProfileMode({
  mode,
  userId,
  username
}) {
  if (mode === "me" || mode === "public" || mode === "guest") return mode;
  if (userId || username) return "public";
  if (currentUserId()) return "me";
  return "guest";
}

async function loadActiveProfile({
  mode = "me",
  userId = null,
  username = null
} = {}) {
  profileLoading = true;
  notifyProfileListeners();

  try {
    if (mode === "guest") return null;

    if (username) {
      return await getProfileByUsername(username);
    }

    if (userId) {
      return await getProfileById(userId);
    }

    if (mode === "me") {
      return (
        await refreshMyProfile?.() ||
        await refreshProfile?.() ||
        getProfile?.() ||
        null
      );
    }

    return null;
  } catch (error) {
    console.warn("[RB PROFILE LOAD WARNING]", error?.message || error);
    return null;
  } finally {
    profileLoading = false;
  }
}

/* =========================
   REALTIME
========================= */

function bindProfileRealtime(profileId) {
  if (!profileId) return;

  clearProfileRealtime();

  activeProfileChannelKey = rbChannelName("profile-state", profileId);

  subscribeToProfile({
    userId: profileId,
    onChange: async () => {
      if (profileRefreshingFromRealtime) return;

      profileRefreshingFromRealtime = true;

      try {
        await refreshProfileState();

        if (hasWindow()) {
          window.dispatchEvent(
            new CustomEvent("rb:profile-updated", {
              detail: getProfileState()
            })
          );
        }
      } finally {
        profileRefreshingFromRealtime = false;
      }
    },
    onStatus: null
  });
}

export async function clearProfileRealtime() {
  if (!activeProfileChannelKey) return;

  try {
    await unsubscribeChannel(activeProfileChannelKey);
  } finally {
    activeProfileChannelKey = null;
  }
}

/* =========================
   AUTH/PROFILE EVENTS
========================= */

if (hasWindow()) {
  window.addEventListener("rb:auth-changed", async () => {
    if (activeProfileMode === "me" && currentUserId()) {
      await refreshProfileState();
      return;
    }

    if (!currentUserId()) {
      activeProfile = null;
      activeIdentity = buildIdentity(null);
      activeProfileMode = "guest";
      profileReady = true;
      await clearProfileRealtime();
      notifyProfileListeners();
    }
  });

  window.addEventListener("rb:identity-rows-synced", () => {
    activeIdentity = buildIdentity(activeProfile);
    notifyProfileListeners();
  });

  window.addEventListener("beforeunload", () => {
    clearProfileRealtime();
  });
}

console.log("RB PROFILE STATE READY");
