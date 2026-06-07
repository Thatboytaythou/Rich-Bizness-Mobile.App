/* =========================
   RICH BIZNESS MOBILE
   /core/games/chess-ai.js

   RICH CHESS CPU ENGINE
   Offline CPU brain for Rich Chess
   No Supabase required
========================= */

import {
  chessPieceAt,
  chessPieceColor,
  chessPieceType,
  chessSquareName,
  getChessLegalMoves,
  applyChessMove
} from "/core/games/chess-board.js";

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

function safeDifficulty(value = "normal") {
  const text = String(value || "normal").toLowerCase();

  if (["easy", "normal", "hard", "boss"].includes(text)) {
    return text;
  }

  return "normal";
}

function randomItem(items = []) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function pieceValue(piece = "") {
  return PIECE_VALUE[chessPieceType(piece)] || 0;
}

function cloneBoard(board = []) {
  return board.map((row) => [...row]);
}

function allMovesForColor(board = [], color = "b") {
  const moves = [];

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = chessPieceAt(board, row, col);

      if (!piece || chessPieceColor(piece) !== color) continue;

      const from = chessSquareName(row, col);

      const legalMoves = getChessLegalMoves({
        board,
        row,
        col,
        turn: color
      });

      legalMoves.forEach((target) => {
        const to = target.square || chessSquareName(target.row, target.col);
        const captured = chessPieceAt(board, target.row, target.col);

        moves.push({
          from,
          to,
          piece,
          captured,
          row,
          col,
          toRow: target.row,
          toCol: target.col
        });
      });
    }
  }

  return moves;
}

function isSquareAttacked(board = [], square, byColor = "w") {
  if (!square) return false;

  const enemyMoves = allMovesForColor(board, byColor);

  return enemyMoves.some((move) => move.to === square);
}

function scoreMove(board = [], move, color = "b", difficulty = "normal") {
  let score = 0;

  const enemyColor = opposite(color);

  if (move.captured) {
    score += pieceValue(move.captured) * 10;
    score -= Math.floor(pieceValue(move.piece) * 0.35);
  }

  const center = CENTER_BONUS[move.to] || 0;
  score += center;

  if (chessPieceType(move.piece) === "P") {
    const advance = color === "b" ? move.toRow : 7 - move.toRow;
    score += advance * 4;

    if ((color === "b" && move.toRow === 7) || (color === "w" && move.toRow === 0)) {
      score += PIECE_VALUE.Q;
    }
  }

  if (chessPieceType(move.piece) === "N" || chessPieceType(move.piece) === "B") {
    const startBackRank = color === "b" ? 0 : 7;

    if (move.row === startBackRank) {
      score += 14;
    }
  }

  try {
    const result = applyChessMove({
      board: cloneBoard(board),
      from: move.from,
      to: move.to,
      turn: color
    });

    const movedPieceValue = pieceValue(move.piece);

    if (isSquareAttacked(result.board, move.to, enemyColor)) {
      score -= Math.floor(movedPieceValue * 0.72);
    }

    const enemyKingCaptured = result.captured && chessPieceType(result.captured) === "K";
    if (enemyKingCaptured) {
      score += 999999;
    }
  } catch {
    score -= 999999;
  }

  if (difficulty === "easy") {
    score += Math.random() * 180;
  }

  if (difficulty === "normal") {
    score += Math.random() * 72;
  }

  if (difficulty === "hard") {
    score += Math.random() * 24;
  }

  if (difficulty === "boss") {
    score += Math.random() * 8;
  }

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
    return {
      ok: false,
      move: null,
      board,
      nextTurn: opposite(color),
      status: `${color === "b" ? "Black" : "White"} CPU has no legal moves.`
    };
  }

  const result = applyChessMove({
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
    status: `CPU moved ${result.move.piece} ${result.move.from} → ${result.move.to}.`,
    score: move.score || 0
  };
}

export function describeChessCpuMove(move = null) {
  if (!move) return "CPU has no move.";

  const capture = move.captured ? ` and captured ${move.captured}` : "";

  return `CPU moved ${move.piece} from ${move.from} to ${move.to}${capture}.`;
}

console.log("RB CHESS AI READY");
