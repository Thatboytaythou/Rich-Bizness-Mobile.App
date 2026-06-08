/* =========================
   RICH BIZNESS MOBILE
   /core/pages/gallery.js

   Gallery Page
   Profile Keys Locked
   Realtime Enabled
   Direct Supabase Gallery Controller
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
  getSupabase,
  getUser,
  getProfile
} from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity,
  bindProfileShell,
  profileAvatar,
  profileName,
  buildProfileUrl
} from "/core/shared/rb-profile.js";

const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const FALLBACK_COVER = "/images/brand/hero-banner.png";
const FALLBACK_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";

const TABLES = {
  uploads: RB_TABLES?.uploads || "uploads",
  feedPosts: RB_TABLES?.feedPosts || "feed_posts"
};

const els = {
  uploadCount: $("gallery-upload-count"),
  postCount: $("gallery-post-count"),
  imageCount: $("gallery-image-count"),
  videoCount: $("gallery-video-count"),

  uploadsList: $("gallery-uploads-list"),
  postsList: $("gallery-posts-list"),
  featuredList: $("gallery-featured-list"),

  uploadBtn: $("gallery-upload-btn"),
  profileBtn: $("gallery-profile-btn")
};

let supabase = null;
let channels = [];
let currentUser = null;
let currentProfile = null;
let identity = null;

function safe(value, fallback = "") {
  return value === null || value === undefined || value === ""
    ? fallback
    : String(value);
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

function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setText(el, value = "") {
  if (el) el.textContent = value;
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
  return (
    item.display_name ||
    item.username ||
    item.creator_name ||
    "Rich Bizness Gallery"
  );
}

function mediaKind(item = {}) {
  const type = String(item.media_type || item.mime_type || "").toLowerCase();
  const url = String(
    item.public_url ||
      item.media_url ||
      item.file_url ||
      item.thumbnail_url ||
      item.cover_url ||
      ""
  ).toLowerCase();

  if (type.includes("video") || /\.(mp4|mov|webm|m4v)(\?|$)/.test(url)) {
    return "video";
  }

  if (type.includes("audio") || /\.(mp3|wav|m4a|ogg)(\?|$)/.test(url)) {
    return "audio";
  }

  return "image";
}

function mediaUrl(item = {}) {
  return safePath(
    item.public_url ||
      item.media_url ||
      item.file_url ||
      item.thumbnail_url ||
      item.cover_url ||
      item.image_url,
    FALLBACK_COVER
  );
}

function setEmpty(target, text) {
  if (!target) return;

  target.innerHTML = `
    <div class="rb-empty">
      ${escapeHtml(text)}
    </div>
  `;
}

function syncProfileKeys() {
  const appState = getCurrentUserState?.() || {};

  currentUser = appState.user || getUser?.() || null;
  currentProfile = appState.profile || getProfile?.() || null;
  identity = getProfileIdentity(currentProfile);

  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = identity?.id || "";
  document.body.dataset.rbRoute = "gallery";
  document.body.dataset.rbProfileLocked = identity?.id ? "true" : "false";

  bindProfileShell?.();

  $$("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl(currentProfile);
  });

  $$("[data-rb-current-avatar]").forEach((el) => {
    const avatar = safePath(profileAvatar(currentProfile), FALLBACK_AVATAR);
    const name = profileName(currentProfile);

    if (el.tagName === "IMG") {
      el.src = avatar;
      el.alt = name;
    } else {
      el.style.backgroundImage = `url("${avatar}")`;
    }
  });
}

function bindTabs() {
  $$("[data-gallery-tab]").forEach((button) => {
    if (button.dataset.rbGalleryBound === "true") return;
    button.dataset.rbGalleryBound = "true";

    button.addEventListener("click", () => {
      const tab = button.dataset.galleryTab || "uploads";

      $$("[data-gallery-tab]").forEach((btn) => {
        btn.classList.toggle("is-active", btn === button);
      });

      $$("[data-gallery-panel]").forEach((panel) => {
        const active = panel.dataset.galleryPanel === tab;

        panel.classList.toggle("is-active", active);
        panel.style.display = active ? "block" : "none";
      });
    });
  });
}

function bindGalleryActions() {
  els.uploadBtn?.addEventListener("click", () => {
    window.location.href = `${RB_ROUTES?.upload || "/upload"}?section=gallery`;
  });

  els.profileBtn?.addEventListener("click", () => {
    window.location.href = buildProfileUrl(currentProfile || getProfile?.());
  });
}

function renderGalleryTile(item = {}) {
  const kind = mediaKind(item);
  const src = mediaUrl(item);
  const title = safe(item.title, "Untitled Drop");
  const creatorName = creatorLine(item);

  const tile = document.createElement("article");
  tile.className = "rb-gallery-tile";
  tile.dataset.ownerId = item.user_id || "";
  tile.dataset.profileLocked = item.user_id ? "true" : "false";

  tile.innerHTML = `
    <div class="rb-gallery-media">
      ${
        kind === "video"
          ? `
            <video
              src="${escapeHtml(src)}"
              controls
              playsinline
              preload="metadata"
            ></video>
          `
          : kind === "audio"
            ? `
              <div class="rb-gallery-audio">
                <img
                  src="${escapeHtml(FALLBACK_COVER)}"
                  alt=""
                  loading="lazy"
                />
                <audio src="${escapeHtml(src)}" controls></audio>
              </div>
            `
            : `
              <img
                src="${escapeHtml(src)}"
                alt="${escapeHtml(title)}"
                loading="lazy"
              />
            `
      }
    </div>

    <div class="rb-gallery-info">
      <p class="rb-kicker">
        ${escapeHtml(safe(item.category || item.section, "GALLERY"))}
      </p>

      <h3>
        ${escapeHtml(title)}
      </h3>

      <p>
        ${escapeHtml(safe(item.description || item.body, "Visual drop from Rich Bizness."))}
      </p>

      <div class="rb-card-meta">
        <span>${escapeHtml(creatorName)}</span>
        <span>${escapeHtml(niceDate(item.created_at))}</span>
      </div>
    </div>
  `;

  return tile;
}

function renderPostCard(item = {}) {
  const image = safePath(
    item.thumbnail_url ||
      item.media_url ||
      item.file_url ||
      item.cover_url ||
      item.image_url,
    FALLBACK_COVER
  );

  const title = safe(item.title, "Gallery Post");

  const card = document.createElement("article");
  card.className = "rb-content-card rb-gallery-card";
  card.dataset.ownerId = item.user_id || "";
  card.dataset.profileLocked = item.user_id ? "true" : "false";

  card.innerHTML = `
    <img
      class="rb-card-cover"
      src="${escapeHtml(image)}"
      alt="${escapeHtml(title)}"
      loading="lazy"
    />

    <div class="rb-card-body">
      <p class="rb-kicker">
        ${escapeHtml(safe(item.section, "GALLERY POST"))}
      </p>

      <h3>
        ${escapeHtml(title)}
      </h3>

      <p>
        ${escapeHtml(safe(item.body || item.description, "No caption yet."))}
      </p>

      <div class="rb-card-meta">
        <span>${escapeHtml(creatorLine(item))}</span>
        <span>${escapeHtml(niceDate(item.created_at))}</span>
      </div>

      <div class="rb-chip-row">
        <span class="rb-chip">${Number(item.like_count || 0)} likes</span>
        <span class="rb-chip">${Number(item.comment_count || 0)} comments</span>
        <span class="rb-chip">${Number(item.view_count || 0)} views</span>
      </div>
    </div>
  `;

  return card;
}

async function loadUploads() {
  const { data, error } = await supabase
    .from(TABLES.uploads)
    .select("*")
    .eq("section", "gallery")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) throw error;

  const uploads = data || [];
  const imageCount = uploads.filter((item) => mediaKind(item) === "image").length;
  const videoCount = uploads.filter((item) => mediaKind(item) === "video").length;

  setText(els.uploadCount, uploads.length);
  setText(els.imageCount, imageCount);
  setText(els.videoCount, videoCount);

  if (!uploads.length) {
    setEmpty(els.uploadsList, "No gallery uploads yet.");
    setEmpty(els.featuredList, "No featured gallery uploads yet.");
    return;
  }

  if (els.uploadsList) {
    els.uploadsList.innerHTML = "";
    uploads.forEach((item) => {
      els.uploadsList.appendChild(renderGalleryTile(item));
    });
  }

  const featured = uploads
    .filter((item) => item?.metadata?.is_featured || item?.metadata?.featured)
    .slice(0, 24);

  const finalFeatured = featured.length ? featured : uploads.slice(0, 12);

  if (els.featuredList) {
    els.featuredList.innerHTML = "";
    finalFeatured.forEach((item) => {
      els.featuredList.appendChild(renderGalleryTile(item));
    });
  }
}

async function loadPosts() {
  const { data, error } = await supabase
    .from(TABLES.feedPosts)
    .select("*")
    .eq("section", "gallery")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) throw error;

  const posts = data || [];

  setText(els.postCount, posts.length);

  if (!posts.length) {
    setEmpty(els.postsList, "No gallery posts yet.");
    return;
  }

  if (els.postsList) {
    els.postsList.innerHTML = "";
    posts.forEach((item) => {
      els.postsList.appendChild(renderPostCard(item));
    });
  }
}

async function loadGalleryPage() {
  await Promise.all([
    loadUploads(),
    loadPosts()
  ]);
}

function clearRealtime() {
  channels.forEach((channel) => {
    supabase?.removeChannel(channel);
  });

  channels = [];
}

function bindRealtime() {
  const reload = () => loadGalleryPage().catch(console.error);

  clearRealtime();

  channels = [
    TABLES.uploads,
    TABLES.feedPosts
  ].map((tableName) =>
    supabase
      .channel(`rb-gallery-${tableName}`)
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

async function bootGalleryPage() {
  try {
    await initApp({
      guard: false,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    syncProfileKeys();
    bindTabs();
    bindGalleryActions();

    await loadGalleryPage();
    bindRealtime();

    window.addEventListener("beforeunload", clearRealtime);

    document.body.dataset.rbPage = "gallery";
    document.body.dataset.rbRoute = "gallery";
    document.body.classList.add("rb-gallery-ready");

    markPageReady("gallery");

    console.log("RB GALLERY READY", {
      profileLocked: !!identity?.id,
      route: "gallery"
    });
  } catch (error) {
    console.error("[gallery.js]", error);

    setEmpty(els.uploadsList, "Gallery uploads failed to load.");
    setEmpty(els.postsList, "Gallery posts failed to load.");
    setEmpty(els.featuredList, "Featured gallery failed to load.");

    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootGalleryPage);
} else {
  bootGalleryPage();
}
