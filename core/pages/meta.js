import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://xfsrqomsiulswbalgknx.supabase.co";
const SUPABASE_KEY = "sb_publishable_pW8c7eWAX1GPi5HbncKjpg_CicEceV8";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const $ = (id) => document.getElementById(id);

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

let currentUser = null;
let currentProfile = null;
let currentAvatar = null;
let worlds = [];
let rooms = [];

const fallbackAvatar = "/images/brand/project-avatar.png.jpeg";
const fallbackBanner = "/images/brand/Avatar-hero-Banner.png.jpeg";

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
  target.innerHTML = `<div class="rb-empty">${message}</div>`;
}

function getDisplayName(profile) {
  return (
    profile?.display_name ||
    profile?.username ||
    profile?.full_name ||
    "Rich Bizness Member"
  );
}

async function boot() {
  await loadSession();
  await loadProfile();
  await loadAvatar();
  await loadWorlds();
  await loadRooms();
  bindEvents();
  bindRealtime();
}

async function loadSession() {
  const { data } = await supabase.auth.getSession();
  currentUser = data?.session?.user || null;
}

async function loadProfile() {
  if (!currentUser) {
    els.metaUserName.textContent = "Guest";
    els.heroName.textContent = "Guest Traveler";
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error(error);
    return;
  }

  currentProfile = data;

  const avatar = clean(data?.avatar_url, fallbackAvatar);
  const name = getDisplayName(data);

  els.metaUserAvatar.src = avatar;
  els.heroAvatar.src = avatar;
  els.metaUserName.textContent = name;
  els.heroName.textContent = name;
  els.heroRank.textContent = `${clean(data?.rank_title, "Member")} • Level ${clean(data?.rich_level, 1)}`;
}

async function loadAvatar() {
  if (!currentUser) return;

  const { data, error } = await supabase
    .from("meta_avatars")
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  currentAvatar = data;

  if (data) {
    els.heroAvatar.src = clean(data.avatar_url, currentProfile?.avatar_url || fallbackAvatar);
    els.heroName.textContent = clean(data.display_name, getDisplayName(currentProfile));
    els.heroRank.textContent = `${clean(data.rank, "Traveler")} • Level ${clean(data.level, 1)}`;
  }
}

async function syncAvatar() {
  if (!currentUser) {
    alert("Sign in first.");
    return;
  }

  const payload = {
    user_id: currentUser.id,
    display_name: getDisplayName(currentProfile),
    avatar_url: clean(currentProfile?.avatar_url, fallbackAvatar),
    aura: "green-gold",
    rank: clean(currentProfile?.rank_title, "Traveler"),
    level: clean(currentProfile?.rich_level, 1),
    is_active: true,
    metadata: {
      source: "Rich Bizness Meta",
      synced_from: "profiles"
    }
  };

  const { error } = await supabase
    .from("meta_avatars")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  await loadAvatar();
}

async function loadWorlds() {
  let query = supabase
    .from("meta_worlds")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const filter = els.worldFilter?.value || "all";

  if (filter !== "all") {
    query = query.eq("world_type", filter);
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    setEmpty(els.worldGrid, "Worlds could not load.");
    return;
  }

  worlds = data || [];
  els.worldCount.textContent = formatNumber(worlds.length);

  renderWorlds();
}

function renderWorlds() {
  if (!worlds.length) {
    setEmpty(els.worldGrid, "No Meta worlds yet.");
    return;
  }

  els.worldGrid.innerHTML = worlds
    .map((world) => {
      const cover = clean(world.cover_url || world.background_url, fallbackBanner);
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
    .from("meta_rooms")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error(error);
    setEmpty(els.roomGrid, "Rooms could not load.");
    return;
  }

  rooms = data || [];
  els.roomCount.textContent = formatNumber(rooms.length);
  renderRooms();
}

function renderRooms() {
  if (!rooms.length) {
    setEmpty(els.roomGrid, "No active rooms yet.");
    return;
  }

  els.roomGrid.innerHTML = rooms
    .map((room) => {
      const cover = clean(room.cover_url, fallbackBanner);
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

  if (!currentUser) {
    alert("Sign in first.");
    return;
  }

  const title = els.worldTitle.value.trim();
  const slug = slugify(els.worldSlug.value || title);

  if (!title || !slug) {
    alert("World title and slug required.");
    return;
  }

  const payload = {
    owner_id: currentUser.id,
    title,
    slug,
    description: els.worldDescription.value.trim(),
    world_type: els.worldType.value,
    access_type: els.worldAccess.value,
    cover_url: els.worldCover.value.trim() || null,
    background_url: els.worldBackground.value.trim() || null,
    status: "active",
    entry_route: "/meta.html",
    theme: "rich-bizness",
    visual_style: "cinematic-portal",
    metadata: {
      source: "Rich Bizness Meta",
      created_from: "meta.html"
    }
  };

  const { error } = await supabase.from("meta_worlds").insert(payload);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  els.worldForm.reset();
  await loadWorlds();
}

async function enterWorld(worldId) {
  const world = worlds.find((item) => item.id === worldId);
  if (!world) return;

  if (currentUser) {
    await supabase.from("meta_visits").insert({
      world_id: world.id,
      user_id: currentUser.id,
      username: currentProfile?.username || null,
      display_name: getDisplayName(currentProfile),
      metadata: {
        source: "meta.html",
        action: "enter_world"
      }
    });
  }

  if (world.entry_route && world.entry_route !== "/meta.html") {
    window.location.href = world.entry_route;
    return;
  }

  alert(`Entering ${world.title}`);
}

async function createRoom(worldId) {
  if (!currentUser) {
    alert("Sign in first.");
    return;
  }

  const world = worlds.find((item) => item.id === worldId);
  if (!world) return;

  const payload = {
    world_id: world.id,
    owner_id: currentUser.id,
    title: `${world.title} Lounge`,
    room_type: world.world_type === "gaming" ? "gaming" : "social",
    status: "open",
    max_members: 50,
    active_members: 1,
    cover_url: world.cover_url || world.background_url || null,
    metadata: {
      source: "meta.html",
      parent_world: world.title
    }
  };

  const { error } = await supabase.from("meta_rooms").insert(payload);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  await loadRooms();
}

function bindEvents() {
  els.createAvatarBtn?.addEventListener("click", syncAvatar);

  els.refreshMetaBtn?.addEventListener("click", async () => {
    await loadProfile();
    await loadAvatar();
    await loadWorlds();
    await loadRooms();
  });

  els.createWorldBtn?.addEventListener("click", () => {
    els.worldTitle?.focus();
  });

  els.worldForm?.addEventListener("submit", createWorld);

  els.worldTitle?.addEventListener("input", () => {
    if (!els.worldSlug.value.trim()) {
      els.worldSlug.value = slugify(els.worldTitle.value);
    }
  });

  els.worldFilter?.addEventListener("change", loadWorlds);

  document.addEventListener("click", async (event) => {
    const enterBtn = event.target.closest("[data-enter-world]");
    const roomBtn = event.target.closest("[data-create-room]");

    if (enterBtn) {
      await enterWorld(enterBtn.dataset.enterWorld);
    }

    if (roomBtn) {
      await createRoom(roomBtn.dataset.createRoom);
    }
  });
}

function bindRealtime() {
  supabase
    .channel("rich-meta-worlds")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "meta_worlds" },
      loadWorlds
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "meta_rooms" },
      loadRooms
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "meta_visits" },
      async () => {
        els.visitCount.textContent = String(Number(els.visitCount.textContent || 0) + 1);
      }
    )
    .subscribe();
}

boot();
