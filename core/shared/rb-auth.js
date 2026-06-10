/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-auth.js

   AUTH WRAPPER

   Locked purpose:
   - wrap rb-supabase auth helpers
   - keep page imports stable
   - enforce auth when needed
   - protect creator/admin/secret routes
   - route after sign in/out

   Identity rules:
   - profiles = account identity
   - profiles.avatar_url = profile image
   - profiles.banner_url = profile banner
   - meta_avatars = starter 3D/avatar universe row
========================= */

import {
  getSupabase,
  getSession,
  getUser,
  getProfile,
  bootAuth,
  loadProfile,
  refreshProfile,
  ensureProfile,
  ensureProfileIdentityRows,
  signUp,
  signIn,
  signOut,
  isAuthed
} from "/core/shared/rb-supabase.js";

import {
  RB_ROUTES,
  RB_PROFILE_KEYS,
  RB_BRAND_ASSETS
} from "/core/shared/rb-config.js";

const DEFAULT_AVATAR =
  RB_BRAND_ASSETS?.defaultProfileAvatar ||
  "/images/brand/Avatar-hero-Banner.png.jpeg";

const DEFAULT_BANNER =
  RB_BRAND_ASSETS?.defaultProfileBanner ||
  "/images/brand/hero-banner.png";

const supabase = getSupabase();

export {
  getSupabase,
  getSession,
  getUser,
  getProfile,
  bootAuth,
  loadProfile,
  refreshProfile,
  ensureProfile,
  ensureProfileIdentityRows,
  isAuthed
};

function cleanUsername(username = "") {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace("@", "")
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 32);
}

function cleanText(value = "", fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function getNextRoute(fallback = RB_ROUTES.home || "/") {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");

  if (!next) return fallback;

  if (next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  return fallback;
}

/* =========================
   STATE
========================= */

export function getAuthState() {
  const user = getUser();
  const profile = getProfile();

  return {
    session: getSession(),
    user,
    profile,
    authed: isAuthed(),
    isAuthed: isAuthed(),
    id: profile?.id || user?.id || null,
    user_id: profile?.id || user?.id || null
  };
}

export function getAuthProfileId() {
  const state = getAuthState();
  return state.id || null;
}

export function getAuthUserId() {
  return getUser()?.id || null;
}

export function getAuthProfileAvatar() {
  const profile = getProfile();
  const user = getUser();
  const metadata = user?.user_metadata || {};

  return (
    profile?.avatar_url ||
    metadata.avatar_url ||
    metadata.picture ||
    DEFAULT_AVATAR
  );
}

export function getAuthProfileBanner() {
  const profile = getProfile();
  const user = getUser();
  const metadata = user?.user_metadata || {};

  return (
    profile?.banner_url ||
    metadata.banner_url ||
    metadata.cover_url ||
    DEFAULT_BANNER
  );
}

/* =========================
   PROFILE ENSURE
========================= */

export async function ensureMyProfile() {
  await bootAuth();

  const user = getUser();

  if (!user?.id) {
    return null;
  }

  const profile = await ensureProfile(user);
  await refreshProfile();

  window.dispatchEvent(
    new CustomEvent("rb:profile-updated", {
      detail: {
        user,
        profile: getProfile() || profile
      }
    })
  );

  return getProfile() || profile;
}

/* =========================
   AUTH ACTIONS
========================= */

export async function rbSignUp({
  email,
  password,
  username = "",
  displayName = "",
  avatarUrl = DEFAULT_AVATAR,
  bannerUrl = DEFAULT_BANNER,
  redirectTo = RB_ROUTES.profile || "/profile"
}) {
  const cleanMetaUsername = cleanUsername(username);
  const cleanDisplayName =
    cleanText(displayName) ||
    cleanMetaUsername ||
    String(email || "").split("@")[0] ||
    "Rich User";

  const data = await signUp({
    email,
    password,
    metadata: {
      username: cleanMetaUsername,
      display_name: cleanDisplayName,
      full_name: cleanDisplayName,
      avatar_url: avatarUrl || DEFAULT_AVATAR,
      banner_url: bannerUrl || DEFAULT_BANNER,
      starter_avatar: true,
      avatar_source: "auth",
      profile_lock: true
    }
  });

  await ensureMyProfile();

  window.dispatchEvent(
    new CustomEvent("rb:auth-signup-complete", {
      detail: getAuthState()
    })
  );

  if (redirectTo) {
    window.location.href = redirectTo;
  }

  return data;
}

export async function rbSignIn({
  email,
  password,
  redirectTo = null
}) {
  const data = await signIn({ email, password });

  await ensureMyProfile();

  window.dispatchEvent(
    new CustomEvent("rb:auth-signin-complete", {
      detail: getAuthState()
    })
  );

  const nextRoute = redirectTo || getNextRoute(RB_ROUTES.home || "/");

  if (nextRoute) {
    window.location.href = nextRoute;
  }

  return data;
}

export async function rbSignOut({
  redirectTo = RB_ROUTES.auth || "/auth"
} = {}) {
  await signOut();

  window.dispatchEvent(
    new CustomEvent("rb:auth-signout-complete", {
      detail: {
        authed: false,
        isAuthed: false
      }
    })
  );

  if (redirectTo) {
    window.location.href = redirectTo;
  }
}

export async function sendPasswordReset(email) {
  const redirectTo =
    `${window.location.origin}${RB_ROUTES.settings || "/settings"}`;

  const { data, error } =
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

  if (error) throw error;

  return data;
}

export async function updatePassword(password) {
  const { data, error } =
    await supabase.auth.updateUser({ password });

  if (error) throw error;

  return data;
}

export async function signInWithProvider(
  provider = "google",
  redirectTo = `${window.location.origin}${RB_ROUTES.auth || "/auth"}`
) {
  const { data, error } =
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo
      }
    });

  if (error) throw error;

  return data;
}

/* =========================
   REQUIRE / PROTECT
========================= */

export async function requireAuth({
  redirectTo = RB_ROUTES.auth || "/auth"
} = {}) {
  await bootAuth();

  if (!getUser()?.id) {
    if (redirectTo) {
      window.location.href =
        `${redirectTo}?next=${encodeURIComponent(window.location.pathname)}`;
    }

    throw new Error("Sign in required.");
  }

  await ensureMyProfile();

  return getAuthState();
}

export function canAccessAdminCreatorRoute(routeKey = "") {
  const profile = getProfile();
  const allowedRoutes = RB_PROFILE_KEYS?.adminCreatorRoutes || [];

  if (!allowedRoutes.includes(routeKey)) {
    return true;
  }

  return Boolean(
    profile?.role === "founder" ||
      profile?.role === "admin" ||
      profile?.role === "rich_admin" ||
      profile?.is_creator ||
      profile?.is_verified
  );
}

export function protectRoute(routeKey = "") {
  const controlledRoutes = RB_PROFILE_KEYS?.controlledRoutes || [];

  if (!controlledRoutes.includes(routeKey)) {
    return true;
  }

  if (!isAuthed()) {
    window.location.href =
      `${RB_ROUTES.auth || "/auth"}?next=${encodeURIComponent(window.location.pathname)}`;
    return false;
  }

  if (!canAccessAdminCreatorRoute(routeKey)) {
    window.location.href = RB_ROUTES.profile || "/profile";
    return false;
  }

  return true;
}

export async function protectRouteAsync(routeKey = "") {
  await bootAuth();
  return protectRoute(routeKey);
}

/* =========================
   PAGE BINDINGS
========================= */

if (!window.__RB_AUTH_FOCUS_BOUND__) {
  window.__RB_AUTH_FOCUS_BOUND__ = true;

  window.addEventListener("focus", async () => {
    if (getUser()?.id) {
      await ensureMyProfile();
      await refreshProfile();

      window.dispatchEvent(
        new CustomEvent("rb:app-identity-refreshed", {
          detail: getAuthState()
        })
      );
    }
  });
}

if (!window.__RB_AUTH_UNLOAD_BOUND__) {
  window.__RB_AUTH_UNLOAD_BOUND__ = true;

  window.addEventListener("beforeunload", () => {
    const user = getUser();

    if (user?.id) {
      supabase
        .from("profiles")
        .update({
          online_status: "away",
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);
    }
  });
}

if (document.body) {
  document.body.classList.add("rb-auth-loaded");
}

console.log("RB AUTH READY");
