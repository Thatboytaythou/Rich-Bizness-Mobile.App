/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-xp.js

   XP + RICH POINTS ENGINE

   Locked purpose:
   - global XP rewards
   - user level sync
   - profile rich_points sync
   - XP ledger logging
   - section rewards
   - index/profile gauge events

   Rule:
   XP can support future USD/monetization,
   but this file does not directly convert XP to cash.
========================= */

import {
  RB_TABLES,
  RB_UNIVERSE
} from "/core/shared/rb-config.js";

import {
  getUser,
  rbInsert,
  rbUpdate,
  rbSelect
} from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity
} from "/core/shared/rb-profile.js";

const LEVEL_STEP =
  RB_UNIVERSE?.xp?.levelStep ||
  1000;

const DEFAULT_RANK =
  RB_UNIVERSE?.xp?.defaultRank ||
  "Biz Legend";

const DEFAULT_XP_RULES = Object.freeze({
  /* visits */
  feed_visit: { xp: 5, rich_points: 1, coins: 0 },
  watch_visit: { xp: 5, rich_points: 1, coins: 0 },
  live_visit: { xp: 6, rich_points: 1, coins: 0 },
  music_visit: { xp: 5, rich_points: 1, coins: 0 },
  podcast_visit: { xp: 5, rich_points: 1, coins: 0 },
  radio_visit: { xp: 4, rich_points: 1, coins: 0 },
  gaming_visit: { xp: 6, rich_points: 1, coins: 0 },
  sports_visit: { xp: 5, rich_points: 1, coins: 0 },
  gallery_visit: { xp: 5, rich_points: 1, coins: 0 },
  store_visit: { xp: 5, rich_points: 1, coins: 0 },
  upload_visit: { xp: 3, rich_points: 1, coins: 0 },
  meta_visit: { xp: 8, rich_points: 2, coins: 0 },
  avatar_visit: { xp: 4, rich_points: 1, coins: 0 },

  /* social */
  upload_created: { xp: 20, rich_points: 5, coins: 0 },
  feed_post_created: { xp: 15, rich_points: 4, coins: 0 },
  comment_created: { xp: 5, rich_points: 1, coins: 0 },
  like_created: { xp: 2, rich_points: 1, coins: 0 },
  follow_created: { xp: 10, rich_points: 3, coins: 0 },
  message_sent: { xp: 3, rich_points: 1, coins: 0 },
  notification_read: { xp: 1, rich_points: 0, coins: 0 },

  /* music / podcast / radio */
  music_uploaded: { xp: 30, rich_points: 8, coins: 0 },
  track_played: { xp: 3, rich_points: 1, coins: 0 },
  track_liked: { xp: 2, rich_points: 1, coins: 0 },
  podcast_uploaded: { xp: 25, rich_points: 6, coins: 0 },
  podcast_played: { xp: 3, rich_points: 1, coins: 0 },
  radio_played: { xp: 2, rich_points: 1, coins: 0 },

  /* live / watch */
  live_started: { xp: 35, rich_points: 10, coins: 0 },
  live_viewed: { xp: 5, rich_points: 1, coins: 0 },
  live_chat_sent: { xp: 4, rich_points: 1, coins: 0 },
  live_tip_sent: { xp: 10, rich_points: 3, coins: 0 },
  watch_viewed: { xp: 4, rich_points: 1, coins: 0 },

  /* games */
  game_score_submitted: { xp: 20, rich_points: 5, coins: 0 },
  game_clip_uploaded: { xp: 25, rich_points: 6, coins: 0 },
  game_session_completed: { xp: 15, rich_points: 4, coins: 0 },
  tournament_joined: { xp: 12, rich_points: 3, coins: 0 },

  /* sports */
  sports_upload_created: { xp: 20, rich_points: 5, coins: 0 },
  sports_pick_created: { xp: 15, rich_points: 4, coins: 0 },
  sports_comment_created: { xp: 5, rich_points: 1, coins: 0 },

  /* store / money flow */
  product_created: { xp: 20, rich_points: 5, coins: 0 },
  product_sold: { xp: 40, rich_points: 12, coins: 0 },
  product_purchased: { xp: 15, rich_points: 4, coins: 0 },
  tip_paid: { xp: 15, rich_points: 4, coins: 0 },
  payout_requested: { xp: 10, rich_points: 2, coins: 0 },

  /* meta / avatar */
  avatar_created: { xp: 20, rich_points: 5, coins: 0 },
  meta_avatar_updated: { xp: 15, rich_points: 4, coins: 0 },
  meta_world_created: { xp: 35, rich_points: 10, coins: 0 },
  meta_world_visited: { xp: 8, rich_points: 2, coins: 0 },
  meta_room_joined: { xp: 5, rich_points: 1, coins: 0 }
});

function now() {
  return new Date().toISOString();
}

function cleanKey(value = "unknown_event") {
  return String(value || "unknown_event")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

export function xpRequiredForLevel(level = 1) {
  const lvl = Math.max(1, safeNumber(level, 1));
  return lvl * LEVEL_STEP;
}

export function levelFromXp(totalXp = 0) {
  const xp = Math.max(0, safeNumber(totalXp, 0));
  return Math.max(1, Math.floor(xp / LEVEL_STEP) + 1);
}

export function rankFromLevel(level = 1) {
  const lvl = Math.max(1, safeNumber(level, 1));

  if (lvl >= 999) return "Rich Universe God";
  if (lvl >= 750) return "Meta Empire Legend";
  if (lvl >= 500) return "Rich Immortal";
  if (lvl >= 250) return "Universe Mogul";
  if (lvl >= 100) return "Biz Legend";
  if (lvl >= 75) return "Elite Creator";
  if (lvl >= 50) return "Rich Boss";
  if (lvl >= 25) return "Rising Creator";
  if (lvl >= 10) return "Street Executive";

  return "Smoke Rookie";
}

export function buildXpProgress(totalXp = 0) {
  const xpTotal = Math.max(0, safeNumber(totalXp, 0));
  const level = levelFromXp(xpTotal);

  const levelFloor = level <= 1 ? 0 : xpRequiredForLevel(level - 1);
  const levelNext = xpRequiredForLevel(level);

  const xpCurrent = Math.max(0, xpTotal - levelFloor);
  const xpNext = Math.max(LEVEL_STEP, levelNext - levelFloor);
  const percent = Math.max(0, Math.min(100, (xpCurrent / xpNext) * 100));

  return {
    level,
    xp_total: xpTotal,
    xp_current: xpCurrent,
    xp_next: xpNext,
    xp_percent: percent,
    xp_to_next: Math.max(0, xpNext - xpCurrent),
    rank_title: rankFromLevel(level)
  };
}

export function getXpRule(eventKey = "") {
  const key = cleanKey(eventKey);
  return DEFAULT_XP_RULES[key] || { xp: 5, rich_points: 1, coins: 0 };
}

/* =========================
   LEVEL STATE
========================= */

export async function getMyLevelState(userId = null) {
  const user = getUser();
  const id = userId || user?.id;

  if (!id) return null;

  try {
    const row = await rbSelect({
      table: RB_TABLES.userLevels,
      match: { user_id: id },
      maybeSingle: true
    });

    return row || null;
  } catch (error) {
    console.warn("[RB XP LEVEL LOAD SKIPPED]", error?.message || error);
    return null;
  }
}

export async function ensureUserLevel(userId = null) {
  const user = getUser();
  const id = userId || user?.id;

  if (!id) {
    throw new Error("User required for XP.");
  }

  const existing = await getMyLevelState(id);

  if (existing?.id || existing?.user_id) {
    return existing;
  }

  const identity = getProfileIdentity();
  const stamp = now();

  try {
    const inserted = await rbInsert({
      table: RB_TABLES.userLevels,
      values: {
        user_id: id,
        level: 1,
        xp_total: 0,
        xp_current: 0,
        xp_next: LEVEL_STEP,
        rank_title: "Smoke Rookie",
        rank_style: "smoke-cloud",
        rich_points: 0,
        coins: 0,
        trust_score: 100,
        metadata: {
          source: "rb-xp.js",
          username: identity.username,
          display_name: identity.display_name
        },
        created_at: stamp,
        updated_at: stamp
      }
    });

    return inserted?.[0] || null;
  } catch (error) {
    console.warn("[RB XP LEVEL INSERT SKIPPED]", error?.message || error);

    return {
      user_id: id,
      level: 1,
      xp_total: 0,
      xp_current: 0,
      xp_next: LEVEL_STEP,
      rank_title: "Smoke Rookie",
      rich_points: 0,
      coins: 0,
      trust_score: 100,
      metadata: {
        virtual: true
      }
    };
  }
}

/* =========================
   AWARD XP
========================= */

export async function awardXp({
  eventKey,
  userId = null,
  xp = null,
  richPoints = null,
  coins = null,
  section = "global",
  sourceTable = null,
  sourceId = null,
  metadata = {}
} = {}) {
  const user = getUser();
  const id = userId || user?.id;

  if (!id) {
    throw new Error("User required to award XP.");
  }

  const key = cleanKey(eventKey);
  const rule = getXpRule(key);

  const xpAmount = safeNumber(xp, rule.xp);
  const richPointsAmount = safeNumber(richPoints, rule.rich_points);
  const coinsAmount = safeNumber(coins, rule.coins);

  const levelState = await ensureUserLevel(id);

  const oldXpTotal =
    safeNumber(levelState?.xp_total, null) ??
    safeNumber(levelState?.xp, 0);

  const oldRichPoints =
    safeNumber(levelState?.rich_points, 0);

  const oldCoins =
    safeNumber(levelState?.coins, 0);

  const newXpTotal = Math.max(0, oldXpTotal + xpAmount);
  const progress = buildXpProgress(newXpTotal);

  const newRichPoints = Math.max(0, oldRichPoints + richPointsAmount);
  const newCoins = Math.max(0, oldCoins + coinsAmount);

  const stamp = now();

  let ledger = null;
  let updatedLevel = null;
  let updatedProfile = null;

  try {
    const ledgerRows = await rbInsert({
      table: RB_TABLES.userXpLedger,
      values: {
        user_id: id,
        event_key: key,
        section,
        xp_amount: xpAmount,
        coins_amount: coinsAmount,
        rich_points_amount: richPointsAmount,
        source_table: sourceTable,
        source_id: sourceId,
        metadata: {
          app: "Rich Bizness Mobile",
          source: "rb-xp.js",
          level_before: safeNumber(levelState?.level, 1),
          level_after: progress.level,
          rank_after: progress.rank_title,
          ...metadata
        },
        created_at: stamp
      }
    });

    ledger = ledgerRows?.[0] || null;
  } catch (error) {
    console.warn("[RB XP LEDGER SKIPPED]", error?.message || error);
  }

  try {
    const updatedLevels = await rbUpdate({
      table: RB_TABLES.userLevels,
      match: { user_id: id },
      values: {
        level: progress.level,
        xp_total: progress.xp_total,
        xp_current: progress.xp_current,
        xp_next: progress.xp_next,
        rank_title: progress.rank_title,
        rich_points: newRichPoints,
        coins: newCoins,
        updated_at: stamp,
        metadata: {
          ...(levelState?.metadata || {}),
          last_event_key: key,
          last_section: section,
          last_xp_amount: xpAmount,
          last_rich_points_amount: richPointsAmount,
          last_awarded_at: stamp
        }
      }
    });

    updatedLevel = updatedLevels?.[0] || null;
  } catch (error) {
    console.warn("[RB XP LEVEL UPDATE SKIPPED]", error?.message || error);
  }

  try {
    const profileRows = await rbUpdate({
      table: RB_TABLES.profiles,
      match: { id },
      values: {
        rich_level: progress.level,
        rank_title: progress.rank_title,
        rich_points: newRichPoints,
        updated_at: stamp
      }
    });

    updatedProfile = profileRows?.[0] || null;
  } catch (error) {
    console.warn("[RB PROFILE XP SYNC SKIPPED]", error?.message || error);
  }

  try {
    await rbInsert({
      table: RB_TABLES.platformAnalyticsEvents,
      values: {
        user_id: id,
        event_name: key,
        section,
        target_table: sourceTable,
        target_id: sourceId,
        value_cents: 0,
        metadata: {
          source: "rb-xp.js",
          xp_amount: xpAmount,
          rich_points_amount: richPointsAmount,
          coins_amount: coinsAmount,
          level_after: progress.level,
          rank_after: progress.rank_title,
          ...metadata
        },
        created_at: stamp
      }
    });
  } catch (error) {
    console.warn("[RB XP ANALYTICS SKIPPED]", error?.message || error);
  }

  const result = {
    ok: true,
    event_key: key,
    user_id: id,
    section,
    xp_awarded: xpAmount,
    rich_points_awarded: richPointsAmount,
    coins_awarded: coinsAmount,
    progress,
    level: updatedLevel,
    profile: updatedProfile,
    ledger
  };

  window.dispatchEvent(
    new CustomEvent("rb:xp-awarded", {
      detail: result
    })
  );

  window.dispatchEvent(
    new CustomEvent("rb:rich-action", {
      detail: result
    })
  );

  return result;
}

export async function awardSectionXp({
  section = "global",
  action = "activity",
  sourceTable = null,
  sourceId = null,
  metadata = {}
} = {}) {
  const eventKey = cleanKey(`${section}_${action}`);

  return await awardXp({
    eventKey,
    section,
    sourceTable,
    sourceId,
    metadata
  });
}

/* =========================
   SYNC / SUMMARY
========================= */

export async function syncProfileXp(userId = null) {
  const user = getUser();
  const id = userId || user?.id;

  if (!id) return null;

  const levelState = await ensureUserLevel(id);

  const xpTotal =
    safeNumber(levelState?.xp_total, null) ??
    safeNumber(levelState?.xp, 0);

  const progress = buildXpProgress(xpTotal);

  const richPoints =
    safeNumber(levelState?.rich_points, 0);

  try {
    const rows = await rbUpdate({
      table: RB_TABLES.profiles,
      match: { id },
      values: {
        rich_level: progress.level,
        rich_points: richPoints,
        rank_title: progress.rank_title,
        updated_at: now()
      }
    });

    return rows?.[0] || null;
  } catch (error) {
    console.warn("[RB PROFILE XP SYNC FAILED]", error?.message || error);
    return null;
  }
}

export async function getXpSummary(userId = null) {
  const user = getUser();
  const id = userId || user?.id;

  if (!id) return null;

  const levelState = await ensureUserLevel(id);

  const xpTotal =
    safeNumber(levelState?.xp_total, null) ??
    safeNumber(levelState?.xp, 0);

  const progress = buildXpProgress(xpTotal);

  return {
    user_id: id,
    level: safeNumber(levelState?.level, progress.level),
    xp_total: progress.xp_total,
    xp_current: progress.xp_current,
    xp_next: progress.xp_next,
    xp_percent: progress.xp_percent,
    xp_to_next: progress.xp_to_next,
    rank_title: levelState?.rank_title || progress.rank_title || DEFAULT_RANK,
    rich_points: safeNumber(levelState?.rich_points, 0),
    coins: safeNumber(levelState?.coins, 0),
    trust_score: safeNumber(levelState?.trust_score, 100)
  };
}

export function getVirtualXpSummary(totalXp = 0) {
  const progress = buildXpProgress(totalXp);

  return {
    level: progress.level,
    xp_total: progress.xp_total,
    xp_current: progress.xp_current,
    xp_next: progress.xp_next,
    xp_percent: progress.xp_percent,
    xp_to_next: progress.xp_to_next,
    rank_title: progress.rank_title
  };
}

console.log("RB XP ENGINE READY");
