/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-presence.js

   LIVE PRESENCE ENGINE
   Viewer presence + stream members + realtime counts
========================= */

import { getSupabase } from "/core/shared/rb-supabase.js";
import { RB_TABLES } from "/core/shared/rb-config.js";

const PRESENCE = {
  stream: null,
  user: null,
  profile: null,

  members: [],
  sessions: [],

  memberChannel: null,
  sessionChannel: null,

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
  return PRESENCE.profile?.username || PRESENCE.user?.email || "guest";
}

export function getLivePresenceState() {
  return {
    stream: PRESENCE.stream,
    user: PRESENCE.user,
    profile: PRESENCE.profile,
    members: [...PRESENCE.members],
    sessions: [...PRESENCE.sessions],
    viewerCount: PRESENCE.stream?.viewer_count || 0,
    peakViewers: PRESENCE.stream?.peak_viewers || 0
  };
}

export function onLivePresence(listener) {
  if (typeof listener !== "function") return () => {};

  PRESENCE.listeners.add(listener);
  listener(getLivePresenceState());

  return () => {
    PRESENCE.listeners.delete(listener);
  };
}

export async function loadLiveMembers(streamId = PRESENCE.stream?.id) {
  if (!streamId) return [];

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.liveStreamMembers)
    .select("*")
    .eq("stream_id", streamId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error) throw error;

  PRESENCE.members = data || [];
  emitPresence();

  return PRESENCE.members;
}

export async function loadLiveViewSessions(streamId = PRESENCE.stream?.id) {
  if (!streamId) return [];

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.liveViewSessions)
    .select("*")
    .eq("stream_id", streamId)
    .is("left_at", null)
    .order("joined_at", { ascending: true });

  if (error) throw error;

  PRESENCE.sessions = data || [];
  emitPresence();

  return PRESENCE.sessions;
}

export async function joinLivePresence({
  role = "viewer",
  anonymousId = null
} = {}) {
  if (!PRESENCE.stream?.id) {
    throw new Error("No live stream selected.");
  }

  const supabase = getSupabase();

  let member = null;
  let session = null;

  if (PRESENCE.user?.id) {
    const { data, error } = await supabase
      .from(RB_TABLES.liveStreamMembers)
      .upsert(
        {
          stream_id: PRESENCE.stream.id,
          user_id: PRESENCE.user.id,
          role,
          status: "active",
          joined_at: new Date().toISOString(),
          left_at: null,
          metadata: {
            source: "live-presence.js",
            username: username(),
            display_name: displayName()
          }
        },
        {
          onConflict: "stream_id,user_id"
        }
      )
      .select("*")
      .single();

    if (error) throw error;
    member = data;
  }

  const { data: viewData, error: viewError } = await supabase
    .from(RB_TABLES.liveViewSessions)
    .insert({
      stream_id: PRESENCE.stream.id,
      user_id: PRESENCE.user?.id || null,
      username: PRESENCE.user ? username() : null,
      display_name: PRESENCE.user ? displayName() : "Guest Viewer",
      anonymous_id: PRESENCE.user ? null : anonymousId,
      joined_at: new Date().toISOString(),
      device_info: {
        user_agent: navigator.userAgent,
        width: window.innerWidth,
        height: window.innerHeight
      },
      metadata: {
        source: "live-presence.js"
      }
    })
    .select("*")
    .single();

  if (viewError) throw viewError;
  session = viewData;

  await syncViewerCount();

  await Promise.all([
    loadLiveMembers(PRESENCE.stream.id),
    loadLiveViewSessions(PRESENCE.stream.id)
  ]);

  return { member, session };
}

export async function leaveLivePresence({
  sessionId = null,
  userId = PRESENCE.user?.id || null
} = {}) {
  if (!PRESENCE.stream?.id) return;

  const supabase = getSupabase();
  const now = new Date().toISOString();

  if (sessionId) {
    const session = PRESENCE.sessions.find((item) => item.id === sessionId);
    const joinedAt = session?.joined_at ? new Date(session.joined_at).getTime() : Date.now();
    const watchSeconds = Math.max(0, Math.floor((Date.now() - joinedAt) / 1000));

    await supabase
      .from(RB_TABLES.liveViewSessions)
      .update({
        left_at: now,
        watch_seconds: watchSeconds
      })
      .eq("id", sessionId);
  } else if (userId) {
    await supabase
      .from(RB_TABLES.liveViewSessions)
      .update({
        left_at: now
      })
      .eq("stream_id", PRESENCE.stream.id)
      .eq("user_id", userId)
      .is("left_at", null);
  }

  if (userId) {
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

  await syncViewerCount();

  await Promise.all([
    loadLiveMembers(PRESENCE.stream.id),
    loadLiveViewSessions(PRESENCE.stream.id)
  ]);
}

export async function syncViewerCount(streamId = PRESENCE.stream?.id) {
  if (!streamId) return null;

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
  const peakViewers = Math.max(Number(PRESENCE.stream?.peak_viewers || 0), viewerCount);

  const { data, error: updateError } = await supabase
    .from(RB_TABLES.liveStreams)
    .update({
      viewer_count: viewerCount,
      peak_viewers: peakViewers,
      last_activity_at: new Date().toISOString()
    })
    .eq("id", streamId)
    .select("*")
    .single();

  if (updateError) throw updateError;

  PRESENCE.stream = {
    ...PRESENCE.stream,
    ...data
  };

  emitPresence();

  return data;
}

export function clearLivePresenceRealtime() {
  const supabase = getSupabase();

  if (PRESENCE.memberChannel) {
    supabase.removeChannel(PRESENCE.memberChannel);
  }

  if (PRESENCE.sessionChannel) {
    supabase.removeChannel(PRESENCE.sessionChannel);
  }

  PRESENCE.memberChannel = null;
  PRESENCE.sessionChannel = null;
}

export function bindLivePresenceRealtime(streamId = PRESENCE.stream?.id) {
  if (!streamId) return null;

  const supabase = getSupabase();

  clearLivePresenceRealtime();

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
  PRESENCE.stream = stream || null;
  PRESENCE.user = user || null;
  PRESENCE.profile = profile || null;
  PRESENCE.members = [];
  PRESENCE.sessions = [];

  if (!PRESENCE.stream?.id) {
    emitPresence();
    return getLivePresenceState();
  }

  await Promise.all([
    loadLiveMembers(PRESENCE.stream.id),
    loadLiveViewSessions(PRESENCE.stream.id)
  ]);

  await syncViewerCount(PRESENCE.stream.id);

  if (realtime) {
    bindLivePresenceRealtime(PRESENCE.stream.id);
  }

  return getLivePresenceState();
}

window.addEventListener("beforeunload", clearLivePresenceRealtime);

console.log("RB LIVE PRESENCE READY");
