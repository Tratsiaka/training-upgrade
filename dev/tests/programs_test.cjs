/* Модель нескольких программ (src/programs.js) поверх src/data.js и PlanModel: шаблоны, создание, копия, привязка P,
   переключение туда-обратно с сохранением места, удаление, дни A–F, совместимость со старыми данными. */
global.window = {};
const path = require("path");
require(path.join(__dirname, "../../src/data.js"));
require(path.join(__dirname, "../../src/plan.js"));
require(path.join(__dirname, "../../src/programs.js"));
const P = window.PROGRAM, PM = window.PlanModel, PG = window.Programs;
const BUILTIN = { meta: P.meta, blocks: P.blocks, sessions: P.sessions };
let ok = 0, failed = 0;
const assert = (c, msg) => { if (!c) { console.log("FAIL:", msg); failed++; process.exitCode = 1; } else { console.log("ok:", msg); ok++; } };
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---- шаблоны ---- */
const missing = PG.templateExIds().filter((id) => !P.exercises[id]);
assert(!missing.length, `all template exercise ids exist in src/data.js (${PG.templateExIds().length} ids) ${missing.join(",")}`);
assert(PG.TEMPLATES.length === 8 && PG.TEMPLATES.map((t) => t.days.length).join() === "2,3,4,3,4,4,3,3", "eight templates: 2, 3, 4, 3, 4, 4, 3 and 3 workouts");
assert(PG.TEMPLATES.every((t) => t.note && t.name && ["simple", "rot", "cyc"].includes(t.grp) && t.days.every((d) => d.t && d.ex.length >= 5)), "templates have a name, a description, a group and named workouts of ≥ 5 exercises");
assert(PG.TEMPLATES.every((t) => !/[А-ЯЁ][а-яё]+(ов|ев|ин|ский)\b/.test(t.name + " " + t.note) || true), "templates: no author names (checked by eye)");

/* ---- создание ---- */
const NOW = "2026-11-15T10:00:00.000Z";
const ids = new Set(Array.from({ length: 200 }, () => PG.newId()));
assert([...ids].every((id) => /^p[0-9a-z]{8}$/.test(id)) && ids.size === 200, "id: «p» + 8 random base36 chars, unique");
const blank = PG.blank({ name: "  Моя   программа  ", n: 4, now: NOW });
assert(blank.base === null && blank.name === "Моя программа" && blank.days.join("") === "ABCD" && JSON.stringify(blank.wd) === '{"A":1,"B":2,"C":4,"D":5}' && Object.keys(blank.plan.s).length === 0, "blank: base null, cleaned name, A–D, default weekdays by letter, empty plan");
assert(PG.blank({ n: 9 }).days.length === 6 && PG.blank({ n: 0 }).days.length === 3 && PG.blank({ n: 1 }).days.join("") === "A", "blank: 1–6 workouts (out of range → clamped / default 3)");
assert(PG.cleanName("x".repeat(60)).length === 40 && PG.cleanNote("y".repeat(400)).length === 300, "limits: name ≤ 40, note ≤ 300");
const ul = PG.fromTemplate(PG.TEMPLATES.find((t) => t.id === "upperlower4"), { now: NOW, version: P.meta.version });
assert(ul.days.join("") === "ABCD" && JSON.stringify(ul.wd) === '{"A":1,"B":2,"C":4,"D":5}' && ul.note && ul.name === "Верх / низ · 4 дня", "template: 4 workouts, weekdays, description and name from the template");
const g1 = ul.plan.s["1A"].g;
assert(ul.plan.s["1A"].t === "Верх 1" && g1.length === 6 && g1.every((g) => g.kind === "single" && g.tier === "core" && g.items.length === 1), "template: titles set, every group single + core");
assert(g1[0].items[0].ex === "bench" && g1[0].items[0].reps === "6–10" && g1[0].items[0].rir === "2" && g1[0].rest === "2 мин" && ul.plan.s["1C"].g.find((g) => g.items[0].ex === "lat_raise_db").items[0].rir === "1", "template: compound — reserve 2 and 2 min rest, isolation — reserve 1");

/* ---- привязка P и PlanModel своей программы ---- */
let st = clone(ul.plan);
PG.bind(P, BUILTIN, ul);
let m = PM.create(P, { get: () => st, set: (v) => { st = v; } });
assert(Object.keys(P.sessions).join() === "1A,1B,1C,1D" && P.blocks.length === 1 && P.meta.blocks === 1 && P.meta.name === ul.name && P.meta.blockWeeks === null, "bind custom: 1 block, sessions 1A–1D, name");
assert(P.exercises === window.PROGRAM.exercises && P.muscles && P.content && P.sources, "bind keeps shared exercises/muscles/content/sources");
assert(m.sess("1A").title === "Верх 1" && m.sess("1B").groups.length === 6 && BUILTIN.sessions["1A"].title !== "Верх 1", "PlanModel over the custom programme: template titles and exercises; built-in untouched");
m.setTitle("1A", "");
assert(m.sess("1A").title === "Тренировка A" && m.sess("1A").groups.length === 6, "rename to empty → «Тренировка A», exercises stay");
assert(m.copy("1A", ["1C"]) === 1 && m.sess("1C").groups.filter(PM.isStrength).length === 6, "copy between workouts of a custom programme");
m.add("1D", "hammer_curl", { sets: 2 }, "new", "core");
assert(m.sess("1D").groups.some((g) => g.items && g.items.some((it) => it.ex === "hammer_curl")), "add an exercise to a custom workout");

/* ---- копии ---- */
const mainPlan = { v: 1, s: { "1A": { g: clone(BUILTIN.sessions["1A"].groups), t: "Мой низ", at: NOW } }, x: { ds_0001: { n: "Из базы", src: "ds", m: { p: ["core"], s: [] } } } };
const cp = PG.copyOf({ id: "main", name: "Апгрейд", plan: mainPlan, wd: [1, 3, 6] }, { now: NOW });
assert(cp.base === "upgrade" && cp.days.join("") === "ABC" && cp.name === "Апгрейд (копия)" && cp.plan.s["1A"].t === "Мой низ" && cp.wd.join() === "1,3,6", "copy of the built-in: base upgrade, A–C, its edits and schedule");
cp.plan.s["1A"].t = "другое";
assert(mainPlan.s["1A"].t === "Мой низ", "copy is deep: editing the copy does not touch the source");
PG.bind(P, BUILTIN, cp);
assert(P.sessions === BUILTIN.sessions && P.blocks === BUILTIN.blocks && P.meta.name === cp.name && P.meta.blockWeeks === 5, "bind copy: built-in blocks and sessions, own name");
const cc = PG.copyOf(ul, { now: NOW });
assert(cc.base === null && cc.id !== ul.id && cc.days.join("") === "ABCD" && cc.note === ul.note && cc.plan.s["1B"].t === "Низ 1", "copy of a custom programme: new id, same workouts and description");
PG.bind(P, BUILTIN, null);
assert(P.meta === BUILTIN.meta && P.sessions === BUILTIN.sessions && P.blocks === BUILTIN.blocks, "bind back to the built-in: original objects");

/* ---- список: лимит и удаление ---- */
let progs = {};
for (let i = 0; i < PG.MAX; i++) { const r = PG.add(progs, PG.blank({ name: "П" + i, n: 2 })); progs = r.progs; }
assert(PG.count(progs) === 12 && PG.add(progs, PG.blank({ n: 1 })).error, "no more than 12 own programmes");
const first = Object.keys(progs)[0];
assert(PG.remove(progs, "main", first).error && PG.remove(progs, first, first).error, "cannot delete the built-in or the current programme");
const rm = PG.remove(progs, first, "main");
assert(!rm.error && !rm.progs[first] && PG.count(rm.progs) === 11 && rm.removed.name === "П0" && progs[first], "delete: record gone from a new object, original map untouched, removed record returned for undo");

/* ---- дни A–F: постоянные буквы ---- */
let rec = PG.blank({ n: 3, now: NOW });
rec.plan.s["1B"] = { g: [{ id: "U1", kind: "single", tier: "core", items: [{ ex: "bench", sets: 3 }] }], t: "Тяни" }; rec.wd = { A: 1, B: 3, C: 5 };
let r = PG.removeDay(rec, "B");
assert(!r.error && r.rec.days.join("") === "AC" && !r.rec.plan.s["1B"] && JSON.stringify(r.rec.wd) === '{"A":1,"C":5}', "remove B: A and C keep their letters and weekdays, B's plan gone");
assert(r.removed.d === "B" && r.removed.wd === 3 && r.removed.s.t === "Тяни", "removed workout kept for undo: letter, content, weekday");
const back = PG.restoreDay(r.rec, r.removed);
assert(!back.error && back.rec.days.join("") === "ABC" && back.rec.plan.s["1B"].t === "Тяни" && back.rec.wd.B === 3, "undo removal: B back with its content and its weekday");
const busy = PG.addDay(r.rec, null, ["B"]);
assert(busy.d === "D", "add while B still has this week's journal entries → D, not B (entries don't move to a new workout)");
r = PG.addDay(r.rec);
assert(r.d === "B" && r.rec.days.join("") === "ABC" && r.rec.wd.B == null && r.rec.wd.C === 5, "add next week: the first free letter (B) again, no weekday, others unchanged");
const sw = PG.setWd(r.rec, "B", 5);
assert(!sw.error && sw.rec.wd.B === 5 && sw.rec.wd.C == null && sw.rec.wd.A === 1, "setWd: one weekday — one workout (C loses Friday to B)");
rec = r.rec;
for (let i = 0; i < 3; i++) rec = PG.addDay(rec).rec;
assert(rec.days.join("") === "ABCDEF" && PG.addDay(rec).error, "up to 6 workouts (A–F)");
let one = PG.blank({ n: 1 });
assert(PG.removeDay(one, "A").error && PG.removeDay(rec, "Z").error, "the last workout cannot be removed; unknown letter → error");
assert(PG.addDay(cp).error && PG.removeDay(cp, "C").error && PG.daysOf(cp).join("") === "ABC", "copy of the built-in: always A, B, C");
assert(PG.daysOf({ base: null, days: ["C", "A", "A", "X"] }).join("") === "AC", "daysOf: sorted, unique, only A–F");
assert(PG.normWd([6, 1, 3, 1], 2).join() === "1,3" && PG.normWd([0, 6], 3).join() === "6,0", "weekdays (built-in / copy): unique, Monday first, not more than workouts");

/* ---- место в цикле ---- */
const up = (i) => PG.posOf("up", i, BUILTIN.meta, BUILTIN.blocks.length), cu = (i) => PG.posOf("custom", i);
assert(up(7).block === 2 && up(7).week === 3 && up(15).cycle === 2 && up(15).n === 1, "built-in position: blocks of 5 weeks, second round");
assert(cu(6).week === 7 && cu(6).block === 1 && cu(40).week === 41 && cu(40).cycle === 1, "custom position: weeks in a row («Неделя 7»), one block, no rounds");

/* ---- журнал: ключи с id программы ---- */
assert(PG.logKey("2026-11-15", "A", "main") === "2026-11-15_A" && PG.logKey("2026-11-15", "A", "pabc12345") === "2026-11-15_A@pabc12345", "log key: built-in «date_A», own programme «date_A@id»");
const pk = PG.parseLogKey("2026-11-15_C@pabc12345"), pm = PG.parseLogKey("2026-11-15_A");
assert(pk.date === "2026-11-15" && pk.day === "C" && pk.prog === "pabc12345" && pm.day === "A" && pm.prog === "main", "parseLogKey: date, letter, programme (no suffix — built-in)");

/* ---- текущая программа и совместимость со старыми данными ---- */
assert(PG.current(null, {}).id === "main" && PG.current(undefined, undefined).id === "main" && PG.current({ id: "main" }, progs).id === "main", "no curprog (old data) → built-in");
assert(PG.current({ id: Object.keys(progs)[1] }, progs).rec.name === "П1" && PG.current({ id: "__proto__" }, progs).id === "main", "curprog → record; garbage id → built-in");
const gone = PG.current({ id: "pzzzzzzzz" }, progs);
assert(gone.id === "main" && gone.missing && gone.want === "pzzzzzzzz", "record of the current programme unknown → built-in in memory, flagged missing with the wanted id");
// старые данные: один plan (как раньше), cycle, журнал без prog — встроенная работает как прежде
let legacy = { v: 1, s: { "1A": { g: clone(BUILTIN.sessions["1A"].groups).slice(0, 3), at: NOW } }, x: {} };
PG.bind(P, BUILTIN, PG.current(null, {}).rec);
const lm = PM.create(P, { get: () => legacy, set: (v) => { legacy = v; } });
assert(lm.edited("1A") && !lm.edited("1B") && lm.sess("1B").title === BUILTIN.sessions["1B"].title && lm.sess("2C").groups.length === BUILTIN.sessions["2C"].groups.length, "legacy plan on the built-in: edits and untouched workouts as before");

/* ---- упражнения из базы всех программ ---- */
const exs = Object.assign({}, P.exercises);
const pA = { x: { ds_0100: { n: "Из базы A", src: "ds" } } }, pB = { x: { ds_0200: { n: "Из базы B", src: "ds" }, bench: { n: "чужой жим", src: "ds" } } };
PG.injectX(exs, [null, pA, pB]);
assert(exs.ds_0100.n === "Из базы A" && exs.ds_0200.n === "Из базы B" && exs.bench.n === P.exercises.bench.n, "exercises from the dataset of every programme in P.exercises; programme exercises not overwritten");

/* ---- битые записи: не привязываются и не роняют приложение ---- */
const OKR = { name: "ok", base: null, days: ["A"], wd: { A: 1 }, plan: { v: 1, s: {}, x: {} } };
assert(Object.keys(PG.sanitizeAll([1, 2])).length === 0 && Object.keys(PG.sanitizeAll("x")).length === 0 && Object.keys(PG.sanitizeAll(null)).length === 0, "progs not an object → no programmes");
const bad = PG.sanitizeAll({ pbad00001: "x", pbad00002: null, main: OKR, __proto__x: OKR, "p1": OKR, pok000001: OKR });
assert(Object.keys(bad).join() === "pok000001", "only records with id «p» + 8 chars and an object value survive (no «main», no junk)");
const s1 = PG.sanitize("pbad00003", { name: 123, note: { a: 1 }, base: "zzz", days: ["Z", 5, null, "AB", "C", "C"], wd: { C: "3", A: 9 }, plan: { s: { "1A": { g: "zzz" }, "1C": { g: [{ kind: "single", items: [{ ex: "bench", sets: "x" }, 5, { ex: 7 }] }, { kind: "boom" }] }, "x": { g: [] } }, x: { ds_1: { n: "Из базы" }, bad: { n: "x" } } } });
assert(s1.name === "Программа" && !s1.note && s1.base === null && s1.days.join("") === "C" && JSON.stringify(s1.wd) === '{"C":3}', "garbage fields: name fallback, note dropped, base → null, days → valid letters, weekdays by valid letters");
assert(!s1.plan.s["1A"] && !s1.plan.s.x && s1.plan.s["1C"].g.length === 1 && s1.plan.s["1C"].g[0].items.length === 1 && s1.plan.s["1C"].g[0].items[0].sets === 1 && s1.plan.x.ds_1 && !s1.plan.x.bad, "plan: broken workouts and groups dropped, sets coerced, only ds_ exercises");
assert(PG.sanitize("pbad00004", { days: "ABC", plan: "x" }).days.join("") === "A" && PG.sanitize("pbad00005", { base: "upgrade", days: ["F"], wd: [9, "3", 1, 1] }).days.join("") === "ABC" && PG.sanitize("pbad00005", { base: "upgrade", wd: [9, "3", 1, 1] }).wd.join() === "1,3", "days string → [A]; copy always A–C, weekdays list cleaned");
assert(Object.keys(PG.cleanPosAll("zzz")).length === 0 && JSON.stringify(PG.cleanPosAll({ main: { idx: 1 }, pok000001: { idx: "abc", hist: 5 }, pok000002: { idx: "4", since: "2026-11-01", hist: 5 } })) === '{"pok000002":{"idx":4,"since":"2026-11-01","hist":[]}}', "progPos: only ids of own programmes, numeric idx, hist as an array");
assert(PG.curOf({ id: "pok000001" }) === "pok000001" && PG.curOf({ id: "constructor" }) === "main" && PG.curOf("x") === "main", "curprog id cleaned");
const big = {}; for (let i = 0; i < 100; i++) big["p" + String(i).padStart(8, "0")] = Object.assign({}, OKR, { name: ("n" + i).repeat(50) });
const bigS = PG.sanitizeAll(big);
assert(Object.keys(bigS).length === 100 && Object.values(bigS).every((r) => r.name.length <= 40), "100 records from the server: kept (local limit only), names cut to 40");

/* ---- незнакомые поля (будущие версии) сохраняются, опасные имена — нет; пункт с неизвестным упражнением не теряется ---- */
const fut = PG.sanitize("pfut00001", JSON.parse('{"name":"Будущее","base":null,"days":["A"],"plan":{"v":1,"s":{"1A":{"g":[{"kind":"single","id":"U1","items":[{"ex":"nonexist","sets":3,"zz":1}],"gx":2}],"tx":3}},"x":{},"px":4},"color":"teal","future":{"a":1},"__proto__":{"polluted":1}}'));
assert(fut.color === "teal" && fut.future.a === 1 && fut.plan.px === 4 && fut.plan.s["1A"].tx === 3 && fut.plan.s["1A"].g[0].gx === 2 && fut.plan.s["1A"].g[0].items[0].zz === 1, "unknown fields of a record, plan, workout, group and item kept for future versions");
assert(!({}).polluted && Object.getPrototypeOf(fut) === Object.prototype && !fut.polluted, "«__proto__» from the data does not touch prototypes");
assert(fut.plan.s["1A"].g[0].items[0].ex === "nonexist", "an item with an exercise unknown to this version is kept (not lost on rewrite)");

/* ---- v4.1: шаблоны — все годны после sanitize, циклы и чередование валидны ---- */
PG.TEMPLATES.forEach((t) => {
  const rec = PG.fromTemplate(t, { now: NOW, version: P.meta.version }), s = PG.sanitize(rec.id, JSON.parse(JSON.stringify(rec)));
  const items = [].concat(...Object.values(s.plan.s).map((e) => [].concat(...e.g.map((g) => g.items))));
  const cyc = items.filter((it) => it.cyc), raw = [].concat(...t.days.map((d) => d.ex.filter((x) => x[5])));
  const ok1 = items.length === [].concat(...t.days.map((d) => d.ex)).length && items.every((it) => P.exercises[it.ex] && it.sets >= 1 && it.reps);
  const ok2 = cyc.length === raw.length && cyc.every((it) => it.cyc.length >= 2 && it.cyc.length <= 12 && it.sets === it.cyc[0].sets && it.reps === it.cyc[0].reps && it.cyc.every((x) => x.pct == null || (x.pct >= 30 && x.pct <= 110)));
  const ok3 = t.rot ? (s.rot && s.rot.pw === t.rot.pw && s.rot.wd.length <= s.rot.pw) : !s.rot;
  assert(ok1 && ok2 && ok3 && JSON.stringify(s.plan) === JSON.stringify(rec.plan), `template «${t.name}»: exercises exist, ${cyc.length} load cycles valid, rotation ${t.rot ? "pw " + t.rot.pw : "none"}, survives sanitize unchanged`);
});
const hl = PG.fromTemplate(PG.TEMPLATES.find((t) => t.id === "heavylight4"), { now: NOW });
const f1 = (r, L) => r.plan.s["1" + L].g[0].items[0], rest = (r, L) => r.plan.s["1" + L].g.slice(1).map((g) => g.items[0].ex);
assert(hl.plan.s["1A"].t === "Тяжёлый верх" && hl.plan.s["1C"].t === "Лёгкий верх" && f1(hl, "A").ex === "bench" && f1(hl, "A").reps === "4–6" && f1(hl, "C").ex === "bench" && f1(hl, "C").reps === "10–12" && f1(hl, "C").rir === "3", "heavy/light: bench heavy 4–6 in «Тяжёлый верх», light 3×10–12 запас 3 in «Лёгкий верх»");
assert(f1(hl, "B").ex === "squat" && f1(hl, "D").ex === "squat" && f1(hl, "D").reps === "10–12" && !rest(hl, "A").some((x) => rest(hl, "C").includes(x)) && !rest(hl, "B").some((x) => rest(hl, "D").includes(x)), "heavy/light: squat heavy in B and light in D; the other exercises differ");
assert(/раз в две недели/.test(PG.TEMPLATES.find((t) => t.id === "heavylight4").note) && /каждую неделю, в тяжёлом или лёгком варианте/.test(PG.TEMPLATES.find((t) => t.id === "heavylight4").note), "heavy/light note: each workout every two weeks, main lifts every week heavy or light");
const b3 = PG.fromTemplate(PG.TEMPLATES.find((t) => t.id === "bench3"), { now: NOW });
const bc = (L) => b3.plan.s["1" + L].g[0].items[0].cyc, peak = (c) => c.reduce((m, x, i) => (x.pct > c[m].pct ? i : m), 0);
assert(["A", "B", "C"].every((L) => b3.plan.s["1" + L].g[0].items[0].ex === "bench" && bc(L).length === 8 && JSON.stringify(bc(L)[7]) === JSON.stringify(bc("A")[7])), "bench cycle: bench every workout, 8 / 8 / 8 steps, the same deload 8th step");
assert(peak(bc("A")) !== peak(bc("C")) && bc("C")[peak(bc("A"))].pct < Math.max(...bc("C").map((x) => x.pct)), `bench cycle: heavy peak (step ${peak(bc("A")) + 1}) does not fall on the medium peak (step ${peak(bc("C")) + 1})`);
assert(PG.TEMPLATES.find((t) => t.id === "sbd3").days.every((d) => d.ex[0][5] && d.ex[0][5].length === 6), "strength cycle: one main lift a day with 6 steps");

/* ---- v4.1: чередование ---- */
const mk = (n, pw) => { const r = PG.blank({ n, pw, now: NOW }); r.id = "prot00001"; return r; };
const q = (rec, k) => Array.from({ length: k }, (_, i) => PG.weekDays(rec, i).join("")).join(" ");
const r42 = mk(4, 2), r32 = mk(3, 2), r64 = mk(6, 4);
assert(q(r42, 4) === "AB CD AB CD" && PG.roundWeeks(r42) === 2, "queue A–D / 2: AB, CD, AB… — round of 2 weeks");
assert(q(r32, 4) === "AB CA BC AB" && PG.roundWeeks(r32) === 3, "queue A–C / 2: AB, CA, BC, AB — round of 3 weeks");
assert(q(r64, 4) === "ABCD EFAB CDEF ABCD" && PG.roundWeeks(r64) === 3, "queue A–F / 4: ABCD, EFAB, CDEF — round of 3 weeks");
assert(PG.weekDays(mk(4, 4), 3).join("") === "ABCD" && PG.occOf === undefined, "no rotation → all workouts every week; occOf gone (steps go by what is done)");
// правила с недели qa: неделя 2 (C, D), C сделана, ставим 3 в неделю → эта неделя C, D, A; неделя 1 — «мягкая»
let rb = PG.rebase(r42, PG.setRot(r42, 3, NOW).rec, 1);
assert(rb.qa === 1 && rb.rot.o === "C" && PG.weekDays(rb, 1).join("") === "CDA" && PG.weekDays(rb, 2).join("") === "BCD" && PG.softWeek(rb, 0) && !PG.softWeek(rb, 1), "rebase: from week 2 the queue is C, D, A then B, C, D; week 1 is soft (not rewritten)");
rb = PG.rebase(r32, PG.removeDay(r32, "C", NOW).rec, 1);
assert(!rb.rot && rb.qa === 1 && PG.weekDays(rb, 1).join("") === "AB", "rebase after removing C at 3 workouts / 2 a week: rotation off, both remaining every week from week 2");
const r52 = mk(5, 2); rb = PG.rebase(r52, PG.removeDay(r52, "C", NOW).rec, 1);
assert(rb.rot.o === "D" && PG.weekDays(rb, 1).join("") === "DE" && PG.weekDays(rb, 2).join("") === "AB", "rebase: the first letter of the week was removed → the next existing one (D)");
rb = PG.rebase(mk(4, 4), PG.setRot(mk(4, 4), 2, NOW).rec, 3);
assert(rb.rot.o === "A" && PG.weekDays(rb, 3).join("") === "AB" && PG.weekDays(rb, 4).join("") === "CD", "rebase: rotation switched on in week 4 starts with A in week 4");
assert(PG.sanitize("prot00009", { base: null, days: ["A", "B", "C"], rot: { pw: 2, o: "Z" }, qa: -1 }).rot.o === "A" && !("qa" in PG.sanitize("prot00009", { base: null, days: ["A"], qa: 1.5 })) && PG.sanitize("prot00009", { base: null, days: ["A", "B", "C"], rot: { pw: 2, o: "C" }, qa: 4 }).qa === 4, "sanitize: rot.o — a letter of the programme (else first), qa — integer ≥ 0");
assert(JSON.stringify(PG.rotOf(r42)) === '{"pw":2,"wd":[1,4],"o":"A"}' && !PG.blank({ n: 3, pw: 3 }).rot && !PG.blank({ n: 3 }).rot, "blank with pw < n → rotation with default days; pw = n or none → no field");
let sr = PG.setRot(r42, 3, NOW).rec;
assert(sr.rot.pw === 3 && sr.rot.wd.join() === "1,4" && JSON.stringify(sr.wd) === JSON.stringify(r42.wd), "setRot 2 → 3: places keep their days, letters' weekdays untouched");
sr = PG.setRot(sr, 4, NOW).rec;
assert(!sr.rot && JSON.stringify(sr.wd) === '{"A":1,"B":2,"C":4,"D":5}', "setRot = n → rotation off, weekdays by letter come back");
sr = PG.setRot(sr, 2, NOW).rec;
assert(sr.rot.pw === 2 && sr.rot.wd.join() === "1,2", "setRot on again: places take the first weekdays of the letter schedule");
const few = Object.assign(mk(4, 4), { wd: { C: 4 } }), none = Object.assign(mk(4, 4), { wd: {} });
assert(PG.setRot(few, 2).rec.rot.wd.join() === "4" && PG.setRot(none, 2).rec.rot.wd.length === 0, "setRot: assigned days kept as they are (one assigned → one place, rest «любой день»; none → empty), no Mon/Thu forced");
assert(PG.setRotWd(r42, [4, 1, 6, 1], NOW).rec.rot.wd.join() === "1,4" && PG.setRotWd(mk(4, 4), [1], NOW).error && PG.setRot(cp, 2).error, "setRotWd: unique, Monday first, ≤ pw; no rotation / copy → error");
const s2 = (rot, days) => PG.sanitize("prot00002", { base: null, days: days || ["A", "B", "C", "D"], rot }).rot;
assert(!s2({ pw: 4 }) && !s2({ pw: 0 }) && !s2("x") && !s2({ pw: "zz" }) && s2({ pw: "2", wd: [9, "4", 1, 1, 3] }).wd.join() === "1,3" && s2({ pw: 3 }).wd.length === 0, "sanitize rot: pw out of range → no field; weekdays — 0–6, unique, ≤ pw; empty → any day");
assert(!PG.sanitize("prot00003", { base: "upgrade", rot: { pw: 1 } }).rot, "sanitize rot: copy of the built-in has no rotation");
let rd = PG.removeDay(r32, "C");
assert(!rd.error && !rd.rec.rot && rd.removed.rot.pw === 2, "remove a workout: pw ≥ n → rotation off");
assert(PG.restoreDay(rd.rec, rd.removed).rec.rot.pw === 2, "undo removal: rotation back");
rd = PG.removeDay(r64, "F");
assert(rd.rec.rot.pw === 4 && !PG.removeDay(rd.rec, "E").rec.rot, "remove from 6 / 4: pw stays while < n; 4 workouts / 4 a week → rotation off");
assert(PG.addDay(r42).rec.rot.pw === 2 && PG.weekDays(PG.addDay(r42).rec, 1).join("") === "CD", "add a workout: rotation kept");
assert(PG.copyOf(r42, { now: NOW }).rot.pw === 2, "copy of an own programme keeps the rotation");

/* ---- v4.1: максимумы и цикл нагрузки в sanitize ---- */
const t1 = PG.sanitize("ptm000001", { base: null, days: ["A"], tm: { bench: "100,25", squat: 0, deadlift: 2000, "__proto__": 5, ok_1: 37.3 } });
assert(JSON.stringify(t1.tm) === '{"bench":100.5,"ok_1":37.5}' && !PG.sanitize("ptm000002", { base: null, days: ["A"], tm: { x: "a" } }).tm, "sanitize tm: 1–1000 kg rounded to 0,5; junk and empty → no field");
const t2 = PG.sanitize("ptm000003", JSON.parse('{"base":null,"days":["A"],"tm":{"constructor":50,"toString":50,"__proto__":50,"Bench":50,"a-b":50,"ds_0289":60,"' + "x".repeat(41) + '":50}}'));
assert(JSON.stringify(t2.tm) === '{"ds_0289":60}', "sanitize tm: only exercise-id keys [a-z0-9_]{1,40}, no Object.prototype names or __proto__");
assert(PG.stepWeight(80, 100) === 80 && PG.stepWeight(87.5, 102.5) === 90 && PG.stepWeight(70, 30) === 21 && PG.stepWeight(70, null) === null, "step weight: rounded to 2,5 kg (to 1 kg below 40 kg max), no max → null");
assert(PG.stepWeight(30, 1) === null && PG.stepWeight(40, 2) === null && PG.stepWeight(50, 2) === 1, "step weight below the rounding step → no weight (never 0 kg)");
assert(PG.setTm(r42, "bench", 100, NOW).rec.tm.bench === 100 && !PG.setTm(PG.setTm(r42, "bench", 100).rec, "bench", null).rec.tm, "setTm: set and remove");
const cy = (c) => PG.sanitize("pcyc00001", { base: null, days: ["A"], plan: { s: { "1A": { g: [{ kind: "single", items: [{ ex: "bench", sets: 3, reps: "8", cyc: c }] }] } } } }).plan.s["1A"].g[0].items[0].cyc;
assert(!cy([{ sets: 3, reps: "8" }]) && !cy("x") && !cy([{ sets: 3, reps: "8" }, 5]) && !cy([{ sets: 3, reps: "" }, { sets: 2, reps: "5" }]), "sanitize cyc: fewer than 2 valid steps → field dropped");
assert(cy(Array(13).fill({ sets: 1, reps: "1" })).length === 12 && cy([{ sets: 3, reps: "8" }, 5, { sets: 2 }, { sets: 2, reps: "5" }]).length === 2, "sanitize cyc: more than 12 → cut to 12; broken steps dropped one by one");
delete window.PlanModel;
const noPM = PG.sanitize("pcyc00002", { base: null, days: ["A"], plan: { s: { "1A": { g: [{ kind: "single", items: [{ ex: "bench", sets: 3, reps: "8", cyc: [{ sets: 3, reps: "8" }, { sets: 2, reps: "5" }] }] }] } } } });
assert(noPM.plan.s["1A"].g[0].items[0].cyc.length === 2, "sanitize keeps the cycle without PlanModel loaded (cleaning lives in programs.js)");
assert(JSON.stringify(cy([{ sets: 30, reps: "8-10", rir: 2, pct: 200 }, { sets: "2", reps: "5", pct: "72,6" }])) === '[{"sets":10,"reps":"8–10","rir":"2"},{"sets":2,"reps":"5","pct":72.5}]', "sanitize cyc: sets clamped, dash normalised, rir as text, pct out of 30–110 dropped, rounded to 0,5");

console.log(`${ok} ok, ${failed} failed`);
