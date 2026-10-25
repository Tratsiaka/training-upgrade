/* Вход и синхронизация через Neon Function (см. backend/).
   - Вход — код на email (Neon Auth). Cookie сессии живут здесь, в localStorage, и ходят
     в заголовках X-Auth-Cookies / X-Auth-Set-Cookies: сторонние cookie браузеру не нужны,
     поэтому вход держится и в установленной PWA на iPhone.
   - Данные: localStorage остаётся источником правды офлайн. Изменения копятся в очереди
     и уходят на сервер, когда есть сеть. Конфликты решает время изменения записи
     (last-write-wins); журнал и замеры синхронизируются по одной тренировке / дате. */
(function () {
  "use strict";
  const S = window.Store;
  const CFG = window.APP_CONFIG || {};
  const SYS = "upg3~";
  const BOOT_TIME = "2000-01-01T00:00:00.000Z"; // данные, которые были на устройстве до первого входа

  /* ---------- служебное хранилище (не экспортируется и не синхронизируется) ---------- */
  const sys = {
    get(k, d) {
      try { const v = localStorage.getItem(SYS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set(k, v) {
      try { if (v === undefined) localStorage.removeItem(SYS + k); else localStorage.setItem(SYS + k, JSON.stringify(v)); } catch (e) { /* нет места */ }
    }
  };
  const apiBase = () => String(sys.get("apiOverride", "") || CFG.api || "").replace(/\/+$/, "");

  class SyncError extends Error {
    constructor(code, message, status, data) { super(message); this.code = code; this.status = status || 0; this.data = data; }
  }

  /* ---------- хэш для сравнения записей ---------- */
  function hash(str) { // cyrb53
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  const b64urlJSON = (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))));

  /* ---------- cookie Neon Auth ---------- */
  function jarHeader() {
    const jar = sys.get("jar", {}), now = Date.now(), parts = [];
    let changed = false;
    Object.keys(jar).forEach((n) => {
      const c = jar[n];
      if (c.exp && c.exp <= now) { delete jar[n]; changed = true; return; }
      parts.push(n + "=" + c.v);
    });
    if (changed) sys.set("jar", jar);
    return parts.join("; ");
  }
  function jarUpdate(header) {
    if (!header) return;
    let list;
    try { list = b64urlJSON(header); } catch (e) { return; }
    const jar = sys.get("jar", {}), now = Date.now();
    (Array.isArray(list) ? list : []).forEach((c) => {
      if (!c || !c.n) return;
      let exp = null;
      if (typeof c.maxAge === "number" && !isNaN(c.maxAge)) exp = now + c.maxAge * 1000;
      else if (c.exp) exp = Date.parse(c.exp);
      if (!c.v || (exp !== null && exp <= now)) delete jar[c.n];
      else jar[c.n] = { v: c.v, exp: exp };
    });
    sys.set("jar", jar);
  }
  function jwtExp(t) {
    try { return (b64urlJSON(t.split(".")[1]).exp || 0) * 1000; } catch (e) { return 0; }
  }
  function keepJwt(t) { if (t) sys.set("jwt", { t: t, exp: jwtExp(t) }); }

  async function authRequest(path, opts) {
    const o = opts || {};
    const base = apiBase();
    if (!base) throw new SyncError("noapi", "Сервер синхронизации не настроен");
    const headers = { "content-type": "application/json" };
    const jar = jarHeader();
    if (jar) headers["x-auth-cookies"] = jar;
    let res;
    try {
      res = await fetch(base + "/auth/" + path, { method: o.method || "GET", headers: headers, body: o.body ? JSON.stringify(o.body) : undefined, cache: "no-store" });
    } catch (e) {
      throw new SyncError("network", "Нет связи с сервером");
    }
    jarUpdate(res.headers.get("x-auth-set-cookies"));
    keepJwt(res.headers.get("set-auth-jwt"));
    let data = null;
    try { data = await res.json(); } catch (e) { /* пустой ответ */ }
    if (!res.ok) {
      const RU = {
        INVALID_OTP: "Неверный код — проверь цифры из письма",
        OTP_EXPIRED: "Код устарел — запроси новый",
        TOO_MANY_ATTEMPTS: "Слишком много попыток — запроси новый код",
        INVALID_EMAIL: "Проверь адрес почты",
        INVALID_ORIGIN: "Вход с этого адреса сайта не разрешён"
      };
      const msg = (data && RU[data.code]) || (res.status === 429 ? "Слишком часто — подожди минуту и попробуй снова" : "") ||
        (data && (data.message || data.error)) || "Ошибка " + res.status;
      throw new SyncError(res.status === 429 ? "rate" : res.status === 401 ? "signedout" : "auth", msg, res.status, data);
    }
    return data;
  }

  async function getJwt(force) {
    const j = sys.get("jwt", null);
    if (!force && j && j.exp - Date.now() > 60000) return j.t;
    const d = await authRequest("token");
    if (d && d.token) { keepJwt(d.token); return d.token; }
    throw new SyncError("signedout", "Сессия истекла — войди заново");
  }

  /* ---------- что синхронизируем ---------- */
  const SPEC = {
    settings: { kind: "whole" },
    swaps: { kind: "whole" },
    goals: { kind: "whole" },
    cycle: { kind: "whole" },
    adjust: { kind: "whole" },
    logs: { kind: "map", prefix: "log:" },
    meas: { kind: "list", prefix: "meas:", id: (m) => (m && m.date ? String(m.date) : "") }
  };
  function storeKeyOf(rk) {
    if (rk.indexOf("log:") === 0) return "logs";
    if (rk.indexOf("meas:") === 0) return "meas";
    return SPEC[rk] && SPEC[rk].kind === "whole" ? rk : null;
  }
  function shardsOf(sk, value) {
    const sp = SPEC[sk], out = {};
    if (sp.kind === "whole") { if (value !== undefined && value !== null) out[sk] = value; }
    else if (sp.kind === "map") { Object.keys(value || {}).forEach((id) => { out[sp.prefix + id] = value[id]; }); }
    else (Array.isArray(value) ? value : []).forEach((item) => { const id = sp.id(item); if (id) out[sp.prefix + id] = item; });
    return out;
  }

  /* ---------- учёт локальных изменений ---------- */
  const dirtyStore = new Set();
  let diffTimer = null;
  S.onChange((k) => {
    if (!SPEC[k] || !signedIn()) return;
    dirtyStore.add(k);
    clearTimeout(diffTimer);
    diffTimer = setTimeout(() => { flushDiff(); scheduleSync(2500); }, 400);
  });
  function flushDiff() {
    clearTimeout(diffTimer);
    if (!dirtyStore.size) return;
    const known = sys.get("known", {}), pending = sys.get("pending", {}), now = new Date().toISOString();
    dirtyStore.forEach((sk) => {
      const sh = shardsOf(sk, S.get(sk));
      Object.keys(sh).forEach((rk) => {
        const h = hash(JSON.stringify(sh[rk])), k = known[rk];
        if (!k || k.d || k.h !== h) { known[rk] = { h: h, u: now }; pending[rk] = 1; }
      });
      const sp = SPEC[sk];
      if (sp.kind !== "whole") Object.keys(known).forEach((rk) => {
        if (rk.indexOf(sp.prefix) === 0 && !(rk in sh) && !known[rk].d) { known[rk] = { h: "", u: now, d: true }; pending[rk] = 1; }
      });
    });
    dirtyStore.clear();
    sys.set("known", known); sys.set("pending", pending);
    emit();
  }
  /** При первом входе на устройстве: всё, что уже есть локально, ставим в очередь.
      Время — «старое», поэтому при совпадении записей побеждает то, что уже есть в базе. */
  function bootstrap() {
    const known = {}, pending = {};
    Object.keys(SPEC).forEach((sk) => {
      const sh = shardsOf(sk, S.get(sk));
      Object.keys(sh).forEach((rk) => { known[rk] = { h: hash(JSON.stringify(sh[rk])), u: BOOT_TIME }; pending[rk] = 1; });
    });
    sys.set("known", known); sys.set("pending", pending); sys.set("cursor", "0");
  }

  /* ---------- применение данных с сервера ---------- */
  function applyRows(rows) {
    const known = sys.get("known", {}), pending = sys.get("pending", {}), byStore = {};
    let overlayChanged = false;
    (rows || []).forEach((r) => {
      if (r.k.indexOf("srv:") === 0) {
        if (r.k === "srv:overlay") { sys.set("overlay", r.d ? undefined : r.v); overlayChanged = true; }
        return;
      }
      const sk = storeKeyOf(r.k);
      if (!sk) return;
      const loc = known[r.k];
      if (pending[r.k] && loc && loc.u > r.u) return; // локальная правка новее — уйдёт следующей отправкой
      const h = r.d ? "" : hash(JSON.stringify(r.v));
      if (loc && !pending[r.k] && loc.h === h && !!loc.d === !!r.d) { loc.u = r.u; return; }
      known[r.k] = r.d ? { h: "", u: r.u, d: true } : { h: h, u: r.u };
      delete pending[r.k];
      (byStore[sk] = byStore[sk] || []).push(r);
    });
    sys.set("known", known); sys.set("pending", pending);
    const updates = {};
    Object.keys(byStore).forEach((sk) => {
      const sp = SPEC[sk];
      let cur = S.get(sk);
      cur = cur === undefined ? (sp.kind === "list" ? [] : sp.kind === "map" ? {} : undefined) : JSON.parse(JSON.stringify(cur));
      byStore[sk].forEach((r) => {
        if (sp.kind === "whole") { if (!r.d) cur = r.v; }
        else if (sp.kind === "map") { const id = r.k.slice(sp.prefix.length); if (r.d) delete cur[id]; else cur[id] = r.v; }
        else { const id = r.k.slice(sp.prefix.length); cur = cur.filter((x) => sp.id(x) !== id); if (!r.d) cur.push(r.v); }
      });
      if (cur !== undefined) updates[sk] = cur;
    });
    if (Object.keys(updates).length) S.applyRemote(updates);
    if (overlayChanged) overlayHandlers.forEach((fn) => { try { fn(sys.get("overlay", null)); } catch (e) { console.error(e); } });
  }

  /* ---------- обмен с сервером ---------- */
  async function postSync(token, body) {
    try {
      return await fetch(apiBase() + "/sync", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token }, body: JSON.stringify(body), cache: "no-store" });
    } catch (e) {
      throw new SyncError("network", "Нет связи с сервером");
    }
  }
  async function doSync() {
    if (!signedIn() || !apiBase()) return;
    if (navigator.onLine === false) { setStatus("offline"); return; }
    flushDiff();
    setStatus("syncing");
    let token = await getJwt(false);
    for (let round = 0; round < 50; round++) {
      const known = sys.get("known", {}), pending = sys.get("pending", {}), cache = {};
      const keys = Object.keys(pending).slice(0, 300);
      const changes = [];
      let dropped = false;
      keys.forEach((rk) => {
        const k = known[rk], sk = storeKeyOf(rk);
        if (!k || !sk) { delete pending[rk]; dropped = true; return; }
        if (k.d) { changes.push({ k: rk, u: k.u, d: true }); return; }
        if (!cache[sk]) cache[sk] = shardsOf(sk, S.get(sk));
        const v = cache[sk][rk];
        changes.push(v === undefined ? { k: rk, u: k.u, d: true } : { k: rk, v: v, u: k.u });
      });
      if (dropped) sys.set("pending", pending);
      const body = { since: sys.get("cursor", "0"), changes: changes };
      let res = await postSync(token, body);
      if (res.status === 401) { token = await getJwt(true); res = await postSync(token, body); }
      let data = null;
      try { data = await res.json(); } catch (e) { /* пусто */ }
      if (res.status === 401) throw new SyncError("signedout", "Сессия истекла — войди заново", 401);
      if (res.status === 403) throw new SyncError("denied", (data && data.message) || "Нет доступа", 403);
      if (!res.ok || !data) throw new SyncError("server", (data && data.message) || "Ошибка сервера " + res.status, res.status);
      const kn = sys.get("known", {}), pend = sys.get("pending", {});
      changes.forEach((c) => { if (kn[c.k] && kn[c.k].u === c.u) delete pend[c.k]; });
      sys.set("pending", pend);
      applyRows(data.rows);
      sys.set("cursor", String(data.cursor || body.since));
      if (!data.more && !Object.keys(sys.get("pending", {})).length) break;
    }
    sys.set("lastSync", Date.now());
    setStatus("ok");
  }

  let running = null, timer = null;
  function syncNow() {
    if (running) return running;
    running = doSync().catch((e) => {
      const code = e instanceof SyncError ? e.code : "server";
      if (code === "signedout") { sys.set("jwt", undefined); setStatus("expired", { error: e.message }); }
      else if (code === "denied") setStatus("denied", { error: e.message });
      else if (code === "network") setStatus(navigator.onLine === false ? "offline" : "error", { error: e.message });
      else setStatus("error", { error: e.message });
    }).finally(() => { running = null; });
    return running;
  }
  function scheduleSync(ms) {
    if (!signedIn()) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, ms || 0);
  }

  /* ---------- статус ---------- */
  const listeners = [], overlayHandlers = [];
  let status = { state: "idle" };
  function setStatus(state, extra) {
    status = Object.assign({ state: state, pending: Object.keys(sys.get("pending", {})).length, last: sys.get("lastSync", 0) }, extra || {});
    listeners.forEach((fn) => { try { fn(status); } catch (e) { console.error(e); } });
  }
  function emit() { setStatus(status.state, status.error ? { error: status.error } : null); }

  /* ---------- вход ---------- */
  function signedIn() { return !!sys.get("user", null); }
  const Auth = {
    user() { return sys.get("user", null); },
    pendingEmail() { return sys.get("pendingEmail", ""); },
    async sendCode(email) {
      const e = String(email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new SyncError("input", "Проверь адрес почты");
      await authRequest("email-otp/send-verification-otp", { method: "POST", body: { email: e, type: "sign-in" } });
      sys.set("pendingEmail", e);
      emit();
    },
    async verifyCode(otp) {
      const email = sys.get("pendingEmail", "");
      const code = String(otp || "").replace(/\s+/g, "");
      if (!email) throw new SyncError("input", "Сначала запроси код");
      if (!/^\d{4,8}$/.test(code)) throw new SyncError("input", "Код — это цифры из письма");
      const d = await authRequest("sign-in/email-otp", { method: "POST", body: { email: email, otp: code } });
      let user = d && d.user;
      try { const s = await authRequest("get-session"); if (s && s.user) user = s.user; } catch (e) { /* хватит ответа входа */ }
      if (!user || !user.id) throw new SyncError("auth", "Не удалось войти — запроси код ещё раз");
      const prev = sys.get("user", null);
      sys.set("user", { id: user.id, email: user.email || email, name: user.name || "" });
      sys.set("pendingEmail", undefined);
      if (!prev || prev.id !== user.id) bootstrap();
      setStatus("idle");
      return syncNow();
    },
    cancelCode() { sys.set("pendingEmail", undefined); emit(); },
    async signOut() {
      try { if (navigator.onLine !== false) await syncNow(); } catch (e) { /* отправим, что успеем */ }
      try { await authRequest("sign-out", { method: "POST", body: {} }); } catch (e) { /* сессия и так закроется */ }
      ["jar", "jwt", "user", "overlay", "cursor", "known", "pending", "lastSync", "pendingEmail"].forEach((k) => sys.set(k, undefined));
      setStatus("idle");
      overlayHandlers.forEach((fn) => { try { fn(null); } catch (e) { console.error(e); } });
    }
  };

  /* ---------- триггеры ---------- */
  window.addEventListener("online", () => scheduleSync(500));
  window.addEventListener("offline", () => setStatus("offline"));
  document.addEventListener("visibilitychange", () => {
    if (!signedIn()) return;
    if (document.visibilityState === "hidden") { flushDiff(); if (Object.keys(sys.get("pending", {})).length) syncNow(); }
    else if (Date.now() - sys.get("lastSync", 0) > 60000) scheduleSync(300);
  });
  setInterval(() => { if (document.visibilityState === "visible") scheduleSync(0); }, 5 * 60 * 1000);

  window.Sync = {
    Auth: Auth,
    SyncError: SyncError,
    configured: () => !!apiBase(),
    signedIn: signedIn,
    status: () => status,
    onStatus(fn) { listeners.push(fn); },
    onOverlay(fn) { overlayHandlers.push(fn); },
    overlay: () => sys.get("overlay", null),
    syncNow: syncNow,
    start() { if (signedIn()) scheduleSync(600); },
    /** Наложить личные заметки на программу: [[путь], значение]. */
    applyOverlay(target, ov) {
      ((ov && ov.set) || []).forEach((pair) => {
        const path = pair[0], val = pair[1];
        if (!Array.isArray(path) || !path.length) return;
        let o = target;
        for (let i = 0; i < path.length - 1; i++) {
          if (o[path[i]] == null || typeof o[path[i]] !== "object") o[path[i]] = typeof path[i + 1] === "number" ? [] : {};
          o = o[path[i]];
        }
        o[path[path.length - 1]] = val;
      });
    }
  };
})();
