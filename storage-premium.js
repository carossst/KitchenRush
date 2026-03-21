// storage-premium.js - premium and code redemption helpers for Kitchen Rush storage

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

  function install(StorageManager) {
    if (!StorageManager || !StorageManager.prototype) {
      throw new Error("KR_STORAGE_PREMIUM.install(): StorageManager missing");
    }

    StorageManager.prototype.getVanityCode = function () {
      var vanityKey = String(this.config?.storage?.vanityCodeStorageKey || "").trim();
      if (!vanityKey) return "";
      try { return String(localStorage.getItem(vanityKey) || "").trim(); } catch (_) { return ""; }
    };

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

      if (!this.data.codes || typeof this.data.codes !== "object") {
        this.data.codes = { redeemedOnce: false, code: "" };
      }
      if (typeof this.data.codes.redeemedOnce !== "boolean") this.data.codes.redeemedOnce = false;
      if (typeof this.data.codes.code !== "string") this.data.codes.code = "";

      const acceptOnce = (cfg.acceptCodeOncePerDevice === true);
      if (acceptOnce && this.data.codes.redeemedOnce === true) {
        return { ok: false, reason: "USED" };
      }

      if (acceptOnce) {
        this.data.codes.redeemedOnce = true;
      }
      this.data.codes.code = code;

      const vanityKey = String(cfg?.storage?.vanityCodeStorageKey || "").trim();
      if (vanityKey) {
        try { window.localStorage.setItem(vanityKey, code); } catch (_) { }
      }

      if (this.data.counters) {
        this.data.counters.codeRedeemed = clampNonNegativeInt(this.data.counters.codeRedeemed) + 1;
      }

      const res = this.unlockPremium();
      if (res && res.ok) {
        return { ok: true, reason: "UNLOCKED" };
      }

      if (acceptOnce) {
        this.data.codes.redeemedOnce = false;
      }
      this.data.codes.code = "";
      this._save();

      return { ok: false, reason: "FAILED" };
    };
  }

  window.KR_STORAGE_PREMIUM = { install: install };
})();
