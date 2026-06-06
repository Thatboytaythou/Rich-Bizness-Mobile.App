/* =========================
   RICH BIZNESS MOBILE
   /core/pages/music.js

   MUSIC PAGE CONTROLLER
   Tracks + Podcast + Radio + Playlists
   Profile Keys Locked
   Realtime Enabled
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity,
  bindProfileShell,
  buildProfileUrl
} from "/core/shared/rb-profile.js";

import {
  setActiveMusicTab,
  bindMusicShell,
  setMusicError
} from "/core/features/music/music-state.js";

import {
  bindMusicRealtime,
  loadMusicCollections,
  clearMusicRealtime
} from "/core/features/music/music-realtime.js";

import {
  mountTrackPlayer,
  bindTrackPlayerControls,
  playTrack
} from "/core/features/music/track-player.js";

import {
  initPodcastEngine,
  playPodcastEpisode
} from "/core/features/music/podcast-engine.js";

import {
  initRadioEngine,
  playRadioStation
} from "/core/features/music/radio-engine.js";

import {
  loadPublicPlaylists,
  loadPlaylistTracks
} from "/core/features/music/playlist-engine.js";

import {
  initMusicUnlocks,
  canPlayMusicTrack
} from "/core/features/music/music-unlocked.js";

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
let cleanupMusicShell = null;
let cleanupPlayerShell = null;

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safe(value, fallback = "") {
  return String(value || fallback || "").trim();
}

function setEmpty(target, text) {
  if (!target) return;
  target.innerHTML = `<p class="rb-empty">${escapeHtml(text)}</p>`;
}

function moneyDate(date) {
  if (!date) return "Just dropped";

  return new Date(date).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
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
  return (
    item.cover_url ||
    item.image_url ||
    item.thumbnail_url ||
    item.show?.cover_url ||
    FALLBACK_COVER
  );
}

function audioOf(item = {}) {
  return (
    item.audio_url ||
    item.stream_url ||
    item.file_url ||
    item.media_url ||
    item.url ||
    ""
  );
}

function titleOf(item = {}, fallback = "Untitled") {
  return item.title || item.name || item.station_name || fallback;
}

function syncProfileKeys() {
  const state = getCurrentUserState?.() || {};

  currentUser = state.user || null;
  currentProfile = state.profile || null;
  profileIdentity = getProfileIdentity(currentProfile);

  document.body.dataset.rbRoute = "music";
  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = profileIdentity?.id || "";
  document.body.dataset.rbProfileLocked = profileIdentity?.id ? "true" : "false";

  bindProfileShell();

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl(currentProfile);
  });
}

function bindTabs() {
  $$("[data-music-tab]").forEach((button) => {
    if (button.dataset.rbMusicTabBound === "true") return;
    button.dataset.rbMusicTabBound = "true";

    button.addEventListener("click", () => {
      const tab = button.dataset.musicTab || "tracks";

      setActiveMusicTab(tab);

      $$("[data-music-tab]").forEach((btn) => {
        btn.classList.toggle("is-active", btn === button);
      });

      $$("[data-music-panel]").forEach((panel) => {
        panel.classList.toggle(
          "is-active",
          panel.dataset.musicPanel === tab
        );
      });
    });
  });
}

function updateNowType(type = "TRACK") {
  if (els.nowType) {
    els.nowType.textContent = type;
  }
}

async function playMusicItem(item = {}, type = "track") {
  const audioUrl = audioOf(item);

  if (!audioUrl) {
    throw new Error("This item has no audio URL.");
  }

  if (type === "track") {
    const access = await canPlayMusicTrack(item);

    if (!access.ok) {
      if (access.redirectTo) {
        window.location.href = access.redirectTo;
      }

      return;
    }

    updateNowType("TRACK");

    await playTrack(item, {
      type: "track",
      autoplay: true
    });

    return;
  }

  if (type === "podcast") {
    updateNowType("PODCAST");
    await playPodcastEpisode(item);
    return;
  }

  if (type === "radio") {
    updateNowType("RADIO");
    await playRadioStation(item);
    return;
  }
}

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
        ${escapeHtml(safe(item.description || item.station_tag, meta))}
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
        await playMusicItem(item, type);
      } catch (error) {
        console.warn("[RB MUSIC PLAY FAILED]", error?.message || error);
        setMusicError(error);
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
        ${escapeHtml(safe(item.description, "Rich Bizness playlist collection."))}
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
          tracks[0]?.track ||
          tracks[0]?.music_track ||
          tracks[0];

        await playMusicItem(first, "track");
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

function updateCounts(collections = {}) {
  if (els.trackCount) {
    els.trackCount.textContent = String(collections.tracks?.length || 0);
  }

  if (els.podcastCount) {
    els.podcastCount.textContent = String(collections.podcasts?.length || 0);
  }

  if (els.radioCount) {
    els.radioCount.textContent = String(collections.radioStations?.length || 0);
  }
}

async function loadPlaylists() {
  const playlists = await loadPublicPlaylists({
    limit: 30
  });

  renderPlaylists(playlists);

  return playlists;
}

async function loadMusicPage() {
  const collections = await loadMusicCollections({
    limit: 30,
    publicOnly: true
  });

  const finalCollections = collections || {
    tracks: [],
    podcasts: [],
    radioStations: []
  };

  updateCounts(finalCollections);

  renderList(
    els.tracksList,
    finalCollections.tracks,
    "track",
    "No tracks yet."
  );

  renderList(
    els.podcastsList,
    finalCollections.podcasts,
    "podcast",
    "No podcast episodes yet."
  );

  renderList(
    els.radioList,
    finalCollections.radioStations,
    "radio",
    "No radio stations yet."
  );

  await loadPlaylists();

  return finalCollections;
}

function bindRealtime() {
  bindMusicRealtime({
    channelName: "rb-music-page",
    autoLoad: false,
    onRefresh: async () => {
      await loadMusicPage();
    }
  });

  const reloadPlaylists = () => loadPlaylists().catch(console.warn);

  const playlistChannel = supabase
    .channel("rb-music-page-playlists")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.playlists
      },
      reloadPlaylists
    )
    .subscribe();

  window.__RB_MUSIC_PLAYLIST_CHANNEL__ = playlistChannel;
}

function clearPageRealtime() {
  clearMusicRealtime();

  if (window.__RB_MUSIC_PLAYLIST_CHANNEL__) {
    supabase?.removeChannel(window.__RB_MUSIC_PLAYLIST_CHANNEL__);
    window.__RB_MUSIC_PLAYLIST_CHANNEL__ = null;
  }
}

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

    syncProfileKeys();
    bindTabs();

    mountTrackPlayer({
      audio: els.audioPlayer || "#music-audio-player"
    });

    cleanupMusicShell = bindMusicShell({
      tabSelector: "[data-music-tab]",
      sectionTitleSelector: "[data-music-section-title]",
      countSelector: "[data-music-count]",
      nowTitleSelector: "[data-music-now-title], #music-now-title",
      nowMetaSelector: "[data-music-now-meta], #music-now-meta",
      nowCoverSelector: "[data-music-now-cover], #music-now-cover"
    });

    cleanupPlayerShell = bindTrackPlayerControls();

    await Promise.allSettled([
      initPodcastEngine(),
      initRadioEngine(),
      initMusicUnlocks()
    ]);

    await loadMusicPage();

    bindRealtime();

    window.addEventListener("beforeunload", clearPageRealtime);

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

window.addEventListener("beforeunload", () => {
  cleanupMusicShell?.();
  cleanupPlayerShell?.();
  clearPageRealtime();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootMusicPage);
} else {
  bootMusicPage();
}
