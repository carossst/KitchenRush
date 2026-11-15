# Kitchen Rush — handoff notes

Written for whoever (human or AI) picks this up next. Read `README.md` first for product
intent; this file covers the state of the code, what was changed recently, what is known
to be broken, and how to verify work.

## What this is

A static, no-build, no-backend browser game (vanilla JS, one `<canvas>`, PWA). Open
`index.html` from any static server. All state is in `localStorage`.

Run locally:

```bash
python3 -m http.server 8123
```

Then open `http://localhost:8123/`. There is no bundler, no package.json, no test suite, no CI.

## File map

| File | Role |
| --- | --- |
| `config.js` | Single source of truth for tuning, colours, pricing, version. `config-boot.js` validates it and throws on missing keys. |
| `wording.js` / `wording-dom.js` | Every user-facing string. Never hardcode copy in UI code. |
| `game.js` | Pure game engine (`KR_Game.GameEngine`): ball state machine, scoring, power-ups, daily modifiers. No DOM. |
| `ui.js` | Main UI class: state machine, canvas renderer (`_renderCanvasV2`), input, HUD, events, run recording. |
| `ui-screens.js` | Landing, end and paywall screens (HTML strings). |
| `ui-overlays.js`, `ui-modals.js`, `ui-sharing.js` | Start overlay/toasts, modals, share card. |
| `fx.js` | **New.** Cosmetic effects: backdrop, particles, rings, ball trail, camera punch, combo meter, confetti. |
| `characters.js` | **New.** Cartoon player (back view) and opponent (front view). Accepts `palette` and `swingT` overrides. |
| `duel.js` | **New.** Duel mode: its own engine, 3D-projected renderer, input and DOM. See "Duel mode" below. |
| `storage*.js` | `StorageManager` over `localStorage`: runs balance, history, personal best, premium, codes. |
| `success.html` / `success.js` | Post-payment page that displays the premium code. |
| `sw.js` / `pwa.js` | Service worker (cache-first). Cache name derives from `KR_CONFIG.version`. |
| `simulate.js` | Business/funnel simulation (revenue, virality). **Not** a gameplay test. |

Script order in `index.html` matters (all `defer`); a new script must also be added to
`ASSET_GROUPS.appScripts` in `sw.js`.

## Conventions that will bite you

- **Bump `version` in `config.js` on every release.** The service worker is cache-first and
  only refreshes when the version (passed as `?v=`) changes. Currently `"6"`.
- **Coordinates.** The engine works in *logical canvas pixels* (`run.canvasW/H`), in a flat
  "world" space. The renderer projects world → screen with `projectX` / `projectCourtY`
  inside `_renderCanvasV2`. Anything drawn at the ball must use the projected position
  (`this._runtime._ballScreen`), not `ball.x/y`.
- **HiDPI.** The canvas backing store is `logical × devicePixelRatio` (capped at 2). Use
  `this._logicalW/_logicalH`, never `canvas.width/height`, for layout or input maths.
- **`smashes` is the score, not a hit count.** Perfect hits are worth 2 and Smash Boost
  multiplies. Use `totalSmashed` (or the `accuracyPct()` helper in `ui.js`) for hit counts.
- `style.css` has a hygiene contract in its header (no duplicate selectors, tokens only,
  weights 400/500/700). Keep to it.
- `fx.js` and `characters.js` are optional by design: `ui.js` guards every call and falls
  back to the legacy drawing if they are missing. Both honour `prefers-reduced-motion`
  and the adaptive perf tier (`_getRenderPerfTier()`: 0 full, 1 low, 2 minimal).

## What was done (November 2026)

PR 2 (merged) — visual modernisation:
- `fx.js` effects layer; vivid court palette, depth shading, glowing kitchen lines.
- Landing hero (animated mini court + wordmark), night-arena CSS theme, tactile buttons.
- Fixed: blurry canvas on phones (no DPR handling); hit flash and score popup drawn at
  world instead of screen coordinates; start overlay not dismissable by keyboard
  (Space/Enter now work); Classic hidden on first visit (now a secondary button).
- Focus-visible outlines, canvas `role`/`aria-label`, `.DS_Store` removed.

Follow-up PR — characters and engine/storage/payment audit:
- `characters.js`: new cartoon athletes replace the flat silhouettes.
- Fixed: accuracy could exceed 100% (it divided score by balls served) on the end screen,
  landing nudges and improvement checks. `totalSmashed` is now stored with each run.
- Fixed: frame step is clamped to 100 ms so a long frame cannot teleport the ball.
- Fixed: a storage schema bump dropped `isPremium` and the redeemed code, and migrated
  data was not persisted. Both are now carried over and saved.
- Fixed: the Buy button did nothing at all when the Stripe URL is unset; it now shows a toast.

Duel PR — new main mode, after owner feedback that the arcade loop was "ugly and not
interesting" (the player only positioned; the return was automatic):
- `duel.js`: a real rally against AI. Singles, or doubles with a choice of left/right side.
- Landing: "Play Duel" is the primary CTA; Daily and Classic sit under "Arcade modes".

## Duel mode (`duel.js`)

Entirely separate from `game.js`/`ui.js`: `UI._startDuel()` calls `KR_DUEL.start()`, which
mounts a full-screen `.kr-duel` element on `<body>` and removes it on exit. It reuses
`KR_FX`, `KR_CHARACTERS` and the UI sound function, nothing else.

- **World**: feet. x −10..10, y −22 (near baseline) .. 22, z up, net at y=0, kitchen ±7.
  Team 0 is the near side (human, plus partner in doubles); team 1 the far side.
- **Camera**: pinhole projection in `_project()`, pitch 59° portrait / 34° landscape,
  auto-fitted to the screen in `_resize()`. Static scenery is cached in `_drawBackground()`.
- **Ball**: real ballistic flight (`G`), bounce damping, net collision in `_stepBall()`.
- **Shots**: `_launch()` solves the arc to a target and raises it until it clears the net;
  a stretched contact (`badness`) adds target error and removes net margin, which is where
  outs and net faults come from. Contact above 5.4 ft becomes a smash.
- **Aim**: `aimToShot(ax, ay)` — x picks the side, y −1 dink / 0 middle / +1 deep drive.
  Keyboard: arrows/WASD + Space (held direction aims). Mouse: click where the ball should
  go. Touch: left thumb joystick, right thumb swipe (release = swing).
- **Rules**: rally scoring to 5, point winner serves; serve and return must bounce
  (`ball.hits < 3` on a volley is a fault); volley while standing in the kitchen is a fault;
  serve landing in the kitchen is a fault; second bounce ends the point.
- **AI** (`_ai`, `_aiShot`): predicts the bounce, reacts after `react` s, runs at `speed`,
  targets the most open spot weighted by `aggr`, error `err`, misjudges out balls by `judge`.
  Six opponents in `LADDER`; beyond the last one stats keep scaling.
- **Save**: `localStorage["kr:duel"]` = `{ stage, mode, side, wins }`.
- Duel is not behind the free-run counter or paywall.

Not done in Duel: no partner/side switching between points, no doubles service rotation or
score-calling, AI never poaches across the centre line, no tutorial, tuning was done with a
bot only (a perfect bot beats opponent 1 about 5–1) — real-player difficulty is unverified.

## Known issues — not fixed, need a decision

1. **Payment is not operational.** `stripeEarlyPaymentUrl` and `stripeStandardPaymentUrl`
   in `config.js` are still `REPLACE_WITH_…` placeholders.
2. **Nothing generates the premium code.** `success.js` only *reads* `kr:vanityCode` from
   `localStorage`; no code in the repo ever writes it. A paying customer landing on
   `success.html` would see an empty code. This flow has never worked end to end here.
3. **Premium is honour-system.** Codes are validated client-side by a regex
   (`^KR-[A-Z0-9]{4}-[A-Z0-9]{4}$`), so any matching string unlocks premium, and the free-run
   counter lives in `localStorage` (clearing site data resets it). Real enforcement needs a
   backend (Stripe webhook or Checkout Session verification issuing signed codes).
4. **Diagonal movement is about 41% faster** than straight movement (`game.js` `update()`
   adds X and Y steps independently). Mouse and touch input are mostly diagonal, so
   normalising would slow the game noticeably — a balance decision, left alone.
5. **Shield-saved faults still play the fault feedback** (shake, sound, red burst) because
   the UI only looks at `ball.state === FAULTED`; check `ball.savedByShield` to soften it.
6. `config.identity.appUrl` is marked "TBD: confirm domain"; canonical/OG tags point at
   `https://kitchenrush.app/`. No `CNAME` file in the repo.
7. The end screen shows two primary-styled buttons (Play again, Share) competing for attention.
8. Not tested on real devices: touch input and low-end Android performance at 2× DPR.

## How to verify changes

No test suite exists. What was used:

```bash
for f in *.js; do node --check "$f"; done
```

Then a headless Chromium pass with Playwright (viewport 390×844, DPR 1 and 2):
landing → click `[data-action="play-daily"]` → press Enter → wait for `.kr-screen--end`,
asserting no console errors. To make a bot play, wrap `KR_UI.prototype._renderCanvasV2` to
capture the UI instance and the state, then move the mouse to `ball.targetX/targetY`
(auto-return fires when the player is close). A streak of 8–9 is typical for that bot.

Useful debug handles: `window.storageManager`, `window.KR_CONFIG`, and on localhost
`window.KR_DEBUG.resetStorage()`.

## Suggested next steps

- Decide the payment architecture (items 1–3) before any launch.
- Add a small automated smoke test (the Playwright flow above) and run it in CI.
- Sound design and music are still basic (`audio.js`, synthesised).
- More character variety (palettes live in `KR_CHARACTERS.palettes`), court skins per milestone.
