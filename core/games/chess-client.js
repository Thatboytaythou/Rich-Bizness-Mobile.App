/* =========================
   RICH BIZNESS MOBILE
   /core/games/chess-client.js

   RICH CHESS CLIENT
   Local chess state + UI bridge + CPU mode
   Uses locked chess-board.js model + chess-rules.js
========================= */

import {
  initChessUI,
  paintChessGameState,
  setSelectedSquare,
  setLegalTargets,
  clearSelectedSquare,
  showChessIllegal
} from "/core/games/chess-ui.js";

import {
  createChessBoard,
  cloneChessBoard,
  chessPieceAt,
  chessPieceColor,
  chessPieceType,
  chessSquareName,
  parseChessSquare
} from "/core/games/chess-board.js";

import {
  getSafeChessMoves,
  applyRichChessMove
} from "/core/games/chess-rules.js";

import {
  applyChessCpuMove
} from "/core/games/chess-ai.js";

const CHESS = {
  board: createChessBoard(),
  turn: "w",
  selected: null,
  legalTargets: [],
  moves: [],
  captured: [],
  lastMove: null,

  roomCode: "Local",
  playerName: "Guest",
  status: "Rich Chess ready.",

  locked: false,
  flipped: false,

  cpuEnabled: false,
  cpuColor: "b",
  cpuDifficulty: "normal",
  cpuThinking: false,
  cpuDelay: 520,

  onMove: null
};

function turnLabel(turn = CHESS.turn) {
  return turn === "b" ? "Black" : "White";
}

function normalizeTurn(value = "w") {
  const text = String(value || "w").toLowerCase();
  return text === "b" || text === "black" ? "b" : "w";
}

function normalizeSquare(square) {
  if (!square) return null;
  return typeof square === "string" ? parseChessSquare(square) : square;
}

function normalizeBoard(board) {
  return Array.isArray(board) && board.length === 8
    ? cloneChessBoard(board)
    : createChessBoard();
}

function snapshot() {
  return {
    board: cloneChessBoard(CHESS.board),
    turn: CHESS.turn,
    selected: CHESS.selected ? { ...CHESS.selected } : null,
    legalTargets: CHESS.legalTargets.map((move) => ({ ...move })),
    moves: CHESS.moves.map((move) => ({ ...move })),
    captured: [...CHESS.captured],
    lastMove: CHESS.lastMove ? { ...CHESS.lastMove } : null,

    roomCode: CHESS.roomCode,
    playerName: CHESS.playerName,
    status: CHESS.status,

    flipped: CHESS.flipped,
    locked: CHESS.locked,

    cpuEnabled: CHESS.cpuEnabled,
    cpuColor: CHESS.cpuColor,
    cpuDifficulty: CHESS.cpuDifficulty,
    cpuThinking: CHESS.cpuThinking
  };
}

function paint() {
  paintChessGameState(snapshot());
}

function setSelection(pos, legalTargets = []) {
  CHESS.selected = pos ? { ...pos } : null;
  CHESS.legalTargets = legalTargets.map((move) => ({ ...move }));

  if (CHESS.selected) {
    setSelectedSquare(CHESS.selected);
    setLegalTargets(CHESS.legalTargets);
  } else {
    clearSelectedSquare();
  }
}

function emitMove(move) {
  const state = snapshot();

  CHESS.onMove?.(move, state);

  window.dispatchEvent(
    new CustomEvent("rb-chess-move", {
      detail: {
        move,
        state
      }
    })
  );
}

function isCpuTurn() {
  return (
    CHESS.cpuEnabled &&
    !CHESS.locked &&
    !CHESS.cpuThinking &&
    CHESS.turn === CHESS.cpuColor
  );
}

function selectSquare(square) {
  if (isCpuTurn()) {
    CHESS.status = "CPU is thinking...";
    paint();
    return;
  }

  const pos = normalizeSquare(square);
  if (!pos) return;

  const piece = chessPieceAt(CHESS.board, pos.row, pos.col);

  if (!piece) {
    showChessIllegal(typeof square === "string" ? square : chessSquareName(pos.row, pos.col));
    CHESS.status = "Pick a piece first.";
    paint();
    return;
  }

  if (chessPieceColor(piece) !== CHESS.turn) {
    showChessIllegal(typeof square === "string" ? square : chessSquareName(pos.row, pos.col));
    CHESS.status = `${turnLabel()} to move.`;
    paint();
    return;
  }

  const legalTargets = getSafeChessMoves({
    board: CHESS.board,
    row: pos.row,
    col: pos.col,
    turn: CHESS.turn
  });

  setSelection(pos, legalTargets);

  CHESS.status = `${turnLabel()} selected ${chessSquareName(pos.row, pos.col)}.`;

  paint();
}

function finishMove(result, source = "human") {
  CHESS.board = result.board;
  CHESS.turn = result.nextTurn;
  CHESS.lastMove = result.move;
  CHESS.moves.push(result.move);

  if (result.captured) {
    CHESS.captured.push(result.captured);
  }

  setSelection(null, []);

  CHESS.status =
    result.status?.message ||
    (
      source === "cpu"
        ? result.status || `CPU moved ${result.move.piece} ${result.move.from} → ${result.move.to}.`
        : `${result.move.piece} moved ${result.move.from} → ${result.move.to}.`
    );

  const kingCaptured = result.captured && chessPieceType(result.captured) === "K";

  if (kingCaptured || result.game_over) {
    CHESS.locked = true;
    CHESS.cpuThinking = false;

    if (kingCaptured) {
      CHESS.status = `${turnLabel(result.move.turn)} wins. King captured.`;
    }
  }

  paint();
  emitMove(result.move);

  if (source === "human" && !CHESS.locked) {
    scheduleCpuMove();
  }

  return true;
}

function moveSelected(toSquare) {
  const from = CHESS.selected;
  const to = normalizeSquare(toSquare);

  if (!from || !to) return false;

  const toName =
    typeof toSquare === "string"
      ? toSquare
      : chessSquareName(to.row, to.col);

  try {
    const result = applyRichChessMove({
      board: CHESS.board,
      from,
      to,
      turn: CHESS.turn
    });

    return finishMove(result, "human");
  } catch (error) {
    showChessIllegal(toName);
    CHESS.status = error?.message || "Illegal move.";
    paint();
    return false;
  }
}

function runCpuMove() {
  if (!isCpuTurn()) return false;

  CHESS.cpuThinking = true;
  CHESS.status = "CPU is thinking...";
  paint();

  window.setTimeout(() => {
    try {
      if (!CHESS.cpuEnabled || CHESS.locked || CHESS.turn !== CHESS.cpuColor) {
        CHESS.cpuThinking = false;
        paint();
        return;
      }

      const result = applyChessCpuMove({
        board: CHESS.board,
        color: CHESS.cpuColor,
        difficulty: CHESS.cpuDifficulty
      });

      CHESS.cpuThinking = false;

      if (!result.ok || !result.move) {
        CHESS.locked = true;
        CHESS.status = result.status || "CPU has no legal moves.";
        paint();
        return;
      }

      finishMove(result, "cpu");
    } catch (error) {
      CHESS.cpuThinking = false;
      CHESS.status = error?.message || "CPU move failed.";
      paint();
    }
  }, CHESS.cpuDelay);

  return true;
}

function scheduleCpuMove() {
  if (!isCpuTurn()) return false;
  return runCpuMove();
}

export function handleChessSquareTap({ square }) {
  if (CHESS.locked) {
    CHESS.status = "Match is locked. Reset board to play again.";
    paint();
    return;
  }

  if (isCpuTurn()) {
    CHESS.status = "CPU is thinking...";
    paint();
    return;
  }

  const target = parseChessSquare(square);
  const selected = CHESS.selected;

  if (selected && target) {
    const selectedPiece = chessPieceAt(CHESS.board, selected.row, selected.col);
    const targetPiece = chessPieceAt(CHESS.board, target.row, target.col);

    if (
      selectedPiece &&
      targetPiece &&
      chessPieceColor(targetPiece) === chessPieceColor(selectedPiece)
    ) {
      selectSquare(square);
      return;
    }

    moveSelected(square);
    return;
  }

  selectSquare(square);
}

export function resetChessGame() {
  CHESS.board = createChessBoard();
  CHESS.turn = "w";
  CHESS.selected = null;
  CHESS.legalTargets = [];
  CHESS.moves = [];
  CHESS.captured = [];
  CHESS.lastMove = null;
  CHESS.status = CHESS.cpuEnabled
    ? "New CPU match ready. You are White."
    : "New Rich Chess match ready.";
  CHESS.locked = false;
  CHESS.cpuThinking = false;

  setSelection(null, []);
  paint();

  scheduleCpuMove();

  return snapshot();
}

export function resignChessGame(color = CHESS.turn) {
  const side = normalizeTurn(color);

  CHESS.locked = true;
  CHESS.cpuThinking = false;
  CHESS.status = `${turnLabel(side)} resigned.`;

  paint();

  return snapshot();
}

export function unlockChessGame() {
  CHESS.locked = false;
  CHESS.status = "Match unlocked.";
  paint();

  scheduleCpuMove();

  return snapshot();
}

export function loadChessState(state = {}) {
  CHESS.board = normalizeBoard(state.board);
  CHESS.turn = normalizeTurn(state.turn);
  CHESS.selected = state.selected ? normalizeSquare(state.selected) : null;
  CHESS.legalTargets = Array.isArray(state.legalTargets)
    ? state.legalTargets.map(normalizeSquare).filter(Boolean)
    : [];
  CHESS.moves = Array.isArray(state.moves) ? state.moves : [];
  CHESS.captured = Array.isArray(state.captured) ? state.captured : [];
  CHESS.lastMove = state.lastMove || null;
  CHESS.roomCode = state.roomCode || state.room || CHESS.roomCode;
  CHESS.playerName = state.playerName || state.player || CHESS.playerName;
  CHESS.status = state.status || "Rich Chess synced.";
  CHESS.flipped = Boolean(state.flipped);
  CHESS.locked = Boolean(state.locked);

  CHESS.cpuEnabled = Boolean(state.cpuEnabled ?? CHESS.cpuEnabled);
  CHESS.cpuColor = normalizeTurn(state.cpuColor || CHESS.cpuColor);
  CHESS.cpuDifficulty = state.cpuDifficulty || CHESS.cpuDifficulty;
  CHESS.cpuThinking = false;

  if (CHESS.selected) {
    setSelectedSquare(CHESS.selected);
    setLegalTargets(CHESS.legalTargets);
  } else {
    clearSelectedSquare();
  }

  paint();
  scheduleCpuMove();

  return snapshot();
}

export function getChessState() {
  return snapshot();
}

export function setChessRoom(roomCode = "Local") {
  CHESS.roomCode = roomCode || "Local";
  paint();

  return snapshot();
}

export function setChessPlayer(playerName = "Guest") {
  CHESS.playerName = playerName || "Guest";
  paint();

  return snapshot();
}

export function setChessFlipped(flipped = false) {
  CHESS.flipped = Boolean(flipped);
  paint();

  return snapshot();
}

export function enableChessCpu({
  color = "b",
  difficulty = "normal",
  reset = true
} = {}) {
  CHESS.cpuEnabled = true;
  CHESS.cpuColor = normalizeTurn(color);
  CHESS.cpuDifficulty = difficulty || "normal";
  CHESS.roomCode = "CPU";
  CHESS.status = `CPU mode on. You are ${CHESS.cpuColor === "b" ? "White" : "Black"}.`;

  if (reset) {
    resetChessGame();
  } else {
    paint();
    scheduleCpuMove();
  }

  window.dispatchEvent(
    new CustomEvent("rb-chess-cpu-toggle", {
      detail: snapshot()
    })
  );

  return snapshot();
}

export function disableChessCpu() {
  CHESS.cpuEnabled = false;
  CHESS.cpuThinking = false;
  CHESS.roomCode = "Local";
  CHESS.status = "CPU mode off. Local match ready.";

  paint();

  window.dispatchEvent(
    new CustomEvent("rb-chess-cpu-toggle", {
      detail: snapshot()
    })
  );

  return snapshot();
}

export function toggleChessCpu(options = {}) {
  return CHESS.cpuEnabled
    ? disableChessCpu()
    : enableChessCpu(options);
}

export function setChessCpuDifficulty(difficulty = "normal") {
  CHESS.cpuDifficulty = difficulty || "normal";
  CHESS.status = `CPU difficulty set to ${CHESS.cpuDifficulty}.`;
  paint();

  return snapshot();
}

export function getChessCpuState() {
  return {
    enabled: CHESS.cpuEnabled,
    color: CHESS.cpuColor,
    difficulty: CHESS.cpuDifficulty,
    thinking: CHESS.cpuThinking
  };
}

export function onChessMove(callback) {
  CHESS.onMove = typeof callback === "function" ? callback : null;

  return () => {
    if (CHESS.onMove === callback) {
      CHESS.onMove = null;
    }
  };
}

export function initChessClient({
  roomCode = "Local",
  playerName = "Guest",
  flipped = false,
  cpu = false,
  cpuColor = "b",
  cpuDifficulty = "normal",
  onMove = null
} = {}) {
  CHESS.roomCode = roomCode || "Local";
  CHESS.playerName = playerName || "Guest";
  CHESS.flipped = Boolean(flipped);
  CHESS.onMove = typeof onMove === "function" ? onMove : null;

  CHESS.cpuEnabled = Boolean(cpu);
  CHESS.cpuColor = normalizeTurn(cpuColor);
  CHESS.cpuDifficulty = cpuDifficulty || "normal";
  CHESS.cpuThinking = false;

  initChessUI({
    onSquareTap: handleChessSquareTap
  });

  paint();
  scheduleCpuMove();

  return snapshot();
}

console.log("RB CHESS CLIENT READY");
