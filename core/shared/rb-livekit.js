/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-livekit.js

   LIVEKIT CORE
   Room + Token + Tracks + Controls
========================= */

import {
  Room,
  RoomEvent,
  Track,
  VideoPresets
} from "https://esm.sh/livekit-client@2";

import {
  RB_LIVEKIT
} from "/core/shared/rb-config.js";

let activeRoom = null;
let boundRoom = null;

const roomCleanups = new Set();

export const LIVEKIT_CONFIG = Object.freeze({
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution
  },
  publishDefaults: {
    simulcast: true
  }
});

function cleanString(value = "") {
  return String(value || "").trim();
}

function getTokenEndpoint() {
  return "/api/livekit-token";
}

function rememberCleanup(fn) {
  if (typeof fn === "function") {
    roomCleanups.add(fn);
  }

  return () => {
    roomCleanups.delete(fn);
  };
}

function runRoomCleanups() {
  roomCleanups.forEach((fn) => {
    try {
      fn();
    } catch (error) {
      console.warn("[RB LIVEKIT CLEANUP WARNING]", error);
    }
  });

  roomCleanups.clear();
}

export async function createRoom() {
  if (activeRoom) return activeRoom;

  activeRoom = new Room({
    adaptiveStream: LIVEKIT_CONFIG.adaptiveStream,
    dynacast: LIVEKIT_CONFIG.dynacast,
    videoCaptureDefaults: LIVEKIT_CONFIG.videoCaptureDefaults,
    publishDefaults: LIVEKIT_CONFIG.publishDefaults
  });

  return activeRoom;
}

export function getRoom() {
  return activeRoom;
}

export function isRoomConnected() {
  return !!activeRoom?.state && activeRoom.state !== "disconnected";
}

export async function requestLiveKitToken({
  roomName,
  room,
  identity,
  userId,
  participantName,
  name,
  role = "viewer",
  metadata = {}
}) {
  const finalRoom = cleanString(roomName || room);
  const finalIdentity = cleanString(identity || userId);
  const finalName = cleanString(name || participantName || identity || userId);

  if (!finalRoom) {
    throw new Error("Missing LiveKit room name.");
  }

  const response = await fetch(getTokenEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      roomName: finalRoom,
      room: finalRoom,
      identity: finalIdentity,
      userId,
      name: finalName,
      participantName: finalName,
      role,
      metadata
    })
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data?.error || "Token request failed.");
  }

  return data;
}

export async function connectToRoom({
  roomName,
  room,
  identity,
  userId,
  participantName,
  name,
  role = "viewer",
  metadata = {}
}) {
  const active = await createRoom();

  if (isRoomConnected()) {
    return active;
  }

  const tokenData = await requestLiveKitToken({
    roomName,
    room,
    identity,
    userId,
    participantName,
    name,
    role,
    metadata
  });

  const token =
    tokenData.token ||
    tokenData.accessToken ||
    tokenData.jwt;

  const url =
    tokenData.url ||
    tokenData.livekitUrl ||
    tokenData.wsUrl ||
    RB_LIVEKIT?.url;

  if (!token || !url) {
    throw new Error("Missing LiveKit URL or token.");
  }

  await active.connect(url, token);

  return active;
}

export async function enableCameraAndMic() {
  if (!activeRoom) return null;

  await activeRoom.localParticipant.setCameraEnabled(true);
  await activeRoom.localParticipant.setMicrophoneEnabled(true);

  return activeRoom;
}

export async function disableCamera() {
  if (!activeRoom) return null;

  await activeRoom.localParticipant.setCameraEnabled(false);
  return activeRoom;
}

export async function disableMic() {
  if (!activeRoom) return null;

  await activeRoom.localParticipant.setMicrophoneEnabled(false);
  return activeRoom;
}

export async function enableCamera() {
  if (!activeRoom) return null;

  await activeRoom.localParticipant.setCameraEnabled(true);
  return activeRoom;
}

export async function enableMic() {
  if (!activeRoom) return null;

  await activeRoom.localParticipant.setMicrophoneEnabled(true);
  return activeRoom;
}

export async function toggleCamera(force = null) {
  if (!activeRoom) return false;

  const enabled =
    force === null
      ? !activeRoom.localParticipant.isCameraEnabled
      : Boolean(force);

  await activeRoom.localParticipant.setCameraEnabled(enabled);

  return enabled;
}

export async function toggleMic(force = null) {
  if (!activeRoom) return false;

  const enabled =
    force === null
      ? !activeRoom.localParticipant.isMicrophoneEnabled
      : Boolean(force);

  await activeRoom.localParticipant.setMicrophoneEnabled(enabled);

  return enabled;
}

export async function startScreenShare() {
  if (!activeRoom) return null;

  await activeRoom.localParticipant.setScreenShareEnabled(true);
  return activeRoom;
}

export async function stopScreenShare() {
  if (!activeRoom) return null;

  await activeRoom.localParticipant.setScreenShareEnabled(false);
  return activeRoom;
}

export async function toggleScreenShare(force = null) {
  if (!activeRoom) return false;

  const enabled =
    force === null
      ? !activeRoom.localParticipant.isScreenShareEnabled
      : Boolean(force);

  await activeRoom.localParticipant.setScreenShareEnabled(enabled);

  return enabled;
}

export async function disconnectRoom() {
  if (!activeRoom) return;

  runRoomCleanups();

  try {
    await activeRoom.disconnect();
  } finally {
    activeRoom = null;
    boundRoom = null;
  }
}

export function getParticipants() {
  if (!activeRoom) return [];
  return Array.from(activeRoom.remoteParticipants.values());
}

export function getLocalParticipant() {
  return activeRoom?.localParticipant || null;
}

export function attachTrack(track, element) {
  if (!track || !element) return null;

  return track.attach(element);
}

export function detachTrack(track) {
  if (!track) return;

  track.detach().forEach((el) => {
    el.remove();
  });
}

export function attachPublication(publication, element) {
  if (!publication?.track || !element) return null;

  return attachTrack(publication.track, element);
}

export function detachPublication(publication) {
  if (!publication?.track) return;

  detachTrack(publication.track);
}

export function bindRoomEvents({
  onParticipantConnected,
  onParticipantDisconnected,
  onTrackSubscribed,
  onTrackUnsubscribed,
  onLocalTrackPublished,
  onLocalTrackUnpublished,
  onDisconnected,
  onConnectionStateChanged
} = {}) {
  if (!activeRoom) return () => {};

  if (boundRoom === activeRoom) {
    runRoomCleanups();
  }

  boundRoom = activeRoom;

  const bindings = [
    [
      RoomEvent.ParticipantConnected,
      onParticipantConnected
    ],
    [
      RoomEvent.ParticipantDisconnected,
      onParticipantDisconnected
    ],
    [
      RoomEvent.LocalTrackPublished,
      onLocalTrackPublished
    ],
    [
      RoomEvent.LocalTrackUnpublished,
      onLocalTrackUnpublished
    ],
    [
      RoomEvent.Disconnected,
      onDisconnected
    ],
    [
      RoomEvent.ConnectionStateChanged,
      onConnectionStateChanged
    ]
  ];

  bindings.forEach(([eventName, handler]) => {
    if (typeof handler !== "function") return;

    activeRoom.on(eventName, handler);

    rememberCleanup(() => {
      activeRoom?.off?.(eventName, handler);
    });
  });

  if (typeof onTrackSubscribed === "function") {
    const handler = (track, publication, participant) => {
      onTrackSubscribed({
        track,
        publication,
        participant
      });
    };

    activeRoom.on(RoomEvent.TrackSubscribed, handler);

    rememberCleanup(() => {
      activeRoom?.off?.(RoomEvent.TrackSubscribed, handler);
    });
  }

  if (typeof onTrackUnsubscribed === "function") {
    const handler = (track, publication, participant) => {
      onTrackUnsubscribed({
        track,
        publication,
        participant
      });
    };

    activeRoom.on(RoomEvent.TrackUnsubscribed, handler);

    rememberCleanup(() => {
      activeRoom?.off?.(RoomEvent.TrackUnsubscribed, handler);
    });
  }

  return () => {
    runRoomCleanups();
  };
}

export function renderParticipantTracks({
  participant,
  container,
  includeAudio = true,
  includeVideo = true
}) {
  if (!participant || !container) return;

  participant.trackPublications.forEach((publication) => {
    const track = publication.track;
    if (!track) return;

    if (track.kind === Track.Kind.Video && includeVideo) {
      const el = track.attach();
      el.playsInline = true;
      container.appendChild(el);
    }

    if (track.kind === Track.Kind.Audio && includeAudio) {
      const el = track.attach();
      container.appendChild(el);
    }
  });
}

window.addEventListener("beforeunload", () => {
  disconnectRoom();
});

export {
  Room,
  RoomEvent,
  Track
};

console.log("RB LIVEKIT CORE READY");
