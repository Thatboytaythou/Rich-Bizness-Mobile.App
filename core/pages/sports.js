/* =========================
   RICH BIZNESS MOBILE
   /core/pages/sports.js

   SPORTS PAGE CONTROLLER
   Profile Keys Locked

   Updates:
   - No project-avatar fallback
   - Safe HTML escaping
   - Direct table fallbacks
   - Tabs bind once
   - Realtime reload guarded
   - Video/audio media support for uploads/posts
   - Profile/meta-compatible activity detail
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

const TABLES = {
  sportsPosts: RB_TABLES?.sportsPosts || "sports_posts",
  sportsPicks: RB_TABLES?.sportsPicks || "sports_picks",
  sportsUploads: RB_TABLES?.sportsUploads || "sports_uploads",
  sportsBroadcasts: RB_TABLES?.sportsBroadcasts || "sports_broadcasts",
  sportsProfiles: RB_TABLES?.sportsProfiles || "sports_profiles",
  sportsTeams: RB_TABLES?.sportsTeams || "sports_teams"
};

const els = {
  postCount: $("sports-post-count"),
  pickCount: $("sports-pick-count"),
  broadcastCount: $("sports-broadcast-count"),
  uploadCount: $("sports-upload-count"),

  postsList: $("sports-posts-list"),
  picksList: $("sports-picks-list"),
  uploadsList: $("sports-uploads-list"),
  broadcastsList: $("sports-broadcasts-list"),
  profilesList: $("sports-profiles-list"),
  teamsList: $("sports-teams-list")
};

let supabase = null;
let channels = [];
let currentUser = null;
let currentProfile = null;
let profileIdentity = null;
let tabsBound = false;
let loading = false;

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function safePath(value = "", fallback = FALLBACK_COVER) {
  const src = String(value || "").trim();

  if (!src || src.includes("project-avatar")) return fallback;

  if (
    src.startsWith("/") ||
    src.startsWith("https://") ||
    src.startsWith("http://") ||
    src.startsWith("blob:")
  ) {
    return src;
  }

  return fallback;
}

function syncProfileKeys() {
  const state = getCurrentUserState?.() || {};

  currentUser = state.user || null;
  currentProfile = state.profile || null;
  profileIdentity = getProfileIdentity(currentProfile);

  document.body.dataset.rbRoute = "sports";
  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = profileIdentity?.id || "";
  document.body.dataset.rbProfileLocked = profileIdentity?.id ? "true" : "false";

  bindProfileShell?.();

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl(currentProfile);
  });
}

function niceDate(date) {
  if (!date) return "Just now";

  return new Date(date).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function creatorLine(item = {}) {
  return item.display_name || item.username || "Rich Bizness Sports";
}

function setEmpty(target, text) {
  if (!target) return;
  target.innerHTML = `<p class="rb-empty">${escapeHtml(text)}</p>`;
}

function mediaImage(item = {}) {
  return safePath(
    item.cover_url ||
      item.thumbnail_url ||
      item.media_url ||
      item.file_url ||
      item.logo_url,
    FALLBACK_COVER
  );
}

function mediaMarkup(item = {}) {
  const url = safePath(item.media_url || item.file_url || item.cover_url || item.thumbnail_url, "");
  if (!url) return "";

  const lower = url.toLowerCase();

  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(lower) || item.media_type === "video") {
    return `
      <video
        class="rb-card-cover"
        src="${escapeHtml(url)}"
        controls
        playsinline
      ></video>
    `;
  }

  if (/\.(mp3|wav|m4a|ogg)(\?|$)/.test(lower) || item.media_type === "audio") {
    return `
      <div class="rb-card-audio-wrap">
        <img
          class="rb-card-cover"
          src="${escapeHtml(mediaImage(item))}"
          alt=""
          loading="lazy"
        />
        <audio src="${escapeHtml(url)}" controls></audio>
      </div>
    `;
  }

  return `
    <img
      class="rb-card-cover"
      src="${escapeHtml(mediaImage(item))}"
      alt=""
      loading="lazy"
    />
  `;
}

function bindTabs() {
  if (tabsBound) return;
  tabsBound = true;

  $$("[data-sports-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.sportsTab;

      $$("[data-sports-tab]").forEach((btn) => {
        btn.classList.toggle("is-active", btn === button);
      });

      $$("[data-sports-panel]").forEach((panel) => {
        const active = panel.dataset.sportsPanel === tab;
        panel.classList.toggle("is-active", active);
        panel.style.display = active ? "block" : "none";
      });
    });
  });
}

function cardTemplate({
  kicker = "SPORTS",
  title = "Untitled",
  body = "",
  image = FALLBACK_COVER,
  meta = "",
  badges = [],
  creatorId = "",
  media = ""
}) {
  const card = document.createElement("article");

  card.className = "rb-content-card rb-sports-card";
  card.dataset.creatorId = creatorId || "";
  card.dataset.profileLocked = creatorId ? "true" : "false";

  card.innerHTML = `
    ${
      media ||
      `
        <img
          class="rb-card-cover"
          src="${escapeHtml(safePath(image, FALLBACK_COVER))}"
          alt="${escapeHtml(title)}"
          loading="lazy"
        />
      `
    }

    <div class="rb-card-body">
      <p class="rb-kicker">${escapeHtml(kicker)}</p>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>

      <div class="rb-card-meta">
        <span>${escapeHtml(meta)}</span>
      </div>

      <div class="rb-chip-row">
        ${badges
          .filter(Boolean)
          .map((badge) => `<span class="rb-chip">${escapeHtml(badge)}</span>`)
          .join("")}
      </div>
    </div>
  `;

  return card;
}

function renderPost(item = {}) {
  return cardTemplate({
    kicker: item.sport || item.league || "SPORTS POST",
    title: item.title || "Sports Post",
    body: safeText(item.body, "No caption yet."),
    image: mediaImage(item),
    media: mediaMarkup(item),
    meta: `${creatorLine(item)} • ${niceDate(item.created_at)}`,
    creatorId: item.user_id,
    badges: [
      item.team_name,
      `${Number(item.like_count || 0).toLocaleString()} likes`,
      `${Number(item.comment_count || 0).toLocaleString()} comments`,
      `${Number(item.view_count || 0).toLocaleString()} views`
    ]
  });
}

function renderPick(item = {}) {
  return cardTemplate({
    kicker: item.sport || item.league || "PICK",
    title: item.title || `${item.team_name || "Team"} Pick`,
    body: safeText(item.prediction, "Prediction locked in."),
    image: FALLBACK_COVER,
    meta: `${creatorLine(item)} • ${niceDate(item.created_at)}`,
    creatorId: item.user_id,
    badges: [
      item.team_name,
      item.opponent ? `vs ${item.opponent}` : "",
      item.result || "pending",
      `${Number(item.confidence || 0)}% confidence`
    ]
  });
}

function renderUpload(item = {}) {
  return cardTemplate({
    kicker: item.content_type || item.clip_type || "UPLOAD",
    title: item.title || "Sports Highlight",
    body: safeText(item.caption, "Sports clip uploaded to Rich Bizness."),
    image: mediaImage(item),
    media: mediaMarkup(item),
    meta: `${creatorLine(item)} • ${niceDate(item.created_at)}`,
    creatorId: item.user_id,
    badges: [
      item.sport_name,
      item.team_name,
      item.athlete_name,
      `${Number(item.views || 0).toLocaleString()} views`,
      `${Number(item.likes || 0).toLocaleString()} likes`
    ]
  });
}

function renderBroadcast(item = {}) {
  return cardTemplate({
    kicker: item.status || "BROADCAST",
    title: item.title || "Sports Broadcast",
    body: safeText(item.description, "Live sports broadcast."),
    image: mediaImage(item),
    meta: `${creatorLine(item)} • ${niceDate(item.scheduled_for || item.created_at)}`,
    creatorId: item.user_id,
    badges: [
      item.sport,
      item.league,
      item.team_name,
      item.access_type,
      `${Number(item.viewer_count || 0).toLocaleString()} watching`
    ]
  });
}

function renderProfile(item = {}) {
  return cardTemplate({
    kicker: item.rank_title || "FAN PROFILE",
    title: item.display_name || item.username || item.fan_tag || "Sports Fan",
    body: safeText(item.bio, "Rich Bizness sports fan."),
    image: FALLBACK_AVATAR,
    meta: `${item.favorite_team || "No team yet"} • ${item.favorite_sport || "Sports"}`,
    creatorId: item.user_id,
    badges: [
      item.fan_tag,
      `${Number(item.points || 0).toLocaleString()} pts`,
      `${Number(item.win_count || 0)}W`,
      `${Number(item.loss_count || 0)}L`
    ]
  });
}

function renderTeam(item = {}) {
  return cardTemplate({
    kicker: item.sport || "TEAM",
    title: item.team_name || item.title || "Sports Team",
    body: safeText(item.city, "Rich Bizness sports team."),
    image: mediaImage(item),
    meta: `${Number(item.wins || 0)}W • ${Number(item.losses || 0)}L`,
    creatorId: "",
    badges: [
      item.slug,
      item.city,
      item.sport
    ]
  });
}

function paintList(target, data = [], renderer, emptyText) {
  if (!target) return;

  if (!data.length) {
    setEmpty(target, emptyText);
    return;
  }

  target.innerHTML = "";
  data.forEach((item) => target.appendChild(renderer(item)));
}

async function loadPosts() {
  const { data, error } = await supabase
    .from(TABLES.sportsPosts)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (els.postCount) els.postCount.textContent = String(data?.length || 0);
  paintList(els.postsList, data || [], renderPost, "No sports posts yet.");
}

async function loadPicks() {
  const { data, error } = await supabase
    .from(TABLES.sportsPicks)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (els.pickCount) els.pickCount.textContent = String(data?.length || 0);
  paintList(els.picksList, data || [], renderPick, "No sports picks yet.");
}

async function loadUploads() {
  const { data, error } = await supabase
    .from(TABLES.sportsUploads)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (els.uploadCount) els.uploadCount.textContent = String(data?.length || 0);
  paintList(els.uploadsList, data || [], renderUpload, "No sports uploads yet.");
}

async function loadBroadcasts() {
  const { data, error } = await supabase
    .from(TABLES.sportsBroadcasts)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (els.broadcastCount) els.broadcastCount.textContent = String(data?.length || 0);
  paintList(els.broadcastsList, data || [], renderBroadcast, "No broadcasts yet.");
}

async function loadProfiles() {
  const { data, error } = await supabase
    .from(TABLES.sportsProfiles)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  paintList(els.profilesList, data || [], renderProfile, "No sports fan profiles yet.");
}

async function loadTeams() {
  const { data, error } = await supabase
    .from(TABLES.sportsTeams)
    .select("*")
    .order("team_name", { ascending: true })
    .limit(50);

  if (error) throw error;

  paintList(els.teamsList, data || [], renderTeam, "No teams loaded yet.");
}

async function loadSportsPage() {
  if (loading) return;
  loading = true;

  try {
    await Promise.all([
      loadPosts(),
      loadPicks(),
      loadUploads(),
      loadBroadcasts(),
      loadProfiles(),
      loadTeams()
    ]);

    window.dispatchEvent(
      new CustomEvent("rb:sports-update", {
        detail: {
          route: "sports",
          profileLocked: !!profileIdentity?.id
        }
      })
    );
  } finally {
    loading = false;
  }
}

function clearRealtime() {
  channels.forEach((channel) => {
    supabase?.removeChannel(channel);
  });

  channels = [];
}

function bindRealtime() {
  const reload = () => loadSportsPage().catch(console.error);

  clearRealtime();

  channels = [
    TABLES.sportsPosts,
    TABLES.sportsPicks,
    TABLES.sportsUploads,
    TABLES.sportsBroadcasts,
    TABLES.sportsProfiles,
    TABLES.sportsTeams
  ].map((tableName) =>
    supabase
      .channel(`rb-sports-${tableName}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: tableName
        },
        reload
      )
      .subscribe()
  );
}

async function bootSportsPage() {
  try {
    await initApp({
      guard: false,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    syncProfileKeys();
    bindTabs();

    await loadSportsPage();

    bindRealtime();

    window.addEventListener("beforeunload", clearRealtime);

    document.body.dataset.rbPage = "sports";
    document.body.dataset.rbRoute = "sports";
    document.body.dataset.rbProfileLock = profileIdentity?.id ? "true" : "false";
    document.body.classList.add("rb-sports-ready");

    markPageReady("sports");

    console.log("RB SPORTS READY", {
      profileLocked: !!profileIdentity?.id,
      route: "sports"
    });
  } catch (error) {
    console.error("[sports.js]", error);

    setEmpty(els.postsList, "Sports posts failed to load.");
    setEmpty(els.picksList, "Sports picks failed to load.");
    setEmpty(els.uploadsList, "Sports uploads failed to load.");
    setEmpty(els.broadcastsList, "Sports broadcasts failed to load.");
    setEmpty(els.profilesList, "Sports profiles failed to load.");
    setEmpty(els.teamsList, "Sports teams failed to load.");

    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSportsPage);
} else {
  bootSportsPage();
}
