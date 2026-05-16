/* =========================
   RICH BIZNESS MOBILE
   /core/features/auth/auth-state.js

   UNIVERSAL AUTH STATE
========================= */

import {
  bootAuth,
  getSession,
  getUser,
  getProfile,
  loadProfile
} from "/core/shared/rb-supabase.js";

let authReady = false;
let listeners = new Set();

export async function initAuthState() {
  await bootAuth();

  authReady = true;
  notifyAuthListeners();

  return getAuthState();
}

export function getAuthState() {
  return {
    ready: authReady,
    session: getSession(),
    user: getUser(),
    profile: getProfile(),
    isAuthed: !!getUser()
  };
}

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

export function onAuthState(callback) {
  if (typeof callback !== "function") return () => {};

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

export function requireAuthState() {
  const state = getAuthState();

  if (!state.isAuthed) {
    throw new Error("User is not authenticated.");
  }

  return state;
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

export function getAuthFlags() {
  const profile = getProfile();

  return {
    isGuest: !getUser(),
    isCreator: !!profile?.is_creator,
    isArtist: !!profile?.is_artist,
    isSeller: !!profile?.is_seller,
    isVerified: !!profile?.is_verified,
    isAdmin: profile?.role === "admin"
  };
}
