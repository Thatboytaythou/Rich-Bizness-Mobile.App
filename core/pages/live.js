/* =========================
   RICH BIZNESS MOBILE
   /core/pages/live.js

   LIVE PAGE CONTROLLER
   Creator studio: create → start → stream → chat → reactions
   Uses locked live feature engines
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  initLiveRail
} from "/core/features/live/live-rail.js";

import {
  initLiveStudio,
  createLiveStudioStream,
  startLiveStudio,
  endLiveStudio,
  disconnectLiveStudioRoom,
  toggleStudioMic,
  toggleStudioCam,
  onLiveStudio
} from "/core/features/live/live-studio.js";

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
  onLivePresence,
  clearLivePresenceRealtime
} from "/core/features/live/live-presence.js";

import {
  initLiveModeration,
  clearLiveModerationRealtime
} from "/core/features/live/live-moderation.js";

const $ = (id) => document.getElementById(id);

const els = {
  createStreamBtn: $("createStreamBtn"),
  startLiveBtn: $("startLiveBtn"),
  endLiveBtn: $("endLiveBtn"),
  watchLink: $("watchLink"),
  liveStatus: $("liveStatus"),

  streamTitle: $("streamTitle"),
  streamDescription: $("streamDescription"),
  streamCategory: $("streamCategory"),
  streamAccess: $("streamAccess"),
  streamPrice: $("streamPrice"),
  streamThumbnail: $("streamThumbnail"),
  streamCover: $("streamCover"),
  chatEnabled: $("chatEnabled"),
  cohostEnabled: $("cohostEnabled"),
  vipEnabled: $("vipEnabled"),

  stageTitle: $("stageTitle"),
  liveBadge: $("liveBadge"),
  videoStage: $("videoStage"),
  localVideo: $("localVideo"),
  remoteVideos: $("remoteVideos"),
  stageEmpty: $("stageEmpty"),
  reactionLayer: $("reactionLayer"),

  toggleMicBtn: $("toggleMicBtn"),
  toggleCamBtn: $("toggleCamBtn"),
  copyWatchBtn: $("copyWatchBtn"),

  statStatus: $("statStatus"),
  statViewers: $("statViewers"),
  statPeak: $("statPeak"),
  statChat: $("statChat"),
  statReactions: $("statReactions"),
  statRevenue: $("statRevenue"),

  participantList: $("participantList"),
  tipList: $("tipList"),
  chatList: $("chatList"),
  chatForm: $("chatForm"),
  chatInput: $("chatInput"),
  sendReactionBtn: $("sendReactionBtn")
};

const LIVE_PAGE = {
  booted: false,
  user: null,
  profile: null,
  stream: null,
  unsubscribers: []
};

function money(cents = 0) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(text) {
  if (els.liveStatus) els.liveStatus.textContent = text || "";
}

function safeSet(el, value) {
  if (el) el.textContent = value ?? "";
}

function profileName() {
  return (
    LIVE_PAGE.profile?.display_name ||
    LIVE_PAGE.profile?.full_name ||
    LIVE_PAGE.profile?.username ||
    LIVE_PAGE.user?.email?.split("@")[0] ||
    "Rich User"
  );
}

function watchUrl(stream = LIVE_PAGE.stream) {
  const base = RB_ROUTES.watch || "/watch";

  if (!stream) return base;

  return `${base}?stream=${encodeURIComponent(stream.slug || stream.display_slug || stream.id)}`;
}

function getPriceCents() {
  const raw = Number(els.streamPrice?.value || 0);

  if (!Number.isFinite(raw)) return 0;

  return Math.max(0, Math.round(raw * 100));
}

function renderStream(stream = LIVE_PAGE.stream) {
  LIVE_PAGE.stream = stream || null;

  if (!stream) {
    safeSet(els.stageTitle, "No stream created");
    safeSet(els.liveBadge, "OFF AIR");
    safeSet(els.statStatus, "off air");
    safeSet(els.statViewers, "0");
    safeSet(els.statPeak, "0");
    safeSet(els.statChat, "0");
    safeSet(els.statReactions, "0");
    safeSet(els.statRevenue, "$0.00");

    if (els.liveBadge) els.liveBadge.className = "live-badge off";
    if (els.watchLink) els.watchLink.href = RB_ROUTES.watch || "/watch";
    if (els.startLiveBtn) els.startLiveBtn.disabled = true;
    if (els.endLiveBtn) els.endLiveBtn.disabled = true;
    if (els.copyWatchBtn) els.copyWatchBtn.disabled = true;

    if (els.stageEmpty) els.stageEmpty.style.display = "grid";

    return;
  }

  const isLive = stream.status === "live";

  safeSet(els.stageTitle, stream.title || "Family Bizness");
  safeSet(
    els.liveBadge,
    isLive ? "LIVE" : String(stream.status || "DRAFT").toUpperCase()
  );

  if (els.liveBadge) {
    els.liveBadge.className = isLive ? "live-badge on" : "live-badge off";
  }

  if (els.watchLink) {
    els.watchLink.href = watchUrl(stream);
  }

  safeSet(els.statStatus, stream.status || "draft");
  safeSet(els.statViewers, stream.viewer_count || 0);
  safeSet(els.statPeak, stream.peak_viewers || 0);
  safeSet(els.statChat, stream.total_chat_messages || 0);
  safeSet(els.statReactions, stream.total_reactions || 0);
  safeSet(els.statRevenue, money(stream.total_revenue_cents));

  if (els.startLiveBtn) els.startLiveBtn.disabled = isLive;
  if (els.endLiveBtn) els.endLiveBtn.disabled = !isLive;
  if (els.copyWatchBtn) els.copyWatchBtn.disabled = false;

  if (els.videoStage) {
    els.videoStage.style.backgroundImage = stream.cover_url
      ? `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.75)), url("${stream.cover_url}")`
      : "";
  }
}

function renderChat(messages = []) {
  if (!els.chatList) return;

  els.chatList.innerHTML = messages.length
    ? messages
        .map((message) => {
          return `
            <li data-chat-id="${escapeHtml(message.id || "")}">
              <strong>${escapeHtml(message.display_name || message.username || "Rich User")}</strong>
              <p>${escapeHtml(message.message || message.body || "")}</p>
            </li>
          `;
        })
        .join("")
    : `<li>No chat yet.</li>`;
}

function renderParticipants({
  members = [],
  sessions = []
} = {}) {
  if (!els.participantList) return;

  const rows = [];

  members.forEach((member) => {
    rows.push(`
      <li>
        <strong>${escapeHtml(member.display_name || member.username || member.metadata?.display_name || "Rich User")}</strong>
        <span>${escapeHtml(member.role || "member")}</span>
      </li>
    `);
  });

  sessions.forEach((session) => {
    if (session.user_id && members.some((member) => member.user_id === session.user_id)) {
      return;
    }

    rows.push(`
      <li>
        <strong>${escapeHtml(session.display_name || session.username || "Guest Viewer")}</strong>
        <span>Viewer</span>
      </li>
    `);
  });

  els.participantList.innerHTML = rows.length
    ? rows.join("")
    : `<li>No participants yet.</li>`;
}

function renderTips(rows = []) {
  if (!els.tipList) return;

  els.tipList.innerHTML = rows.length
    ? rows
        .map((tip) => {
          return `
            <li>
              <strong>${escapeHtml(tip.display_name || tip.username || "Supporter")}</strong>
              <span>${money(tip.amount_cents)}</span>
            </li>
          `;
        })
        .join("")
    : `<li>No tips yet.</li>`;
}

function popReaction(icon = "🔥") {
  if (!els.reactionLayer) return;

  const span = document.createElement("span");
  span.textContent = icon;
  span.className = "reaction-pop";
  span.style.left = `${20 + Math.random() * 60}%`;

  els.reactionLayer.appendChild(span);

  setTimeout(() => {
    span.remove();
  }, 1300);
}

function attachLocalVideo(event) {
  const element = event.detail?.element;

  if (!els.localVideo || !element) return;

  try {
    const srcObject = element.srcObject;

    if (srcObject) {
      els.localVideo.srcObject = srcObject;
      els.localVideo.autoplay = true;
      els.localVideo.muted = true;
      els.localVideo.playsInline = true;
    }
  } catch {}

  if (els.stageEmpty) {
    els.stageEmpty.style.display = "none";
  }
}

function attachRemoteTrack(event) {
  if (!els.remoteVideos) return;

  const { track, element, participant } = event.detail || {};

  if (!track || !element) return;

  const tile = document.createElement("div");
  tile.className = "watch-video-tile";
  tile.dataset.participant = participant?.identity || "viewer";

  if (track.kind === "video") {
    element.classList.add("remote-video");
    tile.appendChild(element);
    els.remoteVideos.appendChild(tile);
    return;
  }

  element.classList.add("remote-audio");
  els.remoteVideos.appendChild(element);
}

async function createStream() {
  if (!LIVE_PAGE.user?.id) {
    setStatus("Sign in first.");
    return;
  }

  if (els.createStreamBtn) els.createStreamBtn.disabled = true;

  try {
    setStatus("Creating live studio...");

    const stream = await createLiveStudioStream({
      title: els.streamTitle?.value?.trim() || "Family Bizness",
      description: els.streamDescription?.value?.trim() || null,
      category: els.streamCategory?.value || "general",
      accessType: els.streamAccess?.value || "free",
      priceCents: getPriceCents(),
      thumbnailUrl: els.streamThumbnail?.value?.trim() || null,
      coverUrl: els.streamCover?.value?.trim() || null,
      chatEnabled: !!els.chatEnabled?.checked,
      cohostEnabled: !!els.cohostEnabled?.checked,
      vipEnabled: !!els.vipEnabled?.checked
    });

    LIVE_PAGE.stream = stream;

    renderStream(stream);

    await initPageLiveFeatures(stream);

    setStatus("Stream created. Press WE LIT 🔥 when ready.");
  } catch (error) {
    console.error("[RB LIVE CREATE FAILED]", error);
    setStatus(error?.message || "Stream create failed.");
  } finally {
    if (els.createStreamBtn) els.createStreamBtn.disabled = false;
  }
}

async function startLive() {
  if (!LIVE_PAGE.stream?.id) {
    setStatus("Create stream first.");
    return;
  }

  if (els.startLiveBtn) els.startLiveBtn.disabled = true;

  try {
    setStatus("Starting LiveKit room...");

    const state = await startLiveStudio();

    LIVE_PAGE.stream = state.stream;

    renderStream(state.stream);

    if (els.toggleMicBtn) els.toggleMicBtn.disabled = false;
    if (els.toggleCamBtn) els.toggleCamBtn.disabled = false;
    if (els.stageEmpty) els.stageEmpty.style.display = "none";

    setStatus("WE LIT 🔥 Live is active and ready for Watch.");
  } catch (error) {
    console.error("[RB LIVE START FAILED]", error);
    setStatus(error?.message || "Live start failed.");

    if (els.startLiveBtn) els.startLiveBtn.disabled = false;
  }
}

async function endLive() {
  if (!LIVE_PAGE.stream?.id) return;

  try {
    setStatus("Ending live...");

    const state = await endLiveStudio();

    LIVE_PAGE.stream = state.stream;

    renderStream(state.stream);

    if (els.toggleMicBtn) els.toggleMicBtn.disabled = true;
    if (els.toggleCamBtn) els.toggleCamBtn.disabled = true;
    if (els.remoteVideos) els.remoteVideos.innerHTML = "";
    if (els.stageEmpty) els.stageEmpty.style.display = "grid";

    setStatus("Live ended.");
  } catch (error) {
    console.error("[RB LIVE END FAILED]", error);
    setStatus(error?.message || "End live failed.");
  }
}

async function toggleMic() {
  const active = await toggleStudioMic();
  safeSet(els.toggleMicBtn, active ? "Mute Mic" : "Unmute Mic");
}

async function toggleCam() {
  const active = await toggleStudioCam();
  safeSet(els.toggleCamBtn, active ? "Stop Cam" : "Start Cam");
}

async function copyWatchLink() {
  const url = `${location.origin}${watchUrl()}`;

  try {
    await navigator.clipboard.writeText(url);
    setStatus("Watch link copied.");
  } catch {
    setStatus(url);
  }
}

async function sendChat(event) {
  event.preventDefault();

  const text = els.chatInput?.value?.trim();

  if (!LIVE_PAGE.stream?.id || !text) return;

  els.chatInput.value = "";

  try {
    await sendLiveChat(text, {
      useApi: true
    });

    setStatus("Chat sent.");
  } catch (error) {
    console.error("[RB LIVE CHAT FAILED]", error);
    setStatus(error?.message || "Chat failed.");
  }
}

async function sendReaction() {
  try {
    if (!LIVE_PAGE.stream?.id) {
      popReaction("🔥");
      return;
    }

    await sendLiveReaction("🔥");
  } catch (error) {
    console.warn("[RB LIVE REACTION FAILED]", error);
    popReaction("🔥");
  }
}

async function initPageLiveFeatures(stream) {
  if (!stream?.id) return;

  await Promise.allSettled([
    initLiveChat({
      stream,
      user: LIVE_PAGE.user,
      profile: LIVE_PAGE.profile,
      realtime: true
    }),

    initLiveReactions({
      stream,
      user: LIVE_PAGE.user,
      profile: LIVE_PAGE.profile,
      realtime: true
    }),

    initLivePresence({
      stream,
      user: LIVE_PAGE.user,
      profile: LIVE_PAGE.profile,
      realtime: true
    }),

    initLiveModeration({
      stream,
      user: LIVE_PAGE.user,
      profile: LIVE_PAGE.profile,
      realtime: true
    })
  ]);
}

async function loadLatestDraftOrLive() {
  const state = await initLiveStudio({
    user: LIVE_PAGE.user,
    profile: LIVE_PAGE.profile,
    loadLatest: true
  });

  LIVE_PAGE.stream = state.stream || null;

  renderStream(LIVE_PAGE.stream);

  if (LIVE_PAGE.stream?.id) {
    await initPageLiveFeatures(LIVE_PAGE.stream);
  }
}

function bindLiveSubscriptions() {
  LIVE_PAGE.unsubscribers.push(
    onLiveStudio((state) => {
      LIVE_PAGE.stream = state.stream || LIVE_PAGE.stream;

      renderStream(LIVE_PAGE.stream);

      if (els.startLiveBtn) els.startLiveBtn.disabled = state.live || state.connecting || !state.stream?.id;
      if (els.endLiveBtn) els.endLiveBtn.disabled = !state.live;
      if (els.toggleMicBtn) els.toggleMicBtn.disabled = !state.live;
      if (els.toggleCamBtn) els.toggleCamBtn.disabled = !state.live;
    })
  );

  LIVE_PAGE.unsubscribers.push(
    onLiveChat((state) => {
      renderChat(state.messages || []);
    })
  );

  LIVE_PAGE.unsubscribers.push(
    onLivePresence((state) => {
      renderParticipants({
        members: state.members || [],
        sessions: state.sessions || []
      });

      if (LIVE_PAGE.stream) {
        LIVE_PAGE.stream.viewer_count = state.viewerCount;
        LIVE_PAGE.stream.peak_viewers = state.peakViewers;
        renderStream(LIVE_PAGE.stream);
      }
    })
  );

  LIVE_PAGE.unsubscribers.push(
    onLiveReactions((state) => {
      const latest = state.burstQueue?.[state.burstQueue.length - 1];

      if (latest) {
        popReaction(latest.reaction || latest.emoji || "🔥");
      }

      if (LIVE_PAGE.stream && state.stream) {
        LIVE_PAGE.stream.total_reactions = state.stream.total_reactions;
        renderStream(LIVE_PAGE.stream);
      }
    })
  );

  window.addEventListener("rb-live-studio-local-video", attachLocalVideo);
  window.addEventListener("rb-live-studio-remote-track", attachRemoteTrack);
}

function bindEvents() {
  if (document.body.dataset.rbLiveEventsBound === "true") return;
  document.body.dataset.rbLiveEventsBound = "true";

  els.createStreamBtn?.addEventListener("click", createStream);
  els.startLiveBtn?.addEventListener("click", startLive);
  els.endLiveBtn?.addEventListener("click", endLive);
  els.toggleMicBtn?.addEventListener("click", toggleMic);
  els.toggleCamBtn?.addEventListener("click", toggleCam);
  els.copyWatchBtn?.addEventListener("click", copyWatchLink);
  els.chatForm?.addEventListener("submit", sendChat);
  els.sendReactionBtn?.addEventListener("click", sendReaction);
}

function cleanupLivePage() {
  LIVE_PAGE.unsubscribers.forEach((unsubscribe) => {
    try {
      unsubscribe?.();
    } catch {}
  });

  LIVE_PAGE.unsubscribers = [];

  clearLiveChatRealtime();
  clearLiveReactionRealtime();
  clearLivePresenceRealtime();
  clearLiveModerationRealtime();

  disconnectLiveStudioRoom();

  window.removeEventListener("rb-live-studio-local-video", attachLocalVideo);
  window.removeEventListener("rb-live-studio-remote-track", attachRemoteTrack);
}

async function initIdentity() {
  await initApp({
    guard: true,
    bindProfile: true,
    toast: false
  });

  const state = getCurrentUserState();

  LIVE_PAGE.user = state?.user || null;
  LIVE_PAGE.profile = state?.profile || null;

  if (!LIVE_PAGE.user?.id) {
    setStatus("Sign in required before going live.");
    return false;
  }

  setStatus(`Signed in as ${profileName()}`);
  return true;
}

async function bootLivePage() {
  if (LIVE_PAGE.booted) return;
  LIVE_PAGE.booted = true;

  try {
    bindEvents();
    bindLiveSubscriptions();

    if (els.toggleMicBtn) els.toggleMicBtn.disabled = true;
    if (els.toggleCamBtn) els.toggleCamBtn.disabled = true;

    renderTips([]);

    const ok = await initIdentity();

    if (!ok) {
      renderStream(null);
      return;
    }

    await initLiveRail({
      limit: 20,
      realtime: true,
      loadCards: true
    });

    await loadLatestDraftOrLive();

    document.body.classList.add("rb-live-ready");

    markPageReady("live");

    console.log("RB LIVE PAGE READY");
  } catch (error) {
    console.error("[live.js]", error);
    setStatus(error?.message || "Live failed to load.");
    markPageError(error);
  }
}

window.addEventListener("beforeunload", cleanupLivePage);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootLivePage);
} else {
  bootLivePage();
}
