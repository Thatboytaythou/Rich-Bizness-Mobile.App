/* =========================
   RICH BIZNESS MOBILE
   /core/features/xp/xp-state.js

   XP STATE
   Keeps level, XP, rank, points synced for UI
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

export function getXpState() {
  return { ...XP_STATE };
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

function notifyXpListeners() {
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
  const id = userId || user?.id;

  if (!id) {
    XP_STATE.ready = true;
    XP_STATE.loading = false;
    XP_STATE.summary = null;
    XP_STATE.error = null;
    notifyXpListeners();
    return getXpState();
  }

  XP_STATE.loading = true;
  notifyXpListeners();

  try {
    await ensureUserLevel(id);
    await syncProfileXp(id);

    XP_STATE.summary = await getXpSummary(id);
    XP_STATE.ready = true;
    XP_STATE.error = null;
  } catch (error) {
    XP_STATE.error = error;
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

export function getXpSummaryState() {
  return XP_STATE.summary;
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

export function bindXpShell({
  levelSelector = "[data-rb-xp-level]",
  pointsSelector = "[data-rb-xp-points]",
  rankSelector = "[data-rb-xp-rank]",
  xpSelector = "[data-rb-xp-total]"
} = {}) {
  return onXpState((state) => {
    const summary = state.summary;

    document.querySelectorAll(levelSelector).forEach((el) => {
      el.textContent = summary ? `LVL ${summary.level}` : "LVL 1";
    });

    document.querySelectorAll(pointsSelector).forEach((el) => {
      el.textContent = summary ? `${summary.rich_points} pts` : "0 pts";
    });

    document.querySelectorAll(rankSelector).forEach((el) => {
      el.textContent = summary?.rank_title || "Smoke Rookie";
    });

    document.querySelectorAll(xpSelector).forEach((el) => {
      el.textContent = summary ? `${summary.xp_total} XP` : "0 XP";
    });
  });
}

window.addEventListener("rb:rich-action", async () => {
  await refreshXpState();
});

console.log("RB XP STATE READY");
