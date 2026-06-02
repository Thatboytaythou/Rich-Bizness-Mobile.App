import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const APP_URL =
  process.env.APP_URL ||
  process.env.PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";

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

function json(res, status, payload) {
  return res.status(status).json(payload);
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

async function getUser(req) {
  const token = getBearerToken(req);

  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) return null;

  return data.user;
}

async function insertQuiet(table, payload) {
  try {
    await supabase.from(table).insert(payload);
  } catch {
    return null;
  }

  return true;
}

async function ensureCreatorBalance(userId) {
  if (!userId) return;

  await supabase.from("creator_available_balances").upsert(
    {
      artist_user_id: userId,
      currency: "usd",
      updated_at: new Date().toISOString()
    },
    { onConflict: "artist_user_id" }
  );
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

    const user = await getUser(req);

    if (!user?.id) {
      return json(res, 401, {
        ok: false,
        error: "Login required"
      });
    }

    const siteUrl = APP_URL;

    const { data: profile } = await supabase
      .from("profiles")
      .select(`
        id,
        username,
        display_name,
        full_name,
        avatar_url,
        banner_url,
        is_creator,
        is_seller,
        metadata
      `)
      .eq("id", user.id)
      .maybeSingle();

    let { data: sellerProfile } = await supabase
      .from("store_seller_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    let stripeAccountId = sellerProfile?.stripe_account_id || null;

    if (!stripeAccountId) {
      const sellerName =
        sellerProfile?.seller_name ||
        profile?.display_name ||
        profile?.full_name ||
        profile?.username ||
        user.email?.split("@")[0] ||
        "Rich Bizness Seller";

      const account = await stripe.accounts.create({
        type: "express",
        country: PLATFORM_COUNTRY,
        email: user.email || undefined,
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
          user_id: user.id,
          username: profile?.username || "",
          source: "api/create-account-link.js"
        }
      });

      stripeAccountId = account.id;

      const upsertPayload = {
        user_id: user.id,
        username: profile?.username || null,
        display_name:
          profile?.display_name ||
          profile?.full_name ||
          user.email?.split("@")[0] ||
          "Creator",
        seller_name: sellerName,
        avatar_url:
          sellerProfile?.avatar_url ||
          profile?.avatar_url ||
          null,
        banner_url:
          sellerProfile?.banner_url ||
          profile?.banner_url ||
          null,
        stripe_account_id: stripeAccountId,
        stripe_onboarding_complete: Boolean(account.details_submitted),
        payouts_enabled: Boolean(account.payouts_enabled),
        status: account.payouts_enabled ? "active" : "pending",
        metadata: {
          ...(sellerProfile?.metadata || {}),
          app: "Rich Bizness Mobile",
          source: "api/create-account-link.js",
          stripe_account_created: true,
          stripe_account_type: "express",
          stripe_account_id: stripeAccountId,
          charges_enabled: Boolean(account.charges_enabled),
          details_submitted: Boolean(account.details_submitted),
          payouts_enabled: Boolean(account.payouts_enabled)
        },
        updated_at: new Date().toISOString()
      };

      const { data: savedSeller, error: sellerError } = await supabase
        .from("store_seller_profiles")
        .upsert(upsertPayload, {
          onConflict: "user_id"
        })
        .select("*")
        .single();

      if (sellerError) throw sellerError;

      sellerProfile = savedSeller;
    }

    const now = new Date().toISOString();

    await supabase
      .from("profiles")
      .update({
        is_creator: true,
        is_seller: true,
        updated_at: now,
        metadata: {
          ...(profile?.metadata || {}),
          stripe_connect_ready: true,
          stripe_account_id: stripeAccountId,
          seller_profile_id: sellerProfile?.id || null,
          seller_source: "api/create-account-link.js"
        }
      })
      .eq("id", user.id);

    await ensureCreatorBalance(user.id);

    const refreshUrl =
      `${siteUrl}/monetization.html?stripe=refresh`;

    const returnUrl =
      `${siteUrl}/monetization.html?stripe=complete`;

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding"
    });

    await insertQuiet("admin_audit_logs", {
      admin_id: user.id,
      action: "stripe_account_link_created",
      target_table: "store_seller_profiles",
      target_id: sellerProfile?.id || null,
      severity: "normal",
      metadata: {
        stripe_account_id: stripeAccountId,
        return_url: returnUrl,
        refresh_url: refreshUrl,
        source: "api/create-account-link.js"
      }
    });

    await insertQuiet("stripe_sync_events", {
      stripe_event_id: `account_link_${stripeAccountId}_${Date.now()}`,
      stripe_object_id: stripeAccountId,
      stripe_object_type: "account_link",
      event_type: "connect_account_link.created",
      status: "processed",
      related_user_id: user.id,
      related_table: "store_seller_profiles",
      related_id: sellerProfile?.id || null,
      payload: {
        stripe_account_id: stripeAccountId,
        url: accountLink.url,
        return_url: returnUrl,
        source: "api/create-account-link.js"
      },
      processed_at: now
    });

    return json(res, 200, {
      ok: true,
      url: accountLink.url,
      stripe_account_id: stripeAccountId,
      account_id: stripeAccountId,
      seller_profile: sellerProfile
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error:
        error?.message ||
        "Failed to create Stripe account link"
    });
  }
}
