/* Service worker «Апгрейд». Версия меняется при каждой сборке — старые кэши удаляются. */
const VERSION = "__V__";
const CACHE = "upg-" + VERSION;
const MEDIA_CACHE = "upg-media";
const MEDIA_MAX = 150;
const CORE = [
  "./", "index.html", "manifest.webmanifest",
  "css/app.css?v=__V__", "js/store.js?v=__V__", "js/config.js?v=__V__", "js/program.js?v=__V__", "js/sync.js?v=__V__", "js/charts.js?v=__V__", "js/app.js?v=__V__",
  "icons/favicon.svg", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("upg-") && k !== CACHE && k !== MEDIA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("message", (e) => { if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting(); });

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

async function navigate(req) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then((res) => { if (res.ok) cache.put("index.html", res.clone()); return res; });
  try { return await Promise.race([net, timeout(3000)]); }
  catch (e) { return (await cache.match("index.html")) || (await cache.match("./")) || net; }
}
async function sameOrigin(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}
async function media(req) {
  const cache = await caches.open(MEDIA_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  cache.put(req, res.clone()).then(async () => {
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - MEDIA_MAX; i++) await cache.delete(keys[i]);
  });
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(req.mode === "navigate" ? navigate(req) : sameOrigin(req));
    return;
  }
  if (url.hostname === "raw.githubusercontent.com" && url.pathname.indexOf("/exercises-dataset/") !== -1) {
    e.respondWith(media(req));
  }
});
