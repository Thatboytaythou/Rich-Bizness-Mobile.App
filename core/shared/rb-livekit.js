/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-livekit.js
========================= */

import {
  Room,
  RoomEvent,
  Track,
  VideoPresets
} from "https://esm.sh/livekit-client@2";

let activeRoom = null;

export const LIVEKIT_CONFIG = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution
  },
  publishDefaults: {
    simulcast: true
  }
};

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
  const response = await fetch("/api/livekit-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      roomName: roomName || room,
      room: room || roomName,
      identity,
      userId,
      name: name || participantName,
      participantName,
      role,
      metadata
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Token request failed");
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

  const token = tokenData.token || tokenData.accessToken;
  const url = tokenData.url || tokenData.livekitUrl || tokenData.wsUrl;

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
  if (!activeRoom) return;
  await activeRoom.localParticipant.setCameraEnabled(false);
}

export async function disableMic() {
  if (!activeRoom) return;
  await activeRoom.localParticipant.setMicrophoneEnabled(false);
}

export async function enableCamera() {
  if (!activeRoom) return;
  await activeRoom.localParticipant.setCameraEnabled(true);
}

export async function enableMic() {
  if (!activeRoom) return;
  await activeRoom.localParticipant.setMicrophoneEnabled(true);
}

export async function startScreenShare() {
  if (!activeRoom) return;
  await activeRoom.localParticipant.setScreenShareEnabled(true);
}

export async function stopScreenShare() {
  if (!activeRoom) return;
  await activeRoom.localParticipant.setScreenShareEnabled(false);
}

export async function disconnectRoom() {
  if (!activeRoom) return;

  await activeRoom.disconnect();
  activeRoom = null;
}

export function getParticipants() {
  if (!activeRoom) return [];
  return Array.from(activeRoom.remoteParticipants.values());
}

export function attachTrack(track, element) {
  if (!track || !element) return;
  track.attach(element);
}

export function detachTrack(track) {
  if (!track) return;
  track.detach().forEach((el) => el.remove());
}

export function bindRoomEvents({
  onParticipantConnected,
  onParticipantDisconnected,
  onTrackSubscribed,
  onTrackUnsubscribed,
  onDisconnected
} = {}) {
  if (!activeRoom) return;

  if (typeof onParticipantConnected === "function") {
    activeRoom.on(RoomEvent.ParticipantConnected, onParticipantConnected);
  }

  if (typeof onParticipantDisconnected === "function") {
    activeRoom.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
  }

  if (typeof onTrackSubscribed === "function") {
    activeRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      onTrackSubscribed({ track, publication, participant });
    });
  }

  if (typeof onTrackUnsubscribed === "function") {
    activeRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      onTrackUnsubscribed({ track, publication, participant });
    });
  }

  if (typeof onDisconnected === "function") {
    activeRoom.on(RoomEvent.Disconnected, onDisconnected);
  }
}

export {
  Room,
  RoomEvent,
  Track
};

console.log("RB LIVEKIT CORE READY");
