(() => {
  "use strict";

  function requireWordingDom() {
    const api = window.KR_WORDING_DOM;
    if (!api || typeof api.applyToDocument !== "function") throw new Error("KR 404: KR_WORDING_DOM.applyToDocument missing");
    return api;
  }

  function apply() {
    const w = window.KR_WORDING;
    const wordingDom = requireWordingDom();
    if (!w || typeof w !== "object") throw new Error("KR_WORDING missing on 404");

    wordingDom.applyToDocument(document, w);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();
