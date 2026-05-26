/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-moderation.js

   LIVE MODERATION ENGINE
   Ban / unban / delete chat / pin chat / report
========================= */

import { getSupabase } from "/core/shared/rb-supabase.js";

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

const MODERATION = {
  stream: null,
  user: null,
  profile: null,

  bans: [],
  reports: [],
  reviewQueue: [],

  banChannel: null,
  reportChannel: null,

  listeners: new Set()
};

function emitModeration() {
  const state = getLiveModerationState();

  MODERATION.listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      console.warn("[RB LIVE MODERATION LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-live-moderation-update", {
      detail: state
    })
  );
}

function isHostOrMod() {
  const role =
    MODERATION.profile?.role ||
    MODERATION.user?.role ||
    "";

  return Boolean(
    MODERATION.stream?.creator_id === MODERATION.user?.id ||
      ["founder", "rich_admin", "elite_mod", "admin", "moderator"].includes(role)
  );
}

export function getLiveModerationState() {
  return {
    stream: MODERATION.stream,
    user: MODERATION.user,
    profile: MODERATION.profile,
    bans: [...MODERATION.bans],
    reports: [...MODERATION.reports],
    reviewQueue: [...MODERATION.reviewQueue],
    canModerate: isHostOrMod()
  };
}

export function onLiveModeration(listener) {
  if (typeof listener !== "function") return () => {};

  MODERATION.listeners.add(listener);
  listener(getLiveModerationState());

  return () => {
    MODERATION.listeners.delete(listener);
  };
}

export async function loadLiveBans(streamId = MODERATION.stream?.id) {
  if (!streamId) return [];

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreamBans)
    .select("*")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[RB LIVE BANS LOAD]", error);
    return [];
  }

  MODERATION.bans = data || [];
  emitModeration();

  return MODERATION.bans;
}

export async function isUserBanned({
  streamId = MODERATION.stream?.id,
  userId = MODERATION.user?.id
} = {}) {
  if (!streamId || !userId) return false;

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreamBans)
    .select("id,expires_at")
    .eq("stream_id", streamId)
    .eq("banned_user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[RB LIVE BAN CHECK]", error);
    return false;
  }

  return Boolean(data?.id);
}

export async function banLiveUser({
  bannedUserId,
  reason = "Live moderation",
  expiresAt = null
} = {}) {
  if (!MODERATION.stream?.id) {
    throw new Error("No live stream selected.");
  }

  if (!bannedUserId) {
    throw new Error("Missing banned user id.");
  }

  if (!isHostOrMod()) {
    throw new Error("You do not have permission to ban users.");
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreamBans)
    .insert({
      stream_id: MODERATION.stream.id,
      banned_user_id: bannedUserId,
      banned_by: MODERATION.user?.id || null,
      reason,
      expires_at: expiresAt,
      metadata: {
        source: "live-moderation.js"
      }
    })
    .select("*")
    .single();

  if (error) throw error;

  await supabase
    .from(RB_TABLES.liveStreamMembers)
    .update({
      status: "blocked",
      left_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("stream_id", MODERATION.stream.id)
    .eq("user_id", bannedUserId);

  await supabase
    .from(RB_TABLES.richNotifications)
    .insert({
      user_id: bannedUserId,
      actor_id: MODERATION.user?.id || null,
      type: "live_banned",
      title: "Live access removed",
      body: reason,
      target_table: RB_TABLES.liveStreams,
      target_type: "live",
      target_id: MODERATION.stream.id,
      emoji: "🛡️",
      priority: "high",
      metadata: {
        source: "live-moderation.js"
      }
    });

  await loadLiveBans(MODERATION.stream.id);

  return data;
}

export async function unbanLiveUser({
  bannedUserId,
  banId = null
} = {}) {
  if (!MODERATION.stream?.id) {
    throw new Error("No live stream selected.");
  }

  if (!isHostOrMod()) {
    throw new Error("You do not have permission to unban users.");
  }

  const supabase = getSupabase();

  let query = supabase
    .from(RB_TABLES.liveStreamBans)
    .delete()
    .eq("stream_id", MODERATION.stream.id);

  if (banId) {
    query = query.eq("id", banId);
  } else if (bannedUserId) {
    query = query.eq("banned_user_id", bannedUserId);
  } else {
    throw new Error("Missing ban id or user id.");
  }

  const { error } = await query;

  if (error) throw error;

  if (bannedUserId) {
    await supabase
      .from(RB_TABLES.liveStreamMembers)
      .update({
        status: "left",
        updated_at: new Date().toISOString()
      })
      .eq("stream_id", MODERATION.stream.id)
      .eq("user_id", bannedUserId);
  }

  await loadLiveBans(MODERATION.stream.id);

  return true;
}

export async function deleteLiveChatMessage(messageId) {
  if (!messageId) {
    throw new Error("Missing message id.");
  }

  if (!isHostOrMod()) {
    throw new Error("You do not have permission to delete chat.");
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.liveChatMessages)
    .update({
      is_deleted: true,
      metadata: {
        moderated_by: MODERATION.user?.id || null,
        moderated_at: new Date().toISOString(),
        source: "live-moderation.js"
      }
    })
    .eq("id", messageId)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function pinLiveChatMessage(messageId, pinned = true) {
  if (!messageId) {
    throw new Error("Missing message id.");
  }

  if (!isHostOrMod()) {
    throw new Error("You do not have permission to pin chat.");
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.liveChatMessages)
    .update({
      is_pinned: Boolean(pinned)
    })
    .eq("id", messageId)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function reportLiveContent({
  targetTable = RB_TABLES.liveStreams,
  targetId = MODERATION.stream?.id,
  reportedUserId = null,
  reason = "Live report",
  details = ""
} = {}) {
  if (!targetTable || !targetId) {
    throw new Error("Missing report target.");
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.moderationReports)
    .insert({
      reporter_id: MODERATION.user?.id || null,
      reported_user_id: reportedUserId,
      target_table: targetTable,
      target_id: targetId,
      reason,
      details,
      status: "open",
      priority: "normal",
      metadata: {
        source: "live-moderation.js",
        stream_id: MODERATION.stream?.id || null
      }
    })
    .select("*")
    .single();

  if (error) throw error;

  await loadLiveReports();

  return data;
}

export async function addLiveReviewQueueItem({
  targetTable = RB_TABLES.liveStreams,
  targetId = MODERATION.stream?.id,
  creatorId = MODERATION.stream?.creator_id || null,
  flaggedReason = "Live review",
  reviewType = "live"
} = {}) {
  if (!isHostOrMod()) {
    throw new Error("You do not have permission to add review items.");
  }

  if (!targetTable || !targetId) {
    throw new Error("Missing review target.");
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.contentReviewQueue)
    .insert({
      target_table: targetTable,
      target_id: targetId,
      creator_id: creatorId,
      review_type: reviewType,
      status: "pending",
      flagged_reason: flaggedReason,
      metadata: {
        source: "live-moderation.js",
        stream_id: MODERATION.stream?.id || null
      }
    })
    .select("*")
    .single();

  if (error) throw error;

  await loadLiveReviewQueue();

  return data;
}

export async function loadLiveReports() {
  const supabase = getSupabase();

  let query = supabase
    .from(RB_TABLES.moderationReports)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (MODERATION.stream?.id) {
    query = query.eq("target_id", MODERATION.stream.id);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[RB LIVE REPORTS LOAD]", error);
    return [];
  }

  MODERATION.reports = data || [];
  emitModeration();

  return MODERATION.reports;
}

export async function loadLiveReviewQueue() {
  const supabase = getSupabase();

  let query = supabase
    .from(RB_TABLES.contentReviewQueue)
    .select("*")
    .eq("review_type", "live")
    .order("created_at", { ascending: false })
    .limit(50);

  if (MODERATION.stream?.id) {
    query = query.eq("target_id", MODERATION.stream.id);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[RB LIVE REVIEW QUEUE LOAD]", error);
    return [];
  }

  MODERATION.reviewQueue = data || [];
  emitModeration();

  return MODERATION.reviewQueue;
}

export function clearLiveModerationRealtime() {
  const supabase = getSupabase();

  if (MODERATION.banChannel) {
    supabase.removeChannel(MODERATION.banChannel);
  }

  if (MODERATION.reportChannel) {
    supabase.removeChannel(MODERATION.reportChannel);
  }

  MODERATION.banChannel = null;
  MODERATION.reportChannel = null;
}

export function bindLiveModerationRealtime(streamId = MODERATION.stream?.id) {
  if (!streamId) return null;

  const supabase = getSupabase();

  clearLiveModerationRealtime();

  MODERATION.banChannel = supabase
    .channel(`rb-live-bans-${streamId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.liveStreamBans,
        filter: `stream_id=eq.${streamId}`
      },
      () => loadLiveBans(streamId)
    )
    .subscribe();

  MODERATION.reportChannel = supabase
    .channel(`rb-live-reports-${streamId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.moderationReports,
        filter: `target_id=eq.${streamId}`
      },
      () => loadLiveReports()
    )
    .subscribe();

  return {
    banChannel: MODERATION.banChannel,
    reportChannel: MODERATION.reportChannel
  };
}

export async function initLiveModeration({
  stream,
  user = null,
  profile = null,
  realtime = true
} = {}) {
  MODERATION.stream = stream || null;
  MODERATION.user = user || null;
  MODERATION.profile = profile || null;

  MODERATION.bans = [];
  MODERATION.reports = [];
  MODERATION.reviewQueue = [];

  if (!MODERATION.stream?.id) {
    emitModeration();
    return getLiveModerationState();
  }

  await Promise.all([
    loadLiveBans(MODERATION.stream.id),
    loadLiveReports(),
    loadLiveReviewQueue()
  ]);

  if (realtime) {
    bindLiveModerationRealtime(MODERATION.stream.id);
  }

  return getLiveModerationState();
}

window.addEventListener("beforeunload", clearLiveModerationRealtime);

console.log("RB LIVE MODERATION READY");
