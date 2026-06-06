/* =========================
   RICH BIZNESS MOBILE
   /games/rich-chess/game.js

   RICH CHESS
   Lightweight playable chess engine
   Board UI + legal moves + captures + score submit hook
========================= */

import {
  startGameSession,
  endGameSession
} from "/core/features/gaming/game-session-client.js";

import {
  submitGameScore
} from "/core/features/gaming/game-score-client.js";

const $ = (id) => document.getElementById(id);

const els = {
  board: $("richChessBoard"),
  status: $("richChessStatus"),
  turn: $("richChessTurn"),
  score: $("richChessScore"),
  captured: $("richChessCaptured"),
  startBtn: $("richChessStartBtn"),
  resetBtn: $("richChessResetBtn"),
  submitBtn: $("richChessSubmitBtn")
};

const GAME_ID = "rich-chess";

const PIECES = {
  white: {
    king: "♔",
    queen: "♕",
    rook: "♖",
    bishop: "♗",
    knight: "♘",
    pawn: "♙"
  },
  black: {
    king: "♚",
    queen: "♛",
    rook: "♜",
    bishop: "♝",
    knight: "♞",
    pawn: "♟"
  }
};

const PIECE_VALUE = {
  pawn: 10,
  knight: 30,
  bishop: 30,
  rook: 50,
  queen: 90,
  king: 500
};

const state = {
  board: [],
  selected: null,
  legalMoves: [],
  turn: "white",
  score: 0,
  captured: [],
  started: false,
  session: null,
  winner: null,
  moveCount: 0
};

function makePiece(color, type) {
  return {
    color,
    type,
    icon: PIECES[color][type],
    moved: false
  };
}

function clonePiece(piece) {
  return piece
    ? { ...piece }
    : null;
}

function initialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));

  const back = [
    "rook",
    "knight",
    "bishop",
    "queen",
    "king",
    "bishop",
    "knight",
    "rook"
  ];

  back.forEach((type, col) => {
    board[0][col] = makePiece("black", type);
    board[1][col] = makePiece("black", "pawn");
    board[6][col] = makePiece("white", "pawn");
    board[7][col] = makePiece("white", type);
  });

  return board;
}

function setStatus(message) {
  if (els.status) {
    els.status.textContent = message;
  }
}

function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function pieceAt(row, col) {
  if (!inBounds(row, col)) return null;
  return state.board[row][col];
}

function sameColor(row, col, color) {
  return pieceAt(row, col)?.color === color;
}

function enemyAt(row, col, color) {
  const piece = pieceAt(row, col);
  return piece && piece.color !== color;
}

function addSlidingMoves(moves, row, col, color, directions) {
  directions.forEach(([dr, dc]) => {
    let r = row + dr;
    let c = col + dc;

    while (inBounds(r, c)) {
      if (sameColor(r, c, color)) break;

      moves.push({
        row: r,
        col: c,
        capture: enemyAt(r, c, color)
      });

      if (enemyAt(r, c, color)) break;

      r += dr;
      c += dc;
    }
  });
}

function legalMovesFor(row, col) {
  const piece = pieceAt(row, col);
  if (!piece) return [];

  const moves = [];
  const color = piece.color;

  if (piece.type === "pawn") {
    const dir = color === "white" ? -1 : 1;
    const startRow = color === "white" ? 6 : 1;

    if (inBounds(row + dir, col) && !pieceAt(row + dir, col)) {
      moves.push({
        row: row + dir,
        col,
        capture: false
      });

      if (
        row === startRow &&
        !pieceAt(row + dir * 2, col)
      ) {
        moves.push({
          row: row + dir * 2,
          col,
          capture: false
        });
      }
    }

    [-1, 1].forEach((dc) => {
      const r = row + dir;
      const c = col + dc;

      if (inBounds(r, c) && enemyAt(r, c, color)) {
        moves.push({
          row: r,
          col: c,
          capture: true
        });
      }
    });
  }

  if (piece.type === "rook") {
    addSlidingMoves(moves, row, col, color, [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]);
  }

  if (piece.type === "bishop") {
    addSlidingMoves(moves, row, col, color, [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ]);
  }

  if (piece.type === "queen") {
    addSlidingMoves(moves, row, col, color, [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ]);
  }

  if (piece.type === "knight") {
    [
      [2, 1],
      [2, -1],
      [-2, 1],
      [-2, -1],
      [1, 2],
      [1, -2],
      [-1, 2],
      [-1, -2]
    ].forEach(([dr, dc]) => {
      const r = row + dr;
      const c = col + dc;

      if (!inBounds(r, c)) return;
      if (sameColor(r, c, color)) return;

      moves.push({
        row: r,
        col: c,
        capture: enemyAt(r, c, color)
      });
    });
  }

  if (piece.type === "king") {
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ].forEach(([dr, dc]) => {
      const r = row + dr;
      const c = col + dc;

      if (!inBounds(r, c)) return;
      if (sameColor(r, c, color)) return;

      moves.push({
        row: r,
        col: c,
        capture: enemyAt(r, c, color)
      });
    });
  }

  return moves;
}

function isLegalTarget(row, col) {
  return state.legalMoves.some(
    (move) => move.row === row && move.col === col
  );
}

function clearSelection() {
  state.selected = null;
  state.legalMoves = [];
}

function selectSquare(row, col) {
  const piece = pieceAt(row, col);

  if (!piece || piece.color !== state.turn || state.winner) {
    clearSelection();
    render();
    return;
  }

  state.selected = { row, col };
  state.legalMoves = legalMovesFor(row, col);

  render();
}

function promoteIfNeeded(piece, row) {
  if (!piece || piece.type !== "pawn") return piece;

  if (
    (piece.color === "white" && row === 0) ||
    (piece.color === "black" && row === 7)
  ) {
    return {
      ...piece,
      type: "queen",
      icon: PIECES[piece.color].queen
    };
  }

  return piece;
}

function movePiece(toRow, toCol) {
  if (!state.selected) return;

  const { row, col } = state.selected;

  if (!isLegalTarget(toRow, toCol)) {
    selectSquare(toRow, toCol);
    return;
  }

  const piece = clonePiece(pieceAt(row, col));
  const captured = pieceAt(toRow, toCol);

  if (!piece) return;

  if (captured) {
    state.captured.push(captured);
    state.score += PIECE_VALUE[captured.type] || 0;

    if (captured.type === "king") {
      state.winner = piece.color;
      state.score += 1000;
    }
  }

  piece.moved = true;

  state.board[row][col] = null;
  state.board[toRow][toCol] = promoteIfNeeded(piece, toRow);

  state.moveCount += 1;
  state.turn = state.turn === "white" ? "black" : "white";

  clearSelection();
  render();

  if (state.winner) {
    setStatus(`${state.winner.toUpperCase()} wins. King captured.`);
    return;
  }

  setStatus(`${state.turn.toUpperCase()} to move.`);
}

function handleSquareClick(row, col) {
  if (!state.started) {
    setStatus("Press Start Match first.");
    return;
  }

  if (state.selected) {
    movePiece(row, col);
    return;
  }

  selectSquare(row, col);
}

function renderBoard() {
  if (!els.board) return;

  els.board.innerHTML = "";

  state.board.forEach((line, row) => {
    line.forEach((piece, col) => {
      const square = document.createElement("button");

      square.type = "button";
      square.className = [
        "rich-chess-square",
        (row + col) % 2 === 0 ? "is-light" : "is-dark",
        state.selected?.row === row && state.selected?.col === col
          ? "is-selected"
          : "",
        isLegalTarget(row, col)
          ? "is-legal"
          : "",
        isLegalTarget(row, col) && piece
          ? "is-capture"
          : ""
      ].filter(Boolean).join(" ");

      square.dataset.row = row;
      square.dataset.col = col;
      square.setAttribute(
        "aria-label",
        piece
          ? `${piece.color} ${piece.type}`
          : `Empty square ${row + 1}, ${col + 1}`
      );

      square.innerHTML = piece
        ? `<span class="rich-chess-piece ${piece.color}">${piece.icon}</span>`
        : "";

      square.addEventListener("click", () => handleSquareClick(row, col));

      els.board.appendChild(square);
    });
  });
}

function renderStats() {
  if (els.turn) {
    els.turn.textContent = state.winner
      ? `${state.winner.toUpperCase()} WON`
      : state.turn.toUpperCase();
  }

  if (els.score) {
    els.score.textContent = String(state.score);
  }

  if (els.captured) {
    els.captured.innerHTML = state.captured.length
      ? state.captured
          .map((piece) => `<span title="${piece.color} ${piece.type}">${piece.icon}</span>`)
          .join("")
      : "<span>No captures yet</span>";
  }

  if (els.submitBtn) {
    els.submitBtn.disabled = !state.started || !state.session?.id;
  }
}

function render() {
  renderBoard();
  renderStats();
}

async function startMatch() {
  resetMatch(false);

  state.started = true;

  try {
    state.session = await startGameSession({
      gameId: GAME_ID,
      gameSlug: "rich-chess",
      gameTitle: "Rich Chess",
      mode: "chess",
      metadata: {
        source: "games/rich-chess/game.js"
      }
    });

    setStatus("Rich Chess started. WHITE to move.");
  } catch (error) {
    console.warn("[RICH CHESS SESSION]", error?.message || error);
    setStatus("Match started locally. Sign in to save score.");
  }

  render();
}

function resetMatch(updateStatus = true) {
  state.board = initialBoard();
  state.selected = null;
  state.legalMoves = [];
  state.turn = "white";
  state.score = 0;
  state.captured = [];
  state.started = false;
  state.winner = null;
  state.moveCount = 0;

  if (updateStatus) {
    setStatus("Board reset. Press Start Match.");
  }

  render();
}

async function submitScoreAndEnd() {
  if (!state.session?.id) {
    setStatus("No saved session. Sign in and start a match first.");
    return;
  }

  const finalScore =
    state.score +
    Math.max(0, 80 - state.moveCount) +
    (state.winner ? 500 : 0);

  try {
    await submitGameScore({
      gameId: GAME_ID,
      sessionId: state.session.id,
      score: finalScore,
      points: finalScore,
      level: state.winner ? "win" : "active",
      rank: state.winner ? "King Taker" : "Chess Hustler",
      metadata: {
        captured: state.captured.map((piece) => ({
          color: piece.color,
          type: piece.type
        })),
        move_count: state.moveCount,
        winner: state.winner,
        base_score: state.score,
        source: "games/rich-chess/game.js"
      }
    });

    await endGameSession({
      sessionId: state.session.id,
      score: finalScore,
      reason: state.winner ? "completed" : "submitted",
      metadata: {
        winner: state.winner,
        move_count: state.moveCount,
        source: "games/rich-chess/game.js"
      }
    });

    setStatus(`Score submitted: ${finalScore}`);
    state.started = false;
    state.session = null;
    render();
  } catch (error) {
    console.error("[RICH CHESS SCORE FAILED]", error);
    setStatus(error?.message || "Score submit failed.");
  }
}

function bindEvents() {
  els.startBtn?.addEventListener("click", startMatch);
  els.resetBtn?.addEventListener("click", () => resetMatch(true));
  els.submitBtn?.addEventListener("click", submitScoreAndEnd);

  window.addEventListener("beforeunload", () => {
    if (!state.session?.id) return;

    endGameSession({
      sessionId: state.session.id,
      score: state.score,
      reason: "page_unload",
      metadata: {
        source: "games/rich-chess/game.js"
      }
    }).catch(() => {});
  });
}

function bootRichChess() {
  bindEvents();
  resetMatch(true);

  document.body.classList.add("rich-chess-ready");

  console.log("RICH CHESS READY");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootRichChess);
} else {
  bootRichChess();
}
