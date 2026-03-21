# Kitchen Rush - Product and Development Principles

## Product direction

Kitchen Rush is not a pure simulator and not a brick-breaker clone.

The target is:

- real pickleball court logic
- human-height frontal camera
- readable arcade trajectories
- strong replay loop
- more fun than realism when the two conflict

The intended feel is:

- "seen like a real rally"
- "felt like a precision arcade game"

## Core mode hierarchy

- Classic is the main game.
- Daily Challenge is one shared Classic run per UTC day.
- Sprint is the short high-pressure side mode.
- Waitlist, house ads, stats sharing, and similar systems are always secondary to play.

## Design inspiration

Primary inspiration:

- real pickleball spacing and constraints
- arcade clarity and hit feel
- Arkanoid-style readability, anticipation, and satisfying impact logic

What we borrow from arcade games:

- clear trajectories
- strong impact feedback
- visible rebound states
- distinct ball personalities
- immediate cause and effect
- "one more run" tension

What must stay pickleball:

- official court proportions as the reference base
- net as the central visual divider
- Kitchen / non-volley logic
- double bounce rule
- rally feeling, not random chaos

## Official court reference

Base court:

- 20 ft x 44 ft
- 6.10 m x 13.41 m

Other key dimensions:

- Kitchen: 7 ft from the net on each side
- Net height: 36 in at the posts
- Net height: 34 in at the center

Useful half-court ratio:

- Kitchen depth = 7 / 22 = 31.8%
- Backcourt depth = 15 / 22 = 68.2%

These proportions are the reference for the frontal rendering and gameplay tuning.

## Camera and gameplay intent

The game should read from a true frontal, eye-level viewpoint.

That means:

- the near baseline should feel wider than the net
- the far side should compress in perspective
- the ball should visibly leave the opponent side
- the ball should cross the net in a readable arc
- the bounce should be visible and legible before auto-return
- Kitchen / WAIT / GO states should stay obvious on mobile

The game should feel like a real rally, but with more readable trajectories and more expressive feedback than a real match.

## Ball system direction

Ball types are not gimmicks. They are trajectory personalities.

Each ball type should change:

- arc feel
- rebound feel
- timing pressure
- placement pressure
- visual read

Current direction:

- `normal`: baseline readable rally ball
- `dink`: soft, short, Kitchen-first read
- `lob`: high, floaty, overhead read
- `fast`: reflex pressure ball
- `skid`: flatter, lower-bounce drive
- `heavy`: denser, fuller, more physical ball

The point is more fun and more mastery, not more randomness.

## Ball progression logic

The run should get richer as the player settles in.

That means:

- early run = clearer, simpler rally read
- mid run = more variety
- late run = more pressure and more expressive balls

Current rule:

- each special ball has `unlockAfterSec`
- each special ball can also have `unlockAfterScore`
- each special ball can also have `weightGrowthPerSec`
- each special ball can also have `weightGrowthPerScore`
- once unlocked, its spawn weight can grow with elapsed run time
- once unlocked, its spawn weight can also grow with run score

This is intentional.

It gives:

- cleaner onboarding
- clearer mastery ramp
- more fun later in the run without random chaos early

Player-facing motivation:

- the player should understand that new powers appear deeper into a run
- the next power unlock should be visible on landing and end screens
- powers should feel discovered, not random

## Power design guardrails

Current live powers are ball personalities, not inventory bonuses.

That means:

- they change the rally itself
- they change placement, timing, and rebound
- they stay readable in a frontal pickleball court

Future bonus ideas like:

- extra life
- brief invincibility
- multi-hit shield
- magnet catch

should be treated as a later design layer, not mixed into the core rally by default.

If added later, they must:

- remain short and readable
- not hide the Kitchen rule
- not erase the double bounce rule
- feel like an arcade twist on pickleball, not random noise

## Non-negotiable development constraints

- Mobile first.
- Vanilla JavaScript architecture stays.
- Fail closed.
- No silent hardcoded copy fallback.
- All user-facing copy lives in `wording.js`.
- All tunable values live in `config.js`.
- `config-boot.js` validates every required tunable.
- No inline CSS.
- All DOM styling stays in `style.css`.
- Canvas colors must come from `config.canvas.colors`.
- Static pages follow the same discipline as gameplay pages.

## Source of truth rules

- `config.js`
  - product tunables
  - rendering tunables
  - thresholds
  - ball personalities
  - growth and nudge rules
- `wording.js`
  - all visible copy
- `game.js`
  - state machine
  - rally rules
  - spawning
  - collisions
  - rebound timing
- `ui.js`
  - canvas render
  - gameplay presentation
  - input orchestration
- `ui-screens.js`
  - non-playing screens only
- `storage.js` and storage submodules
  - persistence only
  - never redefine gameplay timing or product rules

## Current architecture

Gameplay:

- `game.js`
  - rally rules
  - ball spawning
  - service targeting
  - double bounce logic
  - state machine
- `ui.js`
  - frontal gameplay canvas
  - player / opponent / net / ball rendering
  - in-game HUD and feedback
  - gameplay input orchestration

Non-playing UI:

- `ui-screens.js`
  - landing / end / paywall DOM screens
- `ui-overlays.js`
  - toast and transient gameplay overlays
- `ui-modals.js`
  - how-to / support / redeem / waitlist / stats modals
- `ui-sharing.js`
  - share text and share card logic

Boot and contracts:

- `main.js`
  - boot orchestration
  - fail-closed module checks
- `config-boot.js`
  - config validation
- `wording-dom.js`
  - shared DOM wording hydration

Persistence:

- `storage.js`
  - core schema and save/load
- `storage-ux.js`
  - nudge and UX persistence
- `storage-runs.js`
  - runs / economy / history
- `storage-premium.js`
  - premium and redeem logic

## Fail-closed rules

- If config is missing, do not invent defaults in runtime product logic.
- If wording is missing, skip silently instead of rendering hardcoded backup copy.
- If a module contract is missing, boot should fail early instead of drifting.
- If a secondary system is not fully configured, it should not appear.

## UX and nudge rules

Primary goal:

- get the player into a run quickly
- keep the player in the rally loop
- make improvement visible

Secondary systems must never dominate:

- first landing understanding
- active gameplay
- end-of-run replay CTA
- paywall clarity
- purchase success

Nudges should support:

- visible improvement
- mastery
- replay tension

Not:

- clutter
- interruption
- over-marketing

## Current gameplay quality bar

The player should understand in a few seconds:

- where the net is
- where the Kitchen is
- when to wait
- when the ball has bounced
- what to do next

The player should feel:

- clear faults
- satisfying impacts
- distinct ball personalities
- visible improvement from run to run

## Testing priorities

Always test on real mobile first, then desktop.

Must-test flows:

- Classic
- Daily
- Sprint
- Kitchen fault logic
- double bounce sequence
- end screen replay loop
- paywall entry and return
- success page
- static pages

Must-test feel:

- frontal court readability
- visible bounce
- opponent-to-player ball departure
- visible first diagonal serve
- visible second bounce on the opponent side
- ball depth / size / height read
- power-ball readability
- Kitchen readability on small screens
- CTA clarity on landing and end

## Launch checklist

- Stripe URLs replaced with live URLs.
- Real-device test on mobile for Classic, Daily, and Sprint.
- Real visual check of frontal court, bounce, and ball departure.
- Wording audit on landing, paywall, end, success, privacy, terms, and press.
- Confirm no inline CSS on modified files.
- Confirm no new hardcoded product text outside `wording.js`.
