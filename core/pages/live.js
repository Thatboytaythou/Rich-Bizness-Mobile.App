/* =========================
   RICH BIZNESS MOBILE
   /core/pages/live.js

   LIVE PAGE CONTROLLER
   Creator studio: create → start → stream → chat → reactions
========================= */

import {
  Room,
  RoomEvent,
  Track,
  createLocalTracks
} from "https://esm.sh/livekit-client@2";

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import { getSupabase } from "/core/shared/rb-supabase.js";

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  initLiveRail,
  upsertLiveRailCard
} from "/core/features/live/live-rail.js";

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

const LIVE = {
  supabase: null,
  user: null,
  profile: null,
  stream: null,
  room: null,
  localTracks: [],
  subs: [],
  mic: true,
  cam: true,
  booted: false
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
  if (els.liveStatus) els.liveStatus.textContent = text;
}

function safeSet(el, value) {
  if (el) el.textContent = value ?? "";
}

function name() {
  return (
    LIVE.profile?.display_name ||
    LIVE.profile?.full_name ||
    LIVE.profile?.username ||
    LIVE.user?.email?.split("@")[0] ||
    "Rich User"
  );
}

function username() {
  return (
    LIVE.profile?.username ||
    LIVE.user?.email?.split("@")[0] ||
    "rich_user"
  );
}

function watchUrl(stream = LIVE.stream) {
  const base = RB_ROUTES.watch || "/watch";
  if (!stream) return base;

  return `${base}?stream=${encodeURIComponent(stream.slug || stream.id)}`;
}

function getPriceCents() {
  const raw = Number(els.streamPrice?.value || 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.round(raw * 100));
}

function renderStream() {
  const s = LIVE.stream;

  if (!s) {
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

    return;
  }

  const isLive = s.status === "live";

  safeSet(els.stageTitle, s.title || "Family Bizness");
  safeSet(els.liveBadge, isLive ? "LIVE" : String(s.status || "DRAFT").toUpperCase());

  if (els.liveBadge) {
    els.liveBadge.className = isLive ? "live-badge on" : "live-badge off";
  }

  if (els.watchLink) els.watchLink.href = watchUrl(s);

  safeSet(els.statStatus, s.status || "draft");
  safeSet(els.statViewers, s.viewer_count || 0);
  safeSet(els.statPeak, s.peak_viewers || 0);
  safeSet(els.statChat, s.total_chat_messages || 0);
  safeSet(els.statReactions, s.total_reactions || 0);
  safeSet(els.statRevenue, money(s.total_revenue_cents));

  if (els.startLiveBtn) els.startLiveBtn.disabled = isLive;
  if (els.endLiveBtn) els.endLiveBtn.disabled = !isLive;
  if (els.copyWatchBtn) els.copyWatchBtn.disabled = false;

  if (els.videoStage) {
    els.videoStage.style.backgroundImage = s.cover_url
      ? `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.75)), url("${s.cover_url}")`
      : "";
  }
}

async function initIdentity() {
  await initApp({
    guard: true,
    bindProfile: true,
    toast: false
  });

  LIVE.supabase = getSupabase();

  const state = getCurrentUserState();

  LIVE.user = state?.user || null;
  LIVE.profile = state?.profile || null;

  if (!LIVE.user?.id) {
    setStatus("Sign in required before going live.");
    return false;
  }

  setStatus(`Signed in as ${name()}`);
  return true;
}

async function createStream() {
  if (!LIVE.user?.id) return setStatus("Sign in first.");

  if (els.createStreamBtn) els.createStreamBtn.disabled = true;

  const roomName = `rb-live-${LIVE.user.id}-${Date.now()}`;

  const payload = {
    creator_id: LIVE.user.id,
    title: els.streamTitle?.value?.trim() || "Family Bizness",
    description: els.streamDescription?.value?.trim() || null,
    category: els.streamCategory?.value || "general",
    status: "draft",
    status_label: "Get Right",
    access_type: els.streamAccess?.value || "free",
    price_cents: getPriceCents(),
    currency: "usd",
    thumbnail_url: els.streamThumbnail?.value?.trim() || null,
    cover_url: els.streamCover?.value?.trim() || null,
    livekit_room_name: roomName,
    viewer_count: 0,
    peak_viewers: 0,
    total_chat_messages: 0,
    total_reactions: 0,
    total_revenue_cents: 0,
    platform_fee_cents: 0,
    creator_amount_cents: 0,
    is_chat_enabled: !!els.chatEnabled?.checked,
    is_cohost_enabled: !!els.cohostEnabled?.checked,
    is_vip_enabled: !!els.vipEnabled?.checked,
    last_activity_at: new Date().toISOString(),
    metadata: {
      source: "live.js",
      watch_ready: true,
      profile_name: name(),
      username: username()
    }
  };

  try {
    const { data, error } = await LIVE.supabase
      .from(RB_TABLES.liveStreams)
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    LIVE.stream = data;

    await LIVE.supabase.from(RB_TABLES.liveStreamMembers).insert({
      stream_id: data.id,
      user_id: LIVE.user.id,
      role: "host",
      status: "active",
      metadata: {
        display_name: name(),
        username: username(),
        source: "live.js"
      }
    });

    await upsertLiveRailCard(data);

    await notifySelf({
      type: "live_created",
      title: "Live studio created",
      body: `${data.title} is ready to start.`,
      emoji: "📺"
    });

    await initLiveModeration({
      stream: data,
      user: LIVE.user,
      profile: LIVE.profile,
      realtime: true
    });

    renderStream();
    bindRealtime(data.id);
    setStatus("Stream created. Press WE LIT 🔥 when ready.");
  } catch (error) {
    console.error("[RB LIVE CREATE FAILED]", error);
    setStatus(error?.message || "Stream create failed.");
  } finally {
    if (els.createStreamBtn) els.createStreamBtn.disabled = false;
  }
}

async function notifySelf({ type, title, body, emoji }) {
  const table = RB_TABLES.richNotifications || RB_TABLES.notifications;
  if (!table || !LIVE.stream?.id || !LIVE.user?.id) return;

  await LIVE.supabase.from(table).insert({
    user_id: LIVE.user.id,
    actor_id: LIVE.user.id,
    type,
    title,
    body,
    target_table: RB_TABLES.liveStreams,
    target_type: "live",
    target_id: LIVE.stream.id,
    target_url: watchUrl(),
    emoji,
    metadata: {
      stream_slug: LIVE.stream.slug,
      source: "live.js"
    }
  });
}

async function getLivekitToken() {
  const room = LIVE.stream.livekit_room_name || `rb-live-${LIVE.stream.id}`;

  const res = await fetch("/api/livekit-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      room,
      roomName: room,
      identity: LIVE.user.id,
      userId: LIVE.user.id,
      name: name(),
      role: "host",
      metadata: {
        stream_id: LIVE.stream.id,
        stream_slug: LIVE.stream.slug,
        user_id: LIVE.user.id,
        role: "host"
      }
    })
  });

  if (!res.ok) throw new Error("LiveKit token request failed.");
  return await res.json();
}

function attachRemoteTrack(track, participant) {
  if (track.kind !== Track.Kind.Video || !els.remoteVideos) return;

  const el = track.attach();
  el.autoplay = true;
  el.playsInline = true;
  el.dataset.sid = participant.sid;
  el.className = "remote-video";

  els.remoteVideos.appendChild(el);
}

function detachRemoteTrack(track) {
  track.detach().forEach((el) => el.remove());
}

async function syncParticipants() {
  if (!LIVE.stream || !els.participantList) return;

  const rows = [];

  if (LIVE.room?.localParticipant) {
    rows.push(`<li><strong>${escapeHtml(name())}</strong><span>Host</span></li>`);
  }

  LIVE.room?.remoteParticipants?.forEach((p) => {
    rows.push(`
      <li>
        <strong>${escapeHtml(p.name || p.identity || "Viewer")}</strong>
        <span>Viewer</span>
      </li>
    `);
  });

  els.participantList.innerHTML = rows.length
    ? rows.join("")
    : `<li>No participants yet.</li>`;
}

async function startLive() {
  if (!LIVE.stream) return setStatus("Create stream first.");

  if (els.startLiveBtn) els.startLiveBtn.disabled = true;

  setStatus("Starting LiveKit room...");

  try {
    const { data, error } = await LIVE.supabase
      .from(RB_TABLES.liveStreams)
      .update({
        status: "live",
        status_label: "WE LIT 🔥",
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq("id", LIVE.stream.id)
      .select("*")
      .single();

    if (error) throw error;

    LIVE.stream = data;
    renderStream();

    await upsertLiveRailCard(data);

    const tokenData = await getLivekitToken();
    const token = tokenData.token || tokenData.accessToken;
    const url = tokenData.url || tokenData.livekitUrl || tokenData.wsUrl;

    if (!token || !url) throw new Error("Missing LiveKit URL or token.");

    const room = new Room({
      adaptiveStream: true,
      dynacast: true
    });

    LIVE.room = room;

    room.on(RoomEvent.TrackSubscribed, attachRemoteTrack);
    room.on(RoomEvent.TrackUnsubscribed, detachRemoteTrack);
    room.on(RoomEvent.ParticipantConnected, syncParticipants);
    room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
    room.on(RoomEvent.Disconnected, () => setStatus("LiveKit disconnected."));

    await room.connect(url, token);

    LIVE.localTracks = await createLocalTracks({
      audio: true,
      video: true
    });

    for (const track of LIVE.localTracks) {
      await room.localParticipant.publishTrack(track);

      if (track.kind === Track.Kind.Video && els.localVideo) {
        track.attach(els.localVideo);
      }
    }

    if (els.stageEmpty) els.stageEmpty.style.display = "none";
    if (els.toggleMicBtn) els.toggleMicBtn.disabled = false;
    if (els.toggleCamBtn) els.toggleCamBtn.disabled = false;

    await syncParticipants();

    await notifySelf({
      type: "live_started",
      title: "WE LIT 🔥",
      body: `${LIVE.stream.title} is live now.`,
      emoji: "🔥"
    });

    setStatus("WE LIT 🔥 Live is active and ready for Watch.");
  } catch (error) {
    console.error("[RB LIVE START FAILED]", error);
    setStatus(error?.message || "Live start failed.");
    if (els.startLiveBtn) els.startLiveBtn.disabled = false;
  }
}

async function endLive() {
  if (!LIVE.stream) return;

  try {
    await disconnectRoom();

    const { data, error } = await LIVE.supabase
      .from(RB_TABLES.liveStreams)
      .update({
        status: "ended",
        status_label: "Ended",
        ended_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq("id", LIVE.stream.id)
      .select("*")
      .single();

    if (error) throw error;

    LIVE.stream = data;

    await upsertLiveRailCard(data);

    renderStream();
    setStatus("Live ended.");
  } catch (error) {
    console.error("[RB LIVE END FAILED]", error);
    setStatus(error?.message || "End live failed.");
  }
}

async function disconnectRoom() {
  for (const track of LIVE.localTracks) {
    try {
      track.stop();
      track.detach().forEach((el) => el.remove());
    } catch {}
  }

  LIVE.localTracks = [];

  if (LIVE.room) {
    await LIVE.room.disconnect();
    LIVE.room = null;
  }

  if (els.remoteVideos) els.remoteVideos.innerHTML = "";
  if (els.stageEmpty) els.stageEmpty.style.display = "grid";
}

async function toggleMic() {
  LIVE.mic = !LIVE.mic;

  for (const track of LIVE.localTracks) {
    if (track.kind === Track.Kind.Audio) {
      LIVE.mic ? track.unmute() : track.mute();
    }
  }

  safeSet(els.toggleMicBtn, LIVE.mic ? "Mute Mic" : "Unmute Mic");
}

async function toggleCam() {
  LIVE.cam = !LIVE.cam;

  for (const track of LIVE.localTracks) {
    if (track.kind === Track.Kind.Video) {
      LIVE.cam ? track.unmute() : track.mute();
    }
  }

  safeSet(els.toggleCamBtn, LIVE.cam ? "Stop Cam" : "Start Cam");
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

  if (!LIVE.stream || !LIVE.user || !els.chatInput?.value.trim()) return;

  const text = els.chatInput.value.trim();
  els.chatInput.value = "";

  const { error } = await LIVE.supabase
    .from(RB_TABLES.liveChatMessages)
    .insert({
      stream_id: LIVE.stream.id,
      user_id: LIVE.user.id,
      username: username(),
      display_name: name(),
      message: text,
      body: text,
      metadata: {
        source: "live.js",
        role: "host"
      }
    });

  if (error) return setStatus(error.message);

  await LIVE.supabase
    .from(RB_TABLES.liveStreams)
    .update({
      total_chat_messages: Number(LIVE.stream.total_chat_messages || 0) + 1,
      last_activity_at: new Date().toISOString()
    })
    .eq("id", LIVE.stream.id);
}

async function sendReaction() {
  if (!LIVE.stream || !RB_TABLES.liveReactions) return popReaction("🔥");

  await LIVE.supabase.from(RB_TABLES.liveReactions).insert({
    stream_id: LIVE.stream.id,
    user_id: LIVE.user?.id || null,
    reaction: "🔥",
    metadata: {
      source: "live.js"
    }
  });

  await LIVE.supabase
    .from(RB_TABLES.liveStreams)
    .update({
      total_reactions: Number(LIVE.stream.total_reactions || 0) + 1,
      last_activity_at: new Date().toISOString()
    })
    .eq("id", LIVE.stream.id);

  popReaction("🔥");
}

function popReaction(icon) {
  if (!els.reactionLayer) return;

  const span = document.createElement("span");
  span.textContent = icon;
  span.className = "reaction-pop";
  span.style.left = `${20 + Math.random() * 60}%`;

  els.reactionLayer.appendChild(span);

  setTimeout(() => span.remove(), 1300);
}

function renderChat(rows = []) {
  if (!els.chatList) return;

  els.chatList.innerHTML = rows.length
    ? rows.map((m) => `
        <li>
          <strong>${escapeHtml(m.display_name || m.username || "Rich User")}</strong>
          <p>${escapeHtml(m.message || m.body || "")}</p>
        </li>
      `).join("")
    : `<li>No chat yet.</li>`;
}

function renderTips(rows = []) {
  if (!els.tipList) return;

  els.tipList.innerHTML = rows.length
    ? rows.map((t) => `
        <li>
          <strong>${escapeHtml(t.display_name || t.username || "Supporter")}</strong>
          <span>${money(t.amount_cents)}</span>
        </li>
      `).join("")
    : `<li>No tips yet.</li>`;
}

async function loadChat(streamId) {
  const { data } = await LIVE.supabase
    .from(RB_TABLES.liveChatMessages)
    .select("*")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: true })
    .limit(75);

  renderChat(data || []);
}

async function loadTips(streamId) {
  if (!RB_TABLES.liveTips) {
    renderTips([]);
    return;
  }

  const { data } = await LIVE.supabase
    .from(RB_TABLES.liveTips)
    .select("*")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: false })
    .limit(20);

  renderTips(data || []);
}

function clearRealtime() {
  LIVE.subs.forEach((sub) => {
    LIVE.supabase?.removeChannel(sub);
  });

  LIVE.subs = [];
}

function bindRealtime(streamId) {
  clearRealtime();

  const streamSub = LIVE.supabase
    .channel(`live-stream-${streamId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.liveStreams,
        filter: `id=eq.${streamId}`
      },
      async (payload) => {
        LIVE.stream = payload.new;
        renderStream();

        if (payload.new?.id) {
          await upsertLiveRailCard(payload.new);
        }
      }
    )
    .subscribe();

  const chatSub = LIVE.supabase
    .channel(`live-chat-${streamId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.liveChatMessages,
        filter: `stream_id=eq.${streamId}`
      },
      () => loadChat(streamId)
    )
    .subscribe();

  LIVE.subs.push(streamSub, chatSub);

  if (RB_TABLES.liveReactions) {
    const reactionSub = LIVE.supabase
      .channel(`live-reactions-${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: RB_TABLES.liveReactions,
          filter: `stream_id=eq.${streamId}`
        },
        (payload) => popReaction(payload.new?.reaction || "🔥")
      )
      .subscribe();

    LIVE.subs.push(reactionSub);
  }

  if (RB_TABLES.liveTips) {
    const tipsSub = LIVE.supabase
      .channel(`live-tips-${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: RB_TABLES.liveTips,
          filter: `stream_id=eq.${streamId}`
        },
        () => loadTips(streamId)
      )
      .subscribe();

    LIVE.subs.push(tipsSub);
  }
}

async function loadLatestDraftOrLive() {
  if (!LIVE.user?.id) return;

  const { data } = await LIVE.supabase
    .from(RB_TABLES.liveStreams)
    .select("*")
    .eq("creator_id", LIVE.user.id)
    .in("status", ["draft", "scheduled", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    LIVE.stream = data;
    renderStream();
    bindRealtime(data.id);

    await Promise.all([
      loadChat(data.id),
      loadTips(data.id),
      initLiveModeration({
        stream: data,
        user: LIVE.user,
        profile: LIVE.profile,
        realtime: true
      })
    ]);
  } else {
    renderStream();
  }
}

function bindEvents() {
  els.createStreamBtn?.addEventListener("click", createStream);
  els.startLiveBtn?.addEventListener("click", startLive);
  els.endLiveBtn?.addEventListener("click", endLive);
  els.toggleMicBtn?.addEventListener("click", toggleMic);
  els.toggleCamBtn?.addEventListener("click", toggleCam);
  els.copyWatchBtn?.addEventListener("click", copyWatchLink);
  els.chatForm?.addEventListener("submit", sendChat);
  els.sendReactionBtn?.addEventListener("click", sendReaction);

  window.addEventListener("beforeunload", () => {
    clearRealtime();
    clearLiveModerationRealtime();
    disconnectRoom();
  });
}

async function bootLivePage() {
  if (LIVE.booted) return;
  LIVE.booted = true;

  try {
    bindEvents();

    if (els.toggleMicBtn) els.toggleMicBtn.disabled = true;
    if (els.toggleCamBtn) els.toggleCamBtn.disabled = true;

    const ok = await initIdentity();

    if (!ok) {
      renderStream();
      return;
    }

    await initLiveRail({
      limit: 20,
      realtime: true,
      loadCards: true
    });

    await loadLatestDraftOrLive();

    markPageReady("live");
    console.log("RB LIVE PAGE READY");
  } catch (error) {
    console.error("[live.js]", error);
    setStatus(error?.message || "Live failed to load.");
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootLivePage);
} else {
  bootLivePage();
}
