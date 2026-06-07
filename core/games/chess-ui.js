/* =========================
   RICH BIZNESS MOBILE
   /core/games/chess-ui.js

   RICH CHESS UI ENGINE
   Board paint + tap selection + move log + captured pieces
   Tight piece rendering + clean coordinates
========================= */

const PIECE_ICONS = {
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

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const UI = {
  boardEl: null,
  statusEl: null,
  turnEl: null,
  movesEl: null,
  roomEl: null,
  playerEl: null,
  capturedEl: null,
  logEl: null,

  selected: null,
  legalTargets: [],
  lastMove: null,

  onSquareTap: null
};

function safeText(value = "", fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

function squareName(row, col) {
  return `${FILES[col]}${8 - row}`;
}

function parseSquare(square = "") {
  const text = String(square || "").trim().toLowerCase();
  const file = text[0];
  const rank = Number(text[1]);
  const col = FILES.indexOf(file);
  const row = 8 - rank;

  if (col < 0 || row < 0 || row > 7) return null;

  return { row, col };
}

function pieceColor(piece = "") {
  return piece?.[0] === "w" ? "white" : "black";
}

function pieceType(piece = "") {
  return piece?.[1] || "";
}

function isSameSquare(a, b) {
  return Boolean(a && b && a.row === b.row && a.col === b.col);
}

function targetHasSquare(targets = [], square) {
  return targets.some((item) => {
    const parsed = typeof item === "string" ? parseSquare(item) : item;
    return isSameSquare(parsed, square);
  });
}

function emitUi(eventName, detail = {}) {
  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail
    })
  );
}

function setText(el, value = "") {
  if (el) el.textContent = value ?? "";
}

function clearNode(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

function createCoordLabel(text, className) {
  const label = document.createElement("span");
  label.className = className;
  label.textContent = text;
  label.setAttribute("aria-hidden", "true");
  return label;
}

function createSquare({
  row,
  col,
  piece = null,
  selected = null,
  legalTargets = [],
  lastMove = null,
  flipped = false
}) {
  const square = document.createElement("button");
  const name = squareName(row, col);

  const isDark = (row + col) % 2 === 1;
  const selectedMatch = isSameSquare(selected, { row, col });
  const legalMatch = targetHasSquare(legalTargets, { row, col });
  const isLastMove = lastMove?.from === name || lastMove?.to === name;

  square.type = "button";

  square.className = [
    "rich-chess-square",
    isDark ? "is-dark" : "is-light",
    selectedMatch ? "is-selected" : "",
    legalMatch ? "is-legal" : "",
    legalMatch && piece ? "is-capture" : "",
    isLastMove ? "is-last-move" : "",
    piece ? "has-piece" : "",
    piece ? `has-${pieceColor(piece)}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  square.dataset.square = name;
  square.dataset.row = String(row);
  square.dataset.col = String(col);

  square.setAttribute("role", "gridcell");
  square.setAttribute(
    "aria-label",
    piece ? `${name}, ${pieceColor(piece)} ${pieceType(piece)}` : `${name}, empty`
  );

  const showRank = (!flipped && col === 0) || (flipped && col === 7);
  const showFile = (!flipped && row === 7) || (flipped && row === 0);

  if (showRank) {
    square.appendChild(
      createCoordLabel(String(8 - row), "rich-chess-rank-label")
    );
  }

  if (showFile) {
    square.appendChild(
      createCoordLabel(FILES[col], "rich-chess-file-label")
    );
  }

  if (piece) {
    const pieceNode = document.createElement("span");

    pieceNode.className = [
      "rich-chess-piece",
      pieceColor(piece),
      `type-${pieceType(piece).toLowerCase()}`
    ].join(" ");

    pieceNode.textContent = PIECE_ICONS[piece] || piece;
    pieceNode.dataset.piece = piece;
    pieceNode.dataset.color = pieceColor(piece);
    pieceNode.dataset.type = pieceType(piece);
    pieceNode.setAttribute("aria-hidden", "true");

    square.appendChild(pieceNode);
  }

  square.addEventListener("click", () => {
    UI.onSquareTap?.({
      square: name,
      row,
      col,
      piece
    });

    emitUi("rb-chess-square-tap", {
      square: name,
      row,
      col,
      piece
    });
  });

  return square;
}

export function initChessUI({
  boardId = "chessBoard",
  statusId = "chessStatus",
  turnId = "chessTurn",
  movesId = "chessMoves",
  roomId = "chessRoom",
  playerId = "chessPlayer",
  capturedId = "chessCaptured",
  logId = "chessMoveLog",
  onSquareTap = null
} = {}) {
  UI.boardEl = document.getElementById(boardId);
  UI.statusEl = document.getElementById(statusId);
  UI.turnEl = document.getElementById(turnId);
  UI.movesEl = document.getElementById(movesId);
  UI.roomEl = document.getElementById(roomId);
  UI.playerEl = document.getElementById(playerId);
  UI.capturedEl = document.getElementById(capturedId);
  UI.logEl = document.getElementById(logId);
  UI.onSquareTap = onSquareTap;

  if (UI.boardEl) {
    UI.boardEl.classList.add("rich-chess-board");
    UI.boardEl.setAttribute("role", "grid");
    UI.boardEl.setAttribute("aria-label", "Rich Chess board");
  }

  return getChessUI();
}

export function getChessUI() {
  return {
    selected: UI.selected,
    legalTargets: [...UI.legalTargets],
    lastMove: UI.lastMove,
    ready: Boolean(UI.boardEl)
  };
}

export function setChessStatus(message = "") {
  setText(UI.statusEl, message);
}

export function setChessIdentity({
  room = "Local",
  player = "Guest"
} = {}) {
  setText(UI.roomEl, safeText(room, "Local"));
  setText(UI.playerEl, safeText(player, "Guest"));
}

export function setChessTurn(turn = "w") {
  const label =
    turn === "b" ||
    String(turn).toLowerCase() === "black"
      ? "Black"
      : "White";

  setText(UI.turnEl, label);
}

export function setChessMoveCount(count = 0) {
  setText(UI.movesEl, String(Number(count || 0)));
}

export function setSelectedSquare(square = null) {
  UI.selected = typeof square === "string" ? parseSquare(square) : square;
}

export function clearSelectedSquare() {
  UI.selected = null;
  UI.legalTargets = [];
}

export function setLegalTargets(targets = []) {
  UI.legalTargets = targets
    .map((item) => (typeof item === "string" ? parseSquare(item) : item))
    .filter(Boolean);
}

export function setLastMove(move = null) {
  UI.lastMove = move
    ? {
        from: move.from,
        to: move.to,
        piece: move.piece || null,
        captured: move.captured || null
      }
    : null;
}

export function renderChessBoard({
  board = [],
  selected = UI.selected,
  legalTargets = UI.legalTargets,
  lastMove = UI.lastMove,
  flipped = false
} = {}) {
  if (!UI.boardEl) return;

  UI.selected = typeof selected === "string" ? parseSquare(selected) : selected;

  UI.legalTargets = legalTargets
    .map((item) => (typeof item === "string" ? parseSquare(item) : item))
    .filter(Boolean);

  UI.lastMove = lastMove;

  clearNode(UI.boardEl);

  UI.boardEl.classList.toggle("is-flipped", Boolean(flipped));

  const rowIndexes = flipped
    ? [7, 6, 5, 4, 3, 2, 1, 0]
    : [0, 1, 2, 3, 4, 5, 6, 7];

  const colIndexes = flipped
    ? [7, 6, 5, 4, 3, 2, 1, 0]
    : [0, 1, 2, 3, 4, 5, 6, 7];

  rowIndexes.forEach((realRow) => {
    colIndexes.forEach((realCol) => {
      const piece = board?.[realRow]?.[realCol] || null;

      UI.boardEl.appendChild(
        createSquare({
          row: realRow,
          col: realCol,
          piece,
          selected: UI.selected,
          legalTargets: UI.legalTargets,
          lastMove: UI.lastMove,
          flipped
        })
      );
    });
  });
}

export function renderCapturedPieces(captured = []) {
  if (!UI.capturedEl) return;

  clearNode(UI.capturedEl);

  if (!captured.length) {
    const empty = document.createElement("span");
    empty.textContent = "No captures yet.";
    UI.capturedEl.appendChild(empty);
    return;
  }

  captured.forEach((piece) => {
    const item = document.createElement("span");
    item.className = `rich-chess-captured-piece ${pieceColor(piece)}`;
    item.textContent = PIECE_ICONS[piece] || piece;
    item.dataset.piece = piece;
    UI.capturedEl.appendChild(item);
  });
}

export function renderMoveLog(moves = []) {
  if (!UI.logEl) return;

  clearNode(UI.logEl);

  if (!moves.length) {
    const empty = document.createElement("li");
    empty.textContent = "No moves yet.";
    UI.logEl.appendChild(empty);
    return;
  }

  moves.forEach((move, index) => {
    const item = document.createElement("li");

    const piece = PIECE_ICONS[move.piece] || move.piece || "";
    const capture = move.captured
      ? ` x ${PIECE_ICONS[move.captured] || move.captured}`
      : "";

    item.innerHTML = `
      <span>${index + 1}.</span>
      <strong>${piece} ${move.from || ""} → ${move.to || ""}${capture}</strong>
    `;

    UI.logEl.appendChild(item);
  });
}

export function paintChessGameState(state = {}) {
  renderChessBoard({
    board: state.board || [],
    selected: state.selected || UI.selected,
    legalTargets: state.legalTargets || UI.legalTargets,
    lastMove: state.lastMove || UI.lastMove,
    flipped: Boolean(state.flipped)
  });

  setChessTurn(state.turn || "w");
  setChessMoveCount(state.moves?.length || state.moveCount || 0);
  renderCapturedPieces(state.captured || []);
  renderMoveLog(state.moves || []);

  setChessIdentity({
    room: state.roomCode || state.room || "Local",
    player: state.playerName || state.player || "Guest"
  });

  if (state.status) {
    setChessStatus(state.status);
  }
}

export function flashChessSquare(square, className = "is-flashing") {
  if (!UI.boardEl || !square) return;

  const el = UI.boardEl.querySelector(`[data-square="${square}"]`);
  if (!el) return;

  el.classList.add(className);

  setTimeout(() => {
    el.classList.remove(className);
  }, 700);
}

export function showChessCheck(square) {
  flashChessSquare(square, "is-check");
}

export function showChessIllegal(square) {
  flashChessSquare(square, "is-illegal");
}

export function destroyChessUI() {
  if (UI.boardEl) clearNode(UI.boardEl);

  UI.boardEl = null;
  UI.statusEl = null;
  UI.turnEl = null;
  UI.movesEl = null;
  UI.roomEl = null;
  UI.playerEl = null;
  UI.capturedEl = null;
  UI.logEl = null;

  UI.selected = null;
  UI.legalTargets = [];
  UI.lastMove = null;
  UI.onSquareTap = null;
}

console.log("RB CHESS UI READY");
