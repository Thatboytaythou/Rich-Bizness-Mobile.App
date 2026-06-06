/* =========================
   RICH BIZNESS MOBILE
   /core/features/music/music-state.js

   MUSIC STATE ENGINE
   Tracks + Podcast + Radio
   State only, no Supabase, no DOM
========================= */

const MUSIC_STATE = {
  ready: false,
  loading: false,

  activeTab: "tracks",
  activeType: "track",

  tracks: [],
  podcasts: [],
  radioStations: [],

  current: null,
  currentType: null,
  playing: false,

  likedTrackIds: new Set(),
  likedPodcastIds: new Set(),
  likedRadioIds: new Set(),

  counts: {
    tracks: 0,
    podcasts: 0,
    radio: 0,
    likes: 0
  },

  error: null,
  listeners: new Set()
};

function normalizeError(error = null) {
  if (!error) return null;

  return {
    message: error?.message || String(error),
    code: error?.code || null,
    details: error?.details || null
  };
}

function cloneSet(set) {
  return Array.from(set || []);
}

function getItemsByType(type = "track") {
  if (type === "podcast") return MUSIC_STATE.podcasts;
  if (type === "radio") return MUSIC_STATE.radioStations;
  return MUSIC_STATE.tracks;
}

function setItemsByType(type = "track", items = []) {
  if (type === "podcast") {
    MUSIC_STATE.podcasts = Array.isArray(items) ? items : [];
    MUSIC_STATE.counts.podcasts = MUSIC_STATE.podcasts.length;
    return;
  }

  if (type === "radio") {
    MUSIC_STATE.radioStations = Array.isArray(items) ? items : [];
    MUSIC_STATE.counts.radio = MUSIC_STATE.radioStations.length;
    return;
  }

  MUSIC_STATE.tracks = Array.isArray(items) ? items : [];
  MUSIC_STATE.counts.tracks = MUSIC_STATE.tracks.length;
}

function getLikedSetByType(type = "track") {
  if (type === "podcast") return MUSIC_STATE.likedPodcastIds;
  if (type === "radio") return MUSIC_STATE.likedRadioIds;
  return MUSIC_STATE.likedTrackIds;
}

function emitMusicState() {
  const state = getMusicState();

  MUSIC_STATE.listeners.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
      console.warn("[RB MUSIC STATE LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:music-state", {
      detail: state
    })
  );
}

export function getMusicState() {
  return {
    ready: MUSIC_STATE.ready,
    loading: MUSIC_STATE.loading,

    activeTab: MUSIC_STATE.activeTab,
    activeType: MUSIC_STATE.activeType,

    tracks: [...MUSIC_STATE.tracks],
    podcasts: [...MUSIC_STATE.podcasts],
    radioStations: [...MUSIC_STATE.radioStations],

    current: MUSIC_STATE.current ? { ...MUSIC_STATE.current } : null,
    currentType: MUSIC_STATE.currentType,
    playing: MUSIC_STATE.playing,

    likedTrackIds: cloneSet(MUSIC_STATE.likedTrackIds),
    likedPodcastIds: cloneSet(MUSIC_STATE.likedPodcastIds),
    likedRadioIds: cloneSet(MUSIC_STATE.likedRadioIds),

    counts: { ...MUSIC_STATE.counts },

    error: MUSIC_STATE.error ? { ...MUSIC_STATE.error } : null
  };
}

export function onMusicState(callback) {
  if (typeof callback !== "function") return () => {};

  MUSIC_STATE.listeners.add(callback);

  try {
    callback(getMusicState());
  } catch (error) {
    console.warn("[RB MUSIC STATE LISTENER ERROR]", error);
  }

  return () => {
    MUSIC_STATE.listeners.delete(callback);
  };
}

export function setMusicReady(value = true) {
  MUSIC_STATE.ready = Boolean(value);
  emitMusicState();
}

export function setMusicLoading(value = true) {
  MUSIC_STATE.loading = Boolean(value);

  if (MUSIC_STATE.loading) {
    MUSIC_STATE.error = null;
  }

  emitMusicState();
}

export function setMusicError(error = null) {
  MUSIC_STATE.error = normalizeError(error);
  MUSIC_STATE.loading = false;
  emitMusicState();
}

export function setActiveMusicTab(tab = "tracks") {
  const clean = String(tab || "tracks").toLowerCase();

  const map = {
    track: "tracks",
    tracks: "tracks",
    music: "tracks",
    podcast: "podcasts",
    podcasts: "podcasts",
    radio: "radio",
    stations: "radio"
  };

  MUSIC_STATE.activeTab = map[clean] || "tracks";

  MUSIC_STATE.activeType =
    MUSIC_STATE.activeTab === "podcasts"
      ? "podcast"
      : MUSIC_STATE.activeTab === "radio"
        ? "radio"
        : "track";

  emitMusicState();
}

export function setTracks(tracks = []) {
  setItemsByType("track", tracks);
  MUSIC_STATE.ready = true;
  MUSIC_STATE.loading = false;
  MUSIC_STATE.error = null;
  emitMusicState();
}

export function setPodcasts(podcasts = []) {
  setItemsByType("podcast", podcasts);
  MUSIC_STATE.ready = true;
  MUSIC_STATE.loading = false;
  MUSIC_STATE.error = null;
  emitMusicState();
}

export function setRadioStations(stations = []) {
  setItemsByType("radio", stations);
  MUSIC_STATE.ready = true;
  MUSIC_STATE.loading = false;
  MUSIC_STATE.error = null;
  emitMusicState();
}

export function setMusicCollections({
  tracks = MUSIC_STATE.tracks,
  podcasts = MUSIC_STATE.podcasts,
  radioStations = MUSIC_STATE.radioStations
} = {}) {
  setItemsByType("track", tracks);
  setItemsByType("podcast", podcasts);
  setItemsByType("radio", radioStations);

  MUSIC_STATE.ready = true;
  MUSIC_STATE.loading = false;
  MUSIC_STATE.error = null;

  emitMusicState();
}

export function upsertMusicItem(item = {}, type = "track") {
  if (!item?.id) return;

  const list = getItemsByType(type);
  const index = list.findIndex((entry) => entry.id === item.id);

  if (index >= 0) {
    list[index] = {
      ...list[index],
      ...item
    };
  } else {
    list.unshift(item);
  }

  setItemsByType(type, list);
  emitMusicState();
}

export function removeMusicItem(id, type = "track") {
  if (!id) return;

  const list = getItemsByType(type).filter((item) => item.id !== id);

  setItemsByType(type, list);

  if (MUSIC_STATE.current?.id === id && MUSIC_STATE.currentType === type) {
    MUSIC_STATE.current = null;
    MUSIC_STATE.currentType = null;
    MUSIC_STATE.playing = false;
  }

  emitMusicState();
}

export function setNowPlaying(item = null, type = "track") {
  MUSIC_STATE.current = item || null;
  MUSIC_STATE.currentType = item ? type : null;
  MUSIC_STATE.playing = Boolean(item);

  emitMusicState();
}

export function clearNowPlaying() {
  MUSIC_STATE.current = null;
  MUSIC_STATE.currentType = null;
  MUSIC_STATE.playing = false;

  emitMusicState();
}

export function setMusicPlaying(value = true) {
  MUSIC_STATE.playing = Boolean(value);
  emitMusicState();
}

export function setLikedIds({
  type = "track",
  ids = []
} = {}) {
  const likedSet = getLikedSetByType(type);

  likedSet.clear();

  ids.forEach((id) => {
    if (id) likedSet.add(id);
  });

  MUSIC_STATE.counts.likes =
    MUSIC_STATE.likedTrackIds.size +
    MUSIC_STATE.likedPodcastIds.size +
    MUSIC_STATE.likedRadioIds.size;

  emitMusicState();
}

export function setLiked(type = "track", id = "", liked = true) {
  if (!id) return;

  const likedSet = getLikedSetByType(type);

  if (liked) {
    likedSet.add(id);
  } else {
    likedSet.delete(id);
  }

  MUSIC_STATE.counts.likes =
    MUSIC_STATE.likedTrackIds.size +
    MUSIC_STATE.likedPodcastIds.size +
    MUSIC_STATE.likedRadioIds.size;

  emitMusicState();
}

export function isMusicItemLiked(type = "track", id = "") {
  if (!id) return false;
  return getLikedSetByType(type).has(id);
}

export function resetMusicState() {
  MUSIC_STATE.ready = false;
  MUSIC_STATE.loading = false;

  MUSIC_STATE.activeTab = "tracks";
  MUSIC_STATE.activeType = "track";

  MUSIC_STATE.tracks = [];
  MUSIC_STATE.podcasts = [];
  MUSIC_STATE.radioStations = [];

  MUSIC_STATE.current = null;
  MUSIC_STATE.currentType = null;
  MUSIC_STATE.playing = false;

  MUSIC_STATE.likedTrackIds.clear();
  MUSIC_STATE.likedPodcastIds.clear();
  MUSIC_STATE.likedRadioIds.clear();

  MUSIC_STATE.counts = {
    tracks: 0,
    podcasts: 0,
    radio: 0,
    likes: 0
  };

  MUSIC_STATE.error = null;

  emitMusicState();
}

export function bindMusicShell({
  tabSelector = "[data-music-tab]",
  sectionTitleSelector = "[data-music-section-title]",
  countSelector = "[data-music-count]",
  nowTitleSelector = "[data-music-now-title]",
  nowMetaSelector = "[data-music-now-meta]",
  nowCoverSelector = "[data-music-now-cover]"
} = {}) {
  return onMusicState((state) => {
    document.querySelectorAll(tabSelector).forEach((tab) => {
      const key = tab.dataset.musicTab;
      tab.classList.toggle(
        "is-active",
        key === state.activeTab || key === state.activeType
      );
    });

    document.querySelectorAll(sectionTitleSelector).forEach((el) => {
      el.textContent =
        state.activeType === "podcast"
          ? "Podcast Episodes"
          : state.activeType === "radio"
            ? "Radio Stations"
            : "Music Tracks";
    });

    document.querySelectorAll(countSelector).forEach((el) => {
      const count =
        state.activeType === "podcast"
          ? state.counts.podcasts
          : state.activeType === "radio"
            ? state.counts.radio
            : state.counts.tracks;

      el.textContent = `${count}`;
    });

    document.querySelectorAll(nowTitleSelector).forEach((el) => {
      el.textContent =
        state.current?.title ||
        state.current?.name ||
        "Nothing Playing";
    });

    document.querySelectorAll(nowMetaSelector).forEach((el) => {
      el.textContent =
        state.current?.artist ||
        state.current?.creator_name ||
        state.current?.genre ||
        state.currentType ||
        "Rich Bizness Audio";
    });

    document.querySelectorAll(nowCoverSelector).forEach((el) => {
      const cover =
        state.current?.cover_url ||
        state.current?.image_url ||
        "/images/brand/hero-banner.png";

      if (el.tagName === "IMG") {
        el.src = cover;
      } else {
        el.style.backgroundImage = `url("${cover}")`;
      }
    });
  });
}

console.log("RB MUSIC STATE READY");
