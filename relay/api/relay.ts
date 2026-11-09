/**
 * Прокси к Neon Function для тех, до кого Neon не доходит.
 *
 * Neon отвечает 403 на любые запросы из Беларуси и России (проверено с сетей A1, МТС и
 * Белтелекома), а браузер видит это как «нет связи». Функция крутится на Vercel во
 * Франкфурте и пересылает запрос в Neon как есть: путь, метод, тело и нужные заголовки.
 * Данных не хранит и не читает. CORS, вход и доступ проверяет сама Neon Function.
 *
 * vercel.json переписывает любой путь (кроме /api/*) в /api/relay?p=<путь>.
 */

// Без @types/node: на Vercel переменные окружения лежат в process.env.
const ENV: Record<string, string | undefined> = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const UPSTREAM = (ENV.UPSTREAM || "https://br-calm-hill-b9257iw9-api.compute.c-7.eu-central-1.aws.neon.tech").replace(/\/+$/, "");

// Только то, что нужно приложению. X-Forwarded-For и прочие заголовки с адресом клиента не пересылаем.
const PASS_REQUEST = [
  "origin", "content-type", "accept", "authorization", "x-auth-cookies", "x-neon-client-info", "user-agent",
  "access-control-request-method", "access-control-request-headers",
];
const SKIP_RESPONSE = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]);
const ORIGINS = (ENV.ALLOWED_ORIGINS || "https://tratsiaka.github.io").split(",").map((s) => s.trim()).filter(Boolean);
const PATH_OK = /^[A-Za-z0-9._~\-/]{0,300}$/;

function corsFor(request: Request): Record<string, string> {
  const o = request.headers.get("origin") || "";
  return ORIGINS.includes(o) ? { "Access-Control-Allow-Origin": o, Vary: "Origin" } : { Vary: "Origin" };
}
function fail(request: Request, status: number, error: string, message: string): Response {
  return new Response(JSON.stringify({ error, message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsFor(request) },
  });
}

/** Путь из ?p= (после переписывания в vercel.json); если его нет — из самого адреса. */
function targetOf(request: Request): URL | null {
  const url = new URL(request.url);
  let path = url.searchParams.get("p");
  if (path === null) path = url.pathname.replace(/^\/api\/relay\/?/, "");
  url.searchParams.delete("p");
  path = path.replace(/^\/+/, "");
  if (!PATH_OK.test(path) || path.split("/").some((s) => s === "." || s === "..")) return null;
  const target = new URL(UPSTREAM + "/" + path);
  target.search = url.search;
  return target;
}

export async function relay(request: Request): Promise<Response> {
  const target = targetOf(request);
  if (!target) return fail(request, 400, "bad_path", "Неверный адрес");
  const headers = new Headers();
  for (const h of PASS_REQUEST) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" || method === "OPTIONS" ? undefined : await request.arrayBuffer();
  if (body && body.byteLength > 4 * 1024 * 1024) return fail(request, 413, "too_large", "Слишком большой запрос");
  let res: Response;
  try {
    res = await fetch(target, { method, headers, body, redirect: "manual", signal: AbortSignal.timeout(25000) });
  } catch (e) {
    console.error("[relay] upstream failed", String(e));
    return fail(request, 502, "upstream_unreachable", "Сервер синхронизации не ответил — попробуй ещё раз");
  }
  const out = new Headers();
  res.headers.forEach((v, k) => { if (!SKIP_RESPONSE.has(k.toLowerCase())) out.set(k, v); });
  out.set("Cache-Control", "no-store");
  out.set("X-Relay", "1");
  return new Response(method === "HEAD" ? null : res.body, { status: res.status, statusText: res.statusText, headers: out });
}

export const GET = relay;
export const POST = relay;
export const OPTIONS = relay;
export const HEAD = relay;
