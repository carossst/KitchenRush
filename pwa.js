// pwa.js v1.0 - Kitchen Rush
// Install prompt logic (A2HS) - KISS
// Transformed from Word Traps pwa.js — same pattern, KR_ prefix.
// UI owns when to show; copy is in KR_WORDING.installPrompt.*

(() => {
  "use strict";

  let deferredPrompt = null;

  // Capture the beforeinstallprompt event (Chrome/Edge/Android)
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  // If app gets installed, clear prompt handle
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
  });

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  }

  function getCompletedCount(storage) {
    if (!storage || typeof storage.getCounters !== "function") return 0;
    const c = storage.getCounters() || {};
    const runCompletes = Number(c.runCompletes || 0);
    return (Number.isFinite(runCompletes) && runCompletes > 0) ? runCompletes : 0;
  }

  function canPrompt(config, storage) {
    if (!config?.installPrompt?.enabled) return false;
    if (isStandalone()) return false;

    const completed = getCompletedCount(storage);

    const gateAfterFirst =
      (config.installPrompt && config.installPrompt.triggerAfterFirstCompletedRun === true);

    if (gateAfterFirst) {
      if (completed < 1) return false;
    }

    // iOS: no beforeinstallprompt; UI can still show instructions modal
    if (isIOS()) return true;

    return !!deferredPrompt;
  }

  function initPWA(storage, ui) {
    const config = window.KR_CONFIG;
    if (!config?.installPrompt?.enabled) return;

    void storage;
    void ui;
  }

  async function promptInstall(storage) {
    const config = window.KR_CONFIG;

    if (!canPrompt(config, storage)) {
      return { ok: false, reason: "NOT_AVAILABLE" };
    }

    // iOS: no native prompt
    if (isIOS()) {
      if (storage && typeof storage.markInstallPromptShown === "function") {
        storage.markInstallPromptShown();
      }
      return { ok: false, reason: "IOS_NO_NATIVE_PROMPT" };
    }

    if (!deferredPrompt) return { ok: false, reason: "NOT_AVAILABLE" };

    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;

      if (storage && typeof storage.markInstallPromptShown === "function") {
        storage.markInstallPromptShown();
      }

      if (choice && choice.outcome === "accepted") {
        return { ok: true };
      }
      return { ok: false, reason: "DISMISSED" };
    } catch (_) {
      return { ok: false, reason: "ERROR" };
    }
  }

  window.KR_PWA = {
    initPWA,
    canPrompt,
    isStandalone,
    promptInstall
  };
})();
