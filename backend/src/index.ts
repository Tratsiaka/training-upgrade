/**
 * Апгрейд API — Neon Function.
 *
 *   /auth/*   прокси к Neon Auth (Managed Better Auth). Браузер не хранит сторонние cookie:
 *             cookie сессии ходят в заголовках X-Auth-Cookies / X-Auth-Set-Cookies и живут
 *             в localStorage приложения. Так вход работает и в установленной PWA на iPhone.
 *   /sync     синхронизация данных пользователя (last-write-wins по каждой записи).
 *   /me       кто я и есть ли доступ.
 *   /health   проверка, что функция жива (без обращения к базе).
 *
 * Доступ к данным — только по JWT Neon Auth (проверка по JWKS) и только для участников
 * из таблицы app.members (или почт из MEMBER_EMAILS — они добавляются туда автоматически).
 */
import { attachDatabasePool } from "@neon/functions";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { Pool, type PoolClient } from "pg";

const AUTH_BASE = (process.env.NEON_AUTH_BASE_URL ?? "").replace(/\/+$/, "");
const JWKS_URL = process.env.NEON_AUTH_JWKS_URL ?? "";
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? "https://tratsiaka.github.io")
  .split(",").map((s) => s.trim()).filter(Boolean);
const ALLOW_LOCALHOST = (process.env.ALLOW_LOCALHOST ?? "1") === "1";
const MEMBER_EMAILS = (process.env.MEMBER_EMAILS ?? "")
  .toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);

const MAX_BODY = 2 * 1024 * 1024; // 2 МБ на запрос синхронизации
const MAX_VALUE = 512 * 1024; // 512 КБ на одну запись
const MAX_CHANGES = 1000;
const PULL_LIMIT = 1000;
const SERVER_PREFIX = "srv:"; // записи, которые пишет только сервер (личные заметки и т. п.)

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
attachDatabasePool(pool);

const jwks = JWKS_URL ? createRemoteJWKSet(new URL(JWKS_URL)) : null;
// Издатель токена — origin адреса Neon Auth; на всякий случай принимаем и полный базовый адрес.
const issuer = AUTH_BASE ? [new URL(AUTH_BASE).origin, AUTH_BASE] : [];

/* ---------------- schema ---------------- */
const SCHEMA_SQL = `
create schema if not exists app;
create sequence if not exists app.kv_rev;
create table if not exists app.kv (
  user_id    text        not null,
  key        text        not null check (char_length(key) between 1 and 200),
  value      jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null,
  rev        bigint      not null default nextval('app.kv_rev'),
  primary key (user_id, key)
);
create index if not exists kv_user_rev on app.kv (user_id, rev);
create table if not exists app.members (
  user_id  text primary key,
  email    text,
  role     text not null default 'member',
  added_at timestamptz not null default now()
);
-- личные заметки к программе по почте владельца; при синхронизации копируются в app.kv как srv:overlay
create table if not exists app.private_overlays (
  email      text primary key,
  overlay    jsonb not null,
  updated_at timestamptz not null default now()
);
`;
const OVERLAY_SQL = `
insert into app.kv (user_id, key, value, updated_at)
  select $1, 'srv:overlay', o.overlay, o.updated_at from app.private_overlays o where o.email = $2
on conflict (user_id, key) do update
  set value = excluded.value, deleted = false, updated_at = excluded.updated_at, rev = nextval('app.kv_rev')
  where app.kv.updated_at < excluded.updated_at`;
let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(SCHEMA_SQL).then(() => undefined).catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

/* ---------------- http helpers ---------------- */
function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (ORIGINS.includes(origin)) return origin;
  if (ALLOW_LOCALHOST && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}
function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { Vary: "Origin" };
  if (origin) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "authorization, content-type, x-auth-cookies, x-neon-client-info";
    h["Access-Control-Expose-Headers"] = "x-auth-set-cookies, set-auth-jwt, set-auth-token";
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}
function json(data: unknown, status: number, origin: string | null, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(origin), ...extra },
  });
}
const fail = (status: number, code: string, message: string, origin: string | null) =>
  json({ error: code, message }, status, origin);

/* ---------------- /auth/* proxy ---------------- */
const COOKIE_NAME = /^[A-Za-z0-9_.\-]{1,100}$/;
const COOKIE_VALUE = /^[^;\r\n]{0,4096}$/;

function cookiesFromHeader(raw: string | null): string {
  if (!raw) return "";
  const out: string[] = [];
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const name = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (COOKIE_NAME.test(name) && COOKIE_VALUE.test(value)) out.push(`${name}=${value}`);
  }
  return out.slice(0, 20).join("; ");
}

type JarCookie = { n: string; v: string; maxAge?: number; exp?: string };
function parseSetCookie(header: string): JarCookie | null {
  const [pair, ...attrs] = header.split(";");
  const i = pair.indexOf("=");
  if (i < 1) return null;
  const c: JarCookie = { n: pair.slice(0, i).trim(), v: pair.slice(i + 1).trim() };
  for (const a of attrs) {
    const [k, ...rest] = a.split("=");
    const key = k.trim().toLowerCase();
    const val = rest.join("=").trim();
    if (key === "max-age" && val !== "") c.maxAge = Number(val);
    if (key === "expires" && val) {
      const t = Date.parse(val);
      if (!Number.isNaN(t)) c.exp = new Date(t).toISOString();
    }
  }
  return COOKIE_NAME.test(c.n) ? c : null;
}

async function proxyAuth(request: Request, path: string, origin: string): Promise<Response> {
  if (!AUTH_BASE) return fail(503, "auth_disabled", "Neon Auth не включён на этой ветке", origin);
  const url = new URL(request.url);
  const upstream = new URL(`${AUTH_BASE}/${path}`);
  upstream.search = url.search;

  const headers = new Headers();
  for (const h of ["content-type", "user-agent", "x-neon-client-info"]) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("origin", origin);
  headers.set("x-neon-auth-middleware", "true");
  const cookie = cookiesFromHeader(request.headers.get("x-auth-cookies"));
  if (cookie) headers.set("cookie", cookie);

  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
  if (body && body.length > 64 * 1024) return fail(413, "too_large", "Слишком большой запрос", origin);

  let res: Response;
  try {
    res = await fetch(upstream, { method: request.method, headers, body, redirect: "manual" });
  } catch (e) {
    console.error("[auth] upstream fetch failed", e);
    return fail(502, "auth_unreachable", "Сервис входа недоступен", origin);
  }

  const out = new Headers(corsHeaders(origin));
  out.set("Cache-Control", "no-store");
  for (const h of ["content-type", "set-auth-jwt", "set-auth-token", "location"]) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  const jar = res.headers.getSetCookie().map(parseSetCookie).filter((c): c is JarCookie => !!c);
  if (jar.length) out.set("x-auth-set-cookies", Buffer.from(JSON.stringify(jar)).toString("base64url"));
  if (res.status >= 300 && res.status < 400) {
    // Браузерный fetch сам пошёл бы по редиректу на чужой домен — отдаём адрес в JSON.
    out.set("content-type", "application/json; charset=utf-8");
    out.delete("location");
    return new Response(JSON.stringify({ redirect: res.headers.get("location") }), { status: 200, headers: out });
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

/* ---------------- identity ---------------- */
type Identity = { userId: string; email: string | null; payload: JWTPayload };

async function identify(request: Request): Promise<Identity | null> {
  const h = request.headers.get("authorization") ?? "";
  if (!jwks || !h.toLowerCase().startsWith("bearer ")) return null;
  try {
    const { payload } = await jwtVerify(h.slice(7).trim(), jwks, { issuer });
    if (!payload.sub) return null;
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    return { userId: payload.sub, email, payload };
  } catch {
    return null;
  }
}

const memberCache = new Map<string, { ok: boolean; email: string | null; at: number }>();
async function emailOf(db: PoolClient, id: Identity): Promise<string | null> {
  if (id.email) return id.email;
  try {
    const r = await db.query(`select lower(email) as email from neon_auth."user" where id::text = $1`, [id.userId]);
    return r.rows[0]?.email ?? null;
  } catch {
    return null;
  }
}
async function membership(db: PoolClient, id: Identity): Promise<{ ok: boolean; email: string | null }> {
  const hit = memberCache.get(id.userId);
  if (hit && Date.now() - hit.at < 60_000) return hit;
  const email = await emailOf(db, id);
  let ok = (await db.query("select 1 from app.members where user_id = $1", [id.userId])).rowCount === 1;
  if (!ok && email && MEMBER_EMAILS.includes(email)) {
    await db.query(
      "insert into app.members (user_id, email, role) values ($1, $2, 'owner') on conflict (user_id) do nothing",
      [id.userId, email],
    );
    ok = true;
  }
  const res = { ok, email, at: Date.now() };
  memberCache.set(id.userId, res);
  return res;
}

/* ---------------- /sync ---------------- */
type Change = { k: string; v?: unknown; u: string; d?: boolean };

function validChanges(input: unknown): Change[] | string {
  if (input == null) return [];
  if (!Array.isArray(input)) return "changes должен быть массивом";
  if (input.length > MAX_CHANGES) return `не больше ${MAX_CHANGES} изменений за раз`;
  const out: Change[] = [];
  for (const c of input) {
    if (!c || typeof c !== "object") return "некорректное изменение";
    const { k, v, u, d } = c as Change;
    if (typeof k !== "string" || k.length < 1 || k.length > 200) return "некорректный ключ";
    if (k.startsWith(SERVER_PREFIX)) return `ключи ${SERVER_PREFIX}* только для чтения`;
    if (typeof u !== "string" || Number.isNaN(Date.parse(u))) return `некорректная дата у ${k}`;
    const deleted = d === true;
    if (!deleted && JSON.stringify(v ?? null).length > MAX_VALUE) return `запись ${k} слишком большая`;
    out.push({ k, v: deleted ? null : v ?? null, u: new Date(u).toISOString(), d: deleted });
  }
  return out;
}

async function handleSync(request: Request, origin: string, id: Identity): Promise<Response> {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return fail(413, "too_large", "Слишком много данных за один раз", origin);
  let body: { since?: string | null; changes?: unknown };
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return fail(400, "bad_json", "Некорректный JSON", origin);
  }
  const changes = validChanges(body.changes);
  if (typeof changes === "string") return fail(400, "bad_changes", changes, origin);
  const since = /^\d{1,19}$/.test(String(body.since ?? "")) ? String(body.since) : "0";

  await ensureSchema();
  const db = await pool.connect();
  try {
    const m = await membership(db, id);
    if (!m.ok) return fail(403, "not_member", "У этого аккаунта пока нет доступа к синхронизации", origin);
    if (m.email) await db.query(OVERLAY_SQL, [id.userId, m.email]);
    let applied = 0;
    if (changes.length) {
      const r = await db.query(
        `insert into app.kv (user_id, key, value, deleted, updated_at)
           select $1, x.k, x.v, coalesce(x.d, false), x.u
             from jsonb_to_recordset($2::jsonb) as x(k text, v jsonb, u timestamptz, d boolean)
         on conflict (user_id, key) do update
           set value = excluded.value, deleted = excluded.deleted,
               updated_at = excluded.updated_at, rev = nextval('app.kv_rev')
           where app.kv.updated_at < excluded.updated_at`,
        [id.userId, JSON.stringify(changes)],
      );
      applied = r.rowCount ?? 0;
    }
    const rows = await db.query(
      `select key as k, value as v, deleted as d, updated_at as u, rev::text as r
         from app.kv where user_id = $1 and rev > $2::bigint order by rev limit ${PULL_LIMIT + 1}`,
      [id.userId, since],
    );
    const more = rows.rows.length > PULL_LIMIT;
    const list = more ? rows.rows.slice(0, PULL_LIMIT) : rows.rows;
    const cursor = list.length ? list[list.length - 1].r : since;
    return json({ applied, rows: list.map((x) => ({ k: x.k, v: x.v, d: x.d, u: x.u, r: x.r })), cursor, more }, 200, origin);
  } finally {
    db.release();
  }
}

async function handleMe(origin: string, id: Identity): Promise<Response> {
  await ensureSchema();
  const db = await pool.connect();
  try {
    const m = await membership(db, id);
    return json({ userId: id.userId, email: m.email, member: m.ok }, 200, origin);
  } finally {
    db.release();
  }
}

/* ---------------- router ---------------- */
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const origin = allowedOrigin(request.headers.get("origin"));
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: origin ? 204 : 403, headers: corsHeaders(origin) });
    }
    if (path === "/health") return json({ ok: true, auth: !!AUTH_BASE }, 200, origin);

    if (path.startsWith("/auth/")) {
      if (!origin) return fail(403, "origin", "Недопустимый источник запроса", null);
      const sub = path.slice("/auth/".length);
      if (!/^[A-Za-z0-9_\-/.]+$/.test(sub) || sub.includes("..")) return fail(400, "bad_path", "Некорректный путь", origin);
      return proxyAuth(request, sub, origin);
    }

    if (path === "/sync" || path === "/me") {
      if (!origin) return fail(403, "origin", "Недопустимый источник запроса", null);
      const id = await identify(request);
      if (!id) return fail(401, "unauthorized", "Нужен вход", origin);
      try {
        if (path === "/me" && request.method === "GET") return await handleMe(origin, id);
        if (path === "/sync" && request.method === "POST") return await handleSync(request, origin, id);
        return fail(405, "method", "Метод не поддерживается", origin);
      } catch (e) {
        console.error("[api]", e);
        return fail(500, "internal", "Ошибка сервера", origin);
      }
    }
    return fail(404, "not_found", "Нет такого адреса", origin);
  },
};
