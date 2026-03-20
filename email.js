// email.js v2.0 - Kitchen Rush
// Config-driven email helpers. No silent content fallbacks.

(() => {
  "use strict";

  function decodeHtmlEntities(str) {
    const t = document.createElement("textarea");
    t.innerHTML = str;
    return t.value;
  }

  function sanitize(str) {
    return String(str).replace(/[\r\n]/g, " ").trim();
  }

  function requireConfig() {
    const cfg = window.KR_CONFIG;
    if (!cfg || typeof cfg !== "object") throw new Error("KR_Email: KR_CONFIG missing");
    return cfg;
  }

  function requireWording() {
    const w = window.KR_WORDING;
    if (!w || typeof w !== "object") throw new Error("KR_Email: KR_WORDING missing");
    return w;
  }

  function decodeEmail(obfuscated, fieldName) {
    const raw = String(obfuscated).trim();
    if (!raw) throw new Error(fieldName + " missing");
    const email = decodeHtmlEntities(raw).replace(/[\r\n]/g, "").trim();
    if (!email.includes("@")) throw new Error(fieldName + " invalid");
    return email;
  }

  function getSupportEmailDecoded() {
    const cfg = requireConfig();
    return decodeEmail(cfg.support.emailObfuscated, "KR_CONFIG.support.emailObfuscated");
  }

  function buildMailto(config, message) {
    if (!config || typeof config !== "object") throw new Error("KR_Email.buildMailto: config missing");
    const wording = requireWording();
    const waitlist = config.waitlist;
    if (!waitlist || waitlist.enabled !== true) return "";

    const to = decodeEmail(waitlist.toEmailObfuscated, "KR_CONFIG.waitlist.toEmailObfuscated");
    const prefix = sanitize(waitlist.subjectPrefix);
    const suffix = sanitize(wording.waitlist.emailSubjectSuffix);
    const subject = suffix ? `${prefix} ${suffix}` : prefix;
    const idea = String(message).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    const body = String(wording.waitlist.emailBodyTemplate).replaceAll("{idea}", idea);

    const q = [];
    if (subject) q.push(`subject=${encodeURIComponent(subject)}`);
    if (body) q.push(`body=${encodeURIComponent(body)}`);
    return `mailto:${to}${q.length ? `?${q.join("&")}` : ""}`;
  }

  function openSupportEmail() {
    const cfg = requireConfig();
    const wording = requireWording();
    const email = getSupportEmailDecoded();
    const prefix = sanitize(cfg.support.subjectPrefix);
    const suffix = sanitize(wording.support.emailSubjectSuffix);
    const subject = [prefix, suffix].filter(Boolean).join(" ").trim();
    const body = String(wording.support.emailBodyTemplate).trim();
    const q = [];
    if (subject) q.push(`subject=${encodeURIComponent(subject)}`);
    if (body) q.push(`body=${encodeURIComponent(body)}`);
    window.location.href = `mailto:${email}${q.length ? `?${q.join("&")}` : ""}`;
  }

  function initEmailLinks() {
    const wording = requireWording();
    const supportLabel = String(wording.support.label).trim();

    const supportLink = document.getElementById("kr-contact-link");
    if (supportLink) {
      supportLink.textContent = supportLabel;
      supportLink.setAttribute("aria-label", supportLabel);
      supportLink.setAttribute("href", `mailto:${getSupportEmailDecoded()}`);
      supportLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof window.KR_SUPPORT_OPEN === "function") {
          window.KR_SUPPORT_OPEN();
          return;
        }
        openSupportEmail();
      });
    }

    document.querySelectorAll("a[data-user][data-domain]").forEach((link) => {
      if (link.id === "kr-contact-link") return;
      if (link.getAttribute("data-email-mode") === "modal") return;
      const user = String(link.getAttribute("data-user")).trim();
      const domain = String(link.getAttribute("data-domain")).trim();
      if (!user || !domain) return;
      link.href = `mailto:${user}@${domain}`;
    });
  }

  window.KR_Email = {
    buildMailto,
    decodeObfuscated: decodeHtmlEntities,
    getSupportEmailDecoded,
    openSupportEmail,
    initEmailLinks
  };
})();
