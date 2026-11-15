/* Несколько программ: записи, шаблоны, привязка текущей программы к window.PROGRAM, переключение, дни A–F.
   Встроенная «Апгрейд» — id "main": её правки в ключе "plan", её место в цикле — всегда ключ "cycle" (как в выпущенной версии).
   Свои программы — ключ "progs" = { [id]: запись }, синхронизируется картой "prog:<id>". Запись:
   { id, name, note?, base: null | "upgrade", days: ["A","B",…], wd, plan: { v:1, s:{…}, x:{…} }, created, at }.
   wd — дни недели (0 — вс): у своей — по буквам { A: 1, C: 4 } (нет ключа — «любой день», день — одной тренировке);
   у копии — как у встроенной: список дней, i-й день ↔ i-я тренировка.
   base null — своя (с нуля или из шаблона): один блок, недели подряд, тренировки 1A…1F, исходные пустые; всё — в plan.s.
   base "upgrade" — копия встроенной: блоки и исходные тренировки из src/data.js, поверх — свой plan.
   Место своей программы и копии в цикле — всегда в карте "progPos" = { [id]: { idx, since, hist } } (синхронизация "pos:<id>").
   Текущая программа — ключ "curprog" = { id } (нет ключа или "main" — встроенная); переход — одна запись curprog.
   Журнал своей программы — ключи "<дата>_<буква>@<id>", у встроенной — "<дата>_<буква>" (logKey / parseLogKey).
   Всё, что приходит из хранилища, с сервера или из файла, проходит sanitize: битая запись не привязывается и не показывается.
   Здесь только данные и операции — без DOM (покрыто dev/tests/programs_test.cjs). */
(function () {
  "use strict";
  const MAIN = "main";
  const MAX = 12, NAME_MAX = 40, NOTE_MAX = 300, MAX_DAYS = 6, LETTERS = "ABCDEF", HIST_KEEP = 10;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const UP_DAYS = ["A", "B", "C"];
  const ID_RE = /^p[0-9a-z]{8}$/;
  const isObj = (o) => !!o && typeof o === "object" && !Array.isArray(o);
  const BAD_KEY = { __proto__: null, ["__proto__"]: 1, constructor: 1, prototype: 1 };
  /** Копия объекта со всеми своими полями (незнакомые — для будущих версий — сохраняются), кроме опасных имён. */
  const safeCopy = (o) => { const out = {}; if (isObj(o)) Object.keys(o).forEach((k) => { if (!BAD_KEY[k]) out[k] = o[k]; }); return out; };

  /* ---- шаблоны: упражнения встроенной программы, связки одиночные, tier "core" ----
     [id, подходы, повторы, запас, отдых]; база — запас 2 и отдых 2 мин, изоляция — запас 1 и 60–90 с. */
  const B = "2 мин", I = "60–90 с";
  const TEMPLATES = [
    { id: "fullbody3", name: "Фулбоди · 3 дня", note: "Всё тело на каждой тренировке, 6 упражнений. Подходит, если тренируешься через день.", wd: [1, 3, 5],
      days: [
        { t: "Всё тело A", ex: [["legpress", 3, "8–12", "2", B], ["bench", 3, "6–10", "2", B], ["cable_row", 3, "8–12", "2", B], ["lat_raise_db", 3, "12–20", "1", I], ["pushdown", 2, "10–15", "1", I], ["rkc_plank", 2, "30–40 с", null, I]] },
        { t: "Всё тело B", ex: [["rdl", 3, "8–10", "2", B], ["seated_db_press", 3, "8–12", "2", B], ["pulldown", 3, "8–12", "2", B], ["incline_curl", 2, "10–15", "1", I], ["calf_stand", 3, "10–15", "1", I], ["deadbug", 2, "6", null, I]] },
        { t: "Всё тело C", ex: [["bss", 3, "8–12", "2", B], ["incline_db", 3, "8–12", "2", B], ["cs_row", 3, "8–12", "2", B], ["face_pull", 2, "15–20", "1", I], ["hammer_curl", 2, "10–12", "1", I], ["oh_ext_cable", 2, "10–15", "1", I]] }] },
    { id: "upperlower4", name: "Верх / низ · 4 дня", note: "Верх и низ по очереди: каждая мышца — дважды в неделю, 6–7 упражнений за тренировку.", wd: [1, 2, 4, 5],
      days: [
        { t: "Верх 1", ex: [["bench", 3, "6–10", "2", B], ["cs_row", 3, "8–12", "2", B], ["seated_db_press", 3, "8–12", "2", B], ["pulldown", 3, "8–12", "2", B], ["incline_curl", 3, "10–15", "1", I], ["pushdown", 3, "10–15", "1", I]] },
        { t: "Низ 1", ex: [["legpress", 3, "8–12", "2", B], ["rdl", 3, "8–10", "2", B], ["legext", 3, "12–15", "1", I], ["seated_curl", 3, "10–12", "1", I], ["calf_stand", 3, "10–15", "1", I], ["ab_wheel", 3, "8–12", "1", I]] },
        { t: "Верх 2", ex: [["incline_db", 3, "8–12", "2", B], ["pullup", 3, "6–10", "2", B], ["machine_press", 3, "10–12", "2", B], ["cable_row", 3, "10–12", "2", B], ["lat_raise_db", 3, "12–20", "1", I], ["hammer_curl", 2, "10–12", "1", I], ["oh_ext_cable", 2, "10–15", "1", I]] },
        { t: "Низ 2", ex: [["hack", 3, "8–12", "2", B], ["hipthrust", 3, "8–12", "2", B], ["bss", 2, "8–12", "2", B], ["seated_curl", 3, "10–15", "1", I], ["calf_seated", 3, "15–20", "1", I], ["pallof", 3, "10", null, I]] }] },
    { id: "ppl3", name: "Тяни — толкай — ноги · 3 дня", note: "Жимы, тяги и ноги в разные дни: каждая мышца раз в неделю, зато объёмно.", wd: [1, 3, 5],
      days: [
        { t: "Толкай", ex: [["bench", 3, "6–10", "2", B], ["incline_db", 3, "8–12", "2", B], ["seated_db_press", 3, "8–12", "2", B], ["lat_raise_db", 3, "12–20", "1", I], ["pushdown", 3, "10–15", "1", I], ["oh_ext_cable", 2, "10–15", "1", I]] },
        { t: "Тяни", ex: [["pullup", 3, "6–10", "2", B], ["cs_row", 3, "8–12", "2", B], ["pulldown", 3, "10–12", "2", B], ["face_pull", 3, "15–20", "1", I], ["incline_curl", 3, "10–15", "1", I], ["hammer_curl", 2, "10–12", "1", I]] },
        { t: "Ноги", ex: [["legpress", 3, "8–12", "2", B], ["rdl", 3, "8–10", "2", B], ["legext", 3, "12–15", "1", I], ["seated_curl", 3, "10–12", "1", I], ["calf_stand", 4, "10–15", "1", I], ["deadbug", 3, "6", null, I]] }] }
  ];
  /** Все id упражнений шаблонов — для проверки, что они есть в программе. */
  const templateExIds = () => Array.from(new Set([].concat(...TEMPLATES.map((t) => [].concat(...t.days.map((d) => d.ex.map((x) => x[0]))))))).sort();

  /* ---- записи ---- */
  function newId(rand) {
    const r = rand || Math.random;
    let s = "";
    while (s.length < 8) s += Math.floor(r() * 36).toString(36);
    return "p" + s;
  }
  const cleanName = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  const cleanNote = (s) => String(s == null ? "" : s).replace(/[ \t]+/g, " ").trim().slice(0, NOTE_MAX);
  const isCustom = (rec) => !!rec && rec.base == null;
  /** "main" — встроенная, "copy" — копия встроенной, "custom" — своя. */
  const kind = (rec) => (!rec || rec.id === MAIN ? "main" : rec.base === "upgrade" ? "copy" : "custom");
  /** Тренировки программы по алфавиту (буквы — постоянные идентификаторы, без перенумерации). */
  function daysOf(rec) {
    if (!isCustom(rec)) return UP_DAYS.slice();
    const d = (Array.isArray(rec.days) ? rec.days : []).filter((x) => LETTERS.includes(x) && x.length === 1);
    return Array.from(new Set(d)).sort();
  }
  /** Дни недели по умолчанию (0 — вс): равномерно по неделе. */
  function defaultWd(n) { return [[1], [1, 4], [1, 3, 5], [1, 2, 4, 5], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6]][Math.max(1, Math.min(MAX_DAYS, n)) - 1].slice(); }
  const normPlan = (p) => ({ v: 1, s: p && typeof p.s === "object" && p.s ? clone(p.s) : {}, x: p && typeof p.x === "object" && p.x ? clone(p.x) : {} });
  function blank(o) {
    const n = Math.max(1, Math.min(MAX_DAYS, Math.round(+o.n) || 3)), now = o.now || new Date().toISOString();
    const days = LETTERS.slice(0, n).split("");
    return { id: o.id || newId(), name: cleanName(o.name) || "Моя программа", base: null, days, wd: wdMap(days, defaultWd(n)), plan: { v: 1, s: {}, x: {} }, created: now, at: now };
  }
  function fromTemplate(tpl, o) {
    const now = o.now || new Date().toISOString(), s = {};
    tpl.days.forEach((d, i) => {
      const L = LETTERS[i];
      const g = d.ex.map((x, gi) => ({ id: "U" + (gi + 1), kind: "single", tier: "core", rest: x[4], items: [{ ex: x[0], sets: x[1], reps: x[2], rir: x[3] }] }));
      s["1" + L] = { g, t: d.t, at: now, ver: o.version || "" };
    });
    const days = LETTERS.slice(0, tpl.days.length).split("");
    const rec = { id: o.id || newId(), name: cleanName(o.name) || tpl.name, base: null, days, wd: wdMap(days, tpl.wd), plan: { v: 1, s, x: {} }, created: now, at: now };
    const note = cleanNote(o.note != null ? o.note : tpl.note); if (note) rec.note = note;
    return rec;
  }
  /** Копия программы. src — запись или { id: "main", name, plan, wd } для встроенной. */
  function copyOf(src, o) {
    const now = o.now || new Date().toISOString();
    const rec = { id: o.id || newId(), name: cleanName(o.name) || cleanName(`${src.name || "Апгрейд"} (копия)`), base: src.id === MAIN ? "upgrade" : src.base == null ? null : "upgrade",
      days: src.id === MAIN ? UP_DAYS.slice() : daysOf(src), wd: src.id !== MAIN && src.base == null ? cleanWdMap(src.wd, daysOf(src)) : Array.isArray(src.wd) ? src.wd.slice() : [],
      plan: normPlan(src.plan), created: now, at: now };
    if (src.note) rec.note = cleanNote(src.note);
    return rec;
  }
  const count = (progs) => Object.keys(progs || {}).filter((k) => progs[k] && typeof progs[k] === "object").length;
  function add(progs, rec) {
    if (count(progs) >= MAX) return { error: `Не больше ${MAX} своих программ — удали лишнюю.` };
    const out = Object.assign({}, progs); out[rec.id] = rec;
    return { progs: out, rec };
  }
  function remove(progs, id, curId) {
    if (id === MAIN) return { error: "Встроенную программу удалить нельзя." };
    if (id === (curId || MAIN)) return { error: "Это текущая программа — сначала перейди на другую." };
    if (!progs || !progs[id]) return { error: "Программы уже нет." };
    const out = Object.assign({}, progs); delete out[id];
    return { progs: out, removed: progs[id] };
  }
  function patch(rec, fields, now) { return Object.assign({}, rec, fields, { at: now || new Date().toISOString() }); }

  /* ---- проверка данных: из хранилища, с сервера, из файла ---- */
  const STRENGTH = { pair: 1, tri: 1, circuit: 1, single: 1, giant: 1 }, FIXED = { warmup: 1, sprint: 1, n4x4: 1, z2: 1, skill: 1 };
  const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
  /** Связка тренировки: силовая — с пунктами-упражнениями (подходы 1–10), фиксированная — как есть; прочее — null. */
  function cleanGroup(g, i) {
    if (!isObj(g) || typeof g.kind !== "string") return null;
    const out = Object.assign(safeCopy(g), { id: str(g.id, 12) || "U" + (i + 1) });
    if (STRENGTH[g.kind]) {
      if (!Array.isArray(g.items)) return null;
      const cleanIt = (it) => { const o = safeCopy(it); if (o.sets != null) o.sets = Math.max(1, Math.min(10, Math.round(+o.sets) || 1)); ["reps", "rir", "note", "tempo"].forEach((k) => { if (o[k] != null && typeof o[k] !== "string") o[k] = String(o[k]).slice(0, 40); }); return o; };
      out.items = g.items.filter((it) => isObj(it) && (typeof it.ex === "string" || (Array.isArray(it.weekAlt) && it.weekAlt.every((w) => isObj(w) && typeof w.ex === "string")))).map(cleanIt);
      if (!["core", "std", "max"].includes(out.tier)) out.tier = "core";
      if (out.rest != null && typeof out.rest !== "string") delete out.rest;
      return out;
    }
    if (!FIXED[g.kind]) return null;
    if (out.items != null && !Array.isArray(out.items)) delete out.items;
    if (g.kind === "warmup" && !Array.isArray(out.items)) out.items = [];
    return out;
  }
  /** Правки программы (формат PlanModel): s[1A…9F].g — массив связок, иначе запись тренировки отбрасывается; x — упражнения из базы. */
  function cleanPlan(p) {
    const out = Object.assign(safeCopy(p), { v: 1, s: {}, x: {} });
    if (!isObj(p)) return out;
    if (isObj(p.s)) Object.keys(p.s).forEach((k) => {
      const f = p.s[k];
      if (!/^[1-9][A-F]$/.test(k) || !isObj(f) || !Array.isArray(f.g)) return;
      const e = Object.assign(safeCopy(f), { g: f.g.map(cleanGroup).filter(Boolean) });
      if (e.t != null) { const tt = str(e.t, 60); if (tt) e.t = tt; else delete e.t; }
      if (e.to != null && typeof e.to !== "string") delete e.to;
      out.s[k] = e;
    });
    if (isObj(p.x)) Object.keys(p.x).forEach((id) => {
      const x = p.x[id];
      if (!/^ds_\d{1,6}$/.test(id) || !isObj(x) || typeof x.n !== "string") return;
      const m = isObj(x.m) ? x.m : {};
      out.x[id] = Object.assign(safeCopy(x), { m: { p: Array.isArray(m.p) ? m.p.filter((v) => typeof v === "string") : [], s: Array.isArray(m.s) ? m.s.filter((v) => typeof v === "string") : [] } });
    });
    return out;
  }
  /** Запись программы — исправленная копия или null (не привязывать и не показывать). */
  function sanitize(id, rec) {
    if (!ID_RE.test(String(id)) || !isObj(rec)) return null;
    const base = rec.base === "upgrade" ? "upgrade" : null;
    let days = UP_DAYS.slice();
    if (!base) {
      days = Array.from(new Set((Array.isArray(rec.days) ? rec.days : []).filter((x) => typeof x === "string" && x.length === 1 && LETTERS.includes(x)))).sort();
      if (!days.length) days = ["A"];
    }
    const wd = base ? (Array.isArray(rec.wd) ? normWd(rec.wd.filter((x) => (typeof x === "number" || (typeof x === "string" && /^\d$/.test(x))) && Number.isInteger(+x)), days.length) : []) : cleanWdMap(rec.wd, days);
    // известные поля исправляются, незнакомые (поля будущих версий) остаются как были — старая сборка их не теряет при перезаписи
    const out = Object.assign(safeCopy(rec), { id, name: cleanName(typeof rec.name === "string" ? rec.name : "") || "Программа", base, days, wd, plan: cleanPlan(rec.plan),
      created: str(rec.created, 40) || str(rec.at, 40), at: str(rec.at, 40) });
    const note = typeof rec.note === "string" ? cleanNote(rec.note) : "";
    if (note) out.note = note; else delete out.note;
    return out;
  }
  /** Все записи из ключа progs: только годные (по id и содержимому). */
  function sanitizeAll(progs) {
    const out = {};
    if (!isObj(progs)) return out;
    Object.keys(progs).forEach((id) => { const r = sanitize(id, progs[id]); if (r) out[id] = r; });
    return out;
  }
  /** Место в цикле: { idx ≥ 0, since: дата | null, hist: [] } или null. */
  function cleanPos(v) {
    if (!isObj(v)) return null;
    const idx = Math.round(+v.idx);
    if (!Number.isFinite(idx) || idx < 0 || idx > 10000) return null;
    return { idx, since: typeof v.since === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.since) ? v.since : null, hist: Array.isArray(v.hist) ? v.hist.filter(isObj) : [] };
  }
  function cleanPosAll(m) {
    const out = {};
    if (!isObj(m)) return out;
    Object.keys(m).forEach((id) => { const p = ID_RE.test(id) && cleanPos(m[id]); if (p) out[id] = p; });
    return out;
  }
  /** id текущей программы из ключа curprog: "main" или id вида p + 8 знаков. */
  const curOf = (cp) => (isObj(cp) && typeof cp.id === "string" && ID_RE.test(cp.id) ? cp.id : MAIN);

  /* ---- журнал: ключи записей ---- */
  /** Ключ записи тренировки: у встроенной — "<дата>_<буква>", у своей — "<дата>_<буква>@<id>". */
  const logKey = (date, day, prog) => (prog && prog !== MAIN ? `${date}_${day}@${prog}` : `${date}_${day}`);
  /** { date, day, prog } из ключа записи журнала. */
  function parseLogKey(k) {
    const s = String(k), rest = s.slice(11), at = rest.indexOf("@");
    return { date: s.slice(0, 10), day: at < 0 ? rest : rest.slice(0, at), prog: at < 0 ? MAIN : rest.slice(at + 1) };
  }

  /* ---- тренировки своей программы ---- */
  /** Добавить тренировку: первая свободная буква, по которой нет записей этой недели (busy — такие буквы); иначе первая свободная. */
  function addDay(rec, now, busy) {
    const d = daysOf(rec);
    if (!isCustom(rec)) return { error: "В копии «Апгрейда» тренировки A, B, C." };
    if (d.length >= MAX_DAYS) return { error: `Не больше ${MAX_DAYS} тренировок в неделю.` };
    const free = LETTERS.split("").filter((x) => !d.includes(x)), b = busy || [];
    const L = free.find((x) => !b.includes(x)) || free[0];
    return { rec: patch(rec, { days: d.concat(L).sort() }, now), d: L };
  }
  /** Удалить тренировку L: её правки и её день недели (у остальных расписание не сдвигается).
      removed — что вернуть отменой: { d, s: запись plan.s или null, wd: день недели или null }. */
  function removeDay(rec, L, now) {
    const d = daysOf(rec);
    if (!isCustom(rec)) return { error: "В копии «Апгрейда» тренировки не удаляются." };
    if (!d.includes(L)) return { error: "Такой тренировки нет." };
    if (d.length <= 1) return { error: "Это последняя тренировка — её удалить нельзя." };
    const days = d.filter((x) => x !== L), plan = normPlan(rec.plan), i = d.indexOf(L);
    const s = plan.s["1" + L] || null;
    delete plan.s["1" + L];
    // дни недели — по буквам: у остальных тренировок не меняются
    const wd = cleanWdMap(rec.wd, d), wdL = wd[L] != null ? wd[L] : null;
    delete wd[L];
    return { rec: patch(rec, { days, plan, wd }, now), removed: { d: L, s: s ? clone(s) : null, wd: wdL } };
  }
  /** Вернуть удалённую тренировку (отмена): буква, содержимое и название, день недели. */
  function restoreDay(rec, removed, now) {
    if (!isCustom(rec) || !removed) return { error: "Нечего возвращать." };
    const d = daysOf(rec);
    if (d.includes(removed.d)) return { error: "Такая буква уже занята." };
    if (d.length >= MAX_DAYS) return { error: `Не больше ${MAX_DAYS} тренировок в неделю.` };
    const days = d.concat(removed.d).sort(), plan = normPlan(rec.plan);
    if (removed.s) plan.s["1" + removed.d] = clone(removed.s);
    const wd = cleanWdMap(rec.wd, d);
    // свой день возвращается, если его пока никто не занял
    if (removed.wd != null && !Object.values(wd).includes(removed.wd)) wd[removed.d] = removed.wd;
    return { rec: patch(rec, { days, plan, wd }, now) };
  }
  /** Расписание: дней недели не больше, чем тренировок; по порядку недели (с понедельника). */
  const monFirst = (x) => (x + 6) % 7;
  /** Дни своей программы по буквам: { A: 1, C: 4 } — только буквы программы, день 0–6, один день — одной тренировке. */
  function cleanWdMap(wd, days) {
    const out = {}, used = new Set();
    if (!isObj(wd)) return out;
    days.forEach((L) => { const v = wd[L]; if ((typeof v === "number" || (typeof v === "string" && /^\d$/.test(v))) && Number.isInteger(+v) && +v >= 0 && +v <= 6 && !used.has(+v)) { out[L] = +v; used.add(+v); } });
    return out;
  }
  /** Список дней (с понедельника) → по буквам: i-й день ↔ i-я тренировка. */
  function wdMap(days, list) { const out = {}; normWd(list, days.length).forEach((v, i) => { out[days[i]] = v; }); return out; }
  /** Назначить тренировке L день недели wd (null — «любой день»); прежняя тренировка этого дня остаётся без дня. */
  function setWd(rec, L, wd, now) {
    if (!isCustom(rec) || !daysOf(rec).includes(L)) return { error: "Такой тренировки нет." };
    const m = cleanWdMap(rec.wd, daysOf(rec));
    Object.keys(m).forEach((k) => { if (m[k] === wd) delete m[k]; });
    if (wd == null) delete m[L]; else m[L] = wd;
    return { rec: patch(rec, { wd: m }, now) };
  }
  function normWd(wd, n) {
    const out = Array.from(new Set((wd || []).map(Number).filter((x) => x >= 0 && x <= 6)));
    return out.sort((a, b) => monFirst(a) - monFirst(b)).slice(0, n);
  }

  /* ---- место в цикле ---- */
  /** Позиция недели idx: своя — недели подряд; встроенная и копия — блоки по blockWeeks. */
  function posOf(k, idx, meta, nBlocks) {
    if (k === "custom") return { idx, cycle: 1, block: 1, week: idx + 1, n: idx + 1 };
    const bw = meta.blockWeeks, W = nBlocks * bw, i = ((idx % W) + W) % W;
    return { idx, cycle: Math.floor(idx / W) + 1, block: Math.floor(i / bw) + 1, week: (i % bw) + 1, n: i + 1 };
  }
  /** Текущая программа: id из curprog, если запись есть (или "main"); missing — id есть, а записи нет. */
  function current(curprog, progs) {
    const id = curOf(curprog);
    if (id === MAIN) return { id: MAIN, rec: null, missing: false };
    const rec = progs && progs[id];
    return rec ? { id, rec, missing: false } : { id: MAIN, rec: null, missing: true, want: id };
  }

  /* ---- привязка к window.PROGRAM ---- */
  /** Исходные тренировки программы: копия — встроенные; своя — пустые «Тренировка A». */
  function sessionsFor(rec, builtin) {
    if (!isCustom(rec)) return builtin.sessions;
    const out = {};
    daysOf(rec).forEach((L) => { out["1" + L] = { title: "Тренировка " + L, groups: [] }; });
    return out;
  }
  /** Подменить в P meta/blocks/sessions на данные программы rec (null — встроенная). exercises/muscles/content/sources — общие. */
  function bind(P, builtin, rec) {
    if (!rec) { P.meta = builtin.meta; P.blocks = builtin.blocks; P.sessions = builtin.sessions; return P; }
    if (!isCustom(rec)) {
      P.meta = Object.assign({}, builtin.meta, { name: rec.name });
      P.blocks = builtin.blocks; P.sessions = builtin.sessions;
      return P;
    }
    P.meta = Object.assign({}, builtin.meta, { name: rec.name, blocks: 1, blockWeeks: null });
    P.blocks = [{ id: 1, name: rec.name, weeks: "", theme: rec.note || "", skill: null, targets: [] }];
    P.sessions = sessionsFor(rec, builtin);
    return P;
  }
  /** Упражнения из базы (plan.x) всех программ — в P.exercises, чтобы журнал, избранное и недавние не теряли названия. */
  function injectX(exercises, plans) {
    (plans || []).forEach((p) => {
      const x = p && p.x; if (!x || typeof x !== "object") return;
      Object.keys(x).forEach((id) => { if (x[id] && (!exercises[id] || exercises[id].src === "ds")) exercises[id] = x[id]; });
    });
    return exercises;
  }

  window.Programs = { MAIN, MAX, NAME_MAX, NOTE_MAX, MAX_DAYS, LETTERS, ID_RE, TEMPLATES, templateExIds, newId, cleanName, cleanNote, isCustom, kind, daysOf, defaultWd,
    blank, fromTemplate, copyOf, count, add, remove, patch, addDay, removeDay, restoreDay, normWd, cleanWdMap, setWd, posOf, current, curOf, sessionsFor, bind, injectX,
    sanitize, sanitizeAll, cleanPlan, cleanPos, cleanPosAll, logKey, parseLogKey };
})();
