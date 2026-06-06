/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-studio.js

   LIVE STUDIO ENGINE
   Creator stream create/start/end + LiveKit host room
   Safe State Sync + Rail/Card/Notification Sync
========================= */

import {
  Room,
  RoomEvent,
  Track,
  createLocalTracks
} from "https://esm.sh/livekit-client@2";

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  initLiveState,
  refreshLiveState
} from "/core/features/live/live-state.js";

import {
  upsertLiveRailCard
} from "/core/features/live/live-rail.js";

import {
  initLiveChat,
  clearLiveChatRealtime
} from "/core/features/live/live-chat.js";

import {
  initLiveReactions,
  clearLiveReactionRealtime
} from "/core/features/live/live-reactions.js";

import {
  initLivePresence,
  clearLivePresenceRealtime
} from "/core/features/live/live-presence.js";

const STUDIO = {
  stream: null,
  user: null,
  profile: null,

  room: null,
  localTracks: [],

  mic: true,
  cam: true,
  screen: false,

  connecting: false,
  live: false,
  ready: false,
  error: null,

  listeners: new Set()
};

function emitStudio() {
  const state = getLiveStudioState();

  STUDIO.listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      console.warn("[RB LIVE STUDIO LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-live-studio-update", {
      detail: state
    })
  );

  window.dispatchEvent(
    new CustomEvent("rb:live-studio-state", {
      detail: state
    })
  );
}

function displayName() {
  return (
    STUDIO.profile?.display_name ||
    STUDIO.profile?.full_name ||
    STUDIO.profile?.username ||
    STUDIO.user?.email?.split("@")[0] ||
    "Rich Creator"
  );
}

function username() {
  return (
    STUDIO.profile?.username ||
    STUDIO.user?.email?.split("@")[0] ||
    "rich_creator"
  );
}

function avatarUrl() {
  return (
    STUDIO.profile?.avatar_url ||
    "/images/brand/Avatar-hero-Banner.png.jpeg"
  );
}

function watchUrl(stream = STUDIO.stream) {
  if (!stream) return RB_ROUTES.watch || "/watch";

  return `${RB_ROUTES.watch || "/watch"}?stream=${encodeURIComponent(
    stream.slug || stream.display_slug || stream.id
  )}`;
}

function moneyCents(value) {
  const cents = Number(value || 0);
  return Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0;
}

function cleanText(value = "", fallback = "") {
  return String(value || fallback || "").trim();
}

function setStudioError(error = null) {
  STUDIO.error = error;
  emitStudio();
}

async function safeInsert(table, payload) {
  if (!table) return null;

  try {
    const { data, error } = await getSupabase()
      .from(table)
      .insert(payload)
      .select("*")
      .maybeSingle();

    if (error) throw error;

    return data || null;
  } catch (error) {
    console.warn(`[RB LIVE STUDIO INSERT SKIPPED: ${table}]`, error?.message || error);
    return null;
  }
}

async function safeUpdate(table, match = {}, values = {}) {
  if (!table) return null;

  try {
    let query = getSupabase().from(table).update(values);

    Object.entries(match).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    const { data, error } = await query.select("*").maybeSingle();

    if (error) throw error;

    return data || null;
  } catch (error) {
    console.warn(`[RB LIVE STUDIO UPDATE SKIPPED: ${table}]`, error?.message || error);
    return null;
  }
}

async function updateStudioStream(values = {}) {
  if (!STUDIO.stream?.id) {
    throw new Error("No stream selected.");
  }

  const supabase = getSupabase();

  const payload = {
    ...values,
    updated_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreams)
    .update(payload)
    .eq("id", STUDIO.stream.id)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  STUDIO.stream = data || {
    ...STUDIO.stream,
    ...payload
  };

  STUDIO.live = STUDIO.stream.status === "live";

  await refreshLiveState().catch(() => {});
  await upsertLiveRailCard(STUDIO.stream).catch(() => {});

  emitStudio();

  return STUDIO.stream;
}

async function touchStudioStream() {
  if (!STUDIO.stream?.id) return null;

  return await updateStudioStream({
    last_activity_at: new Date().toISOString()
  });
}

async function notifySelf({
  type,
  title,
  body,
  emoji = "💨"
} = {}) {
  const table = RB_TABLES.richNotifications || RB_TABLES.notifications;

  if (!table || !STUDIO.user?.id || !STUDIO.stream?.id) return null;

  return await safeInsert(table, {
    user_id: STUDIO.user.id,
    actor_id: STUDIO.user.id,
    type,
    title,
    body,
    target_table: RB_TABLES.liveStreams,
    target_type: "live",
    target_id: STUDIO.stream.id,
    target_url: watchUrl(STUDIO.stream),
    emoji,
    priority: type === "live_started" ? "high" : "normal",
    metadata: {
      source: "live-studio.js",
      stream_slug: STUDIO.stream.slug || null
    }
  });
}

export function getLiveStudioState() {
  return {
    stream: STUDIO.stream,
    user: STUDIO.user,
    profile: STUDIO.profile,

    room: STUDIO.room,
    localTracks: [...STUDIO.localTracks],

    mic: STUDIO.mic,
    cam: STUDIO.cam,
    screen: STUDIO.screen,

    connecting: STUDIO.connecting,
    live: STUDIO.live,
    ready: STUDIO.ready,
    error: STUDIO.error
  };
}

export function onLiveStudio(listener) {
  if (typeof listener !== "function") return () => {};

  STUDIO.listeners.add(listener);

  try {
    listener(getLiveStudioState());
  } catch (error) {
    console.warn("[RB LIVE STUDIO LISTENER]", error);
  }

  return () => {
    STUDIO.listeners.delete(listener);
  };
}

export async function createLiveStudioStream({
  title = "Family Bizness",
  description = null,
  category = "general",
  accessType = "free",
  priceCents = 0,
  thumbnailUrl = null,
  coverUrl = null,
  chatEnabled = true,
  cohostEnabled = true,
  vipEnabled = true
} = {}) {
  if (!STUDIO.user?.id) {
    throw new Error("Sign in before creating a live stream.");
  }

  const supabase = getSupabase();
  const roomName = `rb-live-${STUDIO.user.id}-${Date.now()}`;

  const payload = {
    creator_id: STUDIO.user.id,

    title: cleanText(title, "Family Bizness"),
    description: cleanText(description) || null,
    category: cleanText(category, "general"),

    status: "draft",
    status_label: "Get Right",

    access_type: cleanText(accessType, "free"),
    price_cents: moneyCents(priceCents),
    currency: "usd",

    thumbnail_url: cleanText(thumbnailUrl) || null,
    cover_url: cleanText(coverUrl) || null,

    livekit_room_name: roomName,

    viewer_count: 0,
    peak_viewers: 0,
    total_chat_messages: 0,
    total_reactions: 0,
    total_revenue_cents: 0,
    platform_fee_cents: 0,
    creator_amount_cents: 0,

    is_chat_enabled: Boolean(chatEnabled),
    is_cohost_enabled: Boolean(cohostEnabled),
    is_vip_enabled: Boolean(vipEnabled),

    last_activity_at: new Date().toISOString(),

    metadata: {
      source: "live-studio.js",
      watch_ready: true,
      username: username(),
      display_name: displayName(),
      avatar_url: avatarUrl()
    }
  };

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreams)
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  STUDIO.stream = data || payload;
  STUDIO.live = STUDIO.stream.status === "live";
  STUDIO.error = null;

  await Promise.allSettled([
    safeInsert(RB_TABLES.liveStreamMembers, {
      stream_id: STUDIO.stream.id,
      user_id: STUDIO.user.id,
      role: "host",
      status: "active",
      metadata: {
        source: "live-studio.js",
        username: username(),
        display_name: displayName(),
        avatar_url: avatarUrl()
      }
    }),

    upsertLiveRailCard(STUDIO.stream),

    notifySelf({
      type: "live_created",
      title: "Live studio created",
      body: `${STUDIO.stream.title} is ready to start.`,
      emoji: "📺"
    })
  ]);

  await Promise.allSettled([
    initLiveChat({
      stream: STUDIO.stream,
      user: STUDIO.user,
      profile: STUDIO.profile,
      realtime: true
    }),

    initLiveReactions({
      stream: STUDIO.stream,
      user: STUDIO.user,
      profile: STUDIO.profile,
      realtime: true
    }),

    initLivePresence({
      stream: STUDIO.stream,
      user: STUDIO.user,
      profile: STUDIO.profile,
      realtime: true
    }),

    refreshLiveState()
  ]);

  emitStudio();

  return STUDIO.stream;
}

async function getLivekitHostToken() {
  if (!STUDIO.stream?.id) {
    throw new Error("Create a stream first.");
  }

  const room =
    STUDIO.stream.livekit_room_name ||
    `rb-live-${STUDIO.stream.id}`;

  const response = await fetch("/api/livekit-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      room,
      roomName: room,
      identity: STUDIO.user.id,
      userId: STUDIO.user.id,
      name: displayName(),
      participantName: displayName(),
      role: "host",
      metadata: {
        stream_id: STUDIO.stream.id,
        stream_slug: STUDIO.stream.slug || null,
        user_id: STUDIO.user.id,
        username: username(),
        display_name: displayName(),
        avatar_url: avatarUrl(),
        role: "host",
        source: "live-studio.js"
      }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || "LiveKit token request failed.");
  }

  return {
    token: data.token || data.accessToken,
    url: data.url || data.livekitUrl || data.wsUrl
  };
}

function bindRoomEvents(room) {
  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    window.dispatchEvent(
      new CustomEvent("rb-live-studio-remote-track", {
        detail: {
          track,
          publication,
          participant
        }
      })
    );
  });

  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    track.detach().forEach((el) => el.remove());
  });

  room.on(RoomEvent.ParticipantConnected, (participant) => {
    window.dispatchEvent(
      new CustomEvent("rb-live-studio-participants", {
        detail: {
          participant,
          type: "connected"
        }
      })
    );
  });

  room.on(RoomEvent.ParticipantDisconnected, (participant) => {
    window.dispatchEvent(
      new CustomEvent("rb-live-studio-participants", {
        detail: {
          participant,
          type: "disconnected"
        }
      })
    );
  });

  room.on(RoomEvent.Disconnected, () => {
    STUDIO.room = null;
    STUDIO.localTracks = [];
    STUDIO.connecting = false;
    emitStudio();
  });
}

export async function startLiveStudio() {
  if (!STUDIO.stream?.id) {
    throw new Error("Create stream first.");
  }

  if (STUDIO.connecting || STUDIO.live) {
    return getLiveStudioState();
  }

  STUDIO.connecting = true;
  STUDIO.error = null;
  emitStudio();

  try {
    STUDIO.stream = await updateStudioStream({
      status: "live",
      status_label: "WE LIT 🔥",
      started_at: new Date().toISOString()
    });

    const tokenData = await getLivekitHostToken();

    if (!tokenData.token || !tokenData.url) {
      throw new Error("Missing LiveKit URL or token.");
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true
    });

    STUDIO.room = room;
    bindRoomEvents(room);

    await room.connect(tokenData.url, tokenData.token);

    STUDIO.localTracks = await createLocalTracks({
      audio: true,
      video: true
    });

    for (const track of STUDIO.localTracks) {
      await room.localParticipant.publishTrack(track);

      if (track.kind === Track.Kind.Video) {
        window.dispatchEvent(
          new CustomEvent("rb-live-studio-local-video", {
            detail: {
              track,
              element: track.attach()
            }
          })
        );
      }
    }

    await notifySelf({
      type: "live_started",
      title: "WE LIT 🔥",
      body: `${STUDIO.stream.title} is live now.`,
      emoji: "🔥"
    });

    STUDIO.connecting = false;
    STUDIO.live = true;
    STUDIO.error = null;

    await touchStudioStream();

    emitStudio();

    return getLiveStudioState();
  } catch (error) {
    STUDIO.connecting = false;
    STUDIO.live = false;
    STUDIO.error = error;

    emitStudio();

    throw error;
  }
}

export async function endLiveStudio() {
  if (!STUDIO.stream?.id) return getLiveStudioState();

  await disconnectLiveStudioRoom();

  STUDIO.stream = await updateStudioStream({
    status: "ended",
    status_label: "Ended",
    ended_at: new Date().toISOString()
  });

  STUDIO.live = false;

  await safeUpdate(
    RB_TABLES.liveStreamCards,
    { stream_id: STUDIO.stream.id },
    {
      is_active: false,
      updated_at: new Date().toISOString()
    }
  );

  clearLiveChatRealtime();
  clearLiveReactionRealtime();
  clearLivePresenceRealtime();

  await refreshLiveState().catch(() => {});

  emitStudio();

  return getLiveStudioState();
}

export async function disconnectLiveStudioRoom() {
  for (const track of STUDIO.localTracks) {
    try {
      track.stop();
      track.detach().forEach((el) => el.remove());
    } catch {}
  }

  STUDIO.localTracks = [];

  if (STUDIO.room) {
    try {
      await STUDIO.room.disconnect();
    } catch {}
    STUDIO.room = null;
  }

  STUDIO.connecting = false;

  emitStudio();
}

export async function toggleStudioMic() {
  STUDIO.mic = !STUDIO.mic;

  for (const track of STUDIO.localTracks) {
    if (track.kind === Track.Kind.Audio) {
      STUDIO.mic ? track.unmute() : track.mute();
    }
  }

  emitStudio();

  return STUDIO.mic;
}

export async function toggleStudioCam() {
  STUDIO.cam = !STUDIO.cam;

  for (const track of STUDIO.localTracks) {
    if (track.kind === Track.Kind.Video) {
      STUDIO.cam ? track.unmute() : track.mute();
    }
  }

  emitStudio();

  return STUDIO.cam;
}

export async function startStudioScreenShare() {
  if (!STUDIO.room) {
    throw new Error("Start live before sharing screen.");
  }

  await STUDIO.room.localParticipant.setScreenShareEnabled(true);

  STUDIO.screen = true;
  emitStudio();

  return true;
}

export async function stopStudioScreenShare() {
  if (!STUDIO.room) return false;

  await STUDIO.room.localParticipant.setScreenShareEnabled(false);

  STUDIO.screen = false;
  emitStudio();

  return true;
}

export async function toggleStudioScreenShare() {
  if (STUDIO.screen) {
    return await stopStudioScreenShare();
  }

  return await startStudioScreenShare();
}

export async function updateLiveStudioMeta(updates = {}) {
  if (!STUDIO.stream?.id) {
    throw new Error("No stream selected.");
  }

  return await updateStudioStream(updates);
}

export async function loadLatestStudioStream() {
  if (!STUDIO.user?.id) return null;

  const supabase = getSupabase();

  const attempts = [
    {
      name: "draft_scheduled_live",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreams)
          .select("*")
          .eq("creator_id", STUDIO.user.id)
          .in("status", ["draft", "scheduled", "live"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
    },
    {
      name: "creator_latest",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreams)
          .select("*")
          .eq("creator_id", STUDIO.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
    }
  ];

  for (const attempt of attempts) {
    try {
      const { data, error } = await attempt.run();
      if (error) throw error;

      if (data) {
        STUDIO.stream = data;
        STUDIO.live = data.status === "live";
        emitStudio();
      }

      return data || null;
    } catch (error) {
      console.warn(`[RB LIVE STUDIO LATEST SKIPPED: ${attempt.name}]`, error?.message || error);
    }
  }

  return null;
}

export async function touchLiveStudio() {
  return await touchStudioStream();
}

export async function initLiveStudio({
  stream = null,
  user = null,
  profile = null,
  loadLatest = true
} = {}) {
  await disconnectLiveStudioRoom().catch(() => {});

  STUDIO.stream = stream || null;
  STUDIO.user = user || null;
  STUDIO.profile = profile || null;

  STUDIO.room = null;
  STUDIO.localTracks = [];
  STUDIO.mic = true;
  STUDIO.cam = true;
  STUDIO.screen = false;
  STUDIO.connecting = false;
  STUDIO.live = stream?.status === "live";
  STUDIO.ready = false;
  STUDIO.error = null;

  await initLiveState({
    realtime: true
  }).catch(() => {});

  if (loadLatest && !stream?.id) {
    await loadLatestStudioStream();
  }

  if (STUDIO.stream?.id) {
    await Promise.allSettled([
      initLiveChat({
        stream: STUDIO.stream,
        user: STUDIO.user,
        profile: STUDIO.profile,
        realtime: true
      }),

      initLiveReactions({
        stream: STUDIO.stream,
        user: STUDIO.user,
        profile: STUDIO.profile,
        realtime: true
      }),

      initLivePresence({
        stream: STUDIO.stream,
        user: STUDIO.user,
        profile: STUDIO.profile,
        realtime: true
      })
    ]);
  }

  STUDIO.ready = true;
  emitStudio();

  return getLiveStudioState();
}

export function resetLiveStudio() {
  disconnectLiveStudioRoom().catch(() => {});

  clearLiveChatRealtime();
  clearLiveReactionRealtime();
  clearLivePresenceRealtime();

  STUDIO.stream = null;
  STUDIO.user = null;
  STUDIO.profile = null;
  STUDIO.ready = false;
  STUDIO.live = false;
  STUDIO.error = null;

  emitStudio();
}

window.addEventListener("beforeunload", () => {
  disconnectLiveStudioRoom();
});

console.log("RB LIVE STUDIO READY");
