import RB_CONFIG from "/core/shared/rb-config.js";

/* =========================
   RICH BIZNESS MOBILE
   /core/engine/universe-preview.js

   PRO MAX UNIVERSE ENGINE
   Living Portal + Galaxy + Orbit Cards + Real 3D Avatar + Smoke Clouds
========================= */

const container = document.getElementById("canvas-container");
const labelEl = document.getElementById("module-label");

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
let cloudField;
let avatarGroup;
let rbAvatar;
let rbAvatarParts = {};
let rbAvatarType = "boy";
let orbitGroup;
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
const smokeParticles = [];
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
  scene.fog = new THREE.FogExp2(0x020503, 0.012);

  camera = new THREE.PerspectiveCamera(
    44,
    window.innerWidth / window.innerHeight,
    0.1,
    1800
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

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);

  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.16, "rgba(250,204,21,.9)");
  gradient.addColorStop(0.42, "rgba(0,255,157,.64)");
  gradient.addColorStop(0.74, "rgba(16,185,129,.18)");
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

  for (let i = 0; i < 42; i += 1) {
    const x = 256 + (Math.random() - 0.5) * 170;
    const y = 256 + (Math.random() - 0.5) * 120;
    const r = 36 + Math.random() * 92;

    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(180,255,220,.22)");
    g.addColorStop(0.45, "rgba(0,255,157,.08)");
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
  scene.add(new THREE.AmbientLight(0xffffff, 0.74));

  const goldLight = new THREE.PointLight(0xfacc15, 5.2, 210);
  goldLight.position.set(20, 22, 38);
  scene.add(goldLight);

  const greenLight = new THREE.PointLight(0x00ff9d, 4.8, 210);
  greenLight.position.set(-24, -6, 26);
  scene.add(greenLight);

  const portalLight = new THREE.PointLight(0x00ffcc, 6.2, 128);
  portalLight.position.set(0, -1, 8);
  scene.add(portalLight);

  const avatarLight = new THREE.PointLight(0xfacc15, 3.4, 90);
  avatarLight.position.set(8, 8, 22);
  scene.add(avatarLight);
}

function buildStars() {
  const isMobile = window.innerWidth <= motion.mobileBreakpoint;
  const count = isMobile ? 3600 : 5800;

  const geo = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  for (let i = 0; i < count; i += 1) {
    positions.push(
      THREE.MathUtils.randFloatSpread(240),
      THREE.MathUtils.randFloatSpread(170),
      THREE.MathUtils.randFloatSpread(210) - 35
    );

    if (Math.random() > 0.78) colors.push(1, 0.78, 0.18);
    else colors.push(0.08, 0.95, 0.62);
  }

  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

  starField = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: isMobile ? 0.055 : 0.068,
      transparent: true,
      opacity: 0.62,
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
      opacity: 0.24,
      depthWrite: false
    })
  );

  deepStarField.position.z = -100;
  deepStarField.scale.setScalar(1.5);
  scene.add(deepStarField);
}

function buildGalaxy() {
  const isMobile = window.innerWidth <= motion.mobileBreakpoint;
  const count = isMobile ? 5600 : 8800;

  const greenGeo = new THREE.BufferGeometry();
  const goldGeo = new THREE.BufferGeometry();

  const green = [];
  const gold = [];

  for (let i = 0; i < count; i += 1) {
    const radius = Math.random() * 84;
    const arm = i % 5;
    const angle = radius * 0.24 + arm * ((Math.PI * 2) / 5) + Math.random() * 0.62;

    const x = Math.cos(angle) * radius;
    const y = THREE.MathUtils.randFloatSpread(32) * (1 - radius / 128);
    const z = Math.sin(angle) * radius - 24;

    if (Math.random() > 0.72) gold.push(x, y, z);
    else green.push(x, y, z);
  }

  greenGeo.setAttribute("position", new THREE.Float32BufferAttribute(green, 3));
  goldGeo.setAttribute("position", new THREE.Float32BufferAttribute(gold, 3));

  galaxyCloud = new THREE.Points(
    greenGeo,
    new THREE.PointsMaterial({
      color: 0x00ff9d,
      size: isMobile ? 0.074 : 0.092,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    })
  );

  galaxyGold = new THREE.Points(
    goldGeo,
    new THREE.PointsMaterial({
      color: 0xfacc15,
      size: isMobile ? 0.056 : 0.07,
      transparent: true,
      opacity: 0.45,
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

  for (let i = 0; i < 16; i += 1) {
    const cloud = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.055 + Math.random() * 0.055,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    cloud.position.set(
      THREE.MathUtils.randFloatSpread(52),
      THREE.MathUtils.randFloat(-10, 16),
      THREE.MathUtils.randFloat(-32, 4)
    );

    const s = THREE.MathUtils.randFloat(10, 24);
    cloud.scale.set(s * 1.8, s, 1);
    cloud.userData.speed = THREE.MathUtils.randFloat(0.0008, 0.0022);
    cloud.userData.float = Math.random() * Math.PI * 2;

    cloudField.add(cloud);
  }

  scene.add(cloudField);
}

function buildFloatingParticles() {
  const isMobile = window.innerWidth <= motion.mobileBreakpoint;
  const count = isMobile ? 1600 : 2700;

  const geo = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = THREE.MathUtils.randFloat(3, 50);

    positions.push(
      Math.cos(angle) * radius,
      THREE.MathUtils.randFloatSpread(58),
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
      size: isMobile ? 0.09 : 0.112,
      transparent: true,
      opacity: 0.6,
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

  for (let i = 0; i < 38; i += 1) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    sprite.userData.speed = THREE.MathUtils.randFloat(0.004, 0.013);
    sprite.userData.radius = THREE.MathUtils.randFloat(9, 36);
    sprite.userData.angle = Math.random() * Math.PI * 2;
    sprite.userData.y = THREE.MathUtils.randFloat(-10, 10);
    sprite.scale.setScalar(THREE.MathUtils.randFloat(0.55, 1.75));

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
      opacity: 0.76,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );

  portalMist.scale.set(27, 27, 1);
  portal.add(portalMist);

  portalMouth = new THREE.Mesh(
    new THREE.TorusGeometry(6.45, 0.42, 24, 180),
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
    new THREE.TorusGeometry(7.35, 0.12, 18, 180),
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

  for (let i = 0; i < 1250; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = THREE.MathUtils.randFloat(0.8, 9.2);
    const pull = Math.random();

    streamPositions.push(
      Math.cos(a) * r * pull,
      THREE.MathUtils.randFloatSpread(7.4),
      Math.sin(a) * r - THREE.MathUtils.randFloat(0, 10)
    );

    if (Math.random() > 0.72) streamColors.push(1, 0.78, 0.12);
    else streamColors.push(0, 1, 0.62);
  }

  streamGeo.setAttribute("position", new THREE.Float32BufferAttribute(streamPositions, 3));
  streamGeo.setAttribute("color", new THREE.Float32BufferAttribute(streamColors, 3));

  const streams = new THREE.Points(
    streamGeo,
    new THREE.PointsMaterial({
      size: 0.112,
      transparent: true,
      opacity: 0.74,
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
      emissiveIntensity: 1.15,
      shininess: 110,
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
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );

  portal.add(portalInner);

  for (let i = 0; i < 4; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(7.8 + i * 1.12, 0.045, 12, 190),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0xfacc15 : 0x00ff9d,
        transparent: true,
        opacity: 0.13 - i * 0.022,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );

    ring.rotation.x = Math.PI / (2.18 + i * 0.2);
    ring.rotation.y = i * 0.38;
    ring.rotation.z = i * 0.82;

    portalRings.push(ring);
    portal.add(ring);
  }

  portal.position.set(0, -1.12, -1.9);
  portal.renderOrder = 1;
  scene.add(portal);
}

function buildRealAvatar() {
  avatarGroup = new THREE.Group();
  avatarGroup.position.set(0, -2.75, 8.2);
  avatarGroup.scale.setScalar(0.24);
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

  rbAvatarType = type;
  rbAvatarParts = {};
  rbAvatar = new THREE.Group();
  avatarGroup.add(rbAvatar);

  const isGirl = type === "girl";

  const skin = new THREE.MeshPhongMaterial({
    color: isGirl ? 0xd99b7b : 0xe8b88a,
    shininess: 30
  });

  const outfit = new THREE.MeshPhongMaterial({
    color: isGirl ? 0x120918 : 0x070a08,
    emissive: isGirl ? 0x26051f : 0x021407,
    emissiveIntensity: 0.36,
    shininess: 38
  });

  const pants = new THREE.MeshPhongMaterial({ color: 0x070d0b, shininess: 18 });
  const shoe = new THREE.MeshPhongMaterial({ color: 0x030303, shininess: 54 });
  const hair = new THREE.MeshPhongMaterial({ color: 0x050302, shininess: 44 });
  const blue = new THREE.MeshPhongMaterial({ color: 0x1e3a8a, shininess: 56 });

  const gold = new THREE.MeshPhongMaterial({
    color: 0xfacc15,
    emissive: 0xc99700,
    emissiveIntensity: 1.15,
    shininess: 128
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
      emissiveIntensity: 0.56,
      shininess: 140
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

  const cigar = makePart(
    "cigar",
    new THREE.CylinderGeometry(0.1, 0.1, 1.55, 14),
    new THREE.MeshPhongMaterial({
      color: 0x4b2e1a,
      emissive: 0x1a0802,
      shininess: 15
    }),
    { x: 1.78, y: 5.12, z: 1.95 }
  );

  cigar.rotation.z = Math.PI / 2.8;
  cigar.rotation.y = 0.32;

  makePart("ember", new THREE.SphereGeometry(0.14, 14, 14), new THREE.MeshBasicMaterial({ color: 0xff3b16 }), {
    x: 2.36,
    y: 5.32,
    z: 2.12
  });

  rbAvatar.scale.setScalar(isGirl ? 0.96 : 1);
  smokeBurst(18);
}

function createAvatarSmoke(boost = 1) {
  if (!rbAvatarParts.ember || !rbAvatar) return;

  const smoke = new THREE.Mesh(
    new THREE.SphereGeometry(0.24 + Math.random() * 0.34, 12, 12),
    new THREE.MeshBasicMaterial({
      color: Math.random() > 0.28 ? 0xd8ddd8 : 0x84ffae,
      transparent: true,
      opacity: 0.38 + Math.random() * 0.25,
      depthWrite: false
    })
  );

  const emberWorld = new THREE.Vector3();
  rbAvatarParts.ember.getWorldPosition(emberWorld);

  smoke.position.copy(emberWorld);
  smoke.position.x += Math.random() * 0.2;
  smoke.position.y += Math.random() * 0.2;
  smoke.position.z += Math.random() * 0.16;

  smoke.userData = {
    life: 1,
    drift: (Math.random() - 0.5) * 0.05 * boost,
    lift: 0.05 + Math.random() * 0.075 * boost,
    grow: 0.01 + Math.random() * 0.02
  };

  scene.add(smoke);
  smokeParticles.push(smoke);
}

function smokeBurst(amount = 36) {
  for (let i = 0; i < amount; i += 1) createAvatarSmoke(2.6);
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
    portalCore.material.emissiveIntensity = 1.15 + Math.sin(t * 3.1) * 0.22;
  }

  if (portalInner) {
    portalInner.scale.setScalar(1 + Math.sin(t * 4.4) * 0.18);
    portalInner.material.opacity = 0.12 + Math.sin(t * 3.6) * 0.06;
  }

  if (portalMist) {
    portalMist.rotation.z += 0.0024 * boost;
    portalMist.scale.set(
      27 + Math.sin(t * 1.7) * 2.5,
      27 + Math.cos(t * 1.4) * 2.5,
      1
    );
    portalMist.material.opacity = 0.55 + Math.sin(t * 1.9) * 0.13;
  }

  if (portalMouth) {
    portalMouth.rotation.z += 0.008 * boost;
    portalMouth.scale.setScalar(1 + Math.sin(t * 3.3) * 0.045);
  }

  portalRings.forEach((ring, index) => {
    ring.rotation.z += (0.004 + index * 0.0016) * (index % 2 ? -1 : 1) * boost;
    ring.rotation.y += 0.0014 * (index + 1) * boost;
    ring.material.opacity = Math.max(
      0.045,
      0.24 - index * 0.035 + Math.sin(t * (1.7 + index)) * 0.035
    );
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

function updateClouds(t) {
  if (!cloudField) return;

  cloudField.children.forEach((cloud, index) => {
    cloud.position.x += cloud.userData.speed * 12;
    cloud.position.y += Math.sin(t * 0.4 + cloud.userData.float) * 0.004;
    cloud.rotation.z += 0.0008;

    if (cloud.position.x > 42) {
      cloud.position.x = -42;
      cloud.position.y = THREE.MathUtils.randFloat(-10, 16);
    }

    cloud.material.opacity = 0.045 + Math.sin(t * 0.6 + index) * 0.018;
  });
}

function updateRealAvatar(t) {
  if (!avatarGroup || !rbAvatar) return;

  const step = Math.sin(t * 4.2);
  const breathe = Math.sin(t * 1.6);

  avatarGroup.position.x = Math.sin(t * 0.45) * 5.2;
  avatarGroup.position.y = -2.65 + Math.sin(t * 1.25) * 0.18;
  avatarGroup.position.z = 8.4 + Math.cos(t * 0.4) * 0.7;
  avatarGroup.rotation.y = Math.sin(t * 0.52) * 0.42;

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
  if (rbAvatarParts.ember) rbAvatarParts.ember.scale.setScalar(1 + Math.sin(t * 18) * 0.22);

  if (rbAvatarParts.glow?.material) {
    rbAvatarParts.glow.material.opacity = 0.06 + Math.abs(breathe) * 0.045;
  }

  if (Math.random() < 0.23) createAvatarSmoke(1.45);

  for (let i = smokeParticles.length - 1; i >= 0; i -= 1) {
    const p = smokeParticles[i];

    p.userData.life -= 0.01;
    p.position.y += p.userData.lift;
    p.position.x += p.userData.drift + Math.sin(t * 1.6 + i) * 0.01;
    p.position.z += Math.cos(t * 1.3 + i) * 0.008;

    p.scale.x += p.userData.grow;
    p.scale.y += p.userData.grow;
    p.scale.z += p.userData.grow;

    p.material.opacity *= 0.979;

    if (p.userData.life <= 0 || p.material.opacity <= 0.015) {
      scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
      smokeParticles.splice(i, 1);
    }
  }
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
    makeRBAvatar(rbAvatarType === "boy" ? "girl" : "boy");
  };
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

  targetOffset += (motion.orbit.speed || 0.00245) * activityState.orbitBoost;

  updatePortal(t);
  updateComets(t);
  updateClouds(t);
  updateRealAvatar(t);

  if (galaxyCloud) {
    galaxyCloud.rotation.y += 0.0011 * activityState.orbitBoost;
    galaxyCloud.rotation.z = Math.sin(t * 0.12) * 0.04;
    galaxyCloud.material.opacity = activityState.liveActive ? 0.7 : 0.6;
  }

  if (galaxyGold) {
    galaxyGold.rotation.y -= 0.0008 * activityState.orbitBoost;
    galaxyGold.material.opacity = activityState.onlineCount > 0 ? 0.54 : 0.45;
  }

  if (starField) {
    starField.rotation.y += 0.00035 * activityState.orbitBoost;
    starField.material.opacity = activityState.onlineCount > 0 ? 0.7 : 0.62;
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
