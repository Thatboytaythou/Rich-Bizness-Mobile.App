/* =========================
   RICH BIZNESS MOBILE
   /core/games/chess-rules.js

   RICH CHESS RULES ENGINE
   Check + checkmate + legal-safe move validation
========================= */

import {
  cloneChessBoard,
  chessPieceAt,
  chessPieceColor,
  chessPieceType,
  chessSquareName,
  parseChessSquare,
  inChessBounds,
  getChessLegalMoves,
  applyChessMove,
  findChessKing
} from "/core/games/chess-board.js";

export function oppositeChessColor(color = "w") {
  return color === "w" ? "b" : "w";
}

export function chessColorName(color = "w") {
  return color === "b" ? "Black" : "White";
}

export function getPseudoLegalMovesForColor(board, color = "w") {
  const moves = [];

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = chessPieceAt(board, row, col);

      if (!piece || chessPieceColor(piece) !== color) continue;

      const from = chessSquareName(row, col);

      getChessLegalMoves({
        board,
        row,
        col,
        turn: color
      }).forEach((move) => {
        moves.push({
          from,
          to: move.square,
          piece,
          captured: move.captured || null
        });
      });
    }
  }

  return moves;
}

export function isChessSquareAttacked(board, square, byColor = "b") {
  const pos = typeof square === "string" ? parseChessSquare(square) : square;
  if (!pos) return false;

  const enemyMoves = getPseudoLegalMovesForColor(board, byColor);

  return enemyMoves.some((move) => move.to === chessSquareName(pos.row, pos.col));
}

export function isChessInCheck(board, color = "w") {
  const king = findChessKing(board, color);
  if (!king) return true;

  return isChessSquareAttacked(
    board,
    king.square,
    oppositeChessColor(color)
  );
}

export function simulateChessMove(board, from, to, turn = "w") {
  return applyChessMove({
    board: cloneChessBoard(board),
    from,
    to,
    turn
  });
}

export function isMoveLeavingKingInCheck(board, from, to, turn = "w") {
  try {
    const result = simulateChessMove(board, from, to, turn);
    return isChessInCheck(result.board, turn);
  } catch {
    return true;
  }
}

export function getSafeChessMoves({
  board,
  row,
  col,
  turn = "w"
} = {}) {
  const piece = chessPieceAt(board, row, col);
  if (!piece || chessPieceColor(piece) !== turn) return [];

  const from = chessSquareName(row, col);

  return getChessLegalMoves({
    board,
    row,
    col,
    turn
  }).filter((move) => {
    return !isMoveLeavingKingInCheck(board, from, move.square, turn);
  });
}

export function getAllSafeChessMoves(board, color = "w") {
  const safeMoves = [];

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = chessPieceAt(board, row, col);

      if (!piece || chessPieceColor(piece) !== color) continue;

      const from = chessSquareName(row, col);

      getSafeChessMoves({
        board,
        row,
        col,
        turn: color
      }).forEach((move) => {
        safeMoves.push({
          from,
          to: move.square,
          piece,
          captured: move.captured || null
        });
      });
    }
  }

  return safeMoves;
}

export function getChessGameStatus(board, turn = "w") {
  const inCheck = isChessInCheck(board, turn);
  const safeMoves = getAllSafeChessMoves(board, turn);

  if (inCheck && safeMoves.length === 0) {
    return {
      state: "checkmate",
      winner: oppositeChessColor(turn),
      turn,
      inCheck: true,
      message: `${chessColorName(turn)} is checkmated. ${chessColorName(oppositeChessColor(turn))} wins.`
    };
  }

  if (!inCheck && safeMoves.length === 0) {
    return {
      state: "stalemate",
      winner: null,
      turn,
      inCheck: false,
      message: "Stalemate. No legal moves."
    };
  }

  if (inCheck) {
    return {
      state: "check",
      winner: null,
      turn,
      inCheck: true,
      message: `${chessColorName(turn)} is in check.`
    };
  }

  return {
    state: "active",
    winner: null,
    turn,
    inCheck: false,
    message: `${chessColorName(turn)} to move.`
  };
}

export function validateRichChessMove({
  board,
  from,
  to,
  turn = "w"
} = {}) {
  const fromPos = typeof from === "string" ? parseChessSquare(from) : from;
  const toPos = typeof to === "string" ? parseChessSquare(to) : to;

  if (!fromPos || !toPos) {
    return {
      ok: false,
      error: "Invalid square."
    };
  }

  if (!inChessBounds(fromPos.row, fromPos.col) || !inChessBounds(toPos.row, toPos.col)) {
    return {
      ok: false,
      error: "Move out of bounds."
    };
  }

  const piece = chessPieceAt(board, fromPos.row, fromPos.col);

  if (!piece) {
    return {
      ok: false,
      error: "No piece selected."
    };
  }

  if (chessPieceColor(piece) !== turn) {
    return {
      ok: false,
      error: `It is ${chessColorName(turn)}'s turn.`
    };
  }

  const legal = getSafeChessMoves({
    board,
    row: fromPos.row,
    col: fromPos.col,
    turn
  });

  const toSquare = chessSquareName(toPos.row, toPos.col);
  const match = legal.find((move) => move.square === toSquare);

  if (!match) {
    return {
      ok: false,
      error: "Illegal move."
    };
  }

  return {
    ok: true,
    move: {
      from: chessSquareName(fromPos.row, fromPos.col),
      to: toSquare,
      piece,
      captured: match.captured || null,
      turn
    }
  };
}

export function applyRichChessMove({
  board,
  from,
  to,
  turn = "w"
} = {}) {
  const validation = validateRichChessMove({
    board,
    from,
    to,
    turn
  });

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const result = applyChessMove({
    board,
    from,
    to,
    turn
  });

  const status = getChessGameStatus(result.board, result.nextTurn);

  return {
    ...result,
    status,
    game_over: ["checkmate", "stalemate"].includes(status.state),
    winner: status.winner
  };
}

export function isKingCaptured(board) {
  let whiteKing = false;
  let blackKing = false;

  board.forEach((row) => {
    row.forEach((piece) => {
      if (piece === "wK") whiteKing = true;
      if (piece === "bK") blackKing = true;
    });
  });

  return {
    whiteKing,
    blackKing,
    captured: !whiteKing || !blackKing,
    winner: !whiteKing ? "b" : !blackKing ? "w" : null
  };
}

export function getRichChessMoveHint({
  board,
  turn = "w"
} = {}) {
  const moves = getAllSafeChessMoves(board, turn);

  if (!moves.length) {
    return null;
  }

  const captures = moves.filter((move) => move.captured);
  const pool = captures.length ? captures : moves;

  return pool[Math.floor(Math.random() * pool.length)];
}

export function getRichChessRulesSummary(board, turn = "w") {
  const status = getChessGameStatus(board, turn);
  const safeMoves = getAllSafeChessMoves(board, turn);

  return {
    ...status,
    legalMoveCount: safeMoves.length,
    hasMoves: safeMoves.length > 0,
    hint: getRichChessMoveHint({ board, turn })
  };
}

console.log("RB CHESS RULES READY");
