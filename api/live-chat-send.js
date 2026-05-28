const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function json(res, status, data) {
  return res.status(status).json(data);
}

function cleanText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
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
    throw new Error(
      data?.message ||
        data?.error ||
        data?.hint ||
        `Supabase failed ${response.status}`
    );
  }

  return data;
}

async function getUserFromAuth(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader?.startsWith("Bearer ")) return null;

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

  if (isUuid(streamKey)) {
    const rows = await supabaseFetch(
      `/live_streams?id=eq.${value}&select=*&limit=1`
    );

    if (rows?.[0]) return rows[0];
  }

  const rows = await supabaseFetch(
    `/live_streams?or=(slug.eq.${value},livekit_room_name.eq.${value})&select=*&limit=1`
  );

  return rows?.[0] || null;
}

async function getProfile(userId) {
  const rows = await supabaseFetch(
    `/profiles?id=eq.${encodeURIComponent(
      userId
    )}&select=id,username,display_name,avatar_url,role,is_verified&limit=1`
  );

  return rows?.[0] || null;
}

async function isBanned(streamId, userId) {
  const rows = await supabaseFetch(
    `/live_stream_bans?stream_id=eq.${encodeURIComponent(
      streamId
    )}&banned_user_id=eq.${encodeURIComponent(
      userId
    )}&select=id,expires_at&limit=1`
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

  if (req.method === "OPTIONS") return res.status(204).end();

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

    if (!user?.id) {
      return json(res, 401, {
        ok: false,
        error: "Sign in required to send live chat"
      });
    }

    const body = req.body || {};

    const streamKey = cleanText(
      body.stream_id ||
        body.streamId ||
        body.slug ||
        body.room ||
        body.roomName ||
        body.livekit_room_name
    );

    const message = cleanText(body.message || body.body);

    if (!streamKey) {
      return json(res, 400, {
        ok: false,
        error: "Missing stream_id, slug, or room"
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

    if (!stream?.id) {
      return json(res, 404, {
        ok: false,
        error: "Live stream not found"
      });
    }

    if (["ended", "cancelled", "deleted"].includes(stream.status)) {
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

    if (await isBanned(stream.id, user.id)) {
      return json(res, 403, {
        ok: false,
        error: "You are banned from this live chat"
      });
    }

    const profile = await getProfile(user.id);

    const username =
      cleanText(body.username) ||
      cleanText(profile?.username) ||
      cleanText(user.email?.split("@")?.[0]) ||
      "rich_user";

    const displayName =
      cleanText(body.display_name || body.displayName) ||
      cleanText(profile?.display_name) ||
      username;

    const inserted = await supabaseFetch("/live_chat_messages", {
      method: "POST",
      body: JSON.stringify({
        stream_id: stream.id,
        user_id: user.id,
        username,
        display_name: displayName,
        message,
        body: message,
        is_pinned: false,
        is_deleted: false,
        metadata: {
          app: "Rich Bizness Mobile",
          source: "api/live-chat-send",
          avatar_url: profile?.avatar_url || null,
          is_verified: profile?.is_verified || false,
          role: profile?.role || "user"
        }
      })
    });

    await supabaseFetch(`/live_streams?id=eq.${encodeURIComponent(stream.id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        total_chat_messages: Number(stream.total_chat_messages || 0) + 1,
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
