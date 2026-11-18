global.window = {};
require(require("path").join(__dirname, "../../src/data.js"));
require(require("path").join(__dirname, "../../src/plan.js"));
require(require("path").join(__dirname, "../../src/programs.js")); // чистка цикла нагрузки — Programs.cleanCyc
const P = window.PROGRAM, PM = window.PlanModel;
let stored = null;
const m = PM.create(P, { get: () => stored, set: (v) => { stored = v; } });
const assert = (c, msg) => { if (!c) { console.log("FAIL:", msg); process.exitCode = 1; } else console.log("ok:", msg); };
const names = (k) => m.sess(k).groups.filter(PM.isStrength).map((g) => g.kind + "[" + g.items.map((it) => it.weekAlt ? it.weekAlt.map(w=>w.ex).join("/") : it.ex).join(",") + "]").join(" ");
console.log("1A:", names("1A"));
// letters
const L = m.letters(m.sess("1A").groups); console.log("letters:", JSON.stringify(L));
assert(!m.edited("1A"), "not edited initially");
// replace only here
const giA = m.sess("1A").groups.findIndex((g) => g.id === "A");
assert(m.replace("1A", giA, 0, "", "hack", false) === 1, "replace here");
assert(m.sess("1A").groups[giA].items[0].ex === "hack" && m.sess("1A").groups[giA].items[0].orig === "legpress", "orig kept");
assert(m.edited("1A") && !m.edited("2A"), "only 1A forked");
assert(P.sessions["1A"].groups[giA].items[0].ex === "legpress", "base untouched");
m.revert("1A", giA, 0, "");
assert(m.sess("1A").groups[giA].items[0].ex === "legpress" && !m.sess("1A").groups[giA].items[0].orig, "revert");
// replace everywhere
const before = m.count("calf_legpress");
const n = m.replace("1A", m.sess("1A").groups.findIndex((g) => g.id === "B"), 1, "", "calf_stand", true);
assert(n === before && m.count("calf_legpress") === 0 && m.count("calf_stand") >= n, `replace all: ${n} of ${before}`);
// weekAlt replace (2B deadlift/rdl)
const gB = m.sess("2B").groups.findIndex((g) => g.items && g.items.some((it) => it.weekAlt));
const iB = m.sess("2B").groups[gB].items.findIndex((it) => it.weekAlt);
m.replace("2B", gB, iB, "1", "hipthrust", false);
assert(m.sess("2B").groups[gB].items[iB].weekAlt[1].ex === "hipthrust" && m.sess("2B").groups[gB].items[iB].weekAlt[0].ex === "deadlift", "weekAlt variant replace");
// params on hl (bench heavy/light)
const gBench = m.sess("1A").groups.findIndex((g) => g.items && g.items.some((it) => it.hl));
m.setParams("1A", gBench, 0, "light", { sets: 4, reps: "12–15", rir: "2", note: "тест" });
const hl = m.sess("1A").groups[gBench].items[0].hl;
assert(hl.light.sets === 4 && hl.light.reps === "12–15" && hl.heavy.sets === 3 && hl.light.note === "тест", "hl light params");
// move within group and across
const s0 = names("1A");
let pos = m.move("1A", giA, 1, -1); // A2 up -> A1
assert(pos && pos.gi === giA && pos.ii === 0 && m.sess("1A").groups[giA].items[0].ex === "deadbug", "move up within group");
pos = m.move("1A", giA, 0, -1); // top of first strength group: no move
assert(pos === null, "no move above first");
// move last item of A down into B
pos = m.move("1A", giA, 1, 1);
console.log("after down:", names("1A"), JSON.stringify(pos));
assert(m.sess("1A").groups[pos.gi].items[0].ex === "legpress", "moved into next group start");
// group A now single
assert(m.sess("1A").groups[giA].kind === "single", "group kind recomputed to single");
// move it back up: B1 up -> into A end
pos = m.move("1A", pos.gi, 0, -1);
assert(m.sess("1A").groups[giA].items.length === 2 && m.sess("1A").groups[giA].kind === "pair", "moved back; pair again");
// swapWith
const a = { gi: giA, ii: 0 }, b = { gi: gBench, ii: 1 };
const ea = m.item("1A", a.gi, a.ii).ex, eb = m.item("1A", b.gi, b.ii).ex;
m.swapWith("1A", a, b);
assert(m.item("1A", a.gi, a.ii).ex === eb && m.item("1A", b.gi, b.ii).ex === ea, "swapWith");
// toGroup new / to other group
const cnt = m.sess("1A").groups.length;
pos = m.toGroup("1A", gBench, 0, "new");
assert(m.sess("1A").groups.length === cnt + 1 && m.sess("1A").groups[pos.gi].kind === "single", "detach to new single group");
pos = m.toGroup("1A", pos.gi, 0, giA);
assert(m.sess("1A").groups.length === cnt && m.sess("1A").groups[giA].items.length === 3 && m.sess("1A").groups[giA].kind === "tri", "into group A → tri; empty group removed");
// remove
const removed = m.remove("1A", giA, 2);
assert(removed && m.sess("1A").groups[giA].kind === "pair", "remove → pair");
// add new
pos = m.add("1A", "face_pull", { sets: 2, reps: "15–20" }, "new", "std");
const g = m.sess("1A").groups[pos.gi];
assert(g.kind === "single" && g.tier === "std" && g.items[0].add === 1, "add new single group");
const si = m.strengthIdx(m.sess("1A").groups);
assert(si[si.length - 1] === pos.gi, "new group after last strength group");
assert(m.sess("1A").groups[pos.gi + 1] && m.sess("1A").groups[pos.gi + 1].kind === "sprint", "before finisher");
// moveGroup
const t = m.moveGroup("1A", pos.gi, -1);
assert(t === si[si.length - 2], "moveGroup up");
// setGroup
m.setGroup("1A", t, { tier: "max", rest: "45 с" });
assert(m.sess("1A").groups[t].tier === "max" && m.sess("1A").groups[t].rest === "45 с", "setGroup");
// split
const gC = m.sess("1A").groups.findIndex((x) => x.kind === "tri");
const c0 = m.sess("1A").groups.length;
m.split("1A", gC);
assert(m.sess("1A").groups.length === c0 + 2 && m.sess("1A").groups[gC].kind === "single", "split tri into 3 singles");
const ids = m.sess("1A").groups.map((x) => x.id);
assert(new Set(ids).size === ids.length, "unique group ids: " + ids.join(","));
// circuit 3C
const gCirc = m.sess("3C").groups.findIndex((x) => x.kind === "circuit");
m.remove("3C", gCirc, 0);
assert(m.sess("3C").groups[gCirc].kind === "circuit", "circuit stays circuit with 3 items");
// library exercise
const libx = { id: "0743", n: "sled hack squat", r: "Гакк-присед в тренажёре", bp: "upper legs", eq: "sled machine", t: "glutes", sec: ["hamstrings", "adductors"], s: ["шаг"], m: "abc" };
const progId = m.exFromLib(libx);
console.log("lib 0743 →", progId);
const libx2 = { id: "0334", n: "dumbbell lateral raise", r: "Махи гантелями в стороны", t: "delts", sec: ["shoulders"], s: ["a"], m: "zz" };
const cid = m.exFromLib(libx2);
console.log("lib 0334 →", cid, JSON.stringify(P.exercises[cid]).slice(0, 200));
const libx3 = { id: "9999", n: "barbell rear delt row", r: "Тяга на заднюю дельту", t: "delts", sec: ["biceps"], s: [], m: "q" };
const cid3 = m.exFromLib(libx3);
assert(P.exercises[cid3].m.p[0] === "reardelts" && P.exercises[cid3].m.s.includes("biceps"), "rear delt mapping");
// snapshot/restore
const snap = m.snapshot();
m.reset("1A");
assert(!m.edited("1A"), "reset 1A");
m.restore(snap);
assert(m.edited("1A"), "restore");
// reload from storage (sync)
const m2 = PM.create(P, { get: () => stored, set: () => {} });
assert(m2.edited("1A") && m2.sess("1A").groups.length === m.sess("1A").groups.length, "persisted & reloaded");
// migrate swaps
stored = null; const m3 = PM.create(P, { get: () => stored, set: (v) => { stored = v; } });
const mig = m3.migrateSwaps({ "1A-B-0": "machine_press", "2B-B-0": "rdl", "9Z-Q-0": "x", "1B-A-0": "pulldown" });
assert(mig === 2 && m3.sess("1A").groups.find((x) => x.id === "B").items[0].ex === "machine_press" && m3.sess("1B").groups.find((x) => x.id === "A").items[0].ex === "pulldown", "migrate swaps (weekAlt skipped): " + mig);
console.log("used ids:", m3.usedIds().size, "| edited:", m3.editedKeys());

/* ---- тренировка целиком: copy / clear / setTitle ---- */
{
  let st = null;
  const w = PM.create(P, { get: () => st, set: (v) => { st = v; } });
  const strength = (k) => w.sess(k).groups.filter(PM.isStrength);
  const flat = (k) => strength(k).flatMap((g) => g.items);
  // источник 1A: замена, параметры, добавленное упражнение из базы
  const gA = w.sess("1A").groups.findIndex((g) => g.id === "A");
  w.replace("1A", gA, 0, "", "hack", false);
  w.setParams("1A", gA, 1, "", { sets: 5 });
  const cx = w.exFromLib({ id: "0334", n: "dumbbell lateral raise", r: "Махи гантелями в стороны", t: "delts", sec: ["shoulders"], s: [], m: "zz" });
  w.add("1A", cx, { sets: 2, reps: "15–20" }, "new", "std");
  w.setTitle("1A", "Ноги и жим");
  // получатель 3A уже изменён — копия его перезапишет
  w.remove("3A", gA, 0);
  const snapCopy = w.snapshot();
  const n = w.copy("1A", ["2A", "3A", "1A", "9Z"]);
  assert(n === 2, "copy: 2 targets (self and unknown skipped): " + n);
  assert(JSON.stringify(strength("2A").map((g) => g.items.map((it) => it.ex || it.weekAlt.map((x) => x.ex).join("/")))) === JSON.stringify(strength("1A").map((g) => g.items.map((it) => it.ex || it.weekAlt.map((x) => x.ex).join("/")))), "copy: same exercises and order as source");
  assert(flat("3A").length === flat("1A").length, "copy overwrites already edited target");
  // пометки относительно получателя (2A в программе — те же упражнения, что 1A)
  const it2 = w.sess("2A").groups[gA].items;
  assert(it2[0].ex === "hack" && it2[0].orig === "legpress" && !it2[0].add, "copy: replacement keeps orig when target program has it");
  assert(it2[0].chg === 1, "copy: params differ from target program (block 2 scheme) → chg");
  assert(it2[1].ex === "deadbug" && it2[1].add === 1 && !it2[1].chg, "copy: exercise absent in target program → add");
  const addIt = flat("2A").find((it) => it.ex === cx);
  assert(addIt && addIt.add === 1 && P.exercises[cx], "copy: custom x exercise copied, marked add");
  const benchFlags = (k) => { const b = flat(k).find((it) => it.ex === "bench"); return b ? [b.chg, b.add, b.orig].map(Boolean).join() : "none"; };
  assert(benchFlags("2A") === "true,false,false", "copy: same exercise with source params → chg only");
  const h3 = flat("3A").find((it) => it.ex === "hack");
  assert(h3 && !h3.orig && h3.add === 1, "copy to other block with other program: orig dropped, marked add");
  // независимость: правка копии не трогает источник
  w.setParams("2A", gA, 1, "", { sets: 2 });
  assert(w.sess("1A").groups[gA].items[1].sets === 5 && w.sess("2A").groups[gA].items[1].sets === 2, "copy is deep (independent of source)");

  assert(w.sess("2A").title === "Ноги и жим", "copy carries renamed title");
  // weekAlt: 2B (становая / румынская) → 3B, вариант 1 заменён
  const gW = w.sess("2B").groups.findIndex((g) => g.items && g.items.some((it) => it.weekAlt));
  const iW = w.sess("2B").groups[gW].items.findIndex((it) => it.weekAlt);
  w.replace("2B", gW, iW, "1", "hipthrust", false);
  w.copy("2B", ["3B"]);
  const wa = w.sess("3B").groups[gW].items[iW];
  assert(wa.weekAlt && wa.weekAlt[1].ex === "hipthrust" && wa.weekAlt[0].ex === "deadlift", "copy: weekAlt items copied with variants");
  // в программе 3B нет пары «становая / румынская» — пункт «добавлен», и «вернуть» в нём некуда
  assert(!P.sessions["3B"].groups.some((g) => (g.items || []).some((it) => it.weekAlt)) && wa.add === 1 && !wa.weekAlt[0].orig && !wa.weekAlt[1].orig, "copy: weekAlt item absent in target program → add, orig dropped: " + JSON.stringify(wa.weekAlt.map((x) => x.orig || "")));
  // 1A → 1B: исходное упражнение замены в программе 1B нет — orig убирается, пункт помечен add
  w.copy("1A", ["1B"]);
  const hb = flat("1B").find((it) => it.ex === "hack");
  assert(hb && !hb.orig && hb.add === 1, "copy to other day: orig dropped when not in target program");
  assert(w.sess("1B").title === "Ноги и жим", "copy to other day: title carried");
  // туда и обратно: пункты, которые в 1A не менялись, после 1A → 2A → 1A снова без пометок
  w.copy("2A", ["1A"]);
  assert(benchFlags("1A") === "false,false,false" && w.sess("1A").groups[gA].items[0].orig === "legpress", "copy back: untouched items lose markers, replacement keeps orig");
  // сброс получателя
  w.reset("2A");
  assert(!w.edited("2A") && w.sess("2A").title === P.sessions["2A"].title, "reset target after copy");
  // откат копии одним снимком
  w.restore(snapCopy);
  assert(!w.edited("2A") && !w.edited("1B") && w.edited("3A") && !flat("3A").some((it) => it.ex === "hack") && flat("3A").length === flat("2A").length - 1, "restore snapshot undoes copy (3A back to its own edit)");
  // clear
  const fixedBefore = w.sess("2A").groups.filter((g) => !PM.isStrength(g)).map((g) => g.kind).join(",");
  const removedN = w.clear("2A");
  assert(removedN === 6 && strength("2A").length === 0, "clear removes all strength groups: " + removedN);
  assert(w.sess("2A").groups.map((g) => g.kind).join(",") === fixedBefore, "clear keeps warmup/finisher: " + fixedBefore);
  assert(w.edited("2A"), "clear is an edit");
  const pos = w.add("2A", "face_pull", { sets: 3 }, "new", "core");
  assert(w.sess("2A").groups.map((g) => g.kind).join(",") === "warmup,single,sprint,z2" && pos.gi === 1, "add into empty workout goes after warmup, before finisher");
  w.clear("2C"); w.add("2C", "face_pull", {}, "new");
  assert(w.sess("2C").groups.map((g) => g.kind).join(",") === "n4x4,single,skill", "add into empty C: after motor, before skill");
  w.reset("2A");
  assert(strength("2A").length === 6, "reset after clear restores program");
  // setTitle: только название — тренировка не считается изменённой, связки берутся из программы
  w.setTitle("3C", "  Мотор   и руки ");
  assert(w.sess("3C").title === "Мотор и руки" && !w.edited("3C") && w.titled("3C") && w.forkInfo("3C") === null && !w.editedKeys().includes("3C"), "title-only rename: stored (trimmed), not reported as edited");
  assert(st.s["3C"].t === "Мотор и руки" && Array.isArray(st.s["3C"].g) && st.s["3C"].g.length === P.sessions["3C"].groups.length && typeof st.s["3C"].to === "string", "title stored in s[key].t with full groups (for older versions) and a title-only mark");
  w.setTitle("3C", "");
  assert(w.sess("3C").title === P.sessions["3C"].title && !w.edited("3C") && !st.s["3C"], "empty title → built-in, entry removed");
  w.setTitle("3C", "Своё"); w.setParams("3C", 1, 0, "", { sets: 4 });
  assert(w.edited("3C") && !st.s["3C"].to && w.sess("3C").title === "Своё" && w.sess("3C").groups[1].items[0].sets === 4, "real edit after rename: edited, mark cleared, title kept");
  w.setTitle("3C", P.sessions["3C"].title);
  assert(w.edited("3C") && !st.s["3C"].t && w.sess("3C").title === P.sessions["3C"].title, "title equal to built-in clears override, other edits kept");
  w.setTitle("3C", "Своё"); w.reset("3C");
  assert(!w.edited("3C") && !w.titled("3C") && w.sess("3C").title === P.sessions["3C"].title, "reset clears title");
  // программа обновилась — переименованная (только название) тренировка получает новую программу
  w.setTitle("1C", "Старой версии не мешает");
  const P2 = JSON.parse(JSON.stringify(P)); P2.sessions["1C"].groups[1].items[0].sets = 9;
  const w2 = PM.create(P2, { get: () => JSON.parse(JSON.stringify(st)), set: () => {} });
  assert(w2.sess("1C").groups[1].items[0].sets === 9 && w2.sess("1C").title === "Старой версии не мешает" && !w2.edited("1C"), "title-only entry follows program updates");
  const reloaded = PM.create(P, { get: () => st, set: () => {} });
  assert(reloaded.sess("1C").title === "Старой версии не мешает", "title persists through reload");
  // предыдущая версия приложения (настоящий plan.js из снимка, если задан OLD_PLAN_JS): видит обычную правку, правит — новая версия это видит
  const OLD = process.env.OLD_PLAN_JS, fs = require("fs");
  if (OLD && fs.existsSync(OLD)) {
    const box = { window: {} }; require("vm").runInNewContext(fs.readFileSync(OLD, "utf8"), box);
    let oldSt = JSON.parse(JSON.stringify(st));
    const om = box.window.PlanModel.create(P, { get: () => oldSt, set: (v) => { oldSt = v; } });
    const og = om.sess("1C").groups;
    assert(Array.isArray(og) && og.length === P.sessions["1C"].groups.length && om.sess("1C").title === P.sessions["1C"].title, "old build: renamed entry renders with groups and its built-in title");
    om.setParams("1C", 1, 0, "", { sets: 7 });
    assert(oldSt.s["1C"].t === "Старой версии не мешает", "old build keeps t when editing");
    const back = PM.create(P, { get: () => oldSt, set: () => {} });
    assert(back.edited("1C") && back.sess("1C").groups[1].items[0].sets === 7 && back.sess("1C").title === "Старой версии не мешает", "edit made in old build is seen as a real edit (mark no longer matches)");
    om.setParams("2A", 1, 0, "", { sets: 2 });
    assert(PM.create(P, { get: () => oldSt, set: () => {} }).sess("2A").groups[1].items[0].sets === 2, "old build edit on another workout reads back");
  } else console.log("skip: old build plan.js not given (OLD_PLAN_JS)");
}

/* ---- доработка: копия только силовой части, дубли, пустые, отмена одного пункта, тире, счётчик ---- */
{
  let st = null;
  const w = PM.create(P, { get: () => st, set: (v) => { st = v; } });
  const kinds = (k) => w.sess(k).groups.map((g) => g.kind).join(",");
  const strengthEx = (k) => w.sess(k).groups.filter(PM.isStrength).map((g) => g.items.map((it) => it.ex || it.weekAlt.map((x) => x.ex).join("/")).join(",")).join(" ");
  w.copy("1A", ["1C"]);
  assert(kinds("1C") === "n4x4,pair,pair,tri,pair,pair,pair,skill" && strengthEx("1C") === strengthEx("1A"), "copy A → C: C keeps intervals and skill, gets A's strength part");
  assert(w.sess("1C").note === P.sessions["1C"].note, "copy keeps target session note");
  w.copy("1C", ["1A"]);
  assert(kinds("1A") === "warmup,pair,pair,tri,pair,pair,pair,sprint,z2", "copy C → A keeps A's warm-up and finishers");
  w.reset("1A"); w.reset("1C");
  w.copy("1A", ["2A"]);
  assert(JSON.stringify(w.sess("2A").groups[0]) === JSON.stringify(P.sessions["2A"].groups[0]), "copy keeps the target block's own warm-up text");
  const ids = w.sess("2A").groups.map((g) => g.id);
  assert(new Set(ids).size === ids.length, "copy: unique group ids in target: " + ids.join(","));
  w.reset("2A");
  // одно упражнение дважды: второе — «добавлено»
  const gA = w.sess("1A").groups.findIndex((g) => g.id === "A");
  w.add("1A", "legpress", { sets: 2 }, "new");
  w.copy("1A", ["2A"]);
  const lp = w.sess("2A").groups.flatMap((g) => g.items || []).filter((it) => it.ex === "legpress");
  assert(lp.length === 2 && !lp[0].add && lp[1].add === 1, "copy: duplicate exercise consumes base item, second marked add");
  w.reset("1A"); w.reset("2A");
  // пустой источник не копируется, пустая тренировка не очищается повторно
  w.clear("1B");
  const snap = w.snapshot();
  assert(w.copy("1B", ["2B"]) === 0 && w.snapshot() === snap, "copy from an empty workout does nothing");
  assert(w.clear("1B") === 0 && w.snapshot() === snap, "clear on a workout without strength groups is a no-op");
  assert(w.clear("2B") === 6 && w.clear("2B") === 0, "clear twice: second is a no-op");
  w.reset("1B"); w.reset("2B");
  assert(w.clear("3C") > 0 && !w.sess("3C").groups.some(PM.isStrength) && w.sess("3C").groups[0].kind === "n4x4", "clear C keeps intervals and skill");
  w.reset("3C");
  // отмена одного пункта
  w.setParams("1A", gA, 1, "", { sets: 5 });
  const saved = JSON.parse(JSON.stringify(w.item("1A", gA, 0)));
  w.setParams("1A", gA, 0, "", { sets: 6, reps: "8-12" });
  assert(w.item("1A", gA, 0).reps === "8–12", "reps dash normalised: 8-12 → 8–12");
  w.putItem("1A", gA, 0, saved);
  assert(w.item("1A", gA, 0).sets === 3 && !w.item("1A", gA, 0).chg && w.item("1A", gA, 1).sets === 5, "putItem restores one item, other edits stay");
  w.reset("1A");
  w.setParams("1A", gA, 0, "", { sets: 6 }); w.putItem("1A", gA, 0, saved);
  assert(!w.edited("1A"), "putItem back to program → workout not edited");
  w.setTitle("1A", "Имя"); w.setParams("1A", gA, 0, "", { sets: 6 }); w.putItem("1A", gA, 0, saved);
  assert(w.titled("1A") && w.sess("1A").title === "Имя", "putItem keeps the title");
  w.reset("1A");
  const r0 = w.rev(); w.setParams("1A", gA, 0, "", { sets: 4 }); const r1 = w.rev(); w.reload(); const r2 = w.rev();
  assert(r1 > r0 && r2 > r1, "rev counts saves and reloads");
  const pos = w.add("1A", "face_pull", { reps: "12-15" }, "new");
  assert(w.item("1A", pos.gi, pos.ii).reps === "12–15", "add normalises dash");
}

/* ---- финальная доработка: отмена на переименованной, оборудование из базы ---- */
{
  let st = null;
  const w = PM.create(P, { get: () => st, set: (v) => { st = v; } });
  const gA = w.sess("1A").groups.findIndex((g) => g.id === "A");
  w.setTitle("1A", "Мой низ");
  const saved = JSON.parse(JSON.stringify(w.item("1A", gA, 0)));
  w.setParams("1A", gA, 0, "", { sets: 5 });
  assert(w.edited("1A"), "renamed + edited → edited");
  w.putItem("1A", gA, 0, saved);
  assert(!w.edited("1A") && w.titled("1A") && w.sess("1A").title === "Мой низ" && st.s["1A"].to, "putItem back to program on a renamed workout → title-only again (not edited)");
  w.setParams("1A", gA, 0, "", { sets: 5 }); w.setParams("1A", gA, 0, "", { sets: 3 });
  assert(w.edited("1A"), "manual param change back still counts as edited (chg marker)");
  w.reset("1A");
  const d = PM.exerciseFromLib({ id: "2133", n: "farmers walk", r: "Прогулка фермера", t: "forearms", eq: "dumbbell", sec: [], s: [], m: "q" });
  assert(d.ds.eq === "dumbbell" && d.unit === "sec", "exerciseFromLib keeps the equipment (ds.eq) for timed loaded exercises");
  const d2 = PM.exerciseFromLib({ id: "1", n: "push-up", t: "pectorals", sec: [], s: [], m: "q" });
  assert(!("eq" in d2.ds), "no eq in the record → no eq field");
}

/* ---- v4.1: цикл нагрузки пункта (setCyc) ---- */
{
  let st = null;
  const w = PM.create(P, { get: () => st, set: (v) => { st = v; } });
  const gA = w.sess("1A").groups.findIndex((g) => g.id === "A");
  const steps = [{ sets: 4, reps: "8", pct: 70 }, { sets: "4", reps: "6-8", rir: 2, pct: "75" }, { sets: 30, reps: "5", pct: 300 }];
  assert(w.setCyc("1A", gA, 0, steps) === true, "setCyc: steps saved");
  let it = w.item("1A", gA, 0);
  assert(it.cyc.length === 3 && it.cyc[1].reps === "6–8" && it.cyc[1].rir === "2" && it.cyc[1].pct === 75 && it.cyc[2].sets === 10 && !("pct" in it.cyc[2]), "setCyc: cleaned — dash, rir as text, sets ≤ 10, pct out of range dropped");
  assert(it.sets === 4 && it.reps === "8" && it.rir === null && w.edited("1A") && it.chg === 1, "setCyc: the item's own scheme = step 1 (seen by older builds), workout edited");
  w.setParams("1A", gA, 0, "", { sets: 5, reps: "7" });
  it = w.item("1A", gA, 0);
  assert(it.cyc[0].sets === 5 && it.cyc[0].reps === "7" && it.cyc[1].sets === 4, "setParams on an item with a cycle edits step 1 too");
  assert(w.setCyc("1A", gA, 0, [{ sets: 3, reps: "5" }]) === false && w.setCyc("1A", gA, 0, [{ sets: 3 }, { sets: 2, reps: "5" }]) === false && w.item("1A", gA, 0).cyc.length === 3, "setCyc: fewer than 2 valid steps → refused, cycle unchanged");
  const before = JSON.stringify(w.item("1A", gA, 0).cyc);
  assert(w.setCyc("1A", gA, 0, Array(13).fill({ sets: 1, reps: "1" })) === true && w.item("1A", gA, 0).cyc.length === 12 && w.setCyc("1A", gA, 0, JSON.parse(before)) === true, "setCyc: more than 12 steps → cut to 12");
  assert(w.setCyc("1A", gA, 0, null) === true && !("cyc" in w.item("1A", gA, 0)) && w.item("1A", gA, 0).sets === 5, "setCyc null: cycle removed, plain scheme stays (= step 1)");
  const gBench = w.sess("1A").groups.findIndex((g) => g.items && g.items.some((x) => x.hl));
  assert(w.setCyc("1A", gBench, 0, steps) === false && !w.item("1A", gBench, 0).cyc, "setCyc refused on heavy/light (hl) items of the built-in");
  const gW = w.sess("2B").groups.findIndex((g) => g.items && g.items.some((x) => x.weekAlt)), iW = w.sess("2B").groups[gW].items.findIndex((x) => x.weekAlt);
  assert(w.setCyc("2B", gW, iW, steps) === false, "setCyc refused on week-alternating (weekAlt) items");
  assert(w.variants(w.item("1A", gA, 0)).length === 1 && window.Programs.cleanCyc([{ sets: 1, reps: "1" }, { sets: 2, reps: "2", pct: 30 }])[1].pct === 30, "variants() unchanged; one cleanCyc for the app (Programs, pct 30 ok)");
}
