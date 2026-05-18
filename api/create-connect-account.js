// ===============================
// RICH BIZNESS MOBILE
// /api/create-connect-account.js
// Stripe Connect Account Creator
// ===============================

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLATFORM_COUNTRY =
  process.env.STRIPE_PLATFORM_COUNTRY || "US";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { userId, email, username, displayName } = req.body || {};

    if (!userId) {
      return res.status(400).json({
        error: "Missing userId"
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name, full_name, avatar_url, banner_url, is_seller")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        error: "Profile not found"
      });
    }

    const { data: existingSeller } = await supabase
      .from("store_seller_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingSeller?.stripe_account_id) {
      return res.status(200).json({
        success: true,
        accountId: existingSeller.stripe_account_id,
        sellerProfile: existingSeller,
        alreadyExists: true
      });
    }

    const account = await stripe.accounts.create({
      type: "express",
      country: PLATFORM_COUNTRY,
      email: email || undefined,

      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },

      business_type: "individual",

      business_profile: {
        name:
          displayName ||
          profile.display_name ||
          username ||
          profile.username ||
          "Rich Bizness Seller",
        product_description: "Rich Bizness creator store, digital products, live access, and premium content."
      },

      metadata: {
        user_id: userId,
        username: profile.username || username || "",
        source: "rich-bizness-mobile"
      }
    });

    const sellerPayload = {
      user_id: userId,
      username: profile.username || username || null,
      display_name: profile.display_name || displayName || null,
      seller_name:
        profile.display_name ||
        displayName ||
        profile.username ||
        username ||
        "Rich Bizness Seller",
      avatar_url: profile.avatar_url || null,
      banner_url: profile.banner_url || null,
      stripe_account_id: account.id,
      stripe_onboarding_complete: false,
      payouts_enabled: false,
      status: "pending",
      metadata: {
        source: "Rich Bizness Mobile",
        stripe_account_type: "express"
      }
    };

    const { data: sellerProfile, error: sellerError } = await supabase
      .from("store_seller_profiles")
      .upsert(sellerPayload, {
        onConflict: "user_id"
      })
      .select()
      .single();

    if (sellerError) {
      return res.status(500).json({
        error: "Failed saving seller profile"
      });
    }

    await supabase
      .from("profiles")
      .update({
        is_seller: true
      })
      .eq("id", userId);

    return res.status(200).json({
      success: true,
      accountId: account.id,
      sellerProfile
    });
  } catch (error) {
    console.error("CREATE CONNECT ACCOUNT ERROR:", error);

    return res.status(500).json({
      error: error.message || "Failed creating Stripe Connect account"
    });
  }
}
