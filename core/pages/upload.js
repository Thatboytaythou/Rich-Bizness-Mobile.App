/* =========================
   RICH BIZNESS MOBILE
   /core/pages/upload.js

   UNIVERSAL UPLOAD ROUTER
   uploads + section records
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

const $ = (id) => document.getElementById(id);

const ROUTES = {
  general: {
    section: "feed",
    bucket: "general-uploads",
    targetTable: "feed_posts",
    mediaType: "file"
  },
  feed: {
    section: "feed",
    bucket: "general-uploads",
    targetTable: "feed_posts",
    mediaType: "file"
  },
  gallery: {
    section: "gallery",
    bucket: "gallery-media",
    targetTable: "feed_posts",
    mediaType: "image"
  },
  music: {
    section: "music",
    bucket: "music-audio",
    targetTable: "music_tracks",
    mediaType: "audio"
  },
  podcast: {
    section: "podcast",
    bucket: "podcast-audio",
    targetTable: "podcast_episodes",
    mediaType: "audio"
  },
  radio: {
    section: "radio",
    bucket: "radio-covers",
    targetTable: "radio_stations",
    mediaType: "image"
  },
  sports: {
    section: "sports",
    bucket: "sports-media",
    targetTable: "sports_uploads",
    mediaType: "video"
  },
  gaming: {
    section: "gaming",
    bucket: "game-clips",
    targetTable: "game_clips",
    mediaType: "video"
  },
  "store-product": {
    section: "store",
    bucket: "store-products",
    targetTable: "products",
    mediaType: "image"
  },
  "store-digital": {
    section: "store",
    bucket: "store-digital",
    targetTable: "products",
    mediaType: "file"
  },
  "live-thumbnail": {
    section: "live",
    bucket: "live-thumbnails",
    targetTable: "live_streams",
    mediaType: "image"
  },
  "live-recording": {
    section: "live",
    bucket: "live-recordings",
    targetTable: "uploads",
    mediaType: "video"
  },
  "profile-avatar": {
    section: "profile",
    bucket: "avatars",
    targetTable: "profiles",
    mediaType: "image"
  },
  "profile-banner": {
    section: "profile",
    bucket: "profile-banners",
    targetTable: "profiles",
    mediaType: "image"
  },
  "meta-avatar": {
    section: "meta",
    bucket: "meta-avatars",
    targetTable: "meta_avatars",
    mediaType: "image"
  }
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
  submit: $("uploadSubmitBtn"),
  message: $("uploadMessage"),
  statusLabel: $("upload-status-label"),
  routeLabel: $("upload-route-label")
};

let supabase = null;
let authState = null;

function setStatus(text) {
  if (els.statusLabel) els.statusLabel.textContent = text;
  if (els.message) els.message.textContent = text;
}

function setLoading(isLoading) {
  els.form?.classList.toggle("is-loading", isLoading);

  els.form
    ?.querySelectorAll("button,input,textarea,select")
    .forEach((el) => {
      el.disabled = isLoading;
    });
}

function routeConfig() {
  return ROUTES[els.routeKey?.value] || ROUTES.general;
}

function getMediaType(file, config) {
  const mime = file?.type || "";

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";

  return config.mediaType || "file";
}

function safeName(fileName) {
  return String(fileName || "upload")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
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

  if (!els.category?.value) {
    els.category.value = config.section;
  }
}

function profilePayload(profile, user) {
  return {
    username: profile?.username || null,
    display_name: profile?.display_name || user?.email?.split("@")[0] || "Rich User"
  };
}

async function insertUploadRecord({ user, config, file, filePath, url, mediaType }) {
  const title = els.title.value.trim();
  const description = els.description.value.trim();
  const category = els.category.value.trim() || config.section;

  const { data, error } = await supabase
    .from("uploads")
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

  if (config.targetTable === "feed_posts") {
    return supabase.from("feed_posts").insert({
      user_id: user.id,
      ...identity,
      body: description || title,
      media_url: url,
      media_type: mediaType,
      thumbnail_url: mediaType === "image" ? url : null,
      section: config.section,
      visibility: "public",
      metadata: {
        upload_id: upload.id,
        route_key: els.routeKey.value,
        category,
        tag
      }
    });
  }

  if (config.targetTable === "music_tracks") {
    return supabase.from("music_tracks").insert({
      user_id: user.id,
      ...identity,
      title,
      description,
      audio_url: url,
      cover_url: null,
      genre: category,
      mood: tag,
      is_published: true,
      metadata: {
        upload_id: upload.id,
        route_key: els.routeKey.value
      }
    });
  }

  if (config.targetTable === "podcast_episodes") {
    return supabase.from("podcast_episodes").insert({
      user_id: user.id,
      ...identity,
      title,
      description,
      audio_url: url,
      cover_url: null,
      episode_number: 1,
      season_number: 1,
      is_published: true,
      metadata: {
        upload_id: upload.id,
        route_key: els.routeKey.value
      }
    });
  }

  if (config.targetTable === "radio_stations") {
    return supabase.from("radio_stations").insert({
      user_id: user.id,
      ...identity,
      station_name: title,
      station_tag: tag,
      description,
      stream_url: url,
      cover_url: url,
      genre: category,
      is_public: true,
      metadata: {
        upload_id: upload.id,
        route_key: els.routeKey.value
      }
    });
  }

  if (config.targetTable === "sports_uploads") {
    return supabase.from("sports_uploads").insert({
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
      metadata: {
        upload_id: upload.id,
        route_key: els.routeKey.value
      }
    });
  }

  if (config.targetTable === "game_clips") {
    return supabase.from("game_clips").insert({
      user_id: user.id,
      ...identity,
      game_slug: tag || category || "rich-bizness",
      title,
      caption: description,
      clip_url: url,
      thumbnail_url: null,
      metadata: {
        upload_id: upload.id,
        route_key: els.routeKey.value
      }
    });
  }

  if (config.targetTable === "products") {
    return supabase.from("products").insert({
      seller_id: user.id,
      title,
      description,
      category,
      product_type: els.routeKey.value === "store-digital" ? "digital" : "physical",
      fulfillment_type: els.routeKey.value === "store-digital" ? "digital" : "shipping",
      price_cents: 0,
      currency: "usd",
      image_url: mediaType === "image" ? url : null,
      media_url: url,
      digital_file_url: els.routeKey.value === "store-digital" ? url : null,
      is_digital: els.routeKey.value === "store-digital",
      is_public: true,
      status: "active",
      metadata: {
        upload_id: upload.id,
        route_key: els.routeKey.value,
        tag
      }
    });
  }

  if (config.targetTable === "profiles") {
    const column = els.routeKey.value === "profile-banner" ? "banner_url" : "avatar_url";

    return supabase
      .from("profiles")
      .update({
        [column]: url,
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);
  }

  if (config.targetTable === "meta_avatars") {
    return supabase.from("meta_avatars").upsert({
      user_id: user.id,
      display_name: identity.display_name,
      avatar_url: url,
      aura: "green-gold",
      rank: "Traveler",
      is_active: true,
      metadata: {
        upload_id: upload.id,
        route_key: els.routeKey.value
      },
      updated_at: new Date().toISOString()
    }, {
      onConflict: "user_id"
    });
  }

  return { error: null };
}

async function handleUpload(event) {
  event.preventDefault();

  const user = authState?.user;
  const profile = authState?.profile;
  const file = els.file?.files?.[0];

  if (!user) {
    setStatus("SIGN IN REQUIRED");
    window.location.href = "/auth.html";
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
    console.error(error);
    setStatus(error?.message || "UPLOAD FAILED");
  } finally {
    setLoading(false);
  }
}

async function bootUploadPage() {
  try {
    authState = await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

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
    console.error(error);
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootUploadPage);
} else {
  bootUploadPage();
}
