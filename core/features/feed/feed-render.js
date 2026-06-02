/* =========================
   RICH BIZNESS MOBILE
   /core/features/feed/feed-render.js

   FEED RENDER ENGINE
========================= */

import { RB_ROUTES } from "/core/shared/rb-config.js";

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";
const DEFAULT_MEDIA = "/images/brand/hero-banner.png";

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function timeAgo(value) {
  if (!value) return "";

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";

  const diff = Date.now() - time;
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;

  return `${Math.floor(hrs / 24)}d`;
}

export function buildFeedProfileUrl(userId = "", username = "") {
  if (username) {
    return `${RB_ROUTES.profile || "/profile"}?u=${encodeURIComponent(username)}`;
  }

  if (userId) {
    return `${RB_ROUTES.profile || "/profile"}?id=${encodeURIComponent(userId)}`;
  }

  return RB_ROUTES.profile || "/profile";
}

export function renderFeedMedia(post = {}) {
  const url = safeText(
    post.media_url ||
      post.file_url ||
      post.image_url ||
      post.thumbnail_url ||
      post.cover_url
  );

  if (!url) return "";

  const type = safeText(post.media_type, "image").toLowerCase();

  if (type.includes("video")) {
    return `
      <video
        class="feed-media feed-video"
        src="${escapeHtml(url)}"
        controls
        playsinline
        preload="metadata"
      ></video>
    `;
  }

  if (type.includes("audio")) {
    return `
      <audio
        class="feed-audio"
        src="${escapeHtml(url)}"
        controls
        preload="metadata"
      ></audio>
    `;
  }

  return `
    <img
      class="feed-media feed-image"
      src="${escapeHtml(url || DEFAULT_MEDIA)}"
      alt="${escapeHtml(post.title || "Rich Bizness feed media")}"
      loading="lazy"
    />
  `;
}

export function renderComment(comment = {}) {
  const name =
    comment.display_name ||
    comment.username ||
    "Rich User";

  return `
    <div class="feed-comment" data-comment-id="${escapeHtml(comment.id || "")}">
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(comment.body || comment.message || "")}</span>
    </div>
  `;
}

export function renderComments(comments = []) {
  if (!comments.length) return "";

  return comments.map(renderComment).join("");
}

export function renderFeedCard(post = {}, options = {}) {
  const avatar =
    post.avatar_url ||
    post.profile_avatar ||
    post.metadata?.profile_avatar ||
    DEFAULT_AVATAR;

  const username =
    post.username ||
    post.profile_username ||
    "rich_user";

  const name =
    post.display_name ||
    post.profile_name ||
    username ||
    "Rich User";

  const commentOpen = options.openComments?.includes?.(post.id);

  return `
    <article
      class="feed-card rb-feed-card"
      data-post-id="${escapeHtml(post.id || "")}"
    >
      <header class="feed-card-head">
        <a
          class="feed-user"
          href="${escapeHtml(buildFeedProfileUrl(post.user_id, username))}"
        >
          <img src="${escapeHtml(avatar)}" alt="" loading="lazy" />

          <span>
            <strong>${escapeHtml(name)}</strong>
            <small>@${escapeHtml(username)} · ${escapeHtml(timeAgo(post.created_at))}</small>
          </span>
        </a>

        <span class="feed-chip">${escapeHtml(post.section || "feed")}</span>
      </header>

      ${
        post.title
          ? `<h2>${escapeHtml(post.title)}</h2>`
          : ""
      }

      ${
        post.body
          ? `<p class="feed-body">${escapeHtml(post.body)}</p>`
          : ""
      }

      ${renderFeedMedia(post)}

      <footer class="feed-actions">
        <button type="button" data-action="like" data-id="${escapeHtml(post.id || "")}">
          💚 <span>${Number(post.like_count || 0)}</span>
        </button>

        <button type="button" data-action="comment" data-id="${escapeHtml(post.id || "")}">
          💬 <span>${Number(post.comment_count || 0)}</span>
        </button>

        <button type="button" data-action="view" data-id="${escapeHtml(post.id || "")}">
          👁 <span>${Number(post.view_count || 0)}</span>
        </button>
      </footer>

      <form
        class="feed-comment-form ${commentOpen ? "is-open" : ""}"
        data-comment-form="${escapeHtml(post.id || "")}"
      >
        <input type="text" placeholder="Drop a Rich Bizness comment..." />
        <button type="submit">Send</button>
      </form>

      <div class="feed-comments" data-comments="${escapeHtml(post.id || "")}"></div>
    </article>
  `;
}

export function renderFeedList({
  target,
  posts = [],
  emptyTarget = null,
  options = {}
} = {}) {
  const el = typeof target === "string"
    ? document.querySelector(target)
    : target;

  if (!el) return;

  const emptyEl = typeof emptyTarget === "string"
    ? document.querySelector(emptyTarget)
    : emptyTarget;

  if (!posts.length) {
    el.innerHTML = "";

    if (emptyEl) {
      emptyEl.style.display = "block";
    }

    return;
  }

  if (emptyEl) {
    emptyEl.style.display = "none";
  }

  el.innerHTML = posts
    .map((post) => renderFeedCard(post, options))
    .join("");
}

export function renderCommentList({
  postId,
  comments = []
} = {}) {
  if (!postId) return;

  const holder = document.querySelector(
    `[data-comments="${CSS.escape(postId)}"]`
  );

  if (!holder) return;

  holder.innerHTML = renderComments(comments);
}

export function renderComposerIdentity({
  avatarEl = null,
  nameEl = null,
  avatarUrl = DEFAULT_AVATAR,
  displayName = "Guest Viewer"
} = {}) {
  if (avatarEl) {
    avatarEl.src = avatarUrl || DEFAULT_AVATAR;
  }

  if (nameEl) {
    nameEl.textContent = displayName || "Guest Viewer";
  }
}

console.log("RB FEED RENDER READY");
