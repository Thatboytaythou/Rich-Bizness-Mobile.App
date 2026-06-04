/* =========================
   RICH BIZNESS MOBILE
   /core/features/monetization/monetization-state.js

   MONETIZATION STATE
   Creator balance + seller status + payout state
========================= */

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getUser,
  rbSelect
} from "/core/shared/rb-supabase.js";

import {
  getEconomySummary,
  ensureCreatorBalance,
  syncProfileBalance
} from "/core/shared/rb-economy.js";

const MONETIZATION_STATE = {
  ready: false,
  loading: false,
  summary: null,
  seller: null,
  error: null
};

const listeners = new Set();

export function getMonetizationState() {
  return { ...MONETIZATION_STATE };
}

export function onMonetizationState(callback) {
  if (typeof callback !== "function") return () => {};

  listeners.add(callback);

  try {
    callback(getMonetizationState());
  } catch (error) {
    console.warn("[RB MONEY LISTENER ERROR]", error);
  }

  return () => listeners.delete(callback);
}

function notifyMoneyListeners() {
  const state = getMonetizationState();

  listeners.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
      console.warn("[RB MONEY LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:monetization-state", {
      detail: state
    })
  );
}

export async function initMonetizationState(userId = null) {
  const user = getUser();
  const id = userId || user?.id;

  if (!id) {
    MONETIZATION_STATE.ready = true;
    MONETIZATION_STATE.loading = false;
    MONETIZATION_STATE.summary = null;
    MONETIZATION_STATE.seller = null;
    MONETIZATION_STATE.error = null;
    notifyMoneyListeners();
    return getMonetizationState();
  }

  MONETIZATION_STATE.loading = true;
  notifyMoneyListeners();

  try {
    await ensureCreatorBalance(id);
    await syncProfileBalance(id);

    MONETIZATION_STATE.summary = await getEconomySummary(id);

    MONETIZATION_STATE.seller = await rbSelect({
      table: RB_TABLES.storeSellerProfiles,
      match: { user_id: id },
      maybeSingle: true
    });

    MONETIZATION_STATE.ready = true;
    MONETIZATION_STATE.error = null;
  } catch (error) {
    MONETIZATION_STATE.error = error;
    console.warn("[RB MONETIZATION STATE FAILED]", error?.message || error);
  } finally {
    MONETIZATION_STATE.loading = false;
    notifyMoneyListeners();
  }

  return getMonetizationState();
}

export async function refreshMonetizationState(userId = null) {
  return await initMonetizationState(userId);
}

export function getAvailableCents() {
  return Number(MONETIZATION_STATE.summary?.available_cents || 0);
}

export function getPendingCents() {
  return Number(MONETIZATION_STATE.summary?.pending_cents || 0);
}

export function getEarnedCents() {
  return Number(MONETIZATION_STATE.summary?.earned_cents || 0);
}

export function getPaidOutCents() {
  return Number(MONETIZATION_STATE.summary?.paid_out_cents || 0);
}

export function formatMoney(cents = 0, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || "usd").toUpperCase()
  }).format(Number(cents || 0) / 100);
}

export function bindMonetizationShell({
  availableSelector = "[data-rb-money-available]",
  pendingSelector = "[data-rb-money-pending]",
  earnedSelector = "[data-rb-money-earned]",
  paidOutSelector = "[data-rb-money-paid-out]",
  sellerStatusSelector = "[data-rb-seller-status]"
} = {}) {
  return onMonetizationState((state) => {
    const summary = state.summary;
    const seller = state.seller;
    const currency = summary?.currency || "usd";

    document.querySelectorAll(availableSelector).forEach((el) => {
      el.textContent = formatMoney(summary?.available_cents || 0, currency);
    });

    document.querySelectorAll(pendingSelector).forEach((el) => {
      el.textContent = formatMoney(summary?.pending_cents || 0, currency);
    });

    document.querySelectorAll(earnedSelector).forEach((el) => {
      el.textContent = formatMoney(summary?.earned_cents || 0, currency);
    });

    document.querySelectorAll(paidOutSelector).forEach((el) => {
      el.textContent = formatMoney(summary?.paid_out_cents || 0, currency);
    });

    document.querySelectorAll(sellerStatusSelector).forEach((el) => {
      el.textContent = seller?.status || "pending";
    });
  });
}

window.addEventListener("rb:rich-action", async () => {
  await refreshMonetizationState();
});

console.log("RB MONETIZATION STATE READY");
