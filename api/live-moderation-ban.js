import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      })
    : null;

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function clean(value, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function validDateOrNull(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

async function getUserFromRequest(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) return null;

  return data.user;
}

async function findStream(streamKey) {
  if (isUuid(streamKey)) {
    const { data } = await supabase
      .from("live_streams")
      .select("id, creator_id, status, title, slug, livekit_room_name")
      .eq("id", streamKey)
      .maybeSingle();

    if (data) return data;
  }

  const { data } = await supabase
    .from("live_streams")
    .select("id, creator_id, status, title, slug, livekit_room_name")
    .or(`slug.eq.${streamKey},livekit_room_name.eq.${streamKey}`)
    .maybeSingle();

  return data || null;
}

async function getProfile(userId) {
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, is_creator, is_verified")
    .eq("id", userId)
    .maybeSingle();

  return data || null;
}

async function safeInsert(table, payload) {
  try {
    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select("*")
      .maybeSingle();

    if (error) throw error;

    return data || null;
  } catch (error) {
    console.warn(`[${table}] optional insert skipped`, error?.message || error);
    return null;
  }
}

async function getModeratorMembership(streamId, userId) {
  const { data } = await supabase
    .from("live_stream_members")
    .select("role, status")
    .eq("stream_id", streamId)
    .eq("user_id", userId)
    .maybeSingle();

  return data || null;
}

function canModerate({ user, profile, stream, member }) {
  if (!user?.id) return false;
  if (stream.creator_id === user.id) return true;

  const appRole = clean(profile?.role).toLowerCase();
  const streamRole = clean(member?.role).toLowerCase();

  return (
    [
      "founder",
      "rich_admin",
      "elite_mod",
      "admin",
      "moderator",
      "support"
    ].includes(appRole) ||
    [
      "host",
      "cohost",
      "moderator"
    ].includes(streamRole)
  );
}

async function upsertBan(banPayload) {
  const { data: existing } = await supabase
    .from("live_stream_bans")
    .select("id, metadata")
    .eq("stream_id", banPayload.stream_id)
    .eq("banned_user_id", banPayload.banned_user_id)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("live_stream_bans")
      .update({
        ...banPayload,
        metadata: {
          ...(existing.metadata || {}),
          ...(banPayload.metadata || {}),
          updated_by_api: true
        }
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw error;

    return data;
  }

  const { data, error } = await supabase
    .from("live_stream_bans")
    .insert(banPayload)
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return json(res, 405, {
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    if (!supabase) {
      return json(res, 500, {
        ok: false,
        error: "Missing Supabase server environment variables"
      });
    }

    const user = await getUserFromRequest(req);

    if (!user?.id) {
      return json(res, 401, {
        ok: false,
        error: "Login required"
      });
    }

    const body = req.body || {};

    const streamKey = clean(
      body.stream_id ||
        body.streamId ||
        body.slug ||
        body.room ||
        body.roomName ||
        body.livekit_room_name
    );

    const bannedUserId = clean(
      body.banned_user_id ||
        body.bannedUserId ||
        body.user_id ||
        body.userId
    );

    const reason = clean(body.reason, "Removed from live stream");
    const expiresAt = validDateOrNull(body.expires_at || body.expiresAt);

    if (!streamKey || !bannedUserId) {
      return json(res, 400, {
        ok: false,
        error: "stream_id/slug/room and banned_user_id are required"
      });
    }

    if (!isUuid(bannedUserId)) {
      return json(res, 400, {
        ok: false,
        error: "banned_user_id must be a valid user id"
      });
    }

    const stream = await findStream(streamKey);

    if (!stream?.id) {
      return json(res, 404, {
        ok: false,
        error: "Live stream not found"
      });
    }

    const [profile, member] = await Promise.all([
      getProfile(user.id),
      getModeratorMembership(stream.id, user.id)
    ]);

    if (!canModerate({ user, profile, stream, member })) {
      return json(res, 403, {
        ok: false,
        error: "You do not have permission to ban users from this stream"
      });
    }

    if (bannedUserId === stream.creator_id) {
      return json(res, 400, {
        ok: false,
        error: "The stream creator cannot be banned"
      });
    }

    if (bannedUserId === user.id) {
      return json(res, 400, {
        ok: false,
        error: "You cannot ban yourself"
      });
    }

    const now = new Date().toISOString();

    const banPayload = {
      stream_id: stream.id,
      banned_user_id: bannedUserId,
      banned_by: user.id,
      reason,
      expires_at: expiresAt,
      metadata: {
        app: "Rich Bizness Mobile",
        source: "api/live-moderation-ban.js",
        stream_title: stream.title || null,
        stream_slug: stream.slug || null,
        livekit_room_name: stream.livekit_room_name || null,
        moderated_by_role: profile?.role || member?.role || "host",
        moderated_at: now
      }
    };

    const ban = await upsertBan(banPayload);

    await supabase
      .from("live_stream_members")
      .update({
        status: "blocked",
        left_at: now,
        updated_at: now,
        metadata: {
          blocked_by: user.id,
          reason,
          source: "api/live-moderation-ban.js"
        }
      })
      .eq("stream_id", stream.id)
      .eq("user_id", bannedUserId);

    await supabase
      .from("live_view_sessions")
      .update({
        left_at: now,
        metadata: {
          ended_by: "moderation_ban",
          banned_by: user.id,
          reason,
          source: "api/live-moderation-ban.js"
        }
      })
      .eq("stream_id", stream.id)
      .eq("user_id", bannedUserId)
      .is("left_at", null);

    await safeInsert("rich_notifications", {
      user_id: bannedUserId,
      actor_id: user.id,
      type: "live_ban",
      title: "Removed from live stream",
      body: reason,
      target_table: "live_streams",
      target_type: "live",
      target_id: stream.id,
      target_url: `/watch?stream=${encodeURIComponent(stream.slug || stream.id)}`,
      emoji: "🚫",
      priority: "high",
      metadata: {
        stream_id: stream.id,
        ban_id: ban.id,
        source: "api/live-moderation-ban.js"
      }
    });

    await safeInsert("admin_audit_logs", {
      admin_id: user.id,
      action: "live_stream_ban",
      target_table: "live_stream_bans",
      target_id: ban.id,
      severity: "high",
      metadata: {
        stream_id: stream.id,
        banned_user_id: bannedUserId,
        reason,
        source: "api/live-moderation-ban.js"
      }
    });

    await safeInsert("moderation_reports", {
      reporter_id: user.id,
      reported_user_id: bannedUserId,
      target_table: "live_streams",
      target_id: stream.id,
      reason,
      details: "Live stream moderation ban",
      status: "resolved",
      priority: "high",
      metadata: {
        ban_id: ban.id,
        source: "api/live-moderation-ban.js"
      }
    });

    return json(res, 200, {
      ok: true,
      ban,
      stream_id: stream.id,
      banned_user_id: bannedUserId
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error?.message || "Failed to ban user from live stream"
    });
  }
}
