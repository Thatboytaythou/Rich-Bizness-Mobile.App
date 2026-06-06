/* =========================
   RICH BIZNESS MOBILE
   /core/features/upload/upload-ui.js

   UPLOAD UI ENGINE
   Preview + Form Binding
   DOM only, no Supabase
========================= */

import {
  setUploadFile,
  setUploadRoute,
  setUploadProgress,
  resetUploadState,
  clearUploadFile,
  onUploadState
} from "/core/features/upload/upload-state.js";

import {
  detectMediaType
} from "/core/features/upload/upload-storage.js";

function $(target) {
  return typeof target === "string"
    ? document.querySelector(target)
    : target;
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatFileSize(bytes = 0) {
  const size = Number(bytes || 0);

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function createPreviewUrl(file) {
  if (!file) return null;
  return URL.createObjectURL(file);
}

/* =========================
   PREVIEW
========================= */

export function renderUploadPreview({
  target,
  file = null,
  previewUrl = "",
  mediaType = "file"
} = {}) {
  const el = $(target);
  if (!el) return;

  if (!file || !previewUrl) {
    el.innerHTML = `
      <div class="upload-preview-empty">
        <strong>No file selected</strong>
        <span>Drop media here or tap to choose.</span>
      </div>
    `;
    return;
  }

  const name = escapeHtml(file.name || "Upload preview");
  const size = escapeHtml(formatFileSize(file.size || 0));

  if (mediaType === "image") {
    el.innerHTML = `
      <figure class="upload-preview-card">
        <img
          class="upload-preview-media"
          src="${escapeHtml(previewUrl)}"
          alt="${name}"
        />
        <figcaption>
          <strong>${name}</strong>
          <span>${size}</span>
        </figcaption>
      </figure>
    `;
    return;
  }

  if (mediaType === "video") {
    el.innerHTML = `
      <figure class="upload-preview-card">
        <video
          class="upload-preview-media"
          src="${escapeHtml(previewUrl)}"
          controls
          playsinline
          preload="metadata"
        ></video>
        <figcaption>
          <strong>${name}</strong>
          <span>${size}</span>
        </figcaption>
      </figure>
    `;
    return;
  }

  if (mediaType === "audio") {
    el.innerHTML = `
      <div class="upload-preview-file upload-preview-audio-card">
        <strong>${name}</strong>
        <span>${size}</span>
        <audio
          class="upload-preview-audio"
          src="${escapeHtml(previewUrl)}"
          controls
          preload="metadata"
        ></audio>
      </div>
    `;
    return;
  }

  el.innerHTML = `
    <div class="upload-preview-file">
      <strong>${name}</strong>
      <span>${size}</span>
    </div>
  `;
}

/* =========================
   DROPZONE
========================= */

export function bindUploadDropzone({
  dropzone,
  fileInput,
  preview,
  onFile
} = {}) {
  const zone = $(dropzone);
  const input = $(fileInput);

  if (!zone || !input) return () => {};

  if (zone.dataset.rbUploadDropzoneBound === "true") {
    return () => {};
  }

  zone.dataset.rbUploadDropzoneBound = "true";

  const pickFile = (file) => {
    if (!file) return;

    const previewUrl = createPreviewUrl(file);
    const mediaType = detectMediaType(file);

    setUploadFile({
      file,
      previewUrl,
      mediaType
    });

    renderUploadPreview({
      target: preview,
      file,
      previewUrl,
      mediaType
    });

    if (typeof onFile === "function") {
      onFile({
        file,
        previewUrl,
        mediaType
      });
    }
  };

  const onInputChange = () => {
    pickFile(input.files?.[0]);
  };

  const onClick = (event) => {
    if (event.target === input) return;
    input.click();
  };

  const onDragOver = (event) => {
    event.preventDefault();
    zone.classList.add("is-dragging");
  };

  const onDragLeave = (event) => {
    event.preventDefault();
    zone.classList.remove("is-dragging");
  };

  const onDrop = (event) => {
    event.preventDefault();
    zone.classList.remove("is-dragging");

    pickFile(event.dataTransfer?.files?.[0]);
  };

  input.addEventListener("change", onInputChange);
  zone.addEventListener("click", onClick);
  zone.addEventListener("dragover", onDragOver);
  zone.addEventListener("dragleave", onDragLeave);
  zone.addEventListener("drop", onDrop);

  return () => {
    input.removeEventListener("change", onInputChange);
    zone.removeEventListener("click", onClick);
    zone.removeEventListener("dragover", onDragOver);
    zone.removeEventListener("dragleave", onDragLeave);
    zone.removeEventListener("drop", onDrop);

    zone.dataset.rbUploadDropzoneBound = "false";
  };
}

/* =========================
   ROUTE / STATUS UI
========================= */

export function bindUploadRouteSelect({
  select,
  routeLabel = null,
  sectionLabel = null,
  bucketLabel = null,
  tableLabel = null,
  routes = {}
} = {}) {
  const selectEl = $(select);
  const routeEl = $(routeLabel);
  const sectionEl = $(sectionLabel);
  const bucketEl = $(bucketLabel);
  const tableEl = $(tableLabel);

  if (!selectEl) return () => {};

  const paint = () => {
    const routeKey = selectEl.value || "feedPost";
    const route = routes?.[routeKey] || {};
    const section = route.section || routeKey || "feed";

    setUploadRoute({
      routeKey,
      section
    });

    if (routeEl) routeEl.textContent = routeKey;
    if (sectionEl) sectionEl.textContent = section;
    if (bucketEl) bucketEl.textContent = route.bucket || "auto";
    if (tableEl) tableEl.textContent = route.table || "auto";
  };

  selectEl.addEventListener("change", paint);
  paint();

  return () => selectEl.removeEventListener("change", paint);
}

export function bindUploadProgress({
  bar,
  label
} = {}) {
  const barEl = $(bar);
  const labelEl = $(label);

  return onUploadState((state) => {
    const progress = Number(state.progress || 0);

    if (barEl) {
      barEl.style.width = `${progress}%`;
      barEl.setAttribute("aria-valuenow", String(progress));
    }

    if (labelEl) {
      if (state.uploading) {
        labelEl.textContent = `Uploading ${progress}%`;
      } else if (state.error) {
        labelEl.textContent = state.error?.message || "Upload failed.";
      } else if (state.result) {
        labelEl.textContent = "Upload complete.";
      } else {
        labelEl.textContent = "Ready.";
      }
    }
  });
}

export function bindUploadStatusLabel({
  target
} = {}) {
  const el = $(target);

  if (!el) return () => {};

  return onUploadState((state) => {
    if (state.uploading) {
      el.textContent = `UPLOADING ${state.progress || 0}%`;
      return;
    }

    if (state.error) {
      el.textContent = "ERROR";
      return;
    }

    if (state.result) {
      el.textContent = "COMPLETE";
      return;
    }

    el.textContent = "READY";
  });
}

/* =========================
   FORM
========================= */

function numberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function readUploadForm(form) {
  const el = $(form);

  if (!el) return {};

  const data = new FormData(el);

  return {
    route_key: String(data.get("route_key") || "").trim(),
    title: String(data.get("title") || "").trim(),
    description: String(data.get("description") || "").trim(),
    body: String(data.get("body") || data.get("description") || "").trim(),
    category: String(data.get("category") || "").trim(),
    tag: String(data.get("tag") || "").trim(),
    section: String(data.get("section") || "").trim(),
    visibility: String(data.get("visibility") || "public").trim(),

    price_cents: Number(data.get("price_cents") || 0),
    currency: String(data.get("currency") || "usd").trim(),

    genre: String(data.get("genre") || "").trim(),
    sport_name: String(data.get("sport_name") || "").trim(),
    game_slug: String(data.get("game_slug") || "").trim(),
    product_type: String(data.get("product_type") || "").trim(),

    episode_number: numberOrNull(data.get("episode_number")),
    show_id: String(data.get("show_id") || "").trim() || null,
    id: String(data.get("id") || "").trim() || null,

    metadata: {
      source_form: "upload-ui.js"
    }
  };
}

export function resetUploadUI({
  form,
  preview,
  input
} = {}) {
  const formEl = $(form);
  const previewEl = $(preview);
  const inputEl = $(input);

  formEl?.reset?.();

  if (inputEl) {
    inputEl.value = "";
  }

  renderUploadPreview({
    target: previewEl
  });

  setUploadProgress(0);
  clearUploadFile();
  resetUploadState();
}

console.log("RB UPLOAD UI READY");
