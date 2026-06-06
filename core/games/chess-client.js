/* =========================
   RICH BIZNESS MOBILE
   /core/games/chess-client.js

   RICH CHESS CLIENT
   Local chess rules + turns + captures + UI bridge
========================= */

import {
  initChessUI,
  paintChessGameState,
  setSelectedSquare,
  setLegalTargets,
  clearSelectedSquare,
  showChessIllegal
} from "/core/games/chess-ui.js";

const START_BOARD = [
  ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
  ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
  ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"]
];

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const CHESS = {
  board: cloneBoard(START_BOARD),
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
  onMove: null
};

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function squareName(row, col) {
  return `${FILES[col]}${8 - row}`;
}

function parseSquare(square = "") {
  const col = FILES.indexOf(square[0]);
  const row = 8 - Number(square[1]);

  if (row < 0 || row > 7 || col < 0 || col > 7) return null;

  return { row, col };
}

function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function pieceAt(row, col) {
  if (!inBounds(row, col)) return null;
  return CHESS.board[row][col];
}

function colorOf(piece) {
  return piece?.[0] || null;
}

function typeOf(piece) {
  return piece?.[1] || null;
}

function enemy(piece, target) {
  return piece && target && colorOf(piece) !== colorOf(target);
}

function sameSquare(a, b) {
  return a && b && a.row === b.row && a.col === b.col;
}

function targetMatch(targets, square) {
  return targets.some((target) => sameSquare(target, square));
}

function pushIfValid(moves, row, col, piece) {
  if (!inBounds(row, col)) return false;

  const target = pieceAt(row, col);

  if (!target) {
    moves.push({ row, col });
    return true;
  }

  if (enemy(piece, target)) {
    moves.push({ row, col });
  }

  return false;
}

function lineMoves(row, col, piece, directions) {
  const moves = [];

  directions.forEach(([dr, dc]) => {
    let r = row + dr;
    let c = col + dc;

    while (inBounds(r, c)) {
      const keepGoing = pushIfValid(moves, r, c, piece);
      if (!keepGoing) break;

      r += dr;
      c += dc;
    }
  });

  return moves;
}

function legalMovesFor(row, col) {
  const piece = pieceAt(row, col);
  if (!piece) return [];

  const color = colorOf(piece);
  const type = typeOf(piece);

  if (color !== CHESS.turn) return [];

  if (type === "P") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const moves = [];

    if (!pieceAt(row + dir, col)) {
      moves.push({ row: row + dir, col });

      if (row === startRow && !pieceAt(row + dir * 2, col)) {
        moves.push({ row: row + dir * 2, col });
      }
    }

    [-1, 1].forEach((dc) => {
      const target = pieceAt(row + dir, col + dc);
      if (enemy(piece, target)) {
        moves.push({ row: row + dir, col: col + dc });
      }
    });

    return moves.filter((m) => inBounds(m.row, m.col));
  }

  if (type === "R") {
    return lineMoves(row, col, piece, [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ]);
  }

  if (type === "B") {
    return lineMoves(row, col, piece, [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1]
    ]);
  }

  if (type === "Q") {
    return lineMoves(row, col, piece, [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1]
    ]);
  }

  if (type === "N") {
    return [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1]
    ]
      .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
      .filter((m) => {
        const target = pieceAt(m.row, m.col);
        return inBounds(m.row, m.col) && (!target || enemy(piece, target));
      });
  }

  if (type === "K") {
    return [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1]
    ]
      .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
      .filter((m) => {
        const target = pieceAt(m.row, m.col);
        return inBounds(m.row, m.col) && (!target || enemy(piece, target));
      });
  }

  return [];
}

function snapshot() {
  return {
    board: cloneBoard(CHESS.board),
    turn: CHESS.turn,
    selected: CHESS.selected,
    legalTargets: CHESS.legalTargets,
    moves: [...CHESS.moves],
    captured: [...CHESS.captured],
    lastMove: CHESS.lastMove,
    roomCode: CHESS.roomCode,
    playerName: CHESS.playerName,
    status: CHESS.status
  };
}

function paint() {
  paintChessGameState(snapshot());
}

function selectSquare(square) {
  const pos = parseSquare(square);
  if (!pos) return;

  const piece = pieceAt(pos.row, pos.col);

  if (!piece || colorOf(piece) !== CHESS.turn) {
    showChessIllegal(square);
    return;
  }

  CHESS.selected = pos;
  CHESS.legalTargets = legalMovesFor(pos.row, pos.col);
  CHESS.status = `${CHESS.turn === "w" ? "White" : "Black"} selected ${square}.`;

  setSelectedSquare(pos);
  setLegalTargets(CHESS.legalTargets);
  paint();
}

function moveSelected(toSquare) {
  const to = parseSquare(toSquare);
  const from = CHESS.selected;

  if (!from || !to) return false;

  if (!targetMatch(CHESS.legalTargets, to)) {
    showChessIllegal(toSquare);
    CHESS.status = "Illegal move.";
    paint();
    return false;
  }

  const piece = pieceAt(from.row, from.col);
  const captured = pieceAt(to.row, to.col);
  const fromName = squareName(from.row, from.col);

  CHESS.board[to.row][to.col] = piece;
  CHESS.board[from.row][from.col] = null;

  if (captured) CHESS.captured.push(captured);

  const move = {
    from: fromName,
    to: toSquare,
    piece,
    captured,
    turn: CHESS.turn,
    created_at: new Date().toISOString()
  };

  CHESS.moves.push(move);
  CHESS.lastMove = move;
  CHESS.turn = CHESS.turn === "w" ? "b" : "w";
  CHESS.selected = null;
  CHESS.legalTargets = [];
  CHESS.status = `${move.piece} moved ${move.from} → ${move.to}.`;

  clearSelectedSquare();
  paint();

  CHESS.onMove?.(move, snapshot());

  window.dispatchEvent(
    new CustomEvent("rb-chess-move", {
      detail: {
        move,
        state: snapshot()
      }
    })
  );

  return true;
}

export function handleChessSquareTap({ square }) {
  if (CHESS.locked) return;

  if (CHESS.selected) {
    const to = parseSquare(square);
    const selectedPiece = pieceAt(CHESS.selected.row, CHESS.selected.col);
    const targetPiece = to ? pieceAt(to.row, to.col) : null;

    if (targetPiece && colorOf(targetPiece) === colorOf(selectedPiece)) {
      selectSquare(square);
      return;
    }

    moveSelected(square);
    return;
  }

  selectSquare(square);
}

export function resetChessGame() {
  CHESS.board = cloneBoard(START_BOARD);
  CHESS.turn = "w";
  CHESS.selected = null;
  CHESS.legalTargets = [];
  CHESS.moves = [];
  CHESS.captured = [];
  CHESS.lastMove = null;
  CHESS.status = "New Rich Chess match ready.";

  clearSelectedSquare();
  paint();

  return snapshot();
}

export function resignChessGame(color = CHESS.turn) {
  CHESS.locked = true;
  CHESS.status = `${color === "w" ? "White" : "Black"} resigned.`;

  paint();

  return snapshot();
}

export function unlockChessGame() {
  CHESS.locked = false;
  CHESS.status = "Match unlocked.";
  paint();
}

export function loadChessState(state = {}) {
  CHESS.board = cloneBoard(state.board || START_BOARD);
  CHESS.turn = state.turn || "w";
  CHESS.selected = state.selected || null;
  CHESS.legalTargets = state.legalTargets || [];
  CHESS.moves = state.moves || [];
  CHESS.captured = state.captured || [];
  CHESS.lastMove = state.lastMove || null;
  CHESS.roomCode = state.roomCode || state.room || CHESS.roomCode;
  CHESS.playerName = state.playerName || state.player || CHESS.playerName;
  CHESS.status = state.status || "Rich Chess synced.";

  paint();

  return snapshot();
}

export function getChessState() {
  return snapshot();
}

export function setChessRoom(roomCode = "Local") {
  CHESS.roomCode = roomCode || "Local";
  paint();
}

export function setChessPlayer(playerName = "Guest") {
  CHESS.playerName = playerName || "Guest";
  paint();
}

export function onChessMove(callback) {
  CHESS.onMove = typeof callback === "function" ? callback : null;
}

export function initChessClient({
  roomCode = "Local",
  playerName = "Guest",
  onMove = null
} = {}) {
  CHESS.roomCode = roomCode;
  CHESS.playerName = playerName;
  CHESS.onMove = onMove;

  initChessUI({
    onSquareTap: handleChessSquareTap
  });

  paint();

  return snapshot();
}

console.log("RB CHESS CLIENT READY");
