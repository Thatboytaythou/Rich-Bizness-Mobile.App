/* =========================
   RICH BIZNESS MOBILE
   /core/pages/radio.js

   RADIO PAGE CONTROLLER
   Stations + Sessions + Likes
   Profile Keys Locked
   Safe Loader + Realtime Enabled
   XP Gauge Enabled

   Updates:
   - No project-avatar fallback
   - Safe URL handling
   - Radio XP gauge connected
   - Tab display fixed
   - Direct table fallbacks
   - Realtime cleanup locked
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity,
  bindProfileShell,
  buildProfileUrl
} from "/core/shared/rb-profile.js";

const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const FALLBACK_COVER = "/images/brand/hero-banner.png";
const FALLBACK_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";

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
  audioPlayer: $("radio-audio-player"),

  xpGauge: $("radio-xp-gauge"),
  xpFill: $("radio-xp-gauge-fill"),
  xpText: $("radio-xp-gauge-text"),
  xpNext: $("radio-xp-gauge-next"),
  xpLevel: $("radio-xp-level"),
  xpRank: $("radio-xp-rank")
};

let supabase = null;
let channels = [];
let currentUser = null;
let currentProfile = null;
let profileIdentity = null;
let activeStation = null;
let activeSessionId = null;
let booted = false;

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

function safe(value, fallback = "") {
  return String(value || fallback || "").trim();
}

function safeUrl(value = "", fallback = FALLBACK_COVER) {
  const url = String(value || "").trim();

  if (!url || url.includes("project-avatar")) return fallback;

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
  return safeUrl(
    item.cover_url ||
      item.image_url ||
      item.thumbnail_url,
    FALLBACK_COVER
  );
}

function stationStream(item = {}) {
  return safeUrl(
    item.stream_url ||
      item.audio_url ||
      item.url,
    ""
  );
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

/* =========================
   XP GAUGE
========================= */

function getProfileXpModel(profile = {}, identity = {}) {
  const rawXp =
    profile?.xp ??
    profile?.rich_points ??
    profile?.points ??
    identity?.xp ??
    identity?.rich_points ??
    0;

  const rawLevel =
    profile?.rich_level ??
    profile?.level ??
    identity?.rich_level ??
    identity?.level ??
    1;

  const rank =
    profile?.rank_title ||
    profile?.rank ||
    identity?.rank_title ||
    identity?.rank ||
    "Radio Host";

  const xp = Math.max(0, Number(rawXp) || 0);
  const level = Math.max(1, Number(rawLevel) || 1);

  const levelBase = Math.max(0, (level - 1) * 1000);
  const nextLevel = level * 1000;
  const span = Math.max(1, nextLevel - levelBase);
  const currentIntoLevel = Math.max(0, xp - levelBase);
  const percent = Math.max(0, Math.min(100, (currentIntoLevel / span) * 100));
  const remaining = Math.max(0, nextLevel - xp);

  return {
    xp,
    level,
    rank,
    nextLevel,
    remaining,
    percent
  };
}

function renderXpGauge() {
  const model = getProfileXpModel(currentProfile, profileIdentity);

  if (els.xpGauge) {
    els.xpGauge.dataset.level = String(model.level);
    els.xpGauge.dataset.rank = model.rank;
    els.xpGauge.dataset.xp = String(model.xp);
  }

  if (els.xpFill) {
    els.xpFill.style.width = `${model.percent}%`;
  }

  if (els.xpText) {
    els.xpText.textContent = `${model.xp.toLocaleString()} XP`;
  }

  if (els.xpNext) {
    els.xpNext.textContent = `${model.remaining.toLocaleString()} XP TO LVL ${model.level + 1}`;
  }

  if (els.xpLevel) {
    els.xpLevel.textContent = `LVL ${model.level}`;
  }

  if (els.xpRank) {
    els.xpRank.textContent = model.rank;
  }

  window.dispatchEvent(
    new CustomEvent("rb:xp-gauge-update", {
      detail: {
        route: "radio",
        xp: model.xp,
        level: model.level,
        rank: model.rank,
        nextLevel: model.nextLevel,
        remaining: model.remaining,
        percent: model.percent
      }
    })
  );
}

/* =========================
   PROFILE LOCK
========================= */

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

  document.querySelectorAll("[data-rb-current-avatar]").forEach((el) => {
    const avatar = safeUrl(
      currentProfile?.avatar_url || profileIdentity?.avatar_url,
      FALLBACK_AVATAR
    );

    if (el.tagName === "IMG") {
      el.src = avatar;
      el.alt =
        currentProfile?.display_name ||
        currentProfile?.username ||
        "Rich Bizness Profile";
    } else {
      el.style.backgroundImage = `url("${avatar}")`;
    }
  });

  renderXpGauge();
}

/* =========================
   SESSION
========================= */

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
  table: tableName,
  limit = 40,
  orderBy = "created_at",
  attempts = []
}) {
  if (!tableName) return [];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      let query = supabase
        .from(tableName)
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
      console.warn(`[RB RADIO SAFE QUERY FAILED] ${tableName}: ${attempt.name}`, error?.message || error);
    }
  }

  throw lastError || new Error(`Failed to load ${tableName}.`);
}

async function startRadioSession(station) {
  const sessionsTable = table("radioSessions", "radio_sessions");

  if (!station?.id || !currentUser?.id || !sessionsTable) return null;

  const payload = {
    station_id: station.id,
    user_id: currentUser.id,
    device_info: deviceInfo(),
    metadata: {
      station_name: stationTitle(station),
      source: "radio_page_play",
      profile_id: profileIdentity?.id || currentUser.id
    }
  };

  const { data, error } = await supabase
    .from(sessionsTable)
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
  const sessionsTable = table("radioSessions", "radio_sessions");

  if (!activeSessionId || !sessionsTable) return;

  const { error } = await supabase
    .from(sessionsTable)
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

  if (els.nowCover) {
    els.nowCover.src = coverUrl;
    els.nowCover.alt = title;
  }

  if (els.nowType) {
    els.nowType.textContent = isStationLive(station) ? "LIVE RADIO" : "RADIO";
  }

  if (els.nowTitle) {
    els.nowTitle.textContent = title;
  }

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

  const likesTable = table("radioLikes", "radio_likes");

  if (!station?.id || !likesTable) return;

  const { error } = await supabase
    .from(likesTable)
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

/* =========================
   TABS
========================= */

function bindTabs() {
  $$("[data-radio-tab]").forEach((button) => {
    if (button.dataset.rbRadioTabBound === "true") return;
    button.dataset.rbRadioTabBound = "true";

    button.addEventListener("click", () => {
      const tab = button.dataset.radioTab || "featured";

      $$("[data-radio-tab]").forEach((btn) => {
        btn.classList.toggle("is-active", btn === button);
      });

      $$("[data-radio-panel]").forEach((panel) => {
        const active = panel.dataset.radioPanel === tab;
        panel.classList.toggle("is-active", active);
        panel.style.display = active ? "block" : "none";
      });
    });
  });
}

/* =========================
   RENDER
========================= */

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

/* =========================
   LOAD
========================= */

async function loadStations() {
  const stationsTable = table("radioStations", "radio_stations");

  try {
    const stations = await safeLoadTable({
      table: stationsTable,
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
  const sessionsTable = table("radioSessions", "radio_sessions");

  if (!els.sessionsList || !sessionsTable) return;

  try {
    const sessions = await safeLoadTable({
      table: sessionsTable,
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

/* =========================
   REALTIME
========================= */

function clearRealtime() {
  channels.forEach((channel) => {
    supabase?.removeChannel(channel);
  });

  channels = [];
}

function watchTable(tableName) {
  if (!tableName) return null;

  return supabase
    .channel(`rb-radio-${tableName}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: tableName
      },
      () => loadRadioPage().catch(console.error)
    )
    .subscribe();
}

function bindRealtime() {
  clearRealtime();

  channels = [
    watchTable(table("radioStations", "radio_stations")),
    watchTable(table("radioLikes", "radio_likes")),
    watchTable(table("radioSessions", "radio_sessions"))
  ].filter(Boolean);
}

/* =========================
   BOOT
========================= */

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

    document.body.dataset.rbPage = "radio";
    document.body.dataset.rbRoute = "radio";
    document.body.dataset.rbProfileLock = profileIdentity?.id ? "true" : "false";
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
