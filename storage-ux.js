// storage-ux.js - UX and growth state helpers for Kitchen Rush storage

(() => {
  "use strict";

  function clampNonNegativeInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.floor(x));
  }

  function deepCopy(obj) {
    try {
      if (typeof structuredClone === "function") return structuredClone(obj);
    } catch (_) { }
    return JSON.parse(JSON.stringify(obj));
  }

  function now() {
    return Date.now();
  }

  function install(StorageManager) {
    if (!StorageManager || !StorageManager.prototype) {
      throw new Error("KR_STORAGE_UX.install(): StorageManager missing");
    }

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
      if (haCfg.premiumOnly === true && !(ctx && ctx.premium === true)) return false;
      if (haCfg.suppressOnPostPaywall === true && ctx && ctx.postPaywallActive === true) return false;
      if (haCfg.suppressWhenWaitlistVisible === true && ctx && ctx.waitlistActive === true) return false;
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
      if (wlCfg.suppressOnPostPaywall === true && ctx && ctx.postPaywallActive === true) return false;
      if (wlCfg.suppressWhenHouseAdVisible === true && ctx && ctx.houseAdActive === true) return false;
      if (wlCfg.afterPoolExhaustedOnly === true && !(ctx && ctx.premium !== true && Number(ctx.balance) <= 0)) return false;

      const placement = String(wlCfg.placement || "").trim();
      if (ctx && ctx.screen === "LANDING") {
        if (placement === "end-only") return false;
        if (placement === "end-and-landing-after-seen-once" && st !== "seen") return false;
      }
      if (ctx && ctx.screen === "END") {
        if (placement === "landing-only") return false;
        if (ctx.isSprint === true && wlCfg.showOnSprintEnd !== true) return false;
        if (wlCfg.suppressWhenStatsPromptVisible === true && ctx.showStatsPrompt === true) return false;
        if (wlCfg.suppressWhenShareVisible === true && ctx.showShare === true) return false;
      }
      return true;
    };

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
  }

  window.KR_STORAGE_UX = { install: install };
})();
