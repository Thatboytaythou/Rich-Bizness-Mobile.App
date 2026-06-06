/* =========================
   RICH BIZNESS MOBILE
   /core/features/auth/auth-state.js

   UNIVERSAL AUTH STATE
   Schema Locked
   Profile Identity Only
========================= */

import {
  RB_BRAND_ASSETS
} from "/core/shared/rb-config.js";

import {
  bootAuth,
  getSession,
  getUser,
  getProfile,
  loadProfile,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

const DEFAULT_AUTH_AVATAR =
  RB_BRAND_ASSETS?.defaultProfileAvatar ||
  "/images/brand/Avatar-hero-Banner.png.jpeg";

const DEFAULT_AUTH_BANNER =
  RB_BRAND_ASSETS?.defaultProfileBanner ||
  "/images/brand/hero-banner.png";

let authReady = false;
let authBooting = null;
let refreshRunning = false;

const listeners = new Set();

export async function initAuthState() {
  if (authReady) {
    notifyAuthListeners();
    return getAuthState();
  }

  if (authBooting) {
    await authBooting;
    return getAuthState();
  }

  authBooting = (async () => {
    await bootAuth();

    if (getUser()?.id) {
      await ensureMyProfile();
      await refreshAuthProfile();
    }

    authReady = true;
    authBooting = null;

    notifyAuthListeners();

    return getAuthState();
  })();

  return authBooting;
}

export function getAuthState() {
  const session = getSession();
  const user = getUser();
  const profile = getProfile();

  const profileId = profile?.id || user?.id || null;

  return {
    ready: authReady,
    session,
    user,
    profile,

    isAuthed: !!user?.id,
    authed: !!user?.id,

    id: profileId,
    user_id: profileId,
    profile_id: profileId,

    email: user?.email || "",
    username: getAuthUsername(),
    display_name: getAuthDisplayName(),
    avatar_url: getAuthAvatar(),
    banner_url: getAuthBanner(),
    role: getAuthRole(),
    flags: getAuthFlags()
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
    console.warn("[RB AUTH PROFILE REFRESH SKIPPED]", error?.message || error);
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
    console.warn("[RB AUTH LISTENER ERROR]", error?.message || error);
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
      console.warn("[RB AUTH LISTENER ERROR]", error?.message || error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:auth-state", {
      detail: state
    })
  );
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
  const profile = getProfile();
  const user = getUser();

  return (
    profile?.username ||
    user?.user_metadata?.username ||
    user?.email?.split("@")[0] ||
    ""
  );
}

export function getAuthDisplayName() {
  const profile = getProfile();
  const user = getUser();

  return (
    profile?.display_name ||
    profile?.full_name ||
    profile?.username ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Rich User"
  );
}

export function getAuthAvatar() {
  const profile = getProfile();

  return profile?.avatar_url || DEFAULT_AUTH_AVATAR;
}

export function getAuthBanner() {
  const profile = getProfile();

  return profile?.banner_url || DEFAULT_AUTH_BANNER;
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
      console.warn("[RB AUTH FOCUS REFRESH SKIPPED]", error?.message || error);
    }
  });
}

console.log("RB AUTH STATE READY");
