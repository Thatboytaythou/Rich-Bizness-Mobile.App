/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-studio.js

   LIVE STUDIO ENGINE
   Creator stream create/start/end + LiveKit host room
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

import { getSupabase } from "/core/shared/rb-supabase.js";

import {
  initLiveState,
  setLiveStateStream,
  getLiveState,
  updateLiveStreamStatus,
  touchLiveStream
} from "/core/features/live/live-state.js";

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
  return STUDIO.profile?.username || STUDIO.user?.email || "rich_creator";
}

function watchUrl(stream = STUDIO.stream) {
  if (!stream) return RB_ROUTES.watch || "/watch";

  return `${RB_ROUTES.watch || "/watch"}?stream=${encodeURIComponent(
    stream.slug || stream.id
  )}`;
}

function moneyCents(value) {
  return Math.max(0, Number(value || 0));
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
    live: STUDIO.live
  };
}

export function onLiveStudio(listener) {
  if (typeof listener !== "function") return () => {};

  STUDIO.listeners.add(listener);
  listener(getLiveStudioState());

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

    title: String(title || "Family Bizness").trim(),
    description: description || null,
    category: category || "general",

    status: "draft",
    status_label: "Get Right",

    access_type: accessType || "free",
    price_cents: moneyCents(priceCents),
    currency: "usd",

    thumbnail_url: thumbnailUrl || null,
    cover_url: coverUrl || null,

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
      display_name: displayName()
    }
  };

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreams)
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  STUDIO.stream = data;
  STUDIO.live = data.status === "live";

  await setLiveStateStream(data);

  await Promise.all([
    supabase.from(RB_TABLES.liveStreamMembers).insert({
      stream_id: data.id,
      user_id: STUDIO.user.id,
      role: "host",
      status: "active",
      metadata: {
        source: "live-studio.js",
        username: username(),
        display_name: displayName()
      }
    }),

    supabase.from(RB_TABLES.liveStreamCards).insert({
      stream_id: data.id,
      creator_id: STUDIO.user.id,
      title: data.title,
      subtitle: data.description,
      card_type: "live",
      thumbnail_url: data.thumbnail_url,
      cover_url: data.cover_url,
      target_url: watchUrl(data),
      is_active: true,
      metadata: {
        source: "live-studio.js",
        section: "watch"
      }
    }),

    supabase.from(RB_TABLES.richNotifications).insert({
      user_id: STUDIO.user.id,
      actor_id: STUDIO.user.id,
      type: "live_created",
      title: "Live studio created",
      body: `${data.title} is ready to start.`,
      target_table: RB_TABLES.liveStreams,
      target_type: "live",
      target_id: data.id,
      target_url: watchUrl(data),
      emoji: "📺",
      metadata: {
        source: "live-studio.js",
        stream_slug: data.slug
      }
    })
  ]);

  await initLiveChat({
    stream: data,
    user: STUDIO.user,
    profile: STUDIO.profile,
    realtime: true
  });

  await initLiveReactions({
    stream: data,
    user: STUDIO.user,
    profile: STUDIO.profile,
    realtime: true
  });

  await initLivePresence({
    stream: data,
    user: STUDIO.user,
    profile: STUDIO.profile,
    realtime: true
  });

  emitStudio();

  return data;
}

async function getLivekitHostToken() {
  if (!STUDIO.stream?.id) {
    throw new Error("Create a stream first.");
  }

  const room =
    STUDIO.stream.livekit_room_name ||
    `rb-live-${STUDIO.stream.id}`;

  const res = await fetch("/api/livekit-token", {
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
      role: "host",
      metadata: {
        stream_id: STUDIO.stream.id,
        stream_slug: STUDIO.stream.slug,
        user_id: STUDIO.user.id,
        role: "host",
        source: "live-studio.js"
      }
    })
  });

  if (!res.ok) {
    throw new Error("LiveKit token request failed.");
  }

  const data = await res.json();

  return {
    token: data.token || data.accessToken,
    url: data.url || data.livekitUrl || data.wsUrl
  };
}

export async function startLiveStudio() {
  if (!STUDIO.stream?.id) {
    throw new Error("Create stream first.");
  }

  if (STUDIO.connecting || STUDIO.live) {
    return getLiveStudioState();
  }

  STUDIO.connecting = true;
  emitStudio();

  try {
    const stream = await updateLiveStreamStatus("live", {
      status_label: "WE LIT 🔥",
      started_at: new Date().toISOString()
    });

    STUDIO.stream = stream;
    STUDIO.live = true;

    const tokenData = await getLivekitHostToken();

    if (!tokenData.token || !tokenData.url) {
      throw new Error("Missing LiveKit URL or token.");
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true
    });

    STUDIO.room = room;

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      window.dispatchEvent(
        new CustomEvent("rb-live-studio-remote-track", {
          detail: { track, publication, participant }
        })
      );
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((el) => el.remove());
    });

    room.on(RoomEvent.ParticipantConnected, () => {
      window.dispatchEvent(new CustomEvent("rb-live-studio-participants"));
    });

    room.on(RoomEvent.ParticipantDisconnected, () => {
      window.dispatchEvent(new CustomEvent("rb-live-studio-participants"));
    });

    room.on(RoomEvent.Disconnected, () => {
      STUDIO.room = null;
      STUDIO.localTracks = [];
      STUDIO.connecting = false;
      emitStudio();
    });

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

    await getSupabase()
      .from(RB_TABLES.richNotifications)
      .insert({
        user_id: STUDIO.user.id,
        actor_id: STUDIO.user.id,
        type: "live_started",
        title: "WE LIT 🔥",
        body: `${STUDIO.stream.title} is live now.`,
        target_table: RB_TABLES.liveStreams,
        target_type: "live",
        target_id: STUDIO.stream.id,
        target_url: watchUrl(),
        emoji: "🔥",
        metadata: {
          source: "live-studio.js",
          stream_slug: STUDIO.stream.slug
        }
      });

    STUDIO.connecting = false;
    STUDIO.live = true;

    emitStudio();

    return getLiveStudioState();
  } catch (error) {
    STUDIO.connecting = false;
    STUDIO.live = false;
    emitStudio();
    throw error;
  }
}

export async function endLiveStudio() {
  if (!STUDIO.stream?.id) return getLiveStudioState();

  await disconnectLiveStudioRoom();

  const stream = await updateLiveStreamStatus("ended", {
    status_label: "Ended",
    ended_at: new Date().toISOString()
  });

  STUDIO.stream = stream;
  STUDIO.live = false;

  await getSupabase()
    .from(RB_TABLES.liveStreamCards)
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq("stream_id", STUDIO.stream.id);

  clearLiveChatRealtime();
  clearLiveReactionRealtime();
  clearLivePresenceRealtime();

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
    await STUDIO.room.disconnect();
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

export async function updateLiveStudioMeta(updates = {}) {
  if (!STUDIO.stream?.id) {
    throw new Error("No stream selected.");
  }

  const supabase = getSupabase();

  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreams)
    .update(payload)
    .eq("id", STUDIO.stream.id)
    .select("*")
    .single();

  if (error) throw error;

  STUDIO.stream = data;
  await setLiveStateStream(data);
  emitStudio();

  return data;
}

export async function loadLatestStudioStream() {
  if (!STUDIO.user?.id) return null;

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreams)
    .select("*")
    .eq("creator_id", STUDIO.user.id)
    .in("status", ["draft", "scheduled", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    STUDIO.stream = data;
    STUDIO.live = data.status === "live";
    await setLiveStateStream(data);
  }

  emitStudio();

  return data || null;
}

export async function touchLiveStudio() {
  if (!STUDIO.stream?.id) return null;

  const stream = await touchLiveStream();

  STUDIO.stream = stream;
  emitStudio();

  return stream;
}

export async function initLiveStudio({
  stream = null,
  user = null,
  profile = null,
  loadLatest = true
} = {}) {
  STUDIO.stream = stream;
  STUDIO.user = user;
  STUDIO.profile = profile;

  STUDIO.room = null;
  STUDIO.localTracks = [];
  STUDIO.mic = true;
  STUDIO.cam = true;
  STUDIO.screen = false;
  STUDIO.connecting = false;
  STUDIO.live = stream?.status === "live";

  await initLiveState({
    stream,
    user,
    profile,
    realtime: true
  });

  if (loadLatest && !stream?.id) {
    await loadLatestStudioStream();
  }

  if (STUDIO.stream?.id) {
    await initLiveChat({
      stream: STUDIO.stream,
      user: STUDIO.user,
      profile: STUDIO.profile,
      realtime: true
    });

    await initLiveReactions({
      stream: STUDIO.stream,
      user: STUDIO.user,
      profile: STUDIO.profile,
      realtime: true
    });

    await initLivePresence({
      stream: STUDIO.stream,
      user: STUDIO.user,
      profile: STUDIO.profile,
      realtime: true
    });
  }

  emitStudio();

  return getLiveStudioState();
}

window.addEventListener("beforeunload", () => {
  disconnectLiveStudioRoom();
});

console.log("RB LIVE STUDIO READY");
