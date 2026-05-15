/* =========================
   RICH BIZNESS PAYMENTS CORE
   /core/shared/rb-payments.js
========================= */

import { RB_CONFIG } from "./rb-config.js";

/* =========================
   STRIPE CONFIG
========================= */
export const STRIPE_CONFIG = {
  publishableKey:
    RB_CONFIG.stripe.publishableKey,

  currency:
    RB_CONFIG.stripe.currency || "usd",

  country:
    RB_CONFIG.stripe.country || "US"
};

/* =========================
   API REQUEST
========================= */
async function apiRequest(
  endpoint,
  payload = {}
) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type":
        "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error || "Request failed"
    );
  }

  return data;
}

/* =========================
   CREATE CHECKOUT
========================= */
export async function createCheckoutSession({
  productId = null,
  productName = "",
  amount = 0,
  creatorId = null,
  metadata = {}
}) {
  return apiRequest(
    "/api/create-checkout-session",
    {
      productId,
      productName,
      amount,
      creatorId,
      metadata
    }
  );
}

/* =========================
   CREATE CONNECT ACCOUNT
========================= */
export async function createConnectAccount({
  email = "",
  country = "US"
}) {
  return apiRequest(
    "/api/create-connect-account",
    {
      email,
      country
    }
  );
}

/* =========================
   CREATE ACCOUNT LINK
========================= */
export async function createAccountLink(
  accountId
) {
  return apiRequest(
    "/api/create-account-link",
    {
      accountId
    }
  );
}

/* =========================
   REQUEST PAYOUT
========================= */
export async function requestPayout({
  amount = 0
}) {
  return apiRequest(
    "/api/request-payout",
    {
      amount
    }
  );
}

/* =========================
   LIVE ACCESS PURCHASE
========================= */
export async function purchaseLiveAccess({
  streamId,
  amount,
  creatorId
}) {
  return apiRequest(
    "/api/live-stream-purchase",
    {
      streamId,
      amount,
      creatorId
    }
  );
}

/* =========================
   GAME CHALLENGE
========================= */
export async function createGameChallenge({
  gameSlug,
  challengerId,
  amount
}) {
  return apiRequest(
    "/api/create-game-challenge-checkout",
    {
      gameSlug,
      challengerId,
      amount
    }
  );
}

/* =========================
   FORMAT MONEY
========================= */
export function money(
  amount = 0,
  currency = "USD"
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency
    }
  ).format((amount || 0) / 100);
}

/* =========================
   PLATFORM FEES
========================= */
export function calculatePlatformFee(
  amount = 0,
  feeBps = 1000
) {
  return Math.round(
    amount * (feeBps / 10000)
  );
}

/* =========================
   CREATOR EARNINGS
========================= */
export function calculateCreatorEarnings(
  amount = 0,
  feeBps = 1000
) {
  const fee =
    calculatePlatformFee(
      amount,
      feeBps
    );

  return amount - fee;
}

/* =========================
   VALID PAYMENT
========================= */
export function isValidAmount(
  amount
) {
  return (
    typeof amount === "number" &&
    amount > 0
  );
}
