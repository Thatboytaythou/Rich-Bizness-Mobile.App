 /* =========================
   RICH BIZNESS MOBILE
   /core/features/auth/auth-state.js

   UNIVERSAL AUTH STATE
   SCHEMA LOCKED VERSION
========================= */

import {
  bootAuth,
  getSession,
  getUser,
  getProfile,
  loadProfile
} from "/core/shared/rb-auth.js";

let authReady = false;
let refreshRunning = false;

const listeners = new Set();

export async function initAuthState() {
  await bootAuth();

  authReady = true;
  notifyAuthListeners();

  return getAuthState();
}

export function getAuthState() {
  const user = getUser();
  const profile = getProfile();

  return {
    ready: authReady,
    session: getSession(),
    user,
    profile,
    isAuthed: !!user?.id
  };
}

export async function refreshAuthProfile() {
  const user = getUser();

  if (!user?.id) {
    notifyAuthListeners();
    return null;
  }

  if (refreshRunning) {
    return getProfile();
  }

  refreshRunning = true;

  try {
    const profile = await loadProfile(user.id);
    notifyAuthListeners();
    return profile;
  } catch (error) {
    console.warn("[RB AUTH PROFILE REFRESH SKIPPED]", error);
    notifyAuthListeners();
    return getProfile();
  } finally {
    refreshRunning = false;
  }
}

export function onAuthState(callback) {
  if (typeof callback !== "function") {
    return () => {};
  }

  listeners.add(callback);

  try {
    callback(getAuthState());
  } catch (error) {
    console.warn("[RB AUTH LISTENER ERROR]", error);
  }

  return () => {
    listeners.delete(callback);
  };
}

export function notifyAuthListeners() {
  const state = getAuthState();

  listeners.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
      console.warn("[RB AUTH LISTENER ERROR]", error);
    }
  });
}

export function requireAuthState() {
  const state = getAuthState();

  if (!state.isAuthed) {
    throw new Error("User is not authenticated.");
  }

  return state;
}

export function authIsReady() {
  return authReady;
}

export function isAuthed() {
  return !!getUser()?.id;
}

export function getAuthUserId() {
  return getUser()?.id || null;
}

export function getAuthEmail() {
  return getUser()?.email || "";
}

export function getAuthProfileId() {
  return getProfile()?.id || getUser()?.id || null;
}

export function getAuthRole() {
  return getProfile()?.role || "guest";
}

export function getAuthUsername() {
  return getProfile()?.username || "";
}

export function getAuthDisplayName() {
  const profile = getProfile();
  const user = getUser();

  return (
    profile?.display_name ||
    profile?.full_name ||
    profile?.username ||
    user?.email?.split("@")[0] ||
    "Rich User"
  );
}

export function getAuthAvatar() {
  const profile = getProfile();

  return (
    profile?.avatar_url ||
    "/images/brand/project-avatar.png.jpeg"
  );
}

export function getAuthFlags() {
  const user = getUser();
  const profile = getProfile();
  const role = profile?.role || "guest";

  return {
    isGuest: !user?.id,
    isAuthed: !!user?.id,
    isCreator: !!profile?.is_creator,
    isArtist: !!profile?.is_artist,
    isSeller: !!profile?.is_seller,
    isVerified: !!profile?.is_verified,
    isAdmin: [
      "admin",
      "owner",
      "super_admin",
      "founder",
      "rich_admin"
    ].includes(role),
    isModerator: [
      "moderator",
      "elite_mod",
      "support"
    ].includes(role),
    role
  };
}

if (!window.__RB_AUTH_STATE_FOCUS_BOUND__) {
  window.__RB_AUTH_STATE_FOCUS_BOUND__ = true;

  window.addEventListener("focus", async () => {
    if (!getUser()?.id) return;

    try {
      await refreshAuthProfile();
    } catch (error) {
      console.warn("[RB AUTH FOCUS REFRESH SKIPPED]", error);
    }
  });
}

console.log("RB AUTH STATE READY");
