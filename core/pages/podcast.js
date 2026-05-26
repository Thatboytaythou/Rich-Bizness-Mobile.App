/* =========================
   RICH BIZNESS MOBILE
   /core/pages/podcast.js

   PODCAST PAGE CONTROLLER
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

function syncProfileKeys() {
  const state = getCurrentUserState?.() || {};

  currentUser = state.user || null;
  currentProfile = state.profile || null;
  profileIdentity = getProfileIdentity(currentProfile);

  document.body.dataset.rbRoute = "podcast";
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
  if (!date) return "Just dropped";

  return new Date(date).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function creatorLine(item) {
  return item?.display_name || item?.username || "Rich Bizness Podcast";
}

function playEpisode(item) {
  if (els.nowCover) {
    els.nowCover.src = item.cover_url || FALLBACK_COVER;
  }

  if (els.nowTitle) {
    els.nowTitle.textContent = item.title || "Untitled Episode";
  }

  if (els.nowMeta) {
    els.nowMeta.textContent = `${creatorLine(item)} • Episode ${item.episode_number || 1}`;
  }

  if (els.audioPlayer && item.audio_url) {
    els.audioPlayer.src = item.audio_url;
    els.audioPlayer.play().catch(() => {});
  }
}

function bindTabs() {
  $$("[data-podcast-tab]").forEach((button) => {
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

function renderShow(item) {
  const card = document.createElement("article");
  card.className = "rb-content-card rb-podcast-card";
  card.dataset.creatorId = item.user_id || "";
  card.dataset.profileLocked = item.user_id ? "true" : "false";

  card.innerHTML = `
    <img class="rb-card-cover" src="${item.cover_url || FALLBACK_COVER}" alt="${safe(item.title, "Podcast show")}" loading="lazy" />

    <div class="rb-card-body">
      <p class="rb-kicker">${safe(item.category, "PODCAST SHOW")}</p>
      <h3>${safe(item.title, "Untitled Show")}</h3>
      <p>${safe(item.description, "Rich Bizness podcast show.")}</p>

      <div class="rb-card-meta">
        <span>${creatorLine(item)}</span>
        <span>${niceDate(item.created_at)}</span>
      </div>

      <div class="rb-chip-row">
        <span class="rb-chip">${item.episode_count || 0} episodes</span>
        <span class="rb-chip">${item.subscriber_count || 0} subs</span>
        <span class="rb-chip">${item.play_count || 0} plays</span>
      </div>
    </div>
  `;

  return card;
}

function renderEpisode(item) {
  const card = document.createElement("article");
  card.className = "rb-content-card rb-podcast-card";
  card.dataset.creatorId = item.user_id || "";
  card.dataset.profileLocked = item.user_id ? "true" : "false";

  card.innerHTML = `
    <img class="rb-card-cover" src="${item.cover_url || FALLBACK_COVER}" alt="${safe(item.title, "Podcast episode")}" loading="lazy" />

    <div class="rb-card-body">
      <p class="rb-kicker">EP ${item.episode_number || 1} • SEASON ${item.season_number || 1}</p>
      <h3>${safe(item.title, "Untitled Episode")}</h3>
      <p>${safe(item.description, "Podcast episode from Rich Bizness.")}</p>

      <div class="rb-card-meta">
        <span>${creatorLine(item)}</span>
        <span>${niceDate(item.created_at)}</span>
      </div>

      <div class="rb-chip-row">
        <span class="rb-chip">${item.play_count || 0} plays</span>
        <span class="rb-chip">${item.like_count || 0} likes</span>
        <span class="rb-chip">${item.comment_count || 0} comments</span>
      </div>

      <button type="button" class="rb-main-launch">PLAY EPISODE</button>
    </div>
  `;

  card.querySelector("button")?.addEventListener("click", () => {
    playEpisode(item);
  });

  return card;
}

async function loadShows() {
  const { data, error } = await supabase
    .from(RB_TABLES.podcastShows)
    .select("*")
    .eq("is_published", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  const shows = data || [];

  if (els.showCount) els.showCount.textContent = shows.length;

  if (!shows.length) {
    setEmpty(els.showsList, "No podcast shows yet.");
    return;
  }

  els.showsList.innerHTML = "";
  shows.forEach((item) => els.showsList.appendChild(renderShow(item)));
}

async function loadEpisodes() {
  const { data, error } = await supabase
    .from(RB_TABLES.podcastEpisodes)
    .select("*")
    .eq("is_published", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) throw error;

  const episodes = data || [];

  if (els.episodeCount) els.episodeCount.textContent = episodes.length;

  const totalComments = episodes.reduce(
    (sum, item) => sum + Number(item.comment_count || 0),
    0
  );

  const totalLikes = episodes.reduce(
    (sum, item) => sum + Number(item.like_count || 0),
    0
  );

  if (els.commentCount) els.commentCount.textContent = totalComments;
  if (els.likeCount) els.likeCount.textContent = totalLikes;

  if (!episodes.length) {
    setEmpty(els.episodesList, "No podcast episodes yet.");
    setEmpty(els.featuredList, "No featured podcast episodes yet.");
    return;
  }

  els.episodesList.innerHTML = "";
  episodes.forEach((item) => els.episodesList.appendChild(renderEpisode(item)));

  const featured = episodes.filter((item) => item.is_featured).slice(0, 12);
  const finalFeatured = featured.length ? featured : episodes.slice(0, 8);

  els.featuredList.innerHTML = "";
  finalFeatured.forEach((item) => els.featuredList.appendChild(renderEpisode(item)));
}

async function loadPodcastPage() {
  await Promise.all([
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

function bindRealtime() {
  const reload = () => loadPodcastPage().catch(console.error);

  clearRealtime();

  channels = [
    RB_TABLES.podcastShows,
    RB_TABLES.podcastEpisodes,
    RB_TABLES.podcastComments,
    RB_TABLES.podcastLikes
  ].map((table) =>
    supabase
      .channel(`rb-podcast-${table}`)
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

async function bootPodcastPage() {
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
    console.error("[podcast.js]", error);

    setEmpty(els.showsList, "Podcast shows failed to load.");
    setEmpty(els.episodesList, "Podcast episodes failed to load.");
    setEmpty(els.featuredList, "Featured podcast episodes failed to load.");

    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootPodcastPage);
} else {
  bootPodcastPage();
}
