/* =========================
   RICH BIZNESS MOBILE
   /core/pages/watch.js
   Viewer side: Live → Watch sync
========================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Room,
  RoomEvent,
  Track
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
const qs = (sel) => document.querySelector(sel);

const els = {
  status: $("watchStatus") || $("liveStatus") || qs("[data-watch-status]"),
  title: $("watchTitle") || $("streamTitle") || qs("[data-watch-title]"),
  description: $("watchDescription") || $("streamDescription") || qs("[data-watch-description]"),
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
  statReactions: $("watchReactions") || $("statReactions") || qs("[data-watch-reactions]"),
  statRevenue: $("watchRevenue") || $("statRevenue") || qs("[data-watch-revenue]"),

  chatList: $("watchChatList") || $("chatList") || qs("[data-watch-chat-list]"),
  chatForm: $("watchChatForm") || $("chatForm") || qs("[data-watch-chat-form]"),
  chatInput: $("watchChatInput") || $("chatInput") || qs("[data-watch-chat-input]"),
  reactionBtn: $("sendReactionBtn") || $("watchReactionBtn") || qs("[data-send-reaction]"),

  tipList: $("watchTipList") || $("tipList") || qs("[data-watch-tips]"),
  tipAmount: $("tipAmount") || qs("[data-tip-amount]"),
  tipMessage: $("tipMessage") || qs("[data-tip-message]"),
  tipBtn: $("sendTipBtn") || qs("[data-send-tip]"),

  streamList: $("watchStreamList") || qs("[data-watch-stream-list]")
};

const WATCH = {
  user: null,
  profile: null,
  stream: null,
  room: null,
  viewSession: null,
  channels: [],
  joinedAt: null,
  anonymousId: localStorage.getItem("rb_watch_anon_id") || crypto.randomUUID(),
  unlocked: false,
  connected: false
};

localStorage.setItem("rb_watch_anon_id", WATCH.anonymousId);

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
  text(els.status, message);
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function streamKey() {
  return getParam("stream") || getParam("slug") || getParam("id");
}

function watchUrl(stream = WATCH.stream) {
  if (!stream) return `${RB_ROUTES.watch || "/watch"}`;
  return `${RB_ROUTES.watch || "/watch"}?stream=${encodeURIComponent(stream.slug || stream.id)}`;
}

function displayName() {
  return (
    WATCH.profile?.display_name ||
    WATCH.profile?.username ||
    WATCH.user?.email ||
    "Rich Viewer"
  );
}

function username() {
  return WATCH.profile?.username || WATCH.user?.email || "rich_viewer";
}

function safeImg(url) {
  return url || "/images/brand/project-avatar.png.jpeg";
}

function renderStream() {
  const s = WATCH.stream;

  if (!s) {
    text(els.title, "No live stream selected");
    text(els.description, "Choose a live room to watch.");
    text(els.badge, "OFF AIR");
    text(els.access, "FREE");
    setStatus("No stream loaded.");
    return;
  }

  text(els.title, s.title || "Family Bizness");
  text(els.description, s.description || "Rich Bizness live room.");
  text(els.creator, s.display_name || s.username || "Rich Bizness Creator");
  text(els.badge, s.status === "live" ? "LIVE" : String(s.status || "DRAFT").toUpperCase());
  text(els.access, `${String(s.access_type || "free").toUpperCase()}${s.price_cents ? ` · ${money(s.price_cents)}` : ""}`);

  text(els.statViewers, s.viewer_count || 0);
  text(els.statPeak, s.peak_viewers || 0);
  text(els.statChat, s.total_chat_messages || 0);
  text(els.statReactions, s.total_reactions || 0);
  text(els.statRevenue, money(s.total_revenue_cents));

  if (els.badge) {
    els.badge.className = s.status === "live" ? "live-badge on" : "live-badge off";
  }

  if (els.stage && (s.cover_url || s.thumbnail_url)) {
    els.stage.style.backgroundImage = `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.75)), url("${s.cover_url || s.thumbnail_url}")`;
  }

  if (els.joinBtn) els.joinBtn.disabled = s.status !== "live";
  if (els.payBtn) els.payBtn.style.display = needsPayment(s) ? "" : "none";
}

function needsPayment(stream = WATCH.stream) {
  if (!stream) return false;
  if (stream.access_type === "free") return false;
  if (stream.price_cents <= 0 && stream.access_type !== "vip") return false;
  return !WATCH.unlocked;
}

async function initAuth() {
  const { data } = await supabase.auth.getUser();
  WATCH.user = data?.user || null;

  if (!WATCH.user) {
    WATCH.profile = null;
    setStatus("Watching as guest.");
    return;
  }

  const { data: profile } = await supabase
    .from(RB_TABLES.profiles)
    .select("*")
    .eq("id", WATCH.user.id)
    .maybeSingle();

  WATCH.profile = profile || {
    id: WATCH.user.id,
    username: WATCH.user.email,
    display_name: WATCH.user.email
  };

  setStatus(`Signed in as ${displayName()}`);
}

async function loadStream() {
  const key = streamKey();

  let query = supabase
    .from(RB_TABLES.liveStreams)
    .select("*, profiles:creator_id(username, display_name, avatar_url, banner_url)")
    .order("created_at", { ascending: false });

  if (key) {
    query = query.or(`slug.eq.${key},id.eq.${key}`);
  } else {
    query = query.in("status", ["live", "scheduled", "draft"]).limit(1);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    setStatus(error.message);
    return null;
  }

  if (!data) {
    setStatus("No stream found.");
    return null;
  }

  WATCH.stream = {
    ...data,
    username: data.profiles?.username,
    display_name: data.profiles?.display_name,
    creator_avatar_url: data.profiles?.avatar_url,
    creator_banner_url: data.profiles?.banner_url
  };

  await checkAccess();
  renderStream();
  return WATCH.stream;
}

async function loadStreamList() {
  if (!els.streamList) return;

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreams)
    .select("id, slug, title, description, status, access_type, price_cents, thumbnail_url, cover_url, viewer_count, created_at")
    .in("status", ["live", "scheduled"])
    .order("status", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return;

  html(
    els.streamList,
    (data || [])
      .map((s) => `
        <article class="watch-card" data-stream-card="${s.id}">
          <div class="watch-card-img" style="background-image:url('${s.thumbnail_url || s.cover_url || "/images/brand/Avatar-hero-Banner.png.jpeg"}')"></div>
          <div>
            <b>${s.title || "Family Bizness"}</b>
            <span>${String(s.status || "draft").toUpperCase()} · ${s.viewer_count || 0} watching</span>
            <small>${String(s.access_type || "free").toUpperCase()} ${s.price_cents ? "· " + money(s.price_cents) : ""}</small>
          </div>
          <a href="${watchUrl(s)}">Watch</a>
        </article>
      `)
      .join("")
  );
}

async function checkAccess() {
  WATCH.unlocked = false;

  if (!WATCH.stream) return false;

  if (WATCH.stream.access_type === "free") {
    WATCH.unlocked = true;
    return true;
  }

  if (!WATCH.user) {
    WATCH.unlocked = false;
    return false;
  }

  const [purchaseRes, vipRes] = await Promise.all([
    supabase
      .from(RB_TABLES.liveStreamPurchases)
      .select("id,status")
      .eq("stream_id", WATCH.stream.id)
      .eq("user_id", WATCH.user.id)
      .eq("status", "paid")
      .limit(1)
      .maybeSingle(),

    supabase
      .from(RB_TABLES.vipLiveAccess)
      .select("id,access_status,expires_at")
      .eq("stream_id", WATCH.stream.id)
      .eq("user_id", WATCH.user.id)
      .eq("access_status", "active")
      .limit(1)
      .maybeSingle()
  ]);

  const hasPurchase = !!purchaseRes.data;
  const hasVip = !!vipRes.data && (!vipRes.data.expires_at || new Date(vipRes.data.expires_at) > new Date());

  WATCH.unlocked = hasPurchase || hasVip;
  return WATCH.unlocked;
}

async function createViewSession() {
  if (!WATCH.stream) return;

  const payload = {
    stream_id: WATCH.stream.id,
    user_id: WATCH.user?.id || null,
    username: WATCH.user ? username() : null,
    display_name: WATCH.user ? displayName() : "Guest Viewer",
    anonymous_id: WATCH.user ? null : WATCH.anonymousId,
    joined_at: new Date().toISOString(),
    device_info: {
      user_agent: navigator.userAgent,
      width: window.innerWidth,
      height: window.innerHeight
    },
    metadata: {
      source: "watch.js",
      route: window.location.pathname
    }
  };

  const { data } = await supabase
    .from(RB_TABLES.liveViewSessions)
    .insert(payload)
    .select("*")
    .single();

  WATCH.viewSession = data || null;
  WATCH.joinedAt = Date.now();

  await updateViewerCount(1);
}

async function closeViewSession() {
  if (!WATCH.viewSession) return;

  const watchSeconds = Math.max(0, Math.floor((Date.now() - (WATCH.joinedAt || Date.now())) / 1000));

  await supabase
    .from(RB_TABLES.liveViewSessions)
    .update({
      left_at: new Date().toISOString(),
      watch_seconds: watchSeconds
    })
    .eq("id", WATCH.viewSession.id);

  WATCH.viewSession = null;
  WATCH.joinedAt = null;

  await updateViewerCount(-1);
}

async function updateViewerCount(delta) {
  if (!WATCH.stream) return;

  const nextViewers = Math.max(0, Number(WATCH.stream.viewer_count || 0) + delta);
  const nextPeak = Math.max(Number(WATCH.stream.peak_viewers || 0), nextViewers);

  const { data } = await supabase
    .from(RB_TABLES.liveStreams)
    .update({
      viewer_count: nextViewers,
      peak_viewers: nextPeak,
      last_activity_at: new Date().toISOString()
    })
    .eq("id", WATCH.stream.id)
    .select("*")
    .single();

  if (data) {
    WATCH.stream = { ...WATCH.stream, ...data };
    renderStream();
  }
}

async function getLivekitToken() {
  const res = await fetch("/api/livekit-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      room: WATCH.stream.livekit_room_name,
      roomName: WATCH.stream.livekit_room_name,
      identity: WATCH.user?.id || WATCH.anonymousId,
      name: displayName(),
      metadata: {
        stream_id: WATCH.stream.id,
        stream_slug: WATCH.stream.slug,
        role: "viewer",
        anonymous: !WATCH.user
      }
    })
  });

  if (!res.ok) throw new Error("LiveKit token request failed.");
  return await res.json();
}

async function joinWatch() {
  if (!WATCH.stream) return setStatus("No stream selected.");
  if (WATCH.stream.status !== "live") return setStatus("This stream is not live yet.");

  await checkAccess();

  if (needsPayment()) {
    setStatus("Unlock required before watching.");
    return;
  }

  setStatus("Joining live room...");

  try {
    await createViewSession();

    const tokenData = await getLivekitToken();
    const token = tokenData.token || tokenData.accessToken;
    const url = tokenData.url || tokenData.livekitUrl || tokenData.wsUrl;

    if (!token || !url) throw new Error("Missing LiveKit URL or token.");

    const room = new Room({
      adaptiveStream: true,
      dynacast: true
    });

    WATCH.room = room;

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.Disconnected, () => {
      WATCH.connected = false;
      setStatus("Disconnected from live.");
    });

    await room.connect(url, token);

    WATCH.connected = true;
    if (els.empty) els.empty.style.display = "none";
    if (els.leaveBtn) els.leaveBtn.disabled = false;
    if (els.joinBtn) els.joinBtn.disabled = true;

    setStatus("You are watching live.");
  } catch (err) {
    await closeViewSession();
    setStatus(err.message || "Could not join live.");
    if (els.joinBtn) els.joinBtn.disabled = false;
  }
}

async function leaveWatch() {
  if (WATCH.room) {
    WATCH.room.disconnect();
    WATCH.room = null;
  }

  WATCH.connected = false;

  if (els.videoGrid) html(els.videoGrid, "");
  if (els.empty) els.empty.style.display = "";
  if (els.leaveBtn) els.leaveBtn.disabled = true;
  if (els.joinBtn) els.joinBtn.disabled = false;

  await closeViewSession();
  setStatus("Left live room.");
}

function handleTrackSubscribed(track, publication, participant) {
  if (!els.videoGrid) return;

  if (track.kind === Track.Kind.Video || track.kind === Track.Kind.Audio) {
    const media = track.attach();
    media.dataset.participant = participant.identity;
    media.className = track.kind === Track.Kind.Video ? "watch-video" : "watch-audio";

    if (track.kind === Track.Kind.Video) {
      const wrap = document.createElement("div");
      wrap.className = "watch-video-tile";
      wrap.dataset.participant = participant.identity;
      wrap.appendChild(media);

      const label = document.createElement("span");
      label.textContent = participant.name || participant.identity || "Host";
      wrap.appendChild(label);

      els.videoGrid.appendChild(wrap);
    } else {
      document.body.appendChild(media);
    }
  }
}

function handleTrackUnsubscribed(track) {
  track.detach().forEach((el) => {
    const tile = el.closest?.(".watch-video-tile");
    if (tile) tile.remove();
    else el.remove();
  });
}

async function loadChat() {
  if (!WATCH.stream || !els.chatList) return;

  const { data, error } = await supabase
    .from(RB_TABLES.liveChatMessages)
    .select("*")
    .eq("stream_id", WATCH.stream.id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return;

  html(els.chatList, (data || []).map(chatTemplate).join(""));
  els.chatList.scrollTop = els.chatList.scrollHeight;
}

function chatTemplate(m) {
  return `
    <div class="chat-line ${m.is_pinned ? "pinned" : ""}">
      <b>${m.display_name || m.username || "Viewer"}</b>
      <span>${m.message || m.body || ""}</span>
    </div>
  `;
}

async function sendChat(e) {
  e?.preventDefault?.();

  if (!WATCH.stream || !els.chatInput) return;
  const message = els.chatInput.value.trim();
  if (!message) return;

  if (!WATCH.stream.is_chat_enabled) {
    setStatus("Chat is disabled for this stream.");
    return;
  }

  const { error } = await supabase.from(RB_TABLES.liveChatMessages).insert({
    stream_id: WATCH.stream.id,
    user_id: WATCH.user?.id || null,
    username: WATCH.user ? username() : "guest",
    display_name: WATCH.user ? displayName() : "Guest Viewer",
    message,
    body: message,
    metadata: {
      source: "watch.js",
      anonymous_id: WATCH.user ? null : WATCH.anonymousId
    }
  });

  if (error) {
    setStatus(error.message);
    return;
  }

  els.chatInput.value = "";

  await supabase
    .from(RB_TABLES.liveStreams)
    .update({
      total_chat_messages: Number(WATCH.stream.total_chat_messages || 0) + 1,
      last_activity_at: new Date().toISOString()
    })
    .eq("id", WATCH.stream.id);
}

async function sendReaction(reaction = "🔥") {
  if (!WATCH.stream) return;

  const { error } = await supabase.from(RB_TABLES.liveReactions).insert({
    stream_id: WATCH.stream.id,
    user_id: WATCH.user?.id || null,
    reaction,
    metadata: {
      source: "watch.js",
      display_name: displayName(),
      anonymous_id: WATCH.user ? null : WATCH.anonymousId
    }
  });

  if (error) {
    setStatus(error.message);
    return;
  }

  burstReaction(reaction);

  await supabase
    .from(RB_TABLES.liveStreams)
    .update({
      total_reactions: Number(WATCH.stream.total_reactions || 0) + 1,
      last_activity_at: new Date().toISOString()
    })
    .eq("id", WATCH.stream.id);
}

function burstReaction(reaction) {
  if (!els.reactionLayer) return;

  const node = document.createElement("span");
  node.className = "reaction-burst";
  node.textContent = reaction;
  node.style.left = `${20 + Math.random() * 60}%`;
  node.style.bottom = `${10 + Math.random() * 30}%`;

  els.reactionLayer.appendChild(node);
  setTimeout(() => node.remove(), 1400);
}

async function loadTips() {
  if (!WATCH.stream || !els.tipList) return;

  const { data } = await supabase
    .from(RB_TABLES.liveTips)
    .select("*")
    .eq("stream_id", WATCH.stream.id)
    .order("created_at", { ascending: false })
    .limit(20);

  html(
    els.tipList,
    (data || [])
      .map((t) => `
        <div class="tip-line">
          <b>${t.display_name || t.username || "Supporter"}</b>
          <span>${money(t.amount_cents)} ${t.message ? "· " + t.message : ""}</span>
        </div>
      `)
      .join("")
  );
}

async function sendTip() {
  if (!WATCH.stream) return;

  const amount = Math.max(100, Math.round(Number(els.tipAmount?.value || 1) * 100));
  const message = els.tipMessage?.value?.trim() || null;

  const { error } = await supabase.from(RB_TABLES.liveTips).insert({
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
}

async function unlockPaidStream() {
  if (!WATCH.stream) return;

  if (!WATCH.user) {
    setStatus("Sign in required to unlock this live.");
    return;
  }

  setStatus("Creating live access checkout...");

  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "live_stream",
        stream_id: WATCH.stream.id,
        product_id: WATCH.stream.id,
        title: WATCH.stream.title,
        amount_cents: WATCH.stream.price_cents,
        currency: WATCH.stream.currency || "usd",
        success_url: `${window.location.origin}${watchUrl(WATCH.stream)}&paid=1`,
        cancel_url: window.location.href
      })
    });

    const data = await res.json();

    if (data?.url) {
      window.location.href = data.url;
      return;
    }

    throw new Error(data?.error || "Checkout URL missing.");
  } catch (err) {
    setStatus(err.message || "Checkout failed.");
  }
}

async function copyLink() {
  const url = `${window.location.origin}${watchUrl(WATCH.stream)}`;
  await navigator.clipboard.writeText(url);
  setStatus("Watch link copied.");
}

function bindRealtime() {
  clearRealtime();

  if (!WATCH.stream) return;

  const streamId = WATCH.stream.id;

  const streamChannel = supabase
    .channel(`watch-stream-${streamId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: RB_TABLES.liveStreams, filter: `id=eq.${streamId}` },
      (payload) => {
        WATCH.stream = { ...WATCH.stream, ...payload.new };
        renderStream();
      }
    )
    .subscribe();

  const chatChannel = supabase
    .channel(`watch-chat-${streamId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: RB_TABLES.liveChatMessages, filter: `stream_id=eq.${streamId}` },
      (payload) => {
        if (!els.chatList) return;
        els.chatList.insertAdjacentHTML("beforeend", chatTemplate(payload.new));
        els.chatList.scrollTop = els.chatList.scrollHeight;
      }
    )
    .subscribe();

  const reactionChannel = supabase
    .channel(`watch-reactions-${streamId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: RB_TABLES.liveReactions, filter: `stream_id=eq.${streamId}` },
      (payload) => burstReaction(payload.new?.reaction || "🔥")
    )
    .subscribe();

  const tipsChannel = supabase
    .channel(`watch-tips-${streamId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: RB_TABLES.liveTips, filter: `stream_id=eq.${streamId}` },
      () => loadTips()
    )
    .subscribe();

  WATCH.channels.push(streamChannel, chatChannel, reactionChannel, tipsChannel);
}

function clearRealtime() {
  WATCH.channels.forEach((ch) => supabase.removeChannel(ch));
  WATCH.channels = [];
}

function bindEvents() {
  els.joinBtn?.addEventListener("click", joinWatch);
  els.leaveBtn?.addEventListener("click", leaveWatch);
  els.payBtn?.addEventListener("click", unlockPaidStream);
  els.copyBtn?.addEventListener("click", copyLink);
  els.chatForm?.addEventListener("submit", sendChat);
  els.reactionBtn?.addEventListener("click", () => sendReaction("🔥"));
  els.tipBtn?.addEventListener("click", sendTip);

  window.addEventListener("beforeunload", () => {
    if (WATCH.viewSession) {
      navigator.sendBeacon?.(
        "/api/health",
        JSON.stringify({
          event: "watch_leave",
          stream_id: WATCH.stream?.id,
          view_session_id: WATCH.viewSession?.id
        })
      );
    }
  });
}

async function boot() {
  bindEvents();
  await initAuth();
  await loadStreamList();

  const stream = await loadStream();

  if (!stream) return;

  bindRealtime();
  await loadChat();
  await loadTips();

  if (getParam("paid") === "1") {
    await checkAccess();
    renderStream();
  }

  setStatus(stream.status === "live" ? "Ready to join live." : "Stream loaded. Waiting for creator.");
}

boot();
