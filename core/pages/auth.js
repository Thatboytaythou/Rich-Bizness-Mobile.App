/* =========================================
   RICH BIZNESS LLC
   /core/pages/auth.js
   AUTH PAGE CONTROLLER
========================================= */

import {
  bootAuth,
  getUser,
  rbSignIn,
  rbSignUp
} from "/core/shared/rb-auth.js";

const state = {
  isLoading: false
};

const $ = (id) => document.getElementById(id);

const els = {
  panel: $("rb-auth-panel"),
  message: $("rb-auth-message"),
  signinForm: $("rb-signin-form"),
  signupForm: $("rb-signup-form"),
  signinBtn: document.querySelector('[data-auth-mode="signin"]'),
  signupBtn: document.querySelector('[data-auth-mode="signup"]')
};

function setMessage(text = "", type = "info") {
  if (!els.message) return;
  els.message.textContent = text;
  els.message.dataset.type = type;
}

function toggleLoading(isLoading) {
  state.isLoading = isLoading;

  document.querySelectorAll(".rb-main-launch").forEach((btn) => {
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = btn.textContent.trim();
    }

    btn.disabled = isLoading;
    btn.textContent = isLoading ? "PROCESSING..." : btn.dataset.originalText;
  });
}

function switchAuthMode(mode) {
  document.body.dataset.authMode = mode;

  els.panel?.classList.toggle("is-signin", mode === "signin");
  els.panel?.classList.toggle("is-signup", mode === "signup");

  els.signinBtn?.classList.toggle("is-active", mode === "signin");
  els.signupBtn?.classList.toggle("is-active", mode === "signup");

  setMessage("");
}

async function onSignInSubmit(event) {
  event.preventDefault();
  if (state.isLoading) return;

  const form = event.currentTarget;
  const email = form.email.value.trim();
  const password = form.password.value.trim();

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
      redirectTo: "/"
    });
  } catch (error) {
    console.error("[RB SIGN IN FAILED]", error);
    setMessage(error.message || "Sign in failed.", "error");
  } finally {
    toggleLoading(false);
  }
}

async function onSignUpSubmit(event) {
  event.preventDefault();
  if (state.isLoading) return;

  const form = event.currentTarget;

  const displayName = form.display_name?.value.trim() || "";
  const username = form.username?.value.trim() || "";
  const email = form.email.value.trim();
  const password = form.password.value.trim();

  if (!email || !password) {
    setMessage("Email and password are required.", "error");
    return;
  }

  toggleLoading(true);
  setMessage("Creating your Rich Bizness identity...", "info");

  try {
    await rbSignUp({
      email,
      password,
      username,
      displayName
    });

    setMessage("Identity created. Tap in with your new login.", "success");
    switchAuthMode("signin");

    const signinEmail = els.signinForm?.querySelector('input[name="email"]');
    if (signinEmail) signinEmail.value = email;
  } catch (error) {
    console.error("[RB SIGN UP FAILED]", error);
    setMessage(error.message || "Sign up failed.", "error");
  } finally {
    toggleLoading(false);
  }
}

function bindAuthPage() {
  els.signinForm?.addEventListener("submit", onSignInSubmit);
  els.signupForm?.addEventListener("submit", onSignUpSubmit);

  els.signinBtn?.addEventListener("click", () => switchAuthMode("signin"));
  els.signupBtn?.addEventListener("click", () => switchAuthMode("signup"));
}

async function bootAuthPage() {
  await bootAuth();

  if (getUser()?.id) {
    window.location.href = "/";
    return;
  }

  bindAuthPage();

  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode");
  const email = urlParams.get("email");

  switchAuthMode(mode === "signup" ? "signup" : "signin");

  if (email && els.signinForm) {
    const emailInput = els.signinForm.querySelector('input[name="email"]');
    if (emailInput) emailInput.value = email;
  }

  document.body.classList.add("rb-auth-ready");
  console.log("RB AUTH PAGE READY");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootAuthPage);
} else {
  bootAuthPage();
}
