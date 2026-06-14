/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-guards.js

   GLOBAL GUARD HUB
   Central access helpers for pages/features

   Source-of-truth rule:
   - rb-supabase.js owns user/profile/identity
   - rb-router.js owns route paths/access helpers
   - rb-guards.js only decides allow/block
========================= */

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  bootAuth,
  getUser,
  getProfile,
  getProfileIdentity
} from "/core/shared/rb-supabase.js";

import {
  normalizePath,
  getCurrentPath,
  isProtectedRoute,
  isCreatorRoute,
  isSellerRoute,
  isArtistRoute,
  isAdminRoute,
  isSecretRoute
} from "/core/shared/rb-router.js";

/* =========================
   BASIC STATE
========================= */

function isBrowser() {
  return typeof window !== "undefined";
}

function safeBool(value) {
  return Boolean(value);
}

function roleValue(profile = {}, identity = {}) {
  return (
    profile?.role ||
    profile?.role_key ||
    identity?.role ||
    identity?.role_key ||
    ""
  );
}

function truthyFlag(...values) {
  return values.some(Boolean);
}

export function getCurrentAuthUser() {
  return getUser?.() || null;
}

export function getCurrentAuthProfile() {
  return getProfile?.() || null;
}

export function getCurrentIdentity() {
  return getProfileIdentity?.() || {};
}

export function isSignedIn() {
  return Boolean(getCurrentAuthUser()?.id);
}

export function isGuest() {
  return !isSignedIn();
}

export function getCurrentAuthFlags() {
  const user = getCurrentAuthUser();
  const profile = getCurrentAuthProfile() || {};
  const identity = getCurrentIdentity() || {};
  const role = roleValue(profile, identity);

  const isAdmin = [
    "founder",
    "admin",
    "rich_admin",
    "elite_admin",
    "super_admin"
  ].includes(role);

  const isModerator = [
    "moderator",
    "mod",
    "elite_mod",
    "support"
  ].includes(role);

  const isCreator = truthyFlag(
    profile.is_creator,
    profile.creator_enabled,
    identity.is_creator,
    identity.creator_enabled
  );

  const isArtist = truthyFlag(
    profile.is_artist,
    profile.artist_enabled,
    identity.is_artist,
    identity.artist_enabled
  );

  const isSeller = truthyFlag(
    profile.is_seller,
    profile.seller_enabled,
    identity.is_seller,
    identity.seller_enabled
  );

  const isVerified = truthyFlag(
    profile.is_verified,
    profile.verified,
    identity.is_verified,
    identity.verified
  );

  return {
    user,
    profile,
    identity,
    role,
    isSignedIn: Boolean(user?.id),
    isGuest: !user?.id,
    isAdmin,
    isModerator,
    isCreator,
    isArtist,
    isSeller,
    isVerified
  };
}

/* =========================
   OWNER / PRIVATE ACCESS
========================= */

export function canEditOwner(ownerId) {
  const user = getCurrentAuthUser();

  return Boolean(
    user?.id &&
    ownerId &&
    user.id === ownerId
  );
}

export function canAccessPrivateContent(ownerId) {
  const flags = getCurrentAuthFlags();

  return Boolean(
    canEditOwner(ownerId) ||
    flags.isAdmin ||
    flags.isModerator
  );
}

export function canManageUser(targetUserId) {
  const flags = getCurrentAuthFlags();

  return Boolean(
    canEditOwner(targetUserId) ||
    flags.isAdmin ||
    flags.isModerator
  );
}

/* =========================
   ROLE ACCESS
========================= */

export function isPlatformAdmin() {
  return Boolean(getCurrentAuthFlags().isAdmin);
}

export function isPlatformModerator() {
  return Boolean(getCurrentAuthFlags().isModerator);
}

export function isVerifiedUser() {
  return Boolean(getCurrentAuthFlags().isVerified);
}

export function isCreatorUser() {
  return Boolean(getCurrentAuthFlags().isCreator);
}

export function isArtistUser() {
  return Boolean(getCurrentAuthFlags().isArtist);
}

export function isSellerUser() {
  return Boolean(getCurrentAuthFlags().isSeller);
}

/* =========================
   FEATURE ACCESS
========================= */

export function canCreateContent() {
  const flags = getCurrentAuthFlags();

  return Boolean(
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
  const user = getCurrentAuthUser();

  if (!profileId) {
    return Boolean(user?.id);
  }

  return canEditOwner(profileId);
}

export function canSellProducts() {
  const flags = getCurrentAuthFlags();

  return Boolean(
    flags.isSeller ||
    flags.isCreator ||
    flags.isAdmin
  );
}

export function canUploadMusic() {
  const flags = getCurrentAuthFlags();

  return Boolean(
    flags.isArtist ||
    flags.isCreator ||
    flags.isAdmin
  );
}

export function canGoLive() {
  const flags = getCurrentAuthFlags();

  return Boolean(
    flags.isCreator ||
    flags.isVerified ||
    flags.isAdmin
  );
}

export function canCreateMetaWorld() {
  const flags = getCurrentAuthFlags();

  return Boolean(
    flags.isCreator ||
    flags.isVerified ||
    flags.isAdmin
  );
}

export function canManageStore() {
  return canSellProducts();
}

export function canManageCreatorHub() {
  const flags = getCurrentAuthFlags();

  return Boolean(
    flags.isCreator ||
    flags.isArtist ||
    flags.isSeller ||
    flags.isAdmin
  );
}

export function canAccessAdmin() {
  return Boolean(getCurrentAuthFlags().isAdmin);
}

export function canAccessSecret() {
  const flags = getCurrentAuthFlags();

  return Boolean(
    flags.isAdmin ||
    flags.isCreator ||
    flags.isVerified
  );
}

/* =========================
   ROUTE ACCESS HELPERS
========================= */

export function getFallbackRouteForAccess() {
  const flags = getCurrentAuthFlags();

  if (!flags.isSignedIn) return RB_ROUTES.auth || "/auth";
  if (flags.isAdmin) return RB_ROUTES.admin || "/admin";
  if (flags.isCreator) return RB_ROUTES.creator || "/creator";

  return RB_ROUTES.profile || "/profile";
}

export function canAccessRouteKey(routeKey = "") {
  const key = String(routeKey || "").trim();

  if (!key) return true;

  if (key === "admin") return canAccessAdmin();
  if (key === "creator") return canManageCreatorHub();
  if (key === "seller") return canSellProducts();
  if (key === "artist") return canUploadMusic();
  if (key === "upload") return canUpload();
  if (key === "messages") return canSendMessage();
  if (key === "notifications") return canUseNotifications();
  if (key === "edit") return canEditProfile();
  if (key === "settings") return isSignedIn();

  if (
    key === "secretDoor" ||
    key === "secretMeta2" ||
    key === "secretMeta3" ||
    key === "rb-secret-door" ||
    key === "rb-secret-meta2" ||
    key === "rb-secret-meta3"
  ) {
    return canAccessSecret();
  }

  return true;
}

export function canAccessRoutePath(path = null) {
  const clean = normalizePath(path || getCurrentPath());

  if (isAdminRoute(clean)) return canAccessAdmin();
  if (isCreatorRoute(clean)) return canManageCreatorHub();
  if (isSellerRoute(clean)) return canSellProducts();
  if (isArtistRoute(clean)) return canUploadMusic();
  if (isSecretRoute(clean)) return canAccessSecret();

  if (isProtectedRoute(clean)) {
    return isSignedIn();
  }

  return true;
}

export function guardRouteKey(routeKey = "", redirectTo = null) {
  if (canAccessRouteKey(routeKey)) return true;

  if (isBrowser()) {
    window.location.href =
      redirectTo ||
      getFallbackRouteForAccess();
  }

  return false;
}

export function guardRoutePath(path = null, redirectTo = null) {
  if (canAccessRoutePath(path)) return true;

  if (isBrowser()) {
    window.location.href =
      redirectTo ||
      getFallbackRouteForAccess();
  }

  return false;
}

/* =========================
   PAGE GUARDS
========================= */

export async function requireSession({
  redirectTo = null
} = {}) {
  await bootAuth?.();

  if (isSignedIn()) return true;

  if (isBrowser()) {
    const fallback = redirectTo || RB_ROUTES.auth || "/auth";
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `${fallback}?next=${next}`;
  }

  return false;
}

export async function blockSession({
  redirectTo = null
} = {}) {
  await bootAuth?.();

  if (!isSignedIn()) return true;

  if (isBrowser()) {
    window.location.href = redirectTo || RB_ROUTES.home || "/";
  }

  return false;
}

export async function requireCreator(options = {}) {
  await requireSession(options);
  return guardRouteKey("creator", options.redirectTo);
}

export async function requireArtist(options = {}) {
  await requireSession(options);
  return guardRouteKey("artist", options.redirectTo);
}

export async function requireSeller(options = {}) {
  await requireSession(options);
  return guardRouteKey("seller", options.redirectTo);
}

export async function requireAdmin(options = {}) {
  await requireSession(options);
  return guardRouteKey("admin", options.redirectTo);
}

export async function autoGuardCurrentPage({
  redirectTo = null
} = {}) {
  await bootAuth?.();

  const path = getCurrentPath();

  if (!canAccessRoutePath(path)) {
    return guardRoutePath(path, redirectTo);
  }

  return true;
}

console.log("RB GUARDS READY");
