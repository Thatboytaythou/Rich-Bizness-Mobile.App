/* =========================
   RICH BIZNESS MOBILE
   /core/games/chess-board.js

   RICH CHESS BOARD MODEL
   Board helpers + legal move map
========================= */

export const CHESS_START_BOARD = [
  ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
  ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
  ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"]
];

export const CHESS_FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function cloneChessBoard(board = CHESS_START_BOARD) {
  return board.map((row) => [...row]);
}

export function createChessBoard() {
  return cloneChessBoard(CHESS_START_BOARD);
}

export function inChessBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function chessSquareName(row, col) {
  return `${CHESS_FILES[col]}${8 - row}`;
}

export function parseChessSquare(square = "") {
  const file = String(square || "")[0];
  const rank = Number(String(square || "")[1]);
  const col = CHESS_FILES.indexOf(file);
  const row = 8 - rank;

  if (!inChessBounds(row, col)) return null;

  return { row, col };
}

export function chessPieceColor(piece = "") {
  return piece?.[0] || null;
}

export function chessPieceType(piece = "") {
  return piece?.[1] || null;
}

export function chessPieceAt(board, row, col) {
  if (!inChessBounds(row, col)) return null;
  return board?.[row]?.[col] || null;
}

export function isChessEnemy(piece, target) {
  return Boolean(
    piece &&
      target &&
      chessPieceColor(piece) !== chessPieceColor(target)
  );
}

export function isSameChessSquare(a, b) {
  return Boolean(a && b && a.row === b.row && a.col === b.col);
}

export function hasChessTarget(targets = [], square) {
  return targets.some((target) => {
    const parsed = typeof target === "string"
      ? parseChessSquare(target)
      : target;

    return isSameChessSquare(parsed, square);
  });
}

function pushChessTarget(board, moves, row, col, piece) {
  if (!inChessBounds(row, col)) return false;

  const target = chessPieceAt(board, row, col);

  if (!target) {
    moves.push({ row, col, square: chessSquareName(row, col) });
    return true;
  }

  if (isChessEnemy(piece, target)) {
    moves.push({
      row,
      col,
      square: chessSquareName(row, col),
      captured: target
    });
  }

  return false;
}

function chessLineMoves(board, row, col, piece, directions = []) {
  const moves = [];

  directions.forEach(([dr, dc]) => {
    let r = row + dr;
    let c = col + dc;

    while (inChessBounds(r, c)) {
      const keepGoing = pushChessTarget(board, moves, r, c, piece);
      if (!keepGoing) break;

      r += dr;
      c += dc;
    }
  });

  return moves;
}

export function getChessLegalMoves({
  board,
  row,
  col,
  turn = null
} = {}) {
  const piece = chessPieceAt(board, row, col);
  if (!piece) return [];

  const color = chessPieceColor(piece);
  const type = chessPieceType(piece);

  if (turn && color !== turn) return [];

  if (type === "P") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const moves = [];

    if (inChessBounds(row + dir, col) && !chessPieceAt(board, row + dir, col)) {
      moves.push({
        row: row + dir,
        col,
        square: chessSquareName(row + dir, col)
      });

      if (
        row === startRow &&
        !chessPieceAt(board, row + dir * 2, col)
      ) {
        moves.push({
          row: row + dir * 2,
          col,
          square: chessSquareName(row + dir * 2, col)
        });
      }
    }

    [-1, 1].forEach((dc) => {
      const r = row + dir;
      const c = col + dc;
      const target = chessPieceAt(board, r, c);

      if (inChessBounds(r, c) && isChessEnemy(piece, target)) {
        moves.push({
          row: r,
          col: c,
          square: chessSquareName(r, c),
          captured: target
        });
      }
    });

    return moves;
  }

  if (type === "R") {
    return chessLineMoves(board, row, col, piece, [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1]
    ]);
  }

  if (type === "B") {
    return chessLineMoves(board, row, col, piece, [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1]
    ]);
  }

  if (type === "Q") {
    return chessLineMoves(board, row, col, piece, [
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
      .map(([dr, dc]) => ({
        row: row + dr,
        col: col + dc
      }))
      .filter((move) => {
        const target = chessPieceAt(board, move.row, move.col);

        return (
          inChessBounds(move.row, move.col) &&
          (!target || isChessEnemy(piece, target))
        );
      })
      .map((move) => ({
        ...move,
        square: chessSquareName(move.row, move.col),
        captured: chessPieceAt(board, move.row, move.col)
      }));
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
      .map(([dr, dc]) => ({
        row: row + dr,
        col: col + dc
      }))
      .filter((move) => {
        const target = chessPieceAt(board, move.row, move.col);

        return (
          inChessBounds(move.row, move.col) &&
          (!target || isChessEnemy(piece, target))
        );
      })
      .map((move) => ({
        ...move,
        square: chessSquareName(move.row, move.col),
        captured: chessPieceAt(board, move.row, move.col)
      }));
  }

  return [];
}

export function applyChessMove({
  board,
  from,
  to,
  turn = "w"
} = {}) {
  const nextBoard = cloneChessBoard(board);
  const fromPos = typeof from === "string" ? parseChessSquare(from) : from;
  const toPos = typeof to === "string" ? parseChessSquare(to) : to;

  if (!fromPos || !toPos) {
    throw new Error("Invalid chess move squares.");
  }

  const piece = chessPieceAt(nextBoard, fromPos.row, fromPos.col);

  if (!piece) {
    throw new Error("No chess piece selected.");
  }

  if (turn && chessPieceColor(piece) !== turn) {
    throw new Error("Wrong turn.");
  }

  const legalMoves = getChessLegalMoves({
    board: nextBoard,
    row: fromPos.row,
    col: fromPos.col,
    turn
  });

  if (!hasChessTarget(legalMoves, toPos)) {
    throw new Error("Illegal chess move.");
  }

  const captured = chessPieceAt(nextBoard, toPos.row, toPos.col);

  nextBoard[toPos.row][toPos.col] = piece;
  nextBoard[fromPos.row][fromPos.col] = null;

  const move = {
    from: chessSquareName(fromPos.row, fromPos.col),
    to: chessSquareName(toPos.row, toPos.col),
    piece,
    captured,
    turn,
    created_at: new Date().toISOString()
  };

  return {
    board: nextBoard,
    move,
    captured,
    nextTurn: turn === "w" ? "b" : "w"
  };
}

export function findChessKing(board, color = "w") {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (chessPieceAt(board, row, col) === `${color}K`) {
        return {
          row,
          col,
          square: chessSquareName(row, col)
        };
      }
    }
  }

  return null;
}

export function getChessMaterial(board = []) {
  const material = {
    white: [],
    black: []
  };

  board.forEach((row) => {
    row.forEach((piece) => {
      if (!piece) return;

      if (chessPieceColor(piece) === "w") {
        material.white.push(piece);
      } else {
        material.black.push(piece);
      }
    });
  });

  return material;
}

export function serializeChessBoard(board = []) {
  return JSON.stringify(board);
}

export function deserializeChessBoard(value = "") {
  try {
    const parsed = JSON.parse(value);
    return cloneChessBoard(parsed);
  } catch {
    return createChessBoard();
  }
}

console.log("RB CHESS BOARD READY");
