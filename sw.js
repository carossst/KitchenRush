/* sw.js - Service Worker for Kitchen Rush */
/* Kitchen Rush */

const SW_VERSION = (() => {
  try {
    const v = new URL(self.location.href).searchParams.get("v");
    const s = String(v || "").trim();
    if (!s) return "dev";
    if (!/^[a-zA-Z0-9._-]{1,32}$/.test(s)) return "dev";
    return s;
  } catch (_) {
    return "dev";
  }
})();

const CACHE_PREFIX = "kr";
const CACHE_NAME = `${CACHE_PREFIX}-cache-${SW_VERSION}`;

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./success.html",
  "./404.html",
  "./privacy.html",
  "./terms.html",
  "./style.css",
  "./config.js",
  "./storage.js",
  "./game.js",
  "./audio.js",
  "./ui.js",
  "./pwa.js",
  "./email.js",
  "./footer.js",
  "./main.js",
  "./wording-dom.js",
  "./page-404.js",
  "./success.js",
  "./manifest.json"
];

const CRITICAL_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./storage.js",
  "./game.js",
  "./audio.js",
  "./ui.js",
  "./main.js"
];

// Install: cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const results = await Promise.allSettled(
        ASSETS_TO_CACHE.map(async (url) => {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) throw new Error(`${url}: ${res.status}`);
          await cache.put(url, res);
        })
      );

      const okByUrl = new Map();
      for (let i = 0; i < ASSETS_TO_CACHE.length; i++) {
        okByUrl.set(ASSETS_TO_CACHE[i], results[i]?.status === "fulfilled");
      }
      const criticalOk = CRITICAL_ASSETS.every((u) => okByUrl.get(u) === true);
      if (criticalOk) {
        await self.skipWaiting();
      }
    })().catch(() => {
      // Fail-closed: don't block the existing SW.
    })
  );
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(`${CACHE_PREFIX}-`) && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isStripeRequest(href) {
  return href.includes("stripe.com") || href.includes("buy.stripe.com");
}

// Fetch: cache-first for same-origin, skip Stripe
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (isStripeRequest(url.href)) return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const res = await fetch(req, { cache: "reload" });
        if (res && res.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(req, res.clone());
        }
        return res;
      } catch (_) {
        if (req.mode === "navigate") {
          const fallbackPath = url.pathname.endsWith("/success.html")
            ? "./success.html"
            : (url.pathname.endsWith("/404.html")
              ? "./404.html"
              : "./index.html");
          const shell = await caches.match(fallbackPath);
          return shell || new Response("Offline", { status: 503 });
        }
        return new Response("", { status: 504 });
      }
    })()
  );
});
