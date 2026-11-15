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
  const FINISH = { sprint: 1, z2: 1, skill: 1 };
  /** Короткий отпечаток строки (djb2) — чтобы узнать, менялись ли связки после переименования. */
  function hash(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0; return h.toString(36); }
  /** "8-12" → "8–12": дефис и длинное тире между числами — в короткое тире, как в программе. */
  const normDash = (v) => String(v).replace(/(\d)\s*[-—–]\s*(\d)/g, "$1–$2");
  /** JSON с ключами по алфавиту — сравнение параметров без учёта порядка полей. */
  function sig(o) {
    if (Array.isArray(o)) return "[" + o.map(sig).join(",") + "]";
    if (o && typeof o === "object") return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + sig(o[k])).join(",") + "}";
    return JSON.stringify(o === undefined ? null : o);
  }

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
    if (x.eq) def.ds.eq = x.eq;
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

  // счётчик правок — сквозной для всех экземпляров: у новой модели (другая программа) значение никогда не совпадёт со старым снимком
  let SEQ = 0;
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
    let rev = ++SEQ; // номер изменения плана: любая запись, откат или подгрузка с сервера
    const save = () => { rev = ++SEQ; io.set(clone(data)); };
    const keys = () => Object.keys(P.sessions);

    /** Только переименована: связки в записи — копия программы для старых версий (им нужен g),
        а эта версия берёт связки из программы. Отпечаток не совпал — связки правили (например, старая версия): это обычная правка. */
    const titleOnly = (f) => !!(f && f.to && f.to === hash(sig(f.g)));
    function sess(key) {
      const b = P.sessions[key], f = data.s[key];
      if (!b) return null;
      if (!f) return b;
      const out = Object.assign({}, b, { groups: titleOnly(f) ? b.groups : f.g });
      if (typeof f.t === "string" && f.t.trim()) out.title = f.t;
      return out;
    }
    /** Название тренировки из программы (без переименования). */
    const baseTitle = (key) => (P.sessions[key] ? P.sessions[key].title : "");
    const edited = (key) => !!data.s[key] && !titleOnly(data.s[key]);
    function fork(key) {
      const f = data.s[key];
      if (!f) data.s[key] = { g: clone(P.sessions[key].groups), at: new Date().toISOString(), ver: P.meta.version };
      else if (f.to) {
        // была только переименована: правим актуальную программу, название остаётся
        if (titleOnly(f)) { f.g = clone(P.sessions[key].groups); f.ver = P.meta.version; }
        delete f.to;
      }
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
    /** Переименованная тренировка снова совпала с программой — опять «только название» (не числится изменённой). */
    function retitle(key) {
      const f = data.s[key];
      if (f && f.t && !f.to && P.sessions[key] && sig(f.g) === sig(P.sessions[key].groups)) f.to = hash(sig(f.g));
    }
    function finish(key) { normalize(key); retitle(key); save(); }

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
      if ("reps" in patch) { const v = normDash(String(patch.reps || "").trim()).slice(0, 20); if (v) p.reps = v; }
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
      if (it.reps) it.reps = normDash(String(it.reps)).slice(0, 20);
      if (place !== "new" && isStrength(gs[place])) {
        gs[place].items.push(it);
        finish(key); return { gi: place, ii: gs[place].items.length - 1 };
      }
      const si = strengthIdx(gs);
      // Пустая тренировка: перед финишем (спринты, кардио, навык), после разминки.
      let at = si.length ? si[si.length - 1] + 1 : gs.findIndex((g) => FINISH[g.kind]);
      if (at < 0) at = gs.length;
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
    /* ---- тренировка целиком ---- */
    /** Пометки пункта (orig/add/chg) заново — относительно программы тренировки-получателя:
        orig остаётся, только если исходное упражнение есть в этой тренировке программы (иначе «вернуть» некуда);
        пункт, которого в программе нет, — add; есть, но с другими параметрами, — chg. */
    function remark(groups, baseGroups) {
      const baseItems = [], baseIds = new Set();
      baseGroups.forEach((g) => { if (isStrength(g)) g.items.forEach((it) => { baseItems.push(it); exIds(it).forEach((id) => baseIds.add(id)); }); });
      const holders = (it) => (it.weekAlt ? it.weekAlt : [it]);
      const strip = (it) => {
        const c = clone(it); delete c.add; delete c.chg; delete c.orig;
        if (c.weekAlt) c.weekAlt.forEach((w) => { delete w.orig; });
        return c;
      };
      groups.forEach((g) => {
        if (!isStrength(g)) return;
        g.items.forEach((it) => {
          delete it.add; delete it.chg;
          holders(it).forEach((h) => { if (h.orig && !baseIds.has(h.orig)) delete h.orig; });
          const ident = holders(it).map((h) => h.orig || h.ex).join("/");
          // каждый пункт программы сопоставляется один раз: второе такое же упражнение — уже «добавлено»
          const bi = baseItems.findIndex((x) => exIds(x).join("/") === ident), b = bi >= 0 ? baseItems.splice(bi, 1)[0] : null;
          if (!b) { it.add = 1; holders(it).forEach((h) => { delete h.orig; }); return; }
          const mine = strip(it);
          holders(mine).forEach((h, i) => { h.ex = holders(it)[i].orig || holders(it)[i].ex; });
          if (sig(mine) !== sig(strip(b))) it.chg = 1;
        });
      });
      return groups;
    }
    /** Куда вставлять силовую часть в связки gs без силовых: после открывающих блоков (разминка, интервалы), перед финишем. */
    function strengthAt(gs) { const i = gs.findIndex((g) => FINISH[g.kind]); return i < 0 ? gs.length : i; }
    /** Скопировать силовую часть тренировки (как она сейчас выглядит, с правками) в другие. У получателя силовые связки
        заменяются целиком, а свои разминка, интервалы, кардио, финиш и навык остаются. Название переносится,
        если отличается от названия получателя в программе. Возвращает число копий. */
    function copy(fromKey, toKeys) {
      const src = sess(fromKey); if (!src) return 0;
      const strength = src.groups.filter(isStrength);
      if (!strength.length) return 0;
      let n = 0;
      (toKeys || []).forEach((to) => {
        if (to === fromKey || !P.sessions[to]) return;
        const fixed = clone(sess(to).groups.filter((g) => !isStrength(g)));
        const st = remark(clone(strength), P.sessions[to].groups);
        const g = fixed.slice(); g.splice(strengthAt(fixed), 0, ...st);
        // id связок уникальны внутри тренировки
        const seen = new Set();
        g.forEach((x) => { if (!x.id || seen.has(x.id)) { let i = 1; while (g.some((y) => y.id === "U" + i) || seen.has("U" + i)) i++; x.id = "U" + i; } seen.add(x.id); });
        const entry = { g, at: new Date().toISOString(), ver: P.meta.version };
        if (src.title && src.title !== baseTitle(to)) entry.t = src.title;
        data.s[to] = entry;
        normalize(to); n++;
      });
      if (n) save();
      return n;
    }
    /** Очистить тренировку: убрать все силовые связки; разминка, кардио, финиш и навык остаются. Возвращает число убранных связок
        (0 — силовых и так нет, ничего не меняется). */
    function clear(key) {
      const cur = sess(key);
      if (!cur || !strengthIdx(cur.groups).length) return 0;
      const gs = fork(key), n = strengthIdx(gs).length;
      data.s[key].g = gs.filter((g) => !isStrength(g));
      finish(key);
      return n;
    }
    /** Своё название тренировки; пустое (или как в программе) — вернуть исходное.
        Если связки не правились, запись помечается «только название» (to — отпечаток связок): тренировка не считается изменённой. */
    function setTitle(key, title) {
      if (!P.sessions[key]) return;
      const v = String(title || "").replace(/\s+/g, " ").trim().slice(0, 60);
      let f = data.s[key];
      if (v && v !== baseTitle(key)) {
        if (!f) { f = data.s[key] = { g: clone(P.sessions[key].groups), at: new Date().toISOString(), ver: P.meta.version }; f.to = hash(sig(f.g)); }
        f.t = v; save(); return;
      }
      if (!f) return;
      if (titleOnly(f)) { delete data.s[key]; save(); return; }
      delete f.t; delete f.to;
      // Кроме названия ничего не менялось — убираем правку совсем, чтобы тренировка не числилась изменённой.
      if (sig(f.g) === sig(P.sessions[key].groups)) delete data.s[key];
      save();
    }
    /** Вернуть один пункт к сохранённому виду (отмена правок быстрого редактора — только этого пункта). */
    function putItem(key, gi, ii, saved) {
      const g = sess(key).groups[gi];
      if (!g || !g.items || !g.items[ii] || !saved) return false;
      const gs = fork(key);
      gs[gi].items[ii] = clone(saved);
      const f = data.s[key];
      if (!f.t && sig(f.g) === sig(P.sessions[key].groups)) delete data.s[key];
      else { normalize(key); retitle(key); }
      save();
      return true;
    }
    function reset(key) { delete data.s[key]; save(); }
    function resetAll() { data.s = {}; save(); }
    const snapshot = () => JSON.stringify(data);
    function restore(snap) { data = norm(JSON.parse(snap)); inject(); save(); }
    function reload() { data = norm(io.get()); inject(); rev = ++SEQ; }
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
      copy, clear, setTitle, baseTitle, putItem, titled: (key) => !!(data.s[key] && data.s[key].t), rev: () => rev,
      reset, resetAll, snapshot, restore, reload, migrateSwaps,
      editedKeys: () => Object.keys(data.s).filter(edited), forkInfo: (key) => (edited(key) ? data.s[key] : null), customs: () => data.x
    };
  }
  window.PlanModel = { create, isStrength, exerciseFromLib, LETTERS };
})();
