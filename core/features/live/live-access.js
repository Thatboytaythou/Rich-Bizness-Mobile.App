/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-access.js

   LIVE ACCESS GATE
   Free + Paid + VIP + Private
========================= */

import { getSupabase } from "/core/shared/rb-supabase.js";

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

const ACCESS = {
  stream: null,
  user: null,
  profile: null,
  unlocked: false,
  reason: "loading",
  purchase: null,
  vip: null,
  member: null,
};

function normalizeAccessType(stream = ACCESS.stream) {
  return String(stream?.access_type || "free").toLowerCase();
}

function hasPrice(stream = ACCESS.stream) {
  return Number(stream?.price_cents || 0) > 0;
}

function isExpired(value) {
  if (!value) return false;
  return new Date(value).getTime() <= Date.now();
}

export function getLiveAccessState() {
  return {
    stream: ACCESS.stream,
    user: ACCESS.user,
    profile: ACCESS.profile,
    unlocked: ACCESS.unlocked,
    reason: ACCESS.reason,
    purchase: ACCESS.purchase,
    vip: ACCESS.vip,
    member: ACCESS.member,
  };
}

export function isLiveAccessUnlocked() {
  return ACCESS.unlocked === true;
}

export function liveAccessLabel(stream = ACCESS.stream) {
  const accessType = normalizeAccessType(stream);

  if (accessType === "free") return "FREE";
  if (accessType === "paid") return `PAID · $${(Number(stream?.price_cents || 0) / 100).toFixed(2)}`;
  if (accessType === "vip") return "VIP";
  if (accessType === "subscriber") return "SUBSCRIBER";
  if (accessType === "private") return "PRIVATE";

  return accessType.toUpperCase();
}

export function liveAccessNeedsPayment(stream = ACCESS.stream) {
  const accessType = normalizeAccessType(stream);

  if (!stream) return false;
  if (accessType === "free") return false;
  if (accessType === "vip") return false;
  if (accessType === "subscriber") return false;
  if (accessType === "private") return false;

  return hasPrice(stream) && !ACCESS.unlocked;
}

export async function checkLiveAccess({
  stream,
  user = null,
  profile = null
} = {}) {
  ACCESS.stream = stream || null;
  ACCESS.user = user || null;
  ACCESS.profile = profile || null;

  ACCESS.unlocked = false;
  ACCESS.reason = "locked";
  ACCESS.purchase = null;
  ACCESS.vip = null;
  ACCESS.member = null;

  if (!stream?.id) {
    ACCESS.reason = "missing_stream";
    return getLiveAccessState();
  }

  const accessType = normalizeAccessType(stream);

  if (accessType === "free") {
    ACCESS.unlocked = true;
    ACCESS.reason = "free";
    return getLiveAccessState();
  }

  if (stream.creator_id && user?.id === stream.creator_id) {
    ACCESS.unlocked = true;
    ACCESS.reason = "creator_owner";
    return getLiveAccessState();
  }

  if (!user?.id) {
    ACCESS.unlocked = false;
    ACCESS.reason = "auth_required";
    return getLiveAccessState();
  }

  const supabase = getSupabase();

  if (accessType === "paid") {
    const { data } = await supabase
      .from(RB_TABLES.liveStreamPurchases)
      .select("*")
      .eq("stream_id", stream.id)
      .eq("user_id", user.id)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    ACCESS.purchase = data || null;

    if (data?.id) {
      ACCESS.unlocked = true;
      ACCESS.reason = "purchase_paid";
      return getLiveAccessState();
    }

    ACCESS.unlocked = false;
    ACCESS.reason = "payment_required";
    return getLiveAccessState();
  }

  if (accessType === "vip") {
    const { data } = await supabase
      .from(RB_TABLES.vipLiveAccess)
      .select("*")
      .eq("stream_id", stream.id)
      .eq("user_id", user.id)
      .eq("access_status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    ACCESS.vip = data || null;

    if (data?.id && !isExpired(data.expires_at)) {
      ACCESS.unlocked = true;
      ACCESS.reason = "vip_access";
      return getLiveAccessState();
    }

    ACCESS.unlocked = false;
    ACCESS.reason = "vip_required";
    return getLiveAccessState();
  }

  if (accessType === "subscriber") {
    const { data } = await supabase
      .from(RB_TABLES.creatorAlertSubscriptions)
      .select("*")
      .eq("creator_id", stream.creator_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    ACCESS.member = data || null;

    if (data?.id) {
      ACCESS.unlocked = true;
      ACCESS.reason = "subscriber_access";
      return getLiveAccessState();
    }

    ACCESS.unlocked = false;
    ACCESS.reason = "subscriber_required";
    return getLiveAccessState();
  }

  if (accessType === "private") {
    const { data } = await supabase
      .from(RB_TABLES.liveStreamMembers)
      .select("*")
      .eq("stream_id", stream.id)
      .eq("user_id", user.id)
      .in("role", ["host", "cohost", "moderator", "guest"])
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    ACCESS.member = data || null;

    if (data?.id) {
      ACCESS.unlocked = true;
      ACCESS.reason = "private_member";
      return getLiveAccessState();
    }

    ACCESS.unlocked = false;
    ACCESS.reason = "private_required";
    return getLiveAccessState();
  }

  ACCESS.unlocked = false;
  ACCESS.reason = "unknown_access_type";

  return getLiveAccessState();
}

export async function createLiveAccessCheckout({
  stream,
  successUrl,
  cancelUrl
} = {}) {
  if (!stream?.id) {
    throw new Error("Missing stream for checkout.");
  }

  const res = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "live_stream",
      stream_id: stream.id,
      product_id: stream.id,
      title: stream.title || "Rich Bizness Live",
      amount_cents: Number(stream.price_cents || 0),
      currency: stream.currency || "usd",
      success_url:
        successUrl ||
        `${window.location.origin}${RB_ROUTES.watch || "/watch"}?stream=${encodeURIComponent(stream.slug || stream.id)}&paid=1`,
      cancel_url:
        cancelUrl ||
        window.location.href
    })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.url) {
    throw new Error(data?.error || "Checkout URL missing.");
  }

  return data;
}

export async function goToLiveAccessCheckout({ stream } = {}) {
  const data = await createLiveAccessCheckout({ stream });
  window.location.href = data.url;
  return data;
}

export function redirectToAuthForLive(stream = ACCESS.stream) {
  const next = `${RB_ROUTES.watch || "/watch"}?stream=${encodeURIComponent(stream?.slug || stream?.id || "")}`;

  window.location.href =
    `${RB_ROUTES.auth || "/auth"}?next=${encodeURIComponent(next)}`;
}

console.log("RB LIVE ACCESS READY");
