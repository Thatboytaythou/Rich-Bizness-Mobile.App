/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-access.js

   LIVE ACCESS GATE
   Free + Paid + VIP + Subscriber + Private
   Safe Table Checks + Checkout Redirect
========================= */

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

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
  subscription: null,
  error: null,
  listeners: new Set()
};

function emitAccess() {
  const state = getLiveAccessState();

  ACCESS.listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      console.warn("[RB LIVE ACCESS LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:live-access-state", {
      detail: state
    })
  );
}

function normalizeAccessType(stream = ACCESS.stream) {
  return String(stream?.access_type || "free").toLowerCase();
}

function hasPrice(stream = ACCESS.stream) {
  return Number(stream?.price_cents || 0) > 0;
}

function isExpired(value) {
  if (!value) return false;

  const time = new Date(value).getTime();

  if (!Number.isFinite(time)) return false;

  return time <= Date.now();
}

function money(cents = 0, currency = "usd") {
  const amount = Number(cents || 0) / 100;
  return new Intl.NumberFormat([], {
    style: "currency",
    currency: String(currency || "usd").toUpperCase()
  }).format(amount);
}

function resetAccessPatch() {
  ACCESS.unlocked = false;
  ACCESS.reason = "locked";
  ACCESS.purchase = null;
  ACCESS.vip = null;
  ACCESS.member = null;
  ACCESS.subscription = null;
  ACCESS.error = null;
}

function ownerOrAdmin() {
  const role = String(
    ACCESS.profile?.role ||
      ACCESS.profile?.role_key ||
      ACCESS.user?.role ||
      ""
  ).toLowerCase();

  return Boolean(
    ACCESS.stream?.creator_id &&
      ACCESS.user?.id &&
      ACCESS.stream.creator_id === ACCESS.user.id
  ) || [
    "founder",
    "rich_admin",
    "admin",
    "super_admin",
    "owner"
  ].includes(role);
}

async function safeMaybeSingle(query, label = "live-access") {
  try {
    const { data, error } = await query;

    if (error) throw error;

    return data || null;
  } catch (error) {
    console.warn(`[RB LIVE ACCESS QUERY SKIPPED: ${label}]`, error?.message || error);
    return null;
  }
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
    subscription: ACCESS.subscription,
    error: ACCESS.error
  };
}

export function onLiveAccess(listener) {
  if (typeof listener !== "function") return () => {};

  ACCESS.listeners.add(listener);

  try {
    listener(getLiveAccessState());
  } catch (error) {
    console.warn("[RB LIVE ACCESS LISTENER]", error);
  }

  return () => {
    ACCESS.listeners.delete(listener);
  };
}

export function isLiveAccessUnlocked() {
  return ACCESS.unlocked === true;
}

export function liveAccessLabel(stream = ACCESS.stream) {
  const accessType = normalizeAccessType(stream);

  if (accessType === "free") return "FREE";

  if (accessType === "paid") {
    return `PAID · ${money(stream?.price_cents || 0, stream?.currency || "usd")}`;
  }

  if (accessType === "vip") return "VIP";
  if (accessType === "subscriber") return "SUBSCRIBER";
  if (accessType === "private") return "PRIVATE";

  return accessType.toUpperCase();
}

export function liveAccessNeedsPayment(stream = ACCESS.stream) {
  const accessType = normalizeAccessType(stream);

  if (!stream) return false;
  if (ACCESS.unlocked) return false;

  return accessType === "paid" && hasPrice(stream);
}

export async function checkLiveAccess({
  stream,
  user = null,
  profile = null
} = {}) {
  ACCESS.stream = stream || null;
  ACCESS.user = user || null;
  ACCESS.profile = profile || null;

  resetAccessPatch();

  if (!stream?.id) {
    ACCESS.reason = "missing_stream";
    emitAccess();
    return getLiveAccessState();
  }

  const accessType = normalizeAccessType(stream);

  if (accessType === "free" || !hasPrice(stream) && accessType === "paid") {
    ACCESS.unlocked = true;
    ACCESS.reason = accessType === "paid" ? "free_price" : "free";
    emitAccess();
    return getLiveAccessState();
  }

  if (ownerOrAdmin()) {
    ACCESS.unlocked = true;
    ACCESS.reason = "owner_or_admin";
    emitAccess();
    return getLiveAccessState();
  }

  if (!user?.id) {
    ACCESS.unlocked = false;
    ACCESS.reason = "auth_required";
    emitAccess();
    return getLiveAccessState();
  }

  const supabase = getSupabase();

  if (accessType === "paid") {
    if (!RB_TABLES.liveStreamPurchases) {
      ACCESS.unlocked = false;
      ACCESS.reason = "payment_table_missing";
      emitAccess();
      return getLiveAccessState();
    }

    const purchase = await safeMaybeSingle(
      supabase
        .from(RB_TABLES.liveStreamPurchases)
        .select("*")
        .eq("stream_id", stream.id)
        .eq("user_id", user.id)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      "paid_purchase"
    );

    ACCESS.purchase = purchase;

    if (purchase?.id) {
      ACCESS.unlocked = true;
      ACCESS.reason = "purchase_paid";
    } else {
      ACCESS.unlocked = false;
      ACCESS.reason = "payment_required";
    }

    emitAccess();
    return getLiveAccessState();
  }

  if (accessType === "vip") {
    if (!RB_TABLES.vipLiveAccess) {
      ACCESS.unlocked = false;
      ACCESS.reason = "vip_table_missing";
      emitAccess();
      return getLiveAccessState();
    }

    const vip = await safeMaybeSingle(
      supabase
        .from(RB_TABLES.vipLiveAccess)
        .select("*")
        .eq("stream_id", stream.id)
        .eq("user_id", user.id)
        .eq("access_status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      "vip_access"
    );

    ACCESS.vip = vip;

    if (vip?.id && !isExpired(vip.expires_at)) {
      ACCESS.unlocked = true;
      ACCESS.reason = "vip_access";
    } else {
      ACCESS.unlocked = false;
      ACCESS.reason = "vip_required";
    }

    emitAccess();
    return getLiveAccessState();
  }

  if (accessType === "subscriber") {
    if (!RB_TABLES.creatorAlertSubscriptions) {
      ACCESS.unlocked = false;
      ACCESS.reason = "subscriber_table_missing";
      emitAccess();
      return getLiveAccessState();
    }

    const subscription = await safeMaybeSingle(
      supabase
        .from(RB_TABLES.creatorAlertSubscriptions)
        .select("*")
        .eq("creator_id", stream.creator_id)
        .eq("user_id", user.id)
        .or("is_active.eq.true,alert_level.neq.silent")
        .limit(1)
        .maybeSingle(),
      "subscriber_access"
    );

    ACCESS.subscription = subscription;
    ACCESS.member = subscription;

    if (subscription?.id) {
      ACCESS.unlocked = true;
      ACCESS.reason = "subscriber_access";
    } else {
      ACCESS.unlocked = false;
      ACCESS.reason = "subscriber_required";
    }

    emitAccess();
    return getLiveAccessState();
  }

  if (accessType === "private") {
    if (!RB_TABLES.liveStreamMembers) {
      ACCESS.unlocked = false;
      ACCESS.reason = "private_members_table_missing";
      emitAccess();
      return getLiveAccessState();
    }

    const member = await safeMaybeSingle(
      supabase
        .from(RB_TABLES.liveStreamMembers)
        .select("*")
        .eq("stream_id", stream.id)
        .eq("user_id", user.id)
        .in("role", ["host", "cohost", "moderator", "guest"])
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
      "private_member"
    );

    ACCESS.member = member;

    if (member?.id) {
      ACCESS.unlocked = true;
      ACCESS.reason = "private_member";
    } else {
      ACCESS.unlocked = false;
      ACCESS.reason = "private_required";
    }

    emitAccess();
    return getLiveAccessState();
  }

  ACCESS.unlocked = false;
  ACCESS.reason = "unknown_access_type";

  emitAccess();
  return getLiveAccessState();
}

export async function initLiveAccess({
  stream,
  user = null,
  profile = null
} = {}) {
  return await checkLiveAccess({
    stream,
    user,
    profile
  });
}

export async function canWatchLiveStream() {
  const state = await checkLiveAccess({
    stream: ACCESS.stream,
    user: ACCESS.user,
    profile: ACCESS.profile
  });

  return {
    allowed: state.unlocked,
    reason: state.reason,
    state
  };
}

export async function createLiveAccessCheckout({
  stream = ACCESS.stream,
  successUrl,
  cancelUrl
} = {}) {
  if (!stream?.id) {
    throw new Error("Missing stream for checkout.");
  }

  if (!hasPrice(stream)) {
    throw new Error("This stream does not require payment.");
  }

  const response = await fetch("/api/create-checkout-session", {
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

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.url) {
    throw new Error(data?.error || "Checkout URL missing.");
  }

  return data;
}

export async function goToLiveAccessCheckout({
  stream = ACCESS.stream
} = {}) {
  const data = await createLiveAccessCheckout({
    stream
  });

  window.location.href = data.url;

  return data;
}

export function redirectToAuthForLive(stream = ACCESS.stream) {
  const next = `${RB_ROUTES.watch || "/watch"}?stream=${encodeURIComponent(
    stream?.slug || stream?.id || ""
  )}`;

  window.location.href =
    `${RB_ROUTES.auth || "/auth"}?next=${encodeURIComponent(next)}`;
}

export function resetLiveAccess() {
  ACCESS.stream = null;
  ACCESS.user = null;
  ACCESS.profile = null;
  resetAccessPatch();
  ACCESS.reason = "reset";
  emitAccess();
}

console.log("RB LIVE ACCESS READY");
