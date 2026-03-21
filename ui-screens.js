// ui-screens.js - non-playing screen rendering for Kitchen Rush

(() => {
  "use strict";

  function install(UIModule, deps) {
    if (!UIModule || !UIModule.prototype) throw new Error("KR_UI_SCREENS.install(): UI constructor missing");

    var escapeHtml = deps && deps.escapeHtml;
    var fillTemplate = deps && deps.fillTemplate;
    var pickChallenge = deps && deps.pickChallenge;
    var mmss = deps && deps.mmss;
    var formatCents = deps && deps.formatCents;
    var requiredConfigNumber = deps && deps.requiredConfigNumber;
    var STATES = deps && deps.STATES;
    var MODES = deps && deps.MODES;

    if (typeof escapeHtml !== "function") throw new Error("KR_UI_SCREENS.install(): escapeHtml missing");
    if (typeof fillTemplate !== "function") throw new Error("KR_UI_SCREENS.install(): fillTemplate missing");
    if (typeof pickChallenge !== "function") throw new Error("KR_UI_SCREENS.install(): pickChallenge missing");
    if (typeof mmss !== "function") throw new Error("KR_UI_SCREENS.install(): mmss missing");
    if (typeof formatCents !== "function") throw new Error("KR_UI_SCREENS.install(): formatCents missing");
    if (typeof requiredConfigNumber !== "function") throw new Error("KR_UI_SCREENS.install(): requiredConfigNumber missing");
    if (!STATES || !MODES) throw new Error("KR_UI_SCREENS.install(): enums missing");

    function normalizeStoredRun(entry) {
      if (!entry || typeof entry !== "object") return null;
      var meta = entry.meta || {};
      return {
        mode: meta.mode || MODES.RUN,
        isDaily: !!meta.isDaily,
        smashes: Number(entry.smashes || 0),
        totalFaulted: Number(meta.totalFaulted || 0),
        totalMissed: Number(meta.totalMissed || 0),
        totalSpawned: Number(meta.totalSpawned || 0),
        elapsedMs: Number(meta.elapsedMs || 0),
        bestStreak: Number(meta.bestStreak || 0),
        newBest: false
      };
    }

    function getAccuracyPct(run) {
      var totalSpawned = Number(run && run.totalSpawned || 0);
      var smashes = Number(run && run.smashes || 0);
      if (totalSpawned <= 0) return 0;
      return Math.round((smashes / totalSpawned) * 100);
    }

    function getRunImprovement(current, previous, challengeCfg) {
      if (!current || !previous) return null;
      if (current.mode !== MODES.RUN || previous.mode !== MODES.RUN) return null;
      if ((current.totalSpawned || 0) <= 0 || (previous.totalSpawned || 0) <= 0) return null;

      var accuracyGainMin = requiredConfigNumber(challengeCfg.improvedAccuracyMinGainPct, "KR_CONFIG.challenges.improvedAccuracyMinGainPct", { min: 1, max: 100, integer: true });
      var fewerFaultsMin = requiredConfigNumber(challengeCfg.fewerFaultsMinDelta, "KR_CONFIG.challenges.fewerFaultsMinDelta", { min: 1, integer: true });
      var betterStreakMin = requiredConfigNumber(challengeCfg.betterStreakMinDelta, "KR_CONFIG.challenges.betterStreakMinDelta", { min: 1, integer: true });
      var accuracyGain = getAccuracyPct(current) - getAccuracyPct(previous);
      var fewerFaults = Number(previous.totalFaulted || 0) - Number(current.totalFaulted || 0);
      var betterStreak = Number(current.bestStreak || 0) - Number(previous.bestStreak || 0);

      return {
        accuracyGain: accuracyGain,
        fewerFaults: fewerFaults,
        betterStreak: betterStreak,
        accuracyImproved: accuracyGain >= accuracyGainMin,
        faultsImproved: fewerFaults >= fewerFaultsMin,
        streakImproved: betterStreak >= betterStreakMin
      };
    }

    function getBallPowerLabel(wording, key) {
      var uiw = (wording && wording.ui) ? wording.ui : {};
      if (key === "dink") return String(uiw.specialBallDink || "").trim();
      if (key === "lob") return String(uiw.specialBallLob || "").trim();
      if (key === "fast") return String(uiw.specialBallFast || "").trim();
      if (key === "skid") return String(uiw.specialBallSkid || "").trim();
      if (key === "heavy") return String(uiw.specialBallHeavy || "").trim();
      return "";
    }

    function getNextBallPower(config, wording, currentScore) {
      var ballTypes = config && config.game && config.game.ballTypes;
      if (!ballTypes || typeof ballTypes !== "object") return null;
      var score = Math.max(0, Math.floor(Number(currentScore || 0)));
      var next = null;
      Object.keys(ballTypes).forEach(function (key) {
        var bt = ballTypes[key];
        if (!bt || typeof bt !== "object" || bt.unlockAfterScore == null) return;
        var unlockScore = requiredConfigNumber(bt.unlockAfterScore, "KR_CONFIG.game.ballTypes." + key + ".unlockAfterScore", { min: 0, integer: true });
        if (unlockScore <= score) return;
        if (!next || unlockScore < next.score) {
          next = {
            key: key,
            score: unlockScore,
            label: getBallPowerLabel(wording, key)
          };
        }
      });
      return (next && next.label) ? next : null;
    }

    UIModule.prototype.render = function () {
      switch (this.state) {
        case STATES.LANDING: this._renderLanding(); break;
        case STATES.PLAYING: this._renderPlaying(); break;
        case STATES.END: this._renderEnd(); break;
        case STATES.PAYWALL: this._renderPaywall(); break;
      }
    };

    UIModule.prototype._renderLanding = function () {
      var cfg = this.config;
      var w = this.wording;
      var lw = (w && w.landing) ? w.landing : {};
      var premium = !!(this._store("isPremium"));
      var pb = this._store("getPersonalBest") || {};
      var best = pb.bestSmashes || 0;
      var balance = this._store("getRunsBalance") || 0;
      var counters = this._store("getCounters") || {};
      var runCompletes = counters.runCompletes || 0;

      var ctaLabel = (runCompletes > 0)
        ? escapeHtml(lw.ctaPlayAfterFirstRun || lw.ctaPlay || "")
        : escapeHtml(lw.ctaPlay || "");

      var showChest = this._canShowChest(STATES.LANDING);
      var solved = !!(this._store("hasSprintChestHintSolved"));
      var chestHtml = showChest
        ? '<button class="kr-btn-icon' + (solved ? "" : " kr-btn-icon--tease") + '" data-kr-secret="chest" aria-label="' + escapeHtml((w?.sprint || {}).chestAria || "") + '">\uD83C\uDF81</button>' : "";

      var chestHintHtml = (showChest && !solved)
        ? '<p class="kr-chest-hint-inline kr-muted">' + escapeHtml((w?.sprint || {}).chestHint || "") + '</p>' : "";

      var bestHtml = "";
      if (best > 0) {
        var targetSmashes = best + 1;
        var targetMsg = String(lw.bestTargetTemplate || "").trim();
        if (targetMsg) {
          bestHtml = '<div class="kr-landing-best">';
          bestHtml += '<p class="kr-landing-best-score">' + escapeHtml(lw.bestLabel || "") + ': ' + best + '</p>';
          bestHtml += '<p class="kr-landing-best-target">' + escapeHtml(fillTemplate(targetMsg, { target: targetSmashes })) + '</p>';
          bestHtml += '</div>';
        } else {
          bestHtml = '<p class="kr-landing-best-score">' + escapeHtml(lw.bestLabel || "") + ': ' + best + '</p>';
        }
      }

      var lifetimeHtml = "";
      var lifetimeTotal = counters.totalLifetimeSmashes || 0;
      if (lifetimeTotal > 0) {
        var ltTpl = String(lw.lifetimeTemplate || "").trim();
        if (ltTpl) lifetimeHtml = '<p class="kr-muted kr-landing-lifetime">' + escapeHtml(fillTemplate(ltTpl, { total: lifetimeTotal })) + '</p>';
      }

      var sparkHtml = "";
      if (cfg?.landingStats?.enabled) {
        var count = Number(cfg.landingStats.sparkRunsCount) || 5;
        var lastRuns = this._store("getLastRuns", count) || [];
        if (lastRuns.length > 0) {
          var maxS = 1;
          for (var i = 0; i < lastRuns.length; i += 1) { if ((lastRuns[i].smashes || 0) > maxS) maxS = lastRuns[i].smashes; }
          var barsHtml = "";
          for (var j = 0; j < lastRuns.length; j += 1) {
            var pct = Math.round(((lastRuns[j].smashes || 0) / maxS) * 100);
            var bucket = Math.max(1, Math.min(10, Math.round(pct / 10)));
            barsHtml += '<div class="kr-spark-bar kr-spark-bar--h' + bucket + '" title="' + (lastRuns[j].smashes || 0) + ' Smashes"></div>';
          }
          sparkHtml = '<div class="kr-spark-bars">' + barsHtml + '</div>';
        }
      }

      var earlyTickerHtml = "";
      try {
        var ep = this._store("getEarlyPriceState") || null;
        if (ep && ep.phase === "EARLY" && Number(ep.remainingMs) > 0) {
          var tl = String((w?.paywall || {}).timerLabel || "").trim();
          if (tl) earlyTickerHtml = '<p class="kr-muted kr-early-timer">' + escapeHtml(tl) + " " + mmss(ep.remainingMs) + '</p>';
        }
      } catch (_) { }

      var landingChallengeHtml = "";
      var recentRun = (this._runtime && this._runtime.lastRun && this._runtime.lastRun.mode === MODES.RUN && this._runtime.lastRun.totalSpawned > 0)
        ? this._runtime.lastRun : null;
      var priorRun = (this._runtime && this._runtime.previousRun && this._runtime.previousRun.mode === MODES.RUN && this._runtime.previousRun.totalSpawned > 0)
        ? this._runtime.previousRun : null;
      if (!recentRun) {
        var storedRuns = this._store("getLastRuns", 2) || [];
        if (storedRuns.length > 0) recentRun = normalizeStoredRun(storedRuns[0]);
        if (storedRuns.length > 1) priorRun = normalizeStoredRun(storedRuns[1]);
      }
      if (recentRun && best > 0 && (premium || balance > 0)) {
        var lch = (w?.challenges) || {};
        var lcCfg = (cfg?.challenges) || {};
        var recentImprove = getRunImprovement(recentRun, priorRun, lcCfg);
        var pF = recentRun.totalFaulted || 0;
        var pS = recentRun.bestStreak || 0;
        var pG = (!recentRun.newBest && recentRun.smashes > 0) ? (best - recentRun.smashes) : 0;

        landingChallengeHtml = pickChallenge([
          { test: !!(recentImprove && recentImprove.faultsImproved), key: "landingFewerFaults", vars: { delta: recentImprove.fewerFaults } },
          { test: !!(recentImprove && recentImprove.accuracyImproved), key: "landingImprovedAccuracy", vars: { delta: recentImprove.accuracyGain } },
          { test: !!(recentImprove && recentImprove.streakImproved), key: "landingBetterStreak", vars: { delta: recentImprove.betterStreak } },
          { test: pG > 0 && pG <= (Number(lcCfg.nearBestGap) || 5), key: "landingNearBest", vars: { gap: pG } },
          { test: pF >= (Number(lcCfg.faultThreshold) || 2), key: "landingComeback", vars: { faults: pF } },
          { test: pS >= (Number(lcCfg.streakThreshold) || 8), key: "landingStreakPush", vars: { streak: pS } }
        ], lch);
      }

      var premiumLabelHtml = "";
      if (premium) {
        var ulLabel = String(lw.premiumLabel || "").trim();
        if (ulLabel) premiumLabelHtml = '<p class="kr-muted">' + escapeHtml(ulLabel) + '</p>';
      }

      var nextPowerHtml = "";
      var progressionScore = Math.max(best || 0, recentRun ? Number(recentRun.smashes || 0) : 0);
      var nextPower = getNextBallPower(cfg, w, progressionScore);
      if (nextPower) {
        var npLabel = String(lw.nextPowerLabel || "").trim();
        var npText = fillTemplate(String(lw.nextPowerTemplate || "").trim(), { power: nextPower.label, score: nextPower.score });
        if (npLabel && npText) {
          nextPowerHtml = '<p class="kr-muted kr-landing-next-power"><strong>' + escapeHtml(npLabel) + '</strong> ' + escapeHtml(npText) + '</p>';
        }
      }

      var postPaywallHtml = "";
      var postPaywallActive = false;
      if (!premium && balance <= 0 && runCompletes > 0) {
        postPaywallActive = true;
        postPaywallHtml = '<div class="kr-box kr-box--tinted">';
        var sprintUsed = this._store("getSprintFreeRunsUsed") || 0;
        if (showChest && sprintUsed === 0 && String(lw.postPaywallSbTitle || "").trim()) {
          postPaywallHtml += '<p><strong>' + escapeHtml(lw.postPaywallSbTitle || "") + '</strong></p>';
          postPaywallHtml += '<p class="kr-muted">' + escapeHtml(lw.postPaywallSbBody || "") + '</p>';
        } else {
          postPaywallHtml += '<p>' + escapeHtml(lw.postPaywallTitle || "") + '</p>';
          postPaywallHtml += '<p class="kr-muted">' + escapeHtml(lw.postPaywallBody || "") + '</p>';
          postPaywallHtml += '<button class="kr-btn kr-btn--secondary" data-action="show-paywall">' + escapeHtml(lw.postPaywallCta || "") + '</button>';
        }
        postPaywallHtml += '</div>';
      }

      var showWaitlistLanding = !!this._store("shouldShowWaitlistNow", {
        screen: STATES.LANDING,
        inRun: false,
        premium: premium,
        balance: balance,
        postPaywallActive: postPaywallActive
      });

      var houseAdHtml = "";
      if (this._store("shouldShowHouseAdNow", {
        screen: STATES.LANDING,
        inRun: false,
        premium: premium,
        balance: balance,
        postPaywallActive: postPaywallActive,
        waitlistActive: showWaitlistLanding
      })) {
        var ha = (w && w.houseAd) ? w.houseAd : {};
        houseAdHtml = '<div class="kr-box">';
        houseAdHtml += '<p>' + escapeHtml(ha.bodyLine1 || "") + '</p>';
        houseAdHtml += '<p class="kr-muted">' + escapeHtml(ha.bodyLine2 || "") + '</p>';
        houseAdHtml += '<div class="kr-actions">';
        houseAdHtml += '<button class="kr-btn kr-btn--secondary" data-action="house-ad-open">' + escapeHtml(ha.ctaPrimary || "") + '</button>';
        houseAdHtml += '<button class="kr-btn kr-btn--secondary" data-action="house-ad-later">' + escapeHtml(ha.ctaRemindLater || "") + '</button>';
        houseAdHtml += '</div></div>';
      }

      var waitlistHtml = "";
      if (showWaitlistLanding) {
        var wl = (w && w.waitlist) ? w.waitlist : {};
        var wlLabel = String(wl.ctaLabel || "").trim();
        var wlBody = String(wl.disclaimer || "").trim();
        var wlCta = String(wl.cta || "").trim();
        if (wlLabel && wlCta) {
          waitlistHtml = '<div class="kr-box">';
          waitlistHtml += '<p>' + escapeHtml(wlLabel) + '</p>';
          if (wlBody) waitlistHtml += '<p class="kr-muted">' + escapeHtml(wlBody) + '</p>';
          waitlistHtml += '<div class="kr-actions">';
          waitlistHtml += '<button class="kr-btn kr-btn--secondary" data-action="waitlist">' + escapeHtml(wlCta) + '</button>';
          waitlistHtml += '</div></div>';
        }
      }

      var primaryLandingNudgeHtml = postPaywallHtml || waitlistHtml || houseAdHtml || landingChallengeHtml || chestHintHtml;
      var showLandingMeta = !primaryLandingNudgeHtml;
      var landingMetaHtml = "";
      if (showLandingMeta) {
        landingMetaHtml = sparkHtml + lifetimeHtml;
      }

      var dailyHtml = "";
      var classicHtml = "";
      if (this.config?.daily?.enabled) {
        var dailyLabel = String(lw.dailyBadge || "").trim();
        if (dailyLabel) {
          var dailyExplain = String(lw.dailyExplain || "").trim();
          var dailyCta = String(lw.ctaPlayDaily || "").trim() || dailyLabel;
          dailyHtml = '<button class="kr-daily-badge kr-daily-badge--cta" data-action="play-daily" aria-label="' + escapeHtml(dailyCta) + '">';
          dailyHtml += '<span class="kr-daily-badge-icon">📅</span>';
          dailyHtml += '<span class="kr-daily-badge-label">' + escapeHtml(dailyLabel) + '</span>';
          dailyHtml += '</button>';
          if (dailyExplain) dailyHtml += '<p class="kr-daily-explain kr-muted">' + escapeHtml(dailyExplain) + '</p>';
        }
        classicHtml = '<div class="kr-actions">' +
          '<button class="kr-btn kr-btn--primary" data-action="play">' + ctaLabel + '</button>' +
        '</div>';
        if (!this._hasCompletedDailyToday()) {
          var classicHint = String(lw.classicUnlockHint || "").trim();
          if (classicHint) classicHtml += '<p class="kr-landing-classic-hint kr-muted">' + escapeHtml(classicHint) + '</p>';
        }
      } else {
        classicHtml = '<div class="kr-actions">' +
          '<button class="kr-btn kr-btn--primary" data-action="play">' + ctaLabel + '</button>' +
        '</div>';
      }

      this.appEl.innerHTML =
        '<div class="kr-screen kr-screen--landing">' +
          '<div class="kr-landing-header"><div class="kr-landing-header-row">' +
            '<button class="kr-btn-icon" data-action="howto" aria-label="' + escapeHtml((w?.system || {}).more || "") + '">?</button>' +
            chestHtml +
          '</div></div>' +
          '<div class="kr-landing-body">' +
            '<h1 class="kr-h1">' + escapeHtml(lw.tagline || "") + '</h1>' +
            '<p class="kr-subtitle">' + escapeHtml(lw.subtitle || "") + '</p>' +
            dailyHtml +
            classicHtml +
            bestHtml +
            nextPowerHtml +
            premiumLabelHtml +
            earlyTickerHtml +
            primaryLandingNudgeHtml +
            landingMetaHtml +
          '</div>' +
        '</div>';

      this._reattachFooter();
    };

    UIModule.prototype._renderEnd = function () {
      var cfg = this.config;
      var w = this.wording;
      var ew = (w && w.end) ? w.end : {};
      var sw = (w && w.sprint) ? w.sprint : {};
      var last = (this._runtime && this._runtime.lastRun) ? this._runtime.lastRun : {};
      var isSprint = (last.mode === MODES.SPRINT);
      var premium = !!(this._store("isPremium"));
      var balance = this._store("getRunsBalance") || 0;

      var title = isSprint ? escapeHtml(sw.endTitle || "") : escapeHtml(ew.title || "");
      var scoreLine = isSprint
        ? escapeHtml(fillTemplate(sw.scoreLine || "", { score: last.smashes }))
        : escapeHtml(fillTemplate(ew.scoreLine || "", { score: last.smashes }));

      var bestSmashes = isSprint
        ? ((this._store("getSprintBest") || {}).bestSmashes || 0)
        : (last.bestSmashes || 0);
      var bestLine = isSprint
        ? escapeHtml(fillTemplate(sw.bestLine || "", { best: bestSmashes }))
        : escapeHtml(fillTemplate(ew.personalBestLine || "", { best: bestSmashes }));

      var newBest = last.newBest;
      var newBestLabel = isSprint ? (sw.newBest || "") : (ew.newBest || "");
      var newBestHtml = newBest ? '<p class="kr-new-best">' + escapeHtml(newBestLabel) + '</p>' : "";

      var endHighlight = (this._runtime && this._runtime.microFeedback) ? (this._runtime.microFeedback.endHighlight || "") : "";
      var highlightHtml = endHighlight ? '<p class="kr-end-highlight kr-muted">' + escapeHtml(endHighlight) + '</p>' : "";
      var endCfg = (cfg?.end) || {};
      var bestStreakLineMin = requiredConfigNumber(endCfg.bestStreakLineMin, "KR_CONFIG.end.bestStreakLineMin", { min: 1, integer: true });
      var almostBestGapMax = requiredConfigNumber(endCfg.almostBestGapMax, "KR_CONFIG.end.almostBestGapMax", { min: 1, integer: true });
      var playAgainNearBestGapMax = requiredConfigNumber(endCfg.playAgainNearBestGapMax, "KR_CONFIG.end.playAgainNearBestGapMax", { min: 1, integer: true });

      var bestStreak = last.bestStreak || 0;
      var streakHtml = (bestStreak >= bestStreakLineMin && !isSprint)
        ? '<p class="kr-muted">' + escapeHtml(fillTemplate(ew.bestStreakLine || "", { streak: bestStreak })) + '</p>' : "";

      var debriefHtml = "";
      if (last.totalSpawned > 0) {
        var accuracy = Math.round((last.smashes / last.totalSpawned) * 100);
        var faults = last.totalFaulted || 0;
        var misses = last.totalMissed || 0;
        var durationSec = Math.round((last.elapsedMs || 0) / 1000);

        var deltaHtml = "";
        if (bestSmashes > 0 && !newBest && last.smashes > 0) {
          var gap = bestSmashes - last.smashes;
          if (gap > 0 && gap <= almostBestGapMax) {
            var dw = isSprint ? (w?.sprint || {}) : (w?.end || {});
            var almostMsg = String(dw.almostBest || (w?.end || {}).almostBest || "").trim();
            if (almostMsg) deltaHtml = '<p class="kr-end-delta">' + escapeHtml(fillTemplate(almostMsg, { gap: gap })) + '</p>';
          }
        }

        var dl = (w?.end || {});
        var lines = [];
        if (!isSprint) {
          var accLine = String(dl.debriefAccuracy || "").trim();
          if (accLine) lines.push(escapeHtml(fillTemplate(accLine, { accuracy: accuracy })));
          if (faults > 0) {
            var fLine = String(dl.debriefFaults || "").trim();
            if (fLine) lines.push(escapeHtml(fillTemplate(fLine, { faults: faults })));
          }
          if (misses > 0) {
            var mLine = String(dl.debriefMisses || "").trim();
            if (mLine) lines.push(escapeHtml(fillTemplate(mLine, { misses: misses })));
          }
          var durLine = String(dl.debriefDuration || "").trim();
          if (durLine) lines.push(escapeHtml(fillTemplate(durLine, { seconds: durationSec })));
        }

        if (lines.length > 0 || deltaHtml) {
          debriefHtml = '<div class="kr-end-debrief kr-muted">';
          debriefHtml += deltaHtml;
          if (lines.length > 0) debriefHtml += '<p>' + lines.join(' · ') + '</p>';
          debriefHtml += '</div>';
        }
      }

      var freeRunHtml = "";
      if (!premium && !isSprint && balance > 0) {
        var totalFree = requiredConfigNumber(cfg?.limits?.freeRuns, "KR_CONFIG.limits.freeRuns", { min: 0, integer: true });
        freeRunHtml = '<p class="kr-muted">' + escapeHtml(fillTemplate(ew.freeRunLeft || "", { remaining: balance, total: totalFree })) + '</p>';
      }

      var challengeHtml = "";
      var canPlayAgain = premium || balance > 0 || isSprint;
      var ch = (w?.challenges) || {};
      var chCfg = (cfg?.challenges) || {};
      var previousRun = (this._runtime && this._runtime.previousRun && this._runtime.previousRun.totalSpawned > 0)
        ? this._runtime.previousRun : null;
      if (last.totalSpawned > 0 && canPlayAgain) {
        var cF = last.totalFaulted || 0;
        var cA = Math.round((last.smashes / last.totalSpawned) * 100);
        var cS = last.bestStreak || 0;
        var improve = (!isSprint) ? getRunImprovement(last, previousRun, chCfg) : null;
        var sT = requiredConfigNumber(chCfg.streakThreshold, "KR_CONFIG.challenges.streakThreshold", { min: 1, integer: true });
        var sB = requiredConfigNumber(chCfg.streakTargetBonus, "KR_CONFIG.challenges.streakTargetBonus", { min: 1, integer: true });
        var fT = requiredConfigNumber(chCfg.faultThreshold, "KR_CONFIG.challenges.faultThreshold", { min: 0, integer: true });
        var aP = requiredConfigNumber(chCfg.lowAccuracyPct, "KR_CONFIG.challenges.lowAccuracyPct", { min: 0, max: 100, integer: true });
        var aM = requiredConfigNumber(chCfg.lowAccuracyMinSmashes, "KR_CONFIG.challenges.lowAccuracyMinSmashes", { min: 1, integer: true });
        var cM = requiredConfigNumber(chCfg.cleanRunMinSmashes, "KR_CONFIG.challenges.cleanRunMinSmashes", { min: 1, integer: true });

        challengeHtml = isSprint
          ? pickChallenge([
              { test: last.smashes > 0, key: "sprintChallenge", vars: { score: last.smashes, target: last.smashes + (last.smashes < 5 ? 2 : 1) } }
            ], ch)
          : pickChallenge([
              { test: newBest && last.smashes > 0, key: "newBestChallenge", vars: { score: last.smashes, target: last.smashes + 1 } },
              { test: !!(improve && improve.faultsImproved), key: "fewerFaults", vars: { delta: improve.fewerFaults } },
              { test: !!(improve && improve.accuracyImproved), key: "improvedAccuracy", vars: { delta: improve.accuracyGain } },
              { test: !!(improve && improve.streakImproved), key: "betterStreak", vars: { delta: improve.betterStreak } },
              { test: cF === 0 && last.smashes >= cM, key: "cleanRun", vars: null },
              { test: cS >= sT, key: "streakChallenge", vars: { streak: cS, target: cS + sB } },
              { test: cF >= fT, key: "faultHeavy", vars: { faults: cF } },
              { test: cA < aP && last.smashes >= aM, key: "lowAccuracy", vars: { accuracy: cA } }
            ], ch);
      }

      var sprintFreeHtml = "";
      if (isSprint && !premium) {
        var used = this._store("getSprintFreeRunsUsed") || 0;
        var limit = requiredConfigNumber(cfg?.sprint?.freeRunsLimit, "KR_CONFIG.sprint.freeRunsLimit", { min: 0, integer: true });
        if (limit > 0 && used < limit) {
          sprintFreeHtml = '<p class="kr-muted">' + escapeHtml(fillTemplate(sw.freeRunsLeftLine || "", { remaining: limit - used, limit: limit })) + '</p>';
        }
      }

      var showChest = this._canShowChest(STATES.END);
      var solvedChest = !!(this._store("hasSprintChestHintSolved"));
      var chestHtml = showChest
        ? '<button class="kr-btn-icon' + (solvedChest ? "" : " kr-btn-icon--tease") + '" data-kr-secret="chest" aria-label="' + escapeHtml(sw.chestAria || "") + '">\uD83C\uDF81</button>' : "";

      var endNudge = this._getEndNudgePriority();
      var waitlistHtml = "";
      if (this._store("shouldShowWaitlistNow", {
        screen: STATES.END,
        inRun: false,
        premium: premium,
        balance: balance,
        isSprint: isSprint,
        postPaywallActive: (!premium && !isSprint && balance <= 0),
        showStatsPrompt: !!endNudge.showStatsPrompt,
        showShare: !!endNudge.showShare
      })) {
        var wl = (w && w.waitlist) ? w.waitlist : {};
        var wlTitle = String(wl.title || "").trim();
        var wlBody = String(wl.bodyLine1 || "").trim();
        var wlCta = String(wl.cta || "").trim();
        if (wlTitle && wlCta) {
          waitlistHtml = '<div class="kr-box kr-box--tinted">';
          waitlistHtml += '<p><strong>' + escapeHtml(wlTitle) + '</strong></p>';
          if (wlBody) waitlistHtml += '<p class="kr-muted">' + escapeHtml(wlBody) + '</p>';
          waitlistHtml += '<button class="kr-btn kr-btn--secondary" data-action="waitlist">' + escapeHtml(wlCta) + '</button>';
          waitlistHtml += '</div>';
        }
      }

      var ctasHtml = "";
      if (isSprint) {
        ctasHtml =
          '<button class="kr-btn kr-btn--primary" data-action="sprint-again">' + escapeHtml(sw.playAgain || "") + '</button>' +
          '<button class="kr-btn kr-btn--secondary" data-action="back-to-runs">' + escapeHtml(sw.backToRuns || "") + '</button>';
      } else if (!premium && balance <= 0) {
        ctasHtml = '<button class="kr-btn kr-btn--primary" data-action="show-paywall">' + escapeHtml((w?.paywall || {}).cta || "") + '</button>';
      } else {
        var ctaText = ew.playAgain || "";
        if (newBest) ctaText = ew.playAgainAfterBest || ew.playAgain || "";
        else if (bestSmashes > 0 && last.smashes > 0) {
          var nearGap = bestSmashes - last.smashes;
          if (nearGap > 0 && nearGap <= playAgainNearBestGapMax) ctaText = ew.playAgainNearBest || ew.playAgain || "";
        }
        ctasHtml = '<button class="kr-btn kr-btn--primary" data-action="play-again">' + escapeHtml(ctaText) + '</button>';
      }

      var nextRunObjectiveHtml = "";
      if (!isSprint && canPlayAgain && last.totalSpawned > 0) {
        var objectiveLabel = String(ew.nextRunLabel || "").trim();
        var objectiveText = "";
        var objectiveImprove = getRunImprovement(last, previousRun, chCfg);
        var bestGap = (!newBest && bestSmashes > 0 && last.smashes > 0) ? (bestSmashes - last.smashes) : 0;
        var objectiveTarget = cS + sB;

        if (bestGap > 0 && bestGap <= playAgainNearBestGapMax) {
          objectiveText = fillTemplate(String(ew.nextRunBestGap || "").trim(), { gap: bestGap });
        } else if (objectiveImprove && objectiveImprove.faultsImproved) {
          objectiveText = String(ew.nextRunHoldCleaner || "").trim();
        } else if (objectiveImprove && objectiveImprove.accuracyImproved) {
          objectiveText = String(ew.nextRunHoldAccuracy || "").trim();
        } else if (objectiveImprove && objectiveImprove.streakImproved) {
          objectiveText = fillTemplate(String(ew.nextRunHoldStreak || "").trim(), { target: objectiveTarget });
        } else if (cF >= fT) {
          objectiveText = String(ew.nextRunFewerFaults || "").trim();
        } else if (cA < aP && last.smashes >= aM) {
          objectiveText = String(ew.nextRunAccuracy || "").trim();
        } else if (cS >= sT) {
          objectiveText = fillTemplate(String(ew.nextRunStreak || "").trim(), { target: objectiveTarget });
        }

        if (objectiveLabel && objectiveText) {
          nextRunObjectiveHtml = '<p class="kr-end-next-run kr-muted"><strong>' + escapeHtml(objectiveLabel) + '</strong> ' + escapeHtml(objectiveText) + '</p>';
        }
      }

      var nextPowerEndHtml = "";
      if (!isSprint) {
        var nextPowerEnd = getNextBallPower(cfg, w, Number(last.smashes || 0));
        if (nextPowerEnd) {
          var endPowerLabel = String(ew.nextPowerLabel || "").trim();
          var endPowerText = fillTemplate(String(ew.nextPowerTemplate || "").trim(), { power: nextPowerEnd.label, score: nextPowerEnd.score });
          if (endPowerLabel && endPowerText) {
            nextPowerEndHtml = '<p class="kr-end-next-run kr-muted"><strong>' + escapeHtml(endPowerLabel) + '</strong> ' + escapeHtml(endPowerText) + '</p>';
          }
        }
      }

      var shareHtml = "";
      var isDaily = !!(last && last.isDaily === true);
      if (cfg?.share?.enabled && endNudge.showShare) {
        var shareBtnClass = isDaily ? "kr-btn kr-btn--primary" : "kr-btn kr-btn--secondary";
        var shareLabel = isDaily
          ? escapeHtml((w?.share || {}).ctaDailyLabel || (w?.share || {}).ctaLabel || "")
          : escapeHtml((w?.share || {}).ctaLabel || "");
        shareHtml = '<div class="kr-share-row">' +
          '<button class="' + shareBtnClass + '" data-action="share">' + shareLabel + '</button>' +
          '<button class="kr-btn kr-btn--secondary" data-action="share-email" aria-label="' + escapeHtml((w?.share || {}).emailAria || "") + '">\u2709</button>' +
        '</div>';
      }

      if (cfg?.share?.enabled && endNudge.autoShare) {
        var autoShareScore = newBest
          ? requiredConfigNumber(cfg?.share?.autoOpenNewBestScoreMin, "KR_CONFIG.share.autoOpenNewBestScoreMin", { min: 1, integer: true })
          : (isDaily
              ? requiredConfigNumber(cfg?.share?.autoOpenDailyScoreMin, "KR_CONFIG.share.autoOpenDailyScoreMin", { min: 1, integer: true })
              : 999999);
        if (last.smashes >= autoShareScore) {
          var self = this;
          if (this._runtime && this._runtime.shareCardAutoOpenTimer) {
            clearTimeout(this._runtime.shareCardAutoOpenTimer);
            this._runtime.shareCardAutoOpenTimer = null;
          }
          if (this._runtime) {
            var autoOpenDelayMs = requiredConfigNumber(cfg?.share?.autoOpenDelayMs, "KR_CONFIG.share.autoOpenDelayMs", { min: 0, integer: true });
            this._runtime.shareCardAutoOpenTimer = setTimeout(function () {
              self._runtime.shareCardAutoOpenTimer = null;
              self._showShareCardModal();
            }, autoOpenDelayMs);
          }
        }
      }

      this.appEl.innerHTML =
        '<div class="kr-screen kr-screen--end">' +
          '<div class="kr-end-header"><div class="kr-end-header-row">' +
            '<button class="kr-btn-icon" data-action="home" aria-label="' + escapeHtml((w?.system || {}).home || "") + '">\u2190</button>' +
            chestHtml +
          '</div></div>' +
          '<div class="kr-end-body">' +
            '<h2 class="kr-h2">' + title + '</h2>' +
            '<p class="kr-end-score' + (newBest ? " kr-end-score--celebrate" : "") + '">' + scoreLine + '</p>' +
            newBestHtml +
            '<p class="kr-muted">' + bestLine + '</p>' +
            streakHtml +
            highlightHtml +
            '<div class="kr-actions kr-actions--stack">' + ctasHtml + shareHtml + '</div>' +
            nextRunObjectiveHtml +
            nextPowerEndHtml +
            debriefHtml +
            challengeHtml +
            waitlistHtml +
            freeRunHtml +
            sprintFreeHtml +
          '</div>' +
        '</div>';

      this._reattachFooter();
    };

    UIModule.prototype._renderPaywall = function () {
      var cfg = this.config;
      var w = this.wording;
      var pw = (w && w.paywall) ? w.paywall : {};

      if (this._store("isPremium")) {
        this.setState(STATES.LANDING);
        return;
      }

      var ep = null;
      try { ep = this._store("getEarlyPriceState") || null; } catch (_) { }
      var isEarly = !!(ep && ep.phase === "EARLY" && Number(ep.remainingMs) > 0);

      var earlyPrice = formatCents(cfg.earlyPriceCents, cfg.currency);
      var standardPrice = formatCents(cfg.standardPriceCents, cfg.currency);

      var balance = this._store("getRunsBalance") || 0;
      var headline = (balance <= 0) ? escapeHtml(pw.headlineLastFree || pw.headline || "") : escapeHtml(pw.headline || "");

      var savingsHtml = "";
      if (isEarly && earlyPrice && standardPrice) {
        var saveAmount = formatCents(cfg.standardPriceCents - cfg.earlyPriceCents, cfg.currency);
        if (saveAmount) savingsHtml = '<p class="kr-paywall-savings">' + escapeHtml(fillTemplate(pw.savingsLineTemplate || "", { saveAmount: saveAmount })) + '</p>';
      }

      var bulletHtml = "";
      if (Array.isArray(pw.valueBullets)) {
        for (var i = 0; i < pw.valueBullets.length; i += 1) bulletHtml += '<li>' + escapeHtml(pw.valueBullets[i]) + '</li>';
      }
      var trustBulletHtml = "";
      if (Array.isArray(pw.trustBullets)) {
        for (var j = 0; j < pw.trustBullets.length; j += 1) trustBulletHtml += '<li>' + escapeHtml(pw.trustBullets[j]) + '</li>';
      }

      var priceCtas = "";
      if (isEarly) {
        var tl = String(pw.timerLabel || "").trim();
        var timerHtml = tl ? '<p class="kr-paywall-timer">' + escapeHtml(tl) + " " + mmss(ep.remainingMs) + '</p>' : "";
        priceCtas = timerHtml + savingsHtml + '<button class="kr-btn kr-btn--primary" data-action="checkout-early">' + escapeHtml(pw.ctaEarly || "") + '</button>';
      } else {
        var postEarly1 = String(pw.postEarlyLine1 || "").trim();
        var postEarly2 = fillTemplate(pw.postEarlyLine2 || "", { standardPrice: standardPrice });
        var postHtml = postEarly1 ? '<p class="kr-muted">' + escapeHtml(postEarly1) + '</p><p class="kr-muted">' + escapeHtml(postEarly2) + '</p>' : "";
        priceCtas = postHtml + '<button class="kr-btn kr-btn--primary" data-action="checkout-standard">' + escapeHtml(pw.ctaStandard || "") + '</button>';
      }

      var progressHtml = "";
      var pb = this._store("getPersonalBest") || {};
      var bestScore = pb.bestSmashes || 0;
      if (bestScore > 0) {
        var progTpl = String(pw.progressLineTemplate || "").trim();
        if (progTpl) progressHtml = '<p class="kr-paywall-progress">' + escapeHtml(fillTemplate(progTpl, { best: bestScore })) + '</p>';
      }

      var redeemHtml = '<p class="kr-muted"><a href="#" data-action="redeem">' + escapeHtml(pw.alreadyHaveCode || "") + '</a></p>';

      this.appEl.innerHTML =
        '<div class="kr-screen kr-screen--paywall">' +
          '<div class="kr-paywall-header">' +
            '<button class="kr-btn-icon" data-action="paywall-not-now" aria-label="' + escapeHtml((w?.system || {}).close || "") + '">\u2715</button>' +
          '</div>' +
          '<div class="kr-paywall-body">' +
            '<h2 class="kr-h2">' + headline + '</h2>' +
            progressHtml +
            '<div class="kr-box"><h3 class="kr-h3">' + escapeHtml(pw.valueTitle || "") + '</h3><ul class="kr-paywall-list">' + bulletHtml + '</ul></div>' +
            '<div class="kr-box"><h3 class="kr-h3">' + escapeHtml(pw.trustTitle || "") + '</h3><ul class="kr-paywall-list">' + trustBulletHtml + '</ul></div>' +
            '<p class="kr-muted">' + escapeHtml(pw.deviceNote || "") + '</p>' +
            '<div class="kr-actions kr-actions--stack">' + priceCtas + '</div>' +
            '<p class="kr-muted">' + escapeHtml(pw.checkoutNote || "") + '</p>' +
            redeemHtml +
          '</div>' +
        '</div>';
    };
  }

  window.KR_UI_SCREENS = { install: install };
})();
