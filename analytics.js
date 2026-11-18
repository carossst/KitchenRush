// analytics.js - optional anonymous statistics (GoatCounter: no cookies, aggregate counts only) and campaign tagging.
// OFF by default: it does nothing unless KR_CONFIG.analytics.goatcounterUrl is set, and never when the browser asks
// not to be tracked. Tagging: a link such as ?src=coach-lyon is remembered on the device (first-party storage only) and
// appended to event names, so a pilot with a coach or a club can be measured. See HANDOFF.md and PILOT.md.

(() => {
  "use strict";

  var SRC_KEY = "kr:src";

  function cleanSlug(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  }

  function readSrc() {
    var q = "";
    try { q = new URLSearchParams(window.location.search).get("src") || ""; } catch (_) { }
    var c = cleanSlug(q);
    if (c) { try { window.localStorage.setItem(SRC_KEY, c); } catch (_) { } return c; }
    try { return cleanSlug(window.localStorage.getItem(SRC_KEY) || ""); } catch (_) { return ""; }
  }

  var src = readSrc();
  var loaded = false;

  function config() { return (window.KR_CONFIG && window.KR_CONFIG.analytics) || null; }

  function enabled() {
    var cfg = config();
    if (!cfg || !cfg.goatcounterUrl) return false;
    try { if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return false; } catch (_) { }
    return true;
  }

  function pathFor(name) { return "kr/" + name + (src ? "/src-" + src : ""); }

  function load() {
    if (loaded) return;
    loaded = true;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.setAttribute("data-goatcounter", config().goatcounterUrl);
    s.setAttribute("data-goatcounter-settings", JSON.stringify({ no_onload: true }));
    document.head.appendChild(s);
  }

  // Events used: landing, duel-start, duel-second, duel-complete, daily-start, daily-complete, tutorial-complete, daily-share.
  function track(name) {
    if (!enabled()) return false;
    var n = String(name || "").replace(/[^a-z0-9/-]/gi, "").slice(0, 60);
    if (!n) return false;
    load();
    var path = pathFor(n), tries = 0;
    (function send() {
      var gc = window.goatcounter;
      if (gc && typeof gc.count === "function") { try { gc.count({ path: path, title: n, event: true }); } catch (_) { } return; }
      if (++tries < 20) setTimeout(send, 250);
    })();
    return true;
  }

  window.KR_Analytics = { track: track, enabled: enabled, getSrc: function () { return src; }, cleanSlug: cleanSlug, pathFor: pathFor };

  try {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { track("landing"); });
    else track("landing");
  } catch (_) { }
})();
