/* =========================
   RICH BIZNESS MOBILE
   /core/pages/messages.js

   MESSAGES PAGE CONTROLLER
   Profile Lock + Realtime DM Shell
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
  RB_ROUTES,
  RB_PROFILE_KEYS
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
  identityStatus: $("messages-identity-status"),
  threadsList: $("messages-threads-list")
};

let supabase = null;
let channel = null;
let actionsBound = false;

function state() {
  return getCurrentUserState?.() || {};
}

function user() {
  return state().user || null;
}

function profile() {
  return state().profile || null;
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function setEmpty(text) {
  if (!els.threadsList) return;
  els.threadsList.innerHTML = `<article class="rb-empty-card">${text}</article>`;
}

function paintMessagesIdentity() {
  const activeUser = user();
  const activeProfile = profile();

  setText(els.name, profileName(activeProfile));
  setText(els.handle, profileHandle(activeProfile));

  if (els.avatar) {
    const avatar = profileAvatar(activeProfile);

    if (els.avatar.tagName === "IMG") {
      els.avatar.src = avatar;
      els.avatar.alt = profileName(activeProfile);
    } else {
      els.avatar.style.backgroundImage = `url("${avatar}")`;
    }
  }

  setText(
    els.status,
    activeUser?.id
      ? "Messages connected to your Rich Bizness profile key."
      : "Sign in to use messages."
  );

  setText(
    els.identityStatus,
    activeProfile?.id
      ? `Profile locked through ${RB_PROFILE_KEYS?.identitySource || "profiles"}`
      : "Waiting for profile lock"
  );
}

async function loadThreads() {
  const activeUser = user();

  if (!activeUser?.id) {
    setText(els.threadCount, "0 active conversations");
    setText(els.syncStatus, "Sign in required");
    setEmpty("Sign in to see your Rich Bizness DMs.");
    return;
  }

  const { data, error } = await supabase
    .from(RB_TABLES.dmThreadMembers)
    .select(`
      id,
      thread_id,
      role,
      status,
      is_muted,
      is_pinned,
      last_read_at,
      joined_at,
      dm_threads:thread_id (
        id,
        title,
        thread_type,
        last_message,
        last_message_at,
        last_message_user_id,
        dm_brand,
        bubble_theme,
        default_reaction,
        typing_label,
        call_theme,
        is_archived,
        created_at,
        updated_at
      )
    `)
    .eq("user_id", activeUser.id)
    .eq("status", "active")
    .order("joined_at", { ascending: false })
    .limit(40);

  if (error) throw error;

  const rows = data || [];

  setText(els.threadCount, `${rows.length} active conversations`);
  setText(els.syncStatus, "Messages synced");

  renderThreads(rows);
}

function renderThreads(rows = []) {
  if (!els.threadsList) return;

  if (!rows.length) {
    setEmpty("No conversations yet.");
    return;
  }

  els.threadsList.innerHTML = rows
    .map((row) => {
      const thread = Array.isArray(row.dm_threads)
        ? row.dm_threads[0]
        : row.dm_threads;

      const title =
        thread?.title ||
        thread?.dm_brand ||
        "Rich Bizness Chat";

      const last =
        thread?.last_message ||
        "No messages yet.";

      const type =
        thread?.thread_type ||
        "direct";

      const pinned = row.is_pinned ? "PINNED" : type.toUpperCase();
      const muted = row.is_muted ? "MUTED" : row.role || "member";

      return `
        <article class="rb-message-thread" data-thread-id="${row.thread_id}">
          <div class="rb-message-thread-avatar">
            <img src="${profileAvatar(profile())}" alt="" />
          </div>

          <div class="rb-message-thread-body">
            <p class="rb-kicker">${pinned} • ${muted}</p>
            <h3>${title}</h3>
            <p>${last}</p>
          </div>

          <button class="rb-btn ghost" data-open-thread="${row.thread_id}">
            OPEN
          </button>
        </article>
      `;
    })
    .join("");
}

function clearRealtime() {
  if (channel && supabase) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

function bindRealtime() {
  const activeUser = user();

  if (!activeUser?.id || !supabase) return;

  clearRealtime();

  channel = supabase
    .channel(`rb-messages-${activeUser.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.dmThreadMembers,
        filter: `user_id=eq.${activeUser.id}`
      },
      loadThreads
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.dmMessages
      },
      loadThreads
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.profiles,
        filter: `id=eq.${activeUser.id}`
      },
      async () => {
        await refreshProfileState();
        await refreshAppIdentity();
        paintMessagesIdentity();
      }
    )
    .subscribe();
}

function bindActions() {
  if (actionsBound) return;
  actionsBound = true;

  els.newBtn?.addEventListener("click", () => {
    toastInfo("Message composer is next in order.", "Rich Bizness DMs");
  });

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-open-thread]");
    if (!btn) return;

    const threadId = btn.dataset.openThread;
    toastInfo(`Thread locked: ${threadId}`, "Rich Bizness DMs");
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

    paintMessagesIdentity();
    bindActions();

    onProfileState((profileState) => {
      if (!profileState?.ready) return;
      paintMessagesIdentity();
    });

    await loadThreads();
    bindRealtime();

    document.body.dataset.rbPage = "messages";
    document.body.dataset.rbProfileLock = "true";
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
