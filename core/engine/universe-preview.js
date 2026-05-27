import RB_CONFIG from "/core/shared/rb-config.js";

/* =========================
   RICH BIZNESS MOBILE
   /core/engine/universe-preview.js

   UNIVERSE ENGINE PRO MAX
   Portal + Galaxy + Cards + Real 3D Avatar
========================= */

const container = document.getElementById("canvas-container");
const labelEl = document.getElementById("module-label");

const fallbackMotion = {
  mobileBreakpoint: 720,
  orbit: {
    speed: 0.00255,
    desktopRadiusX: 306,
    desktopRadiusY: 144,
    mobileRadiusX: 224,
    mobileRadiusY: 108
  },
  portal: {
    scalePulse: 0.082
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
let clock;

let portal;
let portalCore;
let portalInner;
let portalMist;
let portalLens;
let portalRings = [];
let portalStreams = [];
let portalBeams = [];
let portalTouchBursts = [];
let portalColorMode = 0;

let galaxyCloud;
let galaxyGold;
let starField;
let deepStarField;
let floatingParticles;
let energyComets;
let cloudField;

let orbitGroup;
let avatarGroup;
let rbAvatar;
let rbAvatarParts = {};

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

let avatarMode = "idle";
let avatarTargetX = 5.5;
let avatarTargetZ = 8.3;
let avatarWalkTime = 0;

const cards = [];
const avatarParticles = [];
const textureLoader = window.THREE ? new THREE.TextureLoader() : null;

const activityState = {
  liveActive: false,
  liveCount: 0,
  onlineCount: 0,
  orbitBoost: 1,
  portalBoost: 1,
  touchEnergy: 0
};

const portalPalettes = [
  {
    name: "emerald",
    core: 0x00ff9d,
    deep: 0x08795a,
    gold: 0xfacc15,
    accent: 0x0cffb0
  },
  {
    name: "blue",
    core: 0x38bdf8,
    deep: 0x075985,
    gold: 0x93c5fd,
    accent: 0x67e8f9
  },
  {
    name: "purple",
    core: 0xa855f7,
    deep: 0x581c87,
    gold: 0xfacc15,
    accent: 0xc084fc
  }
];

function initUniverse() {
  if (!container || !window.THREE || !textureLoader) return;
  if (container.dataset.rbUniverseMounted === "true") return;

  container.dataset.rbUniverseMounted = "true";

  clock = new THREE.Clock();
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020503, 0.011);

  camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 1800);
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
  buildCloudField();
  buildFloatingParticles();
  buildEnergyComets();
  buildPortal();
  buildCards();
  buildRealAvatar();

  bindPointer();
  bindActivityReactions();
  resizeUniverse();
  animateUniverse();

  document.body.classList.add("rb-universe-ready");
}

function currentPalette() {
  return portalPalettes[portalColorMode % portalPalettes.length];
}

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);

  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.14, "rgba(250,204,21,.92)");
  gradient.addColorStop(0.42, "rgba(0,255,157,.68)");
  gradient.addColorStop(0.74, "rgba(16,185,129,.2)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function makeCloudTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 512);

  for (let i = 0; i < 56; i += 1) {
    const x = 256 + (Math.random() - 0.5) * 190;
    const y = 256 + (Math.random() - 0.5) * 130;
    const r = 34 + Math.random() * 96;

    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(190,255,230,.24)");
    g.addColorStop(0.42, "rgba(0,255,157,.09)");
    g.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function buildLights() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.76));

  const goldLight = new THREE.PointLight(0xfacc15, 5.4, 220);
  goldLight.position.set(20, 22, 40);
  scene.add(goldLight);

  const greenLight = new THREE.PointLight(0x00ff9d, 5.1, 220);
  greenLight.position.set(-24, -6, 28);
  scene.add(greenLight);

  const portalLight = new THREE.PointLight(0x00ffcc, 6.7, 140);
  portalLight.position.set(0, -1, 8);
  portalLight.name = "portalLight";
  scene.add(portalLight);

  const avatarLight = new THREE.PointLight(0xfacc15, 3.8, 110);
  avatarLight.position.set(8, 8, 22);
  scene.add(avatarLight);
}

function buildStars() {
  const isMobile = window.innerWidth <= motion.mobileBreakpoint;
  const count = isMobile ? 4300 : 7200;

  const geo = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  for (let i = 0; i < count; i += 1) {
    positions.push(
      THREE.MathUtils.randFloatSpread(250),
      THREE.MathUtils.randFloatSpread(178),
      THREE.MathUtils.randFloatSpread(220) - 38
    );

    if (Math.random() > 0.78) colors.push(1, 0.78, 0.18);
    else colors.push(0.08, 0.95, 0.62);
  }

  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  starField = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: isMobile ? 0.056 : 0.07,
      transparent: true,
      opacity: 0.66,
      vertexColors: true,
      depthWrite: false
    })
  );

  starField.position.z = -34;
  scene.add(starField);

  deepStarField = new THREE.Points(
    geo.clone(),
    new THREE.PointsMaterial({
      color: 0x0cffb0,
      size: isMobile ? 0.022 : 0.028,
      transparent: true,
      opacity: 0.26,
      depthWrite: false
    })
  );

  deepStarField.position.z = -104;
  deepStarField.scale.setScalar(1.55);
  scene.add(deepStarField);
}

function buildGalaxy() {
  const isMobile = window.innerWidth <= motion.mobileBreakpoint;
  const count = isMobile ? 6400 : 9800;

  const greenGeo = new THREE.BufferGeometry();
  const goldGeo = new THREE.BufferGeometry();

  const green = [];
  const gold = [];

  for (let i = 0; i < count; i += 1) {
    const radius = Math.random() * 92;
    const arm = i % 6;
    const angle = radius * 0.25 + arm * ((Math.PI * 2) / 6) + Math.random() * 0.7;

    const x = Math.cos(angle) * radius;
    const y = THREE.MathUtils.randFloatSpread(34) * (1 - radius / 142);
    const z = Math.sin(angle) * radius - 25;

    if (Math.random() > 0.72) gold.push(x, y, z);
    else green.push(x, y, z);
  }

  greenGeo.setAttribute("position", new THREE.Float32BufferAttribute(green, 3));
  goldGeo.setAttribute("position", new THREE.Float32BufferAttribute(gold, 3));

  galaxyCloud = new THREE.Points(
    greenGeo,
    new THREE.PointsMaterial({
      color: 0x00ff9d,
      size: isMobile ? 0.076 : 0.096,
      transparent: true,
      opacity: 0.64,
      depthWrite: false
    })
  );

  galaxyGold = new THREE.Points(
    goldGeo,
    new THREE.PointsMaterial({
      color: 0xfacc15,
      size: isMobile ? 0.058 : 0.074,
      transparent: true,
      opacity: 0.48,
      depthWrite: false
    })
  );

  galaxyCloud.position.set(0, 0, -12);
  galaxyGold.position.set(0, 0, -11);

  scene.add(galaxyCloud);
  scene.add(galaxyGold);
}

function buildCloudField() {
  cloudField = new THREE.Group();
  const cloudTexture = makeCloudTexture();

  for (let i = 0; i < 24; i += 1) {
    const cloud = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.035 + Math.random() * 0.055,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    cloud.position.set(
      THREE.MathUtils.randFloatSpread(62),
      THREE.MathUtils.randFloat(-12, 18),
      THREE.MathUtils.randFloat(-42, 2)
    );

    const s = THREE.MathUtils.randFloat(12, 30);
    cloud.scale.set(s * 1.9, s, 1);
    cloud.userData.speed = THREE.MathUtils.randFloat(0.0007, 0.0021);
    cloud.userData.float = Math.random() * Math.PI * 2;

    cloudField.add(cloud);
  }

  scene.add(cloudField);
}

function buildFloatingParticles() {
  const isMobile = window.innerWidth <= motion.mobileBreakpoint;
  const count = isMobile ? 1900 : 3200;

  const geo = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = THREE.MathUtils.randFloat(3, 54);

    positions.push(
      Math.cos(angle) * radius,
      THREE.MathUtils.randFloatSpread(62),
      Math.sin(angle) * radius - 3
    );

    if (Math.random() > 0.66) colors.push(1, 0.76, 0.16);
    else colors.push(0, 1, 0.62);
  }

  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  floatingParticles = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: isMobile ? 0.092 : 0.118,
      transparent: true,
      opacity: 0.62,
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

  for (let i = 0; i < 46; i += 1) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    sprite.userData.speed = THREE.MathUtils.randFloat(0.004, 0.014);
    sprite.userData.radius = THREE.MathUtils.randFloat(9, 39);
    sprite.userData.angle = Math.random() * Math.PI * 2;
    sprite.userData.y = THREE.MathUtils.randFloat(-11, 11);
    sprite.scale.setScalar(THREE.MathUtils.randFloat(0.55, 1.9));

    energyComets.add(sprite);
  }

  scene.add(energyComets);
}

function buildPortal() {
  portal = new THREE.Group();
  const glowTexture = makeGlowTexture();
  const p = currentPalette();

  portalMist = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );

  portalMist.scale.set(31, 31, 1);
  portal.add(portalMist);

  portalLens = new THREE.Mesh(
    new THREE.SphereGeometry(6.45, 96, 96),
    new THREE.MeshBasicMaterial({
      color: p.core,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  portal.add(portalLens);

  portalMouth = new THREE.Mesh(
    new THREE.TorusGeometry(7.05, 0.48, 26, 220),
    new THREE.MeshBasicMaterial({
      color: p.core,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );

  portalMouth.rotation.x = Math.PI / 2.65;
  portalMouth.rotation.z = 0.15;
  portal.add(portalMouth);

  for (let i = 0; i < 6; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(7.7 + i * 0.78, 0.04 + i * 0.006, 12, 220),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? p.gold : p.core,
        transparent: true,
        opacity: 0.2 - i * 0.023,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    ring.rotation.x = Math.PI / (2.12 + i * 0.16);
    ring.rotation.y = i * 0.4;
    ring.rotation.z = i * 0.82;

    portalRings.push(ring);
    portal.add(ring);
  }

  const streamGeo = new THREE.BufferGeometry();
  const streamPositions = [];
  const streamColors = [];

  for (let i = 0; i < 1850; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = THREE.MathUtils.randFloat(0.4, 10.4);
    const pull = Math.random();

    streamPositions.push(
      Math.cos(a) * r * pull,
      THREE.MathUtils.randFloatSpread(8.2),
      Math.sin(a) * r - THREE.MathUtils.randFloat(0, 12)
    );

    if (Math.random() > 0.7) streamColors.push(1, 0.78, 0.12);
    else streamColors.push(0, 1, 0.62);
  }

  streamGeo.setAttribute("position", new THREE.Float32BufferAttribute(streamPositions, 3));
  streamGeo.setAttribute("color", new THREE.Float32BufferAttribute(streamColors, 3));

  const streams = new THREE.Points(
    streamGeo,
    new THREE.PointsMaterial({
      size: 0.12,
      transparent: true,
      opacity: 0.78,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );

  portalStreams.push(streams);
  portal.add(streams);

  for (let i = 0; i < 7; i += 1) {
    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(18 + i * 2, 0.13 + i * 0.015),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? p.gold : p.accent,
        transparent: true,
        opacity: 0.13,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    beam.rotation.z = (Math.PI * 2 * i) / 7;
    beam.position.z = -0.25 - i * 0.03;
    portalBeams.push(beam);
    portal.add(beam);
  }

  portalCore = new THREE.Mesh(
    new THREE.SphereGeometry(6.2, 112, 112),
    new THREE.MeshPhongMaterial({
      color: p.core,
      emissive: p.deep,
      emissiveIntensity: 1.24,
      shininess: 128,
      transparent: true,
      opacity: 0.8
    })
  );

  portal.add(portalCore);

  portalInner = new THREE.Mesh(
    new THREE.SphereGeometry(3.45, 112, 112),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );

  portal.add(portalInner);

  portal.position.set(0, -1.08, -1.95);
  portal.renderOrder = 1;
  scene.add(portal);
}

function setPortalPalette(index) {
  portalColorMode = index % portalPalettes.length;
  const p = currentPalette();

  if (portalMouth?.material) portalMouth.material.color.setHex(p.core);
  if (portalCore?.material) {
    portalCore.material.color.setHex(p.core);
    portalCore.material.emissive.setHex(p.deep);
  }
  if (portalLens?.material) portalLens.material.color.setHex(p.core);

  portalRings.forEach((ring, i) => {
    ring.material.color.setHex(i % 2 ? p.gold : p.core);
  });

  portalBeams.forEach((beam, i) => {
    beam.material.color.setHex(i % 2 ? p.gold : p.accent);
  });

  const portalLight = scene.getObjectByName("portalLight");
  if (portalLight) portalLight.color.setHex(p.core);
}

function addPortalTouchBurst(x = 0, y = 0) {
  const p = currentPalette();
  const burst = new THREE.Group();

  for (let i = 0; i < 18; i += 1) {
    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5 + Math.random() * 4.8, 0.055),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? p.gold : p.accent,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    beam.rotation.z = (Math.PI * 2 * i) / 18;
    beam.userData.life = 1;
    beam.userData.speed = 0.035 + Math.random() * 0.04;
    burst.add(beam);
  }

  burst.position.set(x, y, 2.2);
  burst.userData.life = 1;
  portal.add(burst);
  portalTouchBursts.push(burst);
}

function buildRealAvatar() {
  avatarGroup = new THREE.Group();
  avatarGroup.position.set(5.5, -2.55, 8.2);
  avatarGroup.scale.setScalar(0.3);
  avatarGroup.renderOrder = 88;
  scene.add(avatarGroup);

  makeRBAvatar("boy");
}

function makePart(name, geo, mat, pos, scale = null) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = name;
  mesh.position.set(pos.x, pos.y, pos.z);
  if (scale) mesh.scale.set(scale.x, scale.y, scale.z);
  rbAvatar.add(mesh);
  rbAvatarParts[name] = mesh;
  return mesh;
}

function makeRBAvatar(type = "boy") {
  if (rbAvatar) avatarGroup.remove(rbAvatar);

  rbAvatarParts = {};
  rbAvatar = new THREE.Group();
  rbAvatar.userData.type = type;
  avatarGroup.add(rbAvatar);

  const isGirl = type === "girl";

  const skin = new THREE.MeshPhongMaterial({
    color: isGirl ? 0xd99b7b : 0xe8b88a,
    shininess: 34
  });

  const outfit = new THREE.MeshPhongMaterial({
    color: isGirl ? 0x120918 : 0x070a08,
    emissive: isGirl ? 0x26051f : 0x021407,
    emissiveIntensity: 0.4,
    shininess: 42
  });

  const pants = new THREE.MeshPhongMaterial({ color: 0x070d0b, shininess: 20 });
  const shoe = new THREE.MeshPhongMaterial({ color: 0x030303, shininess: 60 });
  const hair = new THREE.MeshPhongMaterial({ color: 0x050302, shininess: 48 });
  const blue = new THREE.MeshPhongMaterial({ color: 0x1e3a8a, shininess: 60 });

  const gold = new THREE.MeshPhongMaterial({
    color: 0xfacc15,
    emissive: 0xc99700,
    emissiveIntensity: 1.18,
    shininess: 135
  });

  const bodyW = isGirl ? 4.1 : 4.85;
  const bodyH = isGirl ? 7.1 : 7.45;
  const bodyD = isGirl ? 2.4 : 3;

  makePart("body", new THREE.BoxGeometry(bodyW, bodyH, bodyD), outfit, { x: 0, y: 0.45, z: 0 });

  makePart(
    "glow",
    new THREE.BoxGeometry(bodyW + 0.34, bodyH + 0.34, bodyD + 0.24),
    new THREE.MeshBasicMaterial({
      color: isGirl ? 0xf472b6 : 0x22c55e,
      transparent: true,
      opacity: 0.08,
      wireframe: true,
      depthWrite: false
    }),
    { x: 0, y: 0.45, z: 0 }
  );

  makePart("neck", new THREE.CylinderGeometry(0.72, 0.84, 0.8, 28), skin, { x: 0, y: 4.25, z: 0 });
  makePart("head", new THREE.SphereGeometry(isGirl ? 1.9 : 2.05, 48, 48), skin, { x: 0, y: 5.45, z: 0 });

  if (isGirl) {
    makePart("hairBack", new THREE.BoxGeometry(3.15, 3.4, 0.85), hair, { x: 0, y: 5.35, z: -0.95 });
    makePart("hairTop", new THREE.SphereGeometry(2.05, 40, 16), hair, { x: 0, y: 6.3, z: 0 }, { x: 1, y: 0.45, z: 1 });
    makePart("hairLeft", new THREE.BoxGeometry(0.62, 3.1, 0.55), hair, { x: -1.72, y: 4.82, z: 0.2 });
    makePart("hairRight", new THREE.BoxGeometry(0.62, 3.1, 0.55), hair, { x: 1.72, y: 4.82, z: 0.2 });
  } else {
    makePart("beanie", new THREE.CylinderGeometry(2.05, 2.22, 1.45, 48), blue, { x: 0, y: 6.75, z: 0 });
    makePart("beanieTop", new THREE.SphereGeometry(2.05, 48, 16), blue, { x: 0, y: 7.43, z: 0 }, { x: 1, y: 0.38, z: 1 });
  }

  makePart(
    "shades",
    new THREE.BoxGeometry(isGirl ? 2.78 : 3.05, 0.45, 0.16),
    new THREE.MeshPhongMaterial({
      color: 0x010101,
      emissive: isGirl ? 0x2b061e : 0x043018,
      emissiveIntensity: 0.6,
      shininess: 145
    }),
    { x: 0, y: 5.55, z: 1.72 }
  );

  makePart("mouth", new THREE.BoxGeometry(0.95, 0.12, 0.08), new THREE.MeshBasicMaterial({ color: 0x160706 }), {
    x: 0.12,
    y: 4.78,
    z: 1.88
  });

  const chain = makePart("chain", new THREE.TorusGeometry(isGirl ? 1.88 : 2.18, 0.22, 26, 72), gold, {
    x: 0,
    y: 3.85,
    z: 0
  });
  chain.rotation.x = Math.PI / 2;
  chain.scale.y = 0.74;

  const pendant = makePart("pendant", new THREE.CylinderGeometry(0.54, 0.54, 0.18, 40), gold, {
    x: 0,
    y: 3.12,
    z: 1.45
  });
  pendant.rotation.x = Math.PI / 2;

  makePart("leftLeg", new THREE.BoxGeometry(isGirl ? 1.25 : 1.55, 4.9, 1.55), pants, { x: -1.25, y: -3.4, z: 0 });
  makePart("rightLeg", new THREE.BoxGeometry(isGirl ? 1.25 : 1.55, 4.9, 1.55), pants, { x: 1.25, y: -3.4, z: 0 });

  makePart("leftShoe", new THREE.BoxGeometry(1.8, 0.6, 2.25), shoe, { x: -1.25, y: -6.1, z: 0.35 });
  makePart("rightShoe", new THREE.BoxGeometry(1.8, 0.6, 2.25), shoe, { x: 1.25, y: -6.1, z: 0.35 });

  makePart("leftArm", new THREE.BoxGeometry(1.18, 5.2, 1.25), outfit, { x: isGirl ? -2.62 : -3.05, y: 1.85, z: 0 });
  makePart("rightArm", new THREE.BoxGeometry(1.18, 5.2, 1.25), outfit, { x: isGirl ? 2.62 : 3.05, y: 1.85, z: 0 });

  makePart("leftHand", new THREE.SphereGeometry(0.55, 24, 24), skin, { x: isGirl ? -2.62 : -3.05, y: -1.1, z: 0.1 });
  makePart("rightHand", new THREE.SphereGeometry(0.55, 24, 24), skin, { x: isGirl ? 2.62 : 3.05, y: -1.1, z: 0.1 });

  const chestGlow = makePart(
    "chatgptCore",
    new THREE.SphereGeometry(0.42, 30, 30),
    new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }),
    { x: 0, y: 1.55, z: 1.62 }
  );

  chestGlow.scale.set(1, 1, 0.24);

  rbAvatar.scale.setScalar(isGirl ? 0.96 : 1);
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
    new THREE.BoxGeometry(5.35, 8.7, 0.64),
    new THREE.MeshPhongMaterial({
      color: 0x050805,
      specular: 0xfacc15,
      shininess: 118,
      transparent: true,
      opacity: 0.96
    })
  );

  const bevelGlow = new THREE.Mesh(
    new THREE.BoxGeometry(5.62, 8.96, 0.08),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.12,
      wireframe: true,
      depthWrite: false
    })
  );
  bevelGlow.position.z = 0.37;

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
    new THREE.PlaneGeometry(4.78, 7.85),
    new THREE.MeshBasicMaterial({
      map: screenTexture,
      transparent: true,
      opacity: 0.985,
      depthWrite: true
    })
  );
  screen.position.z = 0.36;

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(4.78, 7.85),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  glass.position.z = 0.39;

  const shine = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 8.2),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.075,
      depthWrite: false
    })
  );
  shine.position.set(1.25, 0, 0.42);
  shine.rotation.z = -0.16;

  const hotAura = new THREE.Mesh(
    new THREE.PlaneGeometry(6.32, 9.75),
    new THREE.MeshBasicMaterial({
      color: 0x00ff9d,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  hotAura.position.z = 0.22;

  const textLabel = createTextLabel(mod.tag, mod.title);
  textLabel.position.set(0, -5.2, 0.52);

  group.add(body);
  group.add(screen);
  group.add(glass);
  group.add(shine);
  group.add(bevelGlow);
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

  ctx.fillStyle = "rgba(5,8,5,.62)";
  roundRect(ctx, 64, 28, 896, 190, 46);
  ctx.fill();

  ctx.strokeStyle = "rgba(251,191,36,.5)";
  ctx.lineWidth = 4;
  roundRect(ctx, 64, 28, 896, 190, 46);
  ctx.stroke();

  ctx.shadowBlur = 18;
  ctx.fillStyle = "#34d399";
  ctx.font = "900 52px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tag, 512, 82);

  ctx.shadowColor = "rgba(251,191,36,.8)";
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
      opacity: 0.92,
      depthWrite: false
    })
  );

  sprite.scale.set(6.3, 1.58, 1);
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
    activityState.orbitBoost = live.active ? 1.32 : 1;
    activityState.portalBoost = live.active ? 1.26 : 1;

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

function updateCards(t) {
  const isMobile = window.innerWidth <= motion.mobileBreakpoint;

  const radiusX = isMobile ? motion.orbit.mobileRadiusX / 10 : motion.orbit.desktopRadiusX / 10;
  const radiusZ = isMobile ? motion.orbit.mobileRadiusY / 10 : motion.orbit.desktopRadiusY / 10;
  const baseY = isMobile ? -1.02 : -0.52;

  orbitOffset += (targetOffset - orbitOffset) * 0.062;

  cards.forEach((card, index) => {
    const angle = orbitOffset + (index / cards.length) * Math.PI * 2;
    const x = Math.cos(angle) * radiusX;
    const z = Math.sin(angle) * radiusZ;
    const depth = (z + radiusZ) / (radiusZ * 2);

    const centerPull = Math.max(0, 1 - Math.abs(x) / radiusX);
    const scale = 0.4 + depth * 0.47 + centerPull * 0.09;
    const opacity = 0.5 + depth * 0.5;

    const hotBoost = card.userData.isHot ? 1.13 : 1;
    const presenceBoost = card.userData.presenceBoost ? 1.045 : 1;
    const hoverBoost = card === hoveredCard ? 1.12 : 1;

    card.position.set(x, baseY + depth * 1.14 + Math.sin(t * 1.2 + index) * 0.04, z + 1.35);
    card.rotation.y = -angle + Math.PI / 2;
    card.rotation.z = Math.sin(angle) * 0.035;
    card.scale.setScalar(scale * hotBoost * presenceBoost * hoverBoost);

    card.children.forEach((child, childIndex) => {
      if (!child.material) return;

      if (childIndex === 0) child.material.opacity = 0.8 + opacity * 0.16;
      if (childIndex === 1) child.material.opacity = opacity;
      if (childIndex === 2) child.material.opacity = 0.035 + depth * 0.05;
      if (childIndex === 3) child.material.opacity = 0.045 + depth * 0.07;
      if (childIndex === 4) child.material.opacity = 0.1 + depth * 0.14;

      if (childIndex === 5) {
        child.material.opacity = card.userData.isHot
          ? 0.1 + Math.sin(performance.now() * 0.005) * 0.045
          : centerPull * 0.03;
      }

      if (child.userData?.isLabel) {
        child.material.opacity = 0.1 + depth * 0.88;
        child.scale.set(5.24 + depth * 1.38, 1.26 + depth * 0.4, 1);
      }
    });

    card.renderOrder = 20 + Math.round(depth * 130);
  });
}

function updatePortal(t) {
  if (!portal) return;

  const boost = activityState.portalBoost + activityState.touchEnergy * 0.65;
  const pulse = 1 + Math.sin(t * 2.1) * motion.portal.scalePulse * boost;

  portal.rotation.y += 0.0034 * boost;
  portal.rotation.x = Math.sin(t * 0.42) * 0.048;
  portal.scale.setScalar(pulse);

  if (portalCore) {
    portalCore.rotation.y -= 0.0058 * boost;
    portalCore.rotation.z += 0.0032 * boost;
    portalCore.material.opacity = 0.76 + Math.sin(t * 2.8) * 0.06 + activityState.touchEnergy * 0.04;
    portalCore.material.emissiveIntensity = 1.18 + Math.sin(t * 3.1) * 0.24 + activityState.touchEnergy * 0.42;
  }

  if (portalInner) {
    portalInner.scale.setScalar(1 + Math.sin(t * 4.4) * 0.2);
    portalInner.material.opacity = 0.13 + Math.sin(t * 3.6) * 0.065 + activityState.touchEnergy * 0.08;
  }

  if (portalLens) {
    portalLens.rotation.y -= 0.004 * boost;
    portalLens.scale.setScalar(1.02 + Math.sin(t * 1.7) * 0.04);
    portalLens.material.opacity = 0.1 + activityState.touchEnergy * 0.05;
  }

  if (portalMist) {
    portalMist.rotation.z += 0.0027 * boost;
    portalMist.scale.set(
      31 + Math.sin(t * 1.7) * 3.2 + activityState.touchEnergy * 4,
      31 + Math.cos(t * 1.4) * 3.2 + activityState.touchEnergy * 4,
      1
    );
    portalMist.material.opacity = 0.55 + Math.sin(t * 1.9) * 0.13 + activityState.touchEnergy * 0.12;
  }

  if (portalMouth) {
    portalMouth.rotation.z += 0.009 * boost;
    portalMouth.scale.setScalar(1 + Math.sin(t * 3.3) * 0.052 + activityState.touchEnergy * 0.06);
  }

  portalRings.forEach((ring, index) => {
    ring.rotation.z += (0.0045 + index * 0.0018) * (index % 2 ? -1 : 1) * boost;
    ring.rotation.y += 0.0015 * (index + 1) * boost;
    ring.material.opacity = Math.max(
      0.045,
      0.25 - index * 0.032 + Math.sin(t * (1.7 + index)) * 0.04 + activityState.touchEnergy * 0.04
    );
  });

  portalStreams.forEach((stream) => {
    stream.rotation.z -= 0.0068 * boost;
    stream.rotation.y += 0.0024 * boost;
    stream.material.opacity = 0.62 + Math.sin(t * 2.6) * 0.15 + activityState.touchEnergy * 0.1;
  });

  portalBeams.forEach((beam, index) => {
    beam.rotation.z += (0.003 + index * 0.0006) * (index % 2 ? -1 : 1) * boost;
    beam.material.opacity = 0.09 + Math.sin(t * 2.2 + index) * 0.04 + activityState.touchEnergy * 0.08;
    beam.scale.x = 1 + Math.sin(t * 2 + index) * 0.08 + activityState.touchEnergy * 0.16;
  });

  for (let i = portalTouchBursts.length - 1; i >= 0; i -= 1) {
    const burst = portalTouchBursts[i];
    burst.userData.life -= 0.026;
    burst.scale.multiplyScalar(1.035);

    burst.children.forEach((beam) => {
      beam.rotation.z += beam.userData.speed;
      beam.material.opacity *= 0.94;
    });

    if (burst.userData.life <= 0) {
      portal.remove(burst);
      portalTouchBursts.splice(i, 1);
    }
  }

  activityState.touchEnergy *= 0.94;
}

function updateComets(t) {
  if (!energyComets) return;

  energyComets.children.forEach((sprite, index) => {
    sprite.userData.angle += sprite.userData.speed * activityState.portalBoost;

    const r = sprite.userData.radius + Math.sin(t + index) * 1.25;
    const a = sprite.userData.angle;

    sprite.position.set(
      Math.cos(a) * r,
      sprite.userData.y + Math.sin(t * 1.4 + index) * 1.45,
      Math.sin(a) * r - 8
    );

    sprite.material.opacity = 0.15 + Math.sin(t * 2 + index) * 0.08 + activityState.liveCount * 0.002;
  });
}

function updateClouds(t) {
  if (!cloudField) return;

  cloudField.children.forEach((cloud, index) => {
    cloud.position.x += cloud.userData.speed * 12;
    cloud.position.y += Math.sin(t * 0.4 + cloud.userData.float) * 0.004;
    cloud.rotation.z += 0.0008;

    if (cloud.position.x > 46) {
      cloud.position.x = -46;
      cloud.position.y = THREE.MathUtils.randFloat(-12, 18);
    }

    cloud.material.opacity = 0.034 + Math.sin(t * 0.6 + index) * 0.016;
  });
}

function updateRealAvatar(t) {
  if (!avatarGroup || !rbAvatar) return;

  const step = Math.sin(t * 4.2);
  const breathe = Math.sin(t * 1.6);

  avatarTargetX = Math.sin(t * 0.45) * 5.6;
  avatarTargetZ = 8.4 + Math.cos(t * 0.4) * 0.8;

  avatarGroup.position.x += (avatarTargetX - avatarGroup.position.x) * 0.02;
  avatarGroup.position.y = -2.52 + Math.sin(t * 1.25) * 0.2;
  avatarGroup.position.z += (avatarTargetZ - avatarGroup.position.z) * 0.02;
  avatarGroup.rotation.y = Math.sin(t * 0.52) * 0.44;

  rbAvatar.position.y = Math.sin(t * 2.2) * 0.16;
  rbAvatar.rotation.y += (Math.sin(t * 0.58) * 0.18 - rbAvatar.rotation.y) * 0.04;

  if (rbAvatarParts.head) {
    rbAvatarParts.head.position.y = 5.45 + Math.sin(t * 2.8) * 0.075;
    rbAvatarParts.head.rotation.y = Math.sin(t * 1.1) * 0.05;
  }

  if (rbAvatarParts.leftLeg) rbAvatarParts.leftLeg.rotation.x = step * 0.34;
  if (rbAvatarParts.rightLeg) rbAvatarParts.rightLeg.rotation.x = -step * 0.34;
  if (rbAvatarParts.leftArm) rbAvatarParts.leftArm.rotation.x = -step * 0.42;
  if (rbAvatarParts.rightArm) rbAvatarParts.rightArm.rotation.x = step * 0.42;

  if (rbAvatarParts.leftShoe && rbAvatarParts.leftLeg) {
    rbAvatarParts.leftShoe.rotation.x = rbAvatarParts.leftLeg.rotation.x * 0.22;
  }

  if (rbAvatarParts.rightShoe && rbAvatarParts.rightLeg) {
    rbAvatarParts.rightShoe.rotation.x = rbAvatarParts.rightLeg.rotation.x * 0.22;
  }

  if (rbAvatarParts.chain) rbAvatarParts.chain.rotation.z = Math.sin(t * 2.2) * 0.035;
  if (rbAvatarParts.pendant) rbAvatarParts.pendant.rotation.z = Math.sin(t * 2.4) * 0.08;

  if (rbAvatarParts.glow?.material) {
    rbAvatarParts.glow.material.opacity = 0.055 + Math.abs(breathe) * 0.055;
  }

  if (rbAvatarParts.chatgptCore) {
    rbAvatarParts.chatgptCore.scale.setScalar(1 + Math.sin(t * 4.4) * 0.16);
    rbAvatarParts.chatgptCore.material.opacity = 0.68 + Math.sin(t * 3.8) * 0.16;
  }

  avatarWalkTime += 0.016;
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

  window.RB_SWAP_AVATAR = () => {
    makeRBAvatar(rbAvatar?.userData?.type === "boy" ? "girl" : "boy");
  };

  window.RB_PORTAL_COLOR = () => {
    setPortalPalette(portalColorMode + 1);
    activityState.touchEnergy = 1;
    addPortalTouchBurst();
  };
}

function onPointerDown(event) {
  isDragging = true;
  startX = event.clientX;
  lastX = event.clientX;
  dragMoved = false;

  const x = (event.clientX / window.innerWidth) * 2 - 1;
  const y = -(event.clientY / window.innerHeight) * 2 + 1;

  const nearCenter = Math.abs(x) < 0.38 && Math.abs(y) < 0.42;

  if (nearCenter) {
    setPortalPalette(portalColorMode + 1);
    activityState.touchEnergy = 1;
    addPortalTouchBurst();
  }
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
  activityState.touchEnergy = Math.min(1, activityState.touchEnergy + Math.abs(delta) * 0.0025);
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

  const t = performance.now() * 0.001;

  targetOffset += (motion.orbit.speed || 0.00255) * activityState.orbitBoost;

  updatePortal(t);
  updateComets(t);
  updateClouds(t);
  updateRealAvatar(t);

  if (galaxyCloud) {
    galaxyCloud.rotation.y += 0.00115 * activityState.orbitBoost;
    galaxyCloud.rotation.z = Math.sin(t * 0.12) * 0.045;
    galaxyCloud.material.opacity = activityState.liveActive ? 0.72 : 0.64;
  }

  if (galaxyGold) {
    galaxyGold.rotation.y -= 0.00085 * activityState.orbitBoost;
    galaxyGold.material.opacity = activityState.onlineCount > 0 ? 0.56 : 0.48;
  }

  if (starField) {
    starField.rotation.y += 0.00038 * activityState.orbitBoost;
    starField.material.opacity = activityState.onlineCount > 0 ? 0.72 : 0.66;
  }

  if (deepStarField) {
    deepStarField.rotation.y -= 0.00017;
  }

  if (floatingParticles) {
    floatingParticles.rotation.y -= 0.00078;
    floatingParticles.rotation.z = Math.sin(t * 0.16) * 0.05;
  }

  updateCards(t);

  renderer.render(scene, camera);
}

initUniverse();
