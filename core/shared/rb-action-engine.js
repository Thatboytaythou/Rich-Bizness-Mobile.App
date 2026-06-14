/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-action-engine.js

   GLOBAL ACTION ENGINE
   One event system for XP + money + analytics + notifications
   XP Gauge Bridge Enabled

   Source-of-truth rule:
   - rb-supabase.js owns identity
   - rb-action-engine.js routes actions into rb-xp.js
========================= */

import { RB_TABLES } from "/core/shared/rb-config.js";

import {
  getUser,
  getProfileIdentity,
  rbInsert
} from "/core/shared/rb-supabase.js";

import {
  awardXp
} from "/core/shared/rb-xp.js";

import {
  recordLivePurchaseCredit,
  recordProductSaleCredit,
  recordTipCredit,
  syncProfileBalance
} from "/core/shared/rb-economy.js";

function firstRow(result) {
  if (Array.isArray(result)) return result[0] || null;
  if (Array.isArray(result?.data)) return result.data[0] || null;
  return result || null;
}

function cleanKey(value = "activity") {
  return String(value || "activity")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "activity";
}

function safeCents(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? Math.floor(number)
    : fallback;
}

function safeIdentity() {
  try {
    return getProfileIdentity?.() || {};
  } catch {
    return {};
  }
}

function getXpValue(xpResult = null, fallbackXp = 0) {
  const value =
    xpResult?.progress?.xp_total ??
    xpResult?.level?.xp_total ??
    xpResult?.profile?.rich_points ??
    xpResult?.xp_total ??
    xpResult?.xp ??
    xpResult?.total_xp ??
    xpResult?.new_xp ??
    fallbackXp ??
    0;

  return Math.max(0, Number(value) || 0);
}

function getLevelValue(xpResult = null, fallbackLevel = 1) {
  const value =
    xpResult?.progress?.level ??
    xpResult?.level?.level ??
    xpResult?.profile?.rich_level ??
    xpResult?.level ??
    xpResult?.new_level ??
    fallbackLevel ??
    1;

  return Math.max(1, Number(value) || 1);
}

function getRankValue(xpResult = null, fallbackRank = "Member") {
  return (
    xpResult?.progress?.rank_title ||
    xpResult?.level?.rank_title ||
    xpResult?.profile?.rank_title ||
    xpResult?.rank ||
    xpResult?.rank_title ||
    xpResult?.profile?.rank ||
    fallbackRank ||
    "Member"
  );
}

function buildXpGaugePayload({
  route = "global",
  xpResult = null,
  fallbackXp = 0,
  fallbackLevel = 1,
  fallbackRank = "Member"
} = {}) {
  const xp = getXpValue(xpResult, fallbackXp);
  const level = getLevelValue(xpResult, fallbackLevel);
  const rank = getRankValue(xpResult, fallbackRank);

  const levelBase = Math.max(0, (level - 1) * 1000);
  const nextLevel = level * 1000;
  const span = Math.max(1, nextLevel - levelBase);
  const currentIntoLevel = Math.max(0, xp - levelBase);
  const percent = Math.max(0, Math.min(100, (currentIntoLevel / span) * 100));
  const remaining = Math.max(0, nextLevel - xp);

  return {
    route,
    xp,
    level,
    rank,
    nextLevel,
    remaining,
    percent
  };
}

function dispatchXpGaugeUpdate(detail = {}) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("rb:xp-gauge-update", {
      detail
    })
  );
}

async function logAnalytics({
  userId,
  eventKey,
  section,
  targetTable,
  targetId,
  valueCents = 0,
  metadata = {}
}) {
  const table = RB_TABLES.platformAnalyticsEvents;

  if (!table) return null;

  try {
    const rows = await rbInsert({
      table,
      values: {
        user_id: userId || null,
        event_name: eventKey,
        section: section || "global",
        target_table: targetTable || null,
        target_id: targetId || null,
        value_cents: safeCents(valueCents),
        metadata: {
          source: "rb-action-engine.js",
          ...metadata
        }
      }
    });

    return firstRow(rows);
  } catch (error) {
    console.warn("[RB ACTION ANALYTICS SKIPPED]", error?.message || error);
    return null;
  }
}

async function notifyUser({
  userId,
  actorId = null,
  type = "activity",
  title = "",
  body = "",
  targetTable = null,
  targetType = null,
  targetId = null,
  targetUrl = null,
  emoji = "💨",
  priority = "normal",
  metadata = {}
}) {
  const table = RB_TABLES.richNotifications || RB_TABLES.notifications;

  if (!userId || !table) return null;

  try {
    const rows = await rbInsert({
      table,
      values: {
        user_id: userId,
        actor_id: actorId,
        type,
        title,
        body,
        target_table: targetTable,
        target_type: targetType,
        target_id: targetId,
        target_url: targetUrl,
        emoji,
        priority,
        is_read: false,
        is_seen: false,
        is_silent: false,
        metadata: {
          source: "rb-action-engine.js",
          ...metadata
        }
      }
    });

    return firstRow(rows);
  } catch (error) {
    console.warn("[RB ACTION NOTIFICATION SKIPPED]", error?.message || error);
    return null;
  }
}

function dispatchRichAction(result) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("rb:rich-action", {
      detail: result
    })
  );

  if (result?.xp) {
    dispatchXpGaugeUpdate(
      buildXpGaugePayload({
        route: result.section || "global",
        xpResult: result.xp
      })
    );
  }
}

export async function runRichAction({
  action,
  section = "global",
  actorId = null,
  creatorId = null,
  sellerId = null,
  receiverId = null,
  targetTable = null,
  targetType = null,
  targetId = null,
  targetUrl = null,
  title = "",
  body = "",
  amountCents = 0,
  platformFeeCents = null,
  currency = "usd",
  xp = null,
  richPoints = null,
  coins = null,
  notify = true,
  notifyUserId = null,
  notifyTitle = "",
  notifyBody = "",
  emoji = "💨",
  metadata = {}
} = {}) {
  const user = getUser?.() || null;
  const identity = safeIdentity();

  const eventKey = cleanKey(action || `${section}_activity`);
  const userId = actorId || user?.id || null;

  const result = {
    ok: true,
    action: eventKey,
    section,
    user_id: userId,
    xp: null,
    economy: null,
    analytics: null,
    notification: null,
    warnings: []
  };

  result.analytics = await logAnalytics({
    userId,
    eventKey,
    section,
    targetTable,
    targetId,
    valueCents: amountCents,
    metadata: {
      title,
      body,
      target_type: targetType,
      target_url: targetUrl,
      username: identity.username || null,
      display_name: identity.display_name || null,
      ...metadata
    }
  });

  if (userId) {
    try {
      result.xp = await awardXp({
        eventKey,
        userId,
        xp,
        richPoints,
        coins,
        section,
        sourceTable: targetTable,
        sourceId: targetId,
        metadata: {
          title,
          target_type: targetType,
          target_url: targetUrl,
          ...metadata
        }
      });
    } catch (error) {
      result.warnings.push("xp_skipped");
      console.warn("[RB ACTION XP SKIPPED]", error?.message || error);
    }
  }

  try {
    if (eventKey === "product_sold" && sellerId) {
      result.economy = await recordProductSaleCredit({
        sellerId,
        orderId: targetId,
        productId: metadata.product_id || null,
        amountCents,
        platformFeeCents,
        currency,
        metadata
      });

      await syncProfileBalance(sellerId);
    }

    if (eventKey === "live_access_paid" && creatorId) {
      result.economy = await recordLivePurchaseCredit({
        creatorId,
        streamId: metadata.stream_id || targetId || null,
        purchaseId: targetId,
        amountCents,
        platformFeeCents,
        currency,
        metadata
      });

      await syncProfileBalance(creatorId);
    }

    if (eventKey === "tip_paid" && receiverId) {
      result.economy = await recordTipCredit({
        streamId: metadata.stream_id || null,
        fromUserId: userId,
        toUserId: receiverId,
        amountCents,
        currency,
        message: body,
        status: "paid",
        metadata
      });

      await syncProfileBalance(receiverId);
    }
  } catch (error) {
    result.warnings.push("economy_skipped");
    console.warn("[RB ACTION ECONOMY SKIPPED]", error?.message || error);
  }

  if (notify && notifyUserId) {
    result.notification = await notifyUser({
      userId: notifyUserId,
      actorId: userId,
      type: eventKey,
      title: notifyTitle || title || "Rich Bizness update",
      body: notifyBody || body || "Something new happened.",
      targetTable,
      targetType,
      targetId,
      targetUrl,
      emoji,
      metadata
    });
  }

  dispatchRichAction(result);

  return result;
}

export async function actionUploadCreated({
  section = "upload",
  uploadId = null,
  title = "",
  metadata = {}
} = {}) {
  return await runRichAction({
    action: "upload_created",
    section,
    targetTable: RB_TABLES.uploads || "uploads",
    targetType: "upload",
    targetId: uploadId,
    title,
    emoji: "⬆️",
    metadata
  });
}

export async function actionFeedPostCreated({
  postId,
  title = "",
  metadata = {}
} = {}) {
  return await runRichAction({
    action: "feed_post_created",
    section: "feed",
    targetTable: RB_TABLES.feedPosts,
    targetType: "feed_post",
    targetId: postId,
    targetUrl: "/feed",
    title,
    emoji: "🔥",
    metadata
  });
}

export async function actionMusicUploaded({
  trackId,
  title = "",
  metadata = {}
} = {}) {
  return await runRichAction({
    action: "music_uploaded",
    section: "music",
    targetTable: RB_TABLES.musicTracks || RB_TABLES.tracks,
    targetType: "music_track",
    targetId: trackId,
    targetUrl: "/music",
    title,
    emoji: "🎵",
    metadata
  });
}

export async function actionLiveStarted({
  streamId,
  title = "",
  metadata = {}
} = {}) {
  const streamKey = metadata.slug || streamId || "";

  return await runRichAction({
    action: "live_started",
    section: "live",
    targetTable: RB_TABLES.liveStreams,
    targetType: "live",
    targetId: streamId,
    targetUrl: streamKey ? `/watch?stream=${encodeURIComponent(streamKey)}` : "/live",
    title,
    emoji: "📺",
    metadata
  });
}

export async function actionGameScoreSubmitted({
  scoreId,
  title = "",
  metadata = {}
} = {}) {
  return await runRichAction({
    action: "game_score_submitted",
    section: "gaming",
    targetTable: RB_TABLES.gameScores,
    targetType: "game_score",
    targetId: scoreId,
    targetUrl: "/gaming",
    title,
    emoji: "🎮",
    metadata
  });
}

export async function actionSportsUploadCreated({
  uploadId,
  title = "",
  metadata = {}
} = {}) {
  return await runRichAction({
    action: "sports_upload_created",
    section: "sports",
    targetTable: RB_TABLES.sportsUploads,
    targetType: "sports_upload",
    targetId: uploadId,
    targetUrl: "/sports",
    title,
    emoji: "🏆",
    metadata
  });
}

export async function actionProductCreated({
  productId,
  title = "",
  metadata = {}
} = {}) {
  return await runRichAction({
    action: "product_created",
    section: "store",
    targetTable: RB_TABLES.products,
    targetType: "product",
    targetId: productId,
    targetUrl: "/store",
    title,
    emoji: "🛒",
    metadata
  });
}

export async function actionProductSold({
  orderId,
  sellerId,
  productId = null,
  title = "",
  amountCents = 0,
  platformFeeCents = null,
  currency = "usd",
  metadata = {}
} = {}) {
  return await runRichAction({
    action: "product_sold",
    section: "store",
    sellerId,
    targetTable: RB_TABLES.storeOrders,
    targetType: "store_order",
    targetId: orderId,
    title,
    amountCents,
    platformFeeCents,
    currency,
    notifyUserId: sellerId,
    notifyTitle: "Product sold",
    notifyBody: title || "You made a store sale.",
    emoji: "💸",
    metadata: {
      product_id: productId,
      ...metadata
    }
  });
}

export async function actionLiveAccessPaid({
  purchaseId,
  creatorId,
  streamId,
  title = "",
  amountCents = 0,
  platformFeeCents = null,
  currency = "usd",
  metadata = {}
} = {}) {
  return await runRichAction({
    action: "live_access_paid",
    section: "live",
    creatorId,
    targetTable: RB_TABLES.liveStreamPurchases,
    targetType: "live_purchase",
    targetId: purchaseId,
    targetUrl: streamId ? `/watch?stream=${encodeURIComponent(streamId)}` : "/watch",
    title,
    amountCents,
    platformFeeCents,
    currency,
    notifyUserId: creatorId,
    notifyTitle: "Live access purchased",
    notifyBody: title || "Someone unlocked your live stream.",
    emoji: "📺",
    metadata: {
      stream_id: streamId,
      ...metadata
    }
  });
}

export async function actionTipPaid({
  tipId = null,
  receiverId,
  streamId = null,
  title = "",
  body = "",
  amountCents = 0,
  currency = "usd",
  metadata = {}
} = {}) {
  return await runRichAction({
    action: "tip_paid",
    section: "live",
    receiverId,
    targetTable: RB_TABLES.liveTips,
    targetType: "tip",
    targetId: tipId,
    targetUrl: streamId ? `/watch?stream=${encodeURIComponent(streamId)}` : "/watch",
    title,
    body,
    amountCents,
    currency,
    notifyUserId: receiverId,
    notifyTitle: "New tip received",
    notifyBody: body || "Someone sent you a tip.",
    emoji: "💸",
    metadata: {
      stream_id: streamId,
      ...metadata
    }
  });
}

console.log("RB ACTION ENGINE READY");
