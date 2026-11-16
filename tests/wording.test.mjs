// Wording checks (pure Node, no browser): every French override targets a real English key, keeps the same
// {placeholders}, and the Duel French dictionary covers every Duel key. Run: node tests/wording.test.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";

function load(lang) {
  const win = { localStorage: { getItem: () => lang }, navigator: { language: lang } };
  const ctx = { window: win, document: { documentElement: {} } };
  vm.createContext(ctx);
  for (const f of ["wording.js", "wording-fr.js"]) vm.runInContext(readFileSync(new URL("../" + f, import.meta.url), "utf8"), ctx);
  return win;
}

let failed = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failed++; console.error("FAIL", msg); } };
const tokens = (s) => (String(s).match(/\{[a-zA-Z]+\}/g) || []).sort().join(",");

const en = load("en"), fr = load("fr");
const base = en.KR_WORDING, over = en.KR_WORDING_FR;

(function walk(o, b, path) {
  for (const k of Object.keys(o)) {
    const p = path + "." + k;
    ok(b && k in b, "French key not in English base: " + p);
    if (!b || !(k in b)) continue;
    if (Array.isArray(o[k])) { ok(Array.isArray(b[k]) && b[k].length === o[k].length, "Array length differs: " + p); }
    else if (o[k] && typeof o[k] === "object") walk(o[k], b[k], p);
    else { ok(typeof o[k] === typeof b[k], "Type differs: " + p); if (typeof o[k] === "string") ok(tokens(o[k]) === tokens(b[k]), "Placeholders differ at " + p + ": " + tokens(b[k]) + " vs " + tokens(o[k])); }
  }
})(over, base, "wording");

const duel = base.duel, duelFr = base.duelFr;
for (const k of Object.keys(duel)) {
  ok(k in duelFr, "duelFr is missing key: " + k);
  if (k in duelFr) {
    if (Array.isArray(duel[k])) ok(Array.isArray(duelFr[k]) && duelFr[k].length === duel[k].length, "duelFr array length differs: " + k);
    else if (typeof duel[k] === "string") ok(tokens(duel[k]) === tokens(duelFr[k]), "duelFr placeholders differ at " + k);
    else if (duel[k] && typeof duel[k] === "object") ok(Object.keys(duel[k]).every((s) => s in duelFr[k]), "duelFr sub-keys missing in " + k);
  }
}
ok(Array.isArray(duelFr.tags) && duelFr.tags.length === 6, "duelFr.tags must list the 6 opponents");
ok(duel.powerNames.length === 6 && duel.powerDescs.length === 6, "6 power names and descriptions expected");

ok(en.KR_WORDING.landing.ctaPlay === "Play Classic", "English must stay the default");
ok(fr.KR_WORDING.landing.ctaPlay === over.landing.ctaPlay && fr.KR_WORDING.landing.ctaPlay !== "Play Classic", "French merge did not apply");
ok(fr.KR_LANG === "fr" && en.KR_LANG === "en", "KR_LANG not set");

console.log(checks + " checks, " + failed + " failed");
process.exit(failed ? 1 : 0);
