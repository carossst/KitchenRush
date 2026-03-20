// main.js v1.0 - Kitchen Rush
// Bootstrap + orchestration.
// Kitchen Rush

(() => {
  "use strict";

  // ============================================
  // escapeHtml (strict contract)
  // ============================================

  function requiredString(value, name) {
    const s = String(value == null ? "" : value).trim();
    if (!s) throw new Error(name + " missing");
    return s;
  }

  function getSystemWording() {
    const system = window.KR_WORDING && window.KR_WORDING.system;
    if (!system || typeof system !== "object") throw new Error("KR_MAIN: KR_WORDING.system missing");
    return system;
  }

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

    const cfg = window.KR_CONFIG;
    const w = getSystemWording();
    const appName = escapeHtmlSafe(requiredString(cfg && cfg.identity && cfg.identity.appName, "KR_CONFIG.identity.appName"));
    const safeMsg = escapeHtmlSafe(message);
    const reloadLabel = escapeHtmlSafe(requiredString(w.reloadCta, "KR_WORDING.system.reloadCta"));

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
    const w = getSystemWording();
    const errorMsg = event.message || event.error?.message || "";
    showFatal(isDev ? `JavaScript Error: ${errorMsg}` : requiredString(w.fatalGeneric, "KR_WORDING.system.fatalGeneric"));
    // Also log to console even in production for debugging
    if (!isDev) console.error("[KR Fatal]", errorMsg, event.error);
  });

  window.addEventListener("unhandledrejection", (event) => {
    Logger.error("Unhandled promise rejection:", event.reason);
    const isDev = window.KR_CONFIG?.debug?.enabled;
    const w = getSystemWording();
    const errorMsg = event.reason?.message || "";
    showFatal(isDev ? `Promise Error: ${errorMsg}` : requiredString(w.fatalPromise, "KR_WORDING.system.fatalPromise"));
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
      const msg = requiredString(message, "KR_MAIN.showUpdateToast().message");
      if (!msg) return;

      const node = document.getElementById("update-toast");
      if (!node) return;

      window.__KR_SW_UPDATE_READY__ = true;

      const text = node.querySelector("[data-kr-update-text]");
      if (text) text.textContent = msg;

      node.classList.add("kr-toast--visible");
    }

    window.addEventListener("load", () => {
      const version = requiredString(cfg?.version, "KR_CONFIG.version");

      const v = encodeURIComponent(version);
      const swUrl = `./sw.js?v=${v}`;

      navigator.serviceWorker
        .register(swUrl, { scope: "./" })
        .then((registration) => {
          Logger.log("Service Worker registered:", registration.scope);

          if (cfg.serviceWorker.autoUpdate) {
            setInterval(() => {
              registration.update().catch(() => { });
            }, 10 * 60 * 1000); // Every 10 min
          }

          if (cfg?.serviceWorker?.showUpdateNotifications) {
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing;
              if (!newWorker) return;

              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                              const msg = requiredString(getSystemWording().updateAvailable, "KR_WORDING.system.updateAvailable");
                  showUpdateToast(msg);
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


  // ============================================
  // Validation
  // ============================================
  function validatePrerequisites() {
    const w = window.KR_WORDING?.system;

    if (!window.KR_CONFIG || typeof window.KR_CONFIG !== "object") {
      Logger.error("KR_CONFIG not found or invalid");
      showFatal(requiredString(w.fatalConfig, "KR_WORDING.system.fatalConfig"));
      return false;
    }

    if (!window.KR_ENUMS || typeof window.KR_ENUMS !== "object") {
      Logger.error("KR_ENUMS not found or invalid");
      showFatal(requiredString(w.fatalConfig, "KR_WORDING.system.fatalConfig"));
      return false;
    }

    if (!window.KR_WORDING || typeof window.KR_WORDING !== "object") {
      Logger.error("KR_WORDING not found or invalid");
      showFatal(requiredString(w.fatalWording, "KR_WORDING.system.fatalWording"));
      return false;
    }

    if (!window.KR_UTILS || typeof window.KR_UTILS.escapeHtml !== "function") {
      Logger.error("KR_UTILS.escapeHtml not found or invalid");
      showFatal(requiredString(w.fatalConfig, "KR_WORDING.system.fatalConfig"));
      return false;
    }

    if (!window.localStorage) {
      Logger.error("localStorage not supported");
      showFatal(requiredString(w.fatalStorage, "KR_WORDING.system.fatalStorage"));
      return false;
    }

    const appContainer = document.getElementById("app");
    if (!appContainer) {
      Logger.error("App container not found");
      showFatal(requiredString(w.fatalContainer, "KR_WORDING.system.fatalContainer"));
      return false;
    }

    try {
      if (!window.KR_CONFIG_BOOT || typeof window.KR_CONFIG_BOOT.validateConfigStrict !== "function") {
        throw new Error("KR_CONFIG_BOOT.validateConfigStrict missing");
      }
      window.KR_CONFIG_BOOT.validateConfigStrict();
    } catch (error) {
      Logger.error("Strict config validation failed:", error?.message || error);
      showFatal(requiredString(w.fatalConfig, "KR_WORDING.system.fatalConfig"));
      return false;
    }

    return true;
  }

  function validateModules() {
    const required = ["KR_StorageManager", "KR_Game", "KR_UI"];
    const missing = required.filter((name) => !window[name]);

    if (missing.length > 0) {
      const w = window.KR_WORDING?.system;
      Logger.error(`Missing modules: ${missing.join(", ")}`);
      showFatal(requiredString(w.fatalModules, "KR_WORDING.system.fatalModules"));
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

    const w = getSystemWording();
    const label = requiredString(w.loadingLabel, "KR_WORDING.system.loadingLabel");

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

      // Init storage
      const storage = new window.KR_StorageManager(config);
      storage.init();
      window.storageManager = storage; // Global for debug

      // Init game engine
      const game = new window.KR_Game.GameEngine();

      // Init UI
      const ui = new window.KR_UI({ storage, game, config, wording });

      // Listen for storage updates
      window.addEventListener("storage-updated", () => ui.onStorageUpdated());
      window.addEventListener("storage-save-failed", () => {
        if (ui && typeof ui.onStorageSaveFailed === "function") ui.onStorageSaveFailed();
      });

      ui.init();
      if (ui && typeof ui.runBootSmokeChecks === "function") ui.runBootSmokeChecks();

      // Boot optimization: auto-redeem premium code if saved by success.html
      if (ui && typeof ui.promptAutoRedeemIfReady === "function") {
        try { ui.promptAutoRedeemIfReady(); } catch (_) { /* silent */ }
      }

      // Sprint (chest) orchestration
      // ui.js dispatches "kr-sprint-requested", main.js triggers the entry point
      window.addEventListener("kr-sprint-requested", () => {
        try {
          if (ui && typeof ui.startSprintRun === "function") {
            ui.startSprintRun();
          }
        } catch (_) {
          // Never break gameplay for a hidden bonus hook
        }
      });

      // Footer support link bridge (footer is outside #app)
      window.KR_SUPPORT_OPEN = () => {
        try { ui.openSupportModal(); } catch (_) { /* silent */ }
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
      const w = getSystemWording();
      showFatal(
        `${requiredString(w.fatalGeneric, "KR_WORDING.system.fatalGeneric")}${window.KR_CONFIG?.debug?.enabled ? ` Error: ${error.message}` : ""}`
      );
    }
  }


  // ============================================
  // DOMContentLoaded
  // ============================================
  document.addEventListener("DOMContentLoaded", () => {
    const cfg = window.KR_CONFIG;
    const version = requiredString(cfg && cfg.version, "KR_CONFIG.version");
    const env = requiredString(cfg && cfg.environment, "KR_CONFIG.environment");

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
        const cfg = window.KR_CONFIG;
        const storageKey = requiredString(cfg && cfg.storage && cfg.storage.storageKey, "KR_CONFIG.storage.storageKey");
        if (storageKey) {
          localStorage.removeItem(storageKey);
        }

        // Vanity code key cleanup
        const vanityKey = requiredString(cfg && cfg.storage && cfg.storage.vanityCodeStorageKey, "KR_CONFIG.storage.vanityCodeStorageKey");
        if (vanityKey) localStorage.removeItem(vanityKey);

        location.reload();
      }
    };
  }
})();
