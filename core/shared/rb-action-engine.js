/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-action-engine.js

   GLOBAL ACTION ENGINE
   One event system for XP + money + analytics + notifications
========================= */

import { RB_TABLES } from "/core/shared/rb-config.js";

import {
  getUser,
  rbInsert
} from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity
} from "/core/shared/rb-profile.js";

import {
  awardXp
} from "/core/shared/rb-xp.js";

import {
  recordLivePurchaseCredit,
  recordProductSaleCredit,
  recordTipCredit,
  syncProfileBalance
} from "/core/shared/rb-economy.js";

function cleanKey(value = "activity") {
  return String(value || "activity")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .slice(0, 80);
}

function safeCents(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.floor(number)
    : fallback;
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
  try {
    const rows = await rbInsert({
      table: RB_TABLES.platformAnalyticsEvents,
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

    return rows?.[0] || null;
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
  if (!userId || !RB_TABLES.richNotifications) return null;

  try {
    const rows = await rbInsert({
      table: RB_TABLES.richNotifications,
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

    return rows?.[0] || null;
  } catch (error) {
    console.warn("[RB ACTION NOTIFICATION SKIPPED]", error?.message || error);
    return null;
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
  const user = getUser();
  const identity = getProfileIdentity();

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
    notification: null
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
      username: identity.username,
      display_name: identity.display_name,
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
        streamId: metadata.stream_id || null,
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

  window.dispatchEvent(
    new CustomEvent("rb:rich-action", {
      detail: result
    })
  );

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
    targetTable: RB_TABLES.uploads,
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
    title,
    targetUrl: "/feed",
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
    targetTable: RB_TABLES.musicTracks,
    targetType: "music_track",
    targetId: trackId,
    title,
    targetUrl: "/music",
    emoji: "🎵",
    metadata
  });
}

export async function actionLiveStarted({
  streamId,
  title = "",
  metadata = {}
} = {}) {
  return await runRichAction({
    action: "live_started",
    section: "live",
    targetTable: RB_TABLES.liveStreams,
    targetType: "live",
    targetId: streamId,
    targetUrl: metadata.slug ? `/watch?stream=${metadata.slug}` : "/live",
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

console.log("RB ACTION ENGINE READY");
