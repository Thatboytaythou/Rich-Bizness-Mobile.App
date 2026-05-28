import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY)
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

async function safeInsert(table, payload) {
  try {
    await supabase.from(table).insert(payload);
  } catch (error) {
    console.warn(`[${table}] optional insert skipped`, error?.message || error);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
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
      return json(res, 401, { ok: false, error: "Login required" });
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

    const bannedUserId = clean(body.banned_user_id || body.bannedUserId);
    const reason = clean(body.reason, "Removed from live stream");
    const expiresAt = body.expires_at || body.expiresAt || null;

    if (!streamKey || !bannedUserId) {
      return json(res, 400, {
        ok: false,
        error: "stream_id/slug/room and banned_user_id are required"
      });
    }

    const stream = await findStream(streamKey);

    if (!stream?.id) {
      return json(res, 404, { ok: false, error: "Live stream not found" });
    }

    const { data: member } = await supabase
      .from("live_stream_members")
      .select("role, status")
      .eq("stream_id", stream.id)
      .eq("user_id", user.id)
      .maybeSingle();

    const isHost = stream.creator_id === user.id;
    const canModerate =
      isHost || ["host", "cohost", "moderator"].includes(member?.role);

    if (!canModerate) {
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

    const banPayload = {
      stream_id: stream.id,
      banned_user_id: bannedUserId,
      banned_by: user.id,
      reason,
      expires_at: expiresAt,
      metadata: {
        app: "Rich Bizness Mobile",
        source: "api/live-moderation-ban",
        stream_title: stream.title || null,
        stream_slug: stream.slug || null,
        livekit_room_name: stream.livekit_room_name || null
      }
    };

    const { data: ban, error: banError } = await supabase
      .from("live_stream_bans")
      .upsert(banPayload, {
        onConflict: "stream_id,banned_user_id"
      })
      .select("*")
      .single();

    if (banError) throw banError;

    await supabase
      .from("live_stream_members")
      .update({
        status: "blocked",
        left_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          blocked_by: user.id,
          reason,
          source: "api/live-moderation-ban"
        }
      })
      .eq("stream_id", stream.id)
      .eq("user_id", bannedUserId);

    await supabase
      .from("live_view_sessions")
      .update({
        left_at: new Date().toISOString(),
        metadata: {
          ended_by: "moderation_ban",
          banned_by: user.id,
          reason
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
        source: "api/live-moderation-ban"
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
        reason
      }
    });

    return json(res, 200, {
      ok: true,
      ban,
      stream_id: stream.id
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error?.message || "Failed to ban user from live stream"
    });
  }
}
