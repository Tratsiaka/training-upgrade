// Local test stack: PGlite (Postgres) + mock Neon Auth + the real Function code.
// Ports: 5433 Postgres, 8790 mock auth, 8791 function.
import http from "node:http";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

const db = await PGlite.create();
const pgServer = new PGLiteSocketServer({ db, port: 5433, host: "127.0.0.1", maxConnections: 10 });
await pgServer.start();
// neon_auth schema like Managed Auth (users table) so the function can look up emails
await db.exec(`create schema if not exists neon_auth; create table if not exists neon_auth."user" (id uuid primary key, email text, name text);`);

/* ---------------- mock Neon Auth ---------------- */
const BASE_PATH = "/neondb/auth";
const ISS = "http://localhost:8790";
const TRUSTED = ["https://tratsiaka.github.io", "http://localhost:8765"];
const COOKIE = "__Secure-neon-auth.session_token";
const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
const jwk = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "EdDSA", use: "sig" };
const users = new Map(); // email -> user
const sessions = new Map(); // token -> { userId, exp }
const otps = new Map(); // email -> code
const stats = { proxied: 0, lastOrigin: null, lastMiddleware: null };

const sign = (u) => new SignJWT({ email: u.email, name: u.name }).setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
  .setSubject(u.id).setIssuer(ISS).setIssuedAt().setExpirationTime("15m").sign(privateKey);
const readBody = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
const parseCookies = (h) => Object.fromEntries((h || "").split(";").map((p) => p.trim().split("=")).filter((x) => x[0]).map(([k, ...v]) => [k, v.join("=")]));
function sessionOf(req) {
  const raw = parseCookies(req.headers.cookie)[COOKIE];
  if (!raw) return null;
  const token = decodeURIComponent(raw).split(".")[0];
  const s = sessions.get(token);
  if (!s || s.exp < Date.now()) return null;
  const u = [...users.values()].find((x) => x.id === s.userId);
  return u ? { token, s, u } : null;
}
const setCookie = (token, maxAge) => `${COOKIE}=${encodeURIComponent(token + ".sig")}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned`;

const authServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, ISS);
  const send = (status, data, headers = {}) => { res.writeHead(status, { "content-type": "application/json", ...headers }); res.end(JSON.stringify(data)); };
  if (url.pathname === "/__test/otp") return send(200, { code: otps.get(url.searchParams.get("email")) || null });
  if (url.pathname === "/__test/expire") { const u = users.get(url.searchParams.get("email")); for (const [t, s] of sessions) if (u && s.userId === u.id) sessions.delete(t); return send(200, { ok: true }); }
  if (url.pathname === "/__test/stats") return send(200, stats);
  if (!url.pathname.startsWith(BASE_PATH)) return send(404, { error: "nf" });
  const path = url.pathname.slice(BASE_PATH.length);
  if (path === "/.well-known/jwks.json") return send(200, { keys: [jwk] });
  stats.proxied++; stats.lastOrigin = req.headers.origin || null; stats.lastMiddleware = req.headers["x-neon-auth-middleware"] || null;
  if (req.method === "POST" && !TRUSTED.includes(req.headers.origin)) return send(403, { code: "INVALID_ORIGIN", message: "Invalid origin" });
  const body = req.method === "POST" ? JSON.parse((await readBody(req)) || "{}") : {};
  if (path === "/email-otp/send-verification-otp" && req.method === "POST") {
    const code = String(crypto.randomInt(100000, 999999));
    otps.set(body.email, code);
    return send(200, { success: true });
  }
  if (path === "/sign-in/email-otp" && req.method === "POST") {
    if (!body.email || otps.get(body.email) !== body.otp) return send(400, { code: "INVALID_OTP", message: "Неверный код" });
    otps.delete(body.email);
    let u = users.get(body.email);
    if (!u) { u = { id: crypto.randomUUID(), email: body.email, name: "" }; users.set(body.email, u); await db.query(`insert into neon_auth."user"(id,email,name) values ($1,$2,$3)`, [u.id, u.email, u.name]); }
    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, { userId: u.id, exp: Date.now() + 7 * 864e5 });
    return send(200, { token, user: u }, { "set-cookie": setCookie(token, 604800) });
  }
  if (path === "/get-session" && req.method === "GET") {
    const s = sessionOf(req);
    if (!s) return send(200, null);
    return send(200, { session: { id: "s1", userId: s.u.id, token: s.token }, user: s.u }, { "set-auth-jwt": await sign(s.u), "set-cookie": setCookie(s.token, 604800) });
  }
  if (path === "/token" && req.method === "GET") {
    const s = sessionOf(req);
    if (!s) return send(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
    return send(200, { token: await sign(s.u) });
  }
  if (path === "/sign-out" && req.method === "POST") {
    const s = sessionOf(req);
    if (s) sessions.delete(s.token);
    return send(200, { success: true }, { "set-cookie": `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None` });
  }
  return send(404, { code: "NOT_FOUND" });
});
await new Promise((r) => authServer.listen(8790, "127.0.0.1", r));

/* ---------------- the real function ---------------- */
Object.assign(process.env, {
  NEON_AUTH_BASE_URL: ISS + BASE_PATH,
  NEON_AUTH_JWKS_URL: ISS + BASE_PATH + "/.well-known/jwks.json",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable",
  ALLOWED_ORIGINS: "https://tratsiaka.github.io",
  ALLOW_LOCALHOST: "1",
  MEMBER_EMAILS: "art@example.com",
});
const fn = (await import(new URL("../../backend/src/index.ts", import.meta.url).href)).default;
const fnServer = http.createServer(async (req, res) => {
  const body = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS" ? undefined : await readBody(req);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  const request = new Request("http://localhost:8791" + req.url, { method: req.method, headers, body });
  const r = await fn.fetch(request);
  const out = {};
  r.headers.forEach((v, k) => { out[k] = v; });
  res.writeHead(r.status, out);
  res.end(Buffer.from(await r.arrayBuffer()));
});
await new Promise((r) => fnServer.listen(8791, "127.0.0.1", r));

// tiny admin endpoint for tests to run SQL
http.createServer(async (req, res) => {
  const sql = await readBody(req);
  try { const r = sql.trim().includes(";") ? { rows: (await db.exec(sql)).flatMap((x) => x.rows) } : await db.query(sql); res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(r.rows)); }
  catch (e) { res.writeHead(500); res.end(String(e.message)); }
}).listen(8792, "127.0.0.1");

console.log("stack up: pg 5433, auth 8790, fn 8791, sql 8792");
