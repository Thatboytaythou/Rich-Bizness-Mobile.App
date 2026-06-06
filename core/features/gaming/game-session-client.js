/* =========================
   RICH BIZNESS MOBILE
   /core/features/gaming/game-session-client.js

   GAME SESSION CLIENT
   Start / pause / resume / end sessions
   Score + XP + analytics + realtime sync
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

const SESSION = {
  user: null,
  profile: null,

  activeSession: null,
  recentSessions: [],
  scores: [],

  channel: null,
  scoreChannel: null,
  heartbeatTimer: null,

  listeners: new Set()
};

function tableSessions() {
  return RB_TABLES.gameSessions || RB_TABLES.gamingSessions || "game_sessions";
}

function tableScores() {
  return RB_TABLES.gameScores || "game_scores";
}

function tableGames() {
  return RB_TABLES.games || "games";
}

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeCents(value = 0) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0
    ? Math.floor(number)
    : 0;
}

function gameUrl(game = {}) {
  const base = RB_ROUTES.gaming || "/gaming";
  const key = game.slug || game.id || game.game_id || "";

  return key
    ? `${base}?game=${encodeURIComponent(key)}`
    : base;
}

function emitSessionState() {
  const snapshot = getGameSessionState();

  SESSION.listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn("[RB GAME SESSION LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-game-session-update", {
      detail: snapshot
    })
  );
}

function resolveIdentity() {
  SESSION.user = getUser?.() || SESSION.user || null;
  SESSION.profile = getProfileIdentity?.() || SESSION.profile || null;

  return {
    user: SESSION.user,
    profile: SESSION.profile
  };
}

function deviceInfo() {
  return {
    source: "game-session-client.js",
    app: "Rich Bizness Mobile",
    userAgent: navigator.userAgent,
    width: window.innerWidth,
    height: window.innerHeight,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null
  };
}

function durationSeconds(startedAt, endedAt = Date.now()) {
  if (!startedAt) return 0;

  const start = new Date(startedAt).getTime();
  const end = typeof endedAt === "number"
    ? endedAt
    : new Date(endedAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;

  return Math.max(0, Math.floor((end - start) / 1000));
}

function normalizeSession(row = {}) {
  return {
    ...row,
    status: String(row.status || "active").toLowerCase(),
    duration_seconds:
      row.duration_seconds ??
      durationSeconds(row.started_at, row.ended_at || Date.now())
  };
}

export function getGameSessionState() {
  return {
    user: SESSION.user,
    profile: SESSION.profile,

    activeSession: SESSION.activeSession,
    recentSessions: [...SESSION.recentSessions],
    scores: [...SESSION.scores],

    hasActiveSession: Boolean(SESSION.activeSession?.id)
  };
}

export function onGameSessionState(listener) {
  if (typeof listener !== "function") return () => {};

  SESSION.listeners.add(listener);
  listener(getGameSessionState());

  return () => {
    SESSION.listeners.delete(listener);
  };
}

export async function loadGameSessions({
  userId = null,
  gameId = null,
  limit = 30
} = {}) {
  resolveIdentity();

  const id = userId || SESSION.user?.id;

  if (!id) {
    SESSION.activeSession = null;
    SESSION.recentSessions = [];
    emitSessionState();
    return getGameSessionState();
  }

  const supabase = getSupabase();

  let query = supabase
    .from(tableSessions())
    .select("*")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (gameId) {
    query = query.eq("game_id", gameId);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[RB GAME SESSIONS LOAD]", error?.message || error);
    SESSION.activeSession = null;
    SESSION.recentSessions = [];
    emitSessionState();
    return getGameSessionState();
  }

  const sessions = (data || []).map(normalizeSession);

  SESSION.recentSessions = sessions;
  SESSION.activeSession =
    sessions.find((item) =>
      ["active", "playing", "paused"].includes(item.status) && !item.ended_at
    ) || null;

  emitSessionState();

  return getGameSessionState();
}

export async function loadGameScores({
  userId = null,
  gameId = null,
  limit = 30
} = {}) {
  resolveIdentity();

  const id = userId || SESSION.user?.id;
  if (!id) {
    SESSION.scores = [];
    emitSessionState();
    return [];
  }

  const supabase = getSupabase();

  let query = supabase
    .from(tableScores())
    .select("*")
    .eq("user_id", id)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (gameId) {
    query = query.eq("game_id", gameId);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[RB GAME SCORES LOAD]", error?.message || error);
    SESSION.scores = [];
    emitSessionState();
    return [];
  }

  SESSION.scores = data || [];
  emitSessionState();

  return SESSION.scores;
}

export async function getGameById(gameId) {
  if (!gameId) return null;

  const rows = await rbSelect({
    table: tableGames(),
    match: { id: gameId },
    maybeSingle: true
  });

  return rows || null;
}

export async function startGameSession({
  gameId,
  gameSlug = "",
  gameTitle = "",
  challengeId = null,
  mode = "solo",
  entryFeeCents = 0,
  metadata = {}
} = {}) {
  resolveIdentity();

  if (!SESSION.user?.id) {
    throw new Error("Sign in before starting a game session.");
  }

  if (!gameId) {
    throw new Error("Missing game id.");
  }

  if (SESSION.activeSession?.id) {
    await endGameSession({
      sessionId: SESSION.activeSession.id,
      reason: "new_session_started"
    });
  }

  const identity = SESSION.profile || {};

  const payload = {
    game_id: gameId,
    challenge_id: challengeId,

    user_id: SESSION.user.id,
    username:
      identity.username ||
      SESSION.user.email?.split("@")?.[0] ||
      "rich_gamer",
    display_name:
      identity.display_name ||
      identity.username ||
      "Rich Gamer",

    game_slug: gameSlug || null,
    game_title: cleanText(gameTitle, "Rich Bizness Arcade"),

    mode,
    status: "active",

    started_at: nowIso(),
    last_heartbeat_at: nowIso(),

    entry_fee_cents: safeCents(entryFeeCents),
    currency: "usd",

    device_info: deviceInfo(),

    metadata: {
      source: "game-session-client.js",
      route: window.location.pathname,
      ...metadata
    }
  };

  const rows = await rbInsert({
    table: tableSessions(),
    values: payload
  });

  SESSION.activeSession = rows?.[0] || null;

  await runRichAction({
    action: "game_session_started",
    section: "gaming",
    actorId: SESSION.user.id,
    targetTable: tableSessions(),
    targetType: "game_session",
    targetId: SESSION.activeSession?.id || null,
    targetUrl: gameUrl({ id: gameId, slug: gameSlug }),
    title: payload.game_title,
    emoji: "🎮",
    metadata: {
      game_id: gameId,
      challenge_id: challengeId,
      mode,
      source: "game-session-client.js"
    }
  });

  startHeartbeat();

  await loadGameSessions({
    userId: SESSION.user.id,
    gameId: null
  });

  return SESSION.activeSession;
}

export async function pauseGameSession(sessionId = SESSION.activeSession?.id) {
  resolveIdentity();

  if (!sessionId) {
    throw new Error("No game session to pause.");
  }

  const rows = await rbUpdate({
    table: tableSessions(),
    match: { id: sessionId },
    values: {
      status: "paused",
      paused_at: nowIso(),
      last_heartbeat_at: nowIso(),
      updated_at: nowIso()
    }
  });

  SESSION.activeSession = normalizeSession(rows?.[0] || SESSION.activeSession);
  stopHeartbeat();
  emitSessionState();

  return SESSION.activeSession;
}

export async function resumeGameSession(sessionId = SESSION.activeSession?.id) {
  resolveIdentity();

  if (!sessionId) {
    throw new Error("No game session to resume.");
  }

  const rows = await rbUpdate({
    table: tableSessions(),
    match: { id: sessionId },
    values: {
      status: "active",
      resumed_at: nowIso(),
      last_heartbeat_at: nowIso(),
      updated_at: nowIso()
    }
  });

  SESSION.activeSession = normalizeSession(rows?.[0] || SESSION.activeSession);
  startHeartbeat();
  emitSessionState();

  return SESSION.activeSession;
}

export async function heartbeatGameSession(sessionId = SESSION.activeSession?.id) {
  if (!sessionId) return null;

  try {
    const rows = await rbUpdate({
      table: tableSessions(),
      match: { id: sessionId },
      values: {
        last_heartbeat_at: nowIso(),
        duration_seconds: durationSeconds(SESSION.activeSession?.started_at),
        updated_at: nowIso()
      }
    });

    SESSION.activeSession = normalizeSession(rows?.[0] || SESSION.activeSession);
    emitSessionState();

    return SESSION.activeSession;
  } catch (error) {
    console.warn("[RB GAME SESSION HEARTBEAT]", error?.message || error);
    return null;
  }
}

export function startHeartbeat(intervalMs = 15000) {
  stopHeartbeat();

  if (!SESSION.activeSession?.id) return;

  SESSION.heartbeatTimer = window.setInterval(() => {
    heartbeatGameSession().catch(console.warn);
  }, intervalMs);
}

export function stopHeartbeat() {
  if (SESSION.heartbeatTimer) {
    window.clearInterval(SESSION.heartbeatTimer);
  }

  SESSION.heartbeatTimer = null;
}

export async function submitGameScore({
  sessionId = SESSION.activeSession?.id,
  gameId = SESSION.activeSession?.game_id,
  challengeId = SESSION.activeSession?.challenge_id || null,
  score = 0,
  points = null,
  level = null,
  rank = null,
  duration = null,
  metadata = {}
} = {}) {
  resolveIdentity();

  if (!SESSION.user?.id) {
    throw new Error("Sign in before submitting a score.");
  }

  if (!gameId) {
    throw new Error("Missing game id for score.");
  }

  const finalScore = safeNumber(score, 0);
  const finalPoints = points === null
    ? finalScore
    : safeNumber(points, finalScore);

  const identity = SESSION.profile || {};

  const scoreRows = await rbInsert({
    table: tableScores(),
    values: {
      session_id: sessionId,
      game_id: gameId,
      challenge_id: challengeId,

      user_id: SESSION.user.id,
      username:
        identity.username ||
        SESSION.user.email?.split("@")?.[0] ||
        "rich_gamer",
      display_name:
        identity.display_name ||
        identity.username ||
        "Rich Gamer",

      score: finalScore,
      points: finalPoints,
      level,
      rank,

      duration_seconds:
        duration ??
        durationSeconds(SESSION.activeSession?.started_at),

      metadata: {
        source: "game-session-client.js",
        session_id: sessionId,
        ...metadata
      }
    }
  });

  const scoreRow = scoreRows?.[0] || null;

  await runRichAction({
    action: "game_score_submitted",
    section: "gaming",
    actorId: SESSION.user.id,
    targetTable: tableScores(),
    targetType: "game_score",
    targetId: scoreRow?.id || null,
    targetUrl: RB_ROUTES.gaming || "/gaming",
    title: "Game score submitted",
    emoji: "🏆",
    metadata: {
      game_id: gameId,
      challenge_id: challengeId,
      session_id: sessionId,
      score: finalScore,
      points: finalPoints,
      source: "game-session-client.js"
    }
  });

  await loadGameScores({
    userId: SESSION.user.id,
    gameId
  });

  return scoreRow;
}

export async function endGameSession({
  sessionId = SESSION.activeSession?.id,
  score = null,
  reason = "completed",
  metadata = {}
} = {}) {
  resolveIdentity();

  if (!sessionId) return null;

  const active = SESSION.activeSession;
  const endedAt = nowIso();

  let scoreRow = null;

  if (score !== null) {
    scoreRow = await submitGameScore({
      sessionId,
      gameId: active?.game_id,
      challengeId: active?.challenge_id || null,
      score,
      metadata: {
        end_reason: reason,
        ...metadata
      }
    });
  }

  const rows = await rbUpdate({
    table: tableSessions(),
    match: { id: sessionId },
    values: {
      status: "ended",
      ended_at: endedAt,
      end_reason: reason,
      final_score: score === null ? active?.final_score || null : safeNumber(score, 0),
      score_id: scoreRow?.id || active?.score_id || null,
      duration_seconds: durationSeconds(active?.started_at, endedAt),
      updated_at: endedAt,
      metadata: {
        source: "game-session-client.js",
        end_reason: reason,
        ...metadata
      }
    }
  });

  const finalSession = normalizeSession(rows?.[0] || active || { id: sessionId });

  SESSION.activeSession = null;
  stopHeartbeat();

  await runRichAction({
    action: "game_session_ended",
    section: "gaming",
    actorId: SESSION.user?.id || null,
    targetTable: tableSessions(),
    targetType: "game_session",
    targetId: sessionId,
    targetUrl: RB_ROUTES.gaming || "/gaming",
    title: finalSession.game_title || "Game session ended",
    emoji: "🎮",
    metadata: {
      game_id: finalSession.game_id,
      challenge_id: finalSession.challenge_id,
      duration_seconds: finalSession.duration_seconds,
      final_score: finalSession.final_score,
      source: "game-session-client.js"
    }
  });

  await Promise.all([
    loadGameSessions({ userId: SESSION.user?.id || null }),
    loadGameScores({ userId: SESSION.user?.id || null })
  ]);

  return finalSession;
}

export async function abandonGameSession(sessionId = SESSION.activeSession?.id) {
  return await endGameSession({
    sessionId,
    reason: "abandoned"
  });
}

export async function syncLatestActiveSession({
  userId = null
} = {}) {
  resolveIdentity();

  const id = userId || SESSION.user?.id;
  if (!id) return null;

  const sessions = await rbSelect({
    table: tableSessions(),
    match: { user_id: id },
    order: { column: "created_at", ascending: false },
    limit: 20
  });

  const active =
    (sessions || [])
      .map(normalizeSession)
      .find((item) =>
        ["active", "playing", "paused"].includes(item.status) && !item.ended_at
      ) || null;

  SESSION.activeSession = active;

  if (active?.status === "active") {
    startHeartbeat();
  } else {
    stopHeartbeat();
  }

  emitSessionState();

  return active;
}

export function clearGameSessionRealtime() {
  const supabase = getSupabase();

  if (SESSION.channel && supabase) {
    supabase.removeChannel(SESSION.channel);
  }

  if (SESSION.scoreChannel && supabase) {
    supabase.removeChannel(SESSION.scoreChannel);
  }

  SESSION.channel = null;
  SESSION.scoreChannel = null;
}

export function bindGameSessionRealtime(userId = SESSION.user?.id) {
  const supabase = getSupabase();

  if (!supabase || !userId) return null;

  clearGameSessionRealtime();

  SESSION.channel = supabase
    .channel(`rb-game-sessions-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: tableSessions(),
        filter: `user_id=eq.${userId}`
      },
      () => loadGameSessions({ userId })
    )
    .subscribe();

  SESSION.scoreChannel = supabase
    .channel(`rb-game-scores-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: tableScores(),
        filter: `user_id=eq.${userId}`
      },
      () => loadGameScores({ userId })
    )
    .subscribe();

  return {
    sessionChannel: SESSION.channel,
    scoreChannel: SESSION.scoreChannel
  };
}

export async function initGameSessionClient({
  user = null,
  profile = null,
  realtime = true,
  loadScores = true
} = {}) {
  SESSION.user = user || getUser?.() || null;
  SESSION.profile = profile || getProfileIdentity?.() || null;

  await loadGameSessions({
    userId: SESSION.user?.id || null
  });

  if (loadScores) {
    await loadGameScores({
      userId: SESSION.user?.id || null
    });
  }

  if (realtime && SESSION.user?.id) {
    bindGameSessionRealtime(SESSION.user.id);
  }

  return getGameSessionState();
}

window.addEventListener("beforeunload", () => {
  stopHeartbeat();
  clearGameSessionRealtime();

  if (SESSION.activeSession?.id) {
    endGameSession({
      sessionId: SESSION.activeSession.id,
      reason: "page_unload"
    }).catch(() => {});
  }
});

console.log("RB GAME SESSION CLIENT READY", {
  sessions: tableSessions(),
  scores: tableScores()
});
