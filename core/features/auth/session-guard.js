/* =========================
   RICH BIZNESS MOBILE
   /core/features/auth/session-guard.js

   SESSION + ROUTE GUARD
   Compatibility wrapper only

   Source-of-truth rule:
   - rb-guards.js owns guard decisions
   - rb-router.js owns route detection
   - rb-supabase.js owns auth/profile identity
========================= */

import {
  requireSession as sharedRequireSession,
  blockSession as sharedBlockSession,
  requireCreator as sharedRequireCreator,
  requireArtist as sharedRequireArtist,
  requireSeller as sharedRequireSeller,
  requireAdmin as sharedRequireAdmin,
  autoGuardCurrentPage as sharedAutoGuardCurrentPage,
  canAccessSecret,
  getCurrentAuthFlags
} from "/core/shared/rb-guards.js";

import {
  isProtectedRoute,
  isCreatorRoute,
  isSellerRoute,
  isArtistRoute,
  isAdminRoute,
  isSecretRoute,
  getCurrentPath
} from "/core/shared/rb-router.js";

/* =========================
   SESSION GUARDS
========================= */

export async function requireSession(options = {}) {
  return await sharedRequireSession(options);
}

export async function blockSession(options = {}) {
  return await sharedBlockSession(options);
}

export async function requireCreator(options = {}) {
  return await sharedRequireCreator(options);
}

export async function requireArtist(options = {}) {
  return await sharedRequireArtist(options);
}

export async function requireSeller(options = {}) {
  return await sharedRequireSeller(options);
}

export async function requireAdmin(options = {}) {
  return await sharedRequireAdmin(options);
}

export async function requireSecret({
  redirectTo = null
} = {}) {
  const sessionOk = await sharedRequireSession({
    redirectTo
  });

  if (!sessionOk) return null;

  if (!canAccessSecret()) {
    if (typeof window !== "undefined") {
      window.location.href = redirectTo || "/profile";
    }

    return null;
  }

  return getCurrentAuthFlags();
}

/* =========================
   AUTO GUARD
========================= */

export async function autoGuardCurrentPage(options = {}) {
  return await sharedAutoGuardCurrentPage(options);
}

/* =========================
   PATH CHECKS
========================= */

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

export function currentPathNeedsSecretAccess() {
  return isSecretRoute(getCurrentPath());
}

console.log("RB SESSION GUARD READY");
