// game.js v1.0 - Kitchen Rush
// Canvas game engine — real-time ball-smashing arcade.
// Zero DOM access, zero localStorage.
// Kitchen Rush

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

  function requiredNumber(value, name, opts) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(name + " must be a finite number");
    if (opts && Number.isFinite(opts.min) && n < opts.min) throw new Error(name + " must be >= " + opts.min);
    if (opts && Number.isFinite(opts.max) && n > opts.max) throw new Error(name + " must be <= " + opts.max);
    if (opts && opts.integer === true && Math.floor(n) !== n) throw new Error(name + " must be an integer");
    return n;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  // Game-time clock: returns r.elapsedMs from the active run.
  // All ball timestamps (landedAt, bouncedAt, etc.) use game-time,
  // NOT wall-clock. This prevents tab-switch bugs where performance.now()
  // drifts while the RAF loop is paused.
  // The UI maps game-time → wall-time for canvas animations.
  var _currentGameTimeMs = 0;
  function gameTime() {
    return _currentGameTimeMs;
  }

  // V2: Seeded PRNG (mulberry32) for daily challenge
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

  // ============================================
  // Ball type selection (V2)
  // ============================================
  function pickBallType(config, elapsedSec, rng) {
    var types = config.game && config.game.ballTypes;
    if (!types || typeof types !== "object") return "normal";

    var rand = (typeof rng === "function") ? rng : Math.random;
    var candidates = [];
    var totalWeight = 1;  // "normal" always has weight 1

    for (var key in types) {
      if (!types.hasOwnProperty(key)) continue;
      var t = types[key];
      if (!t || typeof t !== "object") continue;
      var unlock = requiredNumber(t.unlockAfterSec, "KR_CONFIG.game.ballTypes." + key + ".unlockAfterSec", { min: 0 });
      if (elapsedSec >= unlock) {
        var w = requiredNumber(t.weight, "KR_CONFIG.game.ballTypes." + key + ".weight", { min: 0 });
        if (w > 0) {
          candidates.push({ type: key, weight: w });
          totalWeight += w;
        }
      }
    }

    if (candidates.length === 0) return "normal";

    var roll = rand() * totalWeight;
    var cumulative = 1;  // "normal" occupies [0, 1)
    if (roll < cumulative) return "normal";

    for (var i = 0; i < candidates.length; i++) {
      cumulative += candidates[i].weight;
      if (roll < cumulative) return candidates[i].type;
    }

    return "normal";
  }


  // ============================================
  // Ball factory
  // ============================================
  let _nextBallId = 0;

  function createBall(config, elapsedSec, canvasW, canvasH, rng) {
    const cfg = config.game || {};
    const canvasCfg = config.canvas || {};
    var rand = (typeof rng === "function") ? rng : Math.random;

    // V2: Ball type
    var ballType = pickBallType(config, elapsedSec, rng);
    var typeConfig = (cfg.ballTypes && cfg.ballTypes[ballType]) || null;
    var speedMul = typeConfig ? requiredNumber(typeConfig.speedMultiplier, "KR_CONFIG.game.ballTypes." + ballType + ".speedMultiplier", { min: 0.01 }) : 1;
    var tapMul = typeConfig ? requiredNumber(typeConfig.tapWindowMultiplier, "KR_CONFIG.game.ballTypes." + ballType + ".tapWindowMultiplier", { min: 0.01 }) : 1;
    var radiusMul = typeConfig ? requiredNumber(typeConfig.radiusMultiplier, "KR_CONFIG.game.ballTypes." + ballType + ".radiusMultiplier", { min: 0.01 }) : 1;
    var forceKitchen = !!(typeConfig && typeConfig.forceKitchen);

    // Kitchen line Y (fraction of canvas height)
    const kitchenLineYFrac = requiredNumber(canvasCfg.kitchenLineY, "KR_CONFIG.canvas.kitchenLineY", { min: 0.01, max: 0.99 });
    const kitchenLineY = kitchenLineYFrac * canvasH;

    // Kitchen ratio at current time
    const kr = cfg.kitchenRatio || {};
    const kitchenRatio = clamp(
      requiredNumber(kr.base, "KR_CONFIG.game.kitchenRatio.base", { min: 0, max: 1 }) + requiredNumber(kr.growthPerSec, "KR_CONFIG.game.kitchenRatio.growthPerSec", { min: 0 }) * elapsedSec,
      0,
      requiredNumber(kr.max, "KR_CONFIG.game.kitchenRatio.max", { min: 0, max: 1 })
    );

    // Decide if ball lands in Kitchen
    const inKitchen = forceKitchen || (rand() < kitchenRatio);

    // Ball radius (V2: type modifier)
    const radius = Math.round(requiredNumber(canvasCfg.ballRadius, "KR_CONFIG.canvas.ballRadius", { min: 1 }) * radiusMul);

    // Random X position (avoid edges)
    const margin = radius * 2;
    const x = margin + rand() * (canvasW - margin * 2);

    // Speed at current time (V2: type modifier)
    const spd = cfg.speed || {};
    const speed = (requiredNumber(spd.base, "KR_CONFIG.game.speed.base", { min: 0.1 }) + requiredNumber(spd.accelPerSec, "KR_CONFIG.game.speed.accelPerSec", { min: 0 }) * elapsedSec) * speedMul;

    // Tap window at current time (V2: type modifier)
    const win = cfg.window || {};
    const tapWindowMs = Math.max(
      requiredNumber(win.minMs, "KR_CONFIG.game.window.minMs", { min: 1 }),
      (requiredNumber(win.initialMs, "KR_CONFIG.game.window.initialMs", { min: 1 }) - requiredNumber(win.decayPerSec, "KR_CONFIG.game.window.decayPerSec", { min: 0 }) * elapsedSec) * tapMul
    );

    // Landing Y: if inKitchen, land between kitchenLineY and bottom; else above kitchenLineY
    // Non-kitchen: enforce minimum landing Y so balls don't stop near top of screen
    var minLandingYFrac = requiredNumber(canvasCfg.minLandingYFrac, "KR_CONFIG.canvas.minLandingYFrac", { min: 0, max: 0.99 });
    var minLandingY = kitchenLineY * minLandingYFrac;

    const landingY = inKitchen
      ? kitchenLineY + rand() * (canvasH - kitchenLineY - radius)
      : Math.max(minLandingY, radius) + rand() * (kitchenLineY - Math.max(minLandingY, radius) - radius);

    return {
      id: ++_nextBallId,
      x: x,
      y: 0,
      radius: radius,
      speed: speed,
      landingY: landingY,
      inKitchen: inKitchen,
      ballType: ballType,
      state: "FALLING",
      tapWindowMs: tapWindowMs,
      landedAt: 0,
      bouncedAt: 0,
      smashedAt: 0,
      faultedAt: 0,
      missedAt: 0,
      // Smash-out animation direction
      smashOutAngle: 0,
      // Trail positions (ring buffer)
      trail: []
    };
  }


  // ============================================
  // GameEngine (Canvas real-time)
  // ============================================
  class GameEngine {
    constructor() {
      this.run = null;
    }

    /**
     * Start a new run.
     * @param {Object} payload — { config, mode: "RUN" | "SPRINT", canvasW, canvasH }
     */
    start(payload) {
      const p = (payload && typeof payload === "object") ? payload : {};

      if (!p.config || typeof p.config !== "object") {
        throw new Error("KR_Game.GameEngine.start(): payload.config is required");
      }

      const config = p.config;
      const canvasW = requiredNumber(p.canvasW, "GameEngine.start().canvasW", { min: 1 });
      const canvasH = requiredNumber(p.canvasH, "GameEngine.start().canvasH", { min: 1 });
      // Mode
      const modeRaw = String(p.mode == null ? "" : p.mode).trim().toUpperCase();
      const VALID_MODES = [MODES.RUN, MODES.SPRINT];
      if (!modeRaw || !VALID_MODES.includes(modeRaw)) {
        throw new Error('GameEngine.start(): invalid mode "' + modeRaw + '"');
      }
      const mode = modeRaw;

      // C11: Daily flag — only seed RNG when explicitly playing daily
      const isDaily = !!(p.isDaily);

      // Lives (RUN only; SPRINT has no lives)
      const lives = (mode === MODES.RUN)
        ? Math.floor(requiredNumber(config.game && config.game.lives, "KR_CONFIG.game.lives", { min: 1 }))
        : null;

      // Sprint timer
      const sprintDurationMs = (mode === MODES.SPRINT)
        ? Math.floor(requiredNumber(config.sprint && config.sprint.durationMs, "KR_CONFIG.sprint.durationMs", { min: 1 }))
        : null;

      // Onboarding shield (first N balls always outside Kitchen)
      const onboardingShield = Math.floor(requiredNumber(config.game && config.game.onboardingShield, "KR_CONFIG.game.onboardingShield", { min: 0 }));

      // Reset game clock
      _currentGameTimeMs = 0;

      this.run = {
        mode: mode,
        config: config,
        canvasW: canvasW,
        canvasH: canvasH,

        // V2: Seeded RNG for daily mode only (C11: Classic uses Math.random)
        rng: (isDaily && mode === MODES.RUN) ? mulberry32(dateSeed()) : null,
        isDaily: isDaily,

        // Timing
        startedAt: 0,
        elapsedMs: 0,
        lastSpawnAt: 0,

        // Lives (RUN)
        lives: lives,
        maxLives: lives,

        // Sprint timer
        sprintDurationMs: sprintDurationMs,
        sprintRemainingMs: sprintDurationMs,
        penaltyAccumulatedMs: 0,

        // Score
        smashes: 0,

        // Balls currently active
        balls: [],

        // Counters
        totalSpawned: 0,
        totalSmashed: 0,
        totalMissed: 0,
        totalFaulted: 0,
        onboardingShield: onboardingShield,

        // Streak tracking (C9: moved from UI to engine for data integrity)
        currentStreak: 0,
        bestStreak: 0,

        // First Kitchen ball signal (for reinforced visual)
        firstKitchenSpawned: false,

        // Milestones (visual feedback triggers)
        milestones: Array.isArray(config.game && config.game.milestones) ? config.game.milestones.slice() : [],
        milestonesReached: [],
        lastMilestoneAt: 0,

        // Bounce events (for audio/visual feedback)
        lastBounceAt: 0,

        // State
        done: false,
        endReason: null    // "LIVES" | "TIMER" | null
      };

      return this.getState();
    }


    /**
     * Update game state (called every frame).
     * @param {number} dtMs — delta time in milliseconds since last update
     * @returns {Object} state snapshot
     */
    update(dtMs) {
      if (!this.run || this.run.done) return this.getState();

      const r = this.run;
      const cfg = r.config;
      const gameCfg = cfg.game || {};

      r.elapsedMs += dtMs;
      _currentGameTimeMs = r.elapsedMs;
      const elapsedSec = r.elapsedMs / 1000;

      // Sprint timer countdown (includes accumulated fault penalties)
      if (r.mode === MODES.SPRINT && r.sprintRemainingMs != null) {
        r.sprintRemainingMs = Math.max(0, r.sprintDurationMs - r.elapsedMs - r.penaltyAccumulatedMs);
        if (r.sprintRemainingMs <= 0) {
          r.done = true;
          r.endReason = "TIMER";
          return this.getState();
        }
      }

      // Rebound delay config
      const reboundDelayMs = requiredNumber(gameCfg.reboundDelayMs, "KR_CONFIG.game.reboundDelayMs", { min: 1 });

      // Update existing balls
      for (let i = r.balls.length - 1; i >= 0; i--) {
        const b = r.balls[i];

        if (b.state === "FALLING") {
          // Record trail position before moving
          if (b.trail.length >= 5) b.trail.shift();
          b.trail.push({ x: b.x, y: b.y });

          b.y += b.speed * (dtMs / 16.67); // normalize to ~60fps baseline

          if (b.y >= b.landingY) {
            b.y = b.landingY;
            b.state = "LANDED";
            b.landedAt = gameTime();
          }
        }

        if (b.state === "LANDED") {
          // After rebound delay, transition to BOUNCING (Kitchen balls become smashable)
          if (b.inKitchen && (gameTime() - b.landedAt >= reboundDelayMs)) {
            b.state = "BOUNCING";
            b.bouncedAt = gameTime();
            r.lastBounceAt = gameTime();
          }

          // Non-kitchen balls: tap window expires → MISSED
          if (!b.inKitchen && (gameTime() - b.landedAt > b.tapWindowMs)) {
            b.state = "MISSED";
            b.missedAt = gameTime();
            r.totalMissed++;
            r.currentStreak = 0;
            this._loseLife(r);
          }
        }

        if (b.state === "BOUNCING") {
          // Kitchen ball: tap window after bounce
          if (gameTime() - b.bouncedAt > b.tapWindowMs) {
            b.state = "MISSED";
            b.missedAt = gameTime();
            r.totalMissed++;
            r.currentStreak = 0;
            this._loseLife(r);
          }
        }

        // Cleanup old resolved balls (keep for fade-out animation, 500ms)
        if ((b.state === "SMASHED" || b.state === "MISSED" || b.state === "FAULTED") &&
            (gameTime() - (b.smashedAt || b.missedAt || b.faultedAt || 0)) > 500) {
          r.balls.splice(i, 1);
        }
      }

      // Spawn new balls
      const spawnCfg = gameCfg.spawn || {};
      const spawnInterval = Math.max(
        requiredNumber(spawnCfg.minMs, "KR_CONFIG.game.spawn.minMs", { min: 1 }),
        requiredNumber(spawnCfg.initialMs, "KR_CONFIG.game.spawn.initialMs", { min: 1 }) - requiredNumber(spawnCfg.decayPerSec, "KR_CONFIG.game.spawn.decayPerSec", { min: 0 }) * elapsedSec
      );

      if (r.elapsedMs - r.lastSpawnAt >= spawnInterval) {
        r.lastSpawnAt = r.elapsedMs;

        const ball = createBall(cfg, elapsedSec, r.canvasW, r.canvasH, r.rng);

        // Onboarding shield: force non-Kitchen for first N balls
        if (r.totalSpawned < r.onboardingShield) {
          ball.inKitchen = false;
          // Recalculate landing Y for non-kitchen
          const canvasCfg = cfg.canvas || {};
          const kitchenLineYFrac = requiredNumber(canvasCfg.kitchenLineY, "KR_CONFIG.canvas.kitchenLineY", { min: 0.01, max: 0.99 });
          const kitchenLineY = kitchenLineYFrac * r.canvasH;
          var shieldRand = (typeof r.rng === "function") ? r.rng : Math.random;
          // Enforce minimum landing Y so balls don't stop near top of screen
          var minFrac = requiredNumber(canvasCfg.minLandingYFrac, "KR_CONFIG.canvas.minLandingYFrac", { min: 0, max: 0.99 });
          var minY = Math.max(kitchenLineY * minFrac, ball.radius);
          ball.landingY = minY + shieldRand() * (kitchenLineY - minY - ball.radius);
        }

        // Track first Kitchen ball (for reinforced signal)
        if (ball.inKitchen && !r.firstKitchenSpawned) {
          r.firstKitchenSpawned = true;
          ball.isFirstKitchen = true;
        }

        r.balls.push(ball);
        r.totalSpawned++;
      }

      // Check end condition (RUN: lives)
      if (r.done) return this.getState();

      return this.getState();
    }


    /**
     * Handle player tap at position (x, y).
     * Returns { hit, ball, fault, smash } or null.
     */
    tap(x, y) {
      if (!this.run || this.run.done) return null;

      const r = this.run;
      const tapAnywhere = !!(r.config.canvas && r.config.canvas.tapAnywhere);
      const hitTolerance = requiredNumber(r.config.canvas && r.config.canvas.hitTolerancePx, "KR_CONFIG.canvas.hitTolerancePx", { min: 0 });

      // Find closest tappable ball
      let bestBall = null;
      let bestDist = Infinity;

      for (const b of r.balls) {
        if (b.state !== "FALLING" && b.state !== "LANDED" && b.state !== "BOUNCING") continue;

        if (tapAnywhere) {
          // In tap-anywhere mode, find the most urgent ball (closest to expiring)
          // Priority: BOUNCING > LANDED > FALLING (closest to landing)
          var urgency;
          if (b.state === "BOUNCING") urgency = 0;
          else if (b.state === "LANDED") urgency = 1;
          else urgency = 2 + (1 - b.y / (b.landingY || 1));

          if (urgency < bestDist) {
            bestDist = urgency;
            bestBall = b;
          }
        } else {
          const dx = b.x - x;
          const dy = b.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= b.radius + hitTolerance && dist < bestDist) {
            bestDist = dist;
            bestBall = b;
          }
        }
      }

      if (!bestBall) return null;

      const b = bestBall;

      // Determine outcome
      if (b.inKitchen && b.state !== "BOUNCING") {
        // Fault: tapped Kitchen ball before bounce
        b.state = "FAULTED";
        b.faultedAt = gameTime();
        r.totalFaulted++;
        r.currentStreak = 0; // C9: streak broken on fault

        if (r.mode === MODES.RUN) {
          this._loseLife(r);
        } else if (r.mode === MODES.SPRINT) {
          // Sprint: accumulate penalty (applied by update() next frame)
          const penalty = Math.floor(requiredNumber(r.config.sprint && r.config.sprint.faultPenaltyMs, "KR_CONFIG.sprint.faultPenaltyMs", { min: 1 }));
          r.penaltyAccumulatedMs += penalty;

          // Immediate end check (penalty may exceed remaining time)
          var remaining = r.sprintDurationMs - r.elapsedMs - r.penaltyAccumulatedMs;
          if (remaining <= 0) {
            r.sprintRemainingMs = 0;
            r.done = true;
            r.endReason = "TIMER";
          }
        }

        return { hit: true, ball: b, fault: true, smash: false };
      }

      // Valid smash
      // Note: smashes = player-visible score; totalSmashed = internal counter.
      // Currently identical. Will diverge if score multipliers are added.
      b.state = "SMASHED";
      b.smashedAt = gameTime();
      b.smashOutAngle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8; // mostly upward
      r.smashes++;
      r.totalSmashed++;
      r.currentStreak++;
      if (r.currentStreak > r.bestStreak) r.bestStreak = r.currentStreak;

      // Check milestones
      for (var mi = 0; mi < r.milestones.length; mi++) {
        if (r.smashes === r.milestones[mi] && r.milestonesReached.indexOf(r.milestones[mi]) === -1) {
          r.milestonesReached.push(r.milestones[mi]);
          r.lastMilestoneAt = gameTime();
        }
      }

      return { hit: true, ball: b, fault: false, smash: true };
    }


    /**
     * Lose a life (RUN mode only).
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
     * Get current state snapshot (read-only, safe for UI).
     */
    getState() {
      if (!this.run) {
        return {
          mode: "NONE",
          done: true,
          smashes: 0,
          lives: null,
          maxLives: null,
          sprintRemainingMs: null,
          balls: [],
          elapsedMs: 0,
          endReason: null
        };
      }

      const r = this.run;
      return {
        mode: r.mode,
        done: !!r.done,
        smashes: r.smashes,
        lives: r.lives,
        maxLives: r.maxLives,
        sprintRemainingMs: r.sprintRemainingMs,
        sprintDurationMs: r.sprintDurationMs,
        balls: r.balls.map((b) => ({
          id: b.id,
          x: b.x,
          y: b.y,
          radius: b.radius,
          inKitchen: b.inKitchen,
          ballType: b.ballType || "normal",
          state: b.state,
          landingY: b.landingY,
          isFirstKitchen: !!b.isFirstKitchen,
          bouncedAt: b.bouncedAt || 0,
          landedAt: b.landedAt || 0,
          smashedAt: b.smashedAt || 0,
          faultedAt: b.faultedAt || 0,
          missedAt: b.missedAt || 0,
          smashOutAngle: b.smashOutAngle || 0,
          trail: b.trail ? b.trail.slice() : []
        })),
        elapsedMs: r.elapsedMs,
        endReason: r.endReason,
        totalSpawned: r.totalSpawned,
        totalSmashed: r.totalSmashed,
        totalMissed: r.totalMissed,
        totalFaulted: r.totalFaulted,
        currentStreak: r.currentStreak || 0,
        bestStreak: r.bestStreak || 0,
        milestonesReached: r.milestonesReached ? r.milestonesReached.slice() : [],
        lastMilestoneAt: r.lastMilestoneAt || 0,
        lastBounceAt: r.lastBounceAt || 0
      };
    }


    /**
     * Get end-of-run result (for storage.recordRunComplete / recordSprintComplete).
     */
    getResult() {
      const s = this.getState();
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
    GameEngine
  };
})();
