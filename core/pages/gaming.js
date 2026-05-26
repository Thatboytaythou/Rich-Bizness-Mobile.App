/* =========================
   RICH BIZNESS MOBILE
   /core/pages/gaming.js

   Gaming Page
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
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

import { getSupabase } from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity,
  bindProfileShell,
  buildProfileUrl,
  profileAvatar,
  profileName
} from "/core/shared/rb-profile.js";

const $ = (id) => document.getElementById(id);

const els = {
  tabs: document.querySelectorAll("[data-tab]"),
  panels: document.querySelectorAll("[data-panel]"),

  gameCount: $("game-count"),
  clipCount: $("clip-count"),
  scoreCount: $("score-count"),
  tournamentCount: $("tournament-count"),

  gamerName: $("gamer-name"),
  gamerMeta: $("gamer-meta"),
  gamerForm: $("gamer-profile-form"),
  gamerTagInput: $("gamerTagInput"),
  platformInput: $("platformInput"),

  gamesList: $("games-list"),
  clipsList: $("clips-list"),
  scoresList: $("scores-list"),
  tournamentsList: $("tournaments-list"),
  challengesList: $("challenges-list")
};

let supabase = null;
let authState = null;
let currentUser = null;
let currentProfile = null;
let gamerProfile = null;
let identity = null;
let channel = null;

const fallbackCover = "/images/brand/hero-banner.png";

function setText(el, value) {
  if (el) el.textContent = value ?? "";
}

function money(cents = 0) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function safeImage(url) {
  return url || fallbackCover;
}

function cardEmpty(target, text) {
  if (target) {
    target.innerHTML = `<article class="rb-empty-card">${text}</article>`;
  }
}

function lockProfileKeys() {
  identity = getProfileIdentity(currentProfile);

  document.body.dataset.rbRoute = "gaming";
  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = identity.id || "";
  document.body.dataset.rbProfileLocked = identity.id ? "true" : "false";

  bindProfileShell();

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl(currentProfile);
  });

  document.querySelectorAll("[data-rb-current-avatar]").forEach((el) => {
    if (el.tagName === "IMG") {
      el.src = profileAvatar(currentProfile);
      el.alt = profileName(currentProfile);
    } else {
      el.style.backgroundImage = `url("${profileAvatar(currentProfile)}")`;
    }
  });
}

function userIdentity() {
  return {
    username: currentProfile?.username || null,
    display_name:
      currentProfile?.display_name ||
      currentProfile?.full_name ||
      currentUser?.email?.split("@")[0] ||
      "Rich Gamer"
  };
}

function bindTabs() {
  els.tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.tab;

      els.tabs.forEach((item) => item.classList.remove("is-active"));

      els.panels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.panel === key);
      });

      btn.classList.add("is-active");
    });
  });
}

async function loadGamerProfile() {
  if (!currentUser?.id) {
    setText(els.gamerName, "Guest Player");
    setText(els.gamerMeta, "Sign in to sync your gamer profile.");
    return;
  }

  const { data, error } = await supabase
    .from(RB_TABLES.gamerProfiles)
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) throw error;

  gamerProfile = data || null;

  if (!gamerProfile) {
    setText(els.gamerName, identity.displayName || "Rich Gamer");
    setText(els.gamerMeta, "No gamer profile yet.");
    return;
  }

  setText(
    els.gamerName,
    gamerProfile.display_name || gamerProfile.gamer_tag || identity.displayName
  );

  setText(
    els.gamerMeta,
    `${gamerProfile.gamer_tag || "No tag"} • ${gamerProfile.platform_primary || "web"} • ${gamerProfile.rank_title || "Rookie"} • ${gamerProfile.xp || 0} XP`
  );

  if (els.gamerTagInput) els.gamerTagInput.value = gamerProfile.gamer_tag || "";
  if (els.platformInput) els.platformInput.value = gamerProfile.platform_primary || "web";
}

async function saveGamerProfile(event) {
  event.preventDefault();

  if (!currentUser?.id) {
    window.location.href = RB_ROUTES.auth;
    return;
  }

  const tag = els.gamerTagInput?.value?.trim() || "";
  const platform = els.platformInput?.value || "web";
  const info = userIdentity();

  const payload = {
    user_id: currentUser.id,
    username: info.username,
    display_name: info.display_name,
    gamer_tag: tag || info.username || info.display_name,
    platform_primary: platform,
    avatar_url: currentProfile?.avatar_url || "/images/brand/project-avatar.png.jpeg",
    banner_url: currentProfile?.banner_url || "/images/brand/Avatar-hero-Banner.png.jpeg",
    metadata: {
      source: "Rich Bizness Gaming",
      profile_locked: true
    },
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from(RB_TABLES.gamerProfiles)
    .upsert(payload, { onConflict: "user_id" });

  if (error) throw error;

  await loadGamerProfile();
}

function renderGames(rows = []) {
  if (!rows.length) return cardEmpty(els.gamesList, "No games loaded yet.");

  els.gamesList.innerHTML = rows.map((game) => `
    <article class="rb-game-card" data-game-id="${game.id || ""}">
      <img src="${safeImage(game.cover_url || game.thumbnail_url)}" alt="" />
      <div>
        <p class="rb-kicker">${game.game_type || "arcade"} • ${game.platform_type || "web"}</p>
        <h3>${game.title}</h3>
        <p>${game.description || "Rich Bizness game experience."}</p>
        <div class="rb-card-stats">
          <span>${game.total_plays || 0} plays</span>
          <span>${game.high_score || 0} high</span>
          <span>${game.active_players || 0} active</span>
        </div>
        <a class="rb-pill-btn" href="${game.play_url || `/games/${game.slug}/index.html`}">Play</a>
      </div>
    </article>
  `).join("");
}

function renderClips(rows = []) {
  if (!rows.length) return cardEmpty(els.clipsList, "No game clips yet.");

  els.clipsList.innerHTML = rows.map((clip) => `
    <article class="rb-game-card" data-owner-id="${clip.user_id || ""}">
      ${
        clip.thumbnail_url
          ? `<img src="${clip.thumbnail_url}" alt="" />`
          : `<video src="${clip.clip_url}" muted playsinline controls></video>`
      }
      <div>
        <p class="rb-kicker">${clip.game_slug || "gaming"} • @${clip.username || "player"}</p>
        <h3>${clip.title || "Game Clip"}</h3>
        <p>${clip.caption || ""}</p>
        <div class="rb-card-stats">
          <span>🔥 ${clip.like_count || 0}</span>
          <span>💬 ${clip.comment_count || 0}</span>
          <span>👁 ${clip.view_count || 0}</span>
        </div>
      </div>
    </article>
  `).join("");
}

function renderScores(rows = []) {
  if (!rows.length) return cardEmpty(els.scoresList, "No scores submitted yet.");

  els.scoresList.innerHTML = rows.map((score, index) => `
    <article class="rb-list-row" data-owner-id="${score.user_id || ""}">
      <strong>#${index + 1}</strong>
      <div>
        <h3>${score.display_name || score.username || "Rich Gamer"}</h3>
        <p>${score.game_slug || "game"} • ${score.mode || "arcade"} • ${score.anti_cheat_status || "pending"}</p>
      </div>
      <b>${score.score || 0}</b>
    </article>
  `).join("");
}

function renderTournaments(rows = []) {
  if (!rows.length) return cardEmpty(els.tournamentsList, "No tournaments open yet.");

  els.tournamentsList.innerHTML = rows.map((item) => `
    <article class="rb-game-card">
      <img src="${safeImage(item.cover_url)}" alt="" />
      <div>
        <p class="rb-kicker">${item.status || "draft"} • ${item.tournament_type || "bracket"}</p>
        <h3>${item.title}</h3>
        <p>${item.description || "Tournament event."}</p>
        <div class="rb-card-stats">
          <span>${item.current_players || 0}/${item.max_players || 0} players</span>
          <span>${money(item.prize_pool_cents)} prize</span>
          <span>${money(item.entry_fee_cents)} entry</span>
        </div>
      </div>
    </article>
  `).join("");
}

function renderChallenges(rows = []) {
  if (!rows.length) return cardEmpty(els.challengesList, "No challenges yet.");

  els.challengesList.innerHTML = rows.map((item) => `
    <article class="rb-game-card">
      <div>
        <p class="rb-kicker">${item.status || "pending"} • ${item.game_slug || "game"}</p>
        <h3>${item.title || "Game Challenge"}</h3>
        <p>Creator ${item.creator_score || 0} vs Opponent ${item.opponent_score || 0}</p>
        <div class="rb-card-stats">
          <span>${money(item.wager_cents)} wager</span>
          <span>${money(item.winner_amount_cents)} winner</span>
          <span>${item.trust_status || "pending"}</span>
        </div>
      </div>
    </article>
  `).join("");
}

async function loadGames() {
  const { data, error } = await supabase
    .from(RB_TABLES.games)
    .select("*")
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) throw error;

  setText(els.gameCount, data?.length || 0);
  renderGames(data || []);
}

async function loadClips() {
  const { data, error } = await supabase
    .from(RB_TABLES.gameClips)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) throw error;

  setText(els.clipCount, data?.length || 0);
  renderClips(data || []);
}

async function loadScores() {
  const { data, error } = await supabase
    .from(RB_TABLES.gameScores)
    .select("*")
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  setText(els.scoreCount, data?.length || 0);
  renderScores(data || []);
}

async function loadTournaments() {
  const { data, error } = await supabase
    .from(RB_TABLES.gameTournaments)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) throw error;

  setText(els.tournamentCount, data?.length || 0);
  renderTournaments(data || []);
}

async function loadChallenges() {
  const { data, error } = await supabase
    .from(RB_TABLES.gameChallenges)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) throw error;

  renderChallenges(data || []);
}

async function loadGamingPage() {
  await Promise.all([
    loadGamerProfile(),
    loadGames(),
    loadClips(),
    loadScores(),
    loadTournaments(),
    loadChallenges()
  ]);
}

function clearRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

function subscribeGaming() {
  clearRealtime();

  channel = supabase
    .channel("rb-gaming-page")
    .on("postgres_changes", { event: "*", schema: "public", table: RB_TABLES.games }, loadGames)
    .on("postgres_changes", { event: "*", schema: "public", table: RB_TABLES.gameClips }, loadClips)
    .on("postgres_changes", { event: "*", schema: "public", table: RB_TABLES.gameScores }, loadScores)
    .on("postgres_changes", { event: "*", schema: "public", table: RB_TABLES.gameTournaments }, loadTournaments)
    .on("postgres_changes", { event: "*", schema: "public", table: RB_TABLES.gameChallenges }, loadChallenges)
    .on("postgres_changes", { event: "*", schema: "public", table: RB_TABLES.gamerProfiles }, loadGamerProfile)
    .subscribe();
}

async function bootGamingPage() {
  try {
    authState = await initApp({
      guard: false,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    const state = getCurrentUserState?.() || authState || {};

    currentUser = state.user || authState?.user || null;
    currentProfile = state.profile || authState?.profile || null;

    lockProfileKeys();
    bindTabs();

    els.gamerForm?.addEventListener("submit", saveGamerProfile);

    await loadGamingPage();

    subscribeGaming();

    window.addEventListener("beforeunload", clearRealtime);

    document.body.classList.add("rb-gaming-ready");

    markPageReady("gaming");

    console.log("RB GAMING READY", {
      profileLocked: !!identity?.id,
      route: "gaming"
    });
  } catch (error) {
    console.error("[gaming.js]", error);
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootGamingPage);
} else {
  bootGamingPage();
}
