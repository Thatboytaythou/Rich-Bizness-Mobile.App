/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-auth.js

   AUTH SYSTEM
   Synced To rb-supabase.js
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
  RB_ROUTES
} from "/core/shared/rb-config.js";

const supabase = getSupabase();

await bootAuth();

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

export async function rbSignUp({
  email,
  password,
  username = "",
  displayName = ""
}) {
  return await signUp({
    email,
    password,
    metadata: {
      username,
      display_name: displayName
    }
  });
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

document.body.classList.add("rb-auth-loaded");

console.log("RB AUTH READY");
