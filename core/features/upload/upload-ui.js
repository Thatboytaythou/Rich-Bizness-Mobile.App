/* =========================
   RICH BIZNESS MOBILE
   /core/features/upload/upload-ui.js

   UPLOAD UI ENGINE
   Preview + Form Binding
========================= */

import {
  setUploadFile,
  setUploadProgress,
  resetUploadState,
  onUploadState
} from "/core/features/upload/upload-state.js";

import {
  detectMediaType
} from "/core/features/upload/upload-storage.js";

export function bindUploadDropzone({
  dropzone,
  fileInput,
  preview,
  onFile
} = {}) {
  const zone = typeof dropzone === "string"
    ? document.querySelector(dropzone)
    : dropzone;

  const input = typeof fileInput === "string"
    ? document.querySelector(fileInput)
    : fileInput;

  if (!zone || !input) return () => {};

  const pickFile = (file) => {
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
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

  const onClick = () => {
    input.click();
  };

  const onDragOver = (event) => {
    event.preventDefault();
    zone.classList.add("is-dragging");
  };

  const onDragLeave = () => {
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
  };
}

export function renderUploadPreview({
  target,
  file = null,
  previewUrl = "",
  mediaType = "file"
} = {}) {
  const el = typeof target === "string"
    ? document.querySelector(target)
    : target;

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

  if (mediaType === "image") {
    el.innerHTML = `
      <img
        class="upload-preview-media"
        src="${previewUrl}"
        alt="${file.name || "Upload preview"}"
      />
    `;
    return;
  }

  if (mediaType === "video") {
    el.innerHTML = `
      <video
        class="upload-preview-media"
        src="${previewUrl}"
        controls
        playsinline
      ></video>
    `;
    return;
  }

  if (mediaType === "audio") {
    el.innerHTML = `
      <audio
        class="upload-preview-audio"
        src="${previewUrl}"
        controls
      ></audio>
    `;
    return;
  }

  el.innerHTML = `
    <div class="upload-preview-file">
      <strong>${file.name || "File selected"}</strong>
      <span>${formatFileSize(file.size || 0)}</span>
    </div>
  `;
}

export function formatFileSize(bytes = 0) {
  const size = Number(bytes || 0);

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function bindUploadProgress({
  bar,
  label
} = {}) {
  const barEl = typeof bar === "string"
    ? document.querySelector(bar)
    : bar;

  const labelEl = typeof label === "string"
    ? document.querySelector(label)
    : label;

  return onUploadState((state) => {
    if (barEl) {
      barEl.style.width = `${state.progress || 0}%`;
      barEl.setAttribute("aria-valuenow", String(state.progress || 0));
    }

    if (labelEl) {
      if (state.uploading) {
        labelEl.textContent = `Uploading ${state.progress || 0}%`;
      } else if (state.error) {
        labelEl.textContent = String(state.error?.message || state.error);
      } else if (state.result) {
        labelEl.textContent = "Upload complete.";
      } else {
        labelEl.textContent = "Ready.";
      }
    }
  });
}

export function readUploadForm(form) {
  const el = typeof form === "string"
    ? document.querySelector(form)
    : form;

  if (!el) return {};

  const data = new FormData(el);

  return {
    title: String(data.get("title") || "").trim(),
    description: String(data.get("description") || "").trim(),
    body: String(data.get("body") || data.get("description") || "").trim(),
    category: String(data.get("category") || "").trim(),
    section: String(data.get("section") || "").trim(),
    visibility: String(data.get("visibility") || "public").trim(),
    price_cents: Number(data.get("price_cents") || 0),
    currency: String(data.get("currency") || "usd").trim(),
    genre: String(data.get("genre") || "").trim(),
    sport_name: String(data.get("sport_name") || "").trim(),
    game_slug: String(data.get("game_slug") || "").trim(),
    product_type: String(data.get("product_type") || "").trim(),
    episode_number: Number(data.get("episode_number") || 0) || null,
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
  const formEl = typeof form === "string"
    ? document.querySelector(form)
    : form;

  const previewEl = typeof preview === "string"
    ? document.querySelector(preview)
    : preview;

  const inputEl = typeof input === "string"
    ? document.querySelector(input)
    : input;

  formEl?.reset?.();

  if (inputEl) inputEl.value = "";

  renderUploadPreview({
    target: previewEl
  });

  setUploadProgress(0);
  resetUploadState();
}

export function bindUploadStatusLabel({
  target
} = {}) {
  const el = typeof target === "string"
    ? document.querySelector(target)
    : target;

  if (!el) return () => {};

  return onUploadState((state) => {
    if (state.uploading) {
      el.textContent = `Uploading ${state.progress || 0}%`;
      return;
    }

    if (state.error) {
      el.textContent = String(state.error?.message || state.error);
      return;
    }

    if (state.result) {
      el.textContent = "Upload routed successfully.";
      return;
    }

    el.textContent = "Choose a section and upload media.";
  });
}

console.log("RB UPLOAD UI READY");
