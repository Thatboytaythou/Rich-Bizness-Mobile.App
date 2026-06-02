import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const PLATFORM_COUNTRY =
  process.env.STRIPE_PLATFORM_COUNTRY || "US";

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

function cleanText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}

function getBearerToken(req) {
  const auth =
    req.headers.authorization ||
    req.headers.Authorization ||
    "";

  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
}

async function getUserFromAuth(req) {
  const token = getBearerToken(req);

  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) return null;

  return data.user;
}

async function insertStripeSyncEvent(payload) {
  try {
    await supabase.from("stripe_sync_events").insert(payload);
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
    if (!stripe) {
      return json(res, 500, {
        ok: false,
        error: "Missing Stripe secret key"
      });
    }

    if (!supabase) {
      return json(res, 500, {
        ok: false,
        error: "Missing Supabase server environment variables"
      });
    }

    const authUser = await getUserFromAuth(req);
    const body = req.body || {};

    const requestedUserId = cleanText(body.userId || body.user_id);

    const userId =
      authUser?.id ||
      requestedUserId;

    if (!userId) {
      return json(res, 401, {
        ok: false,
        error: "Login required"
      });
    }

    if (requestedUserId && authUser?.id && requestedUserId !== authUser.id) {
      return json(res, 403, {
        ok: false,
        error: "You cannot create a Connect account for another user"
      });
    }

    const email =
      cleanText(body.email) ||
      authUser?.email ||
      undefined;

    const username = cleanText(body.username);
    const displayName = cleanText(body.displayName || body.display_name);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(`
        id,
        username,
        display_name,
        full_name,
        avatar_url,
        banner_url,
        is_seller,
        metadata
      `)
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      return json(res, 404, {
        ok: false,
        error: "Profile not found"
      });
    }

    const { data: existingSeller } = await supabase
      .from("store_seller_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingSeller?.stripe_account_id) {
      return json(res, 200, {
        ok: true,
        success: true,
        accountId: existingSeller.stripe_account_id,
        account_id: existingSeller.stripe_account_id,
        sellerProfile: existingSeller,
        seller_profile: existingSeller,
        alreadyExists: true,
        already_exists: true
      });
    }

    const sellerName =
      displayName ||
      profile.display_name ||
      profile.full_name ||
      username ||
      profile.username ||
      "Rich Bizness Seller";

    const account = await stripe.accounts.create({
      type: "express",
      country: PLATFORM_COUNTRY,
      email,

      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },

      business_type: "individual",

      business_profile: {
        name: sellerName,
        product_description:
          "Rich Bizness creator store, digital products, live access, and premium content."
      },

      metadata: {
        app: "rich-bizness-mobile",
        user_id: userId,
        username: profile.username || username || "",
        source: "api/create-connect-account.js"
      }
    });

    const now = new Date().toISOString();

    const sellerPayload = {
      user_id: userId,
      username: profile.username || username || null,
      display_name: profile.display_name || displayName || sellerName,
      seller_name: sellerName,
      avatar_url: profile.avatar_url || null,
      banner_url: profile.banner_url || null,
      stripe_account_id: account.id,
      stripe_onboarding_complete: Boolean(account.details_submitted),
      payouts_enabled: Boolean(account.payouts_enabled),
      status: account.payouts_enabled ? "active" : "pending",
      metadata: {
        ...(existingSeller?.metadata || {}),
        app: "Rich Bizness Mobile",
        source: "api/create-connect-account.js",
        stripe_account_type: "express",
        stripe_account_id: account.id,
        charges_enabled: Boolean(account.charges_enabled),
        details_submitted: Boolean(account.details_submitted),
        payouts_enabled: Boolean(account.payouts_enabled)
      },
      updated_at: now
    };

    const { data: sellerProfile, error: sellerError } = await supabase
      .from("store_seller_profiles")
      .upsert(sellerPayload, {
        onConflict: "user_id"
      })
      .select("*")
      .single();

    if (sellerError) {
      return json(res, 500, {
        ok: false,
        error: sellerError.message || "Failed saving seller profile"
      });
    }

    await supabase
      .from("profiles")
      .update({
        is_seller: true,
        updated_at: now,
        metadata: {
          ...(profile.metadata || {}),
          stripe_connect_ready: true,
          stripe_account_id: account.id,
          seller_profile_id: sellerProfile.id,
          seller_source: "api/create-connect-account.js"
        }
      })
      .eq("id", userId);

    await supabase.from("creator_available_balances").upsert(
      {
        artist_user_id: userId,
        currency: "usd",
        updated_at: now
      },
      { onConflict: "artist_user_id" }
    );

    await insertStripeSyncEvent({
      stripe_event_id: `connect_account_${account.id}`,
      stripe_object_id: account.id,
      stripe_object_type: "account",
      event_type: "connect_account.created",
      status: "processed",
      related_user_id: userId,
      related_table: "store_seller_profiles",
      related_id: sellerProfile.id,
      payload: {
        account_id: account.id,
        user_id: userId,
        source: "api/create-connect-account.js"
      },
      processed_at: now
    });

    return json(res, 200, {
      ok: true,
      success: true,
      accountId: account.id,
      account_id: account.id,
      sellerProfile,
      seller_profile: sellerProfile
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error:
        error?.message ||
        "Failed creating Stripe Connect account"
    });
  }
}
