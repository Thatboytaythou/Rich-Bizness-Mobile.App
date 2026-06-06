/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-guards.js

   GLOBAL GUARD HUB
   Central access helpers for pages/features
========================= */

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  autoGuardCurrentPage,
  requireSession,
  blockSession,
  requireCreator,
  requireArtist,
  requireSeller,
  requireAdmin
} from "/core/features/auth/session-guard.js";

import {
  getAuthState,
  getAuthFlags
} from "/core/features/auth/auth-state.js";

import {
  normalizePath
} from "/core/shared/rb-router.js";

/* =========================
   EXPORT PAGE GUARDS
========================= */

export {
  autoGuardCurrentPage,
  requireSession,
  blockSession,
  requireCreator,
  requireArtist,
  requireSeller,
  requireAdmin
};

/* =========================
   BASIC STATE
========================= */

export function getCurrentAuthFlags() {
  return getAuthFlags();
}

export function getCurrentAuthUser() {
  return getAuthState()?.user || null;
}

export function getCurrentAuthProfile() {
  return getAuthState()?.profile || null;
}

export function isSignedIn() {
  return !!getAuthState()?.user?.id;
}

export function isGuest() {
  return !isSignedIn();
}

/* =========================
   OWNER / PRIVATE ACCESS
========================= */

export function canEditOwner(ownerId) {
  const state = getAuthState();

  return !!(
    state.user?.id &&
    ownerId &&
    state.user.id === ownerId
  );
}

export function canAccessPrivateContent(ownerId) {
  const flags = getAuthFlags();

  return !!(
    canEditOwner(ownerId) ||
    flags.isAdmin ||
    flags.isModerator
  );
}

export function canManageUser(targetUserId) {
  const flags = getAuthFlags();

  return !!(
    canEditOwner(targetUserId) ||
    flags.isAdmin ||
    flags.isModerator
  );
}

/* =========================
   ROLE ACCESS
========================= */

export function isPlatformAdmin() {
  return !!getAuthFlags().isAdmin;
}

export function isPlatformModerator() {
  return !!getAuthFlags().isModerator;
}

export function isVerifiedUser() {
  return !!getAuthFlags().isVerified;
}

export function isCreatorUser() {
  return !!getAuthFlags().isCreator;
}

export function isArtistUser() {
  return !!getAuthFlags().isArtist;
}

export function isSellerUser() {
  return !!getAuthFlags().isSeller;
}

/* =========================
   FEATURE ACCESS
========================= */

export function canCreateContent() {
  const flags = getAuthFlags();

  return !!(
    flags.isCreator ||
    flags.isArtist ||
    flags.isSeller ||
    flags.isVerified ||
    flags.isAdmin
  );
}

export function canUpload() {
  return isSignedIn();
}

export function canComment() {
  return isSignedIn();
}

export function canLike() {
  return isSignedIn();
}

export function canFollow() {
  return isSignedIn();
}

export function canSendMessage() {
  return isSignedIn();
}

export function canUseNotifications() {
  return isSignedIn();
}

export function canEditProfile(profileId = null) {
  const state = getAuthState();

  if (!profileId) {
    return !!state.user?.id;
  }

  return canEditOwner(profileId);
}

export function canSellProducts() {
  const flags = getAuthFlags();

  return !!(
    flags.isSeller ||
    flags.isCreator ||
    flags.isAdmin
  );
}

export function canUploadMusic() {
  const flags = getAuthFlags();

  return !!(
    flags.isArtist ||
    flags.isCreator ||
    flags.isAdmin
  );
}

export function canGoLive() {
  const flags = getAuthFlags();

  return !!(
    flags.isCreator ||
    flags.isVerified ||
    flags.isAdmin
  );
}

export function canCreateMetaWorld() {
  const flags = getAuthFlags();

  return !!(
    flags.isCreator ||
    flags.isVerified ||
    flags.isAdmin
  );
}

export function canManageStore() {
  return canSellProducts();
}

export function canManageCreatorHub() {
  const flags = getAuthFlags();

  return !!(
    flags.isCreator ||
    flags.isArtist ||
    flags.isSeller ||
    flags.isAdmin
  );
}

export function canAccessAdmin() {
  return !!getAuthFlags().isAdmin;
}

/* =========================
   ROUTE ACCESS HELPERS
========================= */

export function getFallbackRouteForAccess() {
  const flags = getAuthFlags();

  if (!isSignedIn()) return RB_ROUTES.auth || "/auth";
  if (flags.isAdmin) return RB_ROUTES.admin || "/admin";
  if (flags.isCreator) return RB_ROUTES.creator || "/creator";

  return RB_ROUTES.profile || "/profile";
}

export function canAccessRouteKey(routeKey = "") {
  const key = String(routeKey || "").trim();

  if (!key) return true;

  if (key === "admin") return canAccessAdmin();
  if (key === "creator") return canManageCreatorHub();
  if (key === "upload") return canUpload();
  if (key === "messages") return canSendMessage();
  if (key === "notifications") return canUseNotifications();
  if (key === "edit") return canEditProfile();
  if (key === "settings") return isSignedIn();

  if (
    key === "secretDoor" ||
    key === "secretMeta2" ||
    key === "secretMeta3"
  ) {
    const flags = getAuthFlags();

    return !!(
      flags.isAdmin ||
      flags.isCreator ||
      flags.isVerified
    );
  }

  return true;
}

export function canAccessRoutePath(path = window.location.pathname) {
  const clean = normalizePath(path);

  const routeKey = Object.entries(RB_ROUTES).find(([, route]) => {
    return typeof route === "string" && normalizePath(route) === clean;
  })?.[0];

  return canAccessRouteKey(routeKey);
}

export function guardRouteKey(routeKey = "", redirectTo = null) {
  if (canAccessRouteKey(routeKey)) return true;

  window.location.href =
    redirectTo ||
    getFallbackRouteForAccess();

  return false;
}

export function guardRoutePath(path = window.location.pathname, redirectTo = null) {
  if (canAccessRoutePath(path)) return true;

  window.location.href =
    redirectTo ||
    getFallbackRouteForAccess();

  return false;
}

console.log("RB GUARDS READY");
