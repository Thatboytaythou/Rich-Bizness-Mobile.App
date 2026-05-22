/* =========================
   RICH BIZNESS MOBILE
   /core/pages/gallery.js
========================= */

import {
  initApp,
  markPageReady,
  markPageError
} from "/core/app.js";

import { RB_TABLES } from "/core/shared/rb-config.js";
import { getSupabase } from "/core/shared/rb-supabase.js";

const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

const FALLBACK_COVER = "/images/brand/hero-banner.png";

const els = {
  uploadCount: $("gallery-upload-count"),
  postCount: $("gallery-post-count"),
  imageCount: $("gallery-image-count"),
  videoCount: $("gallery-video-count"),

  uploadsList: $("gallery-uploads-list"),
  postsList: $("gallery-posts-list"),
  featuredList: $("gallery-featured-list")
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
  return item?.display_name || item?.username || "Rich Bizness Gallery";
}

function mediaKind(item) {
  const type = String(item?.media_type || item?.mime_type || "").toLowerCase();

  if (type.includes("video")) return "video";
  if (type.includes("audio")) return "audio";
  if (type.includes("image")) return "image";

  return "image";
}

function mediaUrl(item) {
  return (
    item?.public_url ||
    item?.media_url ||
    item?.thumbnail_url ||
    item?.cover_url ||
    FALLBACK_COVER
  );
}

function setEmpty(target, text) {
  if (!target) return;
  target.innerHTML = `<p class="rb-empty">${text}</p>`;
}

function bindTabs() {
  $$("[data-gallery-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.galleryTab;

      $$("[data-gallery-tab]").forEach((btn) => {
        btn.classList.toggle("is-active", btn === button);
      });

      $$("[data-gallery-panel]").forEach((panel) => {
        panel.classList.toggle(
          "is-active",
          panel.dataset.galleryPanel === tab
        );
      });
    });
  });
}

function renderGalleryTile(item) {
  const kind = mediaKind(item);
  const src = mediaUrl(item);

  const tile = document.createElement("article");
  tile.className = "rb-gallery-tile";

  tile.innerHTML = `
    <div class="rb-gallery-media">
      ${
        kind === "video"
          ? `<video src="${src}" muted playsinline preload="metadata"></video>`
          : `<img src="${src}" alt="${safe(item.title, "Gallery upload")}" loading="lazy" />`
      }
    </div>

    <div class="rb-gallery-info">
      <p class="rb-kicker">${safe(item.category || item.section, "GALLERY")}</p>
      <h3>${safe(item.title, "Untitled Drop")}</h3>
      <p>${safe(item.description || item.body, "Visual drop from Rich Bizness.")}</p>

      <div class="rb-card-meta">
        <span>${creatorLine(item)}</span>
        <span>${niceDate(item.created_at)}</span>
      </div>
    </div>
  `;

  return tile;
}

function renderPostCard(item) {
  const image =
    item.thumbnail_url ||
    item.media_url ||
    item.cover_url ||
    FALLBACK_COVER;

  const card = document.createElement("article");
  card.className = "rb-content-card rb-gallery-card";

  card.innerHTML = `
    <img class="rb-card-cover" src="${image}" alt="${safe(item.title, "Gallery post")}" loading="lazy" />

    <div class="rb-card-body">
      <p class="rb-kicker">${safe(item.section, "GALLERY POST")}</p>
      <h3>${safe(item.title, "Gallery Post")}</h3>
      <p>${safe(item.body, "No caption yet.")}</p>

      <div class="rb-card-meta">
        <span>${creatorLine(item)}</span>
        <span>${niceDate(item.created_at)}</span>
      </div>

      <div class="rb-chip-row">
        <span class="rb-chip">${item.like_count || 0} likes</span>
        <span class="rb-chip">${item.comment_count || 0} comments</span>
        <span class="rb-chip">${item.view_count || 0} views</span>
      </div>
    </div>
  `;

  return card;
}

async function loadUploads() {
  const { data, error } = await supabase
    .from(RB_TABLES.uploads)
    .select("*")
    .eq("section", "gallery")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) throw error;

  const uploads = data || [];
  const imageCount = uploads.filter((item) => mediaKind(item) === "image").length;
  const videoCount = uploads.filter((item) => mediaKind(item) === "video").length;

  if (els.uploadCount) els.uploadCount.textContent = uploads.length;
  if (els.imageCount) els.imageCount.textContent = imageCount;
  if (els.videoCount) els.videoCount.textContent = videoCount;

  if (!uploads.length) {
    setEmpty(els.uploadsList, "No gallery uploads yet.");
    setEmpty(els.featuredList, "No featured gallery uploads yet.");
    return;
  }

  els.uploadsList.innerHTML = "";
  uploads.forEach((item) => {
    els.uploadsList.appendChild(renderGalleryTile(item));
  });

  const featured = uploads
    .filter((item) => item?.metadata?.is_featured || item?.metadata?.featured)
    .slice(0, 24);

  const finalFeatured = featured.length ? featured : uploads.slice(0, 12);

  els.featuredList.innerHTML = "";
  finalFeatured.forEach((item) => {
    els.featuredList.appendChild(renderGalleryTile(item));
  });
}

async function loadPosts() {
  const { data, error } = await supabase
    .from(RB_TABLES.feedPosts)
    .select("*")
    .eq("section", "gallery")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) throw error;

  const posts = data || [];

  if (els.postCount) els.postCount.textContent = posts.length;

  if (!posts.length) {
    setEmpty(els.postsList, "No gallery posts yet.");
    return;
  }

  els.postsList.innerHTML = "";
  posts.forEach((item) => {
    els.postsList.appendChild(renderPostCard(item));
  });
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
    RB_TABLES.uploads,
    RB_TABLES.feedPosts
  ].map((table) =>
    supabase
      .channel(`rb-gallery-${table}`)
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

async function bootGalleryPage() {
  try {
    await initApp({
      guard: false,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    bindTabs();

    await loadGalleryPage();
    bindRealtime();

    window.addEventListener("beforeunload", clearRealtime);

    document.body.classList.add("rb-gallery-ready");

    markPageReady("gallery");

    console.log("RB GALLERY READY");
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
