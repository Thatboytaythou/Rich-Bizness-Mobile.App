/* =========================
   RICH BIZNESS MOBILE
   /core/features/upload/upload-state.js

   UPLOAD STATE ENGINE
   Pure upload UI state
========================= */

const UPLOAD_STATE = {
  ready: false,
  loading: false,
  uploading: false,
  progress: 0,

  routeKey: "feedPost",
  section: "feed",

  file: null,
  fileName: "",
  fileSize: 0,
  fileType: "",
  previewUrl: null,
  mediaType: "file",

  result: null,
  error: null,
  history: [],

  listeners: new Set()
};

function normalizeError(error = null) {
  if (!error) return null;

  return {
    message: error?.message || String(error),
    code: error?.code || null,
    details: error?.details || null
  };
}

function detectMediaType(file = null, fallback = "file") {
  const type = String(file?.type || "").toLowerCase();

  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";

  return fallback || "file";
}

function revokePreviewUrl() {
  if (
    UPLOAD_STATE.previewUrl &&
    String(UPLOAD_STATE.previewUrl).startsWith("blob:")
  ) {
    URL.revokeObjectURL(UPLOAD_STATE.previewUrl);
  }
}

export function getUploadState() {
  return {
    ready: UPLOAD_STATE.ready,
    loading: UPLOAD_STATE.loading,
    uploading: UPLOAD_STATE.uploading,
    progress: UPLOAD_STATE.progress,

    routeKey: UPLOAD_STATE.routeKey,
    section: UPLOAD_STATE.section,

    file: UPLOAD_STATE.file,
    fileName: UPLOAD_STATE.fileName,
    fileSize: UPLOAD_STATE.fileSize,
    fileType: UPLOAD_STATE.fileType,
    previewUrl: UPLOAD_STATE.previewUrl,
    mediaType: UPLOAD_STATE.mediaType,

    result: UPLOAD_STATE.result,
    error: UPLOAD_STATE.error ? { ...UPLOAD_STATE.error } : null,
    history: [...UPLOAD_STATE.history]
  };
}

export function setUploadReady(value = true) {
  UPLOAD_STATE.ready = Boolean(value);
  emitUploadState();
}

export function setUploadLoading(value = true) {
  UPLOAD_STATE.loading = Boolean(value);

  if (UPLOAD_STATE.loading) {
    UPLOAD_STATE.error = null;
  }

  emitUploadState();
}

export function setUploading(value = true) {
  UPLOAD_STATE.uploading = Boolean(value);

  if (UPLOAD_STATE.uploading) {
    UPLOAD_STATE.loading = true;
    UPLOAD_STATE.error = null;
  }

  emitUploadState();
}

export function setUploadProgress(progress = 0) {
  UPLOAD_STATE.progress = Math.max(
    0,
    Math.min(100, Number(progress || 0))
  );

  emitUploadState();
}

export function setUploadRoute({
  routeKey = UPLOAD_STATE.routeKey,
  section = UPLOAD_STATE.section
} = {}) {
  UPLOAD_STATE.routeKey = routeKey || "feedPost";
  UPLOAD_STATE.section = section || "feed";
  UPLOAD_STATE.error = null;

  emitUploadState();
}

export function setUploadFile({
  file = null,
  previewUrl = null,
  mediaType = ""
} = {}) {
  revokePreviewUrl();

  UPLOAD_STATE.file = file;
  UPLOAD_STATE.fileName = file?.name || "";
  UPLOAD_STATE.fileSize = Number(file?.size || 0);
  UPLOAD_STATE.fileType = file?.type || "";
  UPLOAD_STATE.previewUrl = previewUrl;
  UPLOAD_STATE.mediaType = mediaType || detectMediaType(file);
  UPLOAD_STATE.progress = 0;
  UPLOAD_STATE.result = null;
  UPLOAD_STATE.error = null;

  emitUploadState();
}

export function clearUploadFile() {
  revokePreviewUrl();

  UPLOAD_STATE.file = null;
  UPLOAD_STATE.fileName = "";
  UPLOAD_STATE.fileSize = 0;
  UPLOAD_STATE.fileType = "";
  UPLOAD_STATE.previewUrl = null;
  UPLOAD_STATE.mediaType = "file";

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
  UPLOAD_STATE.error = normalizeError(error);
  UPLOAD_STATE.uploading = false;
  UPLOAD_STATE.loading = false;

  emitUploadState();
}

export function resetUploadState({
  keepRoute = true,
  keepHistory = true
} = {}) {
  revokePreviewUrl();

  const routeKey = UPLOAD_STATE.routeKey;
  const section = UPLOAD_STATE.section;
  const history = [...UPLOAD_STATE.history];

  UPLOAD_STATE.loading = false;
  UPLOAD_STATE.uploading = false;
  UPLOAD_STATE.progress = 0;

  UPLOAD_STATE.file = null;
  UPLOAD_STATE.fileName = "";
  UPLOAD_STATE.fileSize = 0;
  UPLOAD_STATE.fileType = "";
  UPLOAD_STATE.previewUrl = null;
  UPLOAD_STATE.mediaType = "file";

  UPLOAD_STATE.result = null;
  UPLOAD_STATE.error = null;

  if (!keepRoute) {
    UPLOAD_STATE.routeKey = "feedPost";
    UPLOAD_STATE.section = "feed";
  } else {
    UPLOAD_STATE.routeKey = routeKey;
    UPLOAD_STATE.section = section;
  }

  if (!keepHistory) {
    UPLOAD_STATE.history = [];
  } else {
    UPLOAD_STATE.history = history;
  }

  emitUploadState();
}

export function pushUploadHistory(item = {}) {
  if (!item) return;

  UPLOAD_STATE.history.unshift({
    ...item,
    created_at: item.created_at || new Date().toISOString()
  });

  UPLOAD_STATE.history = UPLOAD_STATE.history.slice(0, 25);

  emitUploadState();
}

export function clearUploadHistory() {
  UPLOAD_STATE.history = [];
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

window.addEventListener("beforeunload", revokePreviewUrl);

console.log("RB UPLOAD STATE READY");
