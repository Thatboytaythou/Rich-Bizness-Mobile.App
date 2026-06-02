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
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const PLATFORM_FEE_BPS = Number(
  process.env.STRIPE_PLATFORM_FEE_BPS || 1000
);

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

function getBearerToken(req) {
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

function cleanQty(value) {
  const qty = Number(value);
  if (!Number.isFinite(qty)) return 1;
  return Math.max(1, Math.min(Math.floor(qty), 99));
}

function absoluteUrl(urlOrPath = "/store.html") {
  if (String(urlOrPath).startsWith("http")) return urlOrPath;
  return `${APP_URL}${urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`}`;
}

function calcFee(amountTotal) {
  return Math.max(
    0,
    Math.floor((amountTotal * PLATFORM_FEE_BPS) / 10000)
  );
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

    const token = getBearerToken(req);

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

    const productId = cleanText(
      body.product_id ||
        body.productId
    );

    const qty = cleanQty(body.quantity);

    const successUrlInput = cleanText(
      body.success_url ||
        body.successUrl,
      `/store.html?checkout=success`
    );

    const cancelUrlInput = cleanText(
      body.cancel_url ||
        body.cancelUrl,
      `/store.html?checkout=cancelled`
    );

    if (!productId) {
      return json(res, 400, {
        ok: false,
        error: "Missing product_id"
      });
    }

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
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return json(res, 404, {
        ok: false,
        error: "Product not found"
      });
    }

    if (product.status !== "active" || product.is_public === false) {
      return json(res, 403, {
        ok: false,
        error: "Product is not available"
      });
    }

    if (!product.price_cents || product.price_cents < 50) {
      return json(res, 400, {
        ok: false,
        error: "Product price must be at least 50 cents"
      });
    }

    const inventory = Number(product.inventory_count ?? product.quantity ?? 0);

    if (!product.is_digital && inventory > 0 && qty > inventory) {
      return json(res, 400, {
        ok: false,
        error: "Not enough inventory"
      });
    }

    const { data: sellerProfile } = await supabase
      .from("store_seller_profiles")
      .select("stripe_account_id,payouts_enabled,stripe_onboarding_complete")
      .eq("user_id", product.seller_id)
      .maybeSingle();

    const amountTotal = Number(product.price_cents || 0) * qty;
    const platformFeeCents = calcFee(amountTotal);
    const sellerAmountCents = Math.max(0, amountTotal - platformFeeCents);

    const currency = cleanText(product.currency, "usd")
      .toLowerCase()
      .slice(0, 8);

    const fulfillmentType =
      product.fulfillment_type ||
      (product.is_digital ? "digital" : "shipping");

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
        currency,
        payment_status: "pending",
        order_status: "processing",
        customer_email: user.email || null,
        fulfillment_type: fulfillmentType,
        metadata: {
          app: "Rich Bizness Mobile",
          source: "api/create-store-checkout-session.js",
          product_type: product.product_type,
          is_digital: !!product.is_digital
        }
      })
      .select("*")
      .single();

    if (orderError || !order) {
      return json(res, 500, {
        ok: false,
        error: orderError?.message || "Failed to create order"
      });
    }

    const sessionConfig = {
      mode: "payment",

      success_url:
        `${absoluteUrl(successUrlInput)}` +
        `${successUrlInput.includes("?") ? "&" : "?"}` +
        `order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        `${absoluteUrl(cancelUrlInput)}` +
        `${cancelUrlInput.includes("?") ? "&" : "?"}` +
        `order_id=${order.id}`,

      customer_email: user.email || undefined,

      line_items: [
        {
          quantity: qty,
          price_data: {
            currency,
            unit_amount: product.price_cents,
            product_data: {
              name: product.title,
              description:
                product.description ||
                "Rich Bizness Store Item",
              images: [
                product.image_url ||
                product.cover_url
              ].filter(Boolean),
              metadata: {
                product_id: product.id,
                seller_id: product.seller_id || "",
                product_type: product.product_type || "physical"
              }
            }
          }
        }
      ],

      metadata: {
        app: "rich-bizness-mobile",
        type: "store_order",
        order_id: order.id,
        product_id: product.id,
        buyer_id: user.id,
        seller_id: product.seller_id || "",
        amount_total: String(amountTotal),
        platform_fee_cents: String(platformFeeCents),
        seller_amount_cents: String(sellerAmountCents)
      },

      payment_intent_data: {
        metadata: {
          app: "rich-bizness-mobile",
          type: "store_order",
          order_id: order.id,
          product_id: product.id,
          buyer_id: user.id,
          seller_id: product.seller_id || ""
        }
      }
    };

    const sellerCanTransfer =
      sellerProfile?.stripe_account_id &&
      sellerProfile?.payouts_enabled &&
      sellerProfile?.stripe_onboarding_complete;

    if (sellerCanTransfer) {
      sessionConfig.payment_intent_data.application_fee_amount =
        platformFeeCents;

      sessionConfig.payment_intent_data.transfer_data = {
        destination: sellerProfile.stripe_account_id
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    await supabase
      .from("store_orders")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_customer_id:
          typeof session.customer === "string"
            ? session.customer
            : null,
        metadata: {
          ...(order.metadata || {}),
          stripe_session_id: session.id,
          stripe_checkout_url: session.url,
          stripe_session_status: session.status,
          stripe_payment_status: session.payment_status,
          transfer_enabled: !!sellerCanTransfer
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", order.id);

    await insertStripeSyncEvent({
      stripe_event_id: session.id,
      stripe_object_id: session.id,
      stripe_object_type: "checkout.session",
      event_type: "store_order.created",
      status: "pending",
      related_user_id: user.id,
      related_table: "store_orders",
      related_id: order.id,
      amount_cents: amountTotal,
      currency,
      payload: {
        order_id: order.id,
        product_id: product.id,
        checkout_url: session.url,
        source: "api/create-store-checkout-session.js"
      }
    });

    return json(res, 200, {
      ok: true,
      url: session.url,
      checkout_url: session.url,
      checkoutUrl: session.url,
      session_id: session.id,
      sessionId: session.id,
      order_id: order.id,
      orderId: order.id
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error?.message || "Checkout failed"
    });
  }
}
