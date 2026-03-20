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


  function requiredConfigString(value, name) {
    var s = String(value == null ? "" : value).trim();
    if (!s) throw new Error(name + " must be a non-empty string");
    return s;
  }

  function requiredObject(value, name) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(name + " must be an object");
    return value;
  }

  function requiredArray(value, name) {
    if (!Array.isArray(value)) throw new Error(name + " must be an array");
    return value;
  }

  function requiredWordingString(value, name, vars) {
    var s = requiredConfigString(value, name);
    return vars ? fillTemplate(s, vars) : s;
  }

  function getCanvasColors(config) {
    var canvas = config && config.canvas;
    if (!canvas || typeof canvas !== "object") throw new Error("KR_UI: KR_CONFIG.canvas missing");
    var colors = canvas.colors;
    if (!colors || typeof colors !== "object") throw new Error("KR_UI: KR_CONFIG.canvas.colors missing");
    return colors;
  }

  function getCanvasColor(colors, key) {
    return requiredConfigString(colors && colors[key], "KR_CONFIG.canvas.colors." + key);
  }


  function createCanvasSurface(width, height) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(width));
    c.height = Math.max(1, Math.round(height));
    return c;
  }

  function withAlpha(color, alpha) {
    var a = Math.max(0, Math.min(1, Number(alpha)));
    var src = requiredConfigString(color, "canvas color");
    if (a >= 0.999) return src;
    var s = src.trim();
    if (s.charAt(0) === "#") {
      var hex = s.slice(1);
      if (hex.length === 3) {
        var r3 = parseInt(hex.charAt(0) + hex.charAt(0), 16);
        var g3 = parseInt(hex.charAt(1) + hex.charAt(1), 16);
        var b3 = parseInt(hex.charAt(2) + hex.charAt(2), 16);
        return "rgba(" + r3 + "," + g3 + "," + b3 + "," + a.toFixed(3) + ")";
      }
      if (hex.length === 6) {
        var r6 = parseInt(hex.slice(0, 2), 16);
        var g6 = parseInt(hex.slice(2, 4), 16);
        var b6 = parseInt(hex.slice(4, 6), 16);
        return "rgba(" + r6 + "," + g6 + "," + b6 + "," + a.toFixed(3) + ")";
      }
    }
    var rgb = s.match(/^rgba?\(([^)]+)\)$/i);
    if (rgb) {
      var parts = rgb[1].split(",").map(function (part) { return part.trim(); });
      if (parts.length >= 3) {
        return "rgba(" + parts[0] + "," + parts[1] + "," + parts[2] + "," + a.toFixed(3) + ")";
      }
    }
    return src;
  }

  function getCheckoutUrl(cfg, priceKey) {
    if (!cfg || typeof cfg !== "object") throw new Error("KR_UI.getCheckoutUrl(): config is required");
    var raw = (priceKey === "early") ? cfg.stripeEarlyPaymentUrl : cfg.stripeStandardPaymentUrl;
    var url = String(raw == null ? "" : raw).trim();
    if (!url || url.indexOf("REPLACE") !== -1) throw new Error("KR_UI.getCheckoutUrl(): invalid checkout URL for " + priceKey);
    return url;
  }

  function formatCents(cents, currency) {
    const c = Number(cents);
    if (!Number.isFinite(c) || c <= 0) return "";
    const cur = String(currency == null ? "" : currency).trim().toUpperCase();
    if (!cur) throw new Error("KR_UI.formatCents: currency missing");
    try { return (c / 100).toLocaleString("en-US", { style: "currency", currency: cur }); } catch (_) { throw new Error("KR_UI.formatCents: invalid currency " + cur); }
  }

  function mmss(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ":" + String(sec).padStart(2, "0");
  }

  function isOnline() {
    if (typeof navigator.onLine !== "boolean") throw new Error("KR_UI.isOnline: navigator.onLine unavailable");
    return navigator.onLine;
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
    var s = String(val == null ? "" : val).trim();
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
    var bucketKey = String(key == null ? "default" : key).trim() || "default";
    return {
      delayMs: requiredConfigNumber(bucket.delayMs, "KR_CONFIG.ui.toast." + bucketKey + ".delayMs", { min: 0, integer: true }),
      durationMs: requiredConfigNumber(bucket.durationMs, "KR_CONFIG.ui.toast." + bucketKey + ".durationMs", { min: 1, integer: true })
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
    const timingKey = (opts && opts.timingKey) ? opts.timingKey : "default";
    const timing = getToastTiming(cfg, timingKey);
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

    this._canvasCache = {
      sizeKey: "",
      staticCourtKey: "",
      staticCourt: null,
      faultVignetteKey: "",
      faultVignette: null
    };

    // beforeunload guard
    this._beforeUnloadHandler = null;

    this._runtime = {
      // Input safety
      tapLocked: false,

      // HUD delta pulse cleanup
      hudPulseCleanupTimerId: null,
      hud: {
        signature: "",
        layout: "",
        playerScore: null,
        opponentScore: null,
        sprintScore: null,
        sprintRemaining: null,
        calloutText: ""
      },

      // Canvas juice effects
      juice: {
        flashType: "",         // "hit" | "fault" | "" 
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
      touchHoldTimerId: null,
      touchHoldDirection: 0,

      // Support modal cache
      supportEmail: "",

      // Current run
      runMode: MODES.RUN,           // MODES.RUN | MODES.SPRINT
      runType: "",              // "FREE" | "LAST_FREE" | "UNLIMITED" | ""
      gameplayControlsBound: false,
      finishingRun: false,

      // microFeedback (arcade: hit streaks, kitchen master, close call, last life)
      microFeedback: {
        hitStreak: 0,
        maxHitStreak: 0,
        tierShown: 0,
        lastOverlayAtHit: -999,
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
        score: 0,
        lives: 0,
        maxLives: 0,
        newBest: false,
        bestScore: 0,
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
      case "play-daily":        this.closeModal(); this._handlePlay({ isDaily: true }); break;
      case "daily-info":        this.openDailyModal(); break;
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
      try { ep = this._store("getEarlyPriceState"); } catch (_) { ep = null; }
      if (ep && ep.phase === "EARLY" && Number(ep.remainingMs) > 0) {
        this._stopPaywallTicker(); this._startPaywallTicker();
      } else { this._stopPaywallTicker(); }
    }

    // Stop game loop when leaving PLAYING
    if (prev === STATES.PLAYING && next !== STATES.PLAYING) {
      this._stopGameLoop();
      this._unbindGameplayControls();
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
  UI.prototype._handlePlay = function (opts) {
    var isDaily = !!(opts && opts.isDaily === true);
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
    this._runtime.isDaily = isDaily;

    // First run framing (one-shot: trust line before very first run)
    var counters = requiredObject(this._store("getCounters"), "KR_UI._maybeShowFirstRunFraming().counters");
    if (!this._store("hasFirstRunFramingSeen") && requiredConfigNumber(counters.runCompletes, "KR_UI._maybeShowFirstRunFraming().counters.runCompletes", { min: 0, integer: true }) === 0) {
      this._store("markFirstRunFramingSeen");
      var self = this;
      this._showFirstRunFraming(function () { self._startGameplay(MODES.RUN, runType, { isDaily: isDaily }); });
      return;
    }

    this._startGameplay(MODES.RUN, runType, { isDaily: isDaily });
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
    this._runtime.isDaily = false;
    this._startGameplay(MODES.SPRINT, MODES.SPRINT);
  };

  UI.prototype._startGameplay = function (mode, runType, options) {
    var isDaily = !!(options && options.isDaily === true);
    // Fail-closed: if no DOM → 0 dimensions → game.start must handle gracefully
    var metrics = this._getCanvasMetrics();
    var appW = metrics.width;
    var appH = metrics.height;

    // Reset microFeedback
    var mf = this._runtime.microFeedback;
    mf.hitStreak = 0;
    mf.maxHitStreak = 0;
    mf.tierShown = 0;
    mf.lastOverlayAtHit = -999;
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
    this.game.start({ config: this.config, mode: mode, canvasW: appW, canvasH: appH, isDaily: isDaily });

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
    var isDaily = !!this._runtime.isDaily;
    var cfg = this.config;
    var w = this.wording;
    var premium = !!(this._store("isPremium"));
    var ms = Number(cfg?.ui?.runStartOverlayMs);
    if (!Number.isFinite(ms) || ms <= 0) throw new Error("KR_UI._showRunStartOverlay(): invalid config.ui.runStartOverlayMs");

    var line1 = "";
    var line2 = "";

    if (mode === MODES.SPRINT) {
      var sw = requiredObject(w?.sprint, "KR_WORDING.sprint");
      line1 = requiredWordingString(sw.startOverlayLine1, "KR_WORDING.sprint.startOverlayLine1");
      line2 = requiredWordingString(sw.startOverlayLine2, "KR_WORDING.sprint.startOverlayLine2");

      // Sprint free runs remaining
      if (!premium) {
        var spUsed = requiredConfigNumber(this._store("getSprintFreeRunsUsed"), "KR_UI._showRunStartOverlay().sprintFreeRunsUsed", { min: 0, integer: true });
        var spLimit = Number(cfg?.sprint?.freeRunsLimit);
        if (!Number.isFinite(spLimit) || spLimit < 0) throw new Error("KR_UI._showRunStartOverlay(): invalid config.sprint.freeRunsLimit");
        var spRemaining = Math.max(0, spLimit - spUsed);
        var spLine = requiredWordingString(sw.startOverlayFreeRunsLimitLine, "KR_WORDING.sprint.startOverlayFreeRunsLimitLine");
        if (spLine && spLimit > 0 && spRemaining > 0) {
          line2 = (line2 ? line2 + " " : "") + fillTemplate(spLine, { remaining: spRemaining, limit: spLimit });
        }
      }
    } else {
      var uw = requiredObject(w?.ui, "KR_WORDING.ui");
      var cwStart = requiredObject(w?.classic, "KR_WORDING.classic");
      if (isDaily) line1 = requiredConfigString(uw.dailyBadge, "KR_WORDING.ui.dailyBadge") + " — " + requiredConfigString(uw.startRunTypeFree, "KR_WORDING.ui.startRunTypeFree");
      else if (runType === "FREE") line1 = requiredConfigString(uw.startRunTypeFree, "KR_WORDING.ui.startRunTypeFree");
      else if (runType === "LAST_FREE") line1 = requiredConfigString(uw.startRunTypeLastFree, "KR_WORDING.ui.startRunTypeLastFree");
      else if (runType === "UNLIMITED") line1 = txt(uw.startRunTypeUnlimited);
      line2 = fillTemplate(requiredWordingString(cwStart.startOverlayTargetTemplate, "KR_WORDING.classic.startOverlayTargetTemplate"), {
        target: requiredConfigNumber(cfg?.classic?.targetScore, "KR_CONFIG.classic.targetScore", { min: 1, integer: true }),
        winBy: requiredConfigNumber(cfg?.classic?.winBy, "KR_CONFIG.classic.winBy", { min: 1, integer: true })
      });
    }

    if (!line1 && !line2) return;

    var node = el("kr-run-start-overlay");
    if (!node) return;

    // "Tap anywhere to start" hint (Sprint only)
    var tapHint = "";
    if (mode === MODES.SPRINT) {
      var spTap = requiredWordingString(requiredObject(w?.sprint, "KR_WORDING.sprint").startOverlayTapAnywhere, "KR_WORDING.sprint.startOverlayTapAnywhere");
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
    var fw = requiredObject(this.wording?.firstRun, "KR_WORDING.firstRun");
    var trustLine = requiredWordingString(fw.trustLine, "KR_WORDING.firstRun.trustLine");
    if (!trustLine) { callback(); return; }

    var kitchenHint = requiredWordingString(fw.kitchenHint, "KR_WORDING.firstRun.kitchenHint");
    var kitchenHtml = kitchenHint ? '<p class="kr-first-run-hint kr-muted">' + escapeHtml(kitchenHint) + '</p>' : "";

    // Mini-tutorial: 3 visual rules
    var tutorialHtml = "";
    var rule1 = requiredWordingString(fw.rule1, "KR_WORDING.firstRun.rule1");
    var rule2 = requiredWordingString(fw.rule2, "KR_WORDING.firstRun.rule2");
    var rule3 = requiredWordingString(fw.rule3, "KR_WORDING.firstRun.rule3");
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
        '<button id="kr-first-run-go" class="kr-btn kr-btn--primary">' + escapeHtml(requiredConfigString(this.wording && this.wording.landing && this.wording.landing.ctaPlay, "KR_WORDING.landing.ctaPlay")) + '</button>' +
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

  UI.prototype._getCanvasMetrics = function () {
    var app = this._app;
    if (!app) throw new Error("KR_UI._getCanvasMetrics(): app root missing");
    var appW = Math.max(1, Math.round(app.clientWidth));
    var appH = Math.max(1, Math.round(app.clientHeight));
    var canvasCfg = this.config.canvas;
    var dprMax = requiredConfigNumber(canvasCfg.devicePixelRatioMax, "KR_CONFIG.canvas.devicePixelRatioMax", { min: 1, max: 4 });
    var deviceDpr = (typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio)) ? window.devicePixelRatio : 1;
    var dpr = Math.max(1, Math.min(dprMax, deviceDpr));
    return {
      cssW: appW,
      cssH: appH,
      width: Math.max(1, Math.round(appW * dpr)),
      height: Math.max(1, Math.round(appH * dpr)),
      dpr: dpr
    };
  };

  UI.prototype._syncCanvasSize = function () {
    var canvas = this._canvas;
    if (!canvas) return null;
    var m = this._getCanvasMetrics();
    var nextKey = m.width + "x" + m.height;
    if (canvas.width !== m.width || canvas.height !== m.height) {
      canvas.width = m.width;
      canvas.height = m.height;
    }
    if (!this._canvasCache || this._canvasCache.sizeKey !== nextKey) {
      this._canvasCache = {
        sizeKey: nextKey,
        staticCourtKey: "",
        staticCourt: null,
        faultVignetteKey: "",
        faultVignette: null
      };
    }
    return m;
  };

  UI.prototype._getStaticCourtLayer = function (params) {
    var cache = this._canvasCache;
    if (!cache) throw new Error("KR_UI._getStaticCourtLayer(): cache missing");
    var key = [
      params.w, params.h,
      params.netY, params.kitchenLineY,
      params.topInset, params.bottomInset,
      params.horizonY, params.farInset,
      params.courtColor, params.kitchenColor,
      params.colors.kitchenOverlay || "",
      params.colors.courtStripe || "",
      params.colors.kitchenLineGlow || "",
      params.colors.kitchenLabelColor || "",
      params.farCourtGuideAlpha
    ].join("|");
    if (cache.staticCourtKey === key && cache.staticCourt) return cache.staticCourt;

    var surface = createCanvasSurface(params.w, params.h);
    var sctx = surface.getContext("2d");
    if (!sctx) throw new Error("KR_UI._getStaticCourtLayer(): 2d context missing");
    var colors = params.colors;
    var w = params.w;
    var h = params.h;
    var netY = params.netY;
    var kitchenLineY = params.kitchenLineY;
    var topInset = params.topInset;
    var bottomInset = params.bottomInset;
    var horizonY = params.horizonY;
    var farInset = params.farInset;
    var kitchenInset = params.kitchenInset;
    var trajectoryGuideDashPx = params.trajectoryGuideDashPx;

    function courtInsetAt(y) {
      var depth = Math.max(0, Math.min(1, y / h));
      return topInset + (bottomInset - topInset) * depth;
    }
    function projectX(x, y) {
      var inset = courtInsetAt(y);
      var playableW = Math.max(1, w - inset * 2);
      var nx = Math.max(0, Math.min(1, x / w));
      return inset + nx * playableW;
    }
    function projectScale(y) {
      var depth = Math.max(0, Math.min(1, y / h));
      return params.playerScaleFar + (params.playerScaleNear - params.playerScaleFar) * depth;
    }

    var appBg = sctx.createLinearGradient(0, 0, 0, h);
    appBg.addColorStop(0, getCanvasColor(colors, "appBgTop"));
    appBg.addColorStop(1, getCanvasColor(colors, "appBgBottom"));
    sctx.fillStyle = appBg;
    sctx.fillRect(0, 0, w, h);

    var skyGrad = sctx.createLinearGradient(0, 0, 0, netY);
    skyGrad.addColorStop(0, getCanvasColor(colors, "horizonGlow"));
    skyGrad.addColorStop(1, "rgba(255,255,255,0)");
    sctx.fillStyle = skyGrad;
    sctx.fillRect(0, 0, w, netY + 1);

    sctx.fillStyle = getCanvasColor(colors, "horizonGlow");
    sctx.beginPath();
    sctx.moveTo(farInset, horizonY);
    sctx.lineTo(w - farInset, horizonY);
    sctx.lineTo(w - topInset, netY);
    sctx.lineTo(topInset, netY);
    sctx.closePath();
    sctx.fill();

    var courtGrad = sctx.createLinearGradient(0, netY, 0, h);
    courtGrad.addColorStop(0, colors.courtBgDark || params.courtColor);
    courtGrad.addColorStop(1, params.courtColor);
    sctx.fillStyle = courtGrad;
    sctx.beginPath();
    sctx.moveTo(topInset, netY);
    sctx.lineTo(w - topInset, netY);
    sctx.lineTo(w - bottomInset, h);
    sctx.lineTo(bottomInset, h);
    sctx.closePath();
    sctx.fill();

    var kitchenGrad = sctx.createLinearGradient(0, kitchenLineY, 0, h);
    kitchenGrad.addColorStop(0, colors.kitchenBgDark || params.kitchenColor);
    kitchenGrad.addColorStop(1, params.kitchenColor);
    sctx.fillStyle = kitchenGrad;
    sctx.beginPath();
    sctx.moveTo(kitchenInset, kitchenLineY);
    sctx.lineTo(w - kitchenInset, kitchenLineY);
    sctx.lineTo(w - bottomInset, h);
    sctx.lineTo(bottomInset, h);
    sctx.closePath();
    sctx.fill();

    if (colors.kitchenOverlay) {
      sctx.fillStyle = colors.kitchenOverlay;
      sctx.beginPath();
      sctx.moveTo(kitchenInset, kitchenLineY);
      sctx.lineTo(w - kitchenInset, kitchenLineY);
      sctx.lineTo(w - bottomInset, h);
      sctx.lineTo(bottomInset, h);
      sctx.closePath();
      sctx.fill();
    }

    if (colors.courtStripe) {
      for (var band = 0; band < 4; band++) {
        var bandTop = netY + (h - netY) * (band / 4);
        var bandBottom = netY + (h - netY) * ((band + 1) / 4);
        sctx.fillStyle = colors.courtStripe;
        sctx.beginPath();
        sctx.moveTo(courtInsetAt(bandTop), bandTop);
        sctx.lineTo(w - courtInsetAt(bandTop), bandTop);
        sctx.lineTo(w - courtInsetAt(bandBottom), bandBottom);
        sctx.lineTo(courtInsetAt(bandBottom), bandBottom);
        sctx.closePath();
        sctx.fill();
      }
    }

    sctx.strokeStyle = getCanvasColor(colors, "lineSoft");
    sctx.lineWidth = Math.max(2, w * 0.004);
    sctx.setLineDash([]);
    sctx.beginPath();
    sctx.moveTo(topInset, netY);
    sctx.lineTo(bottomInset, h);
    sctx.moveTo(w - topInset, netY);
    sctx.lineTo(w - bottomInset, h);
    sctx.stroke();

    sctx.strokeStyle = getCanvasColor(colors, "lineSoft");
    sctx.beginPath();
    sctx.moveTo(projectX(w / 2, netY), netY);
    sctx.lineTo(projectX(w / 2, kitchenLineY), kitchenLineY);
    sctx.stroke();

    sctx.strokeStyle = getCanvasColor(colors, "line");
    sctx.lineWidth = Math.max(2, w * 0.0045);
    sctx.beginPath();
    sctx.moveTo(topInset, netY);
    sctx.lineTo(w - topInset, netY);
    sctx.moveTo(bottomInset, h);
    sctx.lineTo(w - bottomInset, h);
    sctx.stroke();

    if (colors.kitchenLineGlow) {
      sctx.strokeStyle = colors.kitchenLineGlow;
      sctx.lineWidth = Math.max(10, w * 0.02);
      sctx.beginPath();
      sctx.moveTo(kitchenInset, kitchenLineY);
      sctx.lineTo(w - kitchenInset, kitchenLineY);
      sctx.stroke();
    }

    sctx.strokeStyle = colors.kitchenLine;
    sctx.lineWidth = Math.max(3, w * 0.006);
    sctx.beginPath();
    sctx.moveTo(kitchenInset, kitchenLineY);
    sctx.lineTo(w - kitchenInset, kitchenLineY);
    sctx.stroke();

    sctx.strokeStyle = getCanvasColor(colors, "netTape");
    sctx.lineWidth = Math.max(3, w * 0.006);
    sctx.beginPath();
    sctx.moveTo(topInset, netY);
    sctx.lineTo(w - topInset, netY);
    sctx.stroke();

    sctx.strokeStyle = getCanvasColor(colors, "netMesh");
    sctx.lineWidth = 1;
    for (var meshY = netY + 4; meshY < kitchenLineY - 6; meshY += Math.max(8, h * 0.018)) {
      var meshInset = courtInsetAt(meshY);
      sctx.beginPath();
      sctx.moveTo(meshInset, meshY);
      sctx.lineTo(w - meshInset, meshY);
      sctx.stroke();
    }
    for (var meshX = topInset; meshX <= w - topInset; meshX += Math.max(18, w * 0.055)) {
      sctx.beginPath();
      sctx.moveTo(meshX, netY);
      sctx.lineTo(projectX(meshX, kitchenLineY), kitchenLineY - 2);
      sctx.stroke();
    }

    sctx.strokeStyle = getCanvasColor(colors, "lineSoft");
    sctx.lineWidth = 1.5;
    sctx.strokeStyle = withAlpha(getCanvasColor(colors, "lineSoft"), params.farCourtGuideAlpha);
    sctx.beginPath();
    sctx.moveTo(farInset, horizonY);
    sctx.lineTo(topInset, netY);
    sctx.moveTo(w - farInset, horizonY);
    sctx.lineTo(w - topInset, netY);
    sctx.moveTo(w * 0.5, horizonY);
    sctx.lineTo(w * 0.5, netY);
    sctx.stroke();

    sctx.strokeStyle = getCanvasColor(colors, "lineSoft");
    sctx.lineWidth = 1;
    sctx.beginPath();
    sctx.moveTo(projectX(w * 0.2, kitchenLineY), kitchenLineY);
    sctx.lineTo(projectX(w * 0.16, h), h);
    sctx.moveTo(projectX(w * 0.8, kitchenLineY), kitchenLineY);
    sctx.lineTo(projectX(w * 0.84, h), h);
    sctx.moveTo(projectX(w * 0.5, kitchenLineY), kitchenLineY);
    sctx.lineTo(projectX(w * 0.5, h), h);
    sctx.stroke();

    if (colors.kitchenLabelColor) {
      sctx.font = "700 " + Math.round(w * 0.043) + "px system-ui, sans-serif";
      sctx.fillStyle = colors.kitchenLabelColor;
      sctx.textAlign = "center";
      sctx.textBaseline = "middle";
      sctx.fillText("KITCHEN", w / 2, kitchenLineY + (h - kitchenLineY) * 0.46);
    }

    cache.staticCourtKey = key;
    cache.staticCourt = surface;
    return surface;
  };

  UI.prototype._getFaultVignetteLayer = function (w, h) {
    var cache = this._canvasCache;
    if (!cache) throw new Error("KR_UI._getFaultVignetteLayer(): cache missing");
    var key = w + "x" + h;
    if (cache.faultVignetteKey === key && cache.faultVignette) return cache.faultVignette;
    var surface = createCanvasSurface(w, h);
    var sctx = surface.getContext("2d");
    if (!sctx) throw new Error("KR_UI._getFaultVignetteLayer(): 2d context missing");
    var vigGrad = sctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.8);
    vigGrad.addColorStop(0, "rgba(239,71,111,0)");
    vigGrad.addColorStop(1, "rgba(239,71,111,1)");
    sctx.fillStyle = vigGrad;
    sctx.fillRect(0, 0, w, h);
    cache.faultVignetteKey = key;
    cache.faultVignette = surface;
    return surface;
  };


  // ============================================
  // Canvas rendering
  // ============================================
  UI.prototype._renderCanvas = function (state) {
    var canvas = this._canvas;
    if (!canvas) return;
    var ctx = this._ctx;
    if (!ctx) return;

    var metrics = this._syncCanvasSize();
    var w = canvas.width;
    var h = canvas.height;
    var canvasCfg = requiredObject(this.config.canvas, "KR_CONFIG.canvas");
    var colors = getCanvasColors(this.config);

    var kitchenLineY = Number(canvasCfg.kitchenLineY) * h;
    if (!Number.isFinite(kitchenLineY) || kitchenLineY <= 0) return;

    var juice = this._runtime.juice;
    var n = performance.now();

    // Bounce animation config
    var bounceHeight = requiredConfigNumber(canvasCfg.bounceHeight, "KR_CONFIG.canvas.bounceHeight", { min: 0 });
    var bounceAnimMs = requiredConfigNumber(canvasCfg.bounceAnimMs, "KR_CONFIG.canvas.bounceAnimMs", { min: 1, integer: true });
    var hitOutMs = requiredConfigNumber(canvasCfg.hitOutMs, "KR_CONFIG.canvas.hitOutMs", { min: 1, integer: true });
    var hitOutDistance = requiredConfigNumber(canvasCfg.hitOutDistance, "KR_CONFIG.canvas.hitOutDistance", { min: 1 });
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

    var netY = requiredConfigNumber(canvasCfg.netYFrac, "KR_CONFIG.canvas.netYFrac", { min: 0.01, max: 0.99 }) * h;
    var topInset = requiredConfigNumber(canvasCfg.perspectiveTopInsetFrac, "KR_CONFIG.canvas.perspectiveTopInsetFrac", { min: 0, max: 0.49 }) * w;
    var bottomInset = requiredConfigNumber(canvasCfg.perspectiveBottomInsetFrac, "KR_CONFIG.canvas.perspectiveBottomInsetFrac", { min: 0, max: 0.49 }) * w;
    var playerScaleNear = requiredConfigNumber(canvasCfg.playerScaleNear, "KR_CONFIG.canvas.playerScaleNear", { min: 0.1, max: 4 });
    var playerScaleFar = requiredConfigNumber(canvasCfg.playerScaleFar, "KR_CONFIG.canvas.playerScaleFar", { min: 0.1, max: 4 });
    var landingMarkerRadiusPx = requiredConfigNumber(canvasCfg.landingMarkerRadiusPx, "KR_CONFIG.canvas.landingMarkerRadiusPx", { min: 1, integer: true });
    var landingMarkerStrokePx = requiredConfigNumber(canvasCfg.landingMarkerStrokePx, "KR_CONFIG.canvas.landingMarkerStrokePx", { min: 1, integer: true });
    var trajectoryGuideDashPx = requiredConfigNumber(canvasCfg.trajectoryGuideDashPx, "KR_CONFIG.canvas.trajectoryGuideDashPx", { min: 1, integer: true });
    var ballGlowBlurPx = requiredConfigNumber(canvasCfg.ballGlowBlurPx, "KR_CONFIG.canvas.ballGlowBlurPx", { min: 1, integer: true });
    var ballCoreRingPx = requiredConfigNumber(canvasCfg.ballCoreRingPx, "KR_CONFIG.canvas.ballCoreRingPx", { min: 1, integer: true });
    var serviceTargetRadiusMult = requiredConfigNumber(canvasCfg.serviceTargetRadiusMult, "KR_CONFIG.canvas.serviceTargetRadiusMult", { min: 1, max: 6 });
    var swingSlashWidthPx = requiredConfigNumber(canvasCfg.swingSlashWidthPx, "KR_CONFIG.canvas.swingSlashWidthPx", { min: 1, integer: true });
    var swingSlashAlpha = requiredConfigNumber(canvasCfg.swingSlashAlpha, "KR_CONFIG.canvas.swingSlashAlpha", { min: 0, max: 1 });
    var farCourtGuideAlpha = requiredConfigNumber(canvasCfg.farCourtGuideAlpha, "KR_CONFIG.canvas.farCourtGuideAlpha", { min: 0, max: 1 });
    var idleBobPx = requiredConfigNumber(canvasCfg.idleBobPx, "KR_CONFIG.canvas.idleBobPx", { min: 0, max: 12 });
    var fastTrailWidthPx = requiredConfigNumber(canvasCfg.fastTrailWidthPx, "KR_CONFIG.canvas.fastTrailWidthPx", { min: 1, integer: true });
    var fastTrailAlpha = requiredConfigNumber(canvasCfg.fastTrailAlpha, "KR_CONFIG.canvas.fastTrailAlpha", { min: 0, max: 1 });
    var impactParticleCount = requiredConfigNumber(canvasCfg.impactParticleCount, "KR_CONFIG.canvas.impactParticleCount", { min: 0, max: 20, integer: true });
    var opponentIdleBobPx = requiredConfigNumber(canvasCfg.opponentIdleBobPx, "KR_CONFIG.canvas.opponentIdleBobPx", { min: 0, max: 16 });
    var opponentReachPx = requiredConfigNumber(canvasCfg.opponentReachPx, "KR_CONFIG.canvas.opponentReachPx", { min: 0, max: 24 });
    var playerRunBobPx = requiredConfigNumber(canvasCfg.playerRunBobPx, "KR_CONFIG.canvas.playerRunBobPx", { min: 0, max: 16 });
    var playerRunSwingPx = requiredConfigNumber(canvasCfg.playerRunSwingPx, "KR_CONFIG.canvas.playerRunSwingPx", { min: 0, max: 24 });
    var playerTiltMaxPx = requiredConfigNumber(canvasCfg.playerTiltMaxPx, "KR_CONFIG.canvas.playerTiltMaxPx", { min: 0, max: 24 });
    var ballSpinAlpha = requiredConfigNumber(canvasCfg.ballSpinAlpha, "KR_CONFIG.canvas.ballSpinAlpha", { min: 0, max: 1 });
    var ballPulsePx = requiredConfigNumber(canvasCfg.ballPulsePx, "KR_CONFIG.canvas.ballPulsePx", { min: 0, max: 8 });
    var servicePulseAlpha = requiredConfigNumber(canvasCfg.servicePulseAlpha, "KR_CONFIG.canvas.servicePulseAlpha", { min: 0, max: 1 });

    function courtInsetAt(y) {
      var depth = Math.max(0, Math.min(1, y / h));
      return topInset + (bottomInset - topInset) * depth;
    }
    function projectX(x, y) {
      var inset = courtInsetAt(y);
      var playableW = Math.max(1, w - inset * 2);
      var nx = Math.max(0, Math.min(1, x / w));
      return inset + nx * playableW;
    }
    function projectScale(y) {
      var depth = Math.max(0, Math.min(1, y / h));
      return playerScaleFar + (playerScaleNear - playerScaleFar) * depth;
    }

    var staticCourt = this._getStaticCourtLayer({
      w: w,
      h: h,
      colors: colors,
      netY: netY,
      kitchenLineY: kitchenLineY,
      topInset: topInset,
      bottomInset: bottomInset,
      horizonY: horizonY,
      farInset: farInset,
      kitchenInset: kitchenInset,
      courtColor: courtColor,
      kitchenColor: kitchenColor,
      farCourtGuideAlpha: farCourtGuideAlpha,
      playerScaleNear: playerScaleNear,
      playerScaleFar: playerScaleFar,
      trajectoryGuideDashPx: trajectoryGuideDashPx
    });
    ctx.drawImage(staticCourt, 0, 0);

    var msGlowMs = requiredConfigNumber(this.config?.juice?.milestoneGlowMs, "KR_CONFIG.juice.milestoneGlowMs", { min: 1, integer: true });
    if (state.lastMilestoneAt && (n - state.lastMilestoneAt) < msGlowMs) {
      var glowAlpha = Math.max(0, 0.14 * (1 - (n - state.lastMilestoneAt) / msGlowMs));
      ctx.fillStyle = "rgba(255,255,255," + glowAlpha + ")";
      ctx.fillRect(0, 0, w, h);
      if (!juice.milestoneGlowUntil || juice.milestoneGlowUntil < state.lastMilestoneAt) {
        juice.milestoneGlowUntil = state.lastMilestoneAt + msGlowMs;
        this._playSound("milestone");
      }
    }

    if (colors.kitchenLineGlow) {
      ctx.strokeStyle = colors.kitchenLineGlow;
      ctx.lineWidth = Math.max(10, w * 0.02);
      ctx.beginPath();
      ctx.moveTo(kitchenInset, kitchenLineY);
      ctx.lineTo(w - kitchenInset, kitchenLineY);
      ctx.stroke();
    }

    ctx.strokeStyle = colors.kitchenLine;
    ctx.lineWidth = Math.max(3, w * 0.006);
    ctx.beginPath();
    ctx.moveTo(kitchenInset, kitchenLineY);
    ctx.lineTo(w - kitchenInset, kitchenLineY);
    ctx.stroke();

    // Net: stronger spatial repere without dominating.
    ctx.strokeStyle = getCanvasColor(colors, "netTape");
    ctx.lineWidth = Math.max(3, w * 0.006);
    ctx.beginPath();
    ctx.moveTo(topInset, netY);
    ctx.lineTo(w - topInset, netY);
    ctx.stroke();

    ctx.strokeStyle = getCanvasColor(colors, "netMesh");
    ctx.lineWidth = 1;
    for (var meshY = netY + 4; meshY < kitchenLineY - 6; meshY += Math.max(8, h * 0.018)) {
      var meshInset = courtInsetAt(meshY);
      ctx.beginPath();
      ctx.moveTo(meshInset, meshY);
      ctx.lineTo(w - meshInset, meshY);
      ctx.stroke();
    }
    for (var meshX = topInset; meshX <= w - topInset; meshX += Math.max(18, w * 0.055)) {
      ctx.beginPath();
      ctx.moveTo(meshX, netY);
      ctx.lineTo(projectX(meshX, kitchenLineY), kitchenLineY - 2);
      ctx.stroke();
    }

    // Service target highlight + diagonal guide
    if (state.mode === MODES.RUN && Number.isFinite(Number(state.serviceTargetX)) && Number.isFinite(Number(state.serverOriginX))) {
      var guideMs = requiredConfigNumber(canvasCfg.serviceGuideShowMs, "KR_CONFIG.canvas.serviceGuideShowMs", { min: 1, integer: true });
      var showGuide = !!state.lastCalloutUntil && (state.lastCalloutUntil - n > -guideMs * 0.25);
      if (showGuide) {
        var serveToPlayer = state.server === "OPPONENT";
        var targetY = serveToPlayer ? (kitchenLineY + (h - kitchenLineY) * 0.28) : (horizonY + (netY - horizonY) * 0.62);
        var originY = serveToPlayer ? (horizonY + (netY - horizonY) * 0.68) : (state.player && state.player.baseY ? state.player.baseY : h * 0.86);
        var targetX = projectX(state.serviceTargetX, targetY);
        var originX = projectX(state.serverOriginX, originY);
        var glowAlpha = requiredConfigNumber(canvasCfg.serviceTargetGlowAlpha, "KR_CONFIG.canvas.serviceTargetGlowAlpha", { min: 0, max: 1 });
        var guideWidth = requiredConfigNumber(canvasCfg.serviceGuideWidthPx, "KR_CONFIG.canvas.serviceGuideWidthPx", { min: 1, integer: true });
        var guideDash = requiredConfigNumber(canvasCfg.serviceGuideDashPx, "KR_CONFIG.canvas.serviceGuideDashPx", { min: 1, integer: true });
        ctx.save();
        if (colors.serviceLane) {
          ctx.fillStyle = colors.serviceLane;
          ctx.beginPath();
          ctx.moveTo(originX, originY);
          ctx.quadraticCurveTo((originX + targetX) / 2, Math.min(originY, targetY) - h * 0.08, targetX, targetY);
          ctx.lineTo(targetX + Math.max(10, landingMarkerRadiusPx * 1.1), targetY + Math.max(8, landingMarkerRadiusPx * 0.65));
          ctx.quadraticCurveTo((originX + targetX) / 2 + Math.max(12, w * 0.03), Math.min(originY, targetY) - h * 0.04, originX + Math.max(6, w * 0.015), originY + Math.max(8, h * 0.015));
          ctx.closePath();
          ctx.fill();
        }
        var guidePulse = 1 + 0.08 * Math.sin(n / 120);
        ctx.fillStyle = withAlpha(getCanvasColor(colors, "serviceTarget"), glowAlpha);
        ctx.beginPath();
        ctx.arc(targetX, targetY, Math.max(12, landingMarkerRadiusPx * serviceTargetRadiusMult) * guidePulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = withAlpha(colors.hudAccent || getCanvasColor(colors, "serviceTarget"), servicePulseAlpha);
        ctx.lineWidth = Math.max(2, guideWidth);
        ctx.beginPath();
        ctx.arc(targetX, targetY, Math.max(14, landingMarkerRadiusPx * (serviceTargetRadiusMult + 0.45)) * (1 + 0.1 * Math.sin(n / 150)), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([guideDash, guideDash]);
        ctx.strokeStyle = getCanvasColor(colors, "serviceGuide");
        ctx.lineWidth = guideWidth;
        var ctrlX = (originX + targetX) / 2;
        var ctrlY = Math.min(originY, targetY) - h * 0.08;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.quadraticCurveTo(ctrlX, ctrlY, targetX, targetY);
        ctx.stroke();

        var beadT = 0.5 + 0.5 * Math.sin(n / 240);
        var inv = 1 - beadT;
        var beadX = inv * inv * originX + 2 * inv * beadT * ctrlX + beadT * beadT * targetX;
        var beadY = inv * inv * originY + 2 * inv * beadT * ctrlY + beadT * beadT * targetY;
        ctx.fillStyle = withAlpha(colors.hudAccent || getCanvasColor(colors, "serviceTarget"), 0.78);
        ctx.beginPath();
        ctx.arc(beadX, beadY, Math.max(3, guideWidth * 1.35), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // First Kitchen ball: pulse the kitchen line + zone
    var balls = requiredArray(state.balls, "KR_UI._renderCanvas().state.balls");
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

      // Hit-out animation: ball flies away
      if (b.state === "HIT" && b.hitAt > 0) {
        var sinceHit = n - b.hitAt;
        if (sinceHit < hitOutMs) {
          var hitT = sinceHit / hitOutMs;
          var eased = 1 - Math.pow(1 - hitT, 3); // ease-out cubic
          var angle = b.hitOutAngle || -Math.PI / 2;
          visualY = b.y + Math.sin(angle) * hitOutDistance * eased;
          var visualX_offset = Math.cos(angle) * hitOutDistance * eased;
          b._renderX = b.x + visualX_offset;
          visualRadius = b.radius * (1 - hitT * 0.5);
          ctx.fillStyle = withAlpha(colors.ballHit, Math.max(0, 1 - hitT));
          ctx.beginPath();
          ctx.arc(b._renderX || projectX(b.x, visualY), visualY, Math.max(1, visualRadius), 0, Math.PI * 2);
          ctx.fill();
          continue; // Skip normal rendering for hit-out balls
        } else {
          continue; // Fully faded
        }
      }

      // Faulted flash
      if (b.state === "FAULTED") {
        var sinceFault = n - (b.faultedAt || 0);
        if (sinceFault < 300) {
          ctx.fillStyle = withAlpha(colors.ballFaulted, Math.max(0, 0.7 * (1 - sinceFault / 300)));
          // Expand ring
          var faultRad = b.radius + (sinceFault / 300) * 20;
          ctx.beginPath();
          ctx.arc(projectX(b.x, b.y), b.y, faultRad * projectScale(b.y), 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }

      // Missed fade
      if (b.state === "MISSED") {
        var sinceMiss = n - (b.missedAt || 0);
        if (sinceMiss < 400) {
          ctx.fillStyle = withAlpha(colors.ballMissed, Math.max(0, 0.4 * (1 - sinceMiss / 400)));
          ctx.beginPath();
          ctx.arc(projectX(b.x, b.y), b.y, b.radius * projectScale(b.y), 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }

      var bt = b.ballType == null ? requiredConfigString(this.config?.rush?.defaultBallType, "KR_CONFIG.rush.defaultBallType") : requiredConfigString(b.ballType, "ball.ballType");

      // Trail (falling balls only)
      if (b.state === "FALLING" && b.trail && b.trail.length > 0) {
        for (var ti = 0; ti < b.trail.length; ti++) {
          var trailAlpha = 0.05 + 0.05 * (ti / b.trail.length);
          var trailRadius = b.radius * (0.3 + 0.4 * (ti / b.trail.length));
          ctx.fillStyle = withAlpha(b.inKitchen ? colors.ballKitchen : colors.ballDefault, trailAlpha);
          ctx.beginPath();
          ctx.arc(projectX(b.trail[ti].x, b.trail[ti].y), b.trail[ti].y, trailRadius * projectScale(b.trail[ti].y), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (bt === "fast" && (b.state === "FALLING" || b.state === "BOUNCING")) {
        ctx.save();
        ctx.strokeStyle = withAlpha(colors.fastTrail || colors.ballFast || colors.ballDefault, fastTrailAlpha);
        ctx.lineWidth = fastTrailWidthPx;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(projectX(b.x, visualY), visualY);
        ctx.lineTo(projectX(b.x, Math.max(netY, visualY - h * 0.06)), Math.max(netY, visualY - h * 0.06));
        ctx.stroke();
        ctx.restore();
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
        ctx.fillStyle = withAlpha(colors.shadow, shadowAlpha);
        ctx.beginPath();
        ctx.ellipse(projectX(b.x, b.landingY), b.landingY + b.radius * 0.3, sr, sr * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // "WAIT!" text above Kitchen balls while falling
      if (b.inKitchen && b.state === "FALLING" && b.y > h * 0.15) {
        var waitAlpha = 0.4 + 0.3 * Math.sin(n / 200);
        ctx.font = "bold " + Math.round(b.radius * 1.1) + "px system-ui, sans-serif";
        ctx.fillStyle = withAlpha(getCanvasColor(colors, "waitIndicator"), waitAlpha);
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("WAIT", projectX(b.x, b.y), b.y - b.radius - 6);
      }

      // Landing marker + trajectory guide for readability
      if (b.state === "FALLING" || b.state === "LANDED" || b.state === "BOUNCING") {
        var landingX = projectX(b.x, b.landingY);
        var visualX = projectX(b.x, visualY);
        ctx.save();
        ctx.setLineDash([trajectoryGuideDashPx, trajectoryGuideDashPx]);
        ctx.strokeStyle = b.mustBounce ? "rgba(255,214,10,0.30)" : "rgba(224,251,252,0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(visualX, visualY);
        ctx.lineTo(landingX, b.landingY);
        ctx.stroke();
        ctx.setLineDash([]);
        var markerPulse = 1 + ((b.mustBounce || bt === "fast") ? 0.08 * Math.sin(n / 110 + i) : 0);
        ctx.strokeStyle = b.mustBounce ? "rgba(255,214,10,0.55)" : "rgba(255,255,255,0.25)";
        ctx.lineWidth = landingMarkerStrokePx;
        ctx.beginPath();
        ctx.arc(landingX, b.landingY, landingMarkerRadiusPx * projectScale(b.landingY) * markerPulse, 0, Math.PI * 2);
        ctx.stroke();
        if (b.mustBounce || bt === "fast") {
          ctx.fillStyle = withAlpha(getCanvasColor(colors, "serviceTarget"), 0.18);
          ctx.beginPath();
          ctx.arc(landingX, b.landingY, landingMarkerRadiusPx * projectScale(b.landingY) * (1.45 + 0.08 * Math.sin(n / 150 + i)), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Ball color by state
      if (bt === "dink" && colors.ballDink) ctx.fillStyle = colors.ballDink;
      else if (bt === "lob" && colors.ballLob) ctx.fillStyle = colors.ballLob;
      else if (bt === "fast" && colors.ballFast) ctx.fillStyle = colors.ballFast;
      else if (b.inKitchen) ctx.fillStyle = colors.ballKitchen;
      else ctx.fillStyle = colors.ballDefault;

      var ballX = projectX(b.x, visualY);
      var ballScale = projectScale(visualY);
      var pulseFactor = (b.state === "FALLING" || b.state === "BOUNCING") ? (1 + (ballPulsePx / Math.max(1, visualRadius * 8)) * Math.sin(n / 95 + i)) : 1;
      var ballRenderRadius = visualRadius * ballScale * pulseFactor;

      // Ball halo without shadowBlur: cheaper on mobile than runtime blur.
      var glowColor = ctx.fillStyle;
      ctx.fillStyle = withAlpha(glowColor, 0.22);
      ctx.beginPath();
      ctx.arc(ballX, visualY, ballRenderRadius + Math.max(1, Math.min(ballGlowBlurPx, ballRenderRadius * 0.8)), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = glowColor;
      ctx.beginPath();
      ctx.arc(ballX, visualY, ballRenderRadius * 0.96, 0, Math.PI * 2);
      ctx.fill();

      if (colors.ballOutline) {
        ctx.strokeStyle = colors.ballOutline;
        ctx.lineWidth = Math.max(ballCoreRingPx, ballRenderRadius * 0.14);
        ctx.beginPath();
        ctx.arc(ballX, visualY, ballRenderRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (colors.ballSeam && ballSpinAlpha > 0) {
        ctx.save();
        ctx.strokeStyle = withAlpha(colors.ballSeam, ballSpinAlpha);
        ctx.lineWidth = Math.max(1, ballRenderRadius * 0.08);
        ctx.beginPath();
        ctx.arc(ballX - ballRenderRadius * 0.16, visualY, ballRenderRadius * 0.46, -1.1, 1.1, false);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ballX + ballRenderRadius * 0.16, visualY, ballRenderRadius * 0.46, 2.04, 4.24, false);
        ctx.stroke();
        ctx.restore();
      }

      if (b.mustBounce) {
        ctx.strokeStyle = colors.waitIndicator || getCanvasColor(colors, "hudAccent");
        ctx.lineWidth = Math.max(1.5, ballRenderRadius * 0.10);
        ctx.beginPath();
        ctx.arc(ballX, visualY, ballRenderRadius * 1.24, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Inner highlight without radial gradient in the frame loop.
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.arc(ballX - ballRenderRadius * 0.22, visualY - ballRenderRadius * 0.22, Math.max(1, ballRenderRadius * 0.24), 0, Math.PI * 2);
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
          ctx.arc(ballX, visualY, bounceRad * ballScale, 0, Math.PI * 2);
          ctx.stroke();

          // "NOW!" text briefly
          if (sinceBounceFlash < bounceFlashMs * 0.6) {
            ctx.font = "bold " + Math.round(b.radius * 1.2) + "px system-ui, sans-serif";
            ctx.fillStyle = withAlpha("#06d6a0", bounceAlpha);
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText("NOW!", ballX, visualY - ballRenderRadius - 8);
          }

          // Play bounce sound once per ball
          if (!juice.bounceFlashBalls[b.id]) {
            juice.bounceFlashBalls[b.id] = true;
            this._playSound("bounce");
          }
        }
      }

      // Bounce indicator ring (Kitchen balls post-bounce = hitable, pulsing)
      if (b.state === "BOUNCING") {
        var pulseScale = 1 + 0.1 * Math.sin(n / 80);
        ctx.strokeStyle = withAlpha(colors.bounceRing, 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ballX, visualY, (ballRenderRadius + 5) * pulseScale, 0, Math.PI * 2);
        ctx.stroke();
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
        if (colors.scoreGlow) {
          ctx.fillStyle = withAlpha(colors.scoreGlow, popAlpha);
          ctx.beginPath();
          ctx.ellipse(popup.x, popY, 26 + (1 - popT) * 10, 16 + (1 - popT) * 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.font = "bold " + Math.round(24 + (1 - popT) * 8) + "px system-ui, sans-serif";
        ctx.fillStyle = withAlpha(getCanvasColor(colors, "scorePopup"), popAlpha);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("+1", popup.x, popY);
      }
    }

    // Hit flash: bright burst at tap point (larger, more particles)
    if (juice.flashType === "hit" && juice.flashUntil > n) {
      var hitFlashDur = requiredConfigNumber(this.config?.juice?.hitFlashMs, "KR_CONFIG.juice.hitFlashMs", { min: 1, integer: true });
      var flashProgress = 1 - (juice.flashUntil - n) / hitFlashDur;
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
      ctx.strokeStyle = withAlpha(getCanvasColor(colors, "hudAccent"), flashAlpha * 0.5);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(juice.flashX, juice.flashY, flashRad * 1.72, 0, Math.PI * 2);
      ctx.stroke();

      // Micro-particles (8 expanding dots)
      for (var pi = 0; pi < impactParticleCount; pi++) {
        var angle = (Math.PI * 2 / Math.max(1, impactParticleCount)) * pi + flashProgress * 0.8;
        var dist = 20 + flashProgress * 40;
        var px = juice.flashX + Math.cos(angle) * dist;
        var py = juice.flashY + Math.sin(angle) * dist;
        var pSize = 3 - flashProgress * 2.5;
        if (pSize > 0) {
          ctx.fillStyle = colors.impactParticle || ("rgba(255,255,255," + (flashAlpha * 0.7).toFixed(2) + ")");
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
      // Cached vignette overlay: built once per canvas size, then alpha-modulated.
      ctx.save();
      ctx.globalAlpha = faultAlpha;
      ctx.drawImage(this._getFaultVignetteLayer(w, h), 0, 0);
      ctx.restore();
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

    // Opponent silhouette (clarifies rally direction and serve origin)
    if (state.mode === MODES.RUN && state.opponent) {
      var oppY = requiredConfigNumber(state.opponent.y, "KR_Game.state.opponent.y", { min: 0, max: h });
      var oppScale = projectScale(oppY) * requiredConfigNumber(canvasCfg.opponentBodyScale, "KR_CONFIG.canvas.opponentBodyScale", { min: 0.2, max: 2 });
      var oppPaddleScale = requiredConfigNumber(canvasCfg.opponentPaddleScale, "KR_CONFIG.canvas.opponentPaddleScale", { min: 0.2, max: 2 });
      var oppXNorm = state.servingSide === "LEFT" ? (0.5 + requiredConfigNumber(canvasCfg.opponentXOffsetFrac, "KR_CONFIG.canvas.opponentXOffsetFrac", { min: 0, max: 0.4 })) : (0.5 - requiredConfigNumber(canvasCfg.opponentXOffsetFrac, "KR_CONFIG.canvas.opponentXOffsetFrac", { min: 0, max: 0.4 }));
      if (state.server === "PLAYER") oppXNorm = 1 - oppXNorm;
      var oppRhythm = Math.sin(n / 260 + oppXNorm * 3.2);
      var oppCenterX = projectX(oppXNorm * w, oppY) + oppRhythm * oppScale * 1.2;
      var oppBody = 19 * oppScale;
      var oppHead = 9 * oppScale;
      var oppHeadY = oppY - oppBody * 1.12 - oppRhythm * opponentIdleBobPx * 0.5;
      var oppShoulderY = oppY - oppBody * 0.62 - oppRhythm * opponentIdleBobPx;
      var oppReach = (state.opponent.serving ? 1 : 0.45) * opponentReachPx * oppScale;
      var oppPaddleDir = state.server === "OPPONENT" ? -1 : 1;
      var oppPaddleX = oppCenterX + oppPaddleDir * (oppBody * 1.05 + oppReach * (0.65 + 0.35 * Math.sin(n / 180)));
      var oppPaddleY = oppShoulderY - oppBody * 0.12 - oppRhythm * opponentIdleBobPx * 0.8;
      ctx.save();
      if (runAmount > 0.55 && colors.paddleGlow) {
        ctx.fillStyle = colors.paddleGlow;
        ctx.globalAlpha = 0.12 * runAmount;
        ctx.beginPath();
        ctx.roundRect(playerCenterX - bodyRadius * 0.92 - moveDir * bodyRadius * 0.34, shoulderY + bodyRadius * 0.05, bodyRadius * 1.84, bodyRadius * 1.62, bodyRadius * 0.38);
        ctx.fill();
      }
      ctx.fillStyle = getCanvasColor(colors, "playerShadow");
      ctx.globalAlpha = requiredConfigNumber(canvasCfg.opponentBaseAlpha, "KR_CONFIG.canvas.opponentBaseAlpha", { min: 0, max: 1 });
      ctx.beginPath();
      ctx.arc(oppCenterX, oppY + oppBody * 0.16, oppBody * 0.44, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = colors.opponentGhost || getCanvasColor(colors, "opponent");
      ctx.beginPath();
      ctx.roundRect(oppCenterX - oppBody * 0.62, oppShoulderY + oppBody * 0.06, oppBody * 1.24, oppBody * 1.05, oppBody * 0.3);
      ctx.fill();
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = getCanvasColor(colors, "playerShadow");
      ctx.beginPath();
      ctx.ellipse(oppCenterX, oppY + oppBody * 0.46, oppBody * 0.95, oppBody * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.86;
      ctx.fillStyle = getCanvasColor(colors, "opponent");
      ctx.beginPath();
      ctx.arc(oppCenterX, oppHeadY, oppHead, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(oppCenterX - oppBody * 0.46, oppShoulderY, oppBody * 0.92, oppBody * 1.18, oppBody * 0.34);
      ctx.fill();
      ctx.lineWidth = Math.max(2, 4.5 * oppScale);
      ctx.strokeStyle = getCanvasColor(colors, "opponent");
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(oppCenterX, oppShoulderY + oppBody * 0.24);
      ctx.lineTo(oppCenterX - oppPaddleDir * oppBody * 0.42, oppShoulderY + oppBody * 0.72);
      ctx.moveTo(oppCenterX, oppShoulderY + oppBody * 0.24);
      ctx.lineTo(oppCenterX + oppPaddleDir * oppBody * 0.32, oppShoulderY + oppBody * 0.7);
      ctx.stroke();
      ctx.strokeStyle = getCanvasColor(colors, "opponentPaddle");
      ctx.lineWidth = Math.max(2, 5 * oppScale * oppPaddleScale);
      ctx.beginPath();
      ctx.moveTo(oppCenterX + oppBody * 0.12 * oppPaddleDir, oppShoulderY + oppBody * 0.22);
      ctx.lineTo(oppPaddleX, oppPaddleY);
      ctx.stroke();
      ctx.restore();
    }

    // Player (mobile-first lateral placement + contextual forward step)
    if (colors.paddle && state.player) {
      var playerCfg = this.config?.game?.player;
      if (!playerCfg) throw new Error("KR_CONFIG.game.player missing for canvas render");
      var playerBaseY = requiredConfigNumber(state.player.baseY, "KR_Game.state.player.baseY", { min: 0, max: h });
      var playerForwardY = requiredConfigNumber(state.player.forwardY, "KR_Game.state.player.forwardY", { min: 0, max: h });
      var playerY = state.player.steppingForward ? playerForwardY : playerBaseY;
      if (!state.player.steppingForward && !state.player.swinging) playerY -= Math.sin(n / 280) * idleBobPx;
      var playerCenterX = projectX(requiredConfigNumber(state.player.x, "KR_Game.state.player.x", { min: 0, max: w }), playerY);
      var playerScale = projectScale(playerY);
      var bodyRadius = requiredConfigNumber(playerCfg.bodyRadiusPx, "KR_CONFIG.game.player.bodyRadiusPx", { min: 1 }) * playerScale;
      var headRadius = requiredConfigNumber(playerCfg.headRadiusPx, "KR_CONFIG.game.player.headRadiusPx", { min: 1 }) * playerScale;
      var paddleLength = requiredConfigNumber(playerCfg.paddleLengthPx, "KR_CONFIG.game.player.paddleLengthPx", { min: 1 }) * playerScale;
      var paddleThickness = requiredConfigNumber(playerCfg.paddleThicknessPx, "KR_CONFIG.game.player.paddleThicknessPx", { min: 1 }) * playerScale;
      var lean = requiredConfigNumber(playerCfg.lateralLeanPx, "KR_CONFIG.game.player.lateralLeanPx", { min: 0 }) * playerScale;
      var bodyY = playerY - bodyRadius * 0.2;
      var shoulderY = bodyY - bodyRadius * 0.68;
      var headY = shoulderY - headRadius * 1.18;
      var paddleDir = 0;
      if (Number.isFinite(Number(state.player.targetX))) {
        if (state.player.targetX < state.player.x - 4) paddleDir = -1;
        else if (state.player.targetX > state.player.x + 4) paddleDir = 1;
      }
      var moveDir = paddleDir;
      var moveDelta = Number.isFinite(Number(state.player.targetX)) ? Math.abs(state.player.targetX - state.player.x) : 0;
      var runAmount = Math.max(0, Math.min(1, moveDelta / Math.max(24, bodyRadius * 0.95)));
      var stepPhase = Math.sin(n / 105 + state.player.x * 0.02);
      if (runAmount > 0) playerY -= stepPhase * playerRunBobPx * runAmount;
      var torsoTilt = moveDir * (bodyRadius * 0.12 + playerTiltMaxPx * 0.04 * runAmount);
      var swingBoost = state.player.swinging ? 1 : 0;
      var paddleAnchorX = playerCenterX + torsoTilt + moveDir * lean * 0.28;
      var paddleAnchorY = shoulderY + bodyRadius * 0.34;
      var paddleTipX = paddleAnchorX + (moveDir === 0 ? paddleLength * 0.55 : moveDir * paddleLength * (0.95 + swingBoost * 0.25)) + moveDir * playerRunSwingPx * runAmount;
      var paddleTipY = paddleAnchorY - bodyRadius * (0.18 + swingBoost * 0.1) - Math.max(0, stepPhase) * playerRunSwingPx * 0.14 * runAmount;

      ctx.save();
      if (runAmount > 0.55 && colors.paddleGlow) {
        ctx.fillStyle = colors.paddleGlow;
        ctx.globalAlpha = 0.12 * runAmount;
        ctx.beginPath();
        ctx.roundRect(playerCenterX - bodyRadius * 0.92 - moveDir * bodyRadius * 0.34, shoulderY + bodyRadius * 0.05, bodyRadius * 1.84, bodyRadius * 1.62, bodyRadius * 0.38);
        ctx.fill();
      }
      ctx.fillStyle = getCanvasColor(colors, "playerShadow");
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.ellipse(playerCenterX, playerY + bodyRadius * 1.32, bodyRadius * 1.55, bodyRadius * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();

      if (colors.paddleGlow) {
        ctx.fillStyle = colors.paddleGlow;
        ctx.globalAlpha = state.player.swinging ? 0.26 : 0.14;
        ctx.beginPath();
        ctx.ellipse(playerCenterX, bodyY, bodyRadius * 1.9, bodyRadius * 1.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 0.98;
      ctx.fillStyle = colors.paddle;
      ctx.beginPath();
      ctx.arc(playerCenterX, headY, headRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.roundRect(playerCenterX - bodyRadius * 0.7 + torsoTilt, shoulderY, bodyRadius * 1.4, bodyRadius * 1.9, bodyRadius * 0.45);
      ctx.fill();

      ctx.lineWidth = Math.max(2, paddleThickness * 0.74);
      ctx.strokeStyle = colors.paddle;
      ctx.lineCap = "round";
      var legSwing = stepPhase * bodyRadius * 0.24 * runAmount;
      ctx.beginPath();
      ctx.moveTo(playerCenterX + torsoTilt, shoulderY + bodyRadius * 0.28);
      ctx.lineTo(playerCenterX + moveDir * bodyRadius * 0.5, bodyY + bodyRadius * 0.18 - stepPhase * bodyRadius * 0.06);
      ctx.moveTo(playerCenterX + torsoTilt * 0.5, bodyY + bodyRadius * 0.38);
      ctx.lineTo(playerCenterX - moveDir * bodyRadius * 0.44 - legSwing, playerY + bodyRadius * 1.14);
      ctx.moveTo(playerCenterX + torsoTilt * 0.2, bodyY + bodyRadius * 0.38);
      ctx.lineTo(playerCenterX + moveDir * bodyRadius * 0.56 + legSwing, playerY + bodyRadius * 1.08);
      ctx.stroke();

      ctx.lineWidth = paddleThickness;
      ctx.strokeStyle = colors.paddleAccent || colors.paddle;
      ctx.beginPath();
      ctx.moveTo(paddleAnchorX, paddleAnchorY);
      ctx.lineTo(paddleTipX, paddleTipY);
      ctx.stroke();

      if (state.player.swinging) {
        ctx.strokeStyle = getCanvasColor(colors, "swingSlash");
        ctx.globalAlpha = swingSlashAlpha;
        ctx.lineWidth = Math.max(swingSlashWidthPx, paddleThickness * 1.1);
        ctx.beginPath();
        ctx.arc(paddleAnchorX, paddleAnchorY, paddleLength * 0.72, -0.95, 0.15, false);
        ctx.stroke();
        ctx.globalAlpha = Math.max(0.12, swingSlashAlpha * 0.65);
        ctx.lineWidth = Math.max(2, swingSlashWidthPx * 0.55);
        ctx.beginPath();
        ctx.arc(paddleAnchorX + moveDir * bodyRadius * 0.08, paddleAnchorY - bodyRadius * 0.06, paddleLength * 0.56, -1.05, -0.02, false);
        ctx.stroke();
        ctx.globalAlpha = 0.98;
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  };


  // ============================================
  // HUD rendering (DOM overlay on canvas)
  // ============================================
  UI.prototype._triggerHudClass = function (node, className) {
    if (!node || !className) return;
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  };

  UI.prototype._getClassicPressureLabel = function (state) {
    var cw = requiredObject(this.wording && this.wording.classic, "KR_WORDING.classic");
    var classicCfg = requiredObject(this.config && this.config.classic, "KR_CONFIG.classic");
    var player = requiredFiniteNumber(state.playerScore, "state.playerScore");
    var opponent = requiredFiniteNumber(state.opponentScore, "state.opponentScore");
    var target = requiredConfigNumber(classicCfg.targetScore, "KR_CONFIG.classic.targetScore", { min: 1, integer: true });
    var winBy = requiredConfigNumber(classicCfg.winBy, "KR_CONFIG.classic.winBy", { min: 1, integer: true });
    var playerThreat = (player + 1 >= target) && ((player + 1) - opponent >= winBy);
    var opponentThreat = (opponent + 1 >= target) && ((opponent + 1) - player >= winBy);
    var deuceLike = player >= (target - 1) && opponent >= (target - 1) && Math.abs(player - opponent) < winBy;
    if (playerThreat) return txt(cw.gamePointYou);
    if (opponentThreat) return txt(cw.gamePointOpponent);
    if (deuceLike) return txt(cw.deuceTension);
    return "";
  };

  UI.prototype._getClassicMomentLevel = function (result, state) {
    var classicCfg = requiredObject(this.config && this.config.classic, "KR_CONFIG.classic");
    var target = requiredConfigNumber(classicCfg.targetScore, "KR_CONFIG.classic.targetScore", { min: 1, integer: true });
    var winBy = requiredConfigNumber(classicCfg.winBy, "KR_CONFIG.classic.winBy", { min: 1, integer: true });
    if (state && state.done) return "decisive";
    var playerScore = state && Number.isFinite(Number(state.playerScore)) ? Number(state.playerScore) : 0;
    var opponentScore = state && Number.isFinite(Number(state.opponentScore)) ? Number(state.opponentScore) : 0;
    var prePlayer = playerScore;
    var preOpponent = opponentScore;
    if (result && result.pointAwarded === true) {
      if (result.winner === "PLAYER") prePlayer = Math.max(0, playerScore - 1);
      else if (result.winner === "OPPONENT") preOpponent = Math.max(0, opponentScore - 1);
    }
    var playerThreatBefore = (prePlayer + 1 >= target) && ((prePlayer + 1) - preOpponent >= winBy);
    var opponentThreatBefore = (preOpponent + 1 >= target) && ((preOpponent + 1) - prePlayer >= winBy);
    if (playerThreatBefore || opponentThreatBefore) return "major";
    var deuceLike = playerScore >= (target - 1) && opponentScore >= (target - 1) && Math.abs(playerScore - opponentScore) < winBy;
    if (deuceLike) return "major";
    return "normal";
  };

  UI.prototype._getClassicPointOverlay = function (result, state) {
    var cw = requiredObject(this.wording && this.wording.classic, "KR_WORDING.classic");
    var ux = requiredObject(this.config && this.config.uxFlow, "KR_CONFIG.uxFlow");
    var level = this._getClassicMomentLevel(result, state);
    var classicCfg = requiredObject(this.config && this.config.classic, "KR_CONFIG.classic");
    var target = requiredConfigNumber(classicCfg.targetScore, "KR_CONFIG.classic.targetScore", { min: 1, integer: true });
    var winBy = requiredConfigNumber(classicCfg.winBy, "KR_CONFIG.classic.winBy", { min: 1, integer: true });
    var playerScore = state && Number.isFinite(Number(state.playerScore)) ? Number(state.playerScore) : 0;
    var opponentScore = state && Number.isFinite(Number(state.opponentScore)) ? Number(state.opponentScore) : 0;
    var prePlayer = playerScore;
    var preOpponent = opponentScore;
    if (result && result.pointAwarded === true) {
      if (result.winner === "PLAYER") prePlayer = Math.max(0, playerScore - 1);
      else if (result.winner === "OPPONENT") preOpponent = Math.max(0, opponentScore - 1);
    }
    var playerThreatBefore = (prePlayer + 1 >= target) && ((prePlayer + 1) - preOpponent >= winBy);
    var opponentThreatBefore = (preOpponent + 1 >= target) && ((preOpponent + 1) - prePlayer >= winBy);
    if (state && state.done && state.endReason === "WIN") return txt(cw.winOverlay);
    if (result && result.sideOut === true && result.winner === "PLAYER" && opponentThreatBefore) return txt(cw.pressureSave);
    if (result && result.sideOut === true && result.winner === "PLAYER") return level === "major" ? txt(cw.clutchBreak) : txt(cw.breakServe);
    if (result && result.pointAwarded === true && result.winner === "PLAYER" && playerThreatBefore) return txt(cw.pressureWin);
    var rallyLength = result && Number.isFinite(Number(result.rallyLength)) ? Number(result.rallyLength) : 0;
    var longRallyMinHits = requiredConfigNumber(ux.classicLongRallyMinHits, "KR_CONFIG.uxFlow.classicLongRallyMinHits", { min: 1, integer: true });
    if (rallyLength >= longRallyMinHits && level !== "decisive") return txt(cw.longRallyPoint);
    if (result && result.pointAwarded === true && result.serverBefore === "PLAYER") return level === "major" ? txt(cw.clutchHold) : txt(cw.holdServe);
    return txt(cw.cleanPoint);
  };

  UI.prototype._ensureHudLayout = function (layout) {
    var hudEl = el("kr-hud");
    if (!hudEl) return null;
    if (this._runtime.hud.layout === layout) return hudEl;

    if (layout === "classic") {
      hudEl.innerHTML =
        '<div class="kr-hud-row kr-hud-row--classic">' +
          '<div class="kr-hud-classic-meta">' +
            '<div id="kr-hud-server" class="kr-hud-server"></div>' +
            '<div id="kr-hud-side" class="kr-hud-side"></div>' +
            '<div id="kr-hud-pressure" class="kr-hud-pressure" hidden></div>' +
            '<div class="kr-hud-progress" aria-hidden="true">' +
              '<div id="kr-hud-progress-player" class="kr-hud-progress-fill kr-hud-progress-fill--player"></div>' +
              '<div id="kr-hud-progress-opponent" class="kr-hud-progress-fill kr-hud-progress-fill--opponent"></div>' +
            '</div>' +
          '</div>' +
          '<div id="kr-hud-score" class="kr-hud-score kr-hud-score--classic"></div>' +
        '</div>' +
        '<div id="kr-hud-callout" class="kr-hud-callout" hidden></div>';
    } else if (layout === "classic-loading") {
      hudEl.innerHTML =
        '<div class="kr-hud-row kr-hud-row--classic">' +
          '<div id="kr-hud-loading" class="kr-hud-server"></div>' +
        '</div>';
    } else if (layout === "sprint") {
      hudEl.innerHTML =
        '<div class="kr-hud-row kr-hud-row--sprint">' +
          '<div id="kr-hud-timer" class="kr-hud-timer"></div>' +
          '<div id="kr-hud-score" class="kr-hud-score kr-hud-score--rush"></div>' +
        '</div>';
    } else {
      hudEl.innerHTML = "";
    }

    this._runtime.hud.layout = layout;
    this._runtime.hud.signature = "";
    return hudEl;
  };

  UI.prototype._renderHUD = function (state) {
    var hudState = this._runtime.hud;
    var hudEl = el("kr-hud");
    if (!hudEl) return;

    if (state.mode === MODES.RUN && Number.isFinite(Number(state.playerScore)) && Number.isFinite(Number(state.opponentScore))) {
      var cw = requiredObject(this.wording && this.wording.classic, "KR_WORDING.classic");
      var classicCfg = requiredObject(this.config && this.config.classic, "KR_CONFIG.classic");
      var serverLabel = state.server === "PLAYER" ? txt(cw.serverYou) : txt(cw.serverOpponent);
      var sideWord = state.servingSide === "LEFT" ? txt(cw.sideLeft) : txt(cw.sideRight);
      var sideLabel = fillTemplate(txt(cw.sideTemplate), { side: sideWord });
      var scoreLabel = fillTemplate(txt(cw.scoreTemplate), { player: state.playerScore, opponent: state.opponentScore });
      var calloutText = "";
      if (state.lastCallout === "SIDE_OUT") calloutText = txt(cw.sideOut);
      else if (state.lastCallout === "POINT") calloutText = txt(cw.pointWon);
      var pressureText = this._getClassicPressureLabel(state);
      var targetScore = requiredConfigNumber(classicCfg.targetScore, "KR_CONFIG.classic.targetScore", { min: 1, integer: true });
      var progressDenom = Math.max(targetScore, state.playerScore, state.opponentScore, targetScore + requiredConfigNumber(classicCfg.winBy, "KR_CONFIG.classic.winBy", { min: 1, integer: true }) - 1);
      var playerPct = Math.max(0, Math.min(100, (state.playerScore / progressDenom) * 100));
      var opponentPct = Math.max(0, Math.min(100, (state.opponentScore / progressDenom) * 100));
      var signature = ["classic", serverLabel, sideLabel, scoreLabel, calloutText, pressureText, playerPct.toFixed(2), opponentPct.toFixed(2)].join("|");
      if (hudState.signature === signature && hudState.layout === "classic") return;

      this._ensureHudLayout("classic");
      var serverNode = el("kr-hud-server");
      var sideNode = el("kr-hud-side");
      var scoreNode = el("kr-hud-score");
      var calloutNode = el("kr-hud-callout");
      var pressureNode = el("kr-hud-pressure");
      var playerProgressNode = el("kr-hud-progress-player");
      var opponentProgressNode = el("kr-hud-progress-opponent");
      if (!serverNode || !sideNode || !scoreNode || !calloutNode || !pressureNode || !playerProgressNode || !opponentProgressNode) throw new Error("KR_UI: classic HUD nodes are required");

      if (serverNode.textContent !== serverLabel) serverNode.textContent = serverLabel;
      if (sideNode.textContent !== sideLabel) sideNode.textContent = sideLabel;
      if (scoreNode.textContent !== scoreLabel) scoreNode.textContent = scoreLabel;
      playerProgressNode.style.width = playerPct.toFixed(2) + "%";
      opponentProgressNode.style.width = opponentPct.toFixed(2) + "%";

      if (hudState.playerScore !== null && (hudState.playerScore !== state.playerScore || hudState.opponentScore !== state.opponentScore)) {
        this._triggerHudClass(scoreNode, "kr-hud-score--pulse");
        if (state.playerScore > hudState.playerScore) this._triggerHudClass(scoreNode, "kr-hud-score--gain");
        else if (state.opponentScore > hudState.opponentScore) this._triggerHudClass(scoreNode, "kr-hud-score--warn");
      }

      if (pressureText) {
        if (pressureNode.textContent !== pressureText) pressureNode.textContent = pressureText;
        pressureNode.hidden = false;
        if (hudState.pressureText !== pressureText) this._triggerHudClass(pressureNode, "kr-hud-pressure--enter");
      } else {
        pressureNode.hidden = true;
        pressureNode.textContent = "";
      }

      if (calloutText) {
        if (calloutNode.textContent !== calloutText) calloutNode.textContent = calloutText;
        calloutNode.hidden = false;
        if (hudState.calloutText !== calloutText) this._triggerHudClass(calloutNode, "kr-hud-callout--enter");
      } else {
        calloutNode.hidden = true;
        calloutNode.textContent = "";
      }

      hudState.playerScore = state.playerScore;
      hudState.opponentScore = state.opponentScore;
      hudState.calloutText = calloutText;
      hudState.pressureText = pressureText;
      hudState.signature = signature;
      return;
    }

    if (state.mode === MODES.RUN) {
      var loadingText = requiredConfigString(this.wording && this.wording.system && this.wording.system.classicLoading, "KR_WORDING.system.classicLoading");
      var loadingSignature = ["classic-loading", loadingText].join("|");
      if (hudState.signature === loadingSignature && hudState.layout === "classic-loading") return;
      this._ensureHudLayout("classic-loading");
      var loadingNode = el("kr-hud-loading");
      if (!loadingNode) throw new Error("KR_UI: classic loading HUD node is required");
      if (loadingNode.textContent !== loadingText) loadingNode.textContent = loadingText;
      hudState.signature = loadingSignature;
      hudState.calloutText = "";
      return;
    }

    if (state.mode === MODES.SPRINT) {
      var remaining = Math.max(0, Math.ceil((state.sprintRemainingMs || 0) / 1000));
      var sprintWording = requiredObject(this.wording && this.wording.sprint, "KR_WORDING.sprint");
      var timerLabel = requiredWordingString(sprintWording.timerLabel, "KR_WORDING.sprint.timerLabel", { remaining: remaining });
      var sprintScore = requiredFiniteNumber(state.score, "state.score");
      var sprintSignature = ["sprint", timerLabel, sprintScore].join("|");
      if (hudState.signature === sprintSignature && hudState.layout === "sprint") return;

      this._ensureHudLayout("sprint");
      var timerNode = el("kr-hud-timer");
      var rushScoreNode = el("kr-hud-score");
      if (!timerNode || !rushScoreNode) throw new Error("KR_UI: sprint HUD nodes are required");

      if (timerNode.textContent !== timerLabel) timerNode.textContent = timerLabel;
      if (String(rushScoreNode.textContent) !== String(sprintScore)) rushScoreNode.textContent = String(sprintScore);

      if (hudState.sprintScore !== null && hudState.sprintScore !== sprintScore) {
        this._triggerHudClass(rushScoreNode, "kr-hud-score--pulse");
        if (sprintScore > hudState.sprintScore) this._triggerHudClass(rushScoreNode, "kr-hud-score--gain");
      }
      if (hudState.sprintRemaining !== null && hudState.sprintRemaining !== remaining) {
        this._triggerHudClass(timerNode, "kr-hud-timer--tick");
      }
      timerNode.classList.toggle("kr-hud-timer--urgent", remaining <= 10);

      hudState.sprintScore = sprintScore;
      hudState.sprintRemaining = remaining;
      hudState.signature = sprintSignature;
      return;
    }

    if (hudState.layout !== "") {
      hudEl.innerHTML = "";
      hudState.layout = "";
      hudState.signature = "";
    }
  };

  // HUD pulse scheduling: after a delta display (+1, -1, -2s), schedule cleanup render
  UI.prototype._scheduleHudPulseCleanup = function () {
    if (this._runtime.hudPulseCleanupTimerId) clearTimeout(this._runtime.hudPulseCleanupTimerId);
    var ms = requiredConfigNumber(this.config?.ui?.gameplayPulseMs, "KR_CONFIG.ui.gameplayPulseMs", { min: 1, integer: true });
    var self = this;
    this._runtime.hudPulseCleanupTimerId = setTimeout(function () {
      self._runtime.hudPulseCleanupTimerId = null;
      // HUD updates are incremental and re-checked by the main loop
    }, ms);
  };



  UI.prototype._clearTouchMoveHold = function () {
    if (this._runtime.touchHoldTimerId) clearInterval(this._runtime.touchHoldTimerId);
    this._runtime.touchHoldTimerId = null;
    this._runtime.touchHoldDirection = 0;
  };

  UI.prototype._startTouchMoveHold = function (direction) {
    this._clearTouchMoveHold();
    var controls = this.config && this.config.controls;
    if (!controls || controls.touchButtonsEnabled !== true) return;
    var tickMs = requiredConfigNumber(controls.touchNudgeMs, "KR_CONFIG.controls.touchNudgeMs", { min: 1, integer: true });
    var self = this;
    this._runtime.touchHoldDirection = direction < 0 ? -1 : 1;
    if (this.game && typeof this.game.nudgePlayer === "function") this.game.nudgePlayer(this._runtime.touchHoldDirection, tickMs);
    this._runtime.touchHoldTimerId = setInterval(function () {
      if (self.state !== STATES.PLAYING || !self.game || typeof self.game.nudgePlayer !== "function") return;
      self.game.nudgePlayer(self._runtime.touchHoldDirection, tickMs);
    }, tickMs);
  };

  UI.prototype._handleTouchControlPress = function (action, e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (e && e.currentTarget && e.currentTarget.classList) e.currentTarget.classList.add("is-pressed");
    if (this.state !== STATES.PLAYING) return;
    if (action === "left") {
      this._startTouchMoveHold(-1);
      return;
    }
    if (action === "right") {
      this._startTouchMoveHold(1);
      return;
    }
    if (action === "hit") {
      var state = this.game.getState();
      var playerX = state && state.player && Number.isFinite(Number(state.player.x)) ? state.player.x : null;
      var playerY = state && state.player && Number.isFinite(Number(state.player.baseY)) ? state.player.baseY : null;
      var result = this.game.tap(playerX, playerY);
      if (result) this._applyTapResult(result, playerX, playerY);
    }
  };

  UI.prototype._handleTouchControlRelease = function (e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (e && e.currentTarget && e.currentTarget.classList) e.currentTarget.classList.remove("is-pressed");
    this._clearTouchMoveHold();
  };

  // ============================================
  // Gameplay input
  // ============================================

  UI.prototype._bindGameplayControls = function () {
    if (this._runtime.gameplayControlsBound) return;
    var self = this;
    this._boundGameplayKeydown = function (e) { self._handleGameplayKeydown(e); };
    document.addEventListener("keydown", this._boundGameplayKeydown);
    this._runtime.gameplayControlsBound = true;
  };

  UI.prototype._unbindGameplayControls = function () {
    this._clearTouchMoveHold();
    if (!this._runtime.gameplayControlsBound) return;
    if (this._boundGameplayKeydown) document.removeEventListener("keydown", this._boundGameplayKeydown);
    this._boundGameplayKeydown = null;
    this._runtime.gameplayControlsBound = false;
  };

  UI.prototype._handleGameplayKeydown = function (e) {
    if (this.state !== STATES.PLAYING) return;
    var controls = this.config && this.config.controls;
    if (!controls || controls.keyboardEnabled !== true) return;
    var key = String(e.key || "");
    var leftKeys = Array.isArray(controls.leftKeys) ? controls.leftKeys : [];
    var rightKeys = Array.isArray(controls.rightKeys) ? controls.rightKeys : [];
    var hitKeys = Array.isArray(controls.hitKeys) ? controls.hitKeys : [];
    var keyNudgeMs = requiredConfigNumber(controls.touchNudgeMs, "KR_CONFIG.controls.touchNudgeMs", { min: 1, integer: true });
    if (leftKeys.indexOf(key) !== -1) {
      e.preventDefault();
      if (this.game && typeof this.game.nudgePlayer === "function") this.game.nudgePlayer(-1, keyNudgeMs);
      return;
    }
    if (rightKeys.indexOf(key) !== -1) {
      e.preventDefault();
      if (this.game && typeof this.game.nudgePlayer === "function") this.game.nudgePlayer(1, keyNudgeMs);
      return;
    }
    if (hitKeys.indexOf(key) !== -1) {
      e.preventDefault();
      var state = this.game.getState();
      var playerX = state && state.player && Number.isFinite(Number(state.player.x)) ? state.player.x : null;
      var playerY = state && state.player && Number.isFinite(Number(state.player.baseY)) ? state.player.baseY : null;
      var result = this.game.tap(playerX, playerY);
      if (result) this._applyTapResult(result, playerX, playerY);
    }
  };

  UI.prototype._handleCanvasPointerMove = function (e) {
    if (this.state !== STATES.PLAYING) return;
    var controls = this.config && this.config.controls;
    if (!controls || controls.pointerMoveEnabled !== true) return;
    var canvas = this._canvas;
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var rawX = (e.clientX || 0) - rect.left;
    var scaleX = canvas.width / rect.width;
    if (this.game && typeof this.game.setPlayerTarget === "function") this.game.setPlayerTarget(rawX * scaleX);
  };

  UI.prototype._applyTapResult = function (result, inputX, inputY) {
    if (!result) return;
    if (window.KR_Audio && typeof window.KR_Audio.unlock === "function") window.KR_Audio.unlock();

    var juice = this._runtime.juice;
    var n = performance.now();
    var canvas = this._canvas;
    var fallbackX = canvas ? canvas.width / 2 : 0;
    var fallbackY = canvas ? canvas.height / 2 : 0;

    if (result.hit) {
      this._haptic("hit");
      this._playSound("hit");
      juice.flashType = "hit";
      juice.flashUntil = n + requiredConfigNumber(this.config?.juice?.hitFlashMs, "KR_CONFIG.juice.hitFlashMs", { min: 1, integer: true });
      juice.flashX = result.ball ? result.ball.x : (Number.isFinite(Number(inputX)) ? inputX : fallbackX);
      juice.flashY = result.ball ? result.ball.y : (Number.isFinite(Number(inputY)) ? inputY : fallbackY);
      if (result.pointAwarded) {
        if (!juice.scorePopups) juice.scorePopups = [];
        juice.scorePopups.push({
          x: result.ball ? result.ball.x : (Number.isFinite(Number(inputX)) ? inputX : fallbackX),
          y: result.ball ? result.ball.y : (Number.isFinite(Number(inputY)) ? inputY : fallbackY),
          at: n
        });
      }
      if (this._runtime.runMode === MODES.RUN) {
        var currentState = (this.game && typeof this.game.getState === "function") ? (this.game.getState() || null) : null;
        var pointOverlay = this._getClassicPointOverlay(result, currentState);
        var momentLevel = this._getClassicMomentLevel(result, currentState);
        var overlayVariant = momentLevel === "decisive" ? "success" : (momentLevel === "major" ? "warning" : (result.winner === "PLAYER" ? "success" : "info"));
        if (momentLevel !== "normal") this._haptic("hit");
        if (result.sideOut) {
          var sideOutMs = requiredConfigNumber(this.config?.classic?.sideOutIndicatorMs, "KR_CONFIG.classic.sideOutIndicatorMs", { min: 1, integer: true });
          showGameplayOverlay(pointOverlay || txt(requiredObject(this.wording && this.wording.classic, "KR_WORDING.classic").sideOut), { durationMs: momentLevel === "normal" ? sideOutMs : Math.round(sideOutMs * 1.2), variant: overlayVariant });
        } else if (result.pointAwarded) {
          var pointMs = requiredConfigNumber(this.config?.classic?.serveIndicatorMs, "KR_CONFIG.classic.serveIndicatorMs", { min: 1, integer: true });
          if (pointOverlay) showGameplayOverlay(pointOverlay, { durationMs: momentLevel === "normal" ? pointMs : Math.round(pointMs * 1.25), variant: overlayVariant });
        }
      }
    }
    if (result.fault) {
      this._haptic("fault");
      this._playSound("fault");
      if (result.faultType === "DOUBLE_BOUNCE") {
        var dblMsg = String(this.config?.ui?.doubleBounceOverlay || "").trim();
        if (dblMsg) showGameplayOverlay(dblMsg, { durationMs: requiredConfigNumber(this.config?.ui?.lifeLostOverlayMs, "KR_CONFIG.ui.lifeLostOverlayMs", { min: 1, integer: true }), variant: "fault" });
      }
      juice.flashType = "fault";
      juice.flashUntil = n + requiredConfigNumber(this.config?.juice?.faultFlashMs, "KR_CONFIG.juice.faultFlashMs", { min: 1, integer: true });
      juice.flashX = result.ball ? result.ball.x : (Number.isFinite(Number(inputX)) ? inputX : fallbackX);
      juice.flashY = result.ball ? result.ball.y : (Number.isFinite(Number(inputY)) ? inputY : fallbackY);
      juice.shakeUntil = n + requiredConfigNumber(this.config?.juice?.faultShakeMs, "KR_CONFIG.juice.faultShakeMs", { min: 1, integer: true });
      juice.shakeIntensity = requiredConfigNumber(this.config?.juice?.faultShakeIntensity, "KR_CONFIG.juice.faultShakeIntensity", { min: 0 });
      if (this._runtime.runMode === MODES.SPRINT) {
        juice.sprintPenaltyUntil = n + requiredConfigNumber(this.config?.juice?.sprintPenaltyMs, "KR_CONFIG.juice.sprintPenaltyMs", { min: 1, integer: true });
      }
    }
    this._handleMicroFeedback(result);
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
    var inputX = rawX * scaleX;
    var inputY = rawY * scaleY;
    if (this.game && typeof this.game.setPlayerTarget === "function") this.game.setPlayerTarget(inputX);
    var result = this.game.tap(inputX, inputY);
    this._applyTapResult(result, inputX, inputY);
  };


  // ============================================
  // Audio & Haptic
  // ============================================
  UI.prototype._haptic = function (type) {
    if (this._store("getHapticsEnabled") === false) return;
    var cfg = this.config.haptic || {};
    if (!cfg.enabled) return;
    var pattern = (type === "hit") ? cfg.hitPattern : cfg.faultPattern;
    if (!pattern || !Array.isArray(pattern)) return;
    try { navigator.vibrate(pattern); } catch (_) { }
  };

  UI.prototype._playSound = function (type, opts) {
    if (this._store("getSoundEnabled") === false) return;
    var cfg = this.config.audio || {};
    if (!cfg.enabled) return;
    if (!window.KR_Audio || typeof window.KR_Audio.play !== "function") return;

    var volMap = {
      hit: cfg.hitVolume,
      fault: cfg.faultVolume,
      bounce: cfg.bounceVolume,
      miss: cfg.faultVolume,
      gameOver: cfg.faultVolume,
      sprintBuzzer: cfg.hitVolume,
      milestone: cfg.hitVolume,
      newBest: cfg.hitVolume
    };

    // V2: streak pitch shift (hit only) — pitch rises with streak
    var pitch = 1;
    if (type === "hit" && this._runtime && this._runtime.microFeedback) {
      var streak = this._runtime.microFeedback.hitStreak || 0;
      // Subtle: +2% per streak hit, cap at +30% (15 streak)
      pitch = 1 + Math.min(streak * 0.02, 0.3);
    }

    window.KR_Audio.play(type, requiredConfigNumber(volMap[type], "KR_CONFIG.audio volume for " + type, { min: 0, max: 1 }), pitch);
  };


  // ============================================
  // MicroFeedback (arcade-adapted from WT microPics)
  // Hit streaks + Kitchen master + Close call (last life)
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
    var totalScore = gameState.score || 0;
    var cooldown = requiredConfigNumber(mfCfg.cooldownScoreDelta, "KR_CONFIG.microFeedback.cooldownScoreDelta", { min: 0, integer: true });
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
      if ((totalScore - mf.lastOverlayAtHit) < cooldown) return false;
      showGameplayOverlay(m, { durationMs: timing.durationMs, variant: variant == null ? "info" : requiredConfigString(variant, "showMicro.variant") });
      mf.lastOverlayAtHit = totalScore;
      return true;
    }

    function setEndHighlight(msg, variant, priority) {
      var m = String(msg || "").trim();
      if (!m) return;
      var p = Number(priority);
      if (Number.isFinite(p) && p > (mf.endHighlightPriority || -1)) {
        mf.endHighlight = m;
        mf.endHighlightVariant = variant == null ? "" : requiredConfigString(variant, "setEndHighlight.variant");
        mf.endHighlightPriority = p;
      }
    }

    if (result.hit) {
      mf.hitStreak++;
      mf.maxHitStreak = Math.max(mf.maxHitStreak, mf.hitStreak);

      var s = mf.hitStreak;
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

      // Kitchen master: hit a Kitchen ball post-bounce (one-shot per run)
      if (result.ball && result.ball.inKitchen && !mf.kitchenMasterShown) {
        var kmMsg = String(mfw.kitchenMaster || "").trim();
        if (kmMsg) {
          // Only show if no streak tier was just shown (avoid double overlays)
          if (mf.lastOverlayAtHit < totalScore) {
            if (tryShowOverlay(kmMsg, "success")) mf.kitchenMasterShown = true;
          }
          setEndHighlight(kmMsg, "success", 50);
        }
      }

    } else if (result.fault) {
      // Streak broken on fault
      mf.hitStreak = 0;
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
        mf.lastOverlayAtHit = totalScore;
      }

      // Close call / Last life warning (one-shot per run)
      if (gameState.lives === 1 && !mf.lastLifeShown) {
        mf.lastLifeShown = true;
        var llMsg = String(mfw.lastLife || "").trim();
        if (llMsg) {
          showGameplayOverlay(llMsg, { durationMs: requiredConfigNumber(cfg?.ui?.lifeLostOverlayMs, "KR_CONFIG.ui.lifeLostOverlayMs", { min: 1, integer: true }), variant: "danger" });
          mf.lastOverlayAtHit = totalScore;
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
    var bestScore = 0;

    if (mode === MODES.SPRINT) {
      var sr = this.storage
        ? (this.storage.recordSprintComplete(result.score) || {}) : {};
      newBest = !!(sr.newBest);
      bestScore = Number(sr.bestScore || 0);
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
        bestStreak: (this._runtime.microFeedback) ? this._runtime.microFeedback.maxHitStreak : 0,
        isDaily: !!this._runtime.isDaily,
        playerScore: result.playerScore || 0,
        opponentScore: result.opponentScore || 0,
        server: result.server || null
      };
      var rr = this.storage
        ? (this.storage.recordRunComplete(nextRunNumber, result.score, meta) || {}) : {};
      newBest = !!(rr.newBest);
      bestScore = Number(rr.bestScore || 0);
    }

    this._runtime.lastRun = {
      mode: mode,
      isDaily: !!this._runtime.isDaily,
      score: result.score,
      lives: result.lives,
      maxLives: result.maxLives,
      newBest: newBest,
      bestScore: bestScore,
      endReason: result.endReason,
      totalFaulted: result.totalFaulted || 0,
      totalMissed: result.totalMissed || 0,
      totalSpawned: result.totalSpawned || 0,
      elapsedMs: result.elapsedMs || 0,
      bestStreak: (this._runtime.microFeedback) ? this._runtime.microFeedback.maxHitStreak : 0,
      playerScore: result.playerScore || 0,
      opponentScore: result.opponentScore || 0,
      server: result.server || null
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
    var FREEZE_MS = requiredConfigNumber(this.config?.transitions?.freezeMs, "KR_CONFIG.transitions.freezeMs", { min: 1, integer: true });
    var FADE_MS = requiredConfigNumber(this.config?.transitions?.fadeMs, "KR_CONFIG.transitions.fadeMs", { min: 1, integer: true });
    var self = this;

    // Apply desaturation class during freeze
    if (this._canvas) {
      try { this._canvas.classList.add("kr-canvas--freeze"); } catch (_) { }
    }

    setTimeout(function () {
      // Remove desaturation
      if (self._canvas) {
        try { self._canvas.classList.remove("kr-canvas--freeze"); } catch (_) { }
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
      var offlineMsg = requiredWordingString(requiredObject(this.wording?.system, "KR_WORDING.system").offlinePayment, "KR_WORDING.system.offlinePayment");
      toastNow(this.config, offlineMsg);
      return;
    }
    var cfg = this.config;
    var url = getCheckoutUrl(cfg, priceKey);

    this._store("markCheckoutStarted", priceKey);
    var winRef = window.open(url, "_blank", "noopener");
    if (!winRef) throw new Error("KR_UI.checkout(): window.open blocked");
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
    var monthNames = requiredArray(requiredObject(window.KR_WORDING && window.KR_WORDING.system, "KR_WORDING.system").monthsShort, "KR_WORDING.system.monthsShort");
    return { month: requiredConfigString(monthNames[d.getMonth()], "KR_WORDING.system.monthsShort[" + d.getMonth() + "]"), day: d.getDate(), year: d.getFullYear() };
  }

  UI.prototype._generateShareCard = function () {
    var last = (this._runtime && this._runtime.lastRun) ? this._runtime.lastRun : {};
    var w = requiredObject(this.wording && this.wording.share, "KR_WORDING.share");
    var appName = requiredConfigString(requiredObject(this.config?.identity, "KR_CONFIG.identity").appName, "KR_CONFIG.identity.appName");
    var score = requiredConfigNumber(last.score == null ? 0 : last.score, "KR_UI._generateShareCard().lastRun.score", { min: 0, integer: true });
    var best = requiredConfigNumber(last.bestScore == null ? 0 : last.bestScore, "KR_UI._generateShareCard().lastRun.bestScore", { min: 0, integer: true });
    var isSprint = (last.mode === MODES.SPRINT);
    var isDaily = !!last.isDaily;
    var colors = getCanvasColors(this.config);

    var salt = requiredConfigString(requiredObject(this.config?.share, "KR_CONFIG.share").verificationSalt, "KR_CONFIG.share.verificationSalt");
    var hash = shareHash(score, last.mode == null ? MODES.RUN : last.mode, salt);

    var cardW = 600;
    var cardH = 340;

    var canvas = document.createElement("canvas");
    canvas.width = cardW;
    canvas.height = cardH;
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Background (court color)
    var bgGrad = ctx.createLinearGradient(0, 0, 0, cardH);
    bgGrad.addColorStop(0, getCanvasColor(colors, "appBgTop"));
    bgGrad.addColorStop(1, getCanvasColor(colors, "appBgBottom"));
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cardW, cardH);

    var courtY = cardH * 0.27;
    var kitchenY = cardH * 0.65;
    var courtGrad = ctx.createLinearGradient(0, courtY, 0, cardH);
    courtGrad.addColorStop(0, getCanvasColor(colors, "courtBgDark"));
    courtGrad.addColorStop(1, getCanvasColor(colors, "courtBg"));
    ctx.fillStyle = courtGrad;
    ctx.beginPath();
    ctx.moveTo(70, courtY);
    ctx.lineTo(cardW - 70, courtY);
    ctx.lineTo(cardW - 24, cardH);
    ctx.lineTo(24, cardH);
    ctx.closePath();
    ctx.fill();

    var kitchenGrad = ctx.createLinearGradient(0, kitchenY, 0, cardH);
    kitchenGrad.addColorStop(0, getCanvasColor(colors, "kitchenBgDark"));
    kitchenGrad.addColorStop(1, getCanvasColor(colors, "kitchenBg"));
    ctx.fillStyle = kitchenGrad;
    ctx.beginPath();
    ctx.moveTo(40, kitchenY);
    ctx.lineTo(cardW - 40, kitchenY);
    ctx.lineTo(cardW - 24, cardH);
    ctx.lineTo(24, cardH);
    ctx.closePath();
    ctx.fill();

    // Kitchen line
    ctx.strokeStyle = colors.kitchenLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(40, kitchenY);
    ctx.lineTo(cardW - 40, kitchenY);
    ctx.stroke();
    ctx.setLineDash([]);

    // App name
    ctx.fillStyle = "#f7fbff";
    ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(appName, cardW / 2, 24);

    // Mode / Daily label
    var modeLabel = "";
    if (isDaily) {
      modeLabel = requiredWordingString(w.cardDailyLabel, "KR_WORDING.share.cardDailyLabel");
      // Add date
      var dp = todayDateParts();
      var dateFmt = requiredWordingString(w.cardDateFormat, "KR_WORDING.share.cardDateFormat");
      if (dateFmt && modeLabel) {
        modeLabel += " — " + fillTemplate(dateFmt, dp);
      }
    } else if (isSprint) {
      modeLabel = requiredWordingString(w.cardSprintLabel, "KR_WORDING.share.cardSprintLabel");
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

    // Score label
    var scoreLabel = requiredWordingString(w.cardScoreLabel, "KR_WORDING.share.cardScoreLabel");
    if (scoreLabel) {
      ctx.font = "20px system-ui, -apple-system, sans-serif";
      ctx.globalAlpha = 0.8;
      ctx.fillText(scoreLabel, cardW / 2, cardH * 0.58);
      ctx.globalAlpha = 1;
    }

    // Best score line
    if (best > 0 && !isSprint) {
      var bestLabel = requiredWordingString(w.cardBestLabel, "KR_WORDING.share.cardBestLabel");
      if (bestLabel) {
        ctx.font = "16px system-ui, -apple-system, sans-serif";
        ctx.globalAlpha = 0.6;
        ctx.fillText(fillTemplate(bestLabel, { best: best }), cardW / 2, cardH * 0.68);
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
    var tagline = requiredWordingString(w.cardTagline, "KR_WORDING.share.cardTagline");
    if (tagline) {
      ctx.font = "14px system-ui, -apple-system, sans-serif";
      ctx.globalAlpha = 0.5;
      ctx.fillText(tagline, cardW / 2, cardH - 20);
      ctx.globalAlpha = 1;
    }

    return canvas;
  };

  UI.prototype._getShareText = function () {
    var w = requiredObject(this.wording && this.wording.share, "KR_WORDING.share");
    var last = (this._runtime && this._runtime.lastRun) ? this._runtime.lastRun : {};
    var url = requiredConfigString(requiredObject(this.config?.identity, "KR_CONFIG.identity").appUrl, "KR_CONFIG.identity.appUrl");
    var isDaily = !!last.isDaily;

    // Dynamic hashtag: #KitchenRush{score}
    var hashtagPrefix = requiredWordingString(w.hashtagPrefix, "KR_WORDING.share.hashtagPrefix");
    var hashtag = hashtagPrefix + requiredConfigNumber(last.score == null ? 0 : last.score, "KR_UI._getShareText().lastRun.score", { min: 0, integer: true });

    // Date string for daily
    var dp = todayDateParts();
    var dateStr = dp.month + " " + dp.day;

    var tpl = "";
    if (isDaily) tpl = requiredWordingString(w.templateDaily, "KR_WORDING.share.templateDaily");
    else if (last.mode === MODES.SPRINT) tpl = requiredWordingString(w.templateSprint, "KR_WORDING.share.templateSprint");
    else if (last.newBest) tpl = requiredWordingString(w.templateNewBest, "KR_WORDING.share.templateNewBest");
    else if (last.totalFaulted > 0) tpl = requiredWordingString(w.templateFault, "KR_WORDING.share.templateFault");
    else tpl = requiredWordingString(w.templateDefault, "KR_WORDING.share.templateDefault");

    var raw = fillTemplate(tpl, { score: requiredConfigNumber(last.score == null ? 0 : last.score, "KR_UI._getShareText().lastRun.score", { min: 0, integer: true }), best: requiredConfigNumber(last.bestScore == null ? 0 : last.bestScore, "KR_UI._getShareText().lastRun.bestScore", { min: 0, integer: true }), url: url, hashtag: hashtag, date: dateStr, scorePlayer: requiredConfigNumber(last.playerScore == null ? 0 : last.playerScore, "KR_UI._getShareText().lastRun.playerScore", { min: 0, integer: true }), scoreOpponent: requiredConfigNumber(last.opponentScore == null ? 0 : last.opponentScore, "KR_UI._getShareText().lastRun.opponentScore", { min: 0, integer: true }) });
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

  UI.prototype.openDailyModal = function () {
    var lw = this.wording?.ui || {};
    var title = txt(lw.dailyInfoTitle) || requiredConfigString(lw.dailyBadge, "KR_WORDING.ui.dailyBadge");
    var body = String(lw.dailyInfoBody || lw.dailyExplain || '').trim();
    var cta = String(lw.dailyCta || 'Play Daily').trim();
    var h = '';
    h += '<div class="kr-modal">';
    h += '<button class="kr-modal-close" data-action="close-modal" aria-label="Close">×</button>';
    h += '<h2 class="kr-h2">' + escapeHtml(title) + '</h2>';
    if (body) h += '<p class="kr-muted">' + escapeHtml(body) + '</p>';
    h += '<div class="kr-actions"><button class="kr-btn kr-btn--primary" data-action="play-daily">' + escapeHtml(cta) + '</button></div>';
    h += '</div>';
    this.openModal(h);
  };

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
    var winRef = window.open("mailto:" + email + (q.length ? "?" + q.join("&") : ""), "_self");
    if (!winRef) throw new Error("KR_UI.sendStatsViaEmail(): window.open blocked");
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
    var w = requiredObject(this.wording?.sprint, "KR_WORDING.sprint");
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
    var w = requiredObject(this.wording?.sprint, "KR_WORDING.sprint");
    var limit = requiredConfigNumber(this.config?.sprint?.freeRunsLimit, "KR_CONFIG.sprint.freeRunsLimit", { min: 0, integer: true });
    var h = '<h2 class="kr-h2">' + escapeHtml(requiredWordingString(w.freeLimitReachedTitle, "KR_WORDING.sprint.freeLimitReachedTitle")) + '</h2>';
    h += '<p>' + escapeHtml(requiredWordingString(w.freeLimitReachedBody, "KR_WORDING.sprint.freeLimitReachedBody", { limit: limit })) + '</p>';
    h += '<div class="kr-actions kr-actions--stack">';
    h += '<button data-action="show-paywall" class="kr-btn kr-btn--primary">' + escapeHtml(requiredWordingString(w.freeLimitReachedCta, "KR_WORDING.sprint.freeLimitReachedCta")) + '</button>';
    h += '<button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(requiredWordingString(w.freeLimitReachedClose, "KR_WORDING.sprint.freeLimitReachedClose")) + '</button>';
    h += '</div>';
    this.openModal(h);
  };

  UI.prototype._canShowChest = function (screen) {
    var cfg = this.config;
    if (!cfg?.sprint?.enabled) return false;
    var gates = requiredObject(cfg.sprint.gates, "KR_CONFIG.sprint.gates");
    var rc = requiredConfigNumber(requiredObject(this._store("getCounters"), "KR_UI._canShowChest().counters").runCompletes, "KR_UI._canShowChest().counters.runCompletes", { min: 0, integer: true });
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
    var url = requiredConfigString(requiredObject(this.config?.houseAd, "KR_CONFIG.houseAd").url, "KR_CONFIG.houseAd.url");
    this._store("markHouseAdClicked");
    var winRef = window.open(url, "_blank", "noopener");
    if (!winRef) throw new Error("KR_UI.checkout(): window.open blocked");
  };

  UI.prototype.remindHouseAdLater = function () {
    this._store("hideHouseAdUsingConfig");
    this.render();
  };


  // ============================================
  // Waitlist
  // ============================================
  UI.prototype.openWaitlistModal = function () {
    var w = requiredObject(this.wording?.waitlist, "KR_WORDING.waitlist");
    var h = '<h2 class="kr-h2">' + escapeHtml(requiredWordingString(w.title, "KR_WORDING.waitlist.title")) + '</h2>';
    h += '<p>' + escapeHtml(requiredWordingString(w.bodyLine1, "KR_WORDING.waitlist.bodyLine1")) + '</p>';
    h += '<textarea id="kr-waitlist-idea" class="kr-input" rows="3" placeholder="' + escapeHtml(requiredWordingString(w.inputPlaceholder, "KR_WORDING.waitlist.inputPlaceholder")) + '"></textarea>';
    h += '<div class="kr-actions kr-actions--stack">';
    h += '<button id="kr-waitlist-send" class="kr-btn kr-btn--primary">' + escapeHtml(requiredWordingString(w.cta, "KR_WORDING.waitlist.cta")) + '</button>';
    h += '<button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(requiredWordingString(requiredObject(this.wording?.system, "KR_WORDING.system").close, "KR_WORDING.system.close")) + '</button>';
    h += '</div>';
    this.openModal(h);

    var ta = el("kr-waitlist-idea");
    if (ta) {
      var draft = this._store("getWaitlistDraftIdea");
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
    var ideaNode = el("kr-waitlist-idea");
    var idea = ideaNode && typeof ideaNode.value === "string" ? ideaNode.value : "";
    if (window.KR_Email && typeof window.KR_Email.buildMailto === "function") {
      var mailto = window.KR_Email.buildMailto(this.config, idea);
      if (mailto) {
        var winRef = window.open(mailto, "_self");
        if (!winRef) throw new Error("KR_UI.sendWaitlistViaEmail(): window.open blocked");
      }
    }
    this._store("setWaitlistStatus","joined");
    this.closeModal();
  };


  // ============================================
  // Stats Sharing
  // ============================================
  UI.prototype.openStatsSharingModal = function () {
    var w = requiredObject(this.wording?.statsSharing, "KR_WORDING.statsSharing");
    var payload = this._store("getAnonymousStatsPayload");
    if (!payload) return;

    var preview = JSON.stringify(payload, null, 2);
    var h = '<h2 class="kr-h2">' + escapeHtml(requiredWordingString(w.modalTitle, "KR_WORDING.statsSharing.modalTitle")) + '</h2>';
    h += '<p class="kr-muted">' + escapeHtml(requiredWordingString(w.modalDescription, "KR_WORDING.statsSharing.modalDescription")) + '</p>';
    h += '<pre class="kr-stats-preview">' + escapeHtml(preview) + '</pre>';
    h += '<div class="kr-actions kr-actions--stack">';
    h += '<button id="kr-stats-send" class="kr-btn kr-btn--primary">' + escapeHtml(requiredWordingString(w.ctaSend, "KR_WORDING.statsSharing.ctaSend")) + '</button>';
    h += '<button id="kr-stats-copy" class="kr-btn kr-btn--secondary">' + escapeHtml(requiredWordingString(w.ctaCopy, "KR_WORDING.statsSharing.ctaCopy")) + '</button>';
    h += '<button data-action="close-modal" class="kr-btn kr-btn--secondary">' + escapeHtml(requiredWordingString(requiredObject(this.wording?.system, "KR_WORDING.system").close, "KR_WORDING.system.close")) + '</button>';
    h += '</div>';
    this.openModal(h);

    var self = this;
    var sendBtn = el("kr-stats-send");
    if (sendBtn) sendBtn.addEventListener("click", function () { self.sendStatsViaEmail(); });
    var copyBtn = el("kr-stats-copy");
    if (copyBtn) copyBtn.addEventListener("click", function () { self.copyStatsToClipboard(); });
  };

  UI.prototype.sendStatsViaEmail = function () {
    var payload = this._store("getAnonymousStatsPayload");
    if (!payload) return;
    var subject = requiredConfigString(requiredObject(this.config?.statsSharing, "KR_CONFIG.statsSharing").emailSubject, "KR_CONFIG.statsSharing.emailSubject");
    var body = JSON.stringify(payload, null, 2);
    var email = (window.KR_Email && typeof window.KR_Email.getSupportEmailDecoded === "function") ? requiredConfigString(window.KR_Email.getSupportEmailDecoded(), "KR_Email.getSupportEmailDecoded()") : (() => { throw new Error("KR_UI.sendStatsViaEmail(): KR_Email.getSupportEmailDecoded missing"); })();
    var q = [];
    if (subject) q.push("subject=" + encodeURIComponent(subject));
    if (body) q.push("body=" + encodeURIComponent(body));
    var winRef = window.open("mailto:" + email + (q.length ? "?" + q.join("&") : ""), "_self");
    if (!winRef) throw new Error("KR_UI.sendStatsViaEmail(): window.open blocked");
    var msg = requiredWordingString(requiredObject(this.wording?.statsSharing, "KR_WORDING.statsSharing").successToast, "KR_WORDING.statsSharing.successToast");
    toastNow(this.config, msg, { timingKey: "positive" });
    this.closeModal();
  };

  UI.prototype.copyStatsToClipboard = async function () {
    var payload = this._store("getAnonymousStatsPayload");
    if (!payload) return;
    try { await navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); } catch (_) { return; }
    var msg = requiredWordingString(requiredObject(this.wording?.statsSharing, "KR_WORDING.statsSharing").copyToast, "KR_WORDING.statsSharing.copyToast");
    toastNow(this.config, msg, { timingKey: "positive" });
  };

  UI.prototype._maybePromptStatsSharingMilestone = function () {
    var cfg = this.config?.statsSharing;
    if (!cfg || !cfg.enabled) return;
    var rc = requiredConfigNumber(requiredObject(this._store("getCounters"), "KR_UI._maybePromptStatsSharingMilestone().counters").runCompletes, "KR_UI._maybePromptStatsSharingMilestone().counters.runCompletes", { min: 0, integer: true });
    var milestones = Array.isArray(cfg.promptAfterRunCompletes) ? cfg.promptAfterRunCompletes : [];

    var shouldPrompt = false;
    var promptFlagBit = 0;
    for (var i = 0; i < milestones.length; i++) {
      if (rc === milestones[i]) {
        promptFlagBit = Math.pow(2, i);
        var seenFlags = this.storage && typeof this.storage.getStatsSharingPromptFlags === "function"
          ? this.storage.getStatsSharingPromptFlags()
          : 0;
        if ((seenFlags & promptFlagBit) === 0) shouldPrompt = true;
        break;
      }
    }

    if (!shouldPrompt && cfg.promptOnFreeRunsExhausted) {
      var balance = requiredConfigNumber(this._store("getRunsBalance"), "KR_UI.renderPaywall().runsBalance", { min: 0, integer: true });
      var premium = !!(this._store("isPremium"));
      if (balance <= 0 && !premium) shouldPrompt = true;
    }

    var snooze = this.storage
      ? (this.storage.getStatsSharingSnoozeUntilRunCompletes() || 0) : 0;
    if (rc < snooze) shouldPrompt = false;
    if (!shouldPrompt) return;
    if (promptFlagBit && this.storage && typeof this.storage.markStatsSharingPromptFlag === "function") {
      this.storage.markStatsSharingPromptFlag(promptFlagBit);
    }

    var w = requiredObject(this.wording?.statsSharing, "KR_WORDING.statsSharing");
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
    var uxFlow = requiredObject(this.config && this.config.uxFlow, "KR_CONFIG.uxFlow");
    var pb = this._store("getPersonalBest") || {};
    var best = pb.bestScore || 0;
    var balance = requiredConfigNumber(this._store("getRunsBalance"), "KR_UI.renderPaywall().runsBalance", { min: 0, integer: true });
    var counters = requiredObject(this._store("getCounters"), "KR_UI._maybeShowFirstRunFraming().counters");
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
      var targetScore = best + 1;
      var targetMsg = String(lw.bestTargetTemplate || "").trim();
      if (targetMsg) {
        bestHtml = '<div class="kr-landing-best">';
        bestHtml += '<p class="kr-landing-best-score">' + escapeHtml(lw.bestLabel || "") + ': ' + best + '</p>';
        bestHtml += '<p class="kr-landing-best-target">' + escapeHtml(fillTemplate(targetMsg, { target: targetScore })) + '</p>';
        bestHtml += '</div>';
      } else {
        bestHtml = '<p class="kr-landing-best-score">' + escapeHtml(lw.bestLabel || "") + ': ' + best + '</p>';
      }
    }

    // Lifetime score counter (Eyal Hook — cumulative investment)
    var lifetimeHtml = "";
    var lifetimeTotal = counters.totalLifetimeScore || 0;
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
        for (var i = 0; i < lastRuns.length; i++) { if ((lastRuns[i].score || 0) > maxS) maxS = lastRuns[i].score; }
        var barsHtml = "";
        for (var i = 0; i < lastRuns.length; i++) {
          var pct = Math.round(((lastRuns[i].score || 0) / maxS) * 100);
          var bucket = Math.max(1, Math.min(10, Math.round(pct / 10)));
          barsHtml += '<div class="kr-spark-bar kr-spark-bar--h' + bucket + '" title="' + (lastRuns[i].score || 0) + ' score"></div>';
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
            score: storedRuns[0].score || 0,
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
      var pG = (!prevRun.newBest && prevRun.score > 0) ? (best - prevRun.score) : 0;

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

      postPaywallHtml += '<p>' + escapeHtml(lw.postPaywallTitle || "") + '</p>';
      postPaywallHtml += '<p class="kr-muted">' + escapeHtml(lw.postPaywallBody || "") + '</p>';
      postPaywallHtml += '<button class="kr-btn kr-btn--secondary" data-action="show-paywall">' + escapeHtml(lw.postPaywallCta || "") + '</button>';
      postPaywallHtml += '</div>';
    }

    // House Ad
    var houseAdHtml = "";
    if (runCompletes >= requiredConfigNumber(uxFlow.houseAdMinRunCompletes, "KR_CONFIG.uxFlow.houseAdMinRunCompletes", { min: 0, integer: true }) && this._store("shouldShowHouseAdNow",{ inRun: false })) {
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

    // Waitlist card
    var waitlistHtml = "";
    if (runCompletes >= requiredConfigNumber(uxFlow.waitlistMinRunCompletes, "KR_CONFIG.uxFlow.waitlistMinRunCompletes", { min: 0, integer: true }) && this._store("shouldShowWaitlistNow",{ inRun: false })) {
      var ww = (w && w.waitlist) ? w.waitlist : {};
      this._store("setWaitlistStatus", "seen");
      waitlistHtml = '<div class="kr-box">';
      if (String(ww.ctaLabel || '').trim()) waitlistHtml += '<p>' + escapeHtml(ww.ctaLabel || '') + '</p>';
      if (String(ww.disclaimer || '').trim()) waitlistHtml += '<p class="kr-muted">' + escapeHtml(ww.disclaimer || '') + '</p>';
      waitlistHtml += '<div class="kr-actions">';
      waitlistHtml += '<button class="kr-btn kr-btn--secondary" data-action="waitlist">' + escapeHtml(ww.cta || '') + '</button>';
      waitlistHtml += '</div></div>';
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
        var dailyCta = String(lw.dailyCta || '').trim();
        if (dailyCta) {
          dailyHtml += '<div class="kr-actions kr-actions--daily"><button class="kr-btn kr-btn--secondary" data-action="play-daily">' + escapeHtml(dailyCta) + '</button></div>';
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
          '<p class="kr-subtitle">' + escapeHtml((runCompletes > 0 ? (lw.subtitleAfterFirstRun || lw.subtitle) : lw.subtitle) || "") + '</p>' +
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
          waitlistHtml +
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
        '<div class="kr-touch-controls" id="kr-touch-controls" aria-label="Game controls">' +
          '<button type="button" class="kr-touch-btn kr-touch-btn--move" data-control="left">' + escapeHtml(this.wording?.landing?.touchLeftLabel || "") + '</button>' +
          '<button type="button" class="kr-touch-btn kr-touch-btn--hit" data-control="hit">' + escapeHtml(this.wording?.landing?.touchHitLabel || "") + '</button>' +
          '<button type="button" class="kr-touch-btn kr-touch-btn--move" data-control="right">' + escapeHtml(this.wording?.landing?.touchRightLabel || "") + '</button>' +
        '</div>' +
      '</div>';

    var canvas = el("kr-canvas");
    if (canvas) {
      this._canvas = canvas;
      this._syncCanvasSize();
      this._ctx = canvas.getContext("2d");

      var self = this;
      canvas.addEventListener("pointermove", function (e) { self._handleCanvasPointerMove(e); });
      canvas.addEventListener("pointerdown", function (e) { self._handleCanvasTap(e); });
      if (!this._boundCanvasResize) {
        this._boundCanvasResize = function () { self._syncCanvasSize(); };
        window.addEventListener("resize", this._boundCanvasResize);
      }
    }

    var touchWrap = el("kr-touch-controls");
    if (touchWrap && this.config?.controls?.touchButtonsEnabled === true) {
      touchWrap.querySelectorAll("[data-control]").forEach(function (btn) {
        var action = btn.getAttribute("data-control");
        btn.addEventListener("pointerdown", function (e) { self._handleTouchControlPress(action, e); });
        btn.addEventListener("pointerup", function (e) { self._handleTouchControlRelease(e); });
        btn.addEventListener("pointercancel", function (e) { self._handleTouchControlRelease(e); });
        btn.addEventListener("pointerleave", function (e) { self._handleTouchControlRelease(e); });
      });
    }

    this._bindGameplayControls();

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
    var uxFlow = requiredObject(cfg && cfg.uxFlow, "KR_CONFIG.uxFlow");
    var balance = requiredConfigNumber(this._store("getRunsBalance"), "KR_UI.renderPaywall().runsBalance", { min: 0, integer: true });

    // Title & score
    var title = isSprint ? escapeHtml(sw.endTitle || "") : escapeHtml(ew.title || "");
    var scoreLine = isSprint
      ? escapeHtml(fillTemplate(sw.scoreLine || "", { score: last.score }))
      : (Number.isFinite(Number(last.playerScore)) && Number.isFinite(Number(last.opponentScore))
          ? escapeHtml((last.playerScore || 0) + " - " + (last.opponentScore || 0))
          : escapeHtml(fillTemplate(ew.scoreLine || "", { score: last.score })));

    // Best
    var bestScore = isSprint
      ? ((this._store("getSprintBest") || {}).bestScore || 0)
      : (last.bestScore || 0);
    var bestLine = isSprint
      ? escapeHtml(fillTemplate(sw.bestLine || "", { best: bestScore }))
      : escapeHtml(fillTemplate(ew.personalBestLine || "", { best: bestScore }));

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

    var retryNoteHtml = "";
    if (!isSprint) {
      var retryMsg = "";
      if (newBest) retryMsg = String(ew.retryWin || "").trim();
      else if (bestScore > 0 && last.score > 0) {
        var bestGap = bestScore - last.score;
        if (bestGap > 0 && bestGap <= requiredConfigNumber(uxFlow.classicNearBestGap, "KR_CONFIG.uxFlow.classicNearBestGap", { min: 1, integer: true })) retryMsg = String(ew.retryNearBest || "").trim();
      }
      if (!retryMsg && (last.totalFaulted || 0) >= requiredConfigNumber(cfg?.challenges?.faultThreshold, "KR_CONFIG.challenges.faultThreshold", { min: 0, integer: true })) retryMsg = String(ew.retryFaults || "").trim();
      if (!retryMsg) retryMsg = String((last.endReason === "WIN" ? ew.retryWin : ew.retryLoss) || "").trim();
      if (retryMsg) retryNoteHtml = '<p class="kr-end-retry-note">' + escapeHtml(retryMsg) + '</p>';
    }

    // Debrief: accuracy + faults + duration + delta vs best (cognitive feedback)
    var debriefHtml = "";
    if (last.totalSpawned > 0) {
      var accuracy = Math.round((last.score / last.totalSpawned) * 100);
      var faults = last.totalFaulted || 0;
      var misses = last.totalMissed || 0;
      var durationSec = Math.round((last.elapsedMs || 0) / 1000);

      // Delta vs personal best (progression signal — Deci/Ryan §2.1)
      var deltaHtml = "";
      if (bestScore > 0 && !newBest && last.score > 0) {
        var gap = bestScore - last.score;
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
      var cA = Math.round((last.score / last.totalSpawned) * 100);
      var cS = last.bestStreak || 0;
      var sT = requiredConfigNumber(chCfg.streakThreshold, "KR_CONFIG.challenges.streakThreshold", { min: 1, integer: true });
      var sB = requiredConfigNumber(chCfg.streakTargetBonus, "KR_CONFIG.challenges.streakTargetBonus", { min: 1, integer: true });
      var fT = requiredConfigNumber(chCfg.faultThreshold, "KR_CONFIG.challenges.faultThreshold", { min: 0, integer: true });
      var aP = requiredConfigNumber(chCfg.lowAccuracyPct, "KR_CONFIG.challenges.lowAccuracyPct", { min: 0, max: 100, integer: true });
      var aM = requiredConfigNumber(chCfg.lowAccuracyMinScore, "KR_CONFIG.challenges.lowAccuracyMinScore", { min: 1, integer: true });
      var cM = requiredConfigNumber(chCfg.cleanRunMinScore, "KR_CONFIG.challenges.cleanRunMinScore", { min: 1, integer: true });

      challengeHtml = isSprint
        ? pickChallenge([
            { test: last.score > 0, key: "sprintChallenge", vars: { score: last.score, target: last.score + (last.score < 5 ? 2 : 1) } }
          ], ch)
        : pickChallenge([
            { test: newBest && last.score > 0,     key: "newBestChallenge", vars: { score: last.score, target: last.score + 1 } },
            { test: cF === 0 && last.score >= cM,  key: "cleanRun",         vars: null },
            { test: cS >= sT,                        key: "streakChallenge",  vars: { streak: cS, target: cS + sB } },
            { test: cF >= fT,                        key: "faultHeavy",       vars: { faults: cF } },
            { test: cA < aP && last.score >= aM,   key: "lowAccuracy",      vars: { accuracy: cA } }
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
      } else if (bestScore > 0 && last.score > 0) {
        var nearGap = bestScore - last.score;
        if (nearGap > 0 && nearGap <= 5) {
          ctaText = ew.playAgainNearBest || ew.playAgain || "";
        }
      }
      ctasHtml = '<button class="kr-btn kr-btn--primary" data-action="play-again">' + escapeHtml(ctaText) + '</button>';
    }

    // Share
    var shareHtml = "";
    var isDaily = !!last.isDaily;
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
      var autoShareScore = newBest
        ? requiredConfigNumber(uxFlow.autoShareNewBestMinScore, "KR_CONFIG.uxFlow.autoShareNewBestMinScore", { min: 0, integer: true })
        : (isDaily
            ? requiredConfigNumber(uxFlow.autoShareDailyMinScore, "KR_CONFIG.uxFlow.autoShareDailyMinScore", { min: 0, integer: true })
            : requiredConfigNumber(uxFlow.autoShareRegularMinScore, "KR_CONFIG.uxFlow.autoShareRegularMinScore", { min: 0, integer: true }));
      if (last.score >= autoShareScore) {
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
          retryNoteHtml +
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

    var balance = requiredConfigNumber(this._store("getRunsBalance"), "KR_UI.renderPaywall().runsBalance", { min: 0, integer: true });
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

    var earlyUrl = getCheckoutUrl(cfg, "early");
    var standardUrl = getCheckoutUrl(cfg, "standard");
    var earlyLive = !!earlyUrl;
    var standardLive = !!standardUrl;
    var checkoutLive = isEarly ? earlyLive : standardLive;

    var priceCtas = "";
    if (isEarly) {
      var tl = String(pw.timerLabel || "").trim();
      var timerHtml = tl ? '<p class="kr-paywall-timer">' + escapeHtml(tl) + " " + mmss(ep.remainingMs) + '</p>' : "";
      if (checkoutLive) {
        priceCtas = timerHtml + savingsHtml + '<button class="kr-btn kr-btn--primary" data-action="checkout-early">' + escapeHtml(pw.ctaEarly || "") + '</button>';
      } else {
        priceCtas = '<p class="kr-muted">' + escapeHtml(requiredWordingString(requiredObject(w?.system, "KR_WORDING.system").checkoutUnavailable, "KR_WORDING.system.checkoutUnavailable")) + '</p>';
      }
    } else {
      var postEarly1 = String(pw.postEarlyLine1 || "").trim();
      var postEarly2 = fillTemplate(pw.postEarlyLine2 || "", { standardPrice: standardPrice });
      var postHtml = postEarly1 ? '<p class="kr-muted">' + escapeHtml(postEarly1) + '</p><p class="kr-muted">' + escapeHtml(postEarly2) + '</p>' : "";
      if (checkoutLive) {
        priceCtas = postHtml + '<button class="kr-btn kr-btn--primary" data-action="checkout-standard">' + escapeHtml(pw.ctaStandard || "") + '</button>';
      } else {
        priceCtas = postHtml + '<p class="kr-muted">' + escapeHtml(requiredWordingString(requiredObject(w?.system, "KR_WORDING.system").checkoutUnavailable, "KR_WORDING.system.checkoutUnavailable")) + '</p>';
      }
    }

    // Personal progress anchor (loss aversion — Kahneman: people value what they already have)
    var progressHtml = "";
    var pb = requiredObject(this._store("getPersonalBest"), "KR_UI.renderPaywall().personalBest");
    var bestScore = requiredConfigNumber(pb.bestScore, "KR_UI.renderPaywall().personalBest.bestScore", { min: 0, integer: true });
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
