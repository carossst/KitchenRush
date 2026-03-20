// success.js v1.0 - Kitchen Rush
(() => {
  "use strict";

  function requireConfig() {
    const cfg = window.KR_CONFIG;
    if (!cfg || typeof cfg !== "object") throw new Error("KR success: KR_CONFIG missing");
    return cfg;
  }

  function requireWording() {
    const w = window.KR_WORDING;
    if (!w || typeof w !== "object") throw new Error("KR success: KR_WORDING missing");
    return w;
  }

  function getStoredCodeStrict(cfg) {
    const rawRe = String(cfg.premiumCodeRegex).trim();
    const re = new RegExp(rawRe);
    const code = String(localStorage.getItem(cfg.storage.vanityCodeStorageKey)).trim();
    return re.test(code) ? code : "";
  }

  function markCodeGeneratedBestEffort(cfg) {
    try {
      const raw = localStorage.getItem(cfg.storage.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return;
      if (!data.counters || typeof data.counters !== "object") data.counters = {};
      const current = Number(data.counters.codeGenerated);
      data.counters.codeGenerated = Number.isFinite(current) ? current + 1 : 1;
      data.updatedAt = Date.now();
      localStorage.setItem(cfg.storage.storageKey, JSON.stringify(data));
    } catch (_) {}
  }

  function renderCode(code) {
    const codeEl = document.getElementById("code");
    if (codeEl) codeEl.textContent = code;
  }

  function showStatus(cfg, msg) {
    const statusEl = document.getElementById("copy-status");
    if (!statusEl) return;
    const dur = Number(cfg.ui.toast.default.durationMs);
    statusEl.textContent = msg;
    statusEl.classList.remove("kr-hidden");
    setTimeout(() => { statusEl.classList.add("kr-hidden"); }, Math.floor(dur));
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.className = "kr-offscreen-copy";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  async function copyCode(cfg, wording) {
    const codeEl = document.getElementById("code");
    const code = codeEl ? codeEl.textContent.trim() : "";
    if (!code) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
        showStatus(cfg, wording.system.copied);
        return;
      }
    } catch (_) {}
    showStatus(cfg, fallbackCopy(code) ? wording.system.copied : wording.system.copyFailed);
  }

  function downloadCodeTxt(cfg, wording) {
    const codeEl = document.getElementById("code");
    const code = codeEl ? codeEl.textContent.trim() : "";
    if (!code) return;
    const content = [wording.success.txtTitle, "", code, "", wording.success.txtSaveLine, wording.success.txtNoRecoverLine].join("\n");
    try {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kitchen-rush-code-" + code + ".txt";
      a.hidden = true;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 0);
      showStatus(cfg, wording.system.downloaded);
    } catch (_) {
      copyCode(cfg, wording);
    }
  }

  function getByPath(root, path) {
    const p = String(path).trim();
    const parts = p.split(".");
    let cur = root;
    for (const key of parts) {
      if (!cur || typeof cur !== "object") throw new Error("KR success wording path invalid: " + path);
      cur = cur[key];
    }
    if (typeof cur !== "string") throw new Error("KR success wording value must be string: " + path);
    return cur;
  }

  function applyWording(wording) {
    document.querySelectorAll("[data-kr-wording]").forEach((el) => {
      const key = el.getAttribute("data-kr-wording");
      el.textContent = getByPath(wording, key);
    });
  }

  function applyBrand(wording) {
    const brand = String(wording.brand.creatorLine).trim();
    document.querySelectorAll('[data-kr-brand="creatorLine"]').forEach((el) => { el.textContent = brand; });
  }

  function applySuccessBranding(cfg) {
    const logoUrl = String(cfg.identity.uiLogoUrl).trim();
    const appName = String(cfg.identity.appName).trim();
    const img = document.getElementById("kr-success-logo");
    const name = document.getElementById("kr-success-name");
    const link = document.getElementById("kr-success-branding");
    if (!img || !name || !link) return;
    name.textContent = appName;
    link.setAttribute("aria-label", appName);
    if (!logoUrl) {
      img.classList.add("kr-hidden-inline");
      img.removeAttribute("src");
      img.setAttribute("alt", "");
      return;
    }
    img.src = logoUrl;
    img.setAttribute("alt", appName);
    img.classList.remove("kr-hidden-inline");
  }

  function applyVersion(cfg, wording) {
    const el = document.querySelector(".kr-footer-version");
    if (el) el.textContent = `${String(wording.system.versionPrefix).trim()}${String(cfg.version).trim()}`;
  }

  function init() {
    const cfg = requireConfig();
    const wording = requireWording();
    const code = getStoredCodeStrict(cfg);
    if (!code) {
      const codeEl = document.getElementById("code");
      if (codeEl) codeEl.textContent = "";
      applyWording(wording);
      applyBrand(wording);
      applySuccessBranding(cfg);
      applyVersion(cfg, wording);
      return;
    }

    renderCode(code);
    markCodeGeneratedBestEffort(cfg);
    applyWording(wording);
    applyBrand(wording);
    applySuccessBranding(cfg);
    applyVersion(cfg, wording);

    const copyBtn = document.getElementById("copy-btn");
    const copyAgain = document.getElementById("copy-again");
    const downloadBtn = document.getElementById("download-code");

    if (copyBtn) copyBtn.addEventListener("click", () => copyCode(cfg, wording));
    if (copyAgain) copyAgain.addEventListener("click", () => copyCode(cfg, wording));
    if (downloadBtn) downloadBtn.addEventListener("click", () => downloadCodeTxt(cfg, wording));

    if (window.KR_Email && typeof window.KR_Email.initEmailLinks === "function") {
      window.KR_Email.initEmailLinks();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
