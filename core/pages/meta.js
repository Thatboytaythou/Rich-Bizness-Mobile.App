/* =========================
   RICH BIZNESS MOBILE
   /core/pages/meta.js

   META PAGE CONTROLLER
   Profile Keys Locked
   Avatar Sync Locked
   Meta World Engine Connected
   Realtime Enabled

   Purpose:
   - Meta is the cinematic world wrapper
   - World districts route into real app pages
   - Real actions stay inside real pages
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import { getSupabase } from "/core/shared/rb-supabase.js";

import {
  RB_TABLES,
  RB_ROUTES,
  RB_MODULES
} from "/core/shared/rb-config.js";

import {
  getProfileIdentity,
  bindProfileShell,
  buildProfileUrl,
  profileAvatar,
  profileName
} from "/core/shared/rb-profile.js";

import {
  createMetaWorldEngine
} from "/core/features/meta/world-engine.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";
const DEFAULT_BANNER = "/images/brand/hero-banner.png";
const DEFAULT_META_AVATAR = "/images/brand/meta-avatar.png.jpeg";

const els = {
  metaUserAvatar: $("metaUserAvatar"),
  metaUserName: $("metaUserName"),
  heroAvatar: $("heroAvatar"),
  heroName: $("heroName"),
  heroRank: $("heroRank"),

  worldStage: $("metaWorldStage") || $("metaWorldCanvas") || $("metaPortalStage"),

  worldCount: $("worldCount"),
  roomCount: $("roomCount"),
  visitCount: $("visitCount"),

  createAvatarBtn: $("createAvatarBtn"),
  createWorldBtn: $("createWorldBtn"),
  refreshMetaBtn: $("refreshMetaBtn"),

  worldForm: $("worldForm"),
  worldTitle: $("worldTitle"),
  worldSlug: $("worldSlug"),
  worldType: $("worldType"),
  worldAccess: $("worldAccess"),
  worldDescription: $("worldDescription"),
  worldCover: $("worldCover"),
  worldBackground: $("worldBackground"),
  worldFilter: $("worldFilter"),

  worldGrid: $("worldGrid"),
  roomGrid: $("roomGrid")
};

let supabase = null;
let currentUser = null;
let currentProfile = null;
let currentAvatar = null;
let profileIdentity = null;

let worlds = [];
let rooms = [];
let channel = null;

let THREERef = window.THREE || null;
let renderer = null;
let scene = null;
let camera = null;
let textureLoader = null;
let metaEngine = null;
let animationId = null;
let worldMounted = false;

function clean(value, fallback = "") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function safePath(value = "", fallback = "") {
  const src = String(value || "").trim();

  if (!src) return fallback;

  if (
    src === "/images/brand/project-avatar.png.jpeg" ||
    src.includes("/project-avatar")
  ) {
    return fallback;
  }

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

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function setEmpty(target, message) {
  if (target) target.innerHTML = `<div class="rb-empty">${message}</div>`;
}

function table(key, fallback) {
  return RB_TABLES?.[key] || fallback || key;
}

function routeFor(key = "") {
  return RB_ROUTES?.[key] || `/${key}`;
}

function isMobile() {
  return window.matchMedia?.("(max-width: 760px)")?.matches || window.innerWidth <= 760;
}

function syncIdentityFromApp() {
  const appState = getCurrentUserState?.() || {};

  currentUser = appState.user || null;
  currentProfile = appState.profile || null;
  profileIdentity = getProfileIdentity(currentProfile);
}

function lockProfileKeys() {
  syncIdentityFromApp();

  document.body.dataset.rbRoute = "meta";
  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = profileIdentity?.id || "";
  document.body.dataset.rbProfileLocked = profileIdentity?.id ? "true" : "false";

  bindProfileShell?.();

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl(currentProfile);
  });
}

function metaAvatarSrc() {
  return safePath(
    currentAvatar?.avatar_url,
    safePath(profileAvatar(currentProfile), DEFAULT_AVATAR)
  );
}

function paintProfile() {
  if (!currentUser?.id) {
    if (els.metaUserAvatar) els.metaUserAvatar.src = DEFAULT_AVATAR;
    if (els.heroAvatar) els.heroAvatar.src = DEFAULT_META_AVATAR;
    if (els.metaUserName) els.metaUserName.textContent = "Guest";
    if (els.heroName) els.heroName.textContent = "Guest Traveler";
    if (els.heroRank) els.heroRank.textContent = "Traveler • Level 1";
    return;
  }

  const avatar = metaAvatarSrc();
  const name = profileName(currentProfile);

  if (els.metaUserAvatar) els.metaUserAvatar.src = safePath(profileAvatar(currentProfile), DEFAULT_AVATAR);
  if (els.heroAvatar) els.heroAvatar.src = avatar;
  if (els.metaUserName) els.metaUserName.textContent = name;
  if (els.heroName) els.heroName.textContent = clean(currentAvatar?.display_name, name);

  if (els.heroRank) {
    els.heroRank.textContent =
      `${clean(currentAvatar?.rank || currentProfile?.rank_title, "Traveler")} • Level ${clean(currentAvatar?.level || currentProfile?.rich_level, 1)}`;
  }
}

/* =========================
   META WORLD ENGINE
========================= */

function metaModules() {
  const fallbackModules = [
    { key: "profile", title: "Profile", tag: "ME", route: routeFor("profile"), image: DEFAULT_AVATAR },
    { key: "watch", title: "Watch", tag: "TV", route: routeFor("watch"), image: "/images/brand/omni-watch.png.jpeg" },
    { key: "gallery", title: "Gallery", tag: "ART", route: routeFor("gallery"), image: "/images/brand/background-v2.png.jpeg" },
    { key: "live", title: "Live", tag: "LIVE", route: routeFor("live"), image: DEFAULT_BANNER },
    { key: "music", title: "Music", tag: "MUSIC", route: routeFor("music"), image: "/images/brand/music-log.png.jpeg" },
    { key: "gaming", title: "Gaming", tag: "GAME", route: routeFor("gaming"), image: "/images/brand/gaming-hero.png.jpeg" },
    { key: "sports", title: "Sports", tag: "SPORT", route: routeFor("sports"), image: "/images/brand/sports-logo.png.jpeg" },
    { key: "store", title: "Store", tag: "SHOP", route: routeFor("store"), image: DEFAULT_BANNER },
    { key: "upload", title: "Upload", tag: "DROP", route: routeFor("upload"), image: DEFAULT_BANNER },
    { key: "meta", title: "Meta", tag: "META", route: routeFor("meta"), image: DEFAULT_META_AVATAR }
  ];

  const source = Array.isArray(RB_MODULES) && RB_MODULES.length
    ? RB_MODULES
    : fallbackModules;

  return source
    .filter((mod) =>
      [
        "gallery",
        "live",
        "music",
        "gaming",
        "sports",
        "store",
        "upload",
        "meta",
        "watch",
        "profile"
      ].includes(mod.key)
    )
    .map((mod) => ({
      key: mod.key,
      title: mod.title || mod.label || mod.key,
      tag: mod.tag || mod.icon || mod.key,
      route: mod.route || routeFor(mod.key),
      image: safePath(mod.image || mod.cover || mod.thumbnail || "", fallbackModules.find((item) => item.key === mod.key)?.image || DEFAULT_BANNER)
    }));
}

async function ensureThree() {
  if (THREERef) return THREERef;

  if (window.THREE) {
    THREERef = window.THREE;
    return THREERef;
  }

  await import("https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js");

  THREERef = window.THREE || null;
  return THREERef;
}

async function mountWorldEngine() {
  if (!els.worldStage || worldMounted) return;

  const THREE = await ensureThree();

  if (!THREE) {
    console.warn("[RB META WORLD] THREE not available.");
    return;
  }

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    45,
    els.worldStage.clientWidth / Math.max(1, els.worldStage.clientHeight),
    0.1,
    1000
  );

  camera.position.set(0, 1.2, 8.8);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(els.worldStage.clientWidth, els.worldStage.clientHeight);
  renderer.domElement.className = "rb-meta-world-canvas";
  renderer.domElement.setAttribute("aria-label", "Rich Bizness Meta World");
  renderer.domElement.setAttribute("role", "img");

  els.worldStage.innerHTML = "";
  els.worldStage.appendChild(renderer.domElement);

  textureLoader = new THREE.TextureLoader();

  const ambient = new THREE.AmbientLight(0xffffff, 1.15);
  scene.add(ambient);

  const point = new THREE.PointLight(0x00ff9d, 1.5, 80);
  point.position.set(0, 4, 6);
  scene.add(point);

  metaEngine = createMetaWorldEngine(
    {
      THREE,
      scene,
      camera,
      textureLoader,
      modules: metaModules(),
      activityState: {
        liveActive: worlds.some((world) => world.world_type === "live" || world.status === "active"),
        avatarReady: Boolean(currentAvatar?.id),
        xp: Number(currentAvatar?.xp || currentProfile?.rich_points || 0)
      },
      isMobile
    },
    {
      mode: "full"
    }
  );

  metaEngine.mount();
  metaEngine.resize();

  renderer.domElement.addEventListener("pointermove", metaEngine.onPointerMove);
  renderer.domElement.addEventListener("pointerdown", metaEngine.onPointerDown);
  renderer.domElement.addEventListener("pointerup", metaEngine.onPointerUp);

  window.addEventListener("resize", resizeWorldEngine);

  worldMounted = true;
  animateWorldEngine();
}

function animateWorldEngine() {
  if (!renderer || !scene || !camera || !metaEngine) return;

  const tick = (time = 0) => {
    const t = time / 1000;

    metaEngine.update(t);
    renderer.render(scene, camera);

    animationId = window.requestAnimationFrame(tick);
  };

  animationId = window.requestAnimationFrame(tick);
}

function resizeWorldEngine() {
  if (!renderer || !camera || !els.worldStage || !metaEngine) return;

  const width = Math.max(1, els.worldStage.clientWidth);
  const height = Math.max(1, els.worldStage.clientHeight);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  metaEngine.resize();
}

function destroyWorldEngine() {
  if (animationId) {
    window.cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (renderer?.domElement && metaEngine) {
    renderer.domElement.removeEventListener("pointermove", metaEngine.onPointerMove);
    renderer.domElement.removeEventListener("pointerdown", metaEngine.onPointerDown);
    renderer.domElement.removeEventListener("pointerup", metaEngine.onPointerUp);
  }

  window.removeEventListener("resize", resizeWorldEngine);

  metaEngine?.destroy?.();
  metaEngine = null;

  renderer?.dispose?.();

  if (renderer?.domElement?.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  renderer = null;
  scene = null;
  camera = null;
  textureLoader = null;
  worldMounted = false;
}

async function routeFromWorld(event) {
  const detail = event?.detail || {};
  const key = detail.key;
  const route = detail.route || routeFor(key);

  if (!key || key === "meta") {
    metaEngine?.focusDistrict?.("meta");
    return;
  }

  await trackMetaAction({
    action: "district_enter",
    target: key,
    route
  });

  window.location.href = route;
}

async function trackMetaAction({
  action = "meta_action",
  target = "meta",
  route = RB_ROUTES?.meta || "/meta"
} = {}) {
  if (!currentUser?.id || !supabase) return;

  await supabase
    .from(table("metaVisits", "meta_visits"))
    .insert({
      world_id: null,
      user_id: currentUser.id,
      username: currentProfile?.username || null,
      display_name: profileName(currentProfile),
      metadata: {
        source: "meta.js",
        action,
        target,
        route,
        profile_locked: true
      }
    })
    .then(({ error }) => {
      if (error) console.warn("[RB META TRACK WARNING]", error.message);
    });
}

/* =========================
   DATA
========================= */

async function loadAvatar() {
  if (!currentUser?.id) return null;

  const { data, error } = await supabase
    .from(table("metaAvatars", "meta_avatars"))
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) throw error;

  currentAvatar = data || null;
  paintProfile();

  return currentAvatar;
}

async function syncAvatar() {
  if (!currentUser?.id) {
    window.location.href = RB_ROUTES.auth || "/auth";
    return;
  }

  const payload = {
    user_id: currentUser.id,
    display_name: profileName(currentProfile),
    avatar_url: safePath(profileAvatar(currentProfile), DEFAULT_AVATAR),
    model_url: currentAvatar?.model_url || null,
    aura: currentAvatar?.aura || "green-gold",
    rank: clean(currentProfile?.rank_title, "Traveler"),
    level: clean(currentProfile?.rich_level, 1),
    xp: currentAvatar?.xp || currentProfile?.rich_points || 0,
    is_active: true,
    metadata: {
      ...(currentAvatar?.metadata || {}),
      source: "Rich Bizness Meta",
      synced_from: table("profiles", "profiles"),
      profile_locked: true,
      profile_id: currentUser.id
    },
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from(table("metaAvatars", "meta_avatars"))
    .upsert(payload, { onConflict: "user_id" });

  if (error) throw error;

  await loadAvatar();
}

async function loadWorlds() {
  let query = supabase
    .from(table("metaWorlds", "meta_worlds"))
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const filter = els.worldFilter?.value || "all";

  if (filter !== "all") {
    query = query.eq("world_type", filter);
  }

  const { data, error } = await query;

  if (error) throw error;

  worlds = data || [];

  if (els.worldCount) els.worldCount.textContent = formatNumber(worlds.length);

  renderWorlds();
}

function renderWorlds() {
  if (!els.worldGrid) return;

  if (!worlds.length) {
    setEmpty(els.worldGrid, "No Meta worlds yet.");
    return;
  }

  els.worldGrid.innerHTML = worlds
    .map((world) => {
      const cover = safePath(world.cover_url || world.background_url, DEFAULT_BANNER);

      return `
        <article class="meta-world-card" data-world-id="${world.id}">
          <div class="world-cover" style="background-image:url('${escapeHtml(cover)}')">
            <span>${escapeHtml(clean(world.world_type, "portal"))}</span>
            <strong>${escapeHtml(clean(world.access_type, "public"))}</strong>
          </div>

          <div class="world-info">
            <h3>${escapeHtml(clean(world.title, "Untitled World"))}</h3>
            <p>${escapeHtml(clean(world.description, "Rich Bizness portal world."))}</p>

            <div class="world-stats">
              <span>👁 ${formatNumber(world.visit_count)}</span>
              <span>💚 ${formatNumber(world.like_count)}</span>
              <span>🚪 ${formatNumber(world.room_count)}</span>
            </div>

            <div class="world-actions">
              <button class="rb-btn small primary" data-enter-world="${world.id}" type="button">Enter</button>
              <button class="rb-btn small ghost" data-create-room="${world.id}" type="button">Room</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadRooms() {
  const { data, error } = await supabase
    .from(table("metaRooms", "meta_rooms"))
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  rooms = data || [];

  if (els.roomCount) els.roomCount.textContent = formatNumber(rooms.length);

  renderRooms();
}

function renderRooms() {
  if (!els.roomGrid) return;

  if (!rooms.length) {
    setEmpty(els.roomGrid, "No active rooms yet.");
    return;
  }

  els.roomGrid.innerHTML = rooms
    .map((room) => {
      const cover = safePath(room.cover_url, DEFAULT_BANNER);

      return `
        <article class="meta-room-card">
          <img src="${escapeHtml(cover)}" alt="" loading="lazy" />
          <div>
            <h3>${escapeHtml(clean(room.title, "Meta Room"))}</h3>
            <p>${escapeHtml(clean(room.room_type, "social"))} • ${escapeHtml(clean(room.status, "open"))}</p>
            <span>${formatNumber(room.active_members)} / ${formatNumber(room.max_members)} inside</span>
          </div>
        </article>
      `;
    })
    .join("");
}

/* =========================
   ACTIONS
========================= */

async function createWorld(event) {
  event.preventDefault();

  if (!currentUser?.id) {
    window.location.href = RB_ROUTES.auth || "/auth";
    return;
  }

  const title = els.worldTitle?.value.trim();
  const slug = slugify(els.worldSlug?.value || title);

  if (!title || !slug) {
    alert("World title and slug required.");
    return;
  }

  const payload = {
    owner_id: currentUser.id,
    title,
    slug,
    description: els.worldDescription?.value.trim() || null,
    world_type: els.worldType?.value || "portal",
    access_type: els.worldAccess?.value || "public",
    cover_url: safePath(els.worldCover?.value.trim() || "", null),
    background_url: safePath(els.worldBackground?.value.trim() || "", null),
    status: "active",
    entry_route: RB_ROUTES.meta || "/meta",
    theme: "rich-bizness",
    visual_style: "cinematic-portal",
    metadata: {
      source: "meta.js",
      app: "Rich Bizness Mobile",
      profile_locked: true,
      profile_id: currentUser.id,
      username: currentProfile?.username || null,
      display_name: profileName(currentProfile)
    }
  };

  const { error } = await supabase
    .from(table("metaWorlds", "meta_worlds"))
    .insert(payload);

  if (error) throw error;

  els.worldForm?.reset();

  await trackMetaAction({
    action: "create_world",
    target: slug,
    route: RB_ROUTES.meta || "/meta"
  });

  await loadWorlds();
}

async function enterWorld(worldId) {
  const world = worlds.find((item) => String(item.id) === String(worldId));
  if (!world) return;

  if (currentUser?.id) {
    await supabase.from(table("metaVisits", "meta_visits")).insert({
      world_id: world.id,
      user_id: currentUser.id,
      username: currentProfile?.username || null,
      display_name: profileName(currentProfile),
      metadata: {
        source: "meta.js",
        action: "enter_world",
        profile_locked: true
      }
    });
  }

  if (world.entry_route && world.entry_route !== (RB_ROUTES.meta || "/meta")) {
    window.location.href = world.entry_route;
    return;
  }

  if (metaEngine && world.world_type) {
    metaEngine.focusDistrict(world.world_type);
  }

  alert(`Entering ${world.title}`);
}

async function createRoom(worldId) {
  if (!currentUser?.id) {
    window.location.href = RB_ROUTES.auth || "/auth";
    return;
  }

  const world = worlds.find((item) => String(item.id) === String(worldId));
  if (!world) return;

  const payload = {
    world_id: world.id,
    owner_id: currentUser.id,
    title: `${world.title} Lounge`,
    room_type: world.world_type === "gaming" ? "gaming" : "social",
    status: "open",
    max_members: 50,
    active_members: 1,
    cover_url: safePath(world.cover_url || world.background_url, DEFAULT_BANNER),
    metadata: {
      source: "meta.js",
      parent_world: world.title,
      profile_locked: true,
      profile_id: currentUser.id
    }
  };

  const { error } = await supabase
    .from(table("metaRooms", "meta_rooms"))
    .insert(payload);

  if (error) throw error;

  await trackMetaAction({
    action: "create_room",
    target: world.slug || world.title,
    route: RB_ROUTES.meta || "/meta"
  });

  await loadRooms();
}

/* =========================
   EVENTS
========================= */

function bindEvents() {
  els.createAvatarBtn?.addEventListener("click", syncAvatar);

  els.refreshMetaBtn?.addEventListener("click", async () => {
    lockProfileKeys();
    paintProfile();
    await loadAvatar();
    await loadWorlds();
    await loadRooms();
    resizeWorldEngine();
  });

  els.createWorldBtn?.addEventListener("click", () => {
    els.worldTitle?.focus();
  });

  els.worldForm?.addEventListener("submit", createWorld);

  els.worldTitle?.addEventListener("input", () => {
    if (els.worldSlug && !els.worldSlug.value.trim()) {
      els.worldSlug.value = slugify(els.worldTitle.value);
    }
  });

  els.worldFilter?.addEventListener("change", loadWorlds);

  document.addEventListener("click", async (event) => {
    const enterBtn = event.target.closest("[data-enter-world]");
    const roomBtn = event.target.closest("[data-create-room]");

    if (enterBtn) await enterWorld(enterBtn.dataset.enterWorld);
    if (roomBtn) await createRoom(roomBtn.dataset.createRoom);
  });

  window.addEventListener("rb:module-select", routeFromWorld);
}

function clearRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

function bindRealtime() {
  clearRealtime();

  channel = supabase
    .channel("rich-meta-worlds")
    .on("postgres_changes", { event: "*", schema: "public", table: table("metaWorlds", "meta_worlds") }, loadWorlds)
    .on("postgres_changes", { event: "*", schema: "public", table: table("metaRooms", "meta_rooms") }, loadRooms)
    .on("postgres_changes", { event: "*", schema: "public", table: table("metaAvatars", "meta_avatars") }, loadAvatar)
    .on("postgres_changes", { event: "*", schema: "public", table: table("metaVisits", "meta_visits") }, () => {
      if (!els.visitCount) return;
      els.visitCount.textContent = String(Number(els.visitCount.textContent || 0) + 1);
    })
    .subscribe();
}

/* =========================
   BOOT
========================= */

async function bootMetaPage() {
  try {
    await initApp({
      guard: false,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    lockProfileKeys();
    paintProfile();

    await loadAvatar();
    await loadWorlds();
    await loadRooms();

    await mountWorldEngine();

    bindEvents();
    bindRealtime();

    document.body.classList.add("rb-meta-ready");

    markPageReady("meta");

    console.log("RB META READY", {
      profileLocked: Boolean(profileIdentity?.id),
      route: "meta",
      worldEngine: Boolean(metaEngine)
    });
  } catch (error) {
    console.error("[meta.js]", error);
    markPageError(error);
  }
}

function shutdownMetaPage() {
  clearRealtime();
  destroyWorldEngine();
  window.removeEventListener("rb:module-select", routeFromWorld);
}

window.addEventListener("beforeunload", shutdownMetaPage);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootMetaPage);
} else {
  bootMetaPage();
}
