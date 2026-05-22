/* =========================
   RICH BIZNESS MOBILE
   /core/pages/meta.js
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
  if (!target) return;
  target.innerHTML = `<div class="rb-empty">${message}</div>`;
}

function getDisplayName(profile) {
  return (
    profile?.display_name ||
    profile?.username ||
    profile?.full_name ||
    currentUser?.email?.split("@")[0] ||
    "Rich Bizness Member"
  );
}

function syncIdentityFromApp() {
  const state = getCurrentUserState();

  currentUser = state?.user || null;
  currentProfile = state?.profile || null;
}

function paintGuest() {
  if (els.metaUserAvatar) els.metaUserAvatar.src = DEFAULT_AVATAR;
  if (els.heroAvatar) els.heroAvatar.src = DEFAULT_AVATAR;
  if (els.metaUserName) els.metaUserName.textContent = "Guest";
  if (els.heroName) els.heroName.textContent = "Guest Traveler";
  if (els.heroRank) els.heroRank.textContent = "Traveler • Level 1";
}

function paintProfile() {
  if (!currentUser) {
    paintGuest();
    return;
  }

  const avatar = clean(currentProfile?.avatar_url, DEFAULT_AVATAR);
  const name = getDisplayName(currentProfile);

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
  if (!currentUser?.id) return;

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
        currentProfile?.avatar_url || DEFAULT_AVATAR
      );
    }

    if (els.heroName) {
      els.heroName.textContent = clean(
        currentAvatar.display_name,
        getDisplayName(currentProfile)
      );
    }

    if (els.heroRank) {
      els.heroRank.textContent =
        `${clean(currentAvatar.rank, "Traveler")} • Level ${clean(currentAvatar.level, 1)}`;
    }
  }
}

async function syncAvatar() {
  if (!currentUser?.id) {
    window.location.href = RB_ROUTES.auth || "/auth";
    return;
  }

  const payload = {
    user_id: currentUser.id,
    display_name: getDisplayName(currentProfile),
    avatar_url: clean(currentProfile?.avatar_url, DEFAULT_AVATAR),
    aura: "green-gold",
    rank: clean(currentProfile?.rank_title, "Traveler"),
    level: clean(currentProfile?.rich_level, 1),
    is_active: true,
    metadata: {
      source: "Rich Bizness Meta",
      synced_from: RB_TABLES.profiles
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

  if (error) {
    console.error("[meta.js worlds]", error);
    setEmpty(els.worldGrid, "Worlds could not load.");
    return;
  }

  worlds = data || [];

  if (els.worldCount) {
    els.worldCount.textContent = formatNumber(worlds.length);
  }

  renderWorlds();
}

function renderWorlds() {
  if (!worlds.length) {
    setEmpty(els.worldGrid, "No Meta worlds yet.");
    return;
  }

  els.worldGrid.innerHTML = worlds
    .map((world) => {
      const cover = clean(world.cover_url || world.background_url, DEFAULT_BANNER);
      const title = clean(world.title, "Untitled World");
      const type = clean(world.world_type, "portal");
      const access = clean(world.access_type, "public");
      const visits = formatNumber(world.visit_count);
      const likes = formatNumber(world.like_count);
      const roomsCount = formatNumber(world.room_count);

      return `
        <article class="meta-world-card" data-world-id="${world.id}">
          <div class="world-cover" style="background-image:url('${cover}')">
            <span>${type}</span>
            <strong>${access}</strong>
          </div>

          <div class="world-info">
            <h3>${title}</h3>
            <p>${clean(world.description, "Rich Bizness portal world.")}</p>

            <div class="world-stats">
              <span>👁 ${visits}</span>
              <span>💚 ${likes}</span>
              <span>🚪 ${roomsCount}</span>
            </div>

            <div class="world-actions">
              <button class="rb-btn small primary" data-enter-world="${world.id}">Enter</button>
              <button class="rb-btn small ghost" data-create-room="${world.id}">Room</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadRooms() {
  const { data, error } = await supabase
    .from(RB_TABLES.metaRooms)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("[meta.js rooms]", error);
    setEmpty(els.roomGrid, "Rooms could not load.");
    return;
  }

  rooms = data || [];

  if (els.roomCount) {
    els.roomCount.textContent = formatNumber(rooms.length);
  }

  renderRooms();
}

function renderRooms() {
  if (!rooms.length) {
    setEmpty(els.roomGrid, "No active rooms yet.");
    return;
  }

  els.roomGrid.innerHTML = rooms
    .map((room) => {
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
    })
    .join("");
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
      app: "Rich Bizness Mobile"
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
      display_name: getDisplayName(currentProfile),
      metadata: {
        source: "meta.js",
        action: "enter_world"
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
      parent_world: world.title
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
    syncIdentityFromApp();
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

function bindRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }

  channel = supabase
    .channel("rich-meta-worlds")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: RB_TABLES.metaWorlds },
      loadWorlds
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: RB_TABLES.metaRooms },
      loadRooms
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: RB_TABLES.metaVisits },
      () => {
        if (!els.visitCount) return;
        els.visitCount.textContent =
          String(Number(els.visitCount.textContent || 0) + 1);
      }
    )
    .subscribe();

  window.addEventListener("beforeunload", () => {
    if (channel) supabase.removeChannel(channel);
  });
}

async function bootMetaPage() {
  try {
    await initApp({
      guard: false,
      bindProfile: true,
      toast: false
    });

    supabase = getSupabase();

    syncIdentityFromApp();
    paintProfile();

    await loadAvatar();
    await loadWorlds();
    await loadRooms();

    bindEvents();
    bindRealtime();

    document.body.classList.add("rb-meta-ready");
    markPageReady("meta");

    console.log("RB META READY");
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
