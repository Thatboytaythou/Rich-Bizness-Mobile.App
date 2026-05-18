const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function json(res, status, data) {
  return res.status(status).json(data);
}

function cleanText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim();
}

function toBool(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function toCents(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

function safeStatus(value) {
  const allowed = ["draft", "scheduled", "live", "ended", "cancelled"];
  return allowed.includes(value) ? value : undefined;
}

function safeAccessType(value) {
  const allowed = ["free", "paid", "vip", "subscriber", "private"];
  return allowed.includes(value) ? value : undefined;
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
    const message =
      data?.message ||
      data?.error ||
      data?.hint ||
      `Supabase request failed with ${response.status}`;

    throw new Error(message);
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST" && req.method !== "PATCH") {
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
        error: "Login required"
      });
    }

    const body = req.body || {};
    const streamId = cleanText(body.stream_id || body.streamId || body.id);

    if (!streamId) {
      return json(res, 400, {
        ok: false,
        error: "Missing stream_id"
      });
    }

    const existingRows = await supabaseFetch(
      `/live_streams?id=eq.${encodeURIComponent(streamId)}&select=*`
    );

    const existing = existingRows?.[0];

    if (!existing) {
      return json(res, 404, {
        ok: false,
        error: "Live stream not found"
      });
    }

    if (existing.creator_id !== user.id) {
      return json(res, 403, {
        ok: false,
        error: "Only the stream creator can update this live stream"
      });
    }

    const patch = {
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString()
    };

    const title = cleanText(body.title);
    const description = cleanText(body.description);
    const category = cleanText(body.category);
    const status = safeStatus(body.status);
    const accessType = safeAccessType(body.access_type || body.accessType);
    const statusLabel = cleanText(body.status_label || body.statusLabel);
    const displaySlug = cleanText(body.display_slug || body.displaySlug);
    const displayRoomName = cleanText(body.display_room_name || body.displayRoomName);
    const thumbnailUrl = cleanText(body.thumbnail_url || body.thumbnailUrl);
    const coverUrl = cleanText(body.cover_url || body.coverUrl);
    const recordingUrl = cleanText(body.recording_url || body.recordingUrl);

    if (title) patch.title = title;
    if (description || body.description === "") patch.description = description;
    if (category) patch.category = category;
    if (status) patch.status = status;
    if (accessType) patch.access_type = accessType;
    if (statusLabel) patch.status_label = statusLabel;
    if (displaySlug) patch.display_slug = displaySlug;
    if (displayRoomName) patch.display_room_name = displayRoomName;
    if (thumbnailUrl) patch.thumbnail_url = thumbnailUrl;
    if (coverUrl) patch.cover_url = coverUrl;
    if (recordingUrl) patch.recording_url = recordingUrl;

    if (body.price_cents !== undefined || body.priceCents !== undefined) {
      patch.price_cents = toCents(body.price_cents ?? body.priceCents, existing.price_cents || 0);
    }

    if (body.currency) {
      patch.currency = cleanText(body.currency, "usd").toLowerCase().slice(0, 8);
    }

    if (body.is_chat_enabled !== undefined || body.isChatEnabled !== undefined) {
      patch.is_chat_enabled = toBool(
        body.is_chat_enabled ?? body.isChatEnabled,
        existing.is_chat_enabled
      );
    }

    if (body.is_cohost_enabled !== undefined || body.isCohostEnabled !== undefined) {
      patch.is_cohost_enabled = toBool(
        body.is_cohost_enabled ?? body.isCohostEnabled,
        existing.is_cohost_enabled
      );
    }

    if (body.is_vip_enabled !== undefined || body.isVipEnabled !== undefined) {
      patch.is_vip_enabled = toBool(
        body.is_vip_enabled ?? body.isVipEnabled,
        existing.is_vip_enabled
      );
    }

    if (body.is_featured !== undefined || body.isFeatured !== undefined) {
      patch.is_featured = toBool(
        body.is_featured ?? body.isFeatured,
        existing.is_featured
      );
    }

    if (status === "live" && !existing.started_at) {
      patch.started_at = new Date().toISOString();
    }

    if (status === "ended" || status === "cancelled") {
      patch.ended_at = new Date().toISOString();
    }

    patch.metadata = {
      ...(existing.metadata || {}),
      ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
      last_update_source: "api/live-stream-update.js",
      last_updated_by: user.id
    };

    const updatedRows = await supabaseFetch(
      `/live_streams?id=eq.${encodeURIComponent(streamId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch)
      }
    );

    return json(res, 200, {
      ok: true,
      stream: updatedRows?.[0] || null
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: error?.message || "Failed to update live stream"
    });
  }
}
