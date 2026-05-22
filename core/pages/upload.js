/* =========================
   RICH BIZNESS MOBILE
   /core/pages/upload.js
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import { getSupabase } from "/core/shared/rb-supabase.js";

import {
  RB_TABLES,
  RB_BUCKETS
} from "/core/shared/rb-config.js";

const $ = (id) => document.getElementById(id);

const ROUTES = {
  general: { section: "feed", bucket: RB_BUCKETS.generalUploads, targetTable: RB_TABLES.feedPosts, mediaType: "file" },
  feed: { section: "feed", bucket: RB_BUCKETS.generalUploads, targetTable: RB_TABLES.feedPosts, mediaType: "file" },
  gallery: { section: "gallery", bucket: RB_BUCKETS.galleryMedia, targetTable: RB_TABLES.feedPosts, mediaType: "image" },
  music: { section: "music", bucket: RB_BUCKETS.musicAudio, targetTable: RB_TABLES.musicTracks, mediaType: "audio" },
  podcast: { section: "podcast", bucket: RB_BUCKETS.podcastAudio, targetTable: RB_TABLES.podcastEpisodes, mediaType: "audio" },
  radio: { section: "radio", bucket: RB_BUCKETS.radioCovers, targetTable: RB_TABLES.radioStations, mediaType: "image" },
  sports: { section: "sports", bucket: RB_BUCKETS.sportsMedia, targetTable: RB_TABLES.sportsUploads, mediaType: "video" },
  gaming: { section: "gaming", bucket: RB_BUCKETS.gameClips, targetTable: RB_TABLES.gameClips, mediaType: "video" },
  "store-product": { section: "store", bucket: RB_BUCKETS.storeProducts, targetTable: RB_TABLES.products, mediaType: "image" },
  "store-digital": { section: "store", bucket: RB_BUCKETS.storeDigital, targetTable: RB_TABLES.products, mediaType: "file" },
  "live-thumbnail": { section: "live", bucket: RB_BUCKETS.liveThumbnails, targetTable: RB_TABLES.liveStreams, mediaType: "image" },
  "live-recording": { section: "live", bucket: RB_BUCKETS.liveRecordings, targetTable: RB_TABLES.uploads, mediaType: "video" },
  "profile-avatar": { section: "profile", bucket: RB_BUCKETS.avatars, targetTable: RB_TABLES.profiles, mediaType: "image" },
  "profile-banner": { section: "profile", bucket: RB_BUCKETS.profileBanners, targetTable: RB_TABLES.profiles, mediaType: "image" },
  "meta-avatar": { section: "meta", bucket: RB_BUCKETS.metaAvatars, targetTable: RB_TABLES.metaAvatars, mediaType: "image" }
};

const els = {
  form: $("rb-upload-form"),
  routeKey: $("routeKey"),
  title: $("uploadTitle"),
  description: $("uploadDescription"),
  category: $("uploadCategory"),
  tag: $("uploadTag"),
  file: $("uploadFile"),
  preview: $("uploadPreview"),
  statusLabel: $("upload-status-label"),
  routeLabel: $("upload-route-label"),
  message: $("uploadMessage")
};

let supabase = null;
let authState = null;

function setStatus(text) {
  if (els.statusLabel) els.statusLabel.textContent = text;
  if (els.message) els.message.textContent = text;
}

function routeConfig() {
  return ROUTES[els.routeKey?.value] || ROUTES.general;
}

function safeName(name) {
  return String(name || "upload")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
}

function getMediaType(file, config) {
  const mime = file?.type || "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return config.mediaType || "file";
}

function setLoading(active) {
  els.form?.classList.toggle("is-loading", active);
  els.form?.querySelectorAll("button,input,textarea,select").forEach((el) => {
    el.disabled = active;
  });
}

function publicUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

function paintPreview() {
  const file = els.file?.files?.[0];

  if (!file) {
    if (els.preview) els.preview.innerHTML = "<span>No file selected</span>";
    return;
  }

  const url = URL.createObjectURL(file);

  if (file.type.startsWith("image/")) {
    els.preview.innerHTML = `<img src="${url}" alt="Upload preview" />`;
    return;
  }

  if (file.type.startsWith("video/")) {
    els.preview.innerHTML = `<video src="${url}" muted controls playsinline></video>`;
    return;
  }

  if (file.type.startsWith("audio/")) {
    els.preview.innerHTML = `<audio src="${url}" controls></audio>`;
    return;
  }

  els.preview.innerHTML = `<span>${file.name}</span>`;
}

function syncRouteLabel() {
  const config = routeConfig();

  if (els.routeLabel) {
    els.routeLabel.textContent = els.routeKey?.value || "general";
  }

  if (els.category && !els.category.value) {
    els.category.value = config.section;
  }
}

function profilePayload(profile, user) {
  return {
    username: profile?.username || null,
    display_name:
      profile?.display_name ||
      profile?.full_name ||
      user?.email?.split("@")[0] ||
      "Rich User"
  };
}

async function insertUploadRecord({ user, config, file, filePath, url, mediaType }) {
  const title = els.title.value.trim();
  const description = els.description.value.trim();
  const category = els.category.value.trim() || config.section;

  const { data, error } = await supabase
    .from(RB_TABLES.uploads)
    .insert({
      user_id: user.id,
      category,
      section: config.section,
      title,
      description,
      bucket: config.bucket,
      file_path: filePath,
      public_url: url,
      mime_type: file.type || null,
      file_size: file.size || null,
      media_type: mediaType,
      visibility: "public",
      processing_status: "completed",
      metadata: {
        route_key: els.routeKey.value,
        source: "Rich Bizness Mobile",
        target_table: config.targetTable
      }
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function createSectionRecord({ user, profile, config, upload, url, mediaType }) {
  const title = els.title.value.trim() || "Untitled Drop";
  const description = els.description.value.trim();
  const category = els.category.value.trim() || config.section;
  const tag = els.tag.value.trim();
  const identity = profilePayload(profile, user);

  if (config.targetTable === RB_TABLES.feedPosts) {
    return supabase.from(RB_TABLES.feedPosts).insert({
      user_id: user.id,
      ...identity,
      title,
      body: description || title,
      media_url: url,
      media_type: mediaType,
      thumbnail_url: mediaType === "image" ? url : null,
      section: config.section,
      visibility: "public",
      metadata: { upload_id: upload.id, route_key: els.routeKey.value, category, tag }
    });
  }

  if (config.targetTable === RB_TABLES.musicTracks) {
    return supabase.from(RB_TABLES.musicTracks).insert({
      user_id: user.id,
      ...identity,
      title,
      description,
      audio_url: url,
      cover_url: null,
      genre: category,
      mood: tag,
      is_published: true,
      metadata: { upload_id: upload.id, route_key: els.routeKey.value }
    });
  }

  if (config.targetTable === RB_TABLES.podcastEpisodes) {
    return supabase.from(RB_TABLES.podcastEpisodes).insert({
      user_id: user.id,
      ...identity,
      title,
      description,
      audio_url: url,
      cover_url: null,
      episode_number: 1,
      season_number: 1,
      is_published: true,
      metadata: { upload_id: upload.id, route_key: els.routeKey.value }
    });
  }

  if (config.targetTable === RB_TABLES.radioStations) {
    return supabase.from(RB_TABLES.radioStations).insert({
      user_id: user.id,
      ...identity,
      station_name: title,
      station_tag: tag,
      description,
      stream_url: url,
      cover_url: url,
      genre: category,
      is_public: true,
      metadata: { upload_id: upload.id, route_key: els.routeKey.value }
    });
  }

  if (config.targetTable === RB_TABLES.sportsUploads) {
    return supabase.from(RB_TABLES.sportsUploads).insert({
      user_id: user.id,
      ...identity,
      title,
      caption: description,
      sport_name: category,
      team_name: tag,
      content_type: mediaType === "video" ? "clip" : mediaType,
      clip_type: "highlight",
      file_url: url,
      thumbnail_url: null,
      metadata: { upload_id: upload.id, route_key: els.routeKey.value }
    });
  }

  if (config.targetTable === RB_TABLES.gameClips) {
    return supabase.from(RB_TABLES.gameClips).insert({
      user_id: user.id,
      ...identity,
      game_slug: tag || category || "rich-bizness",
      title,
      caption: description,
      clip_url: url,
      thumbnail_url: null,
      metadata: { upload_id: upload.id, route_key: els.routeKey.value }
    });
  }

  if (config.targetTable === RB_TABLES.products) {
    const isDigital = els.routeKey.value === "store-digital";

    return supabase.from(RB_TABLES.products).insert({
      seller_id: user.id,
      title,
      description,
      category,
      product_type: isDigital ? "digital" : "physical",
      fulfillment_type: isDigital ? "digital" : "shipping",
      price_cents: 0,
      currency: "usd",
      image_url: mediaType === "image" ? url : null,
      media_url: url,
      digital_file_url: isDigital ? url : null,
      is_digital: isDigital,
      is_public: true,
      status: "active",
      metadata: { upload_id: upload.id, route_key: els.routeKey.value, tag }
    });
  }

  if (config.targetTable === RB_TABLES.profiles) {
    const column = els.routeKey.value === "profile-banner" ? "banner_url" : "avatar_url";

    return supabase
      .from(RB_TABLES.profiles)
      .update({
        [column]: url,
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);
  }

  if (config.targetTable === RB_TABLES.metaAvatars) {
    return supabase.from(RB_TABLES.metaAvatars).upsert(
      {
        user_id: user.id,
        display_name: identity.display_name,
        avatar_url: url,
        aura: "green-gold",
        rank: "Traveler",
        is_active: true,
        metadata: { upload_id: upload.id, route_key: els.routeKey.value },
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );
  }

  return { error: null };
}

async function handleUpload(event) {
  event.preventDefault();

  authState = getCurrentUserState();

  const user = authState?.user;
  const profile = authState?.profile;
  const file = els.file?.files?.[0];

  if (!user) {
    setStatus("SIGN IN REQUIRED");
    window.location.href = "/auth";
    return;
  }

  if (!file) {
    setStatus("CHOOSE A FILE");
    return;
  }

  const config = routeConfig();
  const mediaType = getMediaType(file, config);
  const filePath = `${user.id}/${Date.now()}-${safeName(file.name)}`;

  try {
    setLoading(true);
    setStatus("UPLOADING");

    const uploadResult = await supabase.storage
      .from(config.bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined
      });

    if (uploadResult.error) throw uploadResult.error;

    const url = publicUrl(config.bucket, filePath);

    const upload = await insertUploadRecord({
      user,
      config,
      file,
      filePath,
      url,
      mediaType
    });

    const sectionResult = await createSectionRecord({
      user,
      profile,
      config,
      upload,
      url,
      mediaType
    });

    if (sectionResult?.error) throw sectionResult.error;

    setStatus("DROP LIVE");

    els.form.reset();
    paintPreview();
    syncRouteLabel();
  } catch (error) {
    console.error("[upload.js]", error);
    setStatus(error?.message || "UPLOAD FAILED");
  } finally {
    setLoading(false);
  }
}

async function bootUploadPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    authState = getCurrentUserState();
    supabase = getSupabase();

    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");

    if (section && ROUTES[section] && els.routeKey) {
      els.routeKey.value = section;
    }

    syncRouteLabel();

    els.routeKey?.addEventListener("change", syncRouteLabel);
    els.file?.addEventListener("change", paintPreview);
    els.form?.addEventListener("submit", handleUpload);

    markPageReady("upload");
    console.log("RB UPLOAD READY");
  } catch (error) {
    console.error("[upload.js]", error);
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootUploadPage);
} else {
  bootUploadPage();
}
