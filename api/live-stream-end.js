const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function json(res, status, data) {
  return res.status(status).json(data);
}

function cleanText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || data?.hint || `Supabase failed ${response.status}`);
  }

  return data;
}

async function getUserFromAuth(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) return null;

  return response.json();
}

async function findStream(streamKey) {
  const value = encodeURIComponent(streamKey);

  const rows = await supabaseFetch(
    `/live_streams?or=(id.eq.${value},slug.eq.${value},livekit_room_name.eq.${value})&select=*`
  );

  return rows?.[0] || null;
}

async function getProfile(userId) {
  if (!userId) return null;

  const rows = await supabaseFetch(
    `/profiles?id=eq.${encodeURIComponent(userId)}&select=id,username,display_name,role,is_creator,is_verified&limit=1`
  );

  return rows?.[0] || null;
}

function canEndStream({ user, profile, stream }) {
  if (!user?.id) return false;
  if (stream.creator_id === user.id) return true;

  const role = cleanText(profile?.role).toLowerCase();
  return role === "admin" || role === "founder" || role === "rich_admin";
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
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(res, 500, {
        ok: false,
        error: "Missing Supabase server environment variables"
      });
    }

    const user = await getUserFromAuth(req);
    const body = req.body || {};

    const streamKey = cleanText(
      body.stream_id || body.streamId || body.id || body.slug || body.room || body.livekit_room_name
    );

    if (!streamKey) {
      return json(res, 400, {
        ok: false,
        error: "Missing stream_id or slug"
      });
    }

    const stream = await findStream(streamKey);

    if (!stream) {
      return json(res, 404, {
        ok: false,
        error: "Live stream not found"
      });
    }

    const profile = await getProfile(user?.id);

    if (!canEndStream({ user, profile, stream })) {
      return json(res, 403, {
        ok: false,
        error: "Only the host or admin can end this stream"
      });
    }

    if (stream.status === "ended") {
      return json(res, 200, {
        ok: true,
        stream,
        alreadyEnded: true
      });
    }

    const now = new Date().toISOString();

    const updated = await supabaseFetch(`/live_streams?id=eq.${encodeURIComponent(stream.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "ended",
        status_label: "Ended",
        ended_at: now,
        last_activity_at: now,
        viewer_count: 0,
        updated_at: now,
        metadata: {
          ...(stream.metadata || {}),
          ended_by: user?.id || null,
          ended_by_username: profile?.username || null,
          ended_source: "live-stream-end",
          ended_reason: cleanText(body.reason, "host_ended")
        }
      })
    });

    await supabaseFetch(`/live_stream_members?stream_id=eq.${encodeURIComponent(stream.id)}&status=eq.active`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "left",
        left_at: now,
        updated_at: now
      })
    });

    await supabaseFetch(`/live_view_sessions?stream_id=eq.${encodeURIComponent(stream.id)}&left_at=is.null`, {
      method: "PATCH",
      body: JSON.stringify({
        left_at: now,
        metadata: {
          closed_by_stream_end: true
        }
      })
    });

    await supabaseFetch(`/livekit_room_events`, {
      method: "POST",
      body: JSON.stringify({
        room_name: stream.livekit_room_name,
        stream_id: stream.id,
        event_type: "stream_ended",
        participant_identity: user?.id || null,
        participant_name: profile?.display_name || profile?.username || null,
        user_id: user?.id || null,
        payload: {
          app: "Rich Bizness Mobile",
          source: "live-stream-end",
          reason: cleanText(body.reason, "host_ended"),
          ended_at: now
        }
      })
    });

    return json(res, 200, {
      ok: true,
      stream: updated?.[0] || null,
      stream_id: stream.id,
      slug: stream.slug,
      livekit_room_name: stream.livekit_room_name,
      ended_at: now
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error?.message || "Failed to end live stream"
    });
  }
}
