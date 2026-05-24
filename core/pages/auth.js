/* =========================================
   RICH BIZNESS LLC
   /core/pages/auth.js
   AUTH PAGE CONTROLLER - FULLY POLISHED
========================================= */

import {
  initAuthUI,
  handleSignIn,
  handleSignUp
} from "/core/features/auth/auth-ui.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

const state = {
  supabase: null,
  isLoading: false
};

const $ = (id) => document.getElementById(id);

const els = {
  panel: $("rb-auth-panel"),
  signinForm: $("rb-signin-form"),
  signupForm: $("rb-signup-form"),
  signinBtn: document.querySelector('[data-auth-mode="signin"]'),
  signupBtn: document.querySelector('[data-auth-mode="signup"]')
};

/* ====================== FORM HANDLERS ====================== */

async function onSignInSubmit(e) {
  e.preventDefault();
  if (state.isLoading) return;

  const form = e.target;
  const email = form.email.value.trim();
  const password = form.password.value.trim();

  if (!email || !password) {
    alert("Please enter email and password");
    return;
  }

  state.isLoading = true;
  toggleLoading(true);

  try {
    await handleSignIn(email, password);
    // Success - redirect handled in auth-ui.js
  } catch (error) {
    console.error("Sign in failed:", error);
    alert(error.message || "Sign in failed. Please check your credentials.");
  } finally {
    state.isLoading = false;
    toggleLoading(false);
  }
}

async function onSignUpSubmit(e) {
  e.preventDefault();
  if (state.isLoading) return;

  const form = e.target;
  const displayName = form.display_name?.value.trim() || "";
  const username = form.username?.value.trim() || "";
  const email = form.email.value.trim();
  const password = form.password.value.trim();

  if (!email || !password) {
    alert("Email and password are required");
    return;
  }

  state.isLoading = true;
  toggleLoading(true);

  try {
    await handleSignUp(email, password, { display_name: displayName, username });
    // Success - redirect handled in auth-ui.js
  } catch (error) {
    console.error("Sign up failed:", error);
    alert(error.message || "Sign up failed. Please try again.");
  } finally {
    state.isLoading = false;
    toggleLoading(false);
  }
}

/* ====================== UI HELPERS ====================== */

function toggleLoading(isLoading) {
  const buttons = document.querySelectorAll('.rb-main-launch');
  buttons.forEach(btn => {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "PROCESSING..." : btn.getAttribute('data-original-text') || btn.textContent;
  });
}

function switchAuthMode(mode) {
  document.body.dataset.authMode = mode;
  els.panel.classList.toggle('is-signin', mode === 'signin');
  els.panel.classList.toggle('is-signup', mode === 'signup');
}

/* ====================== BIND EVENTS ====================== */

function bindForms() {
  if (els.signinForm) els.signinForm.addEventListener('submit', onSignInSubmit);
  if (els.signupForm) els.signupForm.addEventListener('submit', onSignUpSubmit);

  // Tab switching
  els.signinBtn?.addEventListener('click', () => switchAuthMode('signin'));
  els.signupBtn?.addEventListener('click', () => switchAuthMode('signup'));
}

/* ====================== BOOT ====================== */

async function bootAuthPage() {
  try {
    state.supabase = getSupabase();

    await initAuthUI();

    bindForms();

    // Pre-fill email if available from URL
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    if (emailParam && els.signinForm) {
      const emailInput = els.signinForm.querySelector('input[name="email"]');
      if (emailInput) emailInput.value = emailParam;
    }

    document.body.classList.add("rb-auth-ready");
    console.log("🚀 RICH BIZNESS AUTH PAGE READY");

  } catch (error) {
    console.error("Auth page boot failed:", error);
  }
}

// Start
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootAuthPage);
} else {
  bootAuthPage();
}
