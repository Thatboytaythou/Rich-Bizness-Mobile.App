import RB_CONFIG from "/core/shared/rb-config.js";

/* =========================
   RICH BIZNESS MOBILE
   /core/engine/universe-preview.js

   LOCKED PORTAL HUB ENGINE
   Three.js Galaxy + Orbit Cards
========================= */

const container = document.getElementById("canvas-container");
const labelEl = document.getElementById("module-label");

const fallbackMotion = {
  mobileBreakpoint: 720,
  orbit: {
    speed: 0.0022,
    desktopRadiusX: 270,
    desktopRadiusY: 120,
    mobileRadiusX: 190,
    mobileRadiusY: 90
  },
  portal: {
    scalePulse: 0.045
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
  { key: "upload", title: "Upload Content", tag: "UPLOAD", image: "/images/brand/project-avatar.png.jpeg" },
  { key: "sports", title: "Sports Arena", tag: "SPORTS", image: "/images/brand/sports-logo.png.jpeg" },
  { key: "gallery", title: "Visual Drops", tag: "GALLERY", image: "/images/brand/father-son-elite.png.jpeg" },
  { key: "store", title: "Creator Market", tag: "STORE", image: "/images/brand/gta-style-elite.png.jpeg" },
  { key: "meta", title: "Meta World", tag: "META", image: "/images/brand/meta-verse-elite.png.jpeg" }
];

let scene;
let camera;
let renderer;
let portal;
let orbitGroup;
let galaxyCloud;
let starField;
let floatingParticles;
let raycaster;
let pointer;
let hoveredCard = null;
let animationFrame = null;

let orbitOffset = 0;
let targetOffset = 0;
let isDragging = false;
let startX = 0;
let lastX = 0;
let dragMoved = false;

const activityState = {
  liveActive: false,
  liveCount: 0,
  onlineCount: 0,
  orbitBoost: 1,
  portalBoost: 1
};

const cards = [];
const textureLoader = window.THREE ? new THREE.TextureLoader() : null;

function initUniverse() {
  if (!container || !window.THREE || !textureLoader) return;

  if (container.dataset.rbUniverseMounted === "true") return;
  container.dataset.rbUniverseMounted = "true";

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1200
  );

  camera.position.set(0, 4, 52);

  renderer = new THREE.WebGLRenderer({
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

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  buildLights();
  buildStars();
  buildGalaxy();
  buildFloatingParticles();
  buildPortal();
  buildCards();

  bindPointer();
  bindActivityReactions();
  resizeUniverse();
  animateUniverse();

  document.body.classList.add("rb-universe-ready");
}

function buildLights() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const goldLight = new THREE.PointLight(0xfbbf24, 3.1, 150);
  goldLight.position.set(18, 18, 32);
  scene.add(goldLight);

  const greenLight = new THREE.PointLight(0x10b981, 2.9, 150);
  greenLight.position.set(-20, -4, 22);
  scene.add(greenLight);
}

function buildStars() {
  const isMobile = window.innerWidth <= motion.mobileBreakpoint;
  const count = isMobile ? 1500 : 2600;

  const geo = new THREE.BufferGeometry();
  const positions = [];

  for (let i = 0; i < count; i += 1) {
    positions.push(
      THREE.MathUtils.randFloatSpread(180),
      THREE.MathUtils.randFloatSpread(130),
      THREE.MathUtils.randFloatSpread(150)
    );
  }

  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  starField = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: isMobile ? 0.04 : 0.045,
      transparent: true,
      opacity: 0.36,
      depthWrite: false
    })
  );

  starField.position.z = -18;
  scene.add(starField);
}

function buildGalaxy() {
  const isMobile = window.innerWidth <= motion.mobileBreakpoint;
  const count = isMobile ? 2200 : 3600;

  const galaxyGeo = new THREE.BufferGeometry();
  const galaxy = [];

  for (let i = 0; i < count; i += 1) {
    const radius = Math.random() * 56;
    const angle = radius * 0.34 + Math.random() * Math.PI * 2;

    galaxy.push(
      Math.cos(angle) * radius,
      THREE.MathUtils.randFloatSpread(22),
      Math.sin(angle) * radius - 14
    );
  }

  galaxyGeo.setAttribute("position", new THREE.Float32BufferAttribute(galaxy, 3));

  galaxyCloud = new THREE.Points(
    galaxyGeo,
    new THREE.PointsMaterial({
      color: 0x10b981,
      size: isMobile ? 0.058 : 0.065,
      transparent: true,
      opacity: 0.4,
      depthWrite: false
    })
  );

  scene.add(galaxyCloud);
}

function buildFloatingParticles() {
  const isMobile = window.innerWidth <= motion.mobileBreakpoint;
  const count = isMobile ? 520 : 900;

  const geo = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  for (let i = 0; i < count; i += 1) {
    positions.push(
      THREE.MathUtils.randFloatSpread(90),
      THREE.MathUtils.randFloatSpread(70),
      THREE.MathUtils.randFloatSpread(80) - 10
    );

    if (Math.random() > 0.72) {
      colors.push(1.0, 0.74, 0.18);
    } else {
      colors.push(0.06, 0.72, 0.5);
    }
  }

  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  floatingParticles = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: isMobile ? 0.075 : 0.09,
      transparent: true,
      opacity: 0.44,
      vertexColors: true,
      depthWrite: false
    })
  );

  floatingParticles.position.z = -6;
  scene.add(floatingParticles);
}

function buildPortal() {
  portal = new THREE.Group();

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(7.65, 72, 72),
    new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.026,
      depthWrite: false
    })
  );

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(5.9, 72, 72),
    new THREE.MeshPhongMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      shininess: 52,
      transparent: true,
      opacity: 0.82
    })
  );

  portal.add(glow);
  portal.add(core);
  portal.position.set(0, -1.15, -1.6);
  portal.renderOrder = 1;

  scene.add(portal);
}

function buildCards() {
  orbitGroup = new THREE.Group();
  orbitGroup.renderOrder = 10;
  scene.add(orbitGroup);

  modules.forEach((mod, index) => {
    const card = createPhoneCard(mod);
    card.userData.module = mod;
    card.userData.index = index;
    card.userData.isHot = false;
    card.userData.activityCount = 0;
    card.userData.presenceBoost = 0;

    cards.push(card);
    orbitGroup.add(card);
  });
}

function createPhoneCard(mod) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 8.4, 0.5),
    new THREE.MeshPhongMaterial({
      color: 0x050805,
      specular: 0xfbbf24,
      shininess: 78,
      transparent: true,
      opacity: 0.92
    })
  );

  const screenTexture = textureLoader.load(
    mod.image,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
    },
    undefined,
    () => console.warn("[RB UNIVERSE IMAGE MISSING]", mod.image)
  );

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.72, 7.72),
    new THREE.MeshBasicMaterial({
      map: screenTexture,
      transparent: true,
      opacity: 0.96,
      depthWrite: true
    })
  );

  screen.position.z = 0.28;

  const tint = new THREE.Mesh(
    new THREE.PlaneGeometry(4.72, 7.72),
    new THREE.MeshBasicMaterial({
      color: 0x03140b,
      transparent: true,
      opacity: 0.1,
      depthWrite: false
    })
  );

  tint.position.z = 0.3;

  const shine = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 7.4),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.055,
      depthWrite: false
    })
  );

  shine.position.set(1.25, 0, 0.32);
  shine.rotation.z = -0.16;

  const border = new THREE.Mesh(
    new THREE.BoxGeometry(5.38, 8.58, 0.08),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.18,
      wireframe: true,
      depthWrite: false
    })
  );

  border.position.z = 0.34;

  const hotAura = new THREE.Mesh(
    new THREE.PlaneGeometry(5.95, 9.15),
    new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  );

  hotAura.position.z = 0.18;

  const textLabel = createTextLabel(mod.tag, mod.title);
  textLabel.position.set(0, -5.05, 0.42);

  group.add(body);
  group.add(screen);
  group.add(tint);
  group.add(shine);
  group.add(border);
  group.add(hotAura);
  group.add(textLabel);

  group.scale.setScalar(0.72);
  group.renderOrder = 20;

  return group;
}

function createTextLabel(tag, title) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.shadowColor = "rgba(16, 185, 129, 0.95)";
  ctx.shadowBlur = 28;

  ctx.fillStyle = "rgba(5, 8, 5, 0.58)";
  roundRect(ctx, 64, 28, 896, 190, 46);
  ctx.fill();

  ctx.strokeStyle = "rgba(251, 191, 36, 0.42)";
  ctx.lineWidth = 4;
  roundRect(ctx, 64, 28, 896, 190, 46);
  ctx.stroke();

  ctx.shadowBlur = 18;
  ctx.fillStyle = "#34d399";
  ctx.font = "900 52px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tag, 512, 82);

  ctx.shadowColor = "rgba(251, 191, 36, 0.75)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#fff7ed";
  ctx.font = "900 64px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(title, 512, 152);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    })
  );

  sprite.scale.set(6.2, 1.55, 1);
  sprite.renderOrder = 60;
  sprite.userData.isLabel = true;

  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bindActivityReactions() {
  window.addEventListener("rb:activity-update", (event) => {
    const live = event.detail?.live;
    if (!live) return;

    activityState.liveActive = Boolean(live.active);
    activityState.liveCount = live.count || 0;
    activityState.orbitBoost = live.active ? 1.18 : 1;
    activityState.portalBoost = live.active ? 1.12 : 1;

    cards.forEach((card) => {
      const mod = card.userData.module;

      if (mod?.key === "live") {
        card.userData.isHot = live.active;
        card.userData.activityCount = live.count || 0;
      }
    });

    document.body.classList.toggle("rb-orbit-live-energy", live.active);
  });

  window.addEventListener("rb:presence-update", (event) => {
    const onlineCount = event.detail?.onlineCount || 0;

    activityState.onlineCount = onlineCount;

    cards.forEach((card) => {
      card.userData.presenceBoost = onlineCount > 0 ? 1 : 0;
    });

    document.body.classList.toggle("rb-orbit-presence-energy", onlineCount > 0);
  });
}

function updateCards() {
  const isMobile = window.innerWidth <= motion.mobileBreakpoint;

  const radiusX = isMobile
    ? motion.orbit.mobileRadiusX / 10
    : motion.orbit.desktopRadiusX / 10;

  const radiusZ = isMobile
    ? motion.orbit.mobileRadiusY / 10
    : motion.orbit.desktopRadiusY / 10;

  const baseY = isMobile ? -1.05 : -0.55;

  orbitOffset += (targetOffset - orbitOffset) * 0.055;

  cards.forEach((card, index) => {
    const angle = orbitOffset + (index / cards.length) * Math.PI * 2;

    const x = Math.cos(angle) * radiusX;
    const z = Math.sin(angle) * radiusZ;

    const depth = (z + radiusZ) / (radiusZ * 2);
    const scale = 0.42 + depth * 0.42;
    const opacity = 0.58 + depth * 0.4;

    const hotBoost = card.userData.isHot ? 1.1 : 1;
    const presenceBoost = card.userData.presenceBoost ? 1.03 : 1;
    const hoverBoost = card === hoveredCard ? 1.1 : 1;

    card.position.set(x, baseY + depth * 1.05, z + 1.2);
    card.rotation.y = -angle + Math.PI / 2;
    card.scale.setScalar(scale * hotBoost * presenceBoost * hoverBoost);

    card.children.forEach((child, childIndex) => {
      if (!child.material) return;

      if (childIndex === 0) child.material.opacity = 0.78 + opacity * 0.14;
      if (childIndex === 1) child.material.opacity = opacity;
      if (childIndex === 2) child.material.opacity = 0.1 + depth * 0.06;
      if (childIndex === 3) child.material.opacity = 0.04 + depth * 0.05;
      if (childIndex === 4) child.material.opacity = 0.1 + depth * 0.12;

      if (childIndex === 5) {
        child.material.opacity = card.userData.isHot
          ? 0.07 + Math.sin(performance.now() * 0.004) * 0.03
          : 0;
      }

      if (child.userData?.isLabel) {
        child.material.opacity = 0.14 + depth * 0.78;
        child.scale.set(5.2 + depth * 1.3, 1.25 + depth * 0.35, 1);
      }

      if (card.userData.isHot && child.material) {
        child.material.opacity = Math.min(1, child.material.opacity + 0.1);
      }
    });

    card.renderOrder = 20 + Math.round(depth * 100);
  });
}

function bindPointer() {
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerUp, { passive: true });
  window.addEventListener("resize", resizeUniverse, { passive: true });
  window.addEventListener("orientationchange", resizeUniverse, { passive: true });

  window.addEventListener("beforeunload", () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
  });
}

function onPointerDown(event) {
  isDragging = true;
  startX = event.clientX;
  lastX = event.clientX;
  dragMoved = false;
}

function onPointerMove(event) {
  updatePointer(event);

  if (!isDragging) {
    checkHover();
    return;
  }

  const delta = event.clientX - lastX;

  if (Math.abs(event.clientX - startX) > 6) {
    dragMoved = true;
  }

  targetOffset += delta * 0.008;
  lastX = event.clientX;
}

function onPointerUp(event) {
  updatePointer(event);
  isDragging = false;

  const hit = getHitCard();

  if (!dragMoved && hit) {
    window.dispatchEvent(
      new CustomEvent("rb:module-select", {
        detail: hit.userData.module
      })
    );
  }
}

function updatePointer(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function getHitCard() {
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(cards, true);
  if (!hits.length) return null;

  let obj = hits[0].object;

  while (obj && !obj.userData.module) {
    obj = obj.parent;
  }

  return obj || null;
}

function checkHover() {
  const hit = getHitCard();
  hoveredCard = hit;

  if (!labelEl) return;

  if (hit?.userData?.module) {
    labelEl.textContent = hit.userData.module.title;
    labelEl.classList.add("is-visible");
  } else {
    labelEl.classList.remove("is-visible");
  }
}

function resizeUniverse() {
  if (!camera || !renderer) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animateUniverse() {
  animationFrame = requestAnimationFrame(animateUniverse);

  const time = performance.now();
  const t = time * 0.001;

  const baseSpeed = motion.orbit.speed || 0.0022;
  targetOffset += baseSpeed * activityState.orbitBoost;

  if (portal) {
    portal.rotation.y += 0.002 * activityState.portalBoost;
    portal.rotation.x = Math.sin(t * 0.45) * 0.06;

    portal.scale.setScalar(
      1 +
        Math.sin(t * 1.8) *
          motion.portal.scalePulse *
          activityState.portalBoost
    );
  }

  if (galaxyCloud) {
    galaxyCloud.rotation.y += 0.0007 * activityState.orbitBoost;

    if (galaxyCloud.material) {
      galaxyCloud.material.opacity = activityState.liveActive ? 0.5 : 0.4;
    }
  }

  if (starField) {
    starField.rotation.y += 0.00025 * activityState.orbitBoost;

    if (starField.material) {
      starField.material.opacity = activityState.onlineCount > 0 ? 0.46 : 0.36;
    }
  }

  if (floatingParticles) {
    floatingParticles.rotation.y -= 0.00038;
  }

  updateCards();

  renderer.render(scene, camera);
}

initUniverse();
