/* =========================
   RICH BIZNESS MOBILE
   /core/features/gallery/gallery-state.js

   GALLERY STATE ENGINE
   Gallery uploads + feed posts + realtime-ready UI state
========================= */

const GALLERY_STATE = {
  ready: false,
  loading: false,
  items: [],
  featured: [],
  mine: [],
  selected: null,
  counts: {
    total: 0,
    featured: 0,
    mine: 0,
    images: 0,
    videos: 0,
    audio: 0
  },
  filters: {
    category: "all",
    mediaType: "all",
    search: ""
  },
  error: null,
  listeners: new Set()
};

function cloneArray(value = []) {
  return Array.isArray(value) ? [...value] : [];
}

function cloneObject(value = {}) {
  return { ...(value || {}) };
}

function mediaTypeOf(item = {}) {
  const raw =
    item.media_type ||
    item.type ||
    item.file_type ||
    item.metadata?.media_type ||
    "";

  const url =
    item.public_url ||
    item.media_url ||
    item.file_url ||
    item.image_url ||
    item.cover_url ||
    "";

  const lower = String(url || "").toLowerCase();
  const type = String(raw || "").toLowerCase();

  if (type.includes("image")) return "image";
  if (type.includes("video")) return "video";
  if (type.includes("audio")) return "audio";

  if (/\.(png|jpg|jpeg|webp|gif|avif)(\?|$)/.test(lower)) return "image";
  if (/\.(mp4|mov|webm|m4v)(\?|$)/.test(lower)) return "video";
  if (/\.(mp3|wav|m4a|ogg)(\?|$)/.test(lower)) return "audio";

  return "file";
}

function normalizeItem(item = {}) {
  const mediaType = mediaTypeOf(item);

  return {
    ...item,
    media_type: item.media_type || mediaType,
    title:
      item.title ||
      item.name ||
      item.caption ||
      item.metadata?.title ||
      "Gallery Drop",
    description:
      item.description ||
      item.body ||
      item.caption ||
      item.metadata?.description ||
      "",
    public_url:
      item.public_url ||
      item.media_url ||
      item.file_url ||
      item.image_url ||
      item.cover_url ||
      "",
    cover_url:
      item.cover_url ||
      item.thumbnail_url ||
      item.image_url ||
      item.media_url ||
      item.public_url ||
      ""
  };
}

function calculateCounts(items = [], mine = [], featured = []) {
  return {
    total: items.length,
    featured: featured.length,
    mine: mine.length,
    images: items.filter((item) => mediaTypeOf(item) === "image").length,
    videos: items.filter((item) => mediaTypeOf(item) === "video").length,
    audio: items.filter((item) => mediaTypeOf(item) === "audio").length
  };
}

function applyFilters(items = []) {
  const { category, mediaType, search } = GALLERY_STATE.filters;

  const cleanSearch = String(search || "").trim().toLowerCase();

  return items.filter((item) => {
    const normalized = normalizeItem(item);

    const itemCategory = String(
      normalized.category ||
      normalized.section ||
      normalized.metadata?.category ||
      ""
    ).toLowerCase();

    const itemMediaType = mediaTypeOf(normalized);

    const haystack = [
      normalized.title,
      normalized.description,
      normalized.caption,
      normalized.username,
      normalized.display_name,
      normalized.category,
      normalized.section
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const categoryOk =
      !category ||
      category === "all" ||
      itemCategory === String(category).toLowerCase();

    const mediaOk =
      !mediaType ||
      mediaType === "all" ||
      itemMediaType === String(mediaType).toLowerCase();

    const searchOk =
      !cleanSearch ||
      haystack.includes(cleanSearch);

    return categoryOk && mediaOk && searchOk;
  });
}

export function getGalleryState() {
  const items = cloneArray(GALLERY_STATE.items);
  const filteredItems = applyFilters(items);

  return {
    ready: GALLERY_STATE.ready,
    loading: GALLERY_STATE.loading,
    items,
    filteredItems,
    featured: cloneArray(GALLERY_STATE.featured),
    mine: cloneArray(GALLERY_STATE.mine),
    selected: GALLERY_STATE.selected,
    counts: cloneObject(GALLERY_STATE.counts),
    filters: cloneObject(GALLERY_STATE.filters),
    error: GALLERY_STATE.error
  };
}

export function emitGalleryState() {
  const state = getGalleryState();

  GALLERY_STATE.listeners.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
      console.warn("[RB GALLERY STATE LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:gallery-state", {
      detail: state
    })
  );
}

export function onGalleryState(callback) {
  if (typeof callback !== "function") return () => {};

  GALLERY_STATE.listeners.add(callback);

  try {
    callback(getGalleryState());
  } catch (error) {
    console.warn("[RB GALLERY STATE LISTENER ERROR]", error);
  }

  return () => {
    GALLERY_STATE.listeners.delete(callback);
  };
}

export function setGalleryLoading(value = true) {
  GALLERY_STATE.loading = Boolean(value);
  emitGalleryState();
}

export function setGalleryReady(value = true) {
  GALLERY_STATE.ready = Boolean(value);
  GALLERY_STATE.loading = false;
  emitGalleryState();
}

export function setGalleryError(error = null) {
  GALLERY_STATE.error = error;
  GALLERY_STATE.loading = false;
  emitGalleryState();
}

export function setGalleryItems(items = []) {
  const normalized = Array.isArray(items)
    ? items.map(normalizeItem)
    : [];

  GALLERY_STATE.items = normalized;

  GALLERY_STATE.featured = normalized.filter((item) => {
    return Boolean(
      item.is_featured ||
      item.featured ||
      item.metadata?.featured
    );
  });

  GALLERY_STATE.counts = calculateCounts(
    GALLERY_STATE.items,
    GALLERY_STATE.mine,
    GALLERY_STATE.featured
  );

  GALLERY_STATE.ready = true;
  GALLERY_STATE.loading = false;
  GALLERY_STATE.error = null;

  emitGalleryState();
}

export function setMyGalleryItems(items = []) {
  GALLERY_STATE.mine = Array.isArray(items)
    ? items.map(normalizeItem)
    : [];

  GALLERY_STATE.counts = calculateCounts(
    GALLERY_STATE.items,
    GALLERY_STATE.mine,
    GALLERY_STATE.featured
  );

  emitGalleryState();
}

export function setFeaturedGalleryItems(items = []) {
  GALLERY_STATE.featured = Array.isArray(items)
    ? items.map(normalizeItem)
    : [];

  GALLERY_STATE.counts = calculateCounts(
    GALLERY_STATE.items,
    GALLERY_STATE.mine,
    GALLERY_STATE.featured
  );

  emitGalleryState();
}

export function upsertGalleryItem(item = {}) {
  const normalized = normalizeItem(item);

  if (!normalized?.id) return;

  const index = GALLERY_STATE.items.findIndex(
    (entry) => entry.id === normalized.id
  );

  if (index >= 0) {
    GALLERY_STATE.items[index] = {
      ...GALLERY_STATE.items[index],
      ...normalized
    };
  } else {
    GALLERY_STATE.items.unshift(normalized);
  }

  if (
    normalized.is_featured ||
    normalized.featured ||
    normalized.metadata?.featured
  ) {
    const featuredIndex = GALLERY_STATE.featured.findIndex(
      (entry) => entry.id === normalized.id
    );

    if (featuredIndex >= 0) {
      GALLERY_STATE.featured[featuredIndex] = {
        ...GALLERY_STATE.featured[featuredIndex],
        ...normalized
      };
    } else {
      GALLERY_STATE.featured.unshift(normalized);
    }
  } else {
    GALLERY_STATE.featured = GALLERY_STATE.featured.filter(
      (entry) => entry.id !== normalized.id
    );
  }

  GALLERY_STATE.counts = calculateCounts(
    GALLERY_STATE.items,
    GALLERY_STATE.mine,
    GALLERY_STATE.featured
  );

  emitGalleryState();
}

export function removeGalleryItem(itemId) {
  if (!itemId) return;

  GALLERY_STATE.items = GALLERY_STATE.items.filter(
    (item) => item.id !== itemId
  );

  GALLERY_STATE.featured = GALLERY_STATE.featured.filter(
    (item) => item.id !== itemId
  );

  GALLERY_STATE.mine = GALLERY_STATE.mine.filter(
    (item) => item.id !== itemId
  );

  if (GALLERY_STATE.selected?.id === itemId) {
    GALLERY_STATE.selected = null;
  }

  GALLERY_STATE.counts = calculateCounts(
    GALLERY_STATE.items,
    GALLERY_STATE.mine,
    GALLERY_STATE.featured
  );

  emitGalleryState();
}

export function setSelectedGalleryItem(item = null) {
  GALLERY_STATE.selected = item ? normalizeItem(item) : null;
  emitGalleryState();
}

export function clearSelectedGalleryItem() {
  GALLERY_STATE.selected = null;
  emitGalleryState();
}

export function setGalleryFilters(filters = {}) {
  GALLERY_STATE.filters = {
    ...GALLERY_STATE.filters,
    ...(filters || {})
  };

  emitGalleryState();
}

export function clearGalleryFilters() {
  GALLERY_STATE.filters = {
    category: "all",
    mediaType: "all",
    search: ""
  };

  emitGalleryState();
}

export function getGalleryCounts() {
  return cloneObject(GALLERY_STATE.counts);
}

export function getSelectedGalleryItem() {
  return GALLERY_STATE.selected;
}

export function resetGalleryState() {
  GALLERY_STATE.ready = false;
  GALLERY_STATE.loading = false;
  GALLERY_STATE.items = [];
  GALLERY_STATE.featured = [];
  GALLERY_STATE.mine = [];
  GALLERY_STATE.selected = null;
  GALLERY_STATE.counts = {
    total: 0,
    featured: 0,
    mine: 0,
    images: 0,
    videos: 0,
    audio: 0
  };
  GALLERY_STATE.filters = {
    category: "all",
    mediaType: "all",
    search: ""
  };
  GALLERY_STATE.error = null;

  emitGalleryState();
}

console.log("RB GALLERY STATE READY");
