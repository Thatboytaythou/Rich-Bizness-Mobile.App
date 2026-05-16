 /* =========================
   RICH BIZNESS MOBILE
   /core/features/auth/session-guard.js

   SESSION + ROUTE GUARD
   Synced With RB Router
========================= */

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  isProtectedRoute,
  isCreatorRoute,
  isSellerRoute,
  isArtistRoute,
  getCurrentPath
} from "/core/shared/rb-router.js";

import {
  initAuthState,
  getAuthState,
  getAuthFlags
} from "/core/features/auth/auth-state.js";

/* =========================
   BASIC SESSION GUARDS
========================= */

export async function requireSession({
  redirectTo = RB_ROUTES.auth
} = {}) {
  await initAuthState();

  const state = getAuthState();

  if (!state.isAuthed) {
    window.location.href = redirectTo;
    return null;
  }

  return state;
}

export async function blockSession({
  redirectTo = RB_ROUTES.home
} = {}) {
  await initAuthState();

  const state = getAuthState();

  if (state.isAuthed) {
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
  const state = await requireSession();

  if (!state) return null;

  const flags = getAuthFlags();

  if (!flags.isCreator && !flags.isAdmin) {
    window.location.href = redirectTo;
    return null;
  }

  return state;
}

export async function requireArtist({
  redirectTo = RB_ROUTES.music
} = {}) {
  const state = await requireSession();

  if (!state) return null;

  const flags = getAuthFlags();

  if (!flags.isArtist && !flags.isAdmin) {
    window.location.href = redirectTo;
    return null;
  }

  return state;
}

export async function requireSeller({
  redirectTo = RB_ROUTES.store
} = {}) {
  const state = await requireSession();

  if (!state) return null;

  const flags = getAuthFlags();

  if (!flags.isSeller && !flags.isAdmin) {
    window.location.href = redirectTo;
    return null;
  }

  return state;
}

export async function requireAdmin({
  redirectTo = RB_ROUTES.home
} = {}) {
  const state = await requireSession();

  if (!state) return null;

  const flags = getAuthFlags();

  if (!flags.isAdmin) {
    window.location.href = redirectTo;
    return null;
  }

  return state;
}

/* =========================
   AUTO PAGE GUARD
========================= */

export async function autoGuardCurrentPage() {
  const path = getCurrentPath();

  if (isProtectedRoute(path)) {
    return await requireSession();
  }

  if (isCreatorRoute(path)) {
    return await requireCreator();
  }

  if (isSellerRoute(path)) {
    return await requireSeller();
  }

  if (isArtistRoute(path)) {
    return await requireArtist();
  }

  return await initAuthState();
}

/* =========================
   PAGE STATE HELPERS
========================= */

export function currentPathIsProtected() {
  return isProtectedRoute();
}

export function currentPathNeedsCreator() {
  return isCreatorRoute();
}

export function currentPathNeedsSeller() {
  return isSellerRoute();
}

export function currentPathNeedsArtist() {
  return isArtistRoute();
}
