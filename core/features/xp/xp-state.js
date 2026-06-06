/* =========================
   RICH BIZNESS MOBILE
   /core/features/xp/xp-state.js

   XP STATE
   Keeps level, XP, rank, points synced for UI
   State + UI shell only
========================= */

import {
  getXpSummary,
  ensureUserLevel,
  syncProfileXp
} from "/core/shared/rb-xp.js";

import {
  getUser
} from "/core/shared/rb-supabase.js";

const XP_STATE = {
  ready: false,
  loading: false,
  summary: null,
  error: null
};

const listeners = new Set();

function normalizeError(error = null) {
  if (!error) return null;

  return {
    message: error?.message || String(error),
    code: error?.code || null,
    details: error?.details || null
  };
}

export function getXpState() {
  return {
    ready: XP_STATE.ready,
    loading: XP_STATE.loading,
    summary: XP_STATE.summary ? { ...XP_STATE.summary } : null,
    error: XP_STATE.error ? { ...XP_STATE.error } : null
  };
}

export function onXpState(callback) {
  if (typeof callback !== "function") return () => {};

  listeners.add(callback);

  try {
    callback(getXpState());
  } catch (error) {
    console.warn("[RB XP LISTENER ERROR]", error);
  }

  return () => listeners.delete(callback);
}

export function notifyXpListeners() {
  const state = getXpState();

  listeners.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
      console.warn("[RB XP LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:xp-state", {
      detail: state
    })
  );
}

export async function initXpState(userId = null) {
  const user = getUser();
  const id = userId || user?.id || null;

  XP_STATE.loading = true;
  XP_STATE.error = null;
  notifyXpListeners();

  if (!id) {
    XP_STATE.ready = true;
    XP_STATE.loading = false;
    XP_STATE.summary = null;
    XP_STATE.error = null;
    notifyXpListeners();
    return getXpState();
  }

  try {
    await ensureUserLevel(id);
    await syncProfileXp(id);

    XP_STATE.summary = await getXpSummary(id);
    XP_STATE.ready = true;
    XP_STATE.error = null;
  } catch (error) {
    XP_STATE.error = normalizeError(error);
    console.warn("[RB XP STATE INIT FAILED]", error?.message || error);
  } finally {
    XP_STATE.loading = false;
    notifyXpListeners();
  }

  return getXpState();
}

export async function refreshXpState(userId = null) {
  return await initXpState(userId);
}

export function resetXpState() {
  XP_STATE.ready = false;
  XP_STATE.loading = false;
  XP_STATE.summary = null;
  XP_STATE.error = null;
  notifyXpListeners();
}

export function getXpSummaryState() {
  return XP_STATE.summary ? { ...XP_STATE.summary } : null;
}

export function getRichLevel() {
  return Number(XP_STATE.summary?.level || 1);
}

export function getRichPoints() {
  return Number(XP_STATE.summary?.rich_points || 0);
}

export function getRankTitle() {
  return XP_STATE.summary?.rank_title || "Smoke Rookie";
}

export function getXpTotal() {
  return Number(XP_STATE.summary?.xp_total || 0);
}

export function getXpCurrent() {
  return Number(XP_STATE.summary?.xp_current || 0);
}

export function getXpNext() {
  return Number(XP_STATE.summary?.xp_next || 100);
}

export function getXpProgressPercent() {
  const current = getXpCurrent();
  const next = getXpNext();

  if (!next) return 0;

  return Math.max(
    0,
    Math.min(100, Math.round((current / next) * 100))
  );
}

export function bindXpShell({
  levelSelector = "[data-rb-xp-level]",
  pointsSelector = "[data-rb-xp-points]",
  rankSelector = "[data-rb-xp-rank]",
  xpSelector = "[data-rb-xp-total]",
  currentSelector = "[data-rb-xp-current]",
  nextSelector = "[data-rb-xp-next]",
  progressSelector = "[data-rb-xp-progress]"
} = {}) {
  return onXpState((state) => {
    const summary = state.summary;

    const level = Number(summary?.level || 1);
    const points = Number(summary?.rich_points || 0);
    const rank = summary?.rank_title || "Smoke Rookie";
    const xpTotal = Number(summary?.xp_total || 0);
    const xpCurrent = Number(summary?.xp_current || 0);
    const xpNext = Number(summary?.xp_next || 100);

    const progress = xpNext
      ? Math.max(0, Math.min(100, Math.round((xpCurrent / xpNext) * 100)))
      : 0;

    document.querySelectorAll(levelSelector).forEach((el) => {
      el.textContent = `LVL ${level}`;
    });

    document.querySelectorAll(pointsSelector).forEach((el) => {
      el.textContent = `${points} pts`;
    });

    document.querySelectorAll(rankSelector).forEach((el) => {
      el.textContent = rank;
    });

    document.querySelectorAll(xpSelector).forEach((el) => {
      el.textContent = `${xpTotal} XP`;
    });

    document.querySelectorAll(currentSelector).forEach((el) => {
      el.textContent = `${xpCurrent}`;
    });

    document.querySelectorAll(nextSelector).forEach((el) => {
      el.textContent = `${xpNext}`;
    });

    document.querySelectorAll(progressSelector).forEach((el) => {
      if (el.tagName === "PROGRESS") {
        el.value = progress;
        el.max = 100;
      } else {
        el.style.width = `${progress}%`;
        el.setAttribute("aria-valuenow", String(progress));
      }
    });
  });
}

if (!window.__RB_XP_ACTION_BOUND__) {
  window.__RB_XP_ACTION_BOUND__ = true;

  window.addEventListener("rb:rich-action", async () => {
    await refreshXpState();
  });

  window.addEventListener("rb:profile-updated", async () => {
    await refreshXpState();
  });
}

console.log("RB XP STATE READY");
