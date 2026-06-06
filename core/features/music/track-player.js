/* =========================
   RICH BIZNESS MOBILE
   /core/features/music/track-player.js

   TRACK PLAYER ENGINE
   Audio element control + now playing sync
   No Supabase, no table writes
========================= */

import {
  setNowPlaying,
  clearNowPlaying,
  setMusicPlaying,
  getMusicState
} from "/core/features/music/music-state.js";

const PLAYER_STATE = {
  audio: null,
  mounted: false,
  current: null,
  currentType: "track",
  volume: 1,
  muted: false,
  repeat: false,
  shuffle: false,
  queue: [],
  queueIndex: -1,
  listeners: new Set()
};

function $(target) {
  return typeof target === "string"
    ? document.querySelector(target)
    : target;
}

function emitPlayerState() {
  const state = getTrackPlayerState();

  PLAYER_STATE.listeners.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
      console.warn("[RB TRACK PLAYER LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:track-player", {
      detail: state
    })
  );
}

function normalizeAudioUrl(item = {}) {
  return (
    item.audio_url ||
    item.stream_url ||
    item.file_url ||
    item.media_url ||
    item.url ||
    ""
  );
}

function normalizeTitle(item = {}) {
  return item.title || item.name || "Untitled Track";
}

function normalizeArtist(item = {}) {
  return (
    item.artist ||
    item.artist_name ||
    item.creator_name ||
    item.display_name ||
    item.username ||
    "Rich Bizness"
  );
}

function paintNowPlayingDom(item = null, type = "track") {
  const title = item ? normalizeTitle(item) : "Nothing Playing";
  const meta = item ? normalizeArtist(item) : "Rich Bizness Audio";
  const cover =
    item?.cover_url ||
    item?.image_url ||
    item?.thumbnail_url ||
    "/images/brand/hero-banner.png";

  document.querySelectorAll("[data-music-now-title], #nowTitle").forEach((el) => {
    el.textContent = title;
  });

  document.querySelectorAll("[data-music-now-meta], #nowMeta").forEach((el) => {
    el.textContent = item ? `${meta} • ${type}` : meta;
  });

  document.querySelectorAll("[data-music-now-cover], #nowCover").forEach((el) => {
    if (el.tagName === "IMG") {
      el.src = cover;
      el.alt = title;
    } else {
      el.style.backgroundImage = `url("${cover}")`;
    }
  });
}

function bindAudioEvents(audio) {
  if (!audio || audio.dataset.rbTrackPlayerBound === "true") return;

  audio.dataset.rbTrackPlayerBound = "true";

  audio.addEventListener("play", () => {
    setMusicPlaying(true);
    emitPlayerState();
  });

  audio.addEventListener("pause", () => {
    setMusicPlaying(false);
    emitPlayerState();
  });

  audio.addEventListener("ended", () => {
    setMusicPlaying(false);

    if (PLAYER_STATE.repeat) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    playNext();
  });

  audio.addEventListener("timeupdate", emitPlayerState);
  audio.addEventListener("volumechange", () => {
    PLAYER_STATE.volume = audio.volume;
    PLAYER_STATE.muted = audio.muted;
    emitPlayerState();
  });

  audio.addEventListener("error", () => {
    window.dispatchEvent(
      new CustomEvent("rb:track-player-error", {
        detail: {
          item: PLAYER_STATE.current,
          type: PLAYER_STATE.currentType,
          error: audio.error
        }
      })
    );
  });
}

/* =========================
   INIT
========================= */

export function mountTrackPlayer({
  audio = "#audioPlayer"
} = {}) {
  const audioEl = $(audio) || document.querySelector("audio");

  if (!audioEl) {
    console.warn("[RB TRACK PLAYER] Audio element not found.");
    return null;
  }

  PLAYER_STATE.audio = audioEl;
  PLAYER_STATE.mounted = true;

  audioEl.volume = PLAYER_STATE.volume;
  audioEl.muted = PLAYER_STATE.muted;

  bindAudioEvents(audioEl);

  document.body.classList.add("rb-track-player-ready");

  console.log("RB TRACK PLAYER READY");

  return audioEl;
}

export function getAudioElement() {
  return PLAYER_STATE.audio;
}

export function getTrackPlayerState() {
  const audio = PLAYER_STATE.audio;

  return {
    mounted: PLAYER_STATE.mounted,
    current: PLAYER_STATE.current ? { ...PLAYER_STATE.current } : null,
    currentType: PLAYER_STATE.currentType,
    playing: audio ? !audio.paused : false,
    duration: Number(audio?.duration || 0),
    currentTime: Number(audio?.currentTime || 0),
    progress:
      audio?.duration
        ? Math.round((audio.currentTime / audio.duration) * 100)
        : 0,
    volume: PLAYER_STATE.volume,
    muted: PLAYER_STATE.muted,
    repeat: PLAYER_STATE.repeat,
    shuffle: PLAYER_STATE.shuffle,
    queue: [...PLAYER_STATE.queue],
    queueIndex: PLAYER_STATE.queueIndex
  };
}

export function onTrackPlayer(callback) {
  if (typeof callback !== "function") return () => {};

  PLAYER_STATE.listeners.add(callback);

  try {
    callback(getTrackPlayerState());
  } catch (error) {
    console.warn("[RB TRACK PLAYER LISTENER ERROR]", error);
  }

  return () => {
    PLAYER_STATE.listeners.delete(callback);
  };
}

/* =========================
   QUEUE
========================= */

export function setQueue(items = [], startIndex = 0) {
  PLAYER_STATE.queue = Array.isArray(items) ? [...items] : [];
  PLAYER_STATE.queueIndex = Math.max(0, Number(startIndex || 0));

  emitPlayerState();
}

export function clearQueue() {
  PLAYER_STATE.queue = [];
  PLAYER_STATE.queueIndex = -1;

  emitPlayerState();
}

export function getQueueItem(index = PLAYER_STATE.queueIndex) {
  return PLAYER_STATE.queue[index] || null;
}

export function addToQueue(item = {}) {
  if (!item?.id && !normalizeAudioUrl(item)) return;

  PLAYER_STATE.queue.push(item);
  emitPlayerState();
}

export function removeFromQueue(index = -1) {
  if (index < 0 || index >= PLAYER_STATE.queue.length) return;

  PLAYER_STATE.queue.splice(index, 1);

  if (PLAYER_STATE.queueIndex >= PLAYER_STATE.queue.length) {
    PLAYER_STATE.queueIndex = PLAYER_STATE.queue.length - 1;
  }

  emitPlayerState();
}

/* =========================
   PLAYBACK
========================= */

export async function playTrack(item = {}, {
  type = "track",
  queue = null,
  index = null,
  autoplay = true
} = {}) {
  const audio = PLAYER_STATE.audio || mountTrackPlayer();

  if (!audio) {
    throw new Error("Audio player not mounted.");
  }

  const audioUrl = normalizeAudioUrl(item);

  if (!audioUrl) {
    throw new Error("Track has no audio URL.");
  }

  if (Array.isArray(queue)) {
    setQueue(queue, index ?? queue.findIndex((entry) => entry.id === item.id));
  } else if (index !== null) {
    PLAYER_STATE.queueIndex = Number(index);
  }

  PLAYER_STATE.current = item;
  PLAYER_STATE.currentType = type;

  audio.src = audioUrl;
  audio.load();

  setNowPlaying(item, type);
  paintNowPlayingDom(item, type);

  if (autoplay) {
    await audio.play();
  }

  emitPlayerState();

  window.dispatchEvent(
    new CustomEvent("rb:music-play", {
      detail: {
        item,
        type
      }
    })
  );

  return item;
}

export async function playCurrent() {
  const audio = PLAYER_STATE.audio || mountTrackPlayer();

  if (!audio) {
    throw new Error("Audio player not mounted.");
  }

  if (!audio.src && PLAYER_STATE.current) {
    audio.src = normalizeAudioUrl(PLAYER_STATE.current);
  }

  await audio.play();

  setMusicPlaying(true);
  emitPlayerState();
}

export function pauseTrack() {
  const audio = PLAYER_STATE.audio;

  if (!audio) return;

  audio.pause();
  setMusicPlaying(false);
  emitPlayerState();
}

export async function togglePlay() {
  const audio = PLAYER_STATE.audio || mountTrackPlayer();

  if (!audio) return;

  if (audio.paused) {
    await playCurrent();
  } else {
    pauseTrack();
  }
}

export function stopTrack() {
  const audio = PLAYER_STATE.audio;

  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute("src");
    audio.load();
  }

  PLAYER_STATE.current = null;
  PLAYER_STATE.currentType = null;

  clearNowPlaying();
  paintNowPlayingDom(null);

  emitPlayerState();
}

export async function playNext() {
  if (!PLAYER_STATE.queue.length) {
    pauseTrack();
    return null;
  }

  let nextIndex = PLAYER_STATE.queueIndex + 1;

  if (PLAYER_STATE.shuffle) {
    nextIndex = Math.floor(Math.random() * PLAYER_STATE.queue.length);
  }

  if (nextIndex >= PLAYER_STATE.queue.length) {
    nextIndex = 0;
  }

  PLAYER_STATE.queueIndex = nextIndex;

  const item = getQueueItem(nextIndex);

  if (!item) return null;

  return await playTrack(item, {
    type: PLAYER_STATE.currentType || "track",
    index: nextIndex,
    autoplay: true
  });
}

export async function playPrevious() {
  if (!PLAYER_STATE.queue.length) return null;

  let prevIndex = PLAYER_STATE.queueIndex - 1;

  if (prevIndex < 0) {
    prevIndex = PLAYER_STATE.queue.length - 1;
  }

  PLAYER_STATE.queueIndex = prevIndex;

  const item = getQueueItem(prevIndex);

  if (!item) return null;

  return await playTrack(item, {
    type: PLAYER_STATE.currentType || "track",
    index: prevIndex,
    autoplay: true
  });
}

/* =========================
   CONTROLS
========================= */

export function seekTo(seconds = 0) {
  const audio = PLAYER_STATE.audio;

  if (!audio) return;

  audio.currentTime = Math.max(0, Number(seconds || 0));
  emitPlayerState();
}

export function seekPercent(percent = 0) {
  const audio = PLAYER_STATE.audio;

  if (!audio?.duration) return;

  const clean = Math.max(0, Math.min(100, Number(percent || 0)));
  audio.currentTime = (clean / 100) * audio.duration;

  emitPlayerState();
}

export function setVolume(volume = 1) {
  const audio = PLAYER_STATE.audio;

  const clean = Math.max(0, Math.min(1, Number(volume)));

  PLAYER_STATE.volume = clean;

  if (audio) {
    audio.volume = clean;
  }

  emitPlayerState();
}

export function toggleMute(force = null) {
  const audio = PLAYER_STATE.audio;

  const next = force === null
    ? !PLAYER_STATE.muted
    : Boolean(force);

  PLAYER_STATE.muted = next;

  if (audio) {
    audio.muted = next;
  }

  emitPlayerState();

  return next;
}

export function toggleRepeat(force = null) {
  PLAYER_STATE.repeat =
    force === null ? !PLAYER_STATE.repeat : Boolean(force);

  emitPlayerState();

  return PLAYER_STATE.repeat;
}

export function toggleShuffle(force = null) {
  PLAYER_STATE.shuffle =
    force === null ? !PLAYER_STATE.shuffle : Boolean(force);

  emitPlayerState();

  return PLAYER_STATE.shuffle;
}

/* =========================
   UI BINDINGS
========================= */

export function bindTrackPlayerControls({
  playButton = "[data-music-play]",
  pauseButton = "[data-music-pause]",
  toggleButton = "[data-music-toggle]",
  nextButton = "[data-music-next]",
  prevButton = "[data-music-prev]",
  muteButton = "[data-music-mute]",
  repeatButton = "[data-music-repeat]",
  shuffleButton = "[data-music-shuffle]",
  progressInput = "[data-music-seek]",
  volumeInput = "[data-music-volume]"
} = {}) {
  document.querySelectorAll(playButton).forEach((btn) => {
    if (btn.dataset.rbMusicPlayBound === "true") return;
    btn.dataset.rbMusicPlayBound = "true";
    btn.addEventListener("click", () => playCurrent().catch(console.warn));
  });

  document.querySelectorAll(pauseButton).forEach((btn) => {
    if (btn.dataset.rbMusicPauseBound === "true") return;
    btn.dataset.rbMusicPauseBound = "true";
    btn.addEventListener("click", pauseTrack);
  });

  document.querySelectorAll(toggleButton).forEach((btn) => {
    if (btn.dataset.rbMusicToggleBound === "true") return;
    btn.dataset.rbMusicToggleBound = "true";
    btn.addEventListener("click", () => togglePlay().catch(console.warn));
  });

  document.querySelectorAll(nextButton).forEach((btn) => {
    if (btn.dataset.rbMusicNextBound === "true") return;
    btn.dataset.rbMusicNextBound = "true";
    btn.addEventListener("click", () => playNext().catch(console.warn));
  });

  document.querySelectorAll(prevButton).forEach((btn) => {
    if (btn.dataset.rbMusicPrevBound === "true") return;
    btn.dataset.rbMusicPrevBound = "true";
    btn.addEventListener("click", () => playPrevious().catch(console.warn));
  });

  document.querySelectorAll(muteButton).forEach((btn) => {
    if (btn.dataset.rbMusicMuteBound === "true") return;
    btn.dataset.rbMusicMuteBound = "true";
    btn.addEventListener("click", () => toggleMute());
  });

  document.querySelectorAll(repeatButton).forEach((btn) => {
    if (btn.dataset.rbMusicRepeatBound === "true") return;
    btn.dataset.rbMusicRepeatBound = "true";
    btn.addEventListener("click", () => toggleRepeat());
  });

  document.querySelectorAll(shuffleButton).forEach((btn) => {
    if (btn.dataset.rbMusicShuffleBound === "true") return;
    btn.dataset.rbMusicShuffleBound = "true";
    btn.addEventListener("click", () => toggleShuffle());
  });

  document.querySelectorAll(progressInput).forEach((input) => {
    if (input.dataset.rbMusicSeekBound === "true") return;
    input.dataset.rbMusicSeekBound = "true";

    input.addEventListener("input", () => {
      seekPercent(input.value);
    });
  });

  document.querySelectorAll(volumeInput).forEach((input) => {
    if (input.dataset.rbMusicVolumeBound === "true") return;
    input.dataset.rbMusicVolumeBound = "true";

    input.addEventListener("input", () => {
      setVolume(input.value);
    });
  });

  return onTrackPlayer((state) => {
    document.querySelectorAll(toggleButton).forEach((btn) => {
      btn.classList.toggle("is-playing", state.playing);
      btn.textContent = state.playing ? "Pause" : "Play";
    });

    document.querySelectorAll(progressInput).forEach((input) => {
      if (document.activeElement !== input) {
        input.value = state.progress || 0;
      }
    });

    document.querySelectorAll(volumeInput).forEach((input) => {
      if (document.activeElement !== input) {
        input.value = state.volume;
      }
    });

    document.querySelectorAll(muteButton).forEach((btn) => {
      btn.classList.toggle("is-muted", state.muted);
    });

    document.querySelectorAll(repeatButton).forEach((btn) => {
      btn.classList.toggle("is-active", state.repeat);
    });

    document.querySelectorAll(shuffleButton).forEach((btn) => {
      btn.classList.toggle("is-active", state.shuffle);
    });
  });
}

/* =========================
   BOOT
========================= */

export function bootTrackPlayer(options = {}) {
  mountTrackPlayer(options);
  bindTrackPlayerControls();

  const state = getMusicState();

  if (state.current) {
    paintNowPlayingDom(state.current, state.currentType || "track");
  }

  console.log("RB TRACK PLAYER BOOTED");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => bootTrackPlayer());
} else {
  bootTrackPlayer();
}
