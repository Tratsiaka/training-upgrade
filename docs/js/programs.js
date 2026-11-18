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
     [id, подходы, повторы, запас, отдых, шаги?]; база — запас 2 и отдых 2 мин, изоляция — запас 1 и 60–90 с.
     шаги — цикл нагрузки: [[подходы, повторы, запас | null, % от максимума | null], …]; схема пункта = шаг 1.
     grp — раздел в шторке «Шаблоны»: simple, rot (с чередованием, поле rot), cyc (с циклом нагрузки). */
  const B = "2 мин", I = "60–90 с", H = "3 мин";
  /* Жимовой цикл: три дня по 8 шагов, шаги идут вместе (по выполнению — каждую неделю все три дня), 8-й — общая разгрузка.
     Тяжёлый — линейно к пику 92,5 % на 7-м шаге; средний — волна из 4 шагов дважды (пик 80 % на 4-м, на 7-м — только 77,5 %),
     лёгкий — волна 60–65 %. Пики тяжёлого и среднего не совпадают. */
  const BENCH8 = [[4, "6", null, 70], [4, "5", null, 75], [4, "4", null, 80], [3, "4", null, 82.5], [3, "3", null, 85], [3, "3", null, 87.5], [2, "2", null, 92.5], [3, "5", null, 60]];
  const BENCH_MID = [[4, "5", null, 72.5], [4, "4", null, 75], [3, "4", null, 77.5], [3, "3", null, 80], [4, "5", null, 72.5], [4, "4", null, 75], [3, "4", null, 77.5], [3, "5", null, 60]];
  const BENCH_LIGHT = [[4, "8", null, 60], [4, "7", null, 62.5], [4, "6", null, 65], [4, "8", null, 60], [4, "8", null, 60], [4, "7", null, 62.5], [4, "6", null, 65], [3, "5", null, 60]];
  const SBD6 = [[5, "5", null, 70], [5, "4", null, 75], [4, "4", null, 80], [4, "3", null, 85], [3, "2", null, 90], [3, "5", null, 60]];
  const TEMPLATES = [
    { id: "fullbody2", grp: "simple", name: "Всё тело · 2 дня", note: "Две тренировки на всё тело, по 6 упражнений. Для тех, у кого на зал два дня в неделю.", wd: [1, 4],
      days: [
        { t: "Всё тело A", ex: [["legpress", 3, "8–12", "2", B], ["bench", 3, "6–10", "2", B], ["cs_row", 3, "8–12", "2", B], ["lat_raise_db", 3, "12–20", "1", I], ["incline_curl", 2, "10–15", "1", I], ["calf_stand", 3, "10–15", "1", I]] },
        { t: "Всё тело B", ex: [["rdl", 3, "8–10", "2", B], ["seated_db_press", 3, "8–12", "2", B], ["pulldown", 3, "8–12", "2", B], ["bss", 2, "8–12", "2", B], ["pushdown", 2, "10–15", "1", I], ["ab_wheel", 2, "8–12", "1", I]] }] },
    { id: "fullbody3", grp: "simple", name: "Фулбоди · 3 дня", note: "Всё тело на каждой тренировке, 6 упражнений. Подходит, если тренируешься через день.", wd: [1, 3, 5],
      days: [
        { t: "Всё тело A", ex: [["legpress", 3, "8–12", "2", B], ["bench", 3, "6–10", "2", B], ["cable_row", 3, "8–12", "2", B], ["lat_raise_db", 3, "12–20", "1", I], ["pushdown", 2, "10–15", "1", I], ["rkc_plank", 2, "30–40 с", null, I]] },
        { t: "Всё тело B", ex: [["rdl", 3, "8–10", "2", B], ["seated_db_press", 3, "8–12", "2", B], ["pulldown", 3, "8–12", "2", B], ["incline_curl", 2, "10–15", "1", I], ["calf_stand", 3, "10–15", "1", I], ["deadbug", 2, "6", null, I]] },
        { t: "Всё тело C", ex: [["bss", 3, "8–12", "2", B], ["incline_db", 3, "8–12", "2", B], ["cs_row", 3, "8–12", "2", B], ["face_pull", 2, "15–20", "1", I], ["hammer_curl", 2, "10–12", "1", I], ["oh_ext_cable", 2, "10–15", "1", I]] }] },
    { id: "upperlower4", grp: "simple", name: "Верх / низ · 4 дня", note: "Верх и низ по очереди: каждая мышца — дважды в неделю, 6–7 упражнений за тренировку.", wd: [1, 2, 4, 5],
      days: [
        { t: "Верх 1", ex: [["bench", 3, "6–10", "2", B], ["cs_row", 3, "8–12", "2", B], ["seated_db_press", 3, "8–12", "2", B], ["pulldown", 3, "8–12", "2", B], ["incline_curl", 3, "10–15", "1", I], ["pushdown", 3, "10–15", "1", I]] },
        { t: "Низ 1", ex: [["legpress", 3, "8–12", "2", B], ["rdl", 3, "8–10", "2", B], ["legext", 3, "12–15", "1", I], ["seated_curl", 3, "10–12", "1", I], ["calf_stand", 3, "10–15", "1", I], ["ab_wheel", 3, "8–12", "1", I]] },
        { t: "Верх 2", ex: [["incline_db", 3, "8–12", "2", B], ["pullup", 3, "6–10", "2", B], ["machine_press", 3, "10–12", "2", B], ["cable_row", 3, "10–12", "2", B], ["lat_raise_db", 3, "12–20", "1", I], ["hammer_curl", 2, "10–12", "1", I], ["oh_ext_cable", 2, "10–15", "1", I]] },
        { t: "Низ 2", ex: [["hack", 3, "8–12", "2", B], ["hipthrust", 3, "8–12", "2", B], ["bss", 2, "8–12", "2", B], ["seated_curl", 3, "10–15", "1", I], ["calf_seated", 3, "15–20", "1", I], ["pallof", 3, "10", null, I]] }] },
    { id: "ppl3", grp: "simple", name: "Тяни — толкай — ноги · 3 дня", note: "Жимы, тяги и ноги в разные дни: каждая мышца раз в неделю, зато объёмно.", wd: [1, 3, 5],
      days: [
        { t: "Толкай", ex: [["bench", 3, "6–10", "2", B], ["incline_db", 3, "8–12", "2", B], ["seated_db_press", 3, "8–12", "2", B], ["lat_raise_db", 3, "12–20", "1", I], ["pushdown", 3, "10–15", "1", I], ["oh_ext_cable", 2, "10–15", "1", I]] },
        { t: "Тяни", ex: [["pullup", 3, "6–10", "2", B], ["cs_row", 3, "8–12", "2", B], ["pulldown", 3, "10–12", "2", B], ["face_pull", 3, "15–20", "1", I], ["incline_curl", 3, "10–15", "1", I], ["hammer_curl", 2, "10–12", "1", I]] },
        { t: "Ноги", ex: [["legpress", 3, "8–12", "2", B], ["rdl", 3, "8–10", "2", B], ["legext", 3, "12–15", "1", I], ["seated_curl", 3, "10–12", "1", I], ["calf_stand", 4, "10–15", "1", I], ["deadbug", 3, "6", null, I]] }] },
    { id: "heavylight4", grp: "rot", name: "Тяжёлая и лёгкая · 2 в неделю", rot: { pw: 2, wd: [1, 4] },
      note: "Две тренировки в неделю по очереди: неделя тяжёлых верха и низа, потом неделя лёгких. Каждая тренировка — раз в две недели, главные движения (жим лёжа и присед) — каждую неделю, в тяжёлом или лёгком варианте.",
      days: [
        { t: "Тяжёлый верх", ex: [["bench", 4, "4–6", "1–2", H], ["bb_row", 4, "5–8", "1–2", H], ["pullup_w", 3, "5–8", "2", B], ["seated_db_press", 3, "6–8", "2", B], ["ez_curl", 2, "8–10", "1", I], ["pushdown", 2, "8–10", "1", I]] },
        { t: "Тяжёлый низ", ex: [["squat", 4, "4–6", "2", H], ["rdl", 3, "6–8", "2", H], ["legpress", 3, "8–10", "2", B], ["seated_curl", 3, "8–10", "1", I], ["calf_stand", 3, "8–12", "1", I], ["ab_wheel", 3, "8–12", "1", I]] },
        { t: "Лёгкий верх", ex: [["bench", 3, "10–12", "3", B], ["cable_row", 3, "10–12", "2", B], ["pulldown", 3, "10–15", "2", B], ["lat_raise_db", 3, "12–20", "1", I], ["incline_curl", 3, "10–15", "1", I], ["oh_ext_cable", 3, "10–15", "1", I]] },
        { t: "Лёгкий низ", ex: [["squat", 3, "10–12", "3", B], ["hipthrust", 3, "10–12", "2", B], ["bss", 2, "10–12", "2", B], ["legext", 3, "12–15", "1", I], ["calf_seated", 3, "15–20", "1", I], ["pallof", 3, "10", null, I]] }] },
    { id: "ulsv4", grp: "simple", name: "Верх / низ: сила и объём · 4 дня", wd: [1, 2, 4, 5],
      note: "Силовые верх и низ в начале недели — базовые движения на 4–8 повторов; объёмные в конце — другие упражнения на 8–15.",
      days: [
        { t: "Силовой верх", ex: [["bench", 4, "4–6", "2", H], ["bb_row", 4, "5–8", "2", B], ["ohp", 3, "5–8", "2", B], ["pullup_w", 3, "5–8", "2", B], ["ez_curl", 2, "8–10", "1", I], ["pushdown", 2, "8–10", "1", I]] },
        { t: "Силовой низ", ex: [["squat", 4, "4–6", "2", H], ["deadlift", 3, "4–6", "2", H], ["legpress", 3, "8–10", "2", B], ["seated_curl", 3, "8–10", "1", I], ["calf_stand", 4, "8–12", "1", I], ["ab_wheel", 3, "8–12", "1", I]] },
        { t: "Объёмный верх", ex: [["incline_db", 3, "8–12", "2", B], ["cs_row", 3, "10–12", "2", B], ["machine_press", 3, "10–15", "2", B], ["pulldown", 3, "10–15", "2", B], ["lat_raise_db", 4, "12–20", "1", I], ["incline_curl", 3, "10–15", "1", I], ["oh_ext_cable", 3, "10–15", "1", I]] },
        { t: "Объёмный низ", ex: [["hack", 3, "10–15", "2", B], ["rdl", 3, "10–12", "2", B], ["bss", 3, "10–12", "2", B], ["legext", 3, "12–15", "1", I], ["seated_curl", 3, "12–15", "1", I], ["calf_seated", 3, "15–20", "1", I]] }] },
    { id: "bench3", grp: "cyc", name: "Жимовой цикл · 3 дня", wd: [1, 3, 5],
      note: "Жим лёжа в каждой тренировке, у всех трёх — цикл из 8 шагов с общей разгрузкой на 8-м. Тяжёлая — от 70 % на 6 к 92,5 % на 2, средняя — волна 72,5–80 %, лёгкая — 60–65 %. Проценты — от максимума; его указываешь сам.",
      days: [
        { t: "Тяжёлый жим", ex: [["bench", 4, "6", null, H, BENCH8], ["pullup_w", 4, "6–8", "2", B], ["oh_ext_cable", 3, "10–12", "1", I], ["lat_raise_db", 3, "12–20", "1", I], ["face_pull", 2, "15–20", "1", I]] },
        { t: "Лёгкий жим", ex: [["bench", 4, "8", null, B, BENCH_LIGHT], ["cable_row", 3, "10–12", "2", B], ["legpress", 3, "8–12", "2", B], ["seated_curl", 3, "10–12", "1", I], ["pushdown", 3, "10–15", "1", I], ["incline_curl", 2, "10–15", "1", I]] },
        { t: "Средний жим", ex: [["bench", 4, "5", null, H, BENCH_MID], ["pulldown", 4, "8–12", "2", B], ["seated_db_press", 3, "8–12", "2", B], ["pushdown", 3, "10–15", "1", I], ["rev_pecdeck", 3, "15–20", "1", I], ["hammer_curl", 2, "10–12", "1", I]] }] },
    { id: "sbd3", grp: "cyc", name: "Силовой цикл · присед, жим, тяга · 3 дня", wd: [1, 3, 5],
      note: "Одно главное движение в день, цикл из 6 шагов: 5×5 на 70 % → 3×2 на 90 % и разгрузочный шаг. Плюс 4 подсобных упражнения. Проценты — от максимума; его указываешь сам.",
      days: [
        { t: "Присед", ex: [["squat", 5, "5", null, H, SBD6], ["legpress", 3, "8–12", "2", B], ["seated_curl", 3, "10–12", "1", I], ["calf_stand", 3, "10–15", "1", I], ["ab_wheel", 3, "8–12", "1", I]] },
        { t: "Жим", ex: [["bench", 5, "5", null, H, SBD6], ["ohp", 3, "6–8", "2", B], ["cs_row", 3, "8–12", "2", B], ["pushdown", 3, "10–15", "1", I], ["lat_raise_db", 3, "12–20", "1", I]] },
        { t: "Тяга", ex: [["deadlift", 5, "5", null, H, SBD6], ["pullup_w", 3, "5–8", "2", B], ["hipthrust", 3, "8–12", "2", B], ["incline_curl", 3, "10–15", "1", I], ["side_plank", 2, "30–45 с", null, I]] }] }
  ];
  /** Шаги цикла из шаблона: [[подходы, повторы, запас, %], …] → [{ sets, reps, rir?, pct? }]. */
  const tplCyc = (x) => (Array.isArray(x) ? x.map(([sets, reps, rir, pct]) => Object.assign({ sets, reps }, rir != null ? { rir } : {}, pct != null ? { pct } : {})) : null);
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
    const rec = { id: o.id || newId(), name: cleanName(o.name) || "Моя программа", base: null, days, wd: wdMap(days, defaultWd(n)), plan: { v: 1, s: {}, x: {} }, created: now, at: now };
    const pw = Math.round(+o.pw);
    if (pw >= 1 && pw < n) rec.rot = { pw, wd: defaultWd(pw) };
    return rec;
  }
  function fromTemplate(tpl, o) {
    const now = o.now || new Date().toISOString(), s = {};
    tpl.days.forEach((d, i) => {
      const L = LETTERS[i];
      const g = d.ex.map((x, gi) => {
        const it = { ex: x[0], sets: x[1], reps: x[2], rir: x[3] }, c = tplCyc(x[5]);
        if (c) { it.cyc = c; it.sets = c[0].sets; it.reps = c[0].reps; it.rir = c[0].rir != null ? c[0].rir : null; }
        return { id: "U" + (gi + 1), kind: "single", tier: "core", rest: x[4], items: [it] };
      });
      s["1" + L] = { g, t: d.t, at: now, ver: o.version || "" };
    });
    const days = LETTERS.slice(0, tpl.days.length).split("");
    // при чередовании дни недели — у мест в неделе (rot.wd), по буквам — как у «все каждую неделю»
    const rec = { id: o.id || newId(), name: cleanName(o.name) || tpl.name, base: null, days, wd: wdMap(days, tpl.rot ? defaultWd(days.length) : tpl.wd), plan: { v: 1, s, x: {} }, created: now, at: now };
    if (tpl.rot) rec.rot = { pw: tpl.rot.pw, wd: normWd(tpl.rot.wd, tpl.rot.pw) };
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
    if (src.id !== MAIN && src.base == null) { const r = rotOf(src), tm = cleanTm(src.tm); if (r) rec.rot = Object.assign(r, { o: daysOf(src)[0] }); if (tm) rec.tm = tm; } // копия начинает с недели 1
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
      const cleanIt = (it) => {
        const o = safeCopy(it); if (o.sets != null) o.sets = Math.max(1, Math.min(10, Math.round(+o.sets) || 1)); ["reps", "rir", "note", "tempo"].forEach((k) => { if (o[k] != null && typeof o[k] !== "string") o[k] = String(o[k]).slice(0, 40); });
        if (o.cyc != null) { const c = cleanCyc(o.cyc); if (c && !o.hl && !o.weekAlt) o.cyc = c; else delete o.cyc; }
        return o;
      };
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
    // чередование (своя программа, pw 1 … n−1) и максимумы для процентов цикла нагрузки
    const rot = base ? null : rotOf(out); if (rot) out.rot = rot; else delete out.rot;
    if (!base && Number.isInteger(rec.qa) && rec.qa >= 0 && rec.qa <= 10000) out.qa = rec.qa; else delete out.qa;
    const tm = cleanTm(rec.tm); if (tm) out.tm = tm; else delete out.tm;
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
    // чередование: тренировок стало столько же, сколько «в неделю», — чередование выключается (все каждую неделю)
    const r = rotOf(rec), out = patch(rec, { days, plan, wd }, now);
    if (r && r.pw >= days.length) delete out.rot;
    return { rec: out, removed: { d: L, s: s ? clone(s) : null, wd: wdL, rot: r ? clone(r) : null } };
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
    const out = patch(rec, { days, plan, wd }, now);
    if (removed.rot && removed.rot.pw < days.length) out.rot = clone(removed.rot);
    return { rec: out };
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

  /* ---- чередование: тренировок в неделю (pw) меньше, чем тренировок в программе (n) ----
     rec.rot = { pw, wd, o }: очередь — буквы по алфавиту по кругу; wd — дни недели мест в неделе (с понедельника): j-й день ↔ j-я
     тренировка недели; rec.wd (по буквам) не трогаем. Правила (pw, набор тренировок) действуют с недели rec.qa: очередь недели
     idx ≥ qa — D[(indexOf(o) + (idx − qa)·pw + j) % n], o — буква, с которой начинается неделя qa. Недели раньше qa — «мягкие»:
     их очередь не показывается, сделана — если записана хоть одна тренировка (смена правил не переписывает прошлое). */
  const isDay = (x) => (typeof x === "number" || (typeof x === "string" && /^\d$/.test(x))) && Number.isInteger(+x) && +x >= 0 && +x <= 6;
  /** Нормализованное { pw, wd, o } или null (не своя программа, нет поля, pw вне 1 … n−1). */
  function rotOf(rec) {
    if (!isCustom(rec) || !isObj(rec.rot)) return null;
    const D = daysOf(rec), n = D.length, pw = Math.round(+rec.rot.pw);
    if (!Number.isFinite(pw) || pw < 1 || pw >= n) return null;
    return { pw, wd: normWd((Array.isArray(rec.rot.wd) ? rec.rot.wd : []).filter(isDay), pw), o: D.includes(rec.rot.o) ? rec.rot.o : D[0] };
  }
  /** С какой недели действуют нынешние правила своей программы (0 — с начала). */
  const qaOf = (rec) => { const v = rec && rec.qa; return Number.isInteger(v) && v >= 0 ? v : 0; };
  /** Неделя idx раньше смены правил: её очередь неизвестна, «сделана» — если записана хоть одна тренировка. */
  const softWeek = (rec, idx) => isCustom(rec) && idx < qaOf(rec);
  /** Тренировки недели idx: при чередовании — pw букв очереди, иначе все. */
  function weekDays(rec, idx) {
    const D = daysOf(rec), r = rotOf(rec);
    if (!r) return D;
    const n = D.length, b = D.indexOf(r.o), off = (idx - qaOf(rec)) * r.pw, out = [];
    for (let j = 0; j < r.pw; j++) out.push(D[(((b + off + j) % n) + n) % n]);
    return out;
  }
  /** Первая буква программы rec начиная с L по алфавиту по кругу. */
  function nextLetter(rec, L) {
    const D = daysOf(rec), i = LETTERS.indexOf(L);
    for (let k = 0; k < LETTERS.length; k++) { const x = LETTERS[(i + k) % LETTERS.length]; if (D.includes(x)) return x; }
    return D[0];
  }
  /** Сменились правила (в неделю, добавили или удалили тренировку): новые действуют с недели qa, прошлое не переписывается.
      Очередь недели qa начинается с первой буквы прежней очереди этой недели (удалили — со следующей; не было чередования — с A). */
  function rebase(old, rec, qa) {
    const out = Object.assign({}, rec, { qa: Math.max(0, Math.round(+qa) || 0) });
    if (rotOf(out)) {
      const o0 = rotOf(old) ? weekDays(old, qa)[0] : "A";
      out.rot = Object.assign({}, out.rot, { o: nextLetter(out, o0) });
    }
    return out;
  }
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  /** Длина круга в неделях: через сколько недель очередь снова начнётся с A. */
  function roundWeeks(rec) { const r = rotOf(rec); if (!r) return 1; const n = daysOf(rec).length; return n / gcd(n, r.pw); }
  /** Тренировок в неделю: pw ≥ n — чередование выключается (rec.wd по буквам снова в силе). Дни мест — прежние или по умолчанию. */
  function setRot(rec, pw, now) {
    if (!isCustom(rec)) return { error: "Чередование — только у своей программы." };
    const n = daysOf(rec).length, v = Math.max(1, Math.min(n, Math.round(+pw) || n));
    const out = patch(rec, {}, now);
    if (v >= n) { delete out.rot; return { rec: out }; }
    // дни мест: прежние; включаем впервые — уже назначенные тренировкам дни по порядку недели (меньше — остальные «любой день»)
    const old = rotOf(rec), base = old ? old.wd : Object.values(cleanWdMap(rec.wd, daysOf(rec)));
    out.rot = { pw: v, wd: normWd(base, v), o: old ? old.o : daysOf(rec)[0] };
    return { rec: out };
  }
  /** Дни недели мест при чередовании: не больше pw, по порядку недели. */
  function setRotWd(rec, wd, now) {
    const r = rotOf(rec);
    if (!r) return { error: "Чередование выключено." };
    return { rec: patch(rec, { rot: { pw: r.pw, wd: normWd((wd || []).filter(isDay), r.pw), o: r.o } }, now) };
  }
  /** Максимумы для процентов цикла нагрузки: { exId: кг } — 1–1000 кг, шаг 0,5; пустое — null. */
  function cleanTm(tm) {
    if (!isObj(tm)) return null;
    const out = {};
    Object.keys(tm).forEach((k) => {
      // только id упражнений: латиница, цифры, «_»; без имён Object.prototype и __proto__
      if (!/^[a-z0-9_]{1,40}$/.test(k) || k === "__proto__" || Object.prototype.hasOwnProperty.call(Object.prototype, k)) return;
      const v = +String(tm[k]).replace(",", ".");
      if (Number.isFinite(v) && v >= 1 && v <= 1000) out[k] = Math.round(v * 2) / 2;
    });
    return Object.keys(out).length ? out : null;
  }
  /** Максимум упражнения: kg — число или null (убрать). */
  function setTm(rec, exId, kg, now) {
    const tm = Object.assign({}, cleanTm(rec.tm) || {});
    if (kg == null || kg === "") delete tm[exId]; else tm[exId] = kg;
    const c = cleanTm(tm), out = patch(rec, {}, now);
    if (c) out.tm = c; else delete out.tm;
    return { rec: out };
  }
  /** Целевой вес шага: pct × максимум / 100, до 2,5 кг (максимум меньше 40 кг — до 1 кг). */
  function stepWeight(pct, tm) {
    if (!(pct > 0) || !(tm > 0)) return null;
    const raw = (pct * tm) / 100, st = tm < 40 ? 1 : 2.5;
    if (raw < st) return null; // меньше шага округления — веса нет, только процент
    return Math.round(raw / st) * st;
  }
  /** Цикл нагрузки пункта: шаги { sets 1–10, reps — строка, rir?, pct? 30–110 }. Лишние сверх 12 отрезаются, битые шаги (не объект,
      без повторов) отбрасываются по одному, процент вне границ — тоже; годных меньше двух — цикла нет (null). */
  const CYC_MIN = 2, CYC_MAX = 12;
  const dash = (v) => String(v).replace(/(\d)\s*[-—–]\s*(\d)/g, "$1–$2");
  function cleanCyc(c) {
    if (!Array.isArray(c)) return null;
    const out = [];
    c.slice(0, CYC_MAX).forEach((x) => {
      if (!isObj(x)) return;
      const sets = Math.round(+x.sets), reps = x.reps == null ? "" : dash(String(x.reps).trim()).slice(0, 20);
      if (!Number.isFinite(sets) || !reps) return;
      const st = { sets: Math.max(1, Math.min(10, sets)), reps };
      if (x.rir != null && String(x.rir).trim() !== "") st.rir = String(x.rir).trim().slice(0, 8);
      const pct = x.pct == null || x.pct === "" ? NaN : +String(x.pct).replace(",", ".");
      if (Number.isFinite(pct) && pct >= 30 && pct <= 110) st.pct = Math.round(pct * 2) / 2;
      out.push(st);
    });
    return out.length >= CYC_MIN ? out : null;
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
    blank, fromTemplate, copyOf, rotOf, weekDays, qaOf, softWeek, rebase, roundWeeks, cleanCyc, CYC_MIN, CYC_MAX, setRot, setRotWd, cleanTm, setTm, stepWeight, count, add, remove, patch, addDay, removeDay, restoreDay, normWd, cleanWdMap, setWd, posOf, current, curOf, sessionsFor, bind, injectX,
    sanitize, sanitizeAll, cleanPlan, cleanPos, cleanPosAll, logKey, parseLogKey };
})();
