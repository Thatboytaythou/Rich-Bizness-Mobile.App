/* =========================
   RICH BIZNESS MOBILE
   /core/pages/gaming.js

   Gaming Page
   Profile Keys Locked
   Realtime Enabled
   Local Game Fallbacks Locked
   XP Gauge Enabled
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
  challengesList: $("challenges-list"),

  xpGauge: $("gaming-xp-gauge"),
  xpFill: $("gaming-xp-gauge-fill"),
  xpText: $("gaming-xp-gauge-text"),
  xpNext: $("gaming-xp-gauge-next"),
  xpLevel: $("gaming-xp-level"),
  xpRank: $("gaming-xp-rank")
};

let supabase = null;
let authState = null;
let currentUser = null;
let currentProfile = null;
let gamerProfile = null;
let identity = null;
let channel = null;

const fallbackCover = "/images/brand/hero-banner.png";
const fallbackAvatar = "/images/brand/Avatar-hero-Banner.png.jpeg";

const LOCAL_GAMES = [
  {
    id: "rich-chess-local",
    slug: "rich-chess",
    title: "Rich Chess",
    description:
      "Strategic Rich Bizness chess room with local and realtime match support.",
    game_type: "strategy",
    platform_type: "web",
    cover_url: "/images/brand/gaming-hero.png.jpeg",
    thumbnail_url: "/images/brand/gaming-hero.png.jpeg",
    play_url: "/games/rich-chess",
    total_plays: 0,
    high_score: 0,
    active_players: 0,
    is_featured: true,
    is_active: true
  },
  {
    id: "money-road-runner-local",
    slug: "money-road-runner",
    title: "Money Road Runner",
    description: "Run the money road and stack points.",
    game_type: "runner",
    platform_type: "web",
    cover_url: "/images/brand/7F5D6348-B3DF-4584-A206-7F98B8BB0D53.png",
    thumbnail_url: "/images/brand/7F5D6348-B3DF-4584-A206-7F98B8BB0D53.png",
    play_url: "/games/money-road-runner",
    total_plays: 0,
    high_score: 0,
    active_players: 0,
    is_featured: false,
    is_active: true
  },
  {
    id: "smoke-city-hustle-local",
    slug: "smoke-city-hustle",
    title: "Smoke City Hustle",
    description: "Street-style Rich Bizness arcade mission.",
    game_type: "arcade",
    platform_type: "web",
    cover_url: "/images/C54535CD-E2B2-481B-81C8-4CFA81CC2ACD.png",
    thumbnail_url: "/images/C54535CD-E2B2-481B-81C8-4CFA81CC2ACD.png",
    play_url: "/games/smoke-city-hustle",
    total_plays: 0,
    high_score: 0,
    active_players: 0,
    is_featured: false,
    is_active: true
  },
  {
    id: "studio-showdown-local",
    slug: "studio-showdown",
    title: "Studio Showdown",
    description: "Creator battle arcade mode for Rich Bizness players.",
    game_type: "battle",
    platform_type: "web",
    cover_url: "/images/D8F60174-7E0C-44AF-A4AB-496AB7ADEC52.png",
    thumbnail_url: "/images/D8F60174-7E0C-44AF-A4AB-496AB7ADEC52.png",
    play_url: "/games/studio-showdown",
    total_plays: 0,
    high_score: 0,
    active_players: 0,
    is_featured: false,
    is_active: true
  }
];

function setText(el, value) {
  if (el) el.textContent = value ?? "";
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(cents = 0) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function safeImage(url, fallback = fallbackCover) {
  const src = String(url || "").trim();

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

/* =========================
   XP GAUGE
========================= */

function getProfileXpModel() {
  const rawXp =
    gamerProfile?.xp ??
    currentProfile?.xp ??
    currentProfile?.rich_points ??
    currentProfile?.points ??
    identity?.xp ??
    identity?.rich_points ??
    0;

  const rawLevel =
    gamerProfile?.level ??
    currentProfile?.rich_level ??
    currentProfile?.level ??
    identity?.rich_level ??
    identity?.level ??
    1;

  const rank =
    gamerProfile?.rank_title ||
    currentProfile?.rank_title ||
    currentProfile?.rank ||
    identity?.rankTitle ||
    identity?.rank_title ||
    identity?.rank ||
    "Rich Gamer";

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
  const model = getProfileXpModel();

  if (els.xpGauge) {
    els.xpGauge.dataset.level = String(model.level);
    els.xpGauge.dataset.rank = model.rank;
    els.xpGauge.dataset.xp = String(model.xp);
  }

  if (els.xpFill) {
    els.xpFill.style.width = `${model.percent}%`;
  }

  setText(els.xpText, `${model.xp.toLocaleString()} XP`);
  setText(els.xpNext, `${model.remaining.toLocaleString()} XP TO LVL ${model.level + 1}`);
  setText(els.xpLevel, `LVL ${model.level}`);
  setText(els.xpRank, model.rank);

  window.dispatchEvent(
    new CustomEvent("rb:xp-gauge-update", {
      detail: {
        route: "gaming",
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

function gamePlayUrl(game = {}) {
  if (game.play_url) return game.play_url;
  if (game.slug) return `/games/${game.slug}`;
  return "/gaming";
}

function cardEmpty(target, text) {
  if (!target) return;

  target.innerHTML = `
    <article class="rb-empty-card">
      ${escapeHtml(text)}
    </article>
  `;
}

function mergeLocalGames(rows = []) {
  const seen = new Set(
    rows
      .map((game) => game.slug || game.id)
      .filter(Boolean)
  );

  const missing = LOCAL_GAMES.filter((game) => {
    return !seen.has(game.slug) && !seen.has(game.id);
  });

  return [...missing, ...rows];
}

function lockProfileKeys() {
  identity = getProfileIdentity(currentProfile);

  document.body.dataset.rbRoute = "gaming";
  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = identity?.id || "";
  document.body.dataset.rbProfileLocked = identity?.id ? "true" : "false";

  bindProfileShell();

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl(currentProfile);
  });

  document.querySelectorAll("[data-rb-current-avatar]").forEach((el) => {
    const avatar = safeImage(profileAvatar(currentProfile), fallbackAvatar);
    const name = profileName(currentProfile);

    if (el.tagName === "IMG") {
      el.src = avatar;
      el.alt = name;
    } else {
      el.style.backgroundImage = `url("${avatar}")`;
    }
  });

  renderXpGauge();
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
    if (btn.dataset.rbGamingTabBound === "true") return;
    btn.dataset.rbGamingTabBound = "true";

    btn.addEventListener("click", () => {
      const key = btn.dataset.tab;

      els.tabs.forEach((item) => {
        item.classList.remove("is-active");
      });

      els.panels.forEach((panel) => {
        const active = panel.dataset.panel === key;
        panel.classList.toggle("is-active", active);
        panel.style.display = active ? "" : "none";
      });

      btn.classList.add("is-active");
    });
  });
}

async function loadGamerProfile() {
  if (!currentUser?.id) {
    setText(els.gamerName, "Guest Player");
    setText(els.gamerMeta, "Sign in to sync your gamer profile.");
    renderXpGauge();
    return;
  }

  if (!RB_TABLES.gamerProfiles) {
    setText(els.gamerName, identity?.displayName || "Rich Gamer");
    setText(els.gamerMeta, "Gamer profile table not configured.");
    renderXpGauge();
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
    setText(els.gamerName, identity?.displayName || "Rich Gamer");
    setText(els.gamerMeta, "No gamer profile yet.");
    renderXpGauge();
    return;
  }

  setText(
    els.gamerName,
    gamerProfile.display_name ||
      gamerProfile.gamer_tag ||
      identity?.displayName ||
      "Rich Gamer"
  );

  setText(
    els.gamerMeta,
    `${gamerProfile.gamer_tag || "No tag"} • ${
      gamerProfile.platform_primary || "web"
    } • ${gamerProfile.rank_title || "Rookie"} • ${gamerProfile.xp || 0} XP`
  );

  if (els.gamerTagInput) {
    els.gamerTagInput.value = gamerProfile.gamer_tag || "";
  }

  if (els.platformInput) {
    els.platformInput.value = gamerProfile.platform_primary || "web";
  }

  renderXpGauge();
}

async function saveGamerProfile(event) {
  event.preventDefault();

  if (!currentUser?.id) {
    window.location.href = RB_ROUTES.auth || "/auth";
    return;
  }

  if (!RB_TABLES.gamerProfiles) {
    setText(els.gamerMeta, "Gamer profile table not configured.");
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
    avatar_url:
      safeImage(currentProfile?.avatar_url, fallbackAvatar),
    banner_url:
      safeImage(currentProfile?.banner_url, fallbackCover),
    metadata: {
      source: "Rich Bizness Gaming",
      profile_locked: true
    },
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from(RB_TABLES.gamerProfiles)
    .upsert(payload, {
      onConflict: "user_id"
    });

  if (error) throw error;

  await loadGamerProfile();
}

function renderGames(rows = []) {
  const games = mergeLocalGames(rows);

  if (!games.length) {
    return cardEmpty(els.gamesList, "No games loaded yet.");
  }

  if (!els.gamesList) return;

  els.gamesList.innerHTML = games.map((game) => `
    <article class="rb-game-card" data-game-id="${escapeHtml(game.id || "")}">
      <img
        src="${escapeHtml(safeImage(game.cover_url || game.thumbnail_url, fallbackCover))}"
        alt=""
      />

      <div>
        <p class="rb-kicker">
          ${escapeHtml(game.game_type || "arcade")} • ${escapeHtml(game.platform_type || "web")}
        </p>

        <h3>${escapeHtml(game.title || "Rich Bizness Game")}</h3>

        <p>${escapeHtml(game.description || "Rich Bizness game experience.")}</p>

        <div class="rb-card-stats">
          <span>${Number(game.total_plays || 0)} plays</span>
          <span>${Number(game.high_score || 0)} high</span>
          <span>${Number(game.active_players || 0)} active</span>
        </div>

        <a class="rb-pill-btn" href="${escapeHtml(gamePlayUrl(game))}">
          Play
        </a>
      </div>
    </article>
  `).join("");
}

function renderClips(rows = []) {
  if (!els.clipsList) return;

  if (!rows.length) {
    return cardEmpty(els.clipsList, "No game clips yet.");
  }

  els.clipsList.innerHTML = rows.map((clip) => `
    <article class="rb-game-card" data-owner-id="${escapeHtml(clip.user_id || "")}">
      ${
        clip.thumbnail_url
          ? `<img src="${escapeHtml(safeImage(clip.thumbnail_url, fallbackCover))}" alt="" />`
          : clip.clip_url
            ? `<video src="${escapeHtml(safeImage(clip.clip_url, ""))}" muted playsinline controls></video>`
            : `<img src="${escapeHtml(fallbackCover)}" alt="" />`
      }

      <div>
        <p class="rb-kicker">
          ${escapeHtml(clip.game_slug || "gaming")} • @${escapeHtml(clip.username || "player")}
        </p>

        <h3>${escapeHtml(clip.title || "Game Clip")}</h3>

        <p>${escapeHtml(clip.caption || "")}</p>

        <div class="rb-card-stats">
          <span>🔥 ${Number(clip.like_count || 0)}</span>
          <span>💬 ${Number(clip.comment_count || 0)}</span>
          <span>👁 ${Number(clip.view_count || 0)}</span>
        </div>
      </div>
    </article>
  `).join("");
}

function renderScores(rows = []) {
  if (!els.scoresList) return;

  if (!rows.length) {
    return cardEmpty(els.scoresList, "No scores submitted yet.");
  }

  els.scoresList.innerHTML = rows.map((score, index) => `
    <article class="rb-list-row" data-owner-id="${escapeHtml(score.user_id || "")}">
      <strong>#${index + 1}</strong>

      <div>
        <h3>${escapeHtml(score.display_name || score.username || "Rich Gamer")}</h3>

        <p>
          ${escapeHtml(score.game_slug || "game")} •
          ${escapeHtml(score.mode || "arcade")} •
          ${escapeHtml(score.anti_cheat_status || "pending")}
        </p>
      </div>

      <b>${Number(score.score || 0)}</b>
    </article>
  `).join("");
}

function renderTournaments(rows = []) {
  if (!els.tournamentsList) return;

  if (!rows.length) {
    return cardEmpty(els.tournamentsList, "No tournaments open yet.");
  }

  els.tournamentsList.innerHTML = rows.map((item) => `
    <article class="rb-game-card">
      <img src="${escapeHtml(safeImage(item.cover_url, fallbackCover))}" alt="" />

      <div>
        <p class="rb-kicker">
          ${escapeHtml(item.status || "draft")} • ${escapeHtml(item.tournament_type || "bracket")}
        </p>

        <h3>${escapeHtml(item.title || "Tournament")}</h3>

        <p>${escapeHtml(item.description || "Tournament event.")}</p>

        <div class="rb-card-stats">
          <span>${Number(item.current_players || 0)}/${Number(item.max_players || 0)} players</span>
          <span>${money(item.prize_pool_cents)} prize</span>
          <span>${money(item.entry_fee_cents)} entry</span>
        </div>
      </div>
    </article>
  `).join("");
}

function renderChallenges(rows = []) {
  if (!els.challengesList) return;

  if (!rows.length) {
    return cardEmpty(els.challengesList, "No challenges yet.");
  }

  els.challengesList.innerHTML = rows.map((item) => `
    <article class="rb-game-card">
      <div>
        <p class="rb-kicker">
          ${escapeHtml(item.status || "pending")} • ${escapeHtml(item.game_slug || "game")}
        </p>

        <h3>${escapeHtml(item.title || "Game Challenge")}</h3>

        <p>
          Creator ${Number(item.creator_score || 0)}
          vs Opponent ${Number(item.opponent_score || 0)}
        </p>

        <div class="rb-card-stats">
          <span>${money(item.wager_cents)} wager</span>
          <span>${money(item.winner_amount_cents)} winner</span>
          <span>${escapeHtml(item.trust_status || "pending")}</span>
        </div>
      </div>
    </article>
  `).join("");
}

async function loadGames() {
  if (!RB_TABLES.games) {
    const merged = mergeLocalGames([]);
    setText(els.gameCount, merged.length);
    renderGames([]);
    return;
  }

  const { data, error } = await supabase
    .from(RB_TABLES.games)
    .select("*")
    .eq("is_active", true)
    .order("is_featured", {
      ascending: false
    })
    .order("created_at", {
      ascending: false
    })
    .limit(24);

  if (error) {
    console.warn("[RB GAMING GAMES FALLBACK]", error);
    const merged = mergeLocalGames([]);
    setText(els.gameCount, merged.length);
    renderGames([]);
    return;
  }

  const merged = mergeLocalGames(data || []);

  setText(els.gameCount, merged.length);
  renderGames(data || []);
}

async function loadClips() {
  if (!RB_TABLES.gameClips) {
    setText(els.clipCount, 0);
    renderClips([]);
    return;
  }

  const { data, error } = await supabase
    .from(RB_TABLES.gameClips)
    .select("*")
    .order("created_at", {
      ascending: false
    })
    .limit(24);

  if (error) {
    console.warn("[RB GAMING CLIPS]", error);
    setText(els.clipCount, 0);
    renderClips([]);
    return;
  }

  setText(els.clipCount, data?.length || 0);
  renderClips(data || []);
}

async function loadScores() {
  if (!RB_TABLES.gameScores) {
    setText(els.scoreCount, 0);
    renderScores([]);
    return;
  }

  const { data, error } = await supabase
    .from(RB_TABLES.gameScores)
    .select("*")
    .order("score", {
      ascending: false
    })
    .order("created_at", {
      ascending: false
    })
    .limit(50);

  if (error) {
    console.warn("[RB GAMING SCORES]", error);
    setText(els.scoreCount, 0);
    renderScores([]);
    return;
  }

  setText(els.scoreCount, data?.length || 0);
  renderScores(data || []);
}

async function loadTournaments() {
  if (!RB_TABLES.gameTournaments) {
    setText(els.tournamentCount, 0);
    renderTournaments([]);
    return;
  }

  const { data, error } = await supabase
    .from(RB_TABLES.gameTournaments)
    .select("*")
    .order("created_at", {
      ascending: false
    })
    .limit(24);

  if (error) {
    console.warn("[RB GAMING TOURNAMENTS]", error);
    setText(els.tournamentCount, 0);
    renderTournaments([]);
    return;
  }

  setText(els.tournamentCount, data?.length || 0);
  renderTournaments(data || []);
}

async function loadChallenges() {
  if (!RB_TABLES.gameChallenges) {
    renderChallenges([]);
    return;
  }

  const { data, error } = await supabase
    .from(RB_TABLES.gameChallenges)
    .select("*")
    .order("created_at", {
      ascending: false
    })
    .limit(24);

  if (error) {
    console.warn("[RB GAMING CHALLENGES]", error);
    renderChallenges([]);
    return;
  }

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

  renderXpGauge();

  window.dispatchEvent(
    new CustomEvent("rb:gaming-update", {
      detail: {
        route: "gaming",
        profileLocked: !!identity?.id,
        xpGauge: true
      }
    })
  );
}

function clearRealtime() {
  if (channel && supabase) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

function subscribeGaming() {
  clearRealtime();

  if (!supabase) return;

  channel = supabase.channel("rb-gaming-page");

  if (RB_TABLES.games) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.games
      },
      loadGames
    );
  }

  if (RB_TABLES.gameClips) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.gameClips
      },
      loadClips
    );
  }

  if (RB_TABLES.gameScores) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.gameScores
      },
      loadScores
    );
  }

  if (RB_TABLES.gameTournaments) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.gameTournaments
      },
      loadTournaments
    );
  }

  if (RB_TABLES.gameChallenges) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.gameChallenges
      },
      loadChallenges
    );
  }

  if (RB_TABLES.gamerProfiles) {
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.gamerProfiles
      },
      loadGamerProfile
    );
  }

  channel.subscribe();
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

    document.body.dataset.rbPage = "gaming";
    document.body.dataset.rbRoute = "gaming";
    document.body.dataset.rbProfileLock = identity?.id ? "true" : "false";
    document.body.classList.add("rb-gaming-ready");

    markPageReady("gaming");

    console.log("RB GAMING READY", {
      profileLocked: !!identity?.id,
      route: "gaming",
      xpGauge: true
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
