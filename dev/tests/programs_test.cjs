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
assert(PG.TEMPLATES.length === 3 && PG.TEMPLATES.map((t) => t.days.length).join() === "3,4,3", "three templates: 3, 4 and 3 workouts");
assert(PG.TEMPLATES.every((t) => t.note && t.name && t.days.every((d) => d.t && d.ex.length >= 6)), "templates have a name, a description and named workouts of ≥ 6 exercises");

/* ---- создание ---- */
const NOW = "2026-11-15T10:00:00.000Z";
const ids = new Set(Array.from({ length: 200 }, () => PG.newId()));
assert([...ids].every((id) => /^p[0-9a-z]{8}$/.test(id)) && ids.size === 200, "id: «p» + 8 random base36 chars, unique");
const blank = PG.blank({ name: "  Моя   программа  ", n: 4, now: NOW });
assert(blank.base === null && blank.name === "Моя программа" && blank.days.join("") === "ABCD" && JSON.stringify(blank.wd) === '{"A":1,"B":2,"C":4,"D":5}' && Object.keys(blank.plan.s).length === 0, "blank: base null, cleaned name, A–D, default weekdays by letter, empty plan");
assert(PG.blank({ n: 9 }).days.length === 6 && PG.blank({ n: 0 }).days.length === 3 && PG.blank({ n: 1 }).days.join("") === "A", "blank: 1–6 workouts (out of range → clamped / default 3)");
assert(PG.cleanName("x".repeat(60)).length === 40 && PG.cleanNote("y".repeat(400)).length === 300, "limits: name ≤ 40, note ≤ 300");
const ul = PG.fromTemplate(PG.TEMPLATES[1], { now: NOW, version: P.meta.version });
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

console.log(`${ok} ok, ${failed} failed`);
