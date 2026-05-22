/* =========================
   RICH BIZNESS MOBILE
   /core/pages/messages.js
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import { getSupabase } from "/core/shared/rb-supabase.js";

import {
  profileName,
  profileAvatar,
  profileHandle
} from "/core/shared/rb-profile.js";

import { RB_TABLES } from "/core/shared/rb-config.js";

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

function paintMessages() {
  const state = getCurrentUserState();
  const user = state?.user || null;
  const profile = state?.profile || null;

  if (els.name) els.name.textContent = profileName(profile);
  if (els.handle) els.handle.textContent = profileHandle(profile);
  if (els.avatar) els.avatar.src = profileAvatar(profile);

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
  const state = getCurrentUserState();
  const user = state?.user || null;

  if (!user?.id) return;

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
    console.warn("[messages.js]", error.message);

    if (els.syncStatus) {
      els.syncStatus.textContent = "Messages table waiting";
    }
  }
}

function bindRealtime() {
  const state = getCurrentUserState();
  const user = state?.user || null;

  if (!user?.id) return;

  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }

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
    .subscribe();
}

function bindMessagesActions() {
  els.newBtn?.addEventListener("click", () => {
    toastInfo(
      "Message composer is next in order.",
      "Rich Bizness DMs"
    );
  });

  window.addEventListener("beforeunload", () => {
    if (channel) supabase?.removeChannel(channel);
  });
}

async function bootMessagesPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    paintMessages();
    bindMessagesActions();

    await loadThreadCount();
    bindRealtime();

    document.body.classList.add("rb-messages-ready");
    markPageReady("messages");

    console.log("RB MESSAGES READY");
  } catch (error) {
    console.error("[messages.js]", error);
    markPageError(error);
    toastError(error?.message || "Messages failed to load.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootMessagesPage);
} else {
  bootMessagesPage();
}
