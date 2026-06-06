/* =========================
   RICH BIZNESS MOBILE
   /core/features/gaming/leaderboard.js

   GAMING LEADERBOARD ENGINE
   Global + game-specific + weekly/monthly ranking
========================= */

import { RB_TABLES } from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  rbSelect
} from "/core/shared/rb-supabase.js";

import {
  formatNumber,
  timeAgo
} from "/core/shared/rb-format.js";

const LEADERBOARD = {
  gameId: null,
  gameSlug: null,
  period: "all",
  limit: 25,
  rows: [],
  myRank: null,
  loading: false,
  channel: null,
  listeners: new Set()
};

function scoresTable() {
  return RB_TABLES.gameScores || RB_TABLES.arcadeScores || "game_scores";
}

function gamesTable() {
  return RB_TABLES.games || "games";
}

function periodStart(period = "all") {
  const now = new Date();

  if (period === "daily") {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }

  if (period === "weekly") {
    now.setDate(now.getDate() - 7);
    return now.toISOString();
  }

  if (period === "monthly") {
    now.setMonth(now.getMonth() - 1);
    return now.toISOString();
  }

  return null;
}

function emitLeaderboard() {
  const snapshot = getLeaderboardState();

  LEADERBOARD.listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn("[RB LEADERBOARD LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-gaming-leaderboard-update", {
      detail: snapshot
    })
  );
}

function normalizeScore(row = {}, index = 0) {
  const profile = row.profiles || row.profile || {};
  const game = row.games || row.game || {};

  return {
    ...row,

    rank: index + 1,

    score: Number(row.score || row.points || row.value || 0),
    points: Number(row.points || row.score || 0),

    game_id: row.game_id || game.id || null,
    game_title:
      row.game_title ||
      game.title ||
      game.name ||
      "Rich Bizness Game",

    username:
      row.username ||
      profile.username ||
      "rich_player",

    display_name:
      row.display_name ||
      profile.display_name ||
      profile.full_name ||
      profile.username ||
      "Rich Player",

    avatar_url:
      row.avatar_url ||
      profile.avatar_url ||
      "/images/brand/Avatar-hero-Banner.png.jpeg",

    rank_label:
      row.rank_label ||
      row.rank ||
      row.level ||
      "Player",

    created_label: timeAgo(row.created_at)
  };
}

function sortRows(rows = []) {
  return [...rows].sort((a, b) => {
    const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
    if (scoreDiff !== 0) return scoreDiff;

    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });
}

function dedupeBestPerUser(rows = []) {
  const best = new Map();

  rows.forEach((row) => {
    const key = row.user_id || row.player_id || row.username || row.id;
    const existing = best.get(key);

    if (!existing || Number(row.score || 0) > Number(existing.score || 0)) {
      best.set(key, row);
    }
  });

  return Array.from(best.values());
}

async function resolveGameId(gameSlug) {
  if (!gameSlug) return null;

  try {
    const game = await rbSelect({
      table: gamesTable(),
      match: { slug: gameSlug },
      maybeSingle: true
    });

    return game?.id || null;
  } catch {
    return null;
  }
}

export function getLeaderboardState() {
  return {
    gameId: LEADERBOARD.gameId,
    gameSlug: LEADERBOARD.gameSlug,
    period: LEADERBOARD.period,
    limit: LEADERBOARD.limit,
    rows: [...LEADERBOARD.rows],
    myRank: LEADERBOARD.myRank,
    loading: LEADERBOARD.loading
  };
}

export function onLeaderboard(listener) {
  if (typeof listener !== "function") return () => {};

  LEADERBOARD.listeners.add(listener);
  listener(getLeaderboardState());

  return () => {
    LEADERBOARD.listeners.delete(listener);
  };
}

export async function loadLeaderboard({
  gameId = LEADERBOARD.gameId,
  gameSlug = LEADERBOARD.gameSlug,
  period = LEADERBOARD.period,
  limit = LEADERBOARD.limit,
  bestPerUser = true
} = {}) {
  const supabase = getSupabase();

  LEADERBOARD.loading = true;
  LEADERBOARD.gameId = gameId || null;
  LEADERBOARD.gameSlug = gameSlug || null;
  LEADERBOARD.period = period || "all";
  LEADERBOARD.limit = Number(limit || 25);

  emitLeaderboard();

  try {
    if (!LEADERBOARD.gameId && LEADERBOARD.gameSlug) {
      LEADERBOARD.gameId = await resolveGameId(LEADERBOARD.gameSlug);
    }

    let query = supabase
      .from(scoresTable())
      .select(`
        *,
        profiles:user_id (
          username,
          display_name,
          full_name,
          avatar_url
        ),
        games:game_id (
          id,
          title,
          name,
          slug
        )
      `)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(Math.max(LEADERBOARD.limit * 4, LEADERBOARD.limit));

    if (LEADERBOARD.gameId) {
      query = query.eq("game_id", LEADERBOARD.gameId);
    }

    const start = periodStart(LEADERBOARD.period);
    if (start) {
      query = query.gte("created_at", start);
    }

    const { data, error } = await query;

    if (error) throw error;

    const sorted = sortRows(data || []);
    const ranked = bestPerUser ? dedupeBestPerUser(sorted) : sorted;

    LEADERBOARD.rows = ranked
      .slice(0, LEADERBOARD.limit)
      .map(normalizeScore);

    LEADERBOARD.myRank = await loadMyLeaderboardRank({
      gameId: LEADERBOARD.gameId,
      period: LEADERBOARD.period,
      rows: ranked
    });
  } catch (error) {
    console.warn("[RB LEADERBOARD LOAD]", error?.message || error);
    LEADERBOARD.rows = [];
    LEADERBOARD.myRank = null;
  } finally {
    LEADERBOARD.loading = false;
    emitLeaderboard();
  }

  return getLeaderboardState();
}

export async function loadMyLeaderboardRank({
  gameId = LEADERBOARD.gameId,
  period = LEADERBOARD.period,
  rows = null
} = {}) {
  const user = getUser?.();

  if (!user?.id) return null;

  let sourceRows = rows;

  if (!sourceRows) {
    const supabase = getSupabase();

    let query = supabase
      .from(scoresTable())
      .select("id,user_id,score,points,created_at")
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(500);

    if (gameId) query = query.eq("game_id", gameId);

    const start = periodStart(period);
    if (start) query = query.gte("created_at", start);

    const { data, error } = await query;

    if (error) {
      console.warn("[RB MY RANK LOAD]", error?.message || error);
      return null;
    }

    sourceRows = dedupeBestPerUser(sortRows(data || []));
  }

  const index = sourceRows.findIndex((row) => row.user_id === user.id);
  if (index < 0) return null;

  const row = normalizeScore(sourceRows[index], index);

  return {
    ...row,
    rank: index + 1
  };
}

export async function loadGameLeaderboard(gameIdOrSlug, options = {}) {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(String(gameIdOrSlug || ""));

  return await loadLeaderboard({
    ...options,
    gameId: isUuid ? gameIdOrSlug : null,
    gameSlug: isUuid ? null : gameIdOrSlug
  });
}

export async function loadGlobalLeaderboard(options = {}) {
  return await loadLeaderboard({
    ...options,
    gameId: null,
    gameSlug: null
  });
}

export function clearLeaderboardRealtime() {
  const supabase = getSupabase();

  if (LEADERBOARD.channel && supabase) {
    supabase.removeChannel(LEADERBOARD.channel);
  }

  LEADERBOARD.channel = null;
}

export function bindLeaderboardRealtime({
  gameId = LEADERBOARD.gameId,
  period = LEADERBOARD.period
} = {}) {
  const supabase = getSupabase();

  clearLeaderboardRealtime();

  LEADERBOARD.channel = supabase
    .channel(`rb-gaming-leaderboard-${gameId || "global"}-${period}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: scoresTable()
      },
      () => loadLeaderboard({
        gameId,
        period,
        limit: LEADERBOARD.limit
      })
    )
    .subscribe();

  return LEADERBOARD.channel;
}

export function renderLeaderboardRows(rows = LEADERBOARD.rows) {
  if (!rows.length) {
    return `
      <article class="rb-mini-empty">
        <strong>No scores yet</strong>
        <span>Play a game to claim the leaderboard.</span>
      </article>
    `;
  }

  return rows
    .map((row) => {
      return `
        <article class="rb-leaderboard-row ${row.rank <= 3 ? "is-top" : ""}">
          <span class="rb-leaderboard-rank">#${row.rank}</span>

          <img
            src="${row.avatar_url}"
            alt=""
            loading="lazy"
          />

          <div>
            <strong>${row.display_name}</strong>
            <small>@${row.username} · ${row.game_title}</small>
          </div>

          <b>${formatNumber(row.score)}</b>
        </article>
      `;
    })
    .join("");
}

export async function initLeaderboard({
  gameId = null,
  gameSlug = null,
  period = "all",
  limit = 25,
  realtime = true
} = {}) {
  LEADERBOARD.gameId = gameId;
  LEADERBOARD.gameSlug = gameSlug;
  LEADERBOARD.period = period;
  LEADERBOARD.limit = limit;

  await loadLeaderboard({
    gameId,
    gameSlug,
    period,
    limit
  });

  if (realtime) {
    bindLeaderboardRealtime({
      gameId: LEADERBOARD.gameId,
      period
    });
  }

  return getLeaderboardState();
}

window.addEventListener("beforeunload", clearLeaderboardRealtime);

console.log("RB GAMING LEADERBOARD READY");
