/* Kitchen Rush - storage (V1) */
/* Kitchen Rush */
/* Removed: statsByItem, practice, houseAd, waitlist, statsSharing, recordAnswer. */
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
        houseAdHiddenUntil: 0
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
        sprintChestHintSolved: false,
        sprintChestWelcomeShown: false,
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

    // No legacy support: mismatch => reset
    if (!loaded || typeof loaded !== "object" || String(loaded.version || "") !== schemaVersion) {
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

    // Harden flags (migrate from legacy separate localStorage keys)
    if (!this.data.flags || typeof this.data.flags !== "object") {
      this.data.flags = deepCopy(this.defaultData.flags);
    }
    var fl = this.data.flags;
    if (typeof fl.sprintChestHintSolved !== "boolean") fl.sprintChestHintSolved = false;
    if (typeof fl.sprintChestWelcomeShown !== "boolean") fl.sprintChestWelcomeShown = false;
    if (typeof fl.firstRunFramingSeen !== "boolean") fl.firstRunFramingSeen = false;

    // One-time migration: read legacy localStorage keys and absorb them
    var storageKey = String(cfg?.storage?.storageKey || "").trim();
    if (storageKey) {
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

  StorageManager.prototype.getRunsBalance = function () {
    return clampNonNegativeInt(this.data?.runs?.balance);
  };

  StorageManager.prototype.getRunsUsed = function () {
    return clampNonNegativeInt(this.data?.counters?.runStarts);
  };

  StorageManager.prototype.getRunNumber = function () {
    return clampNonNegativeInt(this.data?.counters?.runNumber);
  };

  StorageManager.prototype.getCounters = function () {
    return this.data?.counters || {};
  };

  StorageManager.prototype.getData = function () {
    return this.data || {};
  };

  StorageManager.prototype.getPersonalBest = function () {
    const pb = this.data?.personalBest || {};
    return {
      bestSmashes: clampNonNegativeInt(pb.bestSmashes),
      achievedAt: clampNonNegativeInt(pb.achievedAt)
    };
  };

  StorageManager.prototype.getSprintBest = function () {
    const sb = this.data?.sprintBest || {};
    return {
      bestSmashes: clampNonNegativeInt(sb.bestSmashes),
      achievedAt: clampNonNegativeInt(sb.achievedAt)
    };
  };

  StorageManager.prototype.getSprintFreeRunsUsed = function () {
    return clampNonNegativeInt(this.data?.counters?.sprintFreeRunsUsed);
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

    const list = (this.data?.history && Array.isArray(this.data.history.lastRuns))
      ? this.data.history.lastRuns
      : [];

    return list.slice(0, n).map((e) => {
      const it = (e && typeof e === "object") ? e : {};
      return {
        runNumber: clampNonNegativeInt(it.runNumber),
        endedAt: clampNonNegativeInt(it.endedAt),
        smashes: clampNonNegativeInt(it.smashes),
        meta: (it.meta && typeof it.meta === "object") ? it.meta : {}
      };
    });
  };

  StorageManager.prototype.getEarlyPriceState = function () {
    const ep = this.data?.earlyPrice || {};
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

    const r = this.data.runs || {};
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


  // ============================================
  // Run completion
  // ============================================
  StorageManager.prototype.recordRunComplete = function (runNumber, smashes, meta) {
    if (!this.data) return { ok: false, newBest: false };

    const score = clampNonNegativeInt(smashes);
    const rn = clampNonNegativeInt(runNumber);

    // Counters
    this.data.counters.runNumber = Math.max(this.data.counters.runNumber, rn);
    this.data.counters.runCompletes = clampNonNegativeInt(this.data.counters.runCompletes) + 1;
    this.data.counters.totalLifetimeSmashes = clampNonNegativeInt(this.data.counters.totalLifetimeSmashes) + score;

    // Personal best (RUN mode only)
    const mode = String(meta && meta.mode || "").trim().toUpperCase();
    const isRun = (mode === MODES.RUN);

    const pb = this.data.personalBest || { bestSmashes: 0, achievedAt: 0 };
    const prevBest = clampNonNegativeInt(pb.bestSmashes);

    let newBest = false;

    if (isRun && score > prevBest) {
      pb.bestSmashes = score;
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
      smashes: score,
      meta: (meta && typeof meta === "object") ? meta : {}
    };

    list.unshift(entry);
    while (list.length > 20) list.pop();

    this.data.history = this.data.history || {};
    this.data.history.lastRuns = list;

    this._save();

    return { ok: true, newBest, bestSmashes: clampNonNegativeInt(this.data.personalBest.bestSmashes) };
  };


  // ============================================
  // Sprint completion
  // ============================================
  StorageManager.prototype.recordSprintComplete = function (smashes) {
    if (!this.data) return { ok: false, newBest: false };

    const score = clampNonNegativeInt(smashes);

    // Counters
    this.data.counters.sprintCompletes = clampNonNegativeInt(this.data.counters.sprintCompletes) + 1;
    this.data.counters.totalLifetimeSmashes = clampNonNegativeInt(this.data.counters.totalLifetimeSmashes) + score;

    // Sprint best
    const sb = this.data.sprintBest || { bestSmashes: 0, achievedAt: 0 };
    const prevBest = clampNonNegativeInt(sb.bestSmashes);

    let newBest = false;

    if (score > prevBest) {
      sb.bestSmashes = score;
      sb.achievedAt = now();
      this.data.sprintBest = sb;

      // Celebrate from second sprint onward
      const sprintCompletes = clampNonNegativeInt(this.data.counters.sprintCompletes);
      newBest = (sprintCompletes >= 2);
    }

    this._save();

    return { ok: true, newBest, bestSmashes: clampNonNegativeInt(this.data.sprintBest.bestSmashes) };
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
    const ep = this.data.earlyPrice || {};
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
    var vanityKey = String(this.config?.storage?.vanityCodeStorageKey || "").trim();
    if (!vanityKey) return "";
    try { return String(localStorage.getItem(vanityKey) || "").trim(); } catch (_) { return ""; }
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

    const cfg = this.config || {};
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
    const vanityKey = String(cfg?.storage?.vanityCodeStorageKey || "").trim();
    if (vanityKey) {
      try { window.localStorage.setItem(vanityKey, code); } catch (_) { /* ignore */ }
    }

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
    const s = String(this.data?.houseAd?.state || "").trim();
    return (s === "never_seen" || s === "remind_later") ? s : "never_seen";
  };

  StorageManager.prototype.setHouseAdState = function (state) {
    if (!this.data) return;
    const s = String(state || "").trim();
    if (s !== "never_seen" && s !== "remind_later") return;

    if (!this.data.houseAd || typeof this.data.houseAd !== "object") {
      this.data.houseAd = deepCopy(this.defaultData.houseAd);
    }
    this.data.houseAd.state = s;
    this._save();
  };

  StorageManager.prototype.getHouseAdHiddenUntil = function () {
    return clampNonNegativeInt(this.data?.settings?.houseAdHiddenUntil);
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
    const hideMs = clampNonNegativeInt(this.config?.houseAd?.hideMs);
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

  // Config-driven unlock: has the user completed enough runs to show House Ad?
  StorageManager.prototype.hasReachedHouseAdThreshold = function () {
    if (!this.data) return false;
    const n = clampNonNegativeInt(this.config?.houseAd?.minRunCompletesToShow);
    if (n <= 0) return false;
    return clampNonNegativeInt(this.data?.counters?.runCompletes) >= n;
  };

  StorageManager.prototype.shouldShowHouseAdNow = function (ctx) {
    if (!this.data) return false;
    const cfg = this.config || {};
    const haCfg = cfg.houseAd || {};
    if (haCfg.enabled !== true) return false;
    if (!String(haCfg.url || "").trim()) return false;
    if (this.hasReachedHouseAdThreshold() !== true) return false;
    if (ctx && ctx.inRun === true) return false;
    if (this.isHouseAdHiddenNow()) return false;
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
    const s = String(this.data?.waitlist?.status || "").trim();
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
    return String(this.data?.waitlist?.draftIdea || "").trim();
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
    const n = clampNonNegativeInt(this.config?.waitlist?.minRunCompletesToShow);
    if (n <= 0) return false;
    return clampNonNegativeInt(this.data?.counters?.runCompletes) >= n;
  };

  StorageManager.prototype.shouldShowWaitlistNow = function (ctx) {
    if (!this.data) return false;
    const cfg = this.config || {};
    const wlCfg = cfg.waitlist || {};
    if (wlCfg.enabled !== true) return false;
    if (this.hasReachedWaitlistThreshold() !== true) return false;
    if (ctx && ctx.inRun === true) return false;
    const st = String(this.data?.waitlist?.status || "").trim();
    if (st === "joined") return false;
    return true;
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

    const cfg = this.config || {};
    const schemaVersion = String(cfg?.statsSharing?.schemaVersion || "1.0");

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
      personalBest: clampNonNegativeInt(this.data.personalBest?.bestSmashes),
      sprintBest: clampNonNegativeInt(this.data.sprintBest?.bestSmashes),
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
