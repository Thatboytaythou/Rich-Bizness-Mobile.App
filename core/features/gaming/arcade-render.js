/* =========================
   RICH BIZNESS MOBILE
   /core/features/gaming/arcade-render.js

   ARCADE RENDER ENGINE
   Games + Clips + Scores + Profile Keys Locked
========================= */

import { RB_TABLES, RB_ROUTES } from "/core/shared/rb-config.js";

import {
  escapeHtml,
  safeImage
} from "/core/shared/rb-dom.js";

import {
  formatNumber,
  formatDate,
  timeAgo
} from "/core/shared/rb-format.js";

import {
  buildProfileUrl
} from "/core/shared/rb-profile.js";

const FALLBACK_COVER = "/images/brand/gaming-hero.png.jpeg";
const FALLBACK_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";

function text(value, fallback = "") {
  return escapeHtml(value || fallback);
}

function mediaKind(url = "", type = "") {
  const clean = String(url || "").toLowerCase();
  const mediaType = String(type || "").toLowerCase();

  if (mediaType.includes("video")) return "video";
  if (mediaType.includes("audio")) return "audio";
  if (clean.match(/\.(mp4|mov|webm|m4v)(\?|$)/)) return "video";
  if (clean.match(/\.(mp3|wav|m4a|ogg)(\?|$)/)) return "audio";

  return "image";
}

function creatorFrom(item = {}) {
  const profile = item.profiles || item.profile || item.creator || null;

  return {
    id: item.user_id || item.creator_id || profile?.id || null,
    username: item.username || profile?.username || "rich_gamer",
    display_name:
      item.display_name ||
      profile?.display_name ||
      profile?.full_name ||
      profile?.username ||
      "Rich Gamer",
    avatar_url:
      item.avatar_url ||
      profile?.avatar_url ||
      FALLBACK_AVATAR
  };
}

function gameUrl(game = {}) {
  const base = RB_ROUTES.game || RB_ROUTES.gaming || "/gaming";
  const key = game.slug || game.id;

  if (!key) return base;

  return `${base}?game=${encodeURIComponent(key)}`;
}

function profileHref(item = {}) {
  const creator = creatorFrom(item);

  if (!creator.id && !creator.username) return RB_ROUTES.profile || "/profile";

  return buildProfileUrl({
    id: creator.id,
    username: creator.username,
    display_name: creator.display_name,
    avatar_url: creator.avatar_url
  });
}

function setEmpty(target, message = "Nothing here yet.") {
  if (!target) return;

  target.innerHTML = `
    <article class="rb-empty">
      <strong>${text(message)}</strong>
      <span>Rich Bizness arcade is ready.</span>
    </article>
  `;
}

function clear(target) {
  if (!target) return;
  target.innerHTML = "";
}

export function renderGamingStats({
  games = [],
  clips = [],
  scores = [],
  profiles = []
} = {}, els = {}) {
  const liveGames = games.filter((item) => item.is_live || item.status === "live");
  const totalPlays = games.reduce((sum, item) => sum + Number(item.play_count || item.plays || 0), 0);
  const totalLikes = clips.reduce((sum, item) => sum + Number(item.like_count || item.likes || 0), 0);

  if (els.gameCount) els.gameCount.textContent = formatNumber(games.length);
  if (els.clipCount) els.clipCount.textContent = formatNumber(clips.length);
  if (els.scoreCount) els.scoreCount.textContent = formatNumber(scores.length);
  if (els.gamerCount) els.gamerCount.textContent = formatNumber(profiles.length);
  if (els.liveCount) els.liveCount.textContent = formatNumber(liveGames.length);
  if (els.playCount) els.playCount.textContent = formatNumber(totalPlays);
  if (els.likeCount) els.likeCount.textContent = formatNumber(totalLikes);
}

export function renderGameCard(game = {}, handlers = {}) {
  const creator = creatorFrom(game);
  const cover = game.cover_url || game.thumbnail_url || game.image_url || FALLBACK_COVER;

  const card = document.createElement("article");
  card.className = "rb-content-card rb-game-card";
  card.dataset.gameId = game.id || "";
  card.dataset.creatorId = creator.id || "";
  card.dataset.profileLocked = creator.id ? "true" : "false";

  card.innerHTML = `
    <a class="rb-card-cover-link" href="${text(gameUrl(game))}">
      <img
        class="rb-card-cover"
        src="${text(cover)}"
        alt="${text(game.title || game.name, "Rich Bizness game")}"
        loading="lazy"
      />
    </a>

    <div class="rb-card-body">
      <p class="rb-kicker">${text(game.category || game.genre || "ARCADE GAME")}</p>

      <h3>${text(game.title || game.name, "Untitled Game")}</h3>

      <p>${text(game.description || game.summary, "Play this Rich Bizness arcade drop.")}</p>

      <a class="rb-card-creator" href="${text(profileHref(game))}">
        <img src="${text(creator.avatar_url)}" alt="${text(creator.display_name)}" loading="lazy" />
        <span>
          <strong>${text(creator.display_name)}</strong>
          <small>@${text(creator.username)}</small>
        </span>
      </a>

      <div class="rb-chip-row">
        <span class="rb-chip">${text(game.status || "ready")}</span>
        <span class="rb-chip">${formatNumber(game.play_count || game.plays || 0)} plays</span>
        <span class="rb-chip">${formatNumber(game.like_count || game.likes || 0)} likes</span>
        <span class="rb-chip">${formatNumber(game.score_count || 0)} scores</span>
      </div>

      <div class="rb-action-row">
        <button type="button" class="rb-main-launch" data-game-play>PLAY</button>
        <button type="button" class="rb-ghost-btn" data-game-like>LIKE</button>
      </div>
    </div>
  `;

  card.querySelector("[data-game-play]")?.addEventListener("click", () => {
    handlers.onPlay?.(game);
  });

  card.querySelector("[data-game-like]")?.addEventListener("click", () => {
    handlers.onLike?.(game);
  });

  return card;
}

export function renderClipCard(clip = {}, handlers = {}) {
  const creator = creatorFrom(clip);
  const url = clip.media_url || clip.video_url || clip.clip_url || clip.file_url || clip.image_url || "";
  const poster = clip.thumbnail_url || clip.cover_url || clip.image_url || FALLBACK_COVER;
  const kind = mediaKind(url, clip.media_type || clip.file_type);

  const media =
    kind === "video"
      ? `
        <video
          class="rb-card-cover"
          src="${text(url)}"
          poster="${text(poster)}"
          controls
          playsinline
          preload="metadata"
        ></video>
      `
      : kind === "audio"
        ? `
          <div class="rb-audio-cover" style="background-image:url('${text(poster)}')">
            <audio src="${text(url)}" controls preload="metadata"></audio>
          </div>
        `
        : `
          <img
            class="rb-card-cover"
            src="${text(url || poster)}"
            alt="${text(clip.title, "Gaming clip")}"
            loading="lazy"
          />
        `;

  const card = document.createElement("article");
  card.className = "rb-content-card rb-game-clip-card";
  card.dataset.clipId = clip.id || "";
  card.dataset.creatorId = creator.id || "";
  card.dataset.profileLocked = creator.id ? "true" : "false";

  card.innerHTML = `
    ${media}

    <div class="rb-card-body">
      <p class="rb-kicker">${text(clip.game_title || clip.category || "GAME CLIP")}</p>

      <h3>${text(clip.title || "Untitled Clip")}</h3>

      <p>${text(clip.description || clip.caption, "Rich Bizness gaming moment.")}</p>

      <a class="rb-card-creator" href="${text(profileHref(clip))}">
        <img src="${text(creator.avatar_url)}" alt="${text(creator.display_name)}" loading="lazy" />
        <span>
          <strong>${text(creator.display_name)}</strong>
          <small>@${text(creator.username)}</small>
        </span>
      </a>

      <div class="rb-chip-row">
        <span class="rb-chip">${formatNumber(clip.view_count || clip.views || 0)} views</span>
        <span class="rb-chip">${formatNumber(clip.like_count || clip.likes || 0)} likes</span>
        <span class="rb-chip">${timeAgo(clip.created_at)}</span>
      </div>

      <div class="rb-action-row">
        <button type="button" class="rb-main-launch" data-clip-open>OPEN</button>
        <button type="button" class="rb-ghost-btn" data-clip-like>LIKE</button>
      </div>
    </div>
  `;

  card.querySelector("[data-clip-open]")?.addEventListener("click", () => {
    handlers.onOpenClip?.(clip);
  });

  card.querySelector("[data-clip-like]")?.addEventListener("click", () => {
    handlers.onLikeClip?.(clip);
  });

  return card;
}

export function renderScoreRow(score = {}, index = 0) {
  const creator = creatorFrom(score);

  const row = document.createElement("article");
  row.className = "rb-list-row rb-score-row";
  row.dataset.scoreId = score.id || "";
  row.dataset.creatorId = creator.id || "";

  row.innerHTML = `
    <strong>#${index + 1}</strong>

    <a href="${text(profileHref(score))}">
      <img src="${text(creator.avatar_url)}" alt="${text(creator.display_name)}" loading="lazy" />
    </a>

    <div>
      <h3>${text(creator.display_name)}</h3>
      <p>${text(score.game_title || score.game_name || "Arcade")} • ${formatDate(score.created_at)}</p>
    </div>

    <b>${formatNumber(score.score || score.points || score.value || 0)}</b>
  `;

  return row;
}

export function renderGamerProfileCard(profile = {}, handlers = {}) {
  const card = document.createElement("article");
  card.className = "rb-content-card rb-gamer-profile-card";
  card.dataset.creatorId = profile.user_id || profile.id || "";
  card.dataset.profileLocked = profile.user_id || profile.id ? "true" : "false";

  const mergedProfile = {
    id: profile.user_id || profile.id,
    username: profile.username,
    display_name: profile.display_name || profile.gamer_tag,
    avatar_url: profile.avatar_url
  };

  card.innerHTML = `
    <img
      class="rb-card-cover"
      src="${text(profile.banner_url || profile.cover_url || FALLBACK_COVER)}"
      alt="${text(profile.gamer_tag || profile.display_name, "Gamer profile")}"
      loading="lazy"
    />

    <div class="rb-card-body">
      <a class="rb-card-creator" href="${text(buildProfileUrl(mergedProfile))}">
        <img src="${text(profile.avatar_url || FALLBACK_AVATAR)}" alt="${text(profile.display_name || profile.gamer_tag)}" loading="lazy" />
        <span>
          <strong>${text(profile.gamer_tag || profile.display_name || "Rich Gamer")}</strong>
          <small>@${text(profile.username || "rich_gamer")}</small>
        </span>
      </a>

      <p>${text(profile.bio || profile.about || "Gaming profile locked into Rich Bizness.")}</p>

      <div class="rb-chip-row">
        <span class="rb-chip">LVL ${formatNumber(profile.level || 1)}</span>
        <span class="rb-chip">${formatNumber(profile.total_score || 0)} score</span>
        <span class="rb-chip">${formatNumber(profile.win_count || 0)} wins</span>
      </div>

      <button type="button" class="rb-main-launch" data-gamer-open>VIEW PROFILE</button>
    </div>
  `;

  card.querySelector("[data-gamer-open]")?.addEventListener("click", () => {
    handlers.onOpenProfile?.(profile);
  });

  return card;
}

export function renderGamesList(target, games = [], handlers = {}) {
  if (!target) return;

  if (!games.length) {
    setEmpty(target, "No arcade games yet.");
    return;
  }

  clear(target);
  games.forEach((game) => target.appendChild(renderGameCard(game, handlers)));
}

export function renderClipsList(target, clips = [], handlers = {}) {
  if (!target) return;

  if (!clips.length) {
    setEmpty(target, "No gaming clips yet.");
    return;
  }

  clear(target);
  clips.forEach((clip) => target.appendChild(renderClipCard(clip, handlers)));
}

export function renderScoresList(target, scores = []) {
  if (!target) return;

  if (!scores.length) {
    setEmpty(target, "No scores posted yet.");
    return;
  }

  clear(target);
  scores.forEach((score, index) => target.appendChild(renderScoreRow(score, index)));
}

export function renderGamerProfilesList(target, profiles = [], handlers = {}) {
  if (!target) return;

  if (!profiles.length) {
    setEmpty(target, "No gamer profiles yet.");
    return;
  }

  clear(target);
  profiles.forEach((profile) => target.appendChild(renderGamerProfileCard(profile, handlers)));
}

export function renderFeaturedArcade(target, games = [], handlers = {}) {
  if (!target) return;

  const featured = games.filter((game) => game.is_featured).slice(0, 8);
  const finalGames = featured.length ? featured : games.slice(0, 6);

  if (!finalGames.length) {
    setEmpty(target, "No featured arcade drops yet.");
    return;
  }

  clear(target);
  finalGames.forEach((game) => target.appendChild(renderGameCard(game, handlers)));
}

export function renderArcadePage({
  state = {},
  els = {},
  handlers = {}
} = {}) {
  const games = state.games || [];
  const clips = state.clips || [];
  const scores = state.scores || [];
  const profiles = state.profiles || state.gamerProfiles || [];

  renderGamingStats({ games, clips, scores, profiles }, els);

  renderGamesList(els.gamesList, games, handlers);
  renderFeaturedArcade(els.featuredList, games, handlers);
  renderClipsList(els.clipsList, clips, handlers);
  renderScoresList(els.scoresList, scores);
  renderGamerProfilesList(els.profilesList, profiles, handlers);
}

console.log("RB ARCADE RENDER READY", {
  games: RB_TABLES.games,
  clips: RB_TABLES.gameClips,
  scores: RB_TABLES.gameScores
});
