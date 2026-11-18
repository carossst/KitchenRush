// Page contract tests (no browser): fr.html is up to date with index.html, both load the same scripts,
// every script is in the service-worker cache list, and the versioning contract holds. Run: node tests/pages.test.mjs
import { readFileSync, existsSync } from "node:fs";
import { buildHtml, buildManifest } from "../tools/make-fr.mjs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
let failed = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { failed++; console.error("FAIL", m); } };

const index = read("index.html"), fr = read("fr.html"), sw = read("sw.js"), cfg = read("config.js");
ok(fr === buildHtml(index), "fr.html is out of date: run `node tools/make-fr.mjs`");
ok(read("manifest.fr.json") === buildManifest(read("manifest.json")), "manifest.fr.json is out of date: run `node tools/make-fr.mjs`");

const scripts = (h) => [...h.matchAll(/<script defer src="\.\/([^"]+)"/g)].map((m) => m[1]);
const a = scripts(index), b = scripts(fr);
ok(JSON.stringify(a) === JSON.stringify(b), "index.html and fr.html must load the same scripts in the same order");
ok(a.length > 15, "script list looks too short");
for (const s of a) {
  ok(existsSync(new URL("../" + s, import.meta.url)), "script file missing: " + s);
  ok(sw.includes('"./' + s + '"'), "script not in the service-worker cache list: " + s);
}
for (const f of ["./fr.html", "./manifest.fr.json", "./index.html", "./manifest.json", "./style.css"]) ok(sw.includes('"' + f + '"'), "not in the service-worker shell list: " + f);

ok(/<html lang="fr">/.test(fr) && /name="kr-lang" content="fr"/.test(fr), "fr.html must declare French");
ok(/rel="canonical" href="https:\/\/kitchenrush\.app\/fr\.html"/.test(fr), "fr.html canonical");
ok(/hreflang="fr"/.test(index) && /hreflang="en"/.test(index), "index.html must list the language alternates");
ok(!/Fast Pickleball Arcade/.test(fr.replace(/<!--.*?-->/gs, "")), "fr.html still has English metadata");

ok(/version: "\d+"/.test(cfg), "config.js must define a numeric version");
ok(sw.includes('searchParams.get("v")'), "sw.js must read the version from ?v=");
ok(/goatcounterUrl: ""/.test(cfg), "analytics must be OFF by default (empty goatcounterUrl)");

console.log(checks + " checks, " + failed + " failed");
process.exit(failed ? 1 : 0);
