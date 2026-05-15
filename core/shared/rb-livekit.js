/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-livekit.js

   LIVEKIT CLIENT CORE
========================= */

import {
  Room,
  RoomEvent,
  Track,
  VideoPresets
} from "https://esm.sh/livekit-client";

/* =========================
   CONFIG
========================= */
export const LIVEKIT_CONFIG = {
  url:
    window.LIVEKIT_URL ||
    "",

  adaptiveStream: true,
  dynacast: true,

  videoCaptureDefaults: {
    resolution:
      VideoPresets.h720.resolution
  },

  publishDefaults: {
    simulcast: true
  }
};

/* =========================
   ROOM
========================= */
let activeRoom = null;

/* =========================
   CREATE ROOM
========================= */
export async function createRoom() {
  if (activeRoom) {
    return activeRoom;
  }

  activeRoom = new Room({
    adaptiveStream:
      LIVEKIT_CONFIG.adaptiveStream,

    dynacast:
      LIVEKIT_CONFIG.dynacast,

    videoCaptureDefaults:
      LIVEKIT_CONFIG.videoCaptureDefaults,

    publishDefaults:
      LIVEKIT_CONFIG.publishDefaults
  });

  return activeRoom;
}

/* =========================
   GET ROOM
========================= */
export function getRoom() {
  return activeRoom;
}

/* =========================
   TOKEN REQUEST
========================= */
export async function requestLiveKitToken({
  roomName,
  participantName,
  metadata = {}
}) {
  const response = await fetch(
    "/api/livekit-token",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        roomName,
        participantName,
        metadata
      })
    }
  );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error ||
      "Token request failed"
    );
  }

  return data;
}

/* =========================
   CONNECT
========================= */
export async function connectToRoom({
  roomName,
  participantName,
  metadata = {}
}) {
  const room =
    await createRoom();

  const tokenData =
    await requestLiveKitToken({
      roomName,
      participantName,
      metadata
    });

  await room.connect(
    LIVEKIT_CONFIG.url,
    tokenData.token
  );

  return room;
}

/* =========================
   CAMERA + MIC
========================= */
export async function enableCameraAndMic() {
  if (!activeRoom) return;

  await activeRoom.localParticipant
    .enableCameraAndMicrophone(
      true,
      true
    );
}

/* =========================
   DISABLE CAMERA
========================= */
export async function disableCamera() {
  if (!activeRoom) return;

  await activeRoom.localParticipant
    .setCameraEnabled(false);
}

/* =========================
   DISABLE MIC
========================= */
export async function disableMic() {
  if (!activeRoom) return;

  await activeRoom.localParticipant
    .setMicrophoneEnabled(false);
}

/* =========================
   ENABLE CAMERA
========================= */
export async function enableCamera() {
  if (!activeRoom) return;

  await activeRoom.localParticipant
    .setCameraEnabled(true);
}

/* =========================
   ENABLE MIC
========================= */
export async function enableMic() {
  if (!activeRoom) return;

  await activeRoom.localParticipant
    .setMicrophoneEnabled(true);
}

/* =========================
   SCREEN SHARE
========================= */
export async function startScreenShare() {
  if (!activeRoom) return;

  await activeRoom.localParticipant
    .setScreenShareEnabled(true);
}

/* =========================
   STOP SCREEN SHARE
========================= */
export async function stopScreenShare() {
  if (!activeRoom) return;

  await activeRoom.localParticipant
    .setScreenShareEnabled(false);
}

/* =========================
   DISCONNECT
========================= */
export async function disconnectRoom() {
  if (!activeRoom) return;

  await activeRoom.disconnect();

  activeRoom = null;
}

/* =========================
   PARTICIPANTS
========================= */
export function getParticipants() {
  if (!activeRoom) return [];

  return Array.from(
    activeRoom.remoteParticipants.values()
  );
}

/* =========================
   TRACK ATTACH
========================= */
export function attachTrack(
  track,
  element
) {
  if (!track || !element) return;

  track.attach(element);
}

/* =========================
   TRACK DETACH
========================= */
export function detachTrack(
  track,
  element
) {
  if (!track || !element) return;

  track.detach(element);
}

/* =========================
   ROOM EVENTS
========================= */
export function bindRoomEvents({
  onParticipantConnected,
  onParticipantDisconnected,
  onTrackSubscribed,
  onDisconnected
}) {
  if (!activeRoom) return;

  if (
    typeof onParticipantConnected ===
    "function"
  ) {
    activeRoom.on(
      RoomEvent.ParticipantConnected,
      onParticipantConnected
    );
  }

  if (
    typeof onParticipantDisconnected ===
    "function"
  ) {
    activeRoom.on(
      RoomEvent.ParticipantDisconnected,
      onParticipantDisconnected
    );
  }

  if (
    typeof onTrackSubscribed ===
    "function"
  ) {
    activeRoom.on(
      RoomEvent.TrackSubscribed,
      (
        track,
        publication,
        participant
      ) => {
        onTrackSubscribed({
          track,
          publication,
          participant
        });
      }
    );
  }

  if (
    typeof onDisconnected ===
    "function"
  ) {
    activeRoom.on(
      RoomEvent.Disconnected,
      onDisconnected
    );
  }
}
