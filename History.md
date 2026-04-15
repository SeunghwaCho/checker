# Changelog

All notable changes to the Vanilla Checkers project are documented here.

---

## [1.0.0] — 2026-04-15

### Initial release

#### Added
- **Game engine** (`app.js`)
  - 8×8 English Checkers rules
  - Mandatory capture (forced-jump) enforcement
  - Multi-jump (consecutive capture) in a single turn
  - King promotion when reaching the far rank
  - Minimax AI (depth 3) for 1-player mode
  - Material evaluation: piece = 3pts, king = 5pts

- **Rendering** (HTML5 Canvas)
  - Dark wooden board theme
  - Piece shadows and inner-ring detail
  - Selected-piece highlight (yellow border)
  - Legal-move dots (blue overlay)
  - Hint arrow with arrowhead (green)
  - Keyboard cursor indicator (cyan border)
  - Pause overlay
  - Win overlay with winner announcement

- **Input handling**
  - Mouse click: select and move
  - Touch (pointer events, `preventDefault` to suppress scroll)
  - Keyboard: arrow keys, Enter/Space, H, P, N, 1

- **Persistence** (IndexedDB)
  - Auto-save after every move
  - Auto-load on page open
  - Manual resume via "이어하기" button

- **Sound** (WebAudio, no external files)
  - Move beep (sine wave)
  - Capture beep (square wave, lower pitch)
  - Game-start chime
  - Win fanfare
  - Hint tone
  - Toggle ON/OFF

- **UI**
  - Dark theme with CSS custom properties
  - Responsive layout (`100dvh`, `env(safe-area-inset-*)`)
  - Fold/wide-screen aware (canvas sizes to available space)
  - Help panel (modal overlay)
  - Status bar with contextual messages

- **Test suite** (`tests.js`)
  - 10 test groups, 25+ individual assertions
  - Auto-runs on page load (console output)
  - Manual trigger via `window.runCheckerTests()`
  - Tests: initial board, legal moves, forced capture, move application,
    king promotion, king movement, multi-jump, edge cases, clone immutability,
    AI evaluation

- **Documentation**
  - `README.md`: feature table, keyboard shortcuts, rules, architecture notes
  - `History.md`: this file

---

## Planned / Future

- PWA (Service Worker + Web App Manifest) for true installable offline app
- Alpha-beta pruning for faster AI search
- Adjustable AI difficulty (depth 1–5)
- Move history / undo
- Animation for piece movement and captures
- Multiplayer over WebRTC (no server)
