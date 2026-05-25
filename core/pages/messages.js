/* =========================
   RICH BIZNESS MOBILE
   /core/pages/messages.js

   MESSAGES PAGE CONTROLLER
   Synced with auth + profile-state
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  refreshProfileState,
  onProfileState
} from "/core/features/profile/profile-state.js";

import {
  profileName,
  profileAvatar,
  profileHandle
} from "/core/shared/rb-profile.js";

import {
  toastInfo,
  toastError
} from "/core/shared/rb-toast.js";

const $ = (id) => document.getElementById(id);

const els = {
  name: $("messages-user-name"),
  handle: $("messages-user-handle"),
  avatar: $("messages-user-avatar"),
  status: $("messages-status"),
  newBtn: $("messages-new-btn"),
  threadCount: $("messages-thread-count"),
  syncStatus: $("messages-sync-status"),
  identityStatus: $("messages-identity-status")
};

let supabase = null;
let channel = null;
let actionsBound = false;

function currentState() {
  return getCurrentUserState() || {};
}

function currentUser() {
  return currentState().user || null;
}

function currentProfile() {
  return currentState().profile || null;
}

function paintMessages() {
  const user = currentUser();
  const profile = currentProfile();

  if (els.name) {
    els.name.textContent = profileName(profile);
  }

  if (els.handle) {
    els.handle.textContent = profileHandle(profile);
  }

  if (els.avatar) {
    const avatar = profileAvatar(profile);

    if (els.avatar.tagName === "IMG") {
      els.avatar.src = avatar;
      els.avatar.alt = profileName(profile);
    } else {
      els.avatar.style.backgroundImage = `url("${avatar}")`;
    }
  }

  if (els.status) {
    els.status.textContent = user?.id
      ? "Messages system connected to your Rich Bizness identity."
      : "Sign in to use messages.";
  }

  if (els.identityStatus) {
    els.identityStatus.textContent = profile?.id
      ? "Profile synced"
      : "Waiting for profile";
  }
}

async function loadThreadCount() {
  const user = currentUser();

  if (!user?.id) {
    if (els.threadCount) {
      els.threadCount.textContent = "0 active conversations";
    }

    if (els.syncStatus) {
      els.syncStatus.textContent = "Sign in required";
    }

    return;
  }

  try {
    const { count, error } = await supabase
      .from(RB_TABLES.dmThreadMembers)
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("user_id", user.id)
      .eq("status", "active");

    if (error) throw error;

    if (els.threadCount) {
      els.threadCount.textContent = `${count || 0} active conversations`;
    }

    if (els.syncStatus) {
      els.syncStatus.textContent = "Messages synced";
    }
  } catch (error) {
    console.warn("[RB MESSAGES THREAD COUNT WARNING]", error.message);

    if (els.threadCount) {
      els.threadCount.textContent = "0 active conversations";
    }

    if (els.syncStatus) {
      els.syncStatus.textContent = "Messages table waiting";
    }
  }
}

function clearRealtime() {
  if (channel) {
    supabase?.removeChannel(channel);
    channel = null;
  }
}

function bindRealtime() {
  const user = currentUser();

  if (!user?.id || !supabase) return;

  clearRealtime();

  channel = supabase
    .channel(`rb-messages-${user.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.dmThreadMembers,
        filter: `user_id=eq.${user.id}`
      },
      loadThreadCount
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.dmMessages
      },
      loadThreadCount
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.profiles,
        filter: `id=eq.${user.id}`
      },
      async () => {
        await refreshProfileState();
        await refreshAppIdentity();
        paintMessages();
      }
    )
    .subscribe();
}

function bindMessagesActions() {
  if (actionsBound) return;
  actionsBound = true;

  els.newBtn?.addEventListener("click", () => {
    toastInfo(
      "Message composer is next in order.",
      "Rich Bizness DMs"
    );
  });

  window.addEventListener("beforeunload", clearRealtime);
}

async function bootMessagesPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    await ensureMyProfile();
    await refreshProfileState();
    await refreshAppIdentity();

    paintMessages();
    bindMessagesActions();

    onProfileState((profileState) => {
      if (!profileState.ready) return;
      paintMessages();
    });

    await loadThreadCount();
    bindRealtime();

    document.body.classList.add("rb-messages-ready");

    markPageReady("messages");

    console.log("RB MESSAGES READY");
  } catch (error) {
    console.error("[RB MESSAGES BOOT FAILED]", error);
    markPageError(error);
    toastError(error?.message || "Messages failed to load.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootMessagesPage);
} else {
  bootMessagesPage();
}
