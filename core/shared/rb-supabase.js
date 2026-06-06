/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-supabase.js

   SUPABASE ENGINE
   Auth + Profile State + Storage + Realtime
   Locked App URL Redirects
========================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  RB_APP,
  RB_AUTH,
  RB_SUPABASE,
  RB_TABLES
} from "/core/shared/rb-config.js";

const DEFAULT_AVATAR = "/images/brand/Avatar-hero-Banner.png.jpeg";
const DEFAULT_BANNER = "/images/brand/hero-banner.png";

const APP_URL =
  RB_APP?.appUrl ||
  RB_APP?.siteUrl ||
  "https://rich-bizness-mobile-app.vercel.app";

const AUTH_REDIRECT_URL = `${APP_URL}/auth`;

const supabase = createClient(RB_SUPABASE.url, RB_SUPABASE.publishableKey, {
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
});

let currentSession = null;
let currentUser = null;
let currentProfile = null;
let authBooted = false;
let authBooting = null;

function cleanText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function usernameFromUser(user) {
  const raw =
    user?.user_metadata?.username ||
    user?.user_metadata?.name ||
    user?.user_metadata?.display_name ||
    user?.email?.split("@")?.[0] ||
    "rich_user";

  return cleanText(raw, "rich_user")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .slice(0, 32);
}

function displayNameFromUser(user) {
  return cleanText(
    user?.user_metadata?.display_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      usernameFromUser(user),
    "Rich User"
  );
}

function profilePayloadFromUser(user) {
  return {
    id: user.id,
    username: usernameFromUser(user),
    display_name: displayNameFromUser(user),
    full_name: cleanText(user?.user_metadata?.full_name, null),
    avatar_url: cleanText(user?.user_metadata?.avatar_url, DEFAULT_AVATAR),
    banner_url: cleanText(user?.user_metadata?.banner_url, DEFAULT_BANNER),
    online_status: "online",
    last_seen_at: new Date().toISOString(),
    metadata: {
      source: "rb-supabase.js",
      auth_email: user.email || null,
      auth_origin: window.location.origin,
      locked_app_url: APP_URL
    },
    updated_at: new Date().toISOString()
  };
}

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
    authed: !!currentUser
  };
}

export function isAuthed() {
  return !!currentUser;
}

export function getProfileKey() {
  return currentProfile?.id || currentUser?.id || null;
}

export function getProfileIdentity() {
  return {
    user_id: currentProfile?.id || currentUser?.id || null,
    username: currentProfile?.username || usernameFromUser(currentUser),
    display_name: currentProfile?.display_name || displayNameFromUser(currentUser),
    avatar_url: currentProfile?.avatar_url || DEFAULT_AVATAR,
    banner_url: currentProfile?.banner_url || DEFAULT_BANNER
  };
}

export async function ensureProfile(user = currentUser) {
  if (!user?.id) return null;

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .upsert(profilePayloadFromUser(user), { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;

  currentProfile = data;
  await ensureProfileIdentityRows(data);

  return data;
}

export async function ensureProfileIdentityRows(profile = currentProfile) {
  if (!profile?.id) return;

  const now = new Date().toISOString();

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
        updated_at: now
      }
    },
    {
      table: RB_TABLES.gamerProfiles,
      payload: {
        user_id: profile.id,
        username: profile.username || null,
        display_name: profile.display_name || profile.username || "Rich User",
        avatar_url: profile.avatar_url || DEFAULT_AVATAR,
        banner_url: profile.banner_url || DEFAULT_BANNER,
        updated_at: now
      }
    },
    {
      table: RB_TABLES.sportsProfiles,
      payload: {
        user_id: profile.id,
        username: profile.username || null,
        display_name: profile.display_name || profile.username || "Rich User",
        updated_at: now
      }
    },
    {
      table: RB_TABLES.storeSellerProfiles,
      payload: {
        user_id: profile.id,
        username: profile.username || null,
        display_name: profile.display_name || profile.username || "Rich User",
        avatar_url: profile.avatar_url || DEFAULT_AVATAR,
        banner_url: profile.banner_url || DEFAULT_BANNER,
        updated_at: now
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

  for (const job of jobs) {
    if (!job.table) continue;

    try {
      await supabase.from(job.table).upsert(job.payload, {
        onConflict: "user_id"
      });
    } catch (error) {
      console.warn(`[RB IDENTITY SYNC SKIPPED: ${job.table}]`, error?.message || error);
    }
  }
}

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

export async function signUp({ email, password, metadata = {} }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
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
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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

supabase.auth.onAuthStateChange((_event, session) => {
  currentSession = session || null;
  currentUser = session?.user || null;

  if (currentUser?.id) {
    setTimeout(() => {
      ensureProfile(currentUser).catch((error) => {
        console.warn("[RB PROFILE STATE WARNING]", error.message);
      });
    }, 0);
  } else {
    currentProfile = null;
  }

  authBooted = true;
});

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

export function createRealtimeChannel(channelName, config = {}) {
  return supabase.channel(channelName, config);
}

export async function removeRealtimeChannel(channel) {
  if (!channel) return null;
  return await supabase.removeChannel(channel);
}

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
    if (value !== undefined && value !== null) query = query.eq(key, value);
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
  const { data, error } = await supabase.from(table).insert(values).select();

  if (error) throw error;
  return data;
}

export async function rbUpdate({ table, match = {}, values = {} }) {
  let query = supabase.from(table).update(values);

  Object.entries(match).forEach(([key, value]) => {
    if (value !== undefined && value !== null) query = query.eq(key, value);
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
    if (value !== undefined && value !== null) query = query.eq(key, value);
  });

  const { data, error } = await query.select();

  if (error) throw error;
  return data;
}

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
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", currentUser.id)
    .select("*")
    .maybeSingle();

  if (!error && data) currentProfile = data;

  return data || null;
}

console.log("RB SUPABASE ENGINE READY");
