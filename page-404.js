(() => {
  "use strict";

  function getByPath(root, path) {
    const p = String(path).trim();
    if (!p) throw new Error("KR 404 wording path missing");
    const parts = p.split(".");
    let cur = root;
    for (const key of parts) {
      if (!cur || typeof cur !== "object") throw new Error("KR 404 wording path invalid: " + path);
      cur = cur[key];
    }
    if (typeof cur !== "string") throw new Error("KR 404 wording value must be string: " + path);
    return cur;
  }

  function apply() {
    const w = window.KR_WORDING;
    const cfg = window.KR_CONFIG;
    if (!w || typeof w !== "object") throw new Error("KR_WORDING missing on 404");
    if (!cfg || typeof cfg !== "object") throw new Error("KR_CONFIG missing on 404");

    document.querySelectorAll("[data-kr-wording]").forEach((el) => {
      const key = el.getAttribute("data-kr-wording");
      el.textContent = getByPath(w, key);
    });

    const brand = String(w.brand.creatorLine).trim();
    document.querySelectorAll('[data-kr-brand="creatorLine"]').forEach((el) => { el.textContent = brand; });
    const version = String(cfg.version).trim();
    document.querySelectorAll("[data-kr-version]").forEach((el) => { el.textContent = `v${version}`; });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();
