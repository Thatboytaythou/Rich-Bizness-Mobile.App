/* =========================
   RICH BIZNESS MOBILE
   /core/pages/podcast.js

   PODCAST PAGE CONTROLLER
   Shows + Episodes + Featured
   Profile Keys Locked
   Safe Loader + Realtime Enabled
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
  audioPlayer: $("podcast-audio-player")
};

let supabase = null;
let channels = [];
let currentUser = null;
let currentProfile = null;
let profileIdentity = null;
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
  return (
    item.cover_url ||
    item.image_url ||
    item.thumbnail_url ||
    item.show_cover_url ||
    FALLBACK_COVER
  );
}

function audioOf(item = {}) {
  return (
    item.audio_url ||
    item.file_url ||
    item.media_url ||
    item.url ||
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
}

function playEpisode(item = {}) {
  const title = titleOf(item, "Untitled Episode");
  const coverUrl = coverOf(item);
  const audioUrl = audioOf(item);

  if (els.nowCover) {
    els.nowCover.src = coverUrl;
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

function bindTabs() {
  $$("[data-podcast-tab]").forEach((button) => {
    if (button.dataset.rbPodcastTabBound === "true") return;
    button.dataset.rbPodcastTabBound = "true";

    button.addEventListener("click", () => {
      const tab = button.dataset.podcastTab;

      $$("[data-podcast-tab]").forEach((btn) => {
        btn.classList.toggle("is-active", btn === button);
      });

      $$("[data-podcast-panel]").forEach((panel) => {
        panel.classList.toggle(
          "is-active",
          panel.dataset.podcastPanel === tab
        );
      });
    });
  });
}

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
  table,
  limit = 40,
  orderBy = "created_at",
  attempts = []
}) {
  if (!table) return [];

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
      console.warn(`[RB PODCAST SAFE QUERY FAILED] ${table}: ${attempt.name}`, error?.message || error);
    }
  }

  throw lastError || new Error(`Failed to load ${table}.`);
}

async function loadShows() {
  if (!RB_TABLES.podcastShows) {
    setCount(els.showCount, 0);
    setEmpty(els.showsList, "Podcast shows table is not configured.");
    return [];
  }

  try {
    const shows = await safeLoadTable({
      table: RB_TABLES.podcastShows,
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
  try {
    const episodes = await safeLoadTable({
      table: RB_TABLES.podcastEpisodes,
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

function clearRealtime() {
  channels.forEach((channel) => {
    supabase?.removeChannel(channel);
  });

  channels = [];
}

function watchTable(table) {
  if (!table) return null;

  return supabase
    .channel(`rb-podcast-${table}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table
      },
      () => loadPodcastPage().catch(console.error)
    )
    .subscribe();
}

function bindRealtime() {
  clearRealtime();

  channels = [
    watchTable(RB_TABLES.podcastShows),
    watchTable(RB_TABLES.podcastEpisodes),
    watchTable(RB_TABLES.podcastComments),
    watchTable(RB_TABLES.podcastLikes)
  ].filter(Boolean);
}

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
