/* =========================
   RICH BIZNESS MOBILE
   /core/pages/upload.js

   UPLOAD PAGE CONTROLLER
   Signed-in upload router
   Connects upload UI -> storage -> section router

   Updates:
   - Music files route to music_tracks, not only feed_posts
   - Podcast files route to podcast_episodes
   - Optional feed mirror for Music/Podcast with section:"music"
   - Upload XP gauge enabled
   - No project-avatar fallback
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

import {
  RB_TABLES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  getUser,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  getProfileIdentity,
  bindProfileShell,
  buildProfileUrl
} from "/core/shared/rb-profile.js";

import {
  refreshProfileState
} from "/core/features/profile/profile-state.js";

import {
  syncAvatarToUniverse
} from "/core/features/profile/avatar-sync.js";

import {
  setUploadReady,
  setUploadRoute,
  getUploadState,
  setUploading,
  setUploadProgress,
  setUploadResult,
  setUploadError,
  resetUploadState
} from "/core/features/upload/upload-state.js";

import {
  uploadToBucket,
  detectMediaType
} from "/core/features/upload/upload-storage.js";

import {
  getUploadSectionRoute,
  routeUploadedFile
} from "/core/features/upload/upload-section-router.js";

import {
  bindUploadDropzone,
  bindUploadProgress,
  bindUploadStatusLabel,
  readUploadForm,
  resetUploadUI
} from "/core/features/upload/upload-ui.js";

const $ = (id) => document.getElementById(id);

const FALLBACK_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";

const els = {
  form: $("rb-upload-form"),
  routeKey: $("routeKey"),

  title: $("uploadTitle"),
  description: $("uploadDescription"),
  category: $("uploadCategory"),
  tag: $("uploadTag"),

  file: $("uploadFile"),
  preview: $("uploadPreview"),
  dropzone: $("uploadDropzone") || $("uploadPreview"),

  progressBar: $("uploadProgressBar"),
  progressLabel: $("uploadProgressLabel"),

  statusLabel: $("upload-status-label"),
  routeLabel: $("upload-route-label"),
  bucketLabel: $("upload-bucket-label"),
  tableLabel: $("upload-table-label"),

  message: $("uploadMessage"),
  submit: $("uploadSubmitBtn"),
  reset: $("uploadResetBtn"),

  xpGauge: $("upload-xp-gauge"),
  xpFill: $("upload-xp-gauge-fill"),
  xpText: $("upload-xp-gauge-text"),
  xpNext: $("upload-xp-gauge-next"),
  xpLevel: $("upload-xp-level"),
  xpRank: $("upload-xp-rank")
};

let booted = false;
let cleanupDropzone = null;
let cleanupProgress = null;
let cleanupStatus = null;
let supabase = null;
let currentUser = null;
let currentProfile = null;
let profileIdentity = null;

function table(key, fallback) {
  return RB_TABLES?.[key] || fallback || key;
}

function safeText(value, fallback = "") {
  return String(value || fallback || "").trim();
}

function safeUrl(value = "", fallback = "") {
  const url = String(value || "").trim();

  if (!url || url.includes("project-avatar")) return fallback;

  if (
    url.startsWith("/") ||
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("blob:")
  ) {
    return url;
  }

  return fallback;
}

/* =========================
   XP GAUGE
========================= */

function getProfileXpModel(profile = {}, identity = {}) {
  const rawXp =
    profile?.xp ??
    profile?.rich_points ??
    profile?.points ??
    identity?.xp ??
    identity?.rich_points ??
    0;

  const rawLevel =
    profile?.rich_level ??
    profile?.level ??
    identity?.rich_level ??
    identity?.level ??
    1;

  const rank =
    profile?.rank_title ||
    profile?.rank ||
    identity?.rank_title ||
    identity?.rank ||
    "Uploader";

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
  const model = getProfileXpModel(currentProfile, profileIdentity);

  if (els.xpGauge) {
    els.xpGauge.dataset.level = String(model.level);
    els.xpGauge.dataset.rank = model.rank;
    els.xpGauge.dataset.xp = String(model.xp);
  }

  if (els.xpFill) {
    els.xpFill.style.width = `${model.percent}%`;
  }

  if (els.xpText) {
    els.xpText.textContent = `${model.xp.toLocaleString()} XP`;
  }

  if (els.xpNext) {
    els.xpNext.textContent = `${model.remaining.toLocaleString()} XP TO LVL ${model.level + 1}`;
  }

  if (els.xpLevel) {
    els.xpLevel.textContent = `LVL ${model.level}`;
  }

  if (els.xpRank) {
    els.xpRank.textContent = model.rank;
  }

  window.dispatchEvent(
    new CustomEvent("rb:xp-gauge-update", {
      detail: {
        route: "upload",
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

function syncProfileKeys() {
  const state = getCurrentUserState?.() || {};

  currentUser = state.user || getUser?.() || null;
  currentProfile = state.profile || null;
  profileIdentity = getProfileIdentity(currentProfile);

  document.body.dataset.rbRoute = "upload";
  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = profileIdentity?.id || "";
  document.body.dataset.rbProfileLocked = profileIdentity?.id ? "true" : "false";

  bindProfileShell?.();

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl(currentProfile);
  });

  document.querySelectorAll("[data-rb-current-avatar]").forEach((el) => {
    const avatar = safeUrl(
      currentProfile?.avatar_url || profileIdentity?.avatar_url,
      FALLBACK_AVATAR
    );

    if (el.tagName === "IMG") {
      el.src = avatar;
      el.alt =
        currentProfile?.display_name ||
        currentProfile?.username ||
        "Rich Bizness Profile";
    } else {
      el.style.backgroundImage = `url("${avatar}")`;
    }
  });

  renderXpGauge();
}

/* =========================
   ROUTE NORMALIZER
========================= */

function normalizeRouteKey(value = "feed") {
  const raw = String(value || "feed").trim();

  const map = {
    general: "generalUpload",
    "general-upload": "generalUpload",

    feed: "feedPost",
    "feed-post": "feedPost",

    gallery: "galleryMedia",
    "gallery-media": "galleryMedia",

    music: "musicTrack",
    "music-track": "musicTrack",
    "music-cover": "musicCover",

    podcast: "podcastAudio",
    "podcast-audio": "podcastAudio",
    "podcast-cover": "podcastCover",

    radio: "radioCover",
    "radio-cover": "radioCover",

    sports: "sportsClip",
    "sports-media": "sportsMedia",
    "sports-clip": "sportsClip",
    "sports-cover": "sportsCover",

    gaming: "gameClip",
    "game-clip": "gameClip",
    "game-asset": "gameAsset",
    "game-cover": "gameCover",

    "store-product": "storeProduct",
    "store-digital": "storeDigital",
    "store-seller": "storeSellerMedia",
    "store-seller-media": "storeSellerMedia",

    "live-thumbnail": "liveThumbnail",
    "live-recording": "liveRecording",

    "profile-avatar": "profileAvatar",
    "profile-banner": "profileBanner",

    "meta-avatar": "metaAvatar",
    meta: "metaWorld",
    "meta-world": "metaWorld"
  };

  return map[raw] || raw || "feedPost";
}

function getSelectedRouteKey() {
  return normalizeRouteKey(els.routeKey?.value || "feed");
}

/* =========================
   UI HELPERS
========================= */

function setStatus(text = "") {
  if (els.statusLabel) {
    els.statusLabel.textContent = text;
  }

  if (els.message) {
    els.message.textContent = text;
  }
}

function setLoading(active = false) {
  els.form?.classList.toggle("is-loading", active);

  els.form
    ?.querySelectorAll("button,input,textarea,select")
    .forEach((el) => {
      el.disabled = active;
    });

  if (els.submit) {
    els.submit.disabled = active;
  }
}

function applyQuerySection() {
  const params = new URLSearchParams(window.location.search);
  const section = params.get("section") || params.get("route");

  if (!section || !els.routeKey) return;

  const wantedRoute = normalizeRouteKey(section);

  const option = Array.from(els.routeKey.options).find((item) => {
    return normalizeRouteKey(item.value) === wantedRoute;
  });

  if (option) {
    els.routeKey.value = option.value;
  }
}

function syncRouteLabel() {
  const routeKey = getSelectedRouteKey();
  const route = getUploadSectionRoute(routeKey);

  setUploadRoute({
    routeKey,
    section: route.section || "feed"
  });

  if (els.routeLabel) {
    els.routeLabel.textContent = routeKey;
  }

  if (els.bucketLabel) {
    els.bucketLabel.textContent = route.bucket || "auto";
  }

  if (els.tableLabel) {
    els.tableLabel.textContent = route.table || "uploads";
  }

  if (els.category && !els.category.value) {
    els.category.value = route.section || "";
  }

  return {
    routeKey,
    route
  };
}

function buildRouteValues({
  formValues,
  route,
  routeKey,
  uploaded
}) {
  const mediaType = uploaded.mediaType || uploaded.media_type || "file";
  const publicUrl = uploaded.publicUrl || uploaded.public_url || "";

  return {
    ...formValues,

    route_key: routeKey,
    upload_route: routeKey,

    tag: els.tag?.value?.trim() || formValues.tag || "",
    category: formValues.category || route.section || "",
    section: route.section || formValues.section || "feed",

    media_type: mediaType,
    file_url: publicUrl || uploaded.path || "",
    media_url: publicUrl,
    public_url: publicUrl,
    storage_path: uploaded.path || "",
    bucket: uploaded.bucket || route.bucket || "",

    metadata: {
      ...(formValues.metadata || {}),
      source: "upload.js",
      route_key: routeKey,
      section: route.section || "",
      bucket: uploaded.bucket || route.bucket || "",
      storage_path: uploaded.path || "",
      media_type: mediaType,
      original_file_name: uploaded.fileName || uploaded.file_name || ""
    }
  };
}

/* =========================
   MUSIC ROUTE FIX
========================= */

function isMusicRoute(routeKey = "", route = {}, file = null) {
  const key = String(routeKey || "").toLowerCase();
  const section = String(route?.section || "").toLowerCase();
  const type = file?.type || "";

  return (
    key === "musictrack" ||
    key === "music" ||
    key === "music-track" ||
    section === "music" ||
    type.startsWith("audio/")
  );
}

function isPodcastRoute(routeKey = "", route = {}) {
  const key = String(routeKey || "").toLowerCase();
  const section = String(route?.section || "").toLowerCase();

  return (
    key === "podcastaudio" ||
    key === "podcast" ||
    key === "podcast-audio" ||
    section === "podcast"
  );
}

async function routeMusicUpload({
  user,
  values,
  uploaded,
  routeKey
}) {
  const publicUrl = uploaded.publicUrl || uploaded.public_url || values.public_url;
  const title = safeText(values.title, "Untitled Track");

  const trackPayload = {
    artist_user_id: user.id,
    user_id: user.id,
    title,
    description: safeText(values.description, ""),
    audio_url: publicUrl,
    file_url: publicUrl,
    cover_url: values.cover_url || null,
    genre: values.category || values.genre || values.tag || null,
    mood: values.tag || null,
    is_published: true,
    visibility: "public",
    metadata: {
      ...(values.metadata || {}),
      source: "upload.js",
      routed_to: "music_tracks",
      upload_route: routeKey,
      profile_id: profileIdentity?.id || user.id
    }
  };

  const { data: track, error: trackError } = await supabase
    .from(table("musicTracks", "music_tracks"))
    .insert(trackPayload)
    .select("*")
    .single();

  if (trackError) throw trackError;

  const { data: feedPost, error: feedError } = await supabase
    .from(table("feedPosts", "feed_posts"))
    .insert({
      user_id: user.id,
      section: "music",
      post_type: "music",
      title,
      body: safeText(values.description, ""),
      media_url: publicUrl,
      file_url: publicUrl,
      cover_url: values.cover_url || null,
      visibility: "public",
      metadata: {
        ...(values.metadata || {}),
        source: "upload.js",
        routed_to: "music_tracks",
        music_track_id: track?.id || null,
        upload_route: routeKey,
        profile_id: profileIdentity?.id || user.id
      }
    })
    .select("*")
    .single();

  if (feedError) {
    console.warn("[RB MUSIC FEED MIRROR WARNING]", feedError?.message || feedError);
  }

  return {
    table: "music_tracks",
    track,
    feedPost: feedPost || null
  };
}

async function routePodcastUpload({
  user,
  values,
  uploaded,
  routeKey
}) {
  const publicUrl = uploaded.publicUrl || uploaded.public_url || values.public_url;
  const title = safeText(values.title, "Untitled Episode");

  const episodePayload = {
    user_id: user.id,
    creator_id: user.id,
    title,
    description: safeText(values.description, ""),
    audio_url: publicUrl,
    file_url: publicUrl,
    cover_url: values.cover_url || null,
    episode_number: Number(values.episode_number || values.episode || 0) || null,
    is_published: true,
    visibility: "public",
    metadata: {
      ...(values.metadata || {}),
      source: "upload.js",
      routed_to: "podcast_episodes",
      upload_route: routeKey,
      profile_id: profileIdentity?.id || user.id
    }
  };

  const { data: episode, error: episodeError } = await supabase
    .from(table("podcastEpisodes", "podcast_episodes"))
    .insert(episodePayload)
    .select("*")
    .single();

  if (episodeError) throw episodeError;

  const { data: feedPost, error: feedError } = await supabase
    .from(table("feedPosts", "feed_posts"))
    .insert({
      user_id: user.id,
      section: "music",
      post_type: "podcast",
      title,
      body: safeText(values.description, ""),
      media_url: publicUrl,
      file_url: publicUrl,
      cover_url: values.cover_url || null,
      visibility: "public",
      metadata: {
        ...(values.metadata || {}),
        source: "upload.js",
        routed_to: "podcast_episodes",
        podcast_episode_id: episode?.id || null,
        upload_route: routeKey,
        profile_id: profileIdentity?.id || user.id
      }
    })
    .select("*")
    .single();

  if (feedError) {
    console.warn("[RB PODCAST FEED MIRROR WARNING]", feedError?.message || feedError);
  }

  return {
    table: "podcast_episodes",
    episode,
    feedPost: feedPost || null
  };
}

async function routeUploadLocked({
  user,
  routeKey,
  route,
  uploaded,
  values,
  file
}) {
  if (isPodcastRoute(routeKey, route)) {
    return routePodcastUpload({
      user,
      values,
      uploaded,
      routeKey
    });
  }

  if (isMusicRoute(routeKey, route, file)) {
    return routeMusicUpload({
      user,
      values,
      uploaded,
      routeKey
    });
  }

  return routeUploadedFile({
    section: routeKey,
    uploaded,
    values
  });
}

/* =========================
   SUBMIT
========================= */

async function handleUpload(event) {
  event.preventDefault();

  const user = getUser();
  const state = getUploadState();

  if (!user?.id) {
    setStatus("SIGN IN REQUIRED");
    window.location.href = `${RB_ROUTES.auth || "/auth"}?next=${encodeURIComponent(
      window.location.pathname
    )}`;
    return;
  }

  if (!state.file) {
    setStatus("CHOOSE A FILE");
    return;
  }

  const { routeKey, route } = syncRouteLabel();
  const formValues = readUploadForm(els.form);

  try {
    setLoading(true);
    setUploading(true);
    setUploadProgress(5);
    setStatus("SYNCING IDENTITY");

    await ensureMyProfile();
    await refreshAppIdentity();

    syncProfileKeys();

    setStatus("UPLOADING TO STORAGE");

    const uploaded = await uploadToBucket({
      bucket: route.bucket,
      file: state.file,
      userId: user.id,
      folder: route.folder || route.section || routeKey,
      upsert: false,
      metadata: {
        route_key: routeKey,
        section: route.section || "",
        table: route.table || "",
        column: route.column || ""
      }
    });

    uploaded.mediaType = detectMediaType(state.file);
    uploaded.media_type = uploaded.mediaType;

    setUploadProgress(82);
    setStatus("ROUTING TO SECTION");

    const values = buildRouteValues({
      formValues,
      route,
      routeKey,
      uploaded
    });

    const routed = await routeUploadLocked({
      user,
      routeKey,
      route,
      uploaded,
      values,
      file: state.file
    });

    setUploadProgress(95);
    setStatus("SYNCING PROFILE");

    await refreshProfileState();
    await refreshAppIdentity();

    syncProfileKeys();

    if (
      ["profileAvatar", "profileBanner", "metaAvatar"].includes(routeKey)
    ) {
      await syncAvatarToUniverse();
    }

    const result = {
      uploaded,
      routed,
      routeKey,
      section:
        routed?.table === "music_tracks"
          ? "music"
          : routed?.table === "podcast_episodes"
            ? "music"
            : route.section || "feed"
    };

    setUploadResult(result);
    setUploadProgress(100);
    setStatus("DROP LIVE");

    resetUploadUI({
      form: els.form,
      preview: els.preview,
      input: els.file
    });

    syncRouteLabel();
    renderXpGauge();

    window.dispatchEvent(
      new CustomEvent("rb:upload-complete", {
        detail: result
      })
    );
  } catch (error) {
    console.error("[RB UPLOAD FAILED]", error);
    setUploadError(error);
    setStatus(error?.message || "UPLOAD FAILED");
  } finally {
    setLoading(false);
  }
}

/* =========================
   BIND
========================= */

function bindUI() {
  if (els.form?.dataset.rbUploadPageBound === "true") return;

  els.form.dataset.rbUploadPageBound = "true";

  els.routeKey?.addEventListener("change", syncRouteLabel);
  els.form?.addEventListener("submit", handleUpload);

  els.reset?.addEventListener("click", () => {
    resetUploadUI({
      form: els.form,
      preview: els.preview,
      input: els.file
    });

    syncRouteLabel();
    setStatus("READY");
  });

  cleanupDropzone = bindUploadDropzone({
    dropzone: els.dropzone,
    fileInput: els.file,
    preview: els.preview
  });

  cleanupProgress = bindUploadProgress({
    bar: els.progressBar,
    label: els.progressLabel
  });

  cleanupStatus = bindUploadStatusLabel({
    target: els.statusLabel
  });
}

/* =========================
   BOOT
========================= */

async function bootUploadPage() {
  if (booted) return;

  booted = true;

  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    await ensureMyProfile();
    await refreshProfileState();
    await refreshAppIdentity();

    syncProfileKeys();

    applyQuerySection();
    bindUI();
    syncRouteLabel();

    resetUploadState();
    setUploadReady(true);
    setStatus("READY");

    document.body.dataset.rbPage = "upload";
    document.body.dataset.rbRoute = "upload";
    document.body.dataset.rbProfileLock = "true";
    document.body.classList.add("rb-upload-ready");

    markPageReady("upload");

    console.log("RB UPLOAD READY");
  } catch (error) {
    console.error("[RB UPLOAD BOOT FAILED]", error);
    markPageError(error);
    setUploadError(error);
    setStatus(error?.message || "UPLOAD FAILED TO BOOT");
  }
}

window.addEventListener("beforeunload", () => {
  cleanupDropzone?.();
  cleanupProgress?.();
  cleanupStatus?.();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootUploadPage);
} else {
  bootUploadPage();
}
