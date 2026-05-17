/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-auth.js

   AUTH SYSTEM
   Synced To rb-supabase.js
   Profile Upsert Locked
   No Import-Time Auth Boot
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
  return String(email || "")
    .split("@")[0]
    .replace(/[^a-zA-Z0-9_ ]/g, "")
    .trim() || "Rich User";
}

async function upsertProfileFromAuth({
  user,
  email,
  username = "",
  displayName = ""
}) {
  if (!user?.id) return null;

  const finalUsername =
    cleanUsername(username) ||
    cleanUsername(email.split("@")[0]) ||
    `rich_${user.id.slice(0, 8)}`;

  const finalDisplayName =
    String(displayName || "").trim() ||
    fallbackName(email);

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .upsert(
      {
        id: user.id,
        username: finalUsername,
        display_name: finalDisplayName,
        full_name: finalDisplayName,
        avatar_url: "/images/profile/default-avatar.png",
        banner_url: "/images/profile/default-banner.png",
        role: "user",
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "id"
      }
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
      username,
      display_name: displayName
    }
  });

  const user =
    data?.user ||
    data?.session?.user ||
    null;

  if (user?.id) {
    await upsertProfileFromAuth({
      user,
      email,
      username,
      displayName
    });
  }

  return data;
}

export async function rbSignIn({
  email,
  password,
  redirectTo = RB_ROUTES.home
}) {
  const data = await signIn({
    email,
    password
  });

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
  }

  if (redirectTo) {
    window.location.href = redirectTo;
  }

  return data;
}

export async function rbSignOut({
  redirectTo = RB_ROUTES.auth
} = {}) {
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

if (document.body) {
  document.body.classList.add("rb-auth-loaded");
}

console.log("RB AUTH READY");
