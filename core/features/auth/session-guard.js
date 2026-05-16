/* =========================
   RICH BIZNESS MOBILE
   /core/features/auth/session-guard.js

   SESSION + ROUTE GUARD
========================= */

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  initAuthState,
  getAuthState,
  getAuthFlags
} from "/core/features/auth/auth-state.js";

/* =========================
   BASIC GUARDS
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

  if (!flags.isCreator) {
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

  if (!flags.isArtist) {
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

  if (!flags.isSeller) {
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
   PAGE GUARD MAP
========================= */

export const RB_PROTECTED_ROUTES = new Set([
  "/profile",
  "/profile.html",
  "/edit",
  "/edit.html",
  "/upload",
  "/upload.html",
  "/messages",
  "/messages.html",
  "/notifications",
  "/notifications.html",
  "/settings",
  "/settings.html"
]);

export function currentPathIsProtected() {
  return RB_PROTECTED_ROUTES.has(window.location.pathname);
}

export async function autoGuardCurrentPage() {
  if (!currentPathIsProtected()) return null;

  return await requireSession();
}
