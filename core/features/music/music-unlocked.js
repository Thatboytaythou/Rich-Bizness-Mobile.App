/* =========================
   RICH BIZNESS MOBILE
   /core/features/music/music-unlocked.js

   MUSIC UNLOCK ENGINE
   Premium music access + purchased/unlocked tracks
   Uses shared Supabase client
========================= */

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  rbSelect,
  rbInsert,
  rbUpdate
} from "/core/shared/rb-supabase.js";

import {
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  getProfileIdentity
} from "/core/shared/rb-profile.js";

const supabase = getSupabase();

const UNLOCK_STATE = {
  ready: false,
  loading: false,
  unlockedIds: new Set(),
  purchases: [],
  listeners: new Set(),
  error: null
};

function unlockTable() {
  return RB_TABLES.userProductUnlocks || "user_product_unlocks";
}

function productsTable() {
  return RB_TABLES.products || "products";
}

function musicTable() {
  return RB_TABLES.musicTracks || "music_tracks";
}

function requireUser() {
  const user = getUser();

  if (!user?.id) {
    throw new Error("You must be signed in.");
  }

  return user;
}

function normalizeError(error = null) {
  if (!error) return null;

  return {
    message: error?.message || String(error),
    code: error?.code || null,
    details: error?.details || null
  };
}

function normalizeUnlock(row = {}) {
  return {
    ...row,
    track_id:
      row.track_id ||
      row.music_track_id ||
      row.content_id ||
      row.product_id ||
      null,
    music_track_id:
      row.music_track_id ||
      row.track_id ||
      row.content_id ||
      null,
    unlocked: row.unlocked ?? true,
    status: row.status || "active"
  };
}

function emitUnlockState() {
  const state = getMusicUnlockState();

  UNLOCK_STATE.listeners.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
      console.warn("[RB MUSIC UNLOCK LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:music-unlocks", {
      detail: state
    })
  );
}

/* =========================
   STATE
========================= */

export function getMusicUnlockState() {
  return {
    ready: UNLOCK_STATE.ready,
    loading: UNLOCK_STATE.loading,
    unlockedIds: Array.from(UNLOCK_STATE.unlockedIds),
    purchases: [...UNLOCK_STATE.purchases],
    error: UNLOCK_STATE.error ? { ...UNLOCK_STATE.error } : null
  };
}

export function onMusicUnlockState(callback) {
  if (typeof callback !== "function") return () => {};

  UNLOCK_STATE.listeners.add(callback);

  try {
    callback(getMusicUnlockState());
  } catch (error) {
    console.warn("[RB MUSIC UNLOCK LISTENER ERROR]", error);
  }

  return () => {
    UNLOCK_STATE.listeners.delete(callback);
  };
}

export function isMusicUnlocked(trackOrId = "") {
  const id =
    typeof trackOrId === "string"
      ? trackOrId
      : trackOrId?.id ||
        trackOrId?.track_id ||
        trackOrId?.music_track_id ||
        "";

  if (!id) return false;

  const item =
    typeof trackOrId === "object" && trackOrId
      ? trackOrId
      : null;

  if (item?.is_free || item?.price_cents === 0 || item?.visibility === "public") {
    return true;
  }

  return UNLOCK_STATE.unlockedIds.has(id);
}

export function markMusicUnlocked(trackId) {
  if (!trackId) return;

  UNLOCK_STATE.unlockedIds.add(trackId);
  emitUnlockState();
}

export function resetMusicUnlockState() {
  UNLOCK_STATE.ready = false;
  UNLOCK_STATE.loading = false;
  UNLOCK_STATE.unlockedIds.clear();
  UNLOCK_STATE.purchases = [];
  UNLOCK_STATE.error = null;

  emitUnlockState();
}

/* =========================
   LOAD UNLOCKS
========================= */

export async function loadMyMusicUnlocks() {
  const user = getUser();

  UNLOCK_STATE.loading = true;
  UNLOCK_STATE.error = null;
  emitUnlockState();

  if (!user?.id) {
    UNLOCK_STATE.ready = true;
    UNLOCK_STATE.loading = false;
    UNLOCK_STATE.unlockedIds.clear();
    UNLOCK_STATE.purchases = [];
    emitUnlockState();
    return [];
  }

  try {
    const { data, error } = await supabase
      .from(unlockTable())
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "completed", "paid", "unlocked"]);

    if (error) throw error;

    const rows = (data || []).map(normalizeUnlock);

    UNLOCK_STATE.unlockedIds.clear();

    rows.forEach((row) => {
      const id =
        row.track_id ||
        row.music_track_id ||
        row.content_id ||
        row.product_id;

      if (id) {
        UNLOCK_STATE.unlockedIds.add(id);
      }
    });

    UNLOCK_STATE.purchases = rows;
    UNLOCK_STATE.ready = true;
    UNLOCK_STATE.error = null;

    emitUnlockState();

    return rows;
  } catch (error) {
    UNLOCK_STATE.error = normalizeError(error);
    console.warn("[RB MUSIC UNLOCK LOAD FAILED]", error?.message || error);
    emitUnlockState();
    return [];
  } finally {
    UNLOCK_STATE.loading = false;
    emitUnlockState();
  }
}

/* =========================
   ACCESS CHECKS
========================= */

export function trackRequiresUnlock(track = {}) {
  if (!track) return false;

  if (track.is_free === true) return false;
  if (Number(track.price_cents || 0) <= 0) return false;
  if (track.visibility === "public" && !track.is_premium) return false;

  return Boolean(
    track.is_premium ||
      track.requires_unlock ||
      Number(track.price_cents || 0) > 0
  );
}

export async function canPlayMusicTrack(track = {}) {
  if (!track?.id) {
    return {
      ok: false,
      reason: "missing_track"
    };
  }

  if (!trackRequiresUnlock(track)) {
    return {
      ok: true,
      reason: "free"
    };
  }

  if (!getUser()?.id) {
    return {
      ok: false,
      reason: "auth_required",
      redirectTo: `${RB_ROUTES.auth || "/auth"}?next=${encodeURIComponent(
        window.location.pathname + window.location.search
      )}`
    };
  }

  if (!UNLOCK_STATE.ready) {
    await loadMyMusicUnlocks();
  }

  if (isMusicUnlocked(track.id)) {
    return {
      ok: true,
      reason: "unlocked"
    };
  }

  return {
    ok: false,
    reason: "locked",
    redirectTo: `${RB_ROUTES.store || "/store"}?unlock=${encodeURIComponent(track.id)}`
  };
}

export async function requireMusicUnlock(track = {}) {
  const access = await canPlayMusicTrack(track);

  if (!access.ok) {
    if (access.redirectTo) {
      window.location.href = access.redirectTo;
    }

    throw new Error(
      access.reason === "auth_required"
        ? "Sign in required to play this track."
        : "Track is locked."
    );
  }

  return true;
}

/* =========================
   CREATE UNLOCKS
========================= */

export async function unlockMusicTrack({
  trackId,
  productId = null,
  priceCents = 0,
  currency = "usd",
  source = "manual",
  metadata = {}
} = {}) {
  const user = requireUser();
  const profile = await ensureMyProfile();
  const identity = getProfileIdentity(profile);

  if (!trackId) {
    throw new Error("Missing track id.");
  }

  const { data, error } = await supabase
    .from(unlockTable())
    .upsert(
      {
        user_id: user.id,
        track_id: trackId,
        music_track_id: trackId,
        product_id: productId,
        content_id: trackId,
        content_type: "music_track",

        status: "active",
        unlocked: true,
        price_cents: Number(priceCents || 0),
        currency,

        username: identity.username || null,
        display_name: identity.display_name || null,

        metadata: {
          source: "music-unlocked.js",
          unlock_source: source,
          ...metadata
        },
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "user_id,content_id"
      }
    )
    .select("*")
    .maybeSingle();

  if (error) throw error;

  markMusicUnlocked(trackId);

  await loadMyMusicUnlocks();

  return normalizeUnlock(data || {});
}

export async function unlockMusicFromProduct({
  productId,
  trackId = null,
  metadata = {}
} = {}) {
  const user = requireUser();

  if (!productId && !trackId) {
    throw new Error("Missing product or track id.");
  }

  let product = null;

  if (productId) {
    product = await rbSelect({
      table: productsTable(),
      select: "*",
      match: {
        id: productId
      },
      maybeSingle: true
    });
  }

  const finalTrackId =
    trackId ||
    product?.music_track_id ||
    product?.track_id ||
    product?.content_id ||
    product?.metadata?.track_id ||
    null;

  if (!finalTrackId) {
    throw new Error("Product has no music track attached.");
  }

  return await unlockMusicTrack({
    trackId: finalTrackId,
    productId: productId || product?.id || null,
    priceCents: product?.price_cents || 0,
    currency: product?.currency || "usd",
    source: "product",
    metadata: {
      product,
      user_id: user.id,
      ...metadata
    }
  });
}

/* =========================
   PREMIUM PRODUCT HELPER
========================= */

export async function createMusicUnlockProduct({
  trackId,
  title = "",
  description = "",
  priceCents = 0,
  currency = "usd",
  imageUrl = "",
  metadata = {}
} = {}) {
  const user = requireUser();
  const profile = await ensureMyProfile();
  const identity = getProfileIdentity(profile);

  if (!trackId) {
    throw new Error("Missing track id.");
  }

  const track = await rbSelect({
    table: musicTable(),
    select: "*",
    match: {
      id: trackId
    },
    maybeSingle: true
  });

  const rows = await rbInsert({
    table: productsTable(),
    values: {
      seller_id: user.id,
      creator_id: user.id,
      user_id: user.id,

      username: identity.username || null,
      display_name: identity.display_name || null,

      title: title || track?.title || "Music Unlock",
      name: title || track?.title || "Music Unlock",
      description: description || track?.description || "Unlock this Rich Bizness track.",

      image_url:
        imageUrl ||
        track?.cover_url ||
        track?.image_url ||
        "/images/brand/hero-banner.png",

      product_type: "music_unlock",
      content_type: "music_track",
      content_id: trackId,
      track_id: trackId,
      music_track_id: trackId,

      price_cents: Number(priceCents || 0),
      currency,
      status: "active",
      visibility: "public",
      is_digital: true,

      metadata: {
        source: "music-unlocked.js",
        track_id: trackId,
        ...metadata
      },
      updated_at: new Date().toISOString()
    }
  });

  return rows?.[0] || null;
}

/* =========================
   LOCK TRACK
========================= */

export async function markTrackPremium({
  trackId,
  priceCents = 0,
  productId = null
} = {}) {
  const user = requireUser();

  if (!trackId) {
    throw new Error("Missing track id.");
  }

  const rows = await rbUpdate({
    table: musicTable(),
    match: {
      id: trackId,
      user_id: user.id
    },
    values: {
      is_premium: true,
      requires_unlock: true,
      price_cents: Number(priceCents || 0),
      unlock_product_id: productId,
      updated_at: new Date().toISOString()
    }
  });

  return rows?.[0] || null;
}

export async function unlockTrackAfterPurchase({
  productId,
  trackId = null,
  orderId = null,
  metadata = {}
} = {}) {
  return await unlockMusicFromProduct({
    productId,
    trackId,
    metadata: {
      order_id: orderId,
      purchase_confirmed: true,
      ...metadata
    }
  });
}

/* =========================
   UI BINDING
========================= */

export function bindMusicUnlockBadges({
  selector = "[data-music-track-id]",
  lockedClass = "is-locked",
  unlockedClass = "is-unlocked"
} = {}) {
  return onMusicUnlockState(() => {
    document.querySelectorAll(selector).forEach((el) => {
      const id =
        el.dataset.musicTrackId ||
        el.dataset.trackId ||
        "";

      if (!id) return;

      const unlocked = isMusicUnlocked(id);

      el.classList.toggle(unlockedClass, unlocked);
      el.classList.toggle(lockedClass, !unlocked);
    });
  });
}

export async function initMusicUnlocks() {
  const unlocks = await loadMyMusicUnlocks();

  console.log("RB MUSIC UNLOCKS READY");

  return unlocks;
}

console.log("RB MUSIC UNLOCK ENGINE READY");
