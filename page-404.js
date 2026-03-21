(() => {
  "use strict";

  function requireWordingDom() {
    const api = window.KR_WORDING_DOM;
    if (!api || typeof api.applyToDocument !== "function") throw new Error("KR 404: KR_WORDING_DOM.applyToDocument missing");
    return api;
  }

  function apply() {
    const w = window.KR_WORDING;
    const cfg = window.KR_CONFIG;
    const wordingDom = requireWordingDom();
    if (!w || typeof w !== "object") throw new Error("KR_WORDING missing on 404");
    if (!cfg || typeof cfg !== "object") throw new Error("KR_CONFIG missing on 404");

    wordingDom.applyToDocument(document, w);

    const brand = String(w.brand.creatorLine).trim();
    document.querySelectorAll('[data-kr-brand="creatorLine"]').forEach((el) => { el.textContent = brand; });
    const version = String(cfg.version).trim();
    const prefix = String(w.system.versionPrefix).trim();
    document.querySelectorAll("[data-kr-version]").forEach((el) => { el.textContent = (prefix && version) ? `${prefix}${version}` : ""; });

    if (window.KR_Email && typeof window.KR_Email.initEmailLinks === "function") {
      window.KR_Email.initEmailLinks();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();
