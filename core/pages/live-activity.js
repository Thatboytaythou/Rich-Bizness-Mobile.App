import RB_CONFIG from "/core/shared/rb-config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  RB_CONFIG.supabase.url,
  RB_CONFIG.supabase.publishableKey
);

const LIVE_TABLE = RB_CONFIG.tables.liveStreams || "live_streams";

const state = {
  liveCount: 0,
  featuredLive: null,
};

function setLiveUI() {
  document.body.classList.toggle("rb-has-live", state.liveCount > 0);

  const liveButtons = document.querySelectorAll('[data-route="live"], [data-route="watch"]');

  liveButtons.forEach((btn) => {
    btn.classList.toggle("rb-live-active", state.liveCount > 0);
    btn.dataset.count = state.liveCount > 0 ? String(state.liveCount) : "";
  });

  window.dispatchEvent(
    new CustomEvent("rb:activity-update", {
      detail: {
        live: {
          active: state.liveCount > 0,
          count: state.liveCount,
          featured: state.featuredLive,
        },
      },
    })
  );
}

async function loadLiveActivity() {
  const { count, error } = await supabase
    .from(LIVE_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("status", "live");

  if (!error) {
    state.liveCount = count || 0;
  }

  const { data } = await supabase
    .from(LIVE_TABLE)
    .select("id,title,slug,viewer_count,thumbnail_url,cover_url,created_at")
    .eq("status", "live")
    .order("viewer_count", { ascending: false })
    .limit(1)
    .maybeSingle();

  state.featuredLive = data || null;

  setLiveUI();
}

function watchLiveActivity() {
  supabase
    .channel("rb-live-activity")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: LIVE_TABLE,
      },
      () => {
        loadLiveActivity();
      }
    )
    .subscribe();
}

loadLiveActivity();
watchLiveActivity();

console.log("RB LIVE ACTIVITY READY");
