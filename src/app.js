(function () {
  "use strict";
  const P = window.PROGRAM;
  const S = window.Store;
  const SY = window.Sync || null;
  // Личные заметки (приходят из базы после входа) накладываются на публичную программу до первого рендера.
  if (SY && SY.overlay()) { try { SY.applyOverlay(P, SY.overlay()); } catch (e) { console.error(e); } }
  const EX = P.exercises;
  const MEDIA = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/";
  const GV = "© Gym visual — gymvisual.com";

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const WD = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const fmtDate = (s) => { const d = parseISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const fmtNum = (n) => (Math.round(n * 10) / 10).toString().replace(".", ",");
  const todayISO = () => isoOf(new Date());

  /* ---------- state ---------- */
  const state = {};
  const T = { end: 0, id: null };
  function settingsFromStore() {
    return Object.assign({ start: P.meta.startDefault, bw: P.meta.profile.weight, hrmax: 180 }, S.get("settings", {}));
  }
  function loadState() {
    Object.assign(state, {
      tab: "today",
      settings: settingsFromStore(),
      day: null,
      time: S.get("time", 90),
      ready: S.get("readyDate", "") === todayISO() ? S.get("ready", "ok") : "ok",
      swaps: S.get("swaps", {}),
      logs: S.get("logs", {}),
      meas: S.get("meas", []),
      goals: S.get("goals", {}),
      theme: S.get("theme", "auto"),
      media: S.get("media", false),
      volBlock: null,
      volSat: false
    });
  }

  function vars() {
    const hr = +state.settings.hrmax || 180, bw = +state.settings.bw || 89;
    const r5 = (x) => Math.round(x / 5) * 5;
    return { hrmax: hr, hr60: Math.round(hr * 0.6), hr70: Math.round(hr * 0.7), hr85: Math.round(hr * 0.85), hr95: Math.round(hr * 0.95), protLo: r5(bw * 1.8), protHi: r5(bw * 2.0) };
  }
  function rich(text) {
    const v = vars();
    return String(text)
      .replace(/\{\{(\w+)\}\}/g, (m, k) => (k in v ? v[k] : m))
      .replace(/\{(\w+)\}/g, (m, k) => {
        const s = P.sources[k];
        return s ? `<a class="cite" href="${esc(s.u)}" target="_blank" rel="noopener" title="${esc(s.t + " — " + s.j)}">${esc(s.a)}</a>` : m;
      });
  }

  /* ---------- program position: «по выполнению» ----------
     Неделя программы закрывается, когда сделаны A и B (C — по желанию). Курсор цикла
     (S "cycle": idx — номер недели с начала, since — с какой даты считаем эту неделю)
     сдвигается, когда начинаешь первую тренировку следующей недели, или вручную. */
  const WEEKS = P.meta.blocks * P.meta.blockWeeks;
  const DEF_DAYS = [1, 2, 6];
  const WD_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const monFirst = (d) => (d + 6) % 7;
  function plannedDays() {
    const d = Array.isArray(state.settings.days) && state.settings.days.length ? state.settings.days : DEF_DAYS;
    return d.slice().sort((a, b) => monFirst(a) - monFirst(b)).slice(0, 3);
  }
  function posOfIdx(idx) {
    const i = ((idx % WEEKS) + WEEKS) % WEEKS;
    return { idx, cycle: Math.floor(idx / WEEKS) + 1, block: Math.floor(i / 5) + 1, week: (i % 5) + 1, n: i + 1 };
  }
  function cycleState() { return Object.assign({ idx: 0, since: null, hist: [] }, S.get("cycle", {})); }
  function setCycle(next, why) {
    const cur = cycleState();
    const hist = (cur.hist || []).concat({ at: todayISO(), from: cur.idx, to: next.idx, why }).slice(-60);
    const val = { idx: next.idx, since: next.since, hist };
    S.set("cycle", val);
    return cur;
  }
  /** Какие тренировки текущей недели уже сделаны: { A: дата, B: дата, C: дата }. */
  function weekDone(cyc) {
    const done = {};
    Object.keys(state.logs).forEach((k) => {
      const [d, day] = k.split("_"), e = state.logs[k];
      if (!entryHasData(e)) return;
      if (cyc.since && d < cyc.since) return;
      if (e.idx != null && e.idx !== cyc.idx) return;
      if (!done[day] || d > done[day]) done[day] = d;
    });
    return done;
  }
  function ctxNow() {
    const cyc = cycleState(), done = weekDone(cyc), day = state.day, today = todayISO();
    const closed = !!(done.A && done.B);
    let idx = cyc.idx, next = false;
    const todayEntry = state.logs[logKey(today, day)];
    if (todayEntry && entryHasData(todayEntry) && todayEntry.idx != null) idx = todayEntry.idx;
    else if (closed && (day !== "C" || done.C)) { idx = cyc.idx + 1; next = true; }
    const p = posOfIdx(idx);
    const anyLog = Object.keys(state.logs).some((k) => entryHasData(state.logs[k]));
    const pre = !anyLog && cyc.idx === 0 && daysBetween(today, state.settings.start) > 0;
    return { idx, next, done, closed, cyc, pre, block: p.block, week: p.week, n: p.n, cycle: p.cycle, day, time: +state.time, low: state.ready === "low", light: p.week === 5, heavy: p.week === 1 || p.week === 3 };
  }

  /* ---------- logs ---------- */
  function logKey(date, day) { return `${date}_${day}`; }
  function entryHasData(e) { return !!(e && e.ex && Object.values(e.ex).some((sets) => (sets || []).some((s) => s && (s.w || s.r)))); }
  function suggestDay() {
    const today = todayISO();
    for (const d of ["A", "B", "C"]) if (entryHasData(state.logs[logKey(today, d)])) return d;
    const done = weekDone(cycleState());
    if (!done.A) return "A";
    if (!done.B) return "B";
    const pd = plannedDays(), wd = new Date().getDay();
    if (!done.C && pd.length >= 3 && wd !== pd[0]) return "C";
    return "A";
  }
  /** Запись тренировки на сегодня: создаётся при первом вводе; первая запись новой недели сдвигает цикл. */
  function todayEntry(ctx) {
    const key = logKey(todayISO(), ctx.day);
    let e = state.logs[key];
    if (!e) {
      e = state.logs[key] = { day: ctx.day, block: ctx.block, week: ctx.week, idx: ctx.idx, ready: state.ready, time: state.time, ex: {} };
      if (ctx.next) setCycle({ idx: ctx.idx, since: todayISO() }, "auto");
    }
    return e;
  }
  /** Обновить самочувствие и режим времени в сегодняшней записи, если она уже есть. */
  function touchToday(fields) {
    const e = state.logs[logKey(todayISO(), state.day)];
    if (e) { Object.assign(e, fields); S.set("logs", state.logs); }
  }
  function lastFor(exId, beforeKey) {
    const keys = Object.keys(state.logs).filter((k) => k < beforeKey).sort().reverse();
    for (const k of keys) {
      const sets = state.logs[k].ex && state.logs[k].ex[exId];
      if (sets && sets.some((s) => s && (s.w || s.r))) return { key: k, date: k.slice(0, 10), sets };
    }
    return null;
  }

  /* ---------- prescriptions ---------- */
  function bumpRIR(r, n) {
    if (r == null || r === "") return r;
    let out = String(r).replace(/\d+/g, (d) => Math.min(4, +d + n));
    const m = out.match(/^(\d)–(\d)$/);
    if (m && m[1] === m[2]) out = m[1];
    return out;
  }
  /* ---------- корректировки (от агента или вручную), ключ "adjust" ---------- */
  function adjFor(exId, sessKey) {
    const list = S.get("adjust", []);
    if (!Array.isArray(list) || !list.length) return null;
    const out = {};
    list.forEach((a) => {
      if (!a || a.enabled === false) return;
      (a.changes || []).forEach((c) => {
        if (!c || c.exercise !== exId) return;
        const sess = c.session || "*";
        if (sess !== "*" && sess !== sessKey && sess !== sessKey.slice(1)) return;
        if (Array.isArray(c.blocks) && c.blocks.length && !c.blocks.includes(+sessKey[0])) return;
        ["sets", "reps", "rir", "note", "replace_with"].forEach((f) => { if (c[f] != null && c[f] !== "") out[f] = c[f]; });
        out.title = a.title || "Корректировка";
        out.why = c.why || a.reason || "";
      });
    });
    return Object.keys(out).length ? out : null;
  }
  function resolveItem(it, ctx, slotKey) {
    let b = it, variant = null;
    if (it.hl) { b = Object.assign({ ex: it.ex }, ctx.heavy ? it.hl.heavy : it.hl.light); variant = ctx.heavy ? "тяжёлый жим" : "лёгкий жим"; }
    if (it.weekAlt) b = Object.assign({}, it.weekAlt[ctx.heavy ? 0 : 1]);
    const adj = adjFor(b.ex, String(slotKey).split("-")[0]);
    if (adj) {
      b = Object.assign({}, b);
      if (adj.sets != null) b.sets = +adj.sets;
      if (adj.reps != null) b.reps = String(adj.reps);
      if (adj.rir != null) b.rir = String(adj.rir);
      if (adj.note != null) b.note = String(adj.note);
    }
    let exId = adj && adj.replace_with && EX[adj.replace_with] ? adj.replace_with : b.ex;
    const sw = state.swaps[slotKey];
    if (sw && (EX[b.ex].alts || []).concat(b.ex).includes(sw)) exId = sw;
    let sets = b.sets, reps = b.reps, rir = b.rir, myo = !!b.myo;
    if (myo) {
      if (ctx.light || ctx.low) { myo = false; sets = 2; reps = "12–15"; rir = ctx.light ? "3–4" : "2"; }
    } else if (ctx.light) { sets = Math.max(2, sets - 1); if (rir != null) rir = "3–4"; }
    else if (ctx.low && sets >= 3) { sets -= 1; rir = bumpRIR(rir, 1); }
    return { exId, baseId: b.ex, sets, reps, rir, myo, note: b.note || null, variant, tempo: b.tempo || null, adj };
  }
  function tiersFor(ctx) {
    const t = ctx.time <= 60 ? ["core"] : ctx.time <= 90 ? ["core", "std"] : ["core", "std", "max"];
    return ctx.low ? t.filter((x) => x !== "max") : t;
  }
  function groupVisible(g, ctx) {
    if (!tiersFor(ctx).includes(g.tier)) return false;
    if (g.kind === "sprint" && ctx.low) return false;
    return true;
  }

  /* ---------- dataset (exercises-dataset, MIT) ---------- */
  const BP_RU = { back: "Спина", cardio: "Кардио", chest: "Грудь", "lower arms": "Предплечья", "lower legs": "Голени и икры", neck: "Шея", shoulders: "Плечи", "upper arms": "Руки", "upper legs": "Бёдра и ягодицы", waist: "Пресс и кор" };
  const EQ_RU = { "body weight": "свой вес", dumbbell: "гантели", cable: "блок", barbell: "штанга", "leverage machine": "рычажный тренажёр", band: "резина", "smith machine": "Смит", kettlebell: "гиря", weighted: "с отягощением", "stability ball": "фитбол", "ez barbell": "EZ-гриф", assisted: "с помощью", "sled machine": "тренажёр на салазках", "medicine ball": "медбол", rope: "канат", roller: "ролик", "resistance band": "эспандер", "bosu ball": "босу", "olympic barbell": "олимпийский гриф", "wheel roller": "ролик для пресса", "upper body ergometer": "ручной эргометр", "skierg machine": "лыжный эргометр", hammer: "кувалда", "stationary bike": "велотренажёр", tire: "покрышка", "trap bar": "трэп-гриф", "elliptical machine": "эллипс", "stepmill machine": "степпер" };
  const MU_RU = { abs: "пресс", pectorals: "грудные", biceps: "бицепс", glutes: "ягодичные", delts: "дельты", triceps: "трицепс", "upper back": "верх спины", lats: "широчайшие", calves: "икры", quads: "квадрицепс", forearms: "предплечья", "cardiovascular system": "сердце и сосуды", hamstrings: "бицепс бедра", spine: "разгибатели спины", traps: "трапеции", adductors: "приводящие", "serratus anterior": "зубчатые", abductors: "отводящие", "levator scapulae": "поднимающая лопатку", shoulders: "плечи", quadriceps: "квадрицепс", core: "кор", chest: "грудь", "hip flexors": "сгибатели бедра", obliques: "косые", "lower back": "поясница", rhomboids: "ромбовидные", trapezius: "трапеции", deltoids: "дельты", "rear deltoids": "задние дельты", brachialis: "брахиалис", back: "спина", ankles: "голеностоп", feet: "стопы", "rotator cuff": "вращательная манжета", "latissimus dorsi": "широчайшие", "ankle stabilizers": "стабилизаторы голеностопа", soleus: "камбаловидная", wrists: "запястья", "upper chest": "верх груди", "wrist flexors": "сгибатели запястья", "wrist extensors": "разгибатели запястья", abdominals: "пресс", sternocleidomastoid: "грудино-ключичная", hands: "кисти", groin: "пах", "grip muscles": "хват", "lower abs": "низ пресса", "inner thighs": "внутренняя поверхность бедра", shins: "голени" };
  const ru = (map, k) => map[k] || k;
  const mediaImg = (stem) => `${MEDIA}videos/${stem}.gif`;
  function mediaBlock(stem, alt, forceShow) {
    if (!stem) return "";
    if (state.media || forceShow) return `<figure class="media"><img loading="lazy" decoding="async" src="${mediaImg(stem)}" width="180" height="180" alt="${esc(alt)}"><figcaption>${GV}</figcaption></figure>`;
    return `<button class="lnk small" data-showmedia="${esc(stem)}" data-alt="${esc(alt)}">Показать анимацию (${GV})</button>`;
  }
  function dsHTML(ex) {
    if (!ex.ds) return "";
    const d = ex.ds, name = d.nr || d.n;
    return `<div class="ds"><div class="how-sub">Пошагово — база упражнений <span class="muted">(${esc(name)})</span></div>
      <ol>${d.s.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
      ${d.nr ? `<div class="small muted en">Оригинал: <span lang="en">${esc(d.n)}</span></div>` : ""}
      ${mediaBlock(d.m, name)}</div>`;
  }

  /* ---------- render: shared ---------- */
  const TIER = { core: "ядро", std: "90+", max: "120" };
  const KIND = { pair: "Суперсет", tri: "Тройка по кругу", circuit: "Круг" };

  function skillCard(block, week, title) {
    const sk = P.blocks[block - 1].skill;
    const steps = sk.weeks.map((w, i) => `<span class="${i === week - 1 ? "on" : ""}" title="${esc(w)}">нед. ${i + 1}</span>`).join("");
    return `<div class="proto">
      <div class="big">${esc(title || "Навык блока")}: ${esc(sk.title)}</div>
      <div><b>Сегодня:</b> ${esc(sk.weeks[week - 1])}</div>
      <div class="skill-steps">${steps}</div>
      <div class="muted small">Цель блока: ${esc(sk.goal)}</div>
      <details class="how"><summary>Как делать</summary><div class="how-b"><ul>${sk.cues.map((c) => `<li>${rich(c)}</li>`).join("")}</ul></div></details>
    </div>`;
  }
  function sprintProto(ctx) {
    let head, body;
    if (ctx.light) { head = "1 спринт — разгрузочная неделя"; body = "3 мин легко → 20 с быстро, но не на максимум → 3 мин легко."; }
    else if (ctx.block === 1 && ctx.week <= 2) { head = "2 × 15 с примерно на 80 %"; body = "Адаптация: 3 мин легко → 15 с быстро → 3 мин легко → 15 с → 2–3 мин заминки."; }
    else { head = "2 × 20 с — всё, что есть"; body = "3 мин легко → 20 с максимально → 3 мин легко → 20 с → 2–3 мин заминки."; }
    return `<div class="proto"><div class="big">Спринты · ${head}</div><p>${body}</p>
      <p class="muted small">Велотренажёр с высоким сопротивлением или эйр-байк, не бег. Двух спринтов достаточно ${rich("{vollaard17}")} ${rich("{metcalfe12}")}. Никотин — не ближе чем за 1–2 часа.</p></div>`;
  }
  function n4Params(ctx) {
    if (ctx.light) return { n: 2, work: 4, rest: 3, head: "2 × 4 мин тяжело / 3 мин легко" };
    if (ctx.block === 1 && ctx.week <= 2) return { n: 3, work: 3, rest: 2, head: "3 × 3 мин умеренно-тяжело / 2 мин легко", note: "Адаптация: говоришь короткими фразами, не на максимум." };
    if (ctx.block === 1) return { n: 3, work: 3, rest: 2, head: "3 × 3 мин тяжело / 2 мин легко" };
    if (ctx.block === 2) return { n: 4, work: 4, rest: 3, head: "4 × 4 мин тяжело / 3 мин легко" };
    return { n: 4, work: 4, rest: 3, head: "4 × 4 мин (или 5 × 3) / 3 мин легко" };
  }
  function n4Proto(ctx) {
    const v = vars(), p = n4Params(ctx);
    return `<div class="proto"><div class="big">Интервалы · ${p.head}</div>
      ${p.note ? `<p><b>${p.note}</b></p>` : ""}
      <p>8–10 мин разминки — это и есть разминка дня. «Тяжело» — можешь сказать 3–4 слова, ${v.hr85}–${v.hr95} уд/мин. В конце 5 мин заминки.</p>
      <p class="muted small">По умолчанию велотренажёр или гребля. Дорожка с уклоном 8–12 % — если поясница спокойна. ${rich("{helgerud07}")}</p></div>`;
  }
  function z2Proto(len) {
    const v = vars();
    return `<div class="proto"><div class="big">Зона 2 · ${len || "15–20 мин"}</div>
      <p>Велотренажёр или гребля; ходьба в горку (уклон 6–10 %, 5–6 км/ч) — если спина спокойна. Разговорный темп — полными фразами, ${v.hr60}–${v.hr70} уд/мин.</p></div>`;
  }

  /* ---------- цель на сегодня: двойная прогрессия по прошлой записи ---------- */
  const numOf = (v) => { const n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : null; };
  function repRange(reps) {
    const m = String(reps || "").match(/(\d+)\s*(?:[–-]\s*(\d+))?/);
    return m ? [+m[1], +(m[2] || m[1])] : null;
  }
  function stepUp(w) { return w >= 20 ? Math.max(w + 2.5, Math.round((w * 1.025) / 2.5) * 2.5) : w + (w < 10 ? 1 : 2); }
  function progressionHint(r, ex, prev, prevRir, ctx) {
    if (!prev || ex.unit === "sec" || r.myo) return "";
    const sets = prev.sets.filter((s) => s && numOf(s.r) != null);
    if (!sets.length) return "";
    const range = repRange(r.reps), w = numOf(sets[0].w);
    const sameW = sets.every((s) => numOf(s.w) === w);
    if (ctx.light) return w ? `Разгрузка: около ${fmtNum(Math.round((w * 0.87) / 2.5) * 2.5)} кг, повторы с запасом 3–4.` : "Разгрузка: повторы с запасом 3–4.";
    if (ctx.low) return w ? `Самочувствие «так себе»: ${fmtNum(w)} кг, как в прошлый раз, повторы с запасом.` : "Самочувствие «так себе»: повторы с запасом.";
    if (!range) return "";
    const [lo, hi] = range;
    const need = Math.min(r.sets || sets.length, sets.length);
    const topHit = sets.length >= (r.sets || 1) && sameW && sets.slice(0, need).every((s) => numOf(s.r) >= hi);
    if (prevRir === "0" && r.rir && !/^0/.test(String(r.rir))) return w ? `В прошлый раз был отказ — оставь ${fmtNum(w)} кг и держи запас ${r.rir}.` : `В прошлый раз был отказ — держи запас ${r.rir}.`;
    if (topHit) return w ? `Цель: ${fmtNum(stepUp(w))} кг × ${lo}${lo !== hi ? "–" + hi : ""} — в прошлый раз верх диапазона во всех подходах.` : `Верх диапазона во всех подходах — добавь вес (2,5–5 кг) или замедли опускание.`;
    return w ? `Цель: ${fmtNum(w)} кг, добавь повтор там, где было меньше ${hi}.` : `Цель: добавь повтор там, где было меньше ${hi}.`;
  }

  function itemHTML(it, code, ctx, slotKey) {
    const r = resolveItem(it, ctx, slotKey);
    const ex = EX[r.exId];
    if (!ex) return "";
    const side = ex.side ? " на сторону" : "";
    let scheme;
    if (r.myo) scheme = `${r.sets} ${r.sets === 1 ? "майо-подход" : "майо-подхода"} <span class="rir">· 12–20 до отказа, затем мини-подходы по 3–5 через 15 с</span>`;
    else scheme = `${r.sets} <span class="x">×</span> ${esc(r.reps)}${side}${r.rir != null ? ` <span class="rir">· RIR ${esc(r.rir)}</span>` : ""}${r.tempo ? ` <span class="rir">· ${esc(r.tempo)}</span>` : ""}`;
    const prio = ex.m && ex.m.p.some((m) => P.muscles[m] && P.muscles[m].pr === 1);
    const tags = [];
    if (r.variant) tags.push(`<span class="tag">${esc(r.variant)}</span>`);
    if (r.adj) tags.push(`<span class="tag adj" title="${esc(r.adj.why || r.adj.title)}">корректировка</span>`);
    if (prio) tags.push(`<span class="tag">★ приоритет</span>`);
    (ex.tags || []).forEach((t) => tags.push(`<span class="tag">${esc(t)}</span>`));
    const opts = [r.baseId].concat(EX[r.baseId].alts || []);
    if (!opts.includes(r.exId)) opts.push(r.exId);
    const swapped = r.exId !== r.baseId;
    const swap = opts.length > 1 ? `<select class="swap ${swapped ? "on" : ""}" data-swap="${esc(slotKey)}" aria-label="Замена упражнения">${opts.map((id) => `<option value="${id}" ${id === r.exId ? "selected" : ""}>${id === r.baseId ? (swapped ? "↩ Вернуть: " + esc(EX[id].n) : "⇄ Замена") : esc(EX[id].n)}</option>`).join("")}</select>` : "";
    const how = `<div class="how-b pane" data-pane="how" hidden><div class="how-sub">Важно для тебя</div><ul>${(ex.cues || []).map((c) => `<li>${rich(c)}</li>`).join("")}</ul>${ex.why ? `<div class="why">${rich(ex.why)}</div>` : ""}${dsHTML(ex)}</div>`;

    const key = logKey(todayISO(), ctx.day);
    const todayE = state.logs[key] || {};
    const cur = (todayE.ex && todayE.ex[r.exId]) || [];
    const prev = lastFor(r.exId, key);
    const prevRir = prev && state.logs[prev.key] && state.logs[prev.key].rir ? state.logs[prev.key].rir[r.exId] : null;
    const hint = progressionHint(r, ex, prev, prevRir, ctx);
    const rirNow = todayE.rir ? todayE.rir[r.exId] : null;
    const rirPick = ex.unit === "sec" ? "" : `<div class="rir-pick"><span title="Сколько повторов оставалось в запасе в последнем подходе">В запасе</span>${["0", "1", "2", "3+"].map((v) => `<button class="chip ${rirNow === v ? "on" : ""}" data-rir="${esc(r.exId)}:${v}">${v}</button>`).join("")}</div>`;
    const nSets = Math.max(r.sets || 1, 1);
    const unitR = ex.unit === "sec" ? "сек" : "повт.";
    let rows = "";
    for (let i = 0; i < nSets; i++) {
      const c = cur[i] || {}, p = (prev && prev.sets[i]) || {};
      rows += `<div class="log-row"><span class="n">${i + 1}</span>
        <input inputmode="decimal" placeholder="${esc(p.w || "кг")}" value="${esc(c.w || "")}" data-log="${r.exId}" data-i="${i}" data-f="w" aria-label="Вес, подход ${i + 1}">
        <span class="x">×</span>
        <input inputmode="numeric" placeholder="${esc(p.r || unitR)}" value="${esc(c.r || "")}" data-log="${r.exId}" data-i="${i}" data-f="r" aria-label="Повторы, подход ${i + 1}"></div>`;
    }
    const hasToday = cur.some((c) => c && (c.w || c.r));
    const prevTxt = prev ? `Прошлый раз (${fmtDate(prev.date)}): ${prev.sets.filter((s) => s && (s.w || s.r)).map((s) => `${s.w || "—"}×${s.r || "—"}`).join(", ")}` : "Первая запись — вес подберёшь по RIR.";
    const logBlock = `<div class="log pane" data-pane="log" ${hasToday ? "" : "hidden"}>${hint ? `<div class="hint">${esc(hint)}</div>` : ""}${rows}${rirPick}<div class="prev">${esc(prevTxt)} <span class="saved" data-saved="${r.exId}">сохранено</span></div></div>`;
    const tools = `<div class="ex-tools"><button class="lnk" data-toggle="how" aria-expanded="false">Как делать</button><button class="lnk ${hasToday ? "on" : ""}" data-toggle="log" aria-expanded="${hasToday}">Записать${hasToday ? " ✓" : ""}</button>${swap}</div>`;

    return `<div class="ex">
      <div class="ex-h"><span class="code">${code}</span><div class="ex-main">
        <div class="ex-name">${esc(ex.n)}</div>
        <div class="scheme">${scheme}</div>
        ${r.note ? `<div class="ex-note">${esc(r.note)}</div>` : ""}
        ${r.adj && r.adj.why ? `<div class="ex-note adj-why">${esc(r.adj.title)}: ${esc(r.adj.why)}</div>` : ""}
        ${tags.length ? `<div class="tags">${tags.join("")}</div>` : ""}
        ${tools}${how}${logBlock}
      </div></div></div>`;
  }

  function groupHTML(g, ctx, sessKey) {
    const tier = `<span class="tier ${g.tier}">${TIER[g.tier]}</span>`;
    if (g.kind === "warmup") {
      const lines = g.items.map((it) => {
        if (it.skill) return `<div class="ex">${skillCard(ctx.block, ctx.week)}</div>`;
        if (it.text) return `<div class="ex"><div class="ex-note">${esc(it.text)}</div></div>`;
        const e = EX[it.ex];
        return `<div class="ex"><div class="ex-name">${esc(e.n)} · ${esc(it.dose)}</div><div class="ex-note">${esc((e.cues || []).join(". "))}</div></div>`;
      }).join("");
      return `<section class="group"><div class="group-h"><span class="gl">↑</span><div class="gt"><b>Разминка</b> · ${g.min} мин</div>${tier}</div><div class="group-b">${lines}</div></section>`;
    }
    if (g.kind === "sprint") return `<section class="group"><div class="group-h"><span class="gl">⚡</span><div class="gt"><b>Финиш</b> · 10 мин</div>${tier}</div><div class="group-b"><div class="ex">${sprintProto(ctx)}</div></div></section>`;
    if (g.kind === "n4x4") return ctx.low
      ? `<section class="group"><div class="group-h"><span class="gl">~</span><div class="gt"><b>Кардио</b> · вместо интервалов</div>${tier}</div><div class="group-b"><div class="ex">${z2Proto("30 мин, первые 5 — разминка")}</div></div></section>`
      : `<section class="group"><div class="group-h"><span class="gl">♥</span><div class="gt"><b>Мотор</b> · VO₂max</div>${tier}</div><div class="group-b"><div class="ex">${n4Proto(ctx)}</div></div></section>`;
    if (g.kind === "z2") return `<section class="group"><div class="group-h"><span class="gl">~</span><div class="gt"><b>Кардио</b> · зона 2</div>${tier}</div><div class="group-b"><div class="ex">${z2Proto()}</div></div></section>`;
    if (g.kind === "skill") return `<section class="group"><div class="group-h"><span class="gl">✦</span><div class="gt"><b>Навык</b> · 5 мин</div>${tier}</div><div class="group-b"><div class="ex">${skillCard(ctx.block, ctx.week, "Практика")}</div></div></section>`;
    const label = g.kind === "circuit" ? `${KIND.circuit} × ${ctx.light ? 2 : g.rounds}` : KIND[g.kind];
    const items = g.items.map((it, i) => itemHTML(it, `${g.id}${i + 1}`, ctx, `${sessKey}-${g.id}-${i}`)).join("");
    return `<section class="group"><div class="group-h"><span class="gl">${g.id}</span><div class="gt"><b>${label}</b>${g.rest ? ` · отдых ${esc(g.rest)}` : ""}</div>${tier}</div><div class="group-b">${items}</div></section>`;
  }

  function restSec(str) {
    if (!str) return 60;
    const nums = (String(str).replace(/,/g, ".").match(/\d+(\.\d+)?/g) || []).map(Number);
    if (!nums.length) return 60;
    const avg = nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
    return /мин/.test(str) ? avg * 60 : avg;
  }
  function groupMinutes(g, ctx, sessKey) {
    if (g.kind === "warmup") return g.min || 6;
    if (g.kind === "sprint") return 10;
    if (g.kind === "z2") return 18;
    if (g.kind === "skill") return 5;
    if (g.kind === "n4x4") { if (ctx.low) return 30; const p = n4Params(ctx); return 9 + p.n * (p.work + p.rest) + 5; }
    const items = g.items.map((it, i) => resolveItem(it, ctx, `${sessKey}-${g.id}-${i}`));
    const rounds = g.kind === "circuit" ? (ctx.light ? 2 : g.rounds) : Math.max(...items.map((r) => r.sets || 1));
    let sec = 90 + (g.ramp ? 180 : 0);
    for (let k = 1; k <= rounds; k++) {
      const act = g.kind === "circuit" ? items : items.filter((r) => (r.sets || 1) >= k);
      sec += act.reduce((a, r) => a + (r.myo ? 100 : 50) * (EX[r.exId].side ? 2 : 1), 0) + (act.length - 1) * 20 + (k < rounds ? restSec(g.rest) : 0);
    }
    return sec / 60;
  }
  function estMinutes(sess, ctx, sessKey) {
    const m = sess.groups.filter((g) => groupVisible(g, ctx)).reduce((a, g) => a + groupMinutes(g, ctx, sessKey) + 1, 0);
    return Math.round(m / 5) * 5;
  }

  /* ---------- install / update banners ---------- */
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let installEvt = null, waitingSW = null;
  function installBanner() {
    if (isStandalone() || S.get("installHintClosed", false)) return "";
    if (installEvt) return `<div class="banner accent row"><span><b>Установи как приложение</b> — откроется с экрана «Домой», работает без сети.</span><span class="row-btns"><button class="btn primary" data-install="1">Установить</button><button class="btn ghost" data-closehint="1" aria-label="Скрыть">✕</button></span></div>`;
    if (isIOS) return `<div class="banner accent row"><span><b>Установи на iPhone:</b> в Safari нажми «Поделиться» → «На экран „Домой“».</span><span class="row-btns"><button class="btn ghost" data-closehint="1" aria-label="Скрыть">✕</button></span></div>`;
    return "";
  }
  const updateBanner = () => waitingSW ? `<div class="banner warn row"><span><b>Доступна новая версия программы.</b></span><span class="row-btns"><button class="btn primary" data-update="1">Обновить</button></span></div>` : "";

  /* ---------- tab: today ---------- */
  function renderToday() {
    const ctx = ctxNow();
    const blk = P.blocks[ctx.block - 1];
    const sessKey = `${ctx.block}${ctx.day}`;
    const sess = P.sessions[sessKey];
    const wd = new Date().getDay();
    const banners = [updateBanner(), installBanner(), undoBanner()];
    const pd = plannedDays(), hasToday = ["A", "B", "C"].some((d) => entryHasData(state.logs[logKey(todayISO(), d)]));
    if (ctx.pre) banners.push(`<div class="banner accent">Старт — ${WD[parseISO(state.settings.start).getDay()]}, ${fmtDate(state.settings.start)}. Ниже первая неделя — можно начать и раньше.</div>`);
    else if (!pd.includes(wd) && !hasToday) banners.push(`<div class="banner">Сегодня ${WD[wd]} — по плану отдых: шаги и одна микродоза. Если всё же идёшь в зал — следующая по очереди тренировка уже выбрана.</div>`);
    if (ctx.next) banners.push(`<div class="banner accent">Неделя ${ctx.n - 1 || WEEKS} закрыта: A и B сделаны. С этой тренировки начнётся неделя ${ctx.week} блока ${ctx.block}.</div>`);
    if (ctx.light) banners.push(`<div class="banner warn"><b>Разгрузочная неделя.</b> Веса −10–15 %, подходов на один меньше, RIR 3–4. Загляни в «Журнал»: первая и последняя тренировка блока по каждому упражнению — это и есть прогресс блока.</div>`);
    else banners.push(fatigueBanner(ctx));
    if (ctx.low) banners.push(`<div class="banner warn"><b>Режим «так себе».</b> На подход меньше, +1 повтор в запасе, без спринтов и бонусов, интервалы — в зоне 2. Пришёл и сделал ядро — тренировка засчитана. Завтра режим сам вернётся в «норм».</div>`);
    else if (ctx.time <= 60) banners.push(`<div class="banner">60 минут — только ядро. Руки, икры и база всё равно получают нагрузку.</div>`);

    const dayBtn = (d, i) => {
      const sub = pd[i] != null ? WD_SHORT[pd[i]] + (d === "C" ? " · по желанию" : "") : d === "C" ? "по желанию" : "любой день";
      const ok = ctx.done[d] && !ctx.next ? " ✓" : "";
      return `<button data-day="${d}" class="${ctx.day === d ? "on" : ""}">${d}${ok}<small>${sub}</small></button>`;
    };
    const timeBtn = (t) => `<button data-time="${t}" class="${ctx.time === t ? "on" : ""}">${t}<small>мин</small></button>`;
    const groups = sess.groups.filter((g) => groupVisible(g, ctx)).map((g) => groupHTML(g, ctx, sessKey)).join("");

    return `
      ${banners.join("")}
      <div class="controls">
        <div class="seg" role="group" aria-label="Тренировка">${dayBtn("A", 0)}${dayBtn("B", 1)}${dayBtn("C", 2)}</div>
        <div class="ctl-pair">
          <div class="seg" role="group" aria-label="Время, минут">${timeBtn(60)}${timeBtn(90)}${timeBtn(120)}</div>
          <div class="seg" role="group" aria-label="Самочувствие">
            <button data-ready="ok" class="${!ctx.low ? "on" : ""}">Норм<small>как обычно</small></button>
            <button data-ready="low" class="${ctx.low ? "on" : ""}">Так себе<small>облегчить</small></button>
          </div>
        </div>
      </div>
      ${sess.note && ctx.day === "C" ? `<div class="banner">${esc(sess.note)}</div>` : ""}
      <div class="sess-head"><h2>${ctx.day} · ${esc(sess.title)}</h2><span class="sess-time">≈ ${estMinutes(sess, ctx, sessKey)} мин</span></div>
      <div class="weekbar"><span>Блок ${ctx.block} · неделя ${ctx.week} из 5${ctx.light ? " · разгрузка" : ""}</span><button class="lnk" data-tab="plan" data-cycfocus="1">Управлять циклом</button></div>
      ${groups}
      ${checkinHTML(ctx)}
      <section class="card soft"><h3>Цели блока «${esc(blk.name)}»</h3>${goalsHTML(ctx.block)}</section>
      <p class="muted small">Подходы сохраняются на устройстве сразу${SY && SY.signedIn() ? " и уходят в базу, когда есть сеть" : ""}. Резервная копия — «Ещё → Настройки».</p>`;
  }

  /* ---------- итог тренировки ---------- */
  const JOINTS = [["knee", "Колени"], ["back", "Спина"], ["elbow", "Локти"], ["shoulder", "Плечи"]];
  const JOINT_LV = ["", "дискомфорт", "боль"];
  function checkinHTML(ctx) {
    const e = state.logs[logKey(todayISO(), ctx.day)] || {};
    const s = e.s || {}, j = s.joints || {};
    const chips = JOINTS.map(([k, n]) => {
      const lv = +j[k] || 0;
      return `<button class="chip jt lv${lv}" data-joint="${k}" aria-pressed="${lv > 0}" aria-label="${n}: ${JOINT_LV[lv] || "в порядке"}">${n}${lv ? ` · ${JOINT_LV[lv]}` : ""}</button>`;
    }).join("");
    return `<section class="card checkin" id="checkin">
      <h3>Итог тренировки</h3>
      <p class="small muted">Что-то беспокоило? Касание — дискомфорт, ещё одно — боль, третье — сбросить. По этим отметкам приложение подскажет разгрузку, а агент учтёт их в корректировках.</p>
      <div class="chips">${chips}</div>
      <label class="note-lab">Заметка<textarea data-note="1" rows="2" maxlength="500" placeholder="Например: колено отозвалось на жиме ногами, сон 6 часов">${esc(s.note || "")}</textarea></label>
    </section>`;
  }

  /* ---------- усталость и разгрузка ---------- */
  function sessionsByDate() {
    return Object.keys(state.logs).filter((k) => entryHasData(state.logs[k])).sort().reverse().map((k) => ({ k, date: k.slice(0, 10), e: state.logs[k] }));
  }
  function fatigueReasons() {
    const list = sessionsByDate(), today = todayISO();
    const last3 = list.slice(0, 3), reasons = [];
    if (last3.filter((x) => x.e.ready === "low").length >= 2) reasons.push("самочувствие «так себе» в 2 из 3 последних тренировок");
    const pain = list.filter((x) => daysBetween(x.date, today) <= 14 && x.e.s && x.e.s.joints && Object.values(x.e.s.joints).some((v) => +v >= 2));
    if (pain.length >= 2) reasons.push("боль в суставах дважды за 2 недели");
    return reasons;
  }
  function fatigueBanner(ctx) {
    const r = fatigueReasons();
    if (!r.length || S.get("fatigueSkip", -1) === ctx.cyc.idx) return "";
    return `<div class="banner warn row"><span><b>Похоже на накопленную усталость:</b> ${esc(r.join("; "))}. Можно сделать разгрузку сейчас, а блок продолжить после неё.</span>
      <span class="row-btns"><button class="btn primary" data-cyc="deload">Разгрузка</button><button class="btn ghost" data-fatigueskip="1">Не сейчас</button></span></div>`;
  }
  function goalsHTML(block) {
    const g = state.goals["b" + block] || [];
    return `<div class="goals">${P.blocks[block - 1].targets.map((t, i) => `<label><input type="checkbox" data-goal="${block}:${i}" ${g[i] ? "checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div>`;
  }

  /* ---------- tab: plan ---------- */
  function weeklyVolume(block, withSat) {
    const vol = {};
    const add = (m, k, v) => { vol[m] = vol[m] || { d: 0, i: 0 }; vol[m][k] += v; };
    ["A", "B"].concat(withSat ? ["C"] : []).forEach((day) => {
      P.sessions[`${block}${day}`].groups.forEach((g) => {
        if (!g.items || g.kind === "warmup" || g.tier === "max") return;
        g.items.forEach((it) => {
          const b = it.hl ? Object.assign({ ex: it.ex }, it.hl.heavy) : it.weekAlt ? it.weekAlt[0] : it;
          const adj = adjFor(b.ex, `${block}${day}`);
          const ex = EX[adj && adj.replace_with && EX[adj.replace_with] ? adj.replace_with : b.ex];
          if (!ex || !ex.m) return;
          const sets = adj && adj.sets != null ? +adj.sets : b.myo ? (b.eff || 2) : b.sets;
          ex.m.p.forEach((m) => add(m, "d", sets));
          ex.m.s.forEach((m) => add(m, "i", sets));
        });
      });
    });
    return vol;
  }
  function volumeChart(block, withSat) {
    const vol = weeklyVolume(block, withSat);
    const rows = Object.keys(P.muscles).filter((m) => !P.muscles[m].hide).map((m) => {
      const v = vol[m] || { d: 0, i: 0 };
      return { n: P.muscles[m].n, pr: P.muscles[m].pr, d: v.d, i: v.i, t: v.d + v.i * 0.5 };
    });
    const max = Math.max(...rows.map((r) => r.t), 1);
    const col = { 1: "var(--p1)", 2: "var(--p2)", 3: "var(--p3)", 0: "var(--p0)" };
    const bars = rows.map((r) => {
      const w = (r.t / max) * 100;
      const tip = `${r.n}: ${fmtNum(r.t)} подх./нед. — прямые ${fmtNum(r.d)}, косвенные ${fmtNum(r.i)} × 0,5`;
      return `<div class="bar-row" title="${esc(tip)}"><div class="bar-lab">${esc(r.n)}</div>
        <div class="bar-track"><div class="bar" style="width:max(3px, calc(${w}% - 40px));background:${col[r.pr]}"></div>
        <span class="bar-val" style="left:max(3px, calc(${w}% - 40px))">${fmtNum(r.t)}</span></div></div>`;
    }).join("");
    return `<div class="chart" role="img" aria-label="Подходы в неделю по мышцам">${bars}</div>
      <div class="legend"><span><i style="background:var(--p1)"></i>Приоритет 1 — руки, икры</span><span><i style="background:var(--p2)"></i>Приоритет 2 — дельты</span><span><i style="background:var(--p3)"></i>Приоритет 3 — спина</span><span><i style="background:var(--p0)"></i>Остальное</span></div>`;
  }
  /* ---------- цикл: карточка и действия ---------- */
  let lastUndo = null;
  function undoBanner() {
    if (!lastUndo || Date.now() - lastUndo.at > 180000) return "";
    return `<div class="banner row"><span>${esc(lastUndo.label)}</span><span class="row-btns"><button class="btn" data-undo="1">Отменить</button></span></div>`;
  }
  const wkName = (idx) => { const p = posOfIdx(idx); return `неделя ${p.week} блока ${p.block}${p.week === 5 ? " (разгрузка)" : ""}`; };
  function cycleAction(kind, arg) {
    const cyc = cycleState(), cur = posOfIdx(cyc.idx);
    const blockStart = cyc.idx - (cur.week - 1);
    let to = cyc.idx, label;
    if (kind === "next") { to = cyc.idx + 1; label = `Дальше: ${wkName(to)}.`; }
    else if (kind === "repeat") { label = `${wkName(to)[0].toUpperCase() + wkName(to).slice(1)} начнётся заново.`; }
    else if (kind === "deload") { to = blockStart + 4; label = `Разгрузка сейчас: ${wkName(to)}. После неё — следующий блок.`; }
    else if (kind === "nextblock") { to = blockStart + 5; label = `Начат блок ${posOfIdx(to).block} «${P.blocks[posOfIdx(to).block - 1].name}».`; }
    else if (kind === "goto") { to = cyc.idx - (cur.n - 1) + (+arg - 1); label = `Перешли: ${wkName(to)}.`; }
    else return;
    const prev = setCycle({ idx: to, since: todayISO() }, kind);
    if (["A", "B", "C"].some((d) => entryHasData(state.logs[logKey(todayISO(), d)]))) label += " Сегодняшняя записанная тренировка остаётся в прежней неделе.";
    lastUndo = { prev, label, at: Date.now() };
    state.day = suggestDay();
    render();
  }
  function idxSessions() {
    const by = {};
    Object.keys(state.logs).forEach((k) => {
      const e = state.logs[k];
      if (!entryHasData(e)) return;
      const idx = e.idx != null ? e.idx : (e.block && e.week ? (e.block - 1) * 5 + e.week - 1 : null);
      if (idx == null) return;
      (by[idx] = by[idx] || new Set()).add(k.slice(11));
    });
    return by;
  }
  function plural(n, one, few, many) { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many; }
  function cycleCard(ctx) {
    const cyc = ctx.cyc, cur = posOfIdx(cyc.idx), base = cyc.idx - (cur.n - 1), by = idxSessions();
    const blocks = P.blocks.map((b, bi) => {
      const cells = [0, 1, 2, 3, 4].map((w) => {
        const i = bi * 5 + w, idx = base + i, s = by[idx];
        const n = s ? s.size : 0;
        let st = i + 1 < cur.n ? (n >= 2 ? "done" : n === 1 ? "part" : "miss") : i + 1 === cur.n ? "cur" : "fut";
        const lab = `Блок ${b.id}, неделя ${w + 1}${w === 4 ? " — разгрузка" : ""}: ${st === "cur" ? "сейчас" : st === "fut" ? "впереди" : n ? `тренировок ${n}` : "пропущена"}`;
        return `<span class="wk ${st}${w === 4 ? " dl" : ""}" title="${esc(lab)}" aria-label="${esc(lab)}">${w + 1}</span>`;
      }).join("");
      return `<div class="cyc-b"><div class="cyc-cells">${cells}</div><small>${esc(b.name)}</small></div>`;
    }).join("");
    const doneTxt = ["A", "B", "C"].map((d) => `${d} ${ctx.done[d] && !ctx.next ? "✓" : "—"}`).join(" · ");
    const toDeload = 5 - cur.week;
    const dl = cur.week === 5 ? "Сейчас разгрузка." : `Разгрузка — через ${toDeload} ${plural(toDeload, "неделю", "недели", "недель")} выполнения.`;
    const opts = Array.from({ length: WEEKS }, (_, i) => `<option value="${i + 1}" ${i + 1 === cur.n ? "selected" : ""}>Блок ${Math.floor(i / 5) + 1} · неделя ${(i % 5) + 1}${i % 5 === 4 ? " · разгрузка" : ""}</option>`).join("");
    return `<section class="card cycle" id="cycle">
      <h3>Цикл${cur.cycle > 1 ? ` · круг ${cur.cycle}` : ""}</h3>
      <div class="cyc" role="group" aria-label="Недели программы">${blocks}</div>
      <div class="legend"><span><i class="lg done"></i>сделана</span><span><i class="lg part"></i>частично</span><span><i class="lg miss"></i>пропущена</span><span><i class="lg cur"></i>сейчас</span><span><i class="lg dl"></i>разгрузка</span></div>
      <p class="small"><b>Сейчас:</b> блок ${cur.block} «${esc(P.blocks[cur.block - 1].name)}», неделя ${cur.week} из 5. Сделано: ${doneTxt}. ${dl}</p>
      <div class="ex-tools cyc-btns">
        <button class="btn" data-cyc="next">Следующая неделя</button>
        <button class="btn" data-cyc="repeat">Повторить неделю</button>
        ${cur.week !== 5 ? `<button class="btn" data-cyc="deload">Разгрузка сейчас</button>` : ""}
        <button class="btn" data-cyc="nextblock">Следующий блок</button>
      </div>
      <label class="small cyc-go">Перейти к неделе <select data-cycgo="1" aria-label="Перейти к неделе">${opts}</select></label>
      <p class="small muted">Неделя закрывается, когда сделаны A и B; C — по желанию. Пропуски не сбивают программу — она ждёт на той же неделе. Разгрузка — каждая 5-я неделя блока; накопилась усталость — сделай её раньше.</p>
    </section>`;
  }
  function weekGrid() {
    const pd = plannedDays(), order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((wd) => {
      const i = pd.indexOf(wd), lab = i < 0 ? "шаги" : ["A", "B", "C"][i];
      return `<button class="wd ${i < 0 ? "" : i === 2 ? "opt" : "on"}" data-wday="${wd}" aria-pressed="${i >= 0}"><b>${lab}</b>${WD_SHORT[wd]}</button>`;
    }).join("");
  }
  function toggleWeekday(wd) {
    let pd = plannedDays().slice();
    const i = pd.indexOf(wd);
    if (i >= 0) { if (pd.length === 1) return "Нужен хотя бы один день."; pd.splice(i, 1); }
    else { if (pd.length >= 3) return "Максимум три дня: A, B и C. Сначала сними один из них."; pd.push(wd); }
    state.settings = Object.assign({}, state.settings, { days: pd.sort((a, b) => monFirst(a) - monFirst(b)) });
    S.set("settings", state.settings);
    state.day = suggestDay();
    return "";
  }

  function renderPlan() {
    const ctx = ctxNow();
    if (!state.volBlock) state.volBlock = ctx.block;
    const grid = weekGrid();
    const blocks = P.blocks.map((b) => `<div class="blk ${b.id === ctx.block ? "cur" : ""}">
        <h3>Блок ${b.id} «${esc(b.name)}» <small>недели ${b.weeks}</small></h3>
        <p>${esc(b.theme)}</p>
        <p class="small"><b>Навык:</b> ${esc(b.skill.title)} — ${esc(b.skill.goal)}.</p>
        <div class="small"><b>Цели:</b>${goalsHTML(b.id)}</div></div>`).join("");
    const blkBtns = P.blocks.map((b) => `<button data-volblock="${b.id}" class="${state.volBlock === b.id ? "on" : ""}">Блок ${b.id}</button>`).join("");
    return `
      ${undoBanner()}
      ${cycleCard(ctx)}
      <section class="card">
        <h3>Дни тренировок</h3>
        <div class="week-grid" role="group" aria-label="Дни тренировок">${grid}</div>
        <p class="small muted" id="wdayMsg" role="status">Нажми на день, чтобы сделать его тренировочным или выходным — до трёх дней: A, B и C по порядку. Пропустил день — следующая тренировка предложится в любой другой.</p>
        <p class="small muted">A — низ, жим лёжа, трицепс. B — спина, задняя поверхность, бицепс. C — интервалы и памп, по желанию. Икры, дельты и руки — в обеих основных тренировках.</p>
      </section>
      <h2>Как это устроено</h2>
      <section class="card">${rich(P.content.how)}</section>
      <h2>Три блока по 5 недель</h2>
      <div class="blocks">${blocks}</div>
      <p class="small muted">После 15-й недели — пересмотр по журналу или второй круг с заменами упражнений.</p>
      <h2>Куда идут подходы</h2>
      <section class="card">
        <div class="chart-ctl"><div class="seg" style="max-width:320px">${blkBtns}</div>
          <label class="chk"><input type="checkbox" data-volsat="1" ${state.volSat ? "checked" : ""}> + суббота</label></div>
        ${volumeChart(state.volBlock, state.volSat)}
        <p class="small muted" style="margin-top:8px">Рабочие подходы в неделю в режиме 90 минут. Косвенная работа (например, бицепс в подтягиваниях) считается за половину подхода — такой счёт точнее всего предсказывает рост ${rich("{pelland26}")}.</p>
      </section>
      <h2>Нюансы</h2>
      <section class="card">${rich(P.content.progression)}</section>`;
  }

  /* ---------- tab: library ---------- */
  const LIB = { items: null, loading: false, error: null, q: "", bp: "all", eq: "all", limit: 40 };
  const progByDs = {};
  Object.values(EX).forEach((e) => { if (e.ds) (progByDs[e.ds.id] = progByDs[e.ds.id] || []).push(e.n); });
  // ?v= из адреса скрипта: база кэшируется вместе с версией сборки и не залипает старой копией.
  const BUILD_V = (() => { try { return new URL(document.currentScript.src).searchParams.get("v") || ""; } catch (e) { return ""; } })();
  const fold = (s) => String(s || "").toLowerCase().replace(/ё/g, "е");
  // Грубая основа слова: «гантели» находит «гантелями», «штанги» — «штангой», «лежа» — «лёжа».
  const stem = (w) => { const s = w.replace(/[аяыиоеуюйьэ]+$/, ""); return s.length >= 3 ? s : w; };
  const libName = (x) => x.r || x.n;
  const sortKey = (x) => libName(x).replace(/^[«"“(]+/, "");
  function loadLib() {
    if (LIB.items || LIB.loading) return;
    LIB.loading = true;
    fetch("data/exercises-ru.json" + (BUILD_V ? "?v=" + BUILD_V : "")).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then((j) => {
        LIB.items = j.items.map((x) => Object.assign(x, {
          _r: fold(libName(x)), _n: fold(x.n), _t: fold(ru(MU_RU, x.t)),
          _w: " " + fold(libName(x)).replace(/[«»"(),\-]/g, " "),
          _h: fold(`${ru(BP_RU, x.bp)} ${ru(MU_RU, x.t)} ${ru(EQ_RU, x.eq)} ${x.sec.map((m) => ru(MU_RU, m)).join(" ")} ${(progByDs[x.id] || []).join(" ")}`),
        })).sort((a, b) => sortKey(a).localeCompare(sortKey(b), "ru"));
        LIB.loading = false; if (state.tab === "library") render();
      })
      .catch((e) => { LIB.loading = false; LIB.error = String(e.message || e); if (state.tab === "library") render(); });
  }
  // Поиск по русскому и английскому названию, мышцам, оборудованию; «е» находит «ё».
  // Порядок: название начинается с запроса → запрос с начала слова → все слова в названии с начала слов →
  // все слова где-то в названии («жим» внутри «отжиманий») → английское название → остальное
  // (по доле слов в названии и совпадению целевой мышцы).
  function libFiltered() {
    const q = fold(LIB.q.trim()).replace(/\s+/g, " "), words = q ? q.split(" ").map(stem) : [];
    const out = [];
    LIB.items.forEach((x) => {
      if (LIB.bp === "prog" && !progByDs[x.id]) return;
      if (LIB.bp !== "all" && LIB.bp !== "prog" && x.bp !== LIB.bp) return;
      if (LIB.eq !== "all" && x.eq !== LIB.eq) return;
      if (!words.length) { out.push([0, x]); return; }
      const hay = `${x._r} ${x._n} ${x._h}`;
      if (!words.every((w) => hay.includes(w))) return;
      const inName = words.filter((w) => x._r.includes(w)).length;
      const rank = x._r.startsWith(q) ? 0 : x._w.includes(" " + q) ? 1 : words.every((w) => x._w.includes(" " + w)) ? 2
        : inName === words.length ? 2.5 : x._n.includes(q) ? 3
        : 4 + (words.length - inName) / words.length + (words.some((w) => x._t.includes(w)) ? 0 : 0.5);
      out.push([rank, x]);
    });
    return out.sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  }
  function libRow(x) {
    const inProg = progByDs[x.id];
    return `<div class="lib-row" data-libid="${x.id}" role="button" tabindex="0" aria-expanded="false">
      <div class="lib-n">${esc(libName(x))}${inProg ? ` <span class="tag">в программе</span>` : ""}</div>
      <div class="lib-m">${esc(ru(MU_RU, x.t))} · ${esc(ru(EQ_RU, x.eq))}${inProg ? ` · ${esc(inProg.join(", "))}` : ""}</div></div>`;
  }
  function libDetail(x) {
    return `<div class="lib-d">
      <div class="small muted">Зона: ${esc(ru(BP_RU, x.bp))} · цель: ${esc(ru(MU_RU, x.t))}${x.sec.length ? ` · помогают: ${esc(x.sec.map((m) => ru(MU_RU, m)).join(", "))}` : ""} · ${esc(ru(EQ_RU, x.eq))}</div>
      <ol>${x.s.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      ${x.r ? `<div class="small muted en">Оригинал: <span lang="en">${esc(x.n)}</span></div>` : ""}
      ${mediaBlock(`${x.id}-${x.m}`, libName(x))}</div>`;
  }
  function libListHTML() {
    if (!LIB.items) return LIB.error ? `<div class="empty">Не получилось загрузить базу (${esc(LIB.error)}). При первом открытии нужна сеть.</div>` : `<div class="empty">Загружаю базу упражнений…</div>`;
    const f = libFiltered();
    const rows = f.slice(0, LIB.limit).map(libRow).join("");
    return `<div class="small muted" style="margin:4px 0 8px">Найдено: ${f.length}</div>${rows || `<div class="empty">Ничего не нашлось.</div>`}
      ${f.length > LIB.limit ? `<button class="btn" style="width:100%;margin-top:10px" data-libmore="1">Показать ещё</button>` : ""}`;
  }
  function renderLibrary() {
    loadLib();
    const bps = [["all", "Все"], ["prog", "В программе"], ["upper arms", "Руки"], ["shoulders", "Плечи"], ["chest", "Грудь"], ["back", "Спина"], ["upper legs", "Бёдра"], ["lower legs", "Икры"], ["waist", "Кор"], ["lower arms", "Предплечья"], ["cardio", "Кардио"]];
    const eqs = ["all"].concat(Object.keys(EQ_RU));
    return `
      <div class="lib-tools">
        <input type="search" class="search" placeholder="Поиск: жим лёжа, тяга, бицепс, bench…" value="${esc(LIB.q)}" data-libq="1" aria-label="Поиск упражнения">
        <div class="chips">${bps.map(([k, n]) => `<button class="chip ${LIB.bp === k ? "on" : ""}" data-libbp="${k}">${n}</button>`).join("")}</div>
        <select data-libeq="1" aria-label="Оборудование">${eqs.map((k) => `<option value="${esc(k)}" ${LIB.eq === k ? "selected" : ""}>${k === "all" ? "Любое оборудование" : esc(ru(EQ_RU, k))}</option>`).join("")}</select>
      </div>
      <div id="libList">${libListHTML()}</div>
      <p class="small muted" style="margin-top:14px">База: <a href="https://github.com/hasaneyldrm/exercises-dataset" target="_blank" rel="noopener">exercises-dataset</a> — 1324 упражнения, инструкции на русском (данные по лицензии MIT). Названия перевели для приложения, искать можно и по-английски. Анимации — ${GV}; в приложение не скопированы и подгружаются по ссылке, только если ты их включишь.</p>`;
  }

  /* ---------- tabs: static ---------- */
  const renderCardio = () => rich(P.content.cardio);
  const renderBody = () => rich(P.content.body);
  const renderFood = () => rich(P.content.food);
  function renderScience() {
    const items = P.content.science.map((s) => `<div class="sci"><h3>${esc(s.h)}</h3><p>${rich(s.p)}</p></div>`).join("");
    const src = Object.values(P.sources).map((s) => `<li><a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.a)}</a>. ${esc(s.t)}. <span class="j">${esc(s.j)}</span></li>`).join("");
    return `<section class="card">${items}</section>
      <h2>Источники</h2><section class="card"><ol class="sources">${src}</ol>
      <p class="small muted">Часть исследований сделана на нетренированных или молодых людях — направление эффекта переносится, точные проценты могут отличаться.</p></section>`;
  }
  function renderMore() {
    const n = Object.keys(P.sources).length;
    const bodyMenu = P.meta.bodyMenu || ["Суставы и сигналы", "Светофор нагрузки, красные флаги"];
    const items = [["cardio", "Кардио и движение", "Шаги, спринты, интервалы 4×4, микродозы"], ["body", bodyMenu[0], bodyMenu[1]], ["food", "Питание", "Белок, углеводы без гарниров, фазы"], ["science", "Почему так", `Принципы и ${n} источника`], ["settings", "Настройки", "Аккаунт, синхронизация, старт, вес, пульс"]];
    return `<div class="menu">${items.map(([id, t, d]) => `<button class="menu-i" data-tab="${id}"><span><b>${esc(t)}</b><small>${esc(d)}</small></span><span aria-hidden="true">›</span></button>`).join("")}</div>
      <p class="small muted" style="margin-top:16px">Апгрейд · программа v${P.meta.version}. <span id="syncFoot">${esc(footText())}</span></p>`;
  }

  /* ---------- account & sync ---------- */
  function agoText(t) {
    if (!t) return "ещё не было";
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "только что";
    if (m < 60) return `${m} мин назад`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} ч назад`;
    return fmtDate(isoOf(new Date(t)));
  }
  function syncText(st) {
    switch (st.state) {
      case "syncing": return "Синхронизация…";
      case "offline": return st.pending ? `Нет сети — изменений в очереди: ${st.pending}. Уйдут, когда появится связь.` : "Нет сети. Данные на устройстве в порядке.";
      case "denied": return "У этого аккаунта пока нет доступа к синхронизации.";
      case "expired": return "Сессия истекла — войди заново. Данные на устройстве сохранены.";
      case "error": return `Не получилось синхронизировать: ${st.error || "ошибка"}. Попробую ещё раз позже.`;
      default: return st.pending ? `Изменений в очереди: ${st.pending}` : `Синхронизировано ${agoText(st.last)}`;
    }
  }
  function footText() {
    if (!SY || !SY.configured() || !SY.signedIn()) return "Данные хранятся на этом устройстве.";
    return `Данные синхронизируются: ${SY.Auth.user().email}.`;
  }
  function renderAccount() {
    if (!SY || !SY.configured()) {
      return `<section class="card" id="acct"><h3>Аккаунт и синхронизация</h3><p class="small">Синхронизация пока не настроена — всё хранится на этом устройстве.</p></section>`;
    }
    const st = SY.status(), user = SY.Auth.user(), pend = SY.Auth.pendingEmail();
    if (user && st.state !== "expired") {
      return `<section class="card" id="acct">
        <h3>Аккаунт и синхронизация</h3>
        <p class="small">Вход: <b>${esc(user.email)}</b></p>
        <p class="small" id="syncStatus" role="status">${esc(syncText(st))}</p>
        <div class="ex-tools"><button class="btn" data-sync="now">Синхронизировать</button><button class="btn ghost" data-auth="signout">Выйти</button></div>
      </section>`;
    }
    if (pend) {
      return `<section class="card" id="acct">
        <h3>Вход</h3>
        <p class="small">Код отправлен на <b>${esc(pend)}</b>. Письмо обычно приходит за минуту — загляни и в «Спам».</p>
        <div class="form-grid one"><label>Код из письма<input name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" data-enter="verify"></label></div>
        <div class="ex-tools"><button class="btn primary" data-auth="verify">Войти</button><button class="btn" data-auth="resend">Новый код</button><button class="btn ghost" data-auth="cancel">Другая почта</button></div>
        <p class="small muted" id="authMsg" role="status"></p>
      </section>`;
    }
    const expired = user && st.state === "expired";
    return `<section class="card" id="acct">
      <h3>Аккаунт и синхронизация</h3>
      <p class="small">${expired ? "Сессия истекла — войди заново. Данные на устройстве на месте и уйдут в базу после входа." : "Войди по коду из письма — журнал и замеры будут сохраняться в базе и появятся на всех твоих устройствах. Без входа приложение работает так же, но только на этом устройстве."}</p>
      <div class="form-grid one"><label>Почта<input type="email" name="email" autocomplete="email" inputmode="email" placeholder="you@example.com" value="${esc(expired ? user.email : "")}" data-enter="send"></label></div>
      <div class="ex-tools"><button class="btn primary" data-auth="send">Получить код</button></div>
      <p class="small muted" id="authMsg" role="status"></p>
    </section>`;
  }
  let signoutArmed = 0;
  async function authAction(kind, btn) {
    const say = (s, err) => { const m = $("#authMsg"); if (m) { m.textContent = s; m.classList.toggle("err", !!err); } };
    const box = $("#acct");
    if (kind === "signout") {
      if (Date.now() - signoutArmed > 4000) { signoutArmed = Date.now(); btn.textContent = "Точно выйти?"; return; }
      signoutArmed = 0; btn.disabled = true; btn.textContent = "Выхожу…";
      await SY.Auth.signOut();
      return; // onOverlay(null) перезагрузит страницу
    }
    if (kind === "cancel") { SY.Auth.cancelCode(); render(); return; }
    try {
      btn.disabled = true;
      if (kind === "send" || kind === "resend") {
        const email = kind === "resend" ? SY.Auth.pendingEmail() : box.querySelector('[name="email"]').value;
        say("Отправляю код…");
        await SY.Auth.sendCode(email);
        render();
        if (kind === "resend") say("Отправил новый код.");
        const o = $('#acct [name="otp"]'); if (o) o.focus();
      } else if (kind === "verify") {
        say("Проверяю код…");
        await SY.Auth.verifyCode(box.querySelector('[name="otp"]').value);
        render();
      }
    } catch (e) {
      say(e.message || "Что-то пошло не так", true);
    } finally {
      if (btn.isConnected) btn.disabled = false;
    }
  }

  /* ---------- tab: journal ---------- */
  function progressData() {
    const by = {};
    Object.keys(state.logs).sort().forEach((k) => {
      const e = state.logs[k], date = k.slice(0, 10);
      Object.entries(e.ex || {}).forEach(([id, sets]) => {
        let best = null;
        sets.forEach((s) => {
          if (!s) return;
          const w = parseFloat(String(s.w).replace(",", ".")) || 0, r = parseFloat(String(s.r).replace(",", ".")) || 0;
          if (!r) return;
          const score = w > 0 ? w * (1 + r / 30) : r;
          if (!best || score > best.score) best = { w, r, score };
        });
        if (best) (by[id] = by[id] || []).push(Object.assign({ date }, best));
      });
    });
    return by;
  }
  function spark(pts) {
    if (pts.length < 2) return `<svg width="84" height="26" aria-hidden="true"></svg>`;
    const ys = pts.map((p) => p.score), mn = Math.min(...ys), mx = Math.max(...ys), rg = mx - mn || 1;
    const d = pts.map((p, i) => `${(i / (pts.length - 1)) * 80 + 2},${22 - ((p.score - mn) / rg) * 18}`).join(" ");
    return `<svg width="84" height="26" viewBox="0 0 84 26" aria-hidden="true"><polyline points="${d}" fill="none" style="stroke:var(--series)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  const CH = window.Charts || null;
  const JT = [["progress", "Прогресс"], ["volume", "Объём"], ["body", "Тело"]];
  function renderJournal() {
    const jt = state.jtab || "progress";
    const seg = `<div class="seg jseg" role="tablist" aria-label="Разделы журнала">${JT.map(([k, n]) => `<button data-jtab="${k}" class="${jt === k ? "on" : ""}" role="tab" aria-selected="${jt === k}">${n}</button>`).join("")}</div>`;
    return seg + (jt === "volume" ? journalVolume() : jt === "body" ? journalBody() : journalProgress());
  }

  /* --- регулярность и упражнения --- */
  function adherenceHTML() {
    const cyc = cycleState(), by = idxSessions(), today = todayISO(), list = sessionsByDate();
    const from = Math.max(0, cyc.idx - 9), cols = [];
    for (let i = from; i <= cyc.idx; i++) { const p = posOfIdx(i); cols.push({ n: by[i] ? by[i].size : 0, lab: `${p.block}·${p.week}`, cur: i === cyc.idx }); }
    const last28 = list.filter((x) => daysBetween(x.date, today) < 28).length;
    let closed = 0;
    for (let i = 0; i < cyc.idx; i++) { const s = by[i]; if (s && s.has("A") && s.has("B")) closed++; }
    const since = list.length ? daysBetween(list[0].date, today) : null;
    const MAXN = 3, BAR = 56, BASE = 20;
    const colsHTML = cols.map((c) => `<div class="col ${c.cur ? "cur" : ""}" title="Блок·неделя ${c.lab}: тренировок ${c.n}"><div class="ba"><span class="cv">${c.n || ""}</span><i style="height:${Math.round((c.n / MAXN) * BAR)}px"></i></div><small>${c.lab}</small></div>`).join("");
    return `<section class="card">
      <h3>Регулярность</h3>
      <div class="stats">
        <div class="stat"><b>${last28}</b><span>${plural(last28, "тренировка", "тренировки", "тренировок")} за 4 нед.</span></div>
        <div class="stat"><b>${closed}</b><span>${plural(closed, "неделя закрыта", "недели закрыто", "недель закрыто")}</span></div>
        <div class="stat"><b>${since == null ? "—" : since}</b><span>${since == null ? "тренировок ещё не было" : plural(since, "день", "дня", "дней") + " с последней"}</span></div>
      </div>
      <div class="cols" role="img" aria-label="Тренировок в неделю программы за последние ${cols.length} недель">${colsHTML}<div class="target" style="bottom:${BASE + Math.round((2 / MAXN) * BAR)}px"><span>A + B</span></div></div>
      <p class="small muted">Столбик — тренировки в неделе программы (подпись — блок·неделя), линия — обязательные A и B.</p>
    </section>`;
  }
  function exerciseDetail(id, arr) {
    const ex = EX[id], weighted = arr.some((p) => p.w > 0);
    const pts = arr.map((p) => ({ d: p.date, v: weighted ? Math.round(p.score * 10) / 10 : p.r, note: weighted ? `${fmtNum(p.w)} × ${fmtNum(p.r)}` : `${fmtNum(p.r)} повт.` }));
    const chart = CH && pts.length ? CH.slot({ height: 190, unit: weighted ? "кг" : "", digits: weighted ? 0 : 0, label: `${ex ? ex.n : id}: ${weighted ? "расчётный 1ПМ" : "повторы"} по тренировкам`, series: [{ name: weighted ? "1ПМ" : "повторы", color: "var(--series)", points: pts, main: true }] }) : "";
    const rows = arr.slice().reverse().map((p) => `<tr><td>${fmtDate(p.date)}</td><td>${weighted ? `${fmtNum(p.w)} × ${fmtNum(p.r)}` : `${fmtNum(p.r)} повт.`}</td>${weighted ? `<td>${Math.round(p.score)}</td>` : ""}</tr>`).join("");
    return `<div class="exp-detail">
      <div class="small muted">${weighted ? "Расчётный 1ПМ по лучшему подходу тренировки (формула Эпли), кг" : "Лучший подход тренировки, повторы"}</div>
      ${chart}
      <details class="tbl"><summary>Таблица</summary><div class="tbl-wrap"><table class="t"><thead><tr><th>Дата</th><th>Лучший подход</th>${weighted ? "<th>1ПМ</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div></details>
    </div>`;
  }
  function journalProgress() {
    const prog = progressData();
    const ids = Object.keys(prog).sort((a, b) => prog[b][prog[b].length - 1].date.localeCompare(prog[a][prog[a].length - 1].date));
    const progHTML = ids.length ? ids.map((id) => {
      const arr = prog[id], first = arr[0], last = arr[arr.length - 1];
      const pct = first.score ? ((last.score - first.score) / first.score) * 100 : 0;
      const dl = arr.length > 1 ? `<span class="delta ${pct >= 0 ? "up" : "down"}">${pct >= 0 ? "+" : ""}${fmtNum(pct)} %</span>` : "";
      const lastTxt = last.w > 0 ? `${fmtNum(last.w)} × ${fmtNum(last.r)} · 1ПМ ≈ ${Math.round(last.score)} кг` : `${fmtNum(last.r)} повт.`;
      const open = state.jex === id;
      return `<div class="prog-row exp-row" data-jex="${esc(id)}" role="button" tabindex="0" aria-expanded="${open}"><div class="nm">${esc(EX[id] ? EX[id].n : id)}</div>${spark(arr)}<div class="meta">${lastTxt} · ${arr.length} трен. ${dl}</div></div>${open ? exerciseDetail(id, arr) : ""}`;
    }).join("") : `<div class="empty">Пока пусто: записывай подходы на вкладке «Сегодня» — здесь появится динамика по каждому упражнению.</div>`;
    return `${adherenceHTML()}
      <h2>Прогресс по упражнениям</h2>
      <section class="card">${progHTML}
        <p class="small muted" style="margin-top:8px">Нажми на упражнение — откроется график. 1ПМ — расчётный максимум по формуле Эпли из лучшего подхода тренировки: так видно рост, даже когда меняются повторы.</p></section>`;
  }

  /* --- объём: факт против плана --- */
  function actualVolume(idx) {
    const vol = {}, add = (m, v) => { vol[m] = (vol[m] || 0) + v; };
    Object.keys(state.logs).forEach((k) => {
      const e = state.logs[k];
      if (!entryHasData(e)) return;
      const ei = e.idx != null ? e.idx : (e.block && e.week ? (e.block - 1) * 5 + e.week - 1 : null);
      if (ei !== idx) return;
      Object.entries(e.ex || {}).forEach(([id, sets]) => {
        const ex = EX[id];
        if (!ex || !ex.m) return;
        const n = (sets || []).filter((s) => s && (s.w || s.r)).length;
        ex.m.p.forEach((m) => add(m, n));
        ex.m.s.forEach((m) => add(m, n * 0.5));
      });
    });
    return vol;
  }
  function journalVolume() {
    const cyc = cycleState(), back = state.jvol || 0, idx = Math.max(0, cyc.idx - back), pos = posOfIdx(idx);
    const act = actualVolume(idx), plan = weeklyVolume(pos.block, plannedDays().length >= 3);
    const rows = Object.keys(P.muscles).filter((m) => !P.muscles[m].hide).map((m) => {
      const pv = plan[m] || { d: 0, i: 0 };
      return { m, n: P.muscles[m].n, pr: P.muscles[m].pr, a: act[m] || 0, p: pv.d + pv.i * 0.5 };
    }).sort((x, y) => (x.pr || 9) - (y.pr || 9));
    const max = Math.max(1, ...rows.map((r) => Math.max(r.a, r.p)));
    const bars = rows.map((r) => {
      const w = (r.a / max) * 100, tp = (r.p / max) * 100;
      const tip = `${r.n}: ${fmtNum(r.a)} из ${fmtNum(r.p)} по плану`;
      return `<div class="vbar-row" title="${esc(tip)}"><div class="bar-lab ${r.pr && r.pr <= 2 ? "pri" : ""}">${esc(r.n)}</div>
        <div class="vbar-track"><div class="vbar ${r.a ? "" : "zero"}" style="width:calc(${w}% * 0.78)"></div>${r.p ? `<div class="vtick" style="left:calc(${tp}% * 0.78)"></div>` : ""}
        <span class="vval" style="left:calc(${Math.max(w, tp)}% * 0.78 + 2px)">${fmtNum(r.a)} / ${fmtNum(r.p)}</span></div></div>`;
    }).join("");
    const btn = (v, lab) => `<button data-jvol="${v}" class="${back === v ? "on" : ""}">${lab}</button>`;
    const empty = !Object.keys(act).length;
    return `<section class="card">
      <h3>Подходы по мышцам</h3>
      <div class="chart-ctl"><div class="seg" style="max-width:340px">${btn(0, "Текущая")}${btn(1, "Прошлая")}${btn(2, "2 нед. назад")}</div></div>
      <p class="small muted">Блок ${pos.block}, неделя ${pos.week}${pos.week === 5 ? " (разгрузка)" : ""}. Полоса — сделано, риска — план в режиме 90 минут${plannedDays().length >= 3 ? " с субботой" : ""}.</p>
      ${empty ? `<div class="empty">В этой неделе программы пока нет записанных подходов.</div>` : ""}
      <div class="chart" role="img" aria-label="Подходы по мышцам: сделано и план">${bars}</div>
      <p class="small muted" style="margin-top:8px">Жирным — приоритетные мышцы. Прямая работа считается за подход, косвенная (бицепс в тягах) — за половину ${rich("{pelland26}")}.</p>
    </section>`;
  }

  /* --- тело --- */
  function rolling(points, days) {
    return points.map((p) => {
      const win = points.filter((q) => daysBetween(q.d, p.d) >= 0 && daysBetween(q.d, p.d) < days);
      return { d: p.d, v: Math.round((win.reduce((a, q) => a + q.v, 0) / win.length) * 10) / 10 };
    });
  }
  function journalBody() {
    const meas = state.meas.slice().sort((a, b) => b.date.localeCompare(a.date));
    const asc = meas.slice().reverse();
    const first = asc[0];
    const cell = (v, f) => {
      if (v === "" || v == null) return "—";
      const d = first && first[f] !== "" && first[f] != null ? +v - +first[f] : null;
      return `${fmtNum(+v)}${d ? ` <span class="small muted">(${d > 0 ? "+" : ""}${fmtNum(d)})</span>` : ""}`;
    };
    const series = (f) => asc.filter((m) => m[f] !== "" && m[f] != null && isFinite(+String(m[f]).replace(",", "."))).map((m) => ({ d: m.date, v: +String(m[f]).replace(",", ".") }));
    const w = series("w");
    let weightChart = "";
    if (CH && w.length >= 2) {
      weightChart = `<h4 class="ch-h">Вес, кг</h4>${CH.slot({ height: 200, unit: "кг", digits: 1, label: "Вес по дням и среднее за 7 дней", series: [
        { name: "за день", color: "var(--p3)", points: w, line: false, r: 3.5 },
        { name: "среднее за 7 дней", color: "var(--p1)", points: rolling(w, 7), main: true, dots: false }] })}
        <div class="legend"><span><i class="dt" style="background:var(--p3)"></i>за день</span><span><i class="ln" style="background:var(--p1)"></i>среднее за 7 дней</span></div>`;
    }
    const smalls = [["waist", "Талия, см"], ["arm", "Рука, см"], ["calf", "Икра, см"], ["bf", "Жир, %"]].map(([f, n]) => {
      const pts = series(f);
      return CH && pts.length >= 2 ? `<div><h4>${n}</h4>${CH.slot({ height: 130, unit: "", digits: 1, label: n, series: [{ name: n, color: "var(--series)", points: pts, main: true }] })}</div>` : "";
    }).join("");
    const measRows = meas.map((m) => `<tr><td>${fmtDate(m.date)}</td><td>${cell(m.w, "w")}</td><td>${cell(m.waist, "waist")}</td><td>${cell(m.arm, "arm")}</td><td>${cell(m.calf, "calf")}</td><td>${cell(m.bf, "bf")}</td><td><button class="btn ghost small" data-delmeas="${esc(m.date)}" aria-label="Удалить запись">×</button></td></tr>`).join("");
    return `
      <section class="card">
        <h3>Новый замер</h3>
        <div class="form-grid" id="measForm">
          <label>Дата<input type="date" name="date" value="${todayISO()}"></label>
          <label>Вес, кг<input inputmode="decimal" name="w" placeholder="${esc(state.settings.bw || "")}"></label>
          <label>Талия, см<input inputmode="decimal" name="waist" placeholder="по пупку"></label>
          <label>Рука, см<input inputmode="decimal" name="arm" placeholder="в напряжении"></label>
          <label>Икра, см<input inputmode="decimal" name="calf" placeholder="самое широкое место"></label>
          <label>Жир, %<input inputmode="decimal" name="bf" placeholder="калипер"></label>
        </div>
        <div style="margin-top:10px"><button class="btn primary" data-addmeas="1">Сохранить замер</button></div>
        <p class="small muted" style="margin-top:8px">Вес — утром, 3–4 раза в неделю (смотри среднее). Талия — раз в 2 недели, рука и икра — раз в месяц, утром до нагрузки.</p>
      </section>
      ${weightChart || smalls ? `<section class="card">${weightChart}${smalls ? `<div class="small-multiples">${smalls}</div>` : ""}</section>` : `<div class="empty">Графики появятся после двух замеров.</div>`}
      ${meas.length ? `<section class="card"><h3>Все замеры</h3><div class="tbl-wrap"><table class="t"><thead><tr><th>Дата</th><th>Вес</th><th>Талия</th><th>Рука</th><th>Икра</th><th>Жир</th><th></th></tr></thead><tbody>${measRows}</tbody></table></div><p class="small muted">В скобках — изменение от первого замера.</p></section>` : ""}`;
  }

  /* ---------- анализ агентом: экспорт и корректировки ---------- */
  const ADJ_FORMAT = "upgrade.adjust.v1";
  const AGENT_PROMPT = `Ты — тренер-аналитик. Это выгрузка из моего приложения «Апгрейд»: программа силовых тренировок (3 блока по 5 недель, 5-я неделя блока — разгрузка; неделя закрывается, когда сделаны тренировки A и B, C — по желанию), журнал подходов (вес × повторы; RIR — запас повторов в последнем подходе), самочувствие перед тренировкой (ok / low), отметки суставов после тренировки (1 — дискомфорт, 2 — боль), заметки и замеры тела.

Что сделать:
1. Коротко оцени последние недели: прогресс в основных упражнениях (лучшие подходы, расчётный 1ПМ), объём по мышцам против плана (weekly_summary), регулярность, сигналы усталости и жалобы суставов. Опирайся на цифры из данных.
2. Если нужно, предложи корректировки программы на ближайшие 2–4 недели. Если менять нечего — так и скажи.
3. Корректировки верни отдельным блоком кода JSON строго в формате upgrade.adjust.v1 (описание — в поле adjust_format). Я вставлю его в приложение: «Ещё → Настройки → Корректировки».

Правила: используй только id упражнений из program.exercises (для замены — желательно из списка alts); не больше 6 изменений за раз; уважай ограничения из athlete.context_notes и отметки суставов; каждое изменение объясни в поле why одним-двумя предложениями. Разгрузку или повтор недели предлагай через поле cycle.`;
  const ADJ_SPEC = {
    format: ADJ_FORMAT,
    fields: {
      title: "короткое название, до 60 символов",
      reason: "общая причина, 1–3 предложения",
      cycle: "необязательно: deload_now | repeat_week | next_block — предложить действие с циклом",
      changes: "1–20 изменений; в каждом exercise обязателен и хотя бы одно из sets, reps, rir, note, replace_with"
    },
    change: {
      exercise: "id упражнения из program.exercises (как в программе, до замен)",
      session: "необязательно: * (везде, по умолчанию), A, B, C или конкретная тренировка вроде 2A",
      blocks: "необязательно: номера блоков, например [2, 3]",
      sets: "целое 1–8", reps: "строка, например 8–10", rir: "строка, например 1–2",
      note: "подсказка на тренировке, до 200 символов", replace_with: "id другого упражнения", why: "почему"
    },
    example: { format: ADJ_FORMAT, title: "Больше трицепса, щадим локоть", reason: "Трицепс отстаёт от плана, локоть отзывался на разгибаниях из-за головы.", changes: [
      { exercise: "oh_ext_partial", session: "*", sets: 4, reps: "12–15", why: "Объём трицепса ниже плана; больше повторов с меньшим весом мягче для локтя." },
      { exercise: "face_pull", replace_with: "rev_pecdeck", why: "Позиция с согнутыми локтями вызывала дискомфорт." }] }
  };
  const stripHTML = (h) => String(h || "").replace(/<li>/g, "\n• ").replace(/<\/(h3|p|section)>/g, "\n").replace(/<[^>]+>/g, "").replace(/\{\{?\w+\}?\}/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  function buildAnalysis() {
    const cyc = cycleState(), cur = posOfIdx(cyc.idx), done = weekDone(cyc), pd = plannedDays();
    const used = new Set();
    const sessions = {};
    Object.keys(P.sessions).forEach((key) => {
      const s = P.sessions[key];
      sessions[key] = { title: s.title, groups: s.groups.filter((g) => g.items && g.kind !== "warmup").map((g) => ({ id: g.id, kind: g.kind, tier: g.tier, rest: g.rest || null,
        items: g.items.filter((it) => it.ex || it.hl || it.weekAlt).map((it) => {
          const one = (b) => { if (b.ex) used.add(b.ex); return { exercise: b.ex, sets: b.sets, reps: b.reps, rir: b.rir == null ? null : b.rir, note: b.note || null, myo: !!b.myo }; };
          if (it.hl) return Object.assign(one({ ex: it.ex }), { heavy_week: one(Object.assign({ ex: it.ex }, it.hl.heavy)), light_week: one(Object.assign({ ex: it.ex }, it.hl.light)) });
          if (it.weekAlt) return { alternating_by_week: it.weekAlt.map(one) };
          return one(it);
        }) })) };
    });
    const exercises = {};
    Object.keys(EX).forEach((id) => {
      const e = EX[id];
      if (!e.m) return;
      exercises[id] = { name: e.n, primary: e.m.p, secondary: e.m.s, alts: e.alts || [], tags: e.tags || [], in_program: used.has(id), unit: e.unit || "kg×reps" };
    });
    const log = Object.keys(state.logs).filter((k) => entryHasData(state.logs[k]) || (state.logs[k].s && (state.logs[k].s.note || state.logs[k].s.joints))).sort().map((k) => {
      const e = state.logs[k];
      return { date: k.slice(0, 10), session: e.day || k.slice(11), block: e.block, week: e.week, week_index: e.idx, readiness: e.ready || null, time_mode_min: e.time || null,
        joints: (e.s && e.s.joints) || {}, note: (e.s && e.s.note) || "",
        exercises: Object.entries(e.ex || {}).map(([id, sets]) => ({ id, name: EX[id] ? EX[id].n : id, sets: (sets || []).filter((x) => x && (x.w || x.r)).map((x) => ({ kg: numOf(x.w), reps: numOf(x.r) })), rir_last_set: e.rir && e.rir[id] != null ? e.rir[id] : null })).filter((x) => x.sets.length) };
    });
    const weeks = Array.from(new Set(Object.values(state.logs).filter(entryHasData).map((e) => e.idx).filter((x) => x != null))).sort((a, b) => a - b);
    const weekly = weeks.map((i) => {
      const p = posOfIdx(i), plan = weeklyVolume(p.block, pd.length >= 3), act = actualVolume(i), by = idxSessions();
      const planned = {};
      Object.keys(plan).forEach((m) => { planned[m] = plan[m].d + plan[m].i * 0.5; });
      return { week_index: i, block: p.block, week: p.week, deload: p.week === 5, sessions: Array.from(by[i] || []).sort(), hard_sets: act, planned_sets: planned };
    });
    const progress = {};
    const pdata = progressData();
    Object.keys(pdata).forEach((id) => { progress[id] = pdata[id].map((x) => ({ date: x.date, best: x.w > 0 ? `${x.w}×${x.r}` : `${x.r}`, e1rm: x.w > 0 ? Math.round(x.score * 10) / 10 : null })); });
    return {
      format: "upgrade.analysis.v1",
      generated_at: new Date().toISOString(),
      instructions: AGENT_PROMPT,
      adjust_format: ADJ_SPEC,
      athlete: {
        settings: { program_start: state.settings.start, body_weight_kg: +state.settings.bw || null, hr_max: +state.settings.hrmax || null, training_days: pd.map((d) => WD_SHORT[d]) },
        profile: P.meta.profile,
        priorities: Object.keys(P.muscles).filter((m) => P.muscles[m].pr).map((m) => ({ muscle: m, name: P.muscles[m].n, priority: P.muscles[m].pr })),
        context_notes: stripHTML(P.content.body)
      },
      program: {
        version: P.meta.version,
        position: { cycle: cur.cycle, block: cur.block, week: cur.week, week_index: cyc.idx, deload: cur.week === 5, done_this_week: Object.keys(done), deload_in_weeks: cur.week === 5 ? 0 : 5 - cur.week },
        cycle_history: cyc.hist || [],
        blocks: P.blocks.map((b) => ({ id: b.id, name: b.name, theme: b.theme, targets: b.targets })),
        sessions, exercises,
        rules: "Двойная прогрессия: верх диапазона во всех подходах при нужном RIR → +2,5–5 % веса. Разгрузка: веса −10–15 %, подходов на один меньше, RIR 3–4. Самочувствие «так себе»: подходом меньше, RIR +1."
      },
      adjustments_active: (S.get("adjust", []) || []).filter((a) => a && a.enabled !== false),
      log, weekly_summary: weekly, progress,
      measurements: state.meas.slice().sort((a, b) => a.date.localeCompare(b.date)).map((m) => ({ date: m.date, weight_kg: numOf(m.w), waist_cm: numOf(m.waist), arm_cm: numOf(m.arm), calf_cm: numOf(m.calf), body_fat_pct: numOf(m.bf) }))
    };
  }
  function analysisFile() {
    const data = buildAnalysis();
    const text = JSON.stringify(data, null, 1);
    return { data, text, name: `upgrade-analysis-${todayISO()}.json`, kb: Math.round(text.length / 1024) };
  }

  function validateAdjust(raw) {
    let obj = raw, errors = [], warnings = [];
    if (typeof raw === "string") {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return { errors: ["Не нашёл JSON: вставь блок кода от агента целиком."] };
      try { obj = JSON.parse(m[0]); } catch (e) { return { errors: ["JSON не читается: " + e.message] }; }
    }
    if (!obj || typeof obj !== "object") return { errors: ["Ожидался объект JSON."] };
    if (obj.format !== ADJ_FORMAT) warnings.push(`Поле format не равно ${ADJ_FORMAT} — проверяю как есть.`);
    const changes = Array.isArray(obj.changes) ? obj.changes : [];
    const cycle = ["deload_now", "repeat_week", "next_block"].includes(obj.cycle) ? obj.cycle : null;
    if (!changes.length && !cycle) errors.push("Нет изменений: пустой список changes.");
    if (changes.length > 20) errors.push("Слишком много изменений за раз (больше 20).");
    const inProg = new Set();
    Object.keys(P.sessions).forEach((key) => P.sessions[key].groups.forEach((g) => (g.items || []).forEach((it) => {
      const add = (b) => b && b.ex && inProg.add(`${key}|${b.ex}`);
      add(it); if (it.hl) add({ ex: it.ex }); if (it.weekAlt) it.weekAlt.forEach(add);
    })));
    const clean = changes.slice(0, 20).map((c, i) => {
      const n = i + 1, out = {};
      if (!c || typeof c !== "object") { errors.push(`№${n}: не объект.`); return null; }
      if (!EX[c.exercise]) { errors.push(`№${n}: неизвестное упражнение «${c.exercise}».`); return null; }
      out.exercise = c.exercise;
      const sess = c.session == null || c.session === "" ? "*" : String(c.session);
      if (!/^(\*|[ABC]|[123][ABC])$/.test(sess)) { errors.push(`№${n}: session должно быть *, A, B, C или вида 2A.`); return null; }
      out.session = sess;
      if (Array.isArray(c.blocks)) out.blocks = c.blocks.map(Number).filter((b) => b >= 1 && b <= 3);
      if (c.sets != null) { const v = Math.round(+c.sets); if (!(v >= 1 && v <= 8)) errors.push(`№${n}: sets должно быть от 1 до 8.`); else out.sets = v; }
      if (c.reps != null) { const v = String(c.reps).trim(); if (!v || v.length > 20) errors.push(`№${n}: reps — короткая строка, например «8–10».`); else out.reps = v; }
      if (c.rir != null) { const v = String(c.rir).trim(); if (!v || v.length > 8) errors.push(`№${n}: rir — короткая строка, например «1–2».`); else out.rir = v; }
      if (c.note != null) out.note = String(c.note).slice(0, 200);
      if (c.replace_with != null) { if (!EX[c.replace_with]) errors.push(`№${n}: неизвестное упражнение для замены «${c.replace_with}».`); else out.replace_with = c.replace_with; }
      if (c.why != null) out.why = String(c.why).slice(0, 300);
      if (!["sets", "reps", "rir", "note", "replace_with"].some((f) => f in out)) errors.push(`№${n}: нечего менять — нужно sets, reps, rir, note или replace_with.`);
      const found = Array.from(inProg).some((x) => { const [key, ex] = x.split("|"); return ex === out.exercise && (sess === "*" || sess === key || sess === key.slice(1)) && (!out.blocks || !out.blocks.length || out.blocks.includes(+key[0])); });
      if (!found) warnings.push(`№${n}: «${EX[out.exercise].n}» не встречается в программе с такими условиями — изменение ни на что не повлияет.`);
      if (out.replace_with && EX[out.exercise].alts && !EX[out.exercise].alts.includes(out.replace_with)) warnings.push(`№${n}: «${EX[out.replace_with].n}» нет среди обычных замен для «${EX[out.exercise].n}».`);
      return out;
    }).filter(Boolean);
    return { errors, warnings, adj: { title: String(obj.title || "Корректировка").slice(0, 60), reason: String(obj.reason || "").slice(0, 400), cycle, changes: clean } };
  }
  const CYC_RU = { deload_now: "разгрузка сейчас", repeat_week: "повторить неделю", next_block: "перейти к следующему блоку" };
  function describeChange(c) {
    const where = c.session === "*" ? "все тренировки" : c.session.length === 1 ? `тренировки ${c.session}` : `тренировка ${c.session}`;
    const parts = [];
    if (c.replace_with) parts.push(`замена на «${EX[c.replace_with].n}»`);
    if (c.sets != null) parts.push(`подходов: ${c.sets}`);
    if (c.reps) parts.push(`повторы: ${c.reps}`);
    if (c.rir) parts.push(`RIR ${c.rir}`);
    if (c.note) parts.push(`подсказка: «${c.note}»`);
    return `<li><b>${esc(EX[c.exercise].n)}</b> (${where}${c.blocks && c.blocks.length ? `, блоки ${c.blocks.join(", ")}` : ""}): ${esc(parts.join(", "))}${c.why ? `<div class="small muted">${esc(c.why)}</div>` : ""}</li>`;
  }
  let adjDraft = null;
  function adjPreviewHTML(res) {
    if (!res) return "";
    if (res.errors && res.errors.length && !res.adj) return `<div class="banner warn">${res.errors.map(esc).join("<br>")}</div>`;
    const a = res.adj;
    return `<div class="adj-prev">
      ${res.errors.length ? `<div class="banner warn"><b>Нужно поправить:</b><br>${res.errors.map(esc).join("<br>")}</div>` : ""}
      ${res.warnings.length ? `<div class="banner">${res.warnings.map(esc).join("<br>")}</div>` : ""}
      <h4>${esc(a.title)}</h4>${a.reason ? `<p class="small">${esc(a.reason)}</p>` : ""}
      <ul class="dots">${a.changes.map(describeChange).join("")}</ul>
      ${a.cycle ? `<p class="small"><b>Агент предлагает:</b> ${CYC_RU[a.cycle]}. Применится, только если нажмёшь кнопку ниже.</p>` : ""}
      <div class="ex-tools">${a.changes.length && !res.errors.length ? `<button class="btn primary" data-adjapply="1">Применить корректировки</button>` : ""}${a.cycle && !res.errors.length ? `<button class="btn" data-adjcycle="${a.cycle}">Сделать: ${CYC_RU[a.cycle]}</button>` : ""}<button class="btn ghost" data-adjcancel="1">Отмена</button></div>
    </div>`;
  }
  function adjListHTML() {
    const list = S.get("adjust", []) || [];
    if (!list.length) return `<p class="small muted">Активных корректировок нет — программа идёт как задумано.</p>`;
    return list.map((a) => `<div class="adj-item ${a.enabled === false ? "off" : ""}">
      <div><b>${esc(a.title)}</b> <span class="small muted">${a.created ? fmtDate(a.created.slice(0, 10)) : ""} · изменений: ${(a.changes || []).length}</span>
        ${a.reason ? `<div class="small muted">${esc(a.reason)}</div>` : ""}</div>
      <div class="row-btns"><label class="chk"><input type="checkbox" data-adjtoggle="${esc(a.id)}" ${a.enabled === false ? "" : "checked"}> вкл.</label><button class="btn ghost small" data-adjdel="${esc(a.id)}" aria-label="Удалить корректировку">×</button></div>
    </div>`).join("");
  }
  async function agentExport(kind) {
    const msg = (t, err) => { const m = $("#agentMsg"); if (m) { m.textContent = t; m.classList.toggle("err", !!err); } };
    const f = analysisFile();
    if (kind === "file") {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([f.text], { type: "application/json" }));
      a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
      msg(`Готово: ${f.name}, ${f.kb} КБ. Отправь файл агенту — инструкция уже внутри.`);
    } else if (kind === "share") {
      try {
        const file = new File([f.text], f.name, { type: "application/json" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Апгрейд — данные для анализа", text: "Проанализируй по инструкции в файле (поле instructions)." }); msg("Отправлено."); }
        else msg("Этот браузер не умеет делиться файлами — скачай файл.", true);
      } catch (e) { if (e && e.name !== "AbortError") msg("Не получилось поделиться: " + (e.message || e), true); }
    } else if (kind === "copy") {
      const text = `${AGENT_PROMPT}\n\nДанные (JSON):\n\`\`\`json\n${JSON.stringify(f.data)}\n\`\`\``;
      try { await navigator.clipboard.writeText(text); msg(`Скопировано (${Math.round(text.length / 1024)} КБ) — вставь в чат с агентом.${text.length > 150000 ? " Данных много: надёжнее отправить файлом." : ""}`); }
      catch (e) { msg("Не получилось скопировать — скачай файл.", true); }
    }
  }

  /* ---------- tab: settings ---------- */
  function renderSettings() {
    return `${renderAccount()}
      <section class="card">
        <h3>Программа</h3>
        <div class="form-grid" id="setForm">
          <label>Старт программы<input type="date" name="start" value="${esc(state.settings.start)}"></label>
          <label>Вес для расчётов, кг<input inputmode="decimal" name="bw" value="${esc(state.settings.bw)}"></label>
          <label>ЧСС макс., уд/мин<input inputmode="numeric" name="hrmax" value="${esc(state.settings.hrmax)}"></label>
        </div>
        <div class="ex-tools" style="margin-top:10px"><button class="btn primary" data-saveset="1">Сохранить</button><button class="btn" data-resetswaps="1">Сбросить замены</button></div>
      </section>
      <section class="card">
        <h3>Анимации упражнений</h3>
        <label class="chk big"><input type="checkbox" data-media="1" ${state.media ? "checked" : ""}> Показывать анимации (${GV})</label>
        <p class="small muted" style="margin-top:6px">Анимации принадлежат Gym visual и распространяются в exercises-dataset с их разрешения. Сюда они не скопированы — подгружаются по ссылке из исходного репозитория и только на этом устройстве, если включишь. Для публичного использования условия Gym visual требуют собственной лицензии.</p>
      </section>
      <section class="card">
        <h3>Приложение</h3>
        ${isStandalone() ? `<p class="small">Установлено и работает без сети.</p>` : installEvt ? `<button class="btn primary" data-install="1">Установить на устройство</button>` : `<p class="small">${isIOS ? "В Safari: «Поделиться» → «На экран „Домой“»." : "В меню браузера: «Установить приложение» или «Добавить на главный экран»."}</p>`}
      </section>
      <section class="card" id="agents">
        <h3>Анализ агентом</h3>
        <p class="small">Выгрузи данные для ChatGPT, Claude или своего агента. В файле уже есть инструкция: что проанализировать и в каком формате вернуть корректировки программы.</p>
        <div class="ex-tools"><button class="btn primary" data-agentexport="file">Скачать для анализа</button>${navigator.canShare ? `<button class="btn" data-agentexport="share">Поделиться</button>` : ""}<button class="btn" data-agentexport="copy">Скопировать для чата</button></div>
        <p class="small muted" id="agentMsg" role="status"></p>
      </section>
      <section class="card" id="adjust">
        <h3>Корректировки</h3>
        <p class="small">Вставь ответ агента — блок JSON в формате ${ADJ_FORMAT}. Перед применением покажу, что изменится; любую корректировку можно выключить или удалить.</p>
        <textarea class="adj-in" id="adjIn" rows="4" placeholder='{"format": "${ADJ_FORMAT}", "title": "…", "changes": [ … ]}'></textarea>
        <div class="ex-tools" style="margin-top:8px"><button class="btn" data-adjcheck="1">Проверить</button></div>
        <div id="adjPreview">${adjPreviewHTML(adjDraft)}</div>
        <h4>Активные</h4>
        <div class="adj-list">${adjListHTML()}</div>
      </section>
      <section class="card">
        <h3>Резервная копия</h3>
        <p class="small">${SY && SY.signedIn() ? "Журнал, замеры, цикл, цели, замены и корректировки синхронизируются с базой. Резервная копия — полный JSON-файл." : "Без входа всё хранится только на этом устройстве. Резервная копия — полный JSON-файл."}</p>
        <div class="ex-tools"><button class="btn" data-export="1">Экспорт JSON</button><label class="btn" style="cursor:pointer">Импорт JSON<input type="file" accept="application/json,.json" data-import="1" hidden></label></div>
      </section>`;
  }

  /* ---------- main render ---------- */
  const TITLES = { today: "Сегодня", plan: "План", library: "Упражнения", journal: "Журнал", more: "Ещё", cardio: "Кардио", body: "Тело", food: "Питание", science: "Почему так", settings: "Настройки" };
  const SUB_OF_MORE = ["cardio", "body", "food", "science", "settings"];
  const NAV = [
    ["today", "Сегодня", '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" stroke-linecap="round"/>'],
    ["plan", "План", '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4" stroke-linecap="round"/>'],
    ["library", "Упражнения", '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5" stroke-linecap="round"/>'],
    ["journal", "Журнал", '<path d="M4 19.5h16M7 16v-4M12 16V8M17 16v-6" stroke-linecap="round"/>'],
    ["more", "Ещё", '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>']
  ];
  function render() {
    const ctx = ctxNow();
    const blk = P.blocks[ctx.block - 1];
    const sub = SUB_OF_MORE.includes(state.tab);
    $("#title").textContent = TITLES[state.tab] || "Апгрейд";
    $("#sub").textContent = `Блок ${ctx.block} «${blk.name}» · неделя ${ctx.week} из 5${ctx.cycle > 1 ? ` · круг ${ctx.cycle}` : ""}`;
    $("#back").hidden = !sub;
    $("#offline").hidden = navigator.onLine !== false;
    $("#nav").innerHTML = NAV.map(([id, n, ic]) => {
      const on = state.tab === id || (id === "more" && sub);
      return `<button class="nav-i ${on ? "on" : ""}" data-tab="${id}" aria-current="${on ? "page" : "false"}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">${ic}</svg><span>${n}</span></button>`;
    }).join("");
    const fn = { today: renderToday, plan: renderPlan, library: renderLibrary, journal: renderJournal, more: renderMore, cardio: renderCardio, body: renderBody, food: renderFood, science: renderScience, settings: renderSettings }[state.tab] || renderToday;
    $("#app").innerHTML = fn();
    if (CH) CH.mount($("#app"));
    const fab = $("#fab");
    if (fab) fab.hidden = state.tab !== "today" && !T.id;
    if (state.tab !== "today" && !T.id) $("#tPanel").classList.remove("open");
  }
  function go(tab) { state.tab = tab; S.set("tab", tab); render(); window.scrollTo(0, 0); }

  /* ---------- events ---------- */
  let savedTimer = null;
  document.addEventListener("click", (e) => {
    const row = e.target.closest(".lib-row");
    if (row && !e.target.closest("button,a")) { toggleLib(row); return; }
    const t = e.target.closest("button,[data-tab],[data-jex]");
    if (!t) return;
    const d = t.dataset;
    if (d.jtab) { state.jtab = d.jtab; render(); return; }
    if (d.jvol !== undefined) { state.jvol = +d.jvol; render(); return; }
    if (d.jex) { state.jex = state.jex === d.jex ? null : d.jex; render(); const r = document.querySelector(`[data-jex="${d.jex}"]`); if (r && state.jex) r.focus({ preventScroll: true }); return; }
    if (d.auth && SY) { authAction(d.auth, t); return; }
    if (d.sync === "now" && SY) { SY.syncNow(); return; }
    if (d.toggle) {
      const pane = t.closest(".ex").querySelector(`[data-pane="${d.toggle}"]`);
      if (pane) { pane.hidden = !pane.hidden; t.setAttribute("aria-expanded", String(!pane.hidden)); t.classList.toggle("on", !pane.hidden); }
      return;
    }
    if (d.tab) { go(d.tab); if (d.cycfocus) { const c = $("#cycle"); if (c) c.scrollIntoView({ block: "start" }); } return; }
    if (t.id === "back") { go("more"); return; }
    if (d.day) { state.day = d.day; render(); return; }
    if (d.time) { state.time = +d.time; S.set("time", state.time); touchToday({ time: state.time }); render(); return; }
    if (d.ready) { state.ready = d.ready; S.set("ready", d.ready); S.set("readyDate", todayISO()); touchToday({ ready: d.ready }); render(); return; }
    if (d.cyc) { cycleAction(d.cyc); return; }
    if (d.agentexport) { agentExport(d.agentexport); return; }
    if (d.adjcheck) {
      const v = ($("#adjIn") || {}).value || "";
      adjDraft = validateAdjust(v);
      const box = $("#adjPreview"); if (box) box.innerHTML = adjPreviewHTML(adjDraft);
      return;
    }
    if (d.adjcancel) { adjDraft = null; const box = $("#adjPreview"); if (box) box.innerHTML = ""; return; }
    if (d.adjapply && adjDraft && adjDraft.adj && !adjDraft.errors.length) {
      const a = adjDraft.adj, list = (S.get("adjust", []) || []).slice();
      list.push({ id: "a" + Date.now().toString(36), title: a.title, reason: a.reason, created: new Date().toISOString(), source: "import", enabled: true, changes: a.changes });
      S.set("adjust", list);
      adjDraft = null; render();
      const m = $("#agentMsg"); if (m) m.textContent = "";
      const el2 = $("#adjust"); if (el2) el2.scrollIntoView({ block: "start" });
      return;
    }
    if (d.adjcycle) { const map = { deload_now: "deload", repeat_week: "repeat", next_block: "nextblock" }; if (map[d.adjcycle]) cycleAction(map[d.adjcycle]); return; }
    if (d.adjdel) {
      if (t.dataset.armed !== "1") { t.dataset.armed = "1"; t.textContent = "Удалить?"; setTimeout(() => { if (t.isConnected) { t.dataset.armed = ""; t.textContent = "×"; } }, 4000); return; }
      S.set("adjust", (S.get("adjust", []) || []).filter((a) => a.id !== d.adjdel)); render(); return;
    }
    if (d.undo && lastUndo) { S.set("cycle", lastUndo.prev); lastUndo = null; state.day = suggestDay(); render(); return; }
    if (d.fatigueskip) { S.set("fatigueSkip", ctxNow().cyc.idx); render(); return; }
    if (d.wday !== undefined) {
      const msg = toggleWeekday(+d.wday);
      render();
      if (msg) { const m = $("#wdayMsg"); if (m) { m.textContent = msg; m.classList.add("err"); } }
      return;
    }
    if (d.joint) {
      const ctx = ctxNow(), e = todayEntry(ctx);
      e.s = e.s || {}; e.s.joints = e.s.joints || {};
      const lv = ((+e.s.joints[d.joint] || 0) + 1) % 3;
      if (lv) e.s.joints[d.joint] = lv; else delete e.s.joints[d.joint];
      S.set("logs", state.logs);
      const [, name] = JOINTS.find((x) => x[0] === d.joint);
      t.className = `chip jt lv${lv}`; t.setAttribute("aria-pressed", String(lv > 0));
      t.textContent = name + (lv ? ` · ${JOINT_LV[lv]}` : "");
      return;
    }
    if (d.rir) {
      const [exId, val] = d.rir.split(":");
      const ctx = ctxNow(), e = todayEntry(ctx);
      e.rir = e.rir || {};
      if (e.rir[exId] === val) delete e.rir[exId]; else e.rir[exId] = val;
      S.set("logs", state.logs);
      t.parentElement.querySelectorAll("[data-rir]").forEach((b) => b.classList.toggle("on", b.dataset.rir === `${exId}:${e.rir[exId]}`));
      return;
    }
    if (d.volblock) { state.volBlock = +d.volblock; render(); return; }
    if (d.libbp) { LIB.bp = d.libbp; LIB.limit = 40; render(); return; }
    if (d.libmore) { LIB.limit += 40; $("#libList").innerHTML = libListHTML(); return; }
    if (d.showmedia) { t.outerHTML = mediaBlock(d.showmedia, d.alt || "", true); return; }
    if (d.install && installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; render(); }); return; }
    if (d.closehint) { S.set("installHintClosed", true); render(); return; }
    if (d.update && waitingSW) { waitingSW.postMessage({ type: "SKIP_WAITING" }); return; }
    if (d.addmeas) {
      const f = $("#measForm"); const get = (n) => f.querySelector(`[name="${n}"]`).value.trim().replace(",", ".");
      const m = { date: get("date") || todayISO(), w: get("w"), waist: get("waist"), arm: get("arm"), calf: get("calf"), bf: get("bf") };
      if (!m.w && !m.waist && !m.arm && !m.calf && !m.bf) return;
      state.meas = state.meas.filter((x) => x.date !== m.date).concat(m);
      S.set("meas", state.meas); render(); return;
    }
    if (d.delmeas) { state.meas = state.meas.filter((x) => x.date !== d.delmeas); S.set("meas", state.meas); render(); return; }
    if (d.saveset) {
      const f = $("#setForm"); const get = (n) => f.querySelector(`[name="${n}"]`).value.trim().replace(",", ".");
      state.settings = Object.assign({}, state.settings, { start: get("start") || P.meta.startDefault, bw: +get("bw") || P.meta.profile.weight, hrmax: +get("hrmax") || 180 });
      S.set("settings", state.settings); state.day = suggestDay(); t.textContent = "Сохранено"; return;
    }
    if (d.resetswaps) { state.swaps = {}; S.set("swaps", {}); t.textContent = "Замены сброшены"; return; }
    if (d.export) {
      const data = { app: "upgrade-v3", version: P.meta.version, exported: new Date().toISOString(), settings: state.settings, logs: state.logs, meas: state.meas, goals: state.goals, swaps: state.swaps, cycle: S.get("cycle", null), adjust: S.get("adjust", []) };
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      a.download = `upgrade-v3-${todayISO()}.json`; document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    if (t.id === "themeBtn") { state.theme = state.theme === "auto" ? "light" : state.theme === "light" ? "dark" : "auto"; S.set("theme", state.theme); applyTheme(); return; }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("lib-row")) { e.preventDefault(); toggleLib(e.target); }
    if ((e.key === "Enter" || e.key === " ") && e.target.dataset && e.target.dataset.jex) { e.preventDefault(); e.target.click(); }
    if (e.key === "Enter" && e.target.dataset && e.target.dataset.enter) {
      const b = document.querySelector(`#acct [data-auth="${e.target.dataset.enter}"]`);
      if (b && !b.disabled) { e.preventDefault(); b.click(); }
    }
  });
  function toggleLib(row) {
    const open = row.nextElementSibling && row.nextElementSibling.classList.contains("lib-d");
    if (open) { row.nextElementSibling.remove(); row.setAttribute("aria-expanded", "false"); return; }
    const x = LIB.items && LIB.items.find((i) => i.id === row.dataset.libid);
    if (x) { row.insertAdjacentHTML("afterend", libDetail(x)); row.setAttribute("aria-expanded", "true"); }
  }
  document.addEventListener("change", (e) => {
    const t = e.target, d = t.dataset;
    if (d.swap !== undefined) { state.swaps[d.swap] = t.value; S.set("swaps", state.swaps); render(); return; }
    if (d.cycgo) { cycleAction("goto", t.value); return; }
    if (d.adjtoggle) { S.set("adjust", (S.get("adjust", []) || []).map((a) => a.id === d.adjtoggle ? Object.assign({}, a, { enabled: t.checked }) : a)); render(); return; }
    if (d.libeq) { LIB.eq = t.value; LIB.limit = 40; $("#libList").innerHTML = libListHTML(); return; }
    if (d.media) { state.media = t.checked; S.set("media", t.checked); return; }
    if (d.goal) {
      const [b, i] = d.goal.split(":"); const k = "b" + b;
      state.goals[k] = state.goals[k] || []; state.goals[k][+i] = t.checked; S.set("goals", state.goals);
      document.querySelectorAll(`[data-goal="${d.goal}"]`).forEach((x) => { x.checked = t.checked; });
      return;
    }
    if (d.volsat) { state.volSat = t.checked; render(); return; }
    if (d.import && t.files && t.files[0]) {
      const r = new FileReader();
      r.onload = () => {
        try {
          const j = JSON.parse(r.result);
          if (j.logs) state.logs = Object.assign({}, state.logs, j.logs);
          if (Array.isArray(j.meas)) { const byDate = {}; state.meas.concat(j.meas).forEach((m) => { byDate[m.date] = m; }); state.meas = Object.values(byDate); }
          if (j.goals) state.goals = Object.assign({}, state.goals, j.goals);
          if (j.swaps) state.swaps = Object.assign({}, state.swaps, j.swaps);
          if (j.settings) state.settings = Object.assign({}, state.settings, j.settings);
          ["logs", "meas", "goals", "swaps", "settings"].forEach((k) => S.set(k, state[k]));
          if (j.cycle && typeof j.cycle.idx === "number") S.set("cycle", j.cycle);
          if (Array.isArray(j.adjust)) S.set("adjust", j.adjust);
          render();
        } catch (err) { alert("Не получилось прочитать файл: " + err.message); }
      };
      r.readAsText(t.files[0]);
    }
  });
  let qTimer = null;
  document.addEventListener("input", (e) => {
    const t = e.target, d = t.dataset;
    if (d.libq) { clearTimeout(qTimer); qTimer = setTimeout(() => { LIB.q = t.value; LIB.limit = 40; const el = $("#libList"); if (el) el.innerHTML = libListHTML(); }, 150); return; }
    if (d.note) {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => { const e = todayEntry(ctxNow()); e.s = e.s || {}; e.s.note = t.value.slice(0, 500); S.set("logs", state.logs); }, 400);
      return;
    }
    if (!d.log) return;
    const ctx = ctxNow();
    const entry = todayEntry(ctx);
    const arr = entry.ex[d.log] = entry.ex[d.log] || [];
    arr[+d.i] = Object.assign({}, arr[+d.i] || {}, { [d.f]: t.value.trim() });
    S.set("logs", state.logs);
    const s = document.querySelector(`[data-saved="${d.log}"]`);
    if (s) { s.classList.add("on"); clearTimeout(savedTimer); savedTimer = setTimeout(() => s.classList.remove("on"), 1200); }
  });
  window.addEventListener("online", () => softRender());
  window.addEventListener("offline", () => softRender());

  /* ---------- данные с сервера ---------- */
  const SYNCED = ["settings", "swaps", "goals", "logs", "meas"];
  let renderPending = false;
  function editing() {
    const a = document.activeElement;
    return !!(a && a.closest && a.closest("#app") && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  function softRender() { if (editing()) { renderPending = true; return; } render(); }
  document.addEventListener("focusout", () => setTimeout(() => { if (renderPending && !editing()) { renderPending = false; render(); } }, 60));
  S.onRemote((keys) => {
    keys.forEach((k) => {
      if (k === "settings") state.settings = settingsFromStore();
      else if (SYNCED.includes(k)) state[k] = S.get(k, k === "meas" ? [] : {});
    });
    if (keys.includes("settings") || keys.includes("logs") || keys.includes("cycle")) state.day = suggestDay();
    softRender();
  });
  if (SY) {
    SY.onStatus((st) => {
      const el = $("#syncStatus"); if (el) el.textContent = syncText(st);
      const f = $("#syncFoot"); if (f) f.textContent = footText();
      if (st.state === "expired" && state.tab === "settings") softRender();
    });
    SY.onOverlay((ov) => {
      if (!ov) { location.reload(); return; } // вышли из аккаунта — вернуть публичную программу
      SY.applyOverlay(P, ov);
      state.settings = settingsFromStore();
      softRender();
    });
  }

  /* ---------- theme ---------- */
  function applyTheme() {
    const r = document.documentElement;
    if (state.theme === "auto") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", state.theme);
    const ICON = {
      auto: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
      light: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2l1.8 1.8M17 17l1.8 1.8M5.2 18.8 7 17M17 7l1.8-1.8"/></g></svg>',
      dark: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor"/></svg>'
    };
    const b = $("#themeBtn");
    if (b) { b.innerHTML = ICON[state.theme]; b.title = `Тема: ${state.theme === "auto" ? "как в системе" : state.theme === "light" ? "светлая" : "тёмная"}`; }
    const dark = state.theme === "dark" || (state.theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute("content", dark ? "#161917" : "#f4f5f2");
  }

  /* ---------- rest timer ---------- */
  const FAB_IDLE = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 9v4.5l3 2M9.5 2.5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span>Отдых</span>';
  const fmtT = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
  function beep() {
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const c = new C(); [0, 0.25, 0.5].forEach((t) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.15); });
    } catch (e) { /* без звука */ }
  }
  function tick() {
    const left = (T.end - Date.now()) / 1000;
    const fab = $("#fab"), big = $("#tBig");
    if (left <= 0) {
      clearInterval(T.id); T.id = null; fab.classList.remove("run"); fab.textContent = "Готово"; big.textContent = "0:00";
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]); beep();
      setTimeout(() => { if (!T.id) fab.innerHTML = FAB_IDLE; }, 4000);
      return;
    }
    fab.textContent = fmtT(left); big.textContent = fmtT(left);
  }
  function startTimer(sec) { T.end = Date.now() + sec * 1000; clearInterval(T.id); T.id = setInterval(tick, 250); $("#fab").classList.add("run"); tick(); }
  function initTimer() {
    $("#fab").innerHTML = FAB_IDLE;
    $("#fab").addEventListener("click", () => $("#tPanel").classList.toggle("open"));
    $("#tPanel").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.t) startTimer(+b.dataset.t);
      if (b.dataset.plus) { if (T.id) T.end += 15000; else startTimer(15); }
      if (b.dataset.stop !== undefined) { clearInterval(T.id); T.id = null; $("#fab").classList.remove("run"); $("#fab").innerHTML = FAB_IDLE; $("#tBig").textContent = "0:00"; }
      if (b.dataset.close !== undefined) $("#tPanel").classList.remove("open");
    });
  }

  /* ---------- PWA ---------- */
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (state.tab === "today" || state.tab === "settings") render(); });
  window.addEventListener("appinstalled", () => { installEvt = null; render(); });
  function initSW() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      const check = (w) => { if (w && navigator.serviceWorker.controller) { waitingSW = w; if (state.tab === "today") render(); } };
      if (reg.waiting) check(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (nw) nw.addEventListener("statechange", () => { if (nw.state === "installed") check(nw); });
      });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => { /* без офлайна */ });
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloading) return; reloading = true; location.reload(); });
  }

  /* ---------- boot ---------- */
  S.init().then(() => {
    loadState();
    const qp = new URLSearchParams(location.search).get("tab");
    state.tab = qp && TITLES[qp] ? qp : S.get("tab", "today");
    if (!TITLES[state.tab]) state.tab = "today";
    state.day = suggestDay();
    applyTheme();
    try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme); } catch (e) { /* старые браузеры */ }
    initTimer();
    render();
    initSW();
    if (SY) SY.start();
  });
  window.__UPG = { state, ctxNow, weeklyVolume, resolveItem, estMinutes, groupVisible, suggestDay, LIB };
})();
