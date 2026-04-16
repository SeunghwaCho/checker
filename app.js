(() => {
  "use strict";

  // ===== Constants =====
  const SIZE = 8;
  const EMPTY = 0;
  const RED = 1;
  const BLACK = 2;
  const RED_KING = 3;
  const BLACK_KING = 4;

  const MODE_1P = "1P";
  const MODE_2P = "2P";

  const DB_NAME = "checkersDB";
  const STORE = "saveSlots";
  const SAVE_KEY = "latest";

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");

  const statusEl = document.getElementById("status");
  const new1pBtn = document.getElementById("new1pBtn");
  const new2pBtn = document.getElementById("new2pBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const hintBtn = document.getElementById("hintBtn");
  const helpBtn = document.getElementById("helpBtn");
  const closeHelpBtn = document.getElementById("closeHelpBtn");
  const helpPanel = document.getElementById("helpPanel");
  const soundBtn = document.getElementById("soundBtn");
  const confirmOverlay = document.getElementById("confirmOverlay");
  const confirmMsg = document.getElementById("confirmMsg");
  const confirmOk = document.getElementById("confirmOk");
  const confirmCancel = document.getElementById("confirmCancel");
  const orderOverlay = document.getElementById("orderOverlay");
  const orderFirst = document.getElementById("orderFirst");
  const orderSecond = document.getElementById("orderSecond");
  const orderCancel = document.getElementById("orderCancel");

  // ===== State =====
  let state = {
    board: createInitialBoard(),
    turn: RED,
    selected: null,
    legalMoves: [],
    mustCapture: false,
    forcedPiece: null,   // multi-jump: same piece forced
    mode: MODE_2P,
    paused: false,
    winner: null,
    cursor: { r: 0, c: 0 },
    soundOn: true,
    hint: null,
    playerColor: RED
  };

  // ===== Audio (WebAudio, no external files) =====
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  function beep(freq = 440, dur = 0.08, type = "sine", vol = 0.03) {
    if (!state.soundOn) return;
    try {
      ensureAudio();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + dur);
    } catch (_) { /* ignore audio errors */ }
  }

  // ===== DB (IndexedDB) =====
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveGame() {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(JSON.stringify(state), SAVE_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (_) { /* ignore save errors */ }
  }

  async function loadGame() {
    try {
      const db = await openDB();
      const data = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(SAVE_KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      db.close();
      if (data) {
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed.board) || parsed.board.length !== 8) return false;
        state = { ...state, ...parsed, hint: null };
        return true;
      }
    } catch (_) { /* ignore load errors */ }
    return false;
  }

  // ===== Game Setup =====
  function createInitialBoard() {
    const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((r + c) % 2 === 1) b[r][c] = BLACK;
      }
    }
    for (let r = 5; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((r + c) % 2 === 1) b[r][c] = RED;
      }
    }
    return b;
  }

  function newGame(mode, playerColor = RED) {
    state.board = createInitialBoard();
    state.turn = RED;
    state.selected = null;
    state.legalMoves = [];
    state.mustCapture = false;
    state.forcedPiece = null;
    state.mode = mode;
    state.paused = false;
    state.winner = null;
    state.cursor = { r: 0, c: 0 };
    state.hint = null;
    state.playerColor = playerColor;
    pauseBtn.textContent = "⏸️ 일시정지";
    setStatus(`새 게임 시작 (${mode}) - RED 차례`);
    beep(523, 0.08);
    render();
    saveGame();
    // 후공이면 AI가 먼저
    if (mode === MODE_1P && playerColor !== RED) {
      setTimeout(() => {
        const ai = bestMoveFor(RED, state.board);
        if (ai) doMove(ai);
      }, 300);
    }
  }

  // ===== Rules =====
  function isRed(p) { return p === RED || p === RED_KING; }
  function isBlack(p) { return p === BLACK || p === BLACK_KING; }
  function isKing(p) { return p === RED_KING || p === BLACK_KING; }
  function inBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }

  function dirsFor(piece) {
    if (piece === RED) return [[-1, -1], [-1, 1]];
    if (piece === BLACK) return [[1, -1], [1, 1]];
    return [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // king: all 4 dirs
  }

  function opponentOf(turn) {
    return turn === RED ? BLACK : RED;
  }

  function pieceBelongsToTurn(piece, turn) {
    return (turn === RED && isRed(piece)) || (turn === BLACK && isBlack(piece));
  }

  function getMovesForPiece(board, r, c, captureOnly = false) {
    const piece = board[r][c];
    if (!piece) return [];
    const dirs = dirsFor(piece);
    const moves = [];
    for (const [dr, dc] of dirs) {
      const r1 = r + dr, c1 = c + dc;
      const r2 = r + dr * 2, c2 = c + dc * 2;

      // jump (capture)
      if (inBounds(r2, c2) && inBounds(r1, c1) && board[r2][c2] === EMPTY) {
        const mid = board[r1][c1];
        if (mid !== EMPTY &&
          ((isRed(piece) && isBlack(mid)) || (isBlack(piece) && isRed(mid)))) {
          moves.push({ from: [r, c], to: [r2, c2], capture: [r1, c1] });
        }
      }

      // normal move
      if (!captureOnly && inBounds(r1, c1) && board[r1][c1] === EMPTY) {
        moves.push({ from: [r, c], to: [r1, c1], capture: null });
      }
    }
    return moves;
  }

  function allLegalMoves(board, turn, forcedPiece = null) {
    let pieces = [];
    if (forcedPiece) {
      pieces = [forcedPiece];
    } else {
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const p = board[r][c];
          if (pieceBelongsToTurn(p, turn)) pieces.push([r, c]);
        }
      }
    }

    const captures = [];
    for (const [r, c] of pieces) captures.push(...getMovesForPiece(board, r, c, true));
    if (captures.length > 0) return { moves: captures, mustCapture: true };

    const normals = [];
    for (const [r, c] of pieces) {
      normals.push(...getMovesForPiece(board, r, c, false).filter(m => !m.capture));
    }
    return { moves: normals, mustCapture: false };
  }

  function cloneBoard(b) { return b.map(row => row.slice()); }

  function applyMove(board, move) {
    const nb = cloneBoard(board);
    const [fr, fc] = move.from;
    const [tr, tc] = move.to;
    const piece = nb[fr][fc];
    nb[fr][fc] = EMPTY;
    nb[tr][tc] = piece;
    if (move.capture) {
      const [cr, cc] = move.capture;
      nb[cr][cc] = EMPTY;
    }
    // kinging
    if (piece === RED && tr === 0) nb[tr][tc] = RED_KING;
    if (piece === BLACK && tr === SIZE - 1) nb[tr][tc] = BLACK_KING;
    return nb;
  }

  function hasAnyPiece(board, color) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const p = board[r][c];
        if (color === RED && isRed(p)) return true;
        if (color === BLACK && isBlack(p)) return true;
      }
    }
    return false;
  }

  function checkWinner() {
    const redAlive = hasAnyPiece(state.board, RED);
    const blackAlive = hasAnyPiece(state.board, BLACK);
    if (!redAlive) return BLACK;
    if (!blackAlive) return RED;
    const lm = allLegalMoves(state.board, state.turn, state.forcedPiece).moves;
    if (lm.length === 0) return opponentOf(state.turn);
    return null;
  }

  // ===== AI (minimax depth 3) =====
  function evaluate(board) {
    let score = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const p = board[r][c];
        if (p === BLACK) score += 3;
        if (p === BLACK_KING) score += 5;
        if (p === RED) score -= 3;
        if (p === RED_KING) score -= 5;
      }
    }
    return score;
  }

  function bestMoveFor(color, board) {
    const { moves } = allLegalMoves(board, color, null);
    if (!moves.length) return null;
    // BLACK maximizes score, RED minimizes
    const maximizing = color === BLACK;
    let best = moves[0], bestVal = maximizing ? -Infinity : Infinity;
    for (const mv of moves) {
      const nb = applyMove(board, mv);
      const val = minimax(nb, 2, !maximizing);
      if (maximizing ? val > bestVal : val < bestVal) { bestVal = val; best = mv; }
    }
    return best;
  }

  function minimax(board, depth, maximizing) {
    if (depth === 0) return evaluate(board);
    const turn = maximizing ? BLACK : RED;
    const { moves } = allLegalMoves(board, turn, null);
    if (!moves.length) return evaluate(board);

    if (maximizing) {
      let v = -Infinity;
      for (const m of moves) v = Math.max(v, minimax(applyMove(board, m), depth - 1, false));
      return v;
    } else {
      let v = Infinity;
      for (const m of moves) v = Math.min(v, minimax(applyMove(board, m), depth - 1, true));
      return v;
    }
  }

  // ===== UI Actions =====
  function setStatus(t) { statusEl.textContent = t; }

  function selectCell(r, c) {
    if (state.paused || state.winner) return;
    if (state.mode === MODE_1P && state.turn !== state.playerColor) return;
    const piece = state.board[r][c];
    const legal = allLegalMoves(state.board, state.turn, state.forcedPiece);
    state.mustCapture = legal.mustCapture;

    if (pieceBelongsToTurn(piece, state.turn)) {
      // select piece
      const pieceMoves = legal.moves.filter(m => m.from[0] === r && m.from[1] === c);
      if (pieceMoves.length) {
        state.selected = [r, c];
        state.legalMoves = pieceMoves;
        beep(600, 0.03);
      }
    } else if (state.selected) {
      // attempt move
      const mv = state.legalMoves.find(m => m.to[0] === r && m.to[1] === c);
      if (mv) doMove(mv);
    }
    render();
  }

  function doMove(mv) {
    state.board = applyMove(state.board, mv);
    beep(mv.capture ? 220 : 440, 0.07, "square");
    state.hint = null;

    // multi-jump check
    if (mv.capture) {
      const [tr, tc] = mv.to;
      const nextCaps = getMovesForPiece(state.board, tr, tc, true);
      if (nextCaps.length > 0) {
        state.forcedPiece = [tr, tc];
        state.selected = [tr, tc];
        state.legalMoves = nextCaps;
        setStatus(`연속 점프 가능 - 같은 말로 계속 진행`);
        saveGame();
        render();
        // AI 연속 점프 처리
        const aiColor = state.playerColor === RED ? BLACK : RED;
        if (state.mode === MODE_1P && state.turn === aiColor && !state.paused) {
          setTimeout(() => {
            const ai = bestMoveFor(aiColor, state.board);
            if (ai) doMove(ai);
          }, 300);
        }
        return;
      }
    }

    // switch turn
    state.forcedPiece = null;
    state.selected = null;
    state.legalMoves = [];
    state.turn = opponentOf(state.turn);

    state.winner = checkWinner();
    if (state.winner) {
      setStatus(`게임 종료: ${state.winner === RED ? "RED" : "BLACK"} 승리! 🎉`);
      beep(880, 0.15, "triangle");
    } else {
      setStatus(`${state.turn === RED ? "RED" : "BLACK"} 차례`);
    }

    saveGame();
    render();

    // 1P AI turn
    const aiColor = state.playerColor === RED ? BLACK : RED;
    if (!state.winner && state.mode === MODE_1P && state.turn === aiColor && !state.paused) {
      setTimeout(() => {
        const ai = bestMoveFor(aiColor, state.board);
        if (ai) doMove(ai);
      }, 300);
    }
  }

  function showHint() {
    if (state.paused || state.winner) return;
    const legal = allLegalMoves(state.board, state.turn, state.forcedPiece).moves;
    if (!legal.length) return;
    state.hint = legal[Math.floor(Math.random() * legal.length)];
    setStatus(`힌트: (${state.hint.from.join(",")}) → (${state.hint.to.join(",")})`);
    beep(700, 0.05);
    render();
  }

  function togglePause() {
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? "▶️ 이어하기" : "⏸️ 일시정지";
    setStatus(state.paused ? "일시정지됨 - P키 또는 버튼으로 재개" : "재개됨");
    saveGame();
    render();
  }

  function toggleSound() {
    state.soundOn = !state.soundOn;
    soundBtn.textContent = `${state.soundOn ? "🔊" : "🔇"} 사운드: ${state.soundOn ? "ON" : "OFF"}`;
    saveGame();
  }

  // ===== Rendering =====
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const topbarH = document.querySelector(".topbar").getBoundingClientRect().height;
    const availW = window.innerWidth - 16;
    const availH = window.innerHeight - topbarH - 16;
    const cssSize = Math.floor(Math.max(240, Math.min(availW, availH)));
    canvas.style.width = cssSize + "px";
    canvas.style.height = cssSize + "px";
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function drawBoard() {
    const s = canvas.clientWidth / SIZE;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#d7b899" : "#5a3d2b";
        ctx.fillRect(c * s, r * s, s, s);
      }
    }

    // keyboard cursor
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(state.cursor.c * s + 2, state.cursor.r * s + 2, s - 4, s - 4);

    // selected piece highlight
    if (state.selected) {
      const [r, c] = state.selected;
      ctx.strokeStyle = "#ff0";
      ctx.lineWidth = 3;
      ctx.strokeRect(c * s + 3, r * s + 3, s - 6, s - 6);
    }

    // legal move dots
    for (const m of state.legalMoves) {
      const [r, c] = m.to;
      ctx.fillStyle = "rgba(80,200,255,0.5)";
      ctx.beginPath();
      ctx.arc(c * s + s / 2, r * s + s / 2, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    // hint arrow
    if (state.hint) {
      const [fr, fc] = state.hint.from;
      const [tr, tc] = state.hint.to;
      ctx.strokeStyle = "#7CFC00";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(fc * s + s / 2, fr * s + s / 2);
      ctx.lineTo(tc * s + s / 2, tr * s + s / 2);
      ctx.stroke();
      // arrowhead
      const angle = Math.atan2(tr - fr, tc - fc);
      const ax = tc * s + s / 2, ay = tr * s + s / 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - 10 * Math.cos(angle - 0.4), ay - 10 * Math.sin(angle - 0.4));
      ctx.lineTo(ax - 10 * Math.cos(angle + 0.4), ay - 10 * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fillStyle = "#7CFC00";
      ctx.fill();
    }
  }

  function drawPieces() {
    const s = canvas.clientWidth / SIZE;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const p = state.board[r][c];
        if (!p) continue;
        const x = c * s + s / 2, y = r * s + s / 2;

        // shadow
        ctx.beginPath();
        ctx.arc(x + 2, y + 2, s * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fill();

        // piece body
        ctx.beginPath();
        ctx.arc(x, y, s * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = isRed(p) ? "#d74a4a" : "#2a2a2a";
        ctx.fill();
        ctx.strokeStyle = isRed(p) ? "#ff8888" : "#666";
        ctx.lineWidth = 2;
        ctx.stroke();

        // inner ring
        ctx.beginPath();
        ctx.arc(x, y, s * 0.25, 0, Math.PI * 2);
        ctx.strokeStyle = isRed(p) ? "rgba(255,150,150,0.4)" : "rgba(150,150,150,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        if (isKing(p)) {
          ctx.fillStyle = "#ffd700";
          ctx.font = `bold ${Math.floor(s * 0.38)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("K", x, y + 1);
        }
      }
    }
  }

  function render() {
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);
    drawBoard();
    drawPieces();

    if (state.paused) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.floor(W * 0.09)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PAUSED", W / 2, H / 2);
    }

    if (state.winner) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffd700";
      ctx.font = `bold ${Math.floor(W * 0.09)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${state.winner === RED ? "RED" : "BLACK"} WIN!`, W / 2, H / 2);
    }
  }

  // ===== Input: Mouse / Touch =====
  function eventToCell(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const c = Math.floor((x / rect.width) * SIZE);
    const r = Math.floor((y / rect.height) * SIZE);
    if (!inBounds(r, c)) return null;
    return { r, c };
  }

  canvas.addEventListener("click", (e) => {
    const cell = eventToCell(e.clientX, e.clientY);
    if (!cell) return;
    state.cursor = { ...cell };
    selectCell(cell.r, cell.c);
  });

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const cell = eventToCell(t.clientX, t.clientY);
    if (!cell) return;
    state.cursor = { ...cell };
    selectCell(cell.r, cell.c);
  }, { passive: false });

  // ===== Input: Keyboard =====
  window.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "ArrowUp")    { state.cursor.r = Math.max(0, state.cursor.r - 1); }
    else if (k === "ArrowDown")  { state.cursor.r = Math.min(7, state.cursor.r + 1); }
    else if (k === "ArrowLeft")  { state.cursor.c = Math.max(0, state.cursor.c - 1); }
    else if (k === "ArrowRight") { state.cursor.c = Math.min(7, state.cursor.c + 1); }
    else if (k === "Enter" || k === " ") { selectCell(state.cursor.r, state.cursor.c); }
    else if (k.toLowerCase() === "h") { showHint(); }
    else if (k.toLowerCase() === "p") { togglePause(); }
    else if (k.toLowerCase() === "n") { newGame(MODE_2P); }
    else if (k === "1") { newGame(MODE_1P); }
    else return;
    render();
    e.preventDefault();
  });

  // ===== Confirm Dialog =====
  function showConfirm(msg, onOk) {
    confirmMsg.textContent = msg;
    confirmOverlay.classList.remove("hidden");
    const cleanup = () => confirmOverlay.classList.add("hidden");
    confirmOk.onclick = () => { cleanup(); onOk(); };
    confirmCancel.onclick = cleanup;
  }

  function showOrderDialog(onSelect) {
    orderOverlay.classList.remove("hidden");
    const cleanup = () => orderOverlay.classList.add("hidden");
    orderFirst.onclick  = () => { cleanup(); onSelect(RED); };
    orderSecond.onclick = () => { cleanup(); onSelect(BLACK); };
    orderCancel.onclick = cleanup;
  }

  // ===== Buttons =====
  new1pBtn.onclick = () => showConfirm("진행 중인 게임이 종료됩니다.\n1인용 새 게임을 시작할까요?", () =>
    showOrderDialog(playerColor => newGame(MODE_1P, playerColor))
  );
  new2pBtn.onclick = () => showConfirm("진행 중인 게임이 종료됩니다.\n2인용 새 게임을 시작할까요?", () => newGame(MODE_2P));
  pauseBtn.onclick = () => togglePause();
  hintBtn.onclick = () => showHint();
  helpBtn.onclick = () => helpPanel.classList.remove("hidden");
  closeHelpBtn.onclick = () => helpPanel.classList.add("hidden");
  soundBtn.onclick = () => toggleSound();

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("beforeunload", saveGame);

  // ===== Boot =====
  (async function init() {
    resizeCanvas();
    const loaded = await loadGame();
    if (loaded) {
      setStatus(`저장된 게임 불러옴 - ${state.turn === RED ? "RED" : "BLACK"} 차례`);
    } else {
      setStatus("새 게임을 시작하세요.");
    }
    render();
  })();

  // Expose core for tests
  window.CheckersCore = {
    createInitialBoard, allLegalMoves, applyMove, getMovesForPiece,
    cloneBoard, evaluate, bestMoveFor,
    RED, BLACK, RED_KING, BLACK_KING, EMPTY,
    SIZE
  };
})();
