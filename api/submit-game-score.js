import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

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

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
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
    const score = cleanNumber(body.score);
    const mode = cleanText(body.mode, "arcade");
    const platformType = cleanText(body.platform_type || body.platformType, "web");
    const sessionId = cleanText(body.session_id || body.sessionId);
    const durationSeconds = cleanNumber(body.duration_seconds || body.durationSeconds);
    const result = cleanText(body.result, "");
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("username,display_name,avatar_url,rich_level,rich_points")
      .eq("id", user.id)
      .maybeSingle();

    let gameQuery = supabase
      .from("games")
      .select("id,slug,title,high_score,total_plays")
      .eq("is_active", true);

    if (gameId) {
      gameQuery = gameQuery.eq("id", gameId);
    } else {
      gameQuery = gameQuery.eq("slug", gameSlug);
    }

    const { data: game, error: gameError } = await gameQuery.single();

    if (gameError || !game) {
      return json(res, 404, {
        ok: false,
        error: "Game not found"
      });
    }

    const now = new Date().toISOString();

    const antiCheatStatus =
      score > 999999999 ? "flagged" : "pending";

    const { data: scoreRow, error: scoreError } = await supabase
      .from("game_scores")
      .insert({
        game_id: game.id,
        game_slug: game.slug,
        user_id: user.id,
        username: profile?.username || null,
        display_name:
          profile?.display_name ||
          profile?.username ||
          user.email?.split("@")[0] ||
          null,
        score,
        mode,
        platform_type: platformType,
        is_verified: false,
        anti_cheat_status: antiCheatStatus,
        metadata: {
          ...metadata,
          app: "Rich Bizness Mobile",
          source: "api/submit-game-score.js",
          duration_seconds: durationSeconds,
          result: result || null,
          avatar_url: profile?.avatar_url || null
        }
      })
      .select("id,score,created_at")
      .single();

    if (scoreError || !scoreRow) {
      return json(res, 500, {
        ok: false,
        error: scoreError?.message || "Failed to save score"
      });
    }

    if (sessionId) {
      await supabase
        .from("game_sessions")
        .update({
          ended_at: now,
          duration_seconds: durationSeconds,
          result: result || null,
          score,
          metadata: {
            ...metadata,
            score_id: scoreRow.id,
            source: "api/submit-game-score.js"
          },
          updated_at: now
        })
        .eq("id", sessionId)
        .eq("user_id", user.id);
    } else {
      await supabase.from("game_sessions").insert({
        game_id: game.id,
        game_slug: game.slug,
        user_id: user.id,
        username: profile?.username || null,
        display_name:
          profile?.display_name ||
          profile?.username ||
          user.email?.split("@")[0] ||
          null,
        started_at: now,
        ended_at: now,
        duration_seconds: durationSeconds,
        result: result || null,
        score,
        platform_type: platformType,
        metadata: {
          ...metadata,
          score_id: scoreRow.id,
          source: "api/submit-game-score.js"
        }
      });
    }

    const newHighScore = Math.max(
      Number(game.high_score || 0),
      score
    );

    await supabase
      .from("games")
      .update({
        high_score: newHighScore,
        total_plays: Number(game.total_plays || 0) + 1,
        updated_at: now
      })
      .eq("id", game.id);

    await supabase.from("gamer_profiles").upsert(
      {
        user_id: user.id,
        username: profile?.username || null,
        display_name:
          profile?.display_name ||
          profile?.username ||
          user.email?.split("@")[0] ||
          null,
        avatar_url: profile?.avatar_url || null,
        last_game_id: game.id,
        last_game_slug: game.slug,
        last_score: score,
        updated_at: now,
        metadata: {
          source: "api/submit-game-score.js",
          last_game_title: game.title
        }
      },
      { onConflict: "user_id" }
    );

    await insertQuiet("user_xp_ledger", {
      user_id: user.id,
      xp_amount: Math.max(1, Math.floor(score / 100)),
      source_table: "game_scores",
      source_id: scoreRow.id,
      reason: "game_score_submitted",
      metadata: {
        game_id: game.id,
        game_slug: game.slug,
        score,
        source: "api/submit-game-score.js"
      }
    });

    await insertQuiet("platform_analytics_events", {
      user_id: user.id,
      event_name: "game_score_submitted",
      section: "gaming",
      target_table: "game_scores",
      target_id: scoreRow.id,
      value_cents: 0,
      metadata: {
        game_id: game.id,
        game_slug: game.slug,
        score,
        mode,
        platform_type: platformType,
        source: "api/submit-game-score.js"
      }
    });

    return json(res, 200, {
      ok: true,
      score_id: scoreRow.id,
      score,
      game_id: game.id,
      game_slug: game.slug,
      high_score: newHighScore,
      anti_cheat_status: antiCheatStatus
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error?.message || "Score submit failed"
    });
  }
}
