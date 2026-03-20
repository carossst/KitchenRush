/* Kitchen Rush - storage (V1) */
/* Kitchen Rush */
/* Local-only storage manager for Kitchen Rush. */
/* Added: sprintBest, sprintFreeRunsUsed, settings.soundEnabled/hapticsEnabled. */

(() => {
  "use strict";

  const EVT = "storage-updated";
  const EVT_SAVE_FAILED = "storage-save-failed";

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


  function requiredTrimmedString(value, name) {
    const s = String(value == null ? "" : value).trim();
    if (!s) throw new Error(name + " must be a non-empty string");
    return s;
  }

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }


  function ensureObjectBranch(host, key, fallbackFactory) {
    if (!host || typeof host !== "object") throw new Error("StorageManager.ensureObjectBranch: host invalid for " + key);
    if (!isPlainObject(host[key])) host[key] = fallbackFactory();
    return host[key];
  }

  function requireData(manager) {
    if (!manager || !manager.data || typeof manager.data !== "object") throw new Error("StorageManager: data not initialized");
    return manager.data;
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

    if (!config.storage || typeof config.storage !== "object") throw new Error("StorageManager: missing config.storage");
    const resolvedStorageKey = requiredTrimmedString(config.storage.storageKey, "StorageManager: config.storage.storageKey");

    this.config = config;
    this.storageKey = resolvedStorageKey;

    this.initialized = false;
    this.data = null;

    // One-shot per session: persistence failure signal to UI
    this._saveFailedOnce = false;

    // Cache compiled regex (premium codes)
    this._premiumCodeRe = undefined;

    const schemaVersion = requiredTrimmedString(config.storageSchemaVersion, "StorageManager: config.storageSchemaVersion");

    this.schemaVersion = schemaVersion;

    // freeRuns is read from config at init time (not live-synced).
    if (!config.limits || typeof config.limits !== "object") throw new Error("StorageManager: missing config.limits");
    const freeRuns = requiredNonNegativeInt(config.limits.freeRuns, "StorageManager: config.limits.freeRuns");
    this.modes = getModes();

    if (!config.identity || typeof config.identity !== "object") throw new Error("StorageManager: missing config.identity");
    const gameId = requiredTrimmedString(config.identity.appName, "StorageManager: config.identity.appName");

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
        houseAdHiddenUntil: 0
      },

      // Counters
      counters: {
        runNumber: 0,
        runStarts: 0,
        runCompletes: 0,

        // Lifetime aggregate (never resets — Eyal Hook investment)
        totalLifetimeScore: 0,

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
        bestScore: 0,
        achievedAt: 0
      },

      // Sprint best (separate from Run best)
      sprintBest: {
        bestScore: 0,
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
        sprintChestHintSolved: false,
        sprintChestWelcomeShown: false,
        firstRunFramingSeen: false
      }
    };
  }



  StorageManager.prototype._isLoadedDataStructurallyValid = function (loaded) {
    if (!isPlainObject(loaded)) return false;
    if (!isPlainObject(loaded.runs)) return false;
    if (!isPlainObject(loaded.settings)) return false;
    if (!isPlainObject(loaded.counters)) return false;
    if (!isPlainObject(loaded.history) || !Array.isArray(loaded.history.lastRuns)) return false;
    if (!isPlainObject(loaded.personalBest)) return false;
    if (!isPlainObject(loaded.sprintBest)) return false;
    if (!isPlainObject(loaded.earlyPrice)) return false;
    if (!isPlainObject(loaded.analytics)) return false;
    if (!isPlainObject(loaded.codes)) return false;
    if (!isPlainObject(loaded.flags)) return false;
    if (!isPlainObject(loaded.houseAd)) return false;
    if (!isPlainObject(loaded.waitlist)) return false;
    return true;
  };

  // ============================================
  // Init
  // ============================================
  StorageManager.prototype.init = function () {
    if (this.initialized) return;

    const cfg = this.config;
    const schemaVersion = this.schemaVersion;

    const loaded = this._load();

    // No legacy support: mismatch or malformed payload => reset
    var loadedVersion = "";
    if (loaded && typeof loaded === "object") {
      loadedVersion = String(loaded.version == null ? "" : loaded.version).trim();
    }
    if (!loaded || typeof loaded !== "object" || loadedVersion !== schemaVersion || this._isLoadedDataStructurallyValid(loaded) !== true) {
      this._wipeAndReset();

      // If success page already generated a code, keep it across wipes.
      if (this._syncVanityCodeToCodes()) {
        this._save();
      }

      this._addStorageListener();
      this.initialized = true;
      return;
    }

    this.data = loaded;

    // Harden flags (migrate from legacy separate localStorage keys)
    var fl = this.data.flags;
    if (typeof fl.sprintChestHintSolved !== "boolean") fl.sprintChestHintSolved = false;
    if (typeof fl.sprintChestWelcomeShown !== "boolean") fl.sprintChestWelcomeShown = false;
    if (typeof fl.firstRunFramingSeen !== "boolean") fl.firstRunFramingSeen = false;

    // One-time migration: read legacy localStorage keys and absorb them
    if (!cfg.storage || typeof cfg.storage !== "object") throw new Error("StorageManager.init: missing config.storage");
    var storageKey = String(cfg.storage.storageKey).trim();
    if (!storageKey) throw new Error("StorageManager.init: missing config.storage.storageKey");
    {
      try {
        if (!fl.sprintChestHintSolved && localStorage.getItem(storageKey + ":sprintChestHintSolved") === "true") fl.sprintChestHintSolved = true;
        if (!fl.sprintChestWelcomeShown && localStorage.getItem(storageKey + ":sprintChestWelcomeShown") === "true") fl.sprintChestWelcomeShown = true;
        if (!fl.firstRunFramingSeen && localStorage.getItem(storageKey + ":firstRunFramingSeen") === "true") fl.firstRunFramingSeen = true;
        // Clean up legacy keys
        localStorage.removeItem(storageKey + ":sprintChestHintSolved");
        localStorage.removeItem(storageKey + ":sprintChestWelcomeShown");
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

    // Harden counters
    const c = this.data.counters;
    for (const k in this.defaultData.counters) {
      if (!Number.isFinite(c[k])) c[k] = 0;
    }

    // Harden personal best
    if (!Number.isFinite(this.data.personalBest.bestScore)) this.data.personalBest.bestScore = 0;
    if (!Number.isFinite(this.data.personalBest.achievedAt)) this.data.personalBest.achievedAt = 0;

    // Harden sprint best
    if (!Number.isFinite(this.data.sprintBest.bestScore)) this.data.sprintBest.bestScore = 0;
    if (!Number.isFinite(this.data.sprintBest.achievedAt)) this.data.sprintBest.achievedAt = 0;

    // Harden early price
    const data = requireData(this);
    const ep = ensureObjectBranch(data, "earlyPrice", () => deepCopy(this.defaultData.earlyPrice));
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
    } catch (_) { /* silent */ }
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
          try { window.dispatchEvent(new CustomEvent(EVT_SAVE_FAILED)); } catch (_) { /* silent */ }
        }
        return;
      }

      this._emit();
    } catch (_) { /* silent */ }
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

    const cfg = this.config;
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

    const cfg = this.config;
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
      vanity = requiredTrimmedString(window.localStorage.getItem(vanityKey), "StorageManager._loadVanityCode(): vanity code value");
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

  StorageManager.prototype.getRunsBalance = function () {
    const runs = ensureObjectBranch(requireData(this), "runs", () => deepCopy(this.defaultData.runs));
    return clampNonNegativeInt(runs.balance);
  };

  StorageManager.prototype.getRunsUsed = function () {
    const counters = ensureObjectBranch(requireData(this), "counters", () => deepCopy(this.defaultData.counters));
    return clampNonNegativeInt(counters.runStarts);
  };

  StorageManager.prototype.getRunNumber = function () {
    const counters = ensureObjectBranch(requireData(this), "counters", () => deepCopy(this.defaultData.counters));
    return clampNonNegativeInt(counters.runNumber);
  };

  StorageManager.prototype.getCounters = function () {
    return deepCopy(ensureObjectBranch(requireData(this), "counters", () => deepCopy(this.defaultData.counters)));
  };

  StorageManager.prototype.getData = function () {
    return deepCopy(requireData(this));
  };

  StorageManager.prototype.getPersonalBest = function () {
    const pb = ensureObjectBranch(requireData(this), "personalBest", () => deepCopy(this.defaultData.personalBest));
    return {
      bestScore: clampNonNegativeInt(pb.bestScore),
      achievedAt: clampNonNegativeInt(pb.achievedAt)
    };
  };

  StorageManager.prototype.getSprintBest = function () {
    const sb = ensureObjectBranch(requireData(this), "sprintBest", () => deepCopy(this.defaultData.sprintBest));
    return {
      bestScore: clampNonNegativeInt(sb.bestScore),
      achievedAt: clampNonNegativeInt(sb.achievedAt)
    };
  };

  StorageManager.prototype.getSprintFreeRunsUsed = function () {
    const counters = ensureObjectBranch(requireData(this), "counters", () => deepCopy(this.defaultData.counters));
    return clampNonNegativeInt(counters.sprintFreeRunsUsed);
  };

  StorageManager.prototype.incrementSprintFreeRunsUsed = function () {
    if (!this.data) return;

    if (!this.data.counters || typeof this.data.counters !== "object") {
      this.data.counters = deepCopy(this.defaultData.counters);
    }

    const cur = clampNonNegativeInt(this.data.counters.sprintFreeRunsUsed);
    this.data.counters.sprintFreeRunsUsed = cur + 1;
    this._save();
  };

  // LANDING stats: last N runs (most recent first)
  StorageManager.prototype.getLastRuns = function (maxCount) {
    const n = clampNonNegativeInt(maxCount);
    if (n <= 0) return [];

    const history = ensureObjectBranch(requireData(this), "history", () => deepCopy(this.defaultData.history));
    const list = Array.isArray(history.lastRuns) ? history.lastRuns : [];

    return list.slice(0, n).map((e) => {
      const it = (e && typeof e === "object") ? e : {};
      return {
        runNumber: clampNonNegativeInt(it.runNumber),
        endedAt: clampNonNegativeInt(it.endedAt),
        score: clampNonNegativeInt(it.score),
        meta: (it.meta && typeof it.meta === "object") ? it.meta : {}
      };
    });
  };

  StorageManager.prototype.getEarlyPriceState = function () {
    const ep = ensureObjectBranch(requireData(this), "earlyPrice", () => deepCopy(this.defaultData.earlyPrice));
    const startedAt = clampNonNegativeInt(ep.startedAt);
    const windowMs = requiredNonNegativeInt(this.config?.earlyPriceWindowMs, "StorageManager.getEarlyPriceState(): config.earlyPriceWindowMs");

    if (!startedAt || windowMs <= 0) {
      return { phase: "STANDARD", remainingMs: 0, startedAt };
    }

    const elapsed = now() - startedAt;
    const remainingMs = Math.max(0, windowMs - elapsed);
    const phase = remainingMs > 0 ? "EARLY" : "STANDARD";
    return { phase, remainingMs, startedAt };
  };


  // ============================================
  // Economy (Runs)
  // ============================================

  StorageManager.prototype.getRunAccessState = function () {
    if (!this.data) return { ok: false, reason: "NO_DATA", balance: 0, runType: "" };
    if (this.isPremium()) {
      return { ok: true, reason: "PREMIUM", balance: this.getRunsBalance(), runType: "UNLIMITED" };
    }
    const balance = this.getRunsBalance();
    if (balance > 0) {
      return { ok: true, reason: "AVAILABLE", balance: balance, runType: (balance === 1 ? "LAST_FREE" : "FREE") };
    }
    return { ok: false, reason: "NO_RUNS", balance: 0, runType: "" };
  };

  StorageManager.prototype.canStartRun = function () {
    const state = this.getRunAccessState();
    return state.ok === true;
  };

  StorageManager.prototype.getSprintAccessState = function () {
    if (!this.data) return { ok: false, reason: "NO_DATA", used: 0, limit: 0 };
    const limit = requiredNonNegativeInt(this.config?.sprint?.freeRunsLimit, "StorageManager.getSprintAccessState(): config.sprint.freeRunsLimit");
    if (this.isPremium()) return { ok: true, reason: "PREMIUM", used: this.getSprintFreeRunsUsed(), limit };
    const used = this.getSprintFreeRunsUsed();
    if (limit <= 0 || used < limit) return { ok: true, reason: "AVAILABLE", used, limit };
    return { ok: false, reason: "LIMIT_REACHED", used, limit };
  };

  StorageManager.prototype.canStartSprint = function () {
    const state = this.getSprintAccessState();
    return state.ok === true;
  };

  StorageManager.prototype.consumeRunOrBlock = function () {
    if (!this.data) return { ok: false, reason: "NO_DATA", balance: 0 };

    if (this.isPremium()) {
      this.data.counters.runStarts = clampNonNegativeInt(this.data.counters.runStarts) + 1;
      this._save();
      return { ok: true, reason: "PREMIUM", balance: this.getRunsBalance() };
    }

    const r = ensureObjectBranch(requireData(this), "runs", () => deepCopy(this.defaultData.runs));
    const bal = clampNonNegativeInt(r.balance);

    if (bal > 0) {
      r.balance = Math.max(0, bal - 1);
      this.data.counters.runStarts = clampNonNegativeInt(this.data.counters.runStarts) + 1;
      this._save();
      return { ok: true, reason: "CONSUMED", balance: this.getRunsBalance() };
    }

    r.limitReachedCount = clampNonNegativeInt(r.limitReachedCount) + 1;
    this._save();
    return { ok: false, reason: "NO_RUNS", balance: 0 };
  };


  // ============================================
  // Settings
  // ============================================
  StorageManager.prototype.setSoundEnabled = function (on) {
    if (!this.data) return;
    ensureObjectBranch(requireData(this), "settings", () => deepCopy(this.defaultData.settings));
    this.data.settings.soundEnabled = (on === true);
    this._save();
  };

  StorageManager.prototype.getSoundEnabled = function () {
    const v = this.data?.settings?.soundEnabled;
    return (v === false) ? false : true; // default true
  };

  StorageManager.prototype.setHapticsEnabled = function (on) {
    if (!this.data) return;
    ensureObjectBranch(requireData(this), "settings", () => deepCopy(this.defaultData.settings));
    this.data.settings.hapticsEnabled = (on === true);
    this._save();
  };

  StorageManager.prototype.getHapticsEnabled = function () {
    if (!this.data || !isPlainObject(this.data.settings)) throw new Error("StorageManager.getHapticsEnabled: settings missing");
    if (typeof this.data.settings.hapticsEnabled !== "boolean") throw new Error("StorageManager.getHapticsEnabled: settings.hapticsEnabled invalid");
    return this.data.settings.hapticsEnabled;
  };


  // ============================================
  // Run completion
  // ============================================
  StorageManager.prototype.recordRunComplete = function (runNumber, scoreValue, meta) {
    if (!this.data) return { ok: false, newBest: false };

    const score = clampNonNegativeInt(scoreValue);
    const rn = clampNonNegativeInt(runNumber);

    // Counters
    this.data.counters.runNumber = Math.max(this.data.counters.runNumber, rn);
    this.data.counters.runCompletes = clampNonNegativeInt(this.data.counters.runCompletes) + 1;
    this.data.counters.totalLifetimeScore = clampNonNegativeInt(this.data.counters.totalLifetimeScore) + score;

    // Personal best (RUN mode only)
    const mode = String((meta && meta.mode) == null ? "" : meta.mode).trim().toUpperCase();
    const isRun = (mode === MODES.RUN);
    const isDaily = !!(meta && meta.isDaily === true);

    const pb = ensureObjectBranch(requireData(this), "personalBest", () => deepCopy(this.defaultData.personalBest));
    const prevBest = clampNonNegativeInt(pb.bestScore);

    let newBest = false;

    if (isRun && !isDaily && score > prevBest) {
      pb.bestScore = score;
      pb.achievedAt = now();
      this.data.personalBest = pb;

      // Don't celebrate on very first run completion (rn <= 1)
      newBest = (rn >= 2);
    }

    // Run history
    const list = (this.data.history && Array.isArray(this.data.history.lastRuns))
      ? this.data.history.lastRuns
      : [];

    const entry = {
      runNumber: rn,
      endedAt: now(),
      score: score,
      meta: (meta && typeof meta === "object") ? meta : {}
    };

    list.unshift(entry);
    while (list.length > 20) list.pop();

    this.data.history = ensureObjectBranch(requireData(this), "history", () => deepCopy(this.defaultData.history));
    this.data.history.lastRuns = list;

    this._save();

    return { ok: true, newBest, bestScore: clampNonNegativeInt(this.data.personalBest.bestScore) };
  };


  // ============================================
  // Sprint completion
  // ============================================
  StorageManager.prototype.recordSprintComplete = function (scoreValue) {
    if (!this.data) return { ok: false, newBest: false };

    const score = clampNonNegativeInt(scoreValue);

    // Counters
    this.data.counters.sprintCompletes = clampNonNegativeInt(this.data.counters.sprintCompletes) + 1;
    this.data.counters.totalLifetimeScore = clampNonNegativeInt(this.data.counters.totalLifetimeScore) + score;

    // Sprint best
    const sb = ensureObjectBranch(requireData(this), "sprintBest", () => deepCopy(this.defaultData.sprintBest));
    const prevBest = clampNonNegativeInt(sb.bestScore);

    let newBest = false;

    if (score > prevBest) {
      sb.bestScore = score;
      sb.achievedAt = now();
      this.data.sprintBest = sb;

      // Celebrate from second sprint onward
      const sprintCompletes = clampNonNegativeInt(this.data.counters.sprintCompletes);
      newBest = (sprintCompletes >= 2);
    }

    this._save();

    return { ok: true, newBest, bestScore: clampNonNegativeInt(this.data.sprintBest.bestScore) };
  };

  StorageManager.prototype.markSprintStarted = function () {
    if (!this.data) return;
    this.data.counters.sprintStarts = clampNonNegativeInt(this.data.counters.sprintStarts) + 1;
    this._save();
  };


  // ============================================
  // Paywall / Checkout counters
  // ============================================
  StorageManager.prototype.markLandingViewed = function () {
    if (!this.data) return;
    this.data.counters.landingViewed = clampNonNegativeInt(this.data.counters.landingViewed) + 1;
    this._save();
  };

  StorageManager.prototype.markLandingPlayClicked = function () {
    if (!this.data) return;
    this.data.counters.landingPlayClicked = clampNonNegativeInt(this.data.counters.landingPlayClicked) + 1;
    this._save();
  };

  StorageManager.prototype.markPaywallShown = function () {
    if (!this.data) return;
    this.data.counters.paywallShown = clampNonNegativeInt(this.data.counters.paywallShown) + 1;

    // Early price window starts once, at the first PAYWALL view
    const data = requireData(this);
    const ep = ensureObjectBranch(data, "earlyPrice", () => deepCopy(this.defaultData.earlyPrice));
    if (!clampNonNegativeInt(ep.startedAt)) {
      ep.startedAt = now();
    }
    this.data.earlyPrice = ep;
    this._save();
  };

  StorageManager.prototype.markCheckoutStarted = function (priceKey) {
    if (!this.data) return;

    const k = String(priceKey || "").trim();
    if (!k) return;

    if (!this.data.counters || typeof this.data.counters !== "object") {
      this.data.counters = deepCopy(this.defaultData.counters);
    }

    this.data.counters.checkoutStarted = clampNonNegativeInt(this.data.counters.checkoutStarted) + 1;
    this._save();
  };

  StorageManager.prototype.markShareClicked = function () {
    if (!this.data) return;
    this.data.counters.shareClicked = clampNonNegativeInt(this.data.counters.shareClicked) + 1;
    this._save();
  };

  StorageManager.prototype.markInstallPromptShown = function () {
    if (!this.data) return;
    this.data.counters.installPromptShown = clampNonNegativeInt(this.data.counters.installPromptShown) + 1;
    this._save();
  };


  // ============================================
  // UI Flags (sprint chest, first-run framing)
  // ============================================
  StorageManager.prototype.hasSprintChestHintSolved = function () {
    return !!(this.data && this.data.flags && this.data.flags.sprintChestHintSolved);
  };

  StorageManager.prototype.markSprintChestHintSolved = function () {
    if (!this.data) return;
    if (!this.data.flags) this.data.flags = deepCopy(this.defaultData.flags);
    this.data.flags.sprintChestHintSolved = true;
    this._save();
  };

  StorageManager.prototype.hasSprintChestWelcomeShown = function () {
    return !!(this.data && this.data.flags && this.data.flags.sprintChestWelcomeShown);
  };

  StorageManager.prototype.markSprintChestWelcomeShown = function () {
    if (!this.data) return;
    if (!this.data.flags) this.data.flags = deepCopy(this.defaultData.flags);
    this.data.flags.sprintChestWelcomeShown = true;
    this._save();
  };

  StorageManager.prototype.hasFirstRunFramingSeen = function () {
    return !!(this.data && this.data.flags && this.data.flags.firstRunFramingSeen);
  };

  StorageManager.prototype.markFirstRunFramingSeen = function () {
    if (!this.data) return;
    if (!this.data.flags) this.data.flags = deepCopy(this.defaultData.flags);
    this.data.flags.firstRunFramingSeen = true;
    this._save();
  };

  StorageManager.prototype.getVanityCode = function () {
    if (!this.config || !isPlainObject(this.config.storage)) throw new Error("StorageManager.getVanityCode: config.storage missing");
    var vanityKey = requiredTrimmedString(this.config.storage.vanityCodeStorageKey, "StorageManager.getVanityCode: config.storage.vanityCodeStorageKey");
    try {
      var raw = localStorage.getItem(vanityKey);
      return requiredTrimmedString(raw, "StorageManager.getVanityCode(): vanity code");
    } catch (_) {
      return "";
    }
  };


  // ============================================
  // Premium activation (codes)
  // ============================================
  StorageManager.prototype.unlockPremium = function () {
    if (!this.data) return { ok: false, already: false };
    if (this.data.isPremium) return { ok: true, already: true };

    if (!this.data.counters || typeof this.data.counters !== "object") {
      this.data.counters = deepCopy(this.defaultData.counters);
    }

    this.data.isPremium = true;
    this._save();
    return { ok: true, already: false };
  };

  StorageManager.prototype.tryRedeemPremiumCode = function (codeInput) {
    if (!this.data) return { ok: false, reason: "NO_DATA" };

    if (this.isPremium()) return { ok: true, reason: "ALREADY" };

    const cfg = this.config;
    const code = String(codeInput || "").trim();
    if (!code) return { ok: false, reason: "EMPTY" };

    this._compileCodeRegex();
    const re = this._premiumCodeRe;
    if (!re) return { ok: false, reason: "DISABLED" };

    try { re.lastIndex = 0; } catch (_) { }
    if (!re.test(code)) return { ok: false, reason: "INVALID" };

    // Ensure codes block exists
    if (!this.data.codes || typeof this.data.codes !== "object") {
      this.data.codes = { redeemedOnce: false, code: "" };
    }
    if (typeof this.data.codes.redeemedOnce !== "boolean") this.data.codes.redeemedOnce = false;
    if (typeof this.data.codes.code !== "string") this.data.codes.code = "";

    // Enforce "one code per device" if enabled
    const acceptOnce = (cfg.acceptCodeOncePerDevice === true);
    if (acceptOnce && this.data.codes.redeemedOnce === true) {
      return { ok: false, reason: "USED" };
    }

    if (acceptOnce) {
      this.data.codes.redeemedOnce = true;
    }
    this.data.codes.code = code;

    // Vanity key (UI convenience)
    const vanityKey = requiredTrimmedString(cfg.storage.vanityCodeStorageKey, "StorageManager.tryRedeemPremiumCode: config.storage.vanityCodeStorageKey");
    try { window.localStorage.setItem(vanityKey, code); } catch (_) { /* ignore */ }

    // Counters
    if (this.data.counters) {
      this.data.counters.codeRedeemed = clampNonNegativeInt(this.data.counters.codeRedeemed) + 1;
    }

    // Unlock premium
    const res = this.unlockPremium();
    if (res && res.ok) {
      return { ok: true, reason: "UNLOCKED" };
    }

    // Revert on failure
    if (acceptOnce) {
      this.data.codes.redeemedOnce = false;
    }
    this.data.codes.code = "";
    this._save();

    return { ok: false, reason: "FAILED" };
  };


  // ============================================
  // House Ad / Waitlist persisted states
  // ============================================
  StorageManager.prototype.hasSeenHouseAdIntro = function () {
    return !!(this.data?.houseAd?.introSeen);
  };

  StorageManager.prototype.markSeenHouseAdIntro = function () {
    if (!this.data) return;
    if (!this.data.houseAd || typeof this.data.houseAd !== "object") {
      this.data.houseAd = deepCopy(this.defaultData.houseAd);
    }
    this.data.houseAd.introSeen = true;
    this._save();
  };

  StorageManager.prototype.getHouseAdState = function () {
    const houseAd = ensureObjectBranch(requireData(this), "houseAd", () => deepCopy(this.defaultData.houseAd));
    const s = requiredTrimmedString(houseAd.state, "StorageManager.getHouseAdState: houseAd.state");
    return (s === "never_seen" || s === "remind_later") ? s : "never_seen";
  };

  StorageManager.prototype.setHouseAdState = function (state) {
    if (!this.data) return;
    const s = requiredTrimmedString(state, "StorageManager.setHouseAdState(state)");
    if (s !== "never_seen" && s !== "remind_later") return;

    if (!this.data.houseAd || typeof this.data.houseAd !== "object") {
      this.data.houseAd = deepCopy(this.defaultData.houseAd);
    }
    this.data.houseAd.state = s;
    this._save();
  };

  StorageManager.prototype.getHouseAdHiddenUntil = function () {
    const settings = ensureObjectBranch(requireData(this), "settings", () => deepCopy(this.defaultData.settings));
    return clampNonNegativeInt(settings.houseAdHiddenUntil);
  };

  StorageManager.prototype.isHouseAdHiddenNow = function () {
    const until = this.getHouseAdHiddenUntil();
    return (until > 0 && now() < until);
  };

  StorageManager.prototype.setHouseAdHiddenUntil = function (untilMs) {
    if (!this.data) return;
    if (!this.data.settings || typeof this.data.settings !== "object") {
      this.data.settings = deepCopy(this.defaultData.settings);
    }
    this.data.settings.houseAdHiddenUntil = clampNonNegativeInt(untilMs);
    this._save();
  };

  StorageManager.prototype.hideHouseAdUsingConfig = function () {
    if (!this.data) return { ok: false, until: 0 };
    if (!this.config || !isPlainObject(this.config.houseAd)) throw new Error("StorageManager.hideHouseAdUsingConfig: config.houseAd missing");
    const hideMs = requiredNonNegativeInt(this.config.houseAd.hideMs, "StorageManager.hideHouseAdUsingConfig: config.houseAd.hideMs");
    if (hideMs <= 0) return { ok: false, until: 0 };

    const until = now() + hideMs;

    if (!this.data.houseAd || typeof this.data.houseAd !== "object") {
      this.data.houseAd = deepCopy(this.defaultData.houseAd);
    }
    if (!this.data.settings || typeof this.data.settings !== "object") {
      this.data.settings = deepCopy(this.defaultData.settings);
    }

    this.data.houseAd.state = "remind_later";
    this.data.settings.houseAdHiddenUntil = clampNonNegativeInt(until);
    this._save();
    return { ok: true, until: until };
  };

  StorageManager.prototype._countReachedRunMilestones = function (values) {
    if (!Array.isArray(values) || values.length === 0) return 0;
    const rc = clampNonNegativeInt(this.data?.counters?.runCompletes);
    let count = 0;
    for (let i = 0; i < values.length; i += 1) {
      const n = clampNonNegativeInt(values[i]);
      if (n > 0 && rc >= n) count += 1;
    }
    return count;
  };

  // Config-driven unlock: has the user completed enough runs to show House Ad?
  StorageManager.prototype.hasReachedHouseAdThreshold = function () {
    if (!this.data) return false;
    if (!this.config || !isPlainObject(this.config.houseAd)) throw new Error("StorageManager.hasReachedHouseAdThreshold: config.houseAd missing");
    const milestones = this.config.houseAd.showAfterRunCompletes;
    if (!Array.isArray(milestones) || milestones.length === 0) return false;
    return this._countReachedRunMilestones(milestones) > 0;
  };

  StorageManager.prototype.shouldShowHouseAdNow = function (ctx) {
    if (!this.data) return false;
    const cfg = this.config;
    if (!cfg || !isPlainObject(cfg.houseAd)) throw new Error("StorageManager.shouldShowHouseAdNow: config.houseAd missing");
    const haCfg = cfg.houseAd;
    if (haCfg.enabled !== true) return false;
    const houseAdUrl = String(haCfg.url).trim();
    if (!houseAdUrl) return false;
    if (this.hasReachedHouseAdThreshold() !== true) return false;
    if (ctx && ctx.inRun === true) return false;
    if (this.isHouseAdHiddenNow()) return false;
    const milestones = haCfg.showAfterRunCompletes;
    if (Array.isArray(milestones) && milestones.length > 0) {
      const eligible = this._countReachedRunMilestones(milestones);
      const shown = clampNonNegativeInt(this.data?.counters?.houseAdShown);
      return eligible > shown;
    }
    return true;
  };

  StorageManager.prototype.markHouseAdShown = function () {
    if (!this.data) return;
    this.data.counters.houseAdShown = clampNonNegativeInt(this.data.counters.houseAdShown) + 1;
    this._save();
  };

  StorageManager.prototype.markHouseAdClicked = function () {
    if (!this.data) return;
    this.data.counters.houseAdClicked = clampNonNegativeInt(this.data.counters.houseAdClicked) + 1;
    this._save();
  };


  // Waitlist
  StorageManager.prototype.getWaitlistStatus = function () {
    const waitlist = ensureObjectBranch(requireData(this), "waitlist", () => deepCopy(this.defaultData.waitlist));
    const s = requiredTrimmedString(waitlist.status, "StorageManager.getWaitlistStatus(): waitlist.status");
    return (s === "not_seen" || s === "seen" || s === "joined") ? s : "not_seen";
  };

  StorageManager.prototype.setWaitlistStatus = function (status) {
    if (!this.data) return;
    const s = String(status || "").trim();
    if (s !== "not_seen" && s !== "seen" && s !== "joined") return;

    if (!this.data.waitlist || typeof this.data.waitlist !== "object") {
      this.data.waitlist = deepCopy(this.defaultData.waitlist);
    }
    this.data.waitlist.status = s;
    this._save();
  };

  StorageManager.prototype.getWaitlistDraftIdea = function () {
    const waitlist = ensureObjectBranch(requireData(this), "waitlist", () => deepCopy(this.defaultData.waitlist));
    return String(waitlist.draftIdea == null ? "" : waitlist.draftIdea).trim();
  };

  StorageManager.prototype.setWaitlistDraftIdea = function (idea) {
    if (!this.data) return;
    if (!this.data.waitlist || typeof this.data.waitlist !== "object") {
      this.data.waitlist = deepCopy(this.defaultData.waitlist);
    }
    this.data.waitlist.draftIdea = String(idea || "").trim();
    this._save();
  };

  StorageManager.prototype.hasReachedWaitlistThreshold = function () {
    if (!this.data) return false;
    if (!this.config || !isPlainObject(this.config.waitlist)) throw new Error("StorageManager.hasReachedWaitlistThreshold: config.waitlist missing");
    const milestones = this.config.waitlist.showAfterRunCompletes;
    if (!Array.isArray(milestones) || milestones.length === 0) return false;
    return this._countReachedRunMilestones(milestones) > 0;
  };

  StorageManager.prototype.shouldShowWaitlistNow = function (ctx) {
    if (!this.data) return false;
    const cfg = this.config;
    if (!cfg || !isPlainObject(cfg.waitlist)) throw new Error("StorageManager.shouldShowWaitlistNow: config.waitlist missing");
    const wlCfg = cfg.waitlist;
    if (wlCfg.enabled !== true) return false;
    if (this.hasReachedWaitlistThreshold() !== true) return false;
    if (ctx && ctx.inRun === true) return false;
    const waitlist = ensureObjectBranch(requireData(this), "waitlist", () => deepCopy(this.defaultData.waitlist));
    const st = requiredTrimmedString(waitlist.status, "StorageManager.shouldShowWaitlistNow(): waitlist.status");
    if (st === "joined") return false;
    return st === "not_seen";
  };


  // ============================================
  // Stats sharing prompt
  // ============================================
  StorageManager.prototype.getStatsSharingPromptFlags = function () {
    const n = Number(this.data?.statsSharingPromptFlags);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  };

  StorageManager.prototype.markStatsSharingPromptFlag = function (flagBit) {
    if (!this.data) return;
    const b = Number(flagBit);
    if (!Number.isFinite(b) || b <= 0) return;
    const cur = this.getStatsSharingPromptFlags();
    const next = (cur | Math.floor(b));
    if (next === cur) return;
    this.data.statsSharingPromptFlags = next;
    this._save();
  };

  StorageManager.prototype.getStatsSharingSnoozeUntilRunCompletes = function () {
    const n = Number(this.data?.statsSharingSnoozeUntilRunCompletes);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  };

  StorageManager.prototype.setStatsSharingSnoozeUntilRunCompletes = function (n) {
    if (!this.data) return;
    const v = Number(n);
    if (!Number.isFinite(v) || v < 0) return;
    this.data.statsSharingSnoozeUntilRunCompletes = Math.floor(v);
    this._save();
  };

  StorageManager.prototype.snoozeStatsSharingPromptNextEnd = function () {
    if (!this.data) return;
    const runs = clampNonNegativeInt(this.data?.counters?.runCompletes);
    this.setStatsSharingSnoozeUntilRunCompletes(runs + 1);
  };


  // ============================================
  // Anonymous Stats Payload (opt-in sharing)
  // ============================================
  StorageManager.prototype.getAnonymousStatsPayload = function () {
    if (!this.data) return null;

    const cfg = this.config;
    if (!cfg || !isPlainObject(cfg.statsSharing)) throw new Error("StorageManager.getAnonymousStatsPayload: config.statsSharing missing");
    const schemaVersion = String(cfg.statsSharing.schemaVersion).trim();
    if (!schemaVersion) throw new Error("StorageManager.getAnonymousStatsPayload: config.statsSharing.schemaVersion missing");

    let device = "desktop";
    try {
      if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
        device = "mobile";
      }
    } catch (_) { }

    return {
      v: schemaVersion,
      ts: new Date().toISOString(),
      runs: clampNonNegativeInt(this.data.counters?.runCompletes),
      sprintRuns: clampNonNegativeInt(this.data.counters?.sprintCompletes),
      isPremium: !!(this.data.isPremium),
      personalBest: clampNonNegativeInt(this.data.personalBest.bestScore),
      sprintBest: clampNonNegativeInt(this.data.sprintBest.bestScore),
      device: device,

      funnel: {
        landingViewed: clampNonNegativeInt(this.data.counters?.landingViewed),
        landingPlayClicked: clampNonNegativeInt(this.data.counters?.landingPlayClicked),
        paywallShown: clampNonNegativeInt(this.data.counters?.paywallShown),
        checkoutStarted: clampNonNegativeInt(this.data.counters?.checkoutStarted)
      }
    };
  };


  // ============================================
  // Export
  // ============================================
  window.KR_StorageManager = StorageManager;
})();
