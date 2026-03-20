// game.js v3.0 - Kitchen Rush
// Canvas game engine — pickleball exchange arcade.
// V3: 2D movement (up/down/left/right), auto-hit with timing bonus,
//     daily challenge modifiers.
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
  function dist(x1, y1, x2, y2) { return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)); }

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

  // Day-of-year for daily modifier rotation
  function dayOfYear() {
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    var diff = now - start;
    return Math.floor(diff / 86400000);
  }

  // Game-time clock
  var _gt = 0;
  function gameTime() { return _gt; }


  // ============================================
  // Ball states
  // ============================================
  var BALL_STATES = {
    TRAVELING: "TRAVELING",
    BOUNCED: "BOUNCED",
    HIT: "HIT",
    MISSED: "MISSED",
    FAULTED: "FAULTED"
  };


  // ============================================
  // Daily Challenge Modifiers
  // ============================================
  var DAILY_MODIFIERS = [
    { id: "score_target_15", label: "Score Target", desc: "Reach 15 points", targetScore: 15 },
    { id: "speed_demon", label: "Speed Demon", desc: "All balls are fast", speedMul: 1.5 },
    { id: "kitchen_master", label: "Kitchen Master", desc: "Only kitchen balls count", kitchenOnly: true },
    { id: "one_life", label: "One Life", desc: "One chance only", livesOverride: 1 },
    { id: "no_kitchen", label: "Baseline Rally", desc: "No kitchen balls", kitchenRatioOverride: 0 },
    { id: "lob_city", label: "Lob City", desc: "Only lobs", forceBallType: "lob" },
    { id: "tiny_window", label: "Quick Hands", desc: "Tiny hit window", windowMul: 0.5 },
    { id: "wide_court", label: "Wide Court", desc: "Balls spread wide", spreadMul: 2 },
    { id: "marathon", label: "Marathon", desc: "Survive 90 seconds", survivalMs: 90000 },
    { id: "streak_5", label: "Streak Hunter", desc: "Build a 5-streak", targetStreak: 5 },
    { id: "fast_ramp", label: "Fast Ramp", desc: "Speed increases 3x faster", accelMul: 3 },
    { id: "dink_only", label: "Soft Touch", desc: "Only dinks", forceBallType: "dink" },
    { id: "mirror", label: "Mirror Mode", desc: "Controls are inverted", mirror: true },
    { id: "score_target_25", label: "High Score", desc: "Reach 25 points", targetScore: 25 }
  ];

  function getDailyModifier() {
    var day = dayOfYear();
    return DAILY_MODIFIERS[day % DAILY_MODIFIERS.length];
  }


  // ============================================
  // Court layout
  // ============================================
  function getCourtLayout(config) {
    var c = config.court || {};
    return {
      netY: reqNum(c.netY, "court.netY", { min: 0.05, max: 0.3 }),
      kitchenLineY: reqNum(c.kitchenLineY, "court.kitchenLineY", { min: 0.2, max: 0.6 }),
      baselineY: (Number.isFinite(Number(c.baselineY)) && Number(c.baselineY) >= 0.5 && Number(c.baselineY) <= 0.99) ? Number(c.baselineY) : 0.82,
      playerY: reqNum(c.playerY, "court.playerY", { min: 0.5, max: 0.9 }),
      opponentY: reqNum(c.opponentY, "court.opponentY", { min: 0.02, max: 0.2 }),
      controlsY: reqNum(c.controlsY, "court.controlsY", { min: 0.8, max: 1.0 })
    };
  }


  // ============================================
  // Ball factory
  // ============================================
  var _nextBallId = 0;

  function createBallFromOpponent(config, elapsedSec, canvasW, canvasH, court, playerX, playerY, rng, modifier) {
    var rand = (typeof rng === "function") ? rng : Math.random;
    var gameCfg = config.game || {};

    // Ball type selection (modifier can force a type)
    var ballType;
    if (modifier && modifier.forceBallType) {
      ballType = modifier.forceBallType;
    } else {
      ballType = pickBallType(config, elapsedSec, rng);
    }
    var typeConfig = (gameCfg.ballTypes && gameCfg.ballTypes[ballType]) || null;
    var speedMul = typeConfig ? reqNum(typeConfig.speedMultiplier, "ballType.speedMul", { min: 0.01 }) : 1;
    if (modifier && modifier.speedMul) speedMul *= modifier.speedMul;
    var isLob = (ballType === "lob");
    var forceKitchen = !!(typeConfig && typeConfig.forceKitchen);

    // Speed
    var spd = gameCfg.speed || {};
    var accelMul = (modifier && modifier.accelMul) ? modifier.accelMul : 1;
    var speed = (reqNum(spd.base, "speed.base", { min: 0.1 }) +
                 reqNum(spd.accelPerSec, "speed.accel", { min: 0 }) * elapsedSec * accelMul) * speedMul;

    // Opponent X
    var opX = canvasW * 0.2 + rand() * canvasW * 0.6;

    // Target X: spread modifier
    var spreadBase = canvasW * 0.35;
    if (modifier && modifier.spreadMul) spreadBase *= modifier.spreadMul;
    var targetX = clamp(
      playerX + (rand() - 0.5) * spreadBase * 2,
      canvasW * 0.08,
      canvasW * 0.92
    );

    // Kitchen ratio
    var kr = gameCfg.kitchenRatio || {};
    var kitchenRatio;
    if (modifier && modifier.kitchenRatioOverride !== undefined) {
      kitchenRatio = modifier.kitchenRatioOverride;
    } else {
      kitchenRatio = clamp(
        reqNum(kr.base, "kitchenRatio.base", { min: 0, max: 1 }) +
        reqNum(kr.growthPerSec, "kitchenRatio.growth", { min: 0 }) * elapsedSec,
        0,
        reqNum(kr.max, "kitchenRatio.max", { min: 0, max: 1 })
      );
    }
    if (modifier && modifier.kitchenOnly) kitchenRatio = 1;

    var inKitchen = forceKitchen || (rand() < kitchenRatio);

    // Target Y
    var netYpx = court.netY * canvasH;
    var kitchenLineYpx = court.kitchenLineY * canvasH;
    var baselineYpx = court.baselineY * canvasH;

    var targetY;
    if (inKitchen) {
      targetY = netYpx + rand() * (kitchenLineYpx - netYpx) * 0.8 + (kitchenLineYpx - netYpx) * 0.1;
    } else {
      targetY = kitchenLineYpx + rand() * (baselineYpx - kitchenLineYpx - 20) + 10;
    }

    var startX = opX;
    var startY = court.opponentY * canvasH;

    var arcHeight = isLob ? (canvasH * 0.15 + rand() * canvasH * 0.05) : (canvasH * 0.02);

    var radiusMul = typeConfig ? reqNum(typeConfig.radiusMultiplier, "ballType.radius", { min: 0.01 }) : 1;
    var baseRadius = reqNum(config.canvas.ballRadius, "canvas.ballRadius", { min: 1 });
    var radius = Math.round(baseRadius * radiusMul);

    // Tap window
    var win = gameCfg.window || {};
    var tapMul = typeConfig ? reqNum(typeConfig.tapWindowMultiplier, "ballType.tapMul", { min: 0.01 }) : 1;
    if (modifier && modifier.windowMul) tapMul *= modifier.windowMul;
    var tapWindowMs = Math.max(
      reqNum(win.minMs, "window.min", { min: 1 }),
      (reqNum(win.initialMs, "window.initial", { min: 1 }) -
       reqNum(win.decayPerSec, "window.decay", { min: 0 }) * elapsedSec) * tapMul
    );

    // Travel duration
    var d = Math.sqrt(Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2));
    var travelMs = Math.max(300, (d / speed) * 16.67);

    return {
      id: ++_nextBallId,
      ballType: ballType,
      inKitchen: inKitchen,
      radius: radius,
      startX: startX, startY: startY,
      targetX: targetX, targetY: targetY,
      arcHeight: arcHeight,
      travelMs: travelMs,
      x: startX, y: startY,
      state: BALL_STATES.TRAVELING,
      spawnedAt: gameTime(),
      bouncedAt: 0, hitAt: 0, missedAt: 0, faultedAt: 0,
      tapWindowMs: tapWindowMs,
      returnStartX: 0, returnStartY: 0,
      returnTargetX: 0, returnTargetY: 0,
      returnArcHeight: 0, returnTravelMs: 0,
      speed: speed,
      shadowY: targetY,
      // Auto-hit: did auto-hit already fire?
      autoHitFired: false,
      // Timing bonus: how close to optimal timing the player hit (0-1, 1=perfect)
      timingBonus: 0
    };
  }


  // ============================================
  // Ball type selection
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
      var x = lerp(ball.startX, ball.targetX, t);
      var yLinear = lerp(ball.startY, ball.targetY, t);
      var arc = -ball.arcHeight * 4 * t * (1 - t);
      return { x: x, y: yLinear + arc, t: t };
    }

    if (ball.state === BALL_STATES.BOUNCED) {
      var sinceBounce = gt - ball.bouncedAt;
      var bounceAnim = 0;
      // Primary hop: bigger (40px over 250ms)
      if (sinceBounce < 250) {
        var bt = sinceBounce / 250;
        bounceAnim = -40 * Math.sin(bt * Math.PI);
      }
      // Secondary smaller hop (250-400ms)
      else if (sinceBounce < 400) {
        var bt2 = (sinceBounce - 250) / 150;
        bounceAnim = -12 * Math.sin(bt2 * Math.PI);
      }
      // Squash factor for renderer (0-1, 1=max squash at impact)
      var squash = 0;
      if (sinceBounce < 60) squash = 1 - (sinceBounce / 60);
      return { x: ball.targetX, y: ball.targetY + bounceAnim, t: 1, squash: squash };
    }

    if (ball.state === BALL_STATES.HIT) {
      var sinceHit = gt - ball.hitAt;
      var t2 = clamp(sinceHit / ball.returnTravelMs, 0, 1);
      var x2 = lerp(ball.returnStartX, ball.returnTargetX, t2);
      var y2Linear = lerp(ball.returnStartY, ball.returnTargetY, t2);
      var arc2 = -ball.returnArcHeight * 4 * t2 * (1 - t2);
      return { x: x2, y: y2Linear + arc2, t: t2 };
    }

    return { x: ball.x, y: ball.y, t: 1 };
  }


  // ============================================
  // GameEngine V3
  // ============================================
  class GameEngine {
    constructor() {
      this.run = null;
    }

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
      var modifier = isDaily ? getDailyModifier() : null;

      var baseLives = Math.floor(reqNum(config.game.lives, "lives", { min: 1 }));
      var lives = (mode === MODES.RUN) ? ((modifier && modifier.livesOverride) ? modifier.livesOverride : baseLives) : null;
      var sprintDurationMs = (mode === MODES.SPRINT) ? Math.floor(reqNum(config.sprint.durationMs, "sprintDur", { min: 1 })) : null;

      // Daily survival mode: override sprint-like timer on RUN mode
      var survivalMs = (modifier && modifier.survivalMs) ? modifier.survivalMs : null;

      var onboardingShield = Math.floor(reqNum(config.game.onboardingShield, "shield", { min: 0 }));
      var court = getCourtLayout(config);

      _gt = 0;

      this.run = {
        mode: mode,
        config: config,
        court: court,
        canvasW: canvasW,
        canvasH: canvasH,
        isDaily: isDaily,
        modifier: modifier,

        rng: isDaily ? mulberry32(dateSeed()) : null,

        elapsedMs: 0,
        lastSpawnAt: -9999,

        // V3: Player 2D position
        playerX: canvasW / 2,
        playerY: court.playerY * canvasH,
        playerMinY: court.kitchenLineY * canvasH + 10, // can't enter kitchen
        playerMaxY: (court.baselineY || 0.82) * canvasH + 30, // can go slightly behind baseline
        playerState: "idle",
        playerSwingUntil: 0,

        opponentX: canvasW / 2,
        opponentTargetX: canvasW / 2,

        lives: lives,
        maxLives: lives,
        sprintDurationMs: sprintDurationMs,
        sprintRemainingMs: sprintDurationMs,
        penaltyAccumulatedMs: 0,

        // Survival timer (daily modifier)
        survivalMs: survivalMs,

        smashes: 0,
        ball: null,
        rallyCount: 0,
        totalRallies: 0,

        totalSpawned: 0,
        totalSmashed: 0,
        totalMissed: 0,
        totalFaulted: 0,
        onboardingShield: onboardingShield,

        currentStreak: 0,
        bestStreak: 0,
        firstKitchenSpawned: false,

        milestones: Array.isArray(config.game && config.game.milestones) ? config.game.milestones.slice() : [],
        milestonesReached: [],
        lastMilestoneAt: 0,

        // V3 input: 2D movement + optional hit
        input: {
          left: false,
          right: false,
          up: false,
          down: false,
          hit: false,
          hitConsumed: false
        },

        done: false,
        endReason: null,
        waitUntil: 800,

        // V3: last timing bonus for UI display
        lastTimingBonus: 0,
        // V3: daily modifier completion flag
        dailyObjectiveMet: false
      };

      return this.getState();
    }


    setInput(left, right, up, down, hit) {
      if (!this.run) return;
      var r = this.run;
      var mod = r.modifier;

      // V3: Mirror mode inverts left/right
      if (mod && mod.mirror) {
        r.input.left = !!right;
        r.input.right = !!left;
      } else {
        r.input.left = !!left;
        r.input.right = !!right;
      }
      r.input.up = !!up;
      r.input.down = !!down;

      if (hit && !r.input.hitConsumed) {
        r.input.hit = true;
      }
      if (!hit) {
        r.input.hitConsumed = false;
      }
    }


    update(dtMs) {
      if (!this.run || this.run.done) return this.getState();

      var r = this.run;
      var cfg = r.config;
      var gameCfg = cfg.game || {};
      var court = r.court;
      var mod = r.modifier;

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

      // Daily survival timer
      if (r.survivalMs && r.elapsedMs >= r.survivalMs && r.mode === MODES.RUN) {
        r.dailyObjectiveMet = true;
        r.done = true;
        r.endReason = "SURVIVED";
        return this.getState();
      }

      // ── V3: Player 2D movement ──
      var playerSpeed = reqNum(cfg.court.playerSpeed, "court.playerSpeed", { min: 0.1 });
      var moveAmount = playerSpeed * (dtMs / 16.67);

      var moving = false;
      if (r.input.left) {
        r.playerX = Math.max(20, r.playerX - moveAmount);
        moving = true;
      }
      if (r.input.right) {
        r.playerX = Math.min(r.canvasW - 20, r.playerX + moveAmount);
        moving = true;
      }
      if (r.input.up) {
        r.playerY = Math.max(r.playerMinY, r.playerY - moveAmount);
        moving = true;
      }
      if (r.input.down) {
        r.playerY = Math.min(r.playerMaxY, r.playerY + moveAmount);
        moving = true;
      }

      // Player state
      if (r.playerState !== "swing") {
        if (moving) {
          if (r.input.left && !r.input.right) r.playerState = "runLeft";
          else if (r.input.right && !r.input.left) r.playerState = "runRight";
          else if (r.input.up) r.playerState = "runUp";
          else if (r.input.down) r.playerState = "runDown";
          else r.playerState = "running";
        } else {
          r.playerState = "idle";
        }
      }

      if (r.playerState === "swing" && gameTime() > r.playerSwingUntil) {
        r.playerState = "idle";
      }

      // ── Opponent movement ──
      if (r.ball && r.ball.state === BALL_STATES.HIT) {
        r.opponentTargetX = r.ball.returnTargetX;
      } else {
        r.opponentTargetX = r.canvasW / 2;
      }
      var oppSpeed = playerSpeed * 0.7;
      var oppDiff = r.opponentTargetX - r.opponentX;
      if (Math.abs(oppDiff) > 2) {
        r.opponentX += Math.sign(oppDiff) * Math.min(Math.abs(oppDiff), oppSpeed * (dtMs / 16.67));
      }

      // ── Wait state ──
      if (r.waitUntil > 0 && r.elapsedMs < r.waitUntil) {
        return this.getState();
      }

      // ── Spawn ball ──
      if (!r.ball) {
        this._spawnBall(r, elapsedSec);
        return this.getState();
      }

      var ball = r.ball;

      // ── Update ball position ──
      var pos = getBallPosition(ball, gameTime());
      ball.x = pos.x;
      ball.y = pos.y;
      ball.squash = pos.squash || 0; // V3: bounce squash for renderer

      // ── Ball state machine ──
      if (ball.state === BALL_STATES.TRAVELING) {
        if (pos.t >= 1) {
          ball.state = BALL_STATES.BOUNCED;
          ball.bouncedAt = gameTime();
          ball.x = ball.targetX;
          ball.y = ball.targetY;
        }
      }

      if (ball.state === BALL_STATES.BOUNCED) {
        if (gameTime() - ball.bouncedAt > ball.tapWindowMs) {
          // ── V3: Auto-hit — if player is close enough, auto-return ──
          if (!ball.autoHitFired) {
            var autoRange = this._getAutoHitRange(r);
            var d = dist(r.playerX, r.playerY, ball.x, ball.y);
            if (d <= autoRange) {
              ball.autoHitFired = true;
              ball.timingBonus = 0; // no timing bonus on auto-hit
              this._executeHit(r, ball, 0);
              return this.getState();
            }
          }

          // Missed
          ball.state = BALL_STATES.MISSED;
          ball.missedAt = gameTime();
          r.totalMissed++;
          r.currentStreak = 0;
          this._loseLife(r);
          r.waitUntil = r.elapsedMs + 600;
          r.rallyCount = 0;
        }
      }

      // ── V3: Auto-hit check (while ball is BOUNCED, before expiry) ──
      if (ball.state === BALL_STATES.BOUNCED && !ball.autoHitFired) {
        var autoRange = this._getAutoHitRange(r);
        var d2 = dist(r.playerX, r.playerY, ball.x, ball.y);
        if (d2 <= autoRange) {
          // Player is close enough — auto-hit fires
          var sinceBounce = gameTime() - ball.bouncedAt;
          var timingRatio = sinceBounce / ball.tapWindowMs; // 0=instant, 1=last moment

          // ── Explicit HIT input: timing bonus ──
          if (r.input.hit && !r.input.hitConsumed) {
            r.input.hit = false;
            r.input.hitConsumed = true;
            // Timing bonus: best at ~20-40% of window (sweet spot)
            var sweetSpot = 0.3;
            var timingBonus = Math.max(0, 1 - Math.abs(timingRatio - sweetSpot) / 0.5);
            ball.autoHitFired = true;
            this._executeHit(r, ball, timingBonus);
            return this.getState();
          }

          // Auto-hit after short grace period (give player chance to time it)
          var gracePeriodMs = ball.tapWindowMs * 0.4;
          if (sinceBounce >= gracePeriodMs) {
            ball.autoHitFired = true;
            ball.timingBonus = 0;
            this._executeHit(r, ball, 0);
            return this.getState();
          }
        }
      }

      // ── Explicit HIT while TRAVELING (before bounce) — volley attempt ──
      if (r.input.hit && !r.input.hitConsumed && ball &&
          ball.state === BALL_STATES.TRAVELING) {
        r.input.hit = false;
        r.input.hitConsumed = true;
        this._tryVolley(r, ball);
      }

      // ── Ball HIT returning to opponent ──
      if (ball.state === BALL_STATES.HIT) {
        var retPos = getBallPosition(ball, gameTime());
        ball.x = retPos.x;
        ball.y = retPos.y;
        if (retPos.t >= 1) {
          r.ball = null;
          r.waitUntil = r.elapsedMs + 150;
        }
      }

      // ── Cleanup resolved balls ──
      if (ball && (ball.state === BALL_STATES.MISSED || ball.state === BALL_STATES.FAULTED)) {
        var since = gameTime() - (ball.missedAt || ball.faultedAt || 0);
        if (since > 600) r.ball = null;
      }

      // ── Daily objective check ──
      if (mod && !r.dailyObjectiveMet) {
        if (mod.targetScore && r.smashes >= mod.targetScore) r.dailyObjectiveMet = true;
        if (mod.targetStreak && r.bestStreak >= mod.targetStreak) r.dailyObjectiveMet = true;
      }

      return this.getState();
    }


    // V3: Get auto-hit proximity range
    _getAutoHitRange(r) {
      var hitRange = reqNum(r.config.court.hitRange, "court.hitRange", { min: 1 });
      // Generous range for auto-hit (larger than explicit hit)
      return hitRange * 1.5;
    }


    // V3: Execute a valid hit (shared between auto-hit and explicit hit)
    _executeHit(r, ball, timingBonus) {
      var court = r.court;

      // Double bounce rule check
      var mustBounce = (r.rallyCount < 2) || ball.inKitchen;
      if (mustBounce && ball.state !== BALL_STATES.BOUNCED) {
        // Should not happen in auto-hit (only fires on BOUNCED), but safety check
        this._faultBall(r, ball);
        return;
      }

      ball.state = BALL_STATES.HIT;
      ball.hitAt = gameTime();
      ball.timingBonus = timingBonus;

      // Score: base 1 + timing bonus (0-1 extra)
      var points = 1;
      if (timingBonus > 0.7) points = 2; // perfect timing = double points
      r.smashes += points;
      r.totalSmashed++;
      r.currentStreak++;
      if (r.currentStreak > r.bestStreak) r.bestStreak = r.currentStreak;
      r.rallyCount++;
      r.lastTimingBonus = timingBonus;

      r.playerState = "swing";
      r.playerSwingUntil = gameTime() + 250;

      // Return trajectory
      var rand = (typeof r.rng === "function") ? r.rng : Math.random;
      ball.returnStartX = ball.x;
      ball.returnStartY = ball.y;
      ball.returnTargetX = r.canvasW * 0.15 + rand() * r.canvasW * 0.7;
      ball.returnTargetY = court.opponentY * r.canvasH;
      ball.returnArcHeight = r.canvasH * 0.03;
      ball.returnTravelMs = Math.max(250, ball.travelMs * 0.7);

      // Milestones
      for (var mi = 0; mi < r.milestones.length; mi++) {
        if (r.smashes >= r.milestones[mi] && r.milestonesReached.indexOf(r.milestones[mi]) === -1) {
          r.milestonesReached.push(r.milestones[mi]);
          r.lastMilestoneAt = gameTime();
        }
      }
    }


    // V3: Try volley (hit ball before bounce — only valid after double bounce rule satisfied)
    _tryVolley(r, ball) {
      var court = r.court;
      var hitRange = reqNum(r.config.court.hitRange, "court.hitRange", { min: 1 });

      var d = dist(r.playerX, r.playerY, ball.x, ball.y);
      if (d > hitRange * 1.2) {
        // Too far — whiff
        r.playerState = "swing";
        r.playerSwingUntil = gameTime() + 200;
        return;
      }

      // Double bounce rule: must bounce if rallyCount < 2 or in kitchen
      var mustBounce = (r.rallyCount < 2) || ball.inKitchen;
      if (mustBounce) {
        this._faultBall(r, ball);
        return;
      }

      // Valid volley! High skill shot — big timing bonus
      this._executeHit(r, ball, 1.0); // perfect bonus for successful volley
    }


    // Fault a ball
    _faultBall(r, ball) {
      ball.state = BALL_STATES.FAULTED;
      ball.faultedAt = gameTime();
      r.totalFaulted++;
      r.currentStreak = 0;
      r.rallyCount = 0;

      if (r.mode === MODES.RUN) {
        this._loseLife(r);
      } else if (r.mode === MODES.SPRINT) {
        var penalty = Math.floor(reqNum(r.config.sprint.faultPenaltyMs, "faultPenalty", { min: 1 }));
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
    }


    _spawnBall(r, elapsedSec) {
      var ball = createBallFromOpponent(
        r.config, elapsedSec, r.canvasW, r.canvasH, r.court,
        r.playerX, r.playerY, r.rng, r.modifier
      );

      if (r.totalSpawned < r.onboardingShield) {
        ball.inKitchen = false;
        var kitchenLineYpx = r.court.kitchenLineY * r.canvasH;
        var baselineYpx = r.court.baselineY * r.canvasH;
        var rand = (typeof r.rng === "function") ? r.rng : Math.random;
        ball.targetY = kitchenLineYpx + rand() * (baselineYpx - kitchenLineYpx - 20) + 10;
        ball.shadowY = ball.targetY;
      }

      if (ball.inKitchen && !r.firstKitchenSpawned) {
        r.firstKitchenSpawned = true;
        ball.isFirstKitchen = true;
      }

      r.ball = ball;
      r.totalSpawned++;
    }


    _loseLife(r) {
      if (r.mode !== MODES.RUN || r.lives == null) return;
      r.lives = Math.max(0, r.lives - 1);
      if (r.lives <= 0) {
        r.done = true;
        r.endReason = "LIVES";
      }
    }


    getState() {
      if (!this.run) {
        return {
          mode: "NONE", done: true, smashes: 0,
          lives: null, maxLives: null,
          sprintRemainingMs: null,
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
          returnStartX: b.returnStartX, returnStartY: b.returnStartY,
          returnTargetX: b.returnTargetX, returnTargetY: b.returnTargetY,
          returnArcHeight: b.returnArcHeight || 0,
          returnTravelMs: b.returnTravelMs || 0,
          timingBonus: b.timingBonus || 0,
          autoHitFired: !!b.autoHitFired,
          squash: b.squash || 0
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

        // V3: 2D player position
        playerX: r.playerX,
        playerY: r.playerY,
        playerState: r.playerState,
        opponentX: r.opponentX,
        ball: ballState,

        rallyCount: r.rallyCount,
        totalSpawned: r.totalSpawned,
        totalSmashed: r.totalSmashed,
        totalMissed: r.totalMissed,
        totalFaulted: r.totalFaulted,
        currentStreak: r.currentStreak,
        bestStreak: r.bestStreak,

        milestonesReached: r.milestonesReached ? r.milestonesReached.slice() : [],
        lastMilestoneAt: r.lastMilestoneAt || 0,

        court: r.court,
        canvasW: r.canvasW,
        canvasH: r.canvasH,

        // V3 extras
        lastTimingBonus: r.lastTimingBonus || 0,
        dailyModifier: r.modifier ? { id: r.modifier.id, label: r.modifier.label, desc: r.modifier.desc } : null,
        dailyObjectiveMet: !!r.dailyObjectiveMet
      };
    }


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
        bestStreak: s.bestStreak,
        dailyModifier: s.dailyModifier,
        dailyObjectiveMet: s.dailyObjectiveMet
      };
    }
  }


  // ============================================
  // Export
  // ============================================
  window.KR_Game = {
    GameEngine: GameEngine,
    BALL_STATES: BALL_STATES,
    getDailyModifier: getDailyModifier,
    DAILY_MODIFIERS: DAILY_MODIFIERS
  };
})();
