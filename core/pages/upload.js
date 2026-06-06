/* =========================
   RICH BIZNESS MOBILE
   /core/pages/upload.js

   UPLOAD PAGE CONTROLLER
   Signed-in upload router
   Connects upload UI -> storage -> section router
========================= */

import {
  initApp,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

import {
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getUser,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

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
  reset: $("uploadResetBtn")
};

let booted = false;
let cleanupDropzone = null;
let cleanupProgress = null;
let cleanupStatus = null;

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

  return {
    ...formValues,

    route_key: routeKey,
    upload_route: routeKey,

    tag: els.tag?.value?.trim() || formValues.tag || "",
    category: formValues.category || route.section || "",
    section: route.section || formValues.section || "feed",

    media_type: mediaType,
    file_url: uploaded.publicUrl || uploaded.public_url || uploaded.path || "",
    media_url: uploaded.publicUrl || uploaded.public_url || "",
    public_url: uploaded.publicUrl || uploaded.public_url || "",
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

    const routed = await routeUploadedFile({
      section: routeKey,
      uploaded,
      values
    });

    setUploadProgress(95);
    setStatus("SYNCING PROFILE");

    await refreshProfileState();
    await refreshAppIdentity();

    if (
      ["profileAvatar", "profileBanner", "metaAvatar"].includes(routeKey)
    ) {
      await syncAvatarToUniverse();
    }

    const result = {
      uploaded,
      routed,
      routeKey,
      section: route.section || "feed"
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

    await ensureMyProfile();
    await refreshProfileState();
    await refreshAppIdentity();

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
