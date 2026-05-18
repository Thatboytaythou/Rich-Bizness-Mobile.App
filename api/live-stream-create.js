import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.replace("Bearer ", "").trim();
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

    const {
      data: authData,
      error: authError
    } = await supabase.auth.getUser(token);

    if (authError || !authData?.user?.id) {
      return res.status(401).json({
        ok: false,
        error: "Invalid user session"
      });
    }

    const user = authData.user;
    const body = req.body || {};

    const {
      data: profile
    } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, banner_url, is_creator, is_verified")
      .eq("id", user.id)
      .maybeSingle();

    const title = cleanText(body.title, "Family Bizness");
    const description = cleanText(body.description, "");
    const category = cleanText(body.category, "general");
    const accessType = cleanText(body.access_type || body.accessType, "free");
    const priceCents = cleanNumber(body.price_cents || body.priceCents, 0);
    const currency = cleanText(body.currency, "usd").toLowerCase();

    const allowedAccess = ["free", "paid", "vip", "subscriber", "private"];
    const finalAccessType = allowedAccess.includes(accessType) ? accessType : "free";

    const slug = cleanText(body.slug, makeSlug(title));
    const livekitRoomName = cleanText(
      body.livekit_room_name || body.livekitRoomName,
      makeRoomName()
    );

    const payload = {
      creator_id: user.id,
      slug,
      display_slug: cleanText(body.display_slug || body.displaySlug, "We 🔥 📺"),
      title,
      description,
      category,
      status: cleanText(body.status, "draft"),
      status_label: cleanText(body.status_label || body.statusLabel, "Get Right"),
      access_type: finalAccessType,
      price_cents: finalAccessType === "free" ? 0 : priceCents,
      currency,
      livekit_room_name: livekitRoomName,
      display_room_name: cleanText(body.display_room_name || body.displayRoomName, "Bizness Party"),
      thumbnail_url: cleanText(body.thumbnail_url || body.thumbnailUrl, null),
      cover_url: cleanText(body.cover_url || body.coverUrl, null),
      recording_url: cleanText(body.recording_url || body.recordingUrl, null),
      viewer_count: 0,
      peak_viewers: 0,
      total_chat_messages: 0,
      total_reactions: 0,
      total_revenue_cents: 0,
      platform_fee_cents: 0,
      creator_amount_cents: 0,
      is_chat_enabled: body.is_chat_enabled ?? body.isChatEnabled ?? true,
      is_cohost_enabled: body.is_cohost_enabled ?? body.isCohostEnabled ?? true,
      is_vip_enabled: body.is_vip_enabled ?? body.isVipEnabled ?? true,
      is_featured: false,
      metadata: {
        app: "Rich Bizness Mobile",
        source: "api/live-stream-create",
        creator: {
          id: user.id,
          username: profile?.username || null,
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null
        },
        client_metadata: body.metadata || {}
      }
    };

    const {
      data: stream,
      error: streamError
    } = await supabase
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

    await supabase
      .from("live_stream_members")
      .insert({
        stream_id: stream.id,
        user_id: user.id,
        role: "host",
        status: "active",
        metadata: {
          app: "Rich Bizness Mobile",
          source: "api/live-stream-create"
        }
      });

    await supabase
      .from("platform_analytics_events")
      .insert({
        user_id: user.id,
        event_name: "live_stream_created",
        section: "live",
        target_table: "live_streams",
        target_id: stream.id,
        route: "/live",
        metadata: {
          title: stream.title,
          slug: stream.slug,
          access_type: stream.access_type
        }
      });

    return res.status(200).json({
      ok: true,
      stream,
      watchUrl: `/watch.html?stream=${stream.slug}`,
      liveUrl: `/live.html?stream=${stream.slug}`,
      roomName: stream.livekit_room_name
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to create live stream"
    });
  }
}
