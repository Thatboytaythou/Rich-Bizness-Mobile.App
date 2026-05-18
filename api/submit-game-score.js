import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
      score,
      mode = "arcade",
      platform_type = "web",
      session_id,
      duration_seconds = 0,
      result,
      metadata = {}
    } = req.body || {};

    const cleanScore = Math.max(0, Number(score) || 0);

    if (!game_id && !game_slug) {
      return json(res, 400, { error: "Missing game_id or game_slug" });
    }

    if (!Number.isFinite(cleanScore)) {
      return json(res, 400, { error: "Invalid score" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("username,display_name")
      .eq("id", user.id)
      .maybeSingle();

    let gameQuery = supabase
      .from("games")
      .select("id,slug,title,high_score,total_plays")
      .eq("is_active", true);

    if (game_id) {
      gameQuery = gameQuery.eq("id", game_id);
    } else {
      gameQuery = gameQuery.eq("slug", game_slug);
    }

    const { data: game, error: gameError } = await gameQuery.single();

    if (gameError || !game) {
      return json(res, 404, { error: "Game not found" });
    }

    const { data: scoreRow, error: scoreError } = await supabase
      .from("game_scores")
      .insert({
        game_id: game.id,
        game_slug: game.slug,
        user_id: user.id,
        username: profile?.username || null,
        display_name: profile?.display_name || profile?.username || null,
        score: cleanScore,
        mode,
        platform_type,
        is_verified: false,
        anti_cheat_status: "pending",
        metadata: {
          ...metadata,
          source: "submit-game-score"
        }
      })
      .select("id,score,created_at")
      .single();

    if (scoreError || !scoreRow) {
      return json(res, 500, { error: scoreError?.message || "Failed to save score" });
    }

    if (session_id) {
      await supabase
        .from("game_sessions")
        .update({
          ended_at: new Date().toISOString(),
          duration_seconds: Math.max(0, Number(duration_seconds) || 0),
          result: result || null,
          score: cleanScore,
          metadata: {
            ...metadata,
            score_id: scoreRow.id,
            source: "submit-game-score"
          }
        })
        .eq("id", session_id)
        .eq("user_id", user.id);
    } else {
      await supabase.from("game_sessions").insert({
        game_id: game.id,
        game_slug: game.slug,
        user_id: user.id,
        username: profile?.username || null,
        display_name: profile?.display_name || profile?.username || null,
        ended_at: new Date().toISOString(),
        duration_seconds: Math.max(0, Number(duration_seconds) || 0),
        result: result || null,
        score: cleanScore,
        platform_type,
        metadata: {
          ...metadata,
          score_id: scoreRow.id,
          source: "submit-game-score"
        }
      });
    }

    const newHighScore = Math.max(Number(game.high_score || 0), cleanScore);

    await supabase
      .from("games")
      .update({
        high_score: newHighScore,
        total_plays: Number(game.total_plays || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", game.id);

    await supabase.from("platform_analytics_events").insert({
      user_id: user.id,
      event_name: "game_score_submitted",
      section: "gaming",
      target_table: "game_scores",
      target_id: scoreRow.id,
      value_cents: 0,
      metadata: {
        game_id: game.id,
        game_slug: game.slug,
        score: cleanScore,
        mode,
        platform_type
      }
    });

    return json(res, 200, {
      ok: true,
      score_id: scoreRow.id,
      score: cleanScore,
      game_id: game.id,
      game_slug: game.slug,
      high_score: newHighScore
    });
  } catch (error) {
    console.error("SUBMIT GAME SCORE ERROR:", error);
    return json(res, 500, { error: error.message || "Score submit failed" });
  }
}
