/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-economy.js

   MONEY + CREATOR BALANCE ENGINE
   Shared economy system for tips, sales, live, music, store, games
========================= */

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getUser,
  rbInsert,
  rbUpdate,
  rbSelect
} from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity
} from "/core/shared/rb-profile.js";

function safeCents(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.floor(number)
    : fallback;
}

function safeText(value, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function platformFee(amountCents = 0, bps = 1000) {
  return Math.max(0, Math.round((safeCents(amountCents) * Number(bps || 0)) / 10000));
}

export async function getCreatorBalance(userId = null) {
  const user = getUser();
  const id = userId || user?.id;

  if (!id) return null;

  return await rbSelect({
    table: RB_TABLES.creatorAvailableBalances,
    match: { artist_user_id: id },
    maybeSingle: true
  });
}

export async function ensureCreatorBalance(userId = null) {
  const user = getUser();
  const id = userId || user?.id;

  if (!id) {
    throw new Error("User required for creator balance.");
  }

  const existing = await getCreatorBalance(id);
  if (existing?.id) return existing;

  const rows = await rbInsert({
    table: RB_TABLES.creatorAvailableBalances,
    values: {
      artist_user_id: id,
      earned_cents: 0,
      pending_cents: 0,
      paid_out_cents: 0,
      available_cents: 0,
      currency: "usd",
      metadata: {
        source: "rb-economy.js"
      }
    }
  });

  return rows?.[0] || null;
}

export async function creditCreator({
  creatorId,
  amountCents,
  currency = "usd",
  source = "unknown",
  sourceTable = null,
  sourceId = null,
  platformFeeCents = 0,
  metadata = {}
} = {}) {
  const id = creatorId;
  const amount = safeCents(amountCents);
  const fee = safeCents(platformFeeCents);
  const creatorAmount = Math.max(0, amount - fee);

  if (!id) throw new Error("Missing creatorId.");
  if (amount <= 0) throw new Error("Amount must be greater than 0.");

  const balance = await ensureCreatorBalance(id);

  const updated = await rbUpdate({
    table: RB_TABLES.creatorAvailableBalances,
    match: { artist_user_id: id },
    values: {
      earned_cents: safeCents(balance.earned_cents) + creatorAmount,
      available_cents: safeCents(balance.available_cents) + creatorAmount,
      currency: safeText(currency, "usd").toLowerCase(),
      updated_at: new Date().toISOString()
    }
  });

  await logEconomyEvent({
    userId: id,
    eventName: "creator_credit",
    section: source,
    targetTable: sourceTable,
    targetId: sourceId,
    amountCents: amount,
    currency,
    metadata: {
      source: "rb-economy.js",
      gross_amount_cents: amount,
      platform_fee_cents: fee,
      creator_amount_cents: creatorAmount,
      ...metadata
    }
  });

  return {
    ok: true,
    creator_id: id,
    amount_cents: amount,
    platform_fee_cents: fee,
    creator_amount_cents: creatorAmount,
    balance: updated?.[0] || null
  };
}

export async function debitCreatorPending({
  creatorId,
  amountCents,
  currency = "usd",
  source = "payout",
  metadata = {}
} = {}) {
  const id = creatorId;
  const amount = safeCents(amountCents);

  if (!id) throw new Error("Missing creatorId.");
  if (amount <= 0) throw new Error("Amount must be greater than 0.");

  const balance = await ensureCreatorBalance(id);

  if (safeCents(balance.available_cents) < amount) {
    throw new Error("Not enough available balance.");
  }

  const updated = await rbUpdate({
    table: RB_TABLES.creatorAvailableBalances,
    match: { artist_user_id: id },
    values: {
      available_cents: Math.max(0, safeCents(balance.available_cents) - amount),
      pending_cents: safeCents(balance.pending_cents) + amount,
      currency: safeText(currency, "usd").toLowerCase(),
      updated_at: new Date().toISOString()
    }
  });

  await logEconomyEvent({
    userId: id,
    eventName: "creator_payout_pending",
    section: source,
    amountCents: amount,
    currency,
    metadata: {
      source: "rb-economy.js",
      ...metadata
    }
  });

  return {
    ok: true,
    creator_id: id,
    amount_cents: amount,
    balance: updated?.[0] || null
  };
}

export async function completeCreatorPayout({
  creatorId,
  amountCents,
  currency = "usd",
  source = "payout",
  metadata = {}
} = {}) {
  const id = creatorId;
  const amount = safeCents(amountCents);

  if (!id) throw new Error("Missing creatorId.");
  if (amount <= 0) throw new Error("Amount must be greater than 0.");

  const balance = await ensureCreatorBalance(id);

  const updated = await rbUpdate({
    table: RB_TABLES.creatorAvailableBalances,
    match: { artist_user_id: id },
    values: {
      pending_cents: Math.max(0, safeCents(balance.pending_cents) - amount),
      paid_out_cents: safeCents(balance.paid_out_cents) + amount,
      currency: safeText(currency, "usd").toLowerCase(),
      updated_at: new Date().toISOString()
    }
  });

  await logEconomyEvent({
    userId: id,
    eventName: "creator_payout_completed",
    section: source,
    amountCents: amount,
    currency,
    metadata: {
      source: "rb-economy.js",
      ...metadata
    }
  });

  return {
    ok: true,
    creator_id: id,
    amount_cents: amount,
    balance: updated?.[0] || null
  };
}

export async function recordTipCredit({
  streamId = null,
  fromUserId = null,
  toUserId,
  amountCents,
  currency = "usd",
  message = "",
  stripeCheckoutSessionId = null,
  stripePaymentIntentId = null,
  status = "paid",
  metadata = {}
} = {}) {
  const amount = safeCents(amountCents);
  const fee = platformFee(amount);
  const creatorAmount = Math.max(0, amount - fee);
  const identity = getProfileIdentity();

  if (!toUserId) throw new Error("Missing tip receiver.");
  if (amount <= 0) throw new Error("Tip amount must be greater than 0.");

  const rows = await rbInsert({
    table: RB_TABLES.liveTips,
    values: {
      stream_id: streamId,
      from_user_id: fromUserId || getUser()?.id || null,
      to_user_id: toUserId,
      username: identity.username || null,
      display_name: identity.display_name || null,
      stripe_checkout_session_id: stripeCheckoutSessionId,
      stripe_payment_intent_id: stripePaymentIntentId,
      amount_cents: amount,
      platform_fee_cents: fee,
      creator_amount_cents: creatorAmount,
      currency: safeText(currency, "usd").toLowerCase(),
      status,
      message,
      paid_at: status === "paid" ? new Date().toISOString() : null,
      metadata: {
        source: "rb-economy.js",
        ...metadata
      }
    }
  });

  if (status === "paid") {
    await creditCreator({
      creatorId: toUserId,
      amountCents: amount,
      currency,
      source: "tip",
      sourceTable: RB_TABLES.liveTips,
      sourceId: rows?.[0]?.id || null,
      platformFeeCents: fee,
      metadata
    });
  }

  return rows?.[0] || null;
}

export async function recordProductSaleCredit({
  sellerId,
  orderId = null,
  productId = null,
  amountCents,
  platformFeeCents = null,
  currency = "usd",
  metadata = {}
} = {}) {
  const amount = safeCents(amountCents);
  const fee = platformFeeCents === null
    ? platformFee(amount)
    : safeCents(platformFeeCents);

  return await creditCreator({
    creatorId: sellerId,
    amountCents: amount,
    currency,
    source: "store",
    sourceTable: RB_TABLES.storeOrders,
    sourceId: orderId,
    platformFeeCents: fee,
    metadata: {
      product_id: productId,
      order_id: orderId,
      ...metadata
    }
  });
}

export async function recordLivePurchaseCredit({
  creatorId,
  streamId,
  purchaseId = null,
  amountCents,
  platformFeeCents = null,
  currency = "usd",
  metadata = {}
} = {}) {
  const amount = safeCents(amountCents);
  const fee = platformFeeCents === null
    ? platformFee(amount)
    : safeCents(platformFeeCents);

  return await creditCreator({
    creatorId,
    amountCents: amount,
    currency,
    source: "live",
    sourceTable: RB_TABLES.liveStreamPurchases,
    sourceId: purchaseId,
    platformFeeCents: fee,
    metadata: {
      stream_id: streamId,
      purchase_id: purchaseId,
      ...metadata
    }
  });
}

export async function syncProfileBalance(userId = null) {
  const user = getUser();
  const id = userId || user?.id;

  if (!id) return null;

  const balance = await ensureCreatorBalance(id);

  const rows = await rbUpdate({
    table: RB_TABLES.profiles,
    match: { id },
    values: {
      balance_cents: safeCents(balance.available_cents),
      updated_at: new Date().toISOString()
    }
  });

  return rows?.[0] || null;
}

export async function getEconomySummary(userId = null) {
  const user = getUser();
  const id = userId || user?.id;

  if (!id) return null;

  const balance = await ensureCreatorBalance(id);

  return {
    user_id: id,
    earned_cents: safeCents(balance.earned_cents),
    pending_cents: safeCents(balance.pending_cents),
    paid_out_cents: safeCents(balance.paid_out_cents),
    available_cents: safeCents(balance.available_cents),
    currency: balance.currency || "usd"
  };
}

export async function logEconomyEvent({
  userId = null,
  eventName = "economy_event",
  section = "economy",
  targetTable = null,
  targetId = null,
  amountCents = 0,
  currency = "usd",
  metadata = {}
} = {}) {
  try {
    const rows = await rbInsert({
      table: RB_TABLES.platformAnalyticsEvents,
      values: {
        user_id: userId,
        event_name: eventName,
        section,
        target_table: targetTable,
        target_id: targetId,
        value_cents: safeCents(amountCents),
        metadata: {
          source: "rb-economy.js",
          currency,
          ...metadata
        }
      }
    });

    return rows?.[0] || null;
  } catch (error) {
    console.warn("[RB ECONOMY EVENT SKIPPED]", error?.message || error);
    return null;
  }
}

console.log("RB ECONOMY ENGINE READY");
