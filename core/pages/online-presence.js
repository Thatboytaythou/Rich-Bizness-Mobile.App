/* =========================
   RICH BIZNESS MOBILE
   /core/pages/online-presence.js

   ONLINE PRESENCE ENGINE
   Shared Supabase Client + Profile Identity
========================= */

import {
  getSupabase,
  getSession,
  getUser,
  getProfile,
  bootAuth
} from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity
} from "/core/shared/rb-profile.js";

const supabase = getSupabase();

const state = {
  channel: null,
  onlineCount: 0,
  users: []
};

function currentSection() {
  return (
    document.body?.dataset?.rbRoute ||
    document.body?.dataset?.page ||
    document.body?.dataset?.section ||
    window.location.pathname.replace("/", "") ||
    "portal"
  );
}

function updatePresenceUI() {
  document.body?.classList.toggle("rb-has-presence", state.onlineCount > 0);

  const profileChip = document.querySelector(".rb-profile-chip");

  if (profileChip) {
    profileChip.dataset.online = String(state.onlineCount);
    profileChip.classList.toggle("rb-online-active", state.onlineCount > 0);
  }

  document.querySelectorAll("[data-rb-online-count]").forEach((el) => {
    el.textContent = String(state.onlineCount);
  });

  window.dispatchEvent(
    new CustomEvent("rb:presence-update", {
      detail: {
        onlineCount: state.onlineCount,
        users: state.users
      }
    })
  );
}

function flattenPresence(presenceState = {}) {
  return Object.values(presenceState)
    .flat()
    .filter(Boolean);
}

async function trackPresence(channel) {
  const session = getSession();
  const user = getUser() || session?.user || null;
  const profile = getProfile();
  const identity = getProfileIdentity(profile);

  await channel.track({
    user_id: user?.id || null,
    session_id: user?.id ? null : crypto.randomUUID(),
    username: identity?.username || null,
    display_name: identity?.display_name || "Guest",
    avatar_url: identity?.avatar_url || null,
    section: currentSection(),
    path: window.location.pathname,
    online_at: new Date().toISOString()
  });
}

export async function bootPresence() {
  try {
    await bootAuth();

    if (state.channel) {
      await supabase.removeChannel(state.channel);
      state.channel = null;
    }

    const user = getUser();
    const presenceKey =
      user?.id ||
      localStorage.getItem("rb_guest_presence_id") ||
      crypto.randomUUID();

    if (!user?.id) {
      localStorage.setItem("rb_guest_presence_id", presenceKey);
    }

    const channel = supabase.channel("rb-online-presence", {
      config: {
        presence: {
          key: presenceKey
        }
      }
    });

    state.channel = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const users = flattenPresence(channel.presenceState());

        state.users = users;
        state.onlineCount = users.length;

        updatePresenceUI();
      })
      .on("presence", { event: "join" }, () => {
        const users = flattenPresence(channel.presenceState());

        state.users = users;
        state.onlineCount = users.length;

        updatePresenceUI();
      })
      .on("presence", { event: "leave" }, () => {
        const users = flattenPresence(channel.presenceState());

        state.users = users;
        state.onlineCount = users.length;

        updatePresenceUI();
      })
      .subscribe(async (status) => {
        console.log(`[RB ONLINE PRESENCE] ${status}`);

        if (status !== "SUBSCRIBED") return;

        await trackPresence(channel);
      });

    return channel;
  } catch (error) {
    console.warn("[RB ONLINE PRESENCE FAILED]", error?.message || error);
    updatePresenceUI();
    return null;
  }
}

export async function clearPresence() {
  if (!state.channel) return;

  await supabase.removeChannel(state.channel);
  state.channel = null;
  state.onlineCount = 0;
  state.users = [];

  updatePresenceUI();
}

window.addEventListener("beforeunload", () => {
  clearPresence();
});

window.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;
  if (!state.channel) return;

  try {
    await trackPresence(state.channel);
  } catch (error) {
    console.warn("[RB PRESENCE RETRACK SKIPPED]", error?.message || error);
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootPresence);
} else {
  bootPresence();
}

console.log("RB ONLINE PRESENCE READY");
