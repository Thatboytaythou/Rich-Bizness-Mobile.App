/* =========================
   RICH BIZNESS MOBILE
   /core/games/chess-ai.js

   RICH CHESS CPU ENGINE
   Safe CPU brain for Rich Chess
   Uses chess-rules.js
========================= */

import {
  chessPieceType,
  parseChessSquare
} from "/core/games/chess-board.js";

import {
  getAllSafeChessMoves,
  applyRichChessMove,
  getChessGameStatus
} from "/core/games/chess-rules.js";

const PIECE_VALUE = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 20000
};

const CENTER_BONUS = {
  d4: 18,
  e4: 18,
  d5: 18,
  e5: 18,
  c4: 10,
  f4: 10,
  c5: 10,
  f5: 10,
  d3: 8,
  e3: 8,
  d6: 8,
  e6: 8
};

function opposite(color = "b") {
  return color === "w" ? "b" : "w";
}

function colorName(color = "b") {
  return color === "b" ? "Black" : "White";
}

function safeDifficulty(value = "normal") {
  const text = String(value || "normal").toLowerCase();

  return ["easy", "normal", "hard", "boss"].includes(text)
    ? text
    : "normal";
}

function randomItem(items = []) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function pieceValue(piece = "") {
  return PIECE_VALUE[chessPieceType(piece)] || 0;
}

function enrichMove(move = {}) {
  const fromPos = parseChessSquare(move.from);
  const toPos = parseChessSquare(move.to);

  return {
    ...move,
    row: fromPos?.row ?? null,
    col: fromPos?.col ?? null,
    toRow: toPos?.row ?? null,
    toCol: toPos?.col ?? null
  };
}

function allMovesForColor(board = [], color = "b") {
  return getAllSafeChessMoves(board, color).map(enrichMove);
}

function scoreMove(board = [], move, color = "b", difficulty = "normal") {
  let score = 0;

  if (move.captured) {
    score += pieceValue(move.captured) * 10;
    score -= Math.floor(pieceValue(move.piece) * 0.25);
  }

  score += CENTER_BONUS[move.to] || 0;

  if (chessPieceType(move.piece) === "P") {
    const advance = color === "b" ? move.toRow : 7 - move.toRow;
    score += Number(advance || 0) * 4;

    if ((color === "b" && move.toRow === 7) || (color === "w" && move.toRow === 0)) {
      score += PIECE_VALUE.Q;
    }
  }

  if (["N", "B"].includes(chessPieceType(move.piece))) {
    const startBackRank = color === "b" ? 0 : 7;

    if (move.row === startBackRank) {
      score += 14;
    }
  }

  try {
    const result = applyRichChessMove({
      board,
      from: move.from,
      to: move.to,
      turn: color
    });

    const enemyStatus = getChessGameStatus(result.board, result.nextTurn);

    if (enemyStatus.state === "check") {
      score += 90;
    }

    if (enemyStatus.state === "checkmate") {
      score += 999999;
    }

    if (result.game_over && result.winner === color) {
      score += 999999;
    }
  } catch {
    score -= 999999;
  }

  if (difficulty === "easy") score += Math.random() * 180;
  if (difficulty === "normal") score += Math.random() * 72;
  if (difficulty === "hard") score += Math.random() * 24;
  if (difficulty === "boss") score += Math.random() * 8;

  return score;
}

export function getChessCpuMoves({
  board = [],
  color = "b"
} = {}) {
  return allMovesForColor(board, color);
}

export function chooseChessCpuMove({
  board = [],
  color = "b",
  difficulty = "normal"
} = {}) {
  const level = safeDifficulty(difficulty);
  const moves = allMovesForColor(board, color);

  if (!moves.length) return null;

  if (level === "easy") {
    const captures = moves.filter((move) => move.captured);

    if (captures.length && Math.random() > 0.45) {
      return randomItem(captures);
    }

    return randomItem(moves);
  }

  const scored = moves
    .map((move) => ({
      ...move,
      score: scoreMove(board, move, color, level)
    }))
    .sort((a, b) => b.score - a.score);

  if (level === "normal") {
    return scored[Math.floor(Math.random() * Math.min(4, scored.length))] || scored[0];
  }

  if (level === "hard") {
    return scored[Math.floor(Math.random() * Math.min(2, scored.length))] || scored[0];
  }

  return scored[0];
}

export function applyChessCpuMove({
  board = [],
  color = "b",
  difficulty = "normal"
} = {}) {
  const move = chooseChessCpuMove({
    board,
    color,
    difficulty
  });

  if (!move) {
    const status = getChessGameStatus(board, color);

    return {
      ok: false,
      move: null,
      board,
      nextTurn: opposite(color),
      status: status.message || `${colorName(color)} CPU has no legal moves.`,
      game_over: ["checkmate", "stalemate"].includes(status.state),
      winner: status.winner || null
    };
  }

  const result = applyRichChessMove({
    board,
    from: move.from,
    to: move.to,
    turn: color
  });

  return {
    ok: true,
    move: result.move,
    board: result.board,
    captured: result.captured,
    nextTurn: result.nextTurn,
    status: result.status?.message || `CPU moved ${result.move.piece} ${result.move.from} → ${result.move.to}.`,
    game_over: result.game_over,
    winner: result.winner,
    score: move.score || 0
  };
}

export function describeChessCpuMove(move = null) {
  if (!move) return "CPU has no move.";

  const capture = move.captured ? ` and captured ${move.captured}` : "";

  return `CPU moved ${move.piece} from ${move.from} to ${move.to}${capture}.`;
}

console.log("RB CHESS AI READY");
