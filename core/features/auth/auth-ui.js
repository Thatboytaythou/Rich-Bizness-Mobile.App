/* =========================================
   RICH BIZNESS LLC
   /core/features/auth/auth-ui.js
   CINEMATIC AUTH UI BINDINGS - POLISHED
========================================= */

import { RB_ROUTES } from "/core/shared/rb-config.js";

import {
  rbSignIn,
  rbSignUp,
  rbSignOut,
  signInWithProvider
} from "/core/shared/rb-auth.js";

import {
  initAuthState,
  onAuthState,
  refreshAuthProfile
} from "/core/features/auth/auth-state.js";

import {
  profileAvatar,
  profileName,
  profileHandle,
  profileBadge
} from "/core/shared/rb-profile.js";

import {
  toastError,
  toastSuccess,
  toastInfo
} from "/core/shared/rb-toast.js";

const DEFAULT_AVATAR = "/images/brand/project-avatar.png.jpeg";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

/* ====================== UTILITIES ====================== */

function getFormValue(form, name) {
  return String(new FormData(form).get(name) || "").trim();
}

function setLoading(form, isLoading) {
  if (!form) return;

  form.classList.toggle("is-loading", isLoading);

  form.querySelectorAll("button, input, textarea, select").forEach((el) => {
    el.disabled = isLoading;
  });
}

function resetForm(form) {
  if (form) form.reset();
}

function bindOnce(el, key) {
  if (!el) return false;
  const flag = `rbBound${key}`;
  if (el.dataset[flag] === "true") return false;
  el.dataset[flag] = "true";
  return true;
}

/* ====================== UI STATE ====================== */

function switchMode(mode = "signin") {
  const nextMode = mode === "signup" ? "signup" : "signin";

  document.body.dataset.authMode = nextMode;

  const panel = $(".rb-auth-panel");
  if (panel) {
    panel.classList.remove("is-signin", "is-signup");
    panel.classList.add(nextMode === "signup" ? "is-signup" : "is-signin");
  }

  $$("[data-auth-mode]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.authMode === nextMode);
  });
}

export function paintAuthIdentity(state = {}) {
  const user = state?.user || null;
  const profile = state?.profile || null;
  const isAuthed = !!user;

  document.body.classList.toggle("is-authed", isAuthed);
  document.body.classList.toggle("is-guest", !isAuthed);

  $$("[data-rb-auth-email]").forEach((el) => {
    el.textContent = user?.email || "Guest";
  });

  $$("[data-rb-auth-name]").forEach((el) => {
    el.textContent = isAuthed ? profileName(profile) : "Guest Mode";
  });

  $$("[data-rb-auth-handle]").forEach((el) => {
    el.textContent = isAuthed ? profileHandle(profile) : "@guest";
  });

  $$("[data-rb-auth-badge]").forEach((el) => {
    el.textContent = isAuthed ? profileBadge(profile) : "SIGN IN";
  });

  $$("[data-rb-auth-avatar]").forEach((el) => {
    const src = isAuthed ? profileAvatar(profile) : DEFAULT_AVATAR;
    if (el.tagName === "IMG") {
      el.src = src;
      el.alt = isAuthed ? profileName(profile) : "Guest";
    } else {
      el.style.backgroundImage = `url("${src}")`;
    }
  });
}

/* ====================== FORM HANDLERS ====================== */

export function bindSignInForm(selector = "#rb-signin-form") {
  const form = $(selector);
  if (!form || !bindOnce(form, "Signin")) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = getFormValue(form, "email");
    const password = getFormValue(form, "password");

    if (!email || !password) {
      toastError("Please enter email and password.");
      return;
    }

    try {
      setLoading(form, true);
      await rbSignIn({ email, password, redirectTo: RB_ROUTES.profile || "/" });
      toastSuccess("Welcome back to the Universe.");
    } catch (error) {
      console.error(error);
      toastError(error?.message || "Sign in failed.");
    } finally {
      setLoading(form, false);
    }
  });
}

export function bindSignUpForm(selector = "#rb-signup-form") {
  const form = $(selector);
  if (!form || !bindOnce(form, "Signup")) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const displayName = getFormValue(form, "display_name");
    const username = getFormValue(form, "username").replace("@", "").toLowerCase();
    const email = getFormValue(form, "email");
    const password = getFormValue(form, "password");

    if (!email || !password) {
      toastError("Email and password are required.");
      return;
    }

    if (password.length < 6) {
      toastError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(form, true);
      await rbSignUp({ email, password, username, displayName });
      await refreshAuthProfile();
      toastSuccess("Account created successfully!");
      resetForm(form);
      switchMode("signin");
    } catch (error) {
      console.error(error);
      toastError(error?.message || "Sign up failed.");
    } finally {
      setLoading(form, false);
    }
  });
}

/* ====================== OAUTH & SIGN OUT ====================== */

export function bindOAuthButtons() {
  $$("[data-oauth-provider]").forEach((btn) => {
    if (!bindOnce(btn, "OAuth")) return;

    btn.addEventListener("click", async () => {
      const provider = btn.dataset.oauthProvider;
      if (!provider) return;

      try {
        btn.disabled = true;
        await signInWithProvider(provider);
      } catch (error) {
        console.error(error);
        toastError(error?.message || "OAuth sign in failed.");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

export function bindSignOutButtons(selector = "[data-rb-signout]") {
  $$(selector).forEach((btn) => {
    if (!bindOnce(btn, "Signout")) return;

    btn.addEventListener("click", async () => {
      try {
        btn.disabled = true;
        await rbSignOut({ redirectTo: RB_ROUTES.auth || "/" });
        toastInfo("Signed out successfully.");
      } catch (error) {
        console.error(error);
        toastError(error?.message || "Sign out failed.");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

/* ====================== MODE TOGGLES ====================== */

export function bindAuthModeToggles() {
  $$("[data-auth-mode]").forEach((btn) => {
    if (!bindOnce(btn, "Mode")) return;

    btn.addEventListener("click", () => {
      switchMode(btn.dataset.authMode);
    });
  });
}

/* ====================== GLOBAL AUTH LISTENER ====================== */

export function bindAuthStatus() {
  if (document.body.dataset.rbAuthStatusBound === "true") return;
  document.body.dataset.rbAuthStatusBound = "true";

  onAuthState((state) => {
    paintAuthIdentity(state);
  });
}

/* ====================== MAIN INIT ====================== */

export async function initAuthUI({ showBootToast = false } = {}) {
  try {
    const state = await initAuthState();
    paintAuthIdentity(state);

    bindSignInForm();
    bindSignUpForm();
    bindOAuthButtons();
    bindSignOutButtons();
    bindAuthModeToggles();
    bindAuthStatus();

    // Default to signin if no mode set
    switchMode(document.body.dataset.authMode || "signin");

    if (showBootToast) {
      toastInfo("Identity system online.", "Rich Bizness");
    }

    console.log("🚀 RB AUTH UI INITIALIZED");
    return state;
  } catch (error) {
    console.error("Auth UI init failed:", error);
    toastError("Failed to initialize auth system.");
  }
}

console.log("RB AUTH UI MODULE LOADED");
