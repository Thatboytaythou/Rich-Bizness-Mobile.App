/* =========================================
   RICH BIZNESS LLC
   /core/pages/auth.js
   AUTH PAGE CONTROLLER
   Sign In + Create ID
========================================= */

import {
  bootAuth,
  getUser,
  rbSignIn,
  rbSignUp
} from "/core/shared/rb-auth.js";

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

const state = {
  isLoading: false,
  mode: "signin"
};

const $ = (id) => document.getElementById(id);

const els = {
  panel: $("rb-auth-panel"),
  message: $("rb-auth-message"),
  signinForm: $("rb-signin-form"),
  signupForm: $("rb-signup-form"),
  tabs: document.querySelectorAll("[data-auth-mode]")
};

function getNextRoute() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");

  if (next && next.startsWith("/")) return next;

  return RB_ROUTES.home || "/";
}

function setMessage(text = "", type = "info") {
  if (!els.message) return;

  els.message.textContent = text;
  els.message.dataset.type = type;
}

function toggleLoading(isLoading) {
  state.isLoading = isLoading;
  document.body.classList.toggle("rb-auth-loading", isLoading);

  document.querySelectorAll(".rb-main-launch").forEach((btn) => {
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = btn.textContent.trim();
    }

    btn.disabled = isLoading;
    btn.textContent = isLoading ? "PROCESSING..." : btn.dataset.originalText;
  });
}

function setFormVisibility(mode) {
  if (els.signinForm) {
    els.signinForm.style.display = mode === "signin" ? "grid" : "none";
    els.signinForm.hidden = mode !== "signin";
  }

  if (els.signupForm) {
    els.signupForm.style.display = mode === "signup" ? "grid" : "none";
    els.signupForm.hidden = mode !== "signup";
  }
}

function switchAuthMode(mode = "signin") {
  const nextMode = mode === "signup" ? "signup" : "signin";

  state.mode = nextMode;
  document.body.dataset.authMode = nextMode;

  els.panel?.classList.toggle("is-signin", nextMode === "signin");
  els.panel?.classList.toggle("is-signup", nextMode === "signup");

  els.tabs.forEach((tab) => {
    const active = tab.dataset.authMode === nextMode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  setFormVisibility(nextMode);
  setMessage("");
}

function readForm(form) {
  const data = new FormData(form);

  return {
    displayName: String(data.get("display_name") || "").trim(),
    username: String(data.get("username") || "").trim(),
    email: String(data.get("email") || "").trim().toLowerCase(),
    password: String(data.get("password") || "").trim()
  };
}

async function onSignInSubmit(event) {
  event.preventDefault();
  if (state.isLoading) return;

  const { email, password } = readForm(event.currentTarget);

  if (!email || !password) {
    setMessage("Please enter email and password.", "error");
    return;
  }

  toggleLoading(true);
  setMessage("Signing you in...", "info");

  try {
    await rbSignIn({
      email,
      password,
      redirectTo: getNextRoute()
    });
  } catch (error) {
    console.error("[RB SIGN IN FAILED]", error);
    setMessage(error?.message || "Sign in failed.", "error");
  } finally {
    toggleLoading(false);
  }
}

async function onSignUpSubmit(event) {
  event.preventDefault();
  if (state.isLoading) return;

  const {
    displayName,
    username,
    email,
    password
  } = readForm(event.currentTarget);

  if (!email || !password) {
    setMessage("Email and password are required.", "error");
    return;
  }

  if (password.length < 6) {
    setMessage("Password must be at least 6 characters.", "error");
    return;
  }

  toggleLoading(true);
  setMessage("Creating your Rich Bizness identity...", "info");

  try {
    const data = await rbSignUp({
      email,
      password,
      username,
      displayName
    });

    if (data?.session || getUser()?.id) {
      window.location.href = getNextRoute();
      return;
    }

    setMessage(
      "Identity created. Check your email if confirmation is required, then tap in.",
      "success"
    );

    switchAuthMode("signin");

    const signinEmail = els.signinForm?.querySelector('input[name="email"]');
    if (signinEmail) signinEmail.value = email;
  } catch (error) {
    console.error("[RB SIGN UP FAILED]", error);
    setMessage(error?.message || "Create ID failed.", "error");
  } finally {
    toggleLoading(false);
  }
}

function bindAuthPage() {
  if (document.body.dataset.rbAuthBound === "true") return;
  document.body.dataset.rbAuthBound = "true";

  els.signinForm?.addEventListener("submit", onSignInSubmit);
  els.signupForm?.addEventListener("submit", onSignUpSubmit);

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchAuthMode(tab.dataset.authMode);
    });
  });
}

async function bootAuthPage() {
  try {
    bindAuthPage();

    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const email = params.get("email");

    switchAuthMode(mode === "signup" ? "signup" : "signin");

    if (email) {
      const signinEmail = els.signinForm?.querySelector('input[name="email"]');
      const signupEmail = els.signupForm?.querySelector('input[name="email"]');

      if (signinEmail) signinEmail.value = email;
      if (signupEmail) signupEmail.value = email;
    }

    await bootAuth();

    if (getUser()?.id) {
      window.location.href = getNextRoute();
      return;
    }

    document.body.classList.add("rb-auth-ready");
    console.log("RB AUTH PAGE READY");
  } catch (error) {
    console.error("[RB AUTH PAGE BOOT FAILED]", error);
    setMessage(error?.message || "Auth failed to boot.", "error");
    document.body.classList.add("rb-auth-error");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootAuthPage);
} else {
  bootAuthPage();
}
