/* =========================
   RICH BIZNESS MOBILE
   /core/features/auth/auth-ui.js

   CINEMATIC AUTH UI BINDINGS
   Hardened Auth Sync
   Safari Form Switch Fixed
========================= */

import {
  rbSignIn,
  rbSignUp,
  rbSignOut
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

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function getFormValue(form, name) {
  return String(new FormData(form).get(name) || "").trim();
}

function setLoading(form, isLoading) {
  form?.classList.toggle("is-loading", isLoading);

  form?.querySelectorAll("button, input").forEach((el) => {
    el.disabled = isLoading;
  });
}

function switchMode(mode = "signin") {
  const nextMode = mode === "signup" ? "signup" : "signin";

  document.body.dataset.authMode = nextMode;

  const panel = $(".rb-auth-panel");

  if (!panel) return;

  panel.classList.remove("is-signin", "is-signup");

  panel.classList.add(
    nextMode === "signup"
      ? "is-signup"
      : "is-signin"
  );

  $$("[data-auth-mode]").forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.authMode === nextMode
    );
  });
}

/* =========================
   GLOBAL IDENTITY PAINT
========================= */

export function paintAuthIdentity(state) {
  const user = state?.user || null;
  const profile = state?.profile || null;
  const authed = !!user;

  document.body.classList.toggle("is-authed", authed);
  document.body.classList.toggle("is-guest", !authed);

  $$("[data-rb-auth-email]").forEach((el) => {
    el.textContent = user?.email || "Guest";
  });

  $$("[data-rb-auth-name]").forEach((el) => {
    el.textContent = authed ? profileName(profile) : "Guest Mode";
  });

  $$("[data-rb-auth-handle]").forEach((el) => {
    el.textContent = authed ? profileHandle(profile) : "@guest";
  });

  $$("[data-rb-auth-badge]").forEach((el) => {
    el.textContent = authed ? profileBadge(profile) : "SIGN IN";
  });

  $$("[data-rb-auth-avatar]").forEach((img) => {
    img.src = authed
      ? profileAvatar(profile)
      : "/images/profile/default-avatar.png";
  });
}

/* =========================
   SIGN IN FORM
========================= */

export function bindSignInForm(selector = "#rb-signin-form") {
  const form = $(selector);
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = getFormValue(form, "email");
    const password = getFormValue(form, "password");

    if (!email || !password) {
      toastError("Enter your email and password.");
      return;
    }

    try {
      setLoading(form, true);

      await rbSignIn({
        email,
        password,
        redirectTo: "/"
      });
    } catch (error) {
      toastError(error.message || "Sign in failed.");
    } finally {
      setLoading(form, false);
    }
  });
}

/* =========================
   SIGN UP FORM
========================= */

export function bindSignUpForm(selector = "#rb-signup-form") {
  const form = $(selector);
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const displayName = getFormValue(form, "display_name");
    const username = getFormValue(form, "username");
    const email = getFormValue(form, "email");
    const password = getFormValue(form, "password");

    if (!email || !password) {
      toastError("Email and password are required.");
      return;
    }

    try {
      setLoading(form, true);

      await rbSignUp({
        email,
        password,
        username,
        displayName
      });

      await refreshAuthProfile();

      toastSuccess("Account created. Sign in when ready.");
      switchMode("signin");
    } catch (error) {
      toastError(error.message || "Sign up failed.");
    } finally {
      setLoading(form, false);
    }
  });
}

/* =========================
   SIGN OUT
========================= */

export function bindSignOutButtons(selector = "[data-rb-signout]") {
  $$(selector).forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await rbSignOut({ redirectTo: "/auth" });
      } catch (error) {
        toastError(error.message || "Sign out failed.");
      }
    });
  });
}

/* =========================
   MODES
========================= */

export function bindAuthModeToggles() {
  $$("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      switchMode(button.dataset.authMode || "signin");
    });
  });
}

/* =========================
   STATUS SYNC
========================= */

export function bindAuthStatus() {
  onAuthState((state) => {
    paintAuthIdentity(state);
  });
}

/* =========================
   INIT
========================= */

export async function initAuthUI() {
  const state = await initAuthState();

  paintAuthIdentity(state);

  bindSignInForm();
  bindSignUpForm();
  bindSignOutButtons();
  bindAuthModeToggles();
  bindAuthStatus();

  switchMode(
    document.body.dataset.authMode || "signin"
  );

  toastInfo("Identity system online.", "Rich Bizness");
}
