import crypto from "crypto";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));

  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function safeText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function makeIdentity(value) {
  return safeText(value, `guest-${crypto.randomUUID().slice(0, 8)}`)
    .replace(/[^a-zA-Z0-9._:-]/g, "-")
    .slice(0, 80);
}

function parseMetadata(body, role) {
  return {
    app: "Rich Bizness Mobile",
    role,
    stream_id: body.streamId || body.stream_id || body.metadata?.stream_id || null,
    stream_slug: body.streamSlug || body.stream_slug || body.metadata?.stream_slug || null,
    user_id: body.userId || body.user_id || body.metadata?.user_id || null,
    source: "api/livekit-token.js"
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const LIVEKIT_URL = process.env.LIVEKIT_URL;
    const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
    const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(500).json({
        ok: false,
        error: "Missing LiveKit environment variables"
      });
    }

    const body = req.method === "POST" ? req.body || {} : req.query || {};

    const roomName = safeText(
      body.roomName || body.room || body.livekit_room_name,
      `rich-room-${crypto.randomUUID().slice(0, 8)}`
    );

    const identity = makeIdentity(
      body.identity || body.userId || body.user_id || body.participantIdentity
    );

    const name = safeText(
      body.name || body.displayName || body.display_name || body.username,
      "Rich Bizness Guest"
    );

    const role = safeText(body.role, "viewer");

    const canPublish =
      ["host", "cohost", "moderator"].includes(role) ||
      body.canPublish === true;

    const canSubscribe = body.canSubscribe !== false;
    const canPublishData = body.canPublishData !== false;

    const now = Math.floor(Date.now() / 1000);
    const ttlSeconds = Math.min(
      Math.max(Number(body.ttlSeconds || body.ttl || 60 * 60 * 6), 60),
      60 * 60 * 24
    );

    const payload = {
      iss: LIVEKIT_API_KEY,
      sub: identity,
      name,
      iat: now,
      nbf: now,
      exp: now + ttlSeconds,
      video: {
        room: roomName,
        roomJoin: true,
        canPublish,
        canSubscribe,
        canPublishData
      },
      metadata: JSON.stringify(parseMetadata(body, role))
    };

    const token = signJwt(payload, LIVEKIT_API_SECRET);

    return res.status(200).json({
      ok: true,
      token,
      accessToken: token,
      livekitUrl: LIVEKIT_URL,
      url: LIVEKIT_URL,
      wsUrl: LIVEKIT_URL,
      roomName,
      room: roomName,
      identity,
      name,
      role,
      canPublish,
      canSubscribe,
      canPublishData,
      expiresAt: new Date((now + ttlSeconds) * 1000).toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to create LiveKit token"
    });
  }
}
