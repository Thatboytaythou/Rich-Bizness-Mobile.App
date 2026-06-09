/* =========================
   RICH BIZNESS MOBILE
   /core/pages/avatar.js

   3D AVATAR PAGE CONTROLLER
   Profile Lock + Meta Avatar Sync
   Avatar Builder → Meta World Gateway
   XP Gauge Enabled

   Flow:
   - Profile identity stays locked to profiles
   - Avatar builder syncs into meta_avatars
   - Meta page uses meta_avatars for the world avatar
   - No project-avatar fallback
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
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  getUser,
  ensureMyProfile
} from "/core/shared/rb-auth.js";

import {
  getProfileIdentity,
  refreshMyProfile,
  bindProfileShell,
  buildProfileUrl
} from "/core/shared/rb-profile.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";
const DEFAULT_BANNER = "/images/brand/hero-banner.png";
const DEFAULT_META_AVATAR = "/images/brand/meta-avatar.png.jpeg";

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
  outfitInput: $("avatarOutfit"),

  xpGauge: $("avatar-xp-gauge"),
  xpFill: $("avatar-xp-gauge-fill"),
  xpText: $("avatar-xp-gauge-text"),
  xpNext: $("avatar-xp-gauge-next"),
  xpLevel: $("avatar-xp-level"),
  xpRank: $("avatar-xp-rank")
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

function table(key, fallback) {
  return RB_TABLES?.[key] || fallback || key;
}

function bucket(key, fallback) {
  return RB_BUCKETS?.[key] || fallback || key;
}

function clean(value, fallback = "") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function safeImage(value = "", fallback = DEFAULT_AVATAR) {
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

function safeText(value = "", fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function setStatus(value) {
  setText(els.avatarStatus, value);
  if (els.avatarStatus) els.avatarStatus.dataset.status = String(value || "");
}

/* =========================
   XP GAUGE
========================= */

function getProfileXpModel(profile = {}, identity = {}, meta = {}) {
  const rawXp =
    meta?.xp ??
    profile?.xp ??
    profile?.rich_points ??
    profile?.points ??
    identity?.xp ??
    identity?.rich_points ??
    0;

  const rawLevel =
    meta?.level ??
    profile?.rich_level ??
    profile?.level ??
    identity?.rich_level ??
    identity?.level ??
    1;

  const rank =
    meta?.rank ||
    profile?.rank_title ||
    profile?.rank ||
    identity?.rankTitle ||
    identity?.rank_title ||
    identity?.rank ||
    "Meta Avatar";

  const xp = Math.max(0, Number(rawXp) || 0);
  const level = Math.max(1, Number(rawLevel) || 1);

  const levelBase = Math.max(0, (level - 1) * 1000);
  const nextLevel = level * 1000;
  const span = Math.max(1, nextLevel - levelBase);
  const currentIntoLevel = Math.max(0, xp - levelBase);
  const percent = Math.max(0, Math.min(100, (currentIntoLevel / span) * 100));
  const remaining = Math.max(0, nextLevel - xp);

  return {
    xp,
    level,
    rank,
    nextLevel,
    remaining,
    percent
  };
}

function renderXpGauge() {
  const model = getProfileXpModel(
    currentProfile,
    currentIdentity,
    currentMetaAvatar
  );

  if (els.xpGauge) {
    els.xpGauge.dataset.level = String(model.level);
    els.xpGauge.dataset.rank = model.rank;
    els.xpGauge.dataset.xp = String(model.xp);
  }

  if (els.xpFill) {
    els.xpFill.style.width = `${model.percent}%`;
  }

  if (els.xpText) {
    els.xpText.textContent = `${model.xp.toLocaleString()} XP`;
  }

  if (els.xpNext) {
    els.xpNext.textContent = `${model.remaining.toLocaleString()} XP TO LVL ${model.level + 1}`;
  }

  if (els.xpLevel) {
    els.xpLevel.textContent = `LVL ${model.level}`;
  }

  if (els.xpRank) {
    els.xpRank.textContent = model.rank;
  }

  window.dispatchEvent(
    new CustomEvent("rb:xp-gauge-update", {
      detail: {
        route: "avatar",
        xp: model.xp,
        level: model.level,
        rank: model.rank,
        nextLevel: model.nextLevel,
        remaining: model.remaining,
        percent: model.percent
      }
    })
  );
}

/* =========================
   PROFILE LOCK
========================= */

function syncState() {
  const state = getCurrentUserState?.() || {};

  currentUser = state.user || getUser?.() || null;
  currentProfile = state.profile || null;
  currentIdentity = getProfileIdentity(currentProfile);

  document.body.dataset.rbRoute = "avatar";
  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = currentIdentity?.id || "";
  document.body.dataset.rbProfileLocked = currentIdentity?.id ? "true" : "false";

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl(currentProfile);
  });

  document.querySelectorAll("[data-rb-current-avatar]").forEach((el) => {
    const avatar = safeImage(
      currentProfile?.avatar_url || currentIdentity?.avatarUrl || currentIdentity?.avatar_url,
      DEFAULT_AVATAR
    );

    if (el.tagName === "IMG") {
      el.src = avatar;
      el.alt =
        currentProfile?.display_name ||
        currentProfile?.username ||
        "Rich Bizness Profile";
    } else {
      el.style.backgroundImage = `url("${avatar}")`;
    }
  });

  renderXpGauge();
}

function paintIdentity() {
  const identity = currentIdentity || getProfileIdentity(currentProfile);

  const displayName = safeText(
    currentMetaAvatar?.display_name,
    identity?.displayName ||
      identity?.display_name ||
      currentProfile?.display_name ||
      "Rich User"
  );

  const username = safeText(
    identity?.username || currentProfile?.username,
    "richuser"
  );

  const avatarUrl = safeImage(
    currentMetaAvatar?.avatar_url ||
      identity?.avatarUrl ||
      identity?.avatar_url ||
      currentProfile?.avatar_url,
    DEFAULT_AVATAR
  );

  const rankTitle = safeText(
    currentMetaAvatar?.rank,
    identity?.rankTitle ||
      identity?.rank_title ||
      currentProfile?.rank_title ||
      "Member"
  );

  const level = clean(
    currentMetaAvatar?.level,
    identity?.richLevel ||
      identity?.rich_level ||
      currentProfile?.rich_level ||
      1
  );

  if (els.avatarImg) {
    els.avatarImg.src = avatarUrl;
    els.avatarImg.alt = displayName || "Rich Bizness Avatar";
  }

  setText(els.avatarName, displayName);
  setText(els.avatarHandle, username ? `@${username}` : "@richuser");
  setText(els.avatarRank, `${rankTitle} • LVL ${level}`);
  setStatus(currentMetaAvatar?.id ? "synced" : identity?.onlineStatus || "online");

  bindProfileShell?.();
  renderXpGauge();
}

async function loadMetaAvatar() {
  if (!currentUser?.id) return null;

  const { data, error } = await supabase
    .from(table("metaAvatars", "meta_avatars"))
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) throw error;

  currentMetaAvatar = data || null;

  if (els.auraInput) {
    els.auraInput.value = currentMetaAvatar?.aura || "green-gold";
  }

  if (els.outfitInput) {
    els.outfitInput.value =
      currentMetaAvatar?.metadata?.outfit || "rich-default";
  }

  if (els.motionInput) {
    els.motionInput.value =
      currentMetaAvatar?.metadata?.motion || "idle-float";
  }

  paintIdentity();
  applyAvatarVisualState();

  return currentMetaAvatar;
}

function avatarSettings() {
  return {
    aura: els.auraInput?.value || currentMetaAvatar?.aura || "green-gold",
    outfit:
      els.outfitInput?.value ||
      currentMetaAvatar?.metadata?.outfit ||
      "rich-default",
    motion:
      els.motionInput?.value ||
      currentMetaAvatar?.metadata?.motion ||
      "idle-float"
  };
}

async function syncAvatarToMeta() {
  if (!currentUser?.id) {
    window.location.href = RB_ROUTES.auth || "/auth";
    return null;
  }

  await ensureMyProfile();
  await refreshMyProfile?.();
  await refreshAppIdentity();

  syncState();

  const identity = currentIdentity || getProfileIdentity(currentProfile);
  const settings = avatarSettings();

  const avatarUrl = safeImage(
    identity?.avatarUrl ||
      identity?.avatar_url ||
      currentProfile?.avatar_url,
    DEFAULT_AVATAR
  );

  const bannerUrl = safeImage(
    identity?.bannerUrl ||
      identity?.banner_url ||
      currentProfile?.banner_url,
    DEFAULT_BANNER
  );

  const payload = {
    user_id: currentUser.id,
    display_name: safeText(
      identity?.displayName ||
        identity?.display_name ||
        currentProfile?.display_name,
      "Rich User"
    ),
    avatar_url: avatarUrl,
    model_url: currentMetaAvatar?.model_url || null,
    aura: settings.aura,
    rank: safeText(
      identity?.rankTitle ||
        identity?.rank_title ||
        currentProfile?.rank_title,
      "Traveler"
    ),
    level: Number(
      identity?.richLevel ||
        identity?.rich_level ||
        currentProfile?.rich_level ||
        currentMetaAvatar?.level ||
        1
    ),
    xp: Number(
      currentMetaAvatar?.xp ||
        currentProfile?.rich_points ||
        currentProfile?.xp ||
        0
    ),
    is_active: true,
    metadata: {
      ...(currentMetaAvatar?.metadata || {}),
      source: "avatar.js",
      app: "Rich Bizness Mobile",
      profile_lock: true,
      profile_key_source: RB_PROFILE_KEYS?.identitySource || "profiles",
      synced_from: table("profiles", "profiles"),
      avatar_bucket: bucket("metaAvatars", "meta-avatars"),
      profile_avatar_url: avatarUrl,
      banner_url: bannerUrl,
      outfit: settings.outfit,
      motion: settings.motion,
      last_synced_at: new Date().toISOString()
    },
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(table("metaAvatars", "meta_avatars"))
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .maybeSingle();

  if (error) throw error;

  currentMetaAvatar = data || payload;

  paintIdentity();
  applyAvatarVisualState();

  document.body.classList.add("rb-avatar-synced");

  window.dispatchEvent(
    new CustomEvent("rb:avatar-synced", {
      detail: {
        route: "avatar",
        userId: currentUser.id,
        metaAvatar: currentMetaAvatar,
        xpGauge: true
      }
    })
  );

  return currentMetaAvatar;
}

/* =========================
   THREE AVATAR PREVIEW
========================= */

function createAvatarScene() {
  if (!els.canvas || !window.THREE) {
    console.warn("[RB AVATAR] THREE or avatarCanvas missing.");
    return;
  }

  const THREE = window.THREE;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    55,
    Math.max(1, els.canvas.clientWidth) / Math.max(1, els.canvas.clientHeight),
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
  renderer.setSize(
    Math.max(1, els.canvas.clientWidth),
    Math.max(1, els.canvas.clientHeight),
    false
  );

  const ambient = new THREE.AmbientLight(0xffffff, 1.4);
  scene.add(ambient);

  const keyLight = new THREE.PointLight(0x00ffae, 2, 12);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);

  const goldLight = new THREE.PointLight(0xffd700, 1.6, 10);
  goldLight.position.set(-3, 2, 4);
  scene.add(goldLight);

  avatarGroup = new THREE.Group();
  avatarGroup.name = "RB_AVATAR_BUILDER_PREVIEW";
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
  head.name = "head";
  head.position.y = 1.25;
  avatarGroup.add(head);

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.45, 16, 32),
    bodyMaterial
  );
  body.name = "body";
  body.position.y = -0.05;
  avatarGroup.add(body);

  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.045, 16, 80),
    goldMaterial
  );
  crown.name = "crown";
  crown.position.y = 2.03;
  crown.rotation.x = Math.PI / 2;
  avatarGroup.add(crown);

  const aura = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.025, 16, 100),
    glowMaterial
  );
  aura.name = "aura";
  aura.position.y = 0.65;
  aura.rotation.x = Math.PI / 2;
  avatarGroup.add(aura);

  const portalRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.85, 0.035, 16, 140),
    glowMaterial
  );
  portalRing.name = "portalRing";
  portalRing.position.z = -0.55;
  avatarGroup.add(portalRing);

  applyAvatarVisualState();
  animateAvatar();
}

function auraColorHex(aura = "green-gold") {
  const key = String(aura || "").toLowerCase();

  if (key.includes("purple")) return 0xa855f7;
  if (key.includes("blue")) return 0x38bdf8;
  if (key.includes("red")) return 0xff3131;
  if (key.includes("gold")) return 0xfacc15;

  return 0x00ffae;
}

function applyAvatarVisualState() {
  if (!avatarGroup || !window.THREE) return;

  const settings = avatarSettings();
  const color = auraColorHex(settings.aura);

  avatarGroup.userData.motion = settings.motion;
  avatarGroup.userData.outfit = settings.outfit;
  avatarGroup.userData.aura = settings.aura;

  avatarGroup.traverse((child) => {
    if (!child?.material) return;

    if (child.name === "aura" || child.name === "portalRing") {
      child.material.color.setHex(color);
      child.material.emissive?.setHex?.(color);
    }

    if (child.name === "body" || child.name === "head") {
      if (settings.outfit === "gold-boss") {
        child.material.color.setHex(0x141006);
        child.material.emissive?.setHex?.(0x3d2c00);
      } else if (settings.outfit === "midnight") {
        child.material.color.setHex(0x020617);
        child.material.emissive?.setHex?.(0x0f172a);
      } else {
        child.material.color.setHex(0x07130c);
        child.material.emissive?.setHex?.(0x003d25);
      }
    }
  });

  renderXpGauge();
}

function animateAvatar() {
  if (!renderer || !scene || !camera || !avatarGroup) return;

  const t = (performance.now() - clockStart) / 1000;
  const motion = avatarGroup.userData.motion || "idle-float";

  const speed =
    motion === "boss-walk" ? 0.85 :
    motion === "smoke-idle" ? 0.42 :
    0.45;

  const float =
    motion === "boss-walk" ? Math.sin(t * 2.4) * 0.045 :
    motion === "smoke-idle" ? Math.sin(t * 0.8) * 0.06 :
    Math.sin(t * 1.3) * 0.08;

  avatarGroup.rotation.y = Math.sin(t * speed) * 0.28;
  avatarGroup.position.y = float;

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

  const width = Math.max(1, els.canvas.clientWidth || window.innerWidth);
  const height = Math.max(1, els.canvas.clientHeight || window.innerHeight);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function resetAvatarView() {
  if (!avatarGroup) return;

  avatarGroup.rotation.set(0, 0, 0);
  avatarGroup.position.set(0, 0, 0);
  clockStart = performance.now();

  setStatus("view reset");
}

/* =========================
   EVENTS + CLEANUP
========================= */

function bindAvatarActions() {
  els.syncBtn?.addEventListener("click", async () => {
    try {
      setStatus("syncing...");
      await syncAvatarToMeta();
      setStatus("synced");
    } catch (error) {
      console.error("[avatar sync failed]", error);
      setStatus("sync failed");
    }
  });

  els.resetBtn?.addEventListener("click", resetAvatarView);

  els.metaBtn?.addEventListener("click", () => {
    window.location.href = RB_ROUTES.meta || "/meta";
  });

  els.profileBtn?.addEventListener("click", () => {
    window.location.href = buildProfileUrl(currentProfile) || RB_ROUTES.profile || "/profile";
  });

  [els.auraInput, els.motionInput, els.outfitInput]
    .filter(Boolean)
    .forEach((input) => {
      input.addEventListener("change", () => {
        applyAvatarVisualState();
        setStatus("unsaved changes");
      });
    });

  window.addEventListener("resize", resizeAvatarScene);
}

function cleanupAvatarPage() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;

  window.removeEventListener("resize", resizeAvatarScene);

  if (scene) {
    scene.traverse((obj) => {
      obj.geometry?.dispose?.();

      if (Array.isArray(obj.material)) {
        obj.material.forEach((mat) => mat?.dispose?.());
      } else {
        obj.material?.dispose?.();
      }
    });
  }

  renderer?.dispose?.();

  scene = null;
  camera = null;
  renderer = null;
  avatarGroup = null;
}

/* =========================
   BOOT
========================= */

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
