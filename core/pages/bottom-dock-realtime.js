import RB_CONFIG from "/core/shared/rb-config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  RB_CONFIG.supabase.url,
  RB_CONFIG.supabase.publishableKey
);

const TABLES = {
  live: RB_CONFIG.tables.liveStreams || "live_streams",
  feed: RB_CONFIG.tables.feedPosts || "feed_posts",
  music: RB_CONFIG.tables.musicTracks || "music_tracks",
  gaming: RB_CONFIG.tables.gameScores || "game_scores",
  upload: RB_CONFIG.tables.uploads || "uploads",
};

const state = {
  feed: 0,
  live: 0,
  music: 0,
  gaming: 0,
  upload: 0,
};

function getDockButton(key) {
  return document.querySelector(`.rb-bottom-nav [data-route="${key}"]`);
}

function setDockState(key, count) {
  const button = getDockButton(key);
  if (!button) return;

  button.dataset.count = count > 0 ? String(count) : "";
  button.classList.toggle("rb-dock-active", count > 0);
  button.classList.toggle("rb-live-active", key === "live" && count > 0);
}

function renderDock() {
  Object.entries(state).forEach(([key, count]) => {
    setDockState(key, count);
  });

  window.dispatchEvent(
    new CustomEvent("rb:dock-update", {
      detail: { ...state },
    })
  );
}

async function countTable(key, table, query) {
  let req = supabase.from(table).select("id", {
    count: "exact",
    head: true,
  });

  if (query) {
    Object.entries(query).forEach(([col, value]) => {
      req = req.eq(col, value);
    });
  }

  const { count, error } = await req;

  if (!error) {
    state[key] = count || 0;
  }
}

async function loadDockCounts() {
  await Promise.all([
    countTable("feed", TABLES.feed),
    countTable("live", TABLES.live, { status: "live" }),
    countTable("music", TABLES.music),
    countTable("gaming", TABLES.gaming),
    countTable("upload", TABLES.upload),
  ]);

  renderDock();
}

function watchDockTable(table) {
  supabase
    .channel(`rb-dock-${table}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
      },
      () => loadDockCounts()
    )
    .subscribe();
}

function bootBottomDock() {
  loadDockCounts();

  Object.values(TABLES).forEach((table) => {
    watchDockTable(table);
  });
}

bootBottomDock();

console.log("RB BOTTOM DOCK REALTIME READY");
