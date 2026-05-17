/* =========================
   RICH BIZNESS MOBILE
   /core/shared/rb-supabase.js

   LOCKED SUPABASE CORE
========================= */

import {
  createClient
} from "https://esm.sh/@supabase/supabase-js@2";

import {
  RB_SUPABASE,
  RB_TABLES
} from "/core/shared/rb-config.js";

/* =========================
   CLIENT
========================= */

export const supabase = createClient(
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
        eventsPerSecond: 10
      }
    },

    global: {
      headers: {
        "x-client-info":
          "rich-bizness-mobile"
      }
    }
  }
);

/* =========================
   SESSION STATE
========================= */

let rbSession = null;
let rbUser = null;
let rbProfile = null;

/* =========================
   PROFILE LOADER
========================= */

export async function fetchProfile(
  userId
) {
  if (!userId) return null;

  const { data, error } =
    await supabase
      .from(RB_TABLES.profiles)
      .select("*")
      .eq("id", userId)
      .single();

  if (error) {
    console.error(
      "RB PROFILE LOAD ERROR",
      error
    );

    return null;
  }

  rbProfile = data || null;

  return rbProfile;
}

/* =========================
   SESSION BOOT
========================= */

export async function initSupabase() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    console.error(
      "RB SESSION ERROR",
      error
    );
  }

  rbSession = session || null;
  rbUser = session?.user || null;

  if (rbUser?.id) {
    await fetchProfile(rbUser.id);
  }

  return {
    session: rbSession,
    user: rbUser,
    profile: rbProfile
  };
}

/* =========================
   AUTH CHANGES
========================= */

supabase.auth.onAuthStateChange(
  async (_event, session) => {
    rbSession = session || null;
    rbUser = session?.user || null;

    if (rbUser?.id) {
      await fetchProfile(rbUser.id);
    } else {
      rbProfile = null;
    }

    window.dispatchEvent(
      new CustomEvent(
        "rb-auth-change",
        {
          detail: {
            session: rbSession,
            user: rbUser,
            profile: rbProfile
          }
        }
      )
    );
  }
);

/* =========================
   HELPERS
========================= */

export function getSession() {
  return rbSession;
}

export function getUser() {
  return rbUser;
}

export function getProfile() {
  return rbProfile;
}

export function isAuthed() {
  return !!rbUser;
}

/* =========================
   PROFILE UPSERT
========================= */

export async function ensureProfile(
  user
) {
  if (!user?.id) return null;

  const existing =
    await fetchProfile(user.id);

  if (existing) {
    return existing;
  }

  const username =
    user.email
      ?.split("@")[0]
      ?.replace(/[^a-zA-Z0-9_]/g, "")
      ?.toLowerCase() ||
    `rb_${Date.now()}`;

  const payload = {
    id: user.id,

    username,

    display_name:
      user.user_metadata
        ?.display_name ||
      username,

    full_name:
      user.user_metadata
        ?.full_name || "",

    avatar_url:
      user.user_metadata
        ?.avatar_url || "",

    role: "user",

    is_creator: false,
    is_artist: false,
    is_seller: false,
    is_verified: false,

    favorite_section: "live"
  };

  const { error } = await supabase
    .from(RB_TABLES.profiles)
    .upsert(payload);

  if (error) {
    console.error(
      "RB PROFILE CREATE ERROR",
      error
    );

    return null;
  }

  return await fetchProfile(user.id);
}

/* =========================
   SIGN OUT
========================= */

export async function signOut() {
  await supabase.auth.signOut();
}

/* =========================
   REALTIME HELPERS
========================= */

export function createChannel(name) {
  return supabase.channel(name);
}

export function removeChannel(channel) {
  return supabase.removeChannel(channel);
}

/* =========================
   READY
========================= */

document.body.classList.add(
  "rb-supabase-loaded"
);

console.log(
  "RB SUPABASE CORE READY"
);
