/* =========================
   RICH BIZNESS MOBILE
   /core/pages/avatar.js

   3D AVATAR PAGE CONTROLLER
   Profile Lock + Meta Avatar Sync
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError,
  refreshAppIdentity
} from "/core/app.js";

import {
  RB_ROUTES,
  RB_TABLES,
  RB_BUCKETS,
  RB_PROFILE_KEYS
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser
} from "/core/shared/rb-supabase.js";

import {
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  getProfileIdentity,
  refreshMyProfile,
  bindProfileShell
} from "/core/shared/rb-profile.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";
const DEFAULT_BANNER = "/images/brand/hero-banner.png";

const els = {
  canvas: $("avatarCanvas"),
  avatarImg: $("avatarImage"),
  avatarName: $("avatarName"),
  avatarHandle: $("avatarHandle"),
  avatarRank: $("avatarRank"),
  avatarStatus: $("avatarStatus"),

  syncBtn: $("avatarSyncBtn"),
  resetBtn: $("avatarResetBtn"),
  metaBtn: $("avatarMetaBtn"),
  profileBtn: $("avatarProfileBtn"),

  auraInput: $("avatarAura"),
  motionInput: $("avatarMotion"),
  outfitInput: $("avatarOutfit")
};

let supabase = null;
let currentUser = null;
let currentProfile = null;
let currentIdentity = null;
let currentMetaAvatar = null;

let scene = null;
let camera = null;
let renderer = null;
let avatarGroup = null;
let animationFrame = null;
let clockStart = performance.now();

function safe(value, fallback = "") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function syncState() {
  const state = getCurrentUserState?.() || {};

  currentUser = state.user || getUser() || null;
  currentProfile = state.profile || null;
  currentIdentity = getProfileIdentity(currentProfile);
}

function paintIdentity() {
  const identity = currentIdentity || getProfileIdentity();

  if (els.avatarImg) {
    els.avatarImg.src = identity.avatarUrl || DEFAULT_AVATAR;
    els.avatarImg.alt = identity.displayName || "Rich Bizness Avatar";
  }

  setText(els.avatarName, identity.displayName || "Rich User");
  setText(els.avatarHandle, identity.username ? `@${identity.username}` : "@richuser");
  setText(
    els.avatarRank,
    `${identity.rankTitle || "Member"} • LVL ${identity.richLevel || 1}`
  );
  setText(els.avatarStatus, identity.onlineStatus || "online");

  bindProfileShell?.();
}

async function loadMetaAvatar() {
  if (!currentUser?.id) return null;

  const { data, error } = await supabase
    .from(RB_TABLES.metaAvatars)
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) throw error;

  currentMetaAvatar = data || null;

  if (els.auraInput) {
    els.auraInput.value = currentMetaAvatar?.aura || "green-gold";
  }

  if (els.outfitInput) {
    els.outfitInput.value = currentMetaAvatar?.metadata?.outfit || "rich-default";
  }

  if (els.motionInput) {
    els.motionInput.value = currentMetaAvatar?.metadata?.motion || "idle-float";
  }

  return currentMetaAvatar;
}

async function syncAvatarToMeta() {
  if (!currentUser?.id) {
    window.location.href = RB_ROUTES.auth || "/auth";
    return null;
  }

  await ensureMyProfile();
  await refreshMyProfile();
  await refreshAppIdentity();

  syncState();

  const identity = currentIdentity || getProfileIdentity();

  const payload = {
    user_id: currentUser.id,
    display_name: identity.displayName,
    avatar_url: identity.avatarUrl || DEFAULT_AVATAR,
    aura: els.auraInput?.value || "green-gold",
    rank: identity.rankTitle || "Traveler",
    level: identity.richLevel || 1,
    is_active: true,
    metadata: {
      source: "avatar.js",
      app: "Rich Bizness Mobile",
      profile_lock: true,
      profile_key_source: RB_PROFILE_KEYS?.identitySource || "profiles",
      synced_from: RB_TABLES.profiles,
      avatar_bucket: RB_BUCKETS.metaAvatars || "meta-avatars",
      outfit: els.outfitInput?.value || "rich-default",
      motion: els.motionInput?.value || "idle-float",
      banner_url: identity.bannerUrl || DEFAULT_BANNER
    },
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(RB_TABLES.metaAvatars)
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .maybeSingle();

  if (error) throw error;

  currentMetaAvatar = data || null;
  paintIdentity();

  document.body.classList.add("rb-avatar-synced");

  return currentMetaAvatar;
}

function createAvatarScene() {
  if (!els.canvas || !window.THREE) return;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    55,
    els.canvas.clientWidth / els.canvas.clientHeight,
    0.1,
    1000
  );

  camera.position.set(0, 1.2, 5);

  renderer = new THREE.WebGLRenderer({
    canvas: els.canvas,
    alpha: true,
    antialias: true
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(els.canvas.clientWidth, els.canvas.clientHeight, false);

  const ambient = new THREE.AmbientLight(0xffffff, 1.4);
  scene.add(ambient);

  const keyLight = new THREE.PointLight(0x00ffae, 2, 12);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);

  const goldLight = new THREE.PointLight(0xffd700, 1.6, 10);
  goldLight.position.set(-3, 2, 4);
  scene.add(goldLight);

  avatarGroup = new THREE.Group();
  scene.add(avatarGroup);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x07130c,
    metalness: 0.4,
    roughness: 0.25,
    emissive: 0x003d25,
    emissiveIntensity: 0.45
  });

  const goldMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 0.8,
    roughness: 0.18,
    emissive: 0x3d2c00,
    emissiveIntensity: 0.4
  });

  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ffae,
    metalness: 0.2,
    roughness: 0.1,
    emissive: 0x00ffae,
    emissiveIntensity: 1.1
  });

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 48, 48),
    bodyMaterial
  );
  head.position.y = 1.25;
  avatarGroup.add(head);

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.45, 16, 32),
    bodyMaterial
  );
  body.position.y = -0.05;
  avatarGroup.add(body);

  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.045, 16, 80),
    goldMaterial
  );
  crown.position.y = 2.03;
  crown.rotation.x = Math.PI / 2;
  avatarGroup.add(crown);

  const aura = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.025, 16, 100),
    glowMaterial
  );
  aura.position.y = 0.65;
  aura.rotation.x = Math.PI / 2;
  avatarGroup.add(aura);

  const portalRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.85, 0.035, 16, 140),
    glowMaterial
  );
  portalRing.position.z = -0.55;
  avatarGroup.add(portalRing);

  animateAvatar();
}

function animateAvatar() {
  if (!renderer || !scene || !camera || !avatarGroup) return;

  const t = (performance.now() - clockStart) / 1000;

  avatarGroup.rotation.y = Math.sin(t * 0.45) * 0.28;
  avatarGroup.position.y = Math.sin(t * 1.3) * 0.08;

  avatarGroup.children.forEach((child, index) => {
    if (child.geometry?.type === "TorusGeometry") {
      child.rotation.z += 0.006 + index * 0.0008;
    }
  });

  renderer.render(scene, camera);
  animationFrame = requestAnimationFrame(animateAvatar);
}

function resizeAvatarScene() {
  if (!renderer || !camera || !els.canvas) return;

  const width = els.canvas.clientWidth || window.innerWidth;
  const height = els.canvas.clientHeight || window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function resetAvatarView() {
  if (!avatarGroup) return;

  avatarGroup.rotation.set(0, 0, 0);
  avatarGroup.position.set(0, 0, 0);
  clockStart = performance.now();
}

function bindAvatarActions() {
  els.syncBtn?.addEventListener("click", async () => {
    try {
      setText(els.avatarStatus, "syncing...");
      await syncAvatarToMeta();
      setText(els.avatarStatus, "synced");
    } catch (error) {
      console.error("[avatar sync failed]", error);
      setText(els.avatarStatus, "sync failed");
    }
  });

  els.resetBtn?.addEventListener("click", resetAvatarView);

  els.metaBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.meta || "/meta";
  });

  els.profileBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.profile || "/profile";
  });

  window.addEventListener("resize", resizeAvatarScene);
}

function cleanupAvatarPage() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;

  window.removeEventListener("resize", resizeAvatarScene);

  if (renderer) {
    renderer.dispose();
  }
}

async function bootAvatarPage() {
  try {
    await initApp({
      guard: true,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    await ensureMyProfile();
    await refreshAppIdentity();

    syncState();
    paintIdentity();

    await loadMetaAvatar();

    createAvatarScene();
    bindAvatarActions();

    document.body.dataset.rbPage = "avatar";
    document.body.dataset.rbRoute = "avatar";
    document.body.dataset.rbProfileLock = "true";
    document.body.classList.add("rb-avatar-ready");

    window.addEventListener("beforeunload", cleanupAvatarPage);

    markPageReady("avatar");

    console.log("RB AVATAR READY");
  } catch (error) {
    console.error("[RB AVATAR BOOT FAILED]", error);
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootAvatarPage);
} else {
  bootAvatarPage();
}
