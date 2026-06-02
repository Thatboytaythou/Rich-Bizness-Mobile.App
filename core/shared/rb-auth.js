/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-auth.js

   AUTH SYSTEM
   Synced To rb-supabase.js
   Profile Upsert Locked
   Auto Profile Ensure Enabled
   Profile Keys Locked
========================= */

import {
  getSupabase,
  getSession,
  getUser,
  getProfile,
  bootAuth,
  loadProfile,
  ensureProfile,
  ensureProfileIdentityRows,
  signUp,
  signIn,
  signOut,
  isAuthed
} from "/core/shared/rb-supabase.js";

import {
  RB_ROUTES,
  RB_TABLES,
  RB_PROFILE_KEYS
} from "/core/shared/rb-config.js";

const supabase = getSupabase();

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";
const DEFAULT_BANNER = "/images/brand/hero-banner.png";

export {
  getSupabase,
  getSession,
  getUser,
  getProfile,
  bootAuth,
  loadProfile,
  ensureProfile,
  ensureProfileIdentityRows,
  isAuthed
};

export function getAuthState() {
  return {
    session: getSession(),
    user: getUser(),
    profile: getProfile(),
    authed: isAuthed()
  };
}

function cleanUsername(username = "") {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace("@", "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

function fallbackName(email = "") {
  return (
    String(email || "")
      .split("@")[0]
      .replace(/[^a-zA-Z0-9_ ]/g, "")
      .trim() || "Rich User"
  );
}

function getMetadata(user) {
  return user?.user_metadata || {};
}

function getAvatarFromUser(user) {
  const metadata = getMetadata(user);

  return (
    metadata.avatar_url ||
    metadata.picture ||
    metadata.avatar ||
    DEFAULT_AVATAR
  );
}

function getBannerFromUser(user) {
  const metadata = getMetadata(user);

  return (
    metadata.banner_url ||
    metadata.cover_url ||
    DEFAULT_BANNER
  );
}

async function getExistingProfile(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[RB PROFILE LOAD WARNING]", error.message);
    return null;
  }

  return data || null;
}

async function ensureProfileExtensionTables(profile) {
  if (!profile?.id) return;

  const now = new Date().toISOString();

  const baseIdentity = {
    user_id: profile.id,
    username: profile.username || null,
    display_name: profile.display_name || profile.username || "Rich User",
    metadata: {
      source: "rb-auth.js",
      profile_locked: true
    },
    updated_at: now
  };

  const jobs = [
    {
      table: RB_TABLES.userSettings,
      payload: {
        user_id: profile.id,
        updated_at: now
      }
    },
    {
      table: RB_TABLES.userLevels,
      payload: {
        user_id: profile.id,
        updated_at: now
      }
    },
    {
      table: RB_TABLES.profileThemeSettings,
      payload: {
        user_id: profile.id,
        background_url: profile.banner_url || DEFAULT_BANNER,
        updated_at: now
      }
    },
    {
      table: RB_TABLES.metaAvatars,
      payload: {
        user_id: profile.id,
        display_name: profile.display_name || profile.username || "Rich User",
        avatar_url: profile.avatar_url || DEFAULT_AVATAR,
        updated_at: now,
        metadata: {
          source: "rb-auth.js",
          profile_locked: true
        }
      }
    },
    {
      table: RB_TABLES.gamerProfiles,
      payload: {
        ...baseIdentity,
        avatar_url: profile.avatar_url || DEFAULT_AVATAR,
        banner_url: profile.banner_url || DEFAULT_BANNER
      }
    },
    {
      table: RB_TABLES.sportsProfiles,
      payload: {
        ...baseIdentity
      }
    },
    {
      table: RB_TABLES.storeSellerProfiles,
      payload: {
        ...baseIdentity,
        avatar_url: profile.avatar_url || DEFAULT_AVATAR,
        banner_url: profile.banner_url || DEFAULT_BANNER
      }
    },
    {
      table: RB_TABLES.creatorPageSettings,
      payload: {
        user_id: profile.id,
        hero_background_url: profile.banner_url || DEFAULT_BANNER,
        updated_at: now
      }
    }
  ];

  await Promise.allSettled(
    jobs
      .filter((job) => job.table)
      .map((job) =>
        supabase.from(job.table).upsert(job.payload, {
          onConflict: "user_id"
        })
      )
  );
}

async function upsertProfileFromAuth({
  user,
  email,
  username = "",
  displayName = ""
}) {
  if (!user?.id) return null;

  const metadata = getMetadata(user);
  const existingProfile = await getExistingProfile(user.id);

  const finalUsername =
    existingProfile?.username ||
    cleanUsername(username) ||
    cleanUsername(metadata.username) ||
    cleanUsername(String(email || user.email || "").split("@")[0]) ||
    `rich_${user.id.slice(0, 8)}`;

  const finalDisplayName =
    existingProfile?.display_name ||
    String(displayName || "").trim() ||
    metadata.display_name ||
    metadata.full_name ||
    fallbackName(email || user.email);

  const finalAvatar =
    existingProfile?.avatar_url ||
    getAvatarFromUser(user);

  const finalBanner =
    existingProfile?.banner_url ||
    getBannerFromUser(user);

  const finalRole =
    existingProfile?.role ||
    metadata.role ||
    "user";

  const now = new Date().toISOString();

  const payload = {
    id: user.id,
    username: finalUsername,
    display_name: finalDisplayName,
    full_name: existingProfile?.full_name || finalDisplayName,
    avatar_url: finalAvatar,
    banner_url: finalBanner,
    role: finalRole,
    online_status: "online",
    last_seen_at: now,
    updated_at: now,
    metadata: {
      ...(existingProfile?.metadata || {}),
      profile_lock: true,
      profile_source: RB_PROFILE_KEYS?.identitySource || "profiles",
      auth_storage_key: "rich-bizness-mobile-auth",
      secret_routes_enabled: true
    }
  };

  if (!existingProfile?.created_at) {
    payload.created_at = now;
  }

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .maybeSingle();

  if (error) {
    console.warn("[RB PROFILE UPSERT WARNING]", error.message);
    return null;
  }

  await ensureProfileExtensionTables(data);
  await loadProfile(user.id);

  return data;
}

export async function ensureMyProfile() {
  await bootAuth();

  const user = getUser();
  if (!user?.id) return null;

  const existingProfile = await getExistingProfile(user.id);

  if (existingProfile) {
    const now = new Date().toISOString();

    const { data } = await supabase
      .from(RB_TABLES.profiles)
      .update({
        online_status: "online",
        last_seen_at: now,
        updated_at: now,
        metadata: {
          ...(existingProfile.metadata || {}),
          profile_lock: true,
          profile_source: RB_PROFILE_KEYS?.identitySource || "profiles"
        }
      })
      .eq("id", user.id)
      .select("*")
      .maybeSingle();

    const profile = data || existingProfile;

    await ensureProfileExtensionTables(profile);
    await loadProfile(user.id);

    return profile;
  }

  return await upsertProfileFromAuth({
    user,
    email: user.email || "",
    username: user.user_metadata?.username || "",
    displayName:
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      ""
  });
}

export async function rbSignUp({
  email,
  password,
  username = "",
  displayName = ""
}) {
  const data = await signUp({
    email,
    password,
    metadata: {
      username: cleanUsername(username),
      display_name: displayName,
      avatar_url: DEFAULT_AVATAR,
      banner_url: DEFAULT_BANNER
    }
  });

  const user =
    data?.user ||
    data?.session?.user ||
    getUser() ||
    null;

  if (user?.id) {
    await upsertProfileFromAuth({
      user,
      email,
      username,
      displayName
    });

    await refreshProfile();
  }

  return data;
}

export async function rbSignIn({
  email,
  password,
  redirectTo = RB_ROUTES.home
}) {
  const data = await signIn({ email, password });

  const user =
    data?.user ||
    data?.session?.user ||
    getUser();

  if (user?.id) {
    await upsertProfileFromAuth({
      user,
      email,
      username: user.user_metadata?.username || "",
      displayName:
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        ""
    });

    await refreshProfile();
  }

  if (redirectTo) {
    window.location.href = redirectTo;
  }

  return data;
}

export async function rbSignOut({
  redirectTo = RB_ROUTES.auth
} = {}) {
  const user = getUser();

  if (user?.id) {
    await supabase
      .from(RB_TABLES.profiles)
      .update({
        online_status: "offline",
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);
  }

  await signOut();

  if (redirectTo) {
    window.location.href = redirectTo;
  }
}

export async function sendPasswordReset(email) {
  const { data, error } =
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${RB_ROUTES.settings}`
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

export async function signInWithProvider(provider = "google") {
  const { data, error } =
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}${RB_ROUTES.auth}`
      }
    });

  if (error) throw error;
  return data;
}

export async function refreshProfile() {
  const user = getUser();
  if (!user?.id) return null;

  const profile = await loadProfile(user.id);

  if (profile?.id) {
    await ensureProfileExtensionTables(profile);
  }

  return await loadProfile(user.id);
}

export async function requireAuth({
  redirectTo = RB_ROUTES.auth
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

  if (!allowedRoutes.includes(routeKey)) return true;

  return !!(
    profile?.role === "founder" ||
    profile?.role === "admin" ||
    profile?.role === "rich_admin" ||
    profile?.is_creator ||
    profile?.is_verified
  );
}

export function protectRoute(routeKey = "") {
  const controlledRoutes = RB_PROFILE_KEYS?.controlledRoutes || [];

  if (!controlledRoutes.includes(routeKey)) return true;

  if (!isAuthed()) {
    window.location.href =
      `${RB_ROUTES.auth}?next=${encodeURIComponent(window.location.pathname)}`;
    return false;
  }

  if (!canAccessAdminCreatorRoute(routeKey)) {
    window.location.href = RB_ROUTES.profile;
    return false;
  }

  return true;
}

window.addEventListener("focus", async () => {
  if (getUser()?.id) {
    await ensureMyProfile();
    await refreshProfile();
  }
});

window.addEventListener("beforeunload", () => {
  const user = getUser();

  if (user?.id) {
    supabase
      .from(RB_TABLES.profiles)
      .update({
        online_status: "away",
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);
  }
});

if (document.body) {
  document.body.classList.add("rb-auth-loaded");
}

console.log("RB AUTH READY");
