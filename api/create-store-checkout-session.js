import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APP_URL =
  process.env.APP_URL ||
  process.env.PUBLIC_SITE_URL ||
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`;

const PLATFORM_FEE_BPS = Number(process.env.STRIPE_PLATFORM_FEE_BPS || 1000);

function json(res, status, data) {
  return res.status(status).json(data);
}

function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const token = getBearerToken(req);

    if (!token) {
      return json(res, 401, { error: "Missing auth token" });
    }

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json(res, 401, { error: "Invalid auth token" });
    }

    const {
      product_id,
      quantity = 1,
      success_url,
      cancel_url
    } = req.body || {};

    if (!product_id) {
      return json(res, 400, { error: "Missing product_id" });
    }

    const qty = Math.max(1, Math.min(Number(quantity) || 1, 99));

    const { data: product, error: productError } = await supabase
      .from("products")
      .select(`
        id,
        seller_id,
        title,
        description,
        price_cents,
        currency,
        image_url,
        cover_url,
        product_type,
        fulfillment_type,
        inventory_count,
        quantity,
        is_digital,
        status,
        is_public
      `)
      .eq("id", product_id)
      .single();

    if (productError || !product) {
      return json(res, 404, { error: "Product not found" });
    }

    if (product.status !== "active" || product.is_public === false) {
      return json(res, 403, { error: "Product is not available" });
    }

    if (!product.price_cents || product.price_cents < 50) {
      return json(res, 400, { error: "Product price must be at least 50 cents" });
    }

    const inventory = Number(product.inventory_count ?? product.quantity ?? 0);

    if (!product.is_digital && inventory > 0 && qty > inventory) {
      return json(res, 400, { error: "Not enough inventory" });
    }

    const { data: sellerProfile } = await supabase
      .from("store_seller_profiles")
      .select("stripe_account_id,payouts_enabled,stripe_onboarding_complete")
      .eq("user_id", product.seller_id)
      .maybeSingle();

    const amountTotal = product.price_cents * qty;
    const platformFeeCents = Math.floor((amountTotal * PLATFORM_FEE_BPS) / 10000);
    const sellerAmountCents = amountTotal - platformFeeCents;

    const { data: order, error: orderError } = await supabase
      .from("store_orders")
      .insert({
        buyer_id: user.id,
        seller_id: product.seller_id,
        product_id: product.id,
        product_name: product.title,
        quantity: qty,
        amount_total: amountTotal,
        platform_fee_cents: platformFeeCents,
        seller_amount_cents: sellerAmountCents,
        currency: product.currency || "usd",
        payment_status: "pending",
        order_status: "processing",
        fulfillment_type: product.fulfillment_type || "shipping",
        metadata: {
          source: "create-store-checkout-session",
          product_type: product.product_type,
          is_digital: product.is_digital
        }
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return json(res, 500, { error: orderError?.message || "Failed to create order" });
    }

    const sessionConfig = {
      mode: "payment",
      success_url:
        success_url ||
        `${APP_URL}/store.html?checkout=success&order_id=${order.id}`,
      cancel_url:
        cancel_url ||
        `${APP_URL}/store.html?checkout=cancelled&order_id=${order.id}`,
      customer_email: user.email || undefined,
      line_items: [
        {
          quantity: qty,
          price_data: {
            currency: product.currency || "usd",
            unit_amount: product.price_cents,
            product_data: {
              name: product.title,
              description: product.description || "Rich Bizness Store Item",
              images: [product.image_url || product.cover_url].filter(Boolean)
            }
          }
        }
      ],
      metadata: {
        type: "store_order",
        order_id: order.id,
        product_id: product.id,
        buyer_id: user.id,
        seller_id: product.seller_id || ""
      },
      payment_intent_data: {
        metadata: {
          type: "store_order",
          order_id: order.id,
          product_id: product.id,
          buyer_id: user.id,
          seller_id: product.seller_id || ""
        }
      }
    };

    if (
      sellerProfile?.stripe_account_id &&
      sellerProfile?.payouts_enabled &&
      sellerProfile?.stripe_onboarding_complete
    ) {
      sessionConfig.payment_intent_data.application_fee_amount = platformFeeCents;
      sessionConfig.payment_intent_data.transfer_data = {
        destination: sellerProfile.stripe_account_id
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    await supabase
      .from("store_orders")
      .update({
        stripe_checkout_session_id: session.id,
        metadata: {
          source: "create-store-checkout-session",
          stripe_session_id: session.id,
          product_type: product.product_type,
          is_digital: product.is_digital
        }
      })
      .eq("id", order.id);

    return json(res, 200, {
      url: session.url,
      session_id: session.id,
      order_id: order.id
    });
  } catch (error) {
    console.error("CREATE STORE CHECKOUT ERROR:", error);
    return json(res, 500, { error: error.message || "Checkout failed" });
  }
}
