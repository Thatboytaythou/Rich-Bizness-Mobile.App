/* =========================
   RICH BIZNESS MOBILE
   /core/pages/music.js

   MUSIC PAGE CONTROLLER
   Direct Supabase Music Engine
   Tracks + Podcast + Radio + Playlists
   Profile Keys Locked
   Realtime Enabled

   Flow:
   - No feature-engine dependency
   - Reads music_tracks / podcast_episodes / radio_stations / playlists
   - Plays real audio through page audio player
   - Profile lock stays tied to profiles
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

import {
  RB_TABLES,
  RB_ROUTES,
  RB_PROFILE_KEYS
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  getUser
} from "/core/shared/rb-auth.js";

import {
  getProfileIdentity,
  bindProfileShell,
  buildProfileUrl
} from "/core/shared/rb-profile.js";

const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const FALLBACK_COVER = "/images/brand/hero-banner.png";

const els = {
  nowCover: $("music-now-cover"),
  nowType: $("music-now-type"),
  nowTitle: $("music-now-title"),
  nowMeta: $("music-now-meta"),
  audioPlayer: $("music-audio-player"),

  trackCount: $("music-track-count"),
  podcastCount: $("music-podcast-count"),
  radioCount: $("music-radio-count"),

  tracksList: $("music-tracks-list"),
  podcastsList: $("music-podcasts-list"),
  radioList: $("music-radio-list"),
  playlistsList: $("music-playlists-list")
};

let supabase = null;
let pageBooted = false;
let currentUser = null;
let currentProfile = null;
let profileIdentity = null;
let channels = [];

const musicState = {
  tracks: [],
  podcasts: [],
  radioStations: [],
  playlists: [],
  nowPlaying: null
};

function table(key, fallback) {
  return RB_TABLES?.[key] || fallback || key;
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeText(value, fallback = "") {
  return String(value || fallback || "").trim();
}

function safeUrl(value = "", fallback = "") {
  const url = String(value || "").trim();

  if (!url) return fallback;

  if (
    url.startsWith("/") ||
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("blob:")
  ) {
    return url;
  }

  return fallback;
}

function setText(el, value) {
  if (el) el.textContent = value ?? "";
}

function setEmpty(target, text) {
  if (!target) return;

  target.innerHTML = `<p class="rb-empty">${escapeHtml(text)}</p>`;
}

function moneyDate(date) {
  if (!date) return "Just dropped";

  try {
    return new Date(date).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return "Just dropped";
  }
}

function creatorLine(item = {}) {
  return (
    item.artist ||
    item.artist_name ||
    item.creator_name ||
    item.display_name ||
    item.username ||
    "Rich Bizness Creator"
  );
}

function coverOf(item = {}) {
  return safeUrl(
    item.cover_url ||
      item.image_url ||
      item.thumbnail_url ||
      item.show?.cover_url,
    FALLBACK_COVER
  );
}

function audioOf(item = {}) {
  return safeUrl(
    item.audio_url ||
      item.stream_url ||
      item.file_url ||
      item.media_url ||
      item.url,
    ""
  );
}

function titleOf(item = {}, fallback = "Untitled") {
  return item.title || item.name || item.station_name || fallback;
}

/* =========================
   PROFILE LOCK
========================= */

function syncProfileKeys() {
  const state = getCurrentUserState?.() || {};

  currentUser = state.user || getUser?.() || null;
  currentProfile = state.profile || null;
  profileIdentity = getProfileIdentity(currentProfile);

  document.body.dataset.rbRoute = "music";
  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = profileIdentity?.id || "";
  document.body.dataset.rbProfileLocked = profileIdentity?.id ? "true" : "false";

  bindProfileShell?.();

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl(currentProfile);
  });
}

/* =========================
   TABS
========================= */

function setActiveMusicTab(tab = "tracks") {
  $$("[data-music-tab]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.musicTab === tab);
  });

  $$("[data-music-panel]").forEach((panel) => {
    const active = panel.dataset.musicPanel === tab;
    panel.classList.toggle("is-active", active);
    panel.style.display = active ? "" : "none";
  });

  document.body.dataset.musicTab = tab;
}

function bindTabs() {
  $$("[data-music-tab]").forEach((button) => {
    if (button.dataset.rbMusicTabBound === "true") return;

    button.dataset.rbMusicTabBound = "true";

    button.addEventListener("click", () => {
      setActiveMusicTab(button.dataset.musicTab || "tracks");
    });
  });
}

/* =========================
   PLAYER
========================= */

function updateNowPlaying(item = {}, type = "track") {
  const label =
    type === "podcast"
      ? "PODCAST"
      : type === "radio"
        ? "RADIO"
        : "TRACK";

  const title = titleOf(item);
  const cover = coverOf(item);
  const meta = [
    creatorLine(item),
    item.genre || item.category || item.mood || "",
    moneyDate(item.created_at)
  ].filter(Boolean).join(" • ");

  musicState.nowPlaying = {
    item,
    type
  };

  setText(els.nowType, label);
  setText(els.nowTitle, title);
  setText(els.nowMeta, meta);

  if (els.nowCover) {
    els.nowCover.src = cover;
    els.nowCover.alt = title;
  }
}

async function playMusicItem(item = {}, type = "track") {
  const audioUrl = audioOf(item);

  if (!audioUrl) {
    throw new Error("This item has no audio URL.");
  }

  updateNowPlaying(item, type);

  if (!els.audioPlayer) {
    window.open(audioUrl, "_blank", "noopener,noreferrer");
    return;
  }

  if (els.audioPlayer.src !== audioUrl) {
    els.audioPlayer.src = audioUrl;
  }

  els.audioPlayer.dataset.musicType = type;
  els.audioPlayer.dataset.musicItemId = item.id || "";

  await els.audioPlayer.play();
}

async function logPlayEvent(item = {}, type = "track") {
  const user = currentUser || getUser?.();

  if (!item?.id || !supabase) return;

  try {
    if (type === "track") {
      await supabase.from(table("musicPlayEvents", "music_play_events")).insert({
        track_id: item.id,
        user_id: user?.id || null,
        session_id: user?.id ? null : crypto.randomUUID?.() || String(Date.now()),
        seconds_played: 0,
        completed: false,
        metadata: {
          source: "music.js",
          app: "Rich Bizness Mobile"
        }
      });
    }

    if (type === "radio") {
      await supabase.from(table("radioSessions", "radio_sessions")).insert({
        station_id: item.id,
        user_id: user?.id || null,
        anonymous_id: user?.id ? null : crypto.randomUUID?.() || String(Date.now()),
        metadata: {
          source: "music.js",
          app: "Rich Bizness Mobile"
        }
      });
    }
  } catch (error) {
    console.warn("[RB MUSIC PLAY LOG WARNING]", error?.message || error);
  }
}

async function handlePlay(item = {}, type = "track") {
  await playMusicItem(item, type);
  await logPlayEvent(item, type);
}

/* =========================
   RENDER
========================= */

function renderAudioCard(item, type = "track") {
  const title = titleOf(item);
  const audioUrl = audioOf(item);
  const coverUrl = coverOf(item);

  const label =
    type === "podcast"
      ? "PODCAST"
      : type === "radio"
        ? "RADIO"
        : "TRACK";

  const meta = [
    creatorLine(item),
    item.genre || item.category || item.mood || "",
    moneyDate(item.created_at)
  ].filter(Boolean).join(" • ");

  const card = document.createElement("article");

  card.className = "rb-music-card";
  card.dataset.musicItemId = item.id || "";
  card.dataset.musicType = type;
  card.dataset.musicTrackId = type === "track" ? item.id || "" : "";
  card.dataset.creatorId = item.user_id || item.creator_id || item.artist_user_id || "";
  card.dataset.profileLocked = card.dataset.creatorId ? "true" : "false";

  card.innerHTML = `
    <img
      class="rb-music-card-cover"
      src="${escapeHtml(coverUrl)}"
      alt="${escapeHtml(title)}"
      loading="lazy"
    />

    <div class="rb-music-card-body">
      <p class="rb-kicker">${escapeHtml(label)}</p>

      <h3>${escapeHtml(title)}</h3>

      <p>
        ${escapeHtml(safeText(item.description || item.station_tag, meta))}
      </p>

      <div class="rb-music-card-meta">
        <span>${escapeHtml(meta)}</span>
      </div>

      <div class="rb-music-card-actions">
        <button
          type="button"
          class="rb-main-launch"
          data-music-action="play"
          ${audioUrl ? "" : "disabled"}
        >
          PLAY
        </button>
      </div>
    </div>
  `;

  card
    .querySelector("[data-music-action='play']")
    ?.addEventListener("click", async () => {
      try {
        await handlePlay(item, type);
      } catch (error) {
        console.warn("[RB MUSIC PLAY FAILED]", error?.message || error);
      }
    });

  return card;
}

function renderPlaylistCard(item = {}) {
  const title = titleOf(item, "Untitled Playlist");
  const coverUrl = coverOf(item);

  const card = document.createElement("article");

  card.className = "rb-music-card";
  card.dataset.playlistId = item.id || "";
  card.dataset.creatorId = item.user_id || item.creator_id || "";
  card.dataset.profileLocked = card.dataset.creatorId ? "true" : "false";

  card.innerHTML = `
    <img
      class="rb-music-card-cover"
      src="${escapeHtml(coverUrl)}"
      alt="${escapeHtml(title)}"
      loading="lazy"
    />

    <div class="rb-music-card-body">
      <p class="rb-kicker">PLAYLIST</p>

      <h3>${escapeHtml(title)}</h3>

      <p>
        ${escapeHtml(safeText(item.description, "Rich Bizness playlist collection."))}
      </p>

      <div class="rb-music-card-meta">
        <span>
          ${escapeHtml(creatorLine(item))} • ${Number(item.track_count || 0)} tracks • ${escapeHtml(moneyDate(item.created_at))}
        </span>
      </div>

      <div class="rb-music-card-actions">
        <button
          type="button"
          class="rb-main-launch"
          data-playlist-action="open"
        >
          OPEN
        </button>
      </div>
    </div>
  `;

  card
    .querySelector("[data-playlist-action='open']")
    ?.addEventListener("click", async () => {
      try {
        const tracks = await loadPlaylistTracks(item.id);

        if (!tracks.length) return;

        const first =
          tracks[0]?.music_tracks ||
          tracks[0]?.track ||
          tracks[0]?.music_track ||
          tracks[0];

        await handlePlay(first, "track");
      } catch (error) {
        console.warn("[RB PLAYLIST OPEN FAILED]", error?.message || error);
      }
    });

  return card;
}

function renderList(target, items = [], type = "track", emptyText = "Nothing here yet.") {
  if (!target) return;

  if (!items.length) {
    setEmpty(target, emptyText);
    return;
  }

  target.innerHTML = "";

  items.forEach((item) => {
    target.appendChild(renderAudioCard(item, type));
  });
}

function renderPlaylists(items = []) {
  if (!els.playlistsList) return;

  if (!items.length) {
    setEmpty(els.playlistsList, "No playlists yet.");
    return;
  }

  els.playlistsList.innerHTML = "";

  items.forEach((item) => {
    els.playlistsList.appendChild(renderPlaylistCard(item));
  });
}

function updateCounts() {
  setText(els.trackCount, String(musicState.tracks.length || 0));
  setText(els.podcastCount, String(musicState.podcasts.length || 0));
  setText(els.radioCount, String(musicState.radioStations.length || 0));
}

function renderMusicPage() {
  updateCounts();

  renderList(
    els.tracksList,
    musicState.tracks,
    "track",
    "No tracks yet."
  );

  renderList(
    els.podcastsList,
    musicState.podcasts,
    "podcast",
    "No podcast episodes yet."
  );

  renderList(
    els.radioList,
    musicState.radioStations,
    "radio",
    "No radio stations yet."
  );

  renderPlaylists(musicState.playlists);
}

/* =========================
   LOADERS
========================= */

async function loadTracks() {
  const { data, error } = await supabase
    .from(table("musicTracks", "music_tracks"))
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  musicState.tracks = data || [];
  return musicState.tracks;
}

async function loadPodcasts() {
  const { data, error } = await supabase
    .from(table("podcastEpisodes", "podcast_episodes"))
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  musicState.podcasts = data || [];
  return musicState.podcasts;
}

async function loadRadioStations() {
  const { data, error } = await supabase
    .from(table("radioStations", "radio_stations"))
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  musicState.radioStations = data || [];
  return musicState.radioStations;
}

async function loadPlaylists() {
  const { data, error } = await supabase
    .from(table("playlists", "playlists"))
    .select("*")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  musicState.playlists = data || [];
  return musicState.playlists;
}

async function loadPlaylistTracks(playlistId) {
  if (!playlistId) return [];

  const { data, error } = await supabase
    .from(table("playlistTracks", "playlist_tracks"))
    .select(`
      id,
      position,
      track_id,
      music_tracks:track_id (*)
    `)
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  if (error) throw error;

  return data || [];
}

async function loadMusicPage() {
  await Promise.all([
    loadTracks(),
    loadPodcasts(),
    loadRadioStations(),
    loadPlaylists()
  ]);

  renderMusicPage();

  return musicState;
}

/* =========================
   REALTIME
========================= */

function clearPageRealtime() {
  channels.forEach((channel) => {
    supabase?.removeChannel(channel);
  });

  channels = [];
}

function bindRealtime() {
  clearPageRealtime();

  const channel = supabase
    .channel("rb-music-page")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("musicTracks", "music_tracks")
      },
      loadMusicPage
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("podcastEpisodes", "podcast_episodes")
      },
      loadMusicPage
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("radioStations", "radio_stations")
      },
      loadMusicPage
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("playlists", "playlists")
      },
      loadMusicPage
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("playlistTracks", "playlist_tracks")
      },
      loadMusicPage
    )
    .subscribe();

  channels.push(channel);
}

/* =========================
   BOOT
========================= */

async function bootMusicPage() {
  if (pageBooted) return;
  pageBooted = true;

  try {
    await initApp({
      guard: false,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    await refreshAppIdentity();

    syncProfileKeys();
    bindTabs();
    setActiveMusicTab("tracks");

    await loadMusicPage();

    bindRealtime();

    window.addEventListener("beforeunload", clearPageRealtime);

    document.body.dataset.rbPage = "music";
    document.body.dataset.rbRoute = "music";
    document.body.classList.add("rb-music-ready");

    markPageReady("music");

    console.log("RB MUSIC READY", {
      profileLocked: !!profileIdentity?.id,
      route: "music"
    });
  } catch (error) {
    console.error("[RB MUSIC PAGE FAILED]", error);

    setEmpty(els.tracksList, "Music failed to load.");
    setEmpty(els.podcastsList, "Podcasts failed to load.");
    setEmpty(els.radioList, "Radio failed to load.");
    setEmpty(els.playlistsList, "Playlists failed to load.");

    markPageError(error);
  }
}

window.addEventListener("beforeunload", clearPageRealtime);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootMusicPage);
} else {
  bootMusicPage();
}
