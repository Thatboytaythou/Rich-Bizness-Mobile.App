import RB_CONFIG from "/core/shared/rb-config.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  RB_CONFIG.supabase.url,
  RB_CONFIG.supabase.publishableKey
);

const state = {
  onlineCount: 0,
  users: [],
};

function updatePresenceUI() {
  document.body.classList.toggle("rb-has-presence", state.onlineCount > 0);

  const profileChip = document.querySelector(".rb-profile-chip");

  if (profileChip) {
    profileChip.dataset.online = String(state.onlineCount);
    profileChip.classList.toggle("rb-online-active", state.onlineCount > 0);
  }

  window.dispatchEvent(
    new CustomEvent("rb:presence-update", {
      detail: {
        onlineCount: state.onlineCount,
        users: state.users,
      },
    })
  );
}

async function bootPresence() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id || crypto.randomUUID();

  const channel = supabase.channel("rb-online-presence", {
    config: {
      presence: {
        key: userId,
      },
    },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const presenceState = channel.presenceState();

      const users = Object.values(presenceState)
        .flat()
        .filter(Boolean);

      state.users = users;
      state.onlineCount = users.length;

      updatePresenceUI();
    })
    .subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;

      await channel.track({
        user_id: userId,
        section: "portal",
        online_at: new Date().toISOString(),
      });
    });
}

bootPresence();

console.log("RB ONLINE PRESENCE READY");
