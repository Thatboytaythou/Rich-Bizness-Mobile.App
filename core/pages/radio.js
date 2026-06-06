/* =========================
   RICH BIZNESS MOBILE
   /core/pages/radio.js

   RADIO PAGE CONTROLLER
   Stations + Sessions + Likes
   Profile Keys Locked
   Safe Loader + Realtime Enabled
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import { RB_TABLES, RB_ROUTES } from "/core/shared/rb-config.js";
import { getSupabase } from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity,
  bindProfileShell,
  buildProfileUrl
} from "/core/shared/rb-profile.js";

const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

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
let booted = false;

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

function setCount(target, count = 0) {
  if (target) target.textContent = String(count || 0);
}

function niceDate(date) {
  if (!date) return "Just now";

  const stamp = new Date(date).getTime();
  if (!Number.isFinite(stamp)) return "Just now";

  return new Date(date).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function creatorLine(item = {}) {
  return (
    item.display_name ||
    item.creator_name ||
    item.username ||
    item.artist_name ||
    "Rich Bizness Radio"
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function stationTitle(item = {}) {
  return item.station_name || item.title || item.name || "Untitled Station";
}

function stationCover(item = {}) {
  return item.cover_url || item.image_url || item.thumbnail_url || FALLBACK_COVER;
}

function stationStream(item = {}) {
  return item.stream_url || item.audio_url || item.url || "";
}

function stationListeners(item = {}) {
  return Number(item.listener_count || item.listeners || item.active_listeners || 0);
}

function stationLikes(item = {}) {
  return Number(item.like_count || item.likes || 0);
}

function stationPlays(item = {}) {
  return Number(item.play_count || item.plays || 0);
}

function isStationLive(item = {}) {
  return Boolean(item.is_live || item.status === "live");
}

function isStationFeatured(item = {}) {
  return Boolean(item.is_featured || item.featured);
}

function syncProfileKeys() {
  const state = getCurrentUserState?.() || {};

  currentUser = state.user || null;
  currentProfile = state.profile || null;
  profileIdentity = getProfileIdentity(currentProfile);

  document.body.dataset.rbRoute = "radio";
  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = profileIdentity?.id || "";
  document.body.dataset.rbProfileLocked = profileIdentity?.id ? "true" : "false";

  bindProfileShell?.();

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl(currentProfile);
  });
}

function deviceInfo() {
  return {
    source: "radio.js",
    app: "Rich Bizness Mobile",
    userAgent: navigator.userAgent,
    width: window.innerWidth,
    height: window.innerHeight,
    path: window.location.pathname
  };
}

async function safeLoadTable({
  table,
  limit = 40,
  orderBy = "created_at",
  attempts = []
}) {
  let lastError = null;

  for (const attempt of attempts) {
    try {
      let query = supabase
        .from(table)
        .select("*")
        .limit(limit);

      if (attempt.filter) {
        query = attempt.filter(query);
      }

      if (attempt.order) {
        query = attempt.order(query);
      } else if (orderBy) {
        query = query.order(orderBy, { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      lastError = error;
      console.warn(`[RB RADIO SAFE QUERY FAILED] ${table}: ${attempt.name}`, error?.message || error);
    }
  }

  throw lastError || new Error(`Failed to load ${table}.`);
}

async function startRadioSession(station) {
  if (!station?.id || !currentUser?.id || !RB_TABLES.radioSessions) return null;

  const payload = {
    station_id: station.id,
    user_id: currentUser.id,
    device_info: deviceInfo(),
    metadata: {
      station_name: stationTitle(station),
      source: "radio_page_play"
    }
  };

  const { data, error } = await supabase
    .from(RB_TABLES.radioSessions)
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error) {
    console.warn("[RB RADIO SESSION START SKIPPED]", error.message);
    return null;
  }

  activeSessionId = data?.id || null;
  return data || null;
}

async function endRadioSession() {
  if (!activeSessionId || !RB_TABLES.radioSessions) return;

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
    console.warn("[RB RADIO SESSION END SKIPPED]", error.message);
  }

  activeSessionId = null;
}

async function playStation(station) {
  activeStation = station;

  const title = stationTitle(station);
  const coverUrl = stationCover(station);
  const streamUrl = stationStream(station);

  if (els.nowCover) els.nowCover.src = coverUrl;
  if (els.nowType) els.nowType.textContent = isStationLive(station) ? "LIVE RADIO" : "RADIO";
  if (els.nowTitle) els.nowTitle.textContent = title;

  if (els.nowMeta) {
    els.nowMeta.textContent = [
      creatorLine(station),
      station.genre || station.category || "",
      station.mood || station.station_tag || "",
      `${formatNumber(stationListeners(station))} listening`
    ].filter(Boolean).join(" • ");
  }

  await endRadioSession();
  await startRadioSession(station);

  if (els.audioPlayer && streamUrl) {
    els.audioPlayer.src = streamUrl;
    els.audioPlayer.play().catch(() => {});
  }
}

async function likeStation(station) {
  if (!currentUser?.id) {
    window.location.href = `${RB_ROUTES.auth || "/auth"}?next=${encodeURIComponent(
      window.location.pathname + window.location.search
    )}`;
    return;
  }

  if (!station?.id || !RB_TABLES.radioLikes) return;

  const { error } = await supabase
    .from(RB_TABLES.radioLikes)
    .upsert(
      {
        station_id: station.id,
        user_id: currentUser.id,
        created_at: new Date().toISOString()
      },
      {
        onConflict: "station_id,user_id"
      }
    );

  if (error) {
    console.warn("[RB RADIO LIKE SKIPPED]", error.message);
  }

  await loadRadioPage();
}

function bindTabs() {
  $$("[data-radio-tab]").forEach((button) => {
    if (button.dataset.rbRadioTabBound === "true") return;
    button.dataset.rbRadioTabBound = "true";

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

function renderStationCard(item = {}) {
  const title = stationTitle(item);
  const coverUrl = stationCover(item);
  const streamUrl = stationStream(item);

  const card = document.createElement("article");
  card.className = "rb-content-card rb-radio-card";
  card.dataset.creatorId = item.user_id || item.creator_id || "";
  card.dataset.profileLocked = card.dataset.creatorId ? "true" : "false";
  card.dataset.stationId = item.id || "";

  card.innerHTML = `
    <img
      class="rb-card-cover"
      src="${escapeHtml(coverUrl)}"
      alt="${escapeHtml(title)}"
      loading="lazy"
    />

    <div class="rb-card-body">
      <p class="rb-kicker">${isStationLive(item) ? "LIVE RADIO" : "RADIO STATION"}</p>

      <h3>${escapeHtml(title)}</h3>

      <p>${escapeHtml(safe(item.description || item.station_tag, "Rich Bizness radio stream."))}</p>

      <div class="rb-card-meta">
        <span>${escapeHtml(creatorLine(item))}</span>
        <span>${escapeHtml(niceDate(item.created_at))}</span>
      </div>

      <div class="rb-chip-row">
        <span class="rb-chip">${escapeHtml(safe(item.genre || item.category, "genre"))}</span>
        <span class="rb-chip">${formatNumber(stationListeners(item))} listeners</span>
        <span class="rb-chip">${formatNumber(stationLikes(item))} likes</span>
        <span class="rb-chip">${formatNumber(stationPlays(item))} plays</span>
      </div>

      <div class="rb-action-row">
        <button
          type="button"
          class="rb-main-launch"
          data-radio-play
          ${streamUrl ? "" : "disabled"}
        >
          PLAY
        </button>

        <button type="button" class="rb-ghost-btn" data-radio-like>
          LIKE
        </button>
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

function renderSessionCard(item = {}) {
  const card = document.createElement("article");
  card.className = "rb-list-row rb-radio-session";

  const listener =
    item.display_name ||
    item.username ||
    item.anonymous_id ||
    item.user_id ||
    "Radio Listener";

  card.innerHTML = `
    <strong>📻</strong>

    <div>
      <h3>${escapeHtml(listener)}</h3>
      <p>${escapeHtml(niceDate(item.joined_at || item.created_at))} • ${Number(item.listen_seconds || 0)}s listened</p>
    </div>

    <b>${item.left_at ? "ENDED" : "LIVE"}</b>
  `;

  return card;
}

async function loadStations() {
  try {
    const stations = await safeLoadTable({
      table: RB_TABLES.radioStations,
      limit: 50,
      attempts: [
        {
          name: "is_public_featured_created",
          filter: (q) => q.eq("is_public", true),
          order: (q) =>
            q
              .order("is_featured", { ascending: false })
              .order("created_at", { ascending: false })
        },
        {
          name: "status_active",
          filter: (q) => q.in("status", ["active", "published", "live"])
        },
        {
          name: "visibility_public",
          filter: (q) => q.in("visibility", ["public", "published"])
        },
        {
          name: "created_no_filter",
          filter: null
        }
      ]
    });

    const liveStations = stations.filter(isStationLive);

    const totalListeners = stations.reduce(
      (sum, item) => sum + stationListeners(item),
      0
    );

    const totalLikes = stations.reduce(
      (sum, item) => sum + stationLikes(item),
      0
    );

    setCount(els.stationCount, stations.length);
    setCount(els.liveCount, liveStations.length);

    if (els.listenerCount) {
      els.listenerCount.textContent = formatNumber(totalListeners);
    }

    if (els.likeCount) {
      els.likeCount.textContent = formatNumber(totalLikes);
    }

    if (!stations.length) {
      setEmpty(els.stationsList, "No radio stations yet.");
      setEmpty(els.featuredList, "No featured radio stations yet.");
      return;
    }

    if (els.stationsList) {
      els.stationsList.innerHTML = "";
      stations.forEach((item) => {
        els.stationsList.appendChild(renderStationCard(item));
      });
    }

    const featured = stations.filter(isStationFeatured).slice(0, 12);
    const finalFeatured = featured.length ? featured : stations.slice(0, 8);

    if (els.featuredList) {
      els.featuredList.innerHTML = "";
      finalFeatured.forEach((item) => {
        els.featuredList.appendChild(renderStationCard(item));
      });
    }
  } catch (error) {
    console.error("[RB RADIO STATIONS FAILED]", error);
    setCount(els.stationCount, 0);
    setCount(els.liveCount, 0);
    setCount(els.listenerCount, 0);
    setCount(els.likeCount, 0);
    setEmpty(els.stationsList, error?.message || "Radio stations failed to load.");
    setEmpty(els.featuredList, error?.message || "Featured radio stations failed to load.");
  }
}

async function loadSessions() {
  if (!els.sessionsList || !RB_TABLES.radioSessions) return;

  try {
    const sessions = await safeLoadTable({
      table: RB_TABLES.radioSessions,
      limit: 40,
      attempts: [
        {
          name: "joined_at",
          filter: null,
          order: (q) => q.order("joined_at", { ascending: false })
        },
        {
          name: "created_at",
          filter: null,
          order: (q) => q.order("created_at", { ascending: false })
        },
        {
          name: "no_order",
          filter: null,
          order: (q) => q
        }
      ]
    });

    if (!sessions.length) {
      setEmpty(els.sessionsList, "No radio sessions yet.");
      return;
    }

    els.sessionsList.innerHTML = "";

    sessions.forEach((item) => {
      els.sessionsList.appendChild(renderSessionCard(item));
    });
  } catch (error) {
    console.error("[RB RADIO SESSIONS FAILED]", error);
    setEmpty(els.sessionsList, error?.message || "Radio sessions failed to load.");
  }
}

async function loadRadioPage() {
  await Promise.allSettled([
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

function watchTable(table) {
  if (!table) return null;

  return supabase
    .channel(`rb-radio-${table}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table
      },
      () => loadRadioPage().catch(console.error)
    )
    .subscribe();
}

function bindRealtime() {
  clearRealtime();

  channels = [
    watchTable(RB_TABLES.radioStations),
    watchTable(RB_TABLES.radioLikes),
    watchTable(RB_TABLES.radioSessions)
  ].filter(Boolean);
}

async function bootRadioPage() {
  if (booted) return;
  booted = true;

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
    console.error("[RB RADIO BOOT FAILED]", error);

    setEmpty(els.stationsList, error?.message || "Radio stations failed to load.");
    setEmpty(els.featuredList, error?.message || "Featured radio stations failed to load.");
    setEmpty(els.sessionsList, error?.message || "Radio sessions failed to load.");

    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootRadioPage);
} else {
  bootRadioPage();
}
