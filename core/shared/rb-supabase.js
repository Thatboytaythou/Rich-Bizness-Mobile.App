/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-supabase.js

   GLOBAL SUPABASE ENGINE
   Session + Profile Auto-Creation Locked
========================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  RB_SUPABASE,
  RB_TABLES
} from "/core/shared/rb-config.js";

const supabase = createClient(
  RB_SUPABASE.url,
  RB_SUPABASE.publishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "rich-bizness-mobile-auth"
    },
    realtime: {
      params: {
        eventsPerSecond: 25
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

export function isAuthed() {
  return !!currentUser;
}

/* =========================
   AUTH BOOT
========================= */

export async function bootAuth() {
  if (authBooted) {
    return currentUser;
  }

  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    console.error("[RB SESSION ERROR]", error);
    authBooted = true;
    return null;
  }

  currentSession = session || null;
  currentUser = session?.user || null;

  if (currentUser?.id) {
    await ensureProfile(currentUser);
  }

  authBooted = true;

  return currentUser;
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
  }

  return currentSession;
}

/* =========================
   PROFILE
========================= */

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

  currentProfile = data || null;
  return currentProfile;
}

export async function ensureProfile(user = currentUser) {
  if (!user?.id) return null;

  const existingProfile = await loadProfile(user.id);

  if (existingProfile) {
    return existingProfile;
  }

  const fallbackName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.username ||
    user.email?.split("@")[0] ||
    "Rich User";

  const fallbackUsername =
    (
      user.user_metadata?.username ||
      user.email?.split("@")[0] ||
      `user_${user.id.slice(0, 8)}`
    )
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");

  const profilePayload = {
    id: user.id,
    username: fallbackUsername,
    display_name: fallbackName,
    full_name: fallbackName,
    avatar_url: "/images/profile/default-avatar.png",
    banner_url: "/images/profile/default-banner.png",
    role: "user",
    is_creator: false,
    is_artist: false,
    is_seller: false,
    is_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(RB_TABLES.profiles)
    .insert(profilePayload)
    .select()
    .single();

  if (error) {
    console.warn("[RB PROFILE CREATE WARNING]", error.message);
    return await loadProfile(user.id);
  }

  currentProfile = data;
  return currentProfile;
}

/* =========================
   AUTH ACTIONS
========================= */

export async function signUp({
  email,
  password,
  metadata = {}
}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: `${window.location.origin}/auth`
    }
  });

  if (error) throw error;

  currentSession = data.session || null;
  currentUser = data.user || null;

  if (currentUser?.id) {
    await ensureProfile(currentUser);
  }

  authBooted = true;

  return data;
}

export async function signIn({
  email,
  password
}) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password
    });

  if (error) throw error;

  currentSession = data.session || null;
  currentUser = data.user || null;

  if (currentUser?.id) {
    await ensureProfile(currentUser);
  }

  authBooted = true;

  return data;
}

export async function signOut() {
  await supabase.auth.signOut();

  currentSession = null;
  currentUser = null;
  currentProfile = null;
  authBooted = false;
}

/* =========================
   AUTH LISTENER
========================= */

supabase.auth.onAuthStateChange(async (_event, session) => {
  currentSession = session || null;
  currentUser = session?.user || null;

  if (currentUser?.id) {
    await ensureProfile(currentUser);
  } else {
    currentProfile = null;
  }

  authBooted = true;
});

/* =========================
   STORAGE
========================= */

export function getPublicFileUrl(bucket, path) {
  if (!bucket || !path) return null;

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return data?.publicUrl || null;
}

export async function uploadFile({
  bucket,
  path,
  file,
  upsert = false
}) {
  const { data, error } =
    await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert });

  if (error) throw error;

  return data;
}

export async function deleteFile({
  bucket,
  paths = []
}) {
  const { data, error } =
    await supabase.storage
      .from(bucket)
      .remove(paths);

  if (error) throw error;

  return data;
}

/* =========================
   REALTIME
========================= */

export function createRealtimeChannel(channelName, config = {}) {
  return supabase.channel(channelName, config);
}

/* =========================
   DATABASE HELPERS
========================= */

export async function rbSelect({
  table,
  select = "*",
  match = {},
  single = false,
  orderBy = null,
  ascending = false,
  limit = null
}) {
  let query = supabase.from(table).select(select);

  Object.entries(match).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  if (orderBy) query = query.order(orderBy, { ascending });
  if (limit) query = query.limit(limit);
  if (single) query = query.single();

  const { data, error } = await query;

  if (error) throw error;

  return data;
}

export async function rbInsert({
  table,
  values
}) {
  const { data, error } =
    await supabase
      .from(table)
      .insert(values)
      .select();

  if (error) throw error;

  return data;
}

export async function rbUpdate({
  table,
  match = {},
  values = {}
}) {
  let query = supabase.from(table).update(values);

  Object.entries(match).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { data, error } = await query.select();

  if (error) throw error;

  return data;
}

export async function rbDelete({
  table,
  match = {}
}) {
  let query = supabase.from(table).delete();

  Object.entries(match).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { data, error } = await query.select();

  if (error) throw error;

  return data;
}

await bootAuth();

console.log("RB SUPABASE SESSION + PROFILE LOCK READY");
