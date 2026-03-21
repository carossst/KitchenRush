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
  function centeredRand(rand) { return (rand() + rand()) / 2; }

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

  function getUtcDateParts(date) {
    var d = (date instanceof Date) ? date : new Date();
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate()
    };
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function getDailyKeyUtc(date) {
    var parts = getUtcDateParts(date);
    return parts.year + "-" + pad2(parts.month) + "-" + pad2(parts.day);
  }

  function hashString32(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h;
  }

  function dateSeed() {
    return hashString32(getDailyKeyUtc());
  }

  function utcDaySerial(date) {
    var parts = getUtcDateParts(date);
    return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
  }

  function getTimingConfig(config) {
    var timing = (config && config.game && config.game.timing) ? config.game.timing : {};
    return {
      niceThreshold: reqNum(timing.niceThreshold, "game.timing.niceThreshold", { min: 0, max: 1 }),
      perfectThreshold: reqNum(timing.perfectThreshold, "game.timing.perfectThreshold", { min: 0, max: 1 }),
      sweetSpot: reqNum(timing.sweetSpot, "game.timing.sweetSpot", { min: 0, max: 1 }),
      falloffWindow: reqNum(timing.falloffWindow, "game.timing.falloffWindow", { min: 0.01, max: 1 }),
      autoHitGraceFrac: reqNum(timing.autoHitGraceFrac, "game.timing.autoHitGraceFrac", { min: 0, max: 1 }),
      minBounceVisibleMs: reqNum(timing.minBounceVisibleMs, "game.timing.minBounceVisibleMs", { min: 0, integer: true }),
      basePoints: reqNum(timing.basePoints, "game.timing.basePoints", { min: 1, integer: true }),
      perfectPoints: reqNum(timing.perfectPoints, "game.timing.perfectPoints", { min: 1, integer: true })
    };
  }

  // Game-time clock
  var _gt = 0;
  function gameTime() { return _gt; }


  // ============================================
  // Ball states
  // ============================================
  var BALL_STATES = {
    TRAVELING: "TRAVELING",
    LANDED: "LANDED",
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
    var day = utcDaySerial();
    return DAILY_MODIFIERS[((day % DAILY_MODIFIERS.length) + DAILY_MODIFIERS.length) % DAILY_MODIFIERS.length];
  }


  // ============================================
  // Court layout
  // ============================================
  function getCourtLayout(config) {
    var c = config.court || {};
    return {
      netY: reqNum(c.netY, "court.netY", { min: 0.05, max: 0.3 }),
      kitchenLineY: reqNum(c.kitchenLineY, "court.kitchenLineY", { min: 0.2, max: 0.6 }),
      baselineY: reqNum(c.baselineY, "court.baselineY", { min: 0.5, max: 0.99 }),
      playerY: reqNum(c.playerY, "court.playerY", { min: 0.5, max: 0.9 }),
      opponentY: reqNum(c.opponentY, "court.opponentY", { min: 0.02, max: 0.2 }),
      controlsY: reqNum(c.controlsY, "court.controlsY", { min: 0.8, max: 1.0 })
    };
  }

  function getTrajectoryConfig(config) {
    var t = (config.game && config.game.trajectory) || {};
    return {
      lateralSpreadFrac: reqNum(t.lateralSpreadFrac, "game.trajectory.lateralSpreadFrac", { min: 0, max: 1 }),
      edgeMarginFrac: reqNum(t.edgeMarginFrac, "game.trajectory.edgeMarginFrac", { min: 0, max: 0.5 }),
      arcMinFrac: reqNum(t.arcMinFrac, "game.trajectory.arcMinFrac", { min: 0.001, max: 1 }),
      arcMaxFrac: reqNum(t.arcMaxFrac, "game.trajectory.arcMaxFrac", { min: 0.001, max: 1 }),
      arcDepthWeight: reqNum(t.arcDepthWeight, "game.trajectory.arcDepthWeight", { min: 0, max: 1 }),
      descentPower: reqNum(t.descentPower, "game.trajectory.descentPower", { min: 0.1, max: 4 }),
      returnArcScale: reqNum(t.returnArcScale, "game.trajectory.returnArcScale", { min: 0.1, max: 2 }),
      returnTravelScale: reqNum(t.returnTravelScale, "game.trajectory.returnTravelScale", { min: 0.1, max: 2 })
    };
  }

  function getFlightArcHeight(startX, startY, targetX, targetY, canvasH, trajectory, ballType) {
    var flightDist = dist(startX, startY, targetX, targetY);
    var distanceRatio = clamp(flightDist / (canvasH * 0.95), 0, 1);
    var depthRatio = clamp((targetY - startY) / (canvasH * 0.8), 0, 1);
    var arcMix = lerp(distanceRatio, depthRatio, trajectory.arcDepthWeight);
    var arcHeight = lerp(canvasH * trajectory.arcMinFrac, canvasH * trajectory.arcMaxFrac, arcMix);

    if (ballType === "lob") return arcHeight * 1.35;
    if (ballType === "dink") return arcHeight * 0.78;
    if (ballType === "fast") return arcHeight * 0.88;
    if (ballType === "skid") return arcHeight * 0.62;
    if (ballType === "heavy") return arcHeight * 0.8;
    return arcHeight;
  }

  function getServiceConfig(config) {
    var s = (config && config.game && config.game.service) ? config.game.service : {};
    return {
      centerMarginFrac: reqNum(s.centerMarginFrac, "game.service.centerMarginFrac", { min: 0, max: 0.5 }),
      sidelineMarginFrac: reqNum(s.sidelineMarginFrac, "game.service.sidelineMarginFrac", { min: 0, max: 0.5 }),
      depthMinFrac: reqNum(s.depthMinFrac, "game.service.depthMinFrac", { min: 0, max: 1 }),
      depthMaxFrac: reqNum(s.depthMaxFrac, "game.service.depthMaxFrac", { min: 0, max: 1 })
    };
  }

  function getPowerUpConfig(config) {
    var pu = (config && config.game && config.game.powerUps) ? config.game.powerUps : null;
    if (!pu || typeof pu !== "object") return null;
    return pu;
  }

  function getPowerUpKeys(config) {
    var pu = getPowerUpConfig(config);
    if (!pu) return [];
    return ["extraLife", "shield", "speedBoost", "perfectWindow", "smashBoost"].filter(function (key) {
      return pu[key] && pu[key].enabled === true;
    });
  }

  function normalizeProgressionMeta(raw) {
    var p = (raw && typeof raw === "object") ? raw : {};
    return {
      runCompletes: Math.max(0, Math.floor(Number(p.runCompletes || 0))),
      bestScore: Math.max(0, Math.floor(Number(p.bestScore || 0))),
      lifetimeSmashes: Math.max(0, Math.floor(Number(p.lifetimeSmashes || 0))),
      featuredPowerKey: String(p.featuredPowerKey || "").trim()
    };
  }

  function getPowerUpSlotsUnlocked(powerCfg, runScore) {
    var progression = powerCfg && powerCfg.progression;
    if (!progression) return 0;
    var score = Math.max(0, Math.floor(Number(runScore || 0)));
    var firstUnlock = reqNum(progression.firstUnlockScore, "game.powerUps.progression.firstUnlockScore", { min: 0, integer: true });
    var every = reqNum(progression.unlockEveryScore, "game.powerUps.progression.unlockEveryScore", { min: 1, integer: true });
    if (score < firstUnlock) return 0;
    return 1 + Math.floor((score - firstUnlock) / every);
  }

  function isPowerUpMetaUnlocked(item, meta) {
    if (!item || item.enabled !== true) return false;
    if ((item.requireRunCompletes != null) && meta.runCompletes < reqNum(item.requireRunCompletes, "powerUp.requireRunCompletes", { min: 0, integer: true })) return false;
    if ((item.requireBestScore != null) && meta.bestScore < reqNum(item.requireBestScore, "powerUp.requireBestScore", { min: 0, integer: true })) return false;
    if ((item.requireLifetimeSmashes != null) && meta.lifetimeSmashes < reqNum(item.requireLifetimeSmashes, "powerUp.requireLifetimeSmashes", { min: 0, integer: true })) return false;
    return true;
  }

  function getEligiblePowerUpKeys(config, meta, runScore) {
    var pu = getPowerUpConfig(config);
    if (!pu || pu.enabled !== true) return [];
    var score = Math.max(0, Math.floor(Number(runScore || 0)));
    var keys = getPowerUpKeys(config).filter(function (key) {
      var item = pu[key];
      return isPowerUpMetaUnlocked(item, meta) &&
        score >= reqNum(item.unlockAfterScore, "game.powerUps." + key + ".unlockAfterScore", { min: 0, integer: true });
    });
    keys.sort(function (a, b) {
      return reqNum(pu[a].unlockAfterScore, "game.powerUps." + a + ".unlockAfterScore", { min: 0, integer: true }) -
        reqNum(pu[b].unlockAfterScore, "game.powerUps." + b + ".unlockAfterScore", { min: 0, integer: true });
    });
    return keys.slice(0, getPowerUpSlotsUnlocked(pu, score));
  }

  function getTimedPowerRemainingMs(activeItem, nowMs) {
    if (!activeItem || !Number.isFinite(activeItem.until) || activeItem.until <= 0) return 0;
    return Math.max(0, activeItem.until - nowMs);
  }

  function retargetBallAsDiagonalServe(ball, config, canvasW, canvasH, court, rng) {
    var rand = (typeof rng === "function") ? rng : Math.random;
    var serviceCfg = getServiceConfig(config);
    var centerX = canvasW * 0.5;
    var sidelineMargin = canvasW * serviceCfg.sidelineMarginFrac;
    var centerMargin = canvasW * serviceCfg.centerMarginFrac;
    var serveToRight = ball.startX < centerX;
    var xMin = serveToRight ? (centerX + centerMargin) : sidelineMargin;
    var xMax = serveToRight ? (canvasW - sidelineMargin) : (centerX - centerMargin);
    var netYpx = court.netY * canvasH;
    var kitchenLineYpx = court.kitchenLineY * canvasH;
    var baselineYpx = court.baselineY * canvasH;
    var serviceDepth = Math.max(0, baselineYpx - kitchenLineYpx);
    var depthMin = kitchenLineYpx + serviceDepth * serviceCfg.depthMinFrac;
    var depthMax = kitchenLineYpx + serviceDepth * serviceCfg.depthMaxFrac;
    ball.inKitchen = false;
    ball.targetX = lerp(xMin, xMax, centeredRand(rand));
    ball.targetY = lerp(depthMin, depthMax, centeredRand(rand));
    ball.shadowY = ball.targetY;
    ball.arcHeight = getFlightArcHeight(
      ball.startX,
      netYpx * 0.55,
      ball.targetX,
      ball.targetY,
      canvasH,
      getTrajectoryConfig(config),
      ball.ballType
    );
    ball.isServe = true;
    ball.serveToRight = serveToRight;
  }


  // ============================================
  // Ball factory
  // ============================================
  var _nextBallId = 0;

  function createBallFromOpponent(config, elapsedSec, currentScore, canvasW, canvasH, court, playerX, playerY, rng, modifier) {
    var rand = (typeof rng === "function") ? rng : Math.random;
    var gameCfg = config.game || {};
    var trajectoryCfg = getTrajectoryConfig(config);

    // Ball type selection (modifier can force a type)
    var ballType;
    if (modifier && modifier.forceBallType) {
      ballType = modifier.forceBallType;
    } else {
      ballType = pickBallType(config, elapsedSec, currentScore, rng);
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
    var opX = canvasW * 0.2 + centeredRand(rand) * canvasW * 0.6;

    // Target X: spread modifier
    var spreadBase = canvasW * trajectoryCfg.lateralSpreadFrac;
    if (modifier && modifier.spreadMul) spreadBase *= modifier.spreadMul;
    var edgeMargin = canvasW * trajectoryCfg.edgeMarginFrac;
    var targetX = clamp(
      playerX + (centeredRand(rand) - 0.5) * spreadBase * 2,
      edgeMargin,
      canvasW - edgeMargin
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
      var kitchenBand = kitchenLineYpx - netYpx;
      targetY = netYpx + kitchenBand * (0.18 + centeredRand(rand) * 0.64);
    } else {
      var nonKitchenDepthMin = kitchenLineYpx + (baselineYpx - kitchenLineYpx) *
        reqNum(config.canvas.minLandingYFrac, "canvas.minLandingYFrac", { min: 0, max: 0.99 });
      var nonKitchenDepthMax = baselineYpx - 12;
      targetY = nonKitchenDepthMin + centeredRand(rand) * Math.max(0, nonKitchenDepthMax - nonKitchenDepthMin);
    }

    var startX = opX;
    var startY = court.opponentY * canvasH;

    var arcHeight = getFlightArcHeight(startX, startY, targetX, targetY, canvasH, trajectoryCfg, ballType);
    if (typeConfig && typeConfig.arcHeightMultiplier != null) {
      arcHeight *= reqNum(typeConfig.arcHeightMultiplier, "ballType.arcHeightMultiplier", { min: 0.1, max: 3 });
    }

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
      descentPower: trajectoryCfg.descentPower,
      travelMs: travelMs,
      x: startX, y: startY,
      state: BALL_STATES.TRAVELING,
      spawnedAt: gameTime(),
      landedAt: 0, bouncedAt: 0, hitAt: 0, missedAt: 0, faultedAt: 0,
      tapWindowMs: tapWindowMs,
      reboundDelayMs: Math.floor(
        reqNum(gameCfg.reboundDelayMs, "game.reboundDelayMs", { min: 1 }) *
        (typeConfig && typeConfig.reboundDelayMultiplier != null
          ? reqNum(typeConfig.reboundDelayMultiplier, "ballType.reboundDelayMultiplier", { min: 0.05, max: 3 })
          : 1)
      ),
      bounceHeightPx: reqNum(config.canvas.bounceHeight, "canvas.bounceHeight", { min: 0 }) * canvasH *
        (typeConfig && typeConfig.bounceHeightMultiplier != null
          ? reqNum(typeConfig.bounceHeightMultiplier, "ballType.bounceHeightMultiplier", { min: 0.05, max: 3 })
          : 1),
      bounceAnimMs: Math.floor(reqNum(config.canvas.bounceAnimMs, "canvas.bounceAnimMs", { min: 1 })),
      bounceSecondHopScale: reqNum(config.canvas.bounceSecondHopScale, "canvas.bounceSecondHopScale", { min: 0, max: 1 }),
      returnStartX: 0, returnStartY: 0,
      returnTargetX: 0, returnTargetY: 0,
      returnArcHeight: 0, returnTravelMs: 0,
      speed: speed,
      shadowY: targetY,
      isServe: false,
      serveToRight: false,
      // Auto-hit: did auto-hit already fire?
      autoHitFired: false,
      // Timing bonus: how close to optimal timing the player hit (0-1, 1=perfect)
      timingBonus: 0
    };
  }


  // ============================================
  // Ball type selection
  // ============================================
  function pickBallType(config, elapsedSec, currentScore, rng) {
    var types = config.game && config.game.ballTypes;
    if (!types || typeof types !== "object") return "normal";
    var rand = (typeof rng === "function") ? rng : Math.random;
    var score = Math.max(0, Math.floor(Number(currentScore || 0)));
    var candidates = [];
    var totalWeight = 1;
    for (var key in types) {
      if (!types.hasOwnProperty(key)) continue;
      var t = types[key];
      if (!t || typeof t !== "object") continue;
      var unlock = reqNum(t.unlockAfterSec, "ballType." + key + ".unlock", { min: 0 });
      var unlockScore = (t.unlockAfterScore != null)
        ? reqNum(t.unlockAfterScore, "ballType." + key + ".unlockAfterScore", { min: 0, integer: true })
        : 0;
      if (elapsedSec >= unlock && score >= unlockScore) {
        var w = reqNum(t.weight, "ballType." + key + ".weight", { min: 0 });
        if (t.weightGrowthPerSec != null) {
          w += Math.max(0, elapsedSec - unlock) * reqNum(t.weightGrowthPerSec, "ballType." + key + ".weightGrowthPerSec", { min: 0 });
        }
        if (t.weightGrowthPerScore != null) {
          w += Math.max(0, score - unlockScore) * reqNum(t.weightGrowthPerScore, "ballType." + key + ".weightGrowthPerScore", { min: 0 });
        }
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
      var yT = Math.pow(t, Number.isFinite(ball.descentPower) ? ball.descentPower : 1);
      var yLinear = lerp(ball.startY, ball.targetY, yT);
      var arc = -ball.arcHeight * 4 * t * (1 - t);
      return { x: x, y: yLinear + arc, t: t };
    }

    if (ball.state === BALL_STATES.LANDED) {
      return { x: ball.targetX, y: ball.targetY, t: 1, squash: 1 };
    }

    if (ball.state === BALL_STATES.BOUNCED) {
      var sinceBounce = gt - ball.bouncedAt;
      var bounceAnim = 0;
      var primaryAnimMs = ball.bounceAnimMs || 250;
      var secondaryAnimMs = Math.max(1, Math.round(primaryAnimMs * 0.6));
      var bounceHeight = Number.isFinite(ball.bounceHeightPx) ? ball.bounceHeightPx : 40;
      var secondHopScale = Number.isFinite(ball.bounceSecondHopScale) ? ball.bounceSecondHopScale : 0.22;
      // Primary hop
      if (sinceBounce < primaryAnimMs) {
        var bt = sinceBounce / primaryAnimMs;
        bounceAnim = -bounceHeight * Math.sin(bt * Math.PI);
      }
      // Secondary smaller hop
      else if (sinceBounce < primaryAnimMs + secondaryAnimMs) {
        var bt2 = (sinceBounce - primaryAnimMs) / secondaryAnimMs;
        bounceAnim = -(bounceHeight * secondHopScale) * Math.sin(bt2 * Math.PI);
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
      var progressionMeta = normalizeProgressionMeta(p.progression);

      _gt = 0;

      this.run = {
        mode: mode,
        config: config,
        court: court,
        canvasW: canvasW,
        canvasH: canvasH,
        isDaily: isDaily,
        modifier: modifier,
        progressionMeta: progressionMeta,

        rng: isDaily ? mulberry32(dateSeed()) : null,

        elapsedMs: 0,
        lastSpawnAt: -9999,

        // V3: Player 2D position
        playerX: canvasW / 2,
        playerY: court.playerY * canvasH,
        playerMinY: court.netY * canvasH + 10,
        playerMaxY: court.baselineY * canvasH + 30, // can go slightly behind baseline
        playerState: "idle",
        playerSwingUntil: 0,

        opponentX: canvasW / 2,
        opponentTargetX: canvasW / 2,
        opponentState: "idle",
        opponentSwingUntil: 0,
        opponentBounceAt: 0,
        opponentBounceUntil: 0,
        opponentBounceX: 0,

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
        doubleBouncePhase: 0,
        totalRallies: 0,

        totalSpawned: 0,
        totalSmashed: 0,
        totalMissed: 0,
        totalFaulted: 0,
        onboardingShield: onboardingShield,
        powerUpsActivated: {},
        activePowerUps: {},
        lastPowerUpEvent: null,
        lastPowerUpEventUntil: 0,

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
      this._tickPowerUps(r);

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
      var playerSpeed = this._getEffectiveMoveSpeed(r);
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
      if (r.opponentState === "swing" && gameTime() > r.opponentSwingUntil) {
        r.opponentState = "idle";
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
        if (r.opponentBounceUntil > 0) {
          if (r.elapsedMs >= r.opponentBounceUntil) {
            r.opponentBounceAt = 0;
            r.opponentBounceUntil = 0;
            if (r.doubleBouncePhase === 1) r.doubleBouncePhase = 2;
          } else {
            return this.getState();
          }
        }
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
          ball.state = BALL_STATES.LANDED;
          ball.landedAt = gameTime();
          ball.x = ball.targetX;
          ball.y = ball.targetY;
        }
      }

      if (ball.state === BALL_STATES.LANDED) {
        if (gameTime() - ball.landedAt >= ball.reboundDelayMs) {
          ball.state = BALL_STATES.BOUNCED;
          ball.bouncedAt = gameTime();
          ball.x = ball.targetX;
          ball.y = ball.targetY;
        }
      }

      if (ball.state === BALL_STATES.BOUNCED) {
        var effectiveTapWindowMs = this._getEffectiveTapWindowMs(r, ball);
        if (gameTime() - ball.bouncedAt > effectiveTapWindowMs) {
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
          r.doubleBouncePhase = 0;
        }
      }

      // ── V3: Auto-hit check (while ball is BOUNCED, before expiry) ──
      if (ball.state === BALL_STATES.BOUNCED && !ball.autoHitFired) {
        var autoRange = this._getAutoHitRange(r);
        var d2 = dist(r.playerX, r.playerY, ball.x, ball.y);
        if (d2 <= autoRange) {
          // Player is close enough — auto-hit fires
          var sinceBounce = gameTime() - ball.bouncedAt;
          var effectiveTapWindowMs2 = this._getEffectiveTapWindowMs(r, ball);
          var timingRatio = sinceBounce / effectiveTapWindowMs2; // 0=instant, 1=last moment

          // ── Explicit HIT input: timing bonus ──
          if (r.input.hit && !r.input.hitConsumed) {
            r.input.hit = false;
            r.input.hitConsumed = true;
            var timingCfg = getTimingConfig(r.config);
            var timingBonus = Math.max(0, 1 - Math.abs(timingRatio - timingCfg.sweetSpot) / timingCfg.falloffWindow);
            ball.autoHitFired = true;
            this._executeHit(r, ball, timingBonus);
            return this.getState();
          }

          // Auto-hit after short grace period (give player chance to time it)
          var timingCfg = getTimingConfig(r.config);
          var gracePeriodMs = Math.max(
            effectiveTapWindowMs2 * timingCfg.autoHitGraceFrac,
            reqNum(timingCfg.minBounceVisibleMs, "game.timing.minBounceVisibleMs", { min: 0 })
          );
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
          if (r.doubleBouncePhase === 1) {
            r.opponentBounceAt = gameTime();
            r.opponentBounceUntil = gameTime() + ball.reboundDelayMs;
            r.opponentBounceX = ball.returnTargetX;
          }
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

    _getEffectiveMoveSpeed(r) {
      var playerSpeed = reqNum(r.config.court.playerSpeed, "court.playerSpeed", { min: 0.1 });
      var speedBoost = r.activePowerUps && r.activePowerUps.speedBoost;
      if (speedBoost && getTimedPowerRemainingMs(speedBoost, r.elapsedMs) > 0) {
        return playerSpeed * reqNum(speedBoost.moveSpeedMultiplier, "activePowerUps.speedBoost.moveSpeedMultiplier", { min: 0.01 });
      }
      return playerSpeed;
    }

    _getEffectiveTapWindowMs(r, ball) {
      var base = reqNum(ball.tapWindowMs, "ball.tapWindowMs", { min: 1 });
      var perfectWindow = r.activePowerUps && r.activePowerUps.perfectWindow;
      if (perfectWindow && getTimedPowerRemainingMs(perfectWindow, r.elapsedMs) > 0) {
        return Math.max(1, Math.round(base * reqNum(perfectWindow.tapWindowMultiplier, "activePowerUps.perfectWindow.tapWindowMultiplier", { min: 0.01 })));
      }
      return base;
    }

    _countActivePowerUps(r) {
      var active = r.activePowerUps || {};
      var count = 0;
      Object.keys(active).forEach(function (key) {
        var item = active[key];
        if (!item) return;
        if (key === "shield") {
          if (reqNum(item.blocksRemaining || 0, "activePowerUps.shield.blocksRemaining", { min: 0, integer: true }) > 0) count += 1;
          return;
        }
        if (getTimedPowerRemainingMs(item, r.elapsedMs) > 0) count += 1;
      });
      return count;
    }

    _setPowerUpEvent(r, key) {
      r.lastPowerUpEvent = { key: key, at: r.elapsedMs };
      r.lastPowerUpEventUntil = r.elapsedMs + 1500;
    }

    _activatePowerUp(r, key) {
      var pu = getPowerUpConfig(r.config);
      if (!pu || !pu[key]) return false;
      var item = pu[key];
      r.powerUpsActivated[key] = (r.powerUpsActivated[key] || 0) + 1;
      if (key === "extraLife") {
        if (r.mode === MODES.RUN && r.lives != null) {
          r.lives += 1;
          r.maxLives += 1;
        }
      } else if (key === "shield") {
        r.activePowerUps.shield = {
          key: "shield",
          blocksRemaining: reqNum(item.blockCount, "game.powerUps.shield.blockCount", { min: 0, integer: true })
        };
      } else if (key === "speedBoost") {
        r.activePowerUps.speedBoost = {
          key: "speedBoost",
          until: r.elapsedMs + reqNum(item.durationMs, "game.powerUps.speedBoost.durationMs", { min: 0, integer: true }),
          moveSpeedMultiplier: reqNum(item.moveSpeedMultiplier, "game.powerUps.speedBoost.moveSpeedMultiplier", { min: 0.01 })
        };
      } else if (key === "perfectWindow") {
        r.activePowerUps.perfectWindow = {
          key: "perfectWindow",
          until: r.elapsedMs + reqNum(item.durationMs, "game.powerUps.perfectWindow.durationMs", { min: 0, integer: true }),
          tapWindowMultiplier: reqNum(item.tapWindowMultiplier, "game.powerUps.perfectWindow.tapWindowMultiplier", { min: 0.01 })
        };
      } else if (key === "smashBoost") {
        r.activePowerUps.smashBoost = {
          key: "smashBoost",
          until: r.elapsedMs + reqNum(item.durationMs, "game.powerUps.smashBoost.durationMs", { min: 0, integer: true }),
          scoreMultiplier: reqNum(item.scoreMultiplier, "game.powerUps.smashBoost.scoreMultiplier", { min: 1 })
        };
      }
      this._setPowerUpEvent(r, key);
      return true;
    }

    _maybeTriggerPowerUp(r, ball) {
      var pu = getPowerUpConfig(r.config);
      if (!pu || pu.enabled !== true || !ball) return;
      var eligibleKeys = getEligiblePowerUpKeys(r.config, r.progressionMeta, r.smashes);
      if (!eligibleKeys.length) return;

      var matching = [];
      for (var i = 0; i < eligibleKeys.length; i++) {
        var key = eligibleKeys[i];
        var item = pu[key];
        if (key !== "extraLife" &&
          this._countActivePowerUps(r) >= reqNum(pu.progression.maxActiveAtOnce, "game.powerUps.progression.maxActiveAtOnce", { min: 1, integer: true })) {
          continue;
        }
        if (item.triggerBallType && item.triggerBallType !== ball.ballType) continue;
        if (item.maxPerRun != null && (r.powerUpsActivated[key] || 0) >= reqNum(item.maxPerRun, "game.powerUps." + key + ".maxPerRun", { min: 0, integer: true })) continue;
        matching.push(key);
      }
      if (!matching.length) return;

      var featuredKey = String(r.progressionMeta && r.progressionMeta.featuredPowerKey || "").trim();
      var weeklyCfg = pu.weekly || {};
      var rand = (typeof r.rng === "function") ? r.rng : Math.random;
      for (var mi = 0; mi < matching.length; mi++) {
        var pickKey = matching[mi];
        var chance = reqNum(pu[pickKey].weight, "game.powerUps." + pickKey + ".weight", { min: 0 });
        if (weeklyCfg.enabled && featuredKey && featuredKey === pickKey) {
          chance *= reqNum(weeklyCfg.weightMultiplier, "game.powerUps.weekly.weightMultiplier", { min: 0 });
        }
        if (rand() < chance) {
          this._activatePowerUp(r, pickKey);
          return;
        }
      }
    }

    _tickPowerUps(r) {
      if (!r.activePowerUps) return;
      ["speedBoost", "perfectWindow", "smashBoost"].forEach(function (key) {
        if (!r.activePowerUps[key]) return;
        if (getTimedPowerRemainingMs(r.activePowerUps[key], r.elapsedMs) <= 0) delete r.activePowerUps[key];
      });
      if (r.lastPowerUpEventUntil > 0 && r.elapsedMs >= r.lastPowerUpEventUntil) {
        r.lastPowerUpEventUntil = 0;
      }
      if (r.activePowerUps.shield && reqNum(r.activePowerUps.shield.blocksRemaining || 0, "activePowerUps.shield.blocksRemaining", { min: 0, integer: true }) <= 0) {
        delete r.activePowerUps.shield;
      }
    }

    // V3: Execute a valid hit (shared between auto-hit and explicit hit)
    _executeHit(r, ball, timingBonus) {
      var court = r.court;

      // Double bounce rule check
      var mustBounce = !!ball.mustBounce;
      if (mustBounce && ball.state !== BALL_STATES.BOUNCED) {
        // Should not happen in auto-hit (only fires on BOUNCED), but safety check
        this._faultBall(r, ball);
        return;
      }

      ball.state = BALL_STATES.HIT;
      ball.hitAt = gameTime();
      ball.timingBonus = timingBonus;

      var timingCfg = getTimingConfig(r.config);
      var points = timingCfg.basePoints;
      if (timingBonus > timingCfg.perfectThreshold) points = timingCfg.perfectPoints;
      var smashBoost = r.activePowerUps && r.activePowerUps.smashBoost;
      if (smashBoost && getTimedPowerRemainingMs(smashBoost, r.elapsedMs) > 0) {
        points = Math.round(points * reqNum(smashBoost.scoreMultiplier, "activePowerUps.smashBoost.scoreMultiplier", { min: 1 }));
      }
      r.smashes += points;
      r.totalSmashed++;
      r.currentStreak++;
      if (r.currentStreak > r.bestStreak) r.bestStreak = r.currentStreak;
      r.rallyCount++;
      if (r.doubleBouncePhase === 0) r.doubleBouncePhase = 1;
      r.lastTimingBonus = timingBonus;

      r.playerState = "swing";
      r.playerSwingUntil = gameTime() + 250;

      // Return trajectory
      var rand = (typeof r.rng === "function") ? r.rng : Math.random;
      var trajectoryCfg = getTrajectoryConfig(r.config);
      var returnEdgeMargin = r.canvasW * trajectoryCfg.edgeMarginFrac;
      ball.returnStartX = ball.x;
      ball.returnStartY = ball.y;
      ball.returnTargetX = returnEdgeMargin + centeredRand(rand) * (r.canvasW - returnEdgeMargin * 2);
      ball.returnTargetY = court.opponentY * r.canvasH;
      ball.returnArcHeight = getFlightArcHeight(
        ball.returnStartX, ball.returnStartY,
        ball.returnTargetX, ball.returnTargetY,
        r.canvasH, trajectoryCfg, ball.ballType
      ) * trajectoryCfg.returnArcScale;
      ball.returnTravelMs = Math.max(250, ball.travelMs * trajectoryCfg.returnTravelScale);

      // Milestones
      for (var mi = 0; mi < r.milestones.length; mi++) {
        if (r.smashes >= r.milestones[mi] && r.milestonesReached.indexOf(r.milestones[mi]) === -1) {
          r.milestonesReached.push(r.milestones[mi]);
          r.lastMilestoneAt = gameTime();
        }
      }
      this._maybeTriggerPowerUp(r, ball);
    }


    // V3: Try volley (hit ball before bounce — only valid after double bounce rule satisfied)
    _tryVolley(r, ball) {
      var hitRange = reqNum(r.config.court.hitRange, "court.hitRange", { min: 1 });

      var d = dist(r.playerX, r.playerY, ball.x, ball.y);
      if (d > hitRange * 1.2) {
        // Too far — whiff
        r.playerState = "swing";
        r.playerSwingUntil = gameTime() + 200;
        return;
      }

      // Volley stays illegal while this incoming ball still must bounce.
      var mustBounce = !!ball.mustBounce;
      if (mustBounce) {
        this._faultBall(r, ball);
        return;
      }

      // Valid volley! High skill shot — big timing bonus
      this._executeHit(r, ball, 1.0); // perfect bonus for successful volley
    }


    // Fault a ball
    _faultBall(r, ball) {
      if (r.mode === MODES.RUN && r.activePowerUps && r.activePowerUps.shield &&
        reqNum(r.activePowerUps.shield.blocksRemaining || 0, "activePowerUps.shield.blocksRemaining", { min: 0, integer: true }) > 0) {
        r.activePowerUps.shield.blocksRemaining -= 1;
        ball.state = BALL_STATES.FAULTED;
        ball.faultedAt = gameTime();
        ball.savedByShield = true;
        r.waitUntil = r.elapsedMs + 320;
        this._setPowerUpEvent(r, "shield");
        if (r.activePowerUps.shield.blocksRemaining <= 0) delete r.activePowerUps.shield;
        return;
      }
      ball.state = BALL_STATES.FAULTED;
      ball.faultedAt = gameTime();
      r.totalFaulted++;
      r.currentStreak = 0;
      r.rallyCount = 0;
      r.doubleBouncePhase = 0;

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
        r.config, elapsedSec, r.smashes, r.canvasW, r.canvasH, r.court,
        r.playerX, r.playerY, r.rng, r.modifier
      );

      r.opponentX = ball.startX;
      r.opponentTargetX = ball.startX;
      r.opponentState = "swing";
      r.opponentSwingUntil = r.elapsedMs + Math.floor(reqNum(r.config?.ui?.opponentSwingMs, "ui.opponentSwingMs", { min: 1 }));

      if (r.totalSpawned < r.onboardingShield) {
        ball.inKitchen = false;
        var kitchenLineYpx = r.court.kitchenLineY * r.canvasH;
        var baselineYpx = r.court.baselineY * r.canvasH;
        var rand = (typeof r.rng === "function") ? r.rng : Math.random;
        ball.targetY = kitchenLineYpx + rand() * (baselineYpx - kitchenLineYpx - 20) + 10;
        ball.shadowY = ball.targetY;
      }

      if (r.doubleBouncePhase === 0) {
        retargetBallAsDiagonalServe(ball, r.config, r.canvasW, r.canvasH, r.court, r.rng);
      }

      ball.mustBounceReason = ball.inKitchen ? "kitchen" : (r.doubleBouncePhase === 0 ? "double_bounce" : "");
      ball.mustBounce = !!ball.mustBounceReason;

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
          landedAt: b.landedAt || 0,
          bouncedAt: b.bouncedAt || 0,
          hitAt: b.hitAt || 0,
          missedAt: b.missedAt || 0,
          faultedAt: b.faultedAt || 0,
          spawnedAt: b.spawnedAt || 0,
          travelMs: b.travelMs,
          tapWindowMs: b.tapWindowMs,
          shadowY: b.shadowY || b.targetY,
          isServe: !!b.isServe,
          serveToRight: !!b.serveToRight,
          returnStartX: b.returnStartX, returnStartY: b.returnStartY,
          returnTargetX: b.returnTargetX, returnTargetY: b.returnTargetY,
          returnArcHeight: b.returnArcHeight || 0,
          returnTravelMs: b.returnTravelMs || 0,
          timingBonus: b.timingBonus || 0,
          mustBounce: !!b.mustBounce,
          mustBounceReason: b.mustBounceReason || "",
          autoHitFired: !!b.autoHitFired,
          squash: b.squash || 0,
          savedByShield: !!b.savedByShield
        };
      }

      var activePowerUps = [];
      Object.keys(r.activePowerUps || {}).forEach(function (key) {
        var item = r.activePowerUps[key];
        if (!item) return;
        if (key === "shield") {
          var blocksRemaining = reqNum(item.blocksRemaining || 0, "activePowerUps.shield.blocksRemaining", { min: 0, integer: true });
          if (blocksRemaining > 0) activePowerUps.push({ key: key, blocksRemaining: blocksRemaining, remainingMs: 0 });
          return;
        }
        var remainingMs = getTimedPowerRemainingMs(item, r.elapsedMs);
        if (remainingMs > 0) activePowerUps.push({ key: key, blocksRemaining: 0, remainingMs: remainingMs });
      });

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
        opponentState: r.opponentState,
        opponentBounceAt: r.opponentBounceAt,
        opponentBounceUntil: r.opponentBounceUntil,
        opponentBounceX: r.opponentBounceX,
        ball: ballState,

        rallyCount: r.rallyCount,
        doubleBouncePhase: r.doubleBouncePhase,
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
        dailyObjectiveMet: !!r.dailyObjectiveMet,
        featuredPowerKey: r.progressionMeta ? r.progressionMeta.featuredPowerKey : "",
        activePowerUps: activePowerUps,
        lastPowerUpEvent: (r.lastPowerUpEventUntil > r.elapsedMs) ? r.lastPowerUpEvent : null
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
        dailyObjectiveMet: s.dailyObjectiveMet,
        featuredPowerKey: s.featuredPowerKey
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
    DAILY_MODIFIERS: DAILY_MODIFIERS,
    getDailyKeyUtc: getDailyKeyUtc
  };
})();
