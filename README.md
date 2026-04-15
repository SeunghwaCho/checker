# Vanilla Checkers (체커 게임)

A fully offline checkers game built with **HTML5 Canvas + Vanilla JavaScript only** — no external libraries, no build tools, no CDN.

## Features

| Feature | Details |
|---|---|
| **1-Player mode** | Minimax AI (depth 3) plays as BLACK |
| **2-Player mode** | Local two-player on the same screen |
| **Mandatory capture** | Forced jump rule enforced |
| **Multi-jump** | Consecutive captures in one turn |
| **King promotion** | Piece becomes King (K) on reaching the far rank |
| **Mouse / Touch** | Click or tap to select and move pieces |
| **Keyboard** | Full keyboard control (arrow keys + Enter/Space) |
| **Hints** | Random legal-move hint with arrow overlay |
| **Sound** | WebAudio beeps (no files required), toggleable |
| **Save / Resume** | IndexedDB auto-save; loads on next visit |
| **Pause / Resume** | Freeze game state at any time |
| **Offline** | Zero network requests |
| **Responsive** | Fits any screen; tested on Fold-style wide displays |
| **Safe-area aware** | `env(safe-area-inset-*)` for notched devices |

## File Structure

```
checker/
├── index.html   — markup and UI shell
├── style.css    — dark-theme responsive styles
├── app.js       — game engine, AI, rendering, input
└── tests.js     — in-browser test suite (console output)
```

## How to Run

1. Clone or download the repository.
2. Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge).
3. No server required — works from `file://` directly.

```bash
git clone https://github.com/<your-username>/checker.git
cd checker
# open index.html in your browser
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| Arrow keys | Move cursor |
| Enter / Space | Select piece / confirm move |
| H | Show hint |
| P | Pause / Resume |
| N | New game (2-player) |
| 1 | New game (1-player vs AI) |

## Rules

- Standard English Checkers (8×8 board, 12 pieces per side).
- RED moves first; RED moves toward row 0 (up), BLACK moves toward row 7 (down).
- **Mandatory capture**: if you can jump an opponent's piece, you must.
- **Multi-jump**: after a capture, if the same piece can capture again, it must continue.
- A piece reaching the far rank becomes a **King** and can move in all 4 diagonal directions.
- Win by capturing all opponent pieces or leaving the opponent with no legal moves.

## Tests

Tests run automatically on page load and print results to the browser console (`F12 → Console`).  
You can also trigger them manually:

```js
window.runCheckerTests()
```

### Test Cases Covered

1. Initial board setup (24 pieces, correct positions)
2. Legal moves at game start (7 per side)
3. Mandatory capture detection
4. Move application and immutability
5. King promotion (RED at row 0, BLACK at row 7)
6. King 4-directional movement
7. Multi-jump availability
8. No-moves edge case
9. Board clone immutability
10. AI evaluation function (balanced = 0, biased > 0)

## Architecture Notes

- **State** is a single plain object — easy to serialize to IndexedDB.
- **`applyMove`** is pure (returns a new board) — safe for minimax tree search.
- **`allLegalMoves`** handles both forced-capture priority and `forcedPiece` (multi-jump) constraint.
- **Minimax** depth 3 with a simple material score (piece = 3, king = 5). No alpha-beta (kept simple intentionally).
- **WebAudio** oscillator beeps are generated on the fly — no audio files needed.

## Browser Support

Any browser supporting:
- HTML5 Canvas
- IndexedDB
- WebAudio API
- ES6+ (arrow functions, async/await, destructuring)

Tested: Chrome 120+, Firefox 121+, Safari 17+.

## License

MIT
