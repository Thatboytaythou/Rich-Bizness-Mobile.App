const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

function json(res, status, data) {
  return res.status(status).json(data);
}

function cleanText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}

function encode(value) {
  return encodeURIComponent(String(value || ""));
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

  const raw = await response.text();

  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        data?.hint ||
        `Supabase request failed with ${response.status}`
    );
  }

  return data;
}

async function getUserFromAuth(req) {
  const authHeader =
    req.headers.authorization ||
    req.headers.Authorization;

  if (!authHeader?.startsWith("Bearer ")) {
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
  const value = encode(streamKey);

  const rows = await supabaseFetch(
    `/live_streams?or=(id.eq.${value},slug.eq.${value},livekit_room_name.eq.${value})&select=*&limit=1`
  );

  return rows?.[0] || null;
}

async function hasBan(streamId, userId) {
  if (!userId) return false;

  const rows = await supabaseFetch(
    `/live_stream_bans?stream_id=eq.${encode(streamId)}&banned_user_id=eq.${encode(userId)}&select=id,expires_at&limit=1`
  );

  const ban = rows?.[0];

  if (!ban) return false;
  if (!ban.expires_at) return true;

  return new Date(ban.expires_at).getTime() > Date.now();
}

async function hasPaidAccess(streamId, userId) {
  if (!userId) return false;

  const rows = await supabaseFetch(
    `/live_stream_purchases?stream_id=eq.${encode(streamId)}&user_id=eq.${encode(userId)}&status=eq.paid&select=id&limit=1`
  );

  return Boolean(rows?.[0]);
}

async function hasVipAccess(streamId, userId) {
  if (!userId) return false;

  const rows = await supabaseFetch(
    `/vip_live_access?stream_id=eq.${encode(streamId)}&user_id=eq.${encode(userId)}&access_status=eq.active&select=id,expires_at&limit=1`
  );

  const vip = rows?.[0];

  if (!vip) return false;
  if (!vip.expires_at) return true;

  return new Date(vip.expires_at).getTime() > Date.now();
}

async function getMember(streamId, userId) {
  if (!userId) return null;

  const rows = await supabaseFetch(
    `/live_stream_members?stream_id=eq.${encode(streamId)}&user_id=eq.${encode(userId)}&status=eq.active&select=id,role,status&limit=1`
  );

  return rows?.[0] || null;
}

async function getProfile(userId) {
  if (!userId) return null;

  const rows = await supabaseFetch(
    `/profiles?id=eq.${encode(userId)}&select=id,username,display_name,role,is_creator,is_verified&limit=1`
  );

  return rows?.[0] || null;
}

function isAdminProfile(profile) {
  const role = cleanText(profile?.role).toLowerCase();

  return [
    "founder",
    "rich_admin",
    "elite_mod",
    "admin",
    "moderator",
    "support"
  ].includes(role);
}

function accessPayload({
  status = 200,
  allowed = false,
  reason = "access_denied",
  role = "viewer",
  stream = null,
  userId = null,
  extra = {}
}) {
  return {
    status,
    body: {
      ok: true,
      allowed,
      reason,
      role,
      access_type: stream?.access_type || null,
      price_cents: stream?.price_cents || 0,
      currency: stream?.currency || "usd",
      stream,
      user_id: userId,
      ...extra
    }
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!["GET", "POST"].includes(req.method)) {
    return json(res, 405, {
      ok: false,
      allowed: false,
      error: "Method not allowed"
    });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(res, 500, {
        ok: false,
        allowed: false,
        error: "Missing Supabase server environment variables"
      });
    }

    const user = await getUserFromAuth(req);
    const input = req.method === "POST" ? req.body || {} : req.query || {};

    const streamKey = cleanText(
      input.stream_id ||
        input.streamId ||
        input.id ||
        input.slug ||
        input.room ||
        input.roomName ||
        input.livekit_room_name
    );

    if (!streamKey) {
      return json(res, 400, {
        ok: false,
        allowed: false,
        error: "Missing stream_id or slug"
      });
    }

    const stream = await findStream(streamKey);

    if (!stream) {
      return json(res, 404, {
        ok: false,
        allowed: false,
        reason: "not_found",
        error: "Live stream not found"
      });
    }

    const userId = user?.id || null;

    const [member, profile] = await Promise.all([
      getMember(stream.id, userId),
      getProfile(userId)
    ]);

    if (await hasBan(stream.id, userId)) {
      return json(res, 403, {
        ok: true,
        allowed: false,
        reason: "banned",
        stream,
        user_id: userId
      });
    }

    if (stream.creator_id === userId) {
      const result = accessPayload({
        status: 200,
        allowed: true,
        reason: "creator",
        role: "host",
        stream,
        userId
      });

      return json(res, result.status, result.body);
    }

    if (isAdminProfile(profile)) {
      const result = accessPayload({
        status: 200,
        allowed: true,
        reason: "admin",
        role: profile.role || "admin",
        stream,
        userId
      });

      return json(res, result.status, result.body);
    }

    if (["host", "cohost", "moderator"].includes(member?.role)) {
      const result = accessPayload({
        status: 200,
        allowed: true,
        reason: "stream_member",
        role: member.role,
        stream,
        userId
      });

      return json(res, result.status, result.body);
    }

    if (["ended", "cancelled"].includes(stream.status)) {
      return json(res, 403, {
        ok: true,
        allowed: false,
        reason: "stream_closed",
        stream,
        user_id: userId
      });
    }

    if (stream.access_type === "free") {
      const result = accessPayload({
        status: 200,
        allowed: true,
        reason: "free",
        role: "viewer",
        stream,
        userId
      });

      return json(res, result.status, result.body);
    }

    if (!userId) {
      return json(res, 401, {
        ok: true,
        allowed: false,
        reason: "login_required",
        access_type: stream.access_type,
        price_cents: stream.price_cents || 0,
        currency: stream.currency || "usd",
        stream
      });
    }

    if (stream.access_type === "paid") {
      const paid = await hasPaidAccess(stream.id, userId);

      const result = accessPayload({
        status: paid ? 200 : 402,
        allowed: paid,
        reason: paid ? "paid" : "payment_required",
        role: "viewer",
        stream,
        userId
      });

      return json(res, result.status, result.body);
    }

    if (stream.access_type === "vip") {
      const vip = await hasVipAccess(stream.id, userId);

      const result = accessPayload({
        status: vip ? 200 : 403,
        allowed: vip,
        reason: vip ? "vip" : "vip_required",
        role: "viewer",
        stream,
        userId
      });

      return json(res, result.status, result.body);
    }

    if (stream.access_type === "subscriber") {
      const paid = await hasPaidAccess(stream.id, userId);
      const vip = await hasVipAccess(stream.id, userId);
      const allowed = paid || vip;

      const result = accessPayload({
        status: allowed ? 200 : 403,
        allowed,
        reason: allowed ? "subscriber_access" : "subscriber_required",
        role: "viewer",
        stream,
        userId
      });

      return json(res, result.status, result.body);
    }

    if (stream.access_type === "private") {
      const allowed = Boolean(member);

      const result = accessPayload({
        status: allowed ? 200 : 403,
        allowed,
        reason: allowed ? "private_member" : "private_required",
        role: member?.role || "viewer",
        stream,
        userId
      });

      return json(res, result.status, result.body);
    }

    return json(res, 403, {
      ok: true,
      allowed: false,
      reason: "access_denied",
      access_type: stream.access_type,
      stream,
      user_id: userId
    });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      allowed: false,
      error: error?.message || "Failed to check live stream access"
    });
  }
}
