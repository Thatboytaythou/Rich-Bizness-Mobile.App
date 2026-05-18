/* =========================
   RICH BIZNESS MOBILE
   /core/pages/sports.js

   SPORTS PAGE CONTROLLER
   Posts + Picks + Uploads + Broadcasts + Profiles + Teams
========================= */

import {
  initApp,
  markPageReady,
  markPageError
} from "/core/app.js";

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

const FALLBACK_COVER = "/images/brand/hero-banner.png";

const TABLES = {
  sportsPosts: RB_TABLES?.sportsPosts || RB_TABLES?.sports_posts || "sports_posts",
  sportsPicks: RB_TABLES?.sportsPicks || RB_TABLES?.sports_picks || "sports_picks",
  sportsUploads: RB_TABLES?.sportsUploads || RB_TABLES?.sports_uploads || "sports_uploads",
  sportsBroadcasts: RB_TABLES?.sportsBroadcasts || RB_TABLES?.sports_broadcasts || "sports_broadcasts",
  sportsProfiles: RB_TABLES?.sportsProfiles || RB_TABLES?.sports_profiles || "sports_profiles",
  sportsTeams: RB_TABLES?.sportsTeams || RB_TABLES?.sports_teams || "sports_teams"
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

function safe(value, fallback = "") {
  return value || fallback;
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
  return item?.display_name || item?.username || "Rich Bizness Sports";
}

function setEmpty(target, text) {
  if (!target) return;
  target.innerHTML = `<p class="rb-empty">${text}</p>`;
}

function mediaImage(item) {
  return (
    item?.cover_url ||
    item?.thumbnail_url ||
    item?.media_url ||
    item?.file_url ||
    item?.logo_url ||
    FALLBACK_COVER
  );
}

function bindTabs() {
  $$("[data-sports-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.sportsTab;

      $$("[data-sports-tab]").forEach((btn) => {
        btn.classList.toggle("is-active", btn === button);
      });

      $$("[data-sports-panel]").forEach((panel) => {
        panel.classList.toggle(
          "is-active",
          panel.dataset.sportsPanel === tab
        );
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
  badges = []
}) {
  const card = document.createElement("article");
  card.className = "rb-content-card rb-sports-card";

  card.innerHTML = `
    <img class="rb-card-cover" src="${image || FALLBACK_COVER}" alt="${title}" loading="lazy" />

    <div class="rb-card-body">
      <p class="rb-kicker">${kicker}</p>
      <h3>${title}</h3>
      <p>${body}</p>

      <div class="rb-card-meta">
        <span>${meta}</span>
      </div>

      <div class="rb-chip-row">
        ${badges.map((badge) => `<span class="rb-chip">${badge}</span>`).join("")}
      </div>
    </div>
  `;

  return card;
}

function renderPost(item) {
  return cardTemplate({
    kicker: item.sport || item.league || "SPORTS POST",
    title: item.title || "Sports Post",
    body: safe(item.body, "No caption yet."),
    image: mediaImage(item),
    meta: `${creatorLine(item)} • ${niceDate(item.created_at)}`,
    badges: [
      item.team_name,
      `${item.like_count || 0} likes`,
      `${item.comment_count || 0} comments`,
      `${item.view_count || 0} views`
    ].filter(Boolean)
  });
}

function renderPick(item) {
  return cardTemplate({
    kicker: item.sport || item.league || "PICK",
    title: item.title || `${item.team_name || "Team"} Pick`,
    body: safe(item.prediction, "Prediction locked in."),
    image: FALLBACK_COVER,
    meta: `${creatorLine(item)} • ${niceDate(item.created_at)}`,
    badges: [
      item.team_name,
      item.opponent ? `vs ${item.opponent}` : "",
      item.result || "pending",
      `${item.confidence || 0}% confidence`
    ].filter(Boolean)
  });
}

function renderUpload(item) {
  return cardTemplate({
    kicker: item.content_type || item.clip_type || "UPLOAD",
    title: item.title || "Sports Highlight",
    body: safe(item.caption, "Sports clip uploaded to Rich Bizness."),
    image: mediaImage(item),
    meta: `${creatorLine(item)} • ${niceDate(item.created_at)}`,
    badges: [
      item.sport_name,
      item.team_name,
      item.athlete_name,
      `${item.views || 0} views`,
      `${item.likes || 0} likes`
    ].filter(Boolean)
  });
}

function renderBroadcast(item) {
  return cardTemplate({
    kicker: item.status || "BROADCAST",
    title: item.title || "Sports Broadcast",
    body: safe(item.description, "Live sports broadcast."),
    image: mediaImage(item),
    meta: `${creatorLine(item)} • ${niceDate(item.scheduled_for || item.created_at)}`,
    badges: [
      item.sport,
      item.league,
      item.team_name,
      item.access_type,
      `${item.viewer_count || 0} watching`
    ].filter(Boolean)
  });
}

function renderProfile(item) {
  return cardTemplate({
    kicker: item.rank_title || "FAN PROFILE",
    title: item.display_name || item.username || item.fan_tag || "Sports Fan",
    body: safe(item.bio, "Rich Bizness sports fan."),
    image: FALLBACK_COVER,
    meta: `${item.favorite_team || "No team yet"} • ${item.favorite_sport || "Sports"}`,
    badges: [
      item.fan_tag,
      `${item.points || 0} pts`,
      `${item.win_count || 0}W`,
      `${item.loss_count || 0}L`
    ].filter(Boolean)
  });
}

function renderTeam(item) {
  return cardTemplate({
    kicker: item.sport || "TEAM",
    title: item.team_name || item.title || "Sports Team",
    body: safe(item.city, "Rich Bizness sports team."),
    image: mediaImage(item),
    meta: `${item.wins || 0}W • ${item.losses || 0}L`,
    badges: [
      item.slug,
      item.city,
      item.sport
    ].filter(Boolean)
  });
}

async function loadPosts() {
  const { data, error } = await supabase
    .from(TABLES.sportsPosts)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (els.postCount) els.postCount.textContent = data?.length || 0;

  if (!data?.length) {
    setEmpty(els.postsList, "No sports posts yet.");
    return;
  }

  els.postsList.innerHTML = "";
  data.forEach((item) => els.postsList.appendChild(renderPost(item)));
}

async function loadPicks() {
  const { data, error } = await supabase
    .from(TABLES.sportsPicks)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (els.pickCount) els.pickCount.textContent = data?.length || 0;

  if (!data?.length) {
    setEmpty(els.picksList, "No sports picks yet.");
    return;
  }

  els.picksList.innerHTML = "";
  data.forEach((item) => els.picksList.appendChild(renderPick(item)));
}

async function loadUploads() {
  const { data, error } = await supabase
    .from(TABLES.sportsUploads)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (els.uploadCount) els.uploadCount.textContent = data?.length || 0;

  if (!data?.length) {
    setEmpty(els.uploadsList, "No sports uploads yet.");
    return;
  }

  els.uploadsList.innerHTML = "";
  data.forEach((item) => els.uploadsList.appendChild(renderUpload(item)));
}

async function loadBroadcasts() {
  const { data, error } = await supabase
    .from(TABLES.sportsBroadcasts)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (els.broadcastCount) els.broadcastCount.textContent = data?.length || 0;

  if (!data?.length) {
    setEmpty(els.broadcastsList, "No broadcasts yet.");
    return;
  }

  els.broadcastsList.innerHTML = "";
  data.forEach((item) => els.broadcastsList.appendChild(renderBroadcast(item)));
}

async function loadProfiles() {
  const { data, error } = await supabase
    .from(TABLES.sportsProfiles)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  if (!data?.length) {
    setEmpty(els.profilesList, "No sports fan profiles yet.");
    return;
  }

  els.profilesList.innerHTML = "";
  data.forEach((item) => els.profilesList.appendChild(renderProfile(item)));
}

async function loadTeams() {
  const { data, error } = await supabase
    .from(TABLES.sportsTeams)
    .select("*")
    .order("team_name", { ascending: true })
    .limit(50);

  if (error) throw error;

  if (!data?.length) {
    setEmpty(els.teamsList, "No teams loaded yet.");
    return;
  }

  els.teamsList.innerHTML = "";
  data.forEach((item) => els.teamsList.appendChild(renderTeam(item)));
}

async function loadSportsPage() {
  await Promise.all([
    loadPosts(),
    loadPicks(),
    loadUploads(),
    loadBroadcasts(),
    loadProfiles(),
    loadTeams()
  ]);
}

function bindRealtime() {
  const reload = () => loadSportsPage().catch(console.error);

  channels.forEach((channel) => {
    supabase.removeChannel(channel);
  });

  channels = [
    TABLES.sportsPosts,
    TABLES.sportsPicks,
    TABLES.sportsUploads,
    TABLES.sportsBroadcasts,
    TABLES.sportsProfiles,
    TABLES.sportsTeams
  ].map((table) =>
    supabase
      .channel(`rb-${table}`)
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

async function bootSportsPage() {
  try {
    await initApp({
      guard: false,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    bindTabs();

    await loadSportsPage();

    bindRealtime();

    document.body.classList.add("rb-sports-ready");

    markPageReady("sports");

    console.log("RB SPORTS READY");
  } catch (error) {
    console.error(error);

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
