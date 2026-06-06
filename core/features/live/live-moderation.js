/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-moderation.js

   LIVE MODERATION ENGINE
   Ban / unban / delete chat / pin chat / report
   Safe Tables + Realtime + Permission Lock
========================= */

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

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
  reviewChannel: null,

  ready: false,
  loading: false,
  error: null,

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

  window.dispatchEvent(
    new CustomEvent("rb:live-moderation-state", {
      detail: state
    })
  );
}

function roleKey() {
  return String(
    MODERATION.profile?.role ||
      MODERATION.user?.role ||
      MODERATION.profile?.role_key ||
      ""
  ).toLowerCase();
}

function isHostOrMod() {
  const role = roleKey();

  return Boolean(
    MODERATION.stream?.creator_id === MODERATION.user?.id ||
      [
        "founder",
        "rich_admin",
        "elite_mod",
        "admin",
        "moderator",
        "support",
        "owner",
        "super_admin"
      ].includes(role)
  );
}

function displayName() {
  return (
    MODERATION.profile?.display_name ||
    MODERATION.profile?.full_name ||
    MODERATION.profile?.username ||
    MODERATION.user?.email?.split("@")[0] ||
    "Rich Moderator"
  );
}

function username() {
  return (
    MODERATION.profile?.username ||
    MODERATION.user?.email?.split("@")[0] ||
    "moderator"
  );
}

function metadataWithPatch(existing = {}, patch = {}) {
  return {
    ...(existing || {}),
    ...patch
  };
}

function notifyTable() {
  return RB_TABLES.richNotifications || RB_TABLES.notifications;
}

function reportsTable() {
  return RB_TABLES.moderationReports || RB_TABLES.contentReviewQueue;
}

function normalizeBan(row = {}) {
  return {
    ...row,
    reason: row.reason || row.metadata?.reason || "Live moderation",
    banned_user_id: row.banned_user_id || row.user_id || null
  };
}

function normalizeReport(row = {}) {
  return {
    ...row,
    reason: row.reason || row.flagged_reason || "Live report",
    details: row.details || row.description || ""
  };
}

function requireStream() {
  if (!MODERATION.stream?.id) {
    throw new Error("No live stream selected.");
  }

  return MODERATION.stream;
}

function requireModerator() {
  if (!isHostOrMod()) {
    throw new Error("You do not have permission to moderate this live.");
  }

  return true;
}

async function safeInsert(table, payload) {
  if (!table) return null;

  try {
    const { data, error } = await getSupabase()
      .from(table)
      .insert(payload)
      .select("*")
      .maybeSingle();

    if (error) throw error;

    return data || null;
  } catch (error) {
    console.warn(`[RB LIVE MOD INSERT SKIPPED: ${table}]`, error?.message || error);
    return null;
  }
}

async function safeUpdate(table, match = {}, values = {}) {
  if (!table) return null;

  try {
    let query = getSupabase().from(table).update(values);

    Object.entries(match).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    const { data, error } = await query.select("*").maybeSingle();

    if (error) throw error;

    return data || null;
  } catch (error) {
    console.warn(`[RB LIVE MOD UPDATE SKIPPED: ${table}]`, error?.message || error);
    return null;
  }
}

export function getLiveModerationState() {
  return {
    ready: MODERATION.ready,
    loading: MODERATION.loading,
    error: MODERATION.error,
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

  try {
    listener(getLiveModerationState());
  } catch (error) {
    console.warn("[RB LIVE MODERATION LISTENER]", error);
  }

  return () => {
    MODERATION.listeners.delete(listener);
  };
}

export async function loadLiveBans(streamId = MODERATION.stream?.id) {
  if (!streamId || !RB_TABLES.liveStreamBans) {
    MODERATION.bans = [];
    emitModeration();
    return [];
  }

  const supabase = getSupabase();

  try {
    const { data, error } = await supabase
      .from(RB_TABLES.liveStreamBans)
      .select("*")
      .eq("stream_id", streamId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    MODERATION.bans = (data || []).map(normalizeBan);
    emitModeration();

    return MODERATION.bans;
  } catch (error) {
    console.warn("[RB LIVE BANS LOAD]", error?.message || error);
    MODERATION.bans = [];
    emitModeration();
    return [];
  }
}

export async function isUserBanned({
  streamId = MODERATION.stream?.id,
  userId = MODERATION.user?.id
} = {}) {
  if (!streamId || !userId || !RB_TABLES.liveStreamBans) return false;

  const supabase = getSupabase();

  try {
    const { data, error } = await supabase
      .from(RB_TABLES.liveStreamBans)
      .select("id,expires_at")
      .eq("stream_id", streamId)
      .eq("banned_user_id", userId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return Boolean(data?.id);
  } catch (error) {
    console.warn("[RB LIVE BAN CHECK]", error?.message || error);
    return false;
  }
}

export async function banLiveUser({
  bannedUserId,
  reason = "Live moderation",
  expiresAt = null
} = {}) {
  requireStream();
  requireModerator();

  if (!bannedUserId) {
    throw new Error("Missing banned user id.");
  }

  if (!RB_TABLES.liveStreamBans) {
    throw new Error("Live bans table not configured.");
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();

  const payload = {
    stream_id: MODERATION.stream.id,
    banned_user_id: bannedUserId,
    banned_by: MODERATION.user?.id || null,
    reason,
    expires_at: expiresAt,
    metadata: {
      source: "live-moderation.js",
      moderator_username: username(),
      moderator_display_name: displayName()
    }
  };

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreamBans)
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  await safeUpdate(
    RB_TABLES.liveStreamMembers,
    {
      stream_id: MODERATION.stream.id,
      user_id: bannedUserId
    },
    {
      status: "blocked",
      left_at: now,
      updated_at: now
    }
  );

  await safeInsert(notifyTable(), {
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
      source: "live-moderation.js",
      stream_id: MODERATION.stream.id,
      moderator_username: username()
    }
  });

  await loadLiveBans(MODERATION.stream.id);

  return normalizeBan(data || payload);
}

export async function unbanLiveUser({
  bannedUserId,
  banId = null
} = {}) {
  requireStream();
  requireModerator();

  if (!RB_TABLES.liveStreamBans) {
    throw new Error("Live bans table not configured.");
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
    await safeUpdate(
      RB_TABLES.liveStreamMembers,
      {
        stream_id: MODERATION.stream.id,
        user_id: bannedUserId
      },
      {
        status: "left",
        updated_at: new Date().toISOString()
      }
    );
  }

  await loadLiveBans(MODERATION.stream.id);

  return true;
}

export async function deleteLiveChatMessage(messageId) {
  requireModerator();

  if (!messageId) {
    throw new Error("Missing message id.");
  }

  if (!RB_TABLES.liveChatMessages) {
    throw new Error("Live chat table not configured.");
  }

  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from(RB_TABLES.liveChatMessages)
    .select("metadata")
    .eq("id", messageId)
    .maybeSingle();

  const { data, error } = await supabase
    .from(RB_TABLES.liveChatMessages)
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: metadataWithPatch(existing?.metadata, {
        moderated_by: MODERATION.user?.id || null,
        moderator_username: username(),
        moderated_at: new Date().toISOString(),
        source: "live-moderation.js"
      })
    })
    .eq("id", messageId)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  return data || null;
}

export async function pinLiveChatMessage(messageId, pinned = true) {
  requireModerator();

  if (!messageId) {
    throw new Error("Missing message id.");
  }

  if (!RB_TABLES.liveChatMessages) {
    throw new Error("Live chat table not configured.");
  }

  const { data, error } = await getSupabase()
    .from(RB_TABLES.liveChatMessages)
    .update({
      is_pinned: Boolean(pinned),
      updated_at: new Date().toISOString()
    })
    .eq("id", messageId)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  return data || null;
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

  const table = reportsTable();

  if (!table) {
    throw new Error("Moderation reports table not configured.");
  }

  const payload =
    table === RB_TABLES.contentReviewQueue
      ? {
          target_table: targetTable,
          target_id: targetId,
          creator_id: reportedUserId || MODERATION.stream?.creator_id || null,
          review_type: "live",
          status: "pending",
          flagged_reason: reason,
          metadata: {
            source: "live-moderation.js",
            stream_id: MODERATION.stream?.id || null,
            reporter_id: MODERATION.user?.id || null,
            details
          }
        }
      : {
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
        };

  const data = await safeInsert(table, payload);

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
  requireModerator();

  if (!targetTable || !targetId) {
    throw new Error("Missing review target.");
  }

  if (!RB_TABLES.contentReviewQueue) {
    throw new Error("Content review queue table not configured.");
  }

  const data = await safeInsert(RB_TABLES.contentReviewQueue, {
    target_table: targetTable,
    target_id: targetId,
    creator_id: creatorId,
    reviewed_by: MODERATION.user?.id || null,
    review_type: reviewType,
    status: "pending",
    flagged_reason: flaggedReason,
    metadata: {
      source: "live-moderation.js",
      stream_id: MODERATION.stream?.id || null,
      moderator_username: username()
    }
  });

  await loadLiveReviewQueue();

  return data;
}

export async function loadLiveReports() {
  const table = reportsTable();

  if (!table) {
    MODERATION.reports = [];
    emitModeration();
    return [];
  }

  const supabase = getSupabase();

  try {
    let query = supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (MODERATION.stream?.id) {
      query =
        table === RB_TABLES.contentReviewQueue
          ? query.eq("target_id", MODERATION.stream.id)
          : query.eq("target_id", MODERATION.stream.id);
    }

    const { data, error } = await query;

    if (error) throw error;

    MODERATION.reports = (data || []).map(normalizeReport);
    emitModeration();

    return MODERATION.reports;
  } catch (error) {
    console.warn("[RB LIVE REPORTS LOAD]", error?.message || error);
    MODERATION.reports = [];
    emitModeration();
    return [];
  }
}

export async function loadLiveReviewQueue() {
  if (!RB_TABLES.contentReviewQueue) {
    MODERATION.reviewQueue = [];
    emitModeration();
    return [];
  }

  const supabase = getSupabase();

  try {
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

    if (error) throw error;

    MODERATION.reviewQueue = data || [];
    emitModeration();

    return MODERATION.reviewQueue;
  } catch (error) {
    console.warn("[RB LIVE REVIEW QUEUE LOAD]", error?.message || error);
    MODERATION.reviewQueue = [];
    emitModeration();
    return [];
  }
}

export function clearLiveModerationRealtime() {
  const supabase = getSupabase();

  if (MODERATION.banChannel && supabase) {
    supabase.removeChannel(MODERATION.banChannel);
  }

  if (MODERATION.reportChannel && supabase) {
    supabase.removeChannel(MODERATION.reportChannel);
  }

  if (MODERATION.reviewChannel && supabase) {
    supabase.removeChannel(MODERATION.reviewChannel);
  }

  MODERATION.banChannel = null;
  MODERATION.reportChannel = null;
  MODERATION.reviewChannel = null;
}

export function bindLiveModerationRealtime(streamId = MODERATION.stream?.id) {
  if (!streamId) return null;

  const supabase = getSupabase();

  clearLiveModerationRealtime();

  if (RB_TABLES.liveStreamBans) {
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
  }

  const table = reportsTable();

  if (table) {
    MODERATION.reportChannel = supabase
      .channel(`rb-live-reports-${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `target_id=eq.${streamId}`
        },
        () => loadLiveReports()
      )
      .subscribe();
  }

  if (RB_TABLES.contentReviewQueue) {
    MODERATION.reviewChannel = supabase
      .channel(`rb-live-review-${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: RB_TABLES.contentReviewQueue,
          filter: `target_id=eq.${streamId}`
        },
        () => loadLiveReviewQueue()
      )
      .subscribe();
  }

  return {
    banChannel: MODERATION.banChannel,
    reportChannel: MODERATION.reportChannel,
    reviewChannel: MODERATION.reviewChannel
  };
}

export async function initLiveModeration({
  stream,
  user = null,
  profile = null,
  realtime = true
} = {}) {
  clearLiveModerationRealtime();

  MODERATION.stream = stream || null;
  MODERATION.user = user || null;
  MODERATION.profile = profile || null;

  MODERATION.bans = [];
  MODERATION.reports = [];
  MODERATION.reviewQueue = [];
  MODERATION.ready = false;
  MODERATION.loading = false;
  MODERATION.error = null;

  if (!MODERATION.stream?.id) {
    MODERATION.ready = true;
    emitModeration();
    return getLiveModerationState();
  }

  MODERATION.loading = true;
  emitModeration();

  try {
    await Promise.allSettled([
      loadLiveBans(MODERATION.stream.id),
      loadLiveReports(),
      loadLiveReviewQueue()
    ]);

    if (realtime) {
      bindLiveModerationRealtime(MODERATION.stream.id);
    }

    MODERATION.ready = true;
    MODERATION.error = null;
  } catch (error) {
    MODERATION.error = error;
    console.warn("[RB LIVE MODERATION INIT FAILED]", error?.message || error);
  } finally {
    MODERATION.loading = false;
    emitModeration();
  }

  return getLiveModerationState();
}

export function resetLiveModeration() {
  clearLiveModerationRealtime();

  MODERATION.stream = null;
  MODERATION.user = null;
  MODERATION.profile = null;
  MODERATION.bans = [];
  MODERATION.reports = [];
  MODERATION.reviewQueue = [];
  MODERATION.ready = false;
  MODERATION.loading = false;
  MODERATION.error = null;

  emitModeration();
}

window.addEventListener("beforeunload", clearLiveModerationRealtime);

console.log("RB LIVE MODERATION READY");
