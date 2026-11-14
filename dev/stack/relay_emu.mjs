// Emulates (1) Neon's region block: 403 HTML without CORS on :8794, and
// (2) the Vercel relay on :8793: rewrite "/<path>" → "/api/relay?p=<path>", then call relay/api/relay.ts.
import http from "node:http";

process.env.UPSTREAM = "http://localhost:8791";
process.env.ALLOWED_ORIGINS = "https://tratsiaka.github.io,http://localhost:8765";
const mod = await import(new URL("../../relay/api/relay.ts", import.meta.url).href);

const readBody = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });
let hits = 0;

http.createServer((req, res) => {
  res.writeHead(403, { "content-type": "text/html" });
  res.end("<html><head><title>403 Forbidden</title></head><body><center><h1>403 Forbidden</h1></center></body></html>");
}).listen(8794, "127.0.0.1");

http.createServer(async (req, res) => {
  hits++;
  const u = new URL(req.url, "http://localhost:8793");
  if (u.pathname === "/__hits") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ hits })); return; }
  let target = u;
  if (!u.pathname.startsWith("/api/")) { // vercel.json: "/((?!api/).*)" → "/api/relay?p=$1"
    target = new URL("/api/relay", u);
    target.searchParams.set("p", u.pathname.slice(1));
    u.searchParams.forEach((v, k) => target.searchParams.append(k, v));
  }
  const method = req.method;
  const body = method === "GET" || method === "HEAD" || method === "OPTIONS" ? undefined : await readBody(req);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  headers.set("x-forwarded-for", "93.85.1.1"); // Vercel adds the client's address; the relay must not pass it on
  const fn = mod[method] || mod.relay;
  const r = await fn(new Request(target, { method, headers, body }));
  const out = {};
  r.headers.forEach((v, k) => { out[k] = v; });
  res.writeHead(r.status, out);
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(8793, "127.0.0.1");

console.log("relay emu up: block 8794, relay 8793");
