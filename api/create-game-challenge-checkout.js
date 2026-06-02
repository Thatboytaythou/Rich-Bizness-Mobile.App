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

function cleanAmount(value) {
  const amount = Math.floor(Number(value) || 0);
  return Math.max(0, amount);
}

function calcFee(amountCents) {
  return Math.max(
    0,
    Math.round((amountCents * PLATFORM_FEE_BPS) / 10000)
  );
}

async function insertQuiet(table, payload) {
  try {
    await supabase.from(table).insert(payload);
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

    const gameId = cleanText(body.game_id || body.gameId);
    const gameSlug = cleanText(body.game_slug || body.gameSlug);
    const opponentId = cleanText(body.opponent_id || body.opponentId, null);
    const title = cleanText(body.title);
    const wagerCents = cleanAmount(body.wager_cents || body.wagerCents);
    const currency = cleanText(body.currency, "usd").toLowerCase().slice(0, 8);

    const metadata =
      body.metadata && typeof body.metadata === "object"
        ? body.metadata
        : {};

    if (!gameId && !gameSlug) {
      return json(res, 400, {
        ok: false,
        error: "Missing game_id or game_slug"
      });
    }

    if (!title || title.length < 2) {
      return json(res, 400, {
        ok: false,
        error: "Missing challenge title"
      });
    }

    if (wagerCents < 100) {
      return json(res, 400, {
        ok: false,
        error: "Minimum wager is $1.00"
      });
    }

    let gameQuery = supabase
      .from("games")
      .select("id,slug,title,is_cash_enabled,is_active")
      .eq("is_active", true)
      .eq("is_cash_enabled", true);

    if (gameId) {
      gameQuery = gameQuery.eq("id", gameId);
    } else {
      gameQuery = gameQuery.eq("slug", gameSlug);
    }

    const { data: game, error: gameError } = await gameQuery.single();

    if (gameError || !game) {
      return json(res, 404, {
        ok: false,
        error: "Cash-enabled game not found"
      });
    }

    if (opponentId && opponentId === user.id) {
      return json(res, 400, {
        ok: false,
        error: "You cannot challenge yourself"
      });
    }

    const platformFeeCents = calcFee(wagerCents);
    const winnerAmountCents = Math.max(
      0,
      wagerCents - platformFeeCents
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("username,display_name,avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    const now = new Date().toISOString();

    const { data: challenge, error: challengeError } = await supabase
      .from("game_challenges")
      .insert({
        game_id: game.id,
        game_slug: game.slug,
        creator_id: user.id,
        opponent_id: opponentId,
        title,
        wager_cents: wagerCents,
        currency,
        status: "pending",
        payment_status: "pending",
        platform_fee_cents: platformFeeCents,
        winner_amount_cents: winnerAmountCents,
        trust_status: "pending",
        metadata: {
          ...metadata,
          app: "Rich Bizness Mobile",
          creator_username: profile?.username || null,
          creator_display_name:
            profile?.display_name ||
            profile?.username ||
            user.email?.split("@")[0] ||
            null,
          creator_avatar_url: profile?.avatar_url || null,
          platform_fee_bps: PLATFORM_FEE_BPS,
          source: "api/create-game-challenge-checkout.js"
        },
        created_at: now,
        updated_at: now
      })
      .select("*")
      .single();

    if (challengeError || !challenge) {
      return json(res, 500, {
        ok: false,
        error:
          challengeError?.message ||
          "Failed to create challenge"
      });
    }

    const successUrl =
      cleanText(body.success_url || body.successUrl) ||
      `${APP_URL}/gaming.html?challenge=${challenge.id}&checkout=success&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      cleanText(body.cancel_url || body.cancelUrl) ||
      `${APP_URL}/gaming.html?challenge=${challenge.id}&checkout=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: user.email || undefined,

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: wagerCents,
            product_data: {
              name: `Game Challenge: ${challenge.title}`,
              description: `${game.title} wager challenge`,
              metadata: {
                game_id: game.id,
                game_slug: game.slug,
                challenge_id: challenge.id
              }
            }
          }
        }
      ],

      metadata: {
        app: "rich-bizness-mobile",
        type: "game_challenge",
        challenge_id: challenge.id,
        game_id: game.id,
        game_slug: game.slug,
        creator_id: user.id,
        opponent_id: opponentId || "",
        wager_cents: String(wagerCents),
        platform_fee_cents: String(platformFeeCents),
        winner_amount_cents: String(winnerAmountCents)
      },

      payment_intent_data: {
        metadata: {
          app: "rich-bizness-mobile",
          type: "game_challenge",
          challenge_id: challenge.id,
          game_id: game.id,
          game_slug: game.slug,
          creator_id: user.id,
          opponent_id: opponentId || ""
        }
      }
    });

    await supabase
      .from("game_challenges")
      .update({
        stripe_checkout_session_id: session.id,
        metadata: {
          ...(challenge.metadata || {}),
          stripe_checkout_session_id: session.id,
          stripe_checkout_url: session.url,
          stripe_session_status: session.status,
          stripe_payment_status: session.payment_status,
          source: "api/create-game-challenge-checkout.js"
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", challenge.id);

    await insertQuiet("game_rewards", {
      game_id: game.id,
      game_slug: game.slug,
      challenge_id: challenge.id,
      user_id: user.id,
      reward_type: "challenge_wager",
      amount_cents: winnerAmountCents,
      currency,
      status: "pending",
      metadata: {
        source: "api/create-game-challenge-checkout.js",
        wager_cents: wagerCents,
        platform_fee_cents: platformFeeCents
      }
    });

    await insertQuiet("stripe_sync_events", {
      stripe_event_id: session.id,
      stripe_object_id: session.id,
      stripe_object_type: "checkout.session",
      event_type: "game_challenge.checkout.created",
      status: "pending",
      related_user_id: user.id,
      related_table: "game_challenges",
      related_id: challenge.id,
      amount_cents: wagerCents,
      currency,
      payload: {
        checkout_url: session.url,
        challenge_id: challenge.id,
        game_id: game.id,
        game_slug: game.slug,
        source: "api/create-game-challenge-checkout.js"
      }
    });

    return json(res, 200, {
      ok: true,
      url: session.url,
      checkout_url: session.url,
      session_id: session.id,
      challenge_id: challenge.id,
      game_id: game.id,
      game_slug: game.slug,
      wager_cents: wagerCents,
      platform_fee_cents: platformFeeCents,
      winner_amount_cents: winnerAmountCents,
      currency
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error:
        error?.message ||
        "Game challenge checkout failed"
    });
  }
}
