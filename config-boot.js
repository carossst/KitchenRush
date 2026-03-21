// config-boot.js v1.0 - Kitchen Rush
// Validation + brand hydration boot helpers
// Kitchen Rush

(() => {
  "use strict";

  window.KR_CONFIG_BOOT = {
    validateConfigSoft: function () {
      const cfg = window.KR_CONFIG;
      if (!cfg || typeof cfg !== "object") return;

      const warn = (...args) => {
        if (cfg.debug && cfg.debug.enabled) console.warn("[KR_CONFIG]", ...args);
      };

      try { new RegExp(cfg.premiumCodeRegex); } catch (e) { warn("premiumCodeRegex is invalid", e); }

      const appUrl = String((cfg.identity && cfg.identity.appUrl) || "").trim();
      if (!appUrl) warn("identity.appUrl is missing (used for share URL)");
      else if (!/^https?:\/\//i.test(appUrl)) warn("identity.appUrl must start with http:// or https://", appUrl);

      if (!cfg.stripeEarlyPaymentUrl || String(cfg.stripeEarlyPaymentUrl).includes("REPLACE")) warn("Stripe early URL needs to be configured");
      if (!cfg.stripeStandardPaymentUrl || String(cfg.stripeStandardPaymentUrl).includes("REPLACE")) warn("Stripe standard URL needs to be configured");

      if (!cfg.game || !Number.isFinite(Number(cfg.game.lives)) || Number(cfg.game.lives) <= 0) warn("game.lives must be > 0");

      const freeRunsNum = (cfg.limits && Number.isFinite(Number(cfg.limits.freeRuns))) ? Number(cfg.limits.freeRuns) : null;
      if (freeRunsNum == null || Math.floor(freeRunsNum) !== freeRunsNum || freeRunsNum < 0 || freeRunsNum > 99) warn("limits.freeRuns must be an integer in [0..99]");

      if (cfg.sprint && cfg.sprint.enabled === true) {
        const gates = cfg.sprint.gates;
        if (!gates || typeof gates !== "object") warn("sprint.enabled true but sprint.gates is missing");
      }

      if (cfg.support && !cfg.support.emailObfuscated) warn("support.emailObfuscated missing");
      if (cfg.waitlist && cfg.waitlist.enabled && !cfg.waitlist.toEmailObfuscated) warn("waitlist.enabled true but toEmailObfuscated missing");
      if (cfg.waitlist) {
        const placement = String(cfg.waitlist.placement || "").trim();
        if (placement && placement !== "end-and-landing-after-seen-once" && placement !== "landing-only" && placement !== "end-only") {
          warn("waitlist.placement is unknown", placement);
        }
      }
    },

    validateConfigStrict: function () {
      const cfg = window.KR_CONFIG;
      const enums = window.KR_ENUMS;
      const fail = (msg) => { throw new Error("KR_CONFIG strict validation failed: " + msg); };
      const reqObj = (obj, name) => {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) fail(name + " missing or invalid");
        return obj;
      };
      const reqStr = (value, name) => {
        const s = String(value == null ? "" : value).trim();
        if (!s) fail(name + " missing or empty");
        return s;
      };
      const reqNum = (value, name, opts) => {
        const n = Number(value);
        if (!Number.isFinite(n)) fail(name + " must be a finite number");
        if (opts && Number.isFinite(opts.min) && n < opts.min) fail(name + " must be >= " + opts.min);
        if (opts && Number.isFinite(opts.max) && n > opts.max) fail(name + " must be <= " + opts.max);
        if (opts && opts.integer === true && Math.floor(n) !== n) fail(name + " must be an integer");
        return n;
      };
      const reqBool = (value, name) => {
        if (typeof value !== "boolean") fail(name + " must be a boolean");
        return value;
      };

      reqObj(cfg, "KR_CONFIG");
      reqObj(enums, "KR_ENUMS");
      reqObj(enums.UI_STATES, "KR_ENUMS.UI_STATES");
      reqObj(enums.GAME_MODES, "KR_ENUMS.GAME_MODES");

      reqStr(enums.UI_STATES.LANDING, "KR_ENUMS.UI_STATES.LANDING");
      reqStr(enums.UI_STATES.PLAYING, "KR_ENUMS.UI_STATES.PLAYING");
      reqStr(enums.UI_STATES.END, "KR_ENUMS.UI_STATES.END");
      reqStr(enums.UI_STATES.PAYWALL, "KR_ENUMS.UI_STATES.PAYWALL");
      reqStr(enums.GAME_MODES.RUN, "KR_ENUMS.GAME_MODES.RUN");
      reqStr(enums.GAME_MODES.SPRINT, "KR_ENUMS.GAME_MODES.SPRINT");

      reqObj(cfg.identity, "KR_CONFIG.identity");
      reqStr(cfg.identity.appName, "KR_CONFIG.identity.appName");
      reqStr(cfg.version, "KR_CONFIG.version");
      reqStr(cfg.storageSchemaVersion, "KR_CONFIG.storageSchemaVersion");

      reqObj(cfg.storage, "KR_CONFIG.storage");
      reqStr(cfg.storage.storageKey, "KR_CONFIG.storage.storageKey");
      reqStr(cfg.storage.vanityCodeStorageKey, "KR_CONFIG.storage.vanityCodeStorageKey");

      const houseAd = reqObj(cfg.houseAd, "KR_CONFIG.houseAd");
      reqBool(houseAd.enabled, "KR_CONFIG.houseAd.enabled");
      reqBool(houseAd.premiumOnly, "KR_CONFIG.houseAd.premiumOnly");
      reqBool(houseAd.showAfterEnd, "KR_CONFIG.houseAd.showAfterEnd");
      reqBool(houseAd.suppressOnPostPaywall, "KR_CONFIG.houseAd.suppressOnPostPaywall");
      reqBool(houseAd.suppressWhenWaitlistVisible, "KR_CONFIG.houseAd.suppressWhenWaitlistVisible");
      reqNum(houseAd.minRunCompletesToShow, "KR_CONFIG.houseAd.minRunCompletesToShow", { min: 0, integer: true });
      reqNum(houseAd.hideMs, "KR_CONFIG.houseAd.hideMs", { min: 0, integer: true });

      const waitlist = reqObj(cfg.waitlist, "KR_CONFIG.waitlist");
      reqBool(waitlist.enabled, "KR_CONFIG.waitlist.enabled");
      reqNum(waitlist.minRunCompletesToShow, "KR_CONFIG.waitlist.minRunCompletesToShow", { min: 0, integer: true });
      const waitlistPlacement = reqStr(waitlist.placement, "KR_CONFIG.waitlist.placement");
      if (waitlistPlacement !== "end-and-landing-after-seen-once" && waitlistPlacement !== "landing-only" && waitlistPlacement !== "end-only") {
        fail("KR_CONFIG.waitlist.placement invalid");
      }
      reqBool(waitlist.afterPoolExhaustedOnly, "KR_CONFIG.waitlist.afterPoolExhaustedOnly");
      reqBool(waitlist.showModalOneShot, "KR_CONFIG.waitlist.showModalOneShot");
      reqBool(waitlist.showOnSprintEnd, "KR_CONFIG.waitlist.showOnSprintEnd");
      reqBool(waitlist.suppressOnPostPaywall, "KR_CONFIG.waitlist.suppressOnPostPaywall");
      reqBool(waitlist.suppressWhenHouseAdVisible, "KR_CONFIG.waitlist.suppressWhenHouseAdVisible");
      reqBool(waitlist.suppressWhenStatsPromptVisible, "KR_CONFIG.waitlist.suppressWhenStatsPromptVisible");
      reqBool(waitlist.suppressWhenShareVisible, "KR_CONFIG.waitlist.suppressWhenShareVisible");
      reqStr(waitlist.subjectPrefix, "KR_CONFIG.waitlist.subjectPrefix");

      const end = reqObj(cfg.end, "KR_CONFIG.end");
      reqNum(end.bestStreakLineMin, "KR_CONFIG.end.bestStreakLineMin", { min: 1, integer: true });
      reqNum(end.almostBestGapMax, "KR_CONFIG.end.almostBestGapMax", { min: 1, integer: true });
      reqNum(end.playAgainNearBestGapMax, "KR_CONFIG.end.playAgainNearBestGapMax", { min: 1, integer: true });

      const history = reqObj(cfg.history, "KR_CONFIG.history");
      reqNum(history.minRunCompletesForNewBestCelebrate, "KR_CONFIG.history.minRunCompletesForNewBestCelebrate", { min: 0, integer: true });
      reqNum(history.minSprintCompletesForNewBestCelebrate, "KR_CONFIG.history.minSprintCompletesForNewBestCelebrate", { min: 0, integer: true });

      const share = reqObj(cfg.share, "KR_CONFIG.share");
      reqBool(share.enabled, "KR_CONFIG.share.enabled");
      reqStr(share.verificationSalt, "KR_CONFIG.share.verificationSalt");
      reqNum(share.autoOpenDelayMs, "KR_CONFIG.share.autoOpenDelayMs", { min: 0, integer: true });
      reqNum(share.autoOpenNewBestScoreMin, "KR_CONFIG.share.autoOpenNewBestScoreMin", { min: 1, integer: true });
      reqNum(share.autoOpenDailyScoreMin, "KR_CONFIG.share.autoOpenDailyScoreMin", { min: 1, integer: true });

      const endNudges = reqObj(cfg.endNudges, "KR_CONFIG.endNudges");
      reqBool(endNudges.showShareOnNewBest, "KR_CONFIG.endNudges.showShareOnNewBest");
      reqBool(endNudges.showShareOnDaily, "KR_CONFIG.endNudges.showShareOnDaily");
      reqBool(endNudges.showShareByDefault, "KR_CONFIG.endNudges.showShareByDefault");
      reqBool(endNudges.autoShareOnNewBest, "KR_CONFIG.endNudges.autoShareOnNewBest");
      reqBool(endNudges.autoShareOnDaily, "KR_CONFIG.endNudges.autoShareOnDaily");
      reqBool(endNudges.showStatsPromptWhenReplayPrimary, "KR_CONFIG.endNudges.showStatsPromptWhenReplayPrimary");
      reqBool(endNudges.suppressShareWhenNoRuns, "KR_CONFIG.endNudges.suppressShareWhenNoRuns");
      reqBool(endNudges.suppressStatsPromptWhenNoRuns, "KR_CONFIG.endNudges.suppressStatsPromptWhenNoRuns");

      const game = reqObj(cfg.game, "KR_CONFIG.game");
      reqNum(game.lives, "KR_CONFIG.game.lives", { min: 1, integer: true });
      reqNum(game.onboardingShield, "KR_CONFIG.game.onboardingShield", { min: 0, integer: true });
      reqNum(game.reboundDelayMs, "KR_CONFIG.game.reboundDelayMs", { min: 1, integer: true });
      if (game.service != null) {
        const service = reqObj(game.service, "KR_CONFIG.game.service");
        reqNum(service.centerMarginFrac, "KR_CONFIG.game.service.centerMarginFrac", { min: 0, max: 0.49 });
        reqNum(service.sidelineMarginFrac, "KR_CONFIG.game.service.sidelineMarginFrac", { min: 0, max: 0.49 });
        reqNum(service.depthMinFrac, "KR_CONFIG.game.service.depthMinFrac", { min: 0, max: 1 });
        reqNum(service.depthMaxFrac, "KR_CONFIG.game.service.depthMaxFrac", { min: 0, max: 1 });
        if (Number(service.depthMaxFrac) < Number(service.depthMinFrac)) {
          fail("KR_CONFIG.game.service.depthMaxFrac must be >= depthMinFrac");
        }
      }
      const timing = reqObj(game.timing, "KR_CONFIG.game.timing");
      reqNum(timing.niceThreshold, "KR_CONFIG.game.timing.niceThreshold", { min: 0, max: 1 });
      reqNum(timing.perfectThreshold, "KR_CONFIG.game.timing.perfectThreshold", { min: 0, max: 1 });
      reqNum(timing.sweetSpot, "KR_CONFIG.game.timing.sweetSpot", { min: 0, max: 1 });
      reqNum(timing.falloffWindow, "KR_CONFIG.game.timing.falloffWindow", { min: 0.01, max: 1 });
      reqNum(timing.autoHitGraceFrac, "KR_CONFIG.game.timing.autoHitGraceFrac", { min: 0, max: 1 });
      reqNum(timing.minBounceVisibleMs, "KR_CONFIG.game.timing.minBounceVisibleMs", { min: 0, integer: true });
      reqNum(timing.basePoints, "KR_CONFIG.game.timing.basePoints", { min: 1, integer: true });
      reqNum(timing.perfectPoints, "KR_CONFIG.game.timing.perfectPoints", { min: 1, integer: true });
      if (Number(timing.perfectThreshold) < Number(timing.niceThreshold)) fail("KR_CONFIG.game.timing.perfectThreshold must be >= niceThreshold");
      if (Number(timing.perfectPoints) < Number(timing.basePoints)) fail("KR_CONFIG.game.timing.perfectPoints must be >= basePoints");
      reqObj(game.speed, "KR_CONFIG.game.speed");
      reqNum(game.speed.base, "KR_CONFIG.game.speed.base", { min: 0.1 });
      reqNum(game.speed.accelPerSec, "KR_CONFIG.game.speed.accelPerSec", { min: 0 });
      reqObj(game.spawn, "KR_CONFIG.game.spawn");
      reqNum(game.spawn.initialMs, "KR_CONFIG.game.spawn.initialMs", { min: 1, integer: true });
      reqNum(game.spawn.decayPerSec, "KR_CONFIG.game.spawn.decayPerSec", { min: 0 });
      reqNum(game.spawn.minMs, "KR_CONFIG.game.spawn.minMs", { min: 1, integer: true });
      reqObj(game.window, "KR_CONFIG.game.window");
      reqNum(game.window.initialMs, "KR_CONFIG.game.window.initialMs", { min: 1, integer: true });
      reqNum(game.window.decayPerSec, "KR_CONFIG.game.window.decayPerSec", { min: 0 });
      reqNum(game.window.minMs, "KR_CONFIG.game.window.minMs", { min: 1, integer: true });
      reqObj(game.kitchenRatio, "KR_CONFIG.game.kitchenRatio");
      reqNum(game.kitchenRatio.base, "KR_CONFIG.game.kitchenRatio.base", { min: 0, max: 1 });
      reqNum(game.kitchenRatio.growthPerSec, "KR_CONFIG.game.kitchenRatio.growthPerSec", { min: 0 });
      reqNum(game.kitchenRatio.max, "KR_CONFIG.game.kitchenRatio.max", { min: 0, max: 1 });
      if (game.trajectory != null) {
        const trajectory = reqObj(game.trajectory, "KR_CONFIG.game.trajectory");
        reqNum(trajectory.lateralSpreadFrac, "KR_CONFIG.game.trajectory.lateralSpreadFrac", { min: 0.05, max: 0.6 });
        reqNum(trajectory.edgeMarginFrac, "KR_CONFIG.game.trajectory.edgeMarginFrac", { min: 0.01, max: 0.3 });
        reqNum(trajectory.arcMinFrac, "KR_CONFIG.game.trajectory.arcMinFrac", { min: 0.005, max: 0.2 });
        reqNum(trajectory.arcMaxFrac, "KR_CONFIG.game.trajectory.arcMaxFrac", { min: 0.01, max: 0.3 });
        reqNum(trajectory.arcDepthWeight, "KR_CONFIG.game.trajectory.arcDepthWeight", { min: 0, max: 1 });
        reqNum(trajectory.descentPower, "KR_CONFIG.game.trajectory.descentPower", { min: 0.8, max: 2 });
        reqNum(trajectory.returnArcScale, "KR_CONFIG.game.trajectory.returnArcScale", { min: 0.1, max: 2 });
        reqNum(trajectory.returnTravelScale, "KR_CONFIG.game.trajectory.returnTravelScale", { min: 0.1, max: 2 });
      }
      if (game.ballTypes != null) {
        reqObj(game.ballTypes, "KR_CONFIG.game.ballTypes");
        Object.keys(game.ballTypes).forEach((key) => {
          const bt = reqObj(game.ballTypes[key], "KR_CONFIG.game.ballTypes." + key);
          reqNum(bt.unlockAfterSec, "KR_CONFIG.game.ballTypes." + key + ".unlockAfterSec", { min: 0 });
          if (bt.unlockAfterScore != null) reqNum(bt.unlockAfterScore, "KR_CONFIG.game.ballTypes." + key + ".unlockAfterScore", { min: 0, integer: true });
          reqNum(bt.weight, "KR_CONFIG.game.ballTypes." + key + ".weight", { min: 0 });
          if (bt.weightGrowthPerSec != null) reqNum(bt.weightGrowthPerSec, "KR_CONFIG.game.ballTypes." + key + ".weightGrowthPerSec", { min: 0 });
          if (bt.weightGrowthPerScore != null) reqNum(bt.weightGrowthPerScore, "KR_CONFIG.game.ballTypes." + key + ".weightGrowthPerScore", { min: 0 });
          reqNum(bt.speedMultiplier, "KR_CONFIG.game.ballTypes." + key + ".speedMultiplier", { min: 0.01 });
          reqNum(bt.tapWindowMultiplier, "KR_CONFIG.game.ballTypes." + key + ".tapWindowMultiplier", { min: 0.01 });
          reqNum(bt.radiusMultiplier, "KR_CONFIG.game.ballTypes." + key + ".radiusMultiplier", { min: 0.01 });
          if (bt.arcHeightMultiplier != null) reqNum(bt.arcHeightMultiplier, "KR_CONFIG.game.ballTypes." + key + ".arcHeightMultiplier", { min: 0.1, max: 3 });
          if (bt.bounceHeightMultiplier != null) reqNum(bt.bounceHeightMultiplier, "KR_CONFIG.game.ballTypes." + key + ".bounceHeightMultiplier", { min: 0.05, max: 3 });
          if (bt.reboundDelayMultiplier != null) reqNum(bt.reboundDelayMultiplier, "KR_CONFIG.game.ballTypes." + key + ".reboundDelayMultiplier", { min: 0.05, max: 3 });
          reqBool(bt.forceKitchen, "KR_CONFIG.game.ballTypes." + key + ".forceKitchen");
        });
      }

      const daily = reqObj(cfg.daily, "KR_CONFIG.daily");
      reqBool(daily.enabled, "KR_CONFIG.daily.enabled");
      reqStr(daily.mode, "KR_CONFIG.daily.mode");
      if (daily.mode !== enums.GAME_MODES.RUN) fail("KR_CONFIG.daily.mode must equal KR_ENUMS.GAME_MODES.RUN");

      const canvas = reqObj(cfg.canvas, "KR_CONFIG.canvas");
      reqNum(canvas.kitchenLineY, "KR_CONFIG.canvas.kitchenLineY", { min: 0.01, max: 0.99 });
      reqNum(canvas.minLandingYFrac, "KR_CONFIG.canvas.minLandingYFrac", { min: 0, max: 0.99 });
      reqNum(canvas.ballRadius, "KR_CONFIG.canvas.ballRadius", { min: 1, integer: true });
      reqNum(canvas.opponentCourtScale, "KR_CONFIG.canvas.opponentCourtScale", { min: 0.1, max: 1 });
      reqNum(canvas.sidelineInsetFrac, "KR_CONFIG.canvas.sidelineInsetFrac", { min: 0.01, max: 0.3 });
      if (canvas.nearSidelineInsetFrac != null) reqNum(canvas.nearSidelineInsetFrac, "KR_CONFIG.canvas.nearSidelineInsetFrac", { min: 0.01, max: 0.3 });
      if (canvas.netSidelineInsetFrac != null) reqNum(canvas.netSidelineInsetFrac, "KR_CONFIG.canvas.netSidelineInsetFrac", { min: 0.05, max: 0.4 });
      if (canvas.farSidelineInsetFrac != null) reqNum(canvas.farSidelineInsetFrac, "KR_CONFIG.canvas.farSidelineInsetFrac", { min: 0.1, max: 0.45 });
      reqNum(canvas.kitchenLineWidth, "KR_CONFIG.canvas.kitchenLineWidth", { min: 1 });
      reqNum(canvas.baselineLineWidth, "KR_CONFIG.canvas.baselineLineWidth", { min: 1 });
      reqNum(canvas.sidelineLineWidth, "KR_CONFIG.canvas.sidelineLineWidth", { min: 1 });
      reqNum(canvas.centerLineWidth, "KR_CONFIG.canvas.centerLineWidth", { min: 1 });
      reqNum(canvas.netCenterSagPx, "KR_CONFIG.canvas.netCenterSagPx", { min: 0, integer: true });
      reqNum(canvas.netPostHeightPx, "KR_CONFIG.canvas.netPostHeightPx", { min: 1, integer: true });
      reqNum(canvas.netLineWidth, "KR_CONFIG.canvas.netLineWidth", { min: 1 });
      reqNum(canvas.netBandDepthPx, "KR_CONFIG.canvas.netBandDepthPx", { min: 1, integer: true });
      reqNum(canvas.netMeshRows, "KR_CONFIG.canvas.netMeshRows", { min: 1, integer: true });
      reqNum(canvas.netMeshColGapPx, "KR_CONFIG.canvas.netMeshColGapPx", { min: 4, integer: true });
      reqNum(canvas.netNearHighlightThresholdPx, "KR_CONFIG.canvas.netNearHighlightThresholdPx", { min: 0, integer: true });
      reqNum(canvas.netNearHighlightWidth, "KR_CONFIG.canvas.netNearHighlightWidth", { min: 1 });
      reqNum(canvas.hitTolerancePx, "KR_CONFIG.canvas.hitTolerancePx", { min: 0, integer: true });
      reqNum(canvas.shadowGrowthFactor, "KR_CONFIG.canvas.shadowGrowthFactor", { min: 0, max: 1 });
      reqNum(canvas.shadowMinScale, "KR_CONFIG.canvas.shadowMinScale", { min: 0.05, max: 3 });
      reqNum(canvas.shadowMaxScale, "KR_CONFIG.canvas.shadowMaxScale", { min: 0.05, max: 4 });
      reqNum(canvas.landingMarkerRadiusPx, "KR_CONFIG.canvas.landingMarkerRadiusPx", { min: 1, integer: true });
      reqNum(canvas.landingMarkerPulseMs, "KR_CONFIG.canvas.landingMarkerPulseMs", { min: 1, integer: true });
      reqNum(canvas.serveLabelMs, "KR_CONFIG.canvas.serveLabelMs", { min: 0, integer: true });
      reqNum(canvas.specialBallBadgeMs, "KR_CONFIG.canvas.specialBallBadgeMs", { min: 0, integer: true });
      reqNum(canvas.ballOutlineWidth, "KR_CONFIG.canvas.ballOutlineWidth", { min: 0 });
      reqNum(canvas.ballGlowScale, "KR_CONFIG.canvas.ballGlowScale", { min: 1, max: 4 });
      reqNum(canvas.ballDepthScaleNear, "KR_CONFIG.canvas.ballDepthScaleNear", { min: 0.2, max: 2 });
      reqNum(canvas.ballDepthScaleFar, "KR_CONFIG.canvas.ballDepthScaleFar", { min: 0.2, max: 2 });
      reqNum(canvas.ballHeightScaleNear, "KR_CONFIG.canvas.ballHeightScaleNear", { min: 0.1, max: 2 });
      reqNum(canvas.ballHeightScaleFar, "KR_CONFIG.canvas.ballHeightScaleFar", { min: 0.1, max: 2 });
      reqNum(canvas.playerDepthScaleNear, "KR_CONFIG.canvas.playerDepthScaleNear", { min: 0.5, max: 2 });
      reqNum(canvas.playerDepthScaleFar, "KR_CONFIG.canvas.playerDepthScaleFar", { min: 0.5, max: 2 });
      reqNum(canvas.playerOutlineWidth, "KR_CONFIG.canvas.playerOutlineWidth", { min: 0.5, max: 8 });
      reqNum(canvas.opponentOutlineWidth, "KR_CONFIG.canvas.opponentOutlineWidth", { min: 0.5, max: 8 });
      reqNum(canvas.actorIdleBreathePx, "KR_CONFIG.canvas.actorIdleBreathePx", { min: 0, max: 12 });
      reqNum(canvas.playerRunLeanPx, "KR_CONFIG.canvas.playerRunLeanPx", { min: 0, max: 20 });
      reqNum(canvas.playerSwingArcScale, "KR_CONFIG.canvas.playerSwingArcScale", { min: 0.5, max: 3 });
      reqNum(canvas.opponentReadyOffsetPx, "KR_CONFIG.canvas.opponentReadyOffsetPx", { min: 0, max: 12 });
      reqNum(canvas.opponentSwingArcScale, "KR_CONFIG.canvas.opponentSwingArcScale", { min: 0.5, max: 3 });
      reqNum(canvas.impactDustCount, "KR_CONFIG.canvas.impactDustCount", { min: 0, max: 12, integer: true });
      reqNum(canvas.trajectoryTrailSegments, "KR_CONFIG.canvas.trajectoryTrailSegments", { min: 0, max: 12, integer: true });
      reqNum(canvas.trajectoryTrailAlpha, "KR_CONFIG.canvas.trajectoryTrailAlpha", { min: 0, max: 1 });
      reqNum(canvas.controlZoneInsetPx, "KR_CONFIG.canvas.controlZoneInsetPx", { min: 0, integer: true });
      reqNum(canvas.controlZoneFontFrac, "KR_CONFIG.canvas.controlZoneFontFrac", { min: 0.005, max: 0.05 });
      reqNum(canvas.controlZoneLabelYFrac, "KR_CONFIG.canvas.controlZoneLabelYFrac", { min: 0.1, max: 0.95 });
      reqNum(canvas.bounceSecondHopScale, "KR_CONFIG.canvas.bounceSecondHopScale", { min: 0, max: 1 });
      reqNum(canvas.bounceSquashMaxFrac, "KR_CONFIG.canvas.bounceSquashMaxFrac", { min: 0, max: 0.8 });
      reqNum(canvas.bounceHeight, "KR_CONFIG.canvas.bounceHeight", { min: 0 });
      reqNum(canvas.bounceAnimMs, "KR_CONFIG.canvas.bounceAnimMs", { min: 1, integer: true });
      reqNum(canvas.smashOutMs, "KR_CONFIG.canvas.smashOutMs", { min: 1, integer: true });
      reqNum(canvas.smashOutDistance, "KR_CONFIG.canvas.smashOutDistance", { min: 1 });
      reqNum(canvas.scorePopupMs, "KR_CONFIG.canvas.scorePopupMs", { min: 1, integer: true });

      // V2: Court layout validation (USAP-faithful proportions)
      const court = reqObj(cfg.court, "KR_CONFIG.court");
      reqNum(court.netY, "KR_CONFIG.court.netY", { min: 0.05, max: 0.3 });
      reqNum(court.kitchenLineY, "KR_CONFIG.court.kitchenLineY", { min: 0.2, max: 0.6 });
      reqNum(court.baselineY, "KR_CONFIG.court.baselineY", { min: 0.7, max: 0.95 });
      reqNum(court.playerY, "KR_CONFIG.court.playerY", { min: 0.5, max: 0.9 });
      reqNum(court.opponentY, "KR_CONFIG.court.opponentY", { min: 0.02, max: 0.2 });
      reqNum(court.controlsY, "KR_CONFIG.court.controlsY", { min: 0.8, max: 1.0 });
      reqNum(court.playerSpeed, "KR_CONFIG.court.playerSpeed", { min: 0.1 });
      reqNum(court.desktopMouseDeadZonePx, "KR_CONFIG.court.desktopMouseDeadZonePx", { min: 0 });
      reqNum(court.hitRange, "KR_CONFIG.court.hitRange", { min: 1 });

      const limits = reqObj(cfg.limits, "KR_CONFIG.limits");
      reqNum(limits.freeRuns, "KR_CONFIG.limits.freeRuns", { min: 0, integer: true });

      const sprint = reqObj(cfg.sprint, "KR_CONFIG.sprint");
      reqNum(sprint.durationMs, "KR_CONFIG.sprint.durationMs", { min: 1, integer: true });
      reqNum(sprint.faultPenaltyMs, "KR_CONFIG.sprint.faultPenaltyMs", { min: 1, integer: true });
      reqNum(sprint.freeRunsLimit, "KR_CONFIG.sprint.freeRunsLimit", { min: 0, integer: true });

      const audio = reqObj(cfg.audio, "KR_CONFIG.audio");
      reqBool(audio.enabled, "KR_CONFIG.audio.enabled");
      reqNum(audio.smashVolume, "KR_CONFIG.audio.smashVolume", { min: 0, max: 1 });
      reqNum(audio.faultVolume, "KR_CONFIG.audio.faultVolume", { min: 0, max: 1 });
      reqNum(audio.bounceVolume, "KR_CONFIG.audio.bounceVolume", { min: 0, max: 1 });

      const challenges = reqObj(cfg.challenges, "KR_CONFIG.challenges");
      reqNum(challenges.cleanRunMinSmashes, "KR_CONFIG.challenges.cleanRunMinSmashes", { min: 1, integer: true });
      reqNum(challenges.streakThreshold, "KR_CONFIG.challenges.streakThreshold", { min: 1, integer: true });
      reqNum(challenges.streakTargetBonus, "KR_CONFIG.challenges.streakTargetBonus", { min: 1, integer: true });
      reqNum(challenges.faultThreshold, "KR_CONFIG.challenges.faultThreshold", { min: 0, integer: true });
      reqNum(challenges.lowAccuracyPct, "KR_CONFIG.challenges.lowAccuracyPct", { min: 0, max: 100, integer: true });
      reqNum(challenges.lowAccuracyMinSmashes, "KR_CONFIG.challenges.lowAccuracyMinSmashes", { min: 1, integer: true });
      reqNum(challenges.improvedAccuracyMinGainPct, "KR_CONFIG.challenges.improvedAccuracyMinGainPct", { min: 1, max: 100, integer: true });
      reqNum(challenges.fewerFaultsMinDelta, "KR_CONFIG.challenges.fewerFaultsMinDelta", { min: 1, integer: true });
      reqNum(challenges.betterStreakMinDelta, "KR_CONFIG.challenges.betterStreakMinDelta", { min: 1, integer: true });

      const juice = reqObj(cfg.juice, "KR_CONFIG.juice");
      reqNum(juice.smashFlashMs, "KR_CONFIG.juice.smashFlashMs", { min: 1, integer: true });
      reqNum(juice.faultFlashMs, "KR_CONFIG.juice.faultFlashMs", { min: 1, integer: true });
      reqNum(juice.faultShakeMs, "KR_CONFIG.juice.faultShakeMs", { min: 1, integer: true });
      reqNum(juice.faultShakeIntensity, "KR_CONFIG.juice.faultShakeIntensity", { min: 0 });
      reqNum(juice.bounceRingMs, "KR_CONFIG.juice.bounceRingMs", { min: 1, integer: true });
      reqNum(juice.sprintPenaltyMs, "KR_CONFIG.juice.sprintPenaltyMs", { min: 1, integer: true });
      reqNum(juice.milestoneGlowMs, "KR_CONFIG.juice.milestoneGlowMs", { min: 1, integer: true });
      reqNum(juice.firstFaultOverlayMs, "KR_CONFIG.juice.firstFaultOverlayMs", { min: 1, integer: true });
      reqNum(juice.repeatFaultOverlayMs, "KR_CONFIG.juice.repeatFaultOverlayMs", { min: 1, integer: true });

      const ui = reqObj(cfg.ui, "KR_CONFIG.ui");
      reqBool(ui.toastDismissOnTap, "KR_CONFIG.ui.toastDismissOnTap");
      reqNum(ui.runStartOverlayMs, "KR_CONFIG.ui.runStartOverlayMs", { min: 1, integer: true });
      reqNum(ui.runStartOverlayFastTrackMs, "KR_CONFIG.ui.runStartOverlayFastTrackMs", { min: 0, integer: true });
      reqNum(ui.dailyObjectiveOverlayMs, "KR_CONFIG.ui.dailyObjectiveOverlayMs", { min: 1, integer: true });
      reqNum(ui.lifeLostOverlayMs, "KR_CONFIG.ui.lifeLostOverlayMs", { min: 1, integer: true });
      reqNum(ui.desktopClickHitReleaseMs, "KR_CONFIG.ui.desktopClickHitReleaseMs", { min: 0, integer: true });
      reqNum(ui.opponentSwingMs, "KR_CONFIG.ui.opponentSwingMs", { min: 1, integer: true });
      reqNum(ui.firstFaultExplainUntilFaultCount, "KR_CONFIG.ui.firstFaultExplainUntilFaultCount", { min: 0, integer: true });
      reqNum(ui.lastLifeTriggerLives, "KR_CONFIG.ui.lastLifeTriggerLives", { min: 0, integer: true });
      reqNum(ui.gameplayPulseMs, "KR_CONFIG.ui.gameplayPulseMs", { min: 1, integer: true });
      reqNum(ui.endRecordMomentMs, "KR_CONFIG.ui.endRecordMomentMs", { min: 1, integer: true });
      reqNum(ui.paywallTickerMs, "KR_CONFIG.ui.paywallTickerMs", { min: 1, integer: true });
      reqObj(ui.toast, "KR_CONFIG.ui.toast");
      reqObj(ui.toast.default, "KR_CONFIG.ui.toast.default");
      reqNum(ui.toast.default.delayMs, "KR_CONFIG.ui.toast.default.delayMs", { min: 0, integer: true });
      reqNum(ui.toast.default.durationMs, "KR_CONFIG.ui.toast.default.durationMs", { min: 1, integer: true });
      reqObj(ui.toast.positive, "KR_CONFIG.ui.toast.positive");
      reqNum(ui.toast.positive.delayMs, "KR_CONFIG.ui.toast.positive.delayMs", { min: 0, integer: true });
      reqNum(ui.toast.positive.durationMs, "KR_CONFIG.ui.toast.positive.durationMs", { min: 1, integer: true });

      reqStr(cfg.premiumCodeRegex, "KR_CONFIG.premiumCodeRegex");
      try { new RegExp(cfg.premiumCodeRegex); } catch (_) { fail("KR_CONFIG.premiumCodeRegex invalid"); }
      reqStr(cfg.stripeEarlyPaymentUrl, "KR_CONFIG.stripeEarlyPaymentUrl");
      reqStr(cfg.stripeStandardPaymentUrl, "KR_CONFIG.stripeStandardPaymentUrl");
    },

    applyBrandText: function () {
      try {
        const brandHtml = String((window.KR_WORDING && window.KR_WORDING.brand && window.KR_WORDING.brand.creatorLineHtml) || "").trim();
        const brandText = String((window.KR_WORDING && window.KR_WORDING.brand && window.KR_WORDING.brand.creatorLine) || "").trim();

        if (brandHtml || brandText) {
          document.querySelectorAll('[data-kr-brand="creatorLine"]').forEach((node) => {
            if (!node) return;
            if (brandHtml) node.innerHTML = brandHtml;
            else node.textContent = brandText;
          });
        }

        const version = String(window.KR_CONFIG?.version || "").trim();
        const versionPrefix = String(window.KR_WORDING?.system?.versionPrefix || "").trim();
        if (version) {
          document.querySelectorAll("[data-kr-version]").forEach((node) => {
            if (node) node.textContent = `${versionPrefix}${version}`;
          });
        }

        const tyf = document.getElementById("kr-parent-link");
        const tyfSep = document.querySelector(".kr-footer-sep--parent");
        const parentUrl = String(window.KR_CONFIG?.identity?.parentUrl || "").trim();

        if (tyf && parentUrl) {
          tyf.setAttribute("href", parentUrl);
          let label = parentUrl;
          try { label = new URL(parentUrl).hostname.replace(/^www\./i, ""); } catch (_) { }
          tyf.textContent = label;
          if (tyfSep) tyfSep.style.display = "";
        } else {
          if (tyf) { tyf.textContent = ""; tyf.removeAttribute("href"); }
          if (tyfSep) tyfSep.style.display = "none";
        }

        const fw = window.KR_WORDING?.footer || {};
        const privacy = document.getElementById("kr-privacy-link");
        const terms = document.getElementById("kr-terms-link");
        if (privacy) privacy.textContent = String(fw.privacy || "").trim();
        if (terms) terms.textContent = String(fw.terms || "").trim();

        document.querySelectorAll(".kr-footer-row--links .kr-footer-sep").forEach((sep) => {
          if (!sep) return;
          const prev = sep.previousElementSibling;
          const next = sep.nextElementSibling;
          const prevText = prev ? String(prev.textContent || "").trim() : "";
          const nextText = next ? String(next.textContent || "").trim() : "";
          sep.style.display = (prevText && nextText) ? "" : "none";
        });
      } catch (_) { }
    }
  };

})();
