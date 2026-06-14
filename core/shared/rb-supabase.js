/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-supabase.js

   SUPABASE ENGINE

   Locked purpose:
   - one Supabase client
   - auth/session state
   - profile identity
   - starter avatar row
   - storage helpers
   - realtime helpers
   - safe CRUD wrappers

   Identity rules:
   - profiles = account identity
   - profiles.avatar_url = profile chip image
   - profiles.banner_url = profile banner
   - meta_avatars = 3D/avatar universe row synced from profile
========================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  RB_APP,
  RB_AUTH,
  RB_SUPABASE,
  RB_TABLES,
  RB_BRAND_ASSETS
} from "/core/shared/rb-config.js";

const DEFAULT_AVATAR =
  RB_BRAND_ASSETS?.defaultProfileAvatar ||
  "/images/brand/Avatar-hero-Banner.png.jpeg";

const DEFAULT_META_AVATAR =
  RB_BRAND_ASSETS?.defaultMetaAvatar ||
  "/images/brand/meta-avatar.png.jpeg";

const DEFAULT_BANNER =
  RB_BRAND_ASSETS?.defaultProfileBanner ||
  "/images/brand/hero-banner.png";

const APP_URL =
  RB_APP?.appUrl ||
  RB_APP?.siteUrl ||
  window.location.origin;

const AUTH_REDIRECT_URL = `${APP_URL}/auth`;

export const supabase = createClient(
  RB_SUPABASE.url,
  RB_SUPABASE.publishableKey,
  {
    auth: {
      persistSession: RB_AUTH?.persistSession ?? true,
      autoRefreshToken: RB_AUTH?.autoRefreshToken ?? true,
      detectSessionInUrl: RB_AUTH?.detectSessionInUrl ?? true,
      flowType: RB_AUTH?.flowType || "pkce",
      storageKey: RB_AUTH?.sessionStorageKey || "rich-bizness-mobile-auth"
    },

    realtime: {
      params: {
        eventsPerSecond: 15
      }
    },

    global: {
      headers: {
        "x-client-info": "rich-bizness-mobile"
      }
    }
  }
);

let currentSession = null;
let currentUser = null;
let currentProfile = null;
let authBooted = false;
let authBooting = null;

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function cleanUsername(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace("@", "")
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 32);
}

function userMetadata(user) {
  return user?.user_metadata || {};
}

function usernameFromUser(user) {
  const metadata = userMetadata(user);

  return (
    cleanUsername(metadata.username) ||
    cleanUsername(metadata.name) ||
    cleanUsername(metadata.display_name) ||
    cleanUsername(user?.email?.split("@")?.[0]) ||
    "rich_user"
  );
}

function displayNameFromUser(user) {
  const metadata = userMetadata(user);

  return cleanText(
    metadata.display_name ||
      metadata.full_name ||
      metadata.name ||
      usernameFromUser(user),
    "Rich User"
  );
}

function avatarFromUser(user, existingProfile = null) {
  const metadata = userMetadata(user);

  return (
    existingProfile?.avatar_url ||
    cleanText(metadata.avatar_url, "") ||
    cleanText(metadata.picture, "") ||
    cleanText(metadata.avatar, "") ||
    DEFAULT_AVATAR
  );
}

function bannerFromUser(user, existingProfile = null) {
  const metadata = userMetadata(user);

  return (
    existingProfile?.banner_url ||
    cleanText(metadata.banner_url, "") ||
    cleanText(metadata.cover_url, "") ||
    DEFAULT_BANNER
  );
}

async function getExistingProfile(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[RB EXISTING PROFILE WARNING]", error.message);
    return null;
  }

  return data || null;
}

async function safeUpsert(table, payload, onConflict = "user_id") {
  if (!table || !payload) return null;

  try {
    const { data, error } = await supabase
      .from(table)
      .upsert(payload, { onConflict })
      .select("*")
      .maybeSingle();

    if (error) {
      console.warn(`[RB IDENTITY SYNC SKIPPED: ${table}]`, error.message);
      return null;
    }

    return data || null;
  } catch (error) {
    console.warn(`[RB IDENTITY SYNC FAILED: ${table}]`, error?.message || error);
    return null;
  }
}

function profilePayloadFromUser(user, existingProfile = null) {
  const metadata = userMetadata(user);
  const now = nowIso();

  return {
    id: user.id,

    username:
      existingProfile?.username ||
      usernameFromUser(user),

    display_name:
      existingProfile?.display_name ||
      displayNameFromUser(user),

    full_name:
      existingProfile?.full_name ||
      cleanText(metadata.full_name, displayNameFromUser(user)),

    avatar_url: avatarFromUser(user, existingProfile),
    banner_url: bannerFromUser(user, existingProfile),

    role:
      existingProfile?.role ||
      metadata.role ||
      "user",

    online_status: "online",
    last_seen_at: now,
    updated_at: now,

    metadata: {
      ...(existingProfile?.metadata || {}),
      source: "rb-supabase.js",
      auth_email: user.email || null,
      auth_origin: window.location.origin,
      locked_app_url: APP_URL,
      profile_lock: true,
      starter_avatar_created: true
    }
  };
}

function getLevelNumber(profile) {
  return Number(profile?.rich_level || profile?.level || 1) || 1;
}

function getXpNumber(profile) {
  return Number(profile?.rich_points || profile?.xp || profile?.xp_total || 0) || 0;
}

function getRankTitle(profile) {
  return profile?.rank_title || profile?.rank || "Biz Legend";
}

function getStarterAvatarConfig(profile) {
  return {
    style: "rich_bizness_portal_city",
    body: "starter",
    outfit: "black_green_gold",
    aura: "emerald_gold",
    movement: {
      idle: true,
      walk: true,
      run: false
    },
    unlocked_worlds: ["index"],
    current_world: "index",
    profile_avatar_url: profile?.avatar_url || DEFAULT_AVATAR,
    meta_avatar_url: DEFAULT_META_AVATAR
  };
}

/* =========================
   STATE GETTERS
========================= */

export function getSupabase() {
  return supabase;
}

export function getSession() {
  return currentSession;
}

export function getUser() {
  return currentUser;
}

export function getProfile() {
  return currentProfile;
}

export function getCurrentUserState() {
  return {
    session: currentSession,
    user: currentUser,
    profile: currentProfile,
    authed: Boolean(currentUser),
    isAuthed: Boolean(currentUser)
  };
}

export function isAuthed() {
  return Boolean(currentUser);
}

export function getProfileKey() {
  return currentProfile?.id || currentUser?.id || null;
}

export function getProfileIdentity() {
  const id = currentProfile?.id || currentUser?.id || null;

  return {
    id,
    user_id: id,
    profile_id: id,

    username:
      currentProfile?.username ||
      usernameFromUser(currentUser),

    display_name:
      currentProfile?.display_name ||
      displayNameFromUser(currentUser),

    avatar_url:
      currentProfile?.avatar_url ||
      DEFAULT_AVATAR,

    banner_url:
      currentProfile?.banner_url ||
      DEFAULT_BANNER,

    role:
      currentProfile?.role ||
      "user",

    rich_level:
      getLevelNumber(currentProfile),

    rich_points:
      getXpNumber(currentProfile),

    rank_title:
      getRankTitle(currentProfile)
  };
}

/* =========================
   PROFILE + STARTER AVATAR
========================= */

export async function ensureProfile(user = currentUser) {
  if (!user?.id) return null;

  const existingProfile = await getExistingProfile(user.id);
  const payload = profilePayloadFromUser(user, existingProfile);

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .maybeSingle();

  if (error) {
    console.warn("[RB ENSURE PROFILE FAILED]", error.message);

    if (existingProfile) {
      currentProfile = existingProfile;
      return existingProfile;
    }

    throw error;
  }

  currentProfile = data || existingProfile || null;

  if (currentProfile?.id) {
    await ensureProfileIdentityRows(currentProfile);
  }

  return currentProfile;
}

export async function ensureProfileIdentityRows(profile = currentProfile) {
  if (!profile?.id) return null;

  const now = nowIso();
  const level = getLevelNumber(profile);
  const xp = getXpNumber(profile);
  const rankTitle = getRankTitle(profile);
  const starterAvatarConfig = getStarterAvatarConfig(profile);

  const baseIdentity = {
    user_id: profile.id,
    username: profile.username || null,
    display_name: profile.display_name || profile.username || "Rich User",
    updated_at: now
  };

  const jobs = [
    {
      table: RB_TABLES.userSettings,
      payload: {
        user_id: profile.id,
        updated_at: now
      }
    },

    {
      table: RB_TABLES.userLevels,
      payload: {
        user_id: profile.id,
        level,
        xp_total: xp,
        xp_current: xp,
        xp_next: Math.max(100, (level + 1) * 100),
        rank_title: rankTitle,
        rich_points: profile.rich_points || 0,
        coins: 0,
        updated_at: now
      }
    },

    {
      table: RB_TABLES.profileThemeSettings,
      payload: {
        user_id: profile.id,
        background_url: profile.banner_url || DEFAULT_BANNER,
        updated_at: now
      }
    },

    {
      table: RB_TABLES.metaAvatars,
      payload: {
        user_id: profile.id,
        display_name: profile.display_name || profile.username || "Rich User",
        avatar_url: profile.avatar_url || DEFAULT_AVATAR,
        model_url: DEFAULT_META_AVATAR,
        aura: "emerald_gold",
        rank: rankTitle,
        level,
        xp,
        position: {
          x: 0,
          y: 0,
          z: 0
        },
        is_active: true,
        metadata: {
          source: "rb-supabase.js",
          synced_from_profile: true,
          index_portal_avatar: true,
          presence_state: "online",
          avatar_config: starterAvatarConfig,
          updated_at: now
        }
      }
    },

    {
      table: RB_TABLES.gamerProfiles,
      payload: {
        ...baseIdentity,
        avatar_url: profile.avatar_url || DEFAULT_AVATAR,
        banner_url: profile.banner_url || DEFAULT_BANNER
      }
    },

    {
      table: RB_TABLES.sportsProfiles,
      payload: {
        ...baseIdentity
      }
    },

    {
      table: RB_TABLES.storeSellerProfiles,
      payload: {
        ...baseIdentity,
        avatar_url: profile.avatar_url || DEFAULT_AVATAR,
        banner_url: profile.banner_url || DEFAULT_BANNER
      }
    },

    {
      table: RB_TABLES.creatorPageSettings,
      payload: {
        user_id: profile.id,
        hero_background_url: profile.banner_url || DEFAULT_BANNER,
        updated_at: now
      }
    }
  ];

  const results = await Promise.allSettled(
    jobs
      .filter((job) => Boolean(job.table))
      .map((job) => safeUpsert(job.table, job.payload, "user_id"))
  );

  return results;
}

/* =========================
   AUTH BOOT
========================= */

export async function bootAuth() {
  if (authBooted) return currentUser;
  if (authBooting) return authBooting;

  authBooting = (async () => {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      console.error("[RB SESSION ERROR]", error.message);
      authBooted = true;
      authBooting = null;
      return null;
    }

    currentSession = session || null;
    currentUser = session?.user || null;

    if (currentUser?.id) {
      await ensureProfile(currentUser);
    } else {
      currentProfile = null;
    }

    authBooted = true;
    authBooting = null;

    return currentUser;
  })();

  return authBooting;
}

export async function refreshSession() {
  const {
    data: { session },
    error
  } = await supabase.auth.refreshSession();

  if (error) {
    console.warn("[RB SESSION REFRESH WARNING]", error.message);
    return null;
  }

  currentSession = session || null;
  currentUser = session?.user || null;

  if (currentUser?.id) {
    await ensureProfile(currentUser);
  } else {
    currentProfile = null;
  }

  authBooted = true;
  return currentSession;
}

export async function loadProfile(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[RB PROFILE LOAD WARNING]", error.message);
    currentProfile = null;
    return null;
  }

  if (!data && currentUser?.id === userId) {
    return await ensureProfile(currentUser);
  }

  currentProfile = data || null;

  if (currentProfile?.id) {
    await ensureProfileIdentityRows(currentProfile);
  }

  return currentProfile;
}

export async function refreshProfile() {
  await bootAuth();

  if (!currentUser?.id) {
    currentProfile = null;
    return null;
  }

  return await loadProfile(currentUser.id);
}

/* =========================
   AUTH ACTIONS
========================= */

export async function signUp({ email, password, metadata = {} }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        ...metadata,
        username: metadata.username || metadata.display_name || metadata.name,
        display_name: metadata.display_name || metadata.name || metadata.username,
        avatar_url: metadata.avatar_url || DEFAULT_AVATAR,
        banner_url: metadata.banner_url || DEFAULT_BANNER,
        starter_avatar: true
      },
      emailRedirectTo: AUTH_REDIRECT_URL
    }
  });

  if (error) throw error;

  currentSession = data.session || null;
  currentUser = data.user || data.session?.user || null;

  if (currentUser?.id) {
    await ensureProfile(currentUser);
  }

  authBooted = true;
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  currentSession = data.session || null;
  currentUser = data.user || data.session?.user || null;

  if (currentUser?.id) {
    await ensureProfile(currentUser);
  }

  authBooted = true;
  return data;
}

export async function signOut() {
  if (currentUser?.id) {
    await supabase
      .from(RB_TABLES.profiles)
      .update({
        online_status: "offline",
        last_seen_at: nowIso(),
        updated_at: nowIso()
      })
      .eq("id", currentUser.id);
  }

  await supabase.auth.signOut();

  currentSession = null;
  currentUser = null;
  currentProfile = null;
  authBooted = false;
  authBooting = null;
}

export const rbSignOut = signOut;

/* =========================
   AUTH STATE LISTENER
========================= */

supabase.auth.onAuthStateChange((_event, session) => {
  currentSession = session || null;
  currentUser = session?.user || null;

  if (currentUser?.id) {
    window.setTimeout(() => {
      ensureProfile(currentUser).catch((error) => {
        console.warn("[RB PROFILE STATE WARNING]", error?.message || error);
      });
    }, 0);
  } else {
    currentProfile = null;
  }

  authBooted = true;

  window.dispatchEvent(
    new CustomEvent("rb:supabase-auth-state", {
      detail: getCurrentUserState()
    })
  );
});

/* =========================
   STORAGE HELPERS
========================= */

export function getPublicFileUrl(bucket, path) {
  if (!bucket || !path) return null;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

export async function uploadFile({ bucket, path, file, upsert = false }) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert });

  if (error) throw error;

  return {
    ...data,
    publicUrl: getPublicFileUrl(bucket, data.path)
  };
}

export async function deleteFile({ bucket, paths = [] }) {
  const { data, error } = await supabase.storage.from(bucket).remove(paths);

  if (error) throw error;
  return data;
}

/* =========================
   REALTIME HELPERS
========================= */

export function createRealtimeChannel(channelName, config = {}) {
  return supabase.channel(channelName, config);
}

export async function removeRealtimeChannel(channel) {
  if (!channel) return null;
  return await supabase.removeChannel(channel);
}

/* =========================
   CRUD HELPERS
========================= */

export async function rbSelect({
  table,
  select = "*",
  match = {},
  single = false,
  maybeSingle = false,
  orderBy = null,
  ascending = false,
  limit = null
}) {
  let query = supabase.from(table).select(select);

  Object.entries(match).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query = query.eq(key, value);
    }
  });

  if (orderBy) query = query.order(orderBy, { ascending });
  if (limit) query = query.limit(limit);
  if (single) query = query.single();
  if (maybeSingle) query = query.maybeSingle();

  const { data, error } = await query;
  if (error) throw error;

  return data;
}

export async function rbInsert({ table, values }) {
  const { data, error } = await supabase
    .from(table)
    .insert(values)
    .select();

  if (error) throw error;
  return data;
}

export async function rbUpdate({ table, match = {}, values = {} }) {
  let query = supabase.from(table).update(values);

  Object.entries(match).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query = query.eq(key, value);
    }
  });

  const { data, error } = await query.select();

  if (error) throw error;
  return data;
}

export async function rbUpsert({ table, values, onConflict = "id" }) {
  const { data, error } = await supabase
    .from(table)
    .upsert(values, { onConflict })
    .select();

  if (error) throw error;
  return data;
}

export async function rbDelete({ table, match = {} }) {
  let query = supabase.from(table).delete();

  Object.entries(match).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query = query.eq(key, value);
    }
  });

  const { data, error } = await query.select();

  if (error) throw error;
  return data;
}

/* =========================
   REQUIRE HELPERS
========================= */

export async function rbRequireUser() {
  await bootAuth();

  if (!currentUser?.id) {
    throw new Error("You must be signed in.");
  }

  return currentUser;
}

export async function rbRequireProfile() {
  await bootAuth();

  if (!currentUser?.id) {
    throw new Error("You must be signed in.");
  }

  if (!currentProfile?.id) {
    await ensureProfile(currentUser);
  }

  if (!currentProfile?.id) {
    throw new Error("Profile not found.");
  }

  return currentProfile;
}

export async function rbTouchOnline() {
  await bootAuth();

  if (!currentUser?.id) return null;

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .update({
      online_status: "online",
      last_seen_at: nowIso(),
      updated_at: nowIso()
    })
    .eq("id", currentUser.id)
    .select("*")
    .maybeSingle();

  if (!error && data) {
    currentProfile = data;
  }

  return data || null;
}

console.log("RB SUPABASE ENGINE READY");
