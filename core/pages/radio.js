/* =========================
   RICH BIZNESS MOBILE
   /core/pages/radio.js

   RADIO PAGE CONTROLLER
   Stations + Sessions + Likes
   Profile Keys Locked
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
  buildProfileUrl
} from "/core/shared/rb-profile.js";

const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

const FALLBACK_COVER = "/images/brand/hero-banner.png";

const els = {
  stationCount: $("radio-station-count"),
  liveCount: $("radio-live-count"),
  listenerCount: $("radio-listener-count"),
  likeCount: $("radio-like-count"),

  stationsList: $("radio-stations-list"),
  featuredList: $("radio-featured-list"),
  sessionsList: $("radio-sessions-list"),

  nowCover: $("radio-now-cover"),
  nowType: $("radio-now-type"),
  nowTitle: $("radio-now-title"),
  nowMeta: $("radio-now-meta"),
  audioPlayer: $("radio-audio-player")
};

let supabase = null;
let channels = [];
let currentUser = null;
let currentProfile = null;
let profileIdentity = null;
let activeStation = null;
let activeSessionId = null;

function syncProfileKeys() {
  const state = getCurrentUserState?.() || {};

  currentUser = state.user || null;
  currentProfile = state.profile || null;
  profileIdentity = getProfileIdentity(currentProfile);

  document.body.dataset.rbRoute = "radio";
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

function niceDate(date) {
  if (!date) return "Just now";

  return new Date(date).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function creatorLine(item) {
  return item?.display_name || item?.username || "Rich Bizness Radio";
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function deviceInfo() {
  return {
    source: "radio.js",
    app: "Rich Bizness Mobile",
    userAgent: navigator.userAgent,
    width: window.innerWidth,
    height: window.innerHeight
  };
}

async function startRadioSession(station) {
  if (!station?.id) return null;

  if (!currentUser?.id) return null;

  const { data, error } = await supabase
    .from(RB_TABLES.radioSessions)
    .insert({
      station_id: station.id,
      user_id: currentUser.id,
      device_info: deviceInfo(),
      metadata: {
        station_name: station.station_name || "",
        source: "radio_page_play"
      }
    })
    .select()
    .maybeSingle();

  if (error) {
    console.warn("[radio session start]", error.message);
    return null;
  }

  activeSessionId = data?.id || null;
  return data || null;
}

async function endRadioSession() {
  if (!activeSessionId) return;

  const { error } = await supabase
    .from(RB_TABLES.radioSessions)
    .update({
      left_at: new Date().toISOString(),
      metadata: {
        source: "radio_page_stop"
      }
    })
    .eq("id", activeSessionId);

  if (error) {
    console.warn("[radio session end]", error.message);
  }

  activeSessionId = null;
}

async function playStation(station) {
  activeStation = station;

  if (els.nowCover) els.nowCover.src = station.cover_url || FALLBACK_COVER;
  if (els.nowType) els.nowType.textContent = station.is_live ? "LIVE RADIO" : "RADIO";
  if (els.nowTitle) els.nowTitle.textContent = station.station_name || "Untitled Station";

  if (els.nowMeta) {
    els.nowMeta.textContent = [
      creatorLine(station),
      station.genre,
      station.mood,
      `${formatNumber(station.listener_count)} listening`
    ].filter(Boolean).join(" • ");
  }

  await endRadioSession();
  await startRadioSession(station);

  if (els.audioPlayer && station.stream_url) {
    els.audioPlayer.src = station.stream_url;
    els.audioPlayer.play().catch(() => {});
  }
}

async function likeStation(station) {
  if (!currentUser?.id) {
    window.location.href = "/auth";
    return;
  }

  const { error } = await supabase
    .from(RB_TABLES.radioLikes)
    .insert({
      station_id: station.id,
      user_id: currentUser.id
    });

  if (error && !String(error.message || "").toLowerCase().includes("duplicate")) {
    console.warn("[radio like]", error.message);
  }

  await loadRadioPage();
}

function bindTabs() {
  $$("[data-radio-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.radioTab;

      $$("[data-radio-tab]").forEach((btn) => {
        btn.classList.toggle("is-active", btn === button);
      });

      $$("[data-radio-panel]").forEach((panel) => {
        panel.classList.toggle(
          "is-active",
          panel.dataset.radioPanel === tab
        );
      });
    });
  });
}

function renderStationCard(item) {
  const card = document.createElement("article");
  card.className = "rb-content-card rb-radio-card";
  card.dataset.creatorId = item.user_id || "";
  card.dataset.profileLocked = item.user_id ? "true" : "false";

  card.innerHTML = `
    <img
      class="rb-card-cover"
      src="${item.cover_url || FALLBACK_COVER}"
      alt="${safe(item.station_name, "Radio station")}"
      loading="lazy"
    />

    <div class="rb-card-body">
      <p class="rb-kicker">${item.is_live ? "LIVE RADIO" : "RADIO STATION"}</p>
      <h3>${safe(item.station_name, "Untitled Station")}</h3>
      <p>${safe(item.description || item.station_tag, "Rich Bizness radio stream.")}</p>

      <div class="rb-card-meta">
        <span>${creatorLine(item)}</span>
        <span>${niceDate(item.created_at)}</span>
      </div>

      <div class="rb-chip-row">
        <span class="rb-chip">${safe(item.genre, "genre")}</span>
        <span class="rb-chip">${formatNumber(item.listener_count)} listeners</span>
        <span class="rb-chip">${formatNumber(item.like_count)} likes</span>
        <span class="rb-chip">${formatNumber(item.play_count)} plays</span>
      </div>

      <div class="rb-action-row">
        <button type="button" class="rb-main-launch" data-radio-play>PLAY</button>
        <button type="button" class="rb-ghost-btn" data-radio-like>LIKE</button>
      </div>
    </div>
  `;

  card.querySelector("[data-radio-play]")?.addEventListener("click", () => {
    playStation(item);
  });

  card.querySelector("[data-radio-like]")?.addEventListener("click", () => {
    likeStation(item);
  });

  return card;
}

function renderSessionCard(item) {
  const card = document.createElement("article");
  card.className = "rb-list-row rb-radio-session";

  card.innerHTML = `
    <strong>📻</strong>

    <div>
      <h3>${safe(item.anonymous_id || item.user_id, "Radio Listener")}</h3>
      <p>${niceDate(item.joined_at)} • ${item.listen_seconds || 0}s listened</p>
    </div>

    <b>${item.left_at ? "ENDED" : "LIVE"}</b>
  `;

  return card;
}

async function loadStations() {
  const { data, error } = await supabase
    .from(RB_TABLES.radioStations)
    .select("*")
    .eq("is_public", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const stations = data || [];
  const liveStations = stations.filter((item) => item.is_live);
  const totalListeners = stations.reduce(
    (sum, item) => sum + Number(item.listener_count || 0),
    0
  );
  const totalLikes = stations.reduce(
    (sum, item) => sum + Number(item.like_count || 0),
    0
  );

  if (els.stationCount) els.stationCount.textContent = stations.length;
  if (els.liveCount) els.liveCount.textContent = liveStations.length;
  if (els.listenerCount) els.listenerCount.textContent = formatNumber(totalListeners);
  if (els.likeCount) els.likeCount.textContent = formatNumber(totalLikes);

  if (!stations.length) {
    setEmpty(els.stationsList, "No radio stations yet.");
    setEmpty(els.featuredList, "No featured radio stations yet.");
    return;
  }

  els.stationsList.innerHTML = "";
  stations.forEach((item) => els.stationsList.appendChild(renderStationCard(item)));

  const featured = stations.filter((item) => item.is_featured).slice(0, 12);
  const finalFeatured = featured.length ? featured : stations.slice(0, 8);

  els.featuredList.innerHTML = "";
  finalFeatured.forEach((item) => els.featuredList.appendChild(renderStationCard(item)));
}

async function loadSessions() {
  if (!els.sessionsList) return;

  const { data, error } = await supabase
    .from(RB_TABLES.radioSessions)
    .select("*")
    .order("joined_at", { ascending: false })
    .limit(40);

  if (error) throw error;

  const sessions = data || [];

  if (!sessions.length) {
    setEmpty(els.sessionsList, "No radio sessions yet.");
    return;
  }

  els.sessionsList.innerHTML = "";
  sessions.forEach((item) => els.sessionsList.appendChild(renderSessionCard(item)));
}

async function loadRadioPage() {
  await Promise.all([
    loadStations(),
    loadSessions()
  ]);
}

function clearRealtime() {
  channels.forEach((channel) => {
    supabase?.removeChannel(channel);
  });

  channels = [];
}

function bindRealtime() {
  const reload = () => loadRadioPage().catch(console.error);

  clearRealtime();

  channels = [
    RB_TABLES.radioStations,
    RB_TABLES.radioLikes,
    RB_TABLES.radioSessions
  ].map((table) =>
    supabase
      .channel(`rb-radio-${table}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table
        },
        reload
      )
      .subscribe()
  );
}

async function bootRadioPage() {
  try {
    await initApp({
      guard: false,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    syncProfileKeys();
    bindTabs();

    await loadRadioPage();

    bindRealtime();

    window.addEventListener("beforeunload", async () => {
      await endRadioSession();
      clearRealtime();
    });

    document.body.classList.add("rb-radio-ready");

    markPageReady("radio");

    console.log("RB RADIO READY", {
      profileLocked: !!profileIdentity?.id,
      route: "radio"
    });
  } catch (error) {
    console.error("[radio.js]", error);

    setEmpty(els.stationsList, "Radio stations failed to load.");
    setEmpty(els.featuredList, "Featured radio stations failed to load.");
    setEmpty(els.sessionsList, "Radio sessions failed to load.");

    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootRadioPage);
} else {
  bootRadioPage();
}
