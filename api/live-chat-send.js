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
    `/profiles?id=eq.${encodeURIComponent(userId)}&select=id,username,display_name,avatar_url,role,is_verified&limit=1`
  );

  return rows?.[0] || null;
}

async function isBanned(streamId, userId) {
  if (!userId) return false;

  const rows = await supabaseFetch(
    `/live_stream_bans?stream_id=eq.${encodeURIComponent(streamId)}&banned_user_id=eq.${encodeURIComponent(userId)}&select=id,expires_at&limit=1`
  );

  const ban = rows?.[0];
  if (!ban) return false;
  if (!ban.expires_at) return true;

  return new Date(ban.expires_at).getTime() > Date.now();
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
      body.stream_id || body.streamId || body.slug || body.room || body.livekit_room_name
    );

    const message = cleanText(body.message || body.body);

    if (!streamKey) {
      return json(res, 400, {
        ok: false,
        error: "Missing stream_id or slug"
      });
    }

    if (!message) {
      return json(res, 400, {
        ok: false,
        error: "Message is required"
      });
    }

    if (message.length > 500) {
      return json(res, 400, {
        ok: false,
        error: "Message is too long"
      });
    }

    const stream = await findStream(streamKey);

    if (!stream) {
      return json(res, 404, {
        ok: false,
        error: "Live stream not found"
      });
    }

    if (stream.status === "ended" || stream.status === "cancelled") {
      return json(res, 403, {
        ok: false,
        error: "Chat is closed for this stream"
      });
    }

    if (stream.is_chat_enabled === false) {
      return json(res, 403, {
        ok: false,
        error: "Chat is disabled for this stream"
      });
    }

    const userId = user?.id || null;

    if (await isBanned(stream.id, userId)) {
      return json(res, 403, {
        ok: false,
        error: "You are banned from this live chat"
      });
    }

    const profile = await getProfile(userId);

    const username =
      cleanText(body.username) ||
      cleanText(profile?.username) ||
      cleanText(user?.email?.split("@")?.[0]) ||
      "guest";

    const displayName =
      cleanText(body.display_name || body.displayName) ||
      cleanText(profile?.display_name) ||
      username;

    const insertPayload = {
      stream_id: stream.id,
      user_id: userId,
      username,
      display_name: displayName,
      message,
      body: message,
      is_pinned: false,
      is_deleted: false,
      metadata: {
        app: "Rich Bizness Mobile",
        source: "live-chat-send",
        avatar_url: profile?.avatar_url || null,
        is_verified: profile?.is_verified || false,
        role: profile?.role || "user"
      }
    };

    const inserted = await supabaseFetch(`/live_chat_messages`, {
      method: "POST",
      body: JSON.stringify(insertPayload)
    });

    await supabaseFetch(`/live_streams?id=eq.${encodeURIComponent(stream.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        total_chat_messages: (stream.total_chat_messages || 0) + 1,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    return json(res, 200, {
      ok: true,
      message: inserted?.[0] || null,
      stream_id: stream.id
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error?.message || "Failed to send live chat message"
    });
  }
}
