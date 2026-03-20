// footer.js v2.0 — shared footer injection

(() => {
  "use strict";

  function hasNonEmptyContent(el) {
    if (!el) return false;
    const txt = String(el.textContent).replace(/\s+/g, " ").trim();
    return txt.length > 0 || el.children.length > 0;
  }

  function requireConfig() {
    const cfg = window.KR_CONFIG;
    if (!cfg || typeof cfg !== "object") throw new Error("KR_Footer: KR_CONFIG missing");
    return cfg;
  }

  function requireWording() {
    const w = window.KR_WORDING;
    if (!w || typeof w !== "object") throw new Error("KR_Footer: KR_WORDING missing");
    return w;
  }

  function injectIntoFooterRoot(root) {
    if (!root || hasNonEmptyContent(root)) return;
    root.innerHTML = `
      <div class="kr-container">
        <div class="kr-footer-inner">
          <div class="kr-footer-row kr-footer-row--brand">
            <span class="kr-footer-creator" data-kr-brand="creatorLine"></span>
          </div>
          <div class="kr-footer-row kr-footer-row--links">
            <a id="kr-contact-link" class="kr-footer-link" href="#"></a>
            <span class="kr-footer-sep" aria-hidden="true">&middot;</span>
            <a id="kr-parent-link" class="kr-footer-link" href="#" target="_blank" rel="noopener"></a>
            <span class="kr-footer-sep kr-footer-sep--parent" aria-hidden="true">&middot;</span>
            <a id="kr-privacy-link" class="kr-footer-link" href="./privacy.html" target="_blank" rel="noopener" data-kr-wording="footer.privacy"></a>
            <span class="kr-footer-sep" aria-hidden="true">&middot;</span>
            <a id="kr-terms-link" class="kr-footer-link" href="./terms.html" target="_blank" rel="noopener" data-kr-wording="footer.terms"></a>
            <span class="kr-footer-sep" aria-hidden="true">&middot;</span>
            <a id="kr-press-link" class="kr-footer-link" href="./press.html" target="_blank" rel="noopener" data-kr-wording="footer.press"></a>
            <span class="kr-footer-sep" aria-hidden="true">&middot;</span>
            <span class="kr-footer-version" data-kr-version></span>
          </div>
        </div>
      </div>
    `;
  }

  function hydrateFooter(root) {
    const cfg = requireConfig();
    const w = requireWording();

    root.querySelectorAll("[data-kr-wording]").forEach((el) => {
      const key = String(el.getAttribute("data-kr-wording")).trim();
      const parts = key.split(".");
      let cur = w;
      for (const p of parts) {
        if (!cur || typeof cur !== "object") throw new Error("KR_Footer wording path invalid: " + key);
        cur = cur[p];
      }
      el.textContent = String(cur).trim();
    });

    const creatorEl = root.querySelector('[data-kr-brand="creatorLine"]');
    if (creatorEl) {
      const html = String(w.brand.creatorLineHtml).trim();
      if (html) creatorEl.innerHTML = html;
      else creatorEl.textContent = String(w.brand.creatorLine).trim();
    }

    const parentEl = root.querySelector("#kr-parent-link");
    const parentSep = root.querySelector(".kr-footer-sep--parent");
    const url = String(cfg.identity.parentUrl).trim();
    if (parentEl) {
      parentEl.href = url;
      parentEl.target = "_blank";
      parentEl.rel = "noopener";
      parentEl.textContent = new URL(url).hostname.replace(/^www\./, "");
      parentEl.hidden = false;
      if (parentSep) parentSep.hidden = false;
    }

    const vEl = root.querySelector("[data-kr-version]");
    if (vEl) vEl.textContent = `${String(w.system.versionPrefix).trim()}${String(cfg.version).trim()}`;
  }

  function tryInject() {
    const existing = document.querySelector("footer.kr-footer");
    const root = document.getElementById("kr-footer-root") || existing;
    if (!root) return;
    injectIntoFooterRoot(root);
    hydrateFooter(root);
    if (window.KR_Email && typeof window.KR_Email.initEmailLinks === "function") {
      window.KR_Email.initEmailLinks();
    }
  }

  function runConfigBoot() {
    const boot = window.KR_CONFIG_BOOT;
    if (!boot || typeof boot !== "object") return;
    if (typeof boot.validateConfigSoft === "function") boot.validateConfigSoft();
    if (typeof boot.applyBrandText === "function") boot.applyBrandText();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      tryInject();
      runConfigBoot();
    });
  } else {
    tryInject();
    runConfigBoot();
  }
})();
