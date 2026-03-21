// storage-runs.js - run economy, history and milestone helpers for Kitchen Rush storage

(() => {
  "use strict";

  function now() {
    return Date.now();
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
    } catch (_) { }
    return JSON.parse(JSON.stringify(obj));
  }

  function install(StorageManager) {
    if (!StorageManager || !StorageManager.prototype) {
      throw new Error("KR_STORAGE_RUNS.install(): StorageManager missing");
    }

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

    StorageManager.prototype.recordRunComplete = function (runNumber, smashes, meta) {
      if (!this.data) return { ok: false, newBest: false };

      const score = clampNonNegativeInt(smashes);
      const rn = clampNonNegativeInt(runNumber);

      this.data.counters.runNumber = Math.max(this.data.counters.runNumber, rn);
      this.data.counters.runCompletes = clampNonNegativeInt(this.data.counters.runCompletes) + 1;
      this.data.counters.totalLifetimeSmashes = clampNonNegativeInt(this.data.counters.totalLifetimeSmashes) + score;

      const mode = String(meta && meta.mode || "").trim().toUpperCase();
      const isRun = (mode === this.modes.RUN);

      const pb = this.data.personalBest || { bestSmashes: 0, achievedAt: 0 };
      const prevBest = clampNonNegativeInt(pb.bestSmashes);

      let newBest = false;

      if (isRun && score > prevBest) {
        pb.bestSmashes = score;
        pb.achievedAt = now();
        this.data.personalBest = pb;
        const minRunCompletes = requiredNonNegativeInt(
          this.config?.history?.minRunCompletesForNewBestCelebrate,
          "StorageManager.recordRunComplete(): config.history.minRunCompletesForNewBestCelebrate"
        );
        newBest = (rn >= minRunCompletes);
      }

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

    StorageManager.prototype.recordSprintComplete = function (smashes) {
      if (!this.data) return { ok: false, newBest: false };

      const score = clampNonNegativeInt(smashes);

      this.data.counters.sprintCompletes = clampNonNegativeInt(this.data.counters.sprintCompletes) + 1;
      this.data.counters.totalLifetimeSmashes = clampNonNegativeInt(this.data.counters.totalLifetimeSmashes) + score;

      const sb = this.data.sprintBest || { bestSmashes: 0, achievedAt: 0 };
      const prevBest = clampNonNegativeInt(sb.bestSmashes);

      let newBest = false;

      if (score > prevBest) {
        sb.bestSmashes = score;
        sb.achievedAt = now();
        this.data.sprintBest = sb;

        const sprintCompletes = clampNonNegativeInt(this.data.counters.sprintCompletes);
        const minSprintCompletes = requiredNonNegativeInt(
          this.config?.history?.minSprintCompletesForNewBestCelebrate,
          "StorageManager.recordSprintComplete(): config.history.minSprintCompletesForNewBestCelebrate"
        );
        newBest = (sprintCompletes >= minSprintCompletes);
      }

      this._save();

      return { ok: true, newBest, bestSmashes: clampNonNegativeInt(this.data.sprintBest.bestSmashes) };
    };

    StorageManager.prototype.markSprintStarted = function () {
      if (!this.data) return;
      this.data.counters.sprintStarts = clampNonNegativeInt(this.data.counters.sprintStarts) + 1;
      this._save();
    };

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
  }

  window.KR_STORAGE_RUNS = { install: install };
})();
