/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-presence.js

   LIVE PRESENCE ENGINE
   Viewer presence + stream members + realtime counts
   Safe Join/Leave + Viewer Count Sync
========================= */

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

const PRESENCE = {
  stream: null,
  user: null,
  profile: null,

  members: [],
  sessions: [],

  memberChannel: null,
  sessionChannel: null,

  ready: false,
  loading: false,
  error: null,

  listeners: new Set()
};

function emitPresence() {
  const state = getLivePresenceState();

  PRESENCE.listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      console.warn("[RB LIVE PRESENCE LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-live-presence-update", {
      detail: state
    })
  );

  window.dispatchEvent(
    new CustomEvent("rb:live-presence-state", {
      detail: state
    })
  );
}

function displayName() {
  return (
    PRESENCE.profile?.display_name ||
    PRESENCE.profile?.full_name ||
    PRESENCE.profile?.username ||
    PRESENCE.user?.email?.split("@")[0] ||
    "Rich Viewer"
  );
}

function username() {
  return (
    PRESENCE.profile?.username ||
    PRESENCE.user?.email?.split("@")[0] ||
    "guest"
  );
}

function avatarUrl() {
  return (
    PRESENCE.profile?.avatar_url ||
    "/images/brand/Avatar-hero-Banner.png.jpeg"
  );
}

function deviceInfo() {
  return {
    user_agent: navigator.userAgent,
    width: window.innerWidth,
    height: window.innerHeight,
    source: "live-presence.js"
  };
}

function normalizeMember(row = {}) {
  return {
    ...row,
    username: row.username || row.metadata?.username || "guest",
    display_name:
      row.display_name ||
      row.metadata?.display_name ||
      row.username ||
      "Rich Viewer",
    avatar_url:
      row.avatar_url ||
      row.metadata?.avatar_url ||
      "/images/brand/Avatar-hero-Banner.png.jpeg",
    status: row.status || "active",
    role: row.role || "viewer"
  };
}

function normalizeSession(row = {}) {
  return {
    ...row,
    username: row.username || row.metadata?.username || "guest",
    display_name:
      row.display_name ||
      row.metadata?.display_name ||
      row.username ||
      "Rich Viewer",
    avatar_url:
      row.avatar_url ||
      row.metadata?.avatar_url ||
      "/images/brand/Avatar-hero-Banner.png.jpeg",
    watch_seconds: Number(row.watch_seconds || row.listen_seconds || 0)
  };
}

function findSessionById(sessionId) {
  return PRESENCE.sessions.find((item) => String(item.id) === String(sessionId));
}

function watchSecondsFromSession(session = {}) {
  const joinedAt = session?.joined_at
    ? new Date(session.joined_at).getTime()
    : Date.now();

  return Math.max(0, Math.floor((Date.now() - joinedAt) / 1000));
}

export function getLivePresenceState() {
  return {
    ready: PRESENCE.ready,
    loading: PRESENCE.loading,
    error: PRESENCE.error,
    stream: PRESENCE.stream,
    user: PRESENCE.user,
    profile: PRESENCE.profile,
    members: [...PRESENCE.members],
    sessions: [...PRESENCE.sessions],
    viewerCount: Number(PRESENCE.stream?.viewer_count || PRESENCE.sessions.length || 0),
    peakViewers: Number(PRESENCE.stream?.peak_viewers || 0)
  };
}

export function onLivePresence(listener) {
  if (typeof listener !== "function") return () => {};

  PRESENCE.listeners.add(listener);

  try {
    listener(getLivePresenceState());
  } catch (error) {
    console.warn("[RB LIVE PRESENCE LISTENER]", error);
  }

  return () => {
    PRESENCE.listeners.delete(listener);
  };
}

export async function loadLiveMembers(streamId = PRESENCE.stream?.id) {
  if (!streamId || !RB_TABLES.liveStreamMembers) {
    PRESENCE.members = [];
    emitPresence();
    return [];
  }

  const supabase = getSupabase();

  const attempts = [
    {
      name: "active_joined",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreamMembers)
          .select("*")
          .eq("stream_id", streamId)
          .eq("status", "active")
          .order("joined_at", { ascending: true })
    },
    {
      name: "all_joined",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreamMembers)
          .select("*")
          .eq("stream_id", streamId)
          .order("joined_at", { ascending: true })
    },
    {
      name: "all_no_order",
      run: () =>
        supabase
          .from(RB_TABLES.liveStreamMembers)
          .select("*")
          .eq("stream_id", streamId)
    }
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const { data, error } = await attempt.run();

      if (error) throw error;

      PRESENCE.members = (data || [])
        .map(normalizeMember)
        .filter((item) => item.status === "active");

      emitPresence();

      return PRESENCE.members;
    } catch (error) {
      lastError = error;
      console.warn(`[RB LIVE MEMBERS LOAD SKIPPED: ${attempt.name}]`, error?.message || error);
    }
  }

  PRESENCE.error = lastError;
  PRESENCE.members = [];
  emitPresence();

  return [];
}

export async function loadLiveViewSessions(streamId = PRESENCE.stream?.id) {
  if (!streamId || !RB_TABLES.liveViewSessions) {
    PRESENCE.sessions = [];
    emitPresence();
    return [];
  }

  const supabase = getSupabase();

  const attempts = [
    {
      name: "active_joined",
      run: () =>
        supabase
          .from(RB_TABLES.liveViewSessions)
          .select("*")
          .eq("stream_id", streamId)
          .is("left_at", null)
          .order("joined_at", { ascending: true })
    },
    {
      name: "all_joined",
      run: () =>
        supabase
          .from(RB_TABLES.liveViewSessions)
          .select("*")
          .eq("stream_id", streamId)
          .order("joined_at", { ascending: true })
    },
    {
      name: "all_no_order",
      run: () =>
        supabase
          .from(RB_TABLES.liveViewSessions)
          .select("*")
          .eq("stream_id", streamId)
    }
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const { data, error } = await attempt.run();

      if (error) throw error;

      PRESENCE.sessions = (data || [])
        .map(normalizeSession)
        .filter((item) => !item.left_at);

      emitPresence();

      return PRESENCE.sessions;
    } catch (error) {
      lastError = error;
      console.warn(`[RB LIVE SESSIONS LOAD SKIPPED: ${attempt.name}]`, error?.message || error);
    }
  }

  PRESENCE.error = lastError;
  PRESENCE.sessions = [];
  emitPresence();

  return [];
}

export async function joinLivePresence({
  stream = PRESENCE.stream,
  user = PRESENCE.user,
  profile = PRESENCE.profile,
  role = "viewer",
  anonymousId = null
} = {}) {
  if (stream?.id) PRESENCE.stream = stream;
  if (user !== undefined) PRESENCE.user = user;
  if (profile !== undefined) PRESENCE.profile = profile;

  if (!PRESENCE.stream?.id) {
    throw new Error("No live stream selected.");
  }

  const supabase = getSupabase();

  let member = null;
  let session = null;

  const now = new Date().toISOString();

  if (PRESENCE.user?.id && RB_TABLES.liveStreamMembers) {
    const memberPayload = {
      stream_id: PRESENCE.stream.id,
      user_id: PRESENCE.user.id,
      role,
      status: "active",
      joined_at: now,
      left_at: null,
      metadata: {
        source: "live-presence.js",
        username: username(),
        display_name: displayName(),
        avatar_url: avatarUrl()
      }
    };

    try {
      const { data, error } = await supabase
        .from(RB_TABLES.liveStreamMembers)
        .upsert(memberPayload, {
          onConflict: "stream_id,user_id"
        })
        .select("*")
        .maybeSingle();

      if (error) throw error;

      member = data || memberPayload;
    } catch (error) {
      console.warn("[RB LIVE MEMBER UPSERT SKIPPED]", error?.message || error);

      const { data, error: insertError } = await supabase
        .from(RB_TABLES.liveStreamMembers)
        .insert(memberPayload)
        .select("*")
        .maybeSingle();

      if (!insertError) member = data || memberPayload;
    }
  }

  if (RB_TABLES.liveViewSessions) {
    const sessionPayload = {
      stream_id: PRESENCE.stream.id,
      user_id: PRESENCE.user?.id || null,
      username: PRESENCE.user ? username() : null,
      display_name: PRESENCE.user ? displayName() : "Guest Viewer",
      avatar_url: PRESENCE.user ? avatarUrl() : null,
      anonymous_id: PRESENCE.user ? null : anonymousId,
      joined_at: now,
      left_at: null,
      device_info: deviceInfo(),
      metadata: {
        source: "live-presence.js",
        username: username(),
        display_name: displayName(),
        avatar_url: avatarUrl()
      }
    };

    const { data, error } = await supabase
      .from(RB_TABLES.liveViewSessions)
      .insert(sessionPayload)
      .select("*")
      .maybeSingle();

    if (error) throw error;

    session = data || sessionPayload;
  }

  await syncViewerCount(PRESENCE.stream.id);

  await Promise.allSettled([
    loadLiveMembers(PRESENCE.stream.id),
    loadLiveViewSessions(PRESENCE.stream.id)
  ]);

  return {
    member,
    session
  };
}

export async function leaveLivePresence({
  sessionId = null,
  userId = PRESENCE.user?.id || null
} = {}) {
  if (!PRESENCE.stream?.id) return null;

  const supabase = getSupabase();
  const now = new Date().toISOString();

  if (sessionId && RB_TABLES.liveViewSessions) {
    const session = findSessionById(sessionId);
    const watchSeconds = watchSecondsFromSession(session);

    await supabase
      .from(RB_TABLES.liveViewSessions)
      .update({
        left_at: now,
        watch_seconds: watchSeconds,
        updated_at: now
      })
      .eq("id", sessionId);
  } else if (userId && RB_TABLES.liveViewSessions) {
    await supabase
      .from(RB_TABLES.liveViewSessions)
      .update({
        left_at: now,
        updated_at: now
      })
      .eq("stream_id", PRESENCE.stream.id)
      .eq("user_id", userId)
      .is("left_at", null);
  }

  if (userId && RB_TABLES.liveStreamMembers) {
    await supabase
      .from(RB_TABLES.liveStreamMembers)
      .update({
        status: "left",
        left_at: now,
        updated_at: now
      })
      .eq("stream_id", PRESENCE.stream.id)
      .eq("user_id", userId);
  }

  await syncViewerCount(PRESENCE.stream.id);

  await Promise.allSettled([
    loadLiveMembers(PRESENCE.stream.id),
    loadLiveViewSessions(PRESENCE.stream.id)
  ]);

  return getLivePresenceState();
}

export async function syncViewerCount(streamId = PRESENCE.stream?.id) {
  if (!streamId || !RB_TABLES.liveStreams || !RB_TABLES.liveViewSessions) return null;

  const supabase = getSupabase();

  const { count, error } = await supabase
    .from(RB_TABLES.liveViewSessions)
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("stream_id", streamId)
    .is("left_at", null);

  if (error) throw error;

  const viewerCount = count || 0;
  const peakViewers = Math.max(
    Number(PRESENCE.stream?.peak_viewers || 0),
    viewerCount
  );

  const { data, error: updateError } = await supabase
    .from(RB_TABLES.liveStreams)
    .update({
      viewer_count: viewerCount,
      peak_viewers: peakViewers,
      last_activity_at: new Date().toISOString()
    })
    .eq("id", streamId)
    .select("*")
    .maybeSingle();

  if (updateError) throw updateError;

  if (data) {
    PRESENCE.stream = {
      ...PRESENCE.stream,
      ...data
    };
  } else if (PRESENCE.stream?.id === streamId) {
    PRESENCE.stream = {
      ...PRESENCE.stream,
      viewer_count: viewerCount,
      peak_viewers: peakViewers
    };
  }

  emitPresence();

  return PRESENCE.stream;
}

export function clearLivePresenceRealtime() {
  const supabase = getSupabase();

  if (PRESENCE.memberChannel && supabase) {
    supabase.removeChannel(PRESENCE.memberChannel);
  }

  if (PRESENCE.sessionChannel && supabase) {
    supabase.removeChannel(PRESENCE.sessionChannel);
  }

  PRESENCE.memberChannel = null;
  PRESENCE.sessionChannel = null;
}

export function bindLivePresenceRealtime(streamId = PRESENCE.stream?.id) {
  if (!streamId) return null;

  const supabase = getSupabase();

  clearLivePresenceRealtime();

  if (RB_TABLES.liveStreamMembers) {
    PRESENCE.memberChannel = supabase
      .channel(`rb-live-members-${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: RB_TABLES.liveStreamMembers,
          filter: `stream_id=eq.${streamId}`
        },
        () => loadLiveMembers(streamId)
      )
      .subscribe();
  }

  if (RB_TABLES.liveViewSessions) {
    PRESENCE.sessionChannel = supabase
      .channel(`rb-live-sessions-${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: RB_TABLES.liveViewSessions,
          filter: `stream_id=eq.${streamId}`
        },
        async () => {
          await loadLiveViewSessions(streamId);
          await syncViewerCount(streamId);
        }
      )
      .subscribe();
  }

  return {
    memberChannel: PRESENCE.memberChannel,
    sessionChannel: PRESENCE.sessionChannel
  };
}

export async function initLivePresence({
  stream,
  user = null,
  profile = null,
  realtime = true
} = {}) {
  clearLivePresenceRealtime();

  PRESENCE.stream = stream || null;
  PRESENCE.user = user || null;
  PRESENCE.profile = profile || null;
  PRESENCE.members = [];
  PRESENCE.sessions = [];
  PRESENCE.ready = false;
  PRESENCE.loading = false;
  PRESENCE.error = null;

  if (!PRESENCE.stream?.id) {
    PRESENCE.ready = true;
    emitPresence();
    return getLivePresenceState();
  }

  PRESENCE.loading = true;
  emitPresence();

  try {
    await Promise.allSettled([
      loadLiveMembers(PRESENCE.stream.id),
      loadLiveViewSessions(PRESENCE.stream.id)
    ]);

    await syncViewerCount(PRESENCE.stream.id).catch((error) => {
      console.warn("[RB LIVE PRESENCE COUNT INIT SKIPPED]", error?.message || error);
    });

    if (realtime) {
      bindLivePresenceRealtime(PRESENCE.stream.id);
    }

    PRESENCE.ready = true;
    PRESENCE.error = null;
  } catch (error) {
    PRESENCE.error = error;
    console.warn("[RB LIVE PRESENCE INIT FAILED]", error?.message || error);
  } finally {
    PRESENCE.loading = false;
    emitPresence();
  }

  return getLivePresenceState();
}

export function resetLivePresence() {
  clearLivePresenceRealtime();

  PRESENCE.stream = null;
  PRESENCE.user = null;
  PRESENCE.profile = null;
  PRESENCE.members = [];
  PRESENCE.sessions = [];
  PRESENCE.ready = false;
  PRESENCE.loading = false;
  PRESENCE.error = null;

  emitPresence();
}

window.addEventListener("beforeunload", clearLivePresenceRealtime);

console.log("RB LIVE PRESENCE READY");
