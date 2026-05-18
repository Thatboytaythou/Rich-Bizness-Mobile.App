/* =========================
   RICH BIZNESS MOBILE
   /core/features/auth/auth-ui.js

   CINEMATIC AUTH UI BINDINGS
   FINAL LOCKED VERSION
========================= */

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

const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  document.querySelectorAll(selector);

/* =========================
   HELPERS
========================= */

function getFormValue(form, name) {
  return String(
    new FormData(form).get(name) || ""
  ).trim();
}

function setLoading(form, isLoading) {
  form?.classList.toggle(
    "is-loading",
    isLoading
  );

  form
    ?.querySelectorAll(
      "button,input,textarea,select"
    )
    .forEach((el) => {
      el.disabled = isLoading;
    });
}

function resetForm(form) {
  if (!form) return;

  form.reset();
}

function switchMode(mode = "signin") {
  const nextMode =
    mode === "signup"
      ? "signup"
      : "signin";

  document.body.dataset.authMode =
    nextMode;

  const panel = $(".rb-auth-panel");

  if (panel) {
    panel.classList.remove(
      "is-signin",
      "is-signup"
    );

    panel.classList.add(
      nextMode === "signup"
        ? "is-signup"
        : "is-signin"
    );
  }

  $$("[data-auth-mode]").forEach(
    (button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.authMode ===
          nextMode
      );
    }
  );
}

/* =========================
   GLOBAL IDENTITY PAINT
========================= */

export function paintAuthIdentity(
  state
) {
  const user = state?.user || null;

  const profile =
    state?.profile || null;

  const authed = !!user;

  document.body.classList.toggle(
    "is-authed",
    authed
  );

  document.body.classList.toggle(
    "is-guest",
    !authed
  );

  $$("[data-rb-auth-email]").forEach(
    (el) => {
      el.textContent =
        user?.email || "Guest";
    }
  );

  $$("[data-rb-auth-name]").forEach(
    (el) => {
      el.textContent = authed
        ? profileName(profile)
        : "Guest Mode";
    }
  );

  $$("[data-rb-auth-handle]").forEach(
    (el) => {
      el.textContent = authed
        ? profileHandle(profile)
        : "@guest";
    }
  );

  $$("[data-rb-auth-badge]").forEach(
    (el) => {
      el.textContent = authed
        ? profileBadge(profile)
        : "SIGN IN";
    }
  );

  $$("[data-rb-auth-avatar]").forEach(
    (img) => {
      img.src = authed
        ? profileAvatar(profile)
        : "/images/profile/default-avatar.png";
    }
  );
}

/* =========================
   SIGN IN
========================= */

export function bindSignInForm(
  selector = "#rb-signin-form"
) {
  const form = $(selector);

  if (!form) return;

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const email =
        getFormValue(form, "email");

      const password =
        getFormValue(
          form,
          "password"
        );

      if (!email || !password) {
        toastError(
          "Enter your email and password."
        );

        return;
      }

      try {
        setLoading(form, true);

        await rbSignIn({
          email,
          password,
          redirectTo: "/profile"
        });

        toastSuccess(
          "Welcome back."
        );
      } catch (error) {
        console.error(error);

        toastError(
          error?.message ||
            "Sign in failed."
        );
      } finally {
        setLoading(form, false);
      }
    }
  );
}

/* =========================
   SIGN UP
========================= */

export function bindSignUpForm(
  selector = "#rb-signup-form"
) {
  const form = $(selector);

  if (!form) return;

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const displayName =
        getFormValue(
          form,
          "display_name"
        );

      const username =
        getFormValue(
          form,
          "username"
        );

      const email =
        getFormValue(form, "email");

      const password =
        getFormValue(
          form,
          "password"
        );

      if (!email || !password) {
        toastError(
          "Email and password are required."
        );

        return;
      }

      if (password.length < 6) {
        toastError(
          "Password must be at least 6 characters."
        );

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

        toastSuccess(
          "Account created successfully."
        );

        resetForm(form);

        switchMode("signin");
      } catch (error) {
        console.error(error);

        toastError(
          error?.message ||
            "Sign up failed."
        );
      } finally {
        setLoading(form, false);
      }
    }
  );
}

/* =========================
   OAUTH
========================= */

export function bindOAuthButtons() {
  $$("[data-oauth-provider]").forEach(
    (button) => {
      button.addEventListener(
        "click",
        async () => {
          const provider =
            button.dataset
              .oauthProvider;

          if (!provider) return;

          try {
            await signInWithProvider(
              provider
            );
          } catch (error) {
            toastError(
              error?.message ||
                "OAuth failed."
            );
          }
        }
      );
    }
  );
}

/* =========================
   SIGN OUT
========================= */

export function bindSignOutButtons(
  selector = "[data-rb-signout]"
) {
  $$(selector).forEach((button) => {
    button.addEventListener(
      "click",
      async () => {
        try {
          await rbSignOut({
            redirectTo: "/auth"
          });

          toastInfo(
            "Signed out."
          );
        } catch (error) {
          toastError(
            error?.message ||
              "Sign out failed."
          );
        }
      }
    );
  });
}

/* =========================
   AUTH MODE TOGGLES
========================= */

export function bindAuthModeToggles() {
  $$("[data-auth-mode]").forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          switchMode(
            button.dataset.authMode ||
              "signin"
          );
        }
      );
    }
  );
}

/* =========================
   LIVE STATUS SYNC
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
  const state =
    await initAuthState();

  paintAuthIdentity(state);

  bindSignInForm();

  bindSignUpForm();

  bindOAuthButtons();

  bindSignOutButtons();

  bindAuthModeToggles();

  bindAuthStatus();

  switchMode(
    document.body.dataset
      .authMode || "signin"
  );

  toastInfo(
    "Identity system online.",
    "Rich Bizness"
  );

  return state;
}

console.log(
  "RB AUTH UI READY"
);
