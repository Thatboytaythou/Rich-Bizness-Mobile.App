/* =========================
   RICH BIZNESS MOBILE
   /core/features/auth/auth-state.js

   UNIVERSAL AUTH STATE
   FINAL LOCKED VERSION
========================= */

import {
  bootAuth,
  getSession,
  getUser,
  getProfile,
  loadProfile
} from "/core/shared/rb-supabase.js";

/* =========================
   INTERNAL STATE
========================= */

let authReady = false;

const listeners = new Set();

/* =========================
   INIT AUTH
========================= */

export async function initAuthState() {
  await bootAuth();

  authReady = true;

  notifyAuthListeners();

  return getAuthState();
}

/* =========================
   MAIN AUTH STATE
========================= */

export function getAuthState() {
  return {
    ready: authReady,

    session: getSession(),

    user: getUser(),

    profile: getProfile(),

    isAuthed: !!getUser()
  };
}

/* =========================
   REFRESH PROFILE
========================= */

export async function refreshAuthProfile() {
  const user = getUser();

  if (!user?.id) {
    notifyAuthListeners();
    return null;
  }

  const profile = await loadProfile(user.id);

  notifyAuthListeners();

  return profile;
}

/* =========================
   AUTH LISTENERS
========================= */

export function onAuthState(callback) {
  if (typeof callback !== "function") {
    return () => {};
  }

  listeners.add(callback);

  callback(getAuthState());

  return () => {
    listeners.delete(callback);
  };
}

export function notifyAuthListeners() {
  const state = getAuthState();

  listeners.forEach((callback) => {
    callback(state);
  });
}

/* =========================
   REQUIRE AUTH
========================= */

export function requireAuthState() {
  const state = getAuthState();

  if (!state.isAuthed) {
    throw new Error(
      "User is not authenticated."
    );
  }

  return state;
}

/* =========================
   QUICK HELPERS
========================= */

export function authIsReady() {
  return authReady;
}

export function isAuthed() {
  return !!getUser();
}

export function getAuthUserId() {
  return getUser()?.id || null;
}

export function getAuthEmail() {
  return getUser()?.email || "";
}

export function getAuthProfileId() {
  return (
    getProfile()?.id ||
    getUser()?.id ||
    null
  );
}

export function getAuthRole() {
  return getProfile()?.role || "guest";
}

export function getAuthUsername() {
  return (
    getProfile()?.username ||
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
    user?.email?.split("@")[0] ||
    "Rich User"
  );
}

export function getAuthAvatar() {
  const profile = getProfile();

  return (
    profile?.avatar_url ||
    profile?.meta_avatar_url ||
    "/images/profile/default-avatar.png"
  );
}

/* =========================
   AUTH FLAGS
========================= */

export function getAuthFlags() {
  const user = getUser();

  const profile = getProfile();

  const role =
    profile?.role || "guest";

  const adminRoles = [
    "admin",
    "owner",
    "super_admin",
    "founder",
    "rich_admin"
  ];

  return {
    isGuest: !user,

    isAuthed: !!user,

    isCreator:
      !!profile?.is_creator,

    isArtist:
      !!profile?.is_artist,

    isSeller:
      !!profile?.is_seller,

    isVerified:
      !!profile?.is_verified,

    isAdmin:
      adminRoles.includes(role),

    isModerator:
      [
        "moderator",
        "elite_mod",
        "support"
      ].includes(role),

    role
  };
}

/* =========================
   WINDOW FOCUS REFRESH
========================= */

window.addEventListener(
  "focus",
  async () => {
    if (getUser()?.id) {
      await refreshAuthProfile();
    }
  }
);

console.log(
  "RB AUTH STATE READY"
);
