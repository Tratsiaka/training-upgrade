/* Правки программы пользователем (ключ "plan", синхронизируется целиком).
   Модель простая: изменённая тренировка хранится полной копией своих связок (s[ключ].g),
   неизменённые берутся из программы. Упражнения, добавленные из базы exercises-dataset,
   лежат в x и подмешиваются в P.exercises под id вида "ds_0289".
   Здесь только данные и операции — без DOM. */
(function () {
  "use strict";
  const STRENGTH = { pair: 1, tri: 1, circuit: 1, single: 1, giant: 1 };
  const isStrength = (g) => !!(g && STRENGTH[g.kind] && Array.isArray(g.items));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // Мышцы базы → мышцы программы (для объёма и приоритетов).
  const MUSCLE = {
    pectorals: "chest", chest: "chest", "upper chest": "chest",
    biceps: "biceps", brachialis: "biceps", triceps: "triceps",
    calves: "calves", soleus: "calves",
    lats: "back", "upper back": "back", "latissimus dorsi": "back", rhomboids: "back", back: "back", traps: "back", trapezius: "back", spine: "back", "lower back": "back",
    quads: "quads", quadriceps: "quads", hamstrings: "hams", glutes: "glutes", abductors: "glutes",
    abs: "core", abdominals: "core", obliques: "core", core: "core", "lower abs": "core", "serratus anterior": "core",
    adductors: "adductors", "inner thighs": "adductors", groin: "adductors",
    forearms: "forearms", "wrist flexors": "forearms", "wrist extensors": "forearms", "grip muscles": "forearms", hands: "forearms", wrists: "forearms",
    "rear deltoids": "reardelts"
  };
  function deltOf(name) {
    if (/rear|reverse fly|face pull|rear delt/i.test(name)) return "reardelts";
    if (/lateral|side raise|upright|y-raise|iron cross/i.test(name)) return "sidedelts";
    return "frontdelts";
  }
  function muscleOf(m, name) {
    if (m === "delts" || m === "deltoids" || m === "shoulders") return deltOf(name);
    return MUSCLE[m] || null;
  }
  /** Описание упражнения программы из записи базы (exercises-ru.json). */
  function exerciseFromLib(x) {
    const name = x.n || "";
    const p = [muscleOf(x.t, name)].filter(Boolean);
    const s = Array.from(new Set((x.sec || []).map((m) => muscleOf(m, name)).filter((m) => m && !p.includes(m))));
    const timed = x.t === "cardiovascular system" ||
      (/plank|hold|\bstretch\b|\bpose\b|carry|\bwalk\b|wall sit|march sit|l-sit|v-sit|\b(front|back) lever\b|planche|ergometer|\bbike\b/i.test(name) && !/push-up|\breps\b|lunge/i.test(name));
    const side = /\bone (arm|leg|hand)\b|single (arm|leg)|unilateral|\bone-arm\b/i.test(name);
    const def = { n: x.r || name, m: { p, s }, cues: [], alts: [], src: "ds",
      ds: { id: x.id, n: name, nr: x.r || "", s: x.s || [], m: `${x.id}-${x.m}` } };
    if (timed) def.unit = "sec";
    if (side) def.side = true;
    return def;
  }

  /** Варианты пункта: обычный — один; тяжёлая/лёгкая неделя жима — одно упражнение, два набора параметров;
      чередование по неделям — два упражнения. */
  function variants(it) {
    if (it.hl) return [{ key: "heavy", label: "Тяжёлая неделя", ex: it.ex, p: it.hl.heavy }, { key: "light", label: "Лёгкая неделя", ex: it.ex, p: it.hl.light }];
    if (it.weekAlt) return it.weekAlt.map((w, i) => ({ key: String(i), label: i ? "Недели 2 и 4" : "Недели 1 и 3", ex: w.ex, p: w }));
    return [{ key: "", label: "", ex: it.ex, p: it }];
  }
  /** Объект, где лежит упражнение варианта (для замены). */
  function exHolder(it, vkey) { return it.weekAlt ? it.weekAlt[+vkey || 0] : it; }
  /** Объект с параметрами варианта (sets, reps, rir, note). */
  function paramHolder(it, vkey) {
    if (it.hl) return it.hl[vkey === "light" ? "light" : "heavy"];
    if (it.weekAlt) return it.weekAlt[+vkey || 0];
    return it;
  }
  const exIds = (it) => (it.weekAlt ? it.weekAlt.map((w) => w.ex) : it.ex ? [it.ex] : []);

  function kindFor(g) {
    const n = g.items.length;
    if (g.kind === "circuit" && n > 1) return "circuit";
    return n <= 1 ? "single" : n === 2 ? "pair" : n === 3 ? "tri" : "giant";
  }

  function create(P, io) {
    let data = norm(io.get());
    let dsToProg = null;
    function norm(d) {
      d = d && typeof d === "object" ? d : {};
      return { v: 1, s: d.s && typeof d.s === "object" ? d.s : {}, x: d.x && typeof d.x === "object" ? d.x : {} };
    }
    function inject() {
      Object.keys(data.x).forEach((id) => { if (!P.exercises[id] || P.exercises[id].src === "ds") P.exercises[id] = data.x[id]; });
      dsToProg = null;
    }
    inject();
    const save = () => io.set(clone(data));
    const keys = () => Object.keys(P.sessions);

    function sess(key) {
      const b = P.sessions[key], f = data.s[key];
      if (!b) return null;
      return f ? Object.assign({}, b, { groups: f.g }) : b;
    }
    const edited = (key) => !!data.s[key];
    function fork(key) {
      if (!data.s[key]) data.s[key] = { g: clone(P.sessions[key].groups), at: new Date().toISOString(), ver: P.meta.version };
      return data.s[key].g;
    }
    function newGid(gs) { let i = 1; while (gs.some((g) => g.id === "U" + i)) i++; return "U" + i; }
    /** Буквы связок по порядку (A, B, C…) — для кодов A1, B2. */
    function letters(groups) {
      const out = {}; let n = 0;
      groups.forEach((g, gi) => { if (isStrength(g)) out[gi] = LETTERS[n++] || "?"; });
      return out;
    }
    function strengthIdx(gs) { return gs.map((g, i) => (isStrength(g) ? i : -1)).filter((i) => i >= 0); }
    function normalize(key) {
      const f = data.s[key]; if (!f) return;
      f.g = f.g.filter((g) => !isStrength(g) || g.items.length);
      f.g.forEach((g) => { if (isStrength(g)) g.kind = kindFor(g); });
      f.at = new Date().toISOString();
    }
    function finish(key) { normalize(key); save(); }

    /* ---- упражнения ---- */
    /** id упражнения программы, к которому привязана запись базы (или null). */
    function progOf(dsId) {
      if (!dsToProg) {
        dsToProg = {};
        Object.keys(P.exercises).forEach((id) => { const e = P.exercises[id]; if (e.ds && e.src !== "ds") (dsToProg[e.ds.id] = dsToProg[e.ds.id] || []).push(id); });
      }
      // Только однозначная привязка: если на запись базы опираются два упражнения программы, берём саму запись.
      const ids = dsToProg[dsId];
      return ids && ids.length === 1 ? ids[0] : null;
    }
    function exFromLib(x) {
      if (progOf(x.id)) return progOf(x.id);
      const id = "ds_" + x.id;
      if (!data.x[id]) { data.x[id] = exerciseFromLib(x); inject(); save(); }
      return id;
    }
    /** Для упражнения из базы: считать повторы или секунды. */
    function setUnit(id, unit) {
      const d = data.x[id]; if (!d) return;
      if (unit === "sec") d.unit = "sec"; else delete d.unit;
      inject(); save();
    }
    function count(exId) {
      let n = 0;
      keys().forEach((k) => sess(k).groups.forEach((g) => (g.items || []).forEach((it) => exIds(it).forEach((id) => { if (id === exId) n++; }))));
      return n;
    }
    function usedIds() {
      const out = new Set();
      keys().forEach((k) => sess(k).groups.forEach((g) => (g.items || []).forEach((it) => exIds(it).forEach((id) => out.add(id)))));
      return out;
    }

    /* ---- операции над пунктом (gi — индекс связки в тренировке, ii — пункта в связке) ---- */
    function item(key, gi, ii) { const g = sess(key).groups[gi]; return g && g.items ? g.items[ii] : null; }
    function setEx(h, newId) {
      if (!h.orig) h.orig = h.ex;
      h.ex = newId;
      if (h.orig === newId) delete h.orig;
    }
    /** Заменить упражнение. all — во всех тренировках всех блоков, где оно стоит. Возвращает число замен. */
    function replace(key, gi, ii, vkey, newId, all) {
      if (!P.exercises[newId]) return 0;
      const cur = item(key, gi, ii); if (!cur) return 0;
      const oldId = exHolder(cur, vkey).ex;
      if (oldId === newId) return 0;
      if (!all) { setEx(exHolder(fork(key)[gi].items[ii], vkey), newId); finish(key); return 1; }
      let n = 0;
      keys().forEach((k) => {
        const hit = sess(k).groups.some((g) => (g.items || []).some((it) => exIds(it).includes(oldId)));
        if (!hit) return;
        fork(k).forEach((g) => (g.items || []).forEach((it) => {
          if (it.weekAlt) it.weekAlt.forEach((w) => { if (w.ex === oldId) { setEx(w, newId); n++; } });
          else if (it.ex === oldId) { setEx(it, newId); n++; }
        }));
        normalize(k);
      });
      save();
      return n;
    }
    /** Вернуть исходное упражнение пункта. */
    function revert(key, gi, ii, vkey) {
      const h = exHolder(fork(key)[gi].items[ii], vkey);
      if (h.orig) { h.ex = h.orig; delete h.orig; }
      finish(key);
    }
    /** Подходы, повторы, запас, подсказка, майо-повторы. */
    function setParams(key, gi, ii, vkey, patch) {
      const it = fork(key)[gi].items[ii], p = paramHolder(it, vkey);
      if ("sets" in patch) p.sets = Math.max(1, Math.min(10, Math.round(+patch.sets) || 1));
      if ("reps" in patch) { const v = String(patch.reps || "").trim().slice(0, 20); if (v) p.reps = v; }
      if ("rir" in patch) { const v = patch.rir == null ? "" : String(patch.rir).trim().slice(0, 8); if (v) p.rir = v; else p.rir = null; }
      if ("note" in patch) { const v = String(patch.note || "").trim().slice(0, 200); if (v) p.note = v; else delete p.note; }
      if ("tempo" in patch) { const v = String(patch.tempo || "").trim().slice(0, 40); if (v) p.tempo = v; else delete p.tempo; }
      if ("myo" in patch) {
        if (patch.myo) { p.myo = true; p.sets = Math.min(p.sets || 2, 3); }
        else { delete p.myo; delete p.eff; if (!p.reps) p.reps = "12–15"; if (p.rir === undefined) p.rir = "1"; }
      }
      it.chg = 1;
      finish(key);
    }
    /** Сдвиг на одну позицию в общем списке упражнений: через границу связки пункт переходит в соседнюю. */
    function move(key, gi, ii, dir) {
      const gs = fork(key), g = gs[gi], j = ii + dir;
      if (j >= 0 && j < g.items.length) {
        [g.items[ii], g.items[j]] = [g.items[j], g.items[ii]];
        finish(key); return { gi, ii: j };
      }
      const si = strengthIdx(gs), pos = si.indexOf(gi), tgi = si[pos + dir];
      if (tgi == null) return null;
      const it = g.items.splice(ii, 1)[0], t = gs[tgi];
      if (dir < 0) t.items.push(it); else t.items.unshift(it);
      const tPos = dir < 0 ? t.items.length - 1 : 0;
      const removed = !g.items.length && gi < tgi ? 1 : 0;
      finish(key);
      return { gi: tgi - removed, ii: tPos };
    }
    /** Новый порядок после перетаскивания: layout — [{ gi, items: [[gi, ii], …] }] по силовым связкам. */
    function arrange(key, layout) {
      const gs = fork(key), old = gs.map((g) => (g.items ? g.items.slice() : null)), seen = new Set();
      const all = [];
      gs.forEach((g, gi) => { if (isStrength(g)) g.items.forEach((_, ii) => all.push(`${gi}:${ii}`)); });
      layout.forEach((row) => {
        const g = gs[row.gi]; if (!isStrength(g)) return;
        g.items = row.items.filter(([a, b]) => old[a] && old[a][b] && !seen.has(`${a}:${b}`)).map(([a, b]) => { seen.add(`${a}:${b}`); return old[a][b]; });
      });
      // Что не попало в раскладку (не должно случаться) — не теряем: в конец своей связки.
      all.filter((k) => !seen.has(k)).forEach((k) => { const [a, b] = k.split(":").map(Number); gs[a].items.push(old[a][b]); });
      finish(key);
    }
    function swapWith(key, a, b) {
      const gs = fork(key), A = gs[a.gi].items[a.ii], B = gs[b.gi].items[b.ii];
      if (!A || !B) return;
      gs[a.gi].items[a.ii] = B; gs[b.gi].items[b.ii] = A;
      finish(key);
    }
    /** Перенести пункт в связку tgi (в конец) или "new" — отдельной связкой сразу после своей. */
    function toGroup(key, gi, ii, tgi) {
      const gs = fork(key), g = gs[gi];
      if (tgi === "new") {
        if (g.items.length < 2) return null;
        const it = g.items.splice(ii, 1)[0];
        gs.splice(gi + 1, 0, { id: newGid(gs), kind: "single", tier: g.tier, rest: g.rest || "60–90 с", items: [it] });
        finish(key); return { gi: gi + 1, ii: 0 };
      }
      const t = gs[tgi];
      if (!isStrength(t) || tgi === gi) return null;
      const it = g.items.splice(ii, 1)[0];
      t.items.push(it);
      const tPos = t.items.length - 1, removed = !g.items.length && gi < tgi ? 1 : 0;
      finish(key);
      return { gi: tgi - removed, ii: tPos };
    }
    function remove(key, gi, ii) {
      const gs = fork(key);
      const it = gs[gi].items.splice(ii, 1)[0];
      finish(key);
      return it;
    }
    /** Добавить упражнение: place — индекс связки или "new" (отдельной связкой после последней силовой). */
    function add(key, exId, params, place, tier) {
      if (!P.exercises[exId]) return null;
      const gs = fork(key);
      const it = Object.assign({ ex: exId, sets: 3, reps: "10–12", rir: "1–2" }, params || {}, { add: 1 });
      if (place !== "new" && isStrength(gs[place])) {
        gs[place].items.push(it);
        finish(key); return { gi: place, ii: gs[place].items.length - 1 };
      }
      const si = strengthIdx(gs), at = si.length ? si[si.length - 1] + 1 : gs.length;
      gs.splice(at, 0, { id: newGid(gs), kind: "single", tier: tier || "core", rest: "60–90 с", items: [it] });
      finish(key); return { gi: at, ii: 0 };
    }

    /* ---- связки ---- */
    function moveGroup(key, gi, dir) {
      const gs = fork(key), si = strengthIdx(gs), pos = si.indexOf(gi), t = si[pos + dir];
      if (t == null) return null;
      [gs[gi], gs[t]] = [gs[t], gs[gi]];
      finish(key); return t;
    }
    function setGroup(key, gi, patch) {
      const g = fork(key)[gi];
      if (patch.tier && ["core", "std", "max"].includes(patch.tier)) g.tier = patch.tier;
      if ("rest" in patch) { const v = String(patch.rest || "").trim().slice(0, 24); if (v) g.rest = v; }
      if ("rounds" in patch && g.kind === "circuit") g.rounds = Math.max(1, Math.min(6, Math.round(+patch.rounds) || 1));
      finish(key);
    }
    function split(key, gi) {
      const gs = fork(key), g = gs[gi];
      if (!isStrength(g) || g.items.length < 2) return;
      const extra = g.items.splice(1).map((it) => ({ id: "", kind: "single", tier: g.tier, rest: g.rest, items: [it] }));
      gs.splice(gi + 1, 0, ...extra);
      extra.forEach((x) => { x.id = newGid(gs); });
      finish(key);
    }
    function removeGroup(key, gi) { fork(key).splice(gi, 1); finish(key); }

    /* ---- сброс, отмена, данные ---- */
    function reset(key) { delete data.s[key]; save(); }
    function resetAll() { data.s = {}; save(); }
    const snapshot = () => JSON.stringify(data);
    function restore(snap) { data = norm(JSON.parse(snap)); inject(); save(); }
    function reload() { data = norm(io.get()); inject(); }
    /** Старые постоянные замены (ключ swaps: "1A-B-0" → id) переносятся в правки программы. */
    function migrateSwaps(swaps) {
      let n = 0;
      Object.keys(swaps || {}).forEach((sk) => {
        const m = /^([1-9][ABC])-(\w+)-(\d+)$/.exec(sk), to = swaps[sk];
        if (!m || !P.sessions[m[1]] || !P.exercises[to]) return;
        const gs = fork(m[1]), g = gs.find((x) => x.id === m[2]), it = g && g.items && g.items[+m[3]];
        if (!it || it.weekAlt || it.ex === to) return;
        setEx(it, to); n++;
      });
      if (n) save();
      return n;
    }
    return {
      sess, edited, letters, strengthIdx, item, variants, paramHolder, exHolder, exIds, count, usedIds, exFromLib, progOf, setUnit,
      replace, revert, setParams, move, arrange, swapWith, toGroup, remove, add, moveGroup, setGroup, split, removeGroup,
      reset, resetAll, snapshot, restore, reload, migrateSwaps,
      editedKeys: () => Object.keys(data.s), forkInfo: (key) => data.s[key] || null, customs: () => data.x
    };
  }
  window.PlanModel = { create, isStrength, exerciseFromLib, LETTERS };
})();
