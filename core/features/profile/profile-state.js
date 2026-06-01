/* =========================
   RICH BIZNESS MOBILE
   /core/features/profile/profile-state.js

   PROFILE STATE ENGINE
   Auth-linked profile state
   Auto profile ensure
   Public profile loading
   Realtime profile refresh
========================= */

import { RB_TABLES } from "/core/shared/rb-config.js";

import {
  getSupabase,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  initAuthState,
  getAuthState,
  refreshAuthProfile,
  onAuthState
} from "/core/features/auth/auth-state.js";

import {
  getProfileIdentity,
  getProfileById,
  getProfileByUsername,
  refreshMyProfile
} from "/core/shared/rb-profile.js";

const supabase = getSupabase();

let profileReady = false;
let activeProfile = null;
let activeIdentity = null;
let activeProfileMode = "guest";
let profileChannel = null;
let profileLoading = false;
let profileRefreshingFromRealtime = false;

const listeners = new Set();

export async function initProfileState({
  mode = "auto",
  userId = null,
  username = null,
  realtime = true
} = {}) {
  await initAuthState();

  const authState = getAuthState();

  activeProfileMode = resolveProfileMode({
    mode,
    userId,
    username,
    authState
  });

  activeProfile = await loadActiveProfile({
    mode: activeProfileMode,
    userId,
    username
  });

  activeIdentity = getProfileIdentity(activeProfile);
  profileReady = true;

  if (realtime) {
    bindProfileRealtime(activeProfile?.id || authState.user?.id);
  }

  notifyProfileListeners();
  return getProfileState();
}

export function getProfileState() {
  return {
    ready: profileReady,
    loading: profileLoading,
    mode: activeProfileMode,
    auth: getAuthState(),
    profile: activeProfile,
    identity: activeIdentity,
    isMine: isMyProfile(activeProfile)
  };
}

export async function refreshProfileState() {
  if (profileLoading) return getProfileState();

  profileLoading = true;
  notifyProfileListeners();

  try {
    if (activeProfileMode === "me") {
      activeProfile = await ensureMyProfile();
    } else if (activeProfile?.username) {
      activeProfile = await getProfileByUsername(activeProfile.username);
    } else if (activeProfile?.id) {
      activeProfile = await getProfileById(activeProfile.id);
    } else {
      activeProfile = await loadActiveProfile({ mode: activeProfileMode });
    }

    activeIdentity = getProfileIdentity(activeProfile);
    notifyProfileListeners();

    return getProfileState();
  } catch (error) {
    console.warn("[RB PROFILE REFRESH WARNING]", error);
    return getProfileState();
  } finally {
    profileLoading = false;
    notifyProfileListeners();
  }
}

export async function loadProfileByRoute() {
  const params = new URLSearchParams(window.location.search);

  const username = params.get("u") || params.get("username");
  const userId = params.get("id") || params.get("user");

  return await initProfileState({
    mode: username || userId ? "public" : "me",
    username,
    userId,
    realtime: true
  });
}

export async function setActiveProfile(profile) {
  activeProfile = profile || null;
  activeIdentity = getProfileIdentity(activeProfile);
  activeProfileMode = isMyProfile(activeProfile) ? "me" : "public";

  bindProfileRealtime(activeProfile?.id);
  notifyProfileListeners();

  return getProfileState();
}

export function onProfileState(callback) {
  if (typeof callback !== "function") return () => {};

  listeners.add(callback);

  try {
    callback(getProfileState());
  } catch (error) {
    console.warn("[RB PROFILE LISTENER ERROR]", error);
  }

  return () => listeners.delete(callback);
}

export function notifyProfileListeners() {
  const state = getProfileState();

  listeners.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
      console.warn("[RB PROFILE LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:profile-state", {
      detail: state
    })
  );
}

export function isMyProfile(profile = activeProfile) {
  const authState = getAuthState();
  return !!profile?.id && profile.id === authState.user?.id;
}

export function getActiveProfile() {
  return activeProfile;
}

export function getActiveIdentity() {
  return activeIdentity;
}

export function profileStateIsReady() {
  return profileReady;
}

export function getProfileMode() {
  return activeProfileMode;
}

function resolveProfileMode({
  mode,
  userId,
  username,
  authState
}) {
  if (mode === "me" || mode === "public" || mode === "guest") return mode;
  if (userId || username) return "public";
  if (authState?.user?.id) return "me";
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
      await refreshAuthProfile();

      let profile = await refreshMyProfile();

      if (!profile?.id) {
        profile = await ensureMyProfile();
      }

      return profile;
    }

    return null;
  } catch (error) {
    console.warn("[RB PROFILE LOAD WARNING]", error?.message || error);
    return null;
  } finally {
    profileLoading = false;
  }
}

function bindProfileRealtime(profileId) {
  if (!profileId) return;

  if (profileChannel) {
    supabase.removeChannel(profileChannel);
    profileChannel = null;
  }

  profileChannel = supabase
    .channel(`rb-profile-${profileId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.profiles,
        filter: `id=eq.${profileId}`
      },
      async () => {
        if (profileRefreshingFromRealtime) return;

        profileRefreshingFromRealtime = true;

        try {
          await refreshProfileState();

          window.dispatchEvent(
            new CustomEvent("rb:profile-updated", {
              detail: getProfileState()
            })
          );
        } finally {
          profileRefreshingFromRealtime = false;
        }
      }
    )
    .subscribe();
}

export function clearProfileRealtime() {
  if (!profileChannel) return;

  supabase.removeChannel(profileChannel);
  profileChannel = null;
}

onAuthState(async (authState) => {
  if (!authState.ready) return;

  if (activeProfileMode === "me" && authState.user?.id) {
    await refreshProfileState();
  }

  if (!authState.user?.id) {
    activeProfile = null;
    activeIdentity = getProfileIdentity(null);
    activeProfileMode = "guest";
    clearProfileRealtime();
    notifyProfileListeners();
  }
});

window.addEventListener("beforeunload", () => {
  clearProfileRealtime();
});

console.log("RB PROFILE STATE READY");
