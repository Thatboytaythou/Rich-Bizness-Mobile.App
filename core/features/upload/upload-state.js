/* =========================
   RICH BIZNESS MOBILE
   /core/features/upload/upload-state.js

   UPLOAD STATE ENGINE
========================= */

const UPLOAD_STATE = {
  ready: false,
  loading: false,
  uploading: false,
  progress: 0,
  routeKey: "feedPost",
  section: "feed",
  file: null,
  previewUrl: null,
  mediaType: "file",
  result: null,
  error: null,
  history: [],
  listeners: new Set()
};

export function getUploadState() {
  return {
    ready: UPLOAD_STATE.ready,
    loading: UPLOAD_STATE.loading,
    uploading: UPLOAD_STATE.uploading,
    progress: UPLOAD_STATE.progress,
    routeKey: UPLOAD_STATE.routeKey,
    section: UPLOAD_STATE.section,
    file: UPLOAD_STATE.file,
    previewUrl: UPLOAD_STATE.previewUrl,
    mediaType: UPLOAD_STATE.mediaType,
    result: UPLOAD_STATE.result,
    error: UPLOAD_STATE.error,
    history: [...UPLOAD_STATE.history]
  };
}

export function setUploadReady(value = true) {
  UPLOAD_STATE.ready = Boolean(value);
  emitUploadState();
}

export function setUploadLoading(value = true) {
  UPLOAD_STATE.loading = Boolean(value);
  emitUploadState();
}

export function setUploadProgress(progress = 0) {
  UPLOAD_STATE.progress = Math.max(0, Math.min(100, Number(progress || 0)));
  emitUploadState();
}

export function setUploadRoute({
  routeKey = UPLOAD_STATE.routeKey,
  section = UPLOAD_STATE.section
} = {}) {
  UPLOAD_STATE.routeKey = routeKey || "feedPost";
  UPLOAD_STATE.section = section || "feed";
  emitUploadState();
}

export function setUploadFile({
  file = null,
  previewUrl = null,
  mediaType = "file"
} = {}) {
  UPLOAD_STATE.file = file;
  UPLOAD_STATE.previewUrl = previewUrl;
  UPLOAD_STATE.mediaType = mediaType || "file";
  UPLOAD_STATE.error = null;
  emitUploadState();
}

export function setUploading(value = true) {
  UPLOAD_STATE.uploading = Boolean(value);
  emitUploadState();
}

export function setUploadResult(result = null) {
  UPLOAD_STATE.result = result;
  UPLOAD_STATE.uploading = false;
  UPLOAD_STATE.loading = false;
  UPLOAD_STATE.progress = result ? 100 : UPLOAD_STATE.progress;
  UPLOAD_STATE.error = null;

  if (result) {
    UPLOAD_STATE.history.unshift({
      ...result,
      created_at: new Date().toISOString()
    });

    UPLOAD_STATE.history = UPLOAD_STATE.history.slice(0, 25);
  }

  emitUploadState();
}

export function setUploadError(error = null) {
  UPLOAD_STATE.error = error;
  UPLOAD_STATE.uploading = false;
  UPLOAD_STATE.loading = false;
  emitUploadState();
}

export function resetUploadState() {
  UPLOAD_STATE.loading = false;
  UPLOAD_STATE.uploading = false;
  UPLOAD_STATE.progress = 0;
  UPLOAD_STATE.file = null;
  UPLOAD_STATE.previewUrl = null;
  UPLOAD_STATE.mediaType = "file";
  UPLOAD_STATE.result = null;
  UPLOAD_STATE.error = null;
  emitUploadState();
}

export function onUploadState(callback) {
  if (typeof callback !== "function") return () => {};

  UPLOAD_STATE.listeners.add(callback);

  try {
    callback(getUploadState());
  } catch (error) {
    console.warn("[RB UPLOAD STATE LISTENER ERROR]", error);
  }

  return () => {
    UPLOAD_STATE.listeners.delete(callback);
  };
}

export function emitUploadState() {
  const state = getUploadState();

  UPLOAD_STATE.listeners.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
      console.warn("[RB UPLOAD STATE LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:upload-state", {
      detail: state
    })
  );
}

console.log("RB UPLOAD STATE READY");
