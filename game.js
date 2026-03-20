// game.js v2.0 - Kitchen Rush
// Canvas game engine — pickleball exchange arcade.
// Vue frontale face au filet, déplacement latéral, hit explicite.
// Double bounce rule fidèle, kitchen = rebond obligatoire.
// Zero DOM access, zero localStorage.

(() => {
  "use strict";

  // ============================================
  // Helpers
  // ============================================
  function getModes() {
    const modes = window.KR_ENUMS && window.KR_ENUMS.GAME_MODES;
    if (!modes || typeof modes !== "object") throw new Error("KR_Game: KR_ENUMS.GAME_MODES missing");
    if (!modes.RUN || !modes.SPRINT) throw new Error("KR_Game: KR_ENUMS.GAME_MODES invalid");
    return modes;
  }

  const MODES = getModes();

  function reqNum(value, name, opts) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(name + " must be a finite number");
    if (opts && Number.isFinite(opts.min) && n < opts.min) throw new Error(name + " must be >= " + opts.min);
    if (opts && Number.isFinite(opts.max) && n > opts.max) throw new Error(name + " must be <= " + opts.max);
    if (opts && opts.integer === true && Math.floor(n) !== n) throw new Error(name + " must be an integer");
    return n;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Seeded PRNG (mulberry32) for daily challenge
  function mulberry32(seed) {
    var s = seed | 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dateSeed() {
    var d = new Date();
    var str = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h;
  }

  // Game-time clock (avoids wall-clock drift on tab switch)
  var _gt = 0;
  function gameTime() { return _gt; }


  // ============================================
  // Ball states
  // ============================================
  // TRAVELING  — ball moving between opponent and player (in air or after bounce)
  // BOUNCED    — ball has bounced, waiting to be hit or expire
  // HIT        — player hit the ball, it's flying back to opponent
  // RETURNED   — opponent hit it back, new ball incoming
  // MISSED     — player failed to hit
  // FAULTED    — player hit a kitchen ball before bounce (or volley violation)
  // SCORED     — rally won (future: opponent misses)

  var BALL_STATES = {
    TRAVELING: "TRAVELING",
    BOUNCED: "BOUNCED",
    HIT: "HIT",
    MISSED: "MISSED",
    FAULTED: "FAULTED"
  };


  // ============================================
  // Court layout (fractions of canvas)
  // ============================================
  function getCourtLayout(config) {
    var c = config.court || {};
    return {
      netY: reqNum(c.netY, "court.netY", { min: 0.1, max: 0.5 }),                    // filet position (fraction from top)
      kitchenLineY: reqNum(c.kitchenLineY, "court.kitchenLineY", { min: 0.3, max: 0.7 }), // kitchen line (fraction from top)
      playerY: reqNum(c.playerY, "court.playerY", { min: 0.6, max: 0.95 }),            // player fixed Y position
      opponentY: reqNum(c.opponentY, "court.opponentY", { min: 0.02, max: 0.3 }),      // opponent Y position
      controlsY: reqNum(c.controlsY, "court.controlsY", { min: 0.8, max: 1.0 })       // controls zone start
    };
  }


  // ============================================
  // Ball factory
  // ============================================
  var _nextBallId = 0;

  function createBallFromOpponent(config, elapsedSec, canvasW, canvasH, court, playerX, rng) {
    var rand = (typeof rng === "function") ? rng : Math.random;
    var gameCfg = config.game || {};

    // Ball type selection
    var ballType = pickBallType(config, elapsedSec, rng);
    var typeConfig = (gameCfg.ballTypes && gameCfg.ballTypes[ballType]) || null;
    var speedMul = typeConfig ? reqNum(typeConfig.speedMultiplier, "ballType.speedMul", { min: 0.01 }) : 1;
    var isLob = (ballType === "lob");
    var isDink = (ballType === "dink");
    var forceKitchen = !!(typeConfig && typeConfig.forceKitchen);

    // Speed at current time
    var spd = gameCfg.speed || {};
    var speed = (reqNum(spd.base, "speed.base", { min: 0.1 }) +
                 reqNum(spd.accelPerSec, "speed.accel", { min: 0 }) * elapsedSec) * speedMul;

    // Opponent X position (slightly random, biased away from player for challenge)
    var opX = canvasW * 0.2 + rand() * canvasW * 0.6;

    // Target X: mostly toward player but with spread
    var targetSpread = canvasW * 0.35;
    var targetX = clamp(
      playerX + (rand() - 0.5) * targetSpread * 2,
      canvasW * 0.08,
      canvasW * 0.92
    );

    // Kitchen ratio at current time
    var kr = gameCfg.kitchenRatio || {};
    var kitchenRatio = clamp(
      reqNum(kr.base, "kitchenRatio.base", { min: 0, max: 1 }) +
      reqNum(kr.growthPerSec, "kitchenRatio.growth", { min: 0 }) * elapsedSec,
      0,
      reqNum(kr.max, "kitchenRatio.max", { min: 0, max: 1 })
    );

    // Decide if ball lands in kitchen
    var inKitchen = forceKitchen || (rand() < kitchenRatio);

    // Target Y: where the ball will land (bounce point)
    var netYpx = court.netY * canvasH;
    var kitchenLineYpx = court.kitchenLineY * canvasH;
    var playerYpx = court.playerY * canvasH;

    var targetY;
    if (inKitchen) {
      // Land between net and kitchen line
      targetY = netYpx + rand() * (kitchenLineYpx - netYpx) * 0.8 + (kitchenLineYpx - netYpx) * 0.1;
    } else {
      // Land between kitchen line and player
      targetY = kitchenLineYpx + rand() * (playerYpx - kitchenLineYpx - 20) + 10;
    }

    // Start position (opponent side, above net)
    var startX = opX;
    var startY = court.opponentY * canvasH;

    // Arc height (lobs have high arc, drives are flat)
    var arcHeight = isLob ? (canvasH * 0.15 + rand() * canvasH * 0.05) : (canvasH * 0.02);

    // Ball radius
    var radiusMul = typeConfig ? reqNum(typeConfig.radiusMultiplier, "ballType.radius", { min: 0.01 }) : 1;
    var baseRadius = reqNum(config.canvas.ballRadius, "canvas.ballRadius", { min: 1 });
    var radius = Math.round(baseRadius * radiusMul);

    // Tap window (time after bounce before ball expires)
    var win = gameCfg.window || {};
    var tapMul = typeConfig ? reqNum(typeConfig.tapWindowMultiplier, "ballType.tapMul", { min: 0.01 }) : 1;
    var tapWindowMs = Math.max(
      reqNum(win.minMs, "window.min", { min: 1 }),
      (reqNum(win.initialMs, "window.initial", { min: 1 }) -
       reqNum(win.decayPerSec, "window.decay", { min: 0 }) * elapsedSec) * tapMul
    );

    // Travel duration (how long the ball takes to reach target)
    // Derived from speed: faster = shorter travel time
    var dist = Math.sqrt(Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2));
    var travelMs = Math.max(300, (dist / speed) * 16.67);

    return {
      id: ++_nextBallId,
      ballType: ballType,
      inKitchen: inKitchen,
      radius: radius,

      // Trajectory
      startX: startX,
      startY: startY,
      targetX: targetX,
      targetY: targetY,
      arcHeight: arcHeight,
      travelMs: travelMs,

      // Current visual position (updated each frame)
      x: startX,
      y: startY,

      // State
      state: BALL_STATES.TRAVELING,
      spawnedAt: gameTime(),
      bouncedAt: 0,
      hitAt: 0,
      missedAt: 0,
      faultedAt: 0,

      // After bounce
      tapWindowMs: tapWindowMs,

      // Hit return trajectory (filled when player hits)
      returnStartX: 0,
      returnStartY: 0,
      returnTargetX: 0,
      returnTargetY: 0,
      returnArcHeight: 0,
      returnTravelMs: 0,

      // Speed for result
      speed: speed,

      // Shadow
      shadowY: targetY
    };
  }


  // ============================================
  // Ball type selection (from V1, reused)
  // ============================================
  function pickBallType(config, elapsedSec, rng) {
    var types = config.game && config.game.ballTypes;
    if (!types || typeof types !== "object") return "normal";
    var rand = (typeof rng === "function") ? rng : Math.random;
    var candidates = [];
    var totalWeight = 1;
    for (var key in types) {
      if (!types.hasOwnProperty(key)) continue;
      var t = types[key];
      if (!t || typeof t !== "object") continue;
      var unlock = reqNum(t.unlockAfterSec, "ballType." + key + ".unlock", { min: 0 });
      if (elapsedSec >= unlock) {
        var w = reqNum(t.weight, "ballType." + key + ".weight", { min: 0 });
        if (w > 0) { candidates.push({ type: key, weight: w }); totalWeight += w; }
      }
    }
    if (candidates.length === 0) return "normal";
    var roll = rand() * totalWeight;
    var cum = 1;
    if (roll < cum) return "normal";
    for (var i = 0; i < candidates.length; i++) {
      cum += candidates[i].weight;
      if (roll < cum) return candidates[i].type;
    }
    return "normal";
  }


  // ============================================
  // Ball position along trajectory
  // ============================================
  function getBallPosition(ball, gt) {
    var elapsed = gt - ball.spawnedAt;

    if (ball.state === BALL_STATES.TRAVELING) {
      var t = clamp(elapsed / ball.travelMs, 0, 1);
      // X: linear interpolation
      var x = lerp(ball.startX, ball.targetX, t);
      // Y: linear + arc (parabolic dip for lobs, subtle for drives)
      var yLinear = lerp(ball.startY, ball.targetY, t);
      // Arc: highest at t=0.5, zero at t=0 and t=1
      var arc = -ball.arcHeight * 4 * t * (1 - t);
      var y = yLinear + arc;
      return { x: x, y: y, t: t };
    }

    if (ball.state === BALL_STATES.BOUNCED) {
      // Ball sits at bounce point with slight upward bounce animation
      var sinceBounce = gt - ball.bouncedAt;
      var bounceAnim = 0;
      if (sinceBounce < 200) {
        var bt = sinceBounce / 200;
        bounceAnim = -15 * Math.sin(bt * Math.PI); // small hop
      }
      return { x: ball.targetX, y: ball.targetY + bounceAnim, t: 1 };
    }

    if (ball.state === BALL_STATES.HIT) {
      var sinceHit = gt - ball.hitAt;
      var t2 = clamp(sinceHit / ball.returnTravelMs, 0, 1);
      var x2 = lerp(ball.returnStartX, ball.returnTargetX, t2);
      var y2Linear = lerp(ball.returnStartY, ball.returnTargetY, t2);
      var arc2 = -ball.returnArcHeight * 4 * t2 * (1 - t2);
      return { x: x2, y: y2Linear + arc2, t: t2 };
    }

    // MISSED / FAULTED: stay at last known position
    return { x: ball.x, y: ball.y, t: 1 };
  }


  // ============================================
  // GameEngine V2
  // ============================================
  class GameEngine {
    constructor() {
      this.run = null;
    }

    /**
     * Start a new run.
     * @param {Object} payload — { config, mode, canvasW, canvasH, isDaily }
     */
    start(payload) {
      var p = (payload && typeof payload === "object") ? payload : {};
      if (!p.config || typeof p.config !== "object") throw new Error("GameEngine.start(): config required");

      var config = p.config;
      var canvasW = reqNum(p.canvasW, "canvasW", { min: 1 });
      var canvasH = reqNum(p.canvasH, "canvasH", { min: 1 });

      var modeRaw = String(p.mode == null ? "" : p.mode).trim().toUpperCase();
      if (modeRaw !== MODES.RUN && modeRaw !== MODES.SPRINT) throw new Error("GameEngine.start(): invalid mode");
      var mode = modeRaw;

      var isDaily = !!(p.isDaily);
      var lives = (mode === MODES.RUN) ? Math.floor(reqNum(config.game.lives, "lives", { min: 1 })) : null;
      var sprintDurationMs = (mode === MODES.SPRINT) ? Math.floor(reqNum(config.sprint.durationMs, "sprintDur", { min: 1 })) : null;
      var onboardingShield = Math.floor(reqNum(config.game.onboardingShield, "shield", { min: 0 }));

      var court = getCourtLayout(config);

      // Reset game clock
      _gt = 0;

      this.run = {
        mode: mode,
        config: config,
        court: court,
        canvasW: canvasW,
        canvasH: canvasH,
        isDaily: isDaily,

        rng: (isDaily && mode === MODES.RUN) ? mulberry32(dateSeed()) : null,

        // Timing
        elapsedMs: 0,
        lastSpawnAt: -9999, // force immediate first ball

        // Player
        playerX: canvasW / 2,
        playerState: "idle",    // "idle" | "runLeft" | "runRight" | "swing"
        playerSwingUntil: 0,

        // Opponent
        opponentX: canvasW / 2,
        opponentTargetX: canvasW / 2,

        // Lives (RUN)
        lives: lives,
        maxLives: lives,

        // Sprint
        sprintDurationMs: sprintDurationMs,
        sprintRemainingMs: sprintDurationMs,
        penaltyAccumulatedMs: 0,

        // Score = successful rallies / hits
        smashes: 0,

        // Active ball (one at a time — pickleball is one ball)
        ball: null,

        // Rally state
        rallyCount: 0,       // hits in current rally (for double bounce rule)
        totalRallies: 0,     // completed rallies

        // Counters
        totalSpawned: 0,
        totalSmashed: 0,
        totalMissed: 0,
        totalFaulted: 0,
        onboardingShield: onboardingShield,

        // Streak
        currentStreak: 0,
        bestStreak: 0,

        // First kitchen signal
        firstKitchenSpawned: false,

        // Milestones
        milestones: Array.isArray(config.game && config.game.milestones) ? config.game.milestones.slice() : [],
        milestonesReached: [],
        lastMilestoneAt: 0,

        // Input state (set by UI, consumed by engine)
        input: {
          left: false,
          right: false,
          hit: false,
          hitConsumed: false  // prevent multi-hit per press
        },

        // State
        done: false,
        endReason: null,

        // Wait state (between rallies)
        waitUntil: 0
      };

      // Spawn first ball after a short delay
      this.run.waitUntil = 800; // 800ms before first serve

      return this.getState();
    }


    /**
     * Set input state (called by UI on input events).
     */
    setInput(left, right, hit) {
      if (!this.run) return;
      this.run.input.left = !!left;
      this.run.input.right = !!right;
      // Hit: only set if not already consumed
      if (hit && !this.run.input.hitConsumed) {
        this.run.input.hit = true;
      }
      if (!hit) {
        this.run.input.hitConsumed = false;
      }
    }


    /**
     * Update game state (called every frame).
     */
    update(dtMs) {
      if (!this.run || this.run.done) return this.getState();

      var r = this.run;
      var cfg = r.config;
      var gameCfg = cfg.game || {};
      var court = r.court;

      r.elapsedMs += dtMs;
      _gt = r.elapsedMs;
      var elapsedSec = r.elapsedMs / 1000;

      // Sprint timer
      if (r.mode === MODES.SPRINT && r.sprintRemainingMs != null) {
        r.sprintRemainingMs = Math.max(0, r.sprintDurationMs - r.elapsedMs - r.penaltyAccumulatedMs);
        if (r.sprintRemainingMs <= 0) {
          r.done = true;
          r.endReason = "TIMER";
          return this.getState();
        }
      }

      // ── Player movement ──
      var playerSpeed = reqNum(cfg.court.playerSpeed, "court.playerSpeed", { min: 0.1 });
      var moveAmount = playerSpeed * (dtMs / 16.67);

      if (r.input.left) {
        r.playerX = Math.max(20, r.playerX - moveAmount);
        if (r.playerState !== "swing") r.playerState = "runLeft";
      } else if (r.input.right) {
        r.playerX = Math.min(r.canvasW - 20, r.playerX + moveAmount);
        if (r.playerState !== "swing") r.playerState = "runRight";
      } else {
        if (r.playerState !== "swing") r.playerState = "idle";
      }

      // Swing animation timeout
      if (r.playerState === "swing" && gameTime() > r.playerSwingUntil) {
        r.playerState = "idle";
      }

      // ── Opponent movement (simple tracking AI) ──
      if (r.ball && (r.ball.state === BALL_STATES.HIT)) {
        // Track the returning ball
        r.opponentTargetX = r.ball.returnTargetX;
      } else {
        // Drift toward center when idle
        r.opponentTargetX = r.canvasW / 2;
      }
      var oppSpeed = playerSpeed * 0.7;
      var oppDiff = r.opponentTargetX - r.opponentX;
      if (Math.abs(oppDiff) > 2) {
        r.opponentX += Math.sign(oppDiff) * Math.min(Math.abs(oppDiff), oppSpeed * (dtMs / 16.67));
      }

      // ── Wait state (between rallies) ──
      if (r.waitUntil > 0 && r.elapsedMs < r.waitUntil) {
        return this.getState();
      }

      // ── Spawn ball if none active ──
      if (!r.ball) {
        this._spawnBall(r, elapsedSec);
        return this.getState();
      }

      var ball = r.ball;

      // ── Update ball position ──
      var pos = getBallPosition(ball, gameTime());
      ball.x = pos.x;
      ball.y = pos.y;

      // ── Ball state machine ──
      if (ball.state === BALL_STATES.TRAVELING) {
        // Check if ball reached bounce point
        if (pos.t >= 1) {
          ball.state = BALL_STATES.BOUNCED;
          ball.bouncedAt = gameTime();
          ball.x = ball.targetX;
          ball.y = ball.targetY;
        }
      }

      if (ball.state === BALL_STATES.BOUNCED) {
        // Ball has bounced, waiting for player hit or expiry
        if (gameTime() - ball.bouncedAt > ball.tapWindowMs) {
          // Player didn't hit in time → MISSED
          ball.state = BALL_STATES.MISSED;
          ball.missedAt = gameTime();
          r.totalMissed++;
          r.currentStreak = 0;
          this._loseLife(r);
          r.waitUntil = r.elapsedMs + 600; // pause before next ball
          r.rallyCount = 0;
        }
      }

      if (ball.state === BALL_STATES.HIT) {
        // Ball returning to opponent
        var retPos = getBallPosition(ball, gameTime());
        ball.x = retPos.x;
        ball.y = retPos.y;

        if (retPos.t >= 1) {
          // Opponent "hits" it back → new ball
          r.ball = null;
          r.waitUntil = r.elapsedMs + 150; // tiny pause for rhythm
          // Don't reset rallyCount — it continues
        }
      }

      // ── Handle player hit input ──
      if (r.input.hit && !r.input.hitConsumed && ball &&
          (ball.state === BALL_STATES.TRAVELING || ball.state === BALL_STATES.BOUNCED)) {
        r.input.hit = false;
        r.input.hitConsumed = true;
        this._tryHit(r, ball);
      }

      // ── Cleanup old resolved balls (for fade-out) ──
      if (ball && (ball.state === BALL_STATES.MISSED || ball.state === BALL_STATES.FAULTED)) {
        var since = gameTime() - (ball.missedAt || ball.faultedAt || 0);
        if (since > 600) {
          r.ball = null;
        }
      }

      if (r.done) return this.getState();
      return this.getState();
    }


    /**
     * Try to hit the ball.
     */
    _tryHit(r, ball) {
      var cfg = r.config;
      var hitRange = reqNum(cfg.court.hitRange, "court.hitRange", { min: 1 });
      var court = r.court;

      // Check if player is close enough to the ball (X distance)
      var playerYpx = court.playerY * r.canvasH;
      var dx = Math.abs(r.playerX - ball.x);
      // Also check Y: ball should be near player's Y (within reasonable range)
      var dy = Math.abs(ball.y - playerYpx);
      var yRange = r.canvasH * 0.15; // vertical hit range

      if (dx > hitRange || dy > yRange) {
        // Too far — swing and miss (no penalty, just whiff)
        r.playerState = "swing";
        r.playerSwingUntil = gameTime() + 200;
        return;
      }

      // ── Double bounce rule check ──
      // Rally count 0 = return of serve (must bounce)
      // Rally count 1 = 3rd shot (must bounce)
      // Rally count 2+ = volleys allowed EXCEPT in kitchen
      var mustBounce = (r.rallyCount < 2) || ball.inKitchen;

      if (mustBounce && ball.state !== BALL_STATES.BOUNCED) {
        // FAULT: hit before required bounce
        ball.state = BALL_STATES.FAULTED;
        ball.faultedAt = gameTime();
        r.totalFaulted++;
        r.currentStreak = 0;
        r.rallyCount = 0;

        if (r.mode === MODES.RUN) {
          this._loseLife(r);
        } else if (r.mode === MODES.SPRINT) {
          var penalty = Math.floor(reqNum(cfg.sprint.faultPenaltyMs, "faultPenalty", { min: 1 }));
          r.penaltyAccumulatedMs += penalty;
          if (r.sprintDurationMs - r.elapsedMs - r.penaltyAccumulatedMs <= 0) {
            r.sprintRemainingMs = 0;
            r.done = true;
            r.endReason = "TIMER";
          }
        }

        r.waitUntil = r.elapsedMs + 600;
        r.playerState = "swing";
        r.playerSwingUntil = gameTime() + 300;
        return;
      }

      // ── Valid hit! ──
      ball.state = BALL_STATES.HIT;
      ball.hitAt = gameTime();
      r.smashes++;
      r.totalSmashed++;
      r.currentStreak++;
      if (r.currentStreak > r.bestStreak) r.bestStreak = r.currentStreak;
      r.rallyCount++;

      // Swing animation
      r.playerState = "swing";
      r.playerSwingUntil = gameTime() + 250;

      // Calculate return trajectory (ball goes back to opponent)
      var rand = (typeof r.rng === "function") ? r.rng : Math.random;
      ball.returnStartX = ball.x;
      ball.returnStartY = ball.y;
      ball.returnTargetX = r.canvasW * 0.15 + rand() * r.canvasW * 0.7;
      ball.returnTargetY = court.opponentY * r.canvasH;
      ball.returnArcHeight = r.canvasH * 0.03; // slight arc on return
      ball.returnTravelMs = Math.max(250, ball.travelMs * 0.7); // return is faster

      // Check milestones
      for (var mi = 0; mi < r.milestones.length; mi++) {
        if (r.smashes === r.milestones[mi] && r.milestonesReached.indexOf(r.milestones[mi]) === -1) {
          r.milestonesReached.push(r.milestones[mi]);
          r.lastMilestoneAt = gameTime();
        }
      }
    }


    /**
     * Spawn a new ball from opponent.
     */
    _spawnBall(r, elapsedSec) {
      var ball = createBallFromOpponent(
        r.config, elapsedSec, r.canvasW, r.canvasH, r.court, r.playerX, r.rng
      );

      // Onboarding shield: first N balls never kitchen
      if (r.totalSpawned < r.onboardingShield) {
        ball.inKitchen = false;
        // Recalculate target Y to be outside kitchen
        var kitchenLineYpx = r.court.kitchenLineY * r.canvasH;
        var playerYpx = r.court.playerY * r.canvasH;
        var rand = (typeof r.rng === "function") ? r.rng : Math.random;
        ball.targetY = kitchenLineYpx + rand() * (playerYpx - kitchenLineYpx - 20) + 10;
        ball.shadowY = ball.targetY;
      }

      // Track first kitchen ball
      if (ball.inKitchen && !r.firstKitchenSpawned) {
        r.firstKitchenSpawned = true;
        ball.isFirstKitchen = true;
      }

      r.ball = ball;
      r.totalSpawned++;
    }


    /**
     * Lose a life (RUN only).
     */
    _loseLife(r) {
      if (r.mode !== MODES.RUN || r.lives == null) return;
      r.lives = Math.max(0, r.lives - 1);
      if (r.lives <= 0) {
        r.done = true;
        r.endReason = "LIVES";
      }
    }


    /**
     * Get current state snapshot (read-only, for UI).
     */
    getState() {
      if (!this.run) {
        return {
          mode: "NONE", done: true, smashes: 0,
          lives: null, maxLives: null,
          sprintRemainingMs: null, balls: [],
          elapsedMs: 0, endReason: null
        };
      }

      var r = this.run;
      var ballState = null;
      if (r.ball) {
        var b = r.ball;
        ballState = {
          id: b.id,
          x: b.x, y: b.y,
          radius: b.radius,
          inKitchen: b.inKitchen,
          ballType: b.ballType || "normal",
          state: b.state,
          targetX: b.targetX, targetY: b.targetY,
          startX: b.startX, startY: b.startY,
          arcHeight: b.arcHeight,
          isFirstKitchen: !!b.isFirstKitchen,
          bouncedAt: b.bouncedAt || 0,
          hitAt: b.hitAt || 0,
          missedAt: b.missedAt || 0,
          faultedAt: b.faultedAt || 0,
          spawnedAt: b.spawnedAt || 0,
          travelMs: b.travelMs,
          tapWindowMs: b.tapWindowMs,
          shadowY: b.shadowY || b.targetY,
          // Return trajectory
          returnStartX: b.returnStartX, returnStartY: b.returnStartY,
          returnTargetX: b.returnTargetX, returnTargetY: b.returnTargetY,
          returnArcHeight: b.returnArcHeight || 0,
          returnTravelMs: b.returnTravelMs || 0
        };
      }

      return {
        mode: r.mode,
        done: !!r.done,
        smashes: r.smashes,
        lives: r.lives,
        maxLives: r.maxLives,
        sprintRemainingMs: r.sprintRemainingMs,
        sprintDurationMs: r.sprintDurationMs,
        elapsedMs: r.elapsedMs,
        endReason: r.endReason,

        // Court entities
        playerX: r.playerX,
        playerState: r.playerState,
        opponentX: r.opponentX,
        ball: ballState,

        // Rally
        rallyCount: r.rallyCount,

        // Counters
        totalSpawned: r.totalSpawned,
        totalSmashed: r.totalSmashed,
        totalMissed: r.totalMissed,
        totalFaulted: r.totalFaulted,
        currentStreak: r.currentStreak,
        bestStreak: r.bestStreak,

        // Milestones
        milestonesReached: r.milestonesReached ? r.milestonesReached.slice() : [],
        lastMilestoneAt: r.lastMilestoneAt || 0,

        // Court layout (for renderer)
        court: r.court,

        // Canvas dimensions
        canvasW: r.canvasW,
        canvasH: r.canvasH
      };
    }


    /**
     * Get end-of-run result.
     */
    getResult() {
      var s = this.getState();
      return {
        mode: s.mode,
        smashes: s.smashes,
        lives: s.lives,
        maxLives: s.maxLives,
        elapsedMs: s.elapsedMs,
        endReason: s.endReason,
        totalSpawned: s.totalSpawned,
        totalSmashed: s.totalSmashed,
        totalMissed: s.totalMissed,
        totalFaulted: s.totalFaulted,
        currentStreak: s.currentStreak,
        bestStreak: s.bestStreak
      };
    }
  }


  // ============================================
  // Export
  // ============================================
  window.KR_Game = {
    GameEngine: GameEngine,
    BALL_STATES: BALL_STATES
  };
})();
