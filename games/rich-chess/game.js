/* =========================
   RICH BIZNESS MOBILE
   /games/rich-chess/game.js

   RICH CHESS PAGE CONTROLLER
   Premium HUD + local CPU + realtime rooms
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
  onChessMove,
  enableChessCpu,
  disableChessCpu,
  setChessCpuDifficulty,
  getChessCpuState
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
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

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
  cpuBtn: $("cpuChessBtn"),
  resetBtn: $("resetChessBtn"),
  resignBtn: $("resignChessBtn"),
  copyLinkBtn: $("copyChessLinkBtn"),

  modeCards: $$("[data-chess-mode], [data-mode]"),
  difficultyCards: $$("[data-chess-difficulty], [data-difficulty]"),
  actionButtons: $$("[data-chess-action], [data-action]")
};

const PAGE = {
  booted: false,
  user: null,
  profile: null,
  roomCode: new URLSearchParams(location.search).get("room") || null,
  syncingRemote: false,
  difficulty: "normal",
  mode: "local"
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

function normalizeDifficulty(value = "normal") {
  const text = String(value || "normal").toLowerCase();

  if (["rookie", "easy"].includes(text)) return "easy";
  if (["hustler", "normal"].includes(text)) return "normal";
  if (["boss", "hard"].includes(text)) return "hard";
  if (["grandmaster", "grand", "master"].includes(text)) return "boss";

  return "normal";
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

function clearRoomUrl() {
  PAGE.roomCode = null;
  history.replaceState(null, "", "/games/rich-chess");
}

function setMode(mode = "local") {
  PAGE.mode = mode;

  els.modeCards.forEach((card) => {
    const value =
      card.dataset.chessMode ||
      card.dataset.mode ||
      card.dataset.chessAction ||
      card.dataset.action ||
      "";

    card.classList.toggle("is-active", value === mode);
  });
}

function setDifficultyUi(difficulty = PAGE.difficulty) {
  PAGE.difficulty = normalizeDifficulty(difficulty);

  els.difficultyCards.forEach((card) => {
    const value = normalizeDifficulty(
      card.dataset.chessDifficulty ||
        card.dataset.difficulty ||
        card.dataset.level ||
        ""
    );

    card.classList.toggle("is-active", value === PAGE.difficulty);
  });
}

function renderCpuButton() {
  const cpu = getChessCpuState();

  if (!els.cpuBtn) return;

  els.cpuBtn.textContent = cpu.enabled
    ? cpu.thinking
      ? "CPU Thinking"
      : "CPU On"
    : "Play CPU";

  els.cpuBtn.classList.toggle("primary", cpu.enabled);
  els.cpuBtn.classList.toggle("is-active", cpu.enabled);
  els.cpuBtn.setAttribute("aria-pressed", cpu.enabled ? "true" : "false");
}

function renderPageStats() {
  const state = getChessState();
  const realtime = getChessRealtimeState();
  const cpu = getChessCpuState();

  if (els.turn) els.turn.textContent = turnName(state.turn);
  if (els.moves) els.moves.textContent = String(state.moves?.length || 0);

  if (els.room) {
    els.room.textContent = cpu.enabled
      ? "CPU"
      : PAGE.roomCode || state.roomCode || "Local";
  }

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
    const canCopy = Boolean(PAGE.roomCode) && !cpu.enabled;

    els.copyLinkBtn.classList.toggle("is-disabled", !canCopy);
    els.copyLinkBtn.setAttribute("aria-disabled", canCopy ? "false" : "true");
  }

  renderCpuButton();

  if (cpu.enabled) {
    setMode("cpu");
  } else if (PAGE.roomCode || realtime.connected) {
    setMode("room");
  } else {
    setMode("local");
  }

  setDifficultyUi(PAGE.difficulty);
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
    disableChessCpu();

    const chessState = getChessState();

    const room = await createChessRealtimeRoom({
      initialState: {
        ...chessState,
        cpuEnabled: false
      },
      gameKey: "rich-chess"
    });

    PAGE.roomCode = room.room_code;

    history.replaceState(
      null,
      "",
      `/games/rich-chess?room=${encodeURIComponent(PAGE.roomCode)}`
    );

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
    disableChessCpu();

    const room = await joinChessRealtimeRoom(code);

    PAGE.roomCode = room.room_code;

    if (room.game_state) {
      PAGE.syncingRemote = true;
      loadChessState({
        ...room.game_state,
        cpuEnabled: false
      });
      PAGE.syncingRemote = false;
    }

    history.replaceState(
      null,
      "",
      `/games/rich-chess?room=${encodeURIComponent(PAGE.roomCode)}`
    );

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
    disableChessCpu();

    const room = await joinChessRealtimeRoom(PAGE.roomCode);

    if (room.game_state) {
      PAGE.syncingRemote = true;
      loadChessState({
        ...room.game_state,
        cpuEnabled: false
      });
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

  const cpu = getChessCpuState();

  if (cpu.enabled) {
    setStatus("CPU mode is local. Create a room for an online link.");
    return;
  }

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

function startCpuMode() {
  PAGE.roomCode = null;
  clearChessRealtime();
  clearRoomUrl();

  const state = enableChessCpu({
    color: "b",
    difficulty: PAGE.difficulty,
    reset: true
  });

  setStatus(
    state.cpuEnabled
      ? `CPU mode on. Difficulty: ${PAGE.difficulty}. You are White.`
      : "CPU mode failed."
  );

  renderPageStats();
}

function toggleCpuMode() {
  const cpu = getChessCpuState();

  if (cpu.enabled) {
    disableChessCpu();
    setMode("local");
    setStatus("CPU mode off. Local match ready.");
  } else {
    startCpuMode();
  }

  renderPageStats();
}

function setDifficulty(difficulty) {
  PAGE.difficulty = normalizeDifficulty(difficulty);
  setChessCpuDifficulty(PAGE.difficulty);
  setDifficultyUi(PAGE.difficulty);

  const cpu = getChessCpuState();

  if (cpu.enabled) {
    setStatus(`CPU difficulty set to ${PAGE.difficulty}.`);
  } else {
    setStatus(`CPU difficulty selected: ${PAGE.difficulty}. Tap Play CPU.`);
  }

  renderPageStats();
}

function resetBoard() {
  resetChessGame();

  const cpu = getChessCpuState();

  setStatus(
    cpu.enabled
      ? "CPU board reset. You are White."
      : "Board reset."
  );

  renderPageStats();
}

function resignBoard() {
  const state = resignChessGame();

  setStatus(state.status || "Player resigned.");
  renderPageStats();
}

function handleAction(action = "") {
  const key = String(action || "").toLowerCase();

  if (["cpu", "play-cpu", "play_cpu"].includes(key)) {
    toggleCpuMode();
    return;
  }

  if (["room", "new-room", "new_room", "custom-room", "custom_room"].includes(key)) {
    createRoom();
    return;
  }

  if (["join", "join-room", "join_room"].includes(key)) {
    joinRoom();
    return;
  }

  if (["reset", "new-game", "new_game"].includes(key)) {
    resetBoard();
    return;
  }

  if (["resign"].includes(key)) {
    resignBoard();
    return;
  }

  if (["copy", "copy-link", "copy_link"].includes(key)) {
    copyRoomLink();
  }
}

function bindPremiumCards() {
  els.modeCards.forEach((card) => {
    card.addEventListener("click", () => {
      const mode =
        card.dataset.chessMode ||
        card.dataset.mode ||
        card.dataset.chessAction ||
        card.dataset.action ||
        "";

      handleAction(mode);
    });
  });

  els.difficultyCards.forEach((card) => {
    card.addEventListener("click", () => {
      const difficulty =
        card.dataset.chessDifficulty ||
        card.dataset.difficulty ||
        card.dataset.level ||
        "normal";

      setDifficulty(difficulty);
    });
  });

  els.actionButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const action =
        button.dataset.chessAction ||
        button.dataset.action ||
        "";

      if (!action) return;

      if (button.tagName === "A") {
        event.preventDefault();
      }

      handleAction(action);
    });
  });
}

function bindEvents() {
  els.newRoomBtn?.addEventListener("click", createRoom);
  els.joinRoomBtn?.addEventListener("click", joinRoom);
  els.cpuBtn?.addEventListener("click", toggleCpuMode);
  els.resetBtn?.addEventListener("click", resetBoard);
  els.resignBtn?.addEventListener("click", resignBoard);
  els.copyLinkBtn?.addEventListener("click", copyRoomLink);

  bindPremiumCards();

  onChessMove(async (move, state) => {
    renderPageStats();

    if (PAGE.syncingRemote) return;

    const cpu = getChessCpuState();

    if (cpu.enabled) return;

    if (PAGE.roomCode) {
      try {
        await sendChessRealtimeMove(move, state);
      } catch (error) {
        console.warn("[RB CHESS MOVE SYNC]", error?.message || error);
      }
    }
  });

  window.addEventListener("rb-chess-cpu-toggle", renderPageStats);
  window.addEventListener("rb-chess-move", renderPageStats);

  onChessRealtimeMove((row) => {
    const moveData = row?.move_data;
    const realtime = getChessRealtimeState();
    const cpu = getChessCpuState();

    if (cpu.enabled) return;
    if (!moveData || !realtime.state) return;

    PAGE.syncingRemote = true;
    loadChessState({
      ...realtime.state,
      cpuEnabled: false
    });
    PAGE.syncingRemote = false;

    setStatus(`Synced move: ${moveData.from} → ${moveData.to}`);
    renderPageStats();
  });

  onChessRealtime(() => {
    const realtime = getChessRealtimeState();
    const cpu = getChessCpuState();

    if (cpu.enabled) return;

    if (realtime.state && PAGE.roomCode) {
      PAGE.syncingRemote = true;
      loadChessState({
        ...realtime.state,
        cpuEnabled: false
      });
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
      playerName: displayName(),
      cpu: false,
      cpuColor: "b",
      cpuDifficulty: PAGE.difficulty
    });

    await autoJoinRoomFromUrl();

    setDifficultyUi(PAGE.difficulty);
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
