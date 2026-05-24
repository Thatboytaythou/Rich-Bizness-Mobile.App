/* =========================================
   RICH BIZNESS MOBILE
   /core/shared/utils/supabase.js
========================================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =========================================
   LOCKED PROJECT VALUES
========================================= */

export const SUPABASE_URL =
  "https://xfsrqomsiulswbalgknx.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_pW8c7eWAX1GPi5HbncKjpg_CicEceV8";

/* =========================================
   SINGLE GLOBAL CLIENT
========================================= */

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },

    realtime: {
      params: {
        eventsPerSecond: 20
      }
    },

    global: {
      headers: {
        "x-client-info": "rich-bizness-mobile"
      }
    }
  }
);

/* =========================================
   HELPERS
========================================= */

export async function getCurrentUser() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[RB] getCurrentUser error:", error);
    return null;
  }

  return user;
}

export async function getCurrentSession() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    console.error("[RB] getCurrentSession error:", error);
    return null;
  }

  return session;
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[RB] signOutUser error:", error);
  }

  return !error;
}

/* =========================================
   REALTIME CHANNEL FACTORY
========================================= */

export function createRealtimeChannel(name) {
  return supabase.channel(`rb-${name}`);
}

/* =========================================
   STORAGE HELPERS
========================================= */

export function getPublicUrl(bucket, path) {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return data?.publicUrl || null;
}

/* =========================================
   DEBUG
========================================= */

window.RB_SUPABASE = supabase;

console.log(
  "[RB] Supabase locked:",
  SUPABASE_URL
);
