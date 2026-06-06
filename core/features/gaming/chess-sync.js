/* =========================
   RICH BIZNESS MOBILE
   /core/features/gaming/chess-sync.js

   RICH CHESS SYNC
   Shared chess room state + realtime multiplayer handoff
========================= */

import { RB_TABLES } from "/core/shared/rb-config.js";

import {
  getSupabase,
  getUser,
  rbInsert,
  rbUpdate,
  rbSelect
} from "/core/shared/rb-supabase.js";

import {
  getProfileIdentity
} from "/core/shared/rb-profile.js";

const CHESS = {
  user: null,
  profile: null,

  room: null,
  board: null,
  moves: [],
  players: [],

  channel: null,
  listeners: new Set()
};

const START_BOARD = [
  ["br", "bn", "bb", "bq", "bk", "bb", "bn", "br"],
  ["bp", "bp", "bp", "bp", "bp", "bp", "bp", "bp"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["wp", "wp", "wp", "wp", "wp", "wp", "wp", "wp"],
  ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"]
];

function tableRooms() {
  return RB_TABLES.chessRooms || RB_TABLES.gameRooms || "game_rooms";
}

function tableMoves() {
  return RB_TABLES.chessMoves || RB_TABLES.gameMoves || "game_moves";
}

function tablePlayers() {
  return RB_TABLES.chessPlayers || RB_TABLES.gameRoomPlayers || "game_room_players";
}

function cloneBoard(board = START_BOARD) {
  return board.map((row) => [...row]);
}

function nowIso() {
  return new Date().toISOString();
}

function identity() {
  CHESS.user = getUser?.() || CHESS.user || null;
  CHESS.profile = getProfileIdentity?.() || CHESS.profile || null;

  return {
    user: CHESS.user,
    profile: CHESS.profile
  };
}

function emitChessSync() {
  const snapshot = getChessSyncState();

  CHESS.listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.warn("[RB CHESS SYNC LISTENER]", error);
    }
  });

  window.dispatchEvent(
    new CustomEvent("rb-chess-sync-update", {
      detail: snapshot
    })
  );
}

function normalizeRoom(row = {}) {
  return {
    ...row,
    board_state: row.board_state || row.board || cloneBoard(),
    turn: row.turn || row.current_turn || "white",
    status: row.status || "waiting"
  };
}

function normalizeMove(row = {}) {
  return {
    ...row,
    from_row: Number(row.from_row),
    from_col: Number(row.from_col),
    to_row: Number(row.to_row),
    to_col: Number(row.to_col),
    move_number: Number(row.move_number || 0)
  };
}

function playerColorFromRows(rows = []) {
  const hasWhite = rows.some((row) => row.color === "white");
  const hasBlack = rows.some((row) => row.color === "black");

  if (!hasWhite) return "white";
  if (!hasBlack) return "black";

  return "spectator";
}

function applyMoveToBoard(board, move = {}) {
  const next = cloneBoard(board);

  const piece = next[move.from_row]?.[move.from_col] || null;

  if (!piece) return next;

  next[move.from_row][move.from_col] = null;
  next[move.to_row][move.to_col] = move.promotion_piece || piece;

  return next;
}

export function getChessSyncState() {
  return {
    user: CHESS.user,
    profile: CHESS.profile,
    room: CHESS.room,
    board: CHESS.board ? cloneBoard(CHESS.board) : null,
    moves: [...CHESS.moves],
    players: [...CHESS.players]
  };
}

export function onChessSync(listener) {
  if (typeof listener !== "function") return () => {};

  CHESS.listeners.add(listener);
  listener(getChessSyncState());

  return () => {
    CHESS.listeners.delete(listener);
  };
}

export async function createChessRoom({
  gameId = "rich-chess",
  title = "Rich Chess Match",
  visibility = "public",
  metadata = {}
} = {}) {
  identity();

  if (!CHESS.user?.id) {
    throw new Error("Sign in before creating a chess room.");
  }

  const id = crypto.randomUUID();

  const roomPayload = {
    id,
    game_id: gameId,
    title,
    room_type: "chess",
    status: "waiting",
    visibility,
    creator_id: CHESS.user.id,
    host_user_id: CHESS.user.id,
    turn: "white",
    current_turn: "white",
    board_state: cloneBoard(),
    move_count: 0,
    winner_id: null,
    winner_color: null,
    started_at: null,
    ended_at: null,
    updated_at: nowIso(),
    metadata: {
      source: "chess-sync.js",
      ...metadata
    }
  };

  const rows = await rbInsert({
    table: tableRooms(),
    values: roomPayload
  });

  CHESS.room = normalizeRoom(rows?.[0] || roomPayload);
  CHESS.board = cloneBoard(CHESS.room.board_state);

  await joinChessRoom({
    roomId: CHESS.room.id,
    color: "white"
  });

  await bindChessRealtime(CHESS.room.id);

  emitChessSync();

  return CHESS.room;
}

export async function loadChessRoom(roomId) {
  if (!roomId) return null;

  const row = await rbSelect({
    table: tableRooms(),
    match: { id: roomId },
    maybeSingle: true
  });

  if (!row?.id) {
    CHESS.room = null;
    CHESS.board = null;
    CHESS.moves = [];
    CHESS.players = [];
    emitChessSync();
    return null;
  }

  CHESS.room = normalizeRoom(row);
  CHESS.board = cloneBoard(CHESS.room.board_state);

  await Promise.all([
    loadChessPlayers(roomId),
    loadChessMoves(roomId)
  ]);

  emitChessSync();

  return CHESS.room;
}

export async function loadChessPlayers(roomId = CHESS.room?.id) {
  if (!roomId) return [];

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(tablePlayers())
    .select("*")
    .eq("room_id", roomId)
    .order("joined_at", { ascending: true });

  if (error) {
    console.warn("[RB CHESS PLAYERS LOAD]", error?.message || error);
    CHESS.players = [];
    emitChessSync();
    return [];
  }

  CHESS.players = data || [];
  emitChessSync();

  return CHESS.players;
}

export async function loadChessMoves(roomId = CHESS.room?.id) {
  if (!roomId) return [];

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(tableMoves())
    .select("*")
    .eq("room_id", roomId)
    .order("move_number", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[RB CHESS MOVES LOAD]", error?.message || error);
    CHESS.moves = [];
    emitChessSync();
    return [];
  }

  CHESS.moves = (data || []).map(normalizeMove);
  emitChessSync();

  return CHESS.moves;
}

export async function joinChessRoom({
  roomId,
  color = null
} = {}) {
  identity();

  if (!CHESS.user?.id) {
    throw new Error("Sign in before joining chess.");
  }

  const targetRoomId = roomId || CHESS.room?.id;

  if (!targetRoomId) {
    throw new Error("Missing chess room id.");
  }

  await loadChessPlayers(targetRoomId);

  const chosenColor = color || playerColorFromRows(CHESS.players);
  const role = chosenColor === "spectator" ? "spectator" : "player";

  const payload = {
    room_id: targetRoomId,
    user_id: CHESS.user.id,
    color: chosenColor,
    role,
    status: "active",
    username:
      CHESS.profile?.username ||
      CHESS.user.email?.split("@")?.[0] ||
      "rich_player",
    display_name:
      CHESS.profile?.display_name ||
      CHESS.profile?.username ||
      "Rich Player",
    avatar_url: CHESS.profile?.avatar_url || null,
    joined_at: nowIso(),
    left_at: null,
    metadata: {
      source: "chess-sync.js"
    }
  };

  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(tablePlayers())
    .upsert(payload, {
      onConflict: "room_id,user_id"
    })
    .select("*")
    .single();

  if (error) throw error;

  await loadChessPlayers(targetRoomId);

  const activePlayers = CHESS.players.filter((player) => player.role === "player");

  if (activePlayers.length >= 2 && CHESS.room?.status === "waiting") {
    await rbUpdate({
      table: tableRooms(),
      match: { id: targetRoomId },
      values: {
        status: "active",
        started_at: nowIso(),
        updated_at: nowIso()
      }
    });

    await loadChessRoom(targetRoomId);
  }

  emitChessSync();

  return data;
}

export async function leaveChessRoom({
  roomId = CHESS.room?.id,
  userId = CHESS.user?.id
} = {}) {
  if (!roomId || !userId) return false;

  const rows = await rbUpdate({
    table: tablePlayers(),
    match: {
      room_id: roomId,
      user_id: userId
    },
    values: {
      status: "left",
      left_at: nowIso(),
      updated_at: nowIso()
    }
  });

  await loadChessPlayers(roomId);

  return rows?.[0] || true;
}

export function myChessPlayer() {
  identity();

  if (!CHESS.user?.id) return null;

  return CHESS.players.find((player) => player.user_id === CHESS.user.id) || null;
}

export function canMoveChess() {
  const player = myChessPlayer();

  if (!player || player.role !== "player") return false;
  if (!CHESS.room || CHESS.room.status !== "active") return false;

  return player.color === CHESS.room.turn;
}

export async function pushChessMove({
  from,
  to,
  piece = null,
  captured = null,
  promotionPiece = null,
  check = false,
  checkmate = false,
  boardState = null,
  metadata = {}
} = {}) {
  identity();

  if (!CHESS.room?.id) {
    throw new Error("No chess room loaded.");
  }

  if (!canMoveChess()) {
    throw new Error("Not your turn.");
  }

  if (!from || !to) {
    throw new Error("Missing move coordinates.");
  }

  const player = myChessPlayer();
  const moveNumber = Number(CHESS.room.move_count || CHESS.moves.length || 0) + 1;
  const nextTurn = CHESS.room.turn === "white" ? "black" : "white";

  const nextBoard = boardState
    ? cloneBoard(boardState)
    : applyMoveToBoard(CHESS.board || cloneBoard(), {
        from_row: from.row,
        from_col: from.col,
        to_row: to.row,
        to_col: to.col,
        promotion_piece: promotionPiece
      });

  const movePayload = {
    room_id: CHESS.room.id,
    game_id: CHESS.room.game_id || "rich-chess",
    user_id: CHESS.user.id,
    player_id: player?.id || null,
    color: player?.color || CHESS.room.turn,

    move_number: moveNumber,

    from_row: from.row,
    from_col: from.col,
    to_row: to.row,
    to_col: to.col,

    piece,
    captured_piece: captured,
    promotion_piece: promotionPiece,

    is_check: Boolean(check),
    is_checkmate: Boolean(checkmate),

    board_state_after: nextBoard,

    metadata: {
      source: "chess-sync.js",
      ...metadata
    }
  };

  const rows = await rbInsert({
    table: tableMoves(),
    values: movePayload
  });

  const move = normalizeMove(rows?.[0] || movePayload);

  const roomPatch = {
    board_state: nextBoard,
    turn: nextTurn,
    current_turn: nextTurn,
    move_count: moveNumber,
    last_move_id: move.id || null,
    updated_at: nowIso()
  };

  if (checkmate) {
    roomPatch.status = "ended";
    roomPatch.winner_id = CHESS.user.id;
    roomPatch.winner_color = player?.color || CHESS.room.turn;
    roomPatch.ended_at = nowIso();
  }

  const updated = await rbUpdate({
    table: tableRooms(),
    match: { id: CHESS.room.id },
    values: roomPatch
  });

  CHESS.room = normalizeRoom(updated?.[0] || {
    ...CHESS.room,
    ...roomPatch
  });

  CHESS.board = cloneBoard(nextBoard);
  CHESS.moves.push(move);

  emitChessSync();

  return move;
}

export async function resignChessRoom({
  roomId = CHESS.room?.id
} = {}) {
  identity();

  if (!roomId || !CHESS.user?.id) {
    throw new Error("Missing chess room or user.");
  }

  const player = myChessPlayer();

  const winner = CHESS.players.find(
    (item) => item.role === "player" && item.user_id !== CHESS.user.id
  );

  const rows = await rbUpdate({
    table: tableRooms(),
    match: { id: roomId },
    values: {
      status: "ended",
      winner_id: winner?.user_id || null,
      winner_color: winner?.color || null,
      ended_at: nowIso(),
      updated_at: nowIso(),
      metadata: {
        ...(CHESS.room?.metadata || {}),
        resigned_by: CHESS.user.id,
        resigned_color: player?.color || null,
        source: "chess-sync.js"
      }
    }
  });

  CHESS.room = normalizeRoom(rows?.[0] || CHESS.room);
  emitChessSync();

  return CHESS.room;
}

export async function resetChessRoom({
  roomId = CHESS.room?.id
} = {}) {
  identity();

  if (!roomId) {
    throw new Error("Missing chess room id.");
  }

  const room = CHESS.room || await loadChessRoom(roomId);

  if (room?.creator_id && room.creator_id !== CHESS.user?.id) {
    throw new Error("Only the room creator can reset this chess room.");
  }

  const rows = await rbUpdate({
    table: tableRooms(),
    match: { id: roomId },
    values: {
      status: "waiting",
      turn: "white",
      current_turn: "white",
      board_state: cloneBoard(),
      move_count: 0,
      winner_id: null,
      winner_color: null,
      started_at: null,
      ended_at: null,
      last_move_id: null,
      updated_at: nowIso()
    }
  });

  CHESS.room = normalizeRoom(rows?.[0] || CHESS.room);
  CHESS.board = cloneBoard();
  CHESS.moves = [];

  emitChessSync();

  return CHESS.room;
}

export function clearChessRealtime() {
  const supabase = getSupabase();

  if (CHESS.channel && supabase) {
    supabase.removeChannel(CHESS.channel);
  }

  CHESS.channel = null;
}

export function bindChessRealtime(roomId = CHESS.room?.id) {
  if (!roomId) return null;

  const supabase = getSupabase();

  clearChessRealtime();

  CHESS.channel = supabase
    .channel(`rb-rich-chess-${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: tableRooms(),
        filter: `id=eq.${roomId}`
      },
      async () => {
        await loadChessRoom(roomId);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: tableMoves(),
        filter: `room_id=eq.${roomId}`
      },
      async () => {
        await loadChessMoves(roomId);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: tablePlayers(),
        filter: `room_id=eq.${roomId}`
      },
      async () => {
        await loadChessPlayers(roomId);
      }
    )
    .subscribe();

  return CHESS.channel;
}

export async function initChessSync({
  roomId = null,
  room = null,
  user = null,
  profile = null,
  realtime = true
} = {}) {
  CHESS.user = user || getUser?.() || null;
  CHESS.profile = profile || getProfileIdentity?.() || null;

  if (room?.id) {
    CHESS.room = normalizeRoom(room);
    CHESS.board = cloneBoard(CHESS.room.board_state);
    await Promise.all([
      loadChessPlayers(room.id),
      loadChessMoves(room.id)
    ]);

    if (realtime) bindChessRealtime(room.id);

    emitChessSync();
    return getChessSyncState();
  }

  if (roomId) {
    await loadChessRoom(roomId);
    if (realtime) bindChessRealtime(roomId);
    return getChessSyncState();
  }

  CHESS.board = cloneBoard();
  emitChessSync();

  return getChessSyncState();
}

window.addEventListener("beforeunload", () => {
  leaveChessRoom().catch(() => {});
  clearChessRealtime();
});

console.log("RB CHESS SYNC READY", {
  rooms: tableRooms(),
  moves: tableMoves(),
  players: tablePlayers()
});
