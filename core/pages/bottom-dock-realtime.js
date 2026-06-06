/* =========================
   RICH BIZNESS MOBILE
   /core/pages/bottom-dock-realtime.js

   BOTTOM DOCK REALTIME ENGINE
   Uses locked rb-supabase.js client
   No duplicate Supabase client
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
  music: RB_TABLES.musicTracks || "music_tracks",
  gaming: RB_TABLES.gameScores || "game_scores",
  upload: RB_TABLES.uploads || "uploads"
};

const state = {
  feed: 0,
  live: 0,
  music: 0,
  gaming: 0,
  upload: 0
};

const channels = [];
let booted = false;
let loadingCounts = false;

function getDockButton(key) {
  return document.querySelector(`.rb-bottom-nav [data-route="${key}"]`);
}

function setDockState(key, count) {
  const button = getDockButton(key);
  if (!button) return;

  const safeCount = Number(count || 0);

  button.dataset.count = safeCount > 0 ? String(safeCount) : "";
  button.classList.toggle("rb-dock-active", safeCount > 0);
  button.classList.toggle("rb-live-active", key === "live" && safeCount > 0);

  let badge = button.querySelector("[data-rb-dock-count]");

  if (!badge) {
    badge = document.createElement("span");
    badge.className = "rb-dock-count";
    badge.dataset.rbDockCount = "";
    button.appendChild(badge);
  }

  badge.textContent = safeCount > 99 ? "99+" : String(safeCount);
  badge.hidden = safeCount <= 0;
}

function renderDock() {
  Object.entries(state).forEach(([key, count]) => {
    setDockState(key, count);
  });

  window.dispatchEvent(
    new CustomEvent("rb:dock-update", {
      detail: { ...state }
    })
  );
}

async function countTable(key, table, query = null) {
  if (!table) return;

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

  const { count, error } = await req;

  if (error) {
    console.warn(`[RB DOCK COUNT WARNING: ${key}]`, error.message);
    return;
  }

  state[key] = count || 0;
}

async function loadDockCounts() {
  if (loadingCounts) return;

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
  if (!table) return;

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
    .subscribe();

  channels.push(channel);
}

export async function bootBottomDock() {
  if (booted) return;

  booted = true;

  await bootAuth();
  await loadDockCounts();

  Object.entries(TABLES).forEach(([key, table]) => {
    watchDockTable(key, table);
  });

  document.body.classList.add("rb-bottom-dock-ready");

  console.log("RB BOTTOM DOCK REALTIME READY");
}

export async function destroyBottomDock() {
  await Promise.allSettled(
    channels.map((channel) => removeRealtimeChannel(channel))
  );

  channels.length = 0;
  booted = false;
}

window.RBRefreshBottomDock = loadDockCounts;

window.addEventListener("beforeunload", destroyBottomDock);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootBottomDock);
} else {
  bootBottomDock();
}
