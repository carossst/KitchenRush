(() => {
  "use strict";

  function getByPath(root, path) {
    const p = String(path).trim();
    if (!p) throw new Error("KR wording path missing");
    const parts = p.split(".");
    let cur = root;
    for (const k of parts) {
      if (!cur || typeof cur !== "object") throw new Error("KR wording path invalid: " + path);
      cur = cur[k];
    }
    if (typeof cur !== "string") throw new Error("KR wording value must be string: " + path);
    return cur;
  }

  function applyToDocument(root, wording) {
    const scope = (root && typeof root.querySelectorAll === "function") ? root : document;
    const w = wording || window.KR_WORDING;
    if (!w || typeof w !== "object") throw new Error("KR_WORDING missing");

    scope.querySelectorAll("[data-kr-wording]").forEach((el) => {
      const key = el.getAttribute("data-kr-wording");
      el.textContent = getByPath(w, key);
    });

    scope.querySelectorAll("[data-kr-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-kr-aria-label");
      el.setAttribute("aria-label", getByPath(w, key));
    });
  }

  window.KR_WORDING_DOM = {
    getByPath,
    applyToDocument
  };

  function tryAutoApply() {
    try {
      applyToDocument(document);
    } catch (_) { }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryAutoApply);
  } else {
    tryAutoApply();
  }
})();
