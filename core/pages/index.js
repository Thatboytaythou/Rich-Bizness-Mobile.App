/* =========================================
   RICH BIZNESS LLC
   /core/pages/index.js
   INDEX UNIVERSE CONTROLLER + 3D CINEMATIC AVATAR
========================================= */

import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';

const RB_SECTIONS = [
  { key: "feed",    label: "FEED",    title: "Global Feed",     meta: "DISCOVER",    route: "/feed" },
  { key: "live",    label: "LIVE",    title: "Go Live",         meta: "LIVE STREAM", route: "/live" },
  { key: "music",   label: "MUSIC",   title: "Music",           meta: "UNIVERSE",    route: "/music" },
  { key: "gaming",  label: "GAMING",  title: "Gaming",          meta: "PLAY",        route: "/gaming" },
  { key: "sports",  label: "SPORTS",  title: "Sports",          meta: "ACTION",      route: "/sports" },
  { key: "gallery", label: "GALLERY", title: "Gallery",         meta: "SHOWCASE",    route: "/gallery" },
  { key: "store",   label: "STORE",   title: "The Store",       meta: "SHOP",        route: "/store" },
  { key: "meta",    label: "META",    title: "Meta",            meta: "WORLD",       route: "/meta" },
  { key: "upload",  label: "UPLOAD",  title: "Upload Content",  meta: "SHARE YOUR WORLD", route: "/upload" }
];

const $ = (id) => document.getElementById(id);

let activeKey = document.body.dataset.activeSection || "live";
let scene, camera, renderer, avatarMesh;
let isAvatarLoaded = false;

// ====================== 3D AVATAR ======================
function init3DAvatar() {
  const canvas = $('rb-avatar-canvas');
  if (!canvas) return;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: true, 
    alpha: true 
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(64, 64);
  camera.position.z = 3.8;

  // Lights
  const ambient = new THREE.AmbientLight(0x7bff66, 0.7);
  scene.add(ambient);

  const pointLight = new THREE.PointLight(0xffffff, 1.4, 100);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);

  // Glowing Avatar Sphere (can be replaced with real model later)
  const geometry = new THREE.SphereGeometry(1.25, 48, 48);
  const material = new THREE.MeshPhongMaterial({
    color: 0x7bff66,
    emissive: 0x00ff88,
    shininess: 95,
    specular: 0xffffff,
    transparent: true,
    opacity: 0.95
  });

  avatarMesh = new THREE.Mesh(geometry, material);
  scene.add(avatarMesh);

  // Gentle floating + rotation
  function animate() {
    requestAnimationFrame(animate);
    if (avatarMesh) {
      avatarMesh.rotation.y += 0.006;
      avatarMesh.position.y = Math.sin(Date.now() * 0.0015) * 0.08;
    }
    renderer.render(scene, camera);
  }
  animate();

  isAvatarLoaded = true;
  console.log("🌌 3D Avatar Initialized");
}

// ====================== CINEMATIC PORTAL WALK ======================
function cinematicAvatarEnter() {
  const container = $('rb-avatar-3d-container');
  if (!container) return;

  container.style.transition = 'all 1.9s cubic-bezier(0.25, 0.1, 0.25, 1)';
  container.style.transform = 'translateX(220px) scale(0.15) rotate(12deg)';
  container.style.opacity = '0';

  // Portal reaction
  const portalCore = document.querySelector('.rb-portal-core');
  if (portalCore) {
    portalCore.style.transition = 'all 1.2s ease';
    portalCore.style.transform = 'scale(1.15)';
  }

  setTimeout(() => {
    window.location.href = '/profile'; // Change destination as needed
  }, 1650);
}

// ====================== CORE INDEX FUNCTIONS ======================
function getSection(key = activeKey) {
  return RB_SECTIONS.find(s => s.key === key) || RB_SECTIONS[1];
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function setActiveSection(key) {
  const section = getSection(key);
  activeKey = section.key;
  document.body.dataset.activeSection = section.key;

  document.querySelectorAll("[data-section]").forEach(card => {
    card.classList.toggle("is-active", card.dataset.section === section.key);
  });

  document.querySelectorAll("[data-route]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.route === section.key);
  });

  setText("rb-active-label", section.label);
  setText("rb-active-title", section.title);
  setText("rb-active-meta", section.meta);
  setText("rb-launch-section", `ENTER ${section.label} →`);
}

function goTo(path) {
  if (!path) return;
  window.location.href = path;
}

function launchActiveSection() {
  goTo(getSection().route);
}

function bindIndexClicks() {
  document.addEventListener("click", (e) => {
    const target = e.target.closest("button");
    if (!target) return;

    if (target.dataset.section || target.dataset.route) {
      e.preventDefault();
      setActiveSection(target.dataset.section || target.dataset.route);
      return;
    }

    if (target.id === "rb-launch-section") {
      e.preventDefault();
      launchActiveSection();
      return;
    }

    if (target.id === "rb-open-upload") {
      e.preventDefault();
      setActiveSection("upload");
      return;
    }

    if (target.id === "rb-create-channel") {
      e.preventDefault();
      goTo("/profile");
      return;
    }

    if (target.id === "rb-open-profile") {
      e.preventDefault();
      cinematicAvatarEnter();
    }
  });
}

function bindKeyboard() {
  document.addEventListener("keydown", (e) => {
    const currentIndex = RB_SECTIONS.findIndex(s => s.key === activeKey);

    if (e.key === "ArrowRight") {
      const next = RB_SECTIONS[(currentIndex + 1) % RB_SECTIONS.length];
      setActiveSection(next.key);
    }
    if (e.key === "ArrowLeft") {
      const prev = RB_SECTIONS[(currentIndex - 1 + RB_SECTIONS.length) % RB_SECTIONS.length];
      setActiveSection(prev.key);
    }
    if (e.key === "Enter") {
      launchActiveSection();
    }
  });
}

function paintStats() {
  setText("rb-stat-members", "10M+");
  setText("rb-stat-creators", "500K+");
  setText("rb-stat-live", "100K+");
  setText("rb-stat-active", "1M+");
}

function bootIndex() {
  setActiveSection(activeKey);
  paintStats();
  bindIndexClicks();
  bindKeyboard();
  init3DAvatar();

  document.body.classList.add("rb-index-ready");
  console.log("🚀 RICH BIZNESS UNIVERSE INDEX READY");
}

// Boot
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootIndex);
} else {
  bootIndex();
}
