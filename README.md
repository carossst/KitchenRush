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
- Power Run is the short high-pressure side mode.
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

There is now one canonical in-match camera.

That means:

- do not maintain multiple player-selectable match views
- do not spend tuning effort on parallel camera profiles
- the game should converge on one strong frontal camera only
- if readability and realism conflict, tune that one camera instead of adding alternatives

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

There are 2 different systems and they must stay conceptually separate.

### 1. Ball personalities

Current live powers are first and foremost ball personalities.

That means:

- they change the rally itself
- they change placement, timing, and rebound
- they stay readable in a frontal pickleball court

### 2. True power-ups

Kitchen Rush now supports true temporary arcade power-ups as a second layer.

These are not passive stat boosts hidden in the code.
They must be:

- visibly introduced by a specific ball or event
- short
- easy to understand instantly on a phone
- subordinate to ball readability

Current live direction:

- `extraLife`
  - grants `+1` life
  - rare, high-value reward
- `shield`
  - blocks the next fault only
  - preferred over long invincibility
- `speedBoost`
  - increases player movement speed briefly
- `perfectWindow`
  - slightly widens timing forgiveness briefly
- `smashBoost`
  - boosts the next few clean returns or their score value

### Explicit non-goals for now

Do not jump directly to:

- 30-second invincibility
- multi-ball chaos
- random screen-filling gimmicks
- effects that hide Kitchen / net / ball state

The game should feel:

- more fun
- more surprising
- more arcade

But never:

- visually noisy
- unfair
- unreadable on mobile

### Progressive discovery model

The intended player journey is:

- early run: readable rally, almost no overload
- mid run: more ball personalities
- deeper run: rarer power balls appear
- later run: a small number of short-lived power-ups can trigger

The player should feel:

- "I lasted long enough to discover something new"
- "this run got richer"
- "I want one more run to see the next power"

This is closer to arcade progression in Arkanoid / Pac-Man than to a sports sim, but the match must still read as pickleball.

## Secret discovery object

The secret unlock object is now a `Power Ball`, not a gift chest.

Why:

- it fits the pickleball/arcade fantasy better
- it feels less like a generic mobile gimmick
- it connects directly to the power-up system

UI rule:

- the player should see it as a special ball/event
- not as a loot box or present

### Power-up guardrails

They must:

- remain short and readable
- not hide the Kitchen rule
- not erase the double bounce rule
- not make the ball harder to track
- feel like an arcade twist on pickleball, not random noise
- preserve the core norm:
  - at phone size, in motion, the player must still instantly distinguish ball, player, opponent, net, kitchen, and lines

## Live power-up progression

Power-ups are now driven by 3 layers at once:

- score inside the current run
- long-term player progression on this device
- one featured weekly power-up

### 1. In-run progression

Power-ups do not appear immediately.

They unlock deeper into a run through:

- `game.powerUps.progression.firstUnlockScore`
- `game.powerUps.progression.unlockEveryScore`
- per-power `unlockAfterScore`

This means:

- early run stays readable
- mid run starts introducing stronger rewards
- later run gets richer without instant chaos

### 2. Meta progression on device

Each power-up can also require:

- `requireRunCompletes`
- `requireBestScore`
- `requireLifetimeSmashes`

This is intentional.

It gives the player a reason to:

- improve best score
- play more runs
- come back later to unlock new powers

### 3. Weekly featured power-up

A local UTC weekly rotation highlights one power-up at a time.

Current rule:

- config-driven cycle in `game.powerUps.weekly.cycle`
- no backend required
- the featured power-up gets extra weight when eligible

This creates a lightweight return hook:

- "what is this week's featured power?"
- "I unlocked that one, I want to see it more often"

## Live power-up behavior

Current live powers:

- `extraLife`
  - instant reward
  - grants +1 life in Classic
  - rare
- `shield`
  - blocks the next fault
  - preserves the run instead of taking a life
- `speedBoost`
  - increases player movement speed briefly
- `perfectWindow`
  - widens hit timing briefly
- `smashBoost`
  - multiplies hit score briefly

Trigger model:

- powers are tied to readable ball types
- a qualifying hit can activate a matching power-up
- not every qualifying hit activates one
- config controls rarity and run caps

Readability rule:

- at most a very small number of powers can be active at once
- activation feedback must stay lighter than ball tracking
- the rally remains primary

## Player motivation and conversion intent

Power-ups are not only a gameplay layer.
They are also part of the product value story.

That means:

- the player should learn very early that deeper runs unlock more
- first runs should tease future discovery without overwhelming the rules
- landing and end should keep pointing at the next thing to unlock
- the paywall should connect unlimited runs with deeper discovery

The intended perceived value is:

- more runs = more depth
- more score = more surprises
- better play = more systems unlocked
- premium = unlimited access to that progression loop

If a feature exists in gameplay but the player cannot understand it in the first sessions,
it is not yet product-complete.

## Landing screen rules

The first landing must be radically simpler than later visits.

First visit rule:

- show the title
- show the short subtitle
- show only `Daily Challenge` as the primary CTA when Daily is enabled
- if Daily is disabled, fall back to `Play Classic`
- do not show `Play Classic` alongside `Daily Challenge` on the first visit
- do not show progression copy, best score, sparks, `Power Ball`, or extra discovery nudges on the first visit
- use the same vertical slot for `Daily Challenge` on mobile and desktop
- on the first visit, `Daily Challenge` should look like the main primary button, not a badge

Reason:

- first impression must feel clean, premium, and easy to parse
- the first job is to get the player into a run, not to explain the meta loop

After the first visit:

- the landing can become richer again
- keep useful elements such as Daily, Classic, best score, and core nudges
- keep `Daily Challenge` in the same place on screen to avoid confusing returning players
- after the first visit, `Daily Challenge` can step down to a secondary visual treatment
- do not put `Next power ...` or `This week ...` on landing
- those progression lines belong on end screen or short overlays, where they are easier to understand

## Non-negotiable development constraints

- Mobile first.
- Vanilla JavaScript architecture stays.
- Fail closed.
- Before launch, prefer clean renames over legacy aliases.
- Do not keep compatibility layers for unreleased naming changes.
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
  - live power-up tunables and progression rules
  - growth and nudge rules
- `wording.js`
  - all visible copy
- `game.js`
  - state machine
  - rally rules
  - spawning
  - collisions
  - rebound timing
  - power-up unlock/activation logic
- `ui.js`
  - canvas render
  - gameplay presentation
  - input orchestration
  - live power-up chips and activation feedback
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

Future gameplay extension:

- power-up logic lives in `game.js`
- power-up tunables live in `config.js`
- power-up labels and player-facing copy live in `wording.js`
- power-up rendering and temporary visual feedback live in `ui.js`
- no separate ad-hoc source of truth is allowed

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
- make depth and future unlocks visible early

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
- visible progression toward new powers

## Economy and discovery

Current player-facing economy:

- Classic starts with `5` free runs
- Power Run has its own free-tries gate
- landing, start overlay, and end should all make remaining opportunity clear

Current discovery loop:

- early runs teach the base rally
- deeper runs unlock stronger ball personalities
- power-ups unlock through score + meta progression
- one weekly featured power-up keeps the loop fresh without backend live ops

## Testing priorities

Always test on real mobile first, then desktop.

Must-test flows:

- Classic
- Daily
- Power Run
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
- Real-device test on mobile for Classic, Daily, and Power Run.
- Real visual check of frontal court, bounce, and ball departure.
- Wording audit on landing, paywall, end, success, privacy, terms, and press.
- Confirm no inline CSS on modified files.
- Confirm no new hardcoded product text outside `wording.js`.
