import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(res, status, payload) {
  return res.status(status).json(payload);
}

async function getUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  return data.user;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const user = await getUser(req);

    if (!user) {
      return json(res, 401, { ok: false, error: "Login required" });
    }

    const siteUrl =
      process.env.APP_URL ||
      process.env.PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, display_name, full_name, is_creator, is_seller")
      .eq("id", user.id)
      .single();

    let { data: sellerProfile } = await supabase
      .from("store_seller_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    let stripeAccountId = sellerProfile?.stripe_account_id || null;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: process.env.STRIPE_PLATFORM_COUNTRY || "US",
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        business_type: "individual",
        metadata: {
          user_id: user.id,
          source: "rich-bizness-mobile"
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
        seller_name:
          sellerProfile?.seller_name ||
          profile?.display_name ||
          profile?.username ||
          "Rich Bizness Seller",
        avatar_url: sellerProfile?.avatar_url || null,
        banner_url: sellerProfile?.banner_url || null,
        stripe_account_id: stripeAccountId,
        stripe_onboarding_complete: false,
        payouts_enabled: false,
        status: "pending",
        metadata: {
          source: "api/create-account-link",
          stripe_account_created: true
        },
        updated_at: new Date().toISOString()
      };

      const { data: savedSeller, error: sellerError } = await supabase
        .from("store_seller_profiles")
        .upsert(upsertPayload, { onConflict: "user_id" })
        .select("*")
        .single();

      if (sellerError) throw sellerError;
      sellerProfile = savedSeller;

      await supabase
        .from("profiles")
        .update({
          is_creator: true,
          is_seller: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${siteUrl}/monetization.html?stripe=refresh`,
      return_url: `${siteUrl}/monetization.html?stripe=complete`,
      type: "account_onboarding"
    });

    await supabase.from("admin_audit_logs").insert({
      admin_id: user.id,
      action: "stripe_account_link_created",
      target_table: "store_seller_profiles",
      target_id: sellerProfile?.id || null,
      severity: "normal",
      metadata: {
        stripe_account_id: stripeAccountId,
        return_url: `${siteUrl}/monetization.html?stripe=complete`
      }
    });

    return json(res, 200, {
      ok: true,
      url: accountLink.url,
      stripe_account_id: stripeAccountId
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error?.message || "Failed to create Stripe account link"
    });
  }
}
