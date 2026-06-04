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

   STEP 2 LOCKED
   MASTER UNIVERSE BOOT ONLY
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
  { key: "feed", title: "Global Feed", tag: "FEED", icon: "🔥", image: "/images/brand/hero-banner.png" },
  { key: "live", title: "Go Live", tag: "LIVE", icon: "📡", image: "/images/brand/omni-watch.png.jpeg" },
  { key: "music", title: "Music Universe", tag: "MUSIC", icon: "🎵", image: "/images/brand/music-log.png.jpeg" },
  { key: "podcast", title: "Podcast Shows", tag: "PODCAST", icon: "🎙️", image: "/images/brand/Avatar-hero-Banner.png.jpeg" },
  { key: "radio", title: "Live Radio", tag: "RADIO", icon: "📻", image: "/images/brand/background-v2.png.jpeg" },
  { key: "gaming", title: "Arcade District", tag: "GAMING", icon: "🎮", image: "/images/brand/gaming-hero.png.jpeg" },
  { key: "upload", title: "Upload Content", tag: "UPLOAD", icon: "⬆️", image: "/images/brand/3d-logo.png.jpeg" },
  { key: "sports", title: "Sports Arena", tag: "SPORTS", icon: "🏆", image: "/images/brand/sports-logo.png.jpeg" },
  { key: "gallery", title: "Visual Drops", tag: "GALLERY", icon: "🖼️", image: "/images/brand/father-son-elite.png.jpeg" },
  { key: "store", title: "Creator Market", tag: "STORE", icon: "🛒", image: "/images/brand/gta-style-elite.png.jpeg" },
  { key: "meta", title: "Meta World", tag: "META", icon: "🌎", image: "/images/brand/meta-verse-elite.png.jpeg" }
];

let scene;
let camera;
let renderer;
let textureLoader;
let raycaster;
let pointer;
let animationFrame = null;

const engines = [];

const activityState = {
  liveActive: false,
  liveCount: 0,
  onlineCount: 0,
  orbitBoost: 1,
  portalBoost: 1,
  theme: "green"
};

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
    modules,
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

  document.body.classList.add("rb-universe-ready");
}

function bindEvents() {
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerUp, { passive: true });

  window.addEventListener("resize", resizeUniverse, { passive: true });
  window.addEventListener("orientationchange", resizeUniverse, { passive: true });
  window.addEventListener("beforeunload", destroyUniverse);

  window.addEventListener("rb:activity-update", onActivityUpdate);
  window.addEventListener("rb:presence-update", onPresenceUpdate);

  window.RB_SWAP_AVATAR = () => {
    engines.forEach((engine) => safeCall(engine, "swapAvatar"));
  };

  window.RB_PORTAL_THEME = (theme = "green") => {
    activityState.theme = theme;
    engines.forEach((engine) => safeCall(engine, "setTheme", theme));
  };
}

function onActivityUpdate(event) {
  const live = event.detail?.live;
  if (!live) return;

  activityState.liveActive = Boolean(live.active);
  activityState.liveCount = live.count || 0;
  activityState.orbitBoost = live.active ? 1.28 : 1;
  activityState.portalBoost = live.active ? 1.22 : 1;

  document.body.classList.toggle("rb-orbit-live-energy", activityState.liveActive);

  engines.forEach((engine) => safeCall(engine, "onActivityUpdate", activityState));
}

function onPresenceUpdate(event) {
  activityState.onlineCount = event.detail?.onlineCount || 0;

  document.body.classList.toggle(
    "rb-orbit-presence-energy",
    activityState.onlineCount > 0
  );

  engines.forEach((engine) => safeCall(engine, "onPresenceUpdate", activityState));
}

function onPointerDown(event) {
  engines.forEach((engine) => safeCall(engine, "onPointerDown", event));
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  engines.forEach((engine) => safeCall(engine, "onPointerMove", event));
}

function onPointerUp(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  engines.forEach((engine) => safeCall(engine, "onPointerUp", event));
}

function resizeUniverse() {
  if (!camera || !renderer) return;

  const mobile = window.innerWidth <= motion.mobileBreakpoint;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = mobile ? 49 : 44;
  camera.position.set(0, mobile ? 4.2 : 4.4, mobile ? 56 : 55);
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);

  engines.forEach((engine) => safeCall(engine, "resize"));
}

function animateUniverse() {
  animationFrame = requestAnimationFrame(animateUniverse);

  const now = performance.now();
  const t = now * 0.001;

  engines.forEach((engine) => safeCall(engine, "update", t, now));

  renderer.render(scene, camera);
}

function destroyUniverse() {
  if (animationFrame) cancelAnimationFrame(animationFrame);

  engines.forEach((engine) => safeCall(engine, "destroy"));
  engines.length = 0;
  animationFrame = null;
}

initUniverse();
