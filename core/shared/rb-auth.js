/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-auth.js

   AUTH CONTROLLER
========================= */

import {
  RB_CONFIG,
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getSession,
  getUser,
  getProfile,
  bootAuth,
  signUp,
  signIn,
  signOut,
  loadProfile,
  isAuthed
} from "/core/shared/rb-supabase.js";

import {
  toastSuccess,
  toastError,
  toastInfo
} from "/core/shared/rb-toast.js";

/* =========================
   STATE EXPORTS
========================= */

export {
  getSupabase,
  getSession,
  getUser,
  getProfile,
  bootAuth,
  loadProfile,
  isAuthed
};

/* =========================
   AUTH ACTIONS
========================= */

export async function rbSignUp({
  email,
  password,
  username = "",
  displayName = ""
}) {
  try {
    const data = await signUp({
      email,
      password,
      metadata: {
        username,
        display_name: displayName
      }
    });

    toastSuccess(
      "Account created. Check your email if confirmation is required.",
      "Welcome to Rich Bizness"
    );

    return data;
  } catch (error) {
    toastError(error.message || "Could not create account.");
    throw error;
  }
}

export async function rbSignIn({
  email,
  password,
  redirectTo = RB_ROUTES.home
}) {
  try {
    const data = await signIn({
      email,
      password
    });

    toastSuccess("Signed in successfully.", "Welcome back");

    if (redirectTo) {
      window.location.href = redirectTo;
    }

    return data;
  } catch (error) {
    toastError(error.message || "Could not sign in.");
    throw error;
  }
}

export async function rbSignOut({
  redirectTo = RB_ROUTES.auth
} = {}) {
  try {
    await signOut();

    toastInfo("Signed out.");

    if (redirectTo) {
      window.location.href = redirectTo;
    }
  } catch (error) {
    toastError(error.message || "Could not sign out.");
    throw error;
  }
}

/* =========================
   PAGE GUARDS
========================= */

export async function requireAuth({
  redirectTo = RB_ROUTES.auth
} = {}) {
  await bootAuth();

  if (!isAuthed()) {
    window.location.href = redirectTo;
    return null;
  }

  return getUser();
}

export async function redirectIfAuthed({
  redirectTo = RB_ROUTES.home
} = {}) {
  await bootAuth();

  if (isAuthed()) {
    window.location.href = redirectTo;
    return true;
  }

  return false;
}

/* =========================
   PROFILE HELPERS
========================= */

export async function getFreshProfile() {
  const user = getUser();

  if (!user?.id) return null;

  return await loadProfile(user.id);
}

export function getDisplayIdentity() {
  const user = getUser();
  const profile = getProfile();

  return {
    id: user?.id || null,
    email: user?.email || "",
    username: profile?.username || "",
    displayName:
      profile?.display_name ||
      profile?.full_name ||
      profile?.username ||
      user?.email?.split("@")[0] ||
      "Rich User",
    avatarUrl: profile?.avatar_url || "",
    bannerUrl: profile?.banner_url || "",
    role: profile?.role || "user",
    isCreator: !!profile?.is_creator,
    isArtist: !!profile?.is_artist,
    isSeller: !!profile?.is_seller,
    isVerified: !!profile?.is_verified
  };
}

/* =========================
   AUTH FORM BINDERS
========================= */

export function bindAuthForms({
  signInFormSelector = "#signin-form",
  signUpFormSelector = "#signup-form"
} = {}) {
  const signInForm = document.querySelector(signInFormSelector);
  const signUpForm = document.querySelector(signUpFormSelector);

  if (signInForm) {
    signInForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const form = new FormData(signInForm);

      await rbSignIn({
        email: String(form.get("email") || "").trim(),
        password: String(form.get("password") || "")
      });
    });
  }

  if (signUpForm) {
    signUpForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const form = new FormData(signUpForm);

      await rbSignUp({
        email: String(form.get("email") || "").trim(),
        password: String(form.get("password") || ""),
        username: String(form.get("username") || "").trim(),
        displayName: String(form.get("display_name") || "").trim()
      });
    });
  }
}
