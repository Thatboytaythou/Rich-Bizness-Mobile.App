/* =========================
   RICH BIZNESS MOBILE
   /core/app.js

   APP ORCHESTRATOR
   Safe boot lock
   Auth + profile-state synced
   Does not force profile binding on index
   XP Gauge Event Bridge
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

    syncAppXpDataset();

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
   XP HELPERS
========================= */

function getProfileXpModel(profile = {}) {
  const rawXp =
    profile?.xp ??
    profile?.rich_points ??
    profile?.points ??
    0;

  const rawLevel =
    profile?.rich_level ??
    profile?.level ??
    1;

  const rank =
    profile?.rank_title ||
    profile?.rank ||
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

function syncAppXpDataset() {
  const profile = getProfile();
  const model = getProfileXpModel(profile || {});

  if (document.body) {
    document.body.dataset.rbXp = String(model.xp);
    document.body.dataset.rbLevel = String(model.level);
    document.body.dataset.rbRank = model.rank;
    document.body.dataset.rbXpPercent = String(Math.round(model.percent));
  }

  window.dispatchEvent(
    new CustomEvent("rb:app-xp-update", {
      detail: {
        ...model,
        profile
      }
    })
  );

  return model;
}

export function getCurrentXpState() {
  return getProfileXpModel(getProfile() || {});
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
    supabase: getSupabase(),
    xp: getCurrentXpState()
  };
}

export function getCurrentUserState() {
  const user = getUser();

  return {
    session: getSession(),
    user,
    profile: getProfile(),
    auth: getAuthState(),
    authed: !!user?.id,
    xp: getCurrentXpState()
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

  syncAppXpDataset();

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

  window.addEventListener("rb:xp-gauge-update", (event) => {
    const detail = event.detail || {};

    if (!document.body) return;

    document.body.dataset.rbXp = String(detail.xp ?? document.body.dataset.rbXp ?? 0);
    document.body.dataset.rbLevel = String(detail.level ?? document.body.dataset.rbLevel ?? 1);
    document.body.dataset.rbRank = String(detail.rank ?? document.body.dataset.rbRank ?? "Member");
    document.body.dataset.rbXpPercent = String(Math.round(Number(detail.percent || 0)));
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

  syncAppXpDataset();

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
