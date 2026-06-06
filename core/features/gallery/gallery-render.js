/* =========================
   RICH BIZNESS MOBILE
   /core/features/gallery/gallery-render.js

   GALLERY RENDER ENGINE
   Cards + media preview + modal/lightbox
========================= */

import {
  getGalleryState,
  onGalleryState,
  setSelectedGalleryItem,
  clearSelectedGalleryItem,
  setGalleryFilters
} from "/core/features/gallery/gallery-state.js";

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

const FALLBACK_MEDIA = "/images/brand/hero-banner.png";
const FALLBACK_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";

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

function mediaUrl(item = {}) {
  return (
    item.public_url ||
    item.media_url ||
    item.file_url ||
    item.image_url ||
    item.cover_url ||
    item.thumbnail_url ||
    ""
  );
}

function coverUrl(item = {}) {
  return (
    item.cover_url ||
    item.thumbnail_url ||
    item.image_url ||
    item.media_url ||
    item.public_url ||
    FALLBACK_MEDIA
  );
}

function mediaType(item = {}) {
  const raw = String(item.media_type || item.type || item.file_type || "").toLowerCase();
  const url = mediaUrl(item).toLowerCase();

  if (raw.includes("image")) return "image";
  if (raw.includes("video")) return "video";
  if (raw.includes("audio")) return "audio";

  if (/\.(png|jpg|jpeg|webp|gif|avif)(\?|$)/.test(url)) return "image";
  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(url)) return "video";
  if (/\.(mp3|wav|m4a|ogg)(\?|$)/.test(url)) return "audio";

  return "file";
}

function itemTitle(item = {}) {
  return (
    item.title ||
    item.name ||
    item.caption ||
    item.metadata?.title ||
    "Gallery Drop"
  );
}

function itemBody(item = {}) {
  return (
    item.description ||
    item.body ||
    item.caption ||
    item.metadata?.description ||
    ""
  );
}

function creatorName(item = {}) {
  return (
    item.display_name ||
    item.profile_name ||
    item.username ||
    item.metadata?.display_name ||
    "Rich Bizness Creator"
  );
}

function creatorAvatar(item = {}) {
  return (
    item.avatar_url ||
    item.profile_avatar ||
    item.metadata?.avatar_url ||
    FALLBACK_AVATAR
  );
}

function profileUrl(item = {}) {
  const username = item.username || item.profile_username || item.metadata?.username || "";
  const userId = item.user_id || item.creator_id || item.owner_id || "";

  if (username) {
    return `${RB_ROUTES.profile || "/profile"}?u=${encodeURIComponent(username)}`;
  }

  if (userId) {
    return `${RB_ROUTES.profile || "/profile"}?id=${encodeURIComponent(userId)}`;
  }

  return RB_ROUTES.profile || "/profile";
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

export function renderGalleryMedia(item = {}, {
  mode = "card"
} = {}) {
  const type = mediaType(item);
  const url = mediaUrl(item);
  const cover = coverUrl(item);
  const title = itemTitle(item);

  if (!url && type !== "file") {
    return `
      <img
        class="rb-gallery-media rb-gallery-image"
        src="${escapeHtml(FALLBACK_MEDIA)}"
        alt="${escapeHtml(title)}"
        loading="lazy"
      />
    `;
  }

  if (type === "video") {
    return `
      <video
        class="rb-gallery-media rb-gallery-video"
        src="${escapeHtml(url)}"
        poster="${escapeHtml(cover)}"
        ${mode === "modal" ? "controls autoplay" : "muted playsinline preload=\"metadata\""}
        playsinline
      ></video>
    `;
  }

  if (type === "audio") {
    return `
      <div class="rb-gallery-audio-card">
        <img src="${escapeHtml(cover)}" alt="${escapeHtml(title)}" loading="lazy" />
        <audio
          class="rb-gallery-audio"
          src="${escapeHtml(url)}"
          controls
          preload="metadata"
        ></audio>
      </div>
    `;
  }

  if (type === "file") {
    return `
      <div class="rb-gallery-file-card">
        <strong>📎</strong>
        <span>${escapeHtml(title)}</span>
      </div>
    `;
  }

  return `
    <img
      class="rb-gallery-media rb-gallery-image"
      src="${escapeHtml(url || cover)}"
      alt="${escapeHtml(title)}"
      loading="${mode === "modal" ? "eager" : "lazy"}"
    />
  `;
}

export function galleryCardHtml(item = {}) {
  const id = item.id || "";
  const title = itemTitle(item);
  const body = itemBody(item);
  const type = mediaType(item);

  return `
    <article
      class="rb-gallery-card rb-content-card type-${escapeHtml(type)}"
      data-gallery-id="${escapeHtml(id)}"
      data-profile-id="${escapeHtml(item.user_id || item.creator_id || "")}"
      data-profile-username="${escapeHtml(item.username || "")}"
    >
      <div class="rb-gallery-media-wrap">
        ${renderGalleryMedia(item)}

        <span class="rb-gallery-type">${escapeHtml(type.toUpperCase())}</span>
      </div>

      <div class="rb-card-body rb-gallery-card-body">
        <div class="rb-gallery-user">
          <a href="${escapeHtml(profileUrl(item))}" data-rb-profile-link>
            <img src="${escapeHtml(creatorAvatar(item))}" alt="" loading="lazy" />
            <span>
              <strong>${escapeHtml(creatorName(item))}</strong>
              <small>${escapeHtml(timeAgo(item.created_at))}</small>
            </span>
          </a>
        </div>

        <h3>${escapeHtml(title)}</h3>

        ${
          body
            ? `<p>${escapeHtml(body)}</p>`
            : ""
        }

        <div class="rb-chip-row">
          <span class="rb-chip">${escapeHtml(item.category || item.section || "gallery")}</span>
          ${
            item.is_featured || item.featured
              ? `<span class="rb-chip">Featured</span>`
              : ""
          }
          ${
            item.visibility
              ? `<span class="rb-chip">${escapeHtml(item.visibility)}</span>`
              : ""
          }
        </div>

        <div class="rb-action-row">
          <button
            type="button"
            class="rb-main-launch"
            data-gallery-open="${escapeHtml(id)}"
          >
            OPEN
          </button>

          ${
            mediaUrl(item)
              ? `<a class="rb-ghost-btn" href="${escapeHtml(mediaUrl(item))}" target="_blank" rel="noopener noreferrer">VIEW</a>`
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

export function renderGalleryList({
  target,
  items = null,
  emptyTarget = null,
  emptyText = "No gallery drops yet."
} = {}) {
  const el = typeof target === "string"
    ? document.querySelector(target)
    : target;

  if (!el) return;

  const emptyEl = typeof emptyTarget === "string"
    ? document.querySelector(emptyTarget)
    : emptyTarget;

  const state = getGalleryState();
  const rows = Array.isArray(items)
    ? items
    : state.filteredItems;

  if (!rows.length) {
    el.innerHTML = "";

    if (emptyEl) {
      emptyEl.style.display = "block";
      emptyEl.textContent = emptyText;
    } else {
      el.innerHTML = `<p class="rb-empty">${escapeHtml(emptyText)}</p>`;
    }

    return;
  }

  if (emptyEl) emptyEl.style.display = "none";

  el.innerHTML = rows.map(galleryCardHtml).join("");

  bindGalleryCards(el);
}

export function renderFeaturedGallery({
  target,
  items = null,
  emptyText = "No featured gallery drops yet."
} = {}) {
  const state = getGalleryState();
  const rows = Array.isArray(items)
    ? items
    : state.featured;

  renderGalleryList({
    target,
    items: rows,
    emptyText
  });
}

export function renderMyGallery({
  target,
  items = null,
  emptyText = "You have not uploaded gallery media yet."
} = {}) {
  const state = getGalleryState();
  const rows = Array.isArray(items)
    ? items
    : state.mine;

  renderGalleryList({
    target,
    items: rows,
    emptyText
  });
}

export function renderGalleryCounts({
  totalSelector = "[data-gallery-count-total]",
  featuredSelector = "[data-gallery-count-featured]",
  mineSelector = "[data-gallery-count-mine]",
  imageSelector = "[data-gallery-count-images]",
  videoSelector = "[data-gallery-count-videos]",
  audioSelector = "[data-gallery-count-audio]"
} = {}) {
  const { counts } = getGalleryState();

  const set = (selector, value) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = String(value || 0);
      el.dataset.count = String(value || 0);
    });
  };

  set(totalSelector, counts.total);
  set(featuredSelector, counts.featured);
  set(mineSelector, counts.mine);
  set(imageSelector, counts.images);
  set(videoSelector, counts.videos);
  set(audioSelector, counts.audio);
}

export function galleryModalHtml(item = {}) {
  const title = itemTitle(item);
  const body = itemBody(item);

  return `
    <div class="rb-gallery-modal-backdrop" data-gallery-close></div>

    <article class="rb-gallery-modal-card" role="dialog" aria-modal="true">
      <button
        type="button"
        class="rb-gallery-modal-close"
        data-gallery-close
        aria-label="Close gallery preview"
      >
        ×
      </button>

      <div class="rb-gallery-modal-media">
        ${renderGalleryMedia(item, { mode: "modal" })}
      </div>

      <div class="rb-gallery-modal-copy">
        <p class="rb-kicker">${escapeHtml(mediaType(item).toUpperCase())}</p>
        <h2>${escapeHtml(title)}</h2>

        ${
          body
            ? `<p>${escapeHtml(body)}</p>`
            : ""
        }

        <div class="rb-gallery-user">
          <a href="${escapeHtml(profileUrl(item))}" data-rb-profile-link>
            <img src="${escapeHtml(creatorAvatar(item))}" alt="" />
            <span>
              <strong>${escapeHtml(creatorName(item))}</strong>
              <small>${escapeHtml(item.username ? `@${item.username}` : "Rich Bizness")}</small>
            </span>
          </a>
        </div>

        <div class="rb-action-row">
          ${
            mediaUrl(item)
              ? `<a class="rb-main-launch" href="${escapeHtml(mediaUrl(item))}" target="_blank" rel="noopener noreferrer">OPEN FILE</a>`
              : ""
          }

          <button type="button" class="rb-ghost-btn" data-gallery-close>
            CLOSE
          </button>
        </div>
      </div>
    </article>
  `;
}

export function ensureGalleryModalRoot() {
  let root = document.getElementById("rb-gallery-modal-root");

  if (root) return root;

  root = document.createElement("div");
  root.id = "rb-gallery-modal-root";
  root.className = "rb-gallery-modal-root";
  root.hidden = true;

  document.body.appendChild(root);

  return root;
}

export function openGalleryModal(item = {}) {
  const root = ensureGalleryModalRoot();

  root.innerHTML = galleryModalHtml(item);
  root.hidden = false;
  root.classList.add("is-open");

  document.body.classList.add("rb-gallery-modal-open");

  setSelectedGalleryItem(item);
  bindGalleryModal(root);
}

export function closeGalleryModal() {
  const root = ensureGalleryModalRoot();

  root.classList.remove("is-open");
  root.hidden = true;
  root.innerHTML = "";

  document.body.classList.remove("rb-gallery-modal-open");

  clearSelectedGalleryItem();
}

export function bindGalleryModal(root = document) {
  root.querySelectorAll("[data-gallery-close]").forEach((button) => {
    if (button.dataset.rbGalleryCloseBound === "true") return;
    button.dataset.rbGalleryCloseBound = "true";

    button.addEventListener("click", closeGalleryModal);
  });
}

export function bindGalleryCards(root = document) {
  root.querySelectorAll("[data-gallery-open]").forEach((button) => {
    if (button.dataset.rbGalleryOpenBound === "true") return;
    button.dataset.rbGalleryOpenBound = "true";

    button.addEventListener("click", () => {
      const id = button.dataset.galleryOpen;
      const item = getGalleryState().items.find((entry) => String(entry.id) === String(id));

      if (item) openGalleryModal(item);
    });
  });
}

export function bindGalleryFilters({
  categorySelector = "[data-gallery-filter-category]",
  mediaTypeSelector = "[data-gallery-filter-media]",
  searchSelector = "[data-gallery-filter-search]"
} = {}) {
  document.querySelectorAll(categorySelector).forEach((el) => {
    if (el.dataset.rbGalleryFilterBound === "true") return;
    el.dataset.rbGalleryFilterBound = "true";

    el.addEventListener("change", () => {
      setGalleryFilters({
        category: el.value || "all"
      });
    });
  });

  document.querySelectorAll(mediaTypeSelector).forEach((el) => {
    if (el.dataset.rbGalleryFilterBound === "true") return;
    el.dataset.rbGalleryFilterBound = "true";

    el.addEventListener("change", () => {
      setGalleryFilters({
        mediaType: el.value || "all"
      });
    });
  });

  document.querySelectorAll(searchSelector).forEach((el) => {
    if (el.dataset.rbGalleryFilterBound === "true") return;
    el.dataset.rbGalleryFilterBound = "true";

    el.addEventListener("input", () => {
      setGalleryFilters({
        search: el.value || ""
      });
    });
  });
}

export function bindGalleryShell({
  listSelector = "[data-gallery-list]",
  featuredSelector = "[data-gallery-featured]",
  mineSelector = "[data-gallery-mine]",
  emptySelector = "[data-gallery-empty]"
} = {}) {
  bindGalleryFilters();

  return onGalleryState((state) => {
    document.querySelectorAll(listSelector).forEach((target) => {
      renderGalleryList({
        target,
        emptyTarget: emptySelector ? document.querySelector(emptySelector) : null,
        items: state.filteredItems
      });
    });

    document.querySelectorAll(featuredSelector).forEach((target) => {
      renderFeaturedGallery({
        target,
        items: state.featured
      });
    });

    document.querySelectorAll(mineSelector).forEach((target) => {
      renderMyGallery({
        target,
        items: state.mine
      });
    });

    renderGalleryCounts();
  });
}

export function bootGalleryRender(options = {}) {
  bindGalleryShell(options);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeGalleryModal();
    }
  });

  console.log("RB GALLERY RENDER READY");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => bootGalleryRender());
} else {
  bootGalleryRender();
}
