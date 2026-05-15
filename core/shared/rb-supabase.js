/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-supabase.js

   GLOBAL SUPABASE ENGINE
========================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  RB_CONFIG,
  RB_SUPABASE
} from "/core/shared/rb-config.js";

/* =========================
   CLIENT
========================= */

const supabase = createClient(
  RB_SUPABASE.url,
  RB_SUPABASE.publishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce"
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

/* =========================
   STATE
========================= */

let currentSession = null;
let currentUser = null;
let currentProfile = null;

/* =========================
   HELPERS
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

export function isAuthed() {
  return !!currentUser;
}

/* =========================
   AUTH
========================= */

export async function bootAuth() {
  try {
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      console.error("[RB AUTH SESSION ERROR]", error);
      return null;
    }

    currentSession = session || null;
    currentUser = session?.user || null;

    if (currentUser) {
      await loadProfile(currentUser.id);
    }

    return currentUser;
  } catch (err) {
    console.error("[RB AUTH BOOT ERROR]", err);
    return null;
  }
}

/* =========================
   PROFILE
========================= */

export async function loadProfile(userId) {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from(RB_CONFIG.tables.profiles)
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn("[RB PROFILE LOAD WARNING]", error.message);
      return null;
    }

    currentProfile = data;

    return data;
  } catch (err) {
    console.error("[RB PROFILE LOAD ERROR]", err);
    return null;
  }
}

/* =========================
   SIGN UP
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
      data: metadata
    }
  });

  if (error) throw error;

  return data;
}

/* =========================
   SIGN IN
========================= */

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

  currentSession = data.session;
  currentUser = data.user;

  if (currentUser) {
    await loadProfile(currentUser.id);
  }

  return data;
}

/* =========================
   SIGN OUT
========================= */

export async function signOut() {
  await supabase.auth.signOut();

  currentSession = null;
  currentUser = null;
  currentProfile = null;

  window.location.href = RB_CONFIG.routes.auth;
}

/* =========================
   REALTIME AUTH STATE
========================= */

supabase.auth.onAuthStateChange(
  async (_event, session) => {
    currentSession = session || null;
    currentUser = session?.user || null;

    if (currentUser) {
      await loadProfile(currentUser.id);
    } else {
      currentProfile = null;
    }
  }
);

/* =========================
   STORAGE URL
========================= */

export function getPublicFileUrl(bucket, path) {
  if (!bucket || !path) return null;

  const { data } = supabase
    .storage
    .from(bucket)
    .getPublicUrl(path);

  return data?.publicUrl || null;
}

/* =========================
   FILE UPLOAD
========================= */

export async function uploadFile({
  bucket,
  path,
  file,
  upsert = false
}) {
  const { data, error } =
    await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert
      });

  if (error) throw error;

  return data;
}

/* =========================
   FILE DELETE
========================= */

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
   UNIVERSAL REALTIME
========================= */

export function createRealtimeChannel(
  channelName,
  config = {}
) {
  return supabase.channel(channelName, config);
}

/* =========================
   DB HELPERS
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
  let query = supabase
    .from(table)
    .select(select);

  Object.entries(match).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  if (orderBy) {
    query = query.order(orderBy, {
      ascending
    });
  }

  if (limit) {
    query = query.limit(limit);
  }

  if (single) {
    query = query.single();
  }

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
  let query = supabase
    .from(table)
    .update(values);

  Object.entries(match).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { data, error } =
    await query.select();

  if (error) throw error;

  return data;
}

export async function rbDelete({
  table,
  match = {}
}) {
  let query = supabase
    .from(table)
    .delete();

  Object.entries(match).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const { data, error } =
    await query.select();

  if (error) throw error;

  return data;
}

/* =========================
   BOOT
========================= */

await bootAuth();

console.log(
  "%cRICH BIZNESS MOBILE READY",
  `
    color:#00ff88;
    font-weight:900;
    font-size:14px;
  `
);
