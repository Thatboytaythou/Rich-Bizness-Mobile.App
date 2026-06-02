import Stripe from "stripe";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const APP_URL =
  process.env.APP_URL ||
  process.env.PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";

const PLATFORM_FEE_BPS = Number(
  process.env.STRIPE_PLATFORM_FEE_BPS || 1000
);

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY)
  : null;

function json(res, status, data) {
  return res.status(status).json(data);
}

function cleanText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}

function encode(value) {
  return encodeURIComponent(String(value || ""));
}

function toCents(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.round(number));
}

function calcFee(amountCents) {
  return Math.max(
    0,
    Math.round((amountCents * PLATFORM_FEE_BPS) / 10000)
  );
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  const raw = await response.text();
  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        data?.hint ||
        `Supabase failed ${response.status}`
    );
  }

  return data;
}

async function getUserFromAuth(req) {
  const authHeader =
    req.headers.authorization ||
    req.headers.Authorization;

  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "").trim();

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) return null;

  return response.json();
}

async function findStream(streamKey) {
  const value = encode(streamKey);

  const rows = await supabaseFetch(
    `/live_streams?or=(id.eq.${value},slug.eq.${value},livekit_room_name.eq.${value})&select=*&limit=1`
  );

  return rows?.[0] || null;
}

async function getProfile(userId) {
  if (!userId) return null;

  const rows = await supabaseFetch(
    `/profiles?id=eq.${encode(userId)}&select=id,username,display_name,full_name,avatar_url,role,is_creator,is_verified&limit=1`
  );

  return rows?.[0] || null;
}

async function existingPaidAccess(streamId, userId) {
  const purchases = await supabaseFetch(
    `/live_stream_purchases?stream_id=eq.${encode(streamId)}&user_id=eq.${encode(userId)}&status=eq.paid&select=*&limit=1`
  );

  if (purchases?.[0]) return purchases[0];

  const vip = await supabaseFetch(
    `/vip_live_access?stream_id=eq.${encode(streamId)}&user_id=eq.${encode(userId)}&access_status=eq.active&select=*&limit=1`
  );

  return vip?.[0] || null;
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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(res, 500, {
        ok: false,
        error: "Missing Supabase server environment variables"
      });
    }

    if (!stripe) {
      return json(res, 500, {
        ok: false,
        error: "Missing Stripe secret key"
      });
    }

    const user = await getUserFromAuth(req);

    if (!user?.id) {
      return json(res, 401, {
        ok: false,
        error: "Sign in required"
      });
    }

    const body = req.body || {};

    const streamKey = cleanText(
      body.stream_id ||
        body.streamId ||
        body.id ||
        body.slug ||
        body.room ||
        body.livekit_room_name
    );

    if (!streamKey) {
      return json(res, 400, {
        ok: false,
        error: "Missing stream_id or slug"
      });
    }

    const stream = await findStream(streamKey);

    if (!stream) {
      return json(res, 404, {
        ok: false,
        error: "Live stream not found"
      });
    }

    if (stream.creator_id === user.id) {
      return json(res, 200, {
        ok: true,
        free_access: true,
        access_reason: "creator",
        stream_id: stream.id
      });
    }

    if (["ended", "cancelled"].includes(stream.status)) {
      return json(res, 409, {
        ok: false,
        error: "This live stream is no longer available"
      });
    }

    const accessType = cleanText(stream.access_type, "free");

    if (accessType === "free") {
      return json(res, 200, {
        ok: true,
        free_access: true,
        access_reason: "free_stream",
        stream_id: stream.id
      });
    }

    const alreadyHasAccess = await existingPaidAccess(
      stream.id,
      user.id
    );

    if (alreadyHasAccess) {
      return json(res, 200, {
        ok: true,
        already_paid: true,
        access: alreadyHasAccess,
        stream_id: stream.id
      });
    }

    const profile = await getProfile(user.id);

    const amountCents = toCents(stream.price_cents, 0);

    if (amountCents <= 0) {
      return json(res, 400, {
        ok: false,
        error: "This stream requires access but has no valid price"
      });
    }

    const currency = cleanText(stream.currency, "usd")
      .toLowerCase()
      .slice(0, 8);

    const platformFeeCents = calcFee(amountCents);
    const creatorAmountCents = Math.max(
      0,
      amountCents - platformFeeCents
    );

    const purchaseRows = await supabaseFetch("/live_stream_purchases", {
      method: "POST",
      body: JSON.stringify({
        stream_id: stream.id,
        user_id: user.id,
        amount_cents: amountCents,
        platform_fee_cents: platformFeeCents,
        creator_amount_cents: creatorAmountCents,
        currency,
        status: "pending",
        metadata: {
          app: "Rich Bizness Mobile",
          source: "api/live-stream-purchase.js",
          access_type: accessType,
          buyer_username: profile?.username || null,
          buyer_display_name:
            profile?.display_name ||
            profile?.full_name ||
            null,
          creator_id: stream.creator_id,
          stream_slug: stream.slug,
          livekit_room_name: stream.livekit_room_name
        }
      })
    });

    const purchase = purchaseRows?.[0];

    if (!purchase?.id) {
      throw new Error("Purchase record was not created.");
    }

    const streamRoute = encode(stream.slug || stream.id);

    const successUrl =
      `${APP_URL}/watch?stream=${streamRoute}` +
      `&purchase=success&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      `${APP_URL}/watch?stream=${streamRoute}&purchase=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.email || undefined,

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountCents,
            product_data: {
              name: stream.title || "Rich Bizness Live Access",
              description:
                stream.description ||
                "Live stream access",
              images:
                stream.thumbnail_url || stream.cover_url
                  ? [stream.thumbnail_url || stream.cover_url]
                  : undefined,
              metadata: {
                stream_id: stream.id,
                creator_id: stream.creator_id,
                access_type: accessType
              }
            }
          }
        }
      ],

      metadata: {
        app: "rich-bizness-mobile",
        type: "live_stream_purchase",
        purchase_id: purchase.id,
        stream_id: stream.id,
        user_id: user.id,
        creator_id: stream.creator_id,
        amount_cents: String(amountCents),
        platform_fee_cents: String(platformFeeCents),
        creator_amount_cents: String(creatorAmountCents)
      },

      payment_intent_data: {
        metadata: {
          app: "rich-bizness-mobile",
          type: "live_stream_purchase",
          purchase_id: purchase.id,
          stream_id: stream.id,
          user_id: user.id,
          creator_id: stream.creator_id
        }
      }
    });

    const updatedPurchaseRows = await supabaseFetch(
      `/live_stream_purchases?id=eq.${encode(purchase.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          stripe_checkout_session_id: session.id,
          stripe_customer_id:
            typeof session.customer === "string"
              ? session.customer
              : null,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(purchase.metadata || {}),
            stripe_checkout_url: session.url,
            stripe_session_status: session.status,
            stripe_payment_status: session.payment_status
          }
        })
      }
    );

    await supabaseFetch("/stripe_sync_events", {
      method: "POST",
      body: JSON.stringify({
        stripe_event_id: session.id,
        stripe_object_id: session.id,
        stripe_object_type: "checkout.session",
        event_type: "live_stream_purchase.created",
        status: "pending",
        related_user_id: user.id,
        related_table: "live_stream_purchases",
        related_id: purchase.id,
        amount_cents: amountCents,
        currency,
        payload: {
          stream_id: stream.id,
          purchase_id: purchase.id,
          checkout_url: session.url,
          source: "api/live-stream-purchase.js"
        }
      })
    });

    return json(res, 200, {
      ok: true,
      checkout_url: session.url,
      url: session.url,
      session_id: session.id,
      purchase_id: purchase.id,
      purchase: updatedPurchaseRows?.[0] || purchase,
      stream_id: stream.id,
      amount_cents: amountCents,
      platform_fee_cents: platformFeeCents,
      creator_amount_cents: creatorAmountCents,
      currency
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error:
        error?.message ||
        "Failed to create live stream purchase"
    });
  }
}
