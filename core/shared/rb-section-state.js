/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-section-state.js

   UNIVERSAL SECTION STATE
========================= */

const SECTION_MAP = {
  feed: {
    key: "feed",
    label: "FEED",
    title: "Global Feed",
    meta: "Posts • Drops • Community",
    route: "/feed"
  },
  live: {
    key: "live",
    label: "LIVE",
    title: "Go Live",
    meta: "Broadcast • VIP • Realtime",
    route: "/live"
  },
  music: {
    key: "music",
    label: "MUSIC",
    title: "Music Universe",
    meta: "Tracks • Podcast • Radio",
    route: "/music"
  },
  gaming: {
    key: "gaming",
    label: "GAMES",
    title: "Arcade District",
    meta: "Chess • Runner • Scores",
    route: "/gaming"
  },
  sports: {
    key: "sports",
    label: "SPORTS",
    title: "Sports Arena",
    meta: "Picks • Clips • Broadcasts",
    route: "/sports"
  },
  gallery: {
    key: "gallery",
    label: "ART",
    title: "Gallery Vault",
    meta: "Artwork • Collect • Showcase",
    route: "/gallery"
  },
  store: {
    key: "store",
    label: "STORE",
    title: "Creator Market",
    meta: "Products • Unlocks • Sellers",
    route: "/store"
  },
  meta: {
    key: "meta",
    label: "META",
    title: "Meta World",
    meta: "Avatars • Worlds • Portals",
    route: "/meta"
  }
};

let activeSectionKey = "live";
const listeners = new Set();

export function getSections() {
  return Object.values(SECTION_MAP);
}

export function getSection(key = activeSectionKey) {
  return SECTION_MAP[key] || SECTION_MAP.live;
}

export function getActiveSection() {
  return getSection(activeSectionKey);
}

export function getActiveSectionKey() {
  return activeSectionKey;
}

export function setActiveSection(key = "live") {
  const next = getSection(key);

  activeSectionKey = next.key;

  document.body.dataset.activeSection = next.key;

  listeners.forEach((callback) => {
    callback(next);
  });

  window.dispatchEvent(
    new CustomEvent("rb:section-change", {
      detail: next
    })
  );

  return next;
}

export function onSectionChange(callback) {
  if (typeof callback !== "function") return () => {};

  listeners.add(callback);
  callback(getActiveSection());

  return () => {
    listeners.delete(callback);
  };
}

export function nextSection() {
  const sections = getSections();
  const currentIndex = sections.findIndex(
    (section) => section.key === activeSectionKey
  );

  const nextIndex =
    currentIndex >= sections.length - 1
      ? 0
      : currentIndex + 1;

  return setActiveSection(sections[nextIndex].key);
}

export function prevSection() {
  const sections = getSections();
  const currentIndex = sections.findIndex(
    (section) => section.key === activeSectionKey
  );

  const prevIndex =
    currentIndex <= 0
      ? sections.length - 1
      : currentIndex - 1;

  return setActiveSection(sections[prevIndex].key);
}

export function getSectionRoute(key = activeSectionKey) {
  return getSection(key).route;
}

console.log("RB SECTION STATE READY");
