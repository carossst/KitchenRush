# Kitchen Rush - Development Principles

## Product hierarchy

- Classic is the core product.
- Daily Challenge is today's shared Classic run.
- Rush is the fast secondary variant.
- Waitlist, house ads, and stats sharing stay in the product as contextual secondary systems.

## Architecture rules

- Mobile first.
- Fail closed everywhere.
- No silent fallback values.
- All tunable values live in `config.js` only.
- No inline CSS.
- Static pages follow the same rules as gameplay screens.
- Keep wording and thresholds in config, not scattered through runtime code.

## Runtime rules

- `game.js` reads validated config and does not recreate missing defaults.
- `ui.js` renders what state and config say; it does not invent backup product logic.
- `storage.js` persists state and milestones only; it does not redefine product timing.
- Secondary systems appear on explicit milestones only.

## Current milestone cadence

- Waitlist: after 10 completed runs.
- House ad: after 15 and 20 completed runs.
- Stats sharing: after 3, 7, 10, and 50 completed runs.

## Protected moments

Secondary systems must never take over these moments:

- hero / first landing read
- paywall
- purchase success
- primary how-to-play explanation

## Launch checklist

- Stripe URLs replaced with live URLs.
- Audit wording on landing, paywall, end screens, success, privacy, terms, press.
- Test Classic, Daily, and Rush on real mobile devices.
- Confirm no inline CSS or silent fallbacks on modified files.
