import RB_CONFIG from "/core/shared/rb-config.js";

/* =========================
   RICH BIZNESS MOBILE
   /core/engine/universe-preview.js

   LEVEL 100000X PORTAL HUB ENGINE
   Living Portal + Galaxy Flow + Orbit Cards + Avatar Spirits
========================= */

const container = document.getElementById("canvas-container");
const labelEl = document.getElementById("module-label");

const fallbackMotion = {
  mobileBreakpoint: 720,
  orbit: {
    speed: 0.0024,
    desktopRadiusX: 292,
    desktopRadiusY: 136,
    mobileRadiusX: 212,
    mobileRadiusY: 102
  },
  portal: {
    scalePulse: 0.065
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

const avatarSpirits = [
  { name: "Boy Avatar", image: "/images/brand/meta-avatar.png.jpeg", angle: 0 },
  { name: "Girl Avatar", image: "/images/brand/father-son-elite.png.jpeg", angle: Math.PI }
];

let scene;
let camera;
let renderer;
let portal;
let portalCore;
let portalInner;
let portalMist;
let portalMouth;
let portalRings = [];
let portalStreams = [];
let galaxyCloud;
let galaxyGold;
let starField;
let deepStarField;
let floatingParticles;
let energyComets;
let orbitGroup;
let avatarGroup;
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

const cards = [];
const avatars = [];
const textureLoader = window.THREE ? new THREE.TextureLoader() : null;

const activityState = {
  liveActive: false,
  liveCount: 0,
  onlineCount: 0,
  orbitBoost: 1,
  portalBoost: 1
};

function initUniverse() {
  if (!container || !window.THREE || !textureLoader) return;
  if (container.dataset.rbUniverseMounted === "true") return;

  container.dataset.rbUniverseMounted = "true";

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    44,
    window.innerWidth / window.innerHeight,
    0.1,
    1600
  );

  camera.position.set(0, 4.4, 55);

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
  buildEnergyComets();
  buildPortal();
  buildCards();
  buildAvatarSpirits();

  bindPointer();
  bindActivityReactions();
  resizeUniverse();
  animateUniverse();

  document.body.classList.add("rb-universe-ready");
}

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);

  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(250,204,21,.88)");
  gradient.addColorStop(0.42, "rgba(0,255,157,.62)");
  gradient.addColorStop(0.72, "rgba(16,185,129,.18)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function buildLights() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.72));

  const sun = new THREE.PointLight(0xfacc15, 4.8, 190);
  sun.position.set(18, 18, 36);
  scene.add(sun);

  const emerald = new THREE.PointLight(0x00ff9d, 4.2, 190);
  emerald.position.set(-22, -6, 24);
  scene.add(emerald);

  const portalLight = new THREE.PointLight(0x00ffcc, 5.5, 110);
  portalLight.position.set(0, -1, 8);
  scene.add(portalLight);
}

function buildStars() {
  const isMobile = window.innerWidth <= motion.mobileBreakpoint;
  const count = isMobile ? 3200 : 5200;

  const geo = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  for (let i = 0; i < count; i += 1) {
    positions.push(
      THREE.MathUtils.randFloatSpread(220),
      THREE.MathUtils.randFloatSpread(160),
      THREE.MathUtils.randFloatSpread(190) - 28
    );

    if (Math.random() > 0.78) {
      colors.push(1, 0.78, 0.18);
    } else {
      colors.push(0.08, 0.95, 0.62);
    }
  }

  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  starField = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: isMobile ? 0.055 : 0.065,
      transparent: true,
      opacity: 0.58,
      vertexColors: true,
      depthWrite: false
    })
  );

  starField.position.z = -30;
  scene.add(starField);

  const deepGeo = geo.clone();
  deepStarField = new THREE.Points(
    deepGeo,
    new THREE.PointsMaterial({
      color: 0x0cffb0,
      size: isMobile ? 0.022 : 0.026,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    })
  );

  deepStarField.position.z = -90;
  deepStarField.scale.setScalar(1.45);
  scene.add(deepStarField);
}

function buildGalaxy() {
  const isMobile = window.innerWidth <= motion.mobileBreakpoint;
  const count = isMobile ? 5200 : 8200;

  const geo = new THREE.BufferGeometry();
  const goldGeo = new THREE.BufferGeometry();
  const green = [];
  const gold = [];

  for (let i = 0; i < count; i += 1) {
    const radius = Math.random() * 78;
    const arm = i % 5;
    const angle = radius * 0.22 + arm * ((Math.PI * 2) / 5) + Math.random() * 0.55;

    const x = Math.cos(angle) * radius;
    const y = THREE.MathUtils.randFloatSpread(30) * (1 - radius / 120);
    const z = Math.sin(angle) * radius - 22;

    if (Math.random() > 0.72) {
      gold.push(x, y, z);
    } else {
      green.push(x, y, z);
    }
  }

  geo.setAttribute("position", new THREE.Float32BufferAttribute(green, 3));
  goldGeo.setAttribute("position", new THREE.Float32BufferAttribute(gold, 3));

  galaxyCloud = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0x00ff9d,
      size: isMobile ? 0.07 : 0.086,
      transparent: true,
      opacity: 0.58,
      depthWrite: false
    })
  );

  galaxyGold = new THREE.Points(
    goldGeo,
    new THREE.PointsMaterial({
      color: 0xfacc15,
      size: isMobile ? 0.052 : 0.064,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    })
  );

  galaxyCloud.position.set(0, 0, -12);
  galaxyGold.position.set(0, 0, -11);

  scene.add(galaxyCloud);
  scene.add(galaxyGold);
}

function buildFloatingParticles() {
  const isMobile = window.innerWidth <= motion.mobileBreakpoint;
  const count = isMobile ? 1400 : 2400;

  const geo = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = THREE.MathUtils.randFloat(3, 46);

    positions.push(
      Math.cos(angle) * radius,
      THREE.MathUtils.randFloatSpread(52),
      Math.sin(angle) * radius - 3
    );

    if (Math.random() > 0.66) {
      colors.push(1.0, 0.76, 0.16);
    } else {
      colors.push(0.0, 1.0, 0.62);
    }
  }

  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  floatingParticles = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: isMobile ? 0.09 : 0.11,
      transparent: true,
      opacity: 0.58,
      vertexColors: true,
      depthWrite: false
    })
  );

  floatingParticles.position.z = -4;
  scene.add(floatingParticles);
}

function buildEnergyComets() {
  energyComets = new THREE.Group();

  const texture = makeGlowTexture();

  for (let i = 0; i < 32; i += 1) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    sprite.userData.speed = THREE.MathUtils.randFloat(0.004, 0.012);
    sprite.userData.radius = THREE.MathUtils.randFloat(9, 34);
    sprite.userData.angle = Math.random() * Math.PI * 2;
    sprite.userData.y = THREE.MathUtils.randFloat(-9, 9);
    sprite.scale.setScalar(THREE.MathUtils.randFloat(0.55, 1.65));

    energyComets.add(sprite);
  }

  scene.add(energyComets);
}

function buildPortal() {
  portal = new THREE.Group();

  const glowTexture = makeGlowTexture();

  portalMist = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  portalMist.scale.set(26, 26, 1);
  portal.add(portalMist);

  portalMouth = new THREE.Mesh(
    new THREE.TorusGeometry(6.45, 0.42, 24, 160),
    new THREE.MeshBasicMaterial({
      color: 0x00ff9d,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  portalMouth.rotation.x = Math.PI / 2.7;
  portalMouth.rotation.z = 0.15;
  portal.add(portalMouth);

  const mouthGold = new THREE.Mesh(
    new THREE.TorusGeometry(7.35, 0.12, 18, 160),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  mouthGold.rotation.x = Math.PI / 2.45;
  mouthGold.rotation.z = -0.28;
  portalRings.push(mouthGold);
  portal.add(mouthGold);

  const streamGeo = new THREE.BufferGeometry();
  const streamPositions = [];
  const streamColors = [];

  for (let i = 0; i < 900; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = THREE.MathUtils.randFloat(0.8, 8.4);
    const pull = Math.random();

    streamPositions.push(
      Math.cos(a) * r * pull,
      THREE.MathUtils.randFloatSpread(6.8),
      Math.sin(a) * r - THREE.MathUtils.randFloat(0, 9)
    );

    if (Math.random() > 0.72) {
      streamColors.push(1, 0.78, 0.12);
    } else {
      streamColors.push(0, 1, 0.62);
    }
  }

  streamGeo.setAttribute("position", new THREE.Float32BufferAttribute(streamPositions, 3));
  streamGeo.setAttribute("color", new THREE.Float32BufferAttribute(streamColors, 3));

  const streams = new THREE.Points(
    streamGeo,
    new THREE.PointsMaterial({
      size: 0.11,
      transparent: true,
      opacity: 0.72,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );

  portalStreams.push(streams);
  portal.add(streams);

  portalCore = new THREE.Mesh(
    new THREE.SphereGeometry(5.85, 96, 96),
    new THREE.MeshPhongMaterial({
      color: 0x00ff9d,
      emissive: 0x08795a,
      shininess: 92,
      transparent: true,
      opacity: 0.78
    })
  );
  portal.add(portalCore);

  portalInner = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 96, 96),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  portal.add(portalInner);

  for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(7.8 + i * 1.15, 0.045, 12, 180),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0xfacc15 : 0x00ff9d,
        transparent: true,
        opacity: 0.13 - i * 0.025,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    ring.rotation.x = Math.PI / (2.2 + i * 0.2);
    ring.rotation.y = i * 0.38;
    ring.rotation.z = i * 0.82;

    portalRings.push(ring);
    portal.add(ring);
  }

  portal.position.set(0, -1.12, -1.9);
  portal.renderOrder = 1;

  scene.add(portal);
}

function buildAvatarSpirits() {
  avatarGroup = new THREE.Group();
  avatarGroup.renderOrder = 80;
  scene.add(avatarGroup);

  avatarSpirits.forEach((spirit, index) => {
    const texture = textureLoader.load(spirit.image, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
    });

    const avatar = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.82,
        depthWrite: false
      })
    );

    avatar.scale.set(2.2, 2.2, 1);
    avatar.userData.angle = spirit.angle;
    avatar.userData.radius = 9.5 + index * 1.4;
    avatar.userData.float = Math.random() * Math.PI * 2;
    avatar.userData.name = spirit.name;

    avatars.push(avatar);
    avatarGroup.add(avatar);
  });
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
      shininess: 96,
      transparent: true,
      opacity: 0.94
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
      opacity: 0.98,
      depthWrite: true
    })
  );

  screen.position.z = 0.28;

  const tint = new THREE.Mesh(
    new THREE.PlaneGeometry(4.72, 7.72),
    new THREE.MeshBasicMaterial({
      color: 0x03140b,
      transparent: true,
      opacity: 0.08,
      depthWrite: false
    })
  );

  tint.position.z = 0.3;

  const shine = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 7.8),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.07,
      depthWrite: false
    })
  );

  shine.position.set(1.25, 0, 0.32);
  shine.rotation.z = -0.17;

  const border = new THREE.Mesh(
    new THREE.BoxGeometry(5.38, 8.58, 0.08),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.22,
      wireframe: true,
      depthWrite: false
    })
  );

  border.position.z = 0.34;

  const hotAura = new THREE.Mesh(
    new THREE.PlaneGeometry(6.15, 9.45),
    new THREE.MeshBasicMaterial({
      color: 0x00ff9d,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
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

  ctx.shadowColor = "rgba(16,185,129,.95)";
  ctx.shadowBlur = 28;

  ctx.fillStyle = "rgba(5,8,5,.58)";
  roundRect(ctx, 64, 28, 896, 190, 46);
  ctx.fill();

  ctx.strokeStyle = "rgba(251,191,36,.42)";
  ctx.lineWidth = 4;
  roundRect(ctx, 64, 28, 896, 190, 46);
  ctx.stroke();

  ctx.shadowBlur = 18;
  ctx.fillStyle = "#34d399";
  ctx.font = "900 52px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tag, 512, 82);

  ctx.shadowColor = "rgba(251,191,36,.75)";
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
    activityState.orbitBoost = live.active ? 1.28 : 1;
    activityState.portalBoost = live.active ? 1.22 : 1;

    cards.forEach((card) => {
      if (card.userData.module?.key === "live") {
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

  const radiusX = isMobile ? motion.orbit.mobileRadiusX / 10 : motion.orbit.desktopRadiusX / 10;
  const radiusZ = isMobile ? motion.orbit.mobileRadiusY / 10 : motion.orbit.desktopRadiusY / 10;
  const baseY = isMobile ? -1.02 : -0.52;

  orbitOffset += (targetOffset - orbitOffset) * 0.06;

  cards.forEach((card, index) => {
    const angle = orbitOffset + (index / cards.length) * Math.PI * 2;
    const x = Math.cos(angle) * radiusX;
    const z = Math.sin(angle) * radiusZ;
    const depth = (z + radiusZ) / (radiusZ * 2);

    const centerPull = Math.max(0, 1 - Math.abs(x) / radiusX);
    const scale = 0.4 + depth * 0.46 + centerPull * 0.08;
    const opacity = 0.52 + depth * 0.48;

    const hotBoost = card.userData.isHot ? 1.12 : 1;
    const presenceBoost = card.userData.presenceBoost ? 1.04 : 1;
    const hoverBoost = card === hoveredCard ? 1.11 : 1;

    card.position.set(x, baseY + depth * 1.12, z + 1.35);
    card.rotation.y = -angle + Math.PI / 2;
    card.rotation.z = Math.sin(angle) * 0.035;
    card.scale.setScalar(scale * hotBoost * presenceBoost * hoverBoost);

    card.children.forEach((child, childIndex) => {
      if (!child.material) return;

      if (childIndex === 0) child.material.opacity = 0.78 + opacity * 0.16;
      if (childIndex === 1) child.material.opacity = opacity;
      if (childIndex === 2) child.material.opacity = 0.08 + depth * 0.06;
      if (childIndex === 3) child.material.opacity = 0.04 + depth * 0.065;
      if (childIndex === 4) child.material.opacity = 0.12 + depth * 0.13;

      if (childIndex === 5) {
        child.material.opacity = card.userData.isHot
          ? 0.09 + Math.sin(performance.now() * 0.005) * 0.04
          : centerPull * 0.025;
      }

      if (child.userData?.isLabel) {
        child.material.opacity = 0.12 + depth * 0.86;
        child.scale.set(5.2 + depth * 1.35, 1.25 + depth * 0.38, 1);
      }
    });

    card.renderOrder = 20 + Math.round(depth * 120);
  });
}

function updatePortal(t) {
  if (!portal) return;

  const boost = activityState.portalBoost;
  const pulse = 1 + Math.sin(t * 2.1) * motion.portal.scalePulse * boost;

  portal.rotation.y += 0.0032 * boost;
  portal.rotation.x = Math.sin(t * 0.42) * 0.045;
  portal.scale.setScalar(pulse);

  if (portalCore) {
    portalCore.rotation.y -= 0.0054 * boost;
    portalCore.rotation.z += 0.0028 * boost;
    portalCore.material.opacity = 0.74 + Math.sin(t * 2.8) * 0.055;
    portalCore.material.emissiveIntensity = 1 + Math.sin(t * 3.1) * 0.2;
  }

  if (portalInner) {
    portalInner.scale.setScalar(1 + Math.sin(t * 4.4) * 0.18);
    portalInner.material.opacity = 0.12 + Math.sin(t * 3.6) * 0.06;
  }

  if (portalMist) {
    portalMist.rotation.z += 0.0024 * boost;
    portalMist.scale.set(
      26 + Math.sin(t * 1.7) * 2.2,
      26 + Math.cos(t * 1.4) * 2.2,
      1
    );
    portalMist.material.opacity = 0.55 + Math.sin(t * 1.9) * 0.12;
  }

  if (portalMouth) {
    portalMouth.rotation.z += 0.008 * boost;
    portalMouth.scale.setScalar(1 + Math.sin(t * 3.3) * 0.045);
  }

  portalRings.forEach((ring, index) => {
    ring.rotation.z += (0.004 + index * 0.0016) * (index % 2 ? -1 : 1) * boost;
    ring.rotation.y += 0.0014 * (index + 1) * boost;
    ring.material.opacity = Math.max(0.045, 0.24 - index * 0.035 + Math.sin(t * (1.7 + index)) * 0.035);
  });

  portalStreams.forEach((stream) => {
    stream.rotation.z -= 0.006 * boost;
    stream.rotation.y += 0.002 * boost;
    stream.material.opacity = 0.6 + Math.sin(t * 2.6) * 0.14;
  });
}

function updateComets(t) {
  if (!energyComets) return;

  energyComets.children.forEach((sprite, index) => {
    sprite.userData.angle += sprite.userData.speed * activityState.portalBoost;

    const r = sprite.userData.radius + Math.sin(t + index) * 1.2;
    const a = sprite.userData.angle;

    sprite.position.set(
      Math.cos(a) * r,
      sprite.userData.y + Math.sin(t * 1.4 + index) * 1.4,
      Math.sin(a) * r - 8
    );

    sprite.material.opacity = 0.16 + Math.sin(t * 2 + index) * 0.08 + activityState.liveCount * 0.002;
  });
}

function updateAvatarSpirits(t) {
  if (!avatarGroup) return;

  avatars.forEach((avatar, index) => {
    const a = avatar.userData.angle + t * (0.32 + index * 0.04);
    const r = avatar.userData.radius;

    avatar.position.set(
      Math.cos(a) * r,
      -0.35 + Math.sin(t * 1.6 + avatar.userData.float) * 1.1,
      Math.sin(a) * 3.2 + 5.2
    );

    const s = 1.65 + Math.sin(t * 2 + index) * 0.15;
    avatar.scale.set(s, s, 1);
    avatar.material.opacity = 0.38 + Math.sin(t * 1.7 + index) * 0.16;
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

  const isMobile = window.innerWidth <= motion.mobileBreakpoint;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = isMobile ? 49 : 44;
  camera.position.set(0, isMobile ? 4.2 : 4.4, isMobile ? 56 : 55);
  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animateUniverse() {
  animationFrame = requestAnimationFrame(animateUniverse);

  const time = performance.now();
  const t = time * 0.001;

  targetOffset += (motion.orbit.speed || 0.0024) * activityState.orbitBoost;

  updatePortal(t);
  updateComets(t);
  updateAvatarSpirits(t);

  if (galaxyCloud) {
    galaxyCloud.rotation.y += 0.0011 * activityState.orbitBoost;
    galaxyCloud.rotation.z = Math.sin(t * 0.12) * 0.04;
    galaxyCloud.material.opacity = activityState.liveActive ? 0.68 : 0.58;
  }

  if (galaxyGold) {
    galaxyGold.rotation.y -= 0.0008 * activityState.orbitBoost;
    galaxyGold.material.opacity = activityState.onlineCount > 0 ? 0.52 : 0.42;
  }

  if (starField) {
    starField.rotation.y += 0.00035 * activityState.orbitBoost;
    starField.material.opacity = activityState.onlineCount > 0 ? 0.68 : 0.58;
  }

  if (deepStarField) {
    deepStarField.rotation.y -= 0.00016;
  }

  if (floatingParticles) {
    floatingParticles.rotation.y -= 0.00072;
    floatingParticles.rotation.z = Math.sin(t * 0.16) * 0.045;
  }

  updateCards();

  renderer.render(scene, camera);
}

initUniverse();
