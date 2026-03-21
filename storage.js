/* Kitchen Rush - storage (V1) */
/* Kitchen Rush */
/* Removed: statsByItem, practice, houseAd, waitlist, statsSharing, recordAnswer. */
/* Added: sprintBest, sprintFreeRunsUsed, settings.soundEnabled/hapticsEnabled. */

(() => {
  "use strict";

  const EVT = "storage-updated";
  const EVT_SAVE_FAILED = "storage-save-failed";

  function warn(message, error) {
    try {
      console.warn("[KR Storage]", message, error || "");
    } catch (_) { }
  }

  function getModes() {
    const modes = window.KR_ENUMS && window.KR_ENUMS.GAME_MODES;
    if (!modes || typeof modes !== "object") {
      throw new Error("StorageManager: KR_ENUMS.GAME_MODES missing");
    }
    if (!modes.RUN || !modes.SPRINT) {
      throw new Error("StorageManager: KR_ENUMS.GAME_MODES invalid");
    }
    return modes;
  }


  // ============================================
  // Helpers
  // ============================================
  function now() {
    return Date.now();
  }

  function safeJsonParse(str) {
    if (!str || typeof str !== "string") return null;
    try {
      return JSON.parse(str);
    } catch (_) {
      return null;
    }
  }

  function clampNonNegativeInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.floor(x));
  }

  function requiredNonNegativeInt(value, name) {
    const n = Number(value);
    if (!Number.isFinite(n) || Math.floor(n) !== n || n < 0) {
      throw new Error(name + " must be a non-negative integer");
    }
    return n;
  }

  function deepCopy(obj) {
    try {
      if (typeof structuredClone === "function") return structuredClone(obj);
    } catch (_) { /* fall through */ }
    return JSON.parse(JSON.stringify(obj));
  }


  // ============================================
  // StorageManager Constructor
  // ============================================
  function StorageManager(config) {
    if (!config || typeof config !== "object") {
      throw new Error("StorageManager: missing or invalid config (no fallback to window.KR_CONFIG)");
    }

    const resolvedStorageKey = String(config?.storage?.storageKey || "").trim();
    if (!resolvedStorageKey) throw new Error("StorageManager: missing config.storage.storageKey");

    this.config = config;
    this.storageKey = resolvedStorageKey;

    this.initialized = false;
    this.data = null;

    // One-shot per session: persistence failure signal to UI
    this._saveFailedOnce = false;

    // Cache compiled regex (premium codes)
    this._premiumCodeRe = undefined;

    const schemaVersion = String(config.storageSchemaVersion == null ? "" : config.storageSchemaVersion).trim();

    if (!schemaVersion) throw new Error("StorageManager: missing config.storageSchemaVersion");

    this.schemaVersion = schemaVersion;

    // freeRuns is read from config at init time (not live-synced).
    const freeRuns = requiredNonNegativeInt(config?.limits?.freeRuns, "StorageManager: config.limits.freeRuns");
    this.modes = getModes();

    const gameId = String(config.identity?.appName || "").trim();
    if (!gameId) throw new Error("StorageManager: missing config.identity.appName");

    this.defaultData = {
      version: schemaVersion,
      gameId: gameId,
      createdAt: 0,
      updatedAt: 0,

      // Premium
      isPremium: false,

      // Premium codes (device-local)
      codes: {
        redeemedOnce: false,
        code: ""
      },

      // Economy gate (config-driven: see KR_CONFIG.limits.freeRuns)
      runs: {
        balance: freeRuns,
        freeRuns: freeRuns,
        limitReachedCount: 0
      },

      // Settings
      settings: {
        soundEnabled: true,
        hapticsEnabled: true,
        houseAdHiddenUntil: 0,
        matchView: "broadcast"
      },

      // Counters
      counters: {
        runNumber: 0,
        runStarts: 0,
        runCompletes: 0,

        // Lifetime aggregate (never resets — Eyal Hook investment)
        totalLifetimeSmashes: 0,

        // Sprint (teaser premium): free sprint runs used (lifetime, device-local)
        sprintFreeRunsUsed: 0,
        sprintStarts: 0,
        sprintCompletes: 0,

        // Funnel (local-only, aggregated)
        landingViewed: 0,
        landingPlayClicked: 0,
        shareClicked: 0,
        installPromptShown: 0,
        paywallShown: 0,
        checkoutStarted: 0,
        codeRedeemed: 0,

        // House Ad / Waitlist
        houseAdShown: 0,
        houseAdClicked: 0
      },

      // Personal best (Run)
      personalBest: {
        bestSmashes: 0,
        achievedAt: 0
      },

      // Sprint best (separate from Run best)
      sprintBest: {
        bestSmashes: 0,
        achievedAt: 0
      },

      // Run history (lightweight, local-only)
      history: {
        lastRuns: []
      },

      // Early price window (timer UX)
      earlyPrice: {
        startedAt: 0,
        used: false
      },

      analytics: {
        firstSeenAt: 0,
        lastSeenAt: 0
      },

      // House Ad state
      houseAd: {
        introSeen: false,
        state: "never_seen"        // "never_seen" | "remind_later"
      },

      // Waitlist state
      waitlist: {
        status: "not_seen",        // "not_seen" | "seen" | "joined"
        draftIdea: ""
      },

      // Stats sharing prompt
      statsSharingPromptFlags: 0,
      statsSharingSnoozeUntilRunCompletes: 0,

      // UI flags (previously stored as separate localStorage keys)
      flags: {
        powerBallHintSolved: false,
        powerBallWelcomeShown: false,
        firstRunFramingSeen: false
      }
    };
  }


  // ============================================
  // Init
  // ============================================
  StorageManager.prototype.init = function () {
    if (this.initialized) return;

    const cfg = this.config || {};
    const schemaVersion = this.schemaVersion;

    const loaded = this._load();

    // Schema version check with basic migration support.
    // Mismatch: wipe and reset, but preserve critical user data.
    if (!loaded || typeof loaded !== "object" || String(loaded.version || "") !== schemaVersion) {
      var oldData = (loaded && typeof loaded === "object") ? deepCopy(loaded) : null;
      this._wipeAndReset();

      // Migrate critical user data from old schema (fail-closed: any error → fresh data)
      if (oldData) {
        try {
          if (oldData.codes && Array.isArray(oldData.codes.accepted) && oldData.codes.accepted.length > 0) {
            this.data.codes.accepted = oldData.codes.accepted.slice();
          }
          if (oldData.personalBest && Number.isFinite(oldData.personalBest.bestSmashes) && oldData.personalBest.bestSmashes > 0) {
            this.data.personalBest = deepCopy(oldData.personalBest);
          }
          if (oldData.sprintBest && Number.isFinite(oldData.sprintBest.bestSmashes) && oldData.sprintBest.bestSmashes > 0) {
            this.data.sprintBest = deepCopy(oldData.sprintBest);
          }
          if (oldData.counters && Number.isFinite(oldData.counters.totalLifetimeSmashes)) {
            this.data.counters.totalLifetimeSmashes = clampNonNegativeInt(oldData.counters.totalLifetimeSmashes);
          }
          if (oldData.flags && typeof oldData.flags === "object") {
            if (oldData.flags.powerBallHintSolved === true) this.data.flags.powerBallHintSolved = true;
            if (oldData.flags.powerBallWelcomeShown === true) this.data.flags.powerBallWelcomeShown = true;
            if (oldData.flags.firstRunFramingSeen === true) this.data.flags.firstRunFramingSeen = true;
          }
        } catch (_) { /* migration failed — fresh data is still valid */ }
      }

      // If success page already generated a code, keep it across wipes.
      if (this._syncVanityCodeToCodes()) {
        this._save();
      }

      this._addStorageListener();
      this.initialized = true;
      return;
    }

    this.data = loaded;

    // Harden required blocks
    if (!this.data.runs) this.data.runs = deepCopy(this.defaultData.runs);
    if (!this.data.settings) this.data.settings = deepCopy(this.defaultData.settings);
    if (!this.data.counters) this.data.counters = deepCopy(this.defaultData.counters);
    if (!this.data.history) this.data.history = deepCopy(this.defaultData.history);
    if (!this.data.personalBest) this.data.personalBest = deepCopy(this.defaultData.personalBest);
    if (!this.data.sprintBest) this.data.sprintBest = deepCopy(this.defaultData.sprintBest);
    if (!this.data.earlyPrice) this.data.earlyPrice = deepCopy(this.defaultData.earlyPrice);
    if (!this.data.analytics) this.data.analytics = deepCopy(this.defaultData.analytics);
    if (!this.data.codes) this.data.codes = deepCopy(this.defaultData.codes);

    // Harden flags
    if (!this.data.flags || typeof this.data.flags !== "object") {
      this.data.flags = deepCopy(this.defaultData.flags);
    }
    var fl = this.data.flags;
    if (typeof fl.powerBallHintSolved !== "boolean") fl.powerBallHintSolved = false;
    if (typeof fl.powerBallWelcomeShown !== "boolean") fl.powerBallWelcomeShown = false;
    if (typeof fl.firstRunFramingSeen !== "boolean") fl.firstRunFramingSeen = false;

    // One-time normalization: absorb standalone localStorage flags
    var storageKey = String(cfg?.storage?.storageKey || "").trim();
    if (storageKey) {
      try {
        if (!fl.powerBallHintSolved && localStorage.getItem(storageKey + ":powerBallHintSolved") === "true") fl.powerBallHintSolved = true;
        if (!fl.powerBallWelcomeShown && localStorage.getItem(storageKey + ":powerBallWelcomeShown") === "true") fl.powerBallWelcomeShown = true;
        if (!fl.firstRunFramingSeen && localStorage.getItem(storageKey + ":firstRunFramingSeen") === "true") fl.firstRunFramingSeen = true;
        // Clean up absorbed keys
        localStorage.removeItem(storageKey + ":powerBallHintSolved");
        localStorage.removeItem(storageKey + ":powerBallWelcomeShown");
        localStorage.removeItem(storageKey + ":firstRunFramingSeen");
      } catch (_) { /* fail-closed */ }
    }

    // Harden houseAd
    if (!this.data.houseAd || typeof this.data.houseAd !== "object") {
      this.data.houseAd = deepCopy(this.defaultData.houseAd);
    }
    const ha = this.data.houseAd;
    if (typeof ha.introSeen !== "boolean") ha.introSeen = false;
    if (typeof ha.state !== "string") ha.state = "never_seen";
    if (ha.state !== "never_seen" && ha.state !== "remind_later") ha.state = "never_seen";

    // Harden waitlist
    if (!this.data.waitlist || typeof this.data.waitlist !== "object") {
      this.data.waitlist = deepCopy(this.defaultData.waitlist);
    }
    const wl = this.data.waitlist;
    if (typeof wl.status !== "string") wl.status = "not_seen";
    if (wl.status !== "not_seen" && wl.status !== "seen" && wl.status !== "joined") wl.status = "not_seen";

    // Harden stats sharing flags
    if (!Number.isFinite(Number(this.data.statsSharingPromptFlags))) {
      this.data.statsSharingPromptFlags = 0;
    }
    if (!Number.isFinite(Number(this.data.statsSharingSnoozeUntilRunCompletes))) {
      this.data.statsSharingSnoozeUntilRunCompletes = 0;
    }

    // Harden runs (sync with config)
    const r = this.data.runs;
    const freeRunsCfg = requiredNonNegativeInt(cfg?.limits?.freeRuns, "StorageManager._wipeAndReset(): config.limits.freeRuns");
    const isPrem = (this.data && this.data.isPremium === true);

    r.freeRuns = freeRunsCfg;
    r.balance = clampNonNegativeInt(r.balance);

    // Keep economy consistent: for non-premium, balance = freeRuns - runStarts
    if (!isPrem) {
      const used = clampNonNegativeInt(this.data?.counters?.runStarts);
      r.balance = Math.max(0, freeRunsCfg - used);
    }

    if (!Number.isFinite(r.limitReachedCount)) r.limitReachedCount = 0;

    // Harden settings
    const st = this.data.settings;
    if (typeof st.soundEnabled !== "boolean") st.soundEnabled = true;
    if (typeof st.hapticsEnabled !== "boolean") st.hapticsEnabled = true;
    if (!Number.isFinite(st.houseAdHiddenUntil)) st.houseAdHiddenUntil = 0;
    if (st.matchView !== "broadcast" && st.matchView !== "player") st.matchView = "broadcast";

    // Harden counters
    const c = this.data.counters;
    for (const k in this.defaultData.counters) {
      if (!Number.isFinite(c[k])) c[k] = 0;
    }

    // Harden personal best
    if (!Number.isFinite(this.data.personalBest.bestSmashes)) this.data.personalBest.bestSmashes = 0;
    if (!Number.isFinite(this.data.personalBest.achievedAt)) this.data.personalBest.achievedAt = 0;

    // Harden sprint best
    if (!Number.isFinite(this.data.sprintBest.bestSmashes)) this.data.sprintBest.bestSmashes = 0;
    if (!Number.isFinite(this.data.sprintBest.achievedAt)) this.data.sprintBest.achievedAt = 0;

    // Harden early price
    const ep = this.data.earlyPrice || {};
    if (!Number.isFinite(ep.startedAt)) ep.startedAt = 0;
    if (typeof ep.used !== "boolean") ep.used = false;
    this.data.earlyPrice = ep;

    // Harden codes
    const cd = this.data.codes;
    if (typeof cd.redeemedOnce !== "boolean") cd.redeemedOnce = false;
    if (typeof cd.code !== "string") cd.code = "";

    // If success page already generated a code, align vanity storage with main storage.
    this._syncVanityCodeToCodes();

    // Analytics timestamps
    if (!Number.isFinite(this.data.analytics.firstSeenAt) || this.data.analytics.firstSeenAt <= 0) {
      this.data.analytics.firstSeenAt = now();
    }
    this.data.analytics.lastSeenAt = now();

    this._addStorageListener();
    this._save();
    this.initialized = true;
  };


  // ============================================
  // Internal: load, save, wipe, emit
  // ============================================
  StorageManager.prototype._load = function () {
    try {
      if (typeof window.localStorage === "undefined") return null;
      const raw = window.localStorage.getItem(this.storageKey);
      const parsed = safeJsonParse(raw);
      return (parsed && typeof parsed === "object") ? parsed : null;
    } catch (_) {
      return null;
    }
  };

  StorageManager.prototype._emit = function () {
    try {
      window.dispatchEvent(new CustomEvent(EVT));
    } catch (error) {
      warn("storage-updated dispatch failed", error);
    }
  };

  StorageManager.prototype._save = function () {
    if (!this.data) return;
    this.data.updatedAt = now();

    try {
      if (typeof window.localStorage === "undefined") return;

      try {
        window.localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      } catch (err) {
        // Fail closed: no auto-delete, no recursion, no surprises.
        try { console.warn("[KR Storage] Save failed (quota?):", err?.name || err); } catch (_) { }

        if (this._saveFailedOnce !== true) {
          this._saveFailedOnce = true;
          try {
            window.dispatchEvent(new CustomEvent(EVT_SAVE_FAILED, {
              detail: {
                name: String(err?.name || ""),
                message: String(err?.message || "")
              }
            }));
          } catch (error) {
            warn("storage-save-failed dispatch failed", error);
          }
        }
        return;
      }

      this._emit();
    } catch (error) {
      warn("save pipeline failed", error);
    }
  };

  StorageManager.prototype._wipeAndReset = function () {
    this.data = deepCopy(this.defaultData);
    this.data.createdAt = now();
    this.data.updatedAt = now();
    this.data.analytics.firstSeenAt = now();
    this.data.analytics.lastSeenAt = now();
    this._save();
  };

  StorageManager.prototype._addStorageListener = function () {
    if (this._storageListenerAdded) return;

    window.addEventListener("storage", (event) => {
      if (!event || event.key !== this.storageKey) return;
      const updatedData = safeJsonParse(event.newValue);
      if (!updatedData || typeof updatedData !== "object") return;

      // Update local data only (never _save() here)
      this.data = updatedData;
      this._emit();
    });

    this._storageListenerAdded = true;
  };

  StorageManager.prototype._compileCodeRegex = function () {
    if (this._premiumCodeRe !== undefined) return;

    const cfg = this.config || {};
    const raw = String(cfg?.premiumCodeRegex || "").trim();

    if (!raw) {
      this._premiumCodeRe = null;
      return;
    }

    try {
      this._premiumCodeRe = new RegExp(raw);
    } catch (_) {
      this._premiumCodeRe = null;
    }
  };

  StorageManager.prototype._syncVanityCodeToCodes = function () {
    if (!this.data) return false;

    const cfg = this.config || {};
    const vanityKey = String(cfg?.storage?.vanityCodeStorageKey || "").trim();
    if (!vanityKey) return false;

    if (!this.data.codes || typeof this.data.codes !== "object") {
      this.data.codes = deepCopy(this.defaultData.codes);
    }
    const cd = this.data.codes;
    if (typeof cd.redeemedOnce !== "boolean") cd.redeemedOnce = false;
    if (typeof cd.code !== "string") cd.code = "";

    this._compileCodeRegex();
    const re = this._premiumCodeRe;
    if (!re) return false;

    try { re.lastIndex = 0; } catch (_) { }

    let vanity = "";
    try {
      vanity = String(window.localStorage.getItem(vanityKey) || "").trim();
    } catch (_) {
      vanity = "";
    }

    try { re.lastIndex = 0; } catch (_) { }
    if (!vanity || !re.test(vanity)) return false;

    const current = String(cd.code || "").trim();
    try { re.lastIndex = 0; } catch (_) { }
    if (current && re.test(current)) return false;

    cd.code = vanity;
    this.data.codes = cd;
    return true;
  };


  // ============================================
  // Getters
  // ============================================
  StorageManager.prototype.isPremium = function () {
    return !!(this.data && this.data.isPremium);
  };

  StorageManager.prototype.getData = function () {
    return this.data || {};
  };
  // ============================================
  // Settings
  // ============================================
  StorageManager.prototype.setSoundEnabled = function (on) {
    if (!this.data) return;
    if (!this.data.settings) this.data.settings = deepCopy(this.defaultData.settings);
    this.data.settings.soundEnabled = (on === true);
    this._save();
  };

  StorageManager.prototype.getSoundEnabled = function () {
    const v = this.data?.settings?.soundEnabled;
    return (v === false) ? false : true; // default true
  };

  StorageManager.prototype.setHapticsEnabled = function (on) {
    if (!this.data) return;
    if (!this.data.settings) this.data.settings = deepCopy(this.defaultData.settings);
    this.data.settings.hapticsEnabled = (on === true);
    this._save();
  };

  StorageManager.prototype.getHapticsEnabled = function () {
    const v = this.data?.settings?.hapticsEnabled;
    return (v === false) ? false : true; // default true
  };

  StorageManager.prototype.setMatchView = function (view) {
    if (!this.data) return;
    if (!this.data.settings) this.data.settings = deepCopy(this.defaultData.settings);
    var next = String(view || "").trim();
    if (next !== "broadcast" && next !== "player") return;
    this.data.settings.matchView = next;
    this._save();
  };

  StorageManager.prototype.getMatchView = function () {
    var v = String(this.data?.settings?.matchView || "").trim();
    return (v === "player") ? "player" : "broadcast";
  };

  // ============================================
  // Export
  // ============================================
  window.KR_StorageManager = StorageManager;
})();
