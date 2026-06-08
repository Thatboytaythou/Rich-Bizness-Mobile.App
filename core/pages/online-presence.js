/* =========================
   RICH BIZNESS MOBILE
   /core/pages/online-presence.js

   ONLINE PRESENCE ENGINE
   Shared Supabase Client + Profile Identity

   Updates:
   - No duplicate Supabase client
   - Stable guest presence ID
   - Safe profile identity keys
   - Meta/world activity compatible event detail
   - Clean channel teardown
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

const PRESENCE_CHANNEL = "rb-online-presence";
const GUEST_KEY = "rb_guest_presence_id";

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
    window.location.pathname.replace(/^\/+/, "").replace(/\/+$/, "") ||
    "portal"
  );
}

function safeIdentity(profile = null) {
  const identity = getProfileIdentity(profile) || {};

  return {
    id: identity.id || profile?.id || null,
    username: identity.username || profile?.username || null,
    displayName:
      identity.displayName ||
      identity.display_name ||
      profile?.display_name ||
      profile?.full_name ||
      "Guest",
    avatarUrl:
      identity.avatarUrl ||
      identity.avatar_url ||
      profile?.avatar_url ||
      null,
    rankTitle:
      identity.rankTitle ||
      identity.rank_title ||
      profile?.rank_title ||
      "Member",
    richLevel:
      identity.richLevel ||
      identity.rich_level ||
      profile?.rich_level ||
      1
  };
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
        onlineActive: state.onlineCount > 0,
        onlineCount: state.onlineCount,
        presenceUsers: state.users,
        presence: {
          active: state.onlineCount > 0,
          count: state.onlineCount,
          users: state.users
        },
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

function getPresenceKey(user = null) {
  if (user?.id) return user.id;

  let guestId = localStorage.getItem(GUEST_KEY);

  if (!guestId) {
    guestId = crypto.randomUUID();
    localStorage.setItem(GUEST_KEY, guestId);
  }

  return guestId;
}

async function trackPresence(channel = state.channel) {
  if (!channel) return;

  const session = getSession?.();
  const user = getUser?.() || session?.user || null;
  const profile = getProfile?.() || null;
  const identity = safeIdentity(profile);

  await channel.track({
    user_id: user?.id || null,
    session_id: user?.id ? null : getPresenceKey(null),
    username: identity.username,
    display_name: identity.displayName,
    avatar_url: identity.avatarUrl,
    rank_title: identity.rankTitle,
    rich_level: identity.richLevel,
    section: currentSection(),
    path: window.location.pathname,
    online_at: new Date().toISOString()
  });
}

function syncPresenceFromChannel(channel = state.channel) {
  if (!channel) return;

  const users = flattenPresence(channel.presenceState());

  state.users = users;
  state.onlineCount = users.length;

  updatePresenceUI();
}

export async function bootPresence() {
  try {
    await bootAuth();

    if (state.channel) {
      await supabase.removeChannel(state.channel);
      state.channel = null;
    }

    const user = getUser?.();
    const presenceKey = getPresenceKey(user);

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: {
        presence: {
          key: presenceKey
        }
      }
    });

    state.channel = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        syncPresenceFromChannel(channel);
      })
      .on("presence", { event: "join" }, () => {
        syncPresenceFromChannel(channel);
      })
      .on("presence", { event: "leave" }, () => {
        syncPresenceFromChannel(channel);
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

window.RBBootPresence = bootPresence;
window.RBClearPresence = clearPresence;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootPresence);
} else {
  bootPresence();
}

console.log("RB ONLINE PRESENCE READY");
