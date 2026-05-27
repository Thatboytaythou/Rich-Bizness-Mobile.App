import RB_CONFIG from "/core/shared/rb-config.js";

import {
  createGalaxyEngine
} from "/core/engine/galaxy-engine.js";

import {
  createPortalEngine
} from "/core/engine/portal-engine.js";

import {
  createOrbitCardsEngine
} from "/core/engine/orbit-cards.js";

import {
  createAvatarEngine
} from "/core/engine/avatar-engine.js";

import {
  createOmniFxEngine
} from "/core/engine/omni-fx.js";

/* =========================
   RICH BIZNESS MOBILE
   /core/engine/universe-preview.js

   MASTER UNIVERSE BOOT
   Scene + Camera + Renderer + Main Loop
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
  { key: "feed", title: "Global Feed", tag: "FEED", image: "/images/brand/hero-banner.png" },
  { key: "live", title: "Go Live", tag: "LIVE", image: "/images/brand/omni-watch.png.jpeg" },
  { key: "music", title: "Music Universe", tag: "MUSIC", image: "/images/brand/music-log.png.jpeg" },
  { key: "podcast", title: "Podcast Shows", tag: "PODCAST", image: "/images/brand/Avatar-hero-Banner.png.jpeg" },
  { key: "radio", title: "Live Radio", tag: "RADIO", image: "/images/brand/background-v2.png.jpeg" },
  { key: "gaming", title: "Arcade District", tag: "GAMING", image: "/images/brand/gaming-hero.png.jpeg" },
  { key: "upload", title: "Upload Content", tag: "UPLOAD", image: "/images/brand/3d-logo.png.jpeg" },
  { key: "sports", title: "Sports Arena", tag: "SPORTS", image: "/images/brand/sports-logo.png.jpeg" },
  { key: "gallery", title: "Visual Drops", tag: "GALLERY", image: "/images/brand/father-son-elite.png.jpeg" },
  { key: "store", title: "Creator Market", tag: "STORE", image: "/images/brand/gta-style-elite.png.jpeg" },
  { key: "meta", title: "Meta World", tag: "META", image: "/images/brand/meta-verse-elite.png.jpeg" }
];

let scene;
let camera;
let renderer;
let textureLoader;
let raycaster;
let pointer;
let animationFrame = null;

let galaxyEngine;
let portalEngine;
let orbitCardsEngine;
let avatarEngine;
let omniFxEngine;

const activityState = {
  liveActive: false,
  liveCount: 0,
  onlineCount: 0,
  orbitBoost: 1,
  portalBoost: 1,
  theme: "green"
};

function createUniverseContext() {
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
    modules,
    activityState,
    isMobile: () => window.innerWidth <= motion.mobileBreakpoint
  };
}

function initUniverse() {
  if (!container || !THREERef) return;

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

  const ctx = createUniverseContext();

  galaxyEngine = createGalaxyEngine(ctx);
  portalEngine = createPortalEngine(ctx);
  orbitCardsEngine = createOrbitCardsEngine(ctx);
  avatarEngine = createAvatarEngine(ctx);
  omniFxEngine = createOmniFxEngine(ctx);

  galaxyEngine?.mount?.();
  portalEngine?.mount?.();
  orbitCardsEngine?.mount?.();
  avatarEngine?.mount?.();
  omniFxEngine?.mount?.();

  bindUniverseEvents();
  bindRealtimeEvents();
  resizeUniverse();
  animateUniverse();

  document.body.classList.add("rb-universe-ready");
}

function bindUniverseEvents() {
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerUp, { passive: true });

  window.addEventListener("resize", resizeUniverse, { passive: true });
  window.addEventListener("orientationchange", resizeUniverse, { passive: true });

  window.addEventListener("beforeunload", destroyUniverse);

  window.RB_SWAP_AVATAR = () => {
    avatarEngine?.swapAvatar?.();
  };

  window.RB_PORTAL_THEME = (theme = "green") => {
    activityState.theme = theme;
    portalEngine?.setTheme?.(theme);
    galaxyEngine?.setTheme?.(theme);
    omniFxEngine?.setTheme?.(theme);
  };
}

function bindRealtimeEvents() {
  window.addEventListener("rb:activity-update", (event) => {
    const live = event.detail?.live;
    if (!live) return;

    activityState.liveActive = Boolean(live.active);
    activityState.liveCount = live.count || 0;
    activityState.orbitBoost = live.active ? 1.28 : 1;
    activityState.portalBoost = live.active ? 1.22 : 1;

    document.body.classList.toggle("rb-orbit-live-energy", live.active);

    portalEngine?.onActivityUpdate?.(activityState);
    orbitCardsEngine?.onActivityUpdate?.(activityState);
    galaxyEngine?.onActivityUpdate?.(activityState);
    omniFxEngine?.onActivityUpdate?.(activityState);
  });

  window.addEventListener("rb:presence-update", (event) => {
    activityState.onlineCount = event.detail?.onlineCount || 0;

    document.body.classList.toggle(
      "rb-orbit-presence-energy",
      activityState.onlineCount > 0
    );

    portalEngine?.onPresenceUpdate?.(activityState);
    orbitCardsEngine?.onPresenceUpdate?.(activityState);
    galaxyEngine?.onPresenceUpdate?.(activityState);
    omniFxEngine?.onPresenceUpdate?.(activityState);
  });
}

function onPointerDown(event) {
  orbitCardsEngine?.onPointerDown?.(event);
  portalEngine?.onPointerDown?.(event);
  avatarEngine?.onPointerDown?.(event);
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  orbitCardsEngine?.onPointerMove?.(event);
  portalEngine?.onPointerMove?.(event);
  avatarEngine?.onPointerMove?.(event);
}

function onPointerUp(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  orbitCardsEngine?.onPointerUp?.(event);
  portalEngine?.onPointerUp?.(event);
  avatarEngine?.onPointerUp?.(event);
}

function resizeUniverse() {
  if (!camera || !renderer) return;

  const isMobile = window.innerWidth <= motion.mobileBreakpoint;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = isMobile ? 49 : 44;
  camera.position.set(0, isMobile ? 4.2 : 4.4, isMobile ? 56 : 55);
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);

  galaxyEngine?.resize?.();
  portalEngine?.resize?.();
  orbitCardsEngine?.resize?.();
  avatarEngine?.resize?.();
  omniFxEngine?.resize?.();
}

function animateUniverse() {
  animationFrame = requestAnimationFrame(animateUniverse);

  const now = performance.now();
  const t = now * 0.001;

  galaxyEngine?.update?.(t, now);
  portalEngine?.update?.(t, now);
  orbitCardsEngine?.update?.(t, now);
  avatarEngine?.update?.(t, now);
  omniFxEngine?.update?.(t, now);

  renderer.render(scene, camera);
}

function destroyUniverse() {
  if (animationFrame) cancelAnimationFrame(animationFrame);

  galaxyEngine?.destroy?.();
  portalEngine?.destroy?.();
  orbitCardsEngine?.destroy?.();
  avatarEngine?.destroy?.();
  omniFxEngine?.destroy?.();

  animationFrame = null;
}

initUniverse();
