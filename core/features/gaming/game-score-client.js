/* =========================
   RICH BIZNESS MOBILE
   /core/features/gaming/game-score-client.js

   GAME SCORE CLIENT
   Leaderboards + personal scores + best score sync
   Challenge/session compatible
========================= */

import { RB_TABLES, RB_ROUTES } from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  rbInsert,
  rbUpdate,
  rbSelect
} from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity
} from "/core/shared/rb-profile.js";

import {
  runRichAction
} from "/core/shared/rb-action-engine.js";

const SCORE = {
  user: null,
  profile: null,

  leaderboard: [],
  myScores: [],
  bestScore: null,
  latestScore: null,

  leaderboardChannel: null,
  myScoreChannel: null,

  listeners: new Set()
};

function tableScores() {
  return RB_TABLES.gameScores || "game_scores";
}

function tableSessions() {
  return RB_TABLES.gameSessions || RB_TABLES.gamingSessions || "game_sessions";
}

function tableGames() {
  return RB_TABLES.games || "games";
}

function nowIso() {
  return new Date().toISOString();
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function gameUrl(gameId = null) {
  const base = RB_ROUTES.gaming || "/gaming";

  return gameId
    ? `${base}?game=${encodeURIComponent(gameId)}`
    : base;
}

function resolveIdentity() {
  SCORE.user = getUser?.() || SCORE.user || null;
  SCORE.profile = getProfileIdentity?.() || SCORE.profile || null;

  return {
    user: SCORE.user,
    profile: SCORE.profile
  };
}

function normalizeScore(row = {}) {
  const profile = row.profiles || row.profile || null;

  return {
    ...row,

    score: safeNumber(row.score ?? row.points, 0),
    points: safeNumber(row.points ?? row.score, 0),

    username:
      row.username ||
      profile?.username ||
      "rich_gamer",

    display_name:
      row.display_name ||
      profile?.display_name ||
      profile?.full_name ||
      profile?.username ||
      "Rich Gamer",

    avatar_url:
      row.avatar_url ||
      profile?.avatar_url ||
      "/images/brand/Avatar-hero-Banner.png.jpeg"
  };
}

function emitScoreState() {
  const snapshot = getGameScoreState();

  SCORE.listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn("[RB GAME SCORE LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-game-score-update", {
      detail: snapshot
    })
  );
}

function sortScores(rows = []) {
  return [...rows].sort((a, b) => {
    const scoreDiff = safeNumber(b.score) - safeNumber(a.score);
    if (scoreDiff !== 0) return scoreDiff;

    const aTime = new Date(a.created_at || 0).getTime();
    const bTime = new Date(b.created_at || 0).getTime();

    return bTime - aTime;
  });
}

function applyRanks(rows = []) {
  return rows.map((item, index) => ({
    ...item,
    leaderboard_rank: index + 1
  }));
}

export function getGameScoreState() {
  return {
    user: SCORE.user,
    profile: SCORE.profile,

    leaderboard: [...SCORE.leaderboard],
    myScores: [...SCORE.myScores],
    bestScore: SCORE.bestScore,
    latestScore: SCORE.latestScore
  };
}

export function onGameScoreState(listener) {
  if (typeof listener !== "function") return () => {};

  SCORE.listeners.add(listener);
  listener(getGameScoreState());

  return () => {
    SCORE.listeners.delete(listener);
  };
}

export async function loadLeaderboard({
  gameId = null,
  challengeId = null,
  limit = 50
} = {}) {
  const supabase = getSupabase();

  let query = supabase
    .from(tableScores())
    .select(`
      *,
      profiles:user_id (
        username,
        display_name,
        full_name,
        avatar_url
      )
    `)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (gameId) {
    query = query.eq("game_id", gameId);
  }

  if (challengeId) {
    query = query.eq("challenge_id", challengeId);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[RB GAME LEADERBOARD LOAD]", error?.message || error);
    SCORE.leaderboard = [];
    emitScoreState();
    return [];
  }

  SCORE.leaderboard = applyRanks(
    sortScores((data || []).map(normalizeScore))
  );

  emitScoreState();

  return SCORE.leaderboard;
}

export async function loadMyScores({
  userId = null,
  gameId = null,
  challengeId = null,
  limit = 50
} = {}) {
  resolveIdentity();

  const id = userId || SCORE.user?.id;

  if (!id) {
    SCORE.myScores = [];
    SCORE.bestScore = null;
    SCORE.latestScore = null;
    emitScoreState();
    return [];
  }

  const supabase = getSupabase();

  let query = supabase
    .from(tableScores())
    .select("*")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (gameId) {
    query = query.eq("game_id", gameId);
  }

  if (challengeId) {
    query = query.eq("challenge_id", challengeId);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[RB MY GAME SCORES LOAD]", error?.message || error);
    SCORE.myScores = [];
    SCORE.bestScore = null;
    SCORE.latestScore = null;
    emitScoreState();
    return [];
  }

  SCORE.myScores = (data || []).map(normalizeScore);
  SCORE.latestScore = SCORE.myScores[0] || null;
  SCORE.bestScore = sortScores(SCORE.myScores)[0] || null;

  emitScoreState();

  return SCORE.myScores;
}

export async function loadBestScore({
  userId = null,
  gameId = null
} = {}) {
  resolveIdentity();

  const id = userId || SCORE.user?.id;
  if (!id) return null;

  const supabase = getSupabase();

  let query = supabase
    .from(tableScores())
    .select("*")
    .eq("user_id", id)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (gameId) {
    query = query.eq("game_id", gameId);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[RB BEST GAME SCORE LOAD]", error?.message || error);
    return null;
  }

  SCORE.bestScore = data ? normalizeScore(data) : null;
  emitScoreState();

  return SCORE.bestScore;
}

async function touchGameStats({
  gameId,
  score,
  userId
} = {}) {
  if (!gameId) return null;

  try {
    const game = await rbSelect({
      table: tableGames(),
      match: { id: gameId },
      maybeSingle: true
    });

    const playCount = Number(game?.play_count || 0) + 1;
    const currentHigh = Number(game?.high_score || 0);
    const nextHigh = Math.max(currentHigh, safeNumber(score, 0));

    const rows = await rbUpdate({
      table: tableGames(),
      match: { id: gameId },
      values: {
        play_count: playCount,
        high_score: nextHigh,
        high_score_user_id:
          nextHigh > currentHigh
            ? userId || null
            : game?.high_score_user_id || null,
        last_played_at: nowIso(),
        updated_at: nowIso()
      }
    });

    return rows?.[0] || null;
  } catch (error) {
    console.warn("[RB GAME STATS UPDATE SKIPPED]", error?.message || error);
    return null;
  }
}

async function touchSessionScore({
  sessionId,
  scoreId,
  score
} = {}) {
  if (!sessionId) return null;

  try {
    const rows = await rbUpdate({
      table: tableSessions(),
      match: { id: sessionId },
      values: {
        final_score: safeNumber(score, 0),
        score_id: scoreId || null,
        updated_at: nowIso()
      }
    });

    return rows?.[0] || null;
  } catch (error) {
    console.warn("[RB SESSION SCORE UPDATE SKIPPED]", error?.message || error);
    return null;
  }
}

export async function submitGameScore({
  gameId,
  sessionId = null,
  challengeId = null,
  score = 0,
  points = null,
  level = null,
  rank = null,
  durationSeconds = 0,
  accuracy = null,
  combo = null,
  metadata = {}
} = {}) {
  resolveIdentity();

  if (!SCORE.user?.id) {
    throw new Error("Sign in before submitting a score.");
  }

  if (!gameId) {
    throw new Error("Missing game id.");
  }

  const finalScore = safeNumber(score, 0);
  const finalPoints = points === null
    ? finalScore
    : safeNumber(points, finalScore);

  const identity = SCORE.profile || {};

  const payload = {
    game_id: gameId,
    session_id: sessionId,
    challenge_id: challengeId,

    user_id: SCORE.user.id,
    username:
      identity.username ||
      SCORE.user.email?.split("@")?.[0] ||
      "rich_gamer",
    display_name:
      identity.display_name ||
      identity.username ||
      "Rich Gamer",
    avatar_url: identity.avatar_url || null,

    score: finalScore,
    points: finalPoints,
    level,
    rank,

    duration_seconds: Number(durationSeconds || 0),
    accuracy,
    combo,

    metadata: {
      source: "game-score-client.js",
      ...metadata
    }
  };

  const rows = await rbInsert({
    table: tableScores(),
    values: payload
  });

  const scoreRow = rows?.[0] ? normalizeScore(rows[0]) : null;

  if (scoreRow?.id) {
    await Promise.all([
      touchGameStats({
        gameId,
        score: finalScore,
        userId: SCORE.user.id
      }),

      touchSessionScore({
        sessionId,
        scoreId: scoreRow.id,
        score: finalScore
      })
    ]);

    await runRichAction({
      action: "game_score_submitted",
      section: "gaming",
      actorId: SCORE.user.id,
      targetTable: tableScores(),
      targetType: "game_score",
      targetId: scoreRow.id,
      targetUrl: gameUrl(gameId),
      title: "Game score submitted",
      body: `${payload.display_name} scored ${finalScore}`,
      emoji: "🏆",
      metadata: {
        game_id: gameId,
        session_id: sessionId,
        challenge_id: challengeId,
        score: finalScore,
        points: finalPoints,
        source: "game-score-client.js"
      }
    });
  }

  SCORE.latestScore = scoreRow;

  await Promise.all([
    loadLeaderboard({ gameId }),
    loadMyScores({ gameId })
  ]);

  return scoreRow;
}

export async function deleteMyScore(scoreId) {
  resolveIdentity();

  if (!SCORE.user?.id) {
    throw new Error("Sign in before deleting a score.");
  }

  if (!scoreId) {
    throw new Error("Missing score id.");
  }

  const supabase = getSupabase();

  const { error } = await supabase
    .from(tableScores())
    .delete()
    .eq("id", scoreId)
    .eq("user_id", SCORE.user.id);

  if (error) throw error;

  await Promise.all([
    loadLeaderboard(),
    loadMyScores()
  ]);

  return true;
}

export async function getScoreRank({
  score,
  gameId = null,
  challengeId = null
} = {}) {
  const value = safeNumber(score, 0);
  const supabase = getSupabase();

  let query = supabase
    .from(tableScores())
    .select("id", {
      count: "exact",
      head: true
    })
    .gt("score", value);

  if (gameId) {
    query = query.eq("game_id", gameId);
  }

  if (challengeId) {
    query = query.eq("challenge_id", challengeId);
  }

  const { count, error } = await query;

  if (error) {
    console.warn("[RB SCORE RANK]", error?.message || error);
    return null;
  }

  return Number(count || 0) + 1;
}

export async function refreshGameScoreClient({
  gameId = null,
  challengeId = null
} = {}) {
  await Promise.all([
    loadLeaderboard({ gameId, challengeId }),
    loadMyScores({ gameId, challengeId })
  ]);

  return getGameScoreState();
}

export function clearGameScoreRealtime() {
  const supabase = getSupabase();

  if (SCORE.leaderboardChannel && supabase) {
    supabase.removeChannel(SCORE.leaderboardChannel);
  }

  if (SCORE.myScoreChannel && supabase) {
    supabase.removeChannel(SCORE.myScoreChannel);
  }

  SCORE.leaderboardChannel = null;
  SCORE.myScoreChannel = null;
}

export function bindGameScoreRealtime({
  userId = SCORE.user?.id,
  gameId = null,
  challengeId = null
} = {}) {
  const supabase = getSupabase();
  if (!supabase) return null;

  clearGameScoreRealtime();

  SCORE.leaderboardChannel = supabase
    .channel(`rb-game-score-board-${gameId || challengeId || "global"}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: tableScores()
      },
      () => refreshGameScoreClient({ gameId, challengeId })
    )
    .subscribe();

  if (userId) {
    SCORE.myScoreChannel = supabase
      .channel(`rb-game-score-user-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableScores(),
          filter: `user_id=eq.${userId}`
        },
        () => loadMyScores({ userId, gameId, challengeId })
      )
      .subscribe();
  }

  return {
    leaderboardChannel: SCORE.leaderboardChannel,
    myScoreChannel: SCORE.myScoreChannel
  };
}

export async function initGameScoreClient({
  user = null,
  profile = null,
  gameId = null,
  challengeId = null,
  realtime = true
} = {}) {
  SCORE.user = user || getUser?.() || null;
  SCORE.profile = profile || getProfileIdentity?.() || null;

  await refreshGameScoreClient({
    gameId,
    challengeId
  });

  if (realtime) {
    bindGameScoreRealtime({
      userId: SCORE.user?.id || null,
      gameId,
      challengeId
    });
  }

  return getGameScoreState();
}

window.addEventListener("beforeunload", clearGameScoreRealtime);

console.log("RB GAME SCORE CLIENT READY", {
  scores: tableScores(),
  sessions: tableSessions(),
  games: tableGames()
});
