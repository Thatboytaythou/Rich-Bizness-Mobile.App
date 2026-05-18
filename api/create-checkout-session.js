// ===============================
// RICH BIZNESS MOBILE
// /api/create-checkout-session.js
// Stripe Store + VIP + Digital Checkout
// ===============================

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-04-30.basil"
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APP_URL =
  process.env.APP_URL ||
  process.env.PUBLIC_SITE_URL ||
  "http://localhost:3000";

const PLATFORM_FEE_BPS = Number(
  process.env.STRIPE_PLATFORM_FEE_BPS || 1000
); // 10%

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      productId,
      quantity = 1,
      buyerId,
      successPath = "/store.html?success=1",
      cancelPath = "/store.html?cancel=1"
    } = req.body || {};

    if (!productId) {
      return res.status(400).json({
        error: "Missing productId"
      });
    }

    // =========================
    // FETCH PRODUCT
    // =========================

    const { data: product, error: productError } = await supabase
      .from("products")
      .select(`
        *,
        seller:profiles!products_seller_id_fkey(
          id,
          username,
          display_name
        ),
        seller_profile:store_seller_profiles!store_seller_profiles_user_id_fkey(
          stripe_account_id,
          payouts_enabled,
          stripe_onboarding_complete
        )
      `)
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return res.status(404).json({
        error: "Product not found"
      });
    }

    // =========================
    // VALIDATION
    // =========================

    if (product.status !== "active") {
      return res.status(400).json({
        error: "Product inactive"
      });
    }

    if (!product.is_public) {
      return res.status(403).json({
        error: "Private product"
      });
    }

    if (
      product.inventory_count !== null &&
      product.inventory_count >= 0 &&
      quantity > product.inventory_count
    ) {
      return res.status(400).json({
        error: "Not enough inventory"
      });
    }

    const sellerStripe =
      product.seller_profile?.stripe_account_id || null;

    if (!sellerStripe) {
      return res.status(400).json({
        error: "Seller not connected to Stripe"
      });
    }

    // =========================
    // PRICE LOGIC
    // =========================

    const amountTotal = Number(product.price_cents || 0) * quantity;

    if (amountTotal <= 0) {
      return res.status(400).json({
        error: "Invalid price"
      });
    }

    const platformFeeCents = Math.round(
      amountTotal * (PLATFORM_FEE_BPS / 10000)
    );

    const sellerAmountCents =
      amountTotal - platformFeeCents;

    // =========================
    // CREATE PENDING ORDER
    // =========================

    const { data: order, error: orderError } = await supabase
      .from("store_orders")
      .insert({
        buyer_id: buyerId || null,
        seller_id: product.seller_id,
        product_id: product.id,
        product_name: product.title,
        quantity,
        amount_total: amountTotal,
        platform_fee_cents: platformFeeCents,
        seller_amount_cents: sellerAmountCents,
        currency: product.currency || "usd",
        payment_status: "pending",
        order_status: "processing",
        fulfillment_type:
          product.fulfillment_type || "shipping",
        metadata: {
          source: "Rich Bizness Mobile",
          product_type: product.product_type,
          checkout_origin: "store"
        }
      })
      .select()
      .single();

    if (orderError) {
      console.error(orderError);

      return res.status(500).json({
        error: "Failed creating order"
      });
    }

    // =========================
    // STRIPE CHECKOUT
    // =========================

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      payment_method_types: ["card"],

      line_items: [
        {
          quantity,

          price_data: {
            currency: product.currency || "usd",

            unit_amount: product.price_cents,

            product_data: {
              name: product.title,
              description:
                product.description || "Rich Bizness Product",

              images: product.image_url
                ? [product.image_url]
                : []
            }
          }
        }
      ],

      success_url: `${APP_URL}${successPath}&session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${APP_URL}${cancelPath}`,

      metadata: {
        order_id: order.id,
        product_id: product.id,
        buyer_id: buyerId || "",
        seller_id: product.seller_id || "",
        source: "rich-bizness-mobile"
      },

      payment_intent_data: {
        application_fee_amount: platformFeeCents,

        transfer_data: {
          destination: sellerStripe
        },

        metadata: {
          order_id: order.id,
          product_id: product.id
        }
      }
    });

    // =========================
    // UPDATE ORDER
    // =========================

    await supabase
      .from("store_orders")
      .update({
        stripe_checkout_session_id: session.id
      })
      .eq("id", order.id);

    // =========================
    // RESPONSE
    // =========================

    return res.status(200).json({
      success: true,

      checkoutUrl: session.url,

      sessionId: session.id,

      orderId: order.id,

      product: {
        id: product.id,
        title: product.title,
        price_cents: product.price_cents,
        currency: product.currency
      }
    });
  } catch (error) {
    console.error("CHECKOUT ERROR:", error);

    return res.status(500).json({
      error: error.message || "Checkout failed"
    });
  }
}
