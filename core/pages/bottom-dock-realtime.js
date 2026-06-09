/* =========================
   RICH BIZNESS MOBILE
   /core/pages/bottom-dock-realtime.js

   BOTTOM DOCK REALTIME ENGINE
   Uses locked rb-supabase.js client
   No duplicate Supabase client

   Updates:
   - Safer table fallbacks
   - Realtime cleanup lock
   - Profile Lock + XP dock energy
   - Better missing-table tolerance
   - Game score fallback support
========================= */

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  bootAuth,
  createRealtimeChannel,
  removeRealtimeChannel
} from "/core/shared/rb-supabase.js";

const supabase = getSupabase();

const TABLES = {
  live: RB_TABLES.liveStreams || "live_streams",
  feed: RB_TABLES.feedPosts || "feed_posts",
  music: RB_TABLES.musicTracks || RB_TABLES.tracks || "music_tracks",
  gaming: RB_TABLES.gameScores || RB_TABLES.gamingUploads || RB_TABLES.gameClips || "game_scores",
  upload: RB_TABLES.uploads || RB_TABLES.generalUploads || "uploads"
};

const FALLBACK_TABLES = {
  live: ["live_streams"],
  feed: ["feed_posts"],
  music: ["music_tracks", "tracks"],
  gaming: ["game_scores", "gaming_uploads", "game_clips"],
  upload: ["uploads", "general_uploads", "feed_posts"]
};

const state = {
  feed: 0,
  live: 0,
  music: 0,
  gaming: 0,
  upload: 0
};

const profileState = {
  locked: false,
  userId: "",
  profileId: "",
  xp: 0,
  level: 1,
  rank: "Biz Legend",
  percent: 0
};

const channels = [];
const watchedTables = new Set();

let booted = false;
let loadingCounts = false;
let destroyed = false;

function getDockButton(key) {
  return document.querySelector(`.rb-bottom-nav [data-route="${key}"]`);
}

function safeCount(value) {
  return Math.max(0, Number(value || 0));
}

function setDockState(key, count) {
  const button = getDockButton(key);
  if (!button) return;

  const nextCount = safeCount(count);

  button.dataset.count = nextCount > 0 ? String(nextCount) : "";
  button.classList.toggle("rb-dock-active", nextCount > 0);
  button.classList.toggle("rb-live-active", key === "live" && nextCount > 0);
  button.classList.toggle("rb-xp-active", profileState.percent > 0);
  button.classList.toggle("rb-profile-locked", profileState.locked);

  let badge = button.querySelector("[data-rb-dock-count]");

  if (!badge) {
    badge = document.createElement("span");
    badge.className = "rb-dock-count";
    badge.dataset.rbDockCount = "";
    button.appendChild(badge);
  }

  badge.textContent = nextCount > 99 ? "99+" : String(nextCount);
  badge.hidden = nextCount <= 0;

  if (key === "gaming" && profileState.level) {
    button.dataset.level = String(profileState.level);
  }
}

function setProfileDockState(next = {}) {
  const xp = Number(next.xp ?? next.rich_points ?? next.points ?? profileState.xp ?? 0) || 0;
  const level = Number(next.level ?? next.rich_level ?? profileState.level ?? 1) || 1;
  const rank = next.rank || next.rankTitle || next.rank_title || profileState.rank || "Biz Legend";

  let percent = next.percent ?? next.xpPercent ?? next.progress ?? profileState.percent ?? 0;

  if (percent > 1) {
    percent = percent / 100;
  }

  percent = Math.max(0, Math.min(1, Number(percent) || 0));

  profileState.xp = xp;
  profileState.level = level;
  profileState.rank = rank;
  profileState.percent = percent;
  profileState.locked =
    document.body.dataset.rbProfileLocked === "true" ||
    document.body.dataset.rbProfileLock === "true" ||
    Boolean(next.locked);

  profileState.userId = next.userId || next.user_id || document.body.dataset.rbUserId || profileState.userId || "";
  profileState.profileId = next.profileId || next.profile_id || document.body.dataset.rbProfileId || profileState.profileId || "";

  document.body.dataset.rbProfileLocked = profileState.locked ? "true" : "false";

  if (profileState.userId) {
    document.body.dataset.rbUserId = profileState.userId;
  }

  if (profileState.profileId) {
    document.body.dataset.rbProfileId = profileState.profileId;
  }

  document.body.classList.toggle("rb-orbit-xp-energy", profileState.percent > 0);
  document.body.classList.toggle("rb-bottom-dock-profile-locked", profileState.locked);

  window.dispatchEvent(
    new CustomEvent("rb:dock-profile-update", {
      detail: { ...profileState }
    })
  );
}

function renderDock() {
  Object.entries(state).forEach(([key, count]) => {
    setDockState(key, count);
  });

  window.dispatchEvent(
    new CustomEvent("rb:dock-update", {
      detail: {
        ...state,
        profile: { ...profileState }
      }
    })
  );
}

function buildCountRequest(table, query = null) {
  let req = supabase.from(table).select("id", {
    count: "exact",
    head: true
  });

  if (query) {
    Object.entries(query).forEach(([col, value]) => {
      if (value !== undefined && value !== null) {
        req = req.eq(col, value);
      }
    });
  }

  return req;
}

async function countOneTable(key, table, query = null) {
  const { count, error } = await buildCountRequest(table, query);

  if (error) {
    console.warn(`[RB DOCK COUNT WARNING: ${key}:${table}]`, error.message);
    return null;
  }

  return count || 0;
}

async function countTable(key, table, query = null) {
  const candidates = [
    table,
    ...(FALLBACK_TABLES[key] || [])
  ].filter(Boolean);

  const uniqueCandidates = [...new Set(candidates)];

  for (const candidate of uniqueCandidates) {
    const count = await countOneTable(key, candidate, query);

    if (count !== null) {
      state[key] = count;
      TABLES[key] = candidate;
      return;
    }

    if (query) {
      const fallbackCount = await countOneTable(key, candidate, null);

      if (fallbackCount !== null) {
        state[key] = fallbackCount;
        TABLES[key] = candidate;
        return;
      }
    }
  }

  state[key] = 0;
}

async function loadDockCounts() {
  if (loadingCounts || destroyed) return;

  loadingCounts = true;

  try {
    await Promise.allSettled([
      countTable("feed", TABLES.feed),
      countTable("live", TABLES.live, { status: "live" }),
      countTable("music", TABLES.music),
      countTable("gaming", TABLES.gaming),
      countTable("upload", TABLES.upload)
    ]);

    renderDock();
  } finally {
    loadingCounts = false;
  }
}

function watchDockTable(key, table) {
  if (!table || watchedTables.has(`${key}:${table}`)) return;

  watchedTables.add(`${key}:${table}`);

  const channel = createRealtimeChannel(`rb-dock-${key}-${table}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table
      },
      () => loadDockCounts()
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`RB DOCK REALTIME WATCHING ${key}:${table}`);
      }
    });

  channels.push(channel);
}

function watchAllDockTables() {
  Object.entries(TABLES).forEach(([key, table]) => {
    watchDockTable(key, table);
  });

  Object.entries(FALLBACK_TABLES).forEach(([key, tables]) => {
    tables.forEach((table) => watchDockTable(key, table));
  });
}

function onXpGaugeUpdate(event) {
  setProfileDockState(event?.detail || {});
  renderDock();
}

function onProfileLockUpdate(event) {
  setProfileDockState(event?.detail || {});
  renderDock();
}

export async function bootBottomDock() {
  if (booted) return;

  booted = true;
  destroyed = false;

  try {
    const auth = await bootAuth();
    const sessionUser =
      auth?.user ||
      auth?.session?.user ||
      auth?.data?.user ||
      auth?.data?.session?.user ||
      null;

    if (sessionUser?.id) {
      setProfileDockState({
        userId: sessionUser.id,
        profileId: sessionUser.id,
        locked: true
      });
    }
  } catch (error) {
    console.warn("[RB DOCK AUTH WARNING]", error?.message || error);
  }

  window.addEventListener("rb:xp-gauge-update", onXpGaugeUpdate);
  window.addEventListener("rb:app-xp-update", onXpGaugeUpdate);
  window.addEventListener("rb:profile-lock-update", onProfileLockUpdate);
  window.addEventListener("rb:profile-ready", onProfileLockUpdate);

  await loadDockCounts();
  watchAllDockTables();

  document.body.classList.add("rb-bottom-dock-ready");

  renderDock();

  console.log("RB BOTTOM DOCK REALTIME READY");
}

export async function destroyBottomDock() {
  destroyed = true;

  window.removeEventListener("rb:xp-gauge-update", onXpGaugeUpdate);
  window.removeEventListener("rb:app-xp-update", onXpGaugeUpdate);
  window.removeEventListener("rb:profile-lock-update", onProfileLockUpdate);
  window.removeEventListener("rb:profile-ready", onProfileLockUpdate);

  await Promise.allSettled(
    channels.map((channel) => removeRealtimeChannel(channel))
  );

  channels.length = 0;
  watchedTables.clear();

  booted = false;
  loadingCounts = false;

  document.body.classList.remove("rb-bottom-dock-ready");
}

window.RBRefreshBottomDock = loadDockCounts;
window.RBBootBottomDock = bootBottomDock;
window.RBDestroyBottomDock = destroyBottomDock;

window.addEventListener("beforeunload", destroyBottomDock);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootBottomDock, { once: true });
} else {
  bootBottomDock();
}
