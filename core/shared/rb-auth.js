 /* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-auth.js

   AUTH SYSTEM
   Synced To rb-supabase.js
   Profile Upsert Locked
========================= */

import {
  getSupabase,
  getSession,
  getUser,
  getProfile,
  bootAuth,
  loadProfile,
  signUp,
  signIn,
  signOut,
  isAuthed
} from "/core/shared/rb-supabase.js";

import {
  RB_ROUTES,
  RB_TABLES
} from "/core/shared/rb-config.js";

const supabase = getSupabase();

const DEFAULT_AVATAR =
  "/images/brand/project-avatar.png.jpeg";

const DEFAULT_BANNER =
  "/images/brand/Avatar-hero-Banner.png.jpeg";

export {
  getSupabase,
  getSession,
  getUser,
  getProfile,
  bootAuth,
  loadProfile,
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

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .upsert(
      {
        id: user.id,
        username: finalUsername,
        display_name: finalDisplayName,
        full_name: existingProfile?.full_name || finalDisplayName,
        avatar_url: finalAvatar,
        banner_url: finalBanner,
        role: finalRole,
        online_status: "online",
        last_seen_at: now,
        updated_at: now
      },
      { onConflict: "id" }
    )
    .select()
    .maybeSingle();

  if (error) {
    console.warn("[RB PROFILE UPSERT WARNING]", error.message);
    return null;
  }

  await loadProfile(user.id);
  return data;
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
      display_name: displayName
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
        redirectTo: window.location.origin
      }
    });

  if (error) throw error;
  return data;
}

export async function refreshProfile() {
  const user = getUser();
  if (!user?.id) return null;
  return await loadProfile(user.id);
}

window.addEventListener("focus", async () => {
  if (getUser()?.id) {
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
