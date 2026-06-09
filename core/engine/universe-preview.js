import RB_CONFIG from "/core/shared/rb-config.js";

import { createGalaxyEngine } from "/core/engine/galaxy-engine.js";
import { createPortalEngine } from "/core/engine/portal-engine.js";
import { createOrbitCardsEngine } from "/core/engine/orbit-cards.js";
import { createAvatarEngine } from "/core/engine/avatar-engine.js";
import { createOmniFxEngine } from "/core/engine/omni-fx.js";
import { createMetaWorldEngine } from "/core/features/meta/world-engine.js";

/* =========================
   RICH BIZNESS MOBILE
   /core/engine/universe-preview.js

   MASTER UNIVERSE BOOT
   Galaxy + Portal + Orbit Cards + Avatar + Meta Preview
   XP Gauge / Activity Bridge Enabled

   Keep this lightweight:
   - Preview only
   - No page controllers loaded here
   - No auth/profile heavy boot here
========================= */

const container = document.getElementById("canvas-container");
const labelEl = document.getElementById("module-label");
const THREERef = window.THREE;

const fallbackMotion = {
  mobileBreakpoint: 720,
  orbit: {
    speed: 0.00245,
    desktopRadiusX: 292,
    desktopRadiusY: 136,
    mobileRadiusX: 212,
    mobileRadiusY: 102
  },
  portal: {
    scalePulse: 0.07
  }
};

const motion = {
  ...fallbackMotion,
  ...(RB_CONFIG.motion || {}),
  orbit: {
    ...fallbackMotion.orbit,
    ...(RB_CONFIG.motion?.orbit || {})
  },
  portal: {
    ...fallbackMotion.portal,
    ...(RB_CONFIG.motion?.portal || {})
  }
};

const modules = [
  {
    key: "feed",
    title: "Global Feed",
    tag: "FEED",
    icon: "🔥",
    image: "/images/brand/hero-banner.png"
  },
  {
    key: "live",
    title: "Go Live",
    tag: "LIVE",
    icon: "📡",
    image: "/images/brand/omni-watch.png.jpeg"
  },
  {
    key: "music",
    title: "Music Universe",
    tag: "MUSIC",
    icon: "🎵",
    image: "/images/brand/music-log.png.jpeg"
  },
  {
    key: "podcast",
    title: "Podcast Shows",
    tag: "PODCAST",
    icon: "🎙️",
    image: "/images/brand/Avatar-hero-Banner.png.jpeg"
  },
  {
    key: "radio",
    title: "Live Radio",
    tag: "RADIO",
    icon: "📻",
    image: "/images/brand/background-v2.png.jpeg"
  },
  {
    key: "gaming",
    title: "Arcade District",
    tag: "GAMING",
    icon: "🎮",
    image: "/images/brand/gaming-hero.png.jpeg"
  },
  {
    key: "upload",
    title: "Upload Content",
    tag: "UPLOAD",
    icon: "⬆️",
    image: "/images/brand/3d-logo.png.jpeg"
  },
  {
    key: "sports",
    title: "Sports Arena",
    tag: "SPORTS",
    icon: "🏆",
    image: "/images/brand/sports-logo.png.jpeg"
  },
  {
    key: "gallery",
    title: "Visual Drops",
    tag: "GALLERY",
    icon: "🖼️",
    image: "/images/brand/father-son-elite.png.jpeg"
  },
  {
    key: "store",
    title: "Creator Market",
    tag: "STORE",
    icon: "🛒",
    image: "/images/brand/gta-style-elite.png.jpeg"
  },
  {
    key: "meta",
    title: "Meta World",
    tag: "META",
    icon: "🌎",
    image: "/images/brand/meta-verse-elite.png.jpeg"
  }
];

let scene = null;
let camera = null;
let renderer = null;
let textureLoader = null;
let raycaster = null;
let pointer = null;
let animationFrame = null;
let eventsBound = false;

const engines = [];

const activityState = {
  liveActive: false,
  liveCount: 0,
  onlineCount: 0,
  orbitBoost: 1,
  portalBoost: 1,
  theme: "green",
  xp: 0,
  level: 1,
  rank: "Biz Legend",
  xpPercent: 0,
  xpEnergy: 1
};

function safeImage(value = "", fallback = "/images/brand/hero-banner.png") {
  const src = String(value || "").trim();

  if (!src || src.includes("project-avatar")) return fallback;

  if (
    src.startsWith("/") ||
    src.startsWith("https://") ||
    src.startsWith("http://") ||
    src.startsWith("blob:")
  ) {
    return src;
  }

  return fallback;
}

function makeContext() {
  return {
    THREE: THREERef,
    RB_CONFIG,
    container,
    labelEl,
    scene,
    camera,
    renderer,
    textureLoader,
    raycaster,
    pointer,
    motion,
    modules: modules.map((mod) => ({
      ...mod,
      image: safeImage(mod.image)
    })),
    activityState,
    isMobile: () => window.innerWidth <= motion.mobileBreakpoint
  };
}

function safeCall(engine, method, ...args) {
  try {
    engine?.[method]?.(...args);
  } catch (error) {
    console.warn(`[RB UNIVERSE ENGINE ERROR] ${method}`, error);
  }
}

function syncActivityToBody() {
  if (!document.body) return;

  document.body.dataset.rbUniverseXp = String(activityState.xp);
  document.body.dataset.rbUniverseLevel = String(activityState.level);
  document.body.dataset.rbUniverseRank = String(activityState.rank);
  document.body.dataset.rbUniverseXpPercent = String(Math.round(activityState.xpPercent));
}

function broadcastUniverseActivity(type = "universe") {
  syncActivityToBody();

  engines.forEach((engine) => {
    safeCall(engine, "onActivityUpdate", activityState);
    safeCall(engine, "setActivityState", activityState);
  });

  window.dispatchEvent(
    new CustomEvent("rb:universe-preview-update", {
      detail: {
        type,
        activityState: { ...activityState }
      }
    })
  );
}

function initUniverse() {
  if (!container || !THREERef) {
    console.warn("[RB UNIVERSE] Missing canvas container or THREE.");
    return;
  }

  if (container.dataset.rbUniverseMounted === "true") return;

  container.dataset.rbUniverseMounted = "true";

  scene = new THREERef.Scene();
  scene.fog = new THREERef.FogExp2(0x020503, 0.012);

  camera = new THREERef.PerspectiveCamera(
    44,
    window.innerWidth / window.innerHeight,
    0.1,
    1800
  );

  camera.position.set(0, 4.4, 55);

  renderer = new THREERef.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.sortObjects = true;
  renderer.setClearColor(0x000000, 0);

  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  textureLoader = new THREERef.TextureLoader();
  raycaster = new THREERef.Raycaster();
  pointer = new THREERef.Vector2();

  const ctx = makeContext();

  engines.push(
    createGalaxyEngine(ctx),
    createMetaWorldEngine(ctx, {
      mode: "preview",
      world: "rich-bizness"
    }),
    createPortalEngine(ctx),
    createOrbitCardsEngine(ctx),
    createAvatarEngine(ctx),
    createOmniFxEngine(ctx)
  );

  engines.forEach((engine) => safeCall(engine, "mount"));

  bindEvents();
  resizeUniverse();
  animateUniverse();
  broadcastUniverseActivity("mount");

  document.body.classList.add("rb-universe-ready");

  console.log("RB UNIVERSE PREVIEW READY");
}

function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;

  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerUp, { passive: true });

  window.addEventListener("resize", resizeUniverse, { passive: true });
  window.addEventListener("orientationchange", resizeUniverse, { passive: true });
  window.addEventListener("beforeunload", destroyUniverse);

  window.addEventListener("rb:activity-update", onActivityUpdate);
  window.addEventListener("rb:presence-update", onPresenceUpdate);
  window.addEventListener("rb:xp-gauge-update", onXpGaugeUpdate);
  window.addEventListener("rb:app-xp-update", onAppXpUpdate);
  window.addEventListener("rb:rich-action", onRichAction);

  window.RB_SWAP_AVATAR = () => {
    engines.forEach((engine) => safeCall(engine, "swapAvatar"));
  };

  window.RB_PORTAL_THEME = (theme = "green") => {
    activityState.theme = theme;
    engines.forEach((engine) => safeCall(engine, "setTheme", theme));
    broadcastUniverseActivity("theme");
  };

  window.RB_UNIVERSE_ACTIVITY = (next = {}) => {
    Object.assign(activityState, next || {});
    broadcastUniverseActivity("manual");
  };

  window.RB_UNIVERSE_DESTROY = destroyUniverse;
}

function unbindEvents() {
  if (!eventsBound) return;
  eventsBound = false;

  window.removeEventListener("pointerdown", onPointerDown);
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);

  window.removeEventListener("resize", resizeUniverse);
  window.removeEventListener("orientationchange", resizeUniverse);
  window.removeEventListener("beforeunload", destroyUniverse);

  window.removeEventListener("rb:activity-update", onActivityUpdate);
  window.removeEventListener("rb:presence-update", onPresenceUpdate);
  window.removeEventListener("rb:xp-gauge-update", onXpGaugeUpdate);
  window.removeEventListener("rb:app-xp-update", onAppXpUpdate);
  window.removeEventListener("rb:rich-action", onRichAction);
}

function onActivityUpdate(event) {
  const live = event.detail?.live;
  if (!live) return;

  activityState.liveActive = Boolean(live.active);
  activityState.liveCount = Number(live.count || 0);
  activityState.orbitBoost = live.active ? 1.28 : 1;
  activityState.portalBoost = live.active ? 1.22 : 1;

  document.body.classList.toggle(
    "rb-orbit-live-energy",
    activityState.liveActive
  );

  broadcastUniverseActivity("live");
}

function onPresenceUpdate(event) {
  activityState.onlineCount = Number(event.detail?.onlineCount || 0);

  document.body.classList.toggle(
    "rb-orbit-presence-energy",
    activityState.onlineCount > 0
  );

  broadcastUniverseActivity("presence");
}

function onXpGaugeUpdate(event) {
  const detail = event.detail || {};

  activityState.xp = Math.max(0, Number(detail.xp ?? activityState.xp) || 0);
  activityState.level = Math.max(1, Number(detail.level ?? activityState.level) || 1);
  activityState.rank = detail.rank || activityState.rank || "Biz Legend";
  activityState.xpPercent = Math.max(0, Math.min(100, Number(detail.percent ?? activityState.xpPercent) || 0));

  activityState.xpEnergy =
    1 +
    Math.min(0.45, activityState.xpPercent / 240) +
    Math.min(0.25, activityState.level / 100);

  document.body.classList.toggle(
    "rb-orbit-xp-energy",
    activityState.xp > 0 || activityState.level > 1
  );

  broadcastUniverseActivity("xp");
}

function onAppXpUpdate(event) {
  onXpGaugeUpdate({
    detail: event.detail || {}
  });
}

function onRichAction(event) {
  const detail = event.detail || {};

  if (detail?.section) {
    activityState.theme = detail.section === "music"
      ? "gold"
      : detail.section === "live"
        ? "red"
        : detail.section === "gaming"
          ? "green"
          : detail.section === "store"
            ? "gold"
            : activityState.theme;
  }

  if (detail?.xp) {
    onXpGaugeUpdate({
      detail: {
        xp:
          detail.xp?.xp ??
          detail.xp?.total_xp ??
          detail.xp?.new_xp ??
          activityState.xp,
        level:
          detail.xp?.level ??
          detail.xp?.new_level ??
          activityState.level,
        rank:
          detail.xp?.rank ||
          detail.xp?.rank_title ||
          activityState.rank,
        percent: activityState.xpPercent
      }
    });
    return;
  }

  broadcastUniverseActivity("rich-action");
}

function updatePointer(event) {
  if (!pointer) return;

  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onPointerDown(event) {
  updatePointer(event);
  engines.forEach((engine) => safeCall(engine, "onPointerDown", event));
}

function onPointerMove(event) {
  updatePointer(event);
  engines.forEach((engine) => safeCall(engine, "onPointerMove", event));
}

function onPointerUp(event) {
  updatePointer(event);
  engines.forEach((engine) => safeCall(engine, "onPointerUp", event));
}

function resizeUniverse() {
  if (!camera || !renderer) return;

  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const mobile = width <= motion.mobileBreakpoint;

  camera.aspect = width / height;
  camera.fov = mobile ? 49 : 44;
  camera.position.set(0, mobile ? 4.2 : 4.4, mobile ? 56 : 55);
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(width, height);

  engines.forEach((engine) => safeCall(engine, "resize"));
}

function animateUniverse() {
  animationFrame = requestAnimationFrame(animateUniverse);

  if (!renderer || !scene || !camera) return;

  const now = performance.now();
  const t = now * 0.001;

  engines.forEach((engine) => safeCall(engine, "update", t, now));

  renderer.render(scene, camera);
}

function destroyUniverse() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }

  engines.forEach((engine) => safeCall(engine, "destroy"));
  engines.length = 0;

  if (renderer) {
    renderer.dispose?.();
    renderer.forceContextLoss?.();
  }

  if (container) {
    container.innerHTML = "";
    delete container.dataset.rbUniverseMounted;
  }

  animationFrame = null;
  scene = null;
  camera = null;
  renderer = null;
  textureLoader = null;
  raycaster = null;
  pointer = null;

  unbindEvents();

  document.body.classList.remove(
    "rb-universe-ready",
    "rb-orbit-live-energy",
    "rb-orbit-presence-energy",
    "rb-orbit-xp-energy"
  );
}

initUniverse();
