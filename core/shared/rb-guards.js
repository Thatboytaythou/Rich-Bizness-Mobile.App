/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-guards.js

   ROUTE + ACCESS GUARDS
========================= */

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  bootAuth,
  isAuthed,
  getUser,
  getProfile
} from "/core/shared/rb-supabase.js";

/* =========================
   AUTH GUARDS
========================= */

export async function requireUser({
  redirectTo = RB_ROUTES.auth
} = {}) {
  await bootAuth();

  if (!isAuthed()) {
    window.location.href = redirectTo;
    return null;
  }

  return getUser();
}

export async function blockAuthed({
  redirectTo = RB_ROUTES.home
} = {}) {
  await bootAuth();

  if (isAuthed()) {
    window.location.href = redirectTo;
    return true;
  }

  return false;
}

/* =========================
   ROLE GUARDS
========================= */

export async function requireCreator({
  redirectTo = RB_ROUTES.profile
} = {}) {
  await requireUser();

  const profile = getProfile();

  if (!profile?.is_creator) {
    window.location.href = redirectTo;
    return null;
  }

  return profile;
}

export async function requireArtist({
  redirectTo = RB_ROUTES.music
} = {}) {
  await requireUser();

  const profile = getProfile();

  if (!profile?.is_artist) {
    window.location.href = redirectTo;
    return null;
  }

  return profile;
}

export async function requireSeller({
  redirectTo = RB_ROUTES.store
} = {}) {
  await requireUser();

  const profile = getProfile();

  if (!profile?.is_seller) {
    window.location.href = redirectTo;
    return null;
  }

  return profile;
}

/* =========================
   ACCESS HELPERS
========================= */

export function canEditOwner(ownerId) {
  const user = getUser();

  return !!user?.id && user.id === ownerId;
}

export function canAccessPrivateContent(ownerId) {
  const user = getUser();

  return !!user?.id && user.id === ownerId;
}

export function isPlatformAdmin() {
  const profile = getProfile();

  return profile?.role === "admin";
}

export function requirePlatformAdmin({
  redirectTo = RB_ROUTES.home
} = {}) {
  if (!isPlatformAdmin()) {
    window.location.href = redirectTo;
    return false;
  }

  return true;
}
