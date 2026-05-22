/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-supabase.js
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
      await loadProfile(currentUser.id);
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
    await loadProfile(currentUser.id);
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

  currentProfile = data || null;
  return currentProfile;
}

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
  currentUser = data.user || data.session?.user || null;

  if (currentUser?.id) {
    await loadProfile(currentUser.id);
  }

  authBooted = true;

  return data;
}

export async function signIn({
  email,
  password
}) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  currentSession = data.session || null;
  currentUser = data.user || data.session?.user || null;

  if (currentUser?.id) {
    await loadProfile(currentUser.id);
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
  authBooting = null;
}

supabase.auth.onAuthStateChange((_event, session) => {
  currentSession = session || null;
  currentUser = session?.user || null;

  if (currentUser?.id) {
    setTimeout(() => {
      loadProfile(currentUser.id).catch((error) => {
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
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert });

  if (error) throw error;

  return data;
}

export async function deleteFile({
  bucket,
  paths = []
}) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .remove(paths);

  if (error) throw error;

  return data;
}

export function createRealtimeChannel(channelName, config = {}) {
  return supabase.channel(channelName, config);
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
    query = query.eq(key, value);
  });

  if (orderBy) query = query.order(orderBy, { ascending });
  if (limit) query = query.limit(limit);
  if (single) query = query.single();
  if (maybeSingle) query = query.maybeSingle();

  const { data, error } = await query;

  if (error) throw error;

  return data;
}

export async function rbInsert({
  table,
  values
}) {
  const { data, error } = await supabase
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

console.log("RB SUPABASE ENGINE READY");
