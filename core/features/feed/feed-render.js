/* =========================
   RICH BIZNESS MOBILE
   /core/features/feed/feed-render.js

   FEED RENDER ENGINE
   Pure HTML rendering only
========================= */

import { RB_ROUTES } from "/core/shared/rb-config.js";

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";
const DEFAULT_MEDIA = "/images/brand/hero-banner.png";

/* =========================
   HELPERS
========================= */

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function safeNumber(value = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function cssEscape(value = "") {
  if (window.CSS?.escape) return CSS.escape(String(value));
  return String(value).replace(/["\\]/g, "\\$&");
}

function inferMediaType(post = {}, url = "") {
  const explicit = safeText(post.media_type).toLowerCase();
  if (explicit) return explicit;

  const lower = safeText(url).toLowerCase();

  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(lower)) return "video";
  if (/\.(mp3|wav|m4a|ogg)(\?|$)/.test(lower)) return "audio";

  return "image";
}

function getPostBody(post = {}) {
  return (
    post.body ||
    post.caption ||
    post.content ||
    post.description ||
    ""
  );
}

function getPostMediaUrl(post = {}) {
  return safeText(
    post.media_url ||
      post.file_url ||
      post.image_url ||
      post.thumbnail_url ||
      post.cover_url ||
      post.public_url ||
      ""
  );
}

function getPostUsername(post = {}) {
  return safeText(
    post.username ||
      post.profile_username ||
      post.metadata?.username ||
      post.metadata?.profile_username ||
      "rich_user"
  );
}

function getPostDisplayName(post = {}) {
  const username = getPostUsername(post);

  return safeText(
    post.display_name ||
      post.profile_name ||
      post.metadata?.display_name ||
      post.metadata?.profile_name ||
      username ||
      "Rich User"
  );
}

function getPostAvatar(post = {}) {
  return safeText(
    post.avatar_url ||
      post.profile_avatar ||
      post.metadata?.avatar_url ||
      post.metadata?.profile_avatar ||
      DEFAULT_AVATAR,
    DEFAULT_AVATAR
  );
}

export function timeAgo(value) {
  if (!value) return "";

  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";

  const diff = Math.max(0, Date.now() - time);
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;

  return new Date(value).toLocaleDateString();
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

/* =========================
   MEDIA
========================= */

export function renderFeedMedia(post = {}) {
  const url = getPostMediaUrl(post);
  if (!url) return "";

  const type = inferMediaType(post, url);

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
      <div class="feed-audio-shell">
        <img
          class="feed-audio-cover"
          src="${escapeHtml(post.cover_url || post.thumbnail_url || DEFAULT_MEDIA)}"
          alt=""
          loading="lazy"
        />
        <audio
          class="feed-audio"
          src="${escapeHtml(url)}"
          controls
          preload="metadata"
        ></audio>
      </div>
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

/* =========================
   COMMENTS
========================= */

export function renderComment(comment = {}) {
  const username = safeText(
    comment.username ||
      comment.profile_username ||
      comment.metadata?.username ||
      "rich_user"
  );

  const name = safeText(
    comment.display_name ||
      comment.profile_name ||
      comment.metadata?.display_name ||
      username ||
      "Rich User"
  );

  const body = safeText(
    comment.body ||
      comment.message ||
      comment.content ||
      ""
  );

  return `
    <div
      class="feed-comment"
      data-comment-id="${escapeHtml(comment.id || "")}"
    >
      <a
        class="feed-comment-name"
        href="${escapeHtml(buildFeedProfileUrl(comment.user_id, username))}"
      >
        ${escapeHtml(name)}
      </a>

      <span>${escapeHtml(body)}</span>
    </div>
  `;
}

export function renderComments(comments = []) {
  if (!Array.isArray(comments) || !comments.length) return "";

  return comments.map(renderComment).join("");
}

/* =========================
   CARD
========================= */

export function renderFeedCard(post = {}, options = {}) {
  const postId = post.id || "";
  const username = getPostUsername(post);
  const name = getPostDisplayName(post);
  const avatar = getPostAvatar(post);
  const body = getPostBody(post);

  const likeState = options.likes?.[postId] || {};
  const viewCount =
    options.views?.[postId] ??
    post.view_count ??
    post.views_count ??
    0;

  const commentCount =
    post.comment_count ??
    post.comments_count ??
    options.comments?.[postId]?.length ??
    0;

  const likeCount =
    likeState.count ??
    post.like_count ??
    post.likes_count ??
    0;

  const isLiked = Boolean(
    likeState.liked ||
      post.liked_by_me ||
      post.is_liked
  );

  const commentsOpen = options.openComments?.includes?.(postId);

  return `
    <article
      class="feed-card rb-feed-card"
      data-post-id="${escapeHtml(postId)}"
      data-section="${escapeHtml(post.section || "feed")}"
    >
      <header class="feed-card-head">
        <a
          class="feed-user"
          href="${escapeHtml(buildFeedProfileUrl(post.user_id, username))}"
          data-route="profile"
        >
          <img
            src="${escapeHtml(avatar)}"
            alt=""
            loading="lazy"
          />

          <span>
            <strong>${escapeHtml(name)}</strong>
            <small>@${escapeHtml(username)} · ${escapeHtml(timeAgo(post.created_at))}</small>
          </span>
        </a>

        <span class="feed-chip">
          ${escapeHtml(post.section || "feed")}
        </span>
      </header>

      ${
        post.title
          ? `<h2>${escapeHtml(post.title)}</h2>`
          : ""
      }

      ${
        body
          ? `<p class="feed-body">${escapeHtml(body)}</p>`
          : ""
      }

      ${renderFeedMedia(post)}

      <footer class="feed-actions">
        <button
          class="${isLiked ? "is-active" : ""}"
          type="button"
          data-action="like"
          data-id="${escapeHtml(postId)}"
          aria-label="Like post"
        >
          💚 <span>${safeNumber(likeCount)}</span>
        </button>

        <button
          type="button"
          data-action="comment"
          data-id="${escapeHtml(postId)}"
          aria-label="Open comments"
        >
          💬 <span>${safeNumber(commentCount)}</span>
        </button>

        <button
          type="button"
          data-action="view"
          data-id="${escapeHtml(postId)}"
          aria-label="View post"
        >
          👁 <span>${safeNumber(viewCount)}</span>
        </button>
      </footer>

      <form
        class="feed-comment-form ${commentsOpen ? "is-open" : ""}"
        data-comment-form="${escapeHtml(postId)}"
      >
        <input
          name="comment"
          type="text"
          placeholder="Drop a Rich Bizness comment..."
          autocomplete="off"
        />
        <button type="submit">Send</button>
      </form>

      <div
        class="feed-comments"
        data-comments="${escapeHtml(postId)}"
      >
        ${renderComments(options.comments?.[postId] || [])}
      </div>
    </article>
  `;
}

/* =========================
   LIST
========================= */

export function renderFeedList({
  target,
  posts = [],
  emptyTarget = null,
  options = {}
} = {}) {
  const el =
    typeof target === "string"
      ? document.querySelector(target)
      : target;

  if (!el) return;

  const emptyEl =
    typeof emptyTarget === "string"
      ? document.querySelector(emptyTarget)
      : emptyTarget;

  if (!Array.isArray(posts) || !posts.length) {
    el.innerHTML = "";

    if (emptyEl) {
      emptyEl.style.display = "block";
      emptyEl.hidden = false;
    }

    return;
  }

  if (emptyEl) {
    emptyEl.style.display = "none";
    emptyEl.hidden = true;
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
    `[data-comments="${cssEscape(postId)}"]`
  );

  if (!holder) return;

  holder.innerHTML = renderComments(comments);
}

export function patchFeedCounts({
  postId,
  likeCount = null,
  commentCount = null,
  viewCount = null,
  liked = null
} = {}) {
  if (!postId) return;

  const card = document.querySelector(
    `[data-post-id="${cssEscape(postId)}"]`
  );

  if (!card) return;

  const likeBtn = card.querySelector('[data-action="like"]');
  const commentBtn = card.querySelector('[data-action="comment"]');
  const viewBtn = card.querySelector('[data-action="view"]');

  if (likeBtn && likeCount !== null) {
    likeBtn.querySelector("span").textContent = safeNumber(likeCount);
  }

  if (likeBtn && liked !== null) {
    likeBtn.classList.toggle("is-active", Boolean(liked));
  }

  if (commentBtn && commentCount !== null) {
    commentBtn.querySelector("span").textContent = safeNumber(commentCount);
  }

  if (viewBtn && viewCount !== null) {
    viewBtn.querySelector("span").textContent = safeNumber(viewCount);
  }
}

/* =========================
   COMPOSER
========================= */

export function renderComposerIdentity({
  avatarEl = null,
  nameEl = null,
  statusEl = null,
  avatarUrl = DEFAULT_AVATAR,
  displayName = "Guest Viewer",
  status = ""
} = {}) {
  if (avatarEl) {
    avatarEl.src = avatarUrl || DEFAULT_AVATAR;
    avatarEl.alt = displayName || "Guest Viewer";
  }

  if (nameEl) {
    nameEl.textContent = displayName || "Guest Viewer";
  }

  if (statusEl) {
    statusEl.textContent = status;
  }
}

console.log("RB FEED RENDER READY");
