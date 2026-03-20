// game.js v2.0 - Kitchen Rush
// Canvas game engine — Classic = pickleball-styled scoring, Rush = arcade sprint.

(() => {
  "use strict";

  function getModes() {
    const modes = window.KR_ENUMS && window.KR_ENUMS.GAME_MODES;
    if (!modes || typeof modes !== "object") throw new Error("KR_Game: KR_ENUMS.GAME_MODES missing");
    if (!modes.RUN || !modes.SPRINT) throw new Error("KR_Game: KR_ENUMS.GAME_MODES invalid");
    return modes;
  }

  const MODES = getModes();

  function getProductModeKey(mode) {
    return mode === MODES.SPRINT ? "RUSH" : "CLASSIC";
  }

  function getProductModeLabel(mode) {
    return mode === MODES.SPRINT ? "Rush" : "Classic";
  }

  function requiredNumber(value, name, opts) {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(name + " must be a finite number");
    if (opts && Number.isFinite(opts.min) && n < opts.min) throw new Error(name + " must be >= " + opts.min);
    if (opts && Number.isFinite(opts.max) && n > opts.max) throw new Error(name + " must be <= " + opts.max);
    if (opts && opts.integer === true && Math.floor(n) !== n) throw new Error(name + " must be an integer");
    return n;
  }

  function requiredBool(value, name) {
    if (typeof value !== "boolean") throw new Error(name + " must be a boolean");
    return value;
  }

  function requiredString(value, name) {
    const s = String(value).trim();
    if (!s) throw new Error(name + " must be a non-empty string");
    return s;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function now() {
    return performance.now();
  }

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
    for (var i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return h;
  }

  function getPlayerConfig(config) {
    var player = config && config.game && config.game.player;
    if (!player || typeof player !== "object") throw new Error("KR_CONFIG.game.player missing");
    return {
      baseXFrac: requiredNumber(player.baseXFrac, "KR_CONFIG.game.player.baseXFrac", { min: 0, max: 1 }),
      baseYFrac: requiredNumber(player.baseYFrac, "KR_CONFIG.game.player.baseYFrac", { min: 0.5, max: 0.99 }),
      maxForwardYFrac: requiredNumber(player.maxForwardYFrac, "KR_CONFIG.game.player.maxForwardYFrac", { min: 0.4, max: 0.98 }),
      widthFrac: requiredNumber(player.widthFrac, "KR_CONFIG.game.player.widthFrac", { min: 0.05, max: 0.5 }),
      heightPx: requiredNumber(player.heightPx, "KR_CONFIG.game.player.heightPx", { min: 1 }),
      moveSpeedPxPerSec: requiredNumber(player.moveSpeedPxPerSec, "KR_CONFIG.game.player.moveSpeedPxPerSec", { min: 1 }),
      hitReachPx: requiredNumber(player.hitReachPx, "KR_CONFIG.game.player.hitReachPx", { min: 1 }),
      autoForwardReachPx: requiredNumber(player.autoForwardReachPx, "KR_CONFIG.game.player.autoForwardReachPx", { min: 0 }),
      swingMs: requiredNumber(player.swingMs, "KR_CONFIG.game.player.swingMs", { min: 1, integer: true })
    };
  }

  function getClassicConfig(config) {
    var c = config && config.classic;
    if (!c || typeof c !== "object") throw new Error("KR_CONFIG.classic missing");
    return {
      targetScore: requiredNumber(c.targetScore, "KR_CONFIG.classic.targetScore", { min: 1, integer: true }),
      winBy: requiredNumber(c.winBy, "KR_CONFIG.classic.winBy", { min: 1, integer: true }),
      betweenShotsMs: requiredNumber(c.betweenShotsMs, "KR_CONFIG.classic.betweenShotsMs", { min: 1, integer: true }),
      betweenRalliesMs: requiredNumber(c.betweenRalliesMs, "KR_CONFIG.classic.betweenRalliesMs", { min: 1, integer: true }),
      opponentReturnBase: requiredNumber(c.opponentReturnBase, "KR_CONFIG.classic.opponentReturnBase", { min: 0, max: 1 }),
      opponentReturnDecayPerShot: requiredNumber(c.opponentReturnDecayPerShot, "KR_CONFIG.classic.opponentReturnDecayPerShot", { min: 0, max: 1 }),
      opponentReturnMin: requiredNumber(c.opponentReturnMin, "KR_CONFIG.classic.opponentReturnMin", { min: 0, max: 1 }),
      opponentFaultBase: requiredNumber(c.opponentFaultBase, "KR_CONFIG.classic.opponentFaultBase", { min: 0, max: 1 }),
      opponentFaultMax: requiredNumber(c.opponentFaultMax, "KR_CONFIG.classic.opponentFaultMax", { min: 0, max: 1 }),
      serveIndicatorMs: requiredNumber(c.serveIndicatorMs, "KR_CONFIG.classic.serveIndicatorMs", { min: 1, integer: true }),
      sideOutIndicatorMs: requiredNumber(c.sideOutIndicatorMs, "KR_CONFIG.classic.sideOutIndicatorMs", { min: 1, integer: true }),
      playerStartsServing: requiredBool(c.playerStartsServing, "KR_CONFIG.classic.playerStartsServing"),
      serviceCourtRightLabel: requiredString(c.serviceCourtRightLabel, "KR_CONFIG.classic.serviceCourtRightLabel"),
      serviceCourtLeftLabel: requiredString(c.serviceCourtLeftLabel, "KR_CONFIG.classic.serviceCourtLeftLabel"),
      preServePauseMs: requiredNumber(c.preServePauseMs, "KR_CONFIG.classic.preServePauseMs", { min: 1, integer: true }),
      rallyStartSlowMs: requiredNumber(c.rallyStartSlowMs, "KR_CONFIG.classic.rallyStartSlowMs", { min: 0, integer: true }),
      playerReturnWindowBonusMs: requiredNumber(c.playerReturnWindowBonusMs, "KR_CONFIG.classic.playerReturnWindowBonusMs", { min: 0, integer: true }),
      rushCarryoverDisabled: requiredBool(c.rushCarryoverDisabled, "KR_CONFIG.classic.rushCarryoverDisabled")
    };
  }

  function pickBallType(config, elapsedSec, rng) {
    var rush = getRushConfig(config);
    var types = rush.ballTypes;
    if (!types || typeof types !== "object") throw new Error("KR_CONFIG.rush.ballTypes missing");
    var rand = (typeof rng === "function") ? rng : Math.random;
    var candidates = [];
    var totalWeight = 1;
    for (var key in types) {
      if (!Object.prototype.hasOwnProperty.call(types, key)) continue;
      var t = types[key];
      if (!t || typeof t !== "object") continue;
      var unlock = requiredNumber(t.unlockAfterSec, "KR_CONFIG.rush.ballTypes." + key + ".unlockAfterSec", { min: 0 });
      if (elapsedSec >= unlock) {
        var w = requiredNumber(t.weight, "KR_CONFIG.rush.ballTypes." + key + ".weight", { min: 0 });
        if (w > 0) {
          candidates.push({ type: key, weight: w });
          totalWeight += w;
        }
      }
    }
    const defaultBallType = getRushDefaults(config).ballType;
    if (!candidates.length) return defaultBallType;
    var roll = rand() * totalWeight;
    var cumulative = 1;
    if (roll < cumulative) return defaultBallType;
    for (var i = 0; i < candidates.length; i++) {
      cumulative += candidates[i].weight;
      if (roll < cumulative) return candidates[i].type;
    }
    return defaultBallType;
  }

  function projectNonKitchenLanding(config, canvasH, radius, rng) {
    const canvasCfg = config.canvas;
    const kitchenLineYFrac = requiredNumber(canvasCfg.kitchenLineY, "KR_CONFIG.canvas.kitchenLineY", { min: 0.01, max: 0.99 });
    const kitchenLineY = kitchenLineYFrac * canvasH;
    const minLandingYFrac = requiredNumber(canvasCfg.minLandingYFrac, "KR_CONFIG.canvas.minLandingYFrac", { min: 0, max: 0.99 });
    const minLandingY = Math.max(kitchenLineY * minLandingYFrac, radius);
    return minLandingY + rng() * Math.max(1, kitchenLineY - minLandingY - radius);
  }


  function getServerOriginX(canvasW, server, servingSide) {
    const offset = canvasW * 0.16;
    const center = servingSide === "RIGHT" ? canvasW * 0.66 : canvasW * 0.34;
    if (server === "PLAYER") return center;
    return center + (servingSide === "RIGHT" ? -offset : offset);
  }

  function getRushConfig(config) {
    var rush = config && config.rush;
    if (!rush || typeof rush !== "object") throw new Error("KR_CONFIG.rush missing");
    return rush;
  }

  function getRushDefaults(config) {
    var rush = getRushConfig(config);
    return {
      ballType: requiredString(rush.defaultBallType, "KR_CONFIG.rush.defaultBallType"),
      exchangeStage: requiredString(rush.defaultExchangeStage, "KR_CONFIG.rush.defaultExchangeStage"),
      responseType: requiredString(rush.defaultResponseType, "KR_CONFIG.rush.defaultResponseType")
    };
  }

  function projectKitchenLanding(config, canvasH, radius, rng) {
    const canvasCfg = config.canvas;
    const kitchenLineYFrac = requiredNumber(canvasCfg.kitchenLineY, "KR_CONFIG.canvas.kitchenLineY", { min: 0.01, max: 0.99 });
    const kitchenLineY = kitchenLineYFrac * canvasH;
    return kitchenLineY + rng() * Math.max(1, canvasH - kitchenLineY - radius);
  }

  function getServiceTargetX(canvasW, servingSide) {
    return servingSide === "RIGHT" ? canvasW * 0.34 : canvasW * 0.66;
  }

  function isActiveBall(ball) {
    return !!ball && (ball.state === "FALLING" || ball.state === "LANDED" || ball.state === "BOUNCING");
  }

  function createBall(config, elapsedSec, canvasW, canvasH, rng, opts) {
    const safeOpts = (opts && typeof opts === "object") ? opts : {};
    const rushCfg = getRushConfig(config);
    const canvasCfg = config.canvas;
    const rand = (typeof rng === "function") ? rng : Math.random;
    const rushDefaults = getRushDefaults(config);
    const stage = safeOpts.exchangeStage == null ? rushDefaults.exchangeStage : requiredString(safeOpts.exchangeStage, "KR_Game.createBall().exchangeStage");
    const mustBounce = safeOpts.mustBounce === true;
    const forcedKitchen = safeOpts.forceKitchen === true;
    const forcedNonKitchen = safeOpts.forceKitchen === false;
    const ballType = safeOpts.ballType == null ? pickBallType(config, elapsedSec, rng) : requiredString(safeOpts.ballType, "KR_Game.createBall().ballType");
    const typeConfig = rushCfg.ballTypes[ballType];
    if (!typeConfig || typeof typeConfig !== "object") throw new Error("KR_CONFIG.rush.ballTypes." + ballType + " missing");
    const speedMul = typeConfig ? requiredNumber(typeConfig.speedMultiplier, "KR_CONFIG.rush.ballTypes." + ballType + ".speedMultiplier", { min: 0.01 }) : 1;
    const tapMul = typeConfig ? requiredNumber(typeConfig.hitWindowMultiplier, "KR_CONFIG.rush.ballTypes." + ballType + ".hitWindowMultiplier", { min: 0.01 }) : 1;
    const radiusMul = typeConfig ? requiredNumber(typeConfig.radiusMultiplier, "KR_CONFIG.rush.ballTypes." + ballType + ".radiusMultiplier", { min: 0.01 }) : 1;
    const radius = Math.round(requiredNumber(canvasCfg.ballRadius, "KR_CONFIG.canvas.ballRadius", { min: 1 }) * radiusMul);
    const margin = radius * 2;
    let x = Number.isFinite(Number(safeOpts.x)) ? Number(safeOpts.x) : (margin + rand() * Math.max(1, canvasW - margin * 2));
    x = clamp(x, margin, Math.max(margin, canvasW - margin));
    const spd = rushCfg.speedCurve;
    const speed = (requiredNumber(spd.base, "KR_CONFIG.rush.speedCurve.base", { min: 0.1 }) + requiredNumber(spd.accelPerSec, "KR_CONFIG.rush.speedCurve.accelPerSec", { min: 0 }) * elapsedSec) * speedMul;
    const win = rushCfg.hitWindow;
    const baseTapWindowMs = Math.max(
      requiredNumber(win.minMs, "KR_CONFIG.rush.hitWindow.minMs", { min: 1 }),
      (requiredNumber(win.initialMs, "KR_CONFIG.rush.hitWindow.initialMs", { min: 1 }) - requiredNumber(win.decayPerSec, "KR_CONFIG.rush.hitWindow.decayPerSec", { min: 0 }) * elapsedSec) * tapMul
    );
    const tapWindowMs = mustBounce ? Math.round(baseTapWindowMs * 1.2) : baseTapWindowMs;

    let inKitchen = false;
    if (forcedKitchen) inKitchen = true;
    else if (!forcedNonKitchen) {
      const kr = rushCfg.kitchenShare;
      const kitchenRatio = clamp(
        requiredNumber(kr.base, "KR_CONFIG.rush.kitchenShare.base", { min: 0, max: 1 }) + requiredNumber(kr.growthPerSec, "KR_CONFIG.rush.kitchenShare.growthPerSec", { min: 0 }) * elapsedSec,
        0,
        requiredNumber(kr.max, "KR_CONFIG.rush.kitchenShare.max", { min: 0, max: 1 })
      );
      inKitchen = rand() < kitchenRatio;
    }

    const landingY = inKitchen
      ? projectKitchenLanding(config, canvasH, radius, rand)
      : projectNonKitchenLanding(config, canvasH, radius, rand);

    return {
      id: Math.floor(rand() * 1e9) ^ (Date.now() & 0xfffff),
      x: x,
      y: 0,
      radius: radius,
      speed: speed,
      landingY: landingY,
      inKitchen: inKitchen,
      ballType: ballType,
      exchangeStage: stage,
      mustBounce: mustBounce,
      responseType: mustBounce ? "BOUNCE_ONLY" : (inKitchen ? "KITCHEN_SAVE" : "ATTACKABLE"),
      canVolley: !mustBounce && !inKitchen,
      tapWindowMs: tapWindowMs,
      state: "FALLING",
      landedAt: 0,
      bouncedAt: 0,
      hitAt: 0,
      faultedAt: 0,
      missedAt: 0,
      hitOutAngle: 0,
      trail: [],
      isFirstKitchen: false
    };
  }

  class GameEngine {
    constructor() {
      this.run = null;
    }

    start(payload) {
      const p = (payload && typeof payload === "object") ? payload : {};
      if (!p.config || typeof p.config !== "object") throw new Error("KR_Game.GameEngine.start(): payload.config is required");
      const config = p.config;
      const canvasW = requiredNumber(p.canvasW, "GameEngine.start().canvasW", { min: 1 });
      const canvasH = requiredNumber(p.canvasH, "GameEngine.start().canvasH", { min: 1 });
      const modeRaw = String(p.mode == null ? "" : p.mode).trim().toUpperCase();
      if (![MODES.RUN, MODES.SPRINT].includes(modeRaw)) throw new Error('GameEngine.start(): invalid mode "' + modeRaw + '"');
      const mode = modeRaw;
      const playerCfg = getPlayerConfig(config);
      const isClassic = mode === MODES.RUN;
      const classicCfg = isClassic ? getClassicConfig(config) : null;
      const initialServer = isClassic ? (classicCfg.playerStartsServing ? "PLAYER" : "OPPONENT") : null;
      this.run = {
        mode,
        productMode: getProductModeKey(mode),
        productLabel: getProductModeLabel(mode),
        isDaily: !!(p.isDaily === true && config.daily && config.daily.enabled && mode === MODES.RUN),
        config,
        canvasW,
        canvasH,
        rng: (p.isDaily === true && config.daily && config.daily.enabled && mode === MODES.RUN) ? mulberry32(dateSeed()) : null,
        startedAt: now(),
        elapsedMs: 0,
        lastSpawnAt: 0,

        sprintDurationMs: mode === MODES.SPRINT ? Math.floor(requiredNumber(config.sprint && config.sprint.durationMs, "KR_CONFIG.sprint.durationMs", { min: 1 })) : null,
        sprintRemainingMs: mode === MODES.SPRINT ? Math.floor(requiredNumber(config.sprint && config.sprint.durationMs, "KR_CONFIG.sprint.durationMs", { min: 1 })) : null,
        penaltyAccumulatedMs: 0,
        score: 0,
        balls: [],
        totalSpawned: 0,
        totalHit: 0,
        totalMissed: 0,
        totalFaulted: 0,
        exchangePhase: isClassic ? (initialServer === "PLAYER" ? "RETURN_CONFIRM" : "SERVICE_RECEIVE") : "SERVICE_RECEIVE",
        serveSequenceCompleted: false,
        player: {
          x: playerCfg.baseXFrac * canvasW,
          targetX: playerCfg.baseXFrac * canvasW,
          baseY: playerCfg.baseYFrac * canvasH,
          forwardY: playerCfg.maxForwardYFrac * canvasH,
          swingUntil: 0,
          forwardUntil: 0
        },
        firstKitchenSpawned: false,
        milestones: Array.isArray(config.rush && config.rush.milestones) ? config.rush.milestones.slice() : [],
        milestonesReached: [],
        lastMilestoneAt: 0,
        lastBounceAt: 0,
        done: false,
        endReason: null,
        classic: isClassic ? {
          targetScore: classicCfg.targetScore,
          winBy: classicCfg.winBy,
          playerScore: 0,
          opponentScore: 0,
          server: initialServer,
          servingSide: "RIGHT",
          pendingStage: initialServer === "PLAYER" ? "RETURN_CONFIRM" : "SERVICE_RECEIVE",
          nextBallAt: 0,
          rallyHits: 0,
          lastCallout: "",
          lastCalloutUntil: now() + classicCfg.serveIndicatorMs,
          lastRallyWinner: null,
          sideOut: false,
          gameWinner: null
        } : null
      };
      return this.getState();
    }

    _activeBall() {
      if (!this.run) return null;
      for (let i = 0; i < this.run.balls.length; i++) if (isActiveBall(this.run.balls[i])) return this.run.balls[i];
      return null;
    }

    _getClassicServingSide(server) {
      const r = this.run;
      const classic = r.classic;
      const score = server === "PLAYER" ? classic.playerScore : classic.opponentScore;
      return (score % 2 === 0) ? "RIGHT" : "LEFT";
    }

    _spawnClassicBall() {
      const r = this.run;
      const stage = r.classic.pendingStage == null ? getRushDefaults(r.config).exchangeStage : requiredString(r.classic.pendingStage, "run.classic.pendingStage");
      const servingSide = r.classic.servingSide;
      const elapsedSec = r.elapsedMs / 1000;
      let x = null;
      let forceKitchen = null;
      const isServeWindow = stage === "SERVICE_RECEIVE" || stage === "RETURN_CONFIRM";
      if (isServeWindow) {
        x = getServiceTargetX(r.canvasW, servingSide);
        forceKitchen = false;
      }
      const ball = createBall(r.config, elapsedSec, r.canvasW, r.canvasH, r.rng, {
        exchangeStage: stage,
        mustBounce: isServeWindow,
        forceKitchen: forceKitchen,
        x: x
      });
      if (isServeWindow) {
        ball.serveTargetX = x;
        ball.serverOriginX = getServerOriginX(r.canvasW, r.classic.server, servingSide);
        ball.serveFrom = r.classic.server;
        ball.targetSide = servingSide;
        ball.tapWindowMs += getClassicConfig(r.config).playerReturnWindowBonusMs;
      }
      if (ball.inKitchen && !r.firstKitchenSpawned) {
        r.firstKitchenSpawned = true;
        ball.isFirstKitchen = true;
      }
      r.balls.push(ball);
      r.totalSpawned++;
      r.exchangePhase = stage;
      r.serveSequenceCompleted = stage === "RALLY";
    }

    _scheduleClassicBall(stage, delayMs) {
      const r = this.run;
      r.classic.pendingStage = stage;
      r.classic.nextBallAt = r.elapsedMs + delayMs;
      r.exchangePhase = stage;
      r.serveSequenceCompleted = stage === "RALLY";
    }

    _classicOpponentOutcome() {
      const r = this.run;
      const c = getClassicConfig(r.config);
      const rand = (typeof r.rng === "function") ? r.rng : Math.random;
      const shotIndex = Math.max(0, r.classic.rallyHits - 1);
      const faultP = clamp(c.opponentFaultBase + shotIndex * (c.opponentReturnDecayPerShot * 0.5), c.opponentFaultBase, c.opponentFaultMax);
      const returnP = clamp(c.opponentReturnBase - shotIndex * c.opponentReturnDecayPerShot, c.opponentReturnMin, 1 - faultP);
      const roll = rand();
      if (roll < faultP) return "PLAYER_WINS";
      if (roll < faultP + returnP) return "CONTINUE";
      return "PLAYER_WINS";
    }

    _checkClassicGameEnd() {
      const r = this.run;
      const c = getClassicConfig(r.config);
      const p = r.classic.playerScore;
      const o = r.classic.opponentScore;
      if (p >= c.targetScore && p - o >= c.winBy) {
        r.done = true;
        r.endReason = "WIN";
        r.classic.gameWinner = "PLAYER";
        return true;
      }
      if (o >= c.targetScore && o - p >= c.winBy) {
        r.done = true;
        r.endReason = "LOSS";
        r.classic.gameWinner = "OPPONENT";
        return true;
      }
      return false;
    }

    _resolveClassicRally(winner, reason) {
      const r = this.run;
      const c = getClassicConfig(r.config);
      const classic = r.classic;
      const server = classic.server;
      const rallyLength = classic.rallyHits;
      classic.lastRallyWinner = winner;
      classic.sideOut = false;
      classic.lastCallout = "";
      if (winner === server) {
        if (winner === "PLAYER") classic.playerScore += 1;
        else classic.opponentScore += 1;
        classic.lastCallout = "POINT";
      } else {
        classic.server = winner;
        classic.sideOut = true;
        classic.lastCallout = "SIDE_OUT";
      }
      classic.servingSide = this._getClassicServingSide(classic.server);
      classic.rallyHits = 0;
      r.score = classic.playerScore;
      if (!this._checkClassicGameEnd()) {
        const nextStage = classic.server === "PLAYER" ? "RETURN_CONFIRM" : "SERVICE_RECEIVE";
        this._scheduleClassicBall(nextStage, c.betweenRalliesMs + c.preServePauseMs);
        classic.lastCalloutUntil = now() + (classic.sideOut ? c.sideOutIndicatorMs : c.serveIndicatorMs);
      }
      return {
        winner,
        reason,
        pointAwarded: !classic.sideOut,
        sideOut: classic.sideOut,
        playerScore: classic.playerScore,
        opponentScore: classic.opponentScore,
        server: classic.server,
        serverBefore: server,
        servingSide: classic.servingSide,
        rallyLength: rallyLength
      };
    }

    _resolveClassicPlayerFault(faultType) {
      return this._resolveClassicRally("OPPONENT", requiredString(faultType, "KR_Game._resolveClassicPlayerFault().faultType"));
    }

    _updatePlayer(dtMs) {
      const r = this.run;
      if (!r || !r.player) return;
      const playerCfg = getPlayerConfig(r.config);
      const controlsCfg = (r.config && r.config.controls && typeof r.config.controls === "object") ? r.config.controls : (() => { throw new Error("KR_CONFIG.controls missing"); })();
      const maxMove = playerCfg.moveSpeedPxPerSec * (dtMs / 1000);
      const dxToTarget = r.player.targetX - r.player.x;
      const smoothing = requiredNumber(controlsCfg.pointerSmoothing, "KR_CONFIG.controls.pointerSmoothing", { min: 0, max: 1 });
      const easedMove = Math.abs(dxToTarget) * smoothing;
      const appliedMove = Math.min(Math.abs(dxToTarget), Math.max(maxMove, easedMove));
      if (Math.abs(dxToTarget) <= appliedMove) r.player.x = r.player.targetX;
      else r.player.x += (dxToTarget > 0 ? 1 : -1) * appliedMove;
    }

    _advanceBall(ball, dtMs) {
      if (ball.state === "FALLING") {
        if (ball.trail.length >= 5) ball.trail.shift();
        ball.trail.push({ x: ball.x, y: ball.y });
        ball.y += ball.speed * (dtMs / 16.67);
        if (ball.y >= ball.landingY) {
          ball.y = ball.landingY;
          ball.state = "LANDED";
          ball.landedAt = now();
        }
      }
    }

    _cleanupBalls() {
      const r = this.run;
      for (let i = r.balls.length - 1; i >= 0; i--) {
        const b = r.balls[i];
        const at = b.hitAt || b.missedAt || b.faultedAt || 0;
        if ((b.state === "HIT" || b.state === "MISSED" || b.state === "FAULTED") && (now() - at) > 500) r.balls.splice(i, 1);
      }
    }

    _updateClassic(dtMs) {
      const r = this.run;
      const reboundDelayMs = requiredNumber(getRushConfig(r.config).reboundDelayMs, "KR_CONFIG.rush.reboundDelayMs", { min: 1 });
      const active = this._activeBall();
      if (active) {
        this._advanceBall(active, dtMs);
        if (active.state === "LANDED") {
          const needsBounceWindow = !!(active.mustBounce || active.inKitchen);
          if (needsBounceWindow && (now() - active.landedAt >= reboundDelayMs)) {
            active.state = "BOUNCING";
            active.bouncedAt = now();
            r.lastBounceAt = now();
          }
          if (!needsBounceWindow && (now() - active.landedAt > active.tapWindowMs)) {
            active.state = "MISSED";
            active.missedAt = now();
            r.totalMissed++;
            this._resolveClassicPlayerFault("MISS");
          }
        } else if (active.state === "BOUNCING") {
          if (now() - active.bouncedAt > active.tapWindowMs) {
            active.state = "MISSED";
            active.missedAt = now();
            r.totalMissed++;
            this._resolveClassicPlayerFault("MISS");
          }
        }
      }
      if (!this._activeBall() && !r.done && r.elapsedMs >= r.classic.nextBallAt) this._spawnClassicBall();
      this._cleanupBalls();
    }

    _updateRush(dtMs) {
      const r = this.run;
      const cfg = r.config;
      const rushCfg = getRushConfig(cfg);
      const elapsedSec = r.elapsedMs / 1000;
      if (r.sprintRemainingMs != null) {
        r.sprintRemainingMs = Math.max(0, r.sprintDurationMs - r.elapsedMs - r.penaltyAccumulatedMs);
        if (r.sprintRemainingMs <= 0) {
          r.done = true;
          r.endReason = "TIMER";
          return;
        }
      }
      const reboundDelayMs = requiredNumber(rushCfg.reboundDelayMs, "KR_CONFIG.rush.reboundDelayMs", { min: 1 });
      for (let i = r.balls.length - 1; i >= 0; i--) {
        const b = r.balls[i];
        if (isActiveBall(b)) this._advanceBall(b, dtMs);
        if (b.state === "LANDED") {
          const needsBounceWindow = !!(b.mustBounce || b.inKitchen);
          if (needsBounceWindow && (now() - b.landedAt >= reboundDelayMs)) {
            b.state = "BOUNCING";
            b.bouncedAt = now();
            r.lastBounceAt = now();
          }
          if (!needsBounceWindow && (now() - b.landedAt > b.tapWindowMs)) {
            b.state = "MISSED";
            b.missedAt = now();
            r.totalMissed++;
          }
        }
        if (b.state === "BOUNCING" && (now() - b.bouncedAt > b.tapWindowMs)) {
          b.state = "MISSED";
          b.missedAt = now();
          r.totalMissed++;
        }
      }
      const spawnCfg = rushCfg.spawnInterval;
      const spawnInterval = Math.max(
        requiredNumber(spawnCfg.minMs, "KR_CONFIG.rush.spawnInterval.minMs", { min: 1 }),
        requiredNumber(spawnCfg.initialMs, "KR_CONFIG.rush.spawnInterval.initialMs", { min: 1 }) - requiredNumber(spawnCfg.decayPerSec, "KR_CONFIG.rush.spawnInterval.decayPerSec", { min: 0 }) * elapsedSec
      );
      if (r.elapsedMs - r.lastSpawnAt >= spawnInterval) {
        r.lastSpawnAt = r.elapsedMs;
        const stage = r.totalSpawned <= 0 ? "SERVICE_RECEIVE" : (r.totalSpawned === 1 ? "RETURN_CONFIRM" : "RALLY");
        const ball = createBall(cfg, elapsedSec, r.canvasW, r.canvasH, r.rng, {
          exchangeStage: stage,
          mustBounce: stage === "SERVICE_RECEIVE" || stage === "RETURN_CONFIRM",
          forceKitchen: stage === "SERVICE_RECEIVE" ? false : null
        });
        if (ball.inKitchen && !r.firstKitchenSpawned) {
          r.firstKitchenSpawned = true;
          ball.isFirstKitchen = true;
        }
        r.balls.push(ball);
        r.totalSpawned++;
        r.exchangePhase = ball.exchangeStage;
        if (r.totalSpawned >= 2) r.serveSequenceCompleted = true;
      }
      this._cleanupBalls();
    }

    update(dtMs) {
      if (!this.run || this.run.done) return this.getState();
      const step = requiredNumber(dtMs, "KR_Game.GameEngine.update().dtMs", { min: 0 });
      this.run.elapsedMs += step;
      this._updatePlayer(step);
      if (this.run.mode === MODES.RUN) this._updateClassic(step);
      else this._updateRush(step);
      return this.getState();
    }

    setPlayerTarget(x) {
      if (!this.run || this.run.done || !Number.isFinite(Number(x))) return this.getState();
      this.run.player.targetX = clamp(Number(x), 0, this.run.canvasW);
      return this.getState();
    }

    nudgePlayer(direction, dtMs) {
      if (!this.run || this.run.done) return this.getState();
      const playerCfg = getPlayerConfig(this.run.config);
      const stepMs = requiredNumber(dtMs, "KR_Game.GameEngine.nudgePlayer().dtMs", { min: 1 });
      const delta = playerCfg.moveSpeedPxPerSec * (stepMs / 1000) * (direction < 0 ? -1 : 1);
      this.run.player.targetX = clamp(this.run.player.targetX + delta, 0, this.run.canvasW);
      return this.getState();
    }

    tap(x, y) {
      if (!this.run || this.run.done) return null;
      const r = this.run;
      const playerCfg = getPlayerConfig(r.config);
      const hitTolerance = requiredNumber(r.config.canvas && r.config.canvas.hitTolerancePx, "KR_CONFIG.canvas.hitTolerancePx", { min: 0 });
      if (Number.isFinite(Number(x))) {
        r.player.targetX = clamp(Number(x), 0, r.canvasW);
        r.player.x = r.player.targetX;
      }

      let bestBall = null;
      let bestDist = Infinity;
      let activeBallSeen = false;
      for (const b of r.balls) {
        if (!isActiveBall(b)) continue;
        activeBallSeen = true;
        var strikeY = r.player.baseY;
        var reach = playerCfg.hitReachPx;
        if (b.inKitchen) {
          strikeY = r.player.forwardY;
          reach += playerCfg.autoForwardReachPx;
        }
        const dx = b.x - r.player.x;
        const dy = b.y - strikeY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= b.radius + hitTolerance + reach && dist < bestDist) {
          bestDist = dist;
          bestBall = b;
        }
      }
      if (!bestBall) return activeBallSeen ? { hit: false, whiff: true, ball: null, fault: false, hit: false } : null;

      const swingNow = now();
      r.player.swingUntil = swingNow + playerCfg.swingMs;
      r.player.forwardUntil = bestBall.inKitchen ? swingNow + playerCfg.swingMs : 0;

      const ball = bestBall;
      const faultPayload = (type) => ({ hit: true, ball, fault: true, faultType: type, hit: false, whiff: false });

      if (ball.mustBounce && ball.state !== "BOUNCING") {
        ball.state = "FAULTED";
        ball.faultedAt = swingNow;
        r.totalFaulted++;
        if (r.mode === MODES.RUN) {
          const rally = this._resolveClassicPlayerFault("DOUBLE_BOUNCE");
          return Object.assign(faultPayload("DOUBLE_BOUNCE"), rally);
        }
        const penalty = Math.floor(requiredNumber(r.config.sprint && r.config.sprint.faultPenaltyMs, "KR_CONFIG.sprint.faultPenaltyMs", { min: 1 }));
        r.penaltyAccumulatedMs += penalty;
        return faultPayload("DOUBLE_BOUNCE");
      }

      if (ball.inKitchen && ball.state !== "BOUNCING") {
        ball.state = "FAULTED";
        ball.faultedAt = swingNow;
        r.totalFaulted++;
        if (r.mode === MODES.RUN) {
          const rally = this._resolveClassicPlayerFault("KITCHEN_EARLY");
          return Object.assign(faultPayload("KITCHEN_EARLY"), rally);
        }
        const penalty = Math.floor(requiredNumber(r.config.sprint && r.config.sprint.faultPenaltyMs, "KR_CONFIG.sprint.faultPenaltyMs", { min: 1 }));
        r.penaltyAccumulatedMs += penalty;
        return faultPayload("KITCHEN_EARLY");
      }

      ball.state = "HIT";
      ball.hitAt = swingNow;
      ball.hitOutAngle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
      r.totalHit++;

      if (r.mode === MODES.SPRINT) {
        r.score += 1;
        return { hit: true, ball, fault: false, hit: true, whiff: false, pointAwarded: true };
      }

      r.classic.rallyHits += 1;
      let rally = { pointAwarded: false, sideOut: false, playerScore: r.classic.playerScore, opponentScore: r.classic.opponentScore, server: r.classic.server, servingSide: r.classic.servingSide };
      if (ball.exchangeStage === "SERVICE_RECEIVE") {
        this._scheduleClassicBall("RETURN_CONFIRM", getClassicConfig(r.config).betweenShotsMs);
      } else {
        const outcome = this._classicOpponentOutcome();
        if (outcome === "CONTINUE") this._scheduleClassicBall("RALLY", getClassicConfig(r.config).betweenShotsMs);
        else rally = this._resolveClassicRally("PLAYER", "RALLY_WON");
      }

      for (var mi = 0; mi < r.milestones.length; mi++) {
        if (r.score === r.milestones[mi] && r.milestonesReached.indexOf(r.milestones[mi]) === -1) {
          r.milestonesReached.push(r.milestones[mi]);
          r.lastMilestoneAt = now();
        }
      }

      return Object.assign({ hit: true, ball, fault: false, hit: true, whiff: false }, rally);
    }

    getState() {
      if (!this.run) {
        return { mode: "NONE", done: true, score: 0, sprintRemainingMs: null, balls: [], elapsedMs: 0, endReason: null };
      }
      const r = this.run;
      const classic = r.classic;
      return {
        mode: r.mode,
        productMode: r.productMode,
        productLabel: r.productLabel,
        isDaily: !!r.isDaily,
        done: !!r.done,
        score: r.score,
        sprintRemainingMs: r.sprintRemainingMs,
        sprintDurationMs: r.sprintDurationMs,
        balls: r.balls.map((b) => ({
          id: b.id,
          x: b.x,
          y: b.y,
          radius: b.radius,
          inKitchen: b.inKitchen,
          ballType: requiredString(b.ballType, "KR_Game.getState().balls[].ballType"),
          exchangeStage: requiredString(b.exchangeStage, "KR_Game.getState().balls[].exchangeStage"),
          mustBounce: !!b.mustBounce,
          responseType: requiredString(b.responseType, "KR_Game.getState().balls[].responseType"),
          canVolley: !!b.canVolley,
          state: b.state,
          landingY: b.landingY,
          isFirstKitchen: !!b.isFirstKitchen,
          bouncedAt: requiredNumber(b.bouncedAt, "KR_Game.getState().balls[].bouncedAt", { min: 0 }),
          landedAt: requiredNumber(b.landedAt, "KR_Game.getState().balls[].landedAt", { min: 0 }),
          hitAt: requiredNumber(b.hitAt, "KR_Game.getState().balls[].hitAt", { min: 0 }),
          faultedAt: requiredNumber(b.faultedAt, "KR_Game.getState().balls[].faultedAt", { min: 0 }),
          missedAt: requiredNumber(b.missedAt, "KR_Game.getState().balls[].missedAt", { min: 0 }),
          hitOutAngle: requiredNumber(b.hitOutAngle, "KR_Game.getState().balls[].hitOutAngle"),
          serveTargetX: Number.isFinite(Number(b.serveTargetX)) ? b.serveTargetX : null,
          serverOriginX: Number.isFinite(Number(b.serverOriginX)) ? b.serverOriginX : null,
          serveFrom: b.serveFrom == null ? null : requiredString(b.serveFrom, "KR_Game.getState().balls[].serveFrom"),
          targetSide: b.targetSide == null ? null : requiredString(b.targetSide, "KR_Game.getState().balls[].targetSide"),
          trail: b.trail ? b.trail.slice() : []
        })),
        elapsedMs: r.elapsedMs,
        exchangePhase: r.exchangePhase,
        serveSequenceCompleted: !!r.serveSequenceCompleted,
        endReason: r.endReason,
        player: r.player ? {
          x: r.player.x,
          targetX: r.player.targetX,
          normalizedX: r.canvasW > 0 ? r.player.x / r.canvasW : 0.5,
          baseY: r.player.baseY,
          forwardY: r.player.forwardY,
          swinging: !!(r.player.swingUntil > now()),
          steppingForward: !!(r.player.forwardUntil > now())
        } : null,
        playerScore: classic ? classic.playerScore : null,
        opponentScore: classic ? classic.opponentScore : null,
        server: classic ? classic.server : null,
        servingSide: classic ? classic.servingSide : null,
        serviceTargetX: classic ? getServiceTargetX(r.canvasW, classic.servingSide) : null,
        serverOriginX: classic ? getServerOriginX(r.canvasW, classic.server, classic.servingSide) : null,
        sideOut: classic ? !!classic.sideOut : false,
        lastCallout: classic ? classic.lastCallout : "",
        lastCalloutUntil: classic ? classic.lastCalloutUntil : 0,
        rallyHits: classic ? classic.rallyHits : 0,
        opponent: classic ? {
          x: getServerOriginX(r.canvasW, classic.server === "PLAYER" ? "OPPONENT" : "PLAYER", classic.servingSide),
          y: r.canvasH * 0.24,
          serving: classic.server === "OPPONENT",
          receiving: classic.server === "PLAYER"
        } : null,
        totalSpawned: r.totalSpawned,
        totalHit: r.totalHit,
        totalMissed: r.totalMissed,
        totalFaulted: r.totalFaulted,
        milestonesReached: r.milestonesReached ? r.milestonesReached.slice() : [],
        lastMilestoneAt: requiredNumber(r.lastMilestoneAt, "KR_Game.getState().lastMilestoneAt", { min: 0 }),
        lastBounceAt: requiredNumber(r.lastBounceAt, "KR_Game.getState().lastBounceAt", { min: 0 })
      };
    }

    getResult() {
      const s = this.getState();
      return {
        mode: s.mode,
        isDaily: !!s.isDaily,
        score: s.mode === MODES.RUN ? requiredNumber(s.playerScore, "KR_Game.getState().playerScore", { min: 0 }) : requiredNumber(s.score, "KR_Game.getState().score", { min: 0 }),
        playerScore: s.playerScore,
        opponentScore: s.opponentScore,
        server: s.server,
        servingSide: s.servingSide,
        elapsedMs: s.elapsedMs,
        endReason: s.endReason,
        totalSpawned: s.totalSpawned,
        totalHit: s.totalHit,
        totalMissed: s.totalMissed,
        totalFaulted: s.totalFaulted
      };
    }
  }

  window.KR_Game = { GameEngine };
})();
