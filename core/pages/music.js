/* =========================
   RICH BIZNESS MOBILE
   /core/pages/music.js

   Music Page
   Profile Keys Locked
   Realtime Enabled
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import { RB_TABLES } from "/core/shared/rb-config.js";
import { getSupabase } from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity,
  bindProfileShell,
  buildProfileUrl,
  profileAvatar,
  profileName
} from "/core/shared/rb-profile.js";

const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

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
let channels = [];
let currentUser = null;
let currentProfile = null;
let profileIdentity = null;

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

function safe(value, fallback = "") {
  return value || fallback;
}

function setEmpty(target, text) {
  if (!target) return;
  target.innerHTML = `<p class="rb-empty">${text}</p>`;
}

function moneyDate(date) {
  if (!date) return "Just dropped";

  return new Date(date).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function creatorLine(item) {
  return item?.display_name || item?.username || "Rich Bizness Creator";
}

function playAudio({
  type = "TRACK",
  title = "Untitled",
  meta = "",
  audioUrl = "",
  coverUrl = FALLBACK_COVER
}) {
  if (els.nowCover) els.nowCover.src = coverUrl || FALLBACK_COVER;
  if (els.nowType) els.nowType.textContent = type;
  if (els.nowTitle) els.nowTitle.textContent = title;
  if (els.nowMeta) els.nowMeta.textContent = meta;

  if (els.audioPlayer && audioUrl) {
    els.audioPlayer.src = audioUrl;
    els.audioPlayer.play().catch(() => {});
  }
}

function bindTabs() {
  $$("[data-music-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.musicTab;

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

function renderAudioCard(item, type) {
  const title = item.title || item.station_name || "Untitled";
  const audioUrl = item.audio_url || item.stream_url || "";
  const coverUrl = item.cover_url || FALLBACK_COVER;

  const meta = [
    creatorLine(item),
    item.genre || item.category || item.mood || "",
    moneyDate(item.created_at)
  ].filter(Boolean).join(" • ");

  const card = document.createElement("article");
  card.className = "rb-music-card";
  card.dataset.creatorId = item.user_id || "";
  card.dataset.profileLocked = item.user_id ? "true" : "false";

  card.innerHTML = `
    <img
      class="rb-music-card-cover"
      src="${coverUrl}"
      alt="${title}"
      loading="lazy"
    />

    <div class="rb-music-card-body">
      <p class="rb-kicker">${type}</p>
      <h3>${title}</h3>
      <p>${safe(item.description || item.station_tag, meta)}</p>

      <div class="rb-music-card-meta">
        <span>${meta}</span>
      </div>

      <div class="rb-music-card-actions">
        <button type="button" class="rb-main-launch">PLAY</button>
      </div>
    </div>
  `;

  card.querySelector("button")?.addEventListener("click", () => {
    playAudio({ type, title, meta, audioUrl, coverUrl });
  });

  return card;
}

function renderPlaylistCard(item) {
  const title = item.title || "Untitled Playlist";
  const coverUrl = item.cover_url || FALLBACK_COVER;

  const card = document.createElement("article");
  card.className = "rb-music-card";
  card.dataset.creatorId = item.user_id || "";
  card.dataset.profileLocked = item.user_id ? "true" : "false";

  card.innerHTML = `
    <img
      class="rb-music-card-cover"
      src="${coverUrl}"
      alt="${title}"
      loading="lazy"
    />

    <div class="rb-music-card-body">
      <p class="rb-kicker">PLAYLIST</p>
      <h3>${title}</h3>
      <p>${safe(item.description, "Rich Bizness playlist collection.")}</p>

      <div class="rb-music-card-meta">
        <span>${creatorLine(item)} • ${item.track_count || 0} tracks • ${moneyDate(item.created_at)}</span>
      </div>
    </div>
  `;

  return card;
}

async function loadTracks() {
  const { data, error } = await supabase
    .from(RB_TABLES.musicTracks)
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (els.trackCount) els.trackCount.textContent = data?.length || 0;

  if (!data?.length) {
    setEmpty(els.tracksList, "No tracks yet.");
    return;
  }

  els.tracksList.innerHTML = "";
  data.forEach((item) => {
    els.tracksList.appendChild(renderAudioCard(item, "TRACK"));
  });
}

async function loadPodcasts() {
  const { data, error } = await supabase
    .from(RB_TABLES.podcastEpisodes)
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (els.podcastCount) els.podcastCount.textContent = data?.length || 0;

  if (!data?.length) {
    setEmpty(els.podcastsList, "No podcast episodes yet.");
    return;
  }

  els.podcastsList.innerHTML = "";
  data.forEach((item) => {
    els.podcastsList.appendChild(renderAudioCard(item, "PODCAST"));
  });
}

async function loadRadio() {
  const { data, error } = await supabase
    .from(RB_TABLES.radioStations)
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (els.radioCount) els.radioCount.textContent = data?.length || 0;

  if (!data?.length) {
    setEmpty(els.radioList, "No radio stations yet.");
    return;
  }

  els.radioList.innerHTML = "";
  data.forEach((item) => {
    els.radioList.appendChild(renderAudioCard(item, "RADIO"));
  });
}

async function loadPlaylists() {
  const { data, error } = await supabase
    .from(RB_TABLES.playlists)
    .select("*")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (!data?.length) {
    setEmpty(els.playlistsList, "No playlists yet.");
    return;
  }

  els.playlistsList.innerHTML = "";
  data.forEach((item) => {
    els.playlistsList.appendChild(renderPlaylistCard(item));
  });
}

async function loadMusicPage() {
  await Promise.all([
    loadTracks(),
    loadPodcasts(),
    loadRadio(),
    loadPlaylists()
  ]);
}

function clearRealtime() {
  channels.forEach((channel) => {
    supabase?.removeChannel(channel);
  });

  channels = [];
}

function bindRealtime() {
  const reload = () => loadMusicPage().catch(console.error);

  clearRealtime();

  channels = [
    supabase.channel("rb-music-tracks")
      .on("postgres_changes", { event: "*", schema: "public", table: RB_TABLES.musicTracks }, reload)
      .subscribe(),

    supabase.channel("rb-podcast-episodes")
      .on("postgres_changes", { event: "*", schema: "public", table: RB_TABLES.podcastEpisodes }, reload)
      .subscribe(),

    supabase.channel("rb-radio-stations")
      .on("postgres_changes", { event: "*", schema: "public", table: RB_TABLES.radioStations }, reload)
      .subscribe(),

    supabase.channel("rb-playlists")
      .on("postgres_changes", { event: "*", schema: "public", table: RB_TABLES.playlists }, reload)
      .subscribe()
  ];
}

async function bootMusicPage() {
  try {
    await initApp({
      guard: false,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    syncProfileKeys();
    bindTabs();

    await loadMusicPage();

    bindRealtime();

    window.addEventListener("beforeunload", clearRealtime);

    document.body.classList.add("rb-music-ready");

    markPageReady("music");

    console.log("RB MUSIC READY", {
      profileLocked: !!profileIdentity?.id,
      route: "music"
    });
  } catch (error) {
    console.error("[music.js]", error);

    setEmpty(els.tracksList, "Music failed to load.");
    setEmpty(els.podcastsList, "Podcasts failed to load.");
    setEmpty(els.radioList, "Radio failed to load.");
    setEmpty(els.playlistsList, "Playlists failed to load.");

    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootMusicPage);
} else {
  bootMusicPage();
}
