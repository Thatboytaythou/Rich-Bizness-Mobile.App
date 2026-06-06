/* =========================
   RICH BIZNESS MOBILE
   /core/pages/watch.js

   VIEWER SIDE
   Live → Watch sync
   Uses locked live feature engines
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  initLiveAccess,
  canWatchLiveStream,
  liveAccessLabel,
  liveAccessNeedsPayment,
  goToLiveAccessCheckout,
  redirectToAuthForLive,
  onLiveAccess
} from "/core/features/live/live-access.js";

import {
  initLiveViewer,
  joinLiveViewer,
  leaveLiveViewer,
  onLiveViewer
} from "/core/features/live/live-viewer.js";

import {
  initLiveChat,
  sendLiveChat,
  onLiveChat,
  clearLiveChatRealtime
} from "/core/features/live/live-chat.js";

import {
  initLiveReactions,
  sendLiveReaction,
  onLiveReactions,
  clearLiveReactionRealtime
} from "/core/features/live/live-reactions.js";

import {
  initLivePresence,
  joinLivePresence,
  leaveLivePresence,
  onLivePresence,
  clearLivePresenceRealtime
} from "/core/features/live/live-presence.js";

const $ = (id) => document.getElementById(id);
const qs = (selector) => document.querySelector(selector);

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";
const DEFAULT_BANNER = "/images/brand/Avatar-hero-Banner.png.jpeg";

const els = {
  status: $("watchStatus") || $("liveStatus") || qs("[data-watch-status]"),
  title: $("watchTitle") || $("streamTitle") || qs("[data-watch-title]"),
  description:
    $("watchDescription") ||
    $("streamDescription") ||
    qs("[data-watch-description]"),
  creator: $("watchCreator") || $("streamCreator") || qs("[data-watch-creator]"),
  badge: $("watchBadge") || $("liveBadge") || qs("[data-watch-badge]"),
  access: $("watchAccess") || $("streamAccess") || qs("[data-watch-access]"),

  stage: $("watchStage") || $("videoStage") || qs("[data-watch-stage]"),
  videoGrid: $("watchVideoGrid") || $("remoteVideos") || qs("[data-watch-videos]"),
  empty: $("watchEmpty") || $("stageEmpty") || qs("[data-watch-empty]"),
  reactionLayer: $("reactionLayer") || qs("[data-reaction-layer]"),

  joinBtn: $("joinWatchBtn") || $("joinLiveBtn") || qs("[data-join-watch]"),
  leaveBtn: $("leaveWatchBtn") || qs("[data-leave-watch]"),
  payBtn: $("payWatchBtn") || $("unlockLiveBtn") || qs("[data-pay-watch]"),
  copyBtn: $("copyWatchBtn") || qs("[data-copy-watch]"),

  statViewers: $("watchViewers") || $("statViewers") || qs("[data-watch-viewers]"),
  statPeak: $("watchPeak") || $("statPeak") || qs("[data-watch-peak]"),
  statChat: $("watchChatCount") || $("statChat") || qs("[data-watch-chat-count]"),
  statReactions:
    $("watchReactions") ||
    $("statReactions") ||
    qs("[data-watch-reactions]"),
  statRevenue:
    $("watchRevenue") ||
    $("statRevenue") ||
    qs("[data-watch-revenue]"),

  chatList: $("watchChatList") || $("chatList") || qs("[data-watch-chat-list]"),
  chatForm: $("watchChatForm") || $("chatForm") || qs("[data-watch-chat-form]"),
  chatInput:
    $("watchChatInput") ||
    $("chatInput") ||
    qs("[data-watch-chat-input]"),

  reactionBtn:
    $("sendReactionBtn") ||
    $("watchReactionBtn") ||
    qs("[data-send-reaction]"),

  tipList: $("watchTipList") || $("tipList") || qs("[data-watch-tips]"),
  tipAmount: $("tipAmount") || qs("[data-tip-amount]"),
  tipMessage: $("tipMessage") || qs("[data-tip-message]"),
  tipBtn: $("sendTipBtn") || qs("[data-send-tip]"),

  streamList: $("watchStreamList") || qs("[data-watch-stream-list]")
};

const WATCH = {
  supabase: null,
  user: null,
  profile: null,
  stream: null,
  booted: false,
  channels: [],
  unsubscribers: [],
  anonymousId:
    localStorage.getItem("rb_watch_anon_id") ||
    crypto.randomUUID(),
  accessUnlocked: false
};

localStorage.setItem("rb_watch_anon_id", WATCH.anonymousId);

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function text(el, value) {
  if (el) el.textContent = value ?? "";
}

function html(el, value) {
  if (el) el.innerHTML = value ?? "";
}

function money(cents = 0) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function setStatus(message) {
  text(els.status, message || "");
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function streamKey() {
  return getParam("stream") || getParam("slug") || getParam("id");
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function displayName() {
  return (
    WATCH.profile?.display_name ||
    WATCH.profile?.full_name ||
    WATCH.profile?.username ||
    WATCH.user?.email?.split("@")[0] ||
    "Rich Viewer"
  );
}

function username() {
  return (
    WATCH.profile?.username ||
    WATCH.user?.email?.split("@")[0] ||
    "rich_viewer"
  );
}

function watchUrl(stream = WATCH.stream) {
  const base = RB_ROUTES.watch || "/watch";

  if (!stream) return base;

  return `${base}?stream=${encodeURIComponent(
    stream.slug || stream.display_slug || stream.id
  )}`;
}

function normalizeProfile(profile) {
  if (Array.isArray(profile)) return profile[0] || null;
  return profile || null;
}

function normalizeStream(data = {}) {
  const profile = normalizeProfile(data.profiles || data.profile);

  return {
    ...data,

    username:
      data.username ||
      profile?.username ||
      "creator",

    display_name:
      data.display_name ||
      profile?.display_name ||
      profile?.full_name ||
      profile?.username ||
      "Rich Bizness Creator",

    creator_avatar_url:
      data.creator_avatar_url ||
      profile?.avatar_url ||
      DEFAULT_AVATAR,

    creator_banner_url:
      data.creator_banner_url ||
      profile?.banner_url ||
      DEFAULT_BANNER,

    thumbnail_url:
      data.thumbnail_url ||
      data.cover_url ||
      DEFAULT_BANNER,

    cover_url:
      data.cover_url ||
      data.thumbnail_url ||
      DEFAULT_BANNER,

    viewer_count: Number(data.viewer_count || 0),
    peak_viewers: Number(data.peak_viewers || 0),
    total_chat_messages: Number(data.total_chat_messages || 0),
    total_reactions: Number(data.total_reactions || 0),
    total_revenue_cents: Number(data.total_revenue_cents || 0)
  };
}

function renderStream(stream = WATCH.stream) {
  WATCH.stream = stream || null;

  if (!stream) {
    text(els.title, "No live stream selected");
    text(els.description, "Choose a live room to watch.");
    text(els.creator, "Rich Bizness Creator");
    text(els.badge, "OFF AIR");
    text(els.access, "FREE");

    text(els.statViewers, "0");
    text(els.statPeak, "0");
    text(els.statChat, "0");
    text(els.statReactions, "0");
    text(els.statRevenue, "$0.00");

    if (els.badge) els.badge.className = "live-badge off";
    if (els.joinBtn) els.joinBtn.disabled = true;
    if (els.leaveBtn) els.leaveBtn.disabled = true;
    if (els.payBtn) els.payBtn.style.display = "none";
    if (els.empty) els.empty.style.display = "";

    setStatus("No stream loaded.");
    return;
  }

  const isLive = stream.status === "live";
  const needsPayment = liveAccessNeedsPayment(stream);

  text(els.title, stream.title || "Family Bizness");
  text(els.description, stream.description || "Rich Bizness live room.");
  text(els.creator, stream.display_name || stream.username || "Rich Bizness Creator");
  text(els.badge, isLive ? "LIVE" : String(stream.status || "DRAFT").toUpperCase());
  text(els.access, liveAccessLabel(stream));

  text(els.statViewers, stream.viewer_count || 0);
  text(els.statPeak, stream.peak_viewers || 0);
  text(els.statChat, stream.total_chat_messages || 0);
  text(els.statReactions, stream.total_reactions || 0);
  text(els.statRevenue, money(stream.total_revenue_cents));

  if (els.badge) {
    els.badge.className = isLive ? "live-badge on" : "live-badge off";
  }

  if (els.stage) {
    els.stage.style.backgroundImage =
      `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.75)), url("${stream.cover_url || stream.thumbnail_url || DEFAULT_BANNER}")`;
  }

  if (els.joinBtn) {
    els.joinBtn.disabled = !isLive || needsPayment;
  }

  if (els.leaveBtn) {
    els.leaveBtn.disabled = true;
  }

  if (els.payBtn) {
    els.payBtn.style.display = needsPayment ? "" : "none";
  }
}

function renderViewerState(state = {}) {
  if (els.joinBtn) {
    els.joinBtn.disabled =
      !WATCH.stream ||
      WATCH.stream.status !== "live" ||
      state.joined ||
      state.connecting ||
      liveAccessNeedsPayment(WATCH.stream);
  }

  if (els.leaveBtn) {
    els.leaveBtn.disabled = !state.joined;
  }

  if (els.empty) {
    els.empty.style.display = state.joined ? "none" : "";
  }

  if (state.connecting) {
    setStatus("Joining live room...");
  } else if (state.joined) {
    setStatus("You are watching live.");
  }
}

function renderChat(messages = []) {
  if (!els.chatList) return;

  html(
    els.chatList,
    messages.length
      ? messages
          .filter((message) => !message.is_deleted)
          .map((message) => {
            return `
              <div class="chat-line ${message.is_pinned ? "pinned" : ""}">
                <b>${escapeHtml(message.display_name || message.username || "Viewer")}</b>
                <span>${escapeHtml(message.message || message.body || "")}</span>
              </div>
            `;
          })
          .join("")
      : `<div class="rb-empty">No chat yet.</div>`
  );

  els.chatList.scrollTop = els.chatList.scrollHeight;
}

function burstReaction(reaction = "🔥") {
  if (!els.reactionLayer) return;

  const node = document.createElement("span");

  node.className = "reaction-burst";
  node.textContent = reaction;
  node.style.left = `${20 + Math.random() * 60}%`;
  node.style.bottom = `${10 + Math.random() * 30}%`;

  els.reactionLayer.appendChild(node);

  setTimeout(() => node.remove(), 1400);
}

function attachViewerTrack(event) {
  if (!els.videoGrid) return;

  const { track, element, participant, kind } = event.detail || {};

  if (!track || !element) return;

  if (kind === "video" || track.kind === "video") {
    const wrap = document.createElement("div");
    wrap.className = "watch-video-tile";
    wrap.dataset.participant = participant?.identity || "host";

    const label = document.createElement("span");
    label.textContent =
      participant?.name ||
      participant?.identity ||
      "Host";

    element.classList.add("watch-video");

    wrap.appendChild(element);
    wrap.appendChild(label);

    els.videoGrid.appendChild(wrap);

    if (els.empty) els.empty.style.display = "none";
    return;
  }

  element.classList.add("watch-audio");
  document.body.appendChild(element);
}

function renderTips(rows = []) {
  if (!els.tipList) return;

  html(
    els.tipList,
    rows.length
      ? rows
          .map((tip) => {
            return `
              <div class="tip-line">
                <b>${escapeHtml(tip.display_name || tip.username || "Supporter")}</b>
                <span>${money(tip.amount_cents)}${tip.message ? " · " + escapeHtml(tip.message) : ""}</span>
              </div>
            `;
          })
          .join("")
      : `<div class="rb-empty">No tips yet.</div>`
  );
}

async function initIdentity() {
  await initApp({
    guard: false,
    bindProfile: true,
    toast: false
  });

  WATCH.supabase = getSupabase();

  const state = getCurrentUserState();

  WATCH.user = state?.user || null;
  WATCH.profile = state?.profile || null;

  setStatus(WATCH.user?.id ? `Signed in as ${displayName()}` : "Watching as guest.");
}

async function loadStream() {
  const key = streamKey();

  let data = null;
  let error = null;

  const select = "*, profiles:creator_id(username, display_name, full_name, avatar_url, banner_url)";

  if (key) {
    const slugRes = await WATCH.supabase
      .from(RB_TABLES.liveStreams)
      .select(select)
      .eq("slug", key)
      .maybeSingle();

    data = slugRes.data;
    error = slugRes.error;

    if (!data && isUuid(key)) {
      const idRes = await WATCH.supabase
        .from(RB_TABLES.liveStreams)
        .select(select)
        .eq("id", key)
        .maybeSingle();

      data = idRes.data;
      error = idRes.error;
    }

    if (!data) {
      const displaySlugRes = await WATCH.supabase
        .from(RB_TABLES.liveStreams)
        .select(select)
        .eq("display_slug", key)
        .maybeSingle();

      data = displaySlugRes.data;
      error = displaySlugRes.error;
    }
  } else {
    const latestRes = await WATCH.supabase
      .from(RB_TABLES.liveStreams)
      .select(select)
      .in("status", ["live", "scheduled", "draft"])
      .order("status", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    data = latestRes.data;
    error = latestRes.error;
  }

  if (error) {
    setStatus(error.message);
    return null;
  }

  if (!data) {
    setStatus("No stream found.");
    return null;
  }

  WATCH.stream = normalizeStream(data);

  await initLiveAccess({
    stream: WATCH.stream,
    user: WATCH.user,
    profile: WATCH.profile
  });

  renderStream(WATCH.stream);

  return WATCH.stream;
}

async function loadStreamList() {
  if (!els.streamList) return;

  const { data, error } = await WATCH.supabase
    .from(RB_TABLES.liveStreams)
    .select("id, slug, display_slug, title, description, status, access_type, price_cents, thumbnail_url, cover_url, viewer_count, created_at")
    .in("status", ["live", "scheduled"])
    .order("status", { ascending: true })
    .order("viewer_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return;

  html(
    els.streamList,
    (data || [])
      .map((stream) => {
        const normalized = normalizeStream(stream);

        return `
          <article class="watch-card" data-stream-card="${escapeHtml(normalized.id)}">
            <div
              class="watch-card-img"
              style="background-image:url('${escapeHtml(normalized.thumbnail_url || normalized.cover_url || DEFAULT_BANNER)}')"
            ></div>

            <div>
              <b>${escapeHtml(normalized.title || "Family Bizness")}</b>
              <span>${escapeHtml(String(normalized.status || "draft").toUpperCase())} · ${Number(normalized.viewer_count || 0)} watching</span>
              <small>${escapeHtml(String(normalized.access_type || "free").toUpperCase())}${normalized.price_cents ? " · " + money(normalized.price_cents) : ""}</small>
            </div>

            <a href="${escapeHtml(watchUrl(normalized))}">Watch</a>
          </article>
        `;
      })
      .join("") || `<div class="rb-empty">No live rooms yet.</div>`
  );
}

async function loadTips() {
  if (!WATCH.stream || !els.tipList || !RB_TABLES.liveTips) {
    renderTips([]);
    return;
  }

  const { data } = await WATCH.supabase
    .from(RB_TABLES.liveTips)
    .select("*")
    .eq("stream_id", WATCH.stream.id)
    .order("created_at", { ascending: false })
    .limit(20);

  renderTips(data || []);
}

async function sendTip() {
  if (!WATCH.stream || !RB_TABLES.liveTips) return;

  const amount = Math.max(
    100,
    Math.round(Number(els.tipAmount?.value || 1) * 100)
  );

  const message = els.tipMessage?.value?.trim() || null;

  const { error } = await WATCH.supabase
    .from(RB_TABLES.liveTips)
    .insert({
      stream_id: WATCH.stream.id,
      from_user_id: WATCH.user?.id || null,
      to_user_id: WATCH.stream.creator_id,
      username: WATCH.user ? username() : "guest",
      display_name: WATCH.user ? displayName() : "Guest Supporter",
      amount_cents: amount,
      platform_fee_cents: 0,
      creator_amount_cents: amount,
      currency: "usd",
      status: "pending",
      message,
      metadata: {
        source: "watch.js",
        payment_required: true
      }
    });

  if (error) {
    setStatus(error.message);
    return;
  }

  setStatus("Tip recorded as pending. Stripe checkout can connect here.");

  if (els.tipMessage) els.tipMessage.value = "";
  await loadTips();
}

async function joinWatch() {
  if (!WATCH.stream) {
    setStatus("No stream selected.");
    return;
  }

  const access = await canWatchLiveStream();

  if (!access.allowed) {
    if (access.reason === "auth_required") {
      redirectToAuthForLive(WATCH.stream);
      return;
    }

    setStatus(access.reason || "Unlock required before watching.");
    renderStream(WATCH.stream);
    return;
  }

  try {
    await joinLivePresence({
      stream: WATCH.stream,
      user: WATCH.user,
      profile: WATCH.profile,
      role: "viewer",
      anonymousId: WATCH.user?.id ? null : WATCH.anonymousId
    });

    await joinLiveViewer();

    setStatus("You are watching live.");
  } catch (error) {
    setStatus(error?.message || "Could not join live.");
    renderStream(WATCH.stream);
  }
}

async function leaveWatch() {
  await leaveLiveViewer();

  await leaveLivePresence({
    userId: WATCH.user?.id || null
  }).catch(() => {});

  if (els.videoGrid) html(els.videoGrid, "");
  if (els.empty) els.empty.style.display = "";

  renderStream(WATCH.stream);
  setStatus("Left live room.");
}

async function sendChat(event) {
  event?.preventDefault?.();

  if (!WATCH.stream || !els.chatInput) return;

  const message = els.chatInput.value.trim();

  if (!message) return;

  if (WATCH.stream.is_chat_enabled === false) {
    setStatus("Chat is disabled for this stream.");
    return;
  }

  try {
    await sendLiveChat(message, {
      useApi: true
    });

    els.chatInput.value = "";
  } catch (error) {
    console.error("[RB WATCH CHAT FAILED]", error);
    setStatus(error?.message || "Chat failed.");
  }
}

async function sendReaction(reaction = "🔥") {
  try {
    await sendLiveReaction(reaction);
  } catch (error) {
    console.warn("[RB WATCH REACTION FAILED]", error);
    burstReaction(reaction);
  }
}

async function unlockPaidStream() {
  if (!WATCH.stream) return;

  if (!WATCH.user?.id) {
    redirectToAuthForLive(WATCH.stream);
    return;
  }

  setStatus("Creating live access checkout...");

  try {
    await goToLiveAccessCheckout({
      stream: WATCH.stream
    });
  } catch (error) {
    setStatus(error?.message || "Checkout failed.");
  }
}

async function copyLink() {
  const url = `${window.location.origin}${watchUrl(WATCH.stream)}`;

  try {
    await navigator.clipboard.writeText(url);
    setStatus("Watch link copied.");
  } catch {
    setStatus(url);
  }
}

function clearRealtime() {
  WATCH.channels.forEach((channel) => {
    WATCH.supabase?.removeChannel(channel);
  });

  WATCH.channels = [];
}

function bindRealtime() {
  clearRealtime();

  if (!WATCH.stream) return;

  const streamId = WATCH.stream.id;

  const streamChannel = WATCH.supabase
    .channel(`watch-stream-${streamId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.liveStreams,
        filter: `id=eq.${streamId}`
      },
      async (payload) => {
        WATCH.stream = normalizeStream({
          ...WATCH.stream,
          ...payload.new
        });

        await initLiveAccess({
          stream: WATCH.stream,
          user: WATCH.user,
          profile: WATCH.profile
        });

        renderStream(WATCH.stream);
      }
    )
    .subscribe();

  WATCH.channels.push(streamChannel);

  if (RB_TABLES.liveTips) {
    const tipsChannel = WATCH.supabase
      .channel(`watch-tips-${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: RB_TABLES.liveTips,
          filter: `stream_id=eq.${streamId}`
        },
        () => loadTips()
      )
      .subscribe();

    WATCH.channels.push(tipsChannel);
  }
}

async function initWatchFeatures(stream) {
  if (!stream?.id) return;

  await Promise.allSettled([
    initLiveChat({
      stream,
      user: WATCH.user,
      profile: WATCH.profile,
      realtime: true
    }),

    initLiveReactions({
      stream,
      user: WATCH.user,
      profile: WATCH.profile,
      realtime: true
    }),

    initLivePresence({
      stream,
      user: WATCH.user,
      profile: WATCH.profile,
      realtime: true
    }),

    initLiveViewer({
      stream,
      user: WATCH.user,
      profile: WATCH.profile
    })
  ]);
}

function bindStateSubscriptions() {
  WATCH.unsubscribers.push(
    onLiveAccess((state) => {
      WATCH.accessUnlocked = state.unlocked;
      renderStream(WATCH.stream);
    })
  );

  WATCH.unsubscribers.push(
    onLiveViewer((state) => {
      renderViewerState(state);
    })
  );

  WATCH.unsubscribers.push(
    onLiveChat((state) => {
      renderChat(state.messages || []);

      if (WATCH.stream) {
        WATCH.stream.total_chat_messages = state.messages?.length || WATCH.stream.total_chat_messages || 0;
        renderStream(WATCH.stream);
      }
    })
  );

  WATCH.unsubscribers.push(
    onLivePresence((state) => {
      if (WATCH.stream) {
        WATCH.stream.viewer_count = state.viewerCount;
        WATCH.stream.peak_viewers = state.peakViewers;
        renderStream(WATCH.stream);
      }
    })
  );

  WATCH.unsubscribers.push(
    onLiveReactions((state) => {
      const latest = state.burstQueue?.[state.burstQueue.length - 1];

      if (latest) {
        burstReaction(latest.reaction || latest.emoji || "🔥");
      }

      if (WATCH.stream && state.stream) {
        WATCH.stream.total_reactions = state.stream.total_reactions;
        renderStream(WATCH.stream);
      }
    })
  );

  window.addEventListener("rb-live-track-attached", attachViewerTrack);
}

function bindEvents() {
  if (document.body.dataset.rbWatchEventsBound === "true") return;
  document.body.dataset.rbWatchEventsBound = "true";

  els.joinBtn?.addEventListener("click", joinWatch);
  els.leaveBtn?.addEventListener("click", leaveWatch);
  els.payBtn?.addEventListener("click", unlockPaidStream);
  els.copyBtn?.addEventListener("click", copyLink);
  els.chatForm?.addEventListener("submit", sendChat);
  els.reactionBtn?.addEventListener("click", () => sendReaction("🔥"));
  els.tipBtn?.addEventListener("click", sendTip);
}

async function cleanupWatchPage() {
  WATCH.unsubscribers.forEach((unsubscribe) => {
    try {
      unsubscribe?.();
    } catch {}
  });

  WATCH.unsubscribers = [];

  clearRealtime();

  clearLiveChatRealtime();
  clearLiveReactionRealtime();
  clearLivePresenceRealtime();

  await leaveLiveViewer().catch(() => {});
  await leaveLivePresence({
    userId: WATCH.user?.id || null
  }).catch(() => {});

  window.removeEventListener("rb-live-track-attached", attachViewerTrack);
}

async function bootWatchPage() {
  if (WATCH.booted) return;
  WATCH.booted = true;

  try {
    bindEvents();
    bindStateSubscriptions();

    if (els.leaveBtn) els.leaveBtn.disabled = true;

    await initIdentity();
    await loadStreamList();

    const stream = await loadStream();

    if (!stream) {
      renderStream(null);
      return;
    }

    await initWatchFeatures(stream);

    bindRealtime();
    await loadTips();

    if (getParam("paid") === "1") {
      await initLiveAccess({
        stream: WATCH.stream,
        user: WATCH.user,
        profile: WATCH.profile
      });
      renderStream(WATCH.stream);
    }

    setStatus(
      stream.status === "live"
        ? "Ready to join live."
        : "Stream loaded. Waiting for creator."
    );

    document.body.classList.add("rb-watch-ready");

    markPageReady("watch");

    console.log("RB WATCH READY");
  } catch (error) {
    console.error("[watch.js]", error);
    setStatus(error?.message || "Watch failed to load.");
    markPageError(error);
  }
}

window.addEventListener("beforeunload", cleanupWatchPage);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootWatchPage);
} else {
  bootWatchPage();
}
