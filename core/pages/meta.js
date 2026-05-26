/* =========================
   RICH BIZNESS MOBILE
   /core/pages/meta.js

   Meta Page
   Profile Keys Locked
   Avatar Sync Locked
   Realtime Enabled
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
  RB_ROUTES
} from "/core/shared/rb-config.js";

import {
  getProfileIdentity,
  bindProfileShell,
  buildProfileUrl,
  profileAvatar,
  profileName
} from "/core/shared/rb-profile.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_AVATAR = "/images/brand/hero-banner.png";
const DEFAULT_BANNER = "/images/brand/Avatar-hero-Banner.png.jpeg";

const els = {
  metaUserAvatar: $("metaUserAvatar"),
  metaUserName: $("metaUserName"),
  heroAvatar: $("heroAvatar"),
  heroName: $("heroName"),
  heroRank: $("heroRank"),

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

function clean(value, fallback = "") {
  return value === null || value === undefined || value === "" ? fallback : value;
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

function syncIdentityFromApp() {
  const state = getCurrentUserState?.() || {};
  currentUser = state.user || null;
  currentProfile = state.profile || null;
  profileIdentity = getProfileIdentity(currentProfile);
}

function lockProfileKeys() {
  syncIdentityFromApp();

  document.body.dataset.rbRoute = "meta";
  document.body.dataset.rbUserId = currentUser?.id || "";
  document.body.dataset.rbProfileId = profileIdentity?.id || "";
  document.body.dataset.rbProfileLocked = profileIdentity?.id ? "true" : "false";

  bindProfileShell();

  document.querySelectorAll("[data-rb-profile-link]").forEach((el) => {
    el.href = buildProfileUrl(currentProfile);
  });
}

function paintProfile() {
  if (!currentUser?.id) {
    if (els.metaUserAvatar) els.metaUserAvatar.src = DEFAULT_AVATAR;
    if (els.heroAvatar) els.heroAvatar.src = DEFAULT_AVATAR;
    if (els.metaUserName) els.metaUserName.textContent = "Guest";
    if (els.heroName) els.heroName.textContent = "Guest Traveler";
    if (els.heroRank) els.heroRank.textContent = "Traveler • Level 1";
    return;
  }

  const avatar = profileAvatar(currentProfile) || DEFAULT_AVATAR;
  const name = profileName(currentProfile);

  if (els.metaUserAvatar) els.metaUserAvatar.src = avatar;
  if (els.heroAvatar) els.heroAvatar.src = avatar;
  if (els.metaUserName) els.metaUserName.textContent = name;
  if (els.heroName) els.heroName.textContent = name;

  if (els.heroRank) {
    els.heroRank.textContent =
      `${clean(currentProfile?.rank_title, "Member")} • Level ${clean(currentProfile?.rich_level, 1)}`;
  }
}

async function loadAvatar() {
  if (!currentUser?.id) return null;

  const { data, error } = await supabase
    .from(RB_TABLES.metaAvatars)
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) throw error;

  currentAvatar = data || null;

  if (currentAvatar) {
    if (els.heroAvatar) {
      els.heroAvatar.src = clean(
        currentAvatar.avatar_url,
        profileAvatar(currentProfile) || DEFAULT_AVATAR
      );
    }

    if (els.heroName) {
      els.heroName.textContent = clean(
        currentAvatar.display_name,
        profileName(currentProfile)
      );
    }

    if (els.heroRank) {
      els.heroRank.textContent =
        `${clean(currentAvatar.rank, "Traveler")} • Level ${clean(currentAvatar.level, 1)}`;
    }
  }

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
    avatar_url: profileAvatar(currentProfile) || DEFAULT_AVATAR,
    model_url: currentAvatar?.model_url || null,
    aura: currentAvatar?.aura || "green-gold",
    rank: clean(currentProfile?.rank_title, "Traveler"),
    level: clean(currentProfile?.rich_level, 1),
    xp: currentAvatar?.xp || 0,
    is_active: true,
    metadata: {
      ...(currentAvatar?.metadata || {}),
      source: "Rich Bizness Meta",
      synced_from: RB_TABLES.profiles,
      profile_locked: true,
      profile_id: currentUser.id
    },
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from(RB_TABLES.metaAvatars)
    .upsert(payload, { onConflict: "user_id" });

  if (error) throw error;

  await loadAvatar();
}

async function loadWorlds() {
  let query = supabase
    .from(RB_TABLES.metaWorlds)
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
  if (!worlds.length) {
    setEmpty(els.worldGrid, "No Meta worlds yet.");
    return;
  }

  els.worldGrid.innerHTML = worlds.map((world) => {
    const cover = clean(world.cover_url || world.background_url, DEFAULT_BANNER);

    return `
      <article class="meta-world-card" data-world-id="${world.id}">
        <div class="world-cover" style="background-image:url('${cover}')">
          <span>${clean(world.world_type, "portal")}</span>
          <strong>${clean(world.access_type, "public")}</strong>
        </div>

        <div class="world-info">
          <h3>${clean(world.title, "Untitled World")}</h3>
          <p>${clean(world.description, "Rich Bizness portal world.")}</p>

          <div class="world-stats">
            <span>👁 ${formatNumber(world.visit_count)}</span>
            <span>💚 ${formatNumber(world.like_count)}</span>
            <span>🚪 ${formatNumber(world.room_count)}</span>
          </div>

          <div class="world-actions">
            <button class="rb-btn small primary" data-enter-world="${world.id}">Enter</button>
            <button class="rb-btn small ghost" data-create-room="${world.id}">Room</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

async function loadRooms() {
  const { data, error } = await supabase
    .from(RB_TABLES.metaRooms)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  rooms = data || [];

  if (els.roomCount) els.roomCount.textContent = formatNumber(rooms.length);

  renderRooms();
}

function renderRooms() {
  if (!rooms.length) {
    setEmpty(els.roomGrid, "No active rooms yet.");
    return;
  }

  els.roomGrid.innerHTML = rooms.map((room) => {
    const cover = clean(room.cover_url, DEFAULT_BANNER);

    return `
      <article class="meta-room-card">
        <img src="${cover}" alt="" />
        <div>
          <h3>${clean(room.title, "Meta Room")}</h3>
          <p>${clean(room.room_type, "social")} • ${clean(room.status, "open")}</p>
          <span>${formatNumber(room.active_members)} / ${formatNumber(room.max_members)} inside</span>
        </div>
      </article>
    `;
  }).join("");
}

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
    cover_url: els.worldCover?.value.trim() || null,
    background_url: els.worldBackground?.value.trim() || null,
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
    .from(RB_TABLES.metaWorlds)
    .insert(payload);

  if (error) throw error;

  els.worldForm?.reset();
  await loadWorlds();
}

async function enterWorld(worldId) {
  const world = worlds.find((item) => String(item.id) === String(worldId));
  if (!world) return;

  if (currentUser?.id) {
    await supabase.from(RB_TABLES.metaVisits).insert({
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
    cover_url: world.cover_url || world.background_url || DEFAULT_BANNER,
    metadata: {
      source: "meta.js",
      parent_world: world.title,
      profile_locked: true,
      profile_id: currentUser.id
    }
  };

  const { error } = await supabase
    .from(RB_TABLES.metaRooms)
    .insert(payload);

  if (error) throw error;

  await loadRooms();
}

function bindEvents() {
  els.createAvatarBtn?.addEventListener("click", syncAvatar);

  els.refreshMetaBtn?.addEventListener("click", async () => {
    lockProfileKeys();
    paintProfile();
    await loadAvatar();
    await loadWorlds();
    await loadRooms();
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
    .on("postgres_changes", { event: "*", schema: "public", table: RB_TABLES.metaWorlds }, loadWorlds)
    .on("postgres_changes", { event: "*", schema: "public", table: RB_TABLES.metaRooms }, loadRooms)
    .on("postgres_changes", { event: "*", schema: "public", table: RB_TABLES.metaAvatars }, loadAvatar)
    .on("postgres_changes", { event: "*", schema: "public", table: RB_TABLES.metaVisits }, () => {
      if (!els.visitCount) return;
      els.visitCount.textContent = String(Number(els.visitCount.textContent || 0) + 1);
    })
    .subscribe();

  window.addEventListener("beforeunload", clearRealtime);
}

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

    bindEvents();
    bindRealtime();

    document.body.classList.add("rb-meta-ready");

    markPageReady("meta");

    console.log("RB META READY", {
      profileLocked: !!profileIdentity?.id,
      route: "meta"
    });
  } catch (error) {
    console.error("[meta.js]", error);
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootMetaPage);
} else {
  bootMetaPage();
}
