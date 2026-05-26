/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-viewer.js

   LIVE VIEWER ENGINE
   Viewer join/leave + LiveKit watch room
========================= */

import {
  Room,
  RoomEvent,
  Track
} from "https://esm.sh/livekit-client@2";

import { RB_ROUTES } from "/core/shared/rb-config.js";

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
    stream.slug || stream.id
  )}`;
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

    tracks: [...VIEWER.tracks]
  };
}

export function onLiveViewer(listener) {
  if (typeof listener !== "function") return () => {};

  VIEWER.listeners.add(listener);
  listener(getLiveViewerState());

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

  const res = await fetch("/api/livekit-token", {
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
      role: "viewer",
      metadata: {
        stream_id: VIEWER.stream.id,
        stream_slug: VIEWER.stream.slug,
        user_id: VIEWER.user?.id || null,
        role: "viewer",
        anonymous: !VIEWER.user?.id,
        source: "live-viewer.js"
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

function attachTrack(track, participant) {
  const media = track.attach();

  media.autoplay = true;
  media.playsInline = true;
  media.dataset.participant =
    participant?.identity || "host";

  media.className =
    track.kind === Track.Kind.Video
      ? "watch-video"
      : "watch-audio";

  VIEWER.tracks.push({
    track,
    participant,
    element: media,
    kind: track.kind
  });

  emitViewer();

  window.dispatchEvent(
    new CustomEvent("rb-live-track-attached", {
      detail: {
        track,
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
      detail: { track }
    })
  );
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
  emitViewer();

  try {
    await initLiveAccess({
      stream: VIEWER.stream,
      user: VIEWER.user,
      profile: VIEWER.profile
    });

    const allowed = await canWatchLiveStream();

    if (!allowed.allowed) {
      throw new Error(
        allowed.reason || "Unlock required before watching."
      );
    }

    const presence = await joinLivePresence({
      role: "viewer",
      anonymousId: VIEWER.user?.id ? null : anonymousId()
    });

    VIEWER.viewSession = presence.session || null;

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

    room.on(RoomEvent.Disconnected, async () => {
      VIEWER.joined = false;
      VIEWER.connecting = false;

      await leaveLivePresence({
        sessionId: VIEWER.viewSession?.id || null
      });

      VIEWER.viewSession = null;
      emitViewer();
    });

    await room.connect(tokenData.url, tokenData.token);

    VIEWER.joined = true;
    VIEWER.connecting = false;

    emitViewer();

    return getLiveViewerState();
  } catch (error) {
    VIEWER.connecting = false;
    VIEWER.joined = false;

    if (VIEWER.viewSession?.id) {
      await leaveLivePresence({
        sessionId: VIEWER.viewSession.id
      });
    }

    VIEWER.viewSession = null;

    emitViewer();

    throw error;
  }
}

export async function leaveLiveViewer() {
  if (VIEWER.room) {
    VIEWER.room.disconnect();
    VIEWER.room = null;
  }

  VIEWER.tracks.forEach((item) => {
    try {
      item.track.detach().forEach((el) => el.remove());
    } catch {}
  });

  VIEWER.tracks = [];

  if (VIEWER.viewSession?.id) {
    await leaveLivePresence({
      sessionId: VIEWER.viewSession.id
    });
  }

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
  profile = null
} = {}) {
  VIEWER.stream = stream || null;
  VIEWER.user = user || null;
  VIEWER.profile = profile || null;

  VIEWER.joined = false;
  VIEWER.connecting = false;
  VIEWER.tracks = [];

  emitViewer();

  return getLiveViewerState();
}

window.addEventListener("beforeunload", () => {
  leaveLiveViewer();
});

console.log("RB LIVE VIEWER READY");
