/* =========================
   RICH BIZNESS MOBILE
   /core/pages/upload.js

   UPLOAD PAGE CONTROLLER
   Signed-in upload router
========================= */

import {
  initApp,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

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
  message: $("uploadMessage"),
  submit: $("uploadSubmitBtn")
};

let booted = false;
let cleanupDropzone = null;
let cleanupProgress = null;
let cleanupStatus = null;

function setStatus(text) {
  if (els.statusLabel) els.statusLabel.textContent = text;
  if (els.message) els.message.textContent = text;
}

function normalizeRouteKey(value = "feed") {
  const map = {
    general: "feed",
    feed: "feed",
    gallery: "gallery",
    music: "music",
    podcast: "podcast",
    radio: "radio",
    sports: "sports",
    gaming: "gaming",
    "store-product": "storeProduct",
    "store-digital": "storeDigital",
    "live-thumbnail": "liveThumbnail",
    "live-recording": "liveRecording",
    "profile-avatar": "profileAvatar",
    "profile-banner": "profileBanner",
    "meta-avatar": "profileAvatar",
    meta: "meta"
  };

  return map[value] || value || "feed";
}

function getSelectedRouteKey() {
  return normalizeRouteKey(els.routeKey?.value || "feed");
}

function syncRouteLabel() {
  const routeKey = getSelectedRouteKey();
  const route = getUploadSectionRoute(routeKey);

  setUploadRoute({
    routeKey,
    section: route.section
  });

  if (els.routeLabel) {
    els.routeLabel.textContent = `${route.section} → ${route.bucket}`;
  }

  if (els.category && !els.category.value) {
    els.category.value = route.section;
  }
}

function setLoading(active) {
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

async function handleUpload(event) {
  event.preventDefault();

  const user = getUser();
  const state = getUploadState();

  if (!user?.id) {
    setStatus("SIGN IN REQUIRED");
    window.location.href = "/auth?next=/upload";
    return;
  }

  if (!state.file) {
    setStatus("CHOOSE A FILE");
    return;
  }

  const routeKey = getSelectedRouteKey();
  const route = getUploadSectionRoute(routeKey);
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
      folder: route.section,
      upsert: false
    });

    uploaded.mediaType = detectMediaType(state.file);

    setUploadProgress(82);
    setStatus("ROUTING TO SECTION");

    const routed = await routeUploadedFile({
      section: routeKey,
      uploaded,
      values: {
        ...formValues,
        category: formValues.category || route.section,
        media_type: uploaded.mediaType
      }
    });

    setUploadProgress(95);

    await refreshProfileState();
    await refreshAppIdentity();

    if (
      ["profileAvatar", "profileBanner"].includes(routeKey)
    ) {
      await syncAvatarToUniverse();
    }

    setUploadResult({
      uploaded,
      routed,
      routeKey,
      section: route.section
    });

    setStatus("DROP LIVE");

    resetUploadUI({
      form: els.form,
      preview: els.preview,
      input: els.file
    });

    syncRouteLabel();
  } catch (error) {
    console.error("[RB UPLOAD FAILED]", error);
    setUploadError(error);
    setStatus(error?.message || "UPLOAD FAILED");
  } finally {
    setLoading(false);
  }
}

function bindUI() {
  els.routeKey?.addEventListener("change", syncRouteLabel);
  els.form?.addEventListener("submit", handleUpload);

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

    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");

    if (section && els.routeKey) {
      els.routeKey.value = section;
    }

    bindUI();
    syncRouteLabel();

    resetUploadState();
    setUploadReady(true);

    document.body.classList.add("rb-upload-ready");

    markPageReady("upload");

    console.log("RB UPLOAD READY");
  } catch (error) {
    console.error("[RB UPLOAD BOOT FAILED]", error);
    markPageError(error);
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
