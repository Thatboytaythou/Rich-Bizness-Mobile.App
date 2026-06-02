import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase server environment variables");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function cleanText(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function cleanBool(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function makeSlug(title = "live") {
  const base = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 38);

  return `${base || "live"}-${crypto.randomUUID().slice(0, 8)}`;
}

function makeRoomName() {
  return `bizness-party-${crypto.randomUUID().slice(0, 8)}`;
}

function getBearerToken(req) {
  const header =
    req.headers.authorization ||
    req.headers.Authorization ||
    "";

  if (!header.startsWith("Bearer ")) return null;

  return header.replace("Bearer ", "").trim();
}

function watchUrl(stream) {
  return `/watch?stream=${encodeURIComponent(stream.slug || stream.id)}`;
}

function liveUrl(stream) {
  return `/live?stream=${encodeURIComponent(stream.slug || stream.id)}`;
}

async function insertQuiet(supabase, table, payload) {
  if (!table) return null;

  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error) {
    console.warn(`[RB ${table} INSERT SKIPPED]`, error.message);
    return null;
  }

  return data || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    const supabase = getSupabaseAdmin();
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        ok: false,
        error: "Missing authorization token"
      });
    }

    const { data: authData, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !authData?.user?.id) {
      return res.status(401).json({
        ok: false,
        error: "Invalid user session"
      });
    }

    const user = authData.user;
    const body = req.body || {};

    const { data: profile } = await supabase
      .from("profiles")
      .select(`
        id,
        username,
        display_name,
        full_name,
        avatar_url,
        banner_url,
        role,
        is_creator,
        is_verified
      `)
      .eq("id", user.id)
      .maybeSingle();

    const title = cleanText(body.title, "Family Bizness");
    const description = cleanText(body.description, "");
    const category = cleanText(body.category, "general");

    const requestedAccess = cleanText(
      body.access_type || body.accessType,
      "free"
    );

    const allowedAccess = [
      "free",
      "paid",
      "vip",
      "subscriber",
      "private"
    ];

    const accessType = allowedAccess.includes(requestedAccess)
      ? requestedAccess
      : "free";

    const priceCents =
      accessType === "free"
        ? 0
        : cleanNumber(body.price_cents || body.priceCents, 0);

    const slug = cleanText(body.slug, makeSlug(title));

    const livekitRoomName = cleanText(
      body.livekit_room_name || body.livekitRoomName,
      makeRoomName()
    );

    const now = new Date().toISOString();

    const payload = {
      creator_id: user.id,
      slug,
      display_slug: cleanText(
        body.display_slug || body.displaySlug,
        "We 🔥 📺"
      ),
      title,
      description,
      category,
      status: cleanText(body.status, "draft"),
      status_label: cleanText(
        body.status_label || body.statusLabel,
        "Get Right"
      ),
      access_type: accessType,
      price_cents: priceCents,
      currency: cleanText(body.currency, "usd").toLowerCase(),
      livekit_room_name: livekitRoomName,
      display_room_name: cleanText(
        body.display_room_name || body.displayRoomName,
        "Bizness Party"
      ),
      thumbnail_url: cleanText(
        body.thumbnail_url || body.thumbnailUrl,
        null
      ),
      cover_url: cleanText(
        body.cover_url || body.coverUrl,
        null
      ),
      recording_url: cleanText(
        body.recording_url || body.recordingUrl,
        null
      ),
      viewer_count: 0,
      peak_viewers: 0,
      total_chat_messages: 0,
      total_reactions: 0,
      total_revenue_cents: 0,
      platform_fee_cents: 0,
      creator_amount_cents: 0,
      is_chat_enabled: cleanBool(
        body.is_chat_enabled ?? body.isChatEnabled,
        true
      ),
      is_cohost_enabled: cleanBool(
        body.is_cohost_enabled ?? body.isCohostEnabled,
        true
      ),
      is_vip_enabled: cleanBool(
        body.is_vip_enabled ?? body.isVipEnabled,
        true
      ),
      is_featured: false,
      last_activity_at: now,
      metadata: {
        app: "Rich Bizness Mobile",
        source: "api/live-stream-create.js",
        watch_ready: true,
        creator: {
          id: user.id,
          username: profile?.username || null,
          display_name:
            profile?.display_name ||
            profile?.full_name ||
            null,
          avatar_url: profile?.avatar_url || null,
          banner_url: profile?.banner_url || null,
          role: profile?.role || "user"
        },
        client_metadata: body.metadata || {}
      }
    };

    const { data: stream, error: streamError } = await supabase
      .from("live_streams")
      .insert(payload)
      .select("*")
      .single();

    if (streamError) {
      return res.status(400).json({
        ok: false,
        error: streamError.message
      });
    }

    await insertQuiet(supabase, "live_stream_members", {
      stream_id: stream.id,
      user_id: user.id,
      role: "host",
      status: "active",
      metadata: {
        app: "Rich Bizness Mobile",
        source: "api/live-stream-create.js",
        display_name:
          profile?.display_name ||
          profile?.full_name ||
          null,
        username: profile?.username || null
      }
    });

    await insertQuiet(supabase, "live_stream_cards", {
      stream_id: stream.id,
      creator_id: user.id,
      title: stream.title,
      subtitle: stream.description,
      card_type: stream.status === "live" ? "live" : "highlight",
      thumbnail_url: stream.thumbnail_url,
      cover_url: stream.cover_url,
      target_url: watchUrl(stream),
      is_active: true,
      sort_order: 0,
      metadata: {
        app: "Rich Bizness Mobile",
        source: "api/live-stream-create.js",
        section: "watch",
        status: stream.status,
        slug: stream.slug
      }
    });

    await insertQuiet(supabase, "rich_notifications", {
      user_id: user.id,
      actor_id: user.id,
      type: "live_created",
      title: "Live studio created",
      body: `${stream.title} is ready to start.`,
      target_table: "live_streams",
      target_type: "live",
      target_id: stream.id,
      target_url: watchUrl(stream),
      emoji: "📺",
      metadata: {
        stream_slug: stream.slug,
        source: "api/live-stream-create.js"
      }
    });

    await insertQuiet(supabase, "platform_analytics_events", {
      user_id: user.id,
      event_name: "live_stream_created",
      section: "live",
      target_table: "live_streams",
      target_id: stream.id,
      route: "/live",
      metadata: {
        title: stream.title,
        slug: stream.slug,
        access_type: stream.access_type,
        source: "api/live-stream-create.js"
      }
    });

    return res.status(200).json({
      ok: true,
      stream,
      watchUrl: watchUrl(stream),
      liveUrl: liveUrl(stream),
      roomName: stream.livekit_room_name,
      room: stream.livekit_room_name
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to create live stream"
    });
  }
}
