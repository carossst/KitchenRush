// ui-overlays.js - toast and overlay responsibilities for Kitchen Rush

(() => {
  "use strict";

  let toastTimerId = null;
  let gameplayOverlayTimerId = null;
  let sharedEl = null;
  let sharedRequiredConfigNumber = null;

  function getToastTimingShared(cfg, key, requiredConfigNumber) {
    const t = cfg?.ui?.toast;
    if (!t || typeof t !== "object") throw new Error("KR_UI: config.ui.toast missing");
    const bucket = (t[key] && typeof t[key] === "object") ? t[key] : t["default"];
    if (!bucket || typeof bucket !== "object") throw new Error("KR_UI: toast timing bucket missing for " + String(key || "default"));
    return {
      delayMs: requiredConfigNumber(bucket.delayMs, "KR_CONFIG.ui.toast." + String(key || "default") + ".delayMs", { min: 0, integer: true }),
      durationMs: requiredConfigNumber(bucket.durationMs, "KR_CONFIG.ui.toast." + String(key || "default") + ".durationMs", { min: 1, integer: true })
    };
  }

  function showToastShared(message, opts, el, requiredConfigNumber) {
    const node = el("kr-toast");
    if (!node || !message) return;
    node.textContent = message;
    node.className = "kr-toast kr-toast--visible";
    if (opts?.variant) node.classList.add("kr-toast--" + opts.variant);
    if (toastTimerId) { clearTimeout(toastTimerId); toastTimerId = null; }
    const dur = requiredConfigNumber(opts && opts.durationMs, "KR_UI.showToast().durationMs", { min: 1, integer: true });
    toastTimerId = setTimeout(function () {
      node.classList.remove("kr-toast--visible");
      toastTimerId = null;
    }, dur);
  }

  function toastNowShared(cfg, message, opts, el, requiredConfigNumber) {
    const timing = getToastTimingShared(cfg, (opts && opts.timingKey) || "default", requiredConfigNumber);
    if (timing.delayMs > 0) {
      setTimeout(function () { showToastShared(message, { durationMs: timing.durationMs, variant: opts?.variant }, el, requiredConfigNumber); }, timing.delayMs);
    } else {
      showToastShared(message, { durationMs: timing.durationMs, variant: opts?.variant }, el, requiredConfigNumber);
    }
  }

  function install(UIModule, deps) {
    if (!UIModule || !UIModule.prototype) throw new Error("KR_UI_OVERLAYS.install(): UI constructor missing");

    var el = deps && deps.el;
    var escapeHtml = deps && deps.escapeHtml;
    var fillTemplate = deps && deps.fillTemplate;
    var requiredConfigNumber = deps && deps.requiredConfigNumber;
    var MODES = deps && deps.MODES;

    if (typeof el !== "function") throw new Error("KR_UI_OVERLAYS.install(): el missing");
    if (typeof escapeHtml !== "function") throw new Error("KR_UI_OVERLAYS.install(): escapeHtml missing");
    if (typeof fillTemplate !== "function") throw new Error("KR_UI_OVERLAYS.install(): fillTemplate missing");
    if (typeof requiredConfigNumber !== "function") throw new Error("KR_UI_OVERLAYS.install(): requiredConfigNumber missing");
    if (!MODES || !MODES.RUN || !MODES.SPRINT) throw new Error("KR_UI_OVERLAYS.install(): MODES missing");

    sharedEl = el;
    sharedRequiredConfigNumber = requiredConfigNumber;

    function showGameplayOverlay(message, opts) {
      const node = el("kr-gameplay-overlay");
      if (!node || !message) return;
      node.textContent = message;
      node.className = "kr-gameplay-overlay kr-gameplay-overlay--visible";
      if (opts?.variant) node.classList.add("kr-gameplay-overlay--" + opts.variant);
      if (gameplayOverlayTimerId) { clearTimeout(gameplayOverlayTimerId); gameplayOverlayTimerId = null; }
      var dur = requiredConfigNumber(opts && opts.durationMs, "KR_UI.showGameplayOverlay().durationMs", { min: 1, integer: true });
      gameplayOverlayTimerId = setTimeout(function () {
        node.classList.remove("kr-gameplay-overlay--visible");
        gameplayOverlayTimerId = null;
      }, dur);
    }

    function hideGameplayOverlay() {
      var node = el("kr-gameplay-overlay");
      if (node) node.classList.remove("kr-gameplay-overlay--visible");
      if (gameplayOverlayTimerId) { clearTimeout(gameplayOverlayTimerId); gameplayOverlayTimerId = null; }
    }

    UIModule.prototype._toastNow = function (cfg, message, opts) {
      toastNowShared(cfg, message, opts, el, requiredConfigNumber);
    };

    UIModule.prototype._getToastTiming = function (cfg, key) {
      return getToastTimingShared(cfg, key, requiredConfigNumber);
    };

    UIModule.prototype._showGameplayOverlay = function (message, opts) {
      showGameplayOverlay(message, opts);
    };

    UIModule.prototype._hideGameplayOverlay = function () {
      hideGameplayOverlay();
    };

    UIModule.prototype._getEndNudgePriority = function () {
      var last = (this._runtime && this._runtime.lastRun) ? this._runtime.lastRun : {};
      var premium = !!(this._store("isPremium"));
      var balance = this._store("getRunsBalance") || 0;
      var isSprint = (last.mode === MODES.SPRINT);
      var isDaily = !!(last && last.isDaily === true);
      var newBest = !!(last && last.newBest === true);

      if (!isSprint && !premium && balance <= 0) {
        return { primary: "paywall", showShare: false, autoShare: false, showStatsPrompt: false };
      }
      if (newBest || isDaily) {
        return { primary: "replay", showShare: true, autoShare: false, showStatsPrompt: false };
      }
      return { primary: "replay", showShare: true, autoShare: false, showStatsPrompt: true };
    };

    UIModule.prototype._shouldShowRunStartOverlay = function (mode) {
      if (mode === MODES.SPRINT) return true;
      if (this._runtime && this._runtime.currentRunIsDaily) return true;

      var counters = this._store("getCounters") || {};
      var runCompletes = Number(counters.runCompletes);
      if (Number.isFinite(runCompletes) && runCompletes > 0) return false;

      return true;
    };

    UIModule.prototype._showRunStartOverlay = function (mode, runType) {
      var cfg = this.config;
      var w = this.wording;
      var premium = !!(this._store("isPremium"));
      var ms = Number(cfg?.ui?.runStartOverlayMs);
      if (!Number.isFinite(ms) || ms <= 0) throw new Error("KR_UI._showRunStartOverlay(): invalid config.ui.runStartOverlayMs");

      var line1 = "";
      var line2 = "";

      if (mode === MODES.SPRINT) {
        var sw = w?.sprint || {};
        line1 = sw.startOverlayLine1 || "";
        line2 = sw.startOverlayLine2 || "";

        if (!premium) {
          var spUsed = this._store("getSprintFreeRunsUsed") || 0;
          var spLimit = Number(cfg?.sprint?.freeRunsLimit);
          if (!Number.isFinite(spLimit) || spLimit < 0) throw new Error("KR_UI._showRunStartOverlay(): invalid config.sprint.freeRunsLimit");
          var spRemaining = Math.max(0, spLimit - spUsed);
          var spLine = String(sw.startOverlayFreeRunsLimitLine || "").trim();
          if (spLine && spLimit > 0 && spRemaining > 0) {
            line2 = (line2 ? line2 + " " : "") + fillTemplate(spLine, { remaining: spRemaining, limit: spLimit });
          }
        }
      } else {
        var uw = w?.ui || {};
        if (runType === "FREE") line1 = uw.startRunTypeFree || "";
        else if (runType === "LAST_FREE") line1 = uw.startRunTypeLastFree || "";
        else if (runType === "UNLIMITED") line1 = uw.startRunTypeUnlimited || "";
      }

      var node = el("kr-run-start-overlay");
      if (!node) {
        this._startGameLoop();
        return;
      }

      var isTouchDevice = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
      var controlsHtml = "";
      if (isTouchDevice) {
        controlsHtml =
          '<div class="kr-start-controls">' +
            '<div class="kr-start-ctrl"><span class="kr-start-ctrl-key">Left half</span> <span class="kr-start-ctrl-label">Drag to move into range</span></div>' +
            '<div class="kr-start-ctrl"><span class="kr-start-ctrl-key">Right half</span> <span class="kr-start-ctrl-label">Tap to time your hit</span></div>' +
          '</div>';
      } else {
        controlsHtml =
          '<div class="kr-start-controls">' +
            '<div class="kr-start-ctrl"><span class="kr-start-ctrl-key">Mouse</span> <span class="kr-start-ctrl-label">Move around the court</span></div>' +
            '<div class="kr-start-ctrl"><span class="kr-start-ctrl-key">\u2190\u2191\u2192\u2193</span> <span class="kr-start-ctrl-label">Arrow-key movement</span></div>' +
            '<div class="kr-start-ctrl"><span class="kr-start-ctrl-key">Click / Space</span> <span class="kr-start-ctrl-label">Time your hit</span></div>' +
          '</div>' +
          '<p class="kr-run-start-hint kr-muted">Get close and it auto-returns. Time your hit for double points!</p>';
      }

      var kitchenHint = '<p class="kr-run-start-hint kr-muted">Kitchen ball: let it bounce, then hit</p>';

      var dailyHtml = "";
      if (this._runtime.currentRunIsDaily && this.gameApi && typeof this.gameApi.getDailyModifier === "function") {
        var dm = this.gameApi.getDailyModifier();
        if (dm) {
          var dmOvLabel = String(dm.label || "").trim();
          var dmOvDesc = String(dm.desc || "").trim();
          if (dmOvLabel) {
            dailyHtml = '<div class="kr-start-daily">' +
              '<span class="kr-start-daily-icon">\uD83C\uDFC6</span> ' +
              '<strong>' + escapeHtml(dmOvLabel) + '</strong><br>' +
              (dmOvDesc ? '<span class="kr-muted">' + escapeHtml(dmOvDesc) + '</span>' : '') +
            '</div>';
          }
        }
      }

      node.innerHTML =
        '<div class="kr-run-start-content">' +
          dailyHtml +
          (line1 ? '<p class="kr-run-start-line1">' + escapeHtml(line1) + '</p>' : '') +
          (line2 ? '<p class="kr-run-start-line2">' + escapeHtml(line2) + '</p>' : '') +
          controlsHtml +
          kitchenHint +
          '<p class="kr-run-start-hint kr-muted">Tap to start</p>' +
        '</div>';
      node.classList.add("kr-run-start-overlay--visible");

      if (this._runtime.runStartOverlayTimerId) clearTimeout(this._runtime.runStartOverlayTimerId);
      this._runtime.runStartOverlayTimerId = null;

      var self = this;
      node.addEventListener("pointerdown", function dismiss() {
        node.classList.remove("kr-run-start-overlay--visible");
        node.removeEventListener("pointerdown", dismiss);
        self._startGameLoop();
      }, { once: true });
    };

    UIModule.prototype._showFirstRunFraming = function (callback) {
      var fw = this.wording?.firstRun || {};
      var trustLine = String(fw.trustLine || "").trim();
      if (!trustLine) { callback(); return; }

      var kitchenHint = String(fw.kitchenHint || "").trim();
      var kitchenHtml = kitchenHint ? '<p class="kr-first-run-hint kr-muted">' + escapeHtml(kitchenHint) + '</p>' : "";

      var tutorialHtml = "";
      var rule1 = String(fw.rule1 || "").trim();
      var rule2 = String(fw.rule2 || "").trim();
      var rule3 = String(fw.rule3 || "").trim();
      if (rule1 || rule2 || rule3) {
        tutorialHtml = '<div class="kr-first-run-rules">';
        if (rule1) tutorialHtml += '<div class="kr-first-run-rule"><span class="kr-rule-dot kr-rule-dot--green"></span><span>' + escapeHtml(rule1) + '</span></div>';
        if (rule2) tutorialHtml += '<div class="kr-first-run-rule"><span class="kr-rule-dot kr-rule-dot--yellow"></span><span>' + escapeHtml(rule2) + '</span></div>';
        if (rule3) tutorialHtml += '<div class="kr-first-run-rule"><span class="kr-rule-dot kr-rule-dot--red"></span><span>' + escapeHtml(rule3) + '</span></div>';
        tutorialHtml += '</div>';
      }

      var html =
        '<div class="kr-first-run">' +
          '<p class="kr-first-run-trust">' + escapeHtml(trustLine) + '</p>' +
          tutorialHtml +
          kitchenHtml +
          '<button id="kr-first-run-go" class="kr-btn kr-btn--primary">' + escapeHtml(this.wording?.landing?.ctaPlay || "") + '</button>' +
        '</div>';

      this.openModal(html);

      var self = this;
      var goBtn = el("kr-first-run-go");
      if (goBtn) goBtn.addEventListener("click", function () { self.closeModal(); callback(); });
    };
  }

  window.KR_UI_OVERLAYS = {
    install: install,
    toastNow: function (cfg, message, opts) {
      if (!sharedEl || typeof sharedRequiredConfigNumber !== "function") {
        throw new Error("KR_UI_OVERLAYS.toastNow(): install must run first");
      }
      toastNowShared(cfg, message, opts, sharedEl, sharedRequiredConfigNumber);
    }
  };
})();
