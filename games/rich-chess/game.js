/* =========================
   RICH BIZNESS MOBILE
   /games/rich-chess/game.js

   RICH CHESS PAGE CONTROLLER
   Board UI + rules + local/realtime room hooks
========================= */

import {
  initApp,
  getCurrentUserState,
  markPageReady,
  markPageError
} from "/core/app.js";

import {
  initChessClient,
  resetChessGame,
  resignChessGame,
  getChessState,
  loadChessState,
  onChessMove
} from "/core/games/chess-client.js";

import {
  createChessRealtimeRoom,
  joinChessRealtimeRoom,
  sendChessRealtimeMove,
  onChessRealtimeMove,
  onChessRealtime,
  clearChessRealtime,
  getChessRealtimeState
} from "/core/games/chess-realtime.js";

const $ = (id) => document.getElementById(id);

const els = {
  board: $("chessBoard"),
  status: $("chessStatus"),
  turn: $("chessTurn"),
  moves: $("chessMoves"),
  room: $("chessRoom"),
  player: $("chessPlayer"),
  captured: $("chessCaptured"),
  moveLog: $("chessMoveLog"),

  newRoomBtn: $("newChessRoomBtn"),
  joinRoomBtn: $("joinChessRoomBtn"),
  resetBtn: $("resetChessBtn"),
  resignBtn: $("resignChessBtn"),
  copyLinkBtn: $("copyChessLinkBtn")
};

const PAGE = {
  booted: false,
  user: null,
  profile: null,
  roomCode: new URLSearchParams(location.search).get("room") || null,
  syncingRemote: false
};

function setStatus(message = "") {
  if (els.status) els.status.textContent = message;
}

function displayName() {
  return (
    PAGE.profile?.display_name ||
    PAGE.profile?.full_name ||
    PAGE.profile?.username ||
    PAGE.user?.email?.split("@")[0] ||
    "Guest"
  );
}

function pieceIcon(piece = "") {
  const icons = {
    wK: "♔",
    wQ: "♕",
    wR: "♖",
    wB: "♗",
    wN: "♘",
    wP: "♙",
    bK: "♚",
    bQ: "♛",
    bR: "♜",
    bB: "♝",
    bN: "♞",
    bP: "♟"
  };

  return icons[piece] || piece || "";
}

function turnName(turn = "w") {
  return turn === "b" ? "Black" : "White";
}

function roomUrl(roomCode = PAGE.roomCode) {
  const url = new URL(window.location.href);
  url.pathname = "/games/rich-chess";
  url.search = "";

  if (roomCode) {
    url.searchParams.set("room", roomCode);
  }

  return url.toString();
}

function renderPageStats() {
  const state = getChessState();
  const realtime = getChessRealtimeState();

  if (els.turn) els.turn.textContent = turnName(state.turn);
  if (els.moves) els.moves.textContent = String(state.moves?.length || 0);
  if (els.room) els.room.textContent = PAGE.roomCode || state.roomCode || "Local";
  if (els.player) els.player.textContent = displayName();

  if (els.captured) {
    els.captured.innerHTML = state.captured?.length
      ? state.captured
          .map((piece) => `<span title="${piece}">${pieceIcon(piece)}</span>`)
          .join("")
      : "<span>No captures yet.</span>";
  }

  if (els.moveLog) {
    els.moveLog.innerHTML = state.moves?.length
      ? state.moves
          .map((move, index) => `
            <li>
              <strong>${index + 1}.</strong>
              <span>${pieceIcon(move.piece)} ${move.from} → ${move.to}</span>
              ${move.captured ? `<em>${pieceIcon(move.captured)}</em>` : ""}
            </li>
          `)
          .join("")
      : "<li>No moves yet.</li>";
  }

  if (els.copyLinkBtn) {
    els.copyLinkBtn.classList.toggle("is-disabled", !PAGE.roomCode);
    els.copyLinkBtn.setAttribute("aria-disabled", PAGE.roomCode ? "false" : "true");
  }

  if (realtime.connected && PAGE.roomCode) {
    setStatus(`Realtime room connected: ${PAGE.roomCode}`);
  }
}

async function initIdentity() {
  try {
    await initApp({
      guard: false,
      bindProfile: true,
      toast: false
    });

    const state = getCurrentUserState();

    PAGE.user = state?.user || null;
    PAGE.profile = state?.profile || null;
  } catch (error) {
    console.warn("[RB CHESS IDENTITY]", error?.message || error);
  }
}

async function createRoom() {
  try {
    const chessState = getChessState();

    const room = await createChessRealtimeRoom({
      initialState: chessState,
      gameKey: "rich-chess"
    });

    PAGE.roomCode = room.room_code;

    history.replaceState(null, "", `/games/rich-chess?room=${encodeURIComponent(PAGE.roomCode)}`);

    setStatus(`New room created: ${PAGE.roomCode}`);
    renderPageStats();
  } catch (error) {
    console.error("[RB CHESS CREATE ROOM]", error);
    setStatus(error?.message || "Could not create chess room.");
  }
}

async function joinRoom() {
  const code =
    prompt("Enter Rich Chess room code:", PAGE.roomCode || "")?.trim() || "";

  if (!code) return;

  try {
    const room = await joinChessRealtimeRoom(code);

    PAGE.roomCode = room.room_code;

    if (room.game_state) {
      PAGE.syncingRemote = true;
      loadChessState(room.game_state);
      PAGE.syncingRemote = false;
    }

    history.replaceState(null, "", `/games/rich-chess?room=${encodeURIComponent(PAGE.roomCode)}`);

    setStatus(`Joined room: ${PAGE.roomCode}`);
    renderPageStats();
  } catch (error) {
    console.error("[RB CHESS JOIN ROOM]", error);
    setStatus(error?.message || "Could not join chess room.");
  }
}

async function autoJoinRoomFromUrl() {
  if (!PAGE.roomCode) return;

  try {
    const room = await joinChessRealtimeRoom(PAGE.roomCode);

    if (room.game_state) {
      PAGE.syncingRemote = true;
      loadChessState(room.game_state);
      PAGE.syncingRemote = false;
    }

    setStatus(`Joined room: ${PAGE.roomCode}`);
    renderPageStats();
  } catch (error) {
    console.warn("[RB CHESS AUTO JOIN]", error?.message || error);
    setStatus("Room link loaded, but realtime join failed.");
  }
}

async function copyRoomLink(event) {
  event?.preventDefault?.();

  if (!PAGE.roomCode) {
    setStatus("Create or join a room first.");
    return;
  }

  const link = roomUrl(PAGE.roomCode);

  try {
    await navigator.clipboard.writeText(link);
    setStatus("Chess room link copied.");
  } catch {
    setStatus(link);
  }
}

function resetBoard() {
  resetChessGame();
  setStatus("Board reset.");
  renderPageStats();
}

function resignBoard() {
  const state = resignChessGame();
  setStatus(state.status || "Player resigned.");
  renderPageStats();
}

function bindEvents() {
  els.newRoomBtn?.addEventListener("click", createRoom);
  els.joinRoomBtn?.addEventListener("click", joinRoom);
  els.resetBtn?.addEventListener("click", resetBoard);
  els.resignBtn?.addEventListener("click", resignBoard);
  els.copyLinkBtn?.addEventListener("click", copyRoomLink);

  onChessMove(async (move, state) => {
    renderPageStats();

    if (PAGE.syncingRemote) return;

    if (PAGE.roomCode) {
      try {
        await sendChessRealtimeMove(move, state);
      } catch (error) {
        console.warn("[RB CHESS MOVE SYNC]", error?.message || error);
      }
    }
  });

  onChessRealtimeMove((row) => {
    const moveData = row?.move_data;
    const realtime = getChessRealtimeState();

    if (!moveData || !realtime.state) return;

    PAGE.syncingRemote = true;
    loadChessState(realtime.state);
    PAGE.syncingRemote = false;

    setStatus(`Synced move: ${moveData.from} → ${moveData.to}`);
    renderPageStats();
  });

  onChessRealtime(() => {
    const realtime = getChessRealtimeState();

    if (realtime.state && PAGE.roomCode) {
      PAGE.syncingRemote = true;
      loadChessState(realtime.state);
      PAGE.syncingRemote = false;
    }

    renderPageStats();
  });

  window.addEventListener("beforeunload", clearChessRealtime);
}

async function bootRichChess() {
  if (PAGE.booted) return;
  PAGE.booted = true;

  try {
    bindEvents();

    await initIdentity();

    initChessClient({
      roomCode: PAGE.roomCode || "Local",
      playerName: displayName()
    });

    await autoJoinRoomFromUrl();

    renderPageStats();

    document.body.classList.add("rich-chess-ready");
    markPageReady("rich-chess");

    console.log("RB RICH CHESS PAGE READY");
  } catch (error) {
    console.error("[RB RICH CHESS]", error);
    setStatus(error?.message || "Rich Chess failed to load.");
    markPageError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootRichChess);
} else {
  bootRichChess();
}
