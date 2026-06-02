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

const PLATFORM_FEE_BPS = Number(
  process.env.STRIPE_PLATFORM_FEE_BPS || 1000
);

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-04-30.basil"
    })
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

function cleanInt(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function calcFee(amountCents) {
  return Math.max(
    0,
    Math.round((amountCents * PLATFORM_FEE_BPS) / 10000)
  );
}

function absoluteUrl(path = "/") {
  if (String(path).startsWith("http")) return path;
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function getUserFromAuth(req) {
  const authHeader =
    req.headers.authorization ||
    req.headers.Authorization;

  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "").trim();

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

    const user = await getUserFromAuth(req);
    const body = req.body || {};

    if (
      body.type === "live_stream" ||
      body.stream_id ||
      body.streamId
    ) {
      return json(res, 400, {
        ok: false,
        error: "Use /api/live-stream-purchase.js for live stream checkout"
      });
    }

    const productId = cleanText(
      body.productId ||
        body.product_id
    );

    const quantity = cleanInt(body.quantity, 1);

    const buyerId =
      cleanText(body.buyerId || body.buyer_id) ||
      user?.id ||
      null;

    const successPath = cleanText(
      body.successPath || body.success_path,
      "/store.html?success=1"
    );

    const cancelPath = cleanText(
      body.cancelPath || body.cancel_path,
      "/store.html?cancel=1"
    );

    if (!productId) {
      return json(res, 400, {
        ok: false,
        error: "Missing productId"
      });
    }

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
      return json(res, 404, {
        ok: false,
        error: "Product not found"
      });
    }

    if (product.status !== "active") {
      return json(res, 400, {
        ok: false,
        error: "Product inactive"
      });
    }

    if (!product.is_public) {
      return json(res, 403, {
        ok: false,
        error: "Private product"
      });
    }

    if (
      product.inventory_count !== null &&
      product.inventory_count >= 0 &&
      quantity > product.inventory_count
    ) {
      return json(res, 400, {
        ok: false,
        error: "Not enough inventory"
      });
    }

    const amountTotal =
      Number(product.price_cents || 0) * quantity;

    if (amountTotal <= 0) {
      return json(res, 400, {
        ok: false,
        error: "Invalid price"
      });
    }

    const platformFeeCents = calcFee(amountTotal);
    const sellerAmountCents = Math.max(
      0,
      amountTotal - platformFeeCents
    );

    const currency = cleanText(product.currency, "usd")
      .toLowerCase()
      .slice(0, 8);

    const sellerStripe =
      product.seller_profile?.stripe_account_id || null;

    const canTransfer =
      sellerStripe &&
      product.seller_profile?.payouts_enabled !== false &&
      product.seller_profile?.stripe_onboarding_complete !== false;

    const { data: order, error: orderError } = await supabase
      .from("store_orders")
      .insert({
        buyer_id: buyerId,
        seller_id: product.seller_id,
        product_id: product.id,
        product_name: product.title,
        quantity,
        amount_total: amountTotal,
        platform_fee_cents: platformFeeCents,
        seller_amount_cents: sellerAmountCents,
        currency,
        payment_status: "pending",
        order_status: "processing",
        fulfillment_type:
          product.fulfillment_type ||
          (product.is_digital ? "digital" : "shipping"),
        customer_email: user?.email || null,
        metadata: {
          source: "api/create-checkout-session.js",
          app: "Rich Bizness Mobile",
          product_type: product.product_type,
          checkout_origin: "store",
          seller_stripe_connected: !!sellerStripe,
          transfer_enabled: !!canTransfer
        }
      })
      .select("*")
      .single();

    if (orderError) {
      return json(res, 500, {
        ok: false,
        error: orderError.message || "Failed creating order"
      });
    }

    const sessionPayload = {
      mode: "payment",
      payment_method_types: ["card"],

      line_items: [
        {
          quantity,
          price_data: {
            currency,
            unit_amount: product.price_cents,
            product_data: {
              name: product.title,
              description:
                product.description ||
                "Rich Bizness Product",
              images: product.image_url
                ? [product.image_url]
                : undefined,
              metadata: {
                product_id: product.id,
                seller_id: product.seller_id || "",
                product_type: product.product_type || "physical"
              }
            }
          }
        }
      ],

      success_url:
        `${absoluteUrl(successPath)}` +
        `${successPath.includes("?") ? "&" : "?"}` +
        `session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: absoluteUrl(cancelPath),

      customer_email: user?.email || undefined,

      metadata: {
        app: "rich-bizness-mobile",
        type: "store_order",
        order_id: order.id,
        product_id: product.id,
        buyer_id: buyerId || "",
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
          buyer_id: buyerId || "",
          seller_id: product.seller_id || ""
        }
      }
    };

    if (canTransfer) {
      sessionPayload.payment_intent_data.application_fee_amount =
        platformFeeCents;

      sessionPayload.payment_intent_data.transfer_data = {
        destination: sellerStripe
      };
    }

    const session =
      await stripe.checkout.sessions.create(sessionPayload);

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
          stripe_checkout_url: session.url,
          stripe_session_status: session.status,
          stripe_payment_status: session.payment_status
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
      related_user_id: buyerId,
      related_table: "store_orders",
      related_id: order.id,
      amount_cents: amountTotal,
      currency,
      payload: {
        order_id: order.id,
        product_id: product.id,
        checkout_url: session.url,
        source: "api/create-checkout-session.js"
      }
    });

    return json(res, 200, {
      ok: true,
      success: true,
      checkoutUrl: session.url,
      checkout_url: session.url,
      url: session.url,
      sessionId: session.id,
      session_id: session.id,
      orderId: order.id,
      order_id: order.id,
      product: {
        id: product.id,
        title: product.title,
        price_cents: product.price_cents,
        currency
      }
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error?.message || "Checkout failed"
    });
  }
}
