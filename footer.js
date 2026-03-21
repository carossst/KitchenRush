// footer.js v1.0 — Kitchen Rush shared footer injection (uses email.js)
// Kitchen Rush
// Responsibility: inject footer markup into #kr-footer-root when needed.
// Branding/version/labels are handled by config.js. Contact is handled by email.js.

(() => {
  "use strict";

  function warn(message, error) {
    try {
      console.warn("[KR Footer]", message, error || "");
    } catch (_) { }
  }

  function hasNonEmptyContent(el) {
    if (!el) return false;
    const txt = String(el.textContent || "").replace(/\s+/g, " ").trim();
    return txt.length > 0 || el.children.length > 0;
  }

  function injectIntoFooterRoot(root) {
    if (!root) return;
    if (hasNonEmptyContent(root)) return;

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

            <span class="kr-footer-version" data-kr-version></span>
          </div>
        </div>
      </div>
    `;
  }

  function hydrateFooter(root) {
    if (!root) return;

    const cfg = window.KR_CONFIG || {};
    const w = window.KR_WORDING || {};

    var wordingDom = window.KR_WORDING_DOM;

    // Apply wording (scoped to footer only)
    try {
      if (!wordingDom || typeof wordingDom.applyToDocument !== "function") {
        throw new Error("KR_WORDING_DOM.applyToDocument missing");
      }
      wordingDom.applyToDocument(root, w);
    } catch (error) {
      warn("Footer wording hydration failed", error);
    }

    // Creator line (prefer HTML if provided)
    try {
      const creatorEl = root.querySelector('[data-kr-brand="creatorLine"]');
      if (creatorEl) {
        const html = String(w.brand?.creatorLineHtml || "").trim();
        const line = String(w.brand?.creatorLine || "").trim();
        if (html) creatorEl.innerHTML = html;
        else creatorEl.textContent = line || "";
      }
    } catch (error) {
      warn("Footer creator hydration failed", error);
    }

    // Parent link (optional)
    try {
      const parentEl = root.querySelector("#kr-parent-link");
      const parentSep = root.querySelector(".kr-footer-sep--parent");
      const url = String(cfg.identity?.parentUrl || "").trim();

      if (parentEl) {
        if (url) {
          parentEl.setAttribute("href", url);
          parentEl.setAttribute("target", "_blank");
          parentEl.setAttribute("rel", "noopener");

          try {
            parentEl.textContent = new URL(url).hostname.replace(/^www\./, "");
          } catch (_) {
            parentEl.textContent = url;
          }

          parentEl.style.display = "";
          if (parentSep) parentSep.style.display = "";
        } else {
          parentEl.style.display = "none";
          if (parentSep) parentSep.style.display = "none";
        }
      }
    } catch (error) {
      warn("Footer parent link hydration failed", error);
    }

    // Version
    try {
      const vEl = root.querySelector("[data-kr-version]");
      const v = String(cfg.version || "").trim();
      const prefix = String(w.system?.versionPrefix || "").trim();
      if (vEl) {
        vEl.textContent = (v && prefix) ? `${prefix}${v}` : "";
      }
    } catch (error) {
      warn("Footer version hydration failed", error);
    }
  }

  function tryInject() {
    const existing = document.querySelector("footer.kr-footer");
    const root = document.getElementById("kr-footer-root") || existing;
    if (!root) return;

    injectIntoFooterRoot(root);
    hydrateFooter(root);

    // Let email.js wire the contact link, then enforce fail-closed:
    if (window.KR_Email && typeof window.KR_Email.initEmailLinks === "function") {
      window.KR_Email.initEmailLinks();
    }

    const contact = document.getElementById("kr-contact-link");
    if (contact) {
      const hasSupportHook = (typeof window.KR_SUPPORT_OPEN === "function");
      const txt = String(contact.textContent || "").trim();
      const looksLikeEmail = txt.includes("@");

      if (!hasSupportHook || looksLikeEmail) {
        const sep = contact.nextElementSibling;
        contact.remove();
        if (sep && sep.classList && sep.classList.contains("kr-footer-sep")) {
          sep.remove();
        }
      }
    }
  }

  tryInject();

  // Config boot: validation + brand/version hydration
  // (moved from config.js to keep config.js pure data)
  function runConfigBoot() {
    var boot = window.KR_CONFIG_BOOT;
    if (!boot || typeof boot !== "object") return;
    if (typeof boot.validateConfigSoft === "function") {
      try { boot.validateConfigSoft(); } catch (error) { warn("Footer config soft validation failed", error); }
    }
    if (typeof boot.applyBrandText === "function") {
      try { boot.applyBrandText(); } catch (error) { warn("Footer brand hydration failed", error); }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      tryInject();
      runConfigBoot();
    });
  } else {
    runConfigBoot();
  }
})();
