/* =========================
   RICH BIZNESS MOBILE
   /core/features/gaming/challenge-client.js

   CHALLENGE CLIENT
   Create / accept / decline / complete / forfeit
   Synced with gaming state + notifications + XP/action engine
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
  getProfileIdentity,
  buildProfileUrl
} from "/core/shared/rb-profile.js";

import {
  runRichAction
} from "/core/shared/rb-action-engine.js";

const CHALLENGE = {
  user: null,
  profile: null,

  incoming: [],
  outgoing: [],
  active: [],
  completed: [],

  channel: null,
  listeners: new Set()
};

function tableChallenges() {
  return RB_TABLES.gameChallenges || RB_TABLES.gamingChallenges || "game_challenges";
}

function tableScores() {
  return RB_TABLES.gameScores || "game_scores";
}

function tableNotifications() {
  return RB_TABLES.richNotifications || RB_TABLES.notifications || null;
}

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function moneyCents(value = 0) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0
    ? Math.floor(number)
    : 0;
}

function challengeUrl(challenge = {}) {
  const base = RB_ROUTES.gaming || "/gaming";
  const id = challenge.id || "";

  return id
    ? `${base}?challenge=${encodeURIComponent(id)}`
    : base;
}

function normalizeStatus(value = "pending") {
  return String(value || "pending").toLowerCase();
}

function emitChallengeState() {
  const snapshot = getChallengeState();

  CHALLENGE.listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn("[RB CHALLENGE LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-gaming-challenges-update", {
      detail: snapshot
    })
  );
}

function resolveIdentity() {
  CHALLENGE.user = getUser?.() || CHALLENGE.user || null;
  CHALLENGE.profile = getProfileIdentity?.() || CHALLENGE.profile || null;

  return {
    user: CHALLENGE.user,
    profile: CHALLENGE.profile
  };
}

function opponentName(item = {}) {
  return (
    item.opponent_display_name ||
    item.opponent_username ||
    item.challenged_display_name ||
    item.challenged_username ||
    "Rich Gamer"
  );
}

async function notifyUser({
  userId,
  actorId = null,
  type = "game_challenge",
  title = "Gaming challenge",
  body = "You have a new Rich Bizness challenge.",
  targetId = null,
  targetUrl = null,
  emoji = "🎮",
  priority = "normal",
  metadata = {}
} = {}) {
  const table = tableNotifications();
  if (!table || !userId) return null;

  try {
    const rows = await rbInsert({
      table,
      values: {
        user_id: userId,
        actor_id: actorId,
        type,
        title,
        body,
        target_table: tableChallenges(),
        target_type: "game_challenge",
        target_id: targetId,
        target_url: targetUrl,
        emoji,
        priority,
        is_read: false,
        is_seen: false,
        is_silent: false,
        metadata: {
          source: "challenge-client.js",
          ...metadata
        }
      }
    });

    return rows?.[0] || null;
  } catch (error) {
    console.warn("[RB CHALLENGE NOTIFY SKIPPED]", error?.message || error);
    return null;
  }
}

function splitChallenges(rows = []) {
  const userId = CHALLENGE.user?.id;

  CHALLENGE.incoming = [];
  CHALLENGE.outgoing = [];
  CHALLENGE.active = [];
  CHALLENGE.completed = [];

  rows.forEach((item) => {
    const status = normalizeStatus(item.status);

    if (["completed", "cancelled", "declined", "expired", "forfeited"].includes(status)) {
      CHALLENGE.completed.push(item);
      return;
    }

    if (["accepted", "active", "in_progress"].includes(status)) {
      CHALLENGE.active.push(item);
      return;
    }

    if (item.challenged_user_id === userId || item.receiver_id === userId || item.opponent_user_id === userId) {
      CHALLENGE.incoming.push(item);
      return;
    }

    CHALLENGE.outgoing.push(item);
  });
}

export function getChallengeState() {
  return {
    user: CHALLENGE.user,
    profile: CHALLENGE.profile,

    incoming: [...CHALLENGE.incoming],
    outgoing: [...CHALLENGE.outgoing],
    active: [...CHALLENGE.active],
    completed: [...CHALLENGE.completed],

    total:
      CHALLENGE.incoming.length +
      CHALLENGE.outgoing.length +
      CHALLENGE.active.length +
      CHALLENGE.completed.length
  };
}

export function onChallengeState(listener) {
  if (typeof listener !== "function") return () => {};

  CHALLENGE.listeners.add(listener);
  listener(getChallengeState());

  return () => {
    CHALLENGE.listeners.delete(listener);
  };
}

export async function loadChallenges({
  userId = null,
  limit = 80
} = {}) {
  resolveIdentity();

  const id = userId || CHALLENGE.user?.id;
  if (!id) {
    splitChallenges([]);
    emitChallengeState();
    return getChallengeState();
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(tableChallenges())
    .select("*")
    .or(
      [
        `challenger_user_id.eq.${id}`,
        `challenged_user_id.eq.${id}`,
        `creator_id.eq.${id}`,
        `receiver_id.eq.${id}`,
        `opponent_user_id.eq.${id}`
      ].join(",")
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[RB CHALLENGES LOAD]", error?.message || error);
    splitChallenges([]);
    emitChallengeState();
    return getChallengeState();
  }

  splitChallenges(data || []);
  emitChallengeState();

  return getChallengeState();
}

export async function createGameChallenge({
  gameId = null,
  gameTitle = "",
  challengedUserId,
  challengedUsername = "",
  challengedDisplayName = "",
  title = "",
  message = "",
  wagerCents = 0,
  rules = {},
  expiresAt = null,
  metadata = {}
} = {}) {
  resolveIdentity();

  if (!CHALLENGE.user?.id) {
    throw new Error("Sign in before creating a challenge.");
  }

  if (!challengedUserId) {
    throw new Error("Choose a gamer to challenge.");
  }

  if (challengedUserId === CHALLENGE.user.id) {
    throw new Error("You cannot challenge yourself.");
  }

  const identity = CHALLENGE.profile || {};
  const payload = {
    game_id: gameId,
    game_title: cleanText(gameTitle, "Rich Bizness Arcade"),

    challenger_user_id: CHALLENGE.user.id,
    challenged_user_id: challengedUserId,

    challenger_username: identity.username || null,
    challenger_display_name:
      identity.display_name ||
      identity.username ||
      CHALLENGE.user.email?.split("@")?.[0] ||
      "Rich Gamer",

    challenged_username: challengedUsername || null,
    challenged_display_name: challengedDisplayName || null,

    title: cleanText(title, `${identity.display_name || identity.username || "Rich Gamer"} challenged you`),
    message: cleanText(message, "Step into the Rich Bizness arcade."),
    status: "pending",

    wager_cents: moneyCents(wagerCents),
    currency: "usd",

    rules,
    expires_at: expiresAt,
    created_at: nowIso(),
    updated_at: nowIso(),

    metadata: {
      source: "challenge-client.js",
      profile_url: buildProfileUrl?.(identity) || null,
      ...metadata
    }
  };

  const rows = await rbInsert({
    table: tableChallenges(),
    values: payload
  });

  const challenge = rows?.[0] || null;

  if (challenge?.id) {
    await notifyUser({
      userId: challengedUserId,
      actorId: CHALLENGE.user.id,
      type: "game_challenge_created",
      title: "New arcade challenge",
      body: `${payload.challenger_display_name} challenged you to ${payload.game_title}.`,
      targetId: challenge.id,
      targetUrl: challengeUrl(challenge),
      emoji: "🎮",
      priority: moneyCents(wagerCents) > 0 ? "high" : "normal",
      metadata: {
        game_id: gameId,
        game_title: payload.game_title,
        wager_cents: payload.wager_cents
      }
    });

    await runRichAction({
      action: "game_challenge_created",
      section: "gaming",
      actorId: CHALLENGE.user.id,
      targetTable: tableChallenges(),
      targetType: "game_challenge",
      targetId: challenge.id,
      targetUrl: challengeUrl(challenge),
      title: payload.title,
      body: payload.message,
      emoji: "🎮",
      metadata: {
        game_id: gameId,
        challenged_user_id: challengedUserId,
        source: "challenge-client.js"
      }
    });
  }

  await loadChallenges();

  return challenge;
}

export async function acceptGameChallenge(challengeId) {
  resolveIdentity();

  if (!CHALLENGE.user?.id) {
    throw new Error("Sign in before accepting a challenge.");
  }

  if (!challengeId) {
    throw new Error("Missing challenge id.");
  }

  const rows = await rbUpdate({
    table: tableChallenges(),
    match: { id: challengeId },
    values: {
      status: "accepted",
      accepted_at: nowIso(),
      updated_at: nowIso(),
      metadata: {
        source: "challenge-client.js",
        accepted_by: CHALLENGE.user.id
      }
    }
  });

  const challenge = rows?.[0] || null;

  if (challenge?.challenger_user_id) {
    await notifyUser({
      userId: challenge.challenger_user_id,
      actorId: CHALLENGE.user.id,
      type: "game_challenge_accepted",
      title: "Challenge accepted",
      body: `${CHALLENGE.profile?.display_name || "A gamer"} accepted your challenge.`,
      targetId: challenge.id,
      targetUrl: challengeUrl(challenge),
      emoji: "🔥"
    });
  }

  await runRichAction({
    action: "game_challenge_accepted",
    section: "gaming",
    actorId: CHALLENGE.user.id,
    targetTable: tableChallenges(),
    targetType: "game_challenge",
    targetId: challengeId,
    targetUrl: challengeUrl(challenge),
    title: "Challenge accepted",
    emoji: "🔥",
    metadata: {
      source: "challenge-client.js"
    }
  });

  await loadChallenges();

  return challenge;
}

export async function declineGameChallenge(challengeId, reason = "") {
  resolveIdentity();

  if (!CHALLENGE.user?.id) {
    throw new Error("Sign in before declining a challenge.");
  }

  if (!challengeId) {
    throw new Error("Missing challenge id.");
  }

  const rows = await rbUpdate({
    table: tableChallenges(),
    match: { id: challengeId },
    values: {
      status: "declined",
      declined_at: nowIso(),
      updated_at: nowIso(),
      metadata: {
        source: "challenge-client.js",
        declined_by: CHALLENGE.user.id,
        reason
      }
    }
  });

  const challenge = rows?.[0] || null;

  if (challenge?.challenger_user_id) {
    await notifyUser({
      userId: challenge.challenger_user_id,
      actorId: CHALLENGE.user.id,
      type: "game_challenge_declined",
      title: "Challenge declined",
      body: reason || `${CHALLENGE.profile?.display_name || "A gamer"} declined your challenge.`,
      targetId: challenge.id,
      targetUrl: challengeUrl(challenge),
      emoji: "🛡️"
    });
  }

  await loadChallenges();

  return challenge;
}

export async function cancelGameChallenge(challengeId) {
  resolveIdentity();

  if (!CHALLENGE.user?.id) {
    throw new Error("Sign in before cancelling a challenge.");
  }

  if (!challengeId) {
    throw new Error("Missing challenge id.");
  }

  const rows = await rbUpdate({
    table: tableChallenges(),
    match: { id: challengeId },
    values: {
      status: "cancelled",
      cancelled_at: nowIso(),
      updated_at: nowIso(),
      metadata: {
        source: "challenge-client.js",
        cancelled_by: CHALLENGE.user.id
      }
    }
  });

  await loadChallenges();

  return rows?.[0] || null;
}

export async function startGameChallenge(challengeId) {
  resolveIdentity();

  if (!challengeId) {
    throw new Error("Missing challenge id.");
  }

  const rows = await rbUpdate({
    table: tableChallenges(),
    match: { id: challengeId },
    values: {
      status: "active",
      started_at: nowIso(),
      updated_at: nowIso(),
      metadata: {
        source: "challenge-client.js",
        started_by: CHALLENGE.user?.id || null
      }
    }
  });

  await loadChallenges();

  return rows?.[0] || null;
}

export async function submitChallengeScore({
  challengeId,
  gameId = null,
  score,
  durationSeconds = 0,
  metadata = {}
} = {}) {
  resolveIdentity();

  if (!CHALLENGE.user?.id) {
    throw new Error("Sign in before submitting a score.");
  }

  if (!challengeId) {
    throw new Error("Missing challenge id.");
  }

  const numericScore = Number(score);

  if (!Number.isFinite(numericScore)) {
    throw new Error("Score must be a number.");
  }

  const scoreRows = await rbInsert({
    table: tableScores(),
    values: {
      game_id: gameId,
      challenge_id: challengeId,
      user_id: CHALLENGE.user.id,
      username: CHALLENGE.profile?.username || null,
      display_name:
        CHALLENGE.profile?.display_name ||
        CHALLENGE.profile?.username ||
        "Rich Gamer",
      score: numericScore,
      points: numericScore,
      duration_seconds: Number(durationSeconds || 0),
      metadata: {
        source: "challenge-client.js",
        ...metadata
      }
    }
  });

  await runRichAction({
    action: "game_score_submitted",
    section: "gaming",
    actorId: CHALLENGE.user.id,
    targetTable: tableScores(),
    targetType: "game_score",
    targetId: scoreRows?.[0]?.id || null,
    targetUrl: RB_ROUTES.gaming || "/gaming",
    title: "Challenge score submitted",
    emoji: "🏆",
    metadata: {
      challenge_id: challengeId,
      game_id: gameId,
      score: numericScore,
      source: "challenge-client.js"
    }
  });

  await resolveChallengeWinner(challengeId);

  return scoreRows?.[0] || null;
}

export async function resolveChallengeWinner(challengeId) {
  if (!challengeId) return null;

  const scores = await rbSelect({
    table: tableScores(),
    match: { challenge_id: challengeId },
    order: { column: "score", ascending: false },
    limit: 10
  });

  if (!scores?.length) return null;

  const challengerScore = scores[0];
  const winnerId = challengerScore.user_id || null;

  const challengeRows = await rbUpdate({
    table: tableChallenges(),
    match: { id: challengeId },
    values: {
      status: "completed",
      winner_user_id: winnerId,
      winning_score: Number(challengerScore.score || challengerScore.points || 0),
      completed_at: nowIso(),
      updated_at: nowIso(),
      metadata: {
        source: "challenge-client.js",
        resolved_by: "score",
        score_id: challengerScore.id || null
      }
    }
  });

  const challenge = challengeRows?.[0] || null;

  if (challenge) {
    const notifyIds = [
      challenge.challenger_user_id,
      challenge.challenged_user_id
    ].filter(Boolean);

    await Promise.all(
      notifyIds.map((userId) =>
        notifyUser({
          userId,
          actorId: winnerId,
          type: "game_challenge_completed",
          title: "Challenge completed",
          body: winnerId === userId
            ? "You won the arcade challenge."
            : `${challengerScore.display_name || "A gamer"} won the challenge.`,
          targetId: challenge.id,
          targetUrl: challengeUrl(challenge),
          emoji: "🏆"
        })
      )
    );
  }

  await loadChallenges();

  return challenge;
}

export async function forfeitGameChallenge(challengeId) {
  resolveIdentity();

  if (!CHALLENGE.user?.id) {
    throw new Error("Sign in before forfeiting.");
  }

  if (!challengeId) {
    throw new Error("Missing challenge id.");
  }

  const rows = await rbUpdate({
    table: tableChallenges(),
    match: { id: challengeId },
    values: {
      status: "forfeited",
      forfeited_by: CHALLENGE.user.id,
      completed_at: nowIso(),
      updated_at: nowIso(),
      metadata: {
        source: "challenge-client.js",
        forfeited_by: CHALLENGE.user.id
      }
    }
  });

  const challenge = rows?.[0] || null;

  const opponentId =
    challenge?.challenger_user_id === CHALLENGE.user.id
      ? challenge?.challenged_user_id
      : challenge?.challenger_user_id;

  if (opponentId) {
    await notifyUser({
      userId: opponentId,
      actorId: CHALLENGE.user.id,
      type: "game_challenge_forfeited",
      title: "Challenge forfeited",
      body: `${CHALLENGE.profile?.display_name || "A gamer"} forfeited the challenge.`,
      targetId: challenge.id,
      targetUrl: challengeUrl(challenge),
      emoji: "🏳️"
    });
  }

  await loadChallenges();

  return challenge;
}

export function clearChallengeRealtime() {
  const supabase = getSupabase();

  if (CHALLENGE.channel && supabase) {
    supabase.removeChannel(CHALLENGE.channel);
  }

  CHALLENGE.channel = null;
}

export function bindChallengeRealtime(userId = CHALLENGE.user?.id) {
  const supabase = getSupabase();

  if (!supabase || !userId) return null;

  clearChallengeRealtime();

  CHALLENGE.channel = supabase
    .channel(`rb-gaming-challenges-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: tableChallenges()
      },
      () => loadChallenges({ userId })
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: tableScores()
      },
      () => loadChallenges({ userId })
    )
    .subscribe();

  return CHALLENGE.channel;
}

export async function initChallengeClient({
  user = null,
  profile = null,
  realtime = true
} = {}) {
  CHALLENGE.user = user || getUser?.() || null;
  CHALLENGE.profile = profile || getProfileIdentity?.() || null;

  await loadChallenges({
    userId: CHALLENGE.user?.id || null
  });

  if (realtime && CHALLENGE.user?.id) {
    bindChallengeRealtime(CHALLENGE.user.id);
  }

  return getChallengeState();
}

window.addEventListener("beforeunload", clearChallengeRealtime);

console.log("RB GAMING CHALLENGE CLIENT READY", {
  challenges: tableChallenges(),
  scores: tableScores()
});
