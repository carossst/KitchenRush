// Generates fr.html and manifest.fr.json from index.html and manifest.json (run: node tools/make-fr.mjs).
// fr.html is a generated file: never edit it by hand. tests/pages.test.mjs fails when it is out of date, and
// this script throws when a sentence it translates is no longer found in index.html (so the two cannot drift).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const R = [
  ['<html lang="en">', '<html lang="fr">'],
  ['  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">', '  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n  <meta name="kr-lang" content="fr">'],
  ['<title>Kitchen Rush - Fast Pickleball Arcade</title>', "<title>Kitchen Rush - L'arcade du pickleball</title>"],
  ['    content="A fast pickleball arcade. Aim every shot in the Duel, beat the boss, and chase your best in Classic and the Daily Challenge. No ads. No account.">', '    content="Une arcade de pickleball rapide. Visez chaque coup dans le Duel, battez le boss et battez votre record en Classique et dans le Défi du jour. Sans pub. Sans compte.">'],
  ['<link rel="canonical" href="https://kitchenrush.app/">', '<link rel="canonical" href="https://kitchenrush.app/fr.html">'],
  ['<meta name="twitter:url" content="https://kitchenrush.app/">', '<meta name="twitter:url" content="https://kitchenrush.app/fr.html">'],
  ['<meta name="twitter:title" content="Kitchen Rush - Fast Pickleball Arcade">', '<meta name="twitter:title" content="Kitchen Rush - L\'arcade du pickleball">'],
  ['    content="Aim every shot, beat the boss, and chase your best score in the Duel, Classic and the Daily Challenge.">', '    content="Visez chaque coup, battez le boss et battez votre record dans le Duel, en Classique et dans le Défi du jour.">'],
  ['<meta property="og:url" content="https://kitchenrush.app/">', '<meta property="og:url" content="https://kitchenrush.app/fr.html">'],
  ['<meta property="og:title" content="Kitchen Rush - Fast Pickleball Arcade">', '<meta property="og:title" content="Kitchen Rush - L\'arcade du pickleball">'],
  ['    content="A fast pickleball arcade. Aim every shot in the Duel, beat the boss, and chase your best score.">', '    content="Une arcade de pickleball rapide. Visez chaque coup dans le Duel, battez le boss et battez votre record.">'],
  ['<meta property="og:type" content="website">', '<meta property="og:type" content="website">\n  <meta property="og:locale" content="fr_FR">'],
  ['<link rel="manifest" href="./manifest.json">', '<link rel="manifest" href="./manifest.fr.json">'],
  ['<h2>JavaScript Required</h2>', '<h2>JavaScript requis</h2>'],
  ['<p>Kitchen Rush requires JavaScript to run. Please enable JavaScript in your browser settings and reload this\n          page.</p>', '<p>Kitchen Rush a besoin de JavaScript pour fonctionner. Activez JavaScript dans les réglages de votre navigateur puis rechargez\n          la page.</p>'],
  ['Skip to main content</a>', 'Aller au contenu principal</a>'],
  ['aria-label="Kitchen Rush game content"', 'aria-label="Contenu du jeu Kitchen Rush"'],
];

export function buildHtml(html) {
  for (const [a, b] of R) {
    if (!html.includes(a)) throw new Error("make-fr: this text is no longer in index.html, update tools/make-fr.mjs: " + a.slice(0, 70));
    html = html.split(a).join(b);
  }
  return html;
}

export function buildManifest(json) {
  const m = JSON.parse(json);
  m.id = "./fr.html"; m.start_url = "./fr.html"; m.lang = "fr";
  m.description = "Une arcade inspirée du pickleball. Visez chaque coup, maîtrisez la cuisine, battez le boss.";
  return JSON.stringify(m, null, 2) + "\n";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(new URL("fr.html", root), buildHtml(readFileSync(new URL("index.html", root), "utf8")));
  writeFileSync(new URL("manifest.fr.json", root), buildManifest(readFileSync(new URL("manifest.json", root), "utf8")));
  console.log("wrote fr.html and manifest.fr.json");
}
