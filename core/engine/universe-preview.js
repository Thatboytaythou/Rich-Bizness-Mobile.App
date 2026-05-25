import RB_CONFIG from "/core/shared/rb-config.js";

/* =========================
   RICH BIZNESS MOBILE
   /core/engine/universe-preview.js

   REAL ORBIT UNIVERSE
   - Three.js portal
   - Real branded image cards
   - Swipe / drag orbit
   - Tap card routing
   - Galaxy energy
========================= */

const container = document.getElementById("canvas-container");
const labelEl = document.getElementById("module-label");

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
  { key: "meta", title: "Meta World", tag: "META", image: "/images/brand/meta-verse-elite.png.jpeg" },
];

let scene;
let camera;
let renderer;
let portal;
let orbitGroup;
let galaxyCloud;
let starField;
let raycaster;
let pointer;
let hoveredCard = null;

let orbitOffset = 0;
let targetOffset = 0;
let isDragging = false;
let startX = 0;
let lastX = 0;
let dragMoved = false;

const cards = [];
const loader = new THREE.TextureLoader();

function initUniverse() {
  if (!container || !window.THREE) return;

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
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.sortObjects = true;

  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  buildLights();
  buildStars();
  buildGalaxy();
  buildPortal();
  buildCards();

  bindPointer();
  resizeUniverse();
  animateUniverse();
}

function buildLights() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.64));

  const goldLight = new THREE.PointLight(0xfbbf24, 3.4, 150);
  goldLight.position.set(18, 18, 32);
  scene.add(goldLight);

  const greenLight = new THREE.PointLight(0x10b981, 3.1, 150);
  greenLight.position.set(-20, -4, 22);
  scene.add(greenLight);
}

function buildStars() {
  const geo = new THREE.BufferGeometry();
  const positions = [];

  for (let i = 0; i < 2600; i++) {
    positions.push(THREE.MathUtils.randFloatSpread(180));
    positions.push(THREE.MathUtils.randFloatSpread(130));
    positions.push(THREE.MathUtils.randFloatSpread(150));
  }

  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  starField = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.045,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    })
  );

  starField.position.z = -18;
  scene.add(starField);
}

function buildGalaxy() {
  const galaxyGeo = new THREE.BufferGeometry();
  const galaxy = [];

  for (let i = 0; i < 3600; i++) {
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
      size: 0.065,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    })
  );

  galaxyCloud.name = "rbGalaxyCloud";
  scene.add(galaxyCloud);
}

function buildPortal() {
  portal = new THREE.Group();

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(7.65, 96, 96),
    new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.032,
      depthWrite: false,
    })
  );

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(5.9, 96, 96),
    new THREE.MeshPhongMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      shininess: 52,
      transparent: true,
      opacity: 0.96,
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
      opacity: 0.94,
    })
  );

  const screenTexture = loader.load(
    mod.image,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
    },
    undefined,
    () => console.warn("Missing module image:", mod.image)
  );

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.72, 7.72),
    new THREE.MeshBasicMaterial({
      map: screenTexture,
      transparent: true,
      opacity: 0.96,
      depthWrite: true,
    })
  );

  screen.position.z = 0.28;

  const tint = new THREE.Mesh(
    new THREE.PlaneGeometry(4.72, 7.72),
    new THREE.MeshBasicMaterial({
      color: 0x03140b,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
    })
  );

  tint.position.z = 0.3;

  const shine = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 7.4),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.065,
      depthWrite: false,
    })
  );

  shine.position.set(1.25, 0, 0.32);
  shine.rotation.z = -0.16;

  const border = new THREE.Mesh(
    new THREE.BoxGeometry(5.38, 8.58, 0.08),
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.22,
      wireframe: true,
      depthWrite: false,
    })
  );

  border.position.z = 0.34;

  group.add(body);
  group.add(screen);
  group.add(tint);
  group.add(shine);
  group.add(border);

  group.scale.setScalar(0.72);
  group.renderOrder = 20;

  return group;
}

function updateCards() {
  const isMobile = window.innerWidth <= RB_CONFIG.motion.mobileBreakpoint;

  const radiusX = isMobile
    ? RB_CONFIG.motion.orbit.mobileRadiusX / 10
    : RB_CONFIG.motion.orbit.desktopRadiusX / 10;

  const radiusZ = isMobile
    ? RB_CONFIG.motion.orbit.mobileRadiusY / 10
    : RB_CONFIG.motion.orbit.desktopRadiusY / 10;

  const baseY = isMobile ? -1.15 : -0.55;

  orbitOffset += (targetOffset - orbitOffset) * 0.055;

  cards.forEach((card, index) => {
    const angle = orbitOffset + (index / cards.length) * Math.PI * 2;

    const x = Math.cos(angle) * radiusX;
    const z = Math.sin(angle) * radiusZ;

    const depth = (z + radiusZ) / (radiusZ * 2);
    const scale = 0.42 + depth * 0.42;
    const opacity = 0.62 + depth * 0.38;

    card.position.set(x, baseY + depth * 1.05, z + 1.2);
    card.rotation.y = -angle + Math.PI / 2;
    card.scale.setScalar(card === hoveredCard ? scale * 1.12 : scale);

    card.children.forEach((child, childIndex) => {
      if (!child.material) return;

      if (childIndex === 0) child.material.opacity = 0.82 + opacity * 0.14;
      if (childIndex === 1) child.material.opacity = opacity;
      if (childIndex === 2) child.material.opacity = 0.12 + depth * 0.07;
      if (childIndex === 3) child.material.opacity = 0.05 + depth * 0.06;
      if (childIndex === 4) child.material.opacity = 0.13 + depth * 0.14;
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
        detail: hit.userData.module,
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

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animateUniverse() {
  requestAnimationFrame(animateUniverse);

  const t = performance.now() * 0.001;

  targetOffset += RB_CONFIG.motion.orbit.speed || 0.0022;

  portal.rotation.y += 0.002;
  portal.rotation.x = Math.sin(t * 0.45) * 0.06;
  portal.scale.setScalar(
    1 + Math.sin(t * 1.8) * RB_CONFIG.motion.portal.scalePulse
  );

  if (galaxyCloud) galaxyCloud.rotation.y += 0.0007;
  if (starField) starField.rotation.y += 0.00025;

  updateCards();
  renderer.render(scene, camera);
}

initUniverse();
