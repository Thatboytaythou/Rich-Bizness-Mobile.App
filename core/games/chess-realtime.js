/* =========================
   RICH BIZNESS MOBILE
   /core/games/chess-realtime.js

   RICH CHESS REALTIME ENGINE
   Supabase room sync + move broadcast + room presence
========================= */

import { getSupabase } from "/core/shared/rb-supabase.js";
import { RB_TABLES } from "/core/shared/rb-config.js";

const REALTIME = {
  supabase: null,
  roomCode: null,
  roomId: null,
  user: null,
  profile: null,

  room: null,
  state: null,

  roomChannel: null,
  moveChannel: null,
  presenceChannel: null,

  listeners: new Set(),
  moveListeners: new Set(),
  presenceListeners: new Set()
};

function table(name, fallback) {
  return RB_TABLES?.[name] || fallback;
}

function makeRoomCode() {
  return `RB-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function displayName() {
  return (
    REALTIME.profile?.display_name ||
    REALTIME.profile?.full_name ||
    REALTIME.profile?.username ||
    REALTIME.user?.email?.split("@")[0] ||
    "Rich Player"
  );
}

function username() {
  return (
    REALTIME.profile?.username ||
    REALTIME.user?.email?.split("@")[0] ||
    "rich_player"
  );
}

function emitRealtime() {
  const state = getChessRealtimeState();

  REALTIME.listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      console.warn("[RB CHESS REALTIME LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-chess-realtime-update", {
      detail: state
    })
  );
}

function emitMove(move) {
  REALTIME.moveListeners.forEach((listener) => {
    try {
      listener(move, getChessRealtimeState());
    } catch (error) {
      console.warn("[RB CHESS MOVE LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-chess-realtime-move", {
      detail: {
        move,
        state: getChessRealtimeState()
      }
    })
  );
}

function emitPresence(presence) {
  REALTIME.presenceListeners.forEach((listener) => {
    try {
      listener(presence, getChessRealtimeState());
    } catch (error) {
      console.warn("[RB CHESS PRESENCE LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-chess-presence-update", {
      detail: presence
    })
  );
}

export function getChessRealtimeState() {
  return {
    roomCode: REALTIME.roomCode,
    roomId: REALTIME.roomId,
    user: REALTIME.user,
    profile: REALTIME.profile,
    room: REALTIME.room,
    state: REALTIME.state,
    connected: Boolean(
      REALTIME.roomChannel ||
        REALTIME.moveChannel ||
        REALTIME.presenceChannel
    )
  };
}

export function onChessRealtime(listener) {
  if (typeof listener !== "function") return () => {};

  REALTIME.listeners.add(listener);
  listener(getChessRealtimeState());

  return () => REALTIME.listeners.delete(listener);
}

export function onChessRealtimeMove(listener) {
  if (typeof listener !== "function") return () => {};

  REALTIME.moveListeners.add(listener);

  return () => REALTIME.moveListeners.delete(listener);
}

export function onChessPresence(listener) {
  if (typeof listener !== "function") return () => {};

  REALTIME.presenceListeners.add(listener);

  return () => REALTIME.presenceListeners.delete(listener);
}

export async function createChessRealtimeRoom({
  roomCode = makeRoomCode(),
  initialState = {},
  gameKey = "rich-chess"
} = {}) {
  const supabase = REALTIME.supabase || getSupabase();

  if (!supabase) {
    throw new Error("Supabase client missing.");
  }

  const payload = {
    room_code: roomCode,
    game_key: gameKey,
    host_user_id: REALTIME.user?.id || null,
    status: "active",
    current_turn: initialState.turn || "w",
    board_state: initialState.board || null,
    game_state: {
      ...initialState,
      roomCode,
      source: "chess-realtime.js"
    },
    metadata: {
      source: "chess-realtime.js",
      username: username(),
      display_name: displayName()
    },
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(table("gameRooms", "game_rooms"))
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  REALTIME.room = data;
  REALTIME.roomId = data.id;
  REALTIME.roomCode = data.room_code || roomCode;
  REALTIME.state = data.game_state || initialState;

  await bindChessRealtimeRoom({
    roomCode: REALTIME.roomCode,
    roomId: REALTIME.roomId
  });

  emitRealtime();

  return data;
}

export async function joinChessRealtimeRoom(roomCode) {
  const code = String(roomCode || "").trim();

  if (!code) {
    throw new Error("Missing chess room code.");
  }

  const supabase = REALTIME.supabase || getSupabase();

  if (!supabase) {
    throw new Error("Supabase client missing.");
  }

  const { data, error } = await supabase
    .from(table("gameRooms", "game_rooms"))
    .select("*")
    .eq("room_code", code)
    .eq("game_key", "rich-chess")
    .in("status", ["active", "waiting"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!data?.id) {
    throw new Error("Chess room not found.");
  }

  REALTIME.room = data;
  REALTIME.roomId = data.id;
  REALTIME.roomCode = data.room_code;
  REALTIME.state = data.game_state || {};

  await upsertChessRoomMember({
    role: "player",
    status: "active"
  });

  await bindChessRealtimeRoom({
    roomCode: REALTIME.roomCode,
    roomId: REALTIME.roomId
  });

  emitRealtime();

  return data;
}

export async function upsertChessRoomMember({
  role = "player",
  status = "active"
} = {}) {
  if (!REALTIME.roomId) return null;

  const supabase = REALTIME.supabase || getSupabase();

  const payload = {
    room_id: REALTIME.roomId,
    user_id: REALTIME.user?.id || null,
    username: username(),
    display_name: displayName(),
    role,
    status,
    joined_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      source: "chess-realtime.js",
      room_code: REALTIME.roomCode
    }
  };

  if (REALTIME.user?.id) {
    const { data, error } = await supabase
      .from(table("gameRoomMembers", "game_room_members"))
      .upsert(payload, {
        onConflict: "room_id,user_id"
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from(table("gameRoomMembers", "game_room_members"))
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function syncChessRealtimeState(state = {}) {
  if (!REALTIME.roomId) return null;

  const supabase = REALTIME.supabase || getSupabase();

  const payload = {
    current_turn: state.turn || "w",
    board_state: state.board || null,
    game_state: {
      ...state,
      roomCode: REALTIME.roomCode,
      updated_at: new Date().toISOString()
    },
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from(table("gameRooms", "game_rooms"))
    .update(payload)
    .eq("id", REALTIME.roomId)
    .select("*")
    .single();

  if (error) throw error;

  REALTIME.room = data;
  REALTIME.state = data.game_state || state;

  emitRealtime();

  return data;
}

export async function sendChessRealtimeMove(move = {}, state = {}) {
  if (!REALTIME.roomId) return null;

  const supabase = REALTIME.supabase || getSupabase();

  const payload = {
    room_id: REALTIME.roomId,
    game_key: "rich-chess",
    user_id: REALTIME.user?.id || null,
    username: username(),
    display_name: displayName(),
    move_number: state.moves?.length || 0,
    move_data: move,
    from_square: move.from || null,
    to_square: move.to || null,
    piece: move.piece || null,
    captured_piece: move.captured || null,
    turn: move.turn || state.turn || null,
    metadata: {
      source: "chess-realtime.js",
      room_code: REALTIME.roomCode
    }
  };

  const { data, error } = await supabase
    .from(table("gameMoves", "game_moves"))
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  await syncChessRealtimeState(state);

  emitMove(data);

  return data;
}

export async function endChessRealtimeRoom({
  status = "ended",
  winner = null,
  finalState = null
} = {}) {
  if (!REALTIME.roomId) return null;

  const supabase = REALTIME.supabase || getSupabase();

  const { data, error } = await supabase
    .from(table("gameRooms", "game_rooms"))
    .update({
      status,
      winner_user_id: winner || null,
      game_state: finalState || REALTIME.state || {},
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", REALTIME.roomId)
    .select("*")
    .single();

  if (error) throw error;

  REALTIME.room = data;
  REALTIME.state = data.game_state || REALTIME.state;

  emitRealtime();

  return data;
}

export async function loadChessRealtimeMoves(roomId = REALTIME.roomId) {
  if (!roomId) return [];

  const supabase = REALTIME.supabase || getSupabase();

  const { data, error } = await supabase
    .from(table("gameMoves", "game_moves"))
    .select("*")
    .eq("room_id", roomId)
    .eq("game_key", "rich-chess")
    .order("move_number", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(300);

  if (error) throw error;

  return data || [];
}

export function clearChessRealtime({ keepRoom = false } = {}) {
  const supabase = REALTIME.supabase || getSupabase();

  [
    REALTIME.roomChannel,
    REALTIME.moveChannel,
    REALTIME.presenceChannel
  ].forEach((channel) => {
    if (channel && supabase) {
      supabase.removeChannel(channel);
    }
  });

  REALTIME.roomChannel = null;
  REALTIME.moveChannel = null;
  REALTIME.presenceChannel = null;

  if (!keepRoom) {
    REALTIME.roomCode = null;
    REALTIME.roomId = null;
    REALTIME.room = null;
    REALTIME.state = null;
  }

  emitRealtime();
}

export async function bindChessRealtimeRoom({
  roomCode = REALTIME.roomCode,
  roomId = REALTIME.roomId
} = {}) {
  if (!roomCode || !roomId) return null;

  const supabase = REALTIME.supabase || getSupabase();

  clearChessRealtime({ keepRoom: true });

  REALTIME.roomChannel = supabase
    .channel(`rb-chess-room-${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: table("gameRooms", "game_rooms"),
        filter: `id=eq.${roomId}`
      },
      (payload) => {
        if (payload.new?.id) {
          REALTIME.room = payload.new;
          REALTIME.state = payload.new.game_state || REALTIME.state;
          emitRealtime();
        }
      }
    )
    .subscribe();

  REALTIME.moveChannel = supabase
    .channel(`rb-chess-moves-${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: table("gameMoves", "game_moves"),
        filter: `room_id=eq.${roomId}`
      },
      (payload) => {
        if (payload.new?.id) {
          emitMove(payload.new);
        }
      }
    )
    .subscribe();

  REALTIME.presenceChannel = supabase.channel(`rb-chess-presence-${roomCode}`);

  REALTIME.presenceChannel
    .on("presence", { event: "sync" }, () => {
      const state = REALTIME.presenceChannel.presenceState();
      emitPresence(state);
    })
    .on("presence", { event: "join" }, ({ key, newPresences }) => {
      emitPresence({
        type: "join",
        key,
        presences: newPresences
      });
    })
    .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      emitPresence({
        type: "leave",
        key,
        presences: leftPresences
      });
    })
    .subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;

      await REALTIME.presenceChannel.track({
        user_id: REALTIME.user?.id || null,
        username: username(),
        display_name: displayName(),
        room_code: roomCode,
        online_at: new Date().toISOString()
      });
    });

  emitRealtime();

  return {
    roomChannel: REALTIME.roomChannel,
    moveChannel: REALTIME.moveChannel,
    presenceChannel: REALTIME.presenceChannel
  };
}

export async function initChessRealtime({
  user = null,
  profile = null,
  roomCode = null,
  roomId = null,
  realtime = true
} = {}) {
  REALTIME.supabase = getSupabase();
  REALTIME.user = user || null;
  REALTIME.profile = profile || null;
  REALTIME.roomCode = roomCode || null;
  REALTIME.roomId = roomId || null;

  if (roomCode && !roomId) {
    await joinChessRealtimeRoom(roomCode);
    return getChessRealtimeState();
  }

  if (realtime && roomCode && roomId) {
    await bindChessRealtimeRoom({ roomCode, roomId });
  }

  emitRealtime();

  return getChessRealtimeState();
}

window.addEventListener("beforeunload", () => {
  clearChessRealtime();
});

console.log("RB CHESS REALTIME READY");
