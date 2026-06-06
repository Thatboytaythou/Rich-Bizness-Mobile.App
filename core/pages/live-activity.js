/* =========================
   RICH BIZNESS MOBILE
   /core/pages/live-activity.js

   LIVE ACTIVITY ENGINE
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

const LIVE_TABLE = RB_TABLES.liveStreams || "live_streams";

const state = {
  liveCount: 0,
  featuredLive: null
};

const channels = [];
let booted = false;
let loading = false;

function setLiveUI() {
  document.body.classList.toggle("rb-has-live", state.liveCount > 0);

  const liveButtons = document.querySelectorAll(
    '[data-route="live"], [data-route="watch"]'
  );

  liveButtons.forEach((btn) => {
    btn.classList.toggle("rb-live-active", state.liveCount > 0);
    btn.dataset.count = state.liveCount > 0 ? String(state.liveCount) : "";

    let badge = btn.querySelector("[data-rb-live-count]");

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "rb-live-count";
      badge.dataset.rbLiveCount = "";
      btn.appendChild(badge);
    }

    badge.textContent = state.liveCount > 99 ? "99+" : String(state.liveCount);
    badge.hidden = state.liveCount <= 0;
  });

  window.dispatchEvent(
    new CustomEvent("rb:activity-update", {
      detail: {
        live: {
          active: state.liveCount > 0,
          count: state.liveCount,
          featured: state.featuredLive
        }
      }
    })
  );
}

export async function loadLiveActivity() {
  if (loading) return;

  loading = true;

  try {
    const { count, error } = await supabase
      .from(LIVE_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("status", "live");

    if (error) {
      console.warn("[RB LIVE COUNT WARNING]", error.message);
    } else {
      state.liveCount = count || 0;
    }

    const { data, error: featuredError } = await supabase
      .from(LIVE_TABLE)
      .select("id,title,slug,viewer_count,thumbnail_url,cover_url,created_at,status")
      .eq("status", "live")
      .order("viewer_count", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (featuredError) {
      console.warn("[RB FEATURED LIVE WARNING]", featuredError.message);
      state.featuredLive = null;
    } else {
      state.featuredLive = data || null;
    }

    setLiveUI();
  } finally {
    loading = false;
  }
}

function watchLiveActivity() {
  const channel = createRealtimeChannel("rb-live-activity")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: LIVE_TABLE
      },
      () => {
        loadLiveActivity();
      }
    )
    .subscribe();

  channels.push(channel);
}

export async function bootLiveActivity() {
  if (booted) return;

  booted = true;

  await bootAuth();
  await loadLiveActivity();

  watchLiveActivity();

  document.body.classList.add("rb-live-activity-ready");

  console.log("RB LIVE ACTIVITY READY");
}

export async function destroyLiveActivity() {
  await Promise.allSettled(
    channels.map((channel) => removeRealtimeChannel(channel))
  );

  channels.length = 0;
  booted = false;
}

window.RBLoadLiveActivity = loadLiveActivity;

window.addEventListener("beforeunload", destroyLiveActivity);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootLiveActivity);
} else {
  bootLiveActivity();
}
