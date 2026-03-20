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
    this._resizeObserver = null;

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
      case "play":              this._handlePlay("classic"); break;
      case "play-again":        this._handlePlay("classic"); break;
      case "play-daily":        this._handlePlay("daily"); break;
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
      // T5: Disconnect ResizeObserver
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      }
      // T1: Remove visibility handler
      if (this._visibilityHandler) {
        document.removeEventListener("visibilitychange", this._visibilityHandler);
        this._visibilityHandler = null;
      }
      // V2: Teardown input system
      this._teardownInputV2();
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
  UI.prototype._handlePlay = function (entryKind) {
    var kind = String(entryKind == null ? "classic" : entryKind).trim().toLowerCase();
    if (kind !== "daily" && kind !== "classic") throw new Error("KR_UI._handlePlay(): invalid entry kind");

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

    this._runtime.currentRunIsDaily = (kind === "daily");
    this._startGameplay(MODES.RUN, runType);
  };

  UI.prototype._hasCompletedDailyToday = function () {
    var runs = this._store("getLastRuns", 20) || [];
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth();
    var d = now.getDate();

    for (var i = 0; i < runs.length; i += 1) {
      var run = runs[i] || {};
      var meta = (run.meta && typeof run.meta === "object") ? run.meta : {};
      if (meta.isDaily !== true) continue;
      var endedAt = Number(run.endedAt || 0);
      if (!Number.isFinite(endedAt) || endedAt <= 0) continue;
      var rd = new Date(endedAt);
      if (rd.getFullYear() === y && rd.getMonth() === m && rd.getDate() === d) return true;
    }
    return false;
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
    this._runtime.runMode = mode;
    this._runtime._lastBallState = {};

    // Start engine
    var isDaily = !!(this._runtime.currentRunIsDaily);
    this.game.start({ config: this.config, mode: mode, canvasW: appW, canvasH: appH, isDaily: isDaily });

    // beforeunload guard (warn on accidental tab close during gameplay)
    if (!this._beforeUnloadHandler) {
      var self = this;
      this._beforeUnloadHandler = function (e) { if (self.state === STATES.PLAYING) e.preventDefault(); };
      window.addEventListener("beforeunload", this._beforeUnloadHandler);
    }

    this.setState(STATES.PLAYING);

    // Show run start overlay — game loop starts on dismiss tap
    // Fail-closed: if overlay fails, start game loop immediately
    try {
      this._showRunStartOverlay(mode, runType);
    } catch (_) {
      this._startGameLoop();
    }
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
      // Fail-closed: no overlay DOM → start game loop immediately
      this._startGameLoop();
      return;
    }

    // V3: Controls hint — detect device
    var isTouchDevice = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
    var controlsHtml = "";
    if (isTouchDevice) {
      controlsHtml =
        '<div class="kr-start-controls">' +
          '<div class="kr-start-ctrl"><span class="kr-start-ctrl-key">Left half</span> <span class="kr-start-ctrl-label">Drag to move</span></div>' +
          '<div class="kr-start-ctrl"><span class="kr-start-ctrl-key">Right half</span> <span class="kr-start-ctrl-label">Tap for timing bonus</span></div>' +
        '</div>';
    } else {
      controlsHtml =
        '<div class="kr-start-controls">' +
          '<div class="kr-start-ctrl"><span class="kr-start-ctrl-key">\u2190\u2191\u2192\u2193</span> <span class="kr-start-ctrl-label">Move (2D)</span></div>' +
          '<div class="kr-start-ctrl"><span class="kr-start-ctrl-key">Space</span> <span class="kr-start-ctrl-label">Timing bonus</span></div>' +
        '</div>' +
        '<p class="kr-run-start-hint kr-muted">Ball auto-returns when you\'re close. Time your hit for double points!</p>';
    }

    var kitchenHint = '<p class="kr-run-start-hint kr-muted">Kitchen zone \u2014 wait for bounce before hitting</p>';

    // V3: Daily modifier banner
    var dailyHtml = "";
    if (this._runtime.currentRunIsDaily && window.KR_Game && window.KR_Game.getDailyModifier) {
      var dm = window.KR_Game.getDailyModifier();
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

    // V3: NO auto-dismiss — player MUST tap to start
    // Clear any legacy timer
    if (this._runtime.runStartOverlayTimerId) clearTimeout(this._runtime.runStartOverlayTimerId);
    this._runtime.runStartOverlayTimerId = null;

    // Tap anywhere to dismiss overlay AND start game loop
    var self = this;
    node.addEventListener("pointerdown", function dismiss() {
      node.classList.remove("kr-run-start-overlay--visible");
      node.removeEventListener("pointerdown", dismiss);
      // V3: NOW start the game loop — game was frozen until this tap
      self._startGameLoop();
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

      // Feed input to game engine
      var inp = self._runtime.inputState || {};
      self.game.setInput(inp.left, inp.right, inp.up, inp.down, inp.hit);

      var state = self.game.update(dtMs);
      self._renderCanvasV2(state);
      self._renderHUDV2(state);
      self._checkGameEventsV2(state);

      if (state.done) { self._finishRun(state); return; }
      self._rafId = requestAnimationFrame(loop);
    }

    this._rafId = requestAnimationFrame(loop);
  };

  UI.prototype._stopGameLoop = function () {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  };


  // ============================================
  // V2 Canvas rendering
  // ============================================
  UI.prototype._renderCanvasV2 = function (state) {
    var canvas = this._canvas;
    if (!canvas) return;
    var ctx = this._ctx;
    if (!ctx) return;

    var w = canvas.width;
    var h = canvas.height;
    var colors = this.config.canvas && this.config.canvas.colors;
    if (!colors || typeof colors !== "object") return;

    var court = state.court;
    if (!court) return;

    var juice = this._runtime.juice;
    var n = performance.now();
    var gt = state.elapsedMs;

    var netYpx = court.netY * h;
    var kitchenLineYpx = court.kitchenLineY * h;
    var baselineYpx = (court.baselineY || 0.82) * h;
    var playerYpx = court.playerY * h;
    var controlsYpx = court.controlsY * h;
    var opponentYpx = court.opponentY * h;

    // Screen shake
    var shakeX = 0, shakeY = 0;
    if (juice.shakeUntil > n) {
      var intensity = juice.shakeIntensity || 6;
      shakeX = (Math.random() - 0.5) * intensity * 2;
      shakeY = (Math.random() - 0.5) * intensity * 2;
    }

    ctx.save();
    if (shakeX || shakeY) ctx.translate(shakeX, shakeY);

    // Court background
    ctx.fillStyle = colors.courtBg || "#0a1628";
    ctx.fillRect(0, 0, w, h);

    // Kitchen zone
    ctx.fillStyle = colors.kitchenBg || "#2a1a0a";
    ctx.fillRect(0, netYpx, w, kitchenLineYpx - netYpx);

    // Kitchen label
    if (colors.kitchenLabelColor) {
      ctx.font = "bold " + Math.round(w * 0.04) + "px system-ui, sans-serif";
      ctx.fillStyle = colors.kitchenLabelColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var _kitchenLabel = String((this.wording && this.wording.ui && this.wording.ui.kitchenLabel) || "KITCHEN"); ctx.fillText(_kitchenLabel, w / 2, netYpx + (kitchenLineYpx - netYpx) / 2);
    }

    // Kitchen line
    ctx.strokeStyle = colors.kitchenLine || "#ff6b4a";
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, kitchenLineYpx);
    ctx.lineTo(w, kitchenLineYpx);
    ctx.stroke();

    // Net
    ctx.strokeStyle = colors.netColor || "#e0e0e0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, netYpx);
    ctx.lineTo(w, netYpx);
    ctx.stroke();
    // Net posts
    ctx.fillStyle = colors.netColor || "#e0e0e0";
    ctx.fillRect(0, netYpx - 8, 4, 16);
    ctx.fillRect(w - 4, netYpx - 8, 4, 16);
    // Net mesh
    ctx.strokeStyle = colors.netMesh || "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    for (var ni = 1; ni <= 3; ni++) {
      ctx.beginPath();
      ctx.moveTo(4, netYpx - 6 + ni * 4);
      ctx.lineTo(w - 4, netYpx - 6 + ni * 4);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Court lines (USAP-faithful layout)
    if (colors.courtLines) {
      ctx.strokeStyle = colors.courtLines;
      ctx.lineWidth = 1;
      // Centerline (NVZ line to baseline)
      ctx.beginPath(); ctx.moveTo(w / 2, kitchenLineYpx); ctx.lineTo(w / 2, baselineYpx); ctx.stroke();
      // Sidelines
      ctx.beginPath(); ctx.moveTo(w * 0.08, netYpx); ctx.lineTo(w * 0.08, baselineYpx); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w * 0.92, netYpx); ctx.lineTo(w * 0.92, baselineYpx); ctx.stroke();
      // Baseline
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w * 0.08, baselineYpx); ctx.lineTo(w * 0.92, baselineYpx); ctx.stroke();
      // Opponent's side: NVZ line (mirrored, subtle)
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      var oppNvzY = netYpx - (kitchenLineYpx - netYpx) * 0.4; // compressed perspective
      ctx.beginPath(); ctx.moveTo(w * 0.15, oppNvzY); ctx.lineTo(w * 0.85, oppNvzY); ctx.stroke();
      // Opponent's baseline (far, very compressed)
      ctx.globalAlpha = 0.2;
      ctx.beginPath(); ctx.moveTo(w * 0.2, opponentYpx * 0.5); ctx.lineTo(w * 0.8, opponentYpx * 0.5); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Opponent silhouette
    var oppX = state.opponentX || w / 2;
    var oppW = w * 0.06;
    var oppH = h * 0.06;
    ctx.fillStyle = colors.opponentColor || "#667788";
    ctx.beginPath();
    ctx.arc(oppX, opponentYpx - oppH * 0.3, oppW * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(oppX - oppW * 0.35, opponentYpx - oppH * 0.1, oppW * 0.7, oppH * 0.7);

    // Ball
    var ball = state.ball;
    if (ball) {
      this._renderBallV2(ctx, ball, colors, w, h, gt, n, juice, state.rallyCount || 0);
    }

    // Player (V3: 2D position from game state)
    var playerX = state.playerX || w / 2;
    var playerYState = state.playerY || (court.playerY * h);
    var pState = state.playerState || "idle";
    this._renderPlayerV2(ctx, playerX, playerYState, pState, colors, w, h, n);

    // V3 Controls zone: left half = MOVE, right half = HIT (timing bonus)
    ctx.fillStyle = colors.controlZoneBg || "rgba(255,255,255,0.03)";
    ctx.fillRect(0, controlsYpx, w, h - controlsYpx);
    // Divider
    ctx.strokeStyle = colors.controlZoneBorder || "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(4, controlsYpx + 4, w / 2 - 8, h - controlsYpx - 8);
    ctx.strokeStyle = colors.controlZoneHitBorder || "rgba(255,255,255,0.12)";
    ctx.strokeRect(w / 2 + 4, controlsYpx + 4, w / 2 - 8, h - controlsYpx - 8);
    ctx.font = Math.round(w * 0.025) + "px system-ui, sans-serif";
    ctx.fillStyle = colors.controlZoneText || "rgba(255,255,255,0.2)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var ctrlMidY = controlsYpx + (h - controlsYpx) / 2;
    var _uw = (this.wording && this.wording.ui) || {};
    ctx.fillText(String(_uw.controlMoveLabel || "MOVE"), w / 4, ctrlMidY);
    ctx.fillText(String(_uw.controlTimingLabel || "HIT"), w * 3 / 4, ctrlMidY);

    // V3: Timing bonus indicator
    if (state.lastTimingBonus > 0.5) {
      var tbAlpha = Math.max(0, state.lastTimingBonus - 0.3);
      ctx.fillStyle = "rgba(" + (colors.smashFlashColor || "6,214,160") + "," + tbAlpha.toFixed(2) + ")";
      ctx.font = "bold " + Math.round(w * 0.035) + "px system-ui, sans-serif";
      var tbText = state.lastTimingBonus > 0.7
        ? String((_uw && _uw.timingPerfectLabel) || "PERFECT!")
        : String((_uw && _uw.timingNiceLabel) || "NICE!");
      ctx.fillText(tbText, w * 3 / 4, ctrlMidY - 20);
    }

    // V3: Daily modifier banner
    if (state.dailyModifier) {
      var dmLabel = String(state.dailyModifier.label || "").trim();
      var dmDesc = String(state.dailyModifier.desc || "").trim();
      if (dmLabel) {
        ctx.fillStyle = "rgba(255,215,0,0.15)";
        ctx.fillRect(0, 0, w, Math.round(h * 0.04));
        ctx.font = "bold " + Math.round(w * 0.025) + "px system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,215,0,0.8)";
        ctx.textAlign = "center";
        ctx.fillText(dmLabel + (dmDesc ? (" \u2014 " + dmDesc) : ""), w / 2, h * 0.025);
      }
    }

    // Juice: smash flash
    if (juice.flashType === "smash" && juice.flashUntil > n) {
      var smashFlashDur = requiredConfigNumber(this.config?.juice?.smashFlashMs, "juice.smashFlashMs", { min: 1, integer: true });
      var flashP = 1 - (juice.flashUntil - n) / smashFlashDur;
      var flashA = Math.max(0, 0.8 * (1 - flashP));
      ctx.fillStyle = "rgba(" + (colors.smashFlashColor || "6,214,160") + "," + flashA.toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(juice.flashX, juice.flashY, 20 + flashP * 40, 0, Math.PI * 2);
      ctx.fill();
    }

    // Juice: fault vignette
    if (juice.flashType === "fault" && juice.flashUntil > n) {
      var faultFlashDur = requiredConfigNumber(this.config?.juice?.faultFlashMs, "juice.faultFlashMs", { min: 1, integer: true });
      var faultP = 1 - (juice.flashUntil - n) / faultFlashDur;
      var faultA = Math.max(0, 0.3 * (1 - faultP));
      var vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.8);
      var _fvc = colors.faultVignetteColor || "239,71,111";
      vigGrad.addColorStop(0, "rgba(" + _fvc + ",0)");
      vigGrad.addColorStop(1, "rgba(" + _fvc + "," + faultA.toFixed(2) + ")");
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Score popups
    var scorePopupMs = requiredConfigNumber(this.config?.canvas?.scorePopupMs, "canvas.scorePopupMs", { min: 1, integer: true });
    if (juice.scorePopups) {
      for (var sp = juice.scorePopups.length - 1; sp >= 0; sp--) {
        var popup = juice.scorePopups[sp];
        var popElapsed = n - popup.at;
        if (popElapsed > scorePopupMs) { juice.scorePopups.splice(sp, 1); continue; }
        var popT = popElapsed / scorePopupMs;
        ctx.globalAlpha = Math.max(0, 1 - popT);
        ctx.font = "bold " + Math.round(22 + (1 - popT) * 6) + "px system-ui, sans-serif";
        ctx.fillStyle = colors.scorePopup || "#06d6a0";
        ctx.textAlign = "center";
        ctx.fillText(String((_uw && _uw.scoreGainedDeltaText) || "+1"), popup.x, popup.y - popT * 50);
        ctx.globalAlpha = 1;
      }
    }

    // Sprint penalty flash
    if (juice.sprintPenaltyUntil > n) {
      var penP = 1 - (juice.sprintPenaltyUntil - n) / 400;
      var penA = Math.max(0, 0.9 * (1 - penP));
      ctx.font = "bold 28px system-ui, sans-serif";
      ctx.fillStyle = "rgba(" + (colors.faultVignetteColor || "239,71,111") + "," + penA.toFixed(2) + ")";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var penText = String(this.wording?.sprint?.penaltyFlash || "").trim();
      if (penText) ctx.fillText(penText, w / 2, h * 0.3 - penP * 20);
    }

    ctx.restore();
  };


  // ============================================
  // V2: Ball renderer
  // ============================================
  UI.prototype._renderBallV2 = function (ctx, b, colors, w, h, gt, n, juice, rallyCount) {
    var BALL_STATES = window.KR_Game.BALL_STATES;
    var _uw2 = (this.wording && this.wording.ui) || {};

    // V3: Show "MUST BOUNCE" indicator when double bounce rule applies
    var mustBounce = (rallyCount < 2) || b.inKitchen;
    if (mustBounce && b.state === BALL_STATES.TRAVELING) {
      var mbAlpha = 0.4 + 0.2 * Math.sin(gt / 150);
      ctx.globalAlpha = mbAlpha;
      ctx.font = "bold " + Math.round(w * 0.022) + "px system-ui, sans-serif";
      ctx.fillStyle = colors.waitIndicator || "#ff6b4a";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      var mbLabel = (rallyCount < 2)
        ? String((_uw2 && _uw2.doubleBounceLabel) || "LET IT BOUNCE")
        : String((_uw2 && _uw2.waitLabel) || "WAIT");
      ctx.fillText(mbLabel, b.targetX, b.targetY + b.radius + 4);
      ctx.globalAlpha = 1;
    }


    // Shadow at bounce point (grows as ball approaches)
    if (b.state === BALL_STATES.TRAVELING || b.state === BALL_STATES.BOUNCED) {
      var shadowProgress = (b.state === BALL_STATES.TRAVELING) ? Math.min(1, Math.max(0, (gt - b.spawnedAt) / b.travelMs)) : 1;
      var shadowAlpha = 0.1 + shadowProgress * 0.2;
      var shadowW = b.radius * (0.4 + shadowProgress * 0.6);
      ctx.globalAlpha = shadowAlpha;
      ctx.fillStyle = colors.shadow || "#000";
      ctx.beginPath();
      ctx.ellipse(b.targetX, b.shadowY + b.radius * 0.3, shadowW, shadowW * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Ball color by type
    var bt = b.ballType || "normal";
    if (bt === "dink" && colors.ballDink) ctx.fillStyle = colors.ballDink;
    else if (bt === "lob" && colors.ballLob) ctx.fillStyle = colors.ballLob;
    else if (bt === "fast" && colors.ballFast) ctx.fillStyle = colors.ballFast;
    else ctx.fillStyle = colors.ballDefault || "#ffd60a";

    if (b.state === BALL_STATES.TRAVELING || b.state === BALL_STATES.BOUNCED) {
      // WAIT indicator for kitchen balls in flight
      if (b.inKitchen && b.state === BALL_STATES.TRAVELING) {
        var waitAlpha = 0.5 + 0.3 * Math.sin(gt / 200);
        ctx.globalAlpha = waitAlpha;
        ctx.font = "bold " + Math.round(b.radius * 1.1) + "px system-ui, sans-serif";
        ctx.fillStyle = colors.waitIndicator || "#ff6b4a";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(String((_uw2 && _uw2.waitLabel) || "WAIT"), b.x, b.y - b.radius - 6);
        ctx.globalAlpha = 1;
        if (bt === "dink" && colors.ballDink) ctx.fillStyle = colors.ballDink;
        else if (bt === "lob" && colors.ballLob) ctx.fillStyle = colors.ballLob;
        else if (bt === "fast" && colors.ballFast) ctx.fillStyle = colors.ballFast;
        else ctx.fillStyle = colors.ballDefault || "#ffd60a";
      }

      // V3: BOUNCE IMPACT — big visible feedback
      if (b.state === BALL_STATES.BOUNCED && b.bouncedAt > 0) {
        var sinceBounce = gt - b.bouncedAt;

        // 1) Impact shockwave (expands from bounce point)
        if (sinceBounce < 400) {
          var shockT = sinceBounce / 400;
          var shockAlpha = Math.max(0, 0.8 * (1 - shockT));
          ctx.strokeStyle = "rgba(255,255,255," + shockAlpha.toFixed(2) + ")";
          ctx.lineWidth = Math.max(0.5, 3 - shockT * 2);
          ctx.beginPath();
          ctx.arc(b.targetX, b.targetY, b.radius + shockT * 35, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 2) Ground impact mark
        if (sinceBounce < 500) {
          var impactT = sinceBounce / 500;
          ctx.globalAlpha = Math.max(0, 0.5 * (1 - impactT));
          ctx.fillStyle = b.inKitchen ? (colors.kitchenLine || "#ff6b4a") : "rgba(255,255,255,0.6)";
          ctx.beginPath();
          ctx.ellipse(b.targetX, b.targetY, b.radius * (1 + impactT * 0.5), b.radius * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // 3) Dust particles
        if (sinceBounce < 350) {
          var dustT = sinceBounce / 350;
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          for (var di = 0; di < 4; di++) {
            var dAngle = (Math.PI / 2) + (di - 1.5) * 0.5;
            var dDist = dustT * 25;
            var dSize = 2 * (1 - dustT);
            if (dSize > 0) {
              ctx.globalAlpha = Math.max(0, 0.6 * (1 - dustT));
              ctx.beginPath();
              ctx.arc(b.targetX + Math.cos(dAngle) * dDist, b.targetY - Math.sin(dAngle) * dDist, dSize, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
        }

        // 4) Colored flash ring
        if (sinceBounce < 300) {
          var bAlpha = Math.max(0, 1 - sinceBounce / 300);
          var ringColor = b.inKitchen ? (colors.kitchenLine || "#ff6b4a") : (colors.bounceRingFlash || "#06d6a0");
          ctx.strokeStyle = ringColor;
          ctx.globalAlpha = bAlpha;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius + 4 + (sinceBounce / 300) * 18, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;

          if (sinceBounce < 200) {
            ctx.globalAlpha = bAlpha;
            ctx.font = "bold " + Math.round(b.radius * 1.4) + "px system-ui, sans-serif";
            ctx.fillStyle = ringColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            var bounceLabel = b.inKitchen ? String((_uw2 && _uw2.nowLabel) || "NOW!") : String((_uw2 && _uw2.goLabel) || "GO!");
            ctx.fillText(bounceLabel, b.x, b.y - b.radius - 10);
            ctx.globalAlpha = 1;
          }

          if (!juice.bounceFlashBalls[b.id]) {
            juice.bounceFlashBalls[b.id] = true;
            this._playSound("bounce");
          }
        }

        // 5) Pulsing ring while waiting
        var pulseScale = 1 + 0.12 * Math.sin(gt / 70);
        ctx.strokeStyle = colors.bounceRing || "#06d6a0";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(b.x, b.y, (b.radius + 6) * pulseScale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Ball with glow
      ctx.save();
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Highlight
      var grad = ctx.createRadialGradient(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.1, b.x, b.y, b.radius);
      grad.addColorStop(0, colors.highlightWhite || "rgba(255,255,255,0.4)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // HIT: returning to opponent
    if (b.state === "HIT" || b.state === BALL_STATES.HIT) {
      var sinceHit = gt - b.hitAt;
      var retT = Math.min(1, sinceHit / (b.returnTravelMs || 500));
      ctx.globalAlpha = Math.max(0, 1 - retT * 0.7);
      ctx.fillStyle = colors.ballSmashed || "#06d6a0";
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.max(2, b.radius * (1 - retT * 0.4)), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // FAULTED
    if (b.state === "FAULTED" && b.faultedAt > 0) {
      var sinceFault = gt - b.faultedAt;
      if (sinceFault < 400) {
        ctx.globalAlpha = Math.max(0, 0.7 * (1 - sinceFault / 400));
        ctx.fillStyle = colors.ballFaulted || "#ef476f";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + (sinceFault / 400) * 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // MISSED
    if (b.state === "MISSED" && b.missedAt > 0) {
      var sinceMiss = gt - b.missedAt;
      if (sinceMiss < 500) {
        ctx.globalAlpha = Math.max(0, 0.4 * (1 - sinceMiss / 500));
        ctx.fillStyle = colors.ballMissed || "#6c757d";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  };


  // ============================================
  // V2: Player renderer — sport moderne fluid silhouette
  // ============================================
  UI.prototype._renderPlayerV2 = function (ctx, x, y, pState, colors, w, h, n) {
    var pColor = colors.playerColor || "#44ccff";
    var pOutline = colors.playerOutline || "#2288bb";
    var pGlow = colors.playerGlow || "rgba(68,204,255,0.25)";

    // Scale relative to screen
    var scale = Math.min(w, h) / 500;
    var S = function (v) { return v * scale; };

    // Animation phase
    var t = n / 1000;
    var breathe = Math.sin(t * 2) * 0.5; // idle breathing
    var runCycle = Math.sin(t * 12) * 0.5; // running leg cycle
    var isRunning = (pState === "runLeft" || pState === "runRight");
    var isSwinging = (pState === "swing");

    // Lean when running
    var lean = 0;
    if (pState === "runLeft") lean = S(3);
    if (pState === "runRight") lean = S(-3);

    ctx.save();
    ctx.translate(x + lean, y);

    // Shadow on ground
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, S(22), S(14), S(4), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Player glow (subtle)
    ctx.shadowColor = pGlow;
    ctx.shadowBlur = S(12);

    // ── Legs (dynamic, animated) ──
    ctx.fillStyle = pOutline;
    var legSpread = isRunning ? runCycle * S(6) : 0;
    // Left leg
    ctx.beginPath();
    ctx.moveTo(S(-4), S(8));
    ctx.quadraticCurveTo(S(-5) - legSpread, S(15), S(-3) - legSpread, S(20));
    ctx.lineTo(S(-1) - legSpread, S(20));
    ctx.quadraticCurveTo(S(-2), S(14), S(-1), S(8));
    ctx.fill();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(S(4), S(8));
    ctx.quadraticCurveTo(S(5) + legSpread, S(15), S(3) + legSpread, S(20));
    ctx.lineTo(S(1) + legSpread, S(20));
    ctx.quadraticCurveTo(S(2), S(14), S(1), S(8));
    ctx.fill();

    // ── Body (torso — smooth curved shape) ──
    ctx.fillStyle = pColor;
    ctx.beginPath();
    ctx.moveTo(S(-8), S(6)); // left hip
    ctx.quadraticCurveTo(S(-10), S(-2), S(-7), S(-12)); // left side up
    ctx.quadraticCurveTo(S(-3), S(-16) + breathe, 0, S(-16) + breathe); // left shoulder to center
    ctx.quadraticCurveTo(S(3), S(-16) + breathe, S(7), S(-12)); // center to right shoulder
    ctx.quadraticCurveTo(S(10), S(-2), S(8), S(6)); // right side down
    ctx.closePath();
    ctx.fill();

    // Body outline
    ctx.strokeStyle = pOutline;
    ctx.lineWidth = S(1.5);
    ctx.stroke();

    // ── Head ──
    ctx.fillStyle = pColor;
    ctx.beginPath();
    ctx.arc(0, S(-20), S(7), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pOutline;
    ctx.lineWidth = S(1.5);
    ctx.stroke();

    // Head highlight
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.arc(S(-2), S(-22), S(3), 0, Math.PI * 2);
    ctx.fill();

    // ── Paddle arm ──
    ctx.shadowBlur = 0;
    var armBaseX = S(8);
    var armBaseY = S(-8);
    var paddleAngle = isSwinging ? (-0.8 + Math.sin(n / 50) * 0.4)
      : isRunning ? (pState === "runLeft" ? 0.3 : -0.3)
      : -0.1 + breathe * 0.02;

    ctx.save();
    ctx.translate(armBaseX, armBaseY);
    ctx.rotate(paddleAngle);

    // Upper arm
    ctx.fillStyle = pColor;
    ctx.beginPath();
    ctx.moveTo(0, S(-2));
    ctx.quadraticCurveTo(S(8), S(-1), S(14), S(0));
    ctx.lineTo(S(14), S(3));
    ctx.quadraticCurveTo(S(7), S(3), 0, S(2));
    ctx.fill();

    // Paddle (rounded rectangle)
    ctx.fillStyle = pOutline;
    var px = S(13); var py = S(-6); var pw = S(5); var pph = S(14); var pr = S(2);
    ctx.beginPath();
    ctx.moveTo(px + pr, py);
    ctx.lineTo(px + pw - pr, py);
    ctx.quadraticCurveTo(px + pw, py, px + pw, py + pr);
    ctx.lineTo(px + pw, py + pph - pr);
    ctx.quadraticCurveTo(px + pw, py + pph, px + pw - pr, py + pph);
    ctx.lineTo(px + pr, py + pph);
    ctx.quadraticCurveTo(px, py + pph, px, py + pph - pr);
    ctx.lineTo(px, py + pr);
    ctx.quadraticCurveTo(px, py, px + pr, py);
    ctx.fill();

    // Paddle edge highlight
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = S(0.8);
    ctx.stroke();

    ctx.restore(); // arm transform

    // ── Off-arm (left, more relaxed) ──
    ctx.fillStyle = pColor;
    ctx.beginPath();
    ctx.moveTo(S(-8), S(-8));
    ctx.quadraticCurveTo(S(-14), S(-4), S(-12), S(2));
    ctx.lineTo(S(-10), S(2));
    ctx.quadraticCurveTo(S(-11), S(-3), S(-6), S(-6));
    ctx.fill();

    // ── Motion trail when running ──
    if (isRunning) {
      var trailDir = (pState === "runLeft") ? 1 : -1;
      ctx.strokeStyle = colors.motionLines || "rgba(255,255,255,0.15)";
      ctx.lineWidth = S(1);
      for (var mi = 0; mi < 4; mi++) {
        var mx = trailDir * (S(12) + mi * S(5));
        var my = S(-10) + mi * S(6);
        var mLen = S(8) + mi * S(3);
        ctx.globalAlpha = 0.3 - mi * 0.06;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + trailDir * mLen, my);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ── Swing effect ──
    if (isSwinging) {
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = S(2);
      var swingPhase = (n % 300) / 300;
      ctx.globalAlpha = 0.5 * (1 - swingPhase);
      ctx.beginPath();
      ctx.arc(S(18), S(-6), S(10) + swingPhase * S(15), -0.5, 0.8);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore(); // main player transform
  };


  // ============================================
  // V2: HUD rendering
  // ============================================
  UI.prototype._renderHUDV2 = function (state) {
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


  // ============================================
  // V2: Input system (touch zones + keyboard)
  // ============================================
  UI.prototype._setupInputV2 = function () {
    var self = this;
    if (!this._runtime.inputState) {
      this._runtime.inputState = { left: false, right: false, up: false, down: false, hit: false };
    }

    var canvas = this._canvas;
    if (!canvas) return;

    // V3 Mobile: left half = drag to move (2D), right half = tap to hit (timing bonus)
    // Any touch = also moves toward ball automatically
    var activeTouches = {};

    canvas.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      if (window.KR_Audio && typeof window.KR_Audio.unlock === "function") window.KR_Audio.unlock();
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var ratioX = x / rect.width;

      activeTouches[e.pointerId] = { x: x, y: y, startX: x, startY: y, side: (ratioX < 0.5) ? "move" : "hit" };

      // Right half tap = explicit hit for timing bonus
      if (ratioX >= 0.5) {
        self._runtime.inputState.hit = true;
      }
    });

    canvas.addEventListener("pointermove", function (e) {
      var touch = activeTouches[e.pointerId];
      if (!touch) return;
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;

      // Calculate delta from last position for movement
      var dx = x - touch.x;
      var dy = y - touch.y;

      // Directional input from drag delta (threshold to avoid jitter)
      var threshold = 2;
      self._runtime.inputState.left = (dx < -threshold);
      self._runtime.inputState.right = (dx > threshold);
      self._runtime.inputState.up = (dy < -threshold);
      self._runtime.inputState.down = (dy > threshold);

      touch.x = x;
      touch.y = y;
    });

    var pointerUp = function (e) {
      var touch = activeTouches[e.pointerId];
      if (touch) {
        self._runtime.inputState.left = false;
        self._runtime.inputState.right = false;
        self._runtime.inputState.up = false;
        self._runtime.inputState.down = false;
        self._runtime.inputState.hit = false;
        delete activeTouches[e.pointerId];
      }
    };
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", pointerUp);

    // Keyboard (V3: 2D movement)
    this._keydownHandler = function (e) {
      if (self.state !== STATES.PLAYING) return;
      if (e.key === "ArrowLeft" || e.key === "a") { self._runtime.inputState.left = true; e.preventDefault(); }
      if (e.key === "ArrowRight" || e.key === "d") { self._runtime.inputState.right = true; e.preventDefault(); }
      if (e.key === "ArrowUp" || e.key === "w") { self._runtime.inputState.up = true; e.preventDefault(); }
      if (e.key === "ArrowDown" || e.key === "s") { self._runtime.inputState.down = true; e.preventDefault(); }
      if (e.key === " ") { self._runtime.inputState.hit = true; e.preventDefault(); }
    };
    this._keyupHandler = function (e) {
      if (e.key === "ArrowLeft" || e.key === "a") self._runtime.inputState.left = false;
      if (e.key === "ArrowRight" || e.key === "d") self._runtime.inputState.right = false;
      if (e.key === "ArrowUp" || e.key === "w") self._runtime.inputState.up = false;
      if (e.key === "ArrowDown" || e.key === "s") self._runtime.inputState.down = false;
      if (e.key === " ") self._runtime.inputState.hit = false;
    };
    document.addEventListener("keydown", this._keydownHandler);
    document.addEventListener("keyup", this._keyupHandler);

    // Mouse control (desktop): mouse X → player follows, click → hit
    // Only active on non-touch devices to avoid conflict with touch zones
    var isTouchDevice = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
    if (!isTouchDevice) {
      this._runtime._mouseActive = false;
      this._runtime._mouseTargetX = -1;
      var deadZone = 8; // pixels: don't jitter if mouse is very close to player

      this._mouseMoveHandler = function (e) {
        if (self.state !== STATES.PLAYING) return;
        var rect = canvas.getBoundingClientRect();
        var mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
        self._runtime._mouseActive = true;
        self._runtime._mouseTargetX = mouseX;

        // Convert mouse X to left/right input relative to player position
        var playerX = (self.game && self.game.run) ? self.game.run.playerX : canvas.width / 2;
        var diff = mouseX - playerX;
        if (diff < -deadZone) {
          self._runtime.inputState.left = true;
          self._runtime.inputState.right = false;
        } else if (diff > deadZone) {
          self._runtime.inputState.left = false;
          self._runtime.inputState.right = true;
        } else {
          self._runtime.inputState.left = false;
          self._runtime.inputState.right = false;
        }
      };
      canvas.addEventListener("mousemove", this._mouseMoveHandler);

      this._mouseClickHandler = function (e) {
        if (self.state !== STATES.PLAYING) return;
        // Unlock audio
        if (window.KR_Audio && typeof window.KR_Audio.unlock === "function") window.KR_Audio.unlock();
        self._runtime.inputState.hit = true;
        // Auto-release hit after one frame
        setTimeout(function () { self._runtime.inputState.hit = false; }, 50);
      };
      canvas.addEventListener("click", this._mouseClickHandler);
    }
  };

  UI.prototype._teardownInputV2 = function () {
    if (this._keydownHandler) { document.removeEventListener("keydown", this._keydownHandler); this._keydownHandler = null; }
    if (this._keyupHandler) { document.removeEventListener("keyup", this._keyupHandler); this._keyupHandler = null; }
    if (this._mouseMoveHandler && this._canvas) { this._canvas.removeEventListener("mousemove", this._mouseMoveHandler); this._mouseMoveHandler = null; }
    if (this._mouseClickHandler && this._canvas) { this._canvas.removeEventListener("click", this._mouseClickHandler); this._mouseClickHandler = null; }
    this._runtime.inputState = { left: false, right: false, up: false, down: false, hit: false };
    if (this._runtime) { this._runtime._mouseActive = false; this._runtime._mouseTargetX = -1; }
  };


  // ============================================
  // V2: Check game events for juice/audio
  // ============================================
  UI.prototype._checkGameEventsV2 = function (state) {
    var ball = state.ball;
    if (!ball) return;

    var juice = this._runtime.juice;
    var n = performance.now();
    var lastCheck = this._runtime._lastBallState || {};
    var BALL_STATES = window.KR_Game.BALL_STATES;
    var prevState = lastCheck.state || "";
    var curState = ball.state;

    if (curState !== prevState || (lastCheck.id && lastCheck.id !== ball.id)) {
      if (curState === BALL_STATES.HIT && prevState !== BALL_STATES.HIT) {
        this._haptic("smash");
        this._playSound("smash");
        juice.flashType = "smash";
        juice.flashUntil = n + requiredConfigNumber(this.config?.juice?.smashFlashMs, "juice.smashFlashMs", { min: 1, integer: true });
        juice.flashX = ball.x; juice.flashY = ball.y;
        if (!juice.scorePopups) juice.scorePopups = [];
        juice.scorePopups.push({ x: ball.x, y: ball.y, at: n });
        this._handleMicroFeedback({ smash: true, fault: false, ball: ball });
      }
      if (curState === "FAULTED" && prevState !== "FAULTED") {
        this._haptic("fault");
        this._playSound("fault");
        juice.flashType = "fault";
        juice.flashUntil = n + requiredConfigNumber(this.config?.juice?.faultFlashMs, "juice.faultFlashMs", { min: 1, integer: true });
        juice.flashX = ball.x; juice.flashY = ball.y;
        juice.shakeUntil = n + requiredConfigNumber(this.config?.juice?.faultShakeMs, "juice.faultShakeMs", { min: 1, integer: true });
        juice.shakeIntensity = requiredConfigNumber(this.config?.juice?.faultShakeIntensity, "juice.faultShakeIntensity", { min: 0 });
        if (this._runtime.runMode === MODES.SPRINT) {
          juice.sprintPenaltyUntil = n + requiredConfigNumber(this.config?.juice?.sprintPenaltyMs, "juice.sprintPenaltyMs", { min: 1, integer: true });
        }
        this._handleMicroFeedback({ smash: false, fault: true, ball: ball });
      }
      if (curState === "MISSED" && prevState !== "MISSED") {
        this._playSound("miss");
      }
    }

    this._runtime._lastBallState = { state: curState, id: ball.id };
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
        isDaily: !!(this._runtime && this._runtime.currentRunIsDaily),
        endReason: result.endReason,
        endedFrom: "ui",
        totalFaulted: result.totalFaulted || 0,
        totalMissed: result.totalMissed || 0,
        totalSpawned: result.totalSpawned || 0,
        elapsedMs: result.elapsedMs || 0,
        bestStreak: result.bestStreak || 0
      };
      var rr = this.storage
        ? (this.storage.recordRunComplete(nextRunNumber, result.smashes, meta) || {}) : {};
      newBest = !!(rr.newBest);
      bestSmashes = Number(rr.bestSmashes || 0);
    }

    this._runtime.lastRun = {
      mode: mode,
      isDaily: !!(this._runtime && this._runtime.currentRunIsDaily),
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
      bestStreak: result.bestStreak || 0,
      dailyModifier: result.dailyModifier || null,
      dailyObjectiveMet: !!(result.dailyObjectiveMet)
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
    var isDaily = !!(last && last.isDaily === true);
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
    var isDaily = !!(last && last.isDaily === true);

    // Dynamic hashtag: #KitchenRush{score}
    var hashtagPrefix = String(w.hashtagPrefix || "").trim();
    var hashtag = hashtagPrefix ? hashtagPrefix + (last.smashes || 0) : "";

    // Date string for daily
    var dp = todayDateParts();
    var dateStr = dp.month + " " + dp.day;

    // V3: Daily modifier info for share
    var modLabel = "";
    var modDesc = "";
    var objMet = false;
    if (last.dailyModifier) {
      modLabel = last.dailyModifier.label || "";
      modDesc = last.dailyModifier.desc || "";
    }
    if (last.dailyObjectiveMet) objMet = true;
    var modLine = modLabel ? (modLabel + (objMet ? " \u2705" : " \u274C")) : "";

    var tpl = "";
    if (isDaily) tpl = w.templateDaily || w.templateDefault || "";
    else if (last.mode === MODES.SPRINT) tpl = w.templateSprint || "";
    else if (last.newBest) tpl = w.templateNewBest || "";
    else if (last.totalFaulted > 0) tpl = w.templateFault || "";
    else tpl = w.templateDefault || "";

    var raw = fillTemplate(tpl, {
      score: last.smashes || 0,
      best: last.bestSmashes || 0,
      url: url,
      hashtag: hashtag,
      date: dateStr,
      modifier: modLine,
      modifierName: modLabel,
      modifierDesc: modDesc,
      objective: objMet ? "\u2705" : "\u274C",
      streak: last.bestStreak || 0
    });
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

    // Daily challenge primary CTA / Classic unlock after Daily
    var dailyHtml = "";
    var classicHtml = "";
    if (this.config?.daily?.enabled) {
      var dailyLabel = String(lw.dailyBadge || "").trim();
      if (dailyLabel) {
        var dp = todayDateParts();
        var dateTpl = String(lw.dailyDateTemplate || "").trim();
        var dateStr = dateTpl ? fillTemplate(dateTpl, dp) : "";
        var dailyExplain = String(lw.dailyExplain || "").trim();
        var dailyCta = String(lw.ctaPlayDaily || "").trim() || dailyLabel;
        dailyHtml = '<button class="kr-daily-badge kr-daily-badge--cta" data-action="play-daily" aria-label="' + escapeHtml(dailyCta) + '">';
        dailyHtml += '<span class="kr-daily-badge-icon">📅</span>';
        dailyHtml += '<span class="kr-daily-badge-label">' + escapeHtml(dailyLabel) + '</span>';
        if (dateStr) dailyHtml += '<span class="kr-daily-badge-date">' + escapeHtml(dateStr) + '</span>';
        dailyHtml += '</button>';
        if (dailyExplain) {
          dailyHtml += '<p class="kr-daily-explain kr-muted">' + escapeHtml(dailyExplain) + '</p>';
        }
      }
      if (this._hasCompletedDailyToday()) {
        classicHtml = '<div class="kr-actions">' +
          '<button class="kr-btn kr-btn--primary" data-action="play">' + ctaLabel + '</button>' +
        '</div>';
      } else {
        var classicHint = String(lw.classicUnlockHint || "").trim();
        if (classicHint) classicHtml = '<p class="kr-landing-classic-hint kr-muted">' + escapeHtml(classicHint) + '</p>';
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
          landingChallengeHtml +
          premiumLabelHtml +
          sparkHtml +
          lifetimeHtml +
          chestHintHtml +
          earlyTickerHtml +
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

      // V2: Setup touch zones + keyboard input system
      this._setupInputV2();

      // T5: Resize canvas on orientation change / window resize
      if (typeof ResizeObserver !== "undefined") {
        this._resizeObserver = new ResizeObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            var newW = Math.round(entry.contentRect.width);
            var newH = Math.round(entry.contentRect.height);
            if (newW > 0 && newH > 0 && (canvas.width !== newW || canvas.height !== newH)) {
              canvas.width = newW;
              canvas.height = newH;
              // Update game engine canvas dimensions
              if (self.game && self.game.run) {
                self.game.run.canvasW = newW;
                self.game.run.canvasH = newH;
              }
            }
          }
        });
        this._resizeObserver.observe(this.appEl);
      }

      // T1: Pause game when tab loses focus (prevents clock drift)
      this._visibilityHandler = function () {
        if (document.hidden && self.state === STATES.PLAYING) {
          self._stopGameLoop();
        } else if (!document.hidden && self.state === STATES.PLAYING && !self._rafId) {
          // V3: Don't restart if overlay is still visible (game hasn't started yet)
          var overlay = el("kr-run-start-overlay");
          if (overlay && overlay.classList.contains("kr-run-start-overlay--visible")) return;
          self._startGameLoop();
        }
      };
      document.addEventListener("visibilitychange", this._visibilityHandler);
    }

    // V3: Do NOT start game loop yet — wait for overlay tap-to-start
    // The game loop will be started by _showRunStartOverlay dismiss handler
    // this._startGameLoop(); // REMOVED — started on overlay dismiss
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
    var isDaily = !!(last && last.isDaily === true);
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
