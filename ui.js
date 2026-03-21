// ui.js v2.0 - Kitchen Rush
// State machine + Canvas/DOM rendering.
// All features: modals, toasts, power ball, paywall, houseAd, waitlist,
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

  function rgbaFromTuple(rgb, alpha) {
    var s = String(rgb || "").trim();
    if (!s) return "";
    var a = Math.max(0, Math.min(1, Number(alpha || 0)));
    return "rgba(" + s + "," + a.toFixed(3) + ")";
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
    this.pwa = (d.pwa && typeof d.pwa === "object") ? d.pwa : null;
    this.audio = (d.audio && typeof d.audio === "object") ? d.audio : null;
    this.gameApi = (d.gameApi && typeof d.gameApi === "object") ? d.gameApi : null;
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
        sprintSuccessUntil: 0,
        milestoneGlowUntil: 0,
        firstKitchenPulseUntil: 0,
        bounceFlashBalls: {},   // ballId → until timestamp
        lastPlayedBounceAt: 0,
        sprintPenaltyUntil: 0,
        scorePopups: []         // [{ x, y, at }]
      },

      renderPerf: {
        tier: 0,
        samples: [],
        lastChangeAt: 0
      },

      // Support modal cache
      supportEmail: "",
      landingHouseAdImpressionMarked: false,
      endWaitlistImpressionMarked: false,

      // Current run
      runMode: MODES.RUN,           // MODES.RUN | MODES.SPRINT
      runType: "",              // "FREE" | "LAST_FREE" | "UNLIMITED" | ""
      finishingRun: false,
      matchView: "",

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

      // Power Ball gesture
      powerBall: { tapCount: 0, lastTapAt: 0 },

      // End record moment
      endRecordMomentUntil: 0,
      endRecordMomentTimer: null,
      shareCardAutoOpenTimer: null,
      endTransitionTimerIds: [],

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

  UI.prototype._getFeaturedPowerKey = function () {
    var weekly = this.config && this.config.game && this.config.game.powerUps && this.config.game.powerUps.weekly;
    if (!weekly || weekly.enabled !== true || !Array.isArray(weekly.cycle) || !weekly.cycle.length) return "";
    var now = new Date();
    var weekSerial = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 604800000);
    return String(weekly.cycle[((weekSerial % weekly.cycle.length) + weekly.cycle.length) % weekly.cycle.length] || "").trim();
  };

  UI.prototype._getPowerUpLabel = function (key) {
    var uiw = (this.wording && this.wording.ui) ? this.wording.ui : {};
    if (key === "extraLife") return String(uiw.powerUpExtraLife || "").trim();
    if (key === "shield") return String(uiw.powerUpShield || "").trim();
    if (key === "speedBoost") return String(uiw.powerUpSpeedBoost || "").trim();
    if (key === "perfectWindow") return String(uiw.powerUpPerfectWindow || "").trim();
    if (key === "smashBoost") return String(uiw.powerUpSmashBoost || "").trim();
    return "";
  };

  UI.prototype._getRunProgressionMeta = function () {
    var counters = this._store("getCounters") || {};
    var pb = this._store("getPersonalBest") || {};
    return {
      runCompletes: Number(counters.runCompletes || 0),
      lifetimeSmashes: Number(counters.totalLifetimeSmashes || 0),
      bestScore: Number(pb.bestSmashes || 0),
      featuredPowerKey: this._getFeaturedPowerKey()
    };
  };

  UI.prototype._clearEndTransitionTimers = function () {
    if (!this._runtime || !Array.isArray(this._runtime.endTransitionTimerIds)) return;
    while (this._runtime.endTransitionTimerIds.length) {
      clearTimeout(this._runtime.endTransitionTimerIds.pop());
    }
    if (this._canvas) {
      try { this._canvas.style.filter = ""; } catch (_) { }
    }
    if (this.appEl) {
      try { this.appEl.classList.remove("kr-fade", "kr-fade--out", "kr-fade--in", "transitioning"); } catch (_) { }
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

      var powerBallEl = t.closest('[data-kr-secret="power-ball"]');
      if (powerBallEl) { e.preventDefault(); self._handlePowerBallTap(); return; }
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
      case "toggle-match-view": this._toggleMatchView(); break;
      case "sprint-again":      this._handlePowerRunAgain(); break;
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
    this._runtime.matchView = this._getMatchView();
    this._store("markLandingViewed");
    this.render();
  };

  UI.prototype._getMatchView = function () {
    var defaultView = String(this.config?.canvas?.views?.defaultView || "").trim();
    if (defaultView !== "broadcast" && defaultView !== "player") {
      throw new Error("KR_UI: KR_CONFIG.canvas.views.defaultView invalid");
    }
    var stored = "";
    try { stored = String(this._store("getMatchView") || "").trim(); } catch (_) { }
    var resolved = (stored === "player" || stored === "broadcast") ? stored : defaultView;
    if (this._runtime) this._runtime.matchView = resolved;
    return resolved;
  };

  UI.prototype._setMatchView = function (view) {
    var next = String(view || "").trim();
    if (next !== "broadcast" && next !== "player") return;
    if (this._runtime) this._runtime.matchView = next;
    try { this._store("setMatchView", next); } catch (_) { }
  };

  UI.prototype._toggleMatchView = function () {
    var current = this._getMatchView();
    var next = (current === "player") ? "broadcast" : "player";
    this._setMatchView(next);
    if (this.state === STATES.PLAYING) {
      this._renderHUDV2(this.game.getState());
    }
  };

  UI.prototype.onStorageUpdated = function () {
    // Block renders while finishing a run (storage writes during recordRunComplete trigger events)
    if (this.state !== STATES.PLAYING && !(this._runtime && this._runtime.finishingRun)) this.render();
  };

  UI.prototype.onStorageSaveFailed = function () {
    var msg = String(this.wording?.system?.storageSaveFailedToast || "").trim();
    if (msg) this._toastNow(this.config, msg);
  };


  // ============================================
  // State machine
  // ============================================
  UI.prototype.setState = function (next) {
    var prev = this.state;

    // Guard: no-op if same state
    if (next === prev) return;

    // Power Ball gesture reset on END transitions
    if (this._runtime && this._runtime.powerBall) {
      if ((prev === STATES.END && next !== STATES.END) || (next === STATES.END && prev !== STATES.END)) {
        this._runtime.powerBall.tapCount = 0;
        this._runtime.powerBall.lastTapAt = 0;
      }
    }

    // Paywall ticker management
    if (prev === STATES.PAYWALL && next !== STATES.PAYWALL && next !== STATES.LANDING) this._stopPaywallTicker();
    if (prev === STATES.LANDING && next !== STATES.LANDING && next !== STATES.PAYWALL) this._stopPaywallTicker();
    if (prev === STATES.LANDING && next !== STATES.LANDING && this._runtime) {
      this._runtime.landingHouseAdImpressionMarked = false;
    }
    if (prev === STATES.END && next !== STATES.END && this._runtime) {
      this._runtime.endWaitlistImpressionMarked = false;
    }

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
      var landingBalance = this._store("getRunsBalance") || 0;
      var landingPremium = !!(this._store("isPremium"));
      var landingCounters = this._store("getCounters") || {};
      var landingPostPaywallActive = (!landingPremium && landingBalance <= 0 && (landingCounters.runCompletes || 0) > 0);
      var landingWaitlistActive = false;
      try { ep = this._store("getEarlyPriceState") || null; } catch (_) { }
      if (ep && ep.phase === "EARLY" && Number(ep.remainingMs) > 0) {
        this._stopPaywallTicker(); this._startPaywallTicker();
      } else { this._stopPaywallTicker(); }
      try {
        landingWaitlistActive = !!this._store("shouldShowWaitlistNow", {
          screen: STATES.LANDING,
          inRun: false,
          premium: landingPremium,
          balance: landingBalance,
          postPaywallActive: landingPostPaywallActive
        });
      } catch (_) { }
      if (this._runtime && !this._runtime.landingHouseAdImpressionMarked) {
        try {
          if (this._store("shouldShowHouseAdNow", {
            screen: STATES.LANDING,
            inRun: false,
            premium: landingPremium,
            balance: landingBalance,
            postPaywallActive: landingPostPaywallActive,
            waitlistActive: landingWaitlistActive
          })) {
            this._store("markHouseAdShown");
            this._runtime.landingHouseAdImpressionMarked = true;
          }
        } catch (_) { }
      }
    }

    // Stop game loop when leaving PLAYING
    if (prev === STATES.PLAYING && next !== STATES.PLAYING) {
      this._stopGameLoop();
      this._hideGameplayOverlay();
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
      if (this._runtime && this._runtime.shareCardAutoOpenTimer) {
        clearTimeout(this._runtime.shareCardAutoOpenTimer);
        this._runtime.shareCardAutoOpenTimer = null;
      }
      this._clearEndTransitionTimers();
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
      var endNudge = null;
      try {
        endNudge = this._getEndNudgePriority();
        if (endNudge.showStatsPrompt) this._maybePromptStatsSharingMilestone();
      } catch (_) { }

      if (this._runtime && !this._runtime.endWaitlistImpressionMarked) {
        try {
          var waitlistLastRun = (this._runtime && this._runtime.lastRun) ? this._runtime.lastRun : {};
          var waitlistPremium = !!(this._store("isPremium"));
          var waitlistBalance = this._store("getRunsBalance") || 0;
          var showWaitlistEnd = !!this._store("shouldShowWaitlistNow", {
            screen: STATES.END,
            inRun: false,
            premium: waitlistPremium,
            balance: waitlistBalance,
            isSprint: (waitlistLastRun.mode === MODES.SPRINT),
            postPaywallActive: (!waitlistPremium && waitlistLastRun.mode !== MODES.SPRINT && waitlistBalance <= 0),
            showStatsPrompt: !!(endNudge && endNudge.showStatsPrompt),
            showShare: !!(endNudge && endNudge.showShare)
          });
          if (showWaitlistEnd && this._store("getWaitlistStatus") === "not_seen") {
            this._store("setWaitlistStatus", "seen");
          }
          this._runtime.endWaitlistImpressionMarked = true;
        } catch (_) { }
      }

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
  // Play / Power Run handlers
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
    var currentDailyKey = (this.gameApi && typeof this.gameApi.getDailyKeyUtc === "function")
      ? String(this.gameApi.getDailyKeyUtc() || "").trim()
      : "";

    for (var i = 0; i < runs.length; i += 1) {
      var run = runs[i] || {};
      var meta = (run.meta && typeof run.meta === "object") ? run.meta : {};
      if (meta.isDaily !== true) continue;
      var storedDailyKey = String(meta.dailyKey || "").trim();
      if (currentDailyKey && storedDailyKey && storedDailyKey === currentDailyKey) return true;
      var endedAt = Number(run.endedAt || 0);
      if (!Number.isFinite(endedAt) || endedAt <= 0) continue;
      if (currentDailyKey && this.gameApi && typeof this.gameApi.getDailyKeyUtc === "function") {
        if (String(this.gameApi.getDailyKeyUtc(new Date(endedAt)) || "").trim() === currentDailyKey) return true;
      }
    }
    return false;
  };

  UI.prototype._handlePowerRunAgain = function () {
    // Route through startPowerRun() to enforce the free Power Run gate
    this.startPowerRun();
  };

  UI.prototype.startPowerRun = function () {
    var premium = !!(this._store("isPremium"));

    if (!premium) {
      if (!this.storage || typeof this.storage.getSprintAccessState !== "function") {
        throw new Error("KR_UI.startPowerRun(): storage power run gating API missing");
      }
      var sprintAccess = this.storage.getSprintAccessState();
      if (!sprintAccess || sprintAccess.ok !== true) {
        this._showSprintFreeLimitReached();
        return;
      }
      this._store("incrementSprintFreeRunsUsed");
    }

    this._store("markSprintStarted");
    this._runtime.currentRunIsDaily = false;
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
    juice.sprintSuccessUntil = 0;
    juice.milestoneGlowUntil = 0;
    juice.firstKitchenPulseUntil = 0;
    juice.bounceFlashBalls = {};
    juice.lastPlayedBounceAt = 0;
    juice.sprintPenaltyUntil = 0;
    juice.scorePopups = [];

    this._runtime.tapLocked = false;
    this._runtime.finishingRun = false;
    this._clearEndTransitionTimers();
    if (this._runtime.shareCardAutoOpenTimer) {
      clearTimeout(this._runtime.shareCardAutoOpenTimer);
      this._runtime.shareCardAutoOpenTimer = null;
    }
    this._runtime.runMode = mode;
    this._runtime._lastBallState = {};
    this._runtime._lastDailyObjectiveMet = false;
    this._runtime.renderPerf.tier = 0;
    this._runtime.renderPerf.samples = [];
    this._runtime.renderPerf.lastChangeAt = 0;

    // Start engine
    var isDaily = (mode === MODES.RUN) && !!(this._runtime.currentRunIsDaily);
    this.game.start({
      config: this.config,
      mode: mode,
      canvasW: appW,
      canvasH: appH,
      isDaily: isDaily,
      progression: this._getRunProgressionMeta()
    });

    // beforeunload guard (warn on accidental tab close during gameplay)
    if (!this._beforeUnloadHandler) {
      var self = this;
      this._beforeUnloadHandler = function (e) { if (self.state === STATES.PLAYING) e.preventDefault(); };
      window.addEventListener("beforeunload", this._beforeUnloadHandler);
    }

    this.setState(STATES.PLAYING);

    if (!this._shouldShowRunStartOverlay(mode)) {
      this._startGameLoop();
      return;
    }

    // Show run start overlay — game loop starts on dismiss tap
    // Fail-closed: if overlay fails, start game loop immediately
    try {
      this._showRunStartOverlay(mode, runType);
    } catch (_) {
      this._startGameLoop();
    }
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
      self._updateRenderPerf(dtMs);
      self._syncDesktopPointerInput();

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

  UI.prototype._getRenderPerfConfig = function () {
    var cfg = this.config && this.config.renderPerformance;
    if (!cfg || typeof cfg !== "object") throw new Error("KR_UI: KR_CONFIG.renderPerformance missing");
    return cfg;
  };

  UI.prototype._updateRenderPerf = function (dtMs) {
    var perfCfg = this._getRenderPerfConfig();
    if (!perfCfg.enabled) return;
    var perf = this._runtime && this._runtime.renderPerf;
    if (!perf) return;
    var samples = perf.samples;
    samples.push(Number(dtMs) || 0);
    while (samples.length > perfCfg.sampleFrames) samples.shift();
    if (samples.length < perfCfg.sampleFrames) return;

    var sum = 0;
    for (var i = 0; i < samples.length; i++) sum += samples[i];
    var avg = sum / samples.length;
    var now = performance.now();
    if ((now - perf.lastChangeAt) < perfCfg.cooldownMs) return;

    if (avg > perfCfg.downgradeAvgFrameMs && perf.tier < 2) {
      perf.tier += 1;
      perf.lastChangeAt = now;
      return;
    }
    if (avg < perfCfg.upgradeAvgFrameMs && perf.tier > 0) {
      perf.tier -= 1;
      perf.lastChangeAt = now;
    }
  };

  UI.prototype._getRenderPerfTier = function () {
    return (this._runtime && this._runtime.renderPerf && Number.isFinite(this._runtime.renderPerf.tier))
      ? this._runtime.renderPerf.tier
      : 0;
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
    var perfCfg = this._getRenderPerfConfig();
    var perfTier = this._getRenderPerfTier();

    var court = state.court;
    if (!court) return;

    var juice = this._runtime.juice;
    var n = performance.now();
    var gt = state.elapsedMs;

    var worldNetYpx = court.netY * h;
    var worldKitchenLineYpx = court.kitchenLineY * h;
    var worldBaselineYpx = court.baselineY * h;
    var worldPlayerYpx = court.playerY * h;
    var controlsYpx = court.controlsY * h;
    var worldOpponentYpx = court.opponentY * h;
    var playerHalfDepthPx = Math.max(1, worldBaselineYpx - worldNetYpx);
    var kitchenDepthPx = Math.max(1, worldKitchenLineYpx - worldNetYpx);
    var activeView = this._getMatchView();
    var viewCfg = this.config?.canvas?.views?.[activeView];
    if (!viewCfg || typeof viewCfg !== "object") throw new Error("canvas.views." + activeView + " missing");
    var oppScale = requiredConfigNumber(viewCfg.opponentCourtScale, "canvas.views." + activeView + ".opponentCourtScale", { min: 0.1, max: 1 });
    var cameraPerspectivePower = requiredConfigNumber(viewCfg.cameraPerspectivePower, "canvas.views." + activeView + ".cameraPerspectivePower", { min: 1, max: 3 });
    var sidelineInsetFrac = requiredConfigNumber(this.config?.canvas?.sidelineInsetFrac, "canvas.sidelineInsetFrac", { min: 0.01, max: 0.3 });
    var nearSidelineInsetFrac = requiredConfigNumber(viewCfg.nearSidelineInsetFrac, "canvas.views." + activeView + ".nearSidelineInsetFrac", { min: 0.01, max: 0.3 });
    var netSidelineInsetFrac = requiredConfigNumber(viewCfg.netSidelineInsetFrac, "canvas.views." + activeView + ".netSidelineInsetFrac", { min: 0.05, max: 0.4 });
    var farSidelineInsetFrac = requiredConfigNumber(viewCfg.farSidelineInsetFrac, "canvas.views." + activeView + ".farSidelineInsetFrac", { min: 0.1, max: 0.45 });
    var farCourtAlpha = requiredConfigNumber(viewCfg.farCourtAlpha, "canvas.views." + activeView + ".farCourtAlpha", { min: 0.1, max: 1 });
    var opponentKitchenAlpha = requiredConfigNumber(viewCfg.opponentKitchenAlpha, "canvas.views." + activeView + ".opponentKitchenAlpha", { min: 0.1, max: 1 });
    var serviceBoxFarAlpha = requiredConfigNumber(viewCfg.serviceBoxFarAlpha, "canvas.views." + activeView + ".serviceBoxFarAlpha", { min: 0.1, max: 1 });
    var netCenterSagPx = requiredConfigNumber(this.config?.canvas?.netCenterSagPx, "canvas.netCenterSagPx", { min: 0, integer: true });
    var netPostHeightPx = requiredConfigNumber(this.config?.canvas?.netPostHeightPx, "canvas.netPostHeightPx", { min: 1, integer: true });
    var kitchenLineWidth = requiredConfigNumber(this.config?.canvas?.kitchenLineWidth, "canvas.kitchenLineWidth", { min: 1, max: 12 });
    var baselineLineWidth = requiredConfigNumber(this.config?.canvas?.baselineLineWidth, "canvas.baselineLineWidth", { min: 1, max: 12 });
    var sidelineLineWidth = requiredConfigNumber(this.config?.canvas?.sidelineLineWidth, "canvas.sidelineLineWidth", { min: 1, max: 8 });
    var centerLineWidth = requiredConfigNumber(this.config?.canvas?.centerLineWidth, "canvas.centerLineWidth", { min: 1, max: 6 });
    var netLineWidth = requiredConfigNumber(this.config?.canvas?.netLineWidth, "canvas.netLineWidth", { min: 1, max: 12 });
    var netBandDepthPx = requiredConfigNumber(this.config?.canvas?.netBandDepthPx, "canvas.netBandDepthPx", { min: 1, max: 30, integer: true });
    var netMeshRows = requiredConfigNumber(this.config?.canvas?.netMeshRows, "canvas.netMeshRows", { min: 1, max: 12, integer: true });
    var netMeshColGapPx = requiredConfigNumber(this.config?.canvas?.netMeshColGapPx, "canvas.netMeshColGapPx", { min: 4, max: 40, integer: true });
    var netNearHighlightThresholdPx = requiredConfigNumber(this.config?.canvas?.netNearHighlightThresholdPx, "canvas.netNearHighlightThresholdPx", { min: 1, max: 80 });
    var netNearHighlightWidth = requiredConfigNumber(this.config?.canvas?.netNearHighlightWidth, "canvas.netNearHighlightWidth", { min: 1, max: 20 });
    var controlZoneInsetPx = requiredConfigNumber(this.config?.canvas?.controlZoneInsetPx, "canvas.controlZoneInsetPx", { min: 0, max: 20, integer: true });
    var controlZoneFontFrac = requiredConfigNumber(this.config?.canvas?.controlZoneFontFrac, "canvas.controlZoneFontFrac", { min: 0.01, max: 0.06 });
    var controlZoneLabelYFrac = requiredConfigNumber(this.config?.canvas?.controlZoneLabelYFrac, "canvas.controlZoneLabelYFrac", { min: 0.2, max: 0.9 });
    var oppHalfDepthPx = playerHalfDepthPx * oppScale;
    var effectiveNetMeshRows = netMeshRows;
    var effectiveNetNearHighlightWidth = netNearHighlightWidth;
    if (perfTier === 1) {
      effectiveNetMeshRows = Math.min(netMeshRows, perfCfg.lowQualityNetMeshRows);
      effectiveNetNearHighlightWidth = Math.min(netNearHighlightWidth, perfCfg.lowQualityNetHighlightWidth);
    } else if (perfTier >= 2) {
      effectiveNetMeshRows = Math.min(netMeshRows, perfCfg.minQualityNetMeshRows);
      effectiveNetNearHighlightWidth = Math.min(netNearHighlightWidth, perfCfg.minQualityNetHighlightWidth);
    }
    var worldOppBaselineYpx = Math.max(0, worldNetYpx - oppHalfDepthPx);
    var worldOppKitchenLineYpx = Math.max(0, worldNetYpx - kitchenDepthPx * oppScale);
    var sidelineInsetPx = w * sidelineInsetFrac;
    var nearSidelineInsetPx = w * nearSidelineInsetFrac;
    var netSidelineInsetPx = w * netSidelineInsetFrac;
    var farSidelineInsetPx = w * farSidelineInsetFrac;
    var leftSidelineX = sidelineInsetPx;
    var rightSidelineX = w - sidelineInsetPx;
    var centerLineX = w / 2;

    function lerpNum(a, b, t) {
      return a + (b - a) * t;
    }

    function depthFromWorldY(worldY) {
      return Math.max(0, Math.min(1, (worldY - worldOppBaselineYpx) / Math.max(1, worldBaselineYpx - worldOppBaselineYpx)));
    }

    function projectCourtY(worldY) {
      var depth = depthFromWorldY(worldY);
      var projectedDepth = Math.pow(depth, cameraPerspectivePower);
      return lerpNum(worldOppBaselineYpx, worldBaselineYpx, projectedDepth);
    }

    function edgesAtWorldY(worldY) {
      if (worldY >= worldNetYpx) {
        var t = Math.max(0, Math.min(1, (worldY - worldNetYpx) / Math.max(1, worldBaselineYpx - worldNetYpx)));
        var leftNear = w * nearSidelineInsetFrac;
        var rightNear = w - leftNear;
        var leftNet = w * netSidelineInsetFrac;
        var rightNet = w - leftNet;
        return {
          left: lerpNum(leftNet, leftNear, t),
          right: lerpNum(rightNet, rightNear, t)
        };
      }
      var tOpp = Math.max(0, Math.min(1, (worldNetYpx - worldY) / Math.max(1, worldNetYpx - worldOppBaselineYpx)));
      var leftNetOpp = w * netSidelineInsetFrac;
      var rightNetOpp = w - leftNetOpp;
      var leftFar = w * farSidelineInsetFrac;
      var rightFar = w - leftFar;
      return {
        left: lerpNum(leftNetOpp, leftFar, tOpp),
        right: lerpNum(rightNetOpp, rightFar, tOpp)
      };
    }

    function drawQuad(topWorldY, bottomWorldY, fillStyle, alpha) {
      var topY = projectCourtY(topWorldY);
      var bottomY = projectCourtY(bottomWorldY);
      var topEdges = edgesAtWorldY(topWorldY);
      var bottomEdges = edgesAtWorldY(bottomWorldY);
      ctx.save();
      if (Number.isFinite(alpha)) ctx.globalAlpha = alpha;
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      ctx.moveTo(topEdges.left, topY);
      ctx.lineTo(topEdges.right, topY);
      ctx.lineTo(bottomEdges.right, bottomY);
      ctx.lineTo(bottomEdges.left, bottomY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function projectX(worldX, worldY) {
      var nearLeft = w * nearSidelineInsetFrac;
      var nearRight = w - nearLeft;
      var frac = (worldX - nearLeft) / Math.max(1, nearRight - nearLeft);
      frac = Math.max(0, Math.min(1, frac));
      var edges = edgesAtWorldY(worldY);
      return lerpNum(edges.left, edges.right, frac);
    }

    function depthRatioAtY(worldY) {
      return depthFromWorldY(worldY);
    }

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
    ctx.fillStyle = colors.courtBg;
    ctx.fillRect(0, 0, w, h);
    drawQuad(worldOppBaselineYpx, worldNetYpx, colors.courtFarBg, farCourtAlpha);
    drawQuad(worldNetYpx, worldBaselineYpx, colors.courtNearBg, 1);

    // Player kitchen zone
    drawQuad(worldNetYpx, worldKitchenLineYpx, colors.kitchenBg, 1);

    // Opponent kitchen zone (compressed but symmetric for a frontal read)
    drawQuad(worldOppKitchenLineYpx, worldNetYpx, colors.opponentKitchenBg, opponentKitchenAlpha);

    // Service boxes: very light tint to reinforce the frontal court layout.
    if (colors.serviceBoxTint) {
      ctx.fillStyle = colors.serviceBoxTint;
      var kitchenLineYpx = projectCourtY(worldKitchenLineYpx);
      var baselineYpx = projectCourtY(worldBaselineYpx);
      var oppKitchenLineYpx = projectCourtY(worldOppKitchenLineYpx);
      var oppBaselineYpx = projectCourtY(worldOppBaselineYpx);
      var playerKitchenEdges = edgesAtWorldY(worldKitchenLineYpx);
      var playerBaselineEdges = edgesAtWorldY(worldBaselineYpx);
      ctx.beginPath();
      ctx.moveTo(playerKitchenEdges.left, kitchenLineYpx);
      ctx.lineTo(centerLineX, kitchenLineYpx);
      ctx.lineTo(centerLineX, baselineYpx);
      ctx.lineTo(playerBaselineEdges.left, baselineYpx);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(centerLineX, kitchenLineYpx);
      ctx.lineTo(playerKitchenEdges.right, kitchenLineYpx);
      ctx.lineTo(playerBaselineEdges.right, baselineYpx);
      ctx.lineTo(centerLineX, baselineYpx);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.globalAlpha = serviceBoxFarAlpha;
      ctx.fillStyle = colors.serviceBoxTintFar;
      var oppKitchenEdges = edgesAtWorldY(worldOppKitchenLineYpx);
      var oppBaselineEdges = edgesAtWorldY(worldOppBaselineYpx);
      ctx.beginPath();
      ctx.moveTo(oppKitchenEdges.left, oppKitchenLineYpx);
      ctx.lineTo(centerLineX, oppKitchenLineYpx);
      ctx.lineTo(centerLineX, oppBaselineYpx);
      ctx.lineTo(oppBaselineEdges.left, oppBaselineYpx);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(centerLineX, oppKitchenLineYpx);
      ctx.lineTo(oppKitchenEdges.right, oppKitchenLineYpx);
      ctx.lineTo(oppBaselineEdges.right, oppBaselineYpx);
      ctx.lineTo(centerLineX, oppBaselineYpx);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Kitchen label
    if (colors.kitchenLabelColor) {
      ctx.font = "bold " + Math.round(w * 0.04) + "px system-ui, sans-serif";
      ctx.fillStyle = colors.kitchenLabelColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var _kitchenLabel = String((this.wording && this.wording.ui && this.wording.ui.kitchenLabel) || "").trim();
      if (_kitchenLabel) ctx.fillText(_kitchenLabel, w / 2, projectCourtY((worldNetYpx + worldKitchenLineYpx) * 0.5));
    }

    // Kitchen lines
    var netYpx = projectCourtY(worldNetYpx);
    var kitchenLineYpx = projectCourtY(worldKitchenLineYpx);
    var baselineYpx = projectCourtY(worldBaselineYpx);
    var playerYpx = projectCourtY(worldPlayerYpx);
    var opponentYpx = projectCourtY(worldOpponentYpx);
    var oppKitchenLineYpx = projectCourtY(worldOppKitchenLineYpx);
    var oppBaselineYpx = projectCourtY(worldOppBaselineYpx);
    ctx.strokeStyle = colors.kitchenLine;
    ctx.lineWidth = kitchenLineWidth;
    ctx.setLineDash([]);
    ctx.beginPath();
    var playerKitchenEdges2 = edgesAtWorldY(worldKitchenLineYpx);
    var oppKitchenEdges2 = edgesAtWorldY(worldOppKitchenLineYpx);
    ctx.moveTo(playerKitchenEdges2.left, kitchenLineYpx);
    ctx.lineTo(playerKitchenEdges2.right, kitchenLineYpx);
    ctx.moveTo(oppKitchenEdges2.left, oppKitchenLineYpx);
    ctx.lineTo(oppKitchenEdges2.right, oppKitchenLineYpx);
    ctx.stroke();

    // Court lines (frontal)
    if (colors.courtLinesStrong && colors.courtLinesSoft && colors.centerLine) {
      ctx.strokeStyle = colors.courtLinesSoft;
      ctx.lineWidth = sidelineLineWidth;
      var playerBaselineEdges2 = edgesAtWorldY(worldBaselineYpx);
      var oppBaselineEdges2 = edgesAtWorldY(worldOppBaselineYpx);
      var netEdges = edgesAtWorldY(worldNetYpx);
      ctx.beginPath();
      ctx.moveTo(oppBaselineEdges2.left, oppBaselineYpx);
      ctx.lineTo(netEdges.left, netYpx);
      ctx.lineTo(playerBaselineEdges2.left, baselineYpx);
      ctx.moveTo(oppBaselineEdges2.right, oppBaselineYpx);
      ctx.lineTo(netEdges.right, netYpx);
      ctx.lineTo(playerBaselineEdges2.right, baselineYpx);
      ctx.stroke();

      ctx.strokeStyle = colors.courtLinesStrong;
      ctx.lineWidth = baselineLineWidth;
      ctx.beginPath();
      ctx.moveTo(playerBaselineEdges2.left, baselineYpx);
      ctx.lineTo(playerBaselineEdges2.right, baselineYpx);
      ctx.moveTo(oppBaselineEdges2.left, oppBaselineYpx);
      ctx.lineTo(oppBaselineEdges2.right, oppBaselineYpx);
      ctx.stroke();

      ctx.strokeStyle = colors.centerLine;
      ctx.lineWidth = centerLineWidth;
      ctx.beginPath();
      ctx.moveTo(centerLineX, kitchenLineYpx);
      ctx.lineTo(centerLineX, baselineYpx);
      ctx.moveTo(centerLineX, oppKitchenLineYpx);
      ctx.lineTo(centerLineX, oppBaselineYpx);
      ctx.stroke();
    }

    if (state.opponentBounceUntil > gt && state.opponentBounceAt > 0) {
      var oppBounceProgress = 1 - ((state.opponentBounceUntil - gt) / Math.max(1, state.opponentBounceUntil - state.opponentBounceAt));
      oppBounceProgress = Math.max(0, Math.min(1, oppBounceProgress));
      var oppBounceX = projectX((state.opponentBounceX != null ? state.opponentBounceX : state.opponentX), worldOpponentYpx);
      var oppBounceRadius = (10 + oppBounceProgress * 18) * oppScale;
      ctx.save();
      ctx.globalAlpha = Math.max(0.18, 0.55 * (1 - oppBounceProgress));
      ctx.strokeStyle = colors.bounceRing;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(oppBounceX, opponentYpx + 6, oppBounceRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = Math.max(0.24, 0.75 * (1 - oppBounceProgress));
      ctx.fillStyle = colors.highlightWhite;
      ctx.beginPath();
      ctx.ellipse(oppBounceX, opponentYpx + 6, 10 * oppScale, 3 * oppScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.font = "bold " + Math.round(Math.max(10, w * 0.016)) + "px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      var returnBounceLabel = String((this.wording && this.wording.ui && this.wording.ui.returnBounceLabel) || "").trim();
      if (returnBounceLabel) ctx.fillText(returnBounceLabel, oppBounceX, opponentYpx - 10);
      ctx.restore();
    }

    // Ball
    var ball = state.ball;
    var renderBall = null;
    if (ball) {
      var BALL_STATES = this.gameApi && this.gameApi.BALL_STATES;
      renderBall = Object.assign({}, ball);
      var groundY = ball.targetY;
      if (BALL_STATES && ball.state === BALL_STATES.TRAVELING) {
        var tTravel = Math.max(0, Math.min(1, (gt - ball.spawnedAt) / Math.max(1, ball.travelMs)));
        var yTravelT = Math.pow(tTravel, Number.isFinite(ball.descentPower) ? ball.descentPower : 1);
        groundY = (ball.startY || 0) + ((ball.targetY || 0) - (ball.startY || 0)) * yTravelT;
      } else if (BALL_STATES && ball.state === BALL_STATES.HIT) {
        var tReturn = Math.max(0, Math.min(1, (gt - ball.hitAt) / Math.max(1, ball.returnTravelMs)));
        groundY = (ball.returnStartY || 0) + ((ball.returnTargetY || 0) - (ball.returnStartY || 0)) * tReturn;
      }
      var ballHeightPx = Math.max(0, groundY - (ball.y || groundY));
      var ballDepthRatioNear = depthRatioAtY(groundY);
      var ballDepthScaleNear = requiredConfigNumber(viewCfg.ballDepthScaleNear, "canvas.views." + activeView + ".ballDepthScaleNear", { min: 0.2, max: 2 });
      var ballDepthScaleFar = requiredConfigNumber(viewCfg.ballDepthScaleFar, "canvas.views." + activeView + ".ballDepthScaleFar", { min: 0.2, max: 2 });
      var ballHeightScaleNear = requiredConfigNumber(viewCfg.ballHeightScaleNear, "canvas.views." + activeView + ".ballHeightScaleNear", { min: 0.1, max: 2 });
      var ballHeightScaleFar = requiredConfigNumber(viewCfg.ballHeightScaleFar, "canvas.views." + activeView + ".ballHeightScaleFar", { min: 0.1, max: 2 });
      var ballScreenScale = lerpNum(ballDepthScaleFar, ballDepthScaleNear, ballDepthRatioNear);
      var heightScreenScale = lerpNum(ballHeightScaleFar, ballHeightScaleNear, ballDepthRatioNear);
      var screenGroundY = projectCourtY(groundY);
      renderBall.x = projectX(ball.x, groundY);
      renderBall.y = screenGroundY - ballHeightPx * heightScreenScale;
      renderBall.targetX = projectX(ball.targetX, ball.targetY);
      renderBall.targetY = projectCourtY(ball.targetY);
      renderBall.startX = projectX(ball.startX, ball.startY);
      renderBall.startY = projectCourtY(ball.startY);
      renderBall.shadowY = screenGroundY;
      renderBall.worldY = ball.y;
      renderBall.worldTargetY = ball.targetY;
      renderBall.worldShadowY = groundY;
      renderBall.radius = Math.max(4, ball.radius * ballScreenScale);
      if (ball.y <= worldNetYpx) {
        this._renderBallV2(ctx, renderBall, colors, w, h, gt, n, juice);
      }
    }

    // Opponent silhouette
    var oppX = projectX(state.opponentX, worldOpponentYpx);
    this._renderOpponentV2(ctx, oppX, opponentYpx, state.opponentState || "idle", colors, w, h, n, oppScale, renderBall, worldOpponentYpx);

    // Net seen from the front, with a slight center sag (36in sides, 34in center)
    ctx.strokeStyle = colors.netColor;
    ctx.lineWidth = netLineWidth;
    var netEdges2 = edgesAtWorldY(worldNetYpx);
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = colors.netColor;
    ctx.beginPath();
    ctx.moveTo(netEdges2.left, netYpx);
    ctx.quadraticCurveTo(centerLineX, netYpx + netCenterSagPx, netEdges2.right, netYpx);
    ctx.lineTo(netEdges2.right, netYpx + netBandDepthPx);
    ctx.quadraticCurveTo(centerLineX, netYpx + netCenterSagPx + netBandDepthPx, netEdges2.left, netYpx + netBandDepthPx);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(netEdges2.left, netYpx);
    ctx.quadraticCurveTo(centerLineX, netYpx + netCenterSagPx, netEdges2.right, netYpx);
    ctx.stroke();

    if (renderBall) {
      var ballNearNet = Math.abs((renderBall.shadowY || renderBall.y) - netYpx) <= netNearHighlightThresholdPx;
      if (ballNearNet) {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = colors.highlightWhite;
        ctx.lineWidth = effectiveNetNearHighlightWidth;
        ctx.beginPath();
        ctx.moveTo(netEdges2.left + 6, netYpx + 2);
        ctx.quadraticCurveTo(centerLineX, netYpx + netCenterSagPx + 2, netEdges2.right - 6, netYpx + 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Net posts
    ctx.fillStyle = colors.netColor;
    ctx.fillRect(netEdges2.left - (netLineWidth / 2), netYpx - netPostHeightPx / 2, netLineWidth, netPostHeightPx);
    ctx.fillRect(netEdges2.right - (netLineWidth / 2), netYpx - netPostHeightPx / 2, netLineWidth, netPostHeightPx);

    // Net mesh
    ctx.strokeStyle = colors.netMesh;
    ctx.lineWidth = 1;
    for (var ni = 1; ni <= effectiveNetMeshRows; ni++) {
      var meshY = netYpx + ni * (netBandDepthPx / (effectiveNetMeshRows + 1));
      ctx.beginPath();
      ctx.moveTo(netEdges2.left + 2, meshY);
      ctx.lineTo(netEdges2.right - 2, meshY);
      ctx.stroke();
    }
    ctx.strokeStyle = colors.netMesh;
    for (var mx = netEdges2.left + (netMeshColGapPx * 0.6); mx < netEdges2.right; mx += netMeshColGapPx) {
      ctx.beginPath();
      ctx.moveTo(mx, netYpx);
      ctx.lineTo(mx, netYpx + netBandDepthPx - 2);
      ctx.stroke();
    }

    if (renderBall && ball.y > worldNetYpx) {
      this._renderBallV2(ctx, renderBall, colors, w, h, gt, n, juice);
    }

    // Player (V3: 2D position from game state)
    var playerX = projectX(state.playerX, state.playerY);
    var playerYState = state.playerY;
    var pState = state.playerState || "idle";
    this._renderPlayerV2(ctx, playerX, playerYpx, pState, colors, w, h, n, court, playerYState, renderBall);

    // V3 Controls zone: left half = MOVE, right half = HIT (timing bonus)
    ctx.fillStyle = colors.controlZoneBg;
    ctx.fillRect(0, controlsYpx, w, h - controlsYpx);
    // Divider
    ctx.strokeStyle = colors.controlZoneBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(controlZoneInsetPx, controlsYpx + controlZoneInsetPx, w / 2 - controlZoneInsetPx * 2, h - controlsYpx - controlZoneInsetPx * 2);
    ctx.strokeStyle = colors.controlZoneHitBorder;
    ctx.strokeRect(w / 2 + controlZoneInsetPx, controlsYpx + controlZoneInsetPx, w / 2 - controlZoneInsetPx * 2, h - controlsYpx - controlZoneInsetPx * 2);
    ctx.font = Math.round(w * controlZoneFontFrac) + "px system-ui, sans-serif";
    ctx.fillStyle = colors.controlZoneText;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var ctrlMidY = controlsYpx + (h - controlsYpx) * controlZoneLabelYFrac;
    var _uw = (this.wording && this.wording.ui) || {};
    var controlMoveLabel = String(_uw.controlMoveLabel || "").trim();
    var controlTimingLabel = String(_uw.controlTimingLabel || "").trim();
    if (controlMoveLabel) ctx.fillText(controlMoveLabel, w / 4, ctrlMidY);
    if (controlTimingLabel) ctx.fillText(controlTimingLabel, w * 3 / 4, ctrlMidY);

    // V3: Timing bonus indicator
    var timingNiceThreshold = requiredConfigNumber(this.config?.game?.timing?.niceThreshold, "KR_CONFIG.game.timing.niceThreshold", { min: 0, max: 1 });
    var timingPerfectThreshold = requiredConfigNumber(this.config?.game?.timing?.perfectThreshold, "KR_CONFIG.game.timing.perfectThreshold", { min: 0, max: 1 });
    if (state.lastTimingBonus > timingNiceThreshold && colors.smashFlashColor) {
      var timingLabel = state.lastTimingBonus > timingPerfectThreshold
        ? String((_uw && _uw.timingPerfectLabel) || "").trim()
        : String((_uw && _uw.timingNiceLabel) || "").trim();
      if (timingLabel) {
      var tbAlpha = Math.max(0, state.lastTimingBonus - 0.3);
      ctx.fillStyle = "rgba(" + colors.smashFlashColor + "," + tbAlpha.toFixed(2) + ")";
      ctx.font = "bold " + Math.round(w * 0.035) + "px system-ui, sans-serif";
      ctx.fillText(timingLabel, w * 3 / 4, ctrlMidY - 20);
      }
    }

    // V3: Daily modifier banner
    if (state.dailyModifier) {
      var dmLabel = String(state.dailyModifier.label || "").trim();
      var dmDesc = String(state.dailyModifier.desc || "").trim();
      if (dmLabel) {
        ctx.fillStyle = rgbaFromTuple(colors.goldRgb, 0.15);
        ctx.fillRect(0, 0, w, Math.round(h * 0.04));
        ctx.font = "bold " + Math.round(w * 0.025) + "px system-ui, sans-serif";
        ctx.fillStyle = rgbaFromTuple(colors.goldRgb, 0.8);
        ctx.textAlign = "center";
        ctx.fillText(dmLabel + (dmDesc ? (" \u2014 " + dmDesc) : ""), w / 2, h * 0.025);
      }
    }

    // Active power-up chips + short activation toast.
    var activePowerUps = Array.isArray(state.activePowerUps) ? state.activePowerUps : [];
    var featuredPowerKey = String(state.featuredPowerKey || "").trim();
    var uiwPower = (this.wording && this.wording.ui) ? this.wording.ui : {};
    function powerColor(key) {
      if (key === "extraLife") return colors.powerUpLife || colors.powerUpReady || colors.highlightWhite;
      if (key === "shield") return colors.powerUpShield || colors.powerUpReady || colors.highlightWhite;
      if (key === "speedBoost") return colors.powerUpSpeed || colors.powerUpReady || colors.highlightWhite;
      if (key === "perfectWindow") return colors.powerUpPerfect || colors.powerUpReady || colors.highlightWhite;
      if (key === "smashBoost") return colors.powerUpSmash || colors.powerUpReady || colors.highlightWhite;
      return colors.powerUpReady || colors.highlightWhite;
    }
    if (activePowerUps.length) {
      var chipX = 12;
      var chipY = Math.round(h * 0.065);
      for (var ap = 0; ap < activePowerUps.length; ap++) {
        var chip = activePowerUps[ap];
        var chipLabel = String(this._getPowerUpLabel(chip.key) || "").trim();
        if (!chipLabel) continue;
        var chipMeta = "";
        if (chip.blocksRemaining > 0) chipMeta = " " + chip.blocksRemaining;
        else if (chip.remainingMs > 0) chipMeta = " " + Math.max(1, Math.ceil(chip.remainingMs / 1000));
        ctx.save();
        ctx.font = "bold " + Math.round(Math.max(10, w * 0.022)) + "px system-ui, sans-serif";
        var chipText = chipLabel + chipMeta;
        var chipW = ctx.measureText(chipText).width + 16;
        var chipH = Math.round(Math.max(18, h * 0.028));
        ctx.globalAlpha = 0.86;
        ctx.fillStyle = rgbaFromTuple(colors.shadowRgb, 0.68);
        ctx.fillRect(chipX, chipY, chipW, chipH);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = powerColor(chip.key);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(chipX, chipY, chipW, chipH);
        ctx.fillStyle = colors.highlightWhite;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(chipText, chipX + 8, chipY + chipH / 2);
        ctx.restore();
        chipY += chipH + 6;
      }
    }
    if (state.lastPowerUpEvent && state.lastPowerUpEvent.key) {
      var powerEventLabel = String(this._getPowerUpLabel(state.lastPowerUpEvent.key) || "").trim();
      var readyPrefix = String(uiwPower.powerUpActivePrefix || uiwPower.powerUpReadyPrefix || "").trim();
      var weeklyPrefix = (state.lastPowerUpEvent.key === featuredPowerKey) ? String(uiwPower.powerUpWeeklyPrefix || "").trim() : "";
      var powerToast = (weeklyPrefix ? (weeklyPrefix + " ") : (readyPrefix ? (readyPrefix + " ") : "")) + powerEventLabel;
      if (powerToast.trim()) {
        ctx.save();
        ctx.font = "bold " + Math.round(Math.max(14, w * 0.032)) + "px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        var toastW = ctx.measureText(powerToast).width + 22;
        var toastH = Math.round(Math.max(24, h * 0.04));
        var toastY = Math.round(h * 0.12);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = rgbaFromTuple(colors.shadowRgb, 0.74);
        ctx.fillRect((w - toastW) / 2, toastY - toastH / 2, toastW, toastH);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = powerColor(state.lastPowerUpEvent.key);
        ctx.lineWidth = 2;
        ctx.strokeRect((w - toastW) / 2, toastY - toastH / 2, toastW, toastH);
        ctx.fillStyle = powerColor(state.lastPowerUpEvent.key);
        ctx.fillText(powerToast, w / 2, toastY);
        ctx.restore();
      }
    }

    // Juice: smash flash
    if (juice.flashType === "smash" && juice.flashUntil > n && colors.smashFlashColor) {
      var smashFlashDur = requiredConfigNumber(this.config?.juice?.smashFlashMs, "juice.smashFlashMs", { min: 1, integer: true });
      var flashP = 1 - (juice.flashUntil - n) / smashFlashDur;
      var flashA = Math.max(0, 0.8 * (1 - flashP));
      ctx.fillStyle = "rgba(" + colors.smashFlashColor + "," + flashA.toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(juice.flashX, juice.flashY, 20 + flashP * 40, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sprint-only success pulse: balance the strong penalty stack with a brief reward signal.
    var sprintSuccessMs = Number(this.config?.juice?.sprintSuccessPulseMs);
    if (state.mode === MODES.SPRINT && perfTier < perfCfg.hideSprintSuccessPulseAtTier && juice.sprintSuccessUntil > n && Number.isFinite(sprintSuccessMs) && sprintSuccessMs > 0 && colors.smashFlashColor) {
      var ssElapsed = sprintSuccessMs - (juice.sprintSuccessUntil - n);
      var ssT = Math.min(1, Math.max(0, ssElapsed / sprintSuccessMs));
      var ssA = Math.max(0, 0.18 * (1 - ssT));
      var sprintGrad = ctx.createRadialGradient(w / 2, h * 0.18, 0, w / 2, h * 0.18, w * 0.7);
      sprintGrad.addColorStop(0, "rgba(" + colors.smashFlashColor + "," + ssA.toFixed(2) + ")");
      sprintGrad.addColorStop(1, "rgba(" + colors.smashFlashColor + ",0)");
      ctx.fillStyle = sprintGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Juice: fault vignette
    if (juice.flashType === "fault" && juice.flashUntil > n) {
      var faultFlashDur = requiredConfigNumber(this.config?.juice?.faultFlashMs, "juice.faultFlashMs", { min: 1, integer: true });
      var faultP = 1 - (juice.flashUntil - n) / faultFlashDur;
      var faultA = Math.max(0, 0.3 * (1 - faultP));
      var vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.8);
      var _fvc = colors.faultVignetteColor;
      vigGrad.addColorStop(0, "rgba(" + _fvc + ",0)");
      vigGrad.addColorStop(1, "rgba(" + _fvc + "," + faultA.toFixed(2) + ")");
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Score popups
    var scorePopupMs = requiredConfigNumber(this.config?.canvas?.scorePopupMs, "canvas.scorePopupMs", { min: 1, integer: true });
    if (juice.scorePopups && colors.scorePopup) {
      for (var sp = juice.scorePopups.length - 1; sp >= 0; sp--) {
        var popup = juice.scorePopups[sp];
        var popElapsed = n - popup.at;
        if (popElapsed > scorePopupMs) { juice.scorePopups.splice(sp, 1); continue; }
        var popT = popElapsed / scorePopupMs;
        var popupText = String(popup.text || "").trim();
        var popupTimingLabel = (perfTier >= perfCfg.hideScoreTimingLabelAtTier) ? "" : String(popup.timingLabel || "").trim();
        if (!popupText && !popupTimingLabel) { juice.scorePopups.splice(sp, 1); continue; }
        ctx.globalAlpha = Math.max(0, 1 - popT);
        ctx.font = "bold " + Math.round(22 + (1 - popT) * 6) + "px system-ui, sans-serif";
        ctx.fillStyle = colors.scorePopup;
        ctx.textAlign = "center";
        if (popupText) ctx.fillText(popupText, popup.x, popup.y - popT * 50);
        if (popupTimingLabel) {
          ctx.font = "bold " + Math.round(14 + (1 - popT) * 4) + "px system-ui, sans-serif";
          ctx.fillText(popupTimingLabel, popup.x, popup.y - 18 - popT * 50);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Sprint penalty flash
    if (juice.sprintPenaltyUntil > n) {
      var penP = 1 - (juice.sprintPenaltyUntil - n) / 400;
      var penA = Math.max(0, 0.9 * (1 - penP));
      ctx.font = "bold 28px system-ui, sans-serif";
      ctx.fillStyle = "rgba(" + colors.faultVignetteColor + "," + penA.toFixed(2) + ")";
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
  UI.prototype._renderBallV2 = function (ctx, b, colors, w, h, gt, n, juice) {
    var BALL_STATES = this.gameApi && this.gameApi.BALL_STATES;
    if (!BALL_STATES) return;
    var _uw2 = (this.wording && this.wording.ui) || {};
    var perfCfg = this._getRenderPerfConfig();
    var perfTier = this._getRenderPerfTier();
    var shadowMinScale = requiredConfigNumber(this.config?.canvas?.shadowMinScale, "canvas.shadowMinScale", { min: 0.05, max: 3 });
    var shadowMaxScale = requiredConfigNumber(this.config?.canvas?.shadowMaxScale, "canvas.shadowMaxScale", { min: 0.05, max: 4 });
    var landingMarkerRadiusPx = requiredConfigNumber(this.config?.canvas?.landingMarkerRadiusPx, "canvas.landingMarkerRadiusPx", { min: 1, integer: true });
    var landingMarkerPulseMs = requiredConfigNumber(this.config?.canvas?.landingMarkerPulseMs, "canvas.landingMarkerPulseMs", { min: 1, integer: true });
    var bounceSquashMaxFrac = requiredConfigNumber(this.config?.canvas?.bounceSquashMaxFrac, "canvas.bounceSquashMaxFrac", { min: 0, max: 0.8 });
    var serveLabelMs = requiredConfigNumber(this.config?.canvas?.serveLabelMs, "canvas.serveLabelMs", { min: 1, max: 4000, integer: true });
    var specialBallBadgeMs = requiredConfigNumber(this.config?.canvas?.specialBallBadgeMs, "canvas.specialBallBadgeMs", { min: 1, max: 4000, integer: true });
    var ballOutlineWidth = requiredConfigNumber(this.config?.canvas?.ballOutlineWidth, "canvas.ballOutlineWidth", { min: 0.5, max: 6 });
    var ballGlowScale = requiredConfigNumber(this.config?.canvas?.ballGlowScale, "canvas.ballGlowScale", { min: 1, max: 3 });
    var impactDustCount = requiredConfigNumber(this.config?.canvas?.impactDustCount, "canvas.impactDustCount", { min: 0, max: 24, integer: true });
    var trailSegments = requiredConfigNumber(this.config?.canvas?.trajectoryTrailSegments, "canvas.trajectoryTrailSegments", { min: 0, max: 12, integer: true });
    var trailAlpha = requiredConfigNumber(this.config?.canvas?.trajectoryTrailAlpha, "canvas.trajectoryTrailAlpha", { min: 0, max: 1 });
    var effectiveDustCount = impactDustCount;
    var effectiveTrailSegments = trailSegments;
    var showReturnTrail = true;
    if (perfTier === 1) {
      effectiveDustCount = Math.min(impactDustCount, perfCfg.lowQualityDustCount);
      effectiveTrailSegments = Math.min(trailSegments, perfCfg.lowQualityTrailSegments);
    } else if (perfTier >= 2) {
      effectiveDustCount = Math.min(impactDustCount, perfCfg.minQualityDustCount);
      effectiveTrailSegments = Math.min(trailSegments, perfCfg.minQualityTrailSegments);
    }
    if (perfTier >= perfCfg.hideReturnTrailAtTier) showReturnTrail = false;
    var courtCfg = this.config?.court || {};
    var netY = requiredConfigNumber(courtCfg.netY, "KR_CONFIG.court.netY", { min: 0.05, max: 0.3 }) * h;
    var baseY = requiredConfigNumber(courtCfg.baselineY, "KR_CONFIG.court.baselineY", { min: 0.5, max: 0.99 }) * h;
    var targetDepthY = (b.worldTargetY != null) ? b.worldTargetY : b.targetY;
    var depthRatio = Math.max(0, Math.min(1, (targetDepthY - netY) / Math.max(1, baseY - netY)));
    var markerScale = 0.8 + depthRatio * 0.4;
    var specialBallLabel = "";
    if (b.ballType === "dink") specialBallLabel = String((_uw2 && _uw2.specialBallDink) || "").trim();
    else if (b.ballType === "lob") specialBallLabel = String((_uw2 && _uw2.specialBallLob) || "").trim();
    else if (b.ballType === "fast") specialBallLabel = String((_uw2 && _uw2.specialBallFast) || "").trim();
    else if (b.ballType === "skid") specialBallLabel = String((_uw2 && _uw2.specialBallSkid) || "").trim();
    else if (b.ballType === "heavy") specialBallLabel = String((_uw2 && _uw2.specialBallHeavy) || "").trim();
    var specialBallPrefix = String((_uw2 && _uw2.specialBallPrefix) || "").trim();
    if (specialBallPrefix && specialBallLabel) specialBallLabel = specialBallPrefix + " " + specialBallLabel;
    var showServeLabel = !!(b.isServe && (b.state === BALL_STATES.TRAVELING || b.state === BALL_STATES.LANDED) && (gt - b.spawnedAt) <= serveLabelMs);
    var showSpecialBadge = !!(
      specialBallLabel &&
      (b.state === BALL_STATES.TRAVELING || b.state === BALL_STATES.LANDED || b.state === BALL_STATES.BOUNCED) &&
      (gt - b.spawnedAt) <= specialBallBadgeMs &&
      !showServeLabel &&
      perfTier < perfCfg.hideSpecialBallBadgesAtTier &&
      !(mustBounceReason === "kitchen" && b.state === BALL_STATES.TRAVELING)
    );

    // V3: Show "MUST BOUNCE" indicator from the explicit ball state.
    var mustBounce = !!b.mustBounce;
    var mustBounceReason = String(b.mustBounceReason || "");
    if (mustBounce && b.state === BALL_STATES.TRAVELING) {
      var mbAlpha = 0.4 + 0.2 * Math.sin(gt / 150);
      ctx.globalAlpha = mbAlpha;
      ctx.font = "bold " + Math.round(w * 0.022) + "px system-ui, sans-serif";
      ctx.fillStyle = colors.waitIndicator;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      var mbLabel = (mustBounceReason === "double_bounce")
        ? String((_uw2 && _uw2.doubleBounceLabel) || "").trim()
        : String((_uw2 && _uw2.waitLabel) || "").trim();
      if (mbLabel) ctx.fillText(mbLabel, b.targetX, b.targetY + b.radius + 4);
      ctx.globalAlpha = 1;
    }

    if (mustBounce && (b.state === BALL_STATES.TRAVELING || b.state === BALL_STATES.LANDED)) {
      var pulseT = (gt % landingMarkerPulseMs) / landingMarkerPulseMs;
      var markerRadius = (landingMarkerRadiusPx + pulseT * 10) * markerScale;
      var markerAlpha = (b.state === BALL_STATES.LANDED) ? 0.55 : (0.2 + (1 - pulseT) * 0.22);
      var markerColor = colors.waitIndicator;
      ctx.save();
      ctx.globalAlpha = markerAlpha;
      ctx.strokeStyle = markerColor;
      ctx.lineWidth = ((b.state === BALL_STATES.LANDED) ? 3 : 2) * markerScale;
      ctx.beginPath();
      ctx.arc(b.targetX, b.targetY, markerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }


    // Shadow at bounce point (grows as ball approaches)
    if (b.state === BALL_STATES.TRAVELING || b.state === BALL_STATES.LANDED || b.state === BALL_STATES.BOUNCED) {
      var shadowProgress = (b.state === BALL_STATES.TRAVELING) ? Math.min(1, Math.max(0, (gt - b.spawnedAt) / b.travelMs)) : 1;
      var shadowAlpha = 0.12 + shadowProgress * 0.28;
      var shadowW = b.radius * (shadowMinScale + shadowProgress * (shadowMaxScale - shadowMinScale));
      var shadowX = (b.state === BALL_STATES.TRAVELING)
        ? (b.x + (b.targetX - b.x) * 0.45)
        : b.targetX;
      ctx.globalAlpha = shadowAlpha;
      ctx.fillStyle = colors.shadow;
      ctx.beginPath();
      ctx.ellipse(shadowX, b.shadowY + b.radius * 0.3, shadowW, shadowW * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Ball color by type
    var bt = b.ballType || "normal";
    if (bt === "dink" && colors.ballDink) ctx.fillStyle = colors.ballDink;
    else if (bt === "lob" && colors.ballLob) ctx.fillStyle = colors.ballLob;
    else if (bt === "fast" && colors.ballFast) ctx.fillStyle = colors.ballFast;
    else if (bt === "skid" && colors.ballSkid) ctx.fillStyle = colors.ballSkid;
    else if (bt === "heavy" && colors.ballHeavy) ctx.fillStyle = colors.ballHeavy;
    else ctx.fillStyle = colors.ballDefault;

    if (b.state === BALL_STATES.TRAVELING || b.state === BALL_STATES.LANDED || b.state === BALL_STATES.BOUNCED) {
      if (b.state === BALL_STATES.TRAVELING && effectiveTrailSegments > 0) {
        ctx.save();
        for (var ti = effectiveTrailSegments; ti >= 1; ti--) {
          var trailT = ti / (effectiveTrailSegments + 1);
          var trailX = b.x + ((b.shadowY != null ? b.targetX : b.x) - b.x) * trailT * 0.18;
          var trailY = b.y + ((b.shadowY != null ? b.shadowY : b.y) - b.y) * trailT * 0.35;
          var trailScale = 1 - trailT * 0.22;
          ctx.globalAlpha = trailAlpha * (1 - trailT * 0.5);
          ctx.fillStyle = colors.trajectoryTrail;
          ctx.beginPath();
          ctx.ellipse(trailX, trailY, b.radius * trailScale, b.radius * trailScale * 0.78, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // WAIT indicator for kitchen balls in flight
      if (mustBounceReason === "kitchen" && b.state === BALL_STATES.TRAVELING) {
        var waitAlpha = 0.5 + 0.3 * Math.sin(gt / 200);
        ctx.globalAlpha = waitAlpha;
        ctx.font = "bold " + Math.round(b.radius * 1.1) + "px system-ui, sans-serif";
        ctx.fillStyle = colors.waitIndicator;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        var waitLabel = String((_uw2 && _uw2.waitLabel) || "").trim();
        if (waitLabel) ctx.fillText(waitLabel, b.x, b.y - b.radius - 6);
        ctx.globalAlpha = 1;
        if (bt === "dink" && colors.ballDink) ctx.fillStyle = colors.ballDink;
        else if (bt === "lob" && colors.ballLob) ctx.fillStyle = colors.ballLob;
        else if (bt === "fast" && colors.ballFast) ctx.fillStyle = colors.ballFast;
        else if (bt === "skid" && colors.ballSkid) ctx.fillStyle = colors.ballSkid;
        else if (bt === "heavy" && colors.ballHeavy) ctx.fillStyle = colors.ballHeavy;
        else ctx.fillStyle = colors.ballDefault;
      }

      if (bt === "lob") {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = colors.highlightWhite;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y - b.radius * 1.2, b.radius * 0.95, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (bt === "fast") {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = colors.ballFast || colors.ballDefault;
        ctx.lineWidth = Math.max(1, b.radius * 0.18);
        ctx.beginPath();
        ctx.moveTo(b.x - b.radius * 2.1, b.y + b.radius * 0.25);
        ctx.lineTo(b.x - b.radius * 0.5, b.y + b.radius * 0.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(b.x - b.radius * 1.7, b.y - b.radius * 0.2);
        ctx.lineTo(b.x - b.radius * 0.3, b.y - b.radius * 0.12);
        ctx.stroke();
        ctx.restore();
      } else if (bt === "skid") {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = colors.ballSkid || colors.ballDefault;
        ctx.lineWidth = Math.max(1, b.radius * 0.16);
        ctx.beginPath();
        ctx.moveTo(b.x - b.radius * 2.4, b.y + b.radius * 0.6);
        ctx.lineTo(b.x - b.radius * 0.2, b.y + b.radius * 0.2);
        ctx.stroke();
        ctx.restore();
      } else if (bt === "heavy") {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = colors.ballHeavy || colors.ballDefault;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (bt === "dink") {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = colors.ballDink || colors.ballDefault;
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 1.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (showServeLabel) {
        var serveLabel = String((_uw2 && _uw2.serveLabel) || "").trim();
        if (serveLabel) {
          ctx.globalAlpha = 0.92;
          ctx.font = "bold " + Math.round(Math.max(10, b.radius * 1.05)) + "px system-ui, sans-serif";
          ctx.fillStyle = colors.highlightWhite;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(serveLabel, b.x, b.y - b.radius - 22);
          ctx.globalAlpha = 1;
        }
      }

      if (showSpecialBadge) {
        var badgeY = b.y - b.radius - (mustBounceReason === "kitchen" && b.state === BALL_STATES.TRAVELING ? 28 : 14);
        var badgeFont = Math.round(Math.max(10, b.radius * 0.95));
        ctx.save();
        ctx.font = "bold " + badgeFont + "px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        var badgePadX = Math.round(badgeFont * 0.65);
        var badgePadY = Math.round(badgeFont * 0.4);
        var badgeW = ctx.measureText(specialBallLabel).width + badgePadX * 2;
        var badgeH = badgeFont + badgePadY * 2;
        ctx.globalAlpha = 0.78;
        ctx.fillStyle = colors.powerBadgeBg;
        ctx.fillRect(b.x - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = ctx.fillStyle;
        if (b.ballType === "dink" && colors.ballDink) ctx.strokeStyle = colors.ballDink;
        else if (b.ballType === "lob" && colors.ballLob) ctx.strokeStyle = colors.ballLob;
        else if (b.ballType === "fast" && colors.ballFast) ctx.strokeStyle = colors.ballFast;
        else if (b.ballType === "skid" && colors.ballSkid) ctx.strokeStyle = colors.ballSkid;
        else if (b.ballType === "heavy" && colors.ballHeavy) ctx.strokeStyle = colors.ballHeavy;
        ctx.strokeRect(b.x - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH);
        ctx.fillStyle = colors.highlightWhite;
        ctx.fillText(specialBallLabel, b.x, badgeY);
        ctx.restore();
      }

      if (mustBounce && b.state === BALL_STATES.LANDED) {
        var landedAlpha = 0.55 + 0.25 * Math.sin(gt / 140);
        ctx.globalAlpha = Math.max(0.2, landedAlpha);
        ctx.font = "bold " + Math.round(b.radius * 1.25) + "px system-ui, sans-serif";
        ctx.fillStyle = colors.waitIndicator;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        var landedLabel = String((_uw2 && _uw2.waitLabel) || "").trim();
        if (landedLabel) ctx.fillText(landedLabel, b.targetX, b.targetY - b.radius - 10);
        ctx.globalAlpha = 1;
      }

      if (mustBounceReason === "kitchen" && b.state === BALL_STATES.BOUNCED) {
        var kitchenOpenLabel = String((_uw2 && _uw2.kitchenOpenLabel) || "").trim();
        if (kitchenOpenLabel) {
          ctx.globalAlpha = 0.85;
          ctx.font = "bold " + Math.round(b.radius * 1.1) + "px system-ui, sans-serif";
          ctx.fillStyle = colors.bounceRing;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(kitchenOpenLabel, b.x, b.y + b.radius + 10);
          ctx.globalAlpha = 1;
        }
      }

      // V3: BOUNCE IMPACT — big visible feedback
      if (b.state === BALL_STATES.BOUNCED && b.bouncedAt > 0) {
        var sinceBounce = gt - b.bouncedAt;

        // 1) Impact shockwave (expands from bounce point)
        if (sinceBounce < 400) {
          var shockT = sinceBounce / 400;
          var shockAlpha = Math.max(0, 0.8 * (1 - shockT));
          ctx.strokeStyle = rgbaFromTuple(colors.whiteRgb, shockAlpha);
          ctx.lineWidth = Math.max(0.5, (3 - shockT * 2) * markerScale);
          ctx.beginPath();
          ctx.arc(b.targetX, b.targetY, b.radius + shockT * 35 * markerScale, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 2) Ground impact mark
        if (sinceBounce < 500) {
          var impactT = sinceBounce / 500;
          ctx.globalAlpha = Math.max(0, 0.5 * (1 - impactT));
          ctx.fillStyle = b.inKitchen ? colors.kitchenLine : colors.highlightWhite;
          ctx.beginPath();
          ctx.ellipse(b.targetX, b.targetY, b.radius * (1 + impactT * 0.5), b.radius * 0.3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // 3) Dust particles
        if (sinceBounce < 350) {
          var dustT = sinceBounce / 350;
          for (var di = 0; di < effectiveDustCount; di++) {
            var dustCenter = (effectiveDustCount - 1) / 2;
            var dAngle = (Math.PI / 2) + (di - dustCenter) * 0.34;
            var dDist = dustT * 25;
            var dSize = 2 * (1 - dustT);
            if (dSize > 0) {
              ctx.globalAlpha = Math.max(0, 0.6 * (1 - dustT));
              ctx.fillStyle = rgbaFromTuple(colors.whiteRgb, 0.5);
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
          var ringColor = b.inKitchen ? colors.kitchenLine : colors.bounceRingFlash;
          ctx.strokeStyle = ringColor;
          ctx.globalAlpha = bAlpha;
          ctx.lineWidth = 3 * markerScale;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius + 4 * markerScale + (sinceBounce / 300) * 18 * markerScale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;

          if (sinceBounce < 200) {
            ctx.globalAlpha = bAlpha;
            ctx.font = "bold " + Math.round(b.radius * 1.4) + "px system-ui, sans-serif";
            ctx.fillStyle = ringColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            var bounceLabel = b.inKitchen
              ? String((_uw2 && _uw2.nowLabel) || "").trim()
              : String((_uw2 && _uw2.goLabel) || "").trim();
            if (bounceLabel) ctx.fillText(bounceLabel, b.x, b.y - b.radius - 10);
            ctx.globalAlpha = 1;
          }

          if (!juice.bounceFlashBalls[b.id]) {
            juice.bounceFlashBalls[b.id] = true;
            this._playSound("bounce");
          }
        }

        // 5) Pulsing ring while waiting
        var pulseScale = 1 + 0.12 * Math.sin(gt / 70);
        ctx.strokeStyle = colors.bounceRing;
        ctx.lineWidth = 2 * markerScale;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(b.x, b.y, (b.radius + 6 * markerScale) * pulseScale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Ball with glow
      var squash = Math.max(0, Math.min(1, Number(b.squash) || 0));
      var ballRadiusX = b.radius * (1 + bounceSquashMaxFrac * squash);
      var ballRadiusY = b.radius * (1 - bounceSquashMaxFrac * 0.7 * squash);
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = ctx.fillStyle;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, ballRadiusX * ballGlowScale, ballRadiusY * ballGlowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (bt === "dink" && colors.ballDink) ctx.fillStyle = colors.ballDink;
      else if (bt === "lob" && colors.ballLob) ctx.fillStyle = colors.ballLob;
      else if (bt === "fast" && colors.ballFast) ctx.fillStyle = colors.ballFast;
      else if (bt === "skid" && colors.ballSkid) ctx.fillStyle = colors.ballSkid;
      else if (bt === "heavy" && colors.ballHeavy) ctx.fillStyle = colors.ballHeavy;
      else ctx.fillStyle = colors.ballDefault;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, ballRadiusX, ballRadiusY, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = ballOutlineWidth;
      ctx.strokeStyle = colors.ballOutline;
      ctx.stroke();
      ctx.restore();

      // Highlight
      var grad = ctx.createRadialGradient(b.x - ballRadiusX * 0.3, b.y - ballRadiusY * 0.3, Math.min(ballRadiusX, ballRadiusY) * 0.1, b.x, b.y, Math.max(ballRadiusX, ballRadiusY));
      grad.addColorStop(0, colors.highlightWhite);
      grad.addColorStop(1, rgbaFromTuple(colors.whiteRgb, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, ballRadiusX, ballRadiusY, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // HIT: returning to opponent
    if (b.state === "HIT" || b.state === BALL_STATES.HIT) {
      var sinceHit = gt - b.hitAt;
      var retT = Math.min(1, sinceHit / (b.returnTravelMs || 500));
      if (showReturnTrail && effectiveTrailSegments > 0) {
        ctx.save();
        for (var rti = effectiveTrailSegments; rti >= 1; rti--) {
          var returnTrailT = rti / (effectiveTrailSegments + 1);
          ctx.globalAlpha = trailAlpha * 1.15 * (1 - returnTrailT * 0.45) * (1 - retT * 0.35);
          ctx.fillStyle = colors.returnTrail;
          ctx.beginPath();
          ctx.arc(
            b.x + (returnTrailT * 18),
            b.y + (returnTrailT * 10),
            Math.max(1.5, b.radius * (0.9 - returnTrailT * 0.18)),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalAlpha = Math.max(0, 1 - retT * 0.7);
      ctx.fillStyle = colors.ballSmashed;
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
        ctx.fillStyle = colors.ballFaulted;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + (sinceFault / 400) * 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (b.savedByShield && sinceFault < 700) {
        var shieldSaveLabel = String((_uw2 && _uw2.powerUpSavedByShield) || "").trim();
        if (shieldSaveLabel) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, 0.95 * (1 - sinceFault / 700));
          ctx.font = "bold " + Math.round(Math.max(12, b.radius * 1.1)) + "px system-ui, sans-serif";
          ctx.fillStyle = colors.powerUpShield || colors.highlightWhite;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(shieldSaveLabel, b.x, b.y - b.radius - 12);
          ctx.restore();
        }
      }
    }

    // MISSED
    if (b.state === "MISSED" && b.missedAt > 0) {
      var sinceMiss = gt - b.missedAt;
      if (sinceMiss < 500) {
        ctx.globalAlpha = Math.max(0, 0.4 * (1 - sinceMiss / 500));
        ctx.fillStyle = colors.ballMissed;
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
  UI.prototype._renderPlayerV2 = function (ctx, x, y, pState, colors, w, h, n, court, worldY, ball) {
    var pColor = colors.playerColor;
    var pOutline = colors.playerOutline;
    var pGlow = colors.playerGlow;
    var playerOutlineWidth = requiredConfigNumber(this.config?.canvas?.playerOutlineWidth, "canvas.playerOutlineWidth", { min: 0.5, max: 6 });
    var actorIdleBreathePx = requiredConfigNumber(this.config?.canvas?.actorIdleBreathePx, "canvas.actorIdleBreathePx", { min: 0, max: 12 });
    var playerRunLeanPx = requiredConfigNumber(this.config?.canvas?.playerRunLeanPx, "canvas.playerRunLeanPx", { min: 0, max: 20 });
    var playerSwingArcScale = requiredConfigNumber(this.config?.canvas?.playerSwingArcScale, "canvas.playerSwingArcScale", { min: 0.5, max: 3 });
    var playerPaddleWidthPx = requiredConfigNumber(this.config?.canvas?.playerPaddleWidthPx, "canvas.playerPaddleWidthPx", { min: 1, max: 32 });
    var playerPaddleHeightPx = requiredConfigNumber(this.config?.canvas?.playerPaddleHeightPx, "canvas.playerPaddleHeightPx", { min: 1, max: 48 });
    var playerPaddleCornerPx = requiredConfigNumber(this.config?.canvas?.playerPaddleCornerPx, "canvas.playerPaddleCornerPx", { min: 0, max: 12 });
    var playerPaddleReachPx = requiredConfigNumber(this.config?.canvas?.playerPaddleReachPx, "canvas.playerPaddleReachPx", { min: 1, max: 40 });

    // Scale relative to screen + depth in the frontal court view.
    var depthScaleNear = requiredConfigNumber(this.config?.canvas?.playerDepthScaleNear, "canvas.playerDepthScaleNear", { min: 0.5, max: 2 });
    var depthScaleFar = requiredConfigNumber(this.config?.canvas?.playerDepthScaleFar, "canvas.playerDepthScaleFar", { min: 0.5, max: 2 });
    var netY = court ? court.netY * h : (h * 0.26);
    var baseY = court ? court.baselineY * h : (h * 0.88);
    var depthSourceY = (worldY != null) ? worldY : y;
    var depthRatio = (depthSourceY - netY) / Math.max(1, baseY - netY);
    depthRatio = Math.max(0, Math.min(1, depthRatio));
    var depthScale = depthScaleNear + (depthScaleFar - depthScaleNear) * depthRatio;
    var scale = (Math.min(w, h) / 500) * depthScale;
    var S = function (v) { return v * scale; };

    // Animation phase
    var t = n / 1000;
    var breathe = Math.sin(t * 2) * actorIdleBreathePx; // idle breathing
    var runCycle = Math.sin(t * 12) * 0.5; // running leg cycle
    var isRunning = (pState === "runLeft" || pState === "runRight");
    var isSwinging = (pState === "swing");
    var readySet = isRunning ? 0 : 1;
    var swingSide = 1;
    if (isSwinging && ball && Number.isFinite(ball.x) && ball.x < x) swingSide = -1;

    // Lean when running
    var lean = 0;
    if (pState === "runLeft") lean = S(playerRunLeanPx);
    if (pState === "runRight") lean = S(-playerRunLeanPx);

    ctx.save();
    ctx.translate(x + lean, y + S(readySet * 0.9));

    // Shadow on ground
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = rgbaFromTuple(colors.shadowRgb, 1);
    ctx.beginPath();
    ctx.ellipse(0, S(22), S(14), S(4), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Flat glow underlay for phone readability. No blur.
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = pGlow;
    ctx.beginPath();
    ctx.ellipse(0, S(-4), S(15), S(24), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── Legs (dynamic, animated) ──
    ctx.fillStyle = pOutline;
    var legSpread = isRunning ? runCycle * S(6) : 0;
    var kneeLift = isRunning ? Math.max(0, runCycle) * S(2.8) : 0;
    // Left leg
    ctx.beginPath();
    ctx.moveTo(S(-4), S(8));
    ctx.quadraticCurveTo(S(-5) - legSpread, S(15) - kneeLift, S(-3) - legSpread, S(20));
    ctx.lineTo(S(-1) - legSpread, S(20));
    ctx.quadraticCurveTo(S(-2), S(14), S(-1), S(8));
    ctx.fill();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(S(4), S(8));
    ctx.quadraticCurveTo(S(5) + legSpread, S(15) + kneeLift, S(3) + legSpread, S(20));
    ctx.lineTo(S(1) + legSpread, S(20));
    ctx.quadraticCurveTo(S(2), S(14), S(1), S(8));
    ctx.fill();

    // ── Body (torso — smooth curved shape) ──
    ctx.fillStyle = pColor;
    ctx.beginPath();
    ctx.moveTo(S(-8), S(6)); // left hip
    ctx.quadraticCurveTo(S(-10), S(-2), S(-7), S(-12) - S(readySet)); // left side up
    ctx.quadraticCurveTo(S(-3), S(-16) + breathe - S(readySet * 1.4), 0, S(-16) + breathe - S(readySet * 1.4)); // left shoulder to center
    ctx.quadraticCurveTo(S(3), S(-16) + breathe - S(readySet * 1.4), S(7), S(-12) - S(readySet)); // center to right shoulder
    ctx.quadraticCurveTo(S(10), S(-2), S(8), S(6)); // right side down
    ctx.closePath();
    ctx.fill();

    // Body outline
    ctx.strokeStyle = pOutline;
    ctx.lineWidth = S(playerOutlineWidth);
    ctx.stroke();

    // ── Head ──
    ctx.fillStyle = pColor;
    ctx.beginPath();
    ctx.arc(0, S(-20), S(7), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pOutline;
    ctx.lineWidth = S(playerOutlineWidth);
    ctx.stroke();

    // Head highlight
    ctx.fillStyle = rgbaFromTuple(colors.whiteRgb, 0.2);
    ctx.beginPath();
    ctx.arc(S(-2), S(-22), S(3), 0, Math.PI * 2);
    ctx.fill();

    // ── Paddle arm ──
    var armBaseX = S(8 * swingSide);
    var armBaseY = S(-8);
    var paddleAngle = isSwinging ? (-0.95 + Math.sin(n / 50) * 0.45)
      : isRunning ? (pState === "runLeft" ? 0.3 : -0.3)
      : -0.1 + breathe * 0.02;

    ctx.save();
    ctx.translate(armBaseX, armBaseY);
    if (swingSide < 0) ctx.scale(-1, 1);
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
    var px = S(playerPaddleReachPx - (playerPaddleWidthPx * 0.4));
    var py = S(-(playerPaddleHeightPx * 0.45));
    var pw = S(playerPaddleWidthPx);
    var pph = S(playerPaddleHeightPx);
    var pr = S(playerPaddleCornerPx);
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
    ctx.strokeStyle = rgbaFromTuple(colors.whiteRgb, 0.32);
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
      ctx.strokeStyle = colors.motionLines;
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
      ctx.strokeStyle = rgbaFromTuple(colors.whiteRgb, 0.4);
      ctx.lineWidth = S(2);
      var swingPhase = (n % 300) / 300;
      ctx.globalAlpha = 0.5 * (1 - swingPhase);
      ctx.save();
      if (swingSide < 0) ctx.scale(-1, 1);
      ctx.beginPath();
      ctx.arc(S(18), S(-6), (S(10) + swingPhase * S(15)) * playerSwingArcScale, -0.62, 0.95);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    ctx.restore(); // main player transform
  };

  UI.prototype._renderOpponentV2 = function (ctx, x, y, oState, colors, w, h, n, oppScale, ball, worldY) {
    var depthScale = Math.max(0.38, Math.min(1.2, Number(oppScale || 0.55) + 0.2));
    var scale = (Math.min(w, h) / 500) * depthScale;
    var S = function (v) { return v * scale; };
    var isSwinging = (oState === "swing");
    var swingBeat = isSwinging ? Math.sin((n / 1000) * 16) : 0;
    var armReach = isSwinging ? S(8 + swingBeat * 2) : S(4);
    var racketReach = isSwinging ? S(14 + swingBeat * 3) : S(8);
    var opponentOutlineWidth = requiredConfigNumber(this.config?.canvas?.opponentOutlineWidth, "canvas.opponentOutlineWidth", { min: 0.5, max: 6 });
    var actorIdleBreathePx = requiredConfigNumber(this.config?.canvas?.actorIdleBreathePx, "canvas.actorIdleBreathePx", { min: 0, max: 12 });
    var opponentReadyOffsetPx = requiredConfigNumber(this.config?.canvas?.opponentReadyOffsetPx, "canvas.opponentReadyOffsetPx", { min: 0, max: 12 });
    var opponentSwingArcScale = requiredConfigNumber(this.config?.canvas?.opponentSwingArcScale, "canvas.opponentSwingArcScale", { min: 0.5, max: 3 });
    var opponentPaddleWidthPx = requiredConfigNumber(this.config?.canvas?.opponentPaddleWidthPx, "canvas.opponentPaddleWidthPx", { min: 1, max: 32 });
    var opponentPaddleHeightPx = requiredConfigNumber(this.config?.canvas?.opponentPaddleHeightPx, "canvas.opponentPaddleHeightPx", { min: 1, max: 48 });
    var opponentPaddleCornerPx = requiredConfigNumber(this.config?.canvas?.opponentPaddleCornerPx, "canvas.opponentPaddleCornerPx", { min: 0, max: 12 });
    var opponentPaddleReachPx = requiredConfigNumber(this.config?.canvas?.opponentPaddleReachPx, "canvas.opponentPaddleReachPx", { min: 1, max: 40 });
    var breathe = Math.sin((n / 1000) * 2) * actorIdleBreathePx;
    var racketSide = 1;
    if (ball && Number.isFinite(ball.x) && ball.x < x) racketSide = -1;

    ctx.save();
    ctx.translate(x, y + S(opponentReadyOffsetPx) - S(isSwinging ? 0 : 0.6));

    ctx.globalAlpha = 0.22;
    ctx.fillStyle = colors.opponentShadow;
    ctx.beginPath();
    ctx.ellipse(0, S(18), S(12), S(3.2), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = colors.opponentFill;
    ctx.strokeStyle = colors.opponentOutline;
    ctx.lineWidth = S(opponentOutlineWidth);

    ctx.beginPath();
    ctx.arc(0, S(-15) + S(breathe * 0.35), S(5.2), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(S(-6), S(4));
    ctx.quadraticCurveTo(S(-8), S(-5), S(-5), S(-11));
    ctx.quadraticCurveTo(S(-2), S(-14) + S(breathe * 0.2), 0, S(-14) + S(breathe * 0.2));
    ctx.quadraticCurveTo(S(2), S(-14) + S(breathe * 0.2), S(5), S(-11));
    ctx.quadraticCurveTo(S(8), S(-5), S(6), S(4));
    ctx.quadraticCurveTo(S(3), S(8), 0, S(8));
    ctx.quadraticCurveTo(S(-3), S(8), S(-6), S(4));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(S(-5), S(8));
    ctx.lineTo(S(-2), S(18));
    ctx.lineTo(S(0), S(8));
    ctx.lineTo(S(2), S(18));
    ctx.lineTo(S(5), S(8));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(S(5 * -racketSide), S(-5));
    ctx.lineTo(S(9 * -racketSide), S(1));
    ctx.moveTo(S(5 * racketSide), S(-5));
    ctx.lineTo(armReach * racketSide, S(-6));
    ctx.stroke();

    ctx.save();
    ctx.translate(0, 0);
    if (racketSide < 0) ctx.scale(-1, 1);
    ctx.strokeStyle = colors.opponentRacket;
    ctx.beginPath();
    ctx.moveTo(armReach, S(-6));
    ctx.lineTo(racketReach, S(-10));
    ctx.stroke();

    ctx.beginPath();
    var oppPadX = racketReach + S(1.2);
    var oppPadY = S(-(opponentPaddleHeightPx * 0.52));
    var oppPadW = S(opponentPaddleWidthPx);
    var oppPadH = S(opponentPaddleHeightPx);
    var oppPadR = S(opponentPaddleCornerPx);
    ctx.moveTo(oppPadX + oppPadR, oppPadY);
    ctx.lineTo(oppPadX + oppPadW - oppPadR, oppPadY);
    ctx.quadraticCurveTo(oppPadX + oppPadW, oppPadY, oppPadX + oppPadW, oppPadY + oppPadR);
    ctx.lineTo(oppPadX + oppPadW, oppPadY + oppPadH - oppPadR);
    ctx.quadraticCurveTo(oppPadX + oppPadW, oppPadY + oppPadH, oppPadX + oppPadW - oppPadR, oppPadY + oppPadH);
    ctx.lineTo(oppPadX + oppPadR, oppPadY + oppPadH);
    ctx.quadraticCurveTo(oppPadX, oppPadY + oppPadH, oppPadX, oppPadY + oppPadH - oppPadR);
    ctx.lineTo(oppPadX, oppPadY + oppPadR);
    ctx.quadraticCurveTo(oppPadX, oppPadY, oppPadX + oppPadR, oppPadY);
    ctx.stroke();
    ctx.restore();

    if (isSwinging) {
      ctx.strokeStyle = rgbaFromTuple(colors.whiteRgb, 0.18);
      ctx.lineWidth = S(1.2);
      ctx.save();
      if (racketSide < 0) ctx.scale(-1, 1);
      ctx.beginPath();
      ctx.arc(S(10), S(-8), (S(10) + Math.max(0, swingBeat) * S(6)) * opponentSwingArcScale, -0.9, 0.5);
      ctx.stroke();
      ctx.restore();
      if (ball && ball.state === "TRAVELING") {
        ctx.strokeStyle = rgbaFromTuple(colors.whiteRgb, 0.22);
        ctx.lineWidth = S(1);
        ctx.beginPath();
        ctx.moveTo((racketReach + S(2)) * racketSide, S(-12));
        ctx.lineTo(ball.x - x, ball.y - y);
        ctx.stroke();

        ctx.fillStyle = rgbaFromTuple(colors.whiteRgb, 0.22);
        ctx.beginPath();
        ctx.arc((racketReach + S(2)) * racketSide, S(-12), S(2.2 + Math.max(0, swingBeat)), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  };


  // ============================================
  // V2: HUD rendering
  // ============================================
  UI.prototype._renderHUDV2 = function (state) {
    var hudEl = el("kr-hud");
    if (!hudEl) return;
    var uiWording = (this.wording && this.wording.ui) ? this.wording.ui : {};
    var currentView = this._getMatchView();
    var currentViewLabel = currentView === "player"
      ? String(uiWording.matchViewPlayer || "").trim()
      : String(uiWording.matchViewBroadcast || "").trim();
    var viewToggleText = txt(uiWording.matchViewToggleTemplate, { view: currentViewLabel });
    var viewToggleHtml = "";
    if (viewToggleText) {
      viewToggleHtml =
        '<div class="kr-hud-row kr-hud-row--meta">' +
          '<button type="button" class="kr-hud-toggle" data-action="toggle-match-view">' + escapeHtml(viewToggleText) + '</button>' +
        '</div>';
    }

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
        '</div>' + viewToggleHtml;
    } else if (state.mode === MODES.SPRINT) {
      var remaining = Math.max(0, Math.ceil((state.sprintRemainingMs || 0) / 1000));
      var timerLabel = fillTemplate(this.wording?.sprint?.timerLabel || "", { remaining: remaining });
      hudEl.innerHTML =
        '<div class="kr-hud-row">' +
          '<div class="kr-hud-timer">' + escapeHtml(timerLabel) + '</div>' +
          '<div class="kr-hud-score">' + state.smashes + '</div>' +
        '</div>' + viewToggleHtml;
    }
  };


  // ============================================
  // V2: Input system (touch zones + keyboard)
  // ============================================
  UI.prototype._syncDesktopPointerInput = function () {
    if (!this._runtime || this._runtime._mouseActive !== true) return;

    var mouse = this._runtime._mouseState || {};
    var keyboard = this._runtime._keyboardState || {};
    var input = this._runtime.inputState || {};
    var canvas = this._canvas;
    if (!canvas) return;

    var mouseX = Number(this._runtime._mouseTargetX);
    var mouseY = Number(this._runtime._mouseTargetY);
    if (!Number.isFinite(mouseX) || !Number.isFinite(mouseY)) return;

    var deadZone = requiredConfigNumber(this.config?.court?.desktopMouseDeadZonePx, "KR_CONFIG.court.desktopMouseDeadZonePx", { min: 0 });
    var playerX = (this.game && this.game.run) ? this.game.run.playerX : canvas.width / 2;
    var playerY = (this.game && this.game.run) ? this.game.run.playerY : canvas.height * 0.75;
    var diffX = mouseX - playerX;
    var diffY = mouseY - playerY;

    mouse.left = diffX < -deadZone;
    mouse.right = diffX > deadZone;
    mouse.up = diffY < -deadZone;
    mouse.down = diffY > deadZone;

    var keyboardHorizontalActive = !!keyboard.left || !!keyboard.right;
    var keyboardVerticalActive = !!keyboard.up || !!keyboard.down;

    input.left = keyboardHorizontalActive ? !!keyboard.left : !!mouse.left;
    input.right = keyboardHorizontalActive ? !!keyboard.right : !!mouse.right;
    input.up = keyboardVerticalActive ? !!keyboard.up : !!mouse.up;
    input.down = keyboardVerticalActive ? !!keyboard.down : !!mouse.down;
  };

  UI.prototype._setupInputV2 = function () {
    var self = this;
    if (!this._runtime.inputState) {
      this._runtime.inputState = { left: false, right: false, up: false, down: false, hit: false };
    }
    this._runtime._keyboardState = { left: false, right: false, up: false, down: false, hit: false };
    this._runtime._mouseState = { left: false, right: false, up: false, down: false };

    var canvas = this._canvas;
    if (!canvas) return;

    // V3 Mobile: left half = drag to move (2D), right half = tap to hit (timing bonus)
    // Any touch = also moves toward ball automatically
    var activeTouches = {};

    canvas.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      if (self.audio && typeof self.audio.unlock === "function") self.audio.unlock();
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
    var syncDesktopMovement = function () {
      var input = self._runtime.inputState;
      var keyboard = self._runtime._keyboardState || {};
      var mouse = self._runtime._mouseState || {};
      var keyboardHorizontalActive = !!keyboard.left || !!keyboard.right;

      var keyboardVerticalActive = !!keyboard.up || !!keyboard.down;

      input.left = keyboardHorizontalActive ? !!keyboard.left : !!mouse.left;
      input.right = keyboardHorizontalActive ? !!keyboard.right : !!mouse.right;
      input.up = keyboardVerticalActive ? !!keyboard.up : !!mouse.up;
      input.down = keyboardVerticalActive ? !!keyboard.down : !!mouse.down;
      input.hit = !!keyboard.hit || !!input.hit;
    };

    this._keydownHandler = function (e) {
      if (self.state !== STATES.PLAYING) return;
      var key = String(e.key || "");
      var lowerKey = key.toLowerCase();
      if (key === "ArrowLeft" || lowerKey === "a") { self._runtime._keyboardState.left = true; syncDesktopMovement(); e.preventDefault(); }
      if (key === "ArrowRight" || lowerKey === "d") { self._runtime._keyboardState.right = true; syncDesktopMovement(); e.preventDefault(); }
      if (key === "ArrowUp" || lowerKey === "w") { self._runtime._keyboardState.up = true; syncDesktopMovement(); e.preventDefault(); }
      if (key === "ArrowDown" || lowerKey === "s") { self._runtime._keyboardState.down = true; syncDesktopMovement(); e.preventDefault(); }
      if (key === " ") { self._runtime._keyboardState.hit = true; self._runtime.inputState.hit = true; e.preventDefault(); }
    };
    this._keyupHandler = function (e) {
      var key = String(e.key || "");
      var lowerKey = key.toLowerCase();
      if (key === "ArrowLeft" || lowerKey === "a") self._runtime._keyboardState.left = false;
      if (key === "ArrowRight" || lowerKey === "d") self._runtime._keyboardState.right = false;
      if (key === "ArrowUp" || lowerKey === "w") self._runtime._keyboardState.up = false;
      if (key === "ArrowDown" || lowerKey === "s") self._runtime._keyboardState.down = false;
      if (key === " ") { self._runtime._keyboardState.hit = false; self._runtime.inputState.hit = false; }
      syncDesktopMovement();
    };
    this._blurHandler = function () {
      self._runtime._keyboardState = { left: false, right: false, up: false, down: false, hit: false };
      self._runtime._mouseState = { left: false, right: false, up: false, down: false };
      self._runtime.inputState.left = false;
      self._runtime.inputState.right = false;
      self._runtime.inputState.up = false;
      self._runtime.inputState.down = false;
      self._runtime.inputState.hit = false;
    };
    document.addEventListener("keydown", this._keydownHandler);
    document.addEventListener("keyup", this._keyupHandler);
    window.addEventListener("blur", this._blurHandler);

    // Mouse control (desktop): cursor position steers player in 2D, click → hit
    // Only active on non-touch devices to avoid conflict with touch zones
    var isTouchDevice = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
    if (!isTouchDevice) {
      this._runtime._mouseActive = false;
      this._runtime._mouseTargetX = -1;
      this._runtime._mouseTargetY = -1;

      this._mouseMoveHandler = function (e) {
        if (self.state !== STATES.PLAYING) return;
        var rect = canvas.getBoundingClientRect();
        var mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
        var mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
        self._runtime._mouseActive = true;
        self._runtime._mouseTargetX = mouseX;
        self._runtime._mouseTargetY = mouseY;
        self._syncDesktopPointerInput();
        syncDesktopMovement();
      };
      canvas.addEventListener("mousemove", this._mouseMoveHandler);

      this._mouseLeaveHandler = function () {
        self._runtime._mouseActive = false;
        self._runtime._mouseTargetX = -1;
        self._runtime._mouseTargetY = -1;
        self._runtime._mouseState.left = false;
        self._runtime._mouseState.right = false;
        self._runtime._mouseState.up = false;
        self._runtime._mouseState.down = false;
        syncDesktopMovement();
      };
      canvas.addEventListener("mouseleave", this._mouseLeaveHandler);

      this._mouseClickHandler = function (e) {
        if (self.state !== STATES.PLAYING) return;
        // Unlock audio
        if (self.audio && typeof self.audio.unlock === "function") self.audio.unlock();
        self._runtime.inputState.hit = true;
        // Auto-release hit after one frame
        setTimeout(function () { self._runtime.inputState.hit = false; }, requiredConfigNumber(self.config?.ui?.desktopClickHitReleaseMs, "KR_CONFIG.ui.desktopClickHitReleaseMs", { min: 0, integer: true }));
      };
      canvas.addEventListener("click", this._mouseClickHandler);
    }
  };

  UI.prototype._teardownInputV2 = function () {
    if (this._keydownHandler) { document.removeEventListener("keydown", this._keydownHandler); this._keydownHandler = null; }
    if (this._keyupHandler) { document.removeEventListener("keyup", this._keyupHandler); this._keyupHandler = null; }
    if (this._blurHandler) { window.removeEventListener("blur", this._blurHandler); this._blurHandler = null; }
    if (this._mouseMoveHandler && this._canvas) { this._canvas.removeEventListener("mousemove", this._mouseMoveHandler); this._mouseMoveHandler = null; }
    if (this._mouseLeaveHandler && this._canvas) { this._canvas.removeEventListener("mouseleave", this._mouseLeaveHandler); this._mouseLeaveHandler = null; }
    if (this._mouseClickHandler && this._canvas) { this._canvas.removeEventListener("click", this._mouseClickHandler); this._mouseClickHandler = null; }
    this._runtime.inputState = { left: false, right: false, up: false, down: false, hit: false };
    if (this._runtime) {
      this._runtime._keyboardState = { left: false, right: false, up: false, down: false, hit: false };
      this._runtime._mouseState = { left: false, right: false, up: false, down: false };
      this._runtime._mouseActive = false;
      this._runtime._mouseTargetX = -1;
      this._runtime._mouseTargetY = -1;
    }
  };


  // ============================================
  // V2: Check game events for juice/audio
  // ============================================
  UI.prototype._checkGameEventsV2 = function (state) {
    var n = performance.now();
    if (state.dailyObjectiveMet === true && this._runtime._lastDailyObjectiveMet !== true) {
      var dailyMsg = String(this.wording?.microFeedback?.dailyObjectiveMet || this.wording?.ui?.dailyObjectiveMet || "").trim();
      if (dailyMsg) {
        this._showGameplayOverlay(dailyMsg, {
          durationMs: requiredConfigNumber(this.config?.ui?.dailyObjectiveOverlayMs, "KR_CONFIG.ui.dailyObjectiveOverlayMs", { min: 1, integer: true }),
          variant: "success"
        });
        this._playSound("milestone");
        this._runtime.microFeedback.endHighlight = dailyMsg;
        this._runtime.microFeedback.endHighlightVariant = "success";
        this._runtime.microFeedback.endHighlightPriority = Math.max(110, Number(this._runtime.microFeedback.endHighlightPriority || -1));
      }
    }
    this._runtime._lastDailyObjectiveMet = !!state.dailyObjectiveMet;

    var ball = state.ball;
    if (!ball) return;

    var juice = this._runtime.juice;
    var lastCheck = this._runtime._lastBallState || {};
    var BALL_STATES = this.gameApi && this.gameApi.BALL_STATES;
    if (!BALL_STATES) return;
    var prevState = lastCheck.state || "";
    var curState = ball.state;

    if (curState !== prevState || (lastCheck.id && lastCheck.id !== ball.id)) {
      if (curState === BALL_STATES.HIT && prevState !== BALL_STATES.HIT) {
        var uw = (this.wording && this.wording.ui) || {};
        var timingCfg = this.config?.game?.timing || {};
        var timingBonus = Number(ball.timingBonus || 0);
        var perfectThreshold = requiredConfigNumber(timingCfg.perfectThreshold, "KR_CONFIG.game.timing.perfectThreshold", { min: 0, max: 1 });
        var niceThreshold = requiredConfigNumber(timingCfg.niceThreshold, "KR_CONFIG.game.timing.niceThreshold", { min: 0, max: 1 });
        var basePoints = requiredConfigNumber(timingCfg.basePoints, "KR_CONFIG.game.timing.basePoints", { min: 1, integer: true });
        var perfectPoints = requiredConfigNumber(timingCfg.perfectPoints, "KR_CONFIG.game.timing.perfectPoints", { min: 1, integer: true });
        var points = timingBonus > perfectThreshold ? perfectPoints : basePoints;
        var popupText = (points > 1)
          ? String(uw.scoreGainedDoubleDeltaText || "").trim()
          : String(uw.scoreGainedDeltaText || "").trim();
        var popupTimingLabel = "";
        if (timingBonus > perfectThreshold) popupTimingLabel = String(uw.timingPerfectLabel || "").trim();
        else if (timingBonus > niceThreshold) popupTimingLabel = String(uw.timingNiceLabel || "").trim();
        this._haptic("smash");
        this._playSound("smash");
        juice.flashType = "smash";
        juice.flashUntil = n + requiredConfigNumber(this.config?.juice?.smashFlashMs, "juice.smashFlashMs", { min: 1, integer: true });
        juice.flashX = ball.x; juice.flashY = ball.y;
        if (this._runtime.runMode === MODES.SPRINT) {
          var sprintSuccessPulseMs = Number(this.config?.juice?.sprintSuccessPulseMs);
          if (Number.isFinite(sprintSuccessPulseMs) && sprintSuccessPulseMs > 0) {
            juice.sprintSuccessUntil = n + sprintSuccessPulseMs;
          }
        }
        if (!juice.scorePopups) juice.scorePopups = [];
        juice.scorePopups.push({ x: ball.x, y: ball.y, at: n, text: popupText, timingLabel: popupTimingLabel });
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
    if (!this.audio || typeof this.audio.play !== "function") return;

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

    this.audio.play(type, requiredConfigNumber(volMap[type], "KR_CONFIG.audio volume for " + type, { min: 0, max: 1 }), pitch);
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
    var timing = this._getToastTiming(cfg, "positive");
    var self = this;

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
      self._showGameplayOverlay(m, { durationMs: timing.durationMs, variant: String(variant || "info") });
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
      var firstFaultExplainUntil = requiredConfigNumber(this.config?.ui?.firstFaultExplainUntilFaultCount, "KR_CONFIG.ui.firstFaultExplainUntilFaultCount", { min: 0, integer: true });
      if (this._runtime.runMode === MODES.RUN) {
        // First Kitchen fault in run: teach the rule (Roediger §1.2: explain errors)
        if ((gameState.totalFaulted || 0) <= firstFaultExplainUntil) {
          tooEarlyMsg = String(mfw.firstFaultExplain || mfw.tooEarly || "").trim();
        } else {
          tooEarlyMsg = String(mfw.tooEarly || "").trim();
        }
      } else {
        // Sprint: short message only
        tooEarlyMsg = String(mfw.tooEarly || "").trim();
      }
      if (tooEarlyMsg) {
        var faultDur = ((gameState.totalFaulted || 0) <= firstFaultExplainUntil)
          ? requiredConfigNumber(this.config?.juice?.firstFaultOverlayMs, "KR_CONFIG.juice.firstFaultOverlayMs", { min: 1, integer: true })
          : requiredConfigNumber(this.config?.juice?.repeatFaultOverlayMs, "KR_CONFIG.juice.repeatFaultOverlayMs", { min: 1, integer: true });
        this._showGameplayOverlay(tooEarlyMsg, { durationMs: faultDur, variant: "danger" });
        mf.lastOverlayAtSmash = totalSmashes;
      }

      // Close call / Last life warning (one-shot per run)
      var lastLifeTriggerLives = requiredConfigNumber(this.config?.ui?.lastLifeTriggerLives, "KR_CONFIG.ui.lastLifeTriggerLives", { min: 0, integer: true });
      if (gameState.lives === lastLifeTriggerLives && !mf.lastLifeShown) {
        mf.lastLifeShown = true;
        var llMsg = String(mfw.lastLife || "").trim();
        if (llMsg) {
          this._showGameplayOverlay(llMsg, { durationMs: requiredConfigNumber(cfg?.ui?.lifeLostOverlayMs, "KR_CONFIG.ui.lifeLostOverlayMs", { min: 1, integer: true }), variant: "danger" });
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
    this._hideGameplayOverlay();

    // Hide run start overlay if still visible
    var rso = el("kr-run-start-overlay");
    if (rso) rso.classList.remove("kr-run-start-overlay--visible");

    var result = this.game.getResult();
    var mode = (state && state.mode) || this._runtime.runMode;
    var previousRun = (this._runtime && this._runtime.lastRun) ? this._runtime.lastRun : null;

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
        dailyKey: (this._runtime && this._runtime.currentRunIsDaily && this.gameApi && typeof this.gameApi.getDailyKeyUtc === "function")
          ? String(this.gameApi.getDailyKeyUtc() || "").trim()
          : "",
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
    this._runtime.previousRun = previousRun || null;

    if (mode === MODES.RUN && previousRun && previousRun.mode === MODES.RUN && previousRun.totalSpawned > 0 && this._runtime && this._runtime.microFeedback) {
      var chCfg = this.config?.challenges || {};
      var mfw = (this.wording && this.wording.microFeedback) ? this.wording.microFeedback : {};
      var currAccuracy = (result.totalSpawned > 0) ? Math.round((result.smashes / result.totalSpawned) * 100) : 0;
      var prevAccuracy = (previousRun.totalSpawned > 0) ? Math.round((previousRun.smashes / previousRun.totalSpawned) * 100) : 0;
      var accuracyGain = currAccuracy - prevAccuracy;
      var fewerFaults = Number(previousRun.totalFaulted || 0) - Number(result.totalFaulted || 0);
      var betterStreak = Number(result.bestStreak || 0) - Number(previousRun.bestStreak || 0);
      var accuracyGainMin = requiredConfigNumber(chCfg.improvedAccuracyMinGainPct, "KR_CONFIG.challenges.improvedAccuracyMinGainPct", { min: 1, max: 100, integer: true });
      var fewerFaultsMin = requiredConfigNumber(chCfg.fewerFaultsMinDelta, "KR_CONFIG.challenges.fewerFaultsMinDelta", { min: 1, integer: true });
      var betterStreakMin = requiredConfigNumber(chCfg.betterStreakMinDelta, "KR_CONFIG.challenges.betterStreakMinDelta", { min: 1, integer: true });
      var mf = this._runtime.microFeedback;
      var improvementMsg = "";
      var improvementPriority = -1;

      if (fewerFaults >= fewerFaultsMin) {
        improvementMsg = String(mfw.cleanerRun || "").trim();
        improvementPriority = 64;
      } else if (accuracyGain >= accuracyGainMin) {
        improvementMsg = String(mfw.betterAccuracy || "").trim();
        improvementPriority = 63;
      } else if (betterStreak >= betterStreakMin) {
        improvementMsg = String(mfw.betterStreak || "").trim();
        improvementPriority = 62;
      }

      if (improvementMsg && improvementPriority > Number(mf.endHighlightPriority || -1)) {
        mf.endHighlight = improvementMsg;
        mf.endHighlightVariant = "success";
        mf.endHighlightPriority = improvementPriority;
      }
    }

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

    var freezeTimerId = setTimeout(function () {
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

      var fadeOutTimerId = setTimeout(function () {
        self._runtime.finishingRun = false;
        self.setState(STATES.END);

        var fadeInTimerId = setTimeout(function () {
          var a = el("app");
          if (!a) return;
          try {
            a.classList.remove("kr-fade--out");
            a.classList.add("kr-fade--in");
          } catch (_) { }

          var cleanupTimerId = setTimeout(function () {
            var b = el("app");
            if (!b) return;
            try { b.classList.remove("kr-fade", "kr-fade--out", "kr-fade--in", "transitioning"); } catch (_) { }
          }, FADE_MS + 40);
          self._runtime.endTransitionTimerIds.push(cleanupTimerId);
        }, 0);
        self._runtime.endTransitionTimerIds.push(fadeInTimerId);
      }, FADE_MS);
      self._runtime.endTransitionTimerIds.push(fadeOutTimerId);
    }, FREEZE_MS);
    this._runtime.endTransitionTimerIds.push(freezeTimerId);
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
      if (msg) this._toastNow(this.config, msg);
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

  UI.prototype._redeemCode = function (code) {
    if (!code) return;
    var result = this.storage
      ? this.storage.tryRedeemPremiumCode(code) : null;
    if (result && result.ok) {
      this.closeModal();
      var msg = String(this.wording?.system?.premiumUnlockedToast || "").trim();
      if (msg) this._toastNow(this.config, msg, { timingKey: "positive" });
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
      if (msg) this._toastNow(this.config, msg, { timingKey: "positive" });
      this.render();
    }
  };

  UI.prototype.copySupportEmail = async function () {
    var email = this._runtime.supportEmail;
    if (!email) return;
    try { await navigator.clipboard.writeText(email); } catch (_) { return; }
    var msg = String(this.wording?.system?.copied || "").trim();
    if (msg) this._toastNow(this.config, msg, { timingKey: "positive" });
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
  // Power Ball (secret discovery)
  // ============================================
  UI.prototype._handlePowerBallTap = function () {
    if (this.state !== STATES.END && this.state !== STATES.LANDING) return;
    var cfg = this.config;
    if (!cfg?.sprint?.enabled) return;

    var tapWindowMs = requiredConfigNumber(cfg.sprint.tapWindowMs, "KR_CONFIG.sprint.tapWindowMs", { min: 1, integer: true });
    var tapsRequired = requiredConfigNumber(cfg.sprint.tapsRequired, "KR_CONFIG.sprint.tapsRequired", { min: 1, integer: true });
    var powerBall = this._runtime.powerBall;
    var now = Date.now();

    if (now - powerBall.lastTapAt > tapWindowMs) powerBall.tapCount = 0;
    powerBall.tapCount++;
    powerBall.lastTapAt = now;

    if (powerBall.tapCount >= tapsRequired) {
      powerBall.tapCount = 0;

      if (this._store("hasPowerBallHintSolved")) {
        window.dispatchEvent(new CustomEvent("kr-power-run-requested"));
        return;
      }
      if (!this._store("hasPowerBallWelcomeShown")) {
        this._store("markPowerBallHintSolved");
        this._store("markPowerBallWelcomeShown");
        this._showSprintWelcomeModal();
        return;
      }
      this._store("markPowerBallHintSolved");
      window.dispatchEvent(new CustomEvent("kr-power-run-requested"));
    }
  };

  UI.prototype._canShowPowerBall = function (screen) {
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
  // Install prompt
  // ============================================
  UI.prototype.promptInstall = function () {
    if (this.pwa && typeof this.pwa.promptInstall === "function") this.pwa.promptInstall(this.storage);
  };

  UI.prototype.dismissUpdateToast = function () {
    var node = el("update-toast");
    if (node) node.classList.remove("kr-toast--visible");
    if (window.__KR_SW_UPDATE_READY__) try { location.reload(); } catch (_) { }
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

  if (!window.KR_UI_OVERLAYS || typeof window.KR_UI_OVERLAYS.install !== "function") {
    throw new Error("KR_UI: KR_UI_OVERLAYS.install missing");
  }
  window.KR_UI_OVERLAYS.install(UI, {
    el: el,
    escapeHtml: escapeHtml,
    fillTemplate: fillTemplate,
    requiredConfigNumber: requiredConfigNumber,
    MODES: MODES
  });

  if (!window.KR_UI_MODALS || typeof window.KR_UI_MODALS.install !== "function") {
    throw new Error("KR_UI: KR_UI_MODALS.install missing");
  }
  window.KR_UI_MODALS.install(UI, {
    el: el,
    escapeHtml: escapeHtml,
    toastNow: window.KR_UI_OVERLAYS.toastNow,
    fillTemplate: fillTemplate,
    requiredConfigNumber: requiredConfigNumber,
    getEmailApi: function () { return window.KR_Email || null; }
  });

  if (!window.KR_UI_SHARING || typeof window.KR_UI_SHARING.install !== "function") {
    throw new Error("KR_UI: KR_UI_SHARING.install missing");
  }
  window.KR_UI_SHARING.install(UI, {
    el: el,
    escapeHtml: escapeHtml,
    fillTemplate: fillTemplate,
    MODES: MODES
  });

  if (!window.KR_UI_SCREENS || typeof window.KR_UI_SCREENS.install !== "function") {
    throw new Error("KR_UI: KR_UI_SCREENS.install missing");
  }
  window.KR_UI_SCREENS.install(UI, {
    escapeHtml: escapeHtml,
    fillTemplate: fillTemplate,
    pickChallenge: pickChallenge,
    mmss: mmss,
    formatCents: formatCents,
    requiredConfigNumber: requiredConfigNumber,
    STATES: STATES,
    MODES: MODES
  });


  // ============================================
  // Export
  // ============================================
  window.KR_UI = UI;
}();
