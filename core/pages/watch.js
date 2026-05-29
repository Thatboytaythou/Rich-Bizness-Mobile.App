/* =========================
   RICH BIZNESS MOBILE
   /core/pages/watch.js

   VIEWER SIDE
   Live → Watch sync
========================= */

import {
  Room,
  RoomEvent,
  Track
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

const $ = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);

const DEFAULT_AVATAR = "/images/brand/hero-banner.png";
const DEFAULT_BANNER = "/images/brand/Avatar-hero-Banner.png.jpeg";

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
  supabase: null,
  user: null,
  profile: null,
  stream: null,
  room: null,
  viewSession: null,
  channels: [],
  joinedAt: null,
  anonymousId: localStorage.getItem("rb_watch_anon_id") || crypto.randomUUID(),
  unlocked: false,
  connected: false,
  booted: false
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
  text(els.status, message);
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function streamKey() {
  return getParam("stream") || getParam("slug") || getParam("id");
}

function watchUrl(stream = WATCH.stream) {
  const base = RB_ROUTES.watch || "/watch";
  if (!stream) return base;

  return `${base}?stream=${encodeURIComponent(stream.slug || stream.id)}`;
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

function needsPayment(stream = WATCH.stream) {
  if (!stream) return false;
  if (stream.access_type === "free") return false;
  if (Number(stream.price_cents || 0) <= 0 && stream.access_type !== "vip") return false;

  return !WATCH.unlocked;
}

function renderStream() {
  const s = WATCH.stream;

  if (!s) {
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

    setStatus("No stream loaded.");
    return;
  }

  const isLive = s.status === "live";

  text(els.title, s.title || "Family Bizness");
  text(els.description, s.description || "Rich Bizness live room.");
  text(els.creator, s.display_name || s.username || "Rich Bizness Creator");
  text(els.badge, isLive ? "LIVE" : String(s.status || "DRAFT").toUpperCase());

  text(
    els.access,
    `${String(s.access_type || "free").toUpperCase()}${
      s.price_cents ? ` · ${money(s.price_cents)}` : ""
    }`
  );

  text(els.statViewers, s.viewer_count || 0);
  text(els.statPeak, s.peak_viewers || 0);
  text(els.statChat, s.total_chat_messages || 0);
  text(els.statReactions, s.total_reactions || 0);
  text(els.statRevenue, money(s.total_revenue_cents));

  if (els.badge) {
    els.badge.className = isLive ? "live-badge on" : "live-badge off";
  }

  if (els.stage) {
    els.stage.style.backgroundImage =
      `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.75)), url("${s.cover_url || s.thumbnail_url || DEFAULT_BANNER}")`;
  }

  if (els.joinBtn) els.joinBtn.disabled = !isLive || WATCH.connected || needsPayment(s);
  if (els.leaveBtn) els.leaveBtn.disabled = !WATCH.connected;
  if (els.payBtn) els.payBtn.style.display = needsPayment(s) ? "" : "none";
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

  let query = WATCH.supabase
    .from(RB_TABLES.liveStreams)
    .select("*, profiles:creator_id(username, display_name, avatar_url, banner_url)")
    .order("created_at", { ascending: false });

  if (key) {
    query = query.or(`slug.eq.${key},id.eq.${key}`);
  } else {
    query = query.in("status", ["live", "scheduled", "draft"]);
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
    creator_avatar_url: data.profiles?.avatar_url || DEFAULT_AVATAR,
    creator_banner_url: data.profiles?.banner_url || DEFAULT_BANNER
  };

  await checkAccess();
  renderStream();

  return WATCH.stream;
}

async function loadStreamList() {
  if (!els.streamList) return;

  const { data, error } = await WATCH.supabase
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
        <article class="watch-card" data-stream-card="${escapeHtml(s.id)}">
          <div class="watch-card-img" style="background-image:url('${escapeHtml(s.thumbnail_url || s.cover_url || DEFAULT_BANNER)}')"></div>
          <div>
            <b>${escapeHtml(s.title || "Family Bizness")}</b>
            <span>${escapeHtml(String(s.status || "draft").toUpperCase())} · ${Number(s.viewer_count || 0)} watching</span>
            <small>${escapeHtml(String(s.access_type || "free").toUpperCase())}${s.price_cents ? " · " + money(s.price_cents) : ""}</small>
          </div>
          <a href="${escapeHtml(watchUrl(s))}">Watch</a>
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

  if (!WATCH.user?.id) {
    WATCH.unlocked = false;
    return false;
  }

  const [purchaseRes, vipRes] = await Promise.all([
    WATCH.supabase
      .from(RB_TABLES.liveStreamPurchases)
      .select("id,status")
      .eq("stream_id", WATCH.stream.id)
      .eq("user_id", WATCH.user.id)
      .eq("status", "paid")
      .limit(1)
      .maybeSingle(),

    WATCH.supabase
      .from(RB_TABLES.vipLiveAccess)
      .select("id,access_status,expires_at")
      .eq("stream_id", WATCH.stream.id)
      .eq("user_id", WATCH.user.id)
      .eq("access_status", "active")
      .limit(1)
      .maybeSingle()
  ]);

  const hasPurchase = !!purchaseRes.data;
  const hasVip =
    !!vipRes.data &&
    (!vipRes.data.expires_at || new Date(vipRes.data.expires_at) > new Date());

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

  const { data } = await WATCH.supabase
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

  const watchSeconds = Math.max(
    0,
    Math.floor((Date.now() - (WATCH.joinedAt || Date.now())) / 1000)
  );

  await WATCH.supabase
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

  const { data } = await WATCH.supabase
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
  const room = WATCH.stream.livekit_room_name || `rb-live-${WATCH.stream.id}`;

  const res = await fetch("/api/livekit-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      room,
      roomName: room,
      identity: WATCH.user?.id || WATCH.anonymousId,
      userId: WATCH.user?.id || null,
      name: displayName(),
      role: "viewer",
      metadata: {
        stream_id: WATCH.stream.id,
        stream_slug: WATCH.stream.slug,
        user_id: WATCH.user?.id || null,
        role: "viewer",
        anonymous: !WATCH.user
      }
    })
  });

  if (!res.ok) {
    throw new Error("LiveKit token request failed.");
  }

  return await res.json();
}

async function joinWatch() {
  if (!WATCH.stream) return setStatus("No stream selected.");
  if (WATCH.stream.status !== "live") return setStatus("This stream is not live yet.");

  await checkAccess();

  if (needsPayment()) {
    setStatus("Unlock required before watching.");
    renderStream();
    return;
  }

  setStatus("Joining live room...");

  try {
    await createViewSession();

    const tokenData = await getLivekitToken();
    const token = tokenData.token || tokenData.accessToken;
    const url = tokenData.url || tokenData.livekitUrl || tokenData.wsUrl;

    if (!token || !url) {
      throw new Error("Missing LiveKit URL or token.");
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true
    });

    WATCH.room = room;

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

    room.on(RoomEvent.Disconnected, () => {
      WATCH.connected = false;
      renderStream();
      setStatus("Disconnected from live.");
    });

    await room.connect(url, token);

    WATCH.connected = true;

    if (els.empty) els.empty.style.display = "none";
    renderStream();

    setStatus("You are watching live.");
  } catch (error) {
    await closeViewSession();

    WATCH.connected = false;

    setStatus(error?.message || "Could not join live.");
    renderStream();
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

  await closeViewSession();

  renderStream();
  setStatus("Left live room.");
}

function handleTrackSubscribed(track, publication, participant) {
  if (!els.videoGrid) return;

  if (track.kind !== Track.Kind.Video && track.kind !== Track.Kind.Audio) return;

  const media = track.attach();

  media.dataset.participant = participant.identity;
  media.className = track.kind === Track.Kind.Video ? "watch-video" : "watch-audio";

  if (track.kind === Track.Kind.Video) {
    const wrap = document.createElement("div");
    wrap.className = "watch-video-tile";
    wrap.dataset.participant = participant.identity;

    const label = document.createElement("span");
    label.textContent = participant.name || participant.identity || "Host";

    wrap.appendChild(media);
    wrap.appendChild(label);

    els.videoGrid.appendChild(wrap);
  } else {
    media.autoplay = true;
    document.body.appendChild(media);
  }
}

function handleTrackUnsubscribed(track) {
  track.detach().forEach((el) => {
    const tile = el.closest?.(".watch-video-tile");
    if (tile) tile.remove();
    else el.remove();
  });
}

function chatTemplate(m) {
  return `
    <div class="chat-line ${m.is_pinned ? "pinned" : ""}">
      <b>${escapeHtml(m.display_name || m.username || "Viewer")}</b>
      <span>${escapeHtml(m.message || m.body || "")}</span>
    </div>
  `;
}

async function loadChat() {
  if (!WATCH.stream || !els.chatList) return;

  const { data, error } = await WATCH.supabase
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
    const { data: sessionData } = await WATCH.supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      setStatus("Sign in required to send chat.");
      return;
    }

    const res = await fetch("/api/live-chat-send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        stream_id: WATCH.stream.id,
        message,
        username: username(),
        display_name: displayName()
      })
    });

    const data = await res.json();

    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "Watch chat send failed.");
    }

    els.chatInput.value = "";
    await loadChat();
  } catch (error) {
    console.error("[RB WATCH CHAT API FAILED]", error);
    setStatus(error?.message || "Chat failed.");
  }
}

async function sendReaction(reaction = "🔥") {
  if (!WATCH.stream || !RB_TABLES.liveReactions) return;

  const { error } = await WATCH.supabase
    .from(RB_TABLES.liveReactions)
    .insert({
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

  await WATCH.supabase
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
  if (!WATCH.stream || !els.tipList || !RB_TABLES.liveTips) return;

  const { data } = await WATCH.supabase
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
          <b>${escapeHtml(t.display_name || t.username || "Supporter")}</b>
          <span>${money(t.amount_cents)}${t.message ? " · " + escapeHtml(t.message) : ""}</span>
        </div>
      `)
      .join("")
  );
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
}

async function unlockPaidStream() {
  if (!WATCH.stream) return;

  if (!WATCH.user?.id) {
    window.location.href =
      `${RB_ROUTES.auth || "/auth"}?next=${encodeURIComponent(watchUrl(WATCH.stream))}`;
    return;
  }

  setStatus("Creating live access checkout...");

  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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
      (payload) => {
        WATCH.stream = {
          ...WATCH.stream,
          ...payload.new
        };

        renderStream();
      }
    )
    .subscribe();

  const chatChannel = WATCH.supabase
    .channel(`watch-chat-${streamId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: RB_TABLES.liveChatMessages,
        filter: `stream_id=eq.${streamId}`
      },
      (payload) => {
        if (!els.chatList) return;

        els.chatList.insertAdjacentHTML("beforeend", chatTemplate(payload.new));
        els.chatList.scrollTop = els.chatList.scrollHeight;
      }
    )
    .subscribe();

  WATCH.channels.push(streamChannel, chatChannel);

  if (RB_TABLES.liveReactions) {
    const reactionChannel = WATCH.supabase
      .channel(`watch-reactions-${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: RB_TABLES.liveReactions,
          filter: `stream_id=eq.${streamId}`
        },
        (payload) => burstReaction(payload.new?.reaction || "🔥")
      )
      .subscribe();

    WATCH.channels.push(reactionChannel);
  }

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

function bindEvents() {
  els.joinBtn?.addEventListener("click", joinWatch);
  els.leaveBtn?.addEventListener("click", leaveWatch);
  els.payBtn?.addEventListener("click", unlockPaidStream);
  els.copyBtn?.addEventListener("click", copyLink);
  els.chatForm?.addEventListener("submit", sendChat);
  els.reactionBtn?.addEventListener("click", () => sendReaction("🔥"));
  els.tipBtn?.addEventListener("click", sendTip);

  window.addEventListener("beforeunload", () => {
    clearRealtime();
    closeViewSession();
  });
}

async function bootWatchPage() {
  if (WATCH.booted) return;
  WATCH.booted = true;

  try {
    bindEvents();

    if (els.leaveBtn) els.leaveBtn.disabled = true;

    await initIdentity();
    await loadStreamList();

    const stream = await loadStream();

    if (!stream) {
      renderStream();
      return;
    }

    bindRealtime();
    await loadChat();
    await loadTips();

    if (getParam("paid") === "1") {
      await checkAccess();
      renderStream();
    }

    setStatus(
      stream.status === "live"
        ? "Ready to join live."
        : "Stream loaded. Waiting for creator."
    );

    markPageReady("watch");

    console.log("RB WATCH READY");
  } catch (error) {
    console.error("[watch.js]", error);
    setStatus(error?.message || "Watch failed to load.");
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootWatchPage);
} else {
  bootWatchPage();
}
