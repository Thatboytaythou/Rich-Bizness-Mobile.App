/* =========================
   RICH BIZNESS MOBILE
   /core/features/meta/meta-state.js

   META STATE ENGINE
   Avatars + Worlds + Portal Sync
========================= */

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser
} from "/core/shared/rb-supabase.js";

const META_STATE = {
  ready: false,
  loading: false,
  avatar: null,
  myAvatar: null,
  avatars: [],
  worlds: [],
  featuredWorld: null,
  activeWorld: null,
  portalStatus: "offline",
  error: null,
  channel: null,
  listeners: new Set()
};

function emitMetaState() {
  const state = getMetaState();

  META_STATE.listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      console.warn("[RB META STATE LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb:meta-state", {
      detail: state
    })
  );
}

function normalizeAvatar(row = {}) {
  return {
    ...row,
    display_name:
      row.display_name ||
      row.username ||
      row.metadata?.display_name ||
      "Rich Avatar",
    username:
      row.username ||
      row.metadata?.username ||
      "rich_avatar",
    avatar_url:
      row.avatar_url ||
      row.image_url ||
      row.metadata?.avatar_url ||
      "/images/brand/Avatar-hero-Banner.png.jpeg",
    aura:
      row.aura ||
      row.metadata?.aura ||
      "smoke-cloud",
    presence_state:
      row.presence_state ||
      row.status ||
      "idle",
    level: Number(row.level || row.rich_level || 1),
    avatar_config: row.avatar_config || row.config || {}
  };
}

function normalizeWorld(row = {}) {
  return {
    ...row,
    title:
      row.title ||
      row.name ||
      row.world_name ||
      "Rich Bizness World",
    description:
      row.description ||
      row.summary ||
      "Meta world inside the Rich Bizness universe.",
    world_url:
      row.world_url ||
      row.url ||
      row.scene_url ||
      row.media_url ||
      "",
    cover_url:
      row.cover_url ||
      row.thumbnail_url ||
      row.image_url ||
      "/images/brand/hero-banner.png",
    status:
      row.status ||
      "active",
    visibility:
      row.visibility ||
      "public",
    is_featured: Boolean(row.is_featured)
  };
}

export function getMetaState() {
  return {
    ready: META_STATE.ready,
    loading: META_STATE.loading,
    avatar: META_STATE.avatar,
    myAvatar: META_STATE.myAvatar,
    avatars: [...META_STATE.avatars],
    worlds: [...META_STATE.worlds],
    featuredWorld: META_STATE.featuredWorld,
    activeWorld: META_STATE.activeWorld,
    portalStatus: META_STATE.portalStatus,
    error: META_STATE.error
  };
}

export function onMetaState(listener) {
  if (typeof listener !== "function") return () => {};

  META_STATE.listeners.add(listener);

  try {
    listener(getMetaState());
  } catch (error) {
    console.warn("[RB META STATE LISTENER]", error);
  }

  return () => {
    META_STATE.listeners.delete(listener);
  };
}

export function setMetaLoading(value = true) {
  META_STATE.loading = Boolean(value);
  emitMetaState();
}

export function setMetaReady(value = true) {
  META_STATE.ready = Boolean(value);
  emitMetaState();
}

export function setMetaError(error = null) {
  META_STATE.error = error;
  META_STATE.loading = false;
  emitMetaState();
}

export function setActiveMetaAvatar(avatar = null) {
  META_STATE.avatar = avatar ? normalizeAvatar(avatar) : null;
  META_STATE.myAvatar = META_STATE.avatar;
  emitMetaState();

  return META_STATE.avatar;
}

export function setMetaAvatars(avatars = []) {
  META_STATE.avatars = Array.isArray(avatars)
    ? avatars.map(normalizeAvatar)
    : [];

  const user = getUser();

  META_STATE.myAvatar =
    META_STATE.avatars.find((item) => item.user_id === user?.id) ||
    META_STATE.myAvatar ||
    null;

  META_STATE.avatar = META_STATE.myAvatar || META_STATE.avatars[0] || null;

  emitMetaState();

  return META_STATE.avatars;
}

export function upsertMetaAvatar(avatar) {
  if (!avatar) return null;

  const item = normalizeAvatar(avatar);
  const key = item.id || item.user_id;

  const index = META_STATE.avatars.findIndex((row) => {
    return row.id === key || row.user_id === item.user_id;
  });

  if (index >= 0) {
    META_STATE.avatars[index] = {
      ...META_STATE.avatars[index],
      ...item
    };
  } else {
    META_STATE.avatars.unshift(item);
  }

  const user = getUser();

  if (item.user_id === user?.id) {
    META_STATE.myAvatar = item;
    META_STATE.avatar = item;
  }

  emitMetaState();

  return item;
}

export function removeMetaAvatar(id) {
  META_STATE.avatars = META_STATE.avatars.filter((item) => {
    return item.id !== id && item.user_id !== id;
  });

  if (META_STATE.avatar?.id === id || META_STATE.avatar?.user_id === id) {
    META_STATE.avatar = META_STATE.myAvatar || META_STATE.avatars[0] || null;
  }

  emitMetaState();
}

export function setMetaWorlds(worlds = []) {
  META_STATE.worlds = Array.isArray(worlds)
    ? worlds.map(normalizeWorld)
    : [];

  META_STATE.featuredWorld =
    META_STATE.worlds.find((world) => world.is_featured) ||
    META_STATE.worlds[0] ||
    null;

  META_STATE.activeWorld =
    META_STATE.activeWorld ||
    META_STATE.featuredWorld ||
    null;

  emitMetaState();

  return META_STATE.worlds;
}

export function setActiveMetaWorld(world = null) {
  META_STATE.activeWorld = world ? normalizeWorld(world) : null;
  emitMetaState();

  return META_STATE.activeWorld;
}

export function upsertMetaWorld(world) {
  if (!world) return null;

  const item = normalizeWorld(world);
  const key = item.id || item.slug || item.title;

  const index = META_STATE.worlds.findIndex((row) => {
    return row.id === key || row.slug === item.slug;
  });

  if (index >= 0) {
    META_STATE.worlds[index] = {
      ...META_STATE.worlds[index],
      ...item
    };
  } else {
    META_STATE.worlds.unshift(item);
  }

  if (item.is_featured) {
    META_STATE.featuredWorld = item;
  }

  if (!META_STATE.activeWorld) {
    META_STATE.activeWorld = item;
  }

  emitMetaState();

  return item;
}

export function removeMetaWorld(id) {
  META_STATE.worlds = META_STATE.worlds.filter((item) => item.id !== id);

  if (META_STATE.activeWorld?.id === id) {
    META_STATE.activeWorld =
      META_STATE.featuredWorld ||
      META_STATE.worlds[0] ||
      null;
  }

  if (META_STATE.featuredWorld?.id === id) {
    META_STATE.featuredWorld =
      META_STATE.worlds.find((world) => world.is_featured) ||
      META_STATE.worlds[0] ||
      null;
  }

  emitMetaState();
}

export function setMetaPortalStatus(status = "offline") {
  META_STATE.portalStatus = String(status || "offline");
  emitMetaState();

  return META_STATE.portalStatus;
}

export async function loadMyMetaAvatar(userId = null) {
  const user = getUser();
  const id = userId || user?.id;

  if (!id || !RB_TABLES.metaAvatars) return null;

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.metaAvatars)
    .select("*")
    .eq("user_id", id)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    setActiveMetaAvatar(data);
  }

  return data ? normalizeAvatar(data) : null;
}

export async function loadMetaAvatars({
  limit = 40
} = {}) {
  if (!RB_TABLES.metaAvatars) {
    setMetaAvatars([]);
    return [];
  }

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.metaAvatars)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return setMetaAvatars(data || []);
}

export async function loadMetaWorlds({
  limit = 40,
  publicOnly = true
} = {}) {
  if (!RB_TABLES.metaWorlds) {
    setMetaWorlds([]);
    return [];
  }

  const supabase = getSupabase();

  let query = supabase
    .from(RB_TABLES.metaWorlds)
    .select("*")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (publicOnly) {
    query = query.eq("visibility", "public");
  }

  const { data, error } = await query;

  if (error) throw error;

  return setMetaWorlds(data || []);
}

export async function refreshMetaState({
  limit = 40
} = {}) {
  META_STATE.loading = true;
  META_STATE.error = null;
  emitMetaState();

  try {
    await Promise.allSettled([
      loadMetaAvatars({ limit }),
      loadMetaWorlds({ limit })
    ]);

    await loadMyMetaAvatar().catch(() => null);

    META_STATE.ready = true;
    META_STATE.portalStatus =
      META_STATE.activeWorld || META_STATE.avatar
        ? "online"
        : "standby";
  } catch (error) {
    META_STATE.error = error;
    META_STATE.portalStatus = "error";
    console.warn("[RB META STATE REFRESH FAILED]", error?.message || error);
  } finally {
    META_STATE.loading = false;
    emitMetaState();
  }

  return getMetaState();
}

export function clearMetaRealtime() {
  const supabase = getSupabase();

  if (META_STATE.channel && supabase) {
    supabase.removeChannel(META_STATE.channel);
  }

  META_STATE.channel = null;
}

export function bindMetaRealtime() {
  const supabase = getSupabase();

  clearMetaRealtime();

  META_STATE.channel = supabase
    .channel("rb-meta-state")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.metaAvatars
      },
      async (payload) => {
        if (payload.eventType === "DELETE") {
          removeMetaAvatar(payload.old?.id || payload.old?.user_id);
          return;
        }

        if (payload.new) {
          upsertMetaAvatar(payload.new);
          return;
        }

        await loadMetaAvatars();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.metaWorlds
      },
      async (payload) => {
        if (payload.eventType === "DELETE") {
          removeMetaWorld(payload.old?.id);
          return;
        }

        if (payload.new) {
          upsertMetaWorld(payload.new);
          return;
        }

        await loadMetaWorlds();
      }
    )
    .subscribe((status) => {
      setMetaPortalStatus(status === "SUBSCRIBED" ? "online" : "syncing");
    });

  return META_STATE.channel;
}

export async function initMetaState({
  realtime = true,
  limit = 40
} = {}) {
  await refreshMetaState({ limit });

  if (realtime) {
    bindMetaRealtime();
  }

  return getMetaState();
}

export function resetMetaState() {
  clearMetaRealtime();

  META_STATE.ready = false;
  META_STATE.loading = false;
  META_STATE.avatar = null;
  META_STATE.myAvatar = null;
  META_STATE.avatars = [];
  META_STATE.worlds = [];
  META_STATE.featuredWorld = null;
  META_STATE.activeWorld = null;
  META_STATE.portalStatus = "offline";
  META_STATE.error = null;

  emitMetaState();
}

window.addEventListener("beforeunload", clearMetaRealtime);

console.log("RB META STATE READY");
