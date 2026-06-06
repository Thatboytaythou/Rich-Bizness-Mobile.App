/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-viewer.js

   LIVE VIEWER ENGINE
   Viewer join/leave + LiveKit watch room
   Presence + Access + Track Events
========================= */

import {
  Room,
  RoomEvent,
  Track
} from "https://esm.sh/livekit-client@2";

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  initLiveAccess,
  canWatchLiveStream
} from "/core/features/live/live-access.js";

import {
  joinLivePresence,
  leaveLivePresence
} from "/core/features/live/live-presence.js";

const VIEWER = {
  stream: null,
  user: null,
  profile: null,

  room: null,
  viewSession: null,

  joined: false,
  connecting: false,
  ready: false,
  error: null,

  tracks: [],
  listeners: new Set()
};

function emitViewer() {
  const state = getLiveViewerState();

  VIEWER.listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      console.warn("[RB LIVE VIEWER LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-live-viewer-update", {
      detail: state
    })
  );

  window.dispatchEvent(
    new CustomEvent("rb:live-viewer-state", {
      detail: state
    })
  );
}

function displayName() {
  return (
    VIEWER.profile?.display_name ||
    VIEWER.profile?.full_name ||
    VIEWER.profile?.username ||
    VIEWER.user?.email?.split("@")[0] ||
    "Rich Viewer"
  );
}

function username() {
  return (
    VIEWER.profile?.username ||
    VIEWER.user?.email?.split("@")[0] ||
    "guest"
  );
}

function avatarUrl() {
  return (
    VIEWER.profile?.avatar_url ||
    "/images/brand/Avatar-hero-Banner.png.jpeg"
  );
}

function anonymousId() {
  const key = "rb_live_viewer_anon_id";
  let id = localStorage.getItem(key);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }

  return id;
}

function watchUrl(stream = VIEWER.stream) {
  if (!stream) return RB_ROUTES.watch || "/watch";

  return `${RB_ROUTES.watch || "/watch"}?stream=${encodeURIComponent(
    stream.slug || stream.display_slug || stream.id
  )}`;
}

function setViewerError(error = null) {
  VIEWER.error = error;
  emitViewer();
}

function clearDetachedTracks() {
  VIEWER.tracks.forEach((item) => {
    try {
      item.track?.detach?.().forEach((el) => el.remove());
      item.element?.remove?.();
    } catch {}
  });

  VIEWER.tracks = [];
}

export function getLiveViewerState() {
  return {
    stream: VIEWER.stream,
    user: VIEWER.user,
    profile: VIEWER.profile,

    room: VIEWER.room,
    viewSession: VIEWER.viewSession,

    joined: VIEWER.joined,
    connecting: VIEWER.connecting,
    ready: VIEWER.ready,
    error: VIEWER.error,

    tracks: [...VIEWER.tracks]
  };
}

export function onLiveViewer(listener) {
  if (typeof listener !== "function") return () => {};

  VIEWER.listeners.add(listener);

  try {
    listener(getLiveViewerState());
  } catch (error) {
    console.warn("[RB LIVE VIEWER LISTENER]", error);
  }

  return () => {
    VIEWER.listeners.delete(listener);
  };
}

async function getLivekitViewerToken() {
  if (!VIEWER.stream?.id) {
    throw new Error("No stream selected.");
  }

  const room =
    VIEWER.stream.livekit_room_name ||
    `rb-live-${VIEWER.stream.id}`;

  const response = await fetch("/api/livekit-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      room,
      roomName: room,
      identity: VIEWER.user?.id || anonymousId(),
      userId: VIEWER.user?.id || null,
      name: displayName(),
      participantName: displayName(),
      role: "viewer",
      metadata: {
        stream_id: VIEWER.stream.id,
        stream_slug: VIEWER.stream.slug || null,
        user_id: VIEWER.user?.id || null,
        username: username(),
        display_name: displayName(),
        avatar_url: avatarUrl(),
        role: "viewer",
        anonymous: !VIEWER.user?.id,
        source: "live-viewer.js"
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

function attachTrack(track, publication, participant) {
  const media = track.attach();

  media.autoplay = true;
  media.playsInline = true;
  media.dataset.participant =
    participant?.identity || "host";

  media.dataset.trackKind = track.kind;

  media.className =
    track.kind === Track.Kind.Video
      ? "watch-video"
      : "watch-audio";

  VIEWER.tracks.push({
    track,
    publication,
    participant,
    element: media,
    kind: track.kind
  });

  emitViewer();

  window.dispatchEvent(
    new CustomEvent("rb-live-track-attached", {
      detail: {
        track,
        publication,
        participant,
        element: media,
        kind: track.kind
      }
    })
  );

  return media;
}

function detachTrack(track) {
  track.detach().forEach((el) => {
    const tile = el.closest?.(".watch-video-tile");
    if (tile) tile.remove();
    else el.remove();
  });

  VIEWER.tracks = VIEWER.tracks.filter(
    (item) => item.track !== track
  );

  emitViewer();

  window.dispatchEvent(
    new CustomEvent("rb-live-track-detached", {
      detail: {
        track
      }
    })
  );
}

async function safeLeavePresence() {
  if (!VIEWER.viewSession?.id) return;

  try {
    await leaveLivePresence({
      sessionId: VIEWER.viewSession.id
    });
  } catch (error) {
    console.warn("[RB LIVE VIEWER PRESENCE LEAVE SKIPPED]", error?.message || error);
  }
}

export async function joinLiveViewer() {
  if (!VIEWER.stream?.id) {
    throw new Error("No live stream selected.");
  }

  if (VIEWER.stream.status !== "live") {
    throw new Error("This stream is not live yet.");
  }

  if (VIEWER.connecting || VIEWER.joined) {
    return getLiveViewerState();
  }

  VIEWER.connecting = true;
  VIEWER.error = null;
  emitViewer();

  try {
    await initLiveAccess({
      stream: VIEWER.stream,
      user: VIEWER.user,
      profile: VIEWER.profile
    });

    const allowed = await canWatchLiveStream();

    if (!allowed?.allowed) {
      throw new Error(
        allowed?.reason || "Unlock required before watching."
      );
    }

    const presence = await joinLivePresence({
      stream: VIEWER.stream,
      user: VIEWER.user,
      profile: VIEWER.profile,
      role: "viewer",
      anonymousId: VIEWER.user?.id ? null : anonymousId()
    });

    VIEWER.viewSession = presence?.session || presence || null;

    const tokenData = await getLivekitViewerToken();

    if (!tokenData.token || !tokenData.url) {
      throw new Error("Missing LiveKit URL or token.");
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true
    });

    VIEWER.room = room;

    room.on(RoomEvent.TrackSubscribed, attachTrack);
    room.on(RoomEvent.TrackUnsubscribed, detachTrack);

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      window.dispatchEvent(
        new CustomEvent("rb-live-participant-connected", {
          detail: {
            participant
          }
        })
      );

      emitViewer();
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      window.dispatchEvent(
        new CustomEvent("rb-live-participant-disconnected", {
          detail: {
            participant
          }
        })
      );

      emitViewer();
    });

    room.on(RoomEvent.Disconnected, async () => {
      VIEWER.joined = false;
      VIEWER.connecting = false;

      await safeLeavePresence();

      VIEWER.viewSession = null;
      VIEWER.room = null;

      clearDetachedTracks();
      emitViewer();
    });

    await room.connect(tokenData.url, tokenData.token);

    VIEWER.joined = true;
    VIEWER.connecting = false;
    VIEWER.ready = true;
    VIEWER.error = null;

    emitViewer();

    return getLiveViewerState();
  } catch (error) {
    VIEWER.connecting = false;
    VIEWER.joined = false;
    VIEWER.error = error;

    await safeLeavePresence();

    VIEWER.viewSession = null;

    if (VIEWER.room) {
      try {
        VIEWER.room.disconnect();
      } catch {}
      VIEWER.room = null;
    }

    clearDetachedTracks();
    emitViewer();

    throw error;
  }
}

export async function leaveLiveViewer() {
  if (VIEWER.room) {
    try {
      VIEWER.room.disconnect();
    } catch {}
    VIEWER.room = null;
  }

  clearDetachedTracks();

  await safeLeavePresence();

  VIEWER.viewSession = null;
  VIEWER.joined = false;
  VIEWER.connecting = false;

  emitViewer();

  return getLiveViewerState();
}

export function goToWatchPage(stream = VIEWER.stream) {
  window.location.href = watchUrl(stream);
}

export async function initLiveViewer({
  stream,
  user = null,
  profile = null,
  autoJoin = false
} = {}) {
  await leaveLiveViewer().catch(() => {});

  VIEWER.stream = stream || null;
  VIEWER.user = user || null;
  VIEWER.profile = profile || null;

  VIEWER.joined = false;
  VIEWER.connecting = false;
  VIEWER.ready = true;
  VIEWER.error = null;
  VIEWER.tracks = [];

  emitViewer();

  if (autoJoin && VIEWER.stream?.status === "live") {
    await joinLiveViewer();
  }

  return getLiveViewerState();
}

export function resetLiveViewer() {
  leaveLiveViewer().catch(() => {});

  VIEWER.stream = null;
  VIEWER.user = null;
  VIEWER.profile = null;
  VIEWER.ready = false;
  VIEWER.error = null;

  emitViewer();
}

window.addEventListener("beforeunload", () => {
  leaveLiveViewer();
});

console.log("RB LIVE VIEWER READY");
