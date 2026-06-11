/* =========================================
   RICH BIZNESS MOBILE
   /core/pages/auth.js

   AUTH PAGE CONTROLLER
   Sign In + Create ID
   Phone-Safe Auth Flow
   Profile Lock + Avatar Preview + XP Sync
========================================= */

import {
  bootAuth,
  getUser,
  getProfile,
  refreshProfile,
  rbSignIn,
  rbSignUp
} from "/core/shared/rb-auth.js";

import {
  RB_ROUTES,
  RB_BRAND_ASSETS
} from "/core/shared/rb-config.js";

import {
  getProfileIdentity,
  bindProfileShell,
  buildProfileUrl,
  profileAvatar,
  profileName
} from "/core/shared/rb-profile.js";

const DEFAULT_AVATAR =
  RB_BRAND_ASSETS?.defaultProfileAvatar ||
  "/images/brand/Avatar-hero-Banner.png.jpeg";

const DEFAULT_NAME = "Rich Bizness";

const state = {
  isLoading: false,
  mode: "signin",
  user: null,
  profile: null,
  identity: null
};

const $ = (id) => document.getElementById(id);

const els = {
  panel: $("rb-auth-panel"),
  message: $("rb-auth-message"),

  signinForm: $("rb-signin-form"),
  signupForm: $("rb-signup-form"),

  tabs: document.querySelectorAll("[data-auth-mode]"),

  signinEmail: $("signin-email"),
  signupEmail: $("signup-email"),

  xpGauge: $("auth-xp-gauge"),
  xpFill: $("auth-xp-gauge-fill"),
  xpText: $("auth-xp-gauge-text"),
  xpNext: $("auth-xp-gauge-next"),
  xpLevel: $("auth-xp-level"),
  xpRank: $("auth-xp-rank")
};

/* =========================
   SMALL HELPERS
========================================= */

function safeImage(value = "", fallback = DEFAULT_AVATAR) {
  const src = String(value || "").trim();

  if (!src || src.includes("project-avatar")) {
    return fallback;
  }

  if (
    src.startsWith("/") ||
    src.startsWith("https://") ||
    src.startsWith("http://") ||
    src.startsWith("blob:")
  ) {
    return src;
  }

  return fallback;
}

function safeRoute(route = "/") {
  const value = String(route || "/").trim();

  if (!value) return "/";
  if (!value.startsWith("/")) return "/";

  return value;
}

function getNextRoute() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");

  return safeRoute(next || RB_ROUTES.home || "/");
}

function setText(el, value = "") {
  if (el) {
    el.textContent = value;
  }
}

function setMessage(text = "", type = "info") {
  if (!els.message) return;

  els.message.textContent = text;
  els.message.dataset.type = type || "info";

  if (!text) {
    els.message.removeAttribute("data-type");
  }
}

function cleanEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value = "") {
  return String(value || "").trim();
}

/* =========================
   XP GAUGE
========================================= */

function getProfileXpModel(profile = {}, identity = {}) {
  const rawXp =
    profile?.xp ??
    profile?.rich_points ??
    profile?.points ??
    identity?.xp ??
    identity?.rich_points ??
    0;

  const rawLevel =
    profile?.rich_level ??
    profile?.level ??
    identity?.rich_level ??
    identity?.level ??
    1;

  const rank =
    profile?.rank_title ||
    profile?.rank ||
    identity?.rankTitle ||
    identity?.rank_title ||
    identity?.rank ||
    "Member";

  const xp = Math.max(0, Number(rawXp) || 0);
  const level = Math.max(1, Number(rawLevel) || 1);

  const levelBase = Math.max(0, (level - 1) * 1000);
  const nextLevel = level * 1000;
  const span = Math.max(1, nextLevel - levelBase);
  const currentIntoLevel = Math.max(0, xp - levelBase);
  const percent = Math.max(0, Math.min(100, (currentIntoLevel / span) * 100));
  const remaining = Math.max(0, nextLevel - xp);

  return {
    xp,
    level,
    rank,
    nextLevel,
    remaining,
    percent
  };
}

function renderXpGauge() {
  state.user = getUser?.() || null;
  state.profile = getProfile?.() || null;
  state.identity = getProfileIdentity?.(state.profile) || null;

  const model = getProfileXpModel(state.profile, state.identity);

  document.documentElement.style.setProperty(
    "--rb-xp-percent",
    `${model.percent}%`
  );

  if (els.xpGauge) {
    els.xpGauge.dataset.level = String(model.level);
    els.xpGauge.dataset.rank = model.rank;
    els.xpGauge.dataset.xp = String(model.xp);
  }

  if (els.xpFill) {
    els.xpFill.style.width = `${model.percent}%`;
  }

  setText(els.xpText, `${model.xp.toLocaleString()} XP`);
  setText(
    els.xpNext,
    `${model.remaining.toLocaleString()} XP TO LVL ${model.level + 1}`
  );
  setText(els.xpLevel, `LVL ${model.level}`);
  setText(els.xpRank, model.rank);

  document.body.dataset.rbXp = String(model.xp);
  document.body.dataset.rbLevel = String(model.level);
  document.body.dataset.rbRank = model.rank;
  document.body.dataset.rbXpPercent = String(Math.round(model.percent));

  window.dispatchEvent(
    new CustomEvent("rb:xp-gauge-update", {
      detail: {
        route: "auth",
        xp: model.xp,
        level: model.level,
        rank: model.rank,
        nextLevel: model.nextLevel,
        remaining: model.remaining,
        percent: model.percent
      }
    })
  );
}

/* =========================
   PROFILE LOCK / AVATAR PAINT
========================================= */

function paintAvatar(selector, src, name) {
  document.querySelectorAll(selector).forEach((el) => {
    if (el.tagName === "IMG") {
      el.src = src;
      el.alt = name;
      el.dataset.lockedProfileSrc = src;
      return;
    }

    el.style.backgroundImage = `url("${src}")`;
  });
}

function syncAuthProfileLock() {
  state.user = getUser?.() || null;
  state.profile = getProfile?.() || null;
  state.identity = getProfileIdentity?.(state.profile) || null;

  const locked = Boolean(state.identity?.id || state.profile?.id || state.user?.id);

  document.body.dataset.rbPage = "auth";
  document.body.dataset.rbRoute = "auth";
  document.body.dataset.rbUserId = state.user?.id || "";
  document.body.dataset.rbProfileId =
    state.identity?.id ||
    state.profile?.id ||
    state.user?.id ||
    "";
  document.body.dataset.rbProfileLocked = locked ? "true" : "false";

  bindProfileShell?.();

  const profileUrl =
    buildProfileUrl?.(state.profile) ||
    RB_ROUTES.profile ||
    "/profile";

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = profileUrl;
  });

  const avatar = safeImage(
    profileAvatar?.(state.profile) ||
      state.identity?.avatar_url ||
      DEFAULT_AVATAR,
    DEFAULT_AVATAR
  );

  const name =
    profileName?.(state.profile) ||
    state.identity?.display_name ||
    DEFAULT_NAME;

  paintAvatar("[data-rb-avatar]", avatar, name);
  paintAvatar("[data-rb-profile-avatar]", avatar, name);
  paintAvatar("[data-rb-current-avatar]", avatar, name);

  document.querySelectorAll("[data-rb-name]").forEach((el) => {
    el.textContent = name;
  });

  renderXpGauge();
}

/* =========================
   UI
========================================= */

function toggleLoading(isLoading) {
  state.isLoading = Boolean(isLoading);
  document.body.classList.toggle("rb-auth-loading", state.isLoading);

  document.querySelectorAll(".rb-main-launch").forEach((btn) => {
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = btn.textContent.trim();
    }

    btn.disabled = state.isLoading;
    btn.textContent = state.isLoading
      ? "PROCESSING..."
      : btn.dataset.originalText;
  });
}

function setFormVisibility(mode) {
  const signinActive = mode === "signin";
  const signupActive = mode === "signup";

  if (els.signinForm) {
    els.signinForm.hidden = !signinActive;
    els.signinForm.style.display = signinActive ? "grid" : "none";
  }

  if (els.signupForm) {
    els.signupForm.hidden = !signupActive;
    els.signupForm.style.display = signupActive ? "grid" : "none";
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
    tab.tabIndex = active ? 0 : -1;
  });

  setFormVisibility(nextMode);
  setMessage("");
  renderXpGauge();
}

function readForm(form) {
  const data = new FormData(form);

  return {
    displayName: cleanText(data.get("display_name")),
    username: cleanText(data.get("username")),
    email: cleanEmail(data.get("email")),
    password: cleanText(data.get("password"))
  };
}

/* =========================
   ACTIONS
========================================= */

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
      redirectTo: null
    });

    await refreshProfile?.().catch(() => {});
    syncAuthProfileLock();

    setMessage("Welcome back. Opening portal...", "success");

    window.setTimeout(() => {
      window.location.href = getNextRoute();
    }, 350);
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

    await refreshProfile?.().catch(() => {});
    syncAuthProfileLock();

    if (data?.session || getUser?.()?.id) {
      setMessage("Identity created. Opening portal...", "success");

      window.setTimeout(() => {
        window.location.href = getNextRoute();
      }, 450);

      return;
    }

    setMessage(
      "Identity created. Check your email if confirmation is required, then tap in.",
      "success"
    );

    switchAuthMode("signin");

    if (els.signinEmail) {
      els.signinEmail.value = email;
    }
  } catch (error) {
    console.error("[RB SIGN UP FAILED]", error);
    setMessage(error?.message || "Create ID failed.", "error");
  } finally {
    toggleLoading(false);
    syncAuthProfileLock();
  }
}

/* =========================
   BIND + BOOT
========================================= */

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

  window.addEventListener("rb:profile-updated", syncAuthProfileLock);
  window.addEventListener("rb:app-identity-refreshed", syncAuthProfileLock);
  window.addEventListener("focus", syncAuthProfileLock);
}

async function bootAuthPage() {
  try {
    bindAuthPage();

    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const email = params.get("email");

    switchAuthMode(mode === "signup" ? "signup" : "signin");

    if (email) {
      if (els.signinEmail) {
        els.signinEmail.value = cleanEmail(email);
      }

      if (els.signupEmail) {
        els.signupEmail.value = cleanEmail(email);
      }
    }

    await bootAuth?.();

    if (getUser?.()?.id) {
      await refreshProfile?.().catch(() => {});
      syncAuthProfileLock();

      setMessage("You are already signed in.", "success");
    } else {
      syncAuthProfileLock();
    }

    document.body.classList.add("rb-auth-ready");

    console.log("RB AUTH PAGE READY", {
      signedIn: Boolean(getUser?.()?.id),
      profileLocked: Boolean(state.identity?.id),
      route: "auth",
      xpGauge: true
    });
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
