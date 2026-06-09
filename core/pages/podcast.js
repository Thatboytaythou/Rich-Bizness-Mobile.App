/* =========================
   RICH BIZNESS MOBILE
   /core/pages/podcast.js

   PODCAST PAGE CONTROLLER
   Shows + Episodes + Featured
   Profile Keys Locked
   Safe Loader + Realtime Enabled
   XP Gauge Enabled

   Updates:
   - No project-avatar fallback
   - Safe URL handling
   - Podcast XP gauge connected
   - Tab display fixed
   - Realtime cleanup locked
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

const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const FALLBACK_COVER = "/images/brand/hero-banner.png";
const FALLBACK_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";

const els = {
  showCount: $("podcast-show-count"),
  episodeCount: $("podcast-episode-count"),
  commentCount: $("podcast-comment-count"),
  likeCount: $("podcast-like-count"),

  showsList: $("podcast-shows-list"),
  episodesList: $("podcast-episodes-list"),
  featuredList: $("podcast-featured-list"),

  nowCover: $("podcast-now-cover"),
  nowTitle: $("podcast-now-title"),
  nowMeta: $("podcast-now-meta"),
  audioPlayer: $("podcast-audio-player"),

  xpGauge: $("podcast-xp-gauge"),
  xpFill: $("podcast-xp-gauge-fill"),
  xpText: $("podcast-xp-gauge-text"),
  xpNext: $("podcast-xp-gauge-next"),
  xpLevel: $("podcast-xp-level"),
  xpRank: $("podcast-xp-rank")
};

let supabase = null;
let channels = [];
let currentUser = null;
let currentProfile = null;
let profileIdentity = null;
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
  if (!date) return "Just dropped";

  const stamp = new Date(date).getTime();
  if (!Number.isFinite(stamp)) return "Just dropped";

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
    item.host_name ||
    "Rich Bizness Podcast"
  );
}

function titleOf(item = {}, fallback = "Untitled") {
  return item.title || item.name || item.show_title || fallback;
}

function coverOf(item = {}) {
  return safeUrl(
    item.cover_url ||
      item.image_url ||
      item.thumbnail_url ||
      item.show_cover_url,
    FALLBACK_COVER
  );
}

function audioOf(item = {}) {
  return safeUrl(
    item.audio_url ||
      item.file_url ||
      item.media_url ||
      item.url,
    ""
  );
}

function numberOf(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isFeatured(item = {}) {
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
    "Podcaster";

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
        route: "podcast",
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

  document.body.dataset.rbRoute = "podcast";
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
   PLAYER
========================= */

function playEpisode(item = {}) {
  const title = titleOf(item, "Untitled Episode");
  const coverUrl = coverOf(item);
  const audioUrl = audioOf(item);

  if (els.nowCover) {
    els.nowCover.src = coverUrl;
    els.nowCover.alt = title;
  }

  if (els.nowTitle) {
    els.nowTitle.textContent = title;
  }

  if (els.nowMeta) {
    els.nowMeta.textContent = [
      creatorLine(item),
      `Episode ${item.episode_number || 1}`,
      item.season_number ? `Season ${item.season_number}` : ""
    ].filter(Boolean).join(" • ");
  }

  if (els.audioPlayer && audioUrl) {
    els.audioPlayer.src = audioUrl;
    els.audioPlayer.play().catch(() => {});
  }
}

/* =========================
   TABS
========================= */

function bindTabs() {
  $$("[data-podcast-tab]").forEach((button) => {
    if (button.dataset.rbPodcastTabBound === "true") return;
    button.dataset.rbPodcastTabBound = "true";

    button.addEventListener("click", () => {
      const tab = button.dataset.podcastTab || "featured";

      $$("[data-podcast-tab]").forEach((btn) => {
        btn.classList.toggle("is-active", btn === button);
      });

      $$("[data-podcast-panel]").forEach((panel) => {
        const active = panel.dataset.podcastPanel === tab;
        panel.classList.toggle("is-active", active);
        panel.style.display = active ? "block" : "none";
      });
    });
  });
}

/* =========================
   RENDER
========================= */

function renderShow(item = {}) {
  const title = titleOf(item, "Untitled Show");
  const coverUrl = coverOf(item);

  const card = document.createElement("article");
  card.className = "rb-content-card rb-podcast-card";
  card.dataset.creatorId = item.user_id || item.creator_id || "";
  card.dataset.profileLocked = card.dataset.creatorId ? "true" : "false";
  card.dataset.showId = item.id || "";

  card.innerHTML = `
    <img
      class="rb-card-cover"
      src="${escapeHtml(coverUrl)}"
      alt="${escapeHtml(title)}"
      loading="lazy"
    />

    <div class="rb-card-body">
      <p class="rb-kicker">${escapeHtml(safe(item.category, "PODCAST SHOW"))}</p>

      <h3>${escapeHtml(title)}</h3>

      <p>${escapeHtml(safe(item.description, "Rich Bizness podcast show."))}</p>

      <div class="rb-card-meta">
        <span>${escapeHtml(creatorLine(item))}</span>
        <span>${escapeHtml(niceDate(item.created_at))}</span>
      </div>

      <div class="rb-chip-row">
        <span class="rb-chip">${numberOf(item.episode_count)} episodes</span>
        <span class="rb-chip">${numberOf(item.subscriber_count)} subs</span>
        <span class="rb-chip">${numberOf(item.play_count)} plays</span>
      </div>
    </div>
  `;

  return card;
}

function renderEpisode(item = {}) {
  const title = titleOf(item, "Untitled Episode");
  const coverUrl = coverOf(item);
  const audioUrl = audioOf(item);

  const card = document.createElement("article");
  card.className = "rb-content-card rb-podcast-card";
  card.dataset.creatorId = item.user_id || item.creator_id || "";
  card.dataset.profileLocked = card.dataset.creatorId ? "true" : "false";
  card.dataset.episodeId = item.id || "";

  card.innerHTML = `
    <img
      class="rb-card-cover"
      src="${escapeHtml(coverUrl)}"
      alt="${escapeHtml(title)}"
      loading="lazy"
    />

    <div class="rb-card-body">
      <p class="rb-kicker">
        EP ${numberOf(item.episode_number, 1)} • SEASON ${numberOf(item.season_number, 1)}
      </p>

      <h3>${escapeHtml(title)}</h3>

      <p>${escapeHtml(safe(item.description, "Podcast episode from Rich Bizness."))}</p>

      <div class="rb-card-meta">
        <span>${escapeHtml(creatorLine(item))}</span>
        <span>${escapeHtml(niceDate(item.created_at))}</span>
      </div>

      <div class="rb-chip-row">
        <span class="rb-chip">${numberOf(item.play_count)} plays</span>
        <span class="rb-chip">${numberOf(item.like_count)} likes</span>
        <span class="rb-chip">${numberOf(item.comment_count)} comments</span>
      </div>

      <button
        type="button"
        class="rb-main-launch"
        ${audioUrl ? "" : "disabled"}
      >
        PLAY EPISODE
      </button>
    </div>
  `;

  card.querySelector("button")?.addEventListener("click", () => {
    playEpisode(item);
  });

  return card;
}

/* =========================
   SAFE QUERY HELPERS
========================= */

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
      console.warn(`[RB PODCAST SAFE QUERY FAILED] ${tableName}: ${attempt.name}`, error?.message || error);
    }
  }

  throw lastError || new Error(`Failed to load ${tableName}.`);
}

async function loadShows() {
  const showsTable = table("podcastShows", "podcast_shows");

  try {
    const shows = await safeLoadTable({
      table: showsTable,
      limit: 30,
      attempts: [
        {
          name: "is_published_featured_created",
          filter: (q) => q.eq("is_published", true),
          order: (q) =>
            q
              .order("is_featured", { ascending: false })
              .order("created_at", { ascending: false })
        },
        {
          name: "status_published",
          filter: (q) => q.in("status", ["published", "active", "live"])
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

    setCount(els.showCount, shows.length);

    if (!shows.length) {
      setEmpty(els.showsList, "No podcast shows yet.");
      return shows;
    }

    if (els.showsList) {
      els.showsList.innerHTML = "";
      shows.forEach((item) => {
        els.showsList.appendChild(renderShow(item));
      });
    }

    return shows;
  } catch (error) {
    console.error("[RB PODCAST SHOWS FAILED]", error);
    setCount(els.showCount, 0);
    setEmpty(els.showsList, error?.message || "Podcast shows failed to load.");
    return [];
  }
}

async function loadEpisodes() {
  const episodesTable = table("podcastEpisodes", "podcast_episodes");

  try {
    const episodes = await safeLoadTable({
      table: episodesTable,
      limit: 40,
      attempts: [
        {
          name: "is_published_featured_created",
          filter: (q) => q.eq("is_published", true),
          order: (q) =>
            q
              .order("is_featured", { ascending: false })
              .order("created_at", { ascending: false })
        },
        {
          name: "status_published",
          filter: (q) => q.in("status", ["published", "active", "live"])
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

    setCount(els.episodeCount, episodes.length);

    const totalComments = episodes.reduce(
      (sum, item) => sum + numberOf(item.comment_count),
      0
    );

    const totalLikes = episodes.reduce(
      (sum, item) => sum + numberOf(item.like_count),
      0
    );

    setCount(els.commentCount, totalComments);
    setCount(els.likeCount, totalLikes);

    if (!episodes.length) {
      setEmpty(els.episodesList, "No podcast episodes yet.");
      setEmpty(els.featuredList, "No featured podcast episodes yet.");
      return episodes;
    }

    if (els.episodesList) {
      els.episodesList.innerHTML = "";
      episodes.forEach((item) => {
        els.episodesList.appendChild(renderEpisode(item));
      });
    }

    const featured = episodes.filter(isFeatured).slice(0, 12);
    const finalFeatured = featured.length ? featured : episodes.slice(0, 8);

    if (els.featuredList) {
      els.featuredList.innerHTML = "";
      finalFeatured.forEach((item) => {
        els.featuredList.appendChild(renderEpisode(item));
      });
    }

    return episodes;
  } catch (error) {
    console.error("[RB PODCAST EPISODES FAILED]", error);

    setCount(els.episodeCount, 0);
    setCount(els.commentCount, 0);
    setCount(els.likeCount, 0);

    setEmpty(els.episodesList, error?.message || "Podcast episodes failed to load.");
    setEmpty(els.featuredList, error?.message || "Featured podcast episodes failed to load.");

    return [];
  }
}

async function loadPodcastPage() {
  await Promise.allSettled([
    loadShows(),
    loadEpisodes()
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
    .channel(`rb-podcast-${tableName}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: tableName
      },
      () => loadPodcastPage().catch(console.error)
    )
    .subscribe();
}

function bindRealtime() {
  clearRealtime();

  channels = [
    watchTable(table("podcastShows", "podcast_shows")),
    watchTable(table("podcastEpisodes", "podcast_episodes")),
    watchTable(table("podcastComments", "podcast_comments")),
    watchTable(table("podcastLikes", "podcast_likes"))
  ].filter(Boolean);
}

/* =========================
   BOOT
========================= */

async function bootPodcastPage() {
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

    await loadPodcastPage();

    bindRealtime();

    window.addEventListener("beforeunload", clearRealtime);

    document.body.dataset.rbPage = "podcast";
    document.body.dataset.rbRoute = "podcast";
    document.body.dataset.rbProfileLock = profileIdentity?.id ? "true" : "false";
    document.body.classList.add("rb-podcast-ready");

    markPageReady("podcast");

    console.log("RB PODCAST READY", {
      profileLocked: !!profileIdentity?.id,
      route: "podcast"
    });
  } catch (error) {
    console.error("[RB PODCAST BOOT FAILED]", error);

    setEmpty(els.showsList, error?.message || "Podcast shows failed to load.");
    setEmpty(els.episodesList, error?.message || "Podcast episodes failed to load.");
    setEmpty(els.featuredList, error?.message || "Featured podcast episodes failed to load.");

    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootPodcastPage);
} else {
  bootPodcastPage();
}
