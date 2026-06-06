/* =========================
   RICH BIZNESS MOBILE
   /core/features/gallery/gallery-realtime.js

   GALLERY REALTIME ENGINE
   Uploads + Feed Gallery Sync
========================= */

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getUser
} from "/core/shared/rb-supabase.js";

import {
  subscribeToTable,
  unsubscribeChannel,
  rbChannelName
} from "/core/shared/rb-realtime.js";

import {
  loadGalleryItems
} from "/core/features/gallery/gallery-actions.js";

import {
  upsertGalleryItem,
  removeGalleryItem,
  setGalleryError,
  getGalleryState
} from "/core/features/gallery/gallery-state.js";

const GALLERY_REALTIME = {
  ready: false,
  running: false,
  channels: [],
  channelKeys: [],
  lastPayload: null,
  error: null,
  listeners: new Set()
};

function cloneState() {
  return {
    ready: GALLERY_REALTIME.ready,
    running: GALLERY_REALTIME.running,
    channelKeys: [...GALLERY_REALTIME.channelKeys],
    lastPayload: GALLERY_REALTIME.lastPayload,
    error: GALLERY_REALTIME.error
  };
}

export function getGalleryRealtimeState() {
  return cloneState();
}

export function onGalleryRealtime(callback) {
  if (typeof callback !== "function") return () => {};

  GALLERY_REALTIME.listeners.add(callback);

  try {
    callback(getGalleryRealtimeState());
  } catch (error) {
    console.warn("[RB GALLERY REALTIME LISTENER ERROR]", error);
  }

  return () => {
    GALLERY_REALTIME.listeners.delete(callback);
  };
}

function emitGalleryRealtime() {
  const state = getGalleryRealtimeState();

  GALLERY_REALTIME.listeners.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
      console.warn("[RB GALLERY REALTIME LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:gallery-realtime-state", {
      detail: state
    })
  );
}

function dispatchGalleryEvent(name, detail = {}) {
  window.dispatchEvent(
    new CustomEvent(name, {
      detail
    })
  );
}

function normalizeRealtimeRow(row = {}) {
  const publicUrl =
    row.public_url ||
    row.media_url ||
    row.file_url ||
    row.image_url ||
    row.cover_url ||
    "";

  return {
    ...row,
    public_url: publicUrl,
    media_url: row.media_url || publicUrl,
    cover_url:
      row.cover_url ||
      row.thumbnail_url ||
      row.image_url ||
      publicUrl,
    section: row.section || row.category || "gallery"
  };
}

function isGalleryRow(row = {}) {
  if (!row) return false;

  const section = String(row.section || "").toLowerCase();
  const category = String(row.category || "").toLowerCase();
  const route = String(row.route_key || row.upload_type || "").toLowerCase();

  return (
    section === "gallery" ||
    category === "gallery" ||
    route.includes("gallery") ||
    Boolean(row.metadata?.upload_type === "galleryMedia") ||
    Boolean(row.metadata?.section === "gallery")
  );
}

async function handleGalleryPayload(payload = {}, table = "") {
  GALLERY_REALTIME.lastPayload = payload;
  GALLERY_REALTIME.error = null;

  const eventType = payload.eventType || "";
  const oldRow = payload.old || null;
  const newRow = payload.new || null;

  try {
    if (eventType === "DELETE") {
      if (oldRow?.id && isGalleryRow(oldRow)) {
        removeGalleryItem(oldRow.id);

        dispatchGalleryEvent("rb:gallery-deleted", {
          table,
          item: oldRow,
          payload
        });
      }

      emitGalleryRealtime();
      return;
    }

    if (newRow?.id && isGalleryRow(newRow)) {
      const item = normalizeRealtimeRow(newRow);

      upsertGalleryItem(item);

      dispatchGalleryEvent("rb:gallery-upserted", {
        table,
        item,
        payload,
        state: getGalleryState()
      });

      emitGalleryRealtime();
      return;
    }

    if (table === RB_TABLES.uploads || table === RB_TABLES.feedPosts) {
      await loadGalleryItems().catch((error) => {
        console.warn("[RB GALLERY REALTIME REFRESH SKIPPED]", error?.message || error);
      });
    }
  } catch (error) {
    GALLERY_REALTIME.error = error;
    setGalleryError(error);

    console.warn("[RB GALLERY REALTIME HANDLE FAILED]", error?.message || error);
  } finally {
    emitGalleryRealtime();
  }
}

function subscribeGalleryTable({
  table,
  filter = null,
  keySuffix = ""
}) {
  if (!table) return null;

  const key = rbChannelName("gallery", table, keySuffix || "all");

  const channel = subscribeToTable({
    key,
    table,
    event: "*",
    schema: "public",
    filter,
    onChange: (payload) => handleGalleryPayload(payload, table),
    onStatus: (status) => {
      dispatchGalleryEvent("rb:gallery-realtime-status", {
        status,
        table,
        key
      });
    }
  });

  GALLERY_REALTIME.channels.push(channel);
  GALLERY_REALTIME.channelKeys.push(key);

  return channel;
}

export async function startGalleryRealtime({
  includeUploads = true,
  includeFeedPosts = true,
  includeMine = true,
  refreshOnStart = true
} = {}) {
  await stopGalleryRealtime();

  GALLERY_REALTIME.ready = false;
  GALLERY_REALTIME.running = true;
  GALLERY_REALTIME.error = null;
  GALLERY_REALTIME.lastPayload = null;

  emitGalleryRealtime();

  try {
    if (refreshOnStart) {
      await loadGalleryItems({
        includeMine
      });
    }

    if (includeUploads && RB_TABLES.uploads) {
      subscribeGalleryTable({
        table: RB_TABLES.uploads,
        keySuffix: "uploads"
      });
    }

    if (includeFeedPosts && RB_TABLES.feedPosts) {
      subscribeGalleryTable({
        table: RB_TABLES.feedPosts,
        keySuffix: "feed-posts"
      });
    }

    GALLERY_REALTIME.ready = true;
    GALLERY_REALTIME.running = true;

    dispatchGalleryEvent("rb:gallery-realtime-ready", {
      channels: [...GALLERY_REALTIME.channelKeys]
    });

    emitGalleryRealtime();

    return getGalleryRealtimeState();
  } catch (error) {
    GALLERY_REALTIME.ready = false;
    GALLERY_REALTIME.running = false;
    GALLERY_REALTIME.error = error;

    setGalleryError(error);

    console.warn("[RB GALLERY REALTIME START FAILED]", error?.message || error);

    emitGalleryRealtime();

    return getGalleryRealtimeState();
  }
}

export async function stopGalleryRealtime() {
  const keys = [...GALLERY_REALTIME.channelKeys];

  await Promise.allSettled(
    keys.map(async (key) => {
      try {
        await unsubscribeChannel(key);
      } catch (error) {
        console.warn("[RB GALLERY REALTIME UNSUB SKIPPED]", error?.message || error);
      }
    })
  );

  GALLERY_REALTIME.channels = [];
  GALLERY_REALTIME.channelKeys = [];
  GALLERY_REALTIME.running = false;
  GALLERY_REALTIME.ready = true;

  emitGalleryRealtime();
}

export async function restartGalleryRealtime(options = {}) {
  await stopGalleryRealtime();
  return await startGalleryRealtime(options);
}

export function bindGalleryRealtimeStatus({
  target = "[data-gallery-realtime-status]"
} = {}) {
  return onGalleryRealtime((state) => {
    document.querySelectorAll(target).forEach((el) => {
      if (state.error) {
        el.textContent = state.error?.message || "Gallery realtime error";
        el.dataset.status = "error";
        return;
      }

      if (state.running && state.ready) {
        el.textContent = "Gallery realtime synced";
        el.dataset.status = "ready";
        return;
      }

      if (state.running) {
        el.textContent = "Connecting gallery realtime...";
        el.dataset.status = "connecting";
        return;
      }

      el.textContent = "Gallery realtime idle";
      el.dataset.status = "idle";
    });
  });
}

export async function refreshGalleryRealtime() {
  await loadGalleryItems({
    includeMine: !!getUser()?.id
  });

  dispatchGalleryEvent("rb:gallery-refreshed", {
    state: getGalleryState()
  });

  return getGalleryState();
}

export async function bootGalleryRealtime(options = {}) {
  bindGalleryRealtimeStatus();

  const state = await startGalleryRealtime({
    includeUploads: true,
    includeFeedPosts: true,
    includeMine: !!getUser()?.id,
    refreshOnStart: true,
    ...options
  });

  console.log("RB GALLERY REALTIME READY");
  return state;
}

window.addEventListener("rb:auth-state", async () => {
  await restartGalleryRealtime({
    includeMine: !!getUser()?.id,
    refreshOnStart: true
  });
});

window.addEventListener("rb:gallery-refresh-request", async () => {
  await refreshGalleryRealtime().catch((error) => {
    console.warn("[RB GALLERY REFRESH REQUEST FAILED]", error?.message || error);
  });
});

window.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;

  await refreshGalleryRealtime().catch((error) => {
    console.warn("[RB GALLERY VISIBILITY REFRESH SKIPPED]", error?.message || error);
  });
});

window.addEventListener("beforeunload", () => {
  stopGalleryRealtime();
});

console.log("RB GALLERY REALTIME MODULE LOADED");
