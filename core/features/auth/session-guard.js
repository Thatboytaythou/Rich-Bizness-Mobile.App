/* =========================
   RICH BIZNESS MOBILE
   /core/features/auth/session-guard.js

   SESSION + ROUTE GUARD
   Synced With RB Router
========================= */

import { RB_ROUTES } from "/core/shared/rb-config.js";

import {
  isProtectedRoute,
  isCreatorRoute,
  isSellerRoute,
  isArtistRoute,
  isAdminRoute,
  getCurrentPath
} from "/core/shared/rb-router.js";

import {
  initAuthState,
  getAuthState,
  getAuthFlags
} from "/core/features/auth/auth-state.js";

function redirect(route) {
  if (!route) return false;

  const current = `${window.location.pathname}${window.location.search}`;

  const target =
    route === RB_ROUTES.auth
      ? `${route}?next=${encodeURIComponent(current)}`
      : route;

  window.location.href = target;
  return true;
}

export async function requireSession({
  redirectTo = RB_ROUTES.auth
} = {}) {
  await initAuthState();

  const state = getAuthState();

  if (!state.isAuthed) {
    redirect(redirectTo);
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
    redirect(redirectTo);
    return true;
  }

  return false;
}

export async function requireCreator({
  redirectTo = RB_ROUTES.profile
} = {}) {
  const state = await requireSession({
    redirectTo: RB_ROUTES.auth
  });

  if (!state) return null;

  const flags = getAuthFlags();

  if (!flags.isCreator && !flags.isAdmin) {
    redirect(redirectTo);
    return null;
  }

  return state;
}

export async function requireArtist({
  redirectTo = RB_ROUTES.music
} = {}) {
  const state = await requireSession({
    redirectTo: RB_ROUTES.auth
  });

  if (!state) return null;

  const flags = getAuthFlags();

  if (!flags.isArtist && !flags.isAdmin) {
    redirect(redirectTo);
    return null;
  }

  return state;
}

export async function requireSeller({
  redirectTo = RB_ROUTES.store
} = {}) {
  const state = await requireSession({
    redirectTo: RB_ROUTES.auth
  });

  if (!state) return null;

  const flags = getAuthFlags();

  if (!flags.isSeller && !flags.isAdmin) {
    redirect(redirectTo);
    return null;
  }

  return state;
}

export async function requireAdmin({
  redirectTo = RB_ROUTES.home
} = {}) {
  const state = await requireSession({
    redirectTo: RB_ROUTES.auth
  });

  if (!state) return null;

  const flags = getAuthFlags();

  if (!flags.isAdmin) {
    redirect(redirectTo);
    return null;
  }

  return state;
}

export async function autoGuardCurrentPage() {
  const path = getCurrentPath();

  if (isAdminRoute(path)) {
    return await requireAdmin();
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

  if (isProtectedRoute(path)) {
    return await requireSession();
  }

  return await initAuthState();
}

export function currentPathIsProtected() {
  return isProtectedRoute(getCurrentPath());
}

export function currentPathNeedsCreator() {
  return isCreatorRoute(getCurrentPath());
}

export function currentPathNeedsSeller() {
  return isSellerRoute(getCurrentPath());
}

export function currentPathNeedsArtist() {
  return isArtistRoute(getCurrentPath());
}

export function currentPathNeedsAdmin() {
  return isAdminRoute(getCurrentPath());
}

console.log("RB SESSION GUARD READY");
