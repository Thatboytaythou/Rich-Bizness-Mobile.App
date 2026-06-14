/* =========================
   RICH BIZNESS MOBILE
   /core/features/auth/auth-state.js

   UNIVERSAL AUTH STATE
   Compatibility wrapper only

   Source-of-truth rule:
   - rb-supabase.js owns session/user/profile/identity
   - rb-auth.js wraps auth actions
   - auth-state.js only mirrors current state for older imports
========================= */

import {
  RB_BRAND_ASSETS
} from "/core/shared/rb-config.js";

import {
  bootAuth,
  getSession,
  getUser,
  getProfile,
  getProfileIdentity,
  loadProfile,
  refreshProfile
} from "/core/shared/rb-supabase.js";

const DEFAULT_AUTH_AVATAR =
  RB_BRAND_ASSETS?.defaultProfileAvatar ||
  "/images/brand/Avatar-hero-Banner.png.jpeg";

const DEFAULT_AUTH_BANNER =
  RB_BRAND_ASSETS?.defaultProfileBanner ||
  "/images/brand/hero-banner.png";

const listeners = new Set();

let authReady = false;
let authBooting = null;
let refreshRunning = false;

/* =========================
   STATE BUILDERS
========================= */

function hasWindow() {
  return typeof window !== "undefined";
}

function roleValue(profile = {}, identity = {}) {
  return (
    profile?.role ||
    profile?.role_key ||
    identity?.role ||
    identity?.role_key ||
    "guest"
  );
}

function truthyFlag(...values) {
  return values.some(Boolean);
}

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
    await bootAuth?.();

    if (getUser()?.id) {
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
  const session = getSession?.() || null;
  const user = getUser?.() || null;
  const profile = getProfile?.() || null;
  const identity = getProfileIdentity?.() || {};

  const profileId =
    identity?.profile_id ||
    identity?.user_id ||
    identity?.id ||
    profile?.id ||
    user?.id ||
    null;

  const flags = getAuthFlags();

  return {
    ready: authReady,
    session,
    user,
    profile,
    identity,

    isAuthed: Boolean(user?.id),
    authed: Boolean(user?.id),
    isSignedIn: Boolean(user?.id),
    isGuest: !user?.id,

    id: profileId,
    user_id: profileId,
    profile_id: profileId,

    email: user?.email || "",
    username: getAuthUsername(),
    display_name: getAuthDisplayName(),
    avatar_url: getAuthAvatar(),
    banner_url: getAuthBanner(),
    role: getAuthRole(),
    flags
  };
}

export async function refreshAuthProfile() {
  const user = getUser?.();

  if (!user?.id) {
    notifyAuthListeners();
    return null;
  }

  if (refreshRunning) {
    return getProfile?.() || null;
  }

  refreshRunning = true;

  try {
    const profile =
      typeof refreshProfile === "function"
        ? await refreshProfile()
        : await loadProfile?.(user.id);

    notifyAuthListeners();
    return profile;
  } catch (error) {
    console.warn("[RB AUTH PROFILE REFRESH SKIPPED]", error?.message || error);
    notifyAuthListeners();
    return getProfile?.() || null;
  } finally {
    refreshRunning = false;
  }
}

/* =========================
   LISTENERS
========================= */

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

  if (hasWindow()) {
    window.dispatchEvent(
      new CustomEvent("rb:auth-state", {
        detail: state
      })
    );
  }

  return state;
}

/* =========================
   REQUIRE HELPERS
========================= */

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
  return Boolean(getUser?.()?.id);
}

export function getAuthUserId() {
  return getUser?.()?.id || null;
}

export function getAuthEmail() {
  return getUser?.()?.email || "";
}

export function getAuthProfileId() {
  const identity = getProfileIdentity?.() || {};
  return (
    identity?.profile_id ||
    identity?.user_id ||
    identity?.id ||
    getProfile?.()?.id ||
    getUser?.()?.id ||
    null
  );
}

export function getAuthRole() {
  return roleValue(getProfile?.() || {}, getProfileIdentity?.() || {});
}

export function getAuthUsername() {
  const profile = getProfile?.() || {};
  const user = getUser?.() || {};
  const identity = getProfileIdentity?.() || {};

  return (
    identity?.username ||
    profile?.username ||
    user?.user_metadata?.username ||
    user?.email?.split("@")[0] ||
    ""
  );
}

export function getAuthDisplayName() {
  const profile = getProfile?.() || {};
  const user = getUser?.() || {};
  const identity = getProfileIdentity?.() || {};

  return (
    identity?.display_name ||
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
  const profile = getProfile?.() || {};
  const identity = getProfileIdentity?.() || {};

  return (
    identity?.avatar_url ||
    identity?.profile_avatar_url ||
    profile?.avatar_url ||
    DEFAULT_AUTH_AVATAR
  );
}

export function getAuthBanner() {
  const profile = getProfile?.() || {};
  const identity = getProfileIdentity?.() || {};

  return (
    identity?.banner_url ||
    profile?.banner_url ||
    DEFAULT_AUTH_BANNER
  );
}

export function getAuthFlags() {
  const user = getUser?.() || null;
  const profile = getProfile?.() || {};
  const identity = getProfileIdentity?.() || {};
  const role = roleValue(profile, identity);

  return {
    isGuest: !user?.id,
    isAuthed: Boolean(user?.id),
    isSignedIn: Boolean(user?.id),

    isCreator: truthyFlag(
      profile?.is_creator,
      profile?.creator_enabled,
      identity?.is_creator,
      identity?.creator_enabled
    ),

    isArtist: truthyFlag(
      profile?.is_artist,
      profile?.artist_enabled,
      identity?.is_artist,
      identity?.artist_enabled
    ),

    isSeller: truthyFlag(
      profile?.is_seller,
      profile?.seller_enabled,
      identity?.is_seller,
      identity?.seller_enabled
    ),

    isVerified: truthyFlag(
      profile?.is_verified,
      profile?.verified,
      identity?.is_verified,
      identity?.verified
    ),

    isAdmin: [
      "admin",
      "owner",
      "super_admin",
      "founder",
      "rich_admin",
      "elite_admin"
    ].includes(role),

    isModerator: [
      "moderator",
      "mod",
      "elite_mod",
      "support"
    ].includes(role),

    role
  };
}

/* =========================
   FOCUS REFRESH
========================= */

if (hasWindow() && !window.__RB_AUTH_STATE_FOCUS_BOUND__) {
  window.__RB_AUTH_STATE_FOCUS_BOUND__ = true;

  window.addEventListener("focus", async () => {
    if (!getUser?.()?.id) return;

    try {
      await refreshAuthProfile();
    } catch (error) {
      console.warn("[RB AUTH FOCUS REFRESH SKIPPED]", error?.message || error);
    }
  });

  window.addEventListener("rb:profile-updated", () => {
    notifyAuthListeners();
  });

  window.addEventListener("rb:auth-changed", () => {
    notifyAuthListeners();
  });
}

console.log("RB AUTH STATE READY");
