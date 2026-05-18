import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(res, status, data) {
  return res.status(status).json(data);
}

function bearer(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const token = bearer(req);
    if (!token) return json(res, 401, { error: "Missing auth token" });

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json(res, 401, { error: "Invalid auth token" });
    }

    const { amount_cents, currency = "usd", note = "" } = req.body || {};
    const amount = Math.floor(Number(amount_cents) || 0);

    if (amount < 1000) {
      return json(res, 400, { error: "Minimum payout request is $10.00" });
    }

    const { data: balance, error: balanceError } = await supabase
      .from("creator_available_balances")
      .select("*")
      .eq("artist_user_id", user.id)
      .maybeSingle();

    if (balanceError || !balance) {
      return json(res, 404, { error: "Creator balance not found" });
    }

    if ((balance.available_cents || 0) < amount) {
      return json(res, 400, { error: "Not enough available balance" });
    }

    const { data: seller } = await supabase
      .from("store_seller_profiles")
      .select("stripe_account_id,payouts_enabled,stripe_onboarding_complete")
      .eq("user_id", user.id)
      .maybeSingle();

    const autoApprove = process.env.AUTO_APPROVE_PAYOUTS === "true";

    const { data: job, error: jobError } = await supabase
      .from("api_jobs")
      .insert({
        job_type: "creator_payout_request",
        status: autoApprove ? "running" : "queued",
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
          stripe_onboarding_complete: !!seller?.stripe_onboarding_complete
        }
      })
      .select("id")
      .single();

    if (jobError || !job) {
      return json(res, 500, { error: jobError?.message || "Failed to create payout request" });
    }

    await supabase
      .from("creator_available_balances")
      .update({
        available_cents: Math.max(0, (balance.available_cents || 0) - amount),
        pending_cents: (balance.pending_cents || 0) + amount,
        updated_at: new Date().toISOString()
      })
      .eq("id", balance.id);

    let transfer = null;

    if (autoApprove) {
      if (!seller?.stripe_account_id || !seller?.payouts_enabled) {
        return json(res, 400, {
          error: "Stripe payout account is not ready",
          payout_request_id: job.id
        });
      }

      transfer = await stripe.transfers.create({
        amount,
        currency,
        destination: seller.stripe_account_id,
        metadata: {
          type: "creator_payout",
          payout_request_id: job.id,
          user_id: user.id
        }
      });

      await supabase
        .from("creator_available_balances")
        .update({
          pending_cents: Math.max(0, (balance.pending_cents || 0)),
          paid_out_cents: (balance.paid_out_cents || 0) + amount,
          updated_at: new Date().toISOString()
        })
        .eq("id", balance.id);

      await supabase
        .from("api_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          result: { stripe_transfer_id: transfer.id },
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id);
    }

    await supabase.from("stripe_sync_events").insert({
      stripe_object_id: transfer?.id || null,
      stripe_object_type: transfer ? "transfer" : "payout_request",
      event_type: autoApprove ? "creator.payout.sent" : "creator.payout.requested",
      status: autoApprove ? "processed" : "pending",
      related_user_id: user.id,
      related_table: "api_jobs",
      related_id: job.id,
      amount_cents: amount,
      currency,
      payload: { note, auto_approve: autoApprove }
    });

    return json(res, 200, {
      ok: true,
      payout_request_id: job.id,
      status: autoApprove ? "paid" : "queued",
      stripe_transfer_id: transfer?.id || null
    });
  } catch (error) {
    console.error("REQUEST PAYOUT ERROR:", error);
    return json(res, 500, { error: error.message || "Payout request failed" });
  }
}
