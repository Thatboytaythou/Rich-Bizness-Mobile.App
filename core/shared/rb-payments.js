/* =========================
   RICH BIZNESS PAYMENTS CORE
   /core/shared/rb-payments.js
========================= */

import RB_CONFIG from "/core/shared/rb-config.js";

const STRIPE_SETTINGS = RB_CONFIG.stripe || {};

export const STRIPE_CONFIG = {
  publishableKey: STRIPE_SETTINGS.publishableKey || "",
  currency: STRIPE_SETTINGS.currency || "usd",
  country: STRIPE_SETTINGS.country || "US"
};

async function apiRequest(endpoint, payload = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

export async function createCheckoutSession(payload = {}) {
  return apiRequest("/api/create-checkout-session", payload);
}

export async function createConnectAccount({ email = "", country = "US" } = {}) {
  return apiRequest("/api/create-connect-account", { email, country });
}

export async function createAccountLink(accountId) {
  return apiRequest("/api/create-account-link", { accountId });
}

export async function requestPayout({ amount = 0 } = {}) {
  return apiRequest("/api/request-payout", { amount });
}

export async function purchaseLiveAccess({ streamId, stream_id, amount, creatorId } = {}) {
  return apiRequest("/api/live-stream-purchase", {
    streamId,
    stream_id: stream_id || streamId,
    amount,
    creatorId
  });
}

export async function createGameChallenge({ gameSlug, challengerId, amount } = {}) {
  return apiRequest("/api/create-game-challenge-checkout", {
    gameSlug,
    challengerId,
    amount
  });
}

export function money(amount = 0, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format((amount || 0) / 100);
}

export function calculatePlatformFee(amount = 0, feeBps = 1000) {
  return Math.round(amount * (feeBps / 10000));
}

export function calculateCreatorEarnings(amount = 0, feeBps = 1000) {
  return amount - calculatePlatformFee(amount, feeBps);
}

export function isValidAmount(amount) {
  return typeof amount === "number" && amount > 0;
}

console.log("RB PAYMENTS CORE READY");
