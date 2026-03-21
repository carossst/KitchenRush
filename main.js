// main.js v1.0 - Kitchen Rush
// Bootstrap + orchestration.
// Kitchen Rush

(() => {
  "use strict";

  let swUpdateIntervalId = null;

  // ============================================
  // escapeHtml (strict contract)
  // ============================================
  function escapeHtmlSafe(str) {
    const fn = window.KR_UTILS && typeof window.KR_UTILS.escapeHtml === "function"
      ? window.KR_UTILS.escapeHtml
      : null;
    if (!fn) throw new Error("KR_MAIN: KR_UTILS.escapeHtml missing");
    return String(fn(String(str == null ? "" : str)));
  }


  // ============================================
  // Logger
  // ============================================
  const Logger = {
    debug: (...args) =>
      window.KR_CONFIG?.debug?.enabled &&
      window.KR_CONFIG.debug.logLevel === "debug" &&
      console.log("[KR Debug]", ...args),

    log: (...args) =>
      window.KR_CONFIG?.debug?.enabled &&
      ["debug", "log"].includes(window.KR_CONFIG.debug.logLevel) &&
      console.log("[KR]", ...args),

    warn: (...args) =>
      window.KR_CONFIG?.debug?.enabled &&
      console.warn("[KR Warning]", ...args),

    error: (...args) => console.error("[KR Error]", ...args)
  };

  window.Logger = Logger;


  // ============================================
  // Error display
  // ============================================
  function showFatal(message) {
    const root = document.getElementById("app");
    if (!root) return;

    const appName = escapeHtmlSafe(window.KR_CONFIG?.identity?.appName || "");
    const w = window.KR_WORDING?.system;
    const safeMsg = escapeHtmlSafe(message);
    const reloadLabel = escapeHtmlSafe(w?.reloadCta || "");

    // Fail-closed: render only elements that have content
    let html = '<div class="kr-card kr-card--error">';
    if (appName) html += '<h1 class="kr-h1">' + appName + '</h1>';
    if (safeMsg) html += '<p class="kr-muted">' + safeMsg + '</p>';
    // Reload button is always present — it's the user's only escape from a fatal state.
    // Label from wording; if absent, button renders empty (still functional).
    html += '<button id="krFatalReloadBtn" class="kr-btn kr-btn--secondary" type="button">' + reloadLabel + '</button>';
    html += '</div>';

    root.innerHTML = html;

    const btn = document.getElementById("krFatalReloadBtn");
    if (btn) btn.addEventListener("click", () => location.reload());
  }

  window.showFatal = showFatal;


  // ============================================
  // Global error handlers
  // ============================================
  window.addEventListener("error", (event) => {
    Logger.error("Global error:", event.error || event);
    const isDev = window.KR_CONFIG?.debug?.enabled;
    const w = window.KR_WORDING?.system;
    const errorMsg = event.message || event.error?.message || "";
    showFatal(isDev ? `JavaScript Error: ${errorMsg}` : (w?.fatalGeneric || ""));
    // Also log to console even in production for debugging
    if (!isDev) console.error("[KR Fatal]", errorMsg, event.error);
  });

  window.addEventListener("unhandledrejection", (event) => {
    Logger.error("Unhandled promise rejection:", event.reason);
    const isDev = window.KR_CONFIG?.debug?.enabled;
    const w = window.KR_WORDING?.system;
    const errorMsg = event.reason?.message || "";
    showFatal(isDev ? `Promise Error: ${errorMsg}` : (w?.fatalPromise || ""));
    // Also log to console even in production for debugging
    if (!isDev) console.error("[KR Fatal]", errorMsg, event.reason);
  });


  // ============================================
  // Service Worker registration
  // ============================================
  function initServiceWorker() {
    const cfg = window.KR_CONFIG;
    if (!cfg?.serviceWorker?.enabled) return;
    if (cfg.environment === "development") return;

    if (!("serviceWorker" in navigator)) {
      Logger.warn("Service Worker not supported");
      return;
    }

    function showUpdateToast(message) {
      const msg = String(message || "").trim();
      if (!msg) return;

      const node = document.getElementById("update-toast");
      if (!node) return;

      window.__KR_SW_UPDATE_READY__ = true;

      const text = node.querySelector("[data-kr-update-text]");
      if (text) text.textContent = msg;

      node.classList.add("kr-toast--visible");
    }

    window.addEventListener("load", () => {
      const version = String(cfg?.version || "").trim();
      if (!version) {
        Logger.warn("KR_CONFIG.version missing/empty: skipping SW registration (fail-closed)");
        return;
      }

      const v = encodeURIComponent(version);
      const swUrl = `./sw.js?v=${v}`;

      navigator.serviceWorker
        .register(swUrl, { scope: "./" })
        .then((registration) => {
          Logger.log("Service Worker registered:", registration.scope);

          if (cfg.serviceWorker.autoUpdate) {
            if (swUpdateIntervalId) clearInterval(swUpdateIntervalId);
            swUpdateIntervalId = setInterval(() => {
              registration.update().catch(() => { });
            }, 10 * 60 * 1000); // Every 10 min
          }

          if (cfg?.serviceWorker?.showUpdateNotifications) {
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing;
              if (!newWorker) return;

              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  const msg = String(window.KR_WORDING?.system?.updateAvailable || "").trim();
                  if (msg) showUpdateToast(msg);
                }
              });
            });
          }

        })
        .catch((err) => {
          Logger.warn("Service Worker registration failed:", err?.message || err);
        });
    });
  }

  window.addEventListener("pagehide", () => {
    if (swUpdateIntervalId) {
      clearInterval(swUpdateIntervalId);
      swUpdateIntervalId = null;
    }
  });


  // ============================================
  // Validation
  // ============================================
  function validatePrerequisites() {
    const w = window.KR_WORDING?.system;

    if (!window.KR_CONFIG || typeof window.KR_CONFIG !== "object") {
      Logger.error("KR_CONFIG not found or invalid");
      showFatal(w?.fatalConfig || "");
      return false;
    }

    if (!window.KR_ENUMS || typeof window.KR_ENUMS !== "object") {
      Logger.error("KR_ENUMS not found or invalid");
      showFatal(w?.fatalConfig || "");
      return false;
    }

    if (!window.KR_WORDING || typeof window.KR_WORDING !== "object") {
      Logger.error("KR_WORDING not found or invalid");
      showFatal(w?.fatalWording || "");
      return false;
    }

    if (!window.KR_UTILS || typeof window.KR_UTILS.escapeHtml !== "function") {
      Logger.error("KR_UTILS.escapeHtml not found or invalid");
      showFatal(w?.fatalConfig || "");
      return false;
    }

    if (!window.localStorage) {
      Logger.error("localStorage not supported");
      showFatal(w?.fatalStorage || "");
      return false;
    }

    const appContainer = document.getElementById("app");
    if (!appContainer) {
      Logger.error("App container not found");
      showFatal(w?.fatalContainer || "");
      return false;
    }

    try {
      if (!window.KR_CONFIG_BOOT || typeof window.KR_CONFIG_BOOT.validateConfigStrict !== "function") {
        throw new Error("KR_CONFIG_BOOT.validateConfigStrict missing");
      }
      window.KR_CONFIG_BOOT.validateConfigStrict();
    } catch (error) {
      Logger.error("Strict config validation failed:", error?.message || error);
      showFatal(w?.fatalConfig || "");
      return false;
    }

    return true;
  }

  function validateModules() {
    const required = [
      "KR_StorageManager",
      "KR_STORAGE_UX",
      "KR_STORAGE_PREMIUM",
      "KR_STORAGE_RUNS",
      "KR_Game",
      "KR_UI",
      "KR_UI_OVERLAYS",
      "KR_UI_MODALS",
      "KR_UI_SHARING",
      "KR_UI_SCREENS"
    ];
    const missing = required.filter((name) => !window[name]);

    const invalid = [];
    if (window.KR_STORAGE_UX && typeof window.KR_STORAGE_UX.install !== "function") invalid.push("KR_STORAGE_UX.install");
    if (window.KR_STORAGE_PREMIUM && typeof window.KR_STORAGE_PREMIUM.install !== "function") invalid.push("KR_STORAGE_PREMIUM.install");
    if (window.KR_STORAGE_RUNS && typeof window.KR_STORAGE_RUNS.install !== "function") invalid.push("KR_STORAGE_RUNS.install");
    if (window.KR_UI_OVERLAYS && typeof window.KR_UI_OVERLAYS.install !== "function") invalid.push("KR_UI_OVERLAYS.install");
    if (window.KR_UI_MODALS && typeof window.KR_UI_MODALS.install !== "function") invalid.push("KR_UI_MODALS.install");
    if (window.KR_UI_SHARING && typeof window.KR_UI_SHARING.install !== "function") invalid.push("KR_UI_SHARING.install");
    if (window.KR_UI_SCREENS && typeof window.KR_UI_SCREENS.install !== "function") invalid.push("KR_UI_SCREENS.install");

    if (missing.length > 0 || invalid.length > 0) {
      const w = window.KR_WORDING?.system;
      if (missing.length > 0) Logger.error(`Missing modules: ${missing.join(", ")}`);
      if (invalid.length > 0) Logger.error(`Invalid module contracts: ${invalid.join(", ")}`);
      showFatal(w?.fatalModules || "");
      return false;
    }

    return true;
  }


  // ============================================
  // Loading screen
  // ============================================
  function showLoadingScreen() {
    const root = document.getElementById("app");
    if (!root) return;

    const w = window.KR_WORDING?.system;
    const label = String(w?.loadingLabel || "").trim();

    let html = '<div class="kr-loading"><div class="kr-loading-spinner"></div>';
    if (label) html += '<p class="kr-muted">' + escapeHtmlSafe(label) + '</p>';
    html += '</div>';

    root.innerHTML = html;
  }


  // ============================================
  // Main application start
  // ============================================
  async function startApplication() {
    showLoadingScreen();

    try {
      const config = window.KR_CONFIG;
      const wording = window.KR_WORDING;
      const pwa = (window.KR_PWA && typeof window.KR_PWA === "object") ? window.KR_PWA : null;
      const audio = (window.KR_Audio && typeof window.KR_Audio === "object") ? window.KR_Audio : null;
      const gameApi = (window.KR_Game && typeof window.KR_Game === "object") ? window.KR_Game : null;

      window.KR_STORAGE_UX.install(window.KR_StorageManager);
      window.KR_STORAGE_PREMIUM.install(window.KR_StorageManager);
      window.KR_STORAGE_RUNS.install(window.KR_StorageManager);

      // Init storage
      const storage = new window.KR_StorageManager(config);
      storage.init();
      window.storageManager = storage; // Global for debug

      // Init game engine
      const game = new window.KR_Game.GameEngine();

      // Init UI
      const ui = new window.KR_UI({ storage, game, config, wording, pwa, audio, gameApi });

      // Listen for storage updates
      window.addEventListener("storage-updated", () => ui.onStorageUpdated());
      window.addEventListener("storage-save-failed", (event) => {
        Logger.warn("Storage save failed", event?.detail || {});
        if (ui && typeof ui.onStorageSaveFailed === "function") ui.onStorageSaveFailed();
      });

      ui.init();

      // Boot optimization: auto-redeem premium code if saved by success.html
      if (ui && typeof ui.promptAutoRedeemIfReady === "function") {
        try {
          ui.promptAutoRedeemIfReady();
        } catch (error) {
          Logger.warn("Auto-redeem check failed:", error?.message || error);
        }
      }

      // Power Run orchestration
      // ui.js dispatches "kr-power-run-requested", main.js triggers the entry point
      window.addEventListener("kr-power-run-requested", () => {
        try {
          if (ui && typeof ui.startPowerRun === "function") {
            ui.startPowerRun();
          }
        } catch (error) {
          Logger.warn("Power Run launch failed:", error?.message || error);
        }
      });

      // Footer support link bridge (footer is outside #app)
      window.KR_SUPPORT_OPEN = () => {
        try {
          ui.openSupportModal();
        } catch (error) {
          Logger.warn("Support modal open failed:", error?.message || error);
        }
      };

      // Init email links
      if (window.KR_Email && typeof window.KR_Email.initEmailLinks === "function") {
        window.KR_Email.initEmailLinks();
      }

      // Init PWA
      if (typeof window.KR_PWA !== "undefined" && window.KR_PWA.initPWA) {
        window.KR_PWA.initPWA(storage, ui);
      }

      Logger.log(`Kitchen Rush v${config.version} started successfully`);
    } catch (error) {
      Logger.error("Startup error:", error);
      const w = window.KR_WORDING?.system;
      showFatal(
        `${w?.fatalGeneric || ""}${window.KR_CONFIG?.debug?.enabled ? ` Error: ${error.message}` : ""}`
      );
    }
  }


  // ============================================
  // DOMContentLoaded
  // ============================================
  document.addEventListener("DOMContentLoaded", () => {
    const cfg = window.KR_CONFIG;
    const version = String(cfg?.version || "").trim();
    const env = String(cfg?.environment || "").trim();

    if (!version) Logger.warn("KR_CONFIG.version missing/empty");
    if (!env) Logger.warn("KR_CONFIG.environment missing/empty");

    if (version && env) Logger.log(`Initializing Kitchen Rush v${version} (${env})`);
    else if (version) Logger.log(`Initializing Kitchen Rush v${version}`);
    else Logger.log("Initializing Kitchen Rush");

    if (!validatePrerequisites()) return;
    if (!validateModules()) return;

    startApplication();
  });


  // Init service worker immediately (before DOMContentLoaded)
  initServiceWorker();


  // ============================================
  // Debug tools
  // ============================================
  if (window.KR_CONFIG?.debug?.enabled) {
    window.KR_DEBUG = {
      Logger,
      config: window.KR_CONFIG,
      wording: window.KR_WORDING,
      get storage() { return window.storageManager; },
      resetStorage() {
        const cfg = window.KR_CONFIG || {};
        const storageKey = String(cfg?.storage?.storageKey || "").trim();
        if (storageKey) {
          localStorage.removeItem(storageKey);
        }

        // Vanity code key cleanup
        const vanityKey = String(cfg?.storage?.vanityCodeStorageKey || "").trim();
        if (vanityKey) localStorage.removeItem(vanityKey);

        location.reload();
      }
    };
  }
})();
