/* =========================
   RICH BIZNESS MOBILE
   /core/pages/messages.js

   MESSAGES PAGE CONTROLLER
   Direct Supabase DM Shell
   Profile Lock + Realtime Messages
   XP Gauge Enabled

   Flow:
   - Messages reads profile directly
   - No profile-state dependency
   - Realtime watches DM members/messages/profiles
   - Message composer/open thread can be expanded next
   - No project-avatar fallback
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
  getUser,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  profileName,
  profileAvatar,
  profileHandle,
  getProfileIdentity,
  bindProfileShell,
  buildProfileUrl
} from "/core/shared/rb-profile.js";

import {
  toastInfo,
  toastError
} from "/core/shared/rb-toast.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";

const els = {
  name: $("messages-user-name"),
  handle: $("messages-user-handle"),
  avatar: $("messages-user-avatar"),
  status: $("messages-status"),
  newBtn: $("messages-new-btn"),
  threadCount: $("messages-thread-count"),
  syncStatus: $("messages-sync-status"),
  identityStatus: $("messages-identity-status"),
  threadsList: $("messages-threads-list"),

  xpGauge: $("messages-xp-gauge"),
  xpFill: $("messages-xp-gauge-fill"),
  xpText: $("messages-xp-gauge-text"),
  xpNext: $("messages-xp-gauge-next"),
  xpLevel: $("messages-xp-level"),
  xpRank: $("messages-xp-rank")
};

let supabase = null;
let channel = null;
let actionsBound = false;
let currentUser = null;
let currentProfile = null;
let identity = null;

function table(key, fallback) {
  return RB_TABLES?.[key] || fallback || key;
}

function safeImage(value = "", fallback = DEFAULT_AVATAR) {
  const src = String(value || "").trim();

  if (!src || src.includes("project-avatar")) return fallback;

  if (
    src.startsWith("/") ||
    src.startsWith("https://") ||
    src.startsWith("http://") ||
    src.startsWith("blob:")
  ) {
    return src;
  }

  return fallback;
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setText(el, value) {
  if (el) el.textContent = value ?? "";
}

function setEmpty(text) {
  if (!els.threadsList) return;

  els.threadsList.innerHTML = `
    <article class="rb-empty-card">
      ${escapeHtml(text)}
    </article>
  `;
}

/* =========================
   XP GAUGE
========================= */

function getProfileXpModel(profile = {}, profileIdentity = {}) {
  const rawXp =
    profile?.xp ??
    profile?.rich_points ??
    profile?.points ??
    profileIdentity?.xp ??
    profileIdentity?.rich_points ??
    0;

  const rawLevel =
    profile?.rich_level ??
    profile?.level ??
    profileIdentity?.rich_level ??
    profileIdentity?.level ??
    1;

  const rank =
    profile?.rank_title ||
    profile?.rank ||
    profileIdentity?.rankTitle ||
    profileIdentity?.rank_title ||
    profileIdentity?.rank ||
    "Rich Messenger";

  const xp = Math.max(0, Number(rawXp) || 0);
  const level = Math.max(1, Number(rawLevel) || 1);

  const levelBase = Math.max(0, (level - 1) * 1000);
  const nextLevel = level * 1000;
  const span = Math.max(1, nextLevel - levelBase);
  const currentIntoLevel = Math.max(0, xp - levelBase);
  const percent = Math.max(0, Math.min(100, (currentIntoLevel / span) * 100));
  const remaining = Math.max(0, nextLevel - xp);

  return {
    xp,
    level,
    rank,
    nextLevel,
    remaining,
    percent
  };
}

function renderXpGauge() {
  const model = getProfileXpModel(currentProfile, identity);

  if (els.xpGauge) {
    els.xpGauge.dataset.level = String(model.level);
    els.xpGauge.dataset.rank = model.rank;
    els.xpGauge.dataset.xp = String(model.xp);
  }

  if (els.xpFill) {
    els.xpFill.style.width = `${model.percent}%`;
  }

  setText(els.xpText, `${model.xp.toLocaleString()} XP`);
  setText(els.xpNext, `${model.remaining.toLocaleString()} XP TO LVL ${model.level + 1}`);
  setText(els.xpLevel, `LVL ${model.level}`);
  setText(els.xpRank, model.rank);

  window.dispatchEvent(
    new CustomEvent("rb:xp-gauge-update", {
      detail: {
        route: "messages",
        xp: model.xp,
        level: model.level,
        rank: model.rank,
        nextLevel: model.nextLevel,
        remaining: model.remaining,
        percent: model.percent
      }
    })
  );
}

/* =========================
   IDENTITY
========================= */

function syncState() {
  const appState = getCurrentUserState?.() || {};

  currentUser = appState.user || getUser?.() || null;
  currentProfile = appState.profile || currentProfile || null;
  identity = getProfileIdentity(currentProfile);

  document.body.dataset.rbRoute = "messages";
  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = identity?.id || "";
  document.body.dataset.rbProfileLocked = identity?.id ? "true" : "false";
}

async function fetchMyProfile() {
  const activeUser = getUser?.() || currentUser;

  if (!activeUser?.id) {
    currentUser = null;
    currentProfile = null;
    identity = null;
    return null;
  }

  const { data, error } = await supabase
    .from(table("profiles", "profiles"))
    .select("*")
    .eq("id", activeUser.id)
    .maybeSingle();

  if (error) throw error;

  currentUser = activeUser;
  currentProfile = data || null;
  identity = getProfileIdentity(currentProfile);

  return currentProfile;
}

function paintMessagesIdentity() {
  const activeUser = currentUser || getUser?.();
  const activeProfile = currentProfile || {};
  identity = getProfileIdentity(activeProfile);

  const name = profileName(activeProfile);
  const handle = profileHandle(activeProfile);
  const avatar = safeImage(profileAvatar(activeProfile), DEFAULT_AVATAR);

  setText(els.name, name);
  setText(els.handle, handle);

  if (els.avatar) {
    if (els.avatar.tagName === "IMG") {
      els.avatar.src = avatar;
      els.avatar.alt = name;
    } else {
      els.avatar.style.backgroundImage = `url("${avatar}")`;
    }
  }

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl(currentProfile);
  });

  document.querySelectorAll("[data-rb-current-avatar]").forEach((el) => {
    if (el.tagName === "IMG") {
      el.src = avatar;
      el.alt = name;
    } else {
      el.style.backgroundImage = `url("${avatar}")`;
    }
  });

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

  document.body.dataset.rbRoute = "messages";
  document.body.dataset.rbUserId = activeUser?.id || "";
  document.body.dataset.rbProfileId = identity?.id || "";
  document.body.dataset.rbProfileLocked = identity?.id ? "true" : "false";

  bindProfileShell?.();
  renderXpGauge();
}

async function refreshMessagesIdentity() {
  await refreshAppIdentity();
  syncState();
  await fetchMyProfile();
  paintMessagesIdentity();
}

/* =========================
   THREADS
========================= */

async function loadThreads() {
  const activeUser = currentUser || getUser?.();

  if (!activeUser?.id) {
    setText(els.threadCount, "0 active conversations");
    setText(els.syncStatus, "Sign in required");
    setEmpty("Sign in to see your Rich Bizness DMs.");
    renderXpGauge();
    return;
  }

  const { data, error } = await supabase
    .from(table("dmThreadMembers", "dm_thread_members"))
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
  renderXpGauge();

  window.dispatchEvent(
    new CustomEvent("rb:messages-update", {
      detail: {
        route: "messages",
        threadCount: rows.length,
        profileLocked: !!identity?.id,
        xpGauge: true
      }
    })
  );
}

function renderThreads(rows = []) {
  if (!els.threadsList) return;

  if (!rows.length) {
    setEmpty("No conversations yet.");
    return;
  }

  const myAvatar = safeImage(profileAvatar(currentProfile), DEFAULT_AVATAR);

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
        <article class="rb-message-thread" data-thread-id="${escapeHtml(row.thread_id)}">
          <div class="rb-message-thread-avatar">
            <img src="${escapeHtml(myAvatar)}" alt="" loading="lazy" />
          </div>

          <div class="rb-message-thread-body">
            <p class="rb-kicker">${escapeHtml(pinned)} • ${escapeHtml(muted)}</p>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(last)}</p>
          </div>

          <button class="rb-btn ghost" data-open-thread="${escapeHtml(row.thread_id)}" type="button">
            OPEN
          </button>
        </article>
      `;
    })
    .join("");
}

/* =========================
   REALTIME
========================= */

function clearRealtime() {
  if (channel && supabase) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

function bindRealtime() {
  const activeUser = currentUser || getUser?.();

  if (!activeUser?.id || !supabase) return;

  clearRealtime();

  channel = supabase
    .channel(`rb-messages-${activeUser.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("dmThreadMembers", "dm_thread_members"),
        filter: `user_id=eq.${activeUser.id}`
      },
      loadThreads
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("dmMessages", "dm_messages")
      },
      loadThreads
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("profiles", "profiles"),
        filter: `id=eq.${activeUser.id}`
      },
      async () => {
        await refreshMessagesIdentity();
        await loadThreads();
      }
    )
    .subscribe();
}

/* =========================
   ACTIONS
========================= */

async function createOrOpenDirectThread(targetUserId) {
  const activeUser = currentUser || getUser?.();

  if (!activeUser?.id) {
    window.location.href = RB_ROUTES.auth || "/auth";
    return;
  }

  if (!targetUserId || targetUserId === activeUser.id) {
    toastInfo("Message composer is next in order.", "Rich Bizness DMs");
    return;
  }

  const { data: existingMemberships, error: memberError } = await supabase
    .from(table("dmThreadMembers", "dm_thread_members"))
    .select(`
      thread_id,
      dm_threads:thread_id (
        id,
        thread_type
      )
    `)
    .eq("user_id", activeUser.id)
    .eq("status", "active");

  if (memberError) throw memberError;

  const directThreads = (existingMemberships || [])
    .filter((row) => {
      const thread = Array.isArray(row.dm_threads)
        ? row.dm_threads[0]
        : row.dm_threads;

      return thread?.thread_type === "direct";
    })
    .map((row) => row.thread_id);

  if (directThreads.length) {
    const { data: targetMember, error: targetError } = await supabase
      .from(table("dmThreadMembers", "dm_thread_members"))
      .select("thread_id")
      .eq("user_id", targetUserId)
      .eq("status", "active")
      .in("thread_id", directThreads)
      .maybeSingle();

    if (targetError) throw targetError;

    if (targetMember?.thread_id) {
      toastInfo(`Thread locked: ${targetMember.thread_id}`, "Rich Bizness DMs");
      return targetMember.thread_id;
    }
  }

  const { data: thread, error: threadError } = await supabase
    .from(table("dmThreads", "dm_threads"))
    .insert({
      thread_type: "direct",
      created_by: activeUser.id,
      dm_brand: "Rich-DM’s",
      bubble_theme: "smoke-cloud",
      default_reaction: "💨",
      typing_label: "rolling smoke...",
      call_theme: "Rich Call",
      metadata: {
        source: "messages.js",
        app: "Rich Bizness Mobile",
        profile_lock: true
      }
    })
    .select()
    .maybeSingle();

  if (threadError) throw threadError;

  const members = [
    {
      thread_id: thread.id,
      user_id: activeUser.id,
      role: "owner",
      status: "active"
    },
    {
      thread_id: thread.id,
      user_id: targetUserId,
      role: "member",
      status: "active"
    }
  ];

  const { error: insertMembersError } = await supabase
    .from(table("dmThreadMembers", "dm_thread_members"))
    .insert(members);

  if (insertMembersError) throw insertMembersError;

  await loadThreads();

  toastInfo(`Thread created: ${thread.id}`, "Rich Bizness DMs");

  return thread.id;
}

function bindActions() {
  if (actionsBound) return;
  actionsBound = true;

  els.newBtn?.addEventListener("click", async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const targetUserId = params.get("user") || params.get("to");

      await createOrOpenDirectThread(targetUserId);
    } catch (error) {
      console.error("[RB MESSAGE CREATE FAILED]", error);
      toastError(error?.message || "Could not start message.");
    }
  });

  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-open-thread]");
    if (!btn) return;

    const threadId = btn.dataset.openThread;

    document.body.dataset.rbActiveThread = threadId;
    toastInfo(`Thread locked: ${threadId}`, "Rich Bizness DMs");
  });

  window.addEventListener("beforeunload", clearRealtime);
}

/* =========================
   BOOT
========================= */

async function bootMessagesPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false,
      ensureProfile: true
    });

    supabase = getSupabase();

    await ensureMyProfile();
    await refreshAppIdentity();

    syncState();
    await fetchMyProfile();

    paintMessagesIdentity();
    bindActions();

    await loadThreads();
    bindRealtime();

    document.body.dataset.rbPage = "messages";
    document.body.dataset.rbRoute = "messages";
    document.body.dataset.rbProfileLock = "true";
    document.body.classList.add("rb-messages-ready");

    markPageReady("messages");

    console.log("RB MESSAGES READY", {
      profileLocked: !!identity?.id,
      route: "messages",
      xpGauge: true
    });
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
