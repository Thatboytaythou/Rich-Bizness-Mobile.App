import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Room,
  RoomEvent,
  Track,
  createLocalTracks
} from "https://esm.sh/livekit-client@2";

import {
  RB_SUPABASE,
  RB_TABLES,
  RB_ROUTES
} from "../shared/rb-config.js";

const supabase = createClient(RB_SUPABASE.url, RB_SUPABASE.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

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
  user: null,
  profile: null,
  stream: null,
  room: null,
  localTracks: [],
  subs: [],
  mic: true,
  cam: true
};

function money(cents = 0) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function setStatus(text) {
  if (els.liveStatus) els.liveStatus.textContent = text;
}

function name() {
  return LIVE.profile?.display_name || LIVE.profile?.username || LIVE.user?.email || "Rich User";
}

function username() {
  return LIVE.profile?.username || LIVE.user?.email || "rich_user";
}

function watchUrl(stream = LIVE.stream) {
  if (!stream) return RB_ROUTES.watch || "/watch";
  return `${RB_ROUTES.watch || "/watch"}?stream=${encodeURIComponent(stream.slug || stream.id)}`;
}

function safeSet(el, value) {
  if (el) el.textContent = value;
}

function renderStream() {
  const s = LIVE.stream;

  if (!s) {
    safeSet(els.stageTitle, "No stream created");
    safeSet(els.liveBadge, "OFF AIR");
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
  if (els.liveBadge) els.liveBadge.className = isLive ? "live-badge on" : "live-badge off";

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

  if (els.videoStage && s.cover_url) {
    els.videoStage.style.backgroundImage =
      `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.75)), url("${s.cover_url}")`;
  }
}

async function initAuth() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    setStatus("Sign in required before going live.");
    return false;
  }

  LIVE.user = data.user;

  const { data: profile } = await supabase
    .from(RB_TABLES.profiles)
    .select("*")
    .eq("id", LIVE.user.id)
    .maybeSingle();

  LIVE.profile = profile || {
    id: LIVE.user.id,
    username: LIVE.user.email,
    display_name: LIVE.user.email
  };

  setStatus(`Signed in as ${name()}`);
  return true;
}

async function createStream() {
  if (!LIVE.user) return setStatus("Sign in first.");

  const payload = {
    creator_id: LIVE.user.id,
    title: els.streamTitle?.value?.trim() || "Family Bizness",
    description: els.streamDescription?.value?.trim() || null,
    category: els.streamCategory?.value || "general",
    status: "draft",
    status_label: "Get Right",
    access_type: els.streamAccess?.value || "free",
    price_cents: Math.max(0, Number(els.streamPrice?.value || 0)),
    currency: "usd",
    thumbnail_url: els.streamThumbnail?.value?.trim() || null,
    cover_url: els.streamCover?.value?.trim() || null,
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
      source: "live.html",
      watch_ready: true
    }
  };

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreams)
    .insert(payload)
    .select("*")
    .single();

  if (error) return setStatus(error.message);

  LIVE.stream = data;

  await supabase.from(RB_TABLES.liveStreamMembers).insert({
    stream_id: data.id,
    user_id: LIVE.user.id,
    role: "host",
    status: "active",
    metadata: { display_name: name(), source: "live.html" }
  });

  await supabase.from(RB_TABLES.liveStreamCards).insert({
    stream_id: data.id,
    creator_id: LIVE.user.id,
    title: data.title,
    subtitle: data.description,
    card_type: "live",
    thumbnail_url: data.thumbnail_url,
    cover_url: data.cover_url,
    target_url: watchUrl(data),
    is_active: true,
    metadata: { section: "watch", source: "live.html" }
  });

  await supabase.from(RB_TABLES.richNotifications).insert({
    user_id: LIVE.user.id,
    actor_id: LIVE.user.id,
    type: "live_created",
    title: "Live studio created",
    body: `${data.title} is ready to start.`,
    target_table: RB_TABLES.liveStreams,
    target_type: "live",
    target_id: data.id,
    target_url: watchUrl(data),
    emoji: "📺",
    metadata: { stream_slug: data.slug }
  });

  renderStream();
  bindRealtime(data.id);
  setStatus("Stream created. Press WE LIT 🔥 when ready.");
}

async function getLivekitToken() {
  const res = await fetch("/api/livekit-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      room: LIVE.stream.livekit_room_name,
      roomName: LIVE.stream.livekit_room_name,
      identity: LIVE.user.id,
      name: name(),
      metadata: {
        stream_id: LIVE.stream.id,
        stream_slug: LIVE.stream.slug,
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

  const room = LIVE.room;
  const rows = [];

  if (room?.localParticipant) {
    rows.push(`<li><strong>${name()}</strong><span>Host</span></li>`);
  }

  room?.remoteParticipants?.forEach((p) => {
    rows.push(`<li><strong>${p.name || p.identity}</strong><span>Viewer</span></li>`);
  });

  els.participantList.innerHTML = rows.length ? rows.join("") : `<li>No participants yet.</li>`;
}

async function startLive() {
  if (!LIVE.stream) return setStatus("Create stream first.");

  if (els.startLiveBtn) els.startLiveBtn.disabled = true;
  setStatus("Starting LiveKit room...");

  const { data, error } = await supabase
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

  if (error) {
    if (els.startLiveBtn) els.startLiveBtn.disabled = false;
    return setStatus(error.message);
  }

  LIVE.stream = data;
  renderStream();

  try {
    const tokenData = await getLivekitToken();
    const token = tokenData.token || tokenData.accessToken;
    const url = tokenData.url || tokenData.livekitUrl || tokenData.wsUrl;

    if (!token || !url) throw new Error("Missing LiveKit URL or token.");

    const room = new Room({ adaptiveStream: true, dynacast: true });
    LIVE.room = room;

    room.on(RoomEvent.TrackSubscribed, attachRemoteTrack);
    room.on(RoomEvent.TrackUnsubscribed, detachRemoteTrack);
    room.on(RoomEvent.ParticipantConnected, syncParticipants);
    room.on(RoomEvent.ParticipantDisconnected, syncParticipants);
    room.on(RoomEvent.Disconnected, () => setStatus("LiveKit disconnected."));

    await room.connect(url, token);

    LIVE.localTracks = await createLocalTracks({ audio: true, video: true });

    for (const track of LIVE.localTracks) {
      await room.localParticipant.publishTrack(track);
      if (track.kind === Track.Kind.Video && els.localVideo) track.attach(els.localVideo);
    }

    if (els.stageEmpty) els.stageEmpty.style.display = "none";
    if (els.toggleMicBtn) els.toggleMicBtn.disabled = false;
    if (els.toggleCamBtn) els.toggleCamBtn.disabled = false;

    await syncParticipants();

    await supabase.from(RB_TABLES.richNotifications).insert({
      user_id: LIVE.user.id,
      actor_id: LIVE.user.id,
      type: "live_started",
      title: "WE LIT 🔥",
      body: `${LIVE.stream.title} is live now.`,
      target_table: RB_TABLES.liveStreams,
      target_type: "live",
      target_id: LIVE.stream.id,
      target_url: watchUrl(),
      emoji: "🔥",
      metadata: { stream_slug: LIVE.stream.slug }
    });

    setStatus("WE LIT 🔥 Live is active and ready for Watch.");
  } catch (err) {
    setStatus(err.message);
  }
}

async function endLive() {
  if (!LIVE.stream) return;

  await disconnectRoom();

  const { data, error } = await supabase
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

  if (error) return setStatus(error.message);

  LIVE.stream = data;
  renderStream();
  setStatus("Live ended.");
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
    if (track.kind === Track.Kind.Audio) LIVE.mic ? track.unmute() : track.mute();
  }
  safeSet(els.toggleMicBtn, LIVE.mic ? "Mute Mic" : "Unmute Mic");
}

async function toggleCam() {
  LIVE.cam = !LIVE.cam;
  for (const track of LIVE.localTracks) {
    if (track.kind === Track.Kind.Video) LIVE.cam ? track.unmute() : track.mute();
  }
  safeSet(els.toggleCamBtn, LIVE.cam ? "Stop Cam" : "Start Cam");
}

async function copyWatchLink() {
  const url = `${location.origin}${watchUrl()}`;
  await navigator.clipboard.writeText(url);
  setStatus("Watch link copied.");
}

async function sendChat(e) {
  e.preventDefault();
  if (!LIVE.stream || !LIVE.user || !els.chatInput?.value.trim()) return;

  const text = els.chatInput.value.trim();
  els.chatInput.value = "";

  const { error } = await supabase.from(RB_TABLES.liveChatMessages).insert({
    stream_id: LIVE.stream.id,
    user_id: LIVE.user.id,
    username: username(),
    display_name: name(),
    message: text,
    body: text,
    metadata: { source: "live.html", role: "host" }
  });

  if (error) return setStatus(error.message);

  await supabase
    .from(RB_TABLES.liveStreams)
    .update({
      total_chat_messages: Number(LIVE.stream.total_chat_messages || 0) + 1,
      last_activity_at: new Date().toISOString()
    })
    .eq("id", LIVE.stream.id);
}

async function sendReaction() {
  if (!LIVE.stream) return;

  await supabase.from(RB_TABLES.liveReactions).insert({
    stream_id: LIVE.stream.id,
    user_id: LIVE.user?.id || null,
    reaction: "🔥",
    metadata: { source: "live.html" }
  });

  await supabase
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
        <strong>${m.display_name || m.username || "Rich User"}</strong>
        <p>${m.message || m.body || ""}</p>
      </li>
    `).join("")
    : `<li>No chat yet.</li>`;
}

function renderTips(rows = []) {
  if (!els.tipList) return;

  els.tipList.innerHTML = rows.length
    ? rows.map((t) => `
      <li>
        <strong>${t.display_name || t.username || "Supporter"}</strong>
        <span>${money(t.amount_cents)}</span>
      </li>
    `).join("")
    : `<li>No tips yet.</li>`;
}

async function loadChat(streamId) {
  const { data } = await supabase
    .from(RB_TABLES.liveChatMessages)
    .select("*")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: true })
    .limit(75);

  renderChat(data || []);
}

async function loadTips(streamId) {
  const { data } = await supabase
    .from(RB_TABLES.liveTips)
    .select("*")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: false })
    .limit(20);

  renderTips(data || []);
}

function clearRealtime() {
  LIVE.subs.forEach((sub) => supabase.removeChannel(sub));
  LIVE.subs = [];
}

function bindRealtime(streamId) {
  clearRealtime();

  const streamSub = supabase
    .channel(`live-stream-${streamId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.liveStreams,
        filter: `id=eq.${streamId}`
      },
      (payload) => {
        LIVE.stream = payload.new;
        renderStream();
      }
    )
    .subscribe();

  const chatSub = supabase
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

  const reactionSub = supabase
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

  const tipsSub = supabase
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

  LIVE.subs.push(streamSub, chatSub, reactionSub, tipsSub);
}

async function loadLatestDraftOrLive() {
  if (!LIVE.user) return;

  const { data } = await supabase
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
    await loadChat(data.id);
    await loadTips(data.id);
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
    disconnectRoom();
  });
}

async function boot() {
  bindEvents();

  if (els.toggleMicBtn) els.toggleMicBtn.disabled = true;
  if (els.toggleCamBtn) els.toggleCamBtn.disabled = true;

  const ok = await initAuth();
  if (!ok) return renderStream();

  await loadLatestDraftOrLive();
}

boot();
