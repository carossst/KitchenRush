// game.js v1.0 - Kitchen Rush
// Canvas game engine — real-time ball-smashing arcade.
// Zero DOM access, zero localStorage.
// Kitchen Rush

(() => {
  "use strict";

  // ============================================
  // Helpers
  // ============================================
  // Game modes (from KR_ENUMS, fail-closed to literals if unavailable)
  var MODES = (window.KR_ENUMS && window.KR_ENUMS.GAME_MODES) || { RUN: "RUN", SPRINT: "SPRINT" };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function now() {
    return performance.now();
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
      var unlock = Number(t.unlockAfterSec) || 0;
      if (elapsedSec >= unlock) {
        var w = Number(t.weight) || 0;
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
    var speedMul = (typeConfig && Number(typeConfig.speedMultiplier)) || 1;
    var tapMul = (typeConfig && Number(typeConfig.tapWindowMultiplier)) || 1;
    var radiusMul = (typeConfig && Number(typeConfig.radiusMultiplier)) || 1;
    var forceKitchen = !!(typeConfig && typeConfig.forceKitchen);

    // Kitchen line Y (fraction of canvas height)
    const kitchenLineYFrac = Number(canvasCfg.kitchenLineY) || 0.65;
    const kitchenLineY = kitchenLineYFrac * canvasH;

    // Kitchen ratio at current time
    const kr = cfg.kitchenRatio || {};
    const kitchenRatio = clamp(
      (Number(kr.base) || 0.3) + (Number(kr.growthPerSec) || 0.01) * elapsedSec,
      0, Number(kr.max) || 0.7
    );

    // Decide if ball lands in Kitchen
    const inKitchen = forceKitchen || (rand() < kitchenRatio);

    // Ball radius (V2: type modifier)
    const radius = Math.round((Number(canvasCfg.ballRadius) || 12) * radiusMul);

    // Random X position (avoid edges)
    const margin = radius * 2;
    const x = margin + rand() * (canvasW - margin * 2);

    // Speed at current time (V2: type modifier)
    const spd = cfg.speed || {};
    const speed = ((Number(spd.base) || 2.2) + (Number(spd.accelPerSec) || 0.04) * elapsedSec) * speedMul;

    // Tap window at current time (V2: type modifier)
    const win = cfg.window || {};
    const tapWindowMs = Math.max(
      Number(win.minMs) || 80,
      ((Number(win.initialMs) || 140) - (Number(win.decayPerSec) || 1.2) * elapsedSec) * tapMul
    );

    // Landing Y: if inKitchen, land between kitchenLineY and bottom; else above kitchenLineY
    const landingY = inKitchen
      ? kitchenLineY + rand() * (canvasH - kitchenLineY - radius)
      : radius + rand() * (kitchenLineY - radius * 2);

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
      missedAt: 0
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
      const canvasW = Number(p.canvasW) || 360;
      const canvasH = Number(p.canvasH) || 640;

      // Mode
      const modeRaw = String(p.mode || "").trim().toUpperCase();
      const VALID_MODES = [MODES.RUN, MODES.SPRINT];
      let mode = MODES.RUN;

      if (modeRaw && VALID_MODES.includes(modeRaw)) {
        mode = modeRaw;
      } else if (modeRaw) {
        if (window.Logger && window.Logger.error) {
          window.Logger.error(`Invalid game mode "${modeRaw}". Falling back to RUN.`);
        }
      }

      // Lives (RUN only; SPRINT has no lives)
      const livesCfg = Number(config.game && config.game.lives);
      const lives = (mode === MODES.RUN && Number.isFinite(livesCfg) && livesCfg > 0)
        ? Math.floor(livesCfg)
        : null;

      // Sprint timer
      const sprintDurationMs = (mode === MODES.SPRINT)
        ? (Number(config.sprint && config.sprint.durationMs) || 20000)
        : null;

      // Onboarding shield (first N balls always outside Kitchen)
      const onboardingShield = Number(config.game && config.game.onboardingShield) || 0;

      this.run = {
        mode: mode,
        config: config,
        canvasW: canvasW,
        canvasH: canvasH,

        // V2: Seeded RNG for daily mode (null = use Math.random)
        rng: (config.daily && config.daily.enabled && mode === MODES.RUN) ? mulberry32(dateSeed()) : null,

        // Timing
        startedAt: now(),
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
      const reboundDelayMs = Number(gameCfg.reboundDelayMs) || 150;

      // Update existing balls
      for (let i = r.balls.length - 1; i >= 0; i--) {
        const b = r.balls[i];

        if (b.state === "FALLING") {
          b.y += b.speed * (dtMs / 16.67); // normalize to ~60fps baseline

          if (b.y >= b.landingY) {
            b.y = b.landingY;
            b.state = "LANDED";
            b.landedAt = now();
          }
        }

        if (b.state === "LANDED") {
          // After rebound delay, transition to BOUNCING (Kitchen balls become smashable)
          if (b.inKitchen && (now() - b.landedAt >= reboundDelayMs)) {
            b.state = "BOUNCING";
            b.bouncedAt = now();
            r.lastBounceAt = now();
          }

          // Non-kitchen balls: tap window expires → MISSED
          if (!b.inKitchen && (now() - b.landedAt > b.tapWindowMs)) {
            b.state = "MISSED";
            b.missedAt = now();
            r.totalMissed++;
            this._loseLife(r);
          }
        }

        if (b.state === "BOUNCING") {
          // Kitchen ball: tap window after bounce
          if (now() - b.bouncedAt > b.tapWindowMs) {
            b.state = "MISSED";
            b.missedAt = now();
            r.totalMissed++;
            this._loseLife(r);
          }
        }

        // Cleanup old resolved balls (keep for fade-out animation, 500ms)
        if ((b.state === "SMASHED" || b.state === "MISSED" || b.state === "FAULTED") &&
            (now() - (b.smashedAt || b.missedAt || b.faultedAt || 0)) > 500) {
          r.balls.splice(i, 1);
        }
      }

      // Spawn new balls
      const spawnCfg = gameCfg.spawn || {};
      const spawnInterval = Math.max(
        Number(spawnCfg.minMs) || 400,
        (Number(spawnCfg.initialMs) || 1200) - (Number(spawnCfg.decayPerSec) || 12) * elapsedSec
      );

      if (r.elapsedMs - r.lastSpawnAt >= spawnInterval) {
        r.lastSpawnAt = r.elapsedMs;

        const ball = createBall(cfg, elapsedSec, r.canvasW, r.canvasH, r.rng);

        // Onboarding shield: force non-Kitchen for first N balls
        if (r.totalSpawned < r.onboardingShield) {
          ball.inKitchen = false;
          // Recalculate landing Y for non-kitchen
          const canvasCfg = cfg.canvas || {};
          const kitchenLineYFrac = Number(canvasCfg.kitchenLineY) || 0.65;
          const kitchenLineY = kitchenLineYFrac * r.canvasH;
          var shieldRand = (typeof r.rng === "function") ? r.rng : Math.random;
          ball.landingY = ball.radius + shieldRand() * (kitchenLineY - ball.radius * 2);
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
      const hitTolerance = Number(r.config.canvas && r.config.canvas.hitTolerancePx) || 30;

      // Find closest tappable ball
      let bestBall = null;
      let bestDist = Infinity;

      for (const b of r.balls) {
        if (b.state !== "FALLING" && b.state !== "LANDED" && b.state !== "BOUNCING") continue;

        const dx = b.x - x;
        const dy = b.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= b.radius + hitTolerance && dist < bestDist) {
          bestDist = dist;
          bestBall = b;
        }
      }

      if (!bestBall) return null;

      const b = bestBall;

      // Determine outcome
      if (b.inKitchen && b.state !== "BOUNCING") {
        // Fault: tapped Kitchen ball before bounce
        b.state = "FAULTED";
        b.faultedAt = now();
        r.totalFaulted++;

        if (r.mode === MODES.RUN) {
          this._loseLife(r);
        } else if (r.mode === MODES.SPRINT) {
          // Sprint: accumulate penalty (applied by update() next frame)
          const penalty = Number(r.config.sprint && r.config.sprint.faultPenaltyMs) || 2000;
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
      b.smashedAt = now();
      r.smashes++;
      r.totalSmashed++;

      // Check milestones
      for (var mi = 0; mi < r.milestones.length; mi++) {
        if (r.smashes === r.milestones[mi] && r.milestonesReached.indexOf(r.milestones[mi]) === -1) {
          r.milestonesReached.push(r.milestones[mi]);
          r.lastMilestoneAt = now();
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
          bouncedAt: b.bouncedAt || 0
        })),
        elapsedMs: r.elapsedMs,
        endReason: r.endReason,
        totalSpawned: r.totalSpawned,
        totalSmashed: r.totalSmashed,
        totalMissed: r.totalMissed,
        totalFaulted: r.totalFaulted,
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
        totalFaulted: s.totalFaulted
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
