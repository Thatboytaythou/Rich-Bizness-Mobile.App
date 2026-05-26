/* =========================
   RICH BIZNESS MOBILE
   /core/features/live/live-chat.js
========================= */

import { getSupabase } from "/core/shared/rb-supabase.js";
import { RB_TABLES } from "/core/shared/rb-config.js";

const CHAT = {
  stream: null,
  user: null,
  profile: null,
  messages: [],
  channel: null,
  listeners: new Set()
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
  return CHAT.profile?.username || CHAT.user?.email || "guest";
}

export function getLiveChatState() {
  return {
    stream: CHAT.stream,
    user: CHAT.user,
    profile: CHAT.profile,
    messages: [...CHAT.messages]
  };
}

export function onLiveChat(listener) {
  if (typeof listener !== "function") return () => {};

  CHAT.listeners.add(listener);
  listener(getLiveChatState());

  return () => {
    CHAT.listeners.delete(listener);
  };
}

export async function loadLiveChat(streamId = CHAT.stream?.id) {
  if (!streamId) return [];

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.liveChatMessages)
    .select("*")
    .eq("stream_id", streamId)
    .eq("is_deleted", false)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) throw error;

  CHAT.messages = data || [];
  emitChat();

  return CHAT.messages;
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

  const { data, error } = await supabase
    .from(RB_TABLES.liveChatMessages)
    .insert({
      stream_id: CHAT.stream.id,
      user_id: CHAT.user?.id || null,
      username: CHAT.user ? username() : "guest",
      display_name: CHAT.user ? displayName() : "Guest Viewer",
      message: text,
      body: text,
      metadata: {
        source: "live-chat.js"
      }
    })
    .select("*")
    .single();

  if (error) throw error;

  CHAT.messages.push(data);
  emitChat();

  await syncChatCount();

  return data;
}

async function syncChatCount() {
  if (!CHAT.stream?.id) return;

  const supabase = getSupabase();

  const { count } = await supabase
    .from(RB_TABLES.liveChatMessages)
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("stream_id", CHAT.stream.id)
    .eq("is_deleted", false);

  CHAT.stream.total_chat_messages = count || 0;

  await supabase
    .from(RB_TABLES.liveStreams)
    .update({
      total_chat_messages: count || 0,
      last_activity_at: new Date().toISOString()
    })
    .eq("id", CHAT.stream.id);
}

export async function pinLiveChatMessage(messageId, pinned = true) {
  if (!messageId) return null;

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.liveChatMessages)
    .update({
      is_pinned: pinned
    })
    .eq("id", messageId)
    .select("*")
    .single();

  if (error) throw error;

  await loadLiveChat();

  return data;
}

export async function deleteLiveChatMessage(messageId) {
  if (!messageId) return null;

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(RB_TABLES.liveChatMessages)
    .update({
      is_deleted: true
    })
    .eq("id", messageId)
    .select("*")
    .single();

  if (error) throw error;

  await loadLiveChat();
  await syncChatCount();

  return data;
}

export function clearLiveChatRealtime() {
  const supabase = getSupabase();

  if (CHAT.channel && supabase) {
    supabase.removeChannel(CHAT.channel);
  }

  CHAT.channel = null;
}

export function bindLiveChatRealtime(streamId = CHAT.stream?.id) {
  if (!streamId) return null;

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
      () => loadLiveChat(streamId)
    )
    .subscribe();

  return CHAT.channel;
}

export async function initLiveChat({
  stream,
  user = null,
  profile = null,
  realtime = true
} = {}) {
  CHAT.stream = stream || null;
  CHAT.user = user || null;
  CHAT.profile = profile || null;
  CHAT.messages = [];

  if (!CHAT.stream?.id) {
    emitChat();
    return getLiveChatState();
  }

  await loadLiveChat(CHAT.stream.id);

  if (realtime) {
    bindLiveChatRealtime(CHAT.stream.id);
  }

  return getLiveChatState();
}

window.addEventListener("beforeunload", clearLiveChatRealtime);

console.log("RB LIVE CHAT READY");
