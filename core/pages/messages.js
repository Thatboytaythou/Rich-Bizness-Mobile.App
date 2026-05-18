/* =========================
   RICH BIZNESS MOBILE
   /core/pages/messages.js

   MESSAGES PAGE CONTROLLER
   Locked To Current Auth/Profile Chain
========================= */

import {
  autoGuardCurrentPage
} from "/core/features/auth/session-guard.js";

import {
  initAuthState,
  onAuthState
} from "/core/features/auth/auth-state.js";

import {
  profileName,
  profileAvatar,
  profileHandle
} from "/core/shared/rb-profile.js";

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser
} from "/core/shared/rb-supabase.js";

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

function paintMessages(state) {
  const user = state?.user || null;
  const profile = state?.profile || null;

  if (els.name) {
    els.name.textContent = profileName(profile);
  }

  if (els.handle) {
    els.handle.textContent = profileHandle(profile);
  }

  if (els.avatar) {
    els.avatar.src = profileAvatar(profile);
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
  const user = getUser();

  if (!user?.id) return;

  try {
    const supabase = getSupabase();

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
      els.threadCount.textContent =
        `${count || 0} active conversations`;
    }

    if (els.syncStatus) {
      els.syncStatus.textContent = "Messages synced";
    }
  } catch (error) {
    console.warn("[RB MESSAGES COUNT WARNING]", error.message);

    if (els.syncStatus) {
      els.syncStatus.textContent = "Messages table waiting";
    }
  }
}

function bindMessagesActions() {
  els.newBtn?.addEventListener("click", () => {
    toastInfo(
      "Message composer is next in order.",
      "Rich Bizness DMs"
    );
  });
}

async function bootMessagesPage() {
  try {
    await autoGuardCurrentPage();

    const state = await initAuthState();

    paintMessages(state);

    await loadThreadCount();

    onAuthState(async (nextState) => {
      paintMessages(nextState);
      await loadThreadCount();
    });

    bindMessagesActions();

    document.body.classList.add("rb-messages-ready");

    console.log("RB MESSAGES READY");
  } catch (error) {
    console.error(error);

    toastError(
      error?.message ||
        "Messages failed to load."
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    bootMessagesPage
  );
} else {
  bootMessagesPage();
}
