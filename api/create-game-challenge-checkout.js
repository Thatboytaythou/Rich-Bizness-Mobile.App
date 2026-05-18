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
  "http://localhost:3000";

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
      game_id,
      game_slug,
      opponent_id = null,
      title,
      wager_cents,
      currency = "usd",
      success_url,
      cancel_url,
      metadata = {}
    } = req.body || {};

    const cleanWager = Math.max(0, Number(wager_cents) || 0);

    if (!game_id && !game_slug) {
      return json(res, 400, { error: "Missing game_id or game_slug" });
    }

    if (!title || title.trim().length < 2) {
      return json(res, 400, { error: "Missing challenge title" });
    }

    if (cleanWager < 100) {
      return json(res, 400, { error: "Minimum wager is $1.00" });
    }

    let gameQuery = supabase
      .from("games")
      .select("id,slug,title,is_cash_enabled,is_active")
      .eq("is_active", true)
      .eq("is_cash_enabled", true);

    if (game_id) {
      gameQuery = gameQuery.eq("id", game_id);
    } else {
      gameQuery = gameQuery.eq("slug", game_slug);
    }

    const { data: game, error: gameError } = await gameQuery.single();

    if (gameError || !game) {
      return json(res, 404, { error: "Cash-enabled game not found" });
    }

    const platformFeeBps = Number(process.env.STRIPE_PLATFORM_FEE_BPS || 1000);
    const platformFeeCents = Math.round(cleanWager * (platformFeeBps / 10000));
    const winnerAmountCents = Math.max(0, cleanWager - platformFeeCents);

    const { data: profile } = await supabase
      .from("profiles")
      .select("username,display_name")
      .eq("id", user.id)
      .maybeSingle();

    const { data: challenge, error: challengeError } = await supabase
      .from("game_challenges")
      .insert({
        game_id: game.id,
        game_slug: game.slug,
        creator_id: user.id,
        opponent_id,
        title: title.trim(),
        wager_cents: cleanWager,
        currency,
        status: "pending",
        platform_fee_cents: platformFeeCents,
        winner_amount_cents: winnerAmountCents,
        trust_status: "pending",
        metadata: {
          ...metadata,
          creator_username: profile?.username || null,
          creator_display_name: profile?.display_name || profile?.username || null,
          source: "create-game-challenge-checkout"
        }
      })
      .select("id,title,wager_cents,currency")
      .single();

    if (challengeError || !challenge) {
      return json(res, 500, {
        error: challengeError?.message || "Failed to create challenge"
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      success_url:
        success_url ||
        `${APP_URL}/gaming.html?challenge=${challenge.id}&checkout=success`,
      cancel_url:
        cancel_url ||
        `${APP_URL}/gaming.html?challenge=${challenge.id}&checkout=cancelled`,
      customer_email: user.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: cleanWager,
            product_data: {
              name: `Game Challenge: ${challenge.title}`,
              description: `${game.title} wager challenge`
            }
          }
        }
      ],
      metadata: {
        type: "game_challenge",
        challenge_id: challenge.id,
        game_id: game.id,
        game_slug: game.slug,
        creator_id: user.id,
        opponent_id: opponent_id || "",
        wager_cents: String(cleanWager),
        platform_fee_cents: String(platformFeeCents),
        winner_amount_cents: String(winnerAmountCents)
      }
    });

    await supabase
      .from("game_challenges")
      .update({
        metadata: {
          ...metadata,
          stripe_checkout_session_id: session.id,
          platform_fee_bps: platformFeeBps,
          platform_fee_cents: platformFeeCents,
          winner_amount_cents: winnerAmountCents,
          source: "create-game-challenge-checkout"
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", challenge.id);

    await supabase.from("stripe_sync_events").insert({
      stripe_object_id: session.id,
      stripe_object_type: "checkout.session",
      event_type: "game_challenge.checkout.created",
      status: "pending",
      related_user_id: user.id,
      related_table: "game_challenges",
      related_id: challenge.id,
      amount_cents: cleanWager,
      currency,
      payload: {
        checkout_url: session.url,
        challenge_id: challenge.id,
        game_id: game.id,
        game_slug: game.slug
      }
    });

    return json(res, 200, {
      ok: true,
      url: session.url,
      session_id: session.id,
      challenge_id: challenge.id
    });
  } catch (error) {
    console.error("GAME CHALLENGE CHECKOUT ERROR:", error);
    return json(res, 500, {
      error: error.message || "Game challenge checkout failed"
    });
  }
}
