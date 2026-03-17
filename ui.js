// ui.js v2.0 - Kitchen Rush
// State machine + Canvas/DOM rendering.
// All features: modals, toasts, chest, paywall, houseAd, waitlist,
// statsSharing, share, install, support, howto, redeem, microFeedback,
// first run framing, game over delay, run start overlay, record moment.

void function () {
  "use strict";

  // ============================================
  // Helpers
  // ============================================
  function el(id) { return document.getElementById(id); }

  function escapeHtml(str) {
    const fn = window.KR_UTILS && typeof window.KR_UTILS.escapeHtml === "function"
      ? window.KR_UTILS.escapeHtml : null;
    if (!fn) throw new Error("KR_UI: KR_UTILS.escapeHtml missing");
    return String(fn(str));
  }

  function clampInt(n, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, Math.floor(x)));
  }

  function requiredConfigNumber(value, name, opts) {
    var n = Number(value);
    if (!Number.isFinite(n)) throw new Error(name + " must be a finite number");
    if (opts && Number.isFinite(opts.min) && n < opts.min) throw new Error(name + " must be >= " + opts.min);
    if (opts && Number.isFinite(opts.max) && n > opts.max) throw new Error(name + " must be <= " + opts.max);
    if (opts && opts.integer === true && Math.floor(n) !== n) throw new Error(name + " must be an integer");
    return n;
  }

  function formatCents(cents, currency) {
    const c = Number(cents);
    if (!Number.isFinite(c) || c <= 0) return "";
    const cur = String(currency || "").trim().toUpperCase();
    try { return (c / 100).toLocaleString("en-US", { style: "currency", currency: cur }); } catch (_) { }
    return "$" + (c / 100).toFixed(2);
  }

  function mmss(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ":" + String(sec).padStart(2, "0");
  }

  function isOnline() {
    return (typeof navigator.onLine === "boolean") ? navigator.onLine : true;
  }

  function fillTemplate(str, vars) {
    if (!str || typeof str !== "string") return "";
    let out = str;
    for (const k in vars) {
      out = out.replaceAll("{" + k + "}", String(vars[k] ?? ""));
    }
    return out;
  }

  // Safe wording read: String(key).trim(), optionally fill template vars
  function txt(val, vars) {
    var s = String(val || "").trim();
    return (s && vars) ? fillTemplate(s, vars) : s;
  }

  // Pick ONE challenge from a priority-ordered list of rules
  // rules: [{ test: bool, key: string, vars: object|null }, ...]
  // wording: challenges wording object
  // Returns HTML string or ""
  function pickChallenge(rules, wording) {
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].test) {
        var t = txt(wording[rules[i].key], rules[i].vars);
        if (t) return '<p class="kr-challenge">' + escapeHtml(t) + '</p>';
      }
    }
    return "";
  }


  // ============================================
  // States
  // ============================================
  const ENUMS = window.KR_ENUMS;
  if (!ENUMS || typeof ENUMS !== "object") throw new Error("KR_UI: KR_ENUMS missing");
  const STATES = ENUMS.UI_STATES;
  const MODES = ENUMS.GAME_MODES;
  if (!STATES || !STATES.LANDING || !STATES.PLAYING || !STATES.END || !STATES.PAYWALL) {
    throw new Error("KR_UI: KR_ENUMS.UI_STATES invalid");
  }
  if (!MODES || !MODES.RUN || !MODES.SPRINT) {
    throw new Error("KR_UI: KR_ENUMS.GAME_MODES invalid");
  }


  // ============================================
  // Toast system
  // ============================================
  let _toastTimerId = null;

  function getToastTiming(cfg, key) {
    const t = cfg?.ui?.toast;
    if (!t || typeof t !== "object") throw new Error("KR_UI: config.ui.toast missing");
    const bucket = (t[key] && typeof t[key] === "object") ? t[key] : t["default"];
    if (!bucket || typeof bucket !== "object") throw new Error("KR_UI: toast timing bucket missing for " + String(key || "default"));
    return {
      delayMs: requiredConfigNumber(bucket.delayMs, "KR_CONFIG.ui.toast." + String(key || "default") + ".delayMs", { min: 0, integer: true }),
      durationMs: requiredConfigNumber(bucket.durationMs, "KR_CONFIG.ui.toast." + String(key || "default") + ".durationMs", { min: 1, integer: true })
    };
  }

  function showToast(message, opts) {
    const node = el("kr-toast");
    if (!node || !message) return;
    node.textContent = message;
    node.className = "kr-toast kr-toast--visible";
    if (opts?.variant) node.classList.add("kr-toast--" + opts.variant);
    if (_toastTimerId) { clearTimeout(_toastTimerId); _toastTimerId = null; }
    const dur = requiredConfigNumber(opts && opts.durationMs, "KR_UI.showToast().durationMs", { min: 1, integer: true });
    _toastTimerId = setTimeout(function () { node.classList.remove("kr-toast--visible"); _toastTimerId = null; }, dur);
  }

  function toastNow(cfg, message, opts) {
    const timing = getToastTiming(cfg, (opts && opts.timingKey) || "default");
    if (timing.delayMs > 0) {
      setTimeout(function () { showToast(message, { durationMs: timing.durationMs, variant: opts?.variant }); }, timing.delayMs);
    } else {
      showToast(message, { durationMs: timing.durationMs, variant: opts?.variant });
    }
  }


  // ============================================
  // Gameplay overlay (micro-feedback, run start, life lost)
  // ============================================
  let _gameplayOverlayTimerId = null;

  function showGameplayOverlay(message, opts) {
    const node = el("kr-gameplay-overlay");
    if (!node || !message) return;
    node.textContent = message;
    node.className = "kr-gameplay-overlay kr-gameplay-overlay--visible";
    if (opts?.variant) node.classList.add("kr-gameplay-overlay--" + opts.variant);
    if (_gameplayOverlayTimerId) { clearTimeout(_gameplayOverlayTimerId); _gameplayOverlayTimerId = null; }
    var dur = requiredConfigNumber(opts && opts.durationMs, "KR_UI.showGameplayOverlay().durationMs", { min: 1, integer: true });
    _gameplayOverlayTimerId = setTimeout(function () {
      node.classList.remove("kr-gameplay-overlay--visible");
      _gameplayOverlayTimerId = null;
    }, dur);
  }

  function hideGameplayOverlay() {
    var node = el("kr-gameplay-overlay");
    if (node) node.classList.remove("kr-gameplay-overlay--visible");
    if (_gameplayOverlayTimerId) { clearTimeout(_gameplayOverlayTimerId); _gameplayOverlayTimerId = null; }
  }


  // ============================================
  // UI Constructor
  // ============================================
  function UI(deps) {
    var d = (deps && typeof deps === "object") ? deps : null;
    if (!d) throw new Error("KR_UI: deps object is required");
    if (!d.storage || typeof d.storage !== "object") throw new Error("KR_UI: deps.storage is required");
    if (!d.game || typeof d.game !== "object" || typeof d.game.start !== "function" || typeof d.game.getState !== "function") {
      throw new Error("KR_UI: deps.game is required and must expose start() and getState()");
    }
    if (!d.config || typeof d.config !== "object") throw new Error("KR_UI: deps.config is required");
    if (!d.wording || typeof d.wording !== "object") throw new Error("KR_UI: deps.wording is required");
    this.storage = d.storage;
    this.game = d.game;
    this.config = d.config;
    this.wording = d.wording;
    this.state = STATES.LANDING;

    this.appEl = el("app");

    // Footer preservation
    this._footerNode = null;

    // Paywall ticker
    this._paywallTickerId = null;

    // Canvas + RAF
    this._canvas = null;
    this._ctx = null;
    this._rafId = null;
    this._lastFrameTs = 0;

    // beforeunload guard
    this._beforeUnloadHandler = null;

    this._runtime = {
      // Input safety
      tapLocked: false,

      // HUD delta pulse cleanup
      hudPulseCleanupTimerId: null,

      // Canvas juice effects
      juice: {
        flashType: "",         // "smash" | "fault" | "" 
        flashUntil: 0,
        flashX: 0,
        flashY: 0,
        shakeUntil: 0,
        shakeIntensity: 0,
        milestoneGlowUntil: 0,
        firstKitchenPulseUntil: 0,
        bounceFlashBalls: {},   // ballId → until timestamp
        lastPlayedBounceAt: 0,
        sprintPenaltyUntil: 0,
        scorePopups: []         // [{ x, y, at }]
      },

      // Support modal cache
      supportEmail: "",

      // Current run
      runMode: MODES.RUN,           // MODES.RUN | MODES.SPRINT
      runType: "",              // "FREE" | "LAST_FREE" | "UNLIMITED" | ""
      finishingRun: false,

      // microFeedback (arcade: smash streaks, kitchen master, close call, last life)
      microFeedback: {
        smashStreak: 0,
        maxSmashStreak: 0,
        tierShown: 0,
        lastOverlayAtSmash: -999,
        lastLifeShown: false,
        kitchenMasterShown: false,

        // END highlight
        endHighlight: "",
        endHighlightVariant: "",
        endHighlightPriority: -1,

        // Per-run tier memory (show "...Again" copy on second occurrence)
        tierShownOnce: { start: false, building: false, strong: false, elite: false, legendary: false }
      },

      // Last completed run result
      lastRun: {
        mode: MODES.RUN,
        smashes: 0,
        lives: 0,
        maxLives: 0,
        newBest: false,
        bestSmashes: 0,
        endReason: null,
        totalFaulted: 0,
        bestStreak: 0
      },

      // Sprint chest gesture
      sprintChest: { tapCount: 0, lastTapAt: 0 },

      // End record moment
      endRecordMomentUntil: 0,
      endRecordMomentTimer: null,

      // Run start overlay timer
      runStartOverlayTimerId: null
    };

    // Navigation state
    this._nav = { paywallFromState: null };

    this._bindEvents();
  }


  // ============================================
  // Safe storage accessor — eliminates defensive typeof checks everywhere
  // Usage: this._store("isPremium") → result or fallback
  // ============================================
  UI.prototype._store = function (method) {
    var s = this.storage;
    if (!s || typeof s[method] !== "function") return undefined;
    try {
      var args = [];
      for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
      return s[method].apply(s, args);
    } catch (err) {
      if (window.Logger && typeof window.Logger.warn === "function") {
        window.Logger.warn("_store(\"" + method + "\") failed:", err);
      }
      return undefined;
    }
  };


  // ============================================
  // Event binding
  // ============================================
  UI.prototype._bindEvents = function () {
    var self = this;
    if (!this.appEl) return;

    // Delegated click handler on #app
    this.appEl.addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;

      var actionEl = t.closest("[data-action]");
      if (actionEl) {
        e.preventDefault();
        self._dispatchAction(String(actionEl.getAttribute("data-action") || "").trim());
        return;
      }

      var chestEl = t.closest('[data-kr-secret="chest"]');
      if (chestEl) { e.preventDefault(); self._handleChestTap(); return; }
    });

    // Toast dismiss
    var toastEl = el("kr-toast");
    if (toastEl && this.config?.ui?.toastDismissOnTap) {
      toastEl.addEventListener("click", function () {
        toastEl.classList.remove("kr-toast--visible");
        if (_toastTimerId) { clearTimeout(_toastTimerId); _toastTimerId = null; }
      });
    }

    // Browser back
    window.addEventListener("popstate", function () {
      if (self.state !== STATES.LANDING) self.setState(STATES.LANDING);
    });

    // Escape closes modal
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") self.closeModal();
    });

    // Update toast dismiss
    var updateDismiss = el("kr-update-dismiss");
    if (updateDismiss) updateDismiss.addEventListener("click", function () { self.dismissUpdateToast(); });
  };


  // ============================================
  // Action dispatch
  // ============================================
  UI.prototype._dispatchAction = function (action) {
    switch (action) {
      case "play":              this._handlePlay(); break;
      case "play-again":        this._handlePlay(); break;
      case "sprint-again":      this._handleSprintAgain(); break;
      case "back-to-runs":      this.setState(STATES.LANDING); break;
      case "show-paywall":      this.setState(STATES.PAYWALL); break;
      case "paywall-not-now":   this._handlePaywallNotNow(); break;
      case "checkout-early":    this.checkout("early"); break;
      case "checkout-standard": this.checkout("standard"); break;
      case "share":             this.copyShareText(); break;
      case "share-email":       this.sendShareViaEmail(); break;
      case "howto":             this.openHowToModal(); break;
      case "redeem":            this.openRedeemModal(); break;
      case "support":           this.openSupportModal(); break;
      case "install":           this.promptInstall(); break;
      case "home":              this.setState(STATES.LANDING); break;
      case "dismiss-update":    this.dismissUpdateToast(); break;
      case "house-ad-open":     this.openHouseAd(); break;
      case "house-ad-later":    this.remindHouseAdLater(); break;
      case "waitlist":          this.openWaitlistModal(); break;
      case "stats-sharing":     this.openStatsSharingModal(); break;
      case "copy-support-email": this.copySupportEmail(); break;
      case "open-support-email": this.openSupportEmailApp(); break;
      case "close-modal":       this.closeModal(); break;
      default: break;
    }
  };


  // ============================================
  // Init / Storage hooks
  // ============================================
  UI.prototype.init = function () {
    this._store("markLandingViewed");
    this.render();
  };

  UI.prototype.onStorageUpdated = function () {
    // Block renders while finishing a run (storage writes during recordRunComplete trigger events)
    if (this.state !== STATES.PLAYING && !(this._runtime && this._runtime.finishingRun)) this.render();
  };

  UI.prototype.onStorageSaveFailed = function () {
    var msg = String(this.wording?.system?.storageSaveFailedToast || "").trim();
    if (msg) toastNow(this.config, msg);
  };


  // ============================================
  // State machine
  // ============================================
  UI.prototype.setState = function (next) {
    var prev = this.state;

    // Guard: no-op if same state
    if (next === prev) return;

    // Chest gesture reset on END transitions
    if (this._runtime && this._runtime.sprintChest) {
      if ((prev === STATES.END && next !== STATES.END) || (next === STATES.END && prev !== STATES.END)) {
        this._runtime.sprintChest.tapCount = 0;
        this._runtime.sprintChest.lastTapAt = 0;
      }
    }

    // Paywall ticker management
    if (prev === STATES.PAYWALL && next !== STATES.PAYWALL && next !== STATES.LANDING) this._stopPaywallTicker();
    if (prev === STATES.LANDING && next !== STATES.LANDING && next !== STATES.PAYWALL) this._stopPaywallTicker();

    // Remember paywall origin for "Not now" routing
    if (next === STATES.PAYWALL && prev !== STATES.PAYWALL) {
      if (this._nav) this._nav.paywallFromState = prev;
    }

    // Browser back support (single-step)
    try {
      var baseUrl = location.pathname + location.search;
      var hash = (next === STATES.LANDING) ? "#home" : "#app";
      if (next !== STATES.LANDING && prev === STATES.LANDING) {
        history.pushState({ kr: true, screen: next }, "", baseUrl + hash);
      } else {
        history.replaceState({ kr: true, screen: next }, "", baseUrl + hash);
      }
    } catch (_) { }

    this.state = next;

    // Paywall entry: start ticker
    if (next === STATES.PAYWALL && prev !== STATES.PAYWALL) {
      this._store("markPaywallShown");
      this._stopPaywallTicker();
      this._startPaywallTicker();
    }

    // Landing entry: early timer if active
    if (next === STATES.LANDING && prev !== STATES.LANDING) {
      var ep = null;
      try { ep = this._store("getEarlyPriceState") || null; } catch (_) { }
      if (ep && ep.phase === "EARLY" && Number(ep.remainingMs) > 0) {
        this._stopPaywallTicker(); this._startPaywallTicker();
      } else { this._stopPaywallTicker(); }
    }

    // Stop game loop when leaving PLAYING
    if (prev === STATES.PLAYING && next !== STATES.PLAYING) {
      this._stopGameLoop();
      hideGameplayOverlay();
      // Hide run start overlay
      var rso = el("kr-run-start-overlay");
      if (rso) rso.classList.remove("kr-run-start-overlay--visible");
      if (this._runtime && this._runtime.runStartOverlayTimerId) {
        clearTimeout(this._runtime.runStartOverlayTimerId);
        this._runtime.runStartOverlayTimerId = null;
      }
      // Remove beforeunload guard
      if (this._beforeUnloadHandler) {
        window.removeEventListener("beforeunload", this._beforeUnloadHandler);
        this._beforeUnloadHandler = null;
      }
      // HUD pulse cleanup
      if (this._runtime && this._runtime.hudPulseCleanupTimerId) {
        clearTimeout(this._runtime.hudPulseCleanupTimerId);
        this._runtime.hudPulseCleanupTimerId = null;
      }
    }

    this.render();

    // END entry hooks
    if (next === STATES.END && prev !== STATES.END) {
      // Stats sharing milestone prompt
      try { this._maybePromptStatsSharingMilestone(); } catch (_) { }

      // Record moment (premium + RUN + newBest)
      try {
        var lastRun = (this._runtime && this._runtime.lastRun) ? this._runtime.lastRun : {};
        var premium = !!(this._store("isPremium"));
        var isRun = (lastRun.mode === MODES.RUN);
        var newBest = (isRun && lastRun.newBest === true);
        var ms = Number(this.config?.ui?.endRecordMomentMs);
        var hasW = String(this.wording?.end?.newBest || "").trim();

        if (premium && newBest && hasW && Number.isFinite(ms) && ms > 0) {
          this._runtime.endRecordMomentUntil = Date.now() + ms;
          if (this._runtime.endRecordMomentTimer) clearTimeout(this._runtime.endRecordMomentTimer);
          var self = this;
          this._runtime.endRecordMomentTimer = setTimeout(function () {
            self._runtime.endRecordMomentUntil = 0;
            self.render();
          }, ms);
        } else {
          if (this._runtime) this._runtime.endRecordMomentUntil = 0;
        }
      } catch (_) { }

      // Score celebrate animation (respect reduced motion)
      try {
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        var scoreEl = document.querySelector(".kr-end-score");
        if (!scoreEl) return;
        scoreEl.classList.remove("kr-end-score--celebrate");
        void scoreEl.offsetWidth; // force reflow
        scoreEl.classList.add("kr-end-score--celebrate");
      } catch (_) { }
    }
  };


  // ============================================
  // Play / Sprint handlers
  // ============================================
  UI.prototype._handlePlay = function () {
    this._store("markLandingPlayClicked");

    var premium = !!(this._store("isPremium"));
    var runType = "";

    // Run economy gate (free runs)
    if (!premium) {
      if (!this.storage || typeof this.storage.getRunAccessState !== "function" || typeof this.storage.consumeRunOrBlock !== "function") {
        throw new Error("KR_UI._handlePlay(): storage gating API missing");
      }
      var access = this.storage.getRunAccessState();
      if (!access || access.ok !== true) {
        if (this._nav) this._nav.paywallFromState = this.state;
        this.setState(STATES.PAYWALL);
        return;
      }
      runType = String(access.runType == null ? "" : access.runType).trim();
      if (!runType) throw new Error("KR_UI._handlePlay(): access.runType missing");
      var gate = this.storage.consumeRunOrBlock();
      if (!gate || gate.ok !== true) {
        if (this._nav) this._nav.paywallFromState = this.state;
        this.setState(STATES.PAYWALL);
        return;
      }
    } else {
      runType = "UNLIMITED";
    }
    this._runtime.runType = runType;
    this._runtime.runMode = MODES.RUN;

    // First run framing (one-shot: trust line before very first run)
    var counters = this._store("getCounters") || {};
    if (!this._store("hasFirstRunFramingSeen") && (counters.runCompletes || 0) === 0) {
      this._store("markFirstRunFramingSeen");
      var self = this;
      this._showFirstRunFraming(function () { self._startGameplay(MODES.RUN, runType); });
      return;
    }

    this._startGameplay(MODES.RUN, runType);
  };

  UI.prototype._handleSprintAgain = function () {
    // Route through startSprintRun() to enforce sprint free limit gate
    this.startSprintRun();
  };

  UI.prototype.startSprintRun = function () {
    var premium = !!(this._store("isPremium"));

    if (!premium) {
      if (!this.storage || typeof this.storage.getSprintAccessState !== "function") {
        throw new Error("KR_UI.startSprintRun(): storage sprint gating API missing");
      }
      var sprintAccess = this.storage.getSprintAccessState();
      if (!sprintAccess || sprintAccess.ok !== true) {
        this._showSprintFreeLimitReached();
        return;
      }
      this._store("incrementSprintFreeRunsUsed");
    }

    this._store("markSprintStarted");
    this._runtime.runMode = MODES.SPRINT;
    this._startGameplay(MODES.SPRINT, MODES.SPRINT);
  };

  UI.prototype._startGameplay = function (mode, runType) {
    // Fail-closed: if no DOM → 0 dimensions → game.start must handle gracefully
    var appW = this.appEl ? this.appEl.clientWidth : 0;
    var appH = this.appEl ? this.appEl.clientHeight : 0;

    // Reset microFeedback
    var mf = this._runtime.microFeedback;
    mf.smashStreak = 0;
    mf.maxSmashStreak = 0;
    mf.tierShown = 0;
    mf.lastOverlayAtSmash = -999;
    mf.lastLifeShown = false;
    mf.kitchenMasterShown = false;
    mf.endHighlight = "";
    mf.endHighlightVariant = "";
    mf.endHighlightPriority = -1;
    mf.tierShownOnce = { start: false, building: false, strong: false, elite: false, legendary: false };

    // Reset juice effects
    var juice = this._runtime.juice;
    juice.flashType = "";
    juice.flashUntil = 0;
    juice.shakeUntil = 0;
    juice.milestoneGlowUntil = 0;
    juice.firstKitchenPulseUntil = 0;
    juice.bounceFlashBalls = {};
    juice.lastPlayedBounceAt = 0;
    juice.sprintPenaltyUntil = 0;
    juice.scorePopups = [];

    this._runtime.tapLocked = false;
    this._runtime.finishingRun = false;

    // Start engine
    this.game.start({ config: this.config, mode: mode, canvasW: appW, canvasH: appH });

    // beforeunload guard (warn on accidental tab close during gameplay)
    if (!this._beforeUnloadHandler) {
      var self = this;
      this._beforeUnloadHandler = function (e) { if (self.state === STATES.PLAYING) e.preventDefault(); };
      window.addEventListener("beforeunload", this._beforeUnloadHandler);
    }

    this.setState(STATES.PLAYING);

    // Show run start overlay
    this._showRunStartOverlay(mode, runType);
  };


  // ============================================
  // Run start overlay
  // ============================================
  UI.prototype._showRunStartOverlay = function (mode, runType) {
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

      // Sprint free runs remaining
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

    if (!line1 && !line2) return;

    var node = el("kr-run-start-overlay");
    if (!node) return;

    // "Tap anywhere to start" hint (Sprint only)
    var tapHint = "";
    if (mode === MODES.SPRINT) {
      var spTap = String((w?.sprint || {}).startOverlayTapAnywhere || "").trim();
      if (spTap) tapHint = '<p class="kr-run-start-hint kr-muted">' + escapeHtml(spTap) + '</p>';
    }

    node.innerHTML =
      '<div class="kr-run-start-content">' +
        '<p class="kr-run-start-line1">' + escapeHtml(line1) + '</p>' +
        (line2 ? '<p class="kr-run-start-line2">' + escapeHtml(line2) + '</p>' : "") +
        tapHint +
      '</div>';
    node.classList.add("kr-run-start-overlay--visible");

    // Auto-dismiss
    if (this._runtime.runStartOverlayTimerId) clearTimeout(this._runtime.runStartOverlayTimerId);
    this._runtime.runStartOverlayTimerId = setTimeout(function () {
      node.classList.remove("kr-run-start-overlay--visible");
    }, ms);

    // Tap to dismiss early
    node.addEventListener("pointerdown", function dismiss() {
      node.classList.remove("kr-run-start-overlay--visible");
      node.removeEventListener("pointerdown", dismiss);
    }, { once: true });
  };


  // ============================================
  // First run framing (one-shot trust line)
  // ============================================
  UI.prototype._showFirstRunFraming = function (callback) {
    var fw = this.wording?.firstRun || {};
    var trustLine = String(fw.trustLine || "").trim();
    if (!trustLine) { callback(); return; }

    var kitchenHint = String(fw.kitchenHint || "").trim();
    var kitchenHtml = kitchenHint ? '<p class="kr-first-run-hint kr-muted">' + escapeHtml(kitchenHint) + '</p>' : "";

    // Mini-tutorial: 3 visual rules
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


  // ============================================
  // Game loop (Canvas requestAnimationFrame)
  // ============================================
  UI.prototype._startGameLoop = function () {
    this._lastFrameTs = performance.now();
    var self = this;

    function loop(ts) {
      if (self.state !== STATES.PLAYING) return;
      var dtMs = ts - self._lastFrameTs;
      self._lastFrameTs = ts;

      var state = self.game.update(dtMs);
      self._renderCanvas(state);
      self._renderHUD(state);

      if (state.done) { self._finishRun(state); return; }
      self._rafId = requestAnimationFrame(loop);
    }

    this._rafId = requestAnimationFrame(loop);
  };

  UI.prototype._stopGameLoop = function () {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  };


  // ============================================
  // Canvas rendering
  // ============================================
  UI.prototype._renderCanvas = function (state) {
    var canvas = this._canvas;
    if (!canvas) return;
    var ctx = this._ctx;
    if (!ctx) return;

    var w = canvas.width;
    var h = canvas.height;
    var canvasCfg = this.config.canvas || {};
    var colors = canvasCfg.colors;
    // Fail-closed: if colors not configured, render nothing (blank canvas)
    if (!colors || typeof colors !== "object") return;

    var kitchenLineY = Number(canvasCfg.kitchenLineY) * h;
    if (!Number.isFinite(kitchenLineY) || kitchenLineY <= 0) return;

    var juice = this._runtime.juice;
    var n = performance.now();

    // Bounce animation config
    var bounceHeight = requiredConfigNumber(canvasCfg.bounceHeight, "KR_CONFIG.canvas.bounceHeight", { min: 0 });
    var bounceAnimMs = requiredConfigNumber(canvasCfg.bounceAnimMs, "KR_CONFIG.canvas.bounceAnimMs", { min: 1, integer: true });
    var smashOutMs = requiredConfigNumber(canvasCfg.smashOutMs, "KR_CONFIG.canvas.smashOutMs", { min: 1, integer: true });
    var smashOutDistance = requiredConfigNumber(canvasCfg.smashOutDistance, "KR_CONFIG.canvas.smashOutDistance", { min: 1 });
    var scorePopupMs = requiredConfigNumber(canvasCfg.scorePopupMs, "KR_CONFIG.canvas.scorePopupMs", { min: 1, integer: true });

    // Screen shake offset
    var shakeX = 0, shakeY = 0;
    if (juice.shakeUntil > n) {
      var intensity = juice.shakeIntensity || 6;
      shakeX = (Math.random() - 0.5) * intensity * 2;
      shakeY = (Math.random() - 0.5) * intensity * 2;
    }

    ctx.save();
    if (shakeX || shakeY) ctx.translate(shakeX, shakeY);

    // Court background
    ctx.clearRect(-10, -10, w + 20, h + 20);

    // Milestone tint: shift court hue at milestones
    var milestones = state.milestonesReached || [];
    var courtColor = colors.courtBg;
    var kitchenColor = colors.kitchenBg;
    if (milestones.length >= 3 && colors.milestone3CourtBg) {
      courtColor = colors.milestone3CourtBg; kitchenColor = colors.milestone3KitchenBg || kitchenColor;
    } else if (milestones.length >= 2 && colors.milestone2CourtBg) {
      courtColor = colors.milestone2CourtBg; kitchenColor = colors.milestone2KitchenBg || kitchenColor;
    } else if (milestones.length >= 1 && colors.milestone1CourtBg) {
      courtColor = colors.milestone1CourtBg; kitchenColor = colors.milestone1KitchenBg || kitchenColor;
    }

    ctx.fillStyle = courtColor;
    ctx.fillRect(0, 0, w, h);

    // Kitchen zone (darker)
    ctx.fillStyle = kitchenColor;
    ctx.fillRect(0, kitchenLineY, w, h - kitchenLineY);

    // Kitchen label text
    if (colors.kitchenLabelColor) {
      ctx.font = "bold " + Math.round(w * 0.05) + "px system-ui, sans-serif";
      ctx.fillStyle = colors.kitchenLabelColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("KITCHEN", w / 2, kitchenLineY + (h - kitchenLineY) / 2);
    }

    // Milestone glow: brief flash when milestone first reached
    var msGlowMs = requiredConfigNumber(this.config?.juice?.milestoneGlowMs, "KR_CONFIG.juice.milestoneGlowMs", { min: 1, integer: true });
    if (state.lastMilestoneAt && (n - state.lastMilestoneAt) < msGlowMs) {
      var glowAlpha = Math.max(0, 0.15 * (1 - (n - state.lastMilestoneAt) / msGlowMs));
      ctx.fillStyle = "rgba(255,255,255," + glowAlpha + ")";
      ctx.fillRect(0, 0, w, h);
      // Play milestone sound once
      if (!juice.milestoneGlowUntil || juice.milestoneGlowUntil < state.lastMilestoneAt) {
        juice.milestoneGlowUntil = state.lastMilestoneAt + msGlowMs;
        this._playSound("milestone");
      }
    }

    // Kitchen line (solid, prominent)
    ctx.strokeStyle = colors.kitchenLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, kitchenLineY);
    ctx.lineTo(w, kitchenLineY);
    ctx.stroke();

    // Net at top (subtle)
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.02);
    ctx.lineTo(w, h * 0.02);
    ctx.stroke();

    // First Kitchen ball: pulse the kitchen line + zone
    var balls = state.balls || [];
    var hasFirstKitchen = false;
    for (var fi = 0; fi < balls.length; fi++) {
      if (balls[fi].isFirstKitchen && (balls[fi].state === "FALLING" || balls[fi].state === "LANDED")) {
        hasFirstKitchen = true; break;
      }
    }
    if (hasFirstKitchen) {
      var pulseAlpha = 0.15 + 0.15 * Math.sin(n / 150);
      ctx.fillStyle = "rgba(255,204,0," + pulseAlpha + ")";
      ctx.fillRect(0, kitchenLineY, w, h - kitchenLineY);
      ctx.strokeStyle = "rgba(255,204,0," + (pulseAlpha + 0.2) + ")";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, kitchenLineY);
      ctx.lineTo(w, kitchenLineY);
      ctx.stroke();
    }

    // Balls
    for (var i = 0; i < balls.length; i++) {
      var b = balls[i];

      // Calculate visual Y (with bounce animation)
      var visualY = b.y;
      var visualRadius = b.radius;
      var bounceOffset = 0;

      // Bounce animation: ball jumps up after landing
      if (b.state === "BOUNCING" && b.bouncedAt > 0) {
        var sinceBounce = n - b.bouncedAt;
        if (sinceBounce < bounceAnimMs) {
          var t_bounce = sinceBounce / bounceAnimMs;
          // Parabolic bounce: up then down
          bounceOffset = Math.sin(t_bounce * Math.PI) * bounceHeight * h;
          visualY = b.y - bounceOffset;
          // Slight squash at start, stretch at peak
          if (t_bounce < 0.2) {
            visualRadius = b.radius * (1 + 0.15 * (1 - t_bounce / 0.2));
          }
        }
      }

      // Landed squash effect (brief)
      if (b.state === "LANDED" && b.landedAt > 0) {
        var sinceLand = n - b.landedAt;
        if (sinceLand < 100) {
          var squashT = sinceLand / 100;
          visualRadius = b.radius * (1 + 0.2 * (1 - squashT));
        }
      }

      // Smash-out animation: ball flies away
      if (b.state === "SMASHED" && b.smashedAt > 0) {
        var sinceSmash = n - b.smashedAt;
        if (sinceSmash < smashOutMs) {
          var smashT = sinceSmash / smashOutMs;
          var eased = 1 - Math.pow(1 - smashT, 3); // ease-out cubic
          var angle = b.smashOutAngle || -Math.PI / 2;
          visualY = b.y + Math.sin(angle) * smashOutDistance * eased;
          var visualX_offset = Math.cos(angle) * smashOutDistance * eased;
          b._renderX = b.x + visualX_offset;
          visualRadius = b.radius * (1 - smashT * 0.5);
          ctx.globalAlpha = Math.max(0, 1 - smashT);
          ctx.fillStyle = colors.ballSmashed;
          ctx.beginPath();
          ctx.arc(b._renderX || b.x, visualY, Math.max(1, visualRadius), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          continue; // Skip normal rendering for smash-out balls
        } else {
          ctx.globalAlpha = 0;
          continue; // Fully faded
        }
      }

      // Faulted flash
      if (b.state === "FAULTED") {
        var sinceFault = n - (b.faultedAt || 0);
        if (sinceFault < 300) {
          ctx.globalAlpha = Math.max(0, 0.7 * (1 - sinceFault / 300));
          ctx.fillStyle = colors.ballFaulted;
          // Expand ring
          var faultRad = b.radius + (sinceFault / 300) * 20;
          ctx.beginPath();
          ctx.arc(b.x, b.y, faultRad, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        continue;
      }

      // Missed fade
      if (b.state === "MISSED") {
        var sinceMiss = n - (b.missedAt || 0);
        if (sinceMiss < 400) {
          ctx.globalAlpha = Math.max(0, 0.4 * (1 - sinceMiss / 400));
          ctx.fillStyle = colors.ballMissed;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        continue;
      }

      // Trail (falling balls only)
      if (b.state === "FALLING" && b.trail && b.trail.length > 0) {
        for (var ti = 0; ti < b.trail.length; ti++) {
          var trailAlpha = 0.05 + 0.05 * (ti / b.trail.length);
          var trailRadius = b.radius * (0.3 + 0.4 * (ti / b.trail.length));
          ctx.globalAlpha = trailAlpha;
          ctx.fillStyle = b.inKitchen ? colors.ballKitchen : colors.ballDefault;
          ctx.beginPath();
          ctx.arc(b.trail[ti].x, b.trail[ti].y, trailRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Shadow (falling + landed + bouncing)
      if ((b.state === "FALLING" || b.state === "LANDED" || b.state === "BOUNCING") && b.landingY > 0) {
        var progress = Math.min(1, b.y / b.landingY);
        var sf = Number(canvasCfg.shadowGrowthFactor);
        var sr = b.radius * (0.4 + progress * (Number.isFinite(sf) ? sf : 0));
        // Shadow is always at ground level (landingY), size increases with height
        var shadowAlpha = 0.2 * progress;
        if (b.state === "BOUNCING" && bounceOffset > 0) {
          sr = b.radius * (0.6 + 0.4 * (1 - bounceOffset / (bounceHeight * h)));
          shadowAlpha = 0.25;
        }
        ctx.globalAlpha = shadowAlpha;
        ctx.fillStyle = colors.shadow;
        ctx.beginPath();
        ctx.ellipse(b.x, b.landingY + b.radius * 0.3, sr, sr * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // "WAIT!" text above Kitchen balls while falling
      if (b.inKitchen && b.state === "FALLING" && b.y > h * 0.15) {
        var waitAlpha = 0.4 + 0.3 * Math.sin(n / 200);
        ctx.globalAlpha = waitAlpha;
        ctx.font = "bold " + Math.round(b.radius * 1.1) + "px system-ui, sans-serif";
        ctx.fillStyle = colors.waitIndicator || "#ffd60a";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("WAIT", b.x, b.y - b.radius - 6);
        ctx.globalAlpha = 1;
      }

      // Ball color by state
      ctx.globalAlpha = 1;
      var bt = b.ballType || "normal";
      if (bt === "dink" && colors.ballDink) ctx.fillStyle = colors.ballDink;
      else if (bt === "lob" && colors.ballLob) ctx.fillStyle = colors.ballLob;
      else if (bt === "fast" && colors.ballFast) ctx.fillStyle = colors.ballFast;
      else if (b.inKitchen) ctx.fillStyle = colors.ballKitchen;
      else ctx.fillStyle = colors.ballDefault;

      // Ball glow (outer ring for visibility)
      var glowColor = ctx.fillStyle;
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 12;

      // Ball body
      ctx.beginPath();
      ctx.arc(b.x, visualY, visualRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Inner highlight (gives 3D feel)
      var grad = ctx.createRadialGradient(b.x - visualRadius * 0.3, visualY - visualRadius * 0.3, visualRadius * 0.1, b.x, visualY, visualRadius);
      grad.addColorStop(0, "rgba(255,255,255,0.4)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, visualY, visualRadius, 0, Math.PI * 2);
      ctx.fill();

      // Bounce flash: bright ring at exact moment of bounce (Kitchen balls)
      if (b.state === "BOUNCING" && b.bouncedAt > 0) {
        var sinceBounceFlash = n - b.bouncedAt;
        var bounceFlashMs = requiredConfigNumber(this.config?.juice?.bounceRingMs, "KR_CONFIG.juice.bounceRingMs", { min: 1, integer: true });
        if (sinceBounceFlash < bounceFlashMs) {
          var bounceAlpha = Math.max(0, 1 - sinceBounceFlash / bounceFlashMs);
          var bounceRad = visualRadius + 6 + (sinceBounceFlash / bounceFlashMs) * 15;
          ctx.strokeStyle = "rgba(6,214,160," + bounceAlpha.toFixed(2) + ")";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(b.x, visualY, bounceRad, 0, Math.PI * 2);
          ctx.stroke();

          // "NOW!" text briefly
          if (sinceBounceFlash < bounceFlashMs * 0.6) {
            ctx.globalAlpha = bounceAlpha;
            ctx.font = "bold " + Math.round(b.radius * 1.2) + "px system-ui, sans-serif";
            ctx.fillStyle = "#06d6a0";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText("NOW!", b.x, visualY - visualRadius - 8);
            ctx.globalAlpha = 1;
          }

          // Play bounce sound once per ball
          if (!juice.bounceFlashBalls[b.id]) {
            juice.bounceFlashBalls[b.id] = true;
            this._playSound("bounce");
          }
        }
      }

      // Bounce indicator ring (Kitchen balls post-bounce = smashable, pulsing)
      if (b.state === "BOUNCING") {
        var pulseScale = 1 + 0.1 * Math.sin(n / 80);
        ctx.strokeStyle = colors.bounceRing;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(b.x, visualY, (visualRadius + 5) * pulseScale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Miss sound (when ball transitions to MISSED)
      if (b.state === "MISSED" && b.id && !juice.bounceFlashBalls["miss_" + b.id]) {
        juice.bounceFlashBalls["miss_" + b.id] = true;
        this._playSound("miss");
      }

      ctx.globalAlpha = 1;
    }

    // Score popups (+1 floating up)
    if (juice.scorePopups) {
      for (var sp = juice.scorePopups.length - 1; sp >= 0; sp--) {
        var popup = juice.scorePopups[sp];
        var popElapsed = n - popup.at;
        if (popElapsed > scorePopupMs) {
          juice.scorePopups.splice(sp, 1);
          continue;
        }
        var popT = popElapsed / scorePopupMs;
        var popAlpha = Math.max(0, 1 - popT);
        var popY = popup.y - popT * 60;
        ctx.globalAlpha = popAlpha;
        ctx.font = "bold " + Math.round(24 + (1 - popT) * 8) + "px system-ui, sans-serif";
        ctx.fillStyle = colors.scorePopup || "#06d6a0";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+1", popup.x, popY);
        ctx.globalAlpha = 1;
      }
    }

    // Smash flash: bright burst at tap point (larger, more particles)
    if (juice.flashType === "smash" && juice.flashUntil > n) {
      var smashFlashDur = requiredConfigNumber(this.config?.juice?.smashFlashMs, "KR_CONFIG.juice.smashFlashMs", { min: 1, integer: true });
      var flashProgress = 1 - (juice.flashUntil - n) / smashFlashDur;
      var flashAlpha = Math.max(0, 0.9 * (1 - flashProgress));
      var flashRad = 25 + flashProgress * 50;
      ctx.fillStyle = "rgba(6,214,160," + flashAlpha.toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(juice.flashX, juice.flashY, flashRad, 0, Math.PI * 2);
      ctx.fill();

      // Ring expanding outward
      ctx.strokeStyle = "rgba(255,255,255," + (flashAlpha * 0.6).toFixed(2) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(juice.flashX, juice.flashY, flashRad * 1.3, 0, Math.PI * 2);
      ctx.stroke();

      // Micro-particles (8 expanding dots)
      for (var pi = 0; pi < 8; pi++) {
        var angle = (Math.PI * 2 / 8) * pi + flashProgress * 0.8;
        var dist = 20 + flashProgress * 40;
        var px = juice.flashX + Math.cos(angle) * dist;
        var py = juice.flashY + Math.sin(angle) * dist;
        var pSize = 3 - flashProgress * 2.5;
        if (pSize > 0) {
          ctx.fillStyle = "rgba(255,255,255," + (flashAlpha * 0.7).toFixed(2) + ")";
          ctx.beginPath();
          ctx.arc(px, py, pSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Fault flash: red vignette
    if (juice.flashType === "fault" && juice.flashUntil > n) {
      var faultFlashDur = requiredConfigNumber(this.config?.juice?.faultFlashMs, "KR_CONFIG.juice.faultFlashMs", { min: 1, integer: true });
      var faultProgress = 1 - (juice.flashUntil - n) / faultFlashDur;
      var faultAlpha = Math.max(0, 0.35 * (1 - faultProgress));
      // Red vignette from edges
      var vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.8);
      vigGrad.addColorStop(0, "rgba(239,71,111,0)");
      vigGrad.addColorStop(1, "rgba(239,71,111," + faultAlpha.toFixed(2) + ")");
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Sprint penalty flash "-2s" overlay
    if (juice.sprintPenaltyUntil > n) {
      var penProgress = 1 - (juice.sprintPenaltyUntil - n) / 400;
      var penAlpha = Math.max(0, 0.9 * (1 - penProgress));
      ctx.font = "bold 32px system-ui, sans-serif";
      ctx.fillStyle = "rgba(239,71,111," + penAlpha.toFixed(2) + ")";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var penText = String(this.wording?.sprint?.penaltyFlash || "").trim();
      if (penText) ctx.fillText(penText, w / 2, h * 0.3 - penProgress * 20);
    }

    // Paddle (bottom area visual indicator)
    if (colors.paddle) {
      var paddleY = h * 0.92;
      var paddleW = w * 0.25;
      var paddleH = 6;
      var paddleX = w / 2 - paddleW / 2;
      ctx.fillStyle = colors.paddle;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(paddleX, paddleY, paddleW, paddleH, 3);
      } else {
        ctx.rect(paddleX, paddleY, paddleW, paddleH);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  };


  // ============================================
  // HUD rendering (DOM overlay on canvas)
  // ============================================
  UI.prototype._renderHUD = function (state) {
    var hudEl = el("kr-hud");
    if (!hudEl) return;

    if (state.mode === MODES.RUN) {
      var livesHtml = "";
      for (var i = 0; i < (state.maxLives || 3); i++) {
        livesHtml += (i < (state.lives || 0))
          ? '<span class="kr-hud-life kr-hud-life--active"></span>'
          : '<span class="kr-hud-life kr-hud-life--lost"></span>';
      }
      hudEl.innerHTML =
        '<div class="kr-hud-row">' +
          '<div class="kr-hud-lives">' + livesHtml + '</div>' +
          '<div class="kr-hud-score">' + state.smashes + '</div>' +
        '</div>';

    } else if (state.mode === MODES.SPRINT) {
      var remaining = Math.max(0, Math.ceil((state.sprintRemainingMs || 0) / 1000));
      var timerLabel = fillTemplate(this.wording?.sprint?.timerLabel || "", { remaining: remaining });
      hudEl.innerHTML =
        '<div class="kr-hud-row">' +
          '<div class="kr-hud-timer">' + escapeHtml(timerLabel) + '</div>' +
          '<div class="kr-hud-score">' + state.smashes + '</div>' +
        '</div>';
    }
  };

  // HUD pulse scheduling: after a delta display (+1, -1, -2s), schedule cleanup render
  UI.prototype._scheduleHudPulseCleanup = function () {
    if (this._runtime.hudPulseCleanupTimerId) clearTimeout(this._runtime.hudPulseCleanupTimerId);
    var ms = requiredConfigNumber(this.config?.ui?.gameplayPulseMs, "KR_CONFIG.ui.gameplayPulseMs", { min: 1, integer: true });
    var self = this;
    this._runtime.hudPulseCleanupTimerId = setTimeout(function () {
      self._runtime.hudPulseCleanupTimerId = null;
      // No explicit action needed: HUD re-renders every frame via _renderHUD
    }, ms);
  };


  // ============================================
  // Canvas tap handler
  // ============================================
  UI.prototype._handleCanvasTap = function (e) {
    if (this.state !== STATES.PLAYING) return;
    if (this._runtime.tapLocked) return;

    var canvas = this._canvas;
    if (!canvas) return;

    var rect = canvas.getBoundingClientRect();
    var rawX = (e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0) - rect.left;
    var rawY = (e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0) - rect.top;

    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;

    var result = this.game.tap(rawX * scaleX, rawY * scaleY);
    if (!result) return;

    // Unlock audio on first tap (iOS/Chrome requirement)
    if (window.KR_Audio && typeof window.KR_Audio.unlock === "function") window.KR_Audio.unlock();

    var juice = this._runtime.juice;
    var n = performance.now();

    // Haptic + audio + visual juice
    if (result.smash) {
      this._haptic("smash");
      this._playSound("smash");
      // Flash effect at ball position
      juice.flashType = "smash";
      juice.flashUntil = n + requiredConfigNumber(this.config?.juice?.smashFlashMs, "KR_CONFIG.juice.smashFlashMs", { min: 1, integer: true });
      juice.flashX = result.ball ? result.ball.x : 0;
      juice.flashY = result.ball ? result.ball.y : 0;
      // Score popup
      if (!juice.scorePopups) juice.scorePopups = [];
      juice.scorePopups.push({
        x: result.ball ? result.ball.x : w / 2,
        y: result.ball ? result.ball.y : h / 2,
        at: n
      });
    }
    if (result.fault) {
      this._haptic("fault");
      this._playSound("fault");
      // Flash + shake
      juice.flashType = "fault";
      juice.flashUntil = n + requiredConfigNumber(this.config?.juice?.faultFlashMs, "KR_CONFIG.juice.faultFlashMs", { min: 1, integer: true });
      juice.flashX = result.ball ? result.ball.x : 0;
      juice.flashY = result.ball ? result.ball.y : 0;
      juice.shakeUntil = n + requiredConfigNumber(this.config?.juice?.faultShakeMs, "KR_CONFIG.juice.faultShakeMs", { min: 1, integer: true });
      juice.shakeIntensity = requiredConfigNumber(this.config?.juice?.faultShakeIntensity, "KR_CONFIG.juice.faultShakeIntensity", { min: 0 });

      // Sprint: penalty flash "-2s"
      if (this._runtime.runMode === MODES.SPRINT) {
        juice.sprintPenaltyUntil = n + requiredConfigNumber(this.config?.juice?.sprintPenaltyMs, "KR_CONFIG.juice.sprintPenaltyMs", { min: 1, integer: true });
      }
    }

    // microFeedback
    this._handleMicroFeedback(result);
  };


  // ============================================
  // Audio & Haptic
  // ============================================
  UI.prototype._haptic = function (type) {
    if (this._store("getHapticsEnabled") === false) return;
    var cfg = this.config.haptic || {};
    if (!cfg.enabled) return;
    var pattern = (type === "smash") ? cfg.smashPattern : cfg.faultPattern;
    if (!pattern || !Array.isArray(pattern)) return;
    try { navigator.vibrate(pattern); } catch (_) { }
  };

  UI.prototype._playSound = function (type, opts) {
    if (this._store("getSoundEnabled") === false) return;
    var cfg = this.config.audio || {};
    if (!cfg.enabled) return;
    if (!window.KR_Audio || typeof window.KR_Audio.play !== "function") return;

    var volMap = {
      smash: cfg.smashVolume,
      fault: cfg.faultVolume,
      bounce: cfg.bounceVolume,
      miss: cfg.faultVolume,
      gameOver: cfg.faultVolume,
      sprintBuzzer: cfg.smashVolume,
      milestone: cfg.smashVolume,
      newBest: cfg.smashVolume
    };

    // V2: streak pitch shift (smash only) — pitch rises with streak
    var pitch = 1;
    if (type === "smash" && this._runtime && this._runtime.microFeedback) {
      var streak = this._runtime.microFeedback.smashStreak || 0;
      // Subtle: +2% per streak smash, cap at +30% (15 streak)
      pitch = 1 + Math.min(streak * 0.02, 0.3);
    }

    window.KR_Audio.play(type, requiredConfigNumber(volMap[type], "KR_CONFIG.audio volume for " + type, { min: 0, max: 1 }), pitch);
  };


  // ============================================
  // MicroFeedback (arcade-adapted from WT microPics)
  // Smash streaks + Kitchen master + Close call (last life)
  // ============================================
  UI.prototype._handleMicroFeedback = function (result) {
    if (!this._runtime) return;
    var mode = this._runtime.runMode;
    // microFeedback only in RUN (Sprint is pure speed, no distractions)
    if (mode !== MODES.RUN) return;

    var mf = this._runtime.microFeedback;
    if (!mf) return;

    var cfg = this.config;
    var mfw = (this.wording && this.wording.microFeedback) ? this.wording.microFeedback : {};
    var mfCfg = cfg?.microFeedback;
    if (!mfCfg || typeof mfCfg !== "object") throw new Error("KR_CONFIG.microFeedback missing");

    var gameState = (this.game && typeof this.game.getState === "function") ? (this.game.getState() || {}) : {};
    var totalSmashes = gameState.smashes || 0;
    var cooldown = requiredConfigNumber(mfCfg.cooldownSmashes, "KR_CONFIG.microFeedback.cooldownSmashes", { min: 0, integer: true });
    var timing = getToastTiming(cfg, "positive");

    var th = mfCfg.streakThresholds;
    if (!th || typeof th !== "object") throw new Error("KR_CONFIG.microFeedback.streakThresholds missing");
    var tStart = requiredConfigNumber(th.start, "KR_CONFIG.microFeedback.streakThresholds.start", { min: 1, integer: true });
    var tBuilding = requiredConfigNumber(th.building, "KR_CONFIG.microFeedback.streakThresholds.building", { min: 1, integer: true });
    var tStrong = requiredConfigNumber(th.strong, "KR_CONFIG.microFeedback.streakThresholds.strong", { min: 1, integer: true });
    var tElite = requiredConfigNumber(th.elite, "KR_CONFIG.microFeedback.streakThresholds.elite", { min: 1, integer: true });
    var tLegendary = requiredConfigNumber(th.legendary, "KR_CONFIG.microFeedback.streakThresholds.legendary", { min: 1, integer: true });

    function tryShowOverlay(msg, variant) {
      var m = String(msg || "").trim();
      if (!m) return false;
      if ((totalSmashes - mf.lastOverlayAtSmash) < cooldown) return false;
      showGameplayOverlay(m, { durationMs: timing.durationMs, variant: String(variant || "info") });
      mf.lastOverlayAtSmash = totalSmashes;
      return true;
    }

    function setEndHighlight(msg, variant, priority) {
      var m = String(msg || "").trim();
      if (!m) return;
      var p = Number(priority);
      if (Number.isFinite(p) && p > (mf.endHighlightPriority || -1)) {
        mf.endHighlight = m;
        mf.endHighlightVariant = String(variant || "");
        mf.endHighlightPriority = p;
      }
    }

    if (result.smash) {
      mf.smashStreak++;
      mf.maxSmashStreak = Math.max(mf.maxSmashStreak, mf.smashStreak);

      var s = mf.smashStreak;
      var once = mf.tierShownOnce;

      // Streak tiers (highest first)
      if (s >= tLegendary && mf.tierShown < tLegendary) {
        var msg = (once.legendary) ? fillTemplate(mfw.streakAgain || "", { n: tLegendary, streak: s }) : String(mfw.streakLegendary || "");
        if (tryShowOverlay(msg, "success")) mf.tierShown = tLegendary;
        once.legendary = true;
        setEndHighlight(msg, "success", 100);
      } else if (s >= tElite && mf.tierShown < tElite) {
        var msg = (once.elite) ? fillTemplate(mfw.streakAgain || "", { n: tElite, streak: s }) : String(mfw.streakElite || "");
        if (tryShowOverlay(msg, "success")) mf.tierShown = tElite;
        once.elite = true;
        setEndHighlight(msg, "success", 90);
      } else if (s >= tStrong && mf.tierShown < tStrong) {
        var msg = (once.strong) ? fillTemplate(mfw.streakAgain || "", { n: tStrong, streak: s }) : String(mfw.streakStrong || "");
        if (tryShowOverlay(msg, "success")) mf.tierShown = tStrong;
        once.strong = true;
        setEndHighlight(msg, "success", 80);
      } else if (s >= tBuilding && mf.tierShown < tBuilding) {
        var msg = (once.building) ? fillTemplate(mfw.streakAgain || "", { n: tBuilding, streak: s }) : String(mfw.streakBuilding || "");
        if (tryShowOverlay(msg, "info")) mf.tierShown = tBuilding;
        once.building = true;
        setEndHighlight(msg, "success", 70);
      } else if (s >= tStart && mf.tierShown < tStart) {
        var msg = (once.start) ? fillTemplate(mfw.streakAgain || "", { n: tStart, streak: s }) : String(mfw.streakStart || "");
        if (tryShowOverlay(msg, "info")) mf.tierShown = tStart;
        once.start = true;
        setEndHighlight(msg, "success", 65);
      }

      // Kitchen master: smash a Kitchen ball post-bounce (one-shot per run)
      if (result.ball && result.ball.inKitchen && !mf.kitchenMasterShown) {
        var kmMsg = String(mfw.kitchenMaster || "").trim();
        if (kmMsg) {
          // Only show if no streak tier was just shown (avoid double overlays)
          if (mf.lastOverlayAtSmash < totalSmashes) {
            if (tryShowOverlay(kmMsg, "success")) mf.kitchenMasterShown = true;
          }
          setEndHighlight(kmMsg, "success", 50);
        }
      }

    } else if (result.fault) {
      // Streak broken on fault
      mf.smashStreak = 0;
      mf.tierShown = 0;

      // Near-miss feedback: Kitchen fault explanation (§6: error + correction = durable learning)
      var tooEarlyMsg = "";
      if (this._runtime.runMode === MODES.RUN) {
        // First Kitchen fault in run: teach the rule (Roediger §1.2: explain errors)
        if ((gameState.totalFaulted || 0) <= 1) {
          tooEarlyMsg = String(mfw.firstFaultExplain || mfw.tooEarly || "").trim();
        } else {
          tooEarlyMsg = String(mfw.tooEarly || "").trim();
        }
      } else {
        // Sprint: short message only
        tooEarlyMsg = String(mfw.tooEarly || "").trim();
      }
      if (tooEarlyMsg) {
        var faultDur = ((gameState.totalFaulted || 0) <= 1)
          ? requiredConfigNumber(this.config?.juice?.firstFaultOverlayMs, "KR_CONFIG.juice.firstFaultOverlayMs", { min: 1, integer: true })
          : requiredConfigNumber(this.config?.juice?.repeatFaultOverlayMs, "KR_CONFIG.juice.repeatFaultOverlayMs", { min: 1, integer: true });
        showGameplayOverlay(tooEarlyMsg, { durationMs: faultDur, variant: "danger" });
        mf.lastOverlayAtSmash = totalSmashes;
      }

      // Close call / Last life warning (one-shot per run)
      if (gameState.lives === 1 && !mf.lastLifeShown) {
        mf.lastLifeShown = true;
        var llMsg = String(mfw.lastLife || "").trim();
        if (llMsg) {
          showGameplayOverlay(llMsg, { durationMs: requiredConfigNumber(cfg?.ui?.lifeLostOverlayMs, "KR_CONFIG.ui.lifeLostOverlayMs", { min: 1, integer: true }), variant: "danger" });
          mf.lastOverlayAtSmash = totalSmashes;
        }
        setEndHighlight(String(mfw.closeCall || "").trim(), "info", 55);
      }
    }
    // Miss: streak broken but no overlay (miss is already punishing enough)
    // Note: misses are handled by game.js update() not by tap, so no result.miss here.
  };


  // ============================================
  // Finish run (game over delay + fade transition)
  // ============================================
  UI.prototype._finishRun = function (state) {
    // Idempotent
    if (this.state === STATES.END) return;

    this._runtime.finishingRun = true;
    this._stopGameLoop();
    hideGameplayOverlay();

    // Hide run start overlay if still visible
    var rso = el("kr-run-start-overlay");
    if (rso) rso.classList.remove("kr-run-start-overlay--visible");

    var result = this.game.getResult();
    var mode = (state && state.mode) || this._runtime.runMode;

    var newBest = false;
    var bestSmashes = 0;

    if (mode === MODES.SPRINT) {
      var sr = this.storage
        ? (this.storage.recordSprintComplete(result.smashes) || {}) : {};
      newBest = !!(sr.newBest);
      bestSmashes = Number(sr.bestSmashes || 0);
    } else {
      var prevRunNumber = this.storage
        ? Number(this.storage.getRunNumber() || 0) : 0;
      var nextRunNumber = Math.max(0, Math.floor(prevRunNumber)) + 1;
      var meta = {
        mode: MODES.RUN,
        endReason: result.endReason,
        endedFrom: "ui",
        totalFaulted: result.totalFaulted || 0,
        totalMissed: result.totalMissed || 0,
        totalSpawned: result.totalSpawned || 0,
        elapsedMs: result.elapsedMs || 0,
        bestStreak: (this._runtime.microFeedback) ? this._runtime.microFeedback.maxSmashStreak : 0
      };
      var rr = this.storage
        ? (this.storage.recordRunComplete(nextRunNumber, result.smashes, meta) || {}) : {};
      newBest = !!(rr.newBest);
      bestSmashes = Number(rr.bestSmashes || 0);
    }

    this._runtime.lastRun = {
      mode: mode,
      smashes: result.smashes,
      lives: result.lives,
      maxLives: result.maxLives,
      newBest: newBest,
      bestSmashes: bestSmashes,
      endReason: result.endReason,
      totalFaulted: result.totalFaulted || 0,
      totalMissed: result.totalMissed || 0,
      totalSpawned: result.totalSpawned || 0,
      elapsedMs: result.elapsedMs || 0,
      bestStreak: (this._runtime.microFeedback) ? this._runtime.microFeedback.maxSmashStreak : 0
    };

    // Game over audio
    if (mode === MODES.SPRINT) {
      this._playSound("sprintBuzzer");
    } else {
      this._playSound("gameOver");
    }

    // Fade transition (respect reduced motion)
    var reduceMotion = false;
    try { reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (_) { }

    if (reduceMotion || !this.appEl) {
      this._runtime.finishingRun = false;
      if (newBest) this._playSound("newBest");
      this.setState(STATES.END);
      return;
    }

    // FREEZE phase: hold last canvas frame for 300ms (desaturated)
    var FREEZE_MS = 300;
    var FADE_MS = 200;
    var self = this;

    // Apply desaturation filter during freeze
    if (this._canvas) {
      try { this._canvas.style.filter = "saturate(0.3)"; } catch (_) { }
    }

    setTimeout(function () {
      // Remove desaturation
      if (self._canvas) {
        try { self._canvas.style.filter = ""; } catch (_) { }
      }

      // New best audio (after freeze, before fade — emotional peak)
      if (newBest) self._playSound("newBest");

      try {
        self.appEl.classList.add("transitioning");
        self.appEl.classList.add("kr-fade");
        self.appEl.classList.add("kr-fade--out");
      } catch (_) {
        self._runtime.finishingRun = false;
        self.setState(STATES.END);
        return;
      }

      setTimeout(function () {
        self._runtime.finishingRun = false;
        self.setState(STATES.END);

        setTimeout(function () {
          var a = el("app");
          if (!a) return;
          try {
            a.classList.remove("kr-fade--out");
            a.classList.add("kr-fade--in");
          } catch (_) { }

          setTimeout(function () {
            var b = el("app");
            if (!b) return;
            try { b.classList.remove("kr-fade", "kr-fade--out", "kr-fade--in", "transitioning"); } catch (_) { }
          }, FADE_MS + 40);
        }, 0);
      }, FADE_MS);
    }, FREEZE_MS);
  };


  // ============================================
  // Paywall
  // ============================================
  UI.prototype._startPaywallTicker = function () {
    var ms = requiredConfigNumber(this.config?.ui?.paywallTickerMs, "KR_CONFIG.ui.paywallTickerMs", { min: 1, integer: true });
    if (!Number.isFinite(ms) || ms < 200) return;
    if (this._paywallTickerId) return;
    var self = this;
    this._paywallTickerId = setInterval(function () { self.render(); }, ms);
  };

  UI.prototype._stopPaywallTicker = function () {
    if (this._paywallTickerId) { clearInterval(this._paywallTickerId); this._paywallTickerId = null; }
  };

  UI.prototype._handlePaywallNotNow = function () {
    var from = (this._nav) ? this._nav.paywallFromState : null;
    this.setState((from === STATES.END) ? STATES.END : STATES.LANDING);
  };

  UI.prototype.checkout = function (priceKey) {
    if (!isOnline()) {
      var msg = String(this.wording?.system?.offlinePayment || "").trim();
      if (msg) toastNow(this.config, msg);
      return;
    }
    var cfg = this.config;
    var url = (priceKey === "early")
      ? String(cfg.stripeEarlyPaymentUrl || "").trim()
      : String(cfg.stripeStandardPaymentUrl || "").trim();
    if (!url || url.indexOf("REPLACE") !== -1) return;
    this._store("markCheckoutStarted",priceKey);
    try { window.open(url, "_blank", "noopener"); } catch (_) { }
  };


  // ============================================
  // Share
  // ============================================

  // V2: Generate share card as canvas image
  // V2.1: + verification hash + daily label + hashtag

  // Soft anti-tamper hash: 4-char hex derived from score+mode+date+salt
  // NOT cryptographic — just enough to prevent casual Photoshop edits
  function shareHash(score, mode, salt) {
    var d = new Date();
    var str = String(score) + "|" + String(mode) + "|" + d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() + "|" + String(salt);
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return ((h >>> 0) % 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
  }

  function todayDateParts() {
    var d = new Date();
    var monthNames = (window.KR_WORDING && window.KR_WORDING.system && window.KR_WORDING.system.monthsShort)
      ? window.KR_WORDING.system.monthsShort
      : [];
    return { month: monthNames[d.getMonth()] || "", day: d.getDate(), year: d.getFullYear() };
  }

  UI.prototype._generateShareCard = function () {
    var last = (this._runtime && this._runtime.lastRun) ? this._runtime.lastRun : {};
    var w = (this.wording && this.wording.share) ? this.wording.share : {};
    var appName = String(this.config?.identity?.appName || "").trim();
    var score = last.smashes || 0;
    var best = last.bestSmashes || 0;
    var isSprint = (last.mode === MODES.SPRINT);
    var isDaily = !!(this.config?.daily?.enabled && last.mode === MODES.RUN);
    var colors = this.config?.canvas?.colors;
    if (!colors) return null;

    var salt = String(this.config?.share?.verificationSalt || "").trim();
    var hash = salt ? shareHash(score, last.mode || MODES.RUN, salt) : "";

    var cardW = 600;
    var cardH = 340;

    var canvas = document.createElement("canvas");
    canvas.width = cardW;
    canvas.height = cardH;
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Background (court color)
    ctx.fillStyle = colors.courtBg;
    ctx.fillRect(0, 0, cardW, cardH);

    // Kitchen zone (bottom third)
    var kitchenY = cardH * 0.65;
    ctx.fillStyle = colors.kitchenBg;
    ctx.fillRect(0, kitchenY, cardW, cardH - kitchenY);

    // Kitchen line
    ctx.strokeStyle = colors.kitchenLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(0, kitchenY);
    ctx.lineTo(cardW, kitchenY);
    ctx.stroke();
    ctx.setLineDash([]);

    // App name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(appName, cardW / 2, 24);

    // Mode / Daily label
    var modeLabel = "";
    if (isDaily) {
      modeLabel = String(w.cardDailyLabel || "").trim();
      // Add date
      var dp = todayDateParts();
      var dateFmt = String(w.cardDateFormat || "").trim();
      if (dateFmt && modeLabel) {
        modeLabel += " — " + fillTemplate(dateFmt, dp);
      }
    } else if (isSprint) {
      modeLabel = String(w.cardSprintLabel || "").trim();
    }
    if (modeLabel) {
      ctx.font = "16px system-ui, -apple-system, sans-serif";
      ctx.globalAlpha = 0.7;
      ctx.fillText(modeLabel, cardW / 2, 56);
      ctx.globalAlpha = 1;
    }

    // Score (big)
    ctx.font = "bold 96px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(String(score), cardW / 2, cardH * 0.42);

    // "Smashes" label
    var smashLabel = String(w.cardSmashesLabel || "").trim();
    if (smashLabel) {
      ctx.font = "20px system-ui, -apple-system, sans-serif";
      ctx.globalAlpha = 0.8;
      ctx.fillText(smashLabel, cardW / 2, cardH * 0.58);
      ctx.globalAlpha = 1;
    }

    // Best score line
    if (best > 0 && !isSprint) {
      var bestLabel = String(w.cardBestLabel || "").trim();
      if (bestLabel) {
        ctx.font = "16px system-ui, -apple-system, sans-serif";
        ctx.globalAlpha = 0.6;
        ctx.fillText(fillTemplate(bestLabel, { best: best }), cardW / 2, cardH * 0.68);
        ctx.globalAlpha = 1;
      }
    }

    // Verification hash (bottom-right corner, small)
    if (hash) {
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.globalAlpha = 0.35;
      ctx.fillText("#" + hash, cardW - 12, cardH - 10);
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
    }

    // Tagline at bottom-center
    var tagline = String(w.cardTagline || "").trim();
    if (tagline) {
      ctx.font = "14px system-ui, -apple-system, sans-serif";
      ctx.globalAlpha = 0.5;
      ctx.fillText(tagline, cardW / 2, cardH - 20);
      ctx.globalAlpha = 1;
    }

    return canvas;
  };

  UI.prototype._getShareText = function () {
    var w = (this.wording && this.wording.share) ? this.wording.share : {};
    var last = (this._runtime && this._runtime.lastRun) ? this._runtime.lastRun : {};
    var url = String(this.config?.identity?.appUrl || "").trim();
    var isDaily = !!(this.config?.daily?.enabled && last.mode === MODES.RUN);

    // Dynamic hashtag: #KitchenRush{score}
    var hashtagPrefix = String(w.hashtagPrefix || "").trim();
    var hashtag = hashtagPrefix ? hashtagPrefix + (last.smashes || 0) : "";

    // Date string for daily
    var dp = todayDateParts();
    var dateStr = dp.month + " " + dp.day;

    var tpl = "";
    if (isDaily) tpl = w.templateDaily || w.templateDefault || "";
    else if (last.mode === MODES.SPRINT) tpl = w.templateSprint || "";
    else if (last.newBest) tpl = w.templateNewBest || "";
    else if (last.totalFaulted > 0) tpl = w.templateFault || "";
    else tpl = w.templateDefault || "";

    var raw = fillTemplate(tpl, { score: last.smashes || 0, best: last.bestSmashes || 0, url: url, hashtag: hashtag, date: dateStr });
    // Clean trailing spaces per line (when {hashtag} resolves to "")
    return raw.split("\n").map(function (l) { return l.trimEnd(); }).join("\n");
  };

  UI.prototype.copyShareText = async function () {
    var text = this._getShareText();
    if (!text) return;
    this._store("markShareClicked");

    // V2: Try Web Share API with image card first
    var card = this._generateShareCard();
    if (card && navigator.share && navigator.canShare) {
      try {
        var blob = await new Promise(function (resolve) { card.toBlob(resolve, "image/png"); });
        if (blob) {
          var file = new File([blob], "kitchen-rush-score.png", { type: "image/png" });
          var shareData = { text: text, files: [file] };
          if (navigator.canShare(shareData)) {
            await navigator.share(shareData);
            return;
          }
        }
      } catch (e) {
        // User cancelled or API not available — fall through to text
        if (e && e.name === "AbortError") return;
      }
    }

    // Fallback: text-only share
    if (navigator.share) {
      try { await navigator.share({ text: text }); return; } catch (_) { }
    }

    // Fallback: clipboard
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      try {
        var ta = document.createElement("textarea"); ta.value = text;
        document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
      } catch (_) { return; }
    }
    var msg = String(this.wording?.share?.toastCopied || "").trim();
    if (msg) toastNow(this.config, msg, { timingKey: "positive" });
  };

  UI.prototype.sendShareViaEmail = function () {
    var text = this._getShareText();
    if (!text) return;
    this._store("markShareClicked");
    var subject = String(this.config?.identity?.appName || "").trim();
    var url = "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text);
    try { window.open(url, "_self"); } catch (_) { }
  };

  // Reco 3: Share card modal — full-screen preview of the share image
  UI.prototype._showShareCardModal = function () {
    if (this.state !== STATES.END) return;
    var card = this._generateShareCard();
    if (!card) return;

    var sw = (this.wording && this.wording.share) ? this.wording.share : {};
    var shareTitle = String(sw.cardModalTitle || "").trim();
    var shareCta = String(sw.ctaLabel || "").trim();

    var dataUrl = "";
    try { dataUrl = card.toDataURL("image/png"); } catch (_) { return; }

    var html = '<div class="kr-share-card-modal">';
    if (shareTitle) html += '<p class="kr-share-card-title">' + escapeHtml(shareTitle) + '</p>';
    html += '<img src="' + dataUrl + '" class="kr-share-card-img" alt="Score card" />';
    html += '<div class="kr-actions">';
    if (shareCta) html += '<button id="kr-share-card-btn" class="kr-btn kr-btn--primary">' + escapeHtml(shareCta) + '</button>';
    html += '</div></div>';

    this.openModal(html);

    var self = this;
    var btn = el("kr-share-card-btn");
    if (btn) btn.addEventListener("click", function () {
      self.closeModal();
      self.copyShareText();
    });
  };


  // ============================================
  // Modal system
  // ============================================
  UI.prototype.openModal = function (html) {
    var overlay = el("kr-modal-overlay");
    var content = el("kr-modal-content");
    if (!overlay || !content) return;
    content.innerHTML = html;
    overlay.classList.add("kr-modal--visible");
    overlay.setAttribute("aria-hidden", "false");

    var focusable = content.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    if (focusable.length) focusable[0].focus();

    var self = this;
    overlay.addEventListener("click", function (e) { if (e.target === overlay) self.closeModal(); }, { once: true });
  };

  UI.prototype.closeModal = function () {
    var overlay = el("kr-modal-overlay");
    if (overlay) { overlay.classList.remove("kr-modal--visible"); overlay.setAttribute("aria-hidden", "true"); }
  };


  // ============================================
  // HowTo modal
  // ============================================
  UI.prototype.openHowToModal = function () {
    var w = this.wording?.howto || {};
    var premium = !!(this._store("isPremium"));

    var h = '<h2 class="kr-h2">' + escapeHtml(w.title || "") + '</h2>';
    h += '<p>' + escapeHtml(w.line1 || "") + '</p>';
    h += '<p>' + escapeHtml(w.line2 || "") + '</p>';
    h += '<p>' + escapeHtml(w.line3 || "") + '</p>';
    if (w.ruleTitle) h += '<h3 class="kr-h3">' + escapeHtml(w.ruleTitle) + '</h3>';
    if (w.ruleSentence) h += '<p class="kr-muted">' + escapeHtml(w.ruleSentence) + '</p>';

    if (!premium) {
      h += '<div class="kr-divider"></div>';
      h += '<h3 class="kr-h3">' + escapeHtml(w.premiumTitle || "") + '</h3>';
      h += '<h4>' + escapeHtml(w.activateTitle || "") + '</h4>';
      h += '<div class="kr-redeem-inline">';
      h += '<input id="kr-howto-code" type="text" class="kr-input" placeholder="' + escapeHtml(w.activationCodePlaceholder || "") + '" maxlength="16" autocomplete="off" />';
      h += '<button id="kr-howto-redeem" class="kr-btn kr-btn--secondary">' + escapeHtml(w.redeemCta || "") + '</button>';
      h += '</div>';
    }
    h += '<div class="kr-actions"><button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(this.wording?.system?.close || "") + '</button></div>';

    this.openModal(h);

    var self = this;
    var redeemBtn = el("kr-howto-redeem");
    if (redeemBtn) redeemBtn.addEventListener("click", function () {
      var input = el("kr-howto-code");
      if (input) self._redeemCode(String(input.value || "").trim());
    });
  };


  // ============================================
  // Redeem / Premium code
  // ============================================
  UI.prototype.openRedeemModal = function () {
    var w = this.wording?.howto || {};
    var h = '<h2 class="kr-h2">' + escapeHtml(w.activateTitle || "") + '</h2>';
    h += '<div class="kr-redeem-inline">';
    h += '<input id="kr-redeem-code" type="text" class="kr-input" placeholder="' + escapeHtml(w.activationCodePlaceholder || "") + '" maxlength="16" autocomplete="off" />';
    h += '<button id="kr-redeem-confirm" class="kr-btn kr-btn--primary">' + escapeHtml(w.redeemCta || "") + '</button>';
    h += '</div>';
    h += '<div class="kr-actions"><button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(this.wording?.system?.close || "") + '</button></div>';
    this.openModal(h);

    var self = this;
    var btn = el("kr-redeem-confirm");
    if (btn) btn.addEventListener("click", function () {
      var input = el("kr-redeem-code");
      if (input) self._redeemCode(String(input.value || "").trim());
    });
  };

  UI.prototype._redeemCode = function (code) {
    if (!code) return;
    var result = this.storage
      ? this.storage.tryRedeemPremiumCode(code) : null;
    if (result && result.ok) {
      this.closeModal();
      var msg = String(this.wording?.system?.premiumUnlockedToast || "").trim();
      if (msg) toastNow(this.config, msg, { timingKey: "positive" });
      this.render();
    }
  };

  UI.prototype.promptAutoRedeemIfReady = function () {
    if (this._store("isPremium")) return;
    var code = String(this._store("getVanityCode") || "").trim();
    if (!code) return;

    var result = this.storage
      ? this.storage.tryRedeemPremiumCode(code) : null;
    if (result && result.ok) {
      var msg = String(this.wording?.system?.premiumUnlockedToast || "").trim();
      if (msg) toastNow(this.config, msg, { timingKey: "positive" });
      this.render();
    }
  };

  UI.prototype.openAutoRedeemModal = function () {
    var code = String(this._store("getVanityCode") || "").trim();
    if (!code) return;
    if (!code) return;

    var w = this.wording?.howto || {};
    var h = '<h2 class="kr-h2">' + escapeHtml(w.autoActivateTitle || w.activateTitle || "") + '</h2>';
    h += '<p>' + escapeHtml(w.autoActivateBody || "") + '</p>';
    h += '<div class="kr-redeem-inline">';
    h += '<input id="kr-redeem-code" type="text" class="kr-input" value="' + escapeHtml(code) + '" readonly />';
    h += '<button id="kr-redeem-confirm" class="kr-btn kr-btn--primary">' + escapeHtml(w.redeemCta || "") + '</button>';
    h += '</div>';
    h += '<div class="kr-actions"><button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(this.wording?.system?.close || "") + '</button></div>';
    this.openModal(h);

    var self = this;
    var btn = el("kr-redeem-confirm");
    if (btn) btn.addEventListener("click", function () { self._redeemCode(code); });
  };


  // ============================================
  // Support modal
  // ============================================
  UI.prototype.openSupportModal = function () {
    var w = this.wording?.support || {};
    if (!this._runtime.supportEmail) {
      try {
        if (window.KR_Email && typeof window.KR_Email.getSupportEmailDecoded === "function")
          this._runtime.supportEmail = window.KR_Email.getSupportEmailDecoded() || "";
      } catch (_) { }
    }
    var h = '<h2 class="kr-h2">' + escapeHtml(w.modalTitle || "") + '</h2>';
    h += '<p>' + escapeHtml(w.modalBodyLine1 || "") + '</p>';
    h += '<div class="kr-actions kr-actions--stack">';
    h += '<button data-action="open-support-email" class="kr-btn kr-btn--primary">' + escapeHtml(w.ctaOpen || "") + '</button>';
    h += '<button data-action="copy-support-email" class="kr-btn kr-btn--secondary">' + escapeHtml(w.ctaCopy || "") + '</button>';
    h += '<button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(this.wording?.system?.close || "") + '</button>';
    h += '</div>';
    this.openModal(h);
  };

  UI.prototype.copySupportEmail = async function () {
    var email = this._runtime.supportEmail;
    if (!email) return;
    try { await navigator.clipboard.writeText(email); } catch (_) { return; }
    var msg = String(this.wording?.system?.copied || "").trim();
    if (msg) toastNow(this.config, msg, { timingKey: "positive" });
  };

  UI.prototype.openSupportEmailApp = function () {
    var email = this._runtime.supportEmail;
    if (!email) return;
    var subject = String(this.config?.support?.subjectPrefix || "").trim();
    var body = String(this.wording?.support?.emailBodyTemplate || "").trim();
    var q = [];
    if (subject) q.push("subject=" + encodeURIComponent(subject));
    if (body) q.push("body=" + encodeURIComponent(body));
    try { window.open("mailto:" + email + (q.length ? "?" + q.join("&") : ""), "_self"); } catch (_) { }
    this.closeModal();
  };


  // ============================================
  // Sprint chest (secret mode discovery)
  // ============================================
  UI.prototype._handleChestTap = function () {
    if (this.state !== STATES.END && this.state !== STATES.LANDING) return;
    var cfg = this.config;
    if (!cfg?.sprint?.enabled) return;

    var tapWindowMs = requiredConfigNumber(cfg.sprint.tapWindowMs, "KR_CONFIG.sprint.tapWindowMs", { min: 1, integer: true });
    var tapsRequired = requiredConfigNumber(cfg.sprint.tapsRequired, "KR_CONFIG.sprint.tapsRequired", { min: 1, integer: true });
    var chest = this._runtime.sprintChest;
    var now = Date.now();

    if (now - chest.lastTapAt > tapWindowMs) chest.tapCount = 0;
    chest.tapCount++;
    chest.lastTapAt = now;

    if (chest.tapCount >= tapsRequired) {
      chest.tapCount = 0;

      if (this._store("hasSprintChestHintSolved")) {
        window.dispatchEvent(new CustomEvent("kr-sprint-requested"));
        return;
      }
      if (!this._store("hasSprintChestWelcomeShown")) {
        this._store("markSprintChestHintSolved");
        this._store("markSprintChestWelcomeShown");
        this._showSprintWelcomeModal();
        return;
      }
      this._store("markSprintChestHintSolved");
      window.dispatchEvent(new CustomEvent("kr-sprint-requested"));
    }
  };

  UI.prototype._showSprintWelcomeModal = function () {
    var w = this.wording?.sprint || {};
    var h = '<h2 class="kr-h2">' + escapeHtml(w.modalTitle || "") + '</h2>';
    h += '<p>' + escapeHtml(w.modalBody || "") + '</p>';
    h += '<div class="kr-actions"><button id="kr-sprint-modal-cta" class="kr-btn kr-btn--primary">' + escapeHtml(w.modalCta || "") + '</button></div>';
    this.openModal(h);
    var cta = el("kr-sprint-modal-cta");
    if (cta) cta.addEventListener("click", function () {
      var overlay = el("kr-modal-overlay");
      if (overlay) { overlay.classList.remove("kr-modal--visible"); overlay.setAttribute("aria-hidden", "true"); }
      window.dispatchEvent(new CustomEvent("kr-sprint-requested"));
    });
  };

  UI.prototype._showSprintFreeLimitReached = function () {
    var w = this.wording?.sprint || {};
    var limit = requiredConfigNumber(this.config?.sprint?.freeRunsLimit, "KR_CONFIG.sprint.freeRunsLimit", { min: 0, integer: true });
    var h = '<h2 class="kr-h2">' + escapeHtml(w.freeLimitReachedTitle || "") + '</h2>';
    h += '<p>' + escapeHtml(fillTemplate(w.freeLimitReachedBody || "", { limit: limit })) + '</p>';
    h += '<div class="kr-actions kr-actions--stack">';
    h += '<button data-action="show-paywall" class="kr-btn kr-btn--primary">' + escapeHtml(w.freeLimitReachedCta || "") + '</button>';
    h += '<button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(w.freeLimitReachedClose || "") + '</button>';
    h += '</div>';
    this.openModal(h);
  };

  UI.prototype._canShowChest = function (screen) {
    var cfg = this.config;
    if (!cfg?.sprint?.enabled) return false;
    var gates = cfg.sprint.gates || {};
    var rc = ((this._store("getCounters") || {}).runCompletes || 0);
    var endAfterRuns = requiredConfigNumber(gates.endAfterRuns, "KR_CONFIG.sprint.gates.endAfterRuns", { min: 0, integer: true });
    var landingAfterRuns = requiredConfigNumber(gates.landingAfterRuns, "KR_CONFIG.sprint.gates.landingAfterRuns", { min: 0, integer: true });
    if (screen === STATES.END) return rc >= endAfterRuns;
    if (screen === STATES.LANDING) return rc >= landingAfterRuns;
    return false;
  };


  // ============================================
  // House Ad
  // ============================================
  UI.prototype.openHouseAd = function () {
    var url = String(this.config?.houseAd?.url || "").trim();
    if (!url) return;
    this._store("markHouseAdClicked");
    try { window.open(url, "_blank", "noopener"); } catch (_) { }
  };

  UI.prototype.remindHouseAdLater = function () {
    this._store("hideHouseAdUsingConfig");
    this.render();
  };


  // ============================================
  // Waitlist
  // ============================================
  UI.prototype.openWaitlistModal = function () {
    var w = this.wording?.waitlist || {};
    var h = '<h2 class="kr-h2">' + escapeHtml(w.title || "") + '</h2>';
    h += '<p>' + escapeHtml(w.bodyLine1 || "") + '</p>';
    h += '<textarea id="kr-waitlist-idea" class="kr-input" rows="3" placeholder="' + escapeHtml(w.inputPlaceholder || "") + '"></textarea>';
    h += '<div class="kr-actions kr-actions--stack">';
    h += '<button id="kr-waitlist-send" class="kr-btn kr-btn--primary">' + escapeHtml(w.cta || "") + '</button>';
    h += '<button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(this.wording?.system?.close || "") + '</button>';
    h += '</div>';
    this.openModal(h);

    var ta = el("kr-waitlist-idea");
    if (ta) {
      var draft = this._store("getWaitlistDraftIdea") || "";
      if (draft) ta.value = draft;
      var self = this;
      ta.addEventListener("input", function () {
        if (self.storage && typeof self.storage.setWaitlistDraftIdea === "function") self.storage.setWaitlistDraftIdea(ta.value);
      });
    }
    var sendBtn = el("kr-waitlist-send");
    var self2 = this;
    if (sendBtn) sendBtn.addEventListener("click", function () { self2.sendWaitlistViaEmail(); });
  };

  UI.prototype.sendWaitlistViaEmail = function () {
    var idea = (el("kr-waitlist-idea") || {}).value || "";
    if (window.KR_Email && typeof window.KR_Email.buildMailto === "function") {
      var mailto = window.KR_Email.buildMailto(this.config, idea);
      if (mailto) try { window.open(mailto, "_self"); } catch (_) { }
    }
    this._store("setWaitlistStatus","joined");
    this.closeModal();
  };


  // ============================================
  // Stats Sharing
  // ============================================
  UI.prototype.openStatsSharingModal = function () {
    var w = this.wording?.statsSharing || {};
    var payload = this._store("getAnonymousStatsPayload") || null;
    if (!payload) return;

    var preview = JSON.stringify(payload, null, 2);
    var h = '<h2 class="kr-h2">' + escapeHtml(w.modalTitle || "") + '</h2>';
    h += '<p class="kr-muted">' + escapeHtml(w.modalDescription || "") + '</p>';
    h += '<pre class="kr-stats-preview">' + escapeHtml(preview) + '</pre>';
    h += '<div class="kr-actions kr-actions--stack">';
    h += '<button id="kr-stats-send" class="kr-btn kr-btn--primary">' + escapeHtml(w.ctaSend || "") + '</button>';
    h += '<button id="kr-stats-copy" class="kr-btn kr-btn--secondary">' + escapeHtml(w.ctaCopy || "") + '</button>';
    h += '<button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(this.wording?.system?.close || "") + '</button>';
    h += '</div>';
    this.openModal(h);

    var self = this;
    var sendBtn = el("kr-stats-send");
    if (sendBtn) sendBtn.addEventListener("click", function () { self.sendStatsViaEmail(); });
    var copyBtn = el("kr-stats-copy");
    if (copyBtn) copyBtn.addEventListener("click", function () { self.copyStatsToClipboard(); });
  };

  UI.prototype.sendStatsViaEmail = function () {
    var payload = this._store("getAnonymousStatsPayload") || null;
    if (!payload) return;
    var subject = String(this.config?.statsSharing?.emailSubject || "").trim();
    var body = JSON.stringify(payload, null, 2);
    var email = (window.KR_Email && typeof window.KR_Email.getSupportEmailDecoded === "function") ? window.KR_Email.getSupportEmailDecoded() : "";
    var q = [];
    if (subject) q.push("subject=" + encodeURIComponent(subject));
    if (body) q.push("body=" + encodeURIComponent(body));
    try { window.open("mailto:" + email + (q.length ? "?" + q.join("&") : ""), "_self"); } catch (_) { }
    var msg = String(this.wording?.statsSharing?.successToast || "").trim();
    if (msg) toastNow(this.config, msg, { timingKey: "positive" });
    this.closeModal();
  };

  UI.prototype.copyStatsToClipboard = async function () {
    var payload = this._store("getAnonymousStatsPayload") || null;
    if (!payload) return;
    try { await navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); } catch (_) { return; }
    var msg = String(this.wording?.statsSharing?.copyToast || "").trim();
    if (msg) toastNow(this.config, msg, { timingKey: "positive" });
  };

  UI.prototype._maybePromptStatsSharingMilestone = function () {
    var cfg = this.config?.statsSharing;
    if (!cfg || !cfg.enabled) return;
    var rc = ((this._store("getCounters") || {}).runCompletes || 0);
    var milestones = cfg.promptAfterRunCompletes || [];

    var shouldPrompt = false;
    for (var i = 0; i < milestones.length; i++) { if (rc === milestones[i]) { shouldPrompt = true; break; } }

    if (!shouldPrompt && cfg.promptOnFreeRunsExhausted) {
      var balance = this._store("getRunsBalance") || 0;
      var premium = !!(this._store("isPremium"));
      if (balance <= 0 && !premium) shouldPrompt = true;
    }

    var snooze = this.storage
      ? (this.storage.getStatsSharingSnoozeUntilRunCompletes() || 0) : 0;
    if (rc < snooze) shouldPrompt = false;
    if (!shouldPrompt) return;

    var w = this.wording?.statsSharing || {};
    var body = fillTemplate(w.promptBodyTemplate || "", { runCompletes: rc });
    var h = '<h2 class="kr-h2">' + escapeHtml(w.promptTitle || "") + '</h2>';
    h += '<p>' + escapeHtml(body) + '</p>';
    h += '<div class="kr-actions kr-actions--stack">';
    h += '<button id="kr-stats-prompt-yes" class="kr-btn kr-btn--primary">' + escapeHtml(w.promptCtaPrimary || "") + '</button>';
    h += '<button id="kr-stats-prompt-no" class="kr-btn kr-btn--secondary">' + escapeHtml(w.promptCtaSecondary || "") + '</button>';
    h += '</div>';
    this.openModal(h);

    var self = this;
    var yesBtn = el("kr-stats-prompt-yes");
    if (yesBtn) yesBtn.addEventListener("click", function () { self.closeModal(); self.openStatsSharingModal(); });
    var noBtn = el("kr-stats-prompt-no");
    if (noBtn) noBtn.addEventListener("click", function () {
      if (self.storage && typeof self.storage.snoozeStatsSharingPromptNextEnd === "function") self.storage.snoozeStatsSharingPromptNextEnd();
      self.closeModal();
    });
  };


  // ============================================
  // Install prompt
  // ============================================
  UI.prototype.promptInstall = function () {
    if (window.KR_PWA && typeof window.KR_PWA.promptInstall === "function") window.KR_PWA.promptInstall(this.storage);
  };

  UI.prototype.dismissUpdateToast = function () {
    var node = el("update-toast");
    if (node) node.classList.remove("kr-toast--visible");
    if (window.__KR_SW_UPDATE_READY__) try { location.reload(); } catch (_) { }
  };


  // ============================================
  // Render (main dispatch)
  // ============================================
  UI.prototype.render = function () {
    switch (this.state) {
      case STATES.LANDING: this._renderLanding(); break;
      case STATES.PLAYING: this._renderPlaying(); break;
      case STATES.END:     this._renderEnd(); break;
      case STATES.PAYWALL: this._renderPaywall(); break;
    }
  };


  // ============================================
  // LANDING
  // ============================================
  UI.prototype._renderLanding = function () {
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

    // Chest
    var showChest = this._canShowChest(STATES.LANDING);
    var solved = !!(this._store("hasSprintChestHintSolved"));
    var chestHtml = showChest
      ? '<button class="kr-btn-icon' + (solved ? "" : " kr-btn-icon--tease") + '" data-kr-secret="chest" aria-label="' + escapeHtml((w?.sprint || {}).chestAria || "") + '">\uD83C\uDF81</button>' : "";

    var chestHintHtml = (showChest && !solved)
      ? '<p class="kr-chest-hint-inline kr-muted">' + escapeHtml((w?.sprint || {}).chestHint || "") + '</p>' : "";

    // Best score — salience nudge (§4.2: make next target visible)
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

    // Lifetime smashes counter (Eyal Hook — cumulative investment)
    var lifetimeHtml = "";
    var lifetimeTotal = counters.totalLifetimeSmashes || 0;
    if (lifetimeTotal > 0) {
      var ltTpl = String(lw.lifetimeTemplate || "").trim();
      if (ltTpl) lifetimeHtml = '<p class="kr-muted kr-landing-lifetime">' + escapeHtml(fillTemplate(ltTpl, { total: lifetimeTotal })) + '</p>';
    }

    // Spark bars
    var sparkHtml = "";
    if (cfg?.landingStats?.enabled) {
      var count = Number(cfg.landingStats.sparkRunsCount) || 5;
      var lastRuns = this._store("getLastRuns", count) || [];
      if (lastRuns.length > 0) {
        var maxS = 1;
        for (var i = 0; i < lastRuns.length; i++) { if ((lastRuns[i].smashes || 0) > maxS) maxS = lastRuns[i].smashes; }
        var barsHtml = "";
        for (var i = 0; i < lastRuns.length; i++) {
          var pct = Math.round(((lastRuns[i].smashes || 0) / maxS) * 100);
          barsHtml += '<div class="kr-spark-bar" style="height:' + pct + '%" title="' + (lastRuns[i].smashes || 0) + ' Smashes"></div>';
        }
        sparkHtml = '<div class="kr-spark-bars">' + barsHtml + '</div>';
      }
    }

    // Early price ticker
    var earlyTickerHtml = "";
    try {
      var ep = this._store("getEarlyPriceState") || null;
      if (ep && ep.phase === "EARLY" && Number(ep.remainingMs) > 0) {
        var tl = String((w?.paywall || {}).timerLabel || "").trim();
        if (tl) earlyTickerHtml = '<p class="kr-muted kr-early-timer">' + escapeHtml(tl) + " " + mmss(ep.remainingMs) + '</p>';
      }
    } catch (_) { }

    // Court Challenge on LANDING — based on previous run (runtime OR stored history)
    var landingChallengeHtml = "";
    var prevRun = (this._runtime && this._runtime.lastRun && this._runtime.lastRun.totalSpawned > 0)
      ? this._runtime.lastRun : null;
    // Fallback: read from stored history if runtime is empty (app restart)
    if (!prevRun) {
      var storedRuns = this._store("getLastRuns", 1) || [];
      if (storedRuns.length > 0 && storedRuns[0].meta) {
        var sm = storedRuns[0].meta;
        if ((sm.totalSpawned || 0) > 0) {
          prevRun = {
            smashes: storedRuns[0].smashes || 0,
            totalFaulted: sm.totalFaulted || 0,
            bestStreak: sm.bestStreak || 0,
            totalSpawned: sm.totalSpawned || 0,
            newBest: false
          };
        }
      }
    }
    if (prevRun && best > 0 && (premium || balance > 0)) {
      var lch = (w?.challenges) || {};
      var lcCfg = (cfg?.challenges) || {};
      var pF = prevRun.totalFaulted || 0;
      var pS = prevRun.bestStreak || 0;
      var pG = (!prevRun.newBest && prevRun.smashes > 0) ? (best - prevRun.smashes) : 0;

      landingChallengeHtml = pickChallenge([
        { test: pG > 0 && pG <= (Number(lcCfg.nearBestGap) || 5), key: "landingNearBest", vars: { gap: pG } },
        { test: pF >= (Number(lcCfg.faultThreshold) || 2),        key: "landingComeback",  vars: { faults: pF } },
        { test: pS >= (Number(lcCfg.streakThreshold) || 8),       key: "landingStreakPush", vars: { streak: pS } }
      ], lch);
    }

    // Premium label
    var premiumLabelHtml = "";
    if (premium) {
      var ulLabel = String(lw.premiumLabel || "").trim();
      if (ulLabel) premiumLabelHtml = '<p class="kr-muted">' + escapeHtml(ulLabel) + '</p>';
    }

    // Post-paywall block (free runs exhausted, not premium)
    var postPaywallHtml = "";
    if (!premium && balance <= 0 && runCompletes > 0) {
      postPaywallHtml = '<div class="kr-box kr-box--tinted">';

      // Secret bonus redirect: if chest visible + 0 sprints played → "Before you decide..."
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

    // House Ad
    var houseAdHtml = "";
    if (this._store("shouldShowHouseAdNow",{ inRun: false })) {
      var ha = (w && w.houseAd) ? w.houseAd : {};
      this._store("markHouseAdShown");
      houseAdHtml = '<div class="kr-box">';
      houseAdHtml += '<p>' + escapeHtml(ha.bodyLine1 || "") + '</p>';
      houseAdHtml += '<p class="kr-muted">' + escapeHtml(ha.bodyLine2 || "") + '</p>';
      houseAdHtml += '<div class="kr-actions">';
      houseAdHtml += '<button class="kr-btn kr-btn--secondary" data-action="house-ad-open">' + escapeHtml(ha.ctaPrimary || "") + '</button>';
      houseAdHtml += '<button class="kr-btn kr-btn--secondary" data-action="house-ad-later">' + escapeHtml(ha.ctaRemindLater || "") + '</button>';
      houseAdHtml += '</div></div>';
    }

    // Daily challenge badge
    var dailyHtml = "";
    if (this.config?.daily?.enabled) {
      var dailyLabel = String(lw.dailyBadge || "").trim();
      if (dailyLabel) {
        var dp = todayDateParts();
        var dateTpl = String(lw.dailyDateTemplate || "").trim();
        var dateStr = dateTpl ? fillTemplate(dateTpl, dp) : "";
        var dailyExplain = String(lw.dailyExplain || "").trim();
        dailyHtml = '<div class="kr-daily-badge" data-action="daily-info" role="button" tabindex="0">';
        dailyHtml += '<span class="kr-daily-badge-icon">\uD83D\uDCC5</span>';
        dailyHtml += '<span class="kr-daily-badge-label">' + escapeHtml(dailyLabel) + '</span>';
        if (dateStr) dailyHtml += '<span class="kr-daily-badge-date">' + escapeHtml(dateStr) + '</span>';
        dailyHtml += '</div>';
        if (dailyExplain) {
          dailyHtml += '<p class="kr-daily-explain kr-muted">' + escapeHtml(dailyExplain) + '</p>';
        }
      }
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
          bestHtml +
          landingChallengeHtml +
          premiumLabelHtml +
          sparkHtml +
          lifetimeHtml +
          chestHintHtml +
          earlyTickerHtml +
          '<div class="kr-actions">' +
            '<button class="kr-btn kr-btn--primary" data-action="play">' + ctaLabel + '</button>' +
          '</div>' +
          postPaywallHtml +
          houseAdHtml +
        '</div>' +
      '</div>';

    this._reattachFooter();
  };


  // ============================================
  // PLAYING
  // ============================================
  UI.prototype._renderPlaying = function () {
    this.appEl.innerHTML =
      '<div class="kr-screen kr-screen--playing">' +
        '<canvas id="kr-canvas"></canvas>' +
        '<div id="kr-hud" class="kr-hud"></div>' +
        '<div id="kr-gameplay-overlay" class="kr-gameplay-overlay"></div>' +
        '<div id="kr-run-start-overlay" class="kr-run-start-overlay"></div>' +
      '</div>';

    var canvas = el("kr-canvas");
    if (canvas) {
      var cw = this.appEl.clientWidth;
      var ch = this.appEl.clientHeight;
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      this._canvas = canvas;
      this._ctx = canvas.getContext("2d");

      var self = this;
      canvas.addEventListener("pointerdown", function (e) { self._handleCanvasTap(e); });
    }

    // Start game loop after DOM is ready
    this._startGameLoop();
  };


  // ============================================
  // END
  // ============================================
  UI.prototype._renderEnd = function () {
    var cfg = this.config;
    var w = this.wording;
    var ew = (w && w.end) ? w.end : {};
    var sw = (w && w.sprint) ? w.sprint : {};
    var last = (this._runtime && this._runtime.lastRun) ? this._runtime.lastRun : {};
    var isSprint = (last.mode === MODES.SPRINT);
    var premium = !!(this._store("isPremium"));
    var balance = this._store("getRunsBalance") || 0;

    // Title & score
    var title = isSprint ? escapeHtml(sw.endTitle || "") : escapeHtml(ew.title || "");
    var scoreLine = isSprint
      ? escapeHtml(fillTemplate(sw.scoreLine || "", { score: last.smashes }))
      : escapeHtml(fillTemplate(ew.scoreLine || "", { score: last.smashes }));

    // Best
    var bestSmashes = isSprint
      ? ((this._store("getSprintBest") || {}).bestSmashes || 0)
      : (last.bestSmashes || 0);
    var bestLine = isSprint
      ? escapeHtml(fillTemplate(sw.bestLine || "", { best: bestSmashes }))
      : escapeHtml(fillTemplate(ew.personalBestLine || "", { best: bestSmashes }));

    // New best badge
    var newBest = last.newBest;
    var newBestLabel = isSprint ? (sw.newBest || "") : (ew.newBest || "");
    var newBestHtml = newBest ? '<p class="kr-new-best">' + escapeHtml(newBestLabel) + '</p>' : "";

    // Record moment: temporarily show newBest copy instead of regular score
    var recordMomentActive = (this._runtime && this._runtime.endRecordMomentUntil > Date.now());

    // End highlight from microFeedback
    var endHighlight = (this._runtime && this._runtime.microFeedback) ? (this._runtime.microFeedback.endHighlight || "") : "";
    var highlightHtml = endHighlight ? '<p class="kr-end-highlight kr-muted">' + escapeHtml(endHighlight) + '</p>' : "";

    // Best streak
    var bestStreak = last.bestStreak || 0;
    var streakHtml = (bestStreak >= 3 && !isSprint)
      ? '<p class="kr-muted">' + escapeHtml(fillTemplate(ew.bestStreakLine || "", { streak: bestStreak })) + '</p>' : "";

    // Debrief: accuracy + faults + duration + delta vs best (cognitive feedback)
    var debriefHtml = "";
    if (last.totalSpawned > 0) {
      var accuracy = Math.round((last.smashes / last.totalSpawned) * 100);
      var faults = last.totalFaulted || 0;
      var misses = last.totalMissed || 0;
      var durationSec = Math.round((last.elapsedMs || 0) / 1000);

      // Delta vs personal best (progression signal — Deci/Ryan §2.1)
      var deltaHtml = "";
      if (bestSmashes > 0 && !newBest && last.smashes > 0) {
        var gap = bestSmashes - last.smashes;
        if (gap > 0 && gap <= 10) {
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
        if (lines.length > 0) debriefHtml += '<p>' + lines.join(' \u00b7 ') + '</p>';
        debriefHtml += '</div>';
      }
    }

    // Free runs left
    var freeRunHtml = "";
    if (!premium && !isSprint && balance > 0) {
      var totalFree = requiredConfigNumber(cfg?.limits?.freeRuns, "KR_CONFIG.limits.freeRuns", { min: 0, integer: true });
      freeRunHtml = '<p class="kr-muted">' + escapeHtml(fillTemplate(ew.freeRunLeft || "", { remaining: balance, total: totalFree })) + '</p>';
    }

    // Court Challenge — ONE contextual micro-objective per run (priority-ordered)
    // Only show when player can act (premium or has runs left) — Deci/Ryan autonomy
    var challengeHtml = "";
    var canPlayAgain = premium || balance > 0 || isSprint;
    var ch = (w?.challenges) || {};
    var chCfg = (cfg?.challenges) || {};
    if (last.totalSpawned > 0 && canPlayAgain) {
      var cF = last.totalFaulted || 0;
      var cA = Math.round((last.smashes / last.totalSpawned) * 100);
      var cS = last.bestStreak || 0;
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
            { test: newBest && last.smashes > 0,     key: "newBestChallenge", vars: { score: last.smashes, target: last.smashes + 1 } },
            { test: cF === 0 && last.smashes >= cM,  key: "cleanRun",         vars: null },
            { test: cS >= sT,                        key: "streakChallenge",  vars: { streak: cS, target: cS + sB } },
            { test: cF >= fT,                        key: "faultHeavy",       vars: { faults: cF } },
            { test: cA < aP && last.smashes >= aM,   key: "lowAccuracy",      vars: { accuracy: cA } }
          ], ch);
    }

    // Sprint free runs left
    var sprintFreeHtml = "";
    if (isSprint && !premium) {
      var used = this._store("getSprintFreeRunsUsed") || 0;
      var limit = requiredConfigNumber(cfg?.sprint?.freeRunsLimit, "KR_CONFIG.sprint.freeRunsLimit", { min: 0, integer: true });
      if (limit > 0 && used < limit) {
        sprintFreeHtml = '<p class="kr-muted">' + escapeHtml(fillTemplate(sw.freeRunsLeftLine || "", { remaining: limit - used, limit: limit })) + '</p>';
      }
    }

    // Chest
    var showChest = this._canShowChest(STATES.END);
    var solvedChest = !!(this._store("hasSprintChestHintSolved"));
    var chestHtml = showChest
      ? '<button class="kr-btn-icon' + (solvedChest ? "" : " kr-btn-icon--tease") + '" data-kr-secret="chest" aria-label="' + escapeHtml(sw.chestAria || "") + '">\uD83C\uDF81</button>' : "";

    // CTAs
    var ctasHtml = "";
    if (isSprint) {
      ctasHtml =
        '<button class="kr-btn kr-btn--primary" data-action="sprint-again">' + escapeHtml(sw.playAgain || "") + '</button>' +
        '<button class="kr-btn kr-btn--secondary" data-action="back-to-runs">' + escapeHtml(sw.backToRuns || "") + '</button>';
    } else if (!premium && balance <= 0) {
      ctasHtml = '<button class="kr-btn kr-btn--primary" data-action="show-paywall">' + escapeHtml((w?.paywall || {}).cta || "") + '</button>';
    } else {
      // §3.1 Fogg: motivational CTA when near best (increases perceived ability)
      var ctaText = ew.playAgain || "";
      if (newBest) {
        ctaText = ew.playAgainAfterBest || ew.playAgain || "";
      } else if (bestSmashes > 0 && last.smashes > 0) {
        var nearGap = bestSmashes - last.smashes;
        if (nearGap > 0 && nearGap <= 5) {
          ctaText = ew.playAgainNearBest || ew.playAgain || "";
        }
      }
      ctasHtml = '<button class="kr-btn kr-btn--primary" data-action="play-again">' + escapeHtml(ctaText) + '</button>';
    }

    // Share
    var shareHtml = "";
    var isDaily = !!(cfg?.daily?.enabled && last.mode === MODES.RUN);
    if (cfg?.share?.enabled) {
      // Make share button primary for daily challenge (viral loop)
      var shareBtnClass = isDaily ? "kr-btn kr-btn--primary" : "kr-btn kr-btn--secondary";
      var shareLabel = isDaily
        ? ("Share daily score")
        : escapeHtml((w?.share || {}).ctaLabel || "");
      shareHtml = '<div class="kr-share-row">' +
        '<button class="' + shareBtnClass + '" data-action="share">' + shareLabel + '</button>' +
        '<button class="kr-btn kr-btn--secondary" data-action="share-email" aria-label="' + escapeHtml((w?.share || {}).emailAria || "") + '">\u2709</button>' +
      '</div>';
    }

    // Auto-show share card after new best OR after any daily run with decent score
    if (cfg?.share?.enabled) {
      var autoShareScore = newBest ? 5 : (isDaily ? 3 : 999999);
      if (last.smashes >= autoShareScore) {
        var self = this;
        setTimeout(function () { self._showShareCardModal(); }, 1200);
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
          debriefHtml +
          challengeHtml +
          freeRunHtml +
          sprintFreeHtml +
          '<div class="kr-actions kr-actions--stack">' + ctasHtml + shareHtml + '</div>' +
        '</div>' +
      '</div>';

    this._reattachFooter();
  };


  // ============================================
  // PAYWALL
  // ============================================
  UI.prototype._renderPaywall = function () {
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

    // Savings line
    var savingsHtml = "";
    if (isEarly && earlyPrice && standardPrice) {
      var saveAmount = formatCents(cfg.standardPriceCents - cfg.earlyPriceCents, cfg.currency);
      if (saveAmount) savingsHtml = '<p class="kr-paywall-savings">' + escapeHtml(fillTemplate(pw.savingsLineTemplate || "", { saveAmount: saveAmount })) + '</p>';
    }

    var bulletHtml = "";
    if (Array.isArray(pw.valueBullets)) {
      for (var i = 0; i < pw.valueBullets.length; i++) bulletHtml += '<li>' + escapeHtml(pw.valueBullets[i]) + '</li>';
    }
    var trustBulletHtml = "";
    if (Array.isArray(pw.trustBullets)) {
      for (var i = 0; i < pw.trustBullets.length; i++) trustBulletHtml += '<li>' + escapeHtml(pw.trustBullets[i]) + '</li>';
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

    // Personal progress anchor (loss aversion — Kahneman: people value what they already have)
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


  // ============================================
  // Footer preservation
  // ============================================
  UI.prototype._reattachFooter = function () {
    var footerRoot = el("kr-footer-root");
    if (!footerRoot) return;
    if (!this._footerNode && footerRoot.parentElement) this._footerNode = footerRoot;
    if (this._footerNode && !this._footerNode.parentElement && this.appEl) this.appEl.appendChild(this._footerNode);
  };

  UI.prototype.updateFooter = function () {
    if (window.KR_Email && typeof window.KR_Email.initEmailLinks === "function") window.KR_Email.initEmailLinks();
  };


  // ============================================
  // Export
  // ============================================
  window.KR_UI = UI;
}();
