import http from "node:http";
const srv = http.createServer((req, res) => {
  let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => {
    res.writeHead(201, { "content-type": "application/json", "access-control-allow-origin": "https://tratsiaka.github.io", "x-auth-set-cookies": "abc", "set-auth-jwt": "jwt1", "content-encoding": "identity" });
    res.end(JSON.stringify({ method: req.method, url: req.url, headers: req.headers, body: b }));
  });
}).listen(8795);
process.env.UPSTREAM = "http://localhost:8795/";
const { relay, POST } = await import(new URL("../../relay/api/relay.ts", import.meta.url).href);
const ok = (c, m) => console.log((c ? "ok  " : "FAIL") + " " + m);
let r = await POST(new Request("https://x.vercel.app/api/relay?p=auth/sign-in/email-otp&foo=1", {
  method: "POST", body: JSON.stringify({ a: 1 }),
  headers: { origin: "https://tratsiaka.github.io", "content-type": "application/json", "x-auth-cookies": "s=1", authorization: "Device tok",
             "x-forwarded-for": "93.85.1.1", "x-real-ip": "93.85.1.1", cookie: "vercel=1", "x-vercel-id": "fra1::x" } }));
let d = await r.json();
ok(r.status === 201, "status passes through: " + r.status);
ok(d.url === "/auth/sign-in/email-otp?foo=1", "path + query (p removed): " + d.url);
ok(d.method === "POST" && d.body === '{"a":1}', "method + body");
ok(d.headers.origin === "https://tratsiaka.github.io" && d.headers["x-auth-cookies"] === "s=1" && d.headers.authorization === "Device tok", "app headers forwarded");
ok(!d.headers["x-forwarded-for"] && !d.headers["x-real-ip"] && !d.headers.cookie && !d.headers["x-vercel-id"], "client address/cookies NOT forwarded: " + JSON.stringify(Object.keys(d.headers)));
ok(r.headers.get("access-control-allow-origin") === "https://tratsiaka.github.io" && r.headers.get("x-auth-set-cookies") === "abc" && r.headers.get("set-auth-jwt") === "jwt1", "CORS + auth headers come back");
ok(!r.headers.get("content-encoding"), "content-encoding dropped");
// path from pathname when no ?p= (rewrite kept the original URL)
r = await relay(new Request("https://x.vercel.app/sync", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }));
d = await r.json(); ok(d.url === "/sync", "pathname fallback: " + d.url);
r = await relay(new Request("https://x.vercel.app/api/relay/devices")); d = await r.json(); ok(d.url === "/devices", "api/relay/<path>: " + d.url);
for (const bad of ["a/../../etc", "%2e%2e/x", "a b", "x;y"]) {
  r = await relay(new Request("https://x.vercel.app/api/relay?p=" + encodeURIComponent(bad), { headers: { origin: "https://tratsiaka.github.io" } }));
  ok(r.status === 400 && r.headers.get("access-control-allow-origin") === "https://tratsiaka.github.io", `reject ${bad}: ${r.status}`);
}
// upstream down → 502 JSON with CORS for allowed origin only
srv.close(); await new Promise((x) => setTimeout(x, 100));
r = await relay(new Request("https://x.vercel.app/api/relay?p=health", { headers: { origin: "https://tratsiaka.github.io" } }));
ok(r.status === 502 && r.headers.get("access-control-allow-origin") === "https://tratsiaka.github.io", "upstream down → 502 with CORS");
r = await relay(new Request("https://x.vercel.app/api/relay?p=health", { headers: { origin: "https://evil.example" } }));
ok(r.status === 502 && !r.headers.get("access-control-allow-origin"), "no CORS for foreign origin");
process.exit(0);
