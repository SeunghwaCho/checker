(() => {
  "use strict";

  // ===== Mini test runner =====
  let passed = 0, failed = 0;

  function assert(name, cond) {
    if (!cond) {
      console.error("FAIL", name);
      failed++;
      return false;
    }
    console.log("PASS", name);
    passed++;
    return true;
  }

  function assertEqual(name, actual, expected) {
    return assert(`${name} (expected ${expected}, got ${actual})`, actual === expected);
  }

  function section(title) {
    console.groupCollapsed(`--- ${title} ---`);
  }
  function endSection() { console.groupEnd(); }

  function runTests() {
    const C = window.CheckersCore;
    if (!C) {
      console.warn("CheckersCore not found — skipping tests");
      return;
    }

    // ==========================================================
    // 1. Initial board setup
    // ==========================================================
    section("1. Initial Board");
    const b = C.createInitialBoard();
    let red = 0, black = 0, empty = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (p === C.RED) red++;
        else if (p === C.BLACK) black++;
        else if (p === C.EMPTY) empty++;
      }
    }
    assertEqual("Initial RED pieces", red, 12);
    assertEqual("Initial BLACK pieces", black, 12);
    assertEqual("Initial EMPTY cells", empty, 40);
    assert("Board is 8x8", b.length === 8 && b[0].length === 8);
    assert("Top-left [0][0] is EMPTY (light square)", b[0][0] === C.EMPTY);
    assert("BLACK piece at [0][1]", b[0][1] === C.BLACK);
    assert("RED piece at [7][0] is EMPTY (light square)", b[7][0] === C.EMPTY);
    assert("RED piece at [7][1]", b[7][1] === C.RED);
    assert("Middle rows empty [3][1]", b[3][1] === C.EMPTY);
    endSection();

    // ==========================================================
    // 2. Legal moves — initial position
    // ==========================================================
    section("2. Legal Moves — Initial");
    const lmRed = C.allLegalMoves(b, C.RED, null);
    assert("Initial RED has legal moves", lmRed.moves.length > 0);
    assert("Initial RED no forced capture", lmRed.mustCapture === false);
    assertEqual("Initial RED move count", lmRed.moves.length, 7);

    const lmBlack = C.allLegalMoves(b, C.BLACK, null);
    assert("Initial BLACK has legal moves", lmBlack.moves.length > 0);
    assertEqual("Initial BLACK move count", lmBlack.moves.length, 7);
    endSection();

    // ==========================================================
    // 3. Mandatory capture (forced jump)
    // ==========================================================
    section("3. Mandatory Capture");
    const t = Array.from({ length: 8 }, () => Array(8).fill(C.EMPTY));
    t[5][0] = C.RED;
    t[4][1] = C.BLACK;
    const lm = C.allLegalMoves(t, C.RED, null);
    assert("Forced capture recognized", lm.mustCapture === true);
    assertEqual("Forced capture count", lm.moves.length, 1);
    assert("Jump destination row=3", lm.moves[0].to[0] === 3);
    assert("Jump destination col=2", lm.moves[0].to[1] === 2);
    assert("Capture pos row=4", lm.moves[0].capture[0] === 4);
    assert("Capture pos col=1", lm.moves[0].capture[1] === 1);
    endSection();

    // ==========================================================
    // 4. Apply move
    // ==========================================================
    section("4. Apply Move");
    const moved = C.applyMove(t, lm.moves[0]);
    assert("Origin cleared after move", moved[5][0] === C.EMPTY);
    assert("Captured piece removed", moved[4][1] === C.EMPTY);
    assert("Piece at destination", moved[3][2] === C.RED);
    assert("Original board unchanged", t[5][0] === C.RED); // immutability
    endSection();

    // ==========================================================
    // 5. King promotion
    // ==========================================================
    section("5. King Promotion");
    const k = Array.from({ length: 8 }, () => Array(8).fill(C.EMPTY));
    k[1][2] = C.RED;
    const mv = { from: [1, 2], to: [0, 1], capture: null };
    const k2 = C.applyMove(k, mv);
    assert("RED promoted to RED_KING at row 0", k2[0][1] === C.RED_KING);

    const kb = Array.from({ length: 8 }, () => Array(8).fill(C.EMPTY));
    kb[6][3] = C.BLACK;
    const mv2 = { from: [6, 3], to: [7, 4], capture: null };
    const kb2 = C.applyMove(kb, mv2);
    assert("BLACK promoted to BLACK_KING at row 7", kb2[7][4] === C.BLACK_KING);
    endSection();

    // ==========================================================
    // 6. King movement (all 4 directions)
    // ==========================================================
    section("6. King Movement");
    const kg = Array.from({ length: 8 }, () => Array(8).fill(C.EMPTY));
    kg[4][4] = C.RED_KING;
    const kingMoves = C.allLegalMoves(kg, C.RED, null).moves;
    assertEqual("King has 4 diagonal moves", kingMoves.length, 4);
    endSection();

    // ==========================================================
    // 7. Multi-jump setup
    // ==========================================================
    section("7. Multi-jump");
    const mj = Array.from({ length: 8 }, () => Array(8).fill(C.EMPTY));
    mj[5][0] = C.RED;
    mj[4][1] = C.BLACK;
    mj[2][3] = C.BLACK;
    // RED can jump BLACK at [4][1] landing at [3][2], then jump [2][3] landing [1][4]
    const mjMoves = C.allLegalMoves(mj, C.RED, null);
    assert("Multi-jump first capture forced", mjMoves.mustCapture === true);
    const after1 = C.applyMove(mj, mjMoves.moves[0]);
    assert("After 1st jump: black removed at [4][1]", after1[4][1] === C.EMPTY);
    assert("Piece at [3][2]", after1[3][2] === C.RED);
    // Check second jump available
    const { getMovesForPiece } = C;
    // We use allLegalMoves with forcedPiece to simulate multi-jump
    const lm2 = C.allLegalMoves(after1, C.RED, [3, 2]);
    assert("Second jump available", lm2.moves.length >= 1);
    endSection();

    // ==========================================================
    // 8. No moves = opponent wins
    // ==========================================================
    section("8. Board edge cases");
    const empty8 = Array.from({ length: 8 }, () => Array(8).fill(C.EMPTY));
    empty8[0][1] = C.RED;
    // RED has a piece but no moves (stuck in corner with no opponent to jump)
    // Actually in row 0 RED_KING could move; let's test: normal RED at top row can't move forward
    const noMove = Array.from({ length: 8 }, () => Array(8).fill(C.EMPTY));
    noMove[0][1] = C.RED; // RED moves up (row 0 = top), no rows above
    const nmLegal = C.allLegalMoves(noMove, C.RED, null);
    assertEqual("RED at top row has 0 moves", nmLegal.moves.length, 0);
    endSection();

    // ==========================================================
    // 9. Clone board immutability
    // ==========================================================
    section("9. Clone Board");
    const orig = C.createInitialBoard();
    const clone = C.cloneBoard(orig);
    clone[0][1] = C.EMPTY;
    assert("Original board not affected by clone mutation", orig[0][1] === C.BLACK);
    endSection();

    // ==========================================================
    // 10. AI evaluation
    // ==========================================================
    section("10. AI Evaluation");
    const balanced = C.createInitialBoard();
    const score = C.evaluate(balanced);
    assertEqual("Balanced board score is 0", score, 0);

    const biased = Array.from({ length: 8 }, () => Array(8).fill(C.EMPTY));
    biased[0][1] = C.BLACK;
    const biasedScore = C.evaluate(biased);
    assert("Board with only BLACK is positive", biasedScore > 0);
    endSection();

    // ==========================================================
    // Summary
    // ==========================================================
    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} passed, ${failed} failed`);
    if (failed === 0) {
      console.log("All tests passed!");
    } else {
      console.warn(`${failed} test(s) FAILED — check output above`);
    }
  }

  window.addEventListener("load", () => {
    // Small delay to ensure CheckersCore is initialized
    setTimeout(() => {
      try {
        runTests();
      } catch (e) {
        console.error("Test runner crashed:", e);
      }
    }, 100);
  });

  // Expose for manual triggering
  window.runCheckerTests = runTests;
})();
