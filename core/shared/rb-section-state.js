/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-section-state.js

   SECTION STATE ENGINE
   Shared active-section controller
   Synced to rb-config routes/modules
========================= */

import {
  RB_MODULES,
  RB_ROUTES
} from "/core/shared/rb-config.js";

const FALLBACK_SECTION_MAP = {
  feed: {
    key: "feed",
    label: "FEED",
    title: "Global Feed",
    meta: "Posts • Drops • Community",
    route: RB_ROUTES.feed
  },

  watch: {
    key: "watch",
    label: "WATCH",
    title: "Watch Room",
    meta: "Streams • Replays • Shows",
    route: RB_ROUTES.watch
  },

  live: {
    key: "live",
    label: "LIVE",
    title: "Go Live",
    meta: "Broadcast • VIP • Realtime",
    route: RB_ROUTES.live
  },

  music: {
    key: "music",
    label: "MUSIC",
    title: "Music Universe",
    meta: "Tracks • Podcast • Radio",
    route: RB_ROUTES.music
  },

  podcast: {
    key: "podcast",
    label: "PODCAST",
    title: "Podcast Shows",
    meta: "Episodes • Hosts • Audio",
    route: RB_ROUTES.podcast
  },

  radio: {
    key: "radio",
    label: "RADIO",
    title: "Live Radio",
    meta: "Stations • Streams • Rotation",
    route: RB_ROUTES.radio
  },

  gaming: {
    key: "gaming",
    label: "GAMES",
    title: "Arcade District",
    meta: "Chess • Runner • Scores",
    route: RB_ROUTES.gaming
  },

  sports: {
    key: "sports",
    label: "SPORTS",
    title: "Sports Arena",
    meta: "Picks • Clips • Broadcasts",
    route: RB_ROUTES.sports
  },

  gallery: {
    key: "gallery",
    label: "ART",
    title: "Gallery Vault",
    meta: "Artwork • Collect • Showcase",
    route: RB_ROUTES.gallery
  },

  store: {
    key: "store",
    label: "STORE",
    title: "Creator Market",
    meta: "Products • Unlocks • Sellers",
    route: RB_ROUTES.store
  },

  upload: {
    key: "upload",
    label: "UPLOAD",
    title: "Upload Core",
    meta: "Drops • Media • Router",
    route: RB_ROUTES.upload
  },

  meta: {
    key: "meta",
    label: "META",
    title: "Meta World",
    meta: "Avatars • Worlds • Portals",
    route: RB_ROUTES.meta
  },

  avatar: {
    key: "avatar",
    label: "AVATAR",
    title: "Avatar Studio",
    meta: "Playable • Identity • 3D",
    route: RB_ROUTES.avatar
  },

  messages: {
    key: "messages",
    label: "DM",
    title: "Rich DM’s",
    meta: "Messages • Calls • Smoke Rooms",
    route: RB_ROUTES.messages
  },

  notifications: {
    key: "notifications",
    label: "ALERTS",
    title: "Rich Alerts",
    meta: "Notifications • Updates • Realtime",
    route: RB_ROUTES.notifications
  },

  profile: {
    key: "profile",
    label: "PROFILE",
    title: "Profile Universe",
    meta: "Identity • Creator • Stats",
    route: RB_ROUTES.profile
  },

  edit: {
    key: "edit",
    label: "EDIT",
    title: "Edit Profile",
    meta: "Profile • Avatar • Banner",
    route: RB_ROUTES.edit
  },

  settings: {
    key: "settings",
    label: "SETTINGS",
    title: "Settings",
    meta: "Account • Sync • Profile Lock",
    route: RB_ROUTES.settings
  },

  creator: {
    key: "creator",
    label: "CREATOR",
    title: "Creator Hub",
    meta: "Money • Content • Control",
    route: RB_ROUTES.creator
  },

  admin: {
    key: "admin",
    label: "ADMIN",
    title: "Admin Core",
    meta: "Control • Moderation • System",
    route: RB_ROUTES.admin
  }
};

function normalizeSectionKey(key = "") {
  return String(key || "")
    .trim()
    .replace("/", "")
    .replace(".html", "")
    .toLowerCase();
}

function normalizePath(path = "") {
  if (!path) return "/";

  return (
    String(path)
      .replace(window.location.origin, "")
      .replace(/\/index\.html$/, "/")
      .replace(/\.html$/, "")
      .replace(/\/$/, "") || "/"
  );
}

function moduleToSection(module = {}) {
  const key = normalizeSectionKey(module.key);

  return {
    key,
    label: module.label || key.toUpperCase(),
    title:
      module.title ||
      FALLBACK_SECTION_MAP[key]?.title ||
      module.label ||
      key.toUpperCase(),
    meta:
      module.meta ||
      FALLBACK_SECTION_MAP[key]?.meta ||
      "Rich Bizness Mobile",
    route:
      module.route ||
      FALLBACK_SECTION_MAP[key]?.route ||
      RB_ROUTES[key] ||
      `/${key}`,
    icon:
      module.icon ||
      FALLBACK_SECTION_MAP[key]?.icon ||
      "◆",
    color:
      module.color ||
      FALLBACK_SECTION_MAP[key]?.color ||
      "#00ffae"
  };
}

const SECTION_MAP = {
  ...FALLBACK_SECTION_MAP,
  ...Object.fromEntries(
    (RB_MODULES || []).map((module) => {
      const section = moduleToSection(module);
      return [section.key, section];
    })
  )
};

let activeSectionKey =
  getSectionKeyByPath(window.location.pathname) ||
  "live";

const listeners = new Set();

export function getSections() {
  return Object.values(SECTION_MAP);
}

export function getSection(key = activeSectionKey) {
  const clean = normalizeSectionKey(key);
  return SECTION_MAP[clean] || SECTION_MAP.live;
}

export function getSectionByRoute(route = "") {
  const cleanRoute = normalizePath(route);

  return (
    getSections().find((section) => {
      return normalizePath(section.route) === cleanRoute;
    }) || null
  );
}

export function getSectionKeyByPath(path = window.location.pathname) {
  return getSectionByRoute(path)?.key || null;
}

export function getActiveSection() {
  return getSection(activeSectionKey);
}

export function getActiveSectionKey() {
  return activeSectionKey;
}

export function setActiveSection(key = "live", options = {}) {
  const next = getSection(key);

  activeSectionKey = next.key;

  if (document.body) {
    document.body.dataset.activeSection = next.key;
    document.body.dataset.rbSection = next.key;
  }

  listeners.forEach((callback) => {
    try {
      callback(next);
    } catch (error) {
      console.warn("[RB SECTION LISTENER ERROR]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:section-change", {
      detail: {
        ...next,
        previous: options.previous || null,
        source: options.source || "rb-section-state"
      }
    })
  );

  return next;
}

export function syncSectionFromRoute(path = window.location.pathname) {
  const key = getSectionKeyByPath(path);

  if (!key) {
    return getActiveSection();
  }

  return setActiveSection(key, {
    source: "route"
  });
}

export function onSectionChange(callback) {
  if (typeof callback !== "function") return () => {};

  listeners.add(callback);

  try {
    callback(getActiveSection());
  } catch (error) {
    console.warn("[RB SECTION LISTENER ERROR]", error);
  }

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

  return setActiveSection(sections[nextIndex].key, {
    previous: activeSectionKey,
    source: "next"
  });
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

  return setActiveSection(sections[prevIndex].key, {
    previous: activeSectionKey,
    source: "prev"
  });
}

export function getSectionRoute(key = activeSectionKey) {
  return getSection(key).route;
}

export function isActiveSection(key = "") {
  return getActiveSectionKey() === normalizeSectionKey(key);
}

window.addEventListener("popstate", () => {
  syncSectionFromRoute();
});

syncSectionFromRoute();

console.log("RB SECTION STATE READY");
