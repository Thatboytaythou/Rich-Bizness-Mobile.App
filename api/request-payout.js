import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const AUTO_APPROVE_PAYOUTS =
  process.env.AUTO_APPROVE_PAYOUTS === "true";

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

function json(res, status, data) {
  return res.status(status).json(data);
}

function bearer(req) {
  const auth =
    req.headers.authorization ||
    req.headers.Authorization ||
    "";

  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
}

function cleanText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}

function cleanAmount(value) {
  const amount = Math.floor(Number(value) || 0);
  return Math.max(0, amount);
}

async function insertStripeSyncEvent(payload) {
  try {
    await supabase.from("stripe_sync_events").insert(payload);
  } catch {
    return null;
  }

  return true;
}

async function insertNotification(payload) {
  try {
    await supabase.from("rich_notifications").insert(payload);
  } catch {
    return null;
  }

  return true;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return json(res, 405, {
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    if (!supabase) {
      return json(res, 500, {
        ok: false,
        error: "Missing Supabase server environment variables"
      });
    }

    if (AUTO_APPROVE_PAYOUTS && !stripe) {
      return json(res, 500, {
        ok: false,
        error: "Missing Stripe secret key"
      });
    }

    const token = bearer(req);

    if (!token) {
      return json(res, 401, {
        ok: false,
        error: "Missing auth token"
      });
    }

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user?.id) {
      return json(res, 401, {
        ok: false,
        error: "Invalid auth token"
      });
    }

    const body = req.body || {};
    const amount = cleanAmount(body.amount_cents || body.amountCents);
    const currency = cleanText(body.currency, "usd").toLowerCase().slice(0, 8);
    const note = cleanText(body.note);

    if (amount < 1000) {
      return json(res, 400, {
        ok: false,
        error: "Minimum payout request is $10.00"
      });
    }

    const { data: balance, error: balanceError } = await supabase
      .from("creator_available_balances")
      .select("*")
      .eq("artist_user_id", user.id)
      .maybeSingle();

    if (balanceError || !balance) {
      return json(res, 404, {
        ok: false,
        error: "Creator balance not found"
      });
    }

    const availableCents = Number(balance.available_cents || 0);
    const pendingCents = Number(balance.pending_cents || 0);
    const paidOutCents = Number(balance.paid_out_cents || 0);

    if (availableCents < amount) {
      return json(res, 400, {
        ok: false,
        error: "Not enough available balance"
      });
    }

    const { data: seller } = await supabase
      .from("store_seller_profiles")
      .select(`
        id,
        stripe_account_id,
        payouts_enabled,
        stripe_onboarding_complete,
        status
      `)
      .eq("user_id", user.id)
      .maybeSingle();

    const now = new Date().toISOString();

    const { data: job, error: jobError } = await supabase
      .from("api_jobs")
      .insert({
        job_type: "creator_payout_request",
        status: AUTO_APPROVE_PAYOUTS ? "running" : "queued",
        priority: "high",
        target_table: "creator_available_balances",
        target_id: balance.id,
        payload: {
          user_id: user.id,
          amount_cents: amount,
          currency,
          note,
          stripe_account_id: seller?.stripe_account_id || null,
          payouts_enabled: !!seller?.payouts_enabled,
          stripe_onboarding_complete: !!seller?.stripe_onboarding_complete,
          auto_approve: AUTO_APPROVE_PAYOUTS,
          source: "api/request-payout.js"
        },
        created_at: now,
        updated_at: now
      })
      .select("*")
      .single();

    if (jobError || !job) {
      return json(res, 500, {
        ok: false,
        error:
          jobError?.message ||
          "Failed to create payout request"
      });
    }

    await supabase
      .from("creator_available_balances")
      .update({
        available_cents: Math.max(0, availableCents - amount),
        pending_cents: pendingCents + amount,
        updated_at: now
      })
      .eq("id", balance.id);

    let transfer = null;
    let finalStatus = AUTO_APPROVE_PAYOUTS ? "paid" : "queued";

    if (AUTO_APPROVE_PAYOUTS) {
      if (
        !seller?.stripe_account_id ||
        !seller?.payouts_enabled ||
        !seller?.stripe_onboarding_complete
      ) {
        await supabase
          .from("api_jobs")
          .update({
            status: "blocked",
            error_message: "Stripe payout account is not ready",
            updated_at: new Date().toISOString()
          })
          .eq("id", job.id);

        return json(res, 400, {
          ok: false,
          error: "Stripe payout account is not ready",
          payout_request_id: job.id
        });
      }

      transfer = await stripe.transfers.create({
        amount,
        currency,
        destination: seller.stripe_account_id,
        metadata: {
          app: "rich-bizness-mobile",
          type: "creator_payout",
          payout_request_id: job.id,
          user_id: user.id,
          balance_id: balance.id
        }
      });

      await supabase
        .from("creator_available_balances")
        .update({
          pending_cents: pendingCents,
          paid_out_cents: paidOutCents + amount,
          updated_at: new Date().toISOString()
        })
        .eq("id", balance.id);

      await supabase
        .from("api_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          result: {
            stripe_transfer_id: transfer.id,
            amount_cents: amount,
            currency
          },
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id);
    }

    await insertStripeSyncEvent({
      stripe_event_id:
        transfer?.id ||
        `payout_request_${job.id}`,
      stripe_object_id: transfer?.id || job.id,
      stripe_object_type: transfer ? "transfer" : "payout_request",
      event_type: AUTO_APPROVE_PAYOUTS
        ? "creator.payout.sent"
        : "creator.payout.requested",
      status: AUTO_APPROVE_PAYOUTS ? "processed" : "pending",
      related_user_id: user.id,
      related_table: "api_jobs",
      related_id: job.id,
      amount_cents: amount,
      currency,
      payload: {
        note,
        auto_approve: AUTO_APPROVE_PAYOUTS,
        stripe_account_id: seller?.stripe_account_id || null,
        source: "api/request-payout.js"
      },
      processed_at: AUTO_APPROVE_PAYOUTS
        ? new Date().toISOString()
        : null
    });

    await insertNotification({
      user_id: user.id,
      type: "payout_request",
      title: AUTO_APPROVE_PAYOUTS
        ? "Payout sent"
        : "Payout requested",
      body: AUTO_APPROVE_PAYOUTS
        ? "Your creator payout has been sent."
        : "Your payout request is queued for review.",
      target_table: "api_jobs",
      target_type: "payout",
      target_id: job.id,
      emoji: "💸",
      priority: "normal",
      metadata: {
        amount_cents: amount,
        currency,
        stripe_transfer_id: transfer?.id || null,
        source: "api/request-payout.js"
      }
    });

    return json(res, 200, {
      ok: true,
      payout_request_id: job.id,
      status: finalStatus,
      stripe_transfer_id: transfer?.id || null,
      amount_cents: amount,
      currency
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error:
        error?.message ||
        "Payout request failed"
    });
  }
}
