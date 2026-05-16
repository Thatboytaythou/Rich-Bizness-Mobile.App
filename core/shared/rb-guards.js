/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-guards.js

   GLOBAL GUARD HUB
========================= */

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

/* =========================
   EXPORT GUARDS
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
   ACCESS HELPERS
========================= */

export function canEditOwner(ownerId) {
  const state = getAuthState();

  return !!state.user?.id && state.user.id === ownerId;
}

export function canAccessPrivateContent(ownerId) {
  const state = getAuthState();

  return !!state.user?.id && state.user.id === ownerId;
}

export function isPlatformAdmin() {
  return getAuthFlags().isAdmin;
}

export function canCreateContent() {
  const flags = getAuthFlags();

  return (
    flags.isCreator ||
    flags.isArtist ||
    flags.isSeller ||
    flags.isAdmin
  );
}

export function canSellProducts() {
  const flags = getAuthFlags();

  return flags.isSeller || flags.isAdmin;
}

export function canUploadMusic() {
  const flags = getAuthFlags();

  return flags.isArtist || flags.isAdmin;
}

export function canGoLive() {
  const flags = getAuthFlags();

  return flags.isCreator || flags.isAdmin;
}
