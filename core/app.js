/* =========================
   RICH BIZNESS MOBILE
   /core/app.js

   APP ORCHESTRATOR
   Safe boot lock
   Auth + profile-state synced
   Does not force profile binding on index
========================= */

import {
  RB_APP
} from "/core/shared/rb-config.js";

import {
  getSession,
  getUser,
  getProfile,
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  initAuthState,
  getAuthState,
  refreshAuthProfile
} from "/core/features/auth/auth-state.js";

import {
  refreshProfileState
} from "/core/features/profile/profile-state.js";

import {
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  autoGuardCurrentPage
} from "/core/features/auth/session-guard.js";

import {
  unsubscribeAllChannels
} from "/core/shared/rb-realtime.js";

import {
  toastInfo,
  toastWarn
} from "/core/shared/rb-toast.js";

let appReady = false;
let appBooting = false;
let appBootPromise = null;

export async function initApp({
  guard = true,
  bindProfile = true,
  toast = false,
  ensureProfile = true
} = {}) {
  if (appReady) {
    return getAppState();
  }

  if (appBooting && appBootPromise) {
    await appBootPromise;
    return getAppState();
  }

  appBooting = true;

  appBootPromise = bootApp({
    guard,
    bindProfile,
    toast,
    ensureProfile
  });

  await appBootPromise;

  return getAppState();
}

async function bootApp({
  guard,
  bindProfile,
  toast,
  ensureProfile
}) {
  try {
    document.body.classList.add("rb-app-booting");

    await initAuthState();

    if (guard) {
      await autoGuardCurrentPage();
    }

    if (ensureProfile && getUser()?.id) {
      await ensureMyProfile();
      await refreshProfileState();
    }

    if (bindProfile) {
      await bindProfileShellSafe();
    }

    bindRuntimeEvents();

    appReady = true;

    document.body.classList.remove("rb-app-booting", "rb-app-error");
    document.body.classList.add("rb-app-ready");

    if (toast) {
      toastInfo("App system online.", RB_APP.name);
    }
  } catch (error) {
    appReady = false;

    document.body.classList.remove("rb-app-booting");
    document.body.classList.add("rb-app-error");

    console.error("[RB APP BOOT ERROR]", error);

    throw error;
  } finally {
    appBooting = false;
  }
}

async function bindProfileShellSafe() {
  try {
    const profileModule = await import("/core/shared/rb-profile.js");

    if (typeof profileModule.bindProfileShell === "function") {
      profileModule.bindProfileShell();
    }
  } catch (error) {
    console.warn("[RB PROFILE BIND SKIPPED]", error);
  }
}

export function getAppState() {
  return {
    ready: appReady,
    booting: appBooting,
    app: RB_APP,
    session: getSession(),
    user: getUser(),
    profile: getProfile(),
    auth: getAuthState(),
    supabase: getSupabase()
  };
}

export function getCurrentUserState() {
  return {
    session: getSession(),
    user: getUser(),
    profile: getProfile(),
    auth: getAuthState(),
    authed: !!getUser()?.id
  };
}

export function isAppReady() {
  return appReady;
}

export async function refreshAppIdentity() {
  await refreshAuthProfile();

  if (getUser()?.id) {
    await refreshProfileState();
  }

  await bindProfileShellSafe();

  window.dispatchEvent(
    new CustomEvent("rb:app-identity-refreshed", {
      detail: getAppState()
    })
  );

  return getAppState();
}

function bindRuntimeEvents() {
  if (window.__RB_RUNTIME_BOUND__) return;

  window.__RB_RUNTIME_BOUND__ = true;

  window.addEventListener("online", () => {
    document.body.classList.remove("rb-offline");
    document.body.classList.add("rb-online");
  });

  window.addEventListener("offline", () => {
    document.body.classList.remove("rb-online");
    document.body.classList.add("rb-offline");
    toastWarn("Connection dropped. Some features may pause.", "Offline");
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    if (!getUser()?.id) return;

    try {
      await refreshAppIdentity();
    } catch (error) {
      console.warn("[RB VISIBILITY REFRESH SKIPPED]", error);
    }
  });

  window.addEventListener("beforeunload", () => {
    unsubscribeAllChannels();
  });
}

export function markPageReady(pageName = "") {
  document.body.classList.add("rb-page-ready");
  document.body.classList.remove("rb-page-error");

  if (pageName) {
    document.body.dataset.page = pageName;
  }
}

export function markPageError(error) {
  console.error("[RB PAGE ERROR]", error);

  document.body.classList.add("rb-page-error");
  document.body.classList.remove("rb-page-ready");
}

console.log("RB APP ORCHESTRATOR READY");
