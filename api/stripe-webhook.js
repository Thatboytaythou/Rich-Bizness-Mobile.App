import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false
  }
};

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY)
  : null;

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      })
    : null;

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

async function safeInsert(table, payload) {
  try {
    await supabase.from(table).insert(payload);
  } catch {
    return null;
  }

  return true;
}

async function safeUpdate(table, values, column, value) {
  try {
    await supabase
      .from(table)
      .update(values)
      .eq(column, value);
  } catch {
    return null;
  }

  return true;
}

async function logStripeEvent(event, status = "processed", errorMessage = null) {
  if (!event?.id) return;

  const object = event.data?.object || {};
  const now = new Date().toISOString();

  await supabase.from("stripe_sync_events").upsert(
    {
      stripe_event_id: event.id,
      stripe_object_id: object.id || null,
      stripe_object_type: object.object || null,
      event_type: event.type,
      status,
      payload: event,
      error_message: errorMessage,
      processed_at: status === "processed" ? now : null,
      updated_at: now
    },
    { onConflict: "stripe_event_id" }
  );

  await safeInsert("api_webhook_events", {
    provider: "stripe",
    event_type: event.type,
    event_id: event.id,
    status,
    payload: event,
    error_message: errorMessage,
    processed_at: status === "processed" ? now : null
  });
}

async function updateCreatorBalance({
  creatorId,
  earnedCents,
  pendingCents = 0
}) {
  if (!creatorId) return;

  const { data: existing } = await supabase
    .from("creator_available_balances")
    .select("*")
    .eq("artist_user_id", creatorId)
    .maybeSingle();

  const nextEarned =
    Number(existing?.earned_cents || 0) + Number(earnedCents || 0);

  const nextPending =
    Number(existing?.pending_cents || 0) + Number(pendingCents || 0);

  const nextAvailable =
    Number(existing?.available_cents || 0) + Number(earnedCents || 0);

  await supabase.from("creator_available_balances").upsert(
    {
      artist_user_id: creatorId,
      earned_cents: nextEarned,
      pending_cents: nextPending,
      available_cents: nextAvailable,
      currency: "usd",
      updated_at: new Date().toISOString()
    },
    { onConflict: "artist_user_id" }
  );
}

async function unlockDigitalProduct({ order }) {
  if (!order?.buyer_id || !order?.product_id) return;

  await supabase.from("user_product_unlocks").upsert(
    {
      user_id: order.buyer_id,
      product_id: order.product_id,
      order_id: order.id,
      metadata: {
        source: "api/stripe-webhook.js",
        unlock_type: "store_order_paid"
      }
    },
    { onConflict: "user_id,product_id,order_id" }
  );
}

async function handleStoreOrderPaid(session) {
  const meta = session.metadata || {};
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : null;

  const customer =
    typeof session.customer === "string"
      ? session.customer
      : null;

  const amountTotal = Number(session.amount_total || 0);
  const currency = session.currency || "usd";
  const now = new Date().toISOString();

  let order = null;

  if (meta.order_id) {
    const { data } = await supabase
      .from("store_orders")
      .select("*")
      .eq("id", meta.order_id)
      .maybeSingle();

    order = data || null;
  }

  const { data: updatedOrder } = await supabase
    .from("store_orders")
    .update({
      stripe_payment_intent_id: paymentIntent,
      stripe_customer_id: customer,
      payment_status: "paid",
      order_status: "paid",
      amount_total: amountTotal,
      currency,
      customer_email:
        session.customer_details?.email ||
        session.customer_email ||
        null,
      paid_at: now,
      metadata: {
        ...(order?.metadata || {}),
        stripe_session_id: session.id,
        source: "api/stripe-webhook.js"
      },
      updated_at: now
    })
    .eq("stripe_checkout_session_id", session.id)
    .select("*")
    .maybeSingle();

  const finalOrder = updatedOrder || order;

  if (finalOrder?.seller_id) {
    await updateCreatorBalance({
      creatorId: finalOrder.seller_id,
      earnedCents: Number(finalOrder.seller_amount_cents || 0)
    });
  }

  if (
    finalOrder?.fulfillment_type === "digital" ||
    finalOrder?.metadata?.is_digital
  ) {
    await unlockDigitalProduct({
      order: finalOrder
    });
  }

  if (finalOrder?.buyer_id) {
    await safeInsert("store_notifications", {
      user_id: finalOrder.buyer_id,
      title: "Order paid",
      body: finalOrder.product_name || "Your order is confirmed.",
      notification_type: "store",
      related_product_id: finalOrder.product_id,
      related_order_id: finalOrder.id,
      metadata: {
        source: "api/stripe-webhook.js",
        stripe_session_id: session.id
      }
    });
  }
}

async function handleLivePurchasePaid(session) {
  const meta = session.metadata || {};
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : null;

  const customer =
    typeof session.customer === "string"
      ? session.customer
      : null;

  const amountTotal = Number(session.amount_total || meta.amount_cents || 0);
  const currency = session.currency || "usd";
  const now = new Date().toISOString();

  let purchase = null;

  const { data: existingPurchase } = await supabase
    .from("live_stream_purchases")
    .select("*")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  purchase = existingPurchase || null;

  const { data: updatedPurchase } = await supabase
    .from("live_stream_purchases")
    .update({
      stripe_payment_intent_id: paymentIntent,
      stripe_customer_id: customer,
      status: "paid",
      amount_cents: amountTotal,
      currency,
      purchased_at: now,
      metadata: {
        ...(purchase?.metadata || {}),
        stripe_session_id: session.id,
        source: "api/stripe-webhook.js"
      },
      updated_at: now
    })
    .eq("stripe_checkout_session_id", session.id)
    .select("*")
    .maybeSingle();

  purchase = updatedPurchase || purchase;

  const streamId = purchase?.stream_id || meta.stream_id;
  const userId = purchase?.user_id || meta.user_id;
  const creatorId = purchase?.metadata?.creator_id || meta.creator_id;

  if (streamId && userId) {
    await supabase.from("vip_live_access").upsert(
      {
        stream_id: streamId,
        user_id: userId,
        access_source: "purchase",
        access_status: "active",
        metadata: {
          stripe_session_id: session.id,
          live_stream_purchase_id: purchase?.id || null,
          source: "api/stripe-webhook.js"
        },
        updated_at: now
      },
      { onConflict: "stream_id,user_id" }
    );

    const { data: stream } = await supabase
      .from("live_streams")
      .select("total_revenue_cents, creator_amount_cents")
      .eq("id", streamId)
      .maybeSingle();

    await safeUpdate(
      "live_streams",
      {
        total_revenue_cents:
          Number(stream?.total_revenue_cents || 0) + amountTotal,
        creator_amount_cents:
          Number(stream?.creator_amount_cents || 0) +
          Number(purchase?.creator_amount_cents || 0),
        last_activity_at: now,
        updated_at: now
      },
      "id",
      streamId
    );
  }

  if (creatorId || purchase?.creator_amount_cents) {
    await updateCreatorBalance({
      creatorId,
      earnedCents: Number(purchase?.creator_amount_cents || 0)
    });
  }
}

async function handleLiveTipPaid(session) {
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : null;

  const amountTotal = Number(session.amount_total || 0);
  const currency = session.currency || "usd";
  const now = new Date().toISOString();

  const { data: tip } = await supabase
    .from("live_tips")
    .select("*")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  const { data: updatedTip } = await supabase
    .from("live_tips")
    .update({
      stripe_payment_intent_id: paymentIntent,
      status: "paid",
      amount_cents: amountTotal,
      currency,
      paid_at: now,
      metadata: {
        ...(tip?.metadata || {}),
        stripe_session_id: session.id,
        source: "api/stripe-webhook.js"
      }
    })
    .eq("stripe_checkout_session_id", session.id)
    .select("*")
    .maybeSingle();

  const finalTip = updatedTip || tip;

  if (finalTip?.to_user_id) {
    await updateCreatorBalance({
      creatorId: finalTip.to_user_id,
      earnedCents: Number(finalTip.creator_amount_cents || amountTotal || 0)
    });
  }
}

async function handleCheckoutCompleted(session) {
  const meta = session.metadata || {};
  const type = meta.type;

  if (type === "store_order") {
    await handleStoreOrderPaid(session);
    return;
  }

  if (
    type === "live_stream_purchase" ||
    type === "live_access"
  ) {
    await handleLivePurchasePaid(session);
    return;
  }

  if (type === "live_tip") {
    await handleLiveTipPaid(session);
  }
}

async function handleCheckoutFailed(session) {
  const meta = session.metadata || {};
  const type = meta.type;
  const now = new Date().toISOString();

  if (type === "store_order") {
    await supabase
      .from("store_orders")
      .update({
        payment_status: "failed",
        order_status: "cancelled",
        cancelled_at: now,
        updated_at: now
      })
      .eq("stripe_checkout_session_id", session.id);
  }

  if (
    type === "live_stream_purchase" ||
    type === "live_access"
  ) {
    await supabase
      .from("live_stream_purchases")
      .update({
        status: "failed",
        updated_at: now
      })
      .eq("stripe_checkout_session_id", session.id);
  }

  if (type === "live_tip") {
    await supabase
      .from("live_tips")
      .update({
        status: "failed"
      })
      .eq("stripe_checkout_session_id", session.id);
  }
}

async function handleAccountUpdated(account) {
  await supabase
    .from("store_seller_profiles")
    .update({
      stripe_onboarding_complete: Boolean(account.details_submitted),
      payouts_enabled: Boolean(account.payouts_enabled),
      status: account.payouts_enabled ? "active" : "pending",
      metadata: {
        stripe_account_id: account.id,
        charges_enabled: Boolean(account.charges_enabled),
        details_submitted: Boolean(account.details_submitted),
        payouts_enabled: Boolean(account.payouts_enabled),
        source: "api/stripe-webhook.js"
      },
      updated_at: new Date().toISOString()
    })
    .eq("stripe_account_id", account.id);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  if (!stripe || !supabase) {
    return res.status(500).json({
      error: "Missing Stripe or Supabase environment variables"
    });
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({
      error: "Missing STRIPE_WEBHOOK_SECRET"
    });
  }

  const sig = req.headers["stripe-signature"];

  let event;

  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return res.status(400).json({
      error: `Webhook signature failed: ${error.message}`
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        await handleCheckoutFailed(event.data.object);
        break;

      case "account.updated":
        await handleAccountUpdated(event.data.object);
        break;

      default:
        await logStripeEvent(event, "ignored");
        return res.status(200).json({
          received: true,
          ignored: event.type
        });
    }

    await logStripeEvent(event, "processed");

    return res.status(200).json({
      received: true,
      type: event.type
    });
  } catch (error) {
    await logStripeEvent(
      event,
      "failed",
      error?.message || "Webhook failed"
    );

    return res.status(500).json({
      error: error?.message || "Webhook failed"
    });
  }
}
