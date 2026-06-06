/* =========================================
   RICH BIZNESS LLC
   /core/features/auth/auth-ui.js

   CINEMATIC AUTH UI BINDINGS
   UI only: auth mode, auth identity paint,
   OAuth buttons, signout buttons
========================================= */

import {
  RB_ROUTES,
  RB_BRAND_ASSETS
} from "/core/shared/rb-config.js";

import {
  rbSignOut,
  signInWithProvider
} from "/core/shared/rb-auth.js";

import {
  initAuthState,
  onAuthState
} from "/core/features/auth/auth-state.js";

import {
  profileAvatar,
  profileName,
  profileHandle,
  profileBadge
} from "/core/shared/rb-profile.js";

import {
  toastError,
  toastInfo
} from "/core/shared/rb-toast.js";

const DEFAULT_AVATAR =
  RB_BRAND_ASSETS?.defaultProfileAvatar ||
  "/images/brand/Avatar-hero-Banner.png.jpeg";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

let authUiBooted = false;

function bindOnce(el, key) {
  if (!el) return false;

  const flag = `rbBound${key}`;

  if (el.dataset[flag] === "true") {
    return false;
  }

  el.dataset[flag] = "true";
  return true;
}

function setSelectedTab(mode = "signin") {
  $$("[data-auth-mode]").forEach((btn) => {
    const active = btn.dataset.authMode === mode;

    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });
}

/* =========================
   MODE SWITCH
========================= */

export function switchMode(mode = "signin") {
  const nextMode = mode === "signup" ? "signup" : "signin";

  document.body.dataset.authMode = nextMode;

  const panel = $(".rb-auth-panel") || $("#rb-auth-panel");

  if (panel) {
    panel.classList.remove("is-signin", "is-signup");
    panel.classList.add(nextMode === "signup" ? "is-signup" : "is-signin");
  }

  setSelectedTab(nextMode);

  window.dispatchEvent(
    new CustomEvent("rb:auth-mode-change", {
      detail: {
        mode: nextMode
      }
    })
  );

  return nextMode;
}

/* =========================
   IDENTITY PAINT
========================= */

export function paintAuthIdentity(state = {}) {
  const user = state?.user || null;
  const profile = state?.profile || null;
  const isAuthed = !!user?.id;

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

/* =========================
   BUTTONS
========================= */

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
        console.error("[RB OAUTH FAILED]", error);
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

        await rbSignOut({
          redirectTo: RB_ROUTES.auth || "/auth"
        });
      } catch (error) {
        console.error("[RB SIGNOUT FAILED]", error);
        toastError(error?.message || "Sign out failed.");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

export function bindAuthModeToggles() {
  $$("[data-auth-mode]").forEach((btn) => {
    if (!bindOnce(btn, "Mode")) return;

    btn.addEventListener("click", () => {
      switchMode(btn.dataset.authMode);
    });
  });
}

export function bindForgotPasswordButtons(
  selector = "[data-auth-action='forgot-password']"
) {
  $$(selector).forEach((btn) => {
    if (!bindOnce(btn, "Forgot")) return;

    btn.addEventListener("click", () => {
      const email =
        document.querySelector("#signin-email")?.value ||
        document.querySelector("#rb-signin-form input[name='email']")?.value ||
        "";

      const url = `${RB_ROUTES.auth || "/auth"}?mode=signin&reset=1${
        email ? `&email=${encodeURIComponent(email)}` : ""
      }`;

      window.location.href = url;
    });
  });
}

/* =========================
   STATE BINDING
========================= */

export function bindAuthStatus() {
  if (document.body.dataset.rbAuthStatusBound === "true") return;

  document.body.dataset.rbAuthStatusBound = "true";

  onAuthState((state) => {
    paintAuthIdentity(state);
  });
}

/* =========================
   INIT
========================= */

export async function initAuthUI({
  showBootToast = false
} = {}) {
  if (authUiBooted) {
    return null;
  }

  authUiBooted = true;

  try {
    const state = await initAuthState();

    paintAuthIdentity(state);
    bindOAuthButtons();
    bindSignOutButtons();
    bindAuthModeToggles();
    bindForgotPasswordButtons();
    bindAuthStatus();

    switchMode(document.body.dataset.authMode || "signin");

    document.body.classList.add("rb-auth-ui-ready");

    if (showBootToast) {
      toastInfo("Identity system online.");
    }

    console.log("RB AUTH UI INITIALIZED");

    return state;
  } catch (error) {
    authUiBooted = false;

    console.error("[RB AUTH UI INIT FAILED]", error);
    toastError(error?.message || "Failed to initialize auth system.");

    return null;
  }
}

export function resetAuthUIBoot() {
  authUiBooted = false;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initAuthUI());
} else {
  initAuthUI();
}

console.log("RB AUTH UI MODULE LOADED");
