global.window = {};
require(require("path").join(__dirname, "../../src/data.js"));
require(require("path").join(__dirname, "../../src/plan.js"));
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
