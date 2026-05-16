/* =========================
   RICH BIZNESS MOBILE
   /core/features/auth/auth-ui.js

   CINEMATIC AUTH UI BINDINGS
========================= */

import {
  rbSignIn,
  rbSignUp,
  rbSignOut
} from "/core/shared/rb-auth.js";

import {
  onAuthState,
  initAuthState
} from "/core/features/auth/auth-state.js";

import {
  toastError,
  toastSuccess,
  toastInfo
} from "/core/shared/rb-toast.js";

/* =========================
   HELPERS
========================= */

const $ = (selector) => document.querySelector(selector);

function getFormValue(form, name) {
  return String(new FormData(form).get(name) || "").trim();
}

function setLoading(form, isLoading) {
  form?.classList.toggle("is-loading", isLoading);

  form
    ?.querySelectorAll("button, input")
    .forEach((el) => {
      el.disabled = isLoading;
    });
}

function switchMode(mode = "signin") {
  document.body.dataset.authMode = mode;

  $(".rb-auth-panel")?.classList.toggle(
    "is-signup",
    mode === "signup"
  );

  $(".rb-auth-panel")?.classList.toggle(
    "is-signin",
    mode === "signin"
  );
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
   SIGN OUT BUTTONS
========================= */

export function bindSignOutButtons(selector = "[data-rb-signout]") {
  document.querySelectorAll(selector).forEach((button) => {
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
   MODE TOGGLES
========================= */

export function bindAuthModeToggles() {
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      switchMode(button.dataset.authMode || "signin");
    });
  });
}

/* =========================
   AUTH STATUS UI
========================= */

export function bindAuthStatus() {
  onAuthState((state) => {
    document.body.classList.toggle("is-authed", state.isAuthed);
    document.body.classList.toggle("is-guest", !state.isAuthed);

    document.querySelectorAll("[data-rb-auth-email]").forEach((el) => {
      el.textContent = state.user?.email || "Guest";
    });

    document.querySelectorAll("[data-rb-auth-name]").forEach((el) => {
      el.textContent =
        state.profile?.display_name ||
        state.profile?.username ||
        state.user?.email?.split("@")[0] ||
        "Guest Mode";
    });
  });
}

/* =========================
   INIT
========================= */

export async function initAuthUI() {
  await initAuthState();

  bindSignInForm();
  bindSignUpForm();
  bindSignOutButtons();
  bindAuthModeToggles();
  bindAuthStatus();

  switchMode("signin");

  toastInfo("Identity system online.", "Rich Bizness");
}
