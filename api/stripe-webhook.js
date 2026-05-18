import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false
  }
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

async function logStripeEvent(event, status = "processed", errorMessage = null) {
  await supabase.from("stripe_sync_events").upsert(
    {
      stripe_event_id: event.id,
      stripe_object_id: event.data?.object?.id || null,
      stripe_object_type: event.data?.object?.object || null,
      event_type: event.type,
      status,
      payload: event,
      error_message: errorMessage,
      processed_at: status === "processed" ? new Date().toISOString() : null
    },
    { onConflict: "stripe_event_id" }
  );

  await supabase.from("api_webhook_events").insert({
    provider: "stripe",
    event_type: event.type,
    event_id: event.id,
    status,
    payload: event,
    error_message: errorMessage,
    processed_at: status === "processed" ? new Date().toISOString() : null
  });
}

async function handleCheckoutCompleted(session) {
  const meta = session.metadata || {};
  const paymentIntent = session.payment_intent || null;
  const customer = session.customer || null;
  const amountTotal = session.amount_total || 0;
  const currency = session.currency || "usd";

  if (meta.type === "store_order") {
    await supabase
      .from("store_orders")
      .update({
        stripe_payment_intent_id: paymentIntent,
        stripe_customer_id: customer,
        payment_status: "paid",
        order_status: "paid",
        amount_total: amountTotal,
        currency,
        customer_email: session.customer_details?.email || session.customer_email || null,
        paid_at: new Date().toISOString(),
        metadata: {
          stripe_session: session,
          source: "stripe_webhook"
        }
      })
      .eq("stripe_checkout_session_id", session.id);
  }

  if (meta.type === "live_access") {
    await supabase
      .from("live_stream_purchases")
      .update({
        stripe_payment_intent_id: paymentIntent,
        stripe_customer_id: customer,
        status: "paid",
        amount_cents: amountTotal,
        currency,
        purchased_at: new Date().toISOString(),
        metadata: {
          stripe_session: session,
          source: "stripe_webhook"
        }
      })
      .eq("stripe_checkout_session_id", session.id);

    if (meta.stream_id && meta.user_id) {
      await supabase.from("vip_live_access").upsert(
        {
          stream_id: meta.stream_id,
          user_id: meta.user_id,
          access_source: "purchase",
          access_status: "active",
          metadata: {
            stripe_session_id: session.id,
            source: "stripe_webhook"
          }
        },
        { onConflict: "stream_id,user_id" }
      );

      await supabase.rpc("increment_live_revenue", {
        p_stream_id: meta.stream_id,
        p_amount_cents: amountTotal
      }).catch(() => null);
    }
  }

  if (meta.type === "live_tip") {
    await supabase
      .from("live_tips")
      .update({
        stripe_payment_intent_id: paymentIntent,
        status: "paid",
        amount_cents: amountTotal,
        currency,
        paid_at: new Date().toISOString(),
        metadata: {
          stripe_session: session,
          source: "stripe_webhook"
        }
      })
      .eq("stripe_checkout_session_id", session.id);
  }
}

async function handleCheckoutFailed(session) {
  const meta = session.metadata || {};

  if (meta.type === "store_order") {
    await supabase
      .from("store_orders")
      .update({
        payment_status: "failed",
        order_status: "cancelled",
        cancelled_at: new Date().toISOString()
      })
      .eq("stripe_checkout_session_id", session.id);
  }

  if (meta.type === "live_access") {
    await supabase
      .from("live_stream_purchases")
      .update({ status: "failed" })
      .eq("stripe_checkout_session_id", session.id);
  }

  if (meta.type === "live_tip") {
    await supabase
      .from("live_tips")
      .update({ status: "failed" })
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
        stripe_account: account,
        source: "stripe_webhook"
      }
    })
    .eq("stripe_account_id", account.id);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(500).json({ error: "Missing STRIPE_WEBHOOK_SECRET" });
  }

  let event;

  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
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
        return res.status(200).json({ received: true, ignored: event.type });
    }

    await logStripeEvent(event, "processed");

    return res.status(200).json({
      received: true,
      type: event.type
    });
  } catch (error) {
    console.error("STRIPE WEBHOOK ERROR:", error);

    await logStripeEvent(event, "failed", error.message || "Webhook failed");

    return res.status(500).json({
      error: error.message || "Webhook failed"
    });
  }
}
