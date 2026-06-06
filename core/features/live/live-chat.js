/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-chat.js

   LIVE CHAT ENGINE
   Stream chat + pin/delete + realtime sync
   Safe Loader + API fallback ready
========================= */

import {
  getSupabase
} from "/core/shared/rb-supabase.js";

import {
  RB_TABLES
} from "/core/shared/rb-config.js";

const CHAT = {
  stream: null,
  user: null,
  profile: null,
  messages: [],
  channel: null,
  listeners: new Set(),
  ready: false,
  loading: false,
  error: null
};

function emitChat() {
  const state = getLiveChatState();

  CHAT.listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      console.warn("[RB LIVE CHAT LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-live-chat-update", {
      detail: state
    })
  );

  window.dispatchEvent(
    new CustomEvent("rb:live-chat-state", {
      detail: state
    })
  );
}

function displayName() {
  return (
    CHAT.profile?.display_name ||
    CHAT.profile?.full_name ||
    CHAT.profile?.username ||
    CHAT.user?.email?.split("@")[0] ||
    "Rich Viewer"
  );
}

function username() {
  return (
    CHAT.profile?.username ||
    CHAT.user?.email?.split("@")[0] ||
    "guest"
  );
}

function avatarUrl() {
  return (
    CHAT.profile?.avatar_url ||
    "/images/brand/Avatar-hero-Banner.png.jpeg"
  );
}

function normalizeMessage(row = {}) {
  return {
    ...row,
    message: row.message || row.body || "",
    body: row.body || row.message || "",
    username: row.username || "guest",
    display_name: row.display_name || row.username || "Rich Viewer",
    avatar_url:
      row.avatar_url ||
      row.profile_avatar ||
      row.metadata?.avatar_url ||
      "/images/brand/Avatar-hero-Banner.png.jpeg",
    is_deleted: Boolean(row.is_deleted),
    is_pinned: Boolean(row.is_pinned)
  };
}

export function getLiveChatState() {
  return {
    ready: CHAT.ready,
    loading: CHAT.loading,
    error: CHAT.error,
    stream: CHAT.stream,
    user: CHAT.user,
    profile: CHAT.profile,
    messages: [...CHAT.messages]
  };
}

export function onLiveChat(listener) {
  if (typeof listener !== "function") return () => {};

  CHAT.listeners.add(listener);

  try {
    listener(getLiveChatState());
  } catch (error) {
    console.warn("[RB LIVE CHAT LISTENER]", error);
  }

  return () => {
    CHAT.listeners.delete(listener);
  };
}

export async function loadLiveChat(streamId = CHAT.stream?.id) {
  if (!streamId || !RB_TABLES.liveChatMessages) {
    CHAT.messages = [];
    CHAT.ready = true;
    CHAT.loading = false;
    emitChat();
    return [];
  }

  const supabase = getSupabase();

  CHAT.loading = true;
  CHAT.error = null;
  emitChat();

  const attempts = [
    {
      name: "not_deleted_pinned",
      run: () =>
        supabase
          .from(RB_TABLES.liveChatMessages)
          .select("*")
          .eq("stream_id", streamId)
          .eq("is_deleted", false)
          .order("is_pinned", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(100)
    },
    {
      name: "created_only",
      run: () =>
        supabase
          .from(RB_TABLES.liveChatMessages)
          .select("*")
          .eq("stream_id", streamId)
          .order("created_at", { ascending: true })
          .limit(100)
    },
    {
      name: "latest_fallback",
      run: () =>
        supabase
          .from(RB_TABLES.liveChatMessages)
          .select("*")
          .eq("stream_id", streamId)
          .limit(100)
    }
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const { data, error } = await attempt.run();

      if (error) throw error;

      CHAT.messages = (data || [])
        .map(normalizeMessage)
        .filter((message) => !message.is_deleted);

      CHAT.ready = true;
      CHAT.error = null;
      return CHAT.messages;
    } catch (error) {
      lastError = error;
      console.warn(`[RB LIVE CHAT LOAD SKIPPED: ${attempt.name}]`, error?.message || error);
    } finally {
      CHAT.loading = false;
      emitChat();
    }
  }

  CHAT.messages = [];
  CHAT.ready = true;
  CHAT.error = lastError;
  CHAT.loading = false;
  emitChat();

  return [];
}

export async function sendLiveChatMessage(message) {
  const text = String(message || "").trim();

  if (!CHAT.stream?.id) {
    throw new Error("No live stream selected.");
  }

  if (!text) {
    throw new Error("Message is empty.");
  }

  if (CHAT.stream.is_chat_enabled === false) {
    throw new Error("Chat is disabled for this stream.");
  }

  const supabase = getSupabase();

  const payload = {
    stream_id: CHAT.stream.id,
    user_id: CHAT.user?.id || null,
    username: CHAT.user ? username() : "guest",
    display_name: CHAT.user ? displayName() : "Guest Viewer",
    avatar_url: CHAT.user ? avatarUrl() : null,
    message: text,
    body: text,
    metadata: {
      source: "live-chat.js",
      avatar_url: avatarUrl()
    }
  };

  const { data, error } = await supabase
    .from(RB_TABLES.liveChatMessages)
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  const row = normalizeMessage(data || payload);

  if (row?.id) {
    const exists = CHAT.messages.some((item) => item.id === row.id);

    if (!exists) {
      CHAT.messages.push(row);
      emitChat();
    }
  }

  await syncChatCount();

  return row;
}

export async function sendLiveChatMessageViaApi(message) {
  const text = String(message || "").trim();

  if (!CHAT.stream?.id) {
    throw new Error("No live stream selected.");
  }

  if (!text) {
    throw new Error("Message is empty.");
  }

  const supabase = getSupabase();

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    throw new Error("Sign in required to send chat.");
  }

  const response = await fetch("/api/live-chat-send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      stream_id: CHAT.stream.id,
      message: text,
      username: username(),
      display_name: displayName(),
      avatar_url: avatarUrl()
    })
  });

  const data = await response.json();

  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || "Live chat send failed.");
  }

  await loadLiveChat(CHAT.stream.id);
  await syncChatCount();

  return data;
}

export async function sendLiveChat(message, {
  useApi = false
} = {}) {
  if (useApi) {
    return await sendLiveChatMessageViaApi(message);
  }

  try {
    return await sendLiveChatMessage(message);
  } catch (error) {
    console.warn("[RB LIVE CHAT DIRECT SEND FAILED]", error?.message || error);

    if (CHAT.user?.id) {
      return await sendLiveChatMessageViaApi(message);
    }

    throw error;
  }
}

export async function syncChatCount() {
  if (!CHAT.stream?.id || !RB_TABLES.liveChatMessages) return 0;

  const supabase = getSupabase();

  let count = 0;

  try {
    const result = await supabase
      .from(RB_TABLES.liveChatMessages)
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("stream_id", CHAT.stream.id)
      .eq("is_deleted", false);

    count = result.count || 0;
  } catch {
    const result = await supabase
      .from(RB_TABLES.liveChatMessages)
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("stream_id", CHAT.stream.id);

    count = result.count || 0;
  }

  CHAT.stream.total_chat_messages = count;

  if (RB_TABLES.liveStreams) {
    await supabase
      .from(RB_TABLES.liveStreams)
      .update({
        total_chat_messages: count,
        last_activity_at: new Date().toISOString()
      })
      .eq("id", CHAT.stream.id);
  }

  emitChat();

  return count;
}

export async function pinLiveChatMessage(messageId, pinned = true) {
  if (!messageId) return null;

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.liveChatMessages)
    .update({
      is_pinned: Boolean(pinned),
      updated_at: new Date().toISOString()
    })
    .eq("id", messageId)
    .select("*")
    .maybeSingle();

  if (error) throw error;

  await loadLiveChat();

  return normalizeMessage(data || {});
}

export async function deleteLiveChatMessage(messageId) {
  if (!messageId) return null;

  const supabase = getSupabase();

  const attempts = [
    {
      name: "soft_delete",
      run: () =>
        supabase
          .from(RB_TABLES.liveChatMessages)
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", messageId)
          .select("*")
          .maybeSingle()
    },
    {
      name: "hard_delete",
      run: () =>
        supabase
          .from(RB_TABLES.liveChatMessages)
          .delete()
          .eq("id", messageId)
          .select("*")
          .maybeSingle()
    }
  ];

  let finalRow = null;
  let lastError = null;

  for (const attempt of attempts) {
    try {
      const { data, error } = await attempt.run();
      if (error) throw error;

      finalRow = data || null;
      break;
    } catch (error) {
      lastError = error;
      console.warn(`[RB LIVE CHAT DELETE SKIPPED: ${attempt.name}]`, error?.message || error);
    }
  }

  if (!finalRow && lastError) throw lastError;

  CHAT.messages = CHAT.messages.filter((item) => item.id !== messageId);

  await syncChatCount();
  emitChat();

  return finalRow ? normalizeMessage(finalRow) : null;
}

export function clearLiveChatRealtime() {
  const supabase = getSupabase();

  if (CHAT.channel && supabase) {
    supabase.removeChannel(CHAT.channel);
  }

  CHAT.channel = null;
}

export function bindLiveChatRealtime(streamId = CHAT.stream?.id) {
  if (!streamId || !RB_TABLES.liveChatMessages) return null;

  const supabase = getSupabase();

  clearLiveChatRealtime();

  CHAT.channel = supabase
    .channel(`rb-live-chat-${streamId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: RB_TABLES.liveChatMessages,
        filter: `stream_id=eq.${streamId}`
      },
      async (payload) => {
        const eventType = payload.eventType;

        if (eventType === "DELETE" && payload.old?.id) {
          CHAT.messages = CHAT.messages.filter((item) => item.id !== payload.old.id);
          emitChat();
          return;
        }

        await loadLiveChat(streamId);
      }
    )
    .subscribe((status) => {
      window.dispatchEvent(
        new CustomEvent("rb:live-chat-realtime-status", {
          detail: {
            status,
            streamId
          }
        })
      );
    });

  return CHAT.channel;
}

export async function initLiveChat({
  stream,
  user = null,
  profile = null,
  realtime = true
} = {}) {
  clearLiveChatRealtime();

  CHAT.stream = stream || null;
  CHAT.user = user || null;
  CHAT.profile = profile || null;
  CHAT.messages = [];
  CHAT.ready = false;
  CHAT.loading = false;
  CHAT.error = null;

  if (!CHAT.stream?.id) {
    CHAT.ready = true;
    emitChat();
    return getLiveChatState();
  }

  await loadLiveChat(CHAT.stream.id);

  if (realtime) {
    bindLiveChatRealtime(CHAT.stream.id);
  }

  return getLiveChatState();
}

export function resetLiveChat() {
  clearLiveChatRealtime();

  CHAT.stream = null;
  CHAT.user = null;
  CHAT.profile = null;
  CHAT.messages = [];
  CHAT.ready = false;
  CHAT.loading = false;
  CHAT.error = null;

  emitChat();
}

window.addEventListener("beforeunload", clearLiveChatRealtime);

console.log("RB LIVE CHAT READY");
