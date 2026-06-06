/* =========================
   RICH BIZNESS MOBILE
   /core/app.js

   APP ORCHESTRATOR
   Safe boot lock
   Auth + profile-state synced
   Does not force profile binding on index
========================= */

import { RB_APP } from "/core/shared/rb-config.js";

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
  initProfileState,
  refreshProfileState
} from "/core/features/profile/profile-state.js";

import { ensureMyProfile } from "/core/shared/rb-auth.js";

import { autoGuardCurrentPage } from "/core/features/auth/session-guard.js";

import { unsubscribeAllChannels } from "/core/shared/rb-realtime.js";

import {
  toastInfo,
  toastWarn
} from "/core/shared/rb-toast.js";

let appReady = false;
let appBooting = false;
let appBootPromise = null;
let runtimeBound = false;

/* =========================
   INIT
========================= */

export async function initApp({
  guard = true,
  bindProfile = true,
  toast = false,
  ensureProfile = true,
  profileState = true,
  pageName = ""
} = {}) {
  if (appReady) return getAppState();

  if (appBooting && appBootPromise) {
    await appBootPromise;
    return getAppState();
  }

  appBooting = true;

  appBootPromise = bootApp({
    guard,
    bindProfile,
    toast,
    ensureProfile,
    profileState,
    pageName
  });

  await appBootPromise;

  return getAppState();
}

async function bootApp({
  guard,
  bindProfile,
  toast,
  ensureProfile,
  profileState,
  pageName
}) {
  try {
    document.body?.classList.add("rb-app-booting");
    document.body?.classList.remove("rb-app-error");

    await initAuthState();

    if (guard) {
      await autoGuardCurrentPage();
    }

    if (ensureProfile && getUser()?.id) {
      await ensureMyProfile();
    }

    if (profileState) {
      await initProfileState({
        mode: "auto",
        realtime: true
      });
    } else if (getUser()?.id) {
      await refreshProfileState();
    }

    if (bindProfile) {
      await bindProfileShellSafe();
    }

    bindRuntimeEvents();

    appReady = true;

    document.body?.classList.remove("rb-app-booting", "rb-app-error");
    document.body?.classList.add("rb-app-ready");

    if (pageName) {
      document.body.dataset.page = pageName;
      document.body.dataset.rbPage = pageName;
    }

    window.dispatchEvent(
      new CustomEvent("rb:app-ready", {
        detail: getAppState()
      })
    );

    if (toast) {
      toastInfo("App system online.", RB_APP.name);
    }

    return getAppState();
  } catch (error) {
    appReady = false;

    document.body?.classList.remove("rb-app-booting");
    document.body?.classList.add("rb-app-error");

    console.error("[RB APP BOOT ERROR]", error);

    window.dispatchEvent(
      new CustomEvent("rb:app-error", {
        detail: {
          error,
          state: getAppState()
        }
      })
    );

    throw error;
  } finally {
    appBooting = false;
    appBootPromise = null;
  }
}

/* =========================
   PROFILE BIND
========================= */

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

/* =========================
   STATE
========================= */

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
  const user = getUser();

  return {
    session: getSession(),
    user,
    profile: getProfile(),
    auth: getAuthState(),
    authed: !!user?.id
  };
}

export function isAppReady() {
  return appReady;
}

/* =========================
   REFRESH
========================= */

export async function refreshAppIdentity({
  bindProfile = true
} = {}) {
  await refreshAuthProfile();

  if (getUser()?.id) {
    await ensureMyProfile();
    await refreshProfileState();
  }

  if (bindProfile) {
    await bindProfileShellSafe();
  }

  window.dispatchEvent(
    new CustomEvent("rb:app-identity-refreshed", {
      detail: getAppState()
    })
  );

  return getAppState();
}

/* =========================
   RUNTIME EVENTS
========================= */

function bindRuntimeEvents() {
  if (runtimeBound || window.__RB_RUNTIME_BOUND__) return;

  runtimeBound = true;
  window.__RB_RUNTIME_BOUND__ = true;

  window.addEventListener("online", () => {
    document.body?.classList.remove("rb-offline");
    document.body?.classList.add("rb-online");

    window.dispatchEvent(
      new CustomEvent("rb:network-online", {
        detail: getAppState()
      })
    );
  });

  window.addEventListener("offline", () => {
    document.body?.classList.remove("rb-online");
    document.body?.classList.add("rb-offline");

    toastWarn("Connection dropped. Some features may pause.", "Offline");

    window.dispatchEvent(
      new CustomEvent("rb:network-offline", {
        detail: getAppState()
      })
    );
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

/* =========================
   PAGE STATUS
========================= */

export function markPageReady(pageName = "") {
  document.body?.classList.add("rb-page-ready");
  document.body?.classList.remove("rb-page-error");

  if (pageName && document.body) {
    document.body.dataset.page = pageName;
    document.body.dataset.rbPage = pageName;
  }

  window.dispatchEvent(
    new CustomEvent("rb:page-ready", {
      detail: {
        page: pageName,
        state: getAppState()
      }
    })
  );
}

export function markPageError(error) {
  console.error("[RB PAGE ERROR]", error);

  document.body?.classList.add("rb-page-error");
  document.body?.classList.remove("rb-page-ready");

  window.dispatchEvent(
    new CustomEvent("rb:page-error", {
      detail: {
        error,
        state: getAppState()
      }
    })
  );
}

console.log("RB APP ORCHESTRATOR READY");
