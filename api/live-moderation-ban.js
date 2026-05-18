import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function json(res, status, payload) {
  res.status(status).json(payload);
}

async function getUserFromRequest(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  return data.user;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return json(res, 401, { ok: false, error: "Login required" });
    }

    const {
      stream_id,
      banned_user_id,
      reason = "Removed from live stream",
      expires_at = null
    } = req.body || {};

    if (!stream_id || !banned_user_id) {
      return json(res, 400, {
        ok: false,
        error: "stream_id and banned_user_id are required"
      });
    }

    const { data: stream, error: streamError } = await supabase
      .from("live_streams")
      .select("id, creator_id, status, title")
      .eq("id", stream_id)
      .single();

    if (streamError || !stream) {
      return json(res, 404, { ok: false, error: "Live stream not found" });
    }

    const { data: member } = await supabase
      .from("live_stream_members")
      .select("role, status")
      .eq("stream_id", stream_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const isHost = stream.creator_id === user.id;
    const canModerate =
      isHost ||
      ["host", "cohost", "moderator"].includes(member?.role) ||
      false;

    if (!canModerate) {
      return json(res, 403, {
        ok: false,
        error: "You do not have permission to ban users from this stream"
      });
    }

    if (banned_user_id === stream.creator_id) {
      return json(res, 400, {
        ok: false,
        error: "The stream creator cannot be banned"
      });
    }

    const banPayload = {
      stream_id,
      banned_user_id,
      banned_by: user.id,
      reason,
      expires_at,
      metadata: {
        source: "api/live-moderation-ban",
        stream_title: stream.title || null
      }
    };

    const { data: ban, error: banError } = await supabase
      .from("live_stream_bans")
      .insert(banPayload)
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
          reason
        }
      })
      .eq("stream_id", stream_id)
      .eq("user_id", banned_user_id);

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
      .eq("stream_id", stream_id)
      .eq("user_id", banned_user_id)
      .is("left_at", null);

    await supabase.from("rich_notifications").insert({
      user_id: banned_user_id,
      actor_id: user.id,
      type: "live_ban",
      title: "Removed from live stream",
      body: reason,
      target_table: "live_streams",
      target_type: "live",
      target_id: stream_id,
      target_url: `/watch.html?stream=${stream_id}`,
      emoji: "🚫",
      priority: "high",
      metadata: {
        stream_id,
        ban_id: ban.id
      }
    });

    await supabase.from("admin_audit_logs").insert({
      admin_id: user.id,
      action: "live_stream_ban",
      target_table: "live_stream_bans",
      target_id: ban.id,
      severity: "high",
      metadata: {
        stream_id,
        banned_user_id,
        reason
      }
    });

    return json(res, 200, {
      ok: true,
      ban
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error?.message || "Failed to ban user from live stream"
    });
  }
}
