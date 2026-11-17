# Kitchen Rush — handoff notes

## START HERE (state at version 16, 2026-11-16)

**Where things are**
- Everything is merged into `main` (PRs #2 to #8). Live site (GitHub Pages, deploys from `main`, takes 1-2 minutes):
  https://carossst.github.io/KitchenRush/ (`?lang=fr` / `?lang=en`; poster: `poster.html?lang=fr|en`). Footer shows the version.
- Start new work on a **new branch from `main`**, push it, open a **draft PR**. Do not merge or mark ready unless the owner says so.
- Repo: `carossst/KitchenRush`. PR #1 (`improve/pickleball-rally`, another agent's rally game) was **closed without merging** by the owner on 2026-11-16; the branch is kept as a read-only reference and must NOT be merged:
  it conflicts with `main` and replaces the UI. Treat it as a reference (see "What was taken from the rally branch").
- Other owner repos seen read-only: `carossst/pickleballgame` = the Pickleball Rules Quiz (domain www.pickleballrulesquiz.com, has its own
  `poster.html`; the owner once reported a font-colour bug there: question text white on a light box, not investigated),
  `carossst/CoffeeGameGithub` = a coffee quiz. The owner's Arkanoid-style prototype with US/French players is NOT in any repo; it was hosted by the
  other agent (ChatGPT "Sites"), address given by the owner but never opened (the owner only wanted the chat read). Don't use real player names.

**What the game is now**: the original arcade (Classic / Daily / Power Run, in `ui.js` + `game.js`) plus **Duel** (`duel.js`), the main mode:
aimed rallies against AI, singles or doubles, slow motion at contact, 7-opponent ladder with a final boss, worlds, 6 courts, powers and capsules,
coins and 7 fictional players, daily duel, tutorial, FR/EN. Details in the sections below, newest last.

**How to run and test** (no build; needs `python3`, `node`, and `playwright` for the browser tests)
```bash
python3 -m http.server 8123          # then open http://localhost:8123/
node tests/wording.test.mjs          # texts: keys, placeholders (fast, no browser)
node tests/duel-rules.mjs            # rules and features, drives the game directly (about 10 s)
node tests/duel-smoke.mjs            # bot-played matches, catches stalls (about 5 min)
```
Run all three before every Duel change. Poster QR: `python3 tools/make-qr.py` (needs `pip install segno`).

**Working agreements with the owner** (French speaker; replies in French; keep answers short, they are token-limited)
- Ask before merging; "fusionne" means: mark the draft PR ready and merge it. Create PRs as drafts.
- Soft currency only: no real money, no random paid packs (legal/ethical reasons, see the audit). Real athlete names need permission (legal).
- Never publish a design claim you did not test; say what is unverified (nothing was playtested by humans or on a real phone).
- This session widened the sandbox network allowlist once for a site and removed it again; nothing is left open.

**Priorities next** (from the owner to-do list and the audit): 1) human playtest on real phones and read the exported playtest data
(Progress tab "Copy my playtest data"); 2) sound design and haptics; 3) daily quests and coin sinks (cosmetics, upgrades), raise prices;
4) colour-blind-safe power cues; 5) translate the remaining screens (paywall, share card, legal pages); 6) decide the payment architecture
or remove it; 7) final domain, then regenerate the QR codes. Sections below are chronological: later sections supersede earlier details.

Written for whoever (human or AI) picks this up next. Read `README.md` first for product
intent; this file covers the state of the code, what was changed recently, what is known
to be broken, and how to verify work.

**Practical rules (found by a cold-start test of this document)**
- **Which tests when**: `wording.test.mjs` and `duel-rules.mjs` after every change. `duel-smoke.mjs` (about 5 minutes, 4 bot-played scenarios: singles
  bot, doubles-left bot, doubles idle, daily bot) before opening any PR that touches Duel gameplay, physics, the render loop or the menu; skip it for
  copy-only, CSS-only or docs-only changes.
- **Version bump**: increase `version` in `config.js` once per PR that changes shipped files (so the service worker refreshes); not for docs-only PRs.
- **Numbering**: `unlock` in `VENUES` is a 0-based opponent index; the UI shows `unlock + 1` ("Reach opponent 5" means `unlock: 4`). `VENUE_ORDER` is the order
  of the court picker; `AUTO` maps each ladder step to a court (7 entries, same length as `LADDER`) and is a separate decision.
- **Adding a court**: entry in `VENUES`; id in `VENUE_ORDER`; English and French names in `wording.duel.venues` and `wording.duelFr.venues` (both in `wording.js`);
  the id in the "every venue renders" list of `tests/duel-rules.mjs`; look at portrait and landscape screenshots (colours are only verified by eye).
- **Where French lives**: app screens in `wording-fr.js`; the Duel's French is `duelFr` inside `wording.js`.
- **Playwright**: preinstalled in the original cloud sandbox; elsewhere run `npm i -D playwright && npx playwright install chromium` (the tests `require("playwright")`).

## What this is

A static, no-build, no-backend browser game (vanilla JS, one `<canvas>`, PWA). Open
`index.html` from any static server. All state is in `localStorage`.

Run locally:

```bash
python3 -m http.server 8123
```

Then open `http://localhost:8123/`. There is no bundler, no package.json and no CI; the browser tests live in `tests/` (see START HERE).

## File map

| File | Role |
| --- | --- |
| `config.js` | Single source of truth for tuning, colours, pricing, version. `config-boot.js` validates it and throws on missing keys. |
| `wording.js` / `wording-fr.js` / `wording-dom.js` | Every user-facing string (English base; `wording-fr.js` overrides it in French; `wording.duelFr` for Duel). Never hardcode copy in UI code. |
| `game.js` | Pure game engine (`KR_Game.GameEngine`): ball state machine, scoring, power-ups, daily modifiers. No DOM. |
| `ui.js` | Main UI class: state machine, canvas renderer (`_renderCanvasV2`), input, HUD, events, run recording. |
| `ui-screens.js` | Landing, end and paywall screens (HTML strings). |
| `ui-overlays.js`, `ui-modals.js`, `ui-sharing.js` | Start overlay/toasts, modals, share card. |
| `fx.js` | **New.** Cosmetic effects: backdrop, particles, rings, ball trail, camera punch, combo meter, confetti. |
| `characters.js` | **New.** Cartoon player (back view) and opponent (front view). Accepts `palette` and `swingT` overrides. |
| `duel.js` | **New.** Duel mode: its own engine, 3D-projected renderer, input and DOM (about 1422 lines, the main mode). See "Duel mode" below and the later version sections. |
| `poster.html`, `icons/qr-*.svg`, `icons/poster-duel-*.jpg`, `tools/make-qr.py` | Printable FR/EN poster with QR codes. |
| `tests/` | `wording.test.mjs`, `duel-rules.mjs`, `duel-smoke.mjs` (see START HERE). |
| `storage*.js` | `StorageManager` over `localStorage`: runs balance, history, personal best, premium, codes. |
| `success.html` / `success.js` | Post-payment page that displays the premium code. |
| `sw.js` / `pwa.js` | Service worker (cache-first). Cache name derives from `KR_CONFIG.version`. |
| `simulate.js` | Business/funnel simulation (revenue, virality). **Not** a gameplay test. |

Script order in `index.html` matters (all `defer`); a new script must also be added to
`ASSET_GROUPS.appScripts` in `sw.js`.

## Conventions that will bite you

- **Bump `version` in `config.js` on every release.** The service worker is cache-first and
  only refreshes when the version (passed as `?v=`) changes. Currently `"16"`.
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

The automated tests are in `tests/` (see START HERE). Two older, lighter checks that are still useful:

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


## Duel update (version 7) and TODO for the next agent

Done in this update:
- **Focus time**: in `duel.js`, `_wantSlow()` slows the world to 16-40% speed (`_slowScale()`, scales with
  the opponent stage) while an incoming ball is in reach, for a per-ball real-time budget
  (`_slowBudget()`, shrinks with stage). Any touch / held direction + Space / click then aims the shot.
  It never triggers on a ball that must still bounce or on an illegal kitchen volley.
- **Looks**: `LOOKS` in `duel.js` + `hairStyle` in `characters.js` (short, ponytail, bob, long, bun, curly)
  with varied skin tones; "Change my look" button in the match menu; opponents renamed to neutral names.
- **Fixed a stall**: `_launch()` could inflate flight time without bound for a ball struck just past the net
  (ball at z~1000, point never ended; mostly visible in doubles). The net-clearance loop now only runs
  when the shot actually crosses the net and is capped.
- Human reach 3.9 -> 4.7 ft, speed 16 -> 18 ft/s, focus trigger radius widened, to make wide balls catchable.

Verification used: a Playwright script that plays Duel matches with a bot and detects "phase/score/ball id
unchanged for 7 s" as a stall (see "How to verify" above). Doubles idle, doubles bot and singles bot all finish.

TODO, in priority order (written for a smaller model; do them one at a time, run the stall test after each):
1. **Playtest balance with a human.** Opponent 1 should be easy but not free, opponent 6 hard. Tune only
   `LADDER` numbers (`speed`, `react`, `err`, `aggr`) and `_slowScale()/_slowBudget()`.
2. **Doubles polish**: add service rotation and side switching; make the AI partner poach balls that
   cross the centre line; show which half is "mine" with a subtle floor marker.
3. **Too simple?** Ideas, cheapest first: opponent stage modifiers (wind, a bonus ball, shorter focus time),
   a spin/curve shot when swiping with a curve, combo score for consecutive winners, daily Duel opponent.
4. **Arcade-style effects with celebrity players** (owner mentioned an earlier version with Arkanoid-like
   effects and 10 US + 10 French famous pickleball players, one set per language version). Not found in this
   repo; ask the owner where it lives before rebuilding. Do not use real names/likenesses of real people
   without checking rights; fictional lookalike characters are safer.
5. Payment is still not operational (see "Known issues"). Decide the architecture before launch.
6. Real-device test (touch, low-end Android). Sound design for Duel (distinct paddle hit, crowd, ball bounce).

## Audit: `main` vs the rally branch (written 2026-11-16, read-only audit, rally branch not run)

Two lines exist and have diverged:
- **`main`**: original Kitchen Rush (Classic, Daily, Power Run) + **Duel** (aimed shots, slow-motion focus time, singles/doubles, 6 AI opponents, cartoon 3D court). English only, no real athlete names, no tests, no server, payment unfinished.
- **`improve/pickleball-rally`** (PR #1, draft, conflicting with `main`, work by another agent): 2v2 doubles rally with automatic returns, FR and US editions, 10 identities per edition with fixed FR<->US power pairs (9 effects), six round profiles, drop/drive and Pillar/Creator options, end screen with record gap / next goal / history / collection, daily seed, Node + SQLite leaderboard with replay verification (not deployed), 59 tests, FR/US manifests, deferred service-worker update. It no longer loads `ui*.js` / `main.js`, so merging it would **replace** the arcade and Duel instead of adding to them.

**Decision recorded: do not merge PR #1.** Keep `main` as the base and port ideas one at a time.

### Port from the rally branch to `main`, in order
1. **FR/EN for Duel**: move the `duel` block of `wording.js` behind a language switch (browser language, persisted choice) and add French. Also the landing, menu and banners.
2. **End screen / progress for Duel**: record gap, next objective, last 5 matches, opponents beaten (`kr:duel` already stores `stage`, `wins`).
3. **Tests**: port the idea of `tests/rally.test.mjs` (determinism, rules) and keep the stall detector from "How to verify". `duel.js` uses `Math.random`; a seeded RNG is needed for deterministic tests and for any daily mode.
4. **One power per opponent** (reach, slow, reflex volley, life, shield, speed, drive, ATP, smash), discovered from stage 1 to 4. Keep fixed pairs across languages: same effect, same strength, same duration.
5. **Round profiles as opponent traits** (centre-heavy, sides, slow/fast alternation).
6. **Daily Duel** with a shared seed; ranking only once a server exists.
7. **Defer the service-worker update** until the match ends.

### Port from `main` to the rally branch (only if that line is kept)
Aimed shots and focus time, real ball physics and rules, cartoon characters with varied looks, the `fx.js` layer, the stall fix.

### Real athlete names: set aside (legal)
The rally branch's `players.js` uses real professional players' names with source links. Using a real person's name or likeness in a game generally needs their permission (personality / publicity rights; in France also droit à l'image and the right to one's name), and a source link is not permission. **Do not port `players.js`, and do not put real names in the game, until written permission or a legal opinion exists.** Ask the owner before reintroducing them.

Placeholder roster until then: fictional names that only echo the originals (not the same name, no likeness). Still have a lawyer check them if the game goes public.

| Power (same in both editions) | FR placeholder | US placeholder |
|---|---|---|
| Block Volley (bigger paddle, 6 s) | Léo Pavel | Anya Lee Watts |
| Erne | Lara Rocca | Ana Brightwell |
| Reset | Matéo Rey | Bo Jones |
| ATP | Miriam Emery | Tara Blake |
| Drive | Émile Bernel | Haden Patrick |
| Dig | Anaïs Loriel | JT Jensen |
| Reflex Volley | Noa Khalil | Noa Khalil (same in both) |
| Smash | Jay Delvaux | Jay Delvaux (same in both) |
| Lob (+1 life) | Valentina Verne | Jordi Jansen |
| Reflex Volley | Manon Sarceau | Perry Dodd |

The arcade-style effects mentioned by the owner (an earlier version with Arkanoid-like effects and 10 US + 10 French players) are not in this repository; ask where that prototype lives before rebuilding.


## Port status (2026-11-16, version 8)

Ported from the rally branch into `main` (no real athlete names, see the legal note above):
- **FR/EN for Duel** (item 1): `wording.duel` (EN, base) + `wording.duelFr` (overrides). Language is the saved
  choice (`kr:duel.lang`) else the browser language; a "Francais / English" button sits in the match menu.
  The rest of the app (landing, arcade, end screen, share card) is still English only: next step is to
  generalise the same override pattern to `wording.js` as a whole.
- **Match history and end screen** (item 2): last 20 matches, last 5 shown as W/L dots, win count, best margin,
  goal for the next match, and a collection of opponents beaten. Stored in `kr:duel` and sanitised on load
  (`loadSave()`), so corrupted or hand-edited storage cannot break the menu.
- **Smoke test** (item 3): `tests/duel-smoke.mjs` (needs `playwright`; see the file header). It plays full
  matches with a bot and fails on a stall, a console error, a match that never ends, missing history, or a
  broken language toggle. Run all three scenarios before every Duel change. It found a real bug on its first
  run: after a point (e.g. net), an AI player could still hit the dead ball, which put the match back in the
  rally phase with no way to end it. Fixed in `_tryHit` / `_ai`, plus a watchdog after `_stepBall`.
- **Deferred update** (item 7): the service-worker update toast is hidden while a Duel is open
  (`body:has(.kr-duel) #update-toast`), so it can never be tapped mid-match.

Still to port, in order: one power per opponent (4), round profiles as opponent traits (5), Daily Duel with a
seeded RNG (6; `duel.js` uses `Math.random`), FR for the rest of the app, deterministic unit tests of the rules.


## Daily Duel (version 9)

- **Daily Duel** (item 6 of the port list): a "Daily Duel" button in the match menu plays today's opponent
  (picked from the UTC date: `dailyInfo()`), singles, on a seeded RNG (`seeded()`, mulberry32). All gameplay
  randomness goes through `rand()` in `duel.js`; only the screen shake still uses `Math.random`. It never
  touches the ladder (no stage, wins, beaten list or history); only the first attempt of the day is stored
  in `kr:duel.daily`. A result line and a Share button (Web Share, else clipboard; text = date, score,
  opponent, link) replace the button once played.
- Limits: the seed is shared but the match is not fully deterministic (it depends on frame timing and on
  the player), so two players do not get identical rallies. There is no ranking: that needs a server
  (see the rally branch's `server/`, replay verification and per-day boards). Daily and Share strings are
  in `wording.duel` / `wording.duelFr`.
- `tests/duel-smoke.mjs` now has four scenarios (singles bot, doubles-left bot, doubles idle, daily bot).

Still to port: one power per opponent, round profiles as opponent traits, French for the rest of the app,
deterministic unit tests of the rules.


## Powers, opponent styles, full French, rule tests (version 10)

All four remaining port items are done:
- **One power per opponent**: beating opponent i earns `POWERS[i]` (reach, touch, power, precision, sprint, pass).
  Win points to charge (3 points), then tap the HUD button or press E to fire it for 10 s. Choose which earned
  power is equipped by tapping its chip in the match menu. Disabled in the Daily Duel (same conditions for all).
  Effects live in `_launch` (power, precision), `_tryHit` (reach, pass), the move speed in `_update` (sprint),
  `_slowScale/_slowBudget` (touch). Names and descriptions: `wording.duel.powerNames/powerDescs` (+ `duelFr`).
- **Opponent styles**: `trait` on each `LADDER` entry (centre, sides, tempo, left, right) biases `_aiShot`;
  shown in the menu as "Style: ...".
- **French for the whole app**: `wording-fr.js` overrides `wording.js` when the language is French
  (`localStorage["kr:lang"]`, else the browser language; the FR/EN button on the landing switches and reloads).
  Covered: system, landing, in-game labels, end screen, first-run, how-to. NOT translated: paywall, share card,
  stats sharing, house ad, waitlist, install prompt, support, micro-feedback, challenges, notFound, the daily
  modifier names in `game.js` (`DAILY_MODIFIERS` labels are hard-coded English), `privacy.html`, `terms.html`.
  To translate more: add the section to the `FR` object in `wording-fr.js` and run `node tests/wording.test.mjs`
  (it rejects unknown keys and changed `{placeholders}`).
- **Rule tests**: `tests/duel-rules.mjs` (19 checks: net, out, serve, double bounce, kitchen volley, dead ball,
  net clearance, powers, seeded RNG, sanitised storage) and `tests/wording.test.mjs` (616 checks, no browser).
  `Duel.paused` freezes the loop so tests can drive methods directly; `KR_DUEL._test` exposes helpers.
- Test commands (server on 8123, `playwright` installed): `node tests/wording.test.mjs`,
  `node tests/duel-rules.mjs`, `node tests/duel-smoke.mjs` (about 5 minutes).

Remaining ideas: translate the sections listed above; make `DAILY_MODIFIERS` labels translatable; sound
design for Duel; a server for rankings; balance after real playtests; real-device test; the payment flow.


## Power visuals (version 11)

Each power has its own look while active (`_drawPowerFx`, `_drawPowerTint`, plus hooks in `_drawBall`,
`_drawAim`, `_powerHud`, colours in `POWER_RGB`): a coloured aura on the court with a shrinking time arc,
a coloured vignette, a flash on activation and a ring when it ends, and the ball gets a glow and a trail in the
power's colour. Per power: reach = dashed ring showing the real catch radius; touch = time ripples; power = rising
embers; precision = crosshair on the aim marker; sprint = ground streaks behind the player; pass = the Kitchen
lights up (volleys are legal there). The effects blink in the last 20% of the duration, and respect reduced
motion (`fx.reduced`: no pulse, no flash, no embers). Test: "every power renders without errors" in
`tests/duel-rules.mjs`.


## Language URLs and poster (version 12)

- **One address per language**: `https://carossst.github.io/KitchenRush/?lang=fr` and `...?lang=en`. The parameter
  is read in `wording-fr.js` (`pickLang`) and remembered in `localStorage["kr:lang"]`; without it the saved choice,
  then the browser language, decide. The Daily Duel share text already carries `?lang=`.
- **Poster** (`poster.html`, FR and EN, one A4 page, QR code + Duel screenshot): `poster.html?lang=fr` or `?lang=en`,
  then "Imprimer / Print" (save as PDF). Text lives in the `T` object inside the page. QR codes:
  `icons/qr-fr.svg` / `icons/qr-en.svg`, regenerated with `python3 tools/make-qr.py [BASE_URL]` (needs `pip install segno`).
  **If the public address changes, regenerate the QR codes and reprint.** Screenshots: `icons/poster-duel-{fr,en}.jpg`
  (taken from a paused Duel with the Power effect on; retake after big visual changes).

## What was taken from the rally branch, and what was not

Taken (adapted to the Duel): French/English, match history and end screen, tests, Daily mode with a date seed,
one power per opponent (own design), opponent styles (like round profiles), deferred update prompt.
Not taken: 18 real-athlete identities (legal), server leaderboard with replay verification, drop/drive and
Pillar/Creator tactics, ball capture and precision challenge, GoatCounter / Kit email, FR/US manifests.
Not found anywhere in the repos: the Arkanoid-style effects with 10 US + 10 French players.

## Owner to-do list (things only the owner can do or decide)

1. **Playtest** on a real phone and a computer; report difficulty (too easy/hard), controls, power balance.
2. **Have the French (and English) copy read by a native speaker**; tests only check keys and placeholders.
3. **Payment**: decide to launch or remove it. Needs Stripe payment links in `config.js`, something that creates
   premium codes (`success.html` only reads one), and ideally a small server to verify them.
4. **Real player names**: get written permission or a lawyer's opinion before using any; until then keep fictional names.
5. **Legal pages**: `privacy.html` and `terms.html` are English only; check they match what the game actually
   stores and shares (local storage, optional analytics/email), and translate them.
6. **Final address**: decide the public domain (`kitchenrush.app` is a placeholder in `config.js` and the meta tags);
   then update them, regenerate the QR codes and reprint the poster.
7. **Rally branch / PR #1**: PR closed on 2026-11-16 (branch kept as a reference). Still open: tell the next agent where the
   Arkanoid prototype with the US/French player sets lives (repo `carossst/pickleballgame` is a candidate, unread).
8. **Server** (only if rankings are wanted): HTTPS hosting, persistence and secrets; the rally branch has a starting point.
9. **Optional**: contact email setup (`email.js`), a social-share image (the current one is the app icon),
   analytics choice, translating the remaining screens listed in the French section above.


## Capsules, rally ramp, final boss (version 13)

Arkanoid-inspired additions to the Duel (ideas from the original game, not from any other repo):
- **Capsules** (`_spawnCapsule`, `_capsules`, `_collectCapsule`, `_drawCapsule`): during a rally a capsule falls onto the
  player's half; running over it grants one of the six powers for 7 s (`CAPSULE_SECONDS`), it vanishes after 8 s
  (`CAPSULE_LIFE`). One at a time, 6-11 s apart, never in the Daily Duel. Icons are drawn (`capIcon`), not text.
- **Rally ramp**: each shot of a rally makes the ball clock run 3.5% faster, up to +30% (`b.rate`, applied in
  `_stepBall`), with a "RALLY n" counter (`_drawRally`). Speeding up the shot itself does NOT work: the arc must
  still clear the net, which fixes the flight time. The rate resets with every point.
- **Final boss**: `LADDER[6]` "Captain Kitchen" (`boss: true`): 30% bigger, red aura, intro banner, "RAGE" when he
  reaches 3 points (faster and harder shots, embers), no power reward, a normal partner in doubles. After the boss
  the ladder keeps scaling his stats. `wording.duelFr.tags` must have 7 entries (tested).
- Tests: 25 rule checks (capsule spawn/catch/expiry, ramp rate, boss and rage, rendering of capsules and counter).
- Ideas not done: target "bricks" on the opponent's court (Arkanoid's core idea), multiball (only one ball here),
  a laser/catch capsule, boss patterns beyond rage.


## Worlds and courts (version 14)

- **Worlds**: the ladder (6 opponents + boss) is one world. Beating the boss starts world 2: the same opponents again,
  tougher (`_opp()` scales speed, error, reaction and pace per world), with a "World n" label and a "World n
  unlocked" note. `_oppIdx()` = `stage % 7`, `_world()` = `floor(stage / 7) + 1`. The slow-motion budget still depends on the raw `stage`.
- **Courts** (`VENUES`, `AUTO`, `VENUE_ORDER` in `duel.js`): park, beach, night arena, gym, rooftop, stadium, each with its own
  sky/scenery, stands and crowd, ground, boards, court and line colours (`_drawBackground`, `_scene`). The court follows the
  ladder step by default (`AUTO`), and you can pick one in the match menu like a fighting game's stage select; a court unlocks
  when you reach its opponent (`unlock`). The Daily Duel always uses its opponent's court. The choice is saved in
  `kr:duel.venue` (sanitised). Adding a court = one entry in `VENUES` (+ `AUTO`/`VENUE_ORDER` and the two `venues` word lists).
- Scenery behind the stands (sea, skyline, floodlights, beams) is mostly visible in landscape; in portrait the colours carry it.
- Tests: 28 rule checks (worlds, court choice rules, every court renders, sanitised `venue`).


## Coins, shop and players (version 15)

First version of a progression economy, deliberately **soft-currency only**: no real money, no random packs.
- **Coins** are earned by playing (`_afterPoint`): win = 20 + 6 x opponent index + 10 x (world - 1) + 60 for a boss kill,
  plus 1 per point scored; a loss pays 6 + points scored; the Daily Duel pays 25 (win) or 10 (loss) once a day, first attempt only.
- **Players** (`PLAYERS` in `duel.js`, fictional names): Alex (free, balanced), Sasha (+12% speed, starts with 1 charge, 120),
  Wen (+15% reach, 150), Tomi (+40% slow motion, 200), Priya (easier, faster smashes, 220), Lola (capsules sooner/longer/easier, 240),
  Chen (power needs 2 points instead of 3, 260). Each also sets the jersey colours; hair and skin stay your own "look".
  Skills are read through `_player()`, `_pstat()`, `_chargeMax()`, `_capDelay()`. The Daily Duel always uses Alex (equal terms).
- **UI**: the match menu shows the coin balance and one chip per player (tap to equip; tap an affordable locked one to buy it;
  unaffordable ones are greyed with the price in the tooltip). Result lines show "+n coins".
- **Save** (`kr:duel`): `coins`, `owned`, `player`, all sanitised on load. It is client-side only, so a user can edit it:
  fine for a free soft currency, NOT acceptable if coins ever become purchasable (that needs a server holding the balance).
- Tests: 31 rule checks (earnings, shop rules, skills, sanitising). Balance is untested with real players: watch how fast
  coins accumulate versus prices, and whether any skill is clearly best.
- Not done / decisions needed: paid currency or random packs (legal review needed: loot-box rules in France and Belgium,
  minors, refunds; also needs the payment flow and a server), choosing your doubles partner, upgrading players, cosmetics shop.

## Expert audit (2026-11-16, version 15) - design, math, UX, live-ops, using Hearthstone as the reference

Method: code reading plus calculations (no human playtest, no real device). Hearthstone lessons used: rules simple, depth grows
(pre-made decks, visual cues); fast pace; juicy feedback (board shakes, stingers); free-to-play with earnable currency and daily
quests; no trading; rotation to avoid power creep; beta used to rebalance; experimental weekly mode; AND the criticism: pay-to-win
perception and a 2022 class action about minors buying packs (reason we avoid random paid packs).

Numbers (see the calculation in this section's tables):
- Coins: a perfect clear of one world (7 wins) pays 361 / 431 / 501 coins in worlds 1 / 2 / 3; the whole roster costs 1190 =
  about 3 perfect worlds = about 23 wins = roughly 35-45 minutes of play. Too fast for retention, and nothing to spend on afterwards.
- AI coverage model (reach after the flight time, T = 0.9 s, rate 1.0): Rookie 8.6 ft, Dee 10.3, Lou 11.4, Bo 12.6, Sam 13.8, Ace 15.2,
  Boss 17.0 (half-court width is 10 ft). With the rally ramp (rate 1.3) they drop to 6.5 / 7.9 / 8.8 / 9.8 / 10.8 / 12.0 / 13.5.
  Hypothesis to verify with an instrumented bot: from opponent 3 on, placement alone cannot beat the AI; points come from AI error
  (`err`), the ramp and short balls. If true, aiming matters less at high stages and the game drifts toward luck.
- Ramp: rate = 1 + 0.035 x (hits - 1), capped at +30% from the 10th shot.

Findings, by priority:
P0 (before showing it to the public)
1. No tutorial or guided first match; the aim + slow-motion idea is not self-explanatory (Hearthstone: "depth grows as you go").
2. The match menu is overloaded (stats, daily, collection, power, courts, coins, players, mode, look, rules). Split into tabs: Play /
   Players / Courts / Stats.
3. Touch controls and performance are untested on real phones; chip buttons are about 28 px high (guideline 44 px); skills and prices
   of locked players are only in `title` tooltips, invisible on touch: show a detail panel on tap.
4. Difficulty and economy are unvalidated by humans; there is no telemetry to tune them (Hearthstone rebalanced in beta).
P1
5. Economy: add sinks (cosmetics, ball trails, court themes, player upgrades), raise prices 2-3x or add content, add daily quests
   (win 2 matches, catch 3 capsules, reach a 10-shot rally) and a weekly twist mode.
6. Sound design (hit, capsule, rally milestones, boss rage, music), haptics. Hearthstone sells the "feel" with sound and shake.
7. Capsules give a random power: fine for fun, but telegraph it (icon is shown) and keep it out of competitive/daily modes (done).
8. Colour-only power effects: add shapes/labels for colour-blind players; honour reduced motion (done).
9. The Daily Duel uses the device date, so changing the clock repeats it (and its coins): fine for a free currency, not for rankings.
P2
10. Content cadence and rotation (new courts/players per season, skills as side-grades, no strict upgrades) to avoid power creep.
11. Social: friend challenge by link (seeded match), async leaderboard (needs a server).
12. Monetisation, if ever: cosmetics only, fixed prices, no random packs, no pay-to-win; server-held balance; legal review for minors.
13. Architecture: `duel.js` is large and untyped; split rendering, rules and UI before adding more features.


## Audit fixes: tutorial, tabs, touch, local playtest log (version 16)

Done from the audit's P0 list:
- **Tutorial**: the first match (stage 0, `save.coached` false) uses a gentler opponent (`_opp()`: speed x0.8, error x1.4, reaction x1.4,
  aggression x0.6), 60% longer slow-motion, and a coach box (`_coachTick`) with one hint at a time: serve, get to the ball, aim while
  time slows, "nice". It ends after 4 of your shots or at the end of the match (`save.coached = true`). "Replay the tutorial" is in the
  Play tab. Touch and keyboard wordings are separate (`coachServeTouch/Keys`, `coachAimTouch/Keys`).
- **Menu tabs**: Play / Players / Courts / Progress (`_showMenu`, `panel()`); Start / Back / language buttons stay visible. Tab switches
  toggle `hidden` without re-rendering (`tab-` action). The result and the opponent header stay on top.
- **Touch**: chips and tabs are at least 44 px high; tapping a player previews it (skill, price, status) and a separate button equips
  or buys it (`pl-` previews, `act-` acts), so purchases need two deliberate taps; locked courts are `aria-disabled` and explain
  themselves when tapped instead of relying on `title` tooltips.
- **Local playtest log** (`kr:duel-stats`, last 60 matches, never sent anywhere): day, version, stage, world, opponent, mode, score,
  duration, longest rally, capsules, powers used, player, court and the cause of every point (`team:reason`). The Progress tab shows
  win rate and average duration and has "Copy my playtest data" so testers can paste their data to the owner. This is what is needed to
  verify the AI-coverage hypothesis (how points are won) and to tune coins and difficulty.
- Tests: 37 rule checks (tutorial, coach, tabs, preview/buy, locked court, log and export), 686 wording checks.
Still open from the audit: real-device test, sound design, daily quests and coin sinks, colour-blind shapes, seasons, server.


## Character-select concept: studio analysis (2026-11-17, five expert profiles, read-only, nothing implemented)

Owner's idea: a fighting-game style start: choose a character (names evoking real pro players, American-sounding for the US edition,
French-sounding for the French edition), each with a super power, then choose the stage. (The owner's example "Tyra Banks" is a different
famous person, a supermodel: it must not be used; the pro is Tyra Black.)

**Verdict of all profiles**: the mechanics are a good fit and the code is about 70% there (`PLAYERS` passives, `POWERS` charge meter, `VENUES` stage
picker); the **risk is the names**, not the selector.

**Names / legal (counsel profile, not legal advice, not web-verified)**
- Pun or lookalike names of real players ("Bon Jonesy") = HIGH risk: the evoked identity is the point, which is exactly what right of publicity /
  false endorsement (US) and droit au nom, droit a l'image, parasitisme (France) look at. "Parody" or "inspired by" and disclaimers protect little.
  Highest risk when the game is public, reaches minors and sells cosmetics. Copying a player's signature move, look or nickname adds risk.
- Safe paths: (1) fictional archetypes inspired by a playing STYLE (the Pillar, the Creator), with no phonetic or visual allusion: LOW risk;
  (2) real names under a signed licence: LOW risk once signed (scope: name, stylised image, voice; territories FR/US; duration; cosmetics;
  revenue share or flat fee; right of withdrawal; visual approval; parental consent for minors). Do not mention anyone publicly before signature.
- Process: list players; approach agents or federations (PPA, MLP, FFP; check league trademarks); French players first (small scene, the owner's
  media is a lever; offer visibility and a dedicated character with the power they choose, no money at first); written simple agreement; IP lawyer review.
- Decision taken in this session: **do not ship lookalike or pun names.** Ship fictional archetypes; add real names only with a signed agreement.
  The roster data must make names swappable per edition so that a licence costs nothing technically.
- One profile (product) called lookalikes "risk-free": the legal profile contradicts it; follow the legal profile.

**Design and balance (designer profile)**
- One model: character = identity + stats + one passive + one super (reuse the charge meter: `charge`, `chargeNeed`, `startCharge`). The 6 `POWERS`
  become the characters' supers (no longer "earned by beating opponent i"); capsules would be a second power system: neutralise (neutral bonus) or remove.
- Opponents: reuse the same cast (reskins or draws) for the ladder; AI tier = difficulty, character = style; the boss stays unique; mirror matches allowed.
- Courts stay cosmetic (no gameplay effect). Daily Duel stays without supers (equal terms).
- Measure with the playtest log: add character id, super used/hit, opponent, court; targets: win rate per character within +-10 points of the average,
  at most one character picked in more than 40% of matches.

**UX / art (UX profile)**: first launch = full-screen Character -> Court -> tutorial -> match; returning players keep the tabs. Character card = animated
signature pose, power icon and name, 3 stat bars (speed, reach, focus) with numbers; each power gets a shape and a label besides its colour; distinct
silhouettes (build, height, accessory: headband, visor, sleeve, glasses) and an idle pose per character, all in code (`characters.js` has `palette`,
`swingT`); keep the independent look picker (hair, skin) so appearance and gender are not tied to a power; intros skippable and reduced-motion aware.
Start with 6-8 characters, not 10-20.

**Product / community (producer profile)**: one codebase, two cast lists switched by `?lang=`; minimal first slice (1-2 weeks): selection screen with
4 characters (2 FR-flavoured, 2 US-flavoured), one passive each, existing court picker, text read by a native speaker; milestones: 10 real phone
testers using "Copy my playtest data"; metrics: at least 40% finish a first duel, at least 20% start a second, daily-duel shares. Refuse: payment,
random packs, server rankings, 20 characters, real names without agreement.

**Engineering / QA / feel (engineer profile)**: add a `super` field to each `PLAYERS` entry mapped to the existing powers; names as `{en, fr}` in the
roster data (or `wording.duel`/`duelFr`) with a wording test that every id has both. New supers are one more `_pw` branch in `_launch`/`_tryHit`.
Pitfall: `beaten` and `equipped` are indexed by `POWERS`; reordering `POWERS` breaks saves (add a migration or never reorder). Extract `_fxHit` and
`_superFx` before piling effects into `_launch`. Juice available: `fx.punch`, `freezeUntil` (hit stop), `flashUntil`, `shakeUntil`, `fx.burst/ring`;
for a super: hit stop about 120 ms, zoom, tinted flash, 0.4 s slow-down, banner, `navigator.vibrate` behind try/catch (not on iOS). Audio: add
`superCharge` and `superFire` to `audio.js` (synth; `pitch` gives each character a cue). Tests: per super charge/activation/effect/expiry, `loadSave`
rejects an unknown `player`; balance regression with seeded bots (`seeded()`), about 20 matches per character with a win-rate band of 35-65%.
Safe slice in 4 steps: 1) roster data per edition + existing picker; 2) super = the character's power, no new meter; 3) one genuinely new super;
4) sound + hit stop + tests.

**Unverified by all profiles**: real balance of the 6 powers, mobile UI and haptics, the legal analysis, the appetite of real players for an agreement.
**Decisions needed from the owner**: confirm archetypes-first (no lookalikes); which French players to approach first; keep or remove capsules once supers
exist; initial cast size (recommended 6).
