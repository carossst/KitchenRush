// email.js v1.0 - Kitchen Rush
// Obfuscation mailto helper — fail-closed, config-driven.
// Transformed from Word Traps email.js — same pattern, KR_ prefix.
//
// Responsibilities:
//   1. Decode obfuscated emails from KR_CONFIG (technical, never displayed raw)
//   2. Wire footer contact link: label from KR_WORDING, click → KR_SUPPORT_OPEN hook
//   3. Wire legacy data-user/data-domain links (success.html)
//
// Fail-closed contract:
//   - No label in KR_WORDING → no link (silent skip)
//   - No KR_SUPPORT_OPEN hook → no click handler (footer.js cleans up)
//   - No obfuscated email in KR_CONFIG → empty string (callers handle it)
//   - No fallbacks, no guessing, no email ever shown as text

(() => {
  "use strict";

  /** Decode HTML-entity-obfuscated string (e.g. "a&#64;b&#46;c" → "a@b.c") */
  function decodeHtmlEntities(str) {
    const t = document.createElement("textarea");
    t.innerHTML = str;
    return t.value;
  }

  /** Sanitize a string for safe use in mailto query params (strip injection vectors) */
  function sanitize(str) {
    return String(str || "").replace(/[\r\n]/g, " ").trim();
  }

  // Returns decoded support email from KR_CONFIG.support.emailObfuscated.
  // Fail-closed: returns "" if anything is missing or invalid.
  function getSupportEmailDecoded() {
    try {
      const obf = String(window.KR_CONFIG?.support?.emailObfuscated || "").trim();
      if (!obf) return "";

      const email = decodeHtmlEntities(obf).replace(/[\r\n]/g, "").trim();
      if (!email || !email.includes("@")) return "";
      return email;
    } catch (_) {
      return "";
    }
  }

  // Build a mailto URL for waitlist signup.
  // Fail-closed: returns "" if config is missing/disabled.
  function buildMailto(config, message) {
    const wl = config?.waitlist;
    if (!wl?.enabled) return "";

    const obf = String(wl.toEmailObfuscated || "").trim();
    if (!obf) return "";
    const to = decodeHtmlEntities(obf).replace(/[\r\n]/g, "").trim();
    if (!to || !to.includes("@")) return "";

    const prefix = sanitize(wl.subjectPrefix);
    if (!prefix) return "";
    const suffix = sanitize(window.KR_WORDING?.waitlist?.emailSubjectSuffix);
    const subject = suffix ? `${prefix} ${suffix}` : prefix;

    const idea = String(message || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    const tpl = String(window.KR_WORDING?.waitlist?.emailBodyTemplate || "").trim();
    const body = tpl ? tpl.replaceAll("{idea}", idea) : idea;

    const q = [];
    if (subject) q.push(`subject=${encodeURIComponent(subject)}`);
    if (body) q.push(`body=${encodeURIComponent(body)}`);
    return `mailto:${to}${q.length ? `?${q.join("&")}` : ""}`;
  }

  // Wire all email-related links in the DOM.
  function initEmailLinks() {
    try {
      const wording = window.KR_WORDING || {};

      // Footer contact link (#kr-contact-link)
      const supportLink = document.getElementById("kr-contact-link");
      if (supportLink) {
        const label = String(wording.support?.label || "").trim();

        if (!label) {
          // Fail-closed: no label → footer.js will remove the empty link + separator.
        } else {
          supportLink.textContent = label;
          supportLink.setAttribute("aria-label", label);

          if (typeof window.KR_SUPPORT_OPEN !== "function") {
            supportLink.removeAttribute("href");
            supportLink.removeAttribute("target");
            supportLink.removeAttribute("rel");
          } else {
            const email = getSupportEmailDecoded();
            if (email) {
              supportLink.href = `mailto:${email}`;
            } else {
              supportLink.removeAttribute("href");
            }

            supportLink.addEventListener("click", (e) => {
              e.preventDefault();
              window.KR_SUPPORT_OPEN();
            });
          }
        }
      }

      // Legacy data-user/data-domain links (success.html)
      const links = document.querySelectorAll("a[data-user][data-domain]");
      links.forEach((link) => {
        if (!link) return;
        if (link.id === "kr-contact-link") return;
        if (link.getAttribute("data-email-mode") === "modal") return;

        const user = link.getAttribute("data-user");
        const domain = link.getAttribute("data-domain");
        if (!user || !domain) return;

        link.href = `mailto:${user}@${domain}`;
      });
    } catch (_) {
      // Silent fail — fail-closed.
    }
  }

  window.KR_Email = {
    buildMailto,
    decodeObfuscated: decodeHtmlEntities,
    getSupportEmailDecoded,
    initEmailLinks
  };

})();
