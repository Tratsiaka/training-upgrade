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
  function loadState() {
    Object.assign(state, {
      tab: "today",
      settings: Object.assign({ start: P.meta.startDefault, bw: P.meta.profile.weight, hrmax: 180 }, S.get("settings", {})),
      manualWeek: S.get("manualWeek", null),
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

  /* ---------- program position ---------- */
  function posFor(dateISO) {
    const diff = daysBetween(state.settings.start, dateISO);
    if (diff < 0) return { pre: true, daysToStart: -diff, idx: 0, cycle: 1, block: 1, week: 1, n: 1 };
    const idx = Math.floor(diff / 7), i = idx % 15;
    return { pre: false, idx, cycle: Math.floor(idx / 15) + 1, block: Math.floor(i / 5) + 1, week: (i % 5) + 1, n: i + 1 };
  }
  function ctxNow() {
    const auto = posFor(todayISO());
    let block = auto.block, week = auto.week, n = auto.n;
    if (state.manualWeek) { n = +state.manualWeek; block = Math.floor((n - 1) / 5) + 1; week = ((n - 1) % 5) + 1; }
    return { auto, block, week, n, cycle: auto.cycle, day: state.day, time: +state.time, low: state.ready === "low", light: week === 5, heavy: week === 1 || week === 3 };
  }

  /* ---------- logs ---------- */
  const logKey = (date, day) => `${date}_${day}`;
  const entryHasData = (e) => e && e.ex && Object.values(e.ex).some((sets) => sets.some((s) => s && (s.w || s.r)));
  function loggedThisWeek(day) {
    const cur = posFor(todayISO()).idx;
    return Object.keys(state.logs).some((k) => {
      const [d, dd] = k.split("_");
      const p = posFor(d);
      return dd === day && p.idx === cur && !p.pre && entryHasData(state.logs[k]);
    });
  }
  function suggestDay() {
    const wd = new Date().getDay();
    const usesLog = Object.keys(state.logs).some((k) => entryHasData(state.logs[k]));
    const doneA = loggedThisWeek("A"), doneB = loggedThisWeek("B");
    if (wd === 1) return "A";
    if (wd === 2) return usesLog && !doneA ? "A" : "B";
    if (wd === 6) return usesLog && !doneA ? "A" : usesLog && !doneB ? "B" : "C";
    if (!doneA) return "A";
    if (!doneB) return "B";
    return "C";
  }
  function lastFor(exId, beforeKey) {
    const keys = Object.keys(state.logs).filter((k) => k < beforeKey).sort().reverse();
    for (const k of keys) {
      const sets = state.logs[k].ex && state.logs[k].ex[exId];
      if (sets && sets.some((s) => s && (s.w || s.r))) return { date: k.slice(0, 10), sets };
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
  function resolveItem(it, ctx, slotKey) {
    let b = it, variant = null;
    if (it.hl) { b = Object.assign({ ex: it.ex }, ctx.heavy ? it.hl.heavy : it.hl.light); variant = ctx.heavy ? "тяжёлый жим" : "лёгкий жим"; }
    if (it.weekAlt) b = Object.assign({}, it.weekAlt[ctx.heavy ? 0 : 1]);
    let exId = b.ex;
    const sw = state.swaps[slotKey];
    if (sw && (EX[exId].alts || []).includes(sw)) exId = sw;
    let sets = b.sets, reps = b.reps, rir = b.rir, myo = !!b.myo;
    if (myo) {
      if (ctx.light || ctx.low) { myo = false; sets = 2; reps = "12–15"; rir = ctx.light ? "3–4" : "2"; }
    } else if (ctx.light) { sets = Math.max(2, sets - 1); if (rir != null) rir = "3–4"; }
    else if (ctx.low && sets >= 3) { sets -= 1; rir = bumpRIR(rir, 1); }
    return { exId, baseId: b.ex, sets, reps, rir, myo, note: b.note || null, variant, tempo: b.tempo || null };
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
    const d = ex.ds;
    return `<div class="ds"><div class="how-sub">Пошагово — база упражнений <span class="muted">(${esc(d.n)})</span></div>
      <ol>${d.s.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>
      ${mediaBlock(d.m, d.n)}</div>`;
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
      <p class="muted small">Велотренажёр с высоким сопротивлением или эйр-байк, не бег. Двух спринтов достаточно ${rich("{vollaard17}")} ${rich("{metcalfe12}")}. Снюс — не ближе чем за 1–2 часа.</p></div>`;
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
    if (prio) tags.push(`<span class="tag">★ приоритет</span>`);
    (ex.tags || []).forEach((t) => tags.push(`<span class="tag">${esc(t)}</span>`));
    const opts = [r.baseId].concat(EX[r.baseId].alts || []);
    const swapped = r.exId !== r.baseId;
    const swap = opts.length > 1 ? `<select class="swap ${swapped ? "on" : ""}" data-swap="${esc(slotKey)}" aria-label="Замена упражнения">${opts.map((id) => `<option value="${id}" ${id === r.exId ? "selected" : ""}>${id === r.baseId ? (swapped ? "↩ Вернуть: " + esc(EX[id].n) : "⇄ Замена") : esc(EX[id].n)}</option>`).join("")}</select>` : "";
    const how = `<div class="how-b pane" data-pane="how" hidden><div class="how-sub">Важно для тебя</div><ul>${(ex.cues || []).map((c) => `<li>${rich(c)}</li>`).join("")}</ul>${ex.why ? `<div class="why">${rich(ex.why)}</div>` : ""}${dsHTML(ex)}</div>`;

    const key = logKey(todayISO(), ctx.day);
    const cur = (state.logs[key] && state.logs[key].ex && state.logs[key].ex[r.exId]) || [];
    const prev = lastFor(r.exId, key);
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
    const logBlock = `<div class="log pane" data-pane="log" ${hasToday ? "" : "hidden"}>${rows}<div class="prev">${esc(prevTxt)} <span class="saved" data-saved="${r.exId}">сохранено</span></div></div>`;
    const tools = `<div class="ex-tools"><button class="lnk" data-toggle="how" aria-expanded="false">Как делать</button><button class="lnk ${hasToday ? "on" : ""}" data-toggle="log" aria-expanded="${hasToday}">Записать${hasToday ? " ✓" : ""}</button>${swap}</div>`;

    return `<div class="ex">
      <div class="ex-h"><span class="code">${code}</span><div class="ex-main">
        <div class="ex-name">${esc(ex.n)}</div>
        <div class="scheme">${scheme}</div>
        ${r.note ? `<div class="ex-note">${esc(r.note)}</div>` : ""}
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
    const banners = [updateBanner(), installBanner()];
    if (ctx.auto.pre && !state.manualWeek) banners.push(`<div class="banner accent">Старт — ${WD[parseISO(state.settings.start).getDay()]}, ${fmtDate(state.settings.start)}. Ниже превью первой недели.</div>`);
    else if (![1, 2, 6].includes(wd)) banners.push(`<div class="banner">Сегодня ${WD[wd]} — по плану отдых: шаги и одна микродоза. Если всё же идёшь в зал — следующая по очереди тренировка уже выбрана.</div>`);
    if (ctx.light) banners.push(`<div class="banner warn"><b>Разгрузочная неделя.</b> Веса −10–15 %, подходов на один меньше, RIR 3–4. Загляни в «Журнал»: первая и последняя тренировка блока по каждому упражнению — это и есть прогресс блока.</div>`);
    if (ctx.low) banners.push(`<div class="banner warn"><b>Режим «так себе».</b> На подход меньше, +1 повтор в запасе, без спринтов и бонусов, интервалы — в зоне 2. Пришёл и сделал ядро — тренировка засчитана. Завтра режим сам вернётся в «норм».</div>`);
    else if (ctx.time <= 60) banners.push(`<div class="banner">60 минут — только ядро. Руки, икры и база всё равно получают нагрузку.</div>`);

    const weekOpts = ['<option value="">текущая</option>'].concat(Array.from({ length: 15 }, (_, i) => `<option value="${i + 1}" ${+state.manualWeek === i + 1 ? "selected" : ""}>${i + 1} · блок ${Math.floor(i / 5) + 1}</option>`)).join("");
    const dayBtn = (d, lab, sub) => `<button data-day="${d}" class="${ctx.day === d ? "on" : ""}">${lab}<small>${sub}</small></button>`;
    const timeBtn = (t) => `<button data-time="${t}" class="${ctx.time === t ? "on" : ""}">${t}<small>мин</small></button>`;
    const groups = sess.groups.filter((g) => groupVisible(g, ctx)).map((g) => groupHTML(g, ctx, sessKey)).join("");

    return `
      ${banners.join("")}
      <div class="controls">
        <div class="seg" role="group" aria-label="Тренировка">${dayBtn("A", "A", "Пн")}${dayBtn("B", "B", "Вт")}${dayBtn("C", "C", "Сб · по желанию")}</div>
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
      <div class="weekbar"><label>Неделя программы <select data-week aria-label="Неделя программы">${weekOpts}</select></label>${state.manualWeek ? `<button class="lnk" data-weekauto="1">вернуть текущую</button>` : ""}</div>
      ${groups}
      <section class="card soft"><h3>Цели блока «${esc(blk.name)}»</h3>${goalsHTML(ctx.block)}</section>
      <p class="muted small">Подходы сохраняются на этом устройстве автоматически. Резервная копия — «Ещё → Настройки → Экспорт».</p>`;
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
          const ex = EX[b.ex];
          if (!ex || !ex.m) return;
          const sets = b.myo ? (b.eff || 2) : b.sets;
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
  function renderPlan() {
    const ctx = ctxNow();
    if (!state.volBlock) state.volBlock = ctx.block;
    const days = [["Пн", "A", "on"], ["Вт", "B", "on"], ["Ср", "шаги", ""], ["Чт", "шаги", ""], ["Пт", "шаги", ""], ["Сб", "C", "opt"], ["Вс", "шаги", ""]];
    const grid = days.map(([d, t, c]) => `<div class="wd ${c}"><b>${t}</b>${d}</div>`).join("");
    const blocks = P.blocks.map((b) => `<div class="blk ${b.id === ctx.block ? "cur" : ""}">
        <h3>Блок ${b.id} «${esc(b.name)}» <small>недели ${b.weeks}</small></h3>
        <p>${esc(b.theme)}</p>
        <p class="small"><b>Навык:</b> ${esc(b.skill.title)} — ${esc(b.skill.goal)}.</p>
        <div class="small"><b>Цели:</b>${goalsHTML(b.id)}</div></div>`).join("");
    const blkBtns = P.blocks.map((b) => `<button data-volblock="${b.id}" class="${state.volBlock === b.id ? "on" : ""}">Блок ${b.id}</button>`).join("");
    return `
      <h2>Как это устроено</h2>
      <section class="card">${rich(P.content.how)}</section>
      <section class="card">
        <h3>Неделя</h3>
        <div class="week-grid">${grid}</div>
        <p class="small muted">A — низ, жим лёжа, трицепс. B — спина, задняя поверхность, бицепс. C — интервалы и памп, по желанию. Икры, дельты и руки — в обеих основных тренировках.</p>
      </section>
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
  function loadLib() {
    if (LIB.items || LIB.loading) return;
    LIB.loading = true;
    fetch("data/exercises-ru.json").then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then((j) => { LIB.items = j.items; LIB.loading = false; if (state.tab === "library") render(); })
      .catch((e) => { LIB.loading = false; LIB.error = String(e.message || e); if (state.tab === "library") render(); });
  }
  function libFiltered() {
    const q = LIB.q.trim().toLowerCase();
    return LIB.items.filter((x) => {
      if (LIB.bp === "prog" && !progByDs[x.id]) return false;
      if (LIB.bp !== "all" && LIB.bp !== "prog" && x.bp !== LIB.bp) return false;
      if (LIB.eq !== "all" && x.eq !== LIB.eq) return false;
      if (!q) return true;
      const hay = `${x.n} ${ru(BP_RU, x.bp)} ${ru(MU_RU, x.t)} ${ru(EQ_RU, x.eq)} ${x.sec.map((m) => ru(MU_RU, m)).join(" ")} ${(progByDs[x.id] || []).join(" ")}`.toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  }
  function libRow(x) {
    const inProg = progByDs[x.id];
    return `<div class="lib-row" data-libid="${x.id}" role="button" tabindex="0" aria-expanded="false">
      <div class="lib-n">${esc(x.n)}${inProg ? ` <span class="tag">в программе</span>` : ""}</div>
      <div class="lib-m">${esc(ru(MU_RU, x.t))} · ${esc(ru(EQ_RU, x.eq))}${inProg ? ` · ${esc(inProg.join(", "))}` : ""}</div></div>`;
  }
  function libDetail(x) {
    return `<div class="lib-d">
      <div class="small muted">Зона: ${esc(ru(BP_RU, x.bp))} · цель: ${esc(ru(MU_RU, x.t))}${x.sec.length ? ` · помогают: ${esc(x.sec.map((m) => ru(MU_RU, m)).join(", "))}` : ""} · ${esc(ru(EQ_RU, x.eq))}</div>
      <ol>${x.s.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      ${mediaBlock(`${x.id}-${x.m}`, x.n)}</div>`;
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
        <input type="search" class="search" placeholder="Поиск: bench, тяга, бицепс, гантели…" value="${esc(LIB.q)}" data-libq="1" aria-label="Поиск упражнения">
        <div class="chips">${bps.map(([k, n]) => `<button class="chip ${LIB.bp === k ? "on" : ""}" data-libbp="${k}">${n}</button>`).join("")}</div>
        <select data-libeq="1" aria-label="Оборудование">${eqs.map((k) => `<option value="${esc(k)}" ${LIB.eq === k ? "selected" : ""}>${k === "all" ? "Любое оборудование" : esc(ru(EQ_RU, k))}</option>`).join("")}</select>
      </div>
      <div id="libList">${libListHTML()}</div>
      <p class="small muted" style="margin-top:14px">База: <a href="https://github.com/hasaneyldrm/exercises-dataset" target="_blank" rel="noopener">exercises-dataset</a> — 1324 упражнения, инструкции на русском (данные по лицензии MIT). Анимации — ${GV}; в приложение не скопированы и подгружаются по ссылке, только если ты их включишь.</p>`;
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
    return `<svg width="84" height="26" viewBox="0 0 84 26" aria-hidden="true"><polyline points="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  function renderJournal() {
    const prog = progressData();
    const ids = Object.keys(prog).sort((a, b) => prog[b][prog[b].length - 1].date.localeCompare(prog[a][prog[a].length - 1].date));
    const progHTML = ids.length ? ids.map((id) => {
      const arr = prog[id], first = arr[0], last = arr[arr.length - 1];
      const pct = first.score ? ((last.score - first.score) / first.score) * 100 : 0;
      const dl = arr.length > 1 ? `<span class="delta ${pct >= 0 ? "up" : "down"}">${pct >= 0 ? "+" : ""}${fmtNum(pct)} %</span>` : "";
      const lastTxt = last.w > 0 ? `${fmtNum(last.w)} × ${fmtNum(last.r)} · 1ПМ ≈ ${Math.round(last.score)} кг` : `${fmtNum(last.r)} повт.`;
      return `<div class="prog-row"><div class="nm">${esc(EX[id] ? EX[id].n : id)}</div>${spark(arr)}<div class="meta">${lastTxt} · ${arr.length} трен. ${dl}</div></div>`;
    }).join("") : `<div class="empty">Пока пусто: записывай подходы на вкладке «Сегодня» — здесь появится динамика по каждому упражнению.</div>`;
    const meas = state.meas.slice().sort((a, b) => b.date.localeCompare(a.date));
    const first = state.meas.slice().sort((a, b) => a.date.localeCompare(b.date))[0];
    const cell = (v, f) => {
      if (v === "" || v == null) return "—";
      const d = first && first[f] !== "" && first[f] != null ? +v - +first[f] : null;
      return `${fmtNum(+v)}${d ? ` <span class="small muted">(${d > 0 ? "+" : ""}${fmtNum(d)})</span>` : ""}`;
    };
    const measRows = meas.map((m) => `<tr><td>${fmtDate(m.date)}</td><td>${cell(m.w, "w")}</td><td>${cell(m.waist, "waist")}</td><td>${cell(m.arm, "arm")}</td><td>${cell(m.calf, "calf")}</td><td>${cell(m.bf, "bf")}</td><td><button class="btn ghost small" data-delmeas="${esc(m.date)}" aria-label="Удалить запись">×</button></td></tr>`).join("");
    return `
      <h2>Замеры</h2>
      <section class="card">
        <div class="form-grid" id="measForm">
          <label>Дата<input type="date" name="date" value="${todayISO()}"></label>
          <label>Вес, кг<input inputmode="decimal" name="w" placeholder="89"></label>
          <label>Талия, см<input inputmode="decimal" name="waist" placeholder="по пупку"></label>
          <label>Рука, см<input inputmode="decimal" name="arm" placeholder="в напряжении"></label>
          <label>Икра, см<input inputmode="decimal" name="calf" placeholder="самое широкое место"></label>
          <label>Жир, %<input inputmode="decimal" name="bf" placeholder="калипер"></label>
        </div>
        <div style="margin-top:10px"><button class="btn primary" data-addmeas="1">Сохранить замер</button></div>
        <p class="small muted" style="margin-top:8px">Вес — утром, 3–4 раза в неделю (смотри среднее). Талия — раз в 2 недели, рука и икра — раз в месяц, утром до нагрузки.</p>
        ${meas.length ? `<div class="tbl-wrap"><table class="t"><thead><tr><th>Дата</th><th>Вес</th><th>Талия</th><th>Рука</th><th>Икра</th><th>Жир</th><th></th></tr></thead><tbody>${measRows}</tbody></table></div><p class="small muted">В скобках — изменение от первого замера.</p>` : ""}
      </section>
      <h2>Прогресс по упражнениям</h2>
      <section class="card">${progHTML}
        <p class="small muted" style="margin-top:8px">1ПМ — расчётный максимум по формуле Эпли из лучшего подхода тренировки: так видно рост, даже когда меняются повторы.</p></section>`;
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
      <section class="card">
        <h3>Данные</h3>
        <p class="small">${SY && SY.signedIn() ? "Журнал, замеры, цели и замены синхронизируются с базой. Экспорт — резервная копия в JSON-файл." : "Без входа всё хранится только на этом устройстве. Экспорт — резервная копия в JSON-файл."}</p>
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
    const t = e.target.closest("button,[data-tab]");
    if (!t) return;
    const d = t.dataset;
    if (d.auth && SY) { authAction(d.auth, t); return; }
    if (d.sync === "now" && SY) { SY.syncNow(); return; }
    if (d.toggle) {
      const pane = t.closest(".ex").querySelector(`[data-pane="${d.toggle}"]`);
      if (pane) { pane.hidden = !pane.hidden; t.setAttribute("aria-expanded", String(!pane.hidden)); t.classList.toggle("on", !pane.hidden); }
      return;
    }
    if (d.tab) { go(d.tab); return; }
    if (t.id === "back") { go("more"); return; }
    if (d.day) { state.day = d.day; render(); return; }
    if (d.weekauto) { state.manualWeek = null; S.set("manualWeek", null); render(); return; }
    if (d.time) { state.time = +d.time; S.set("time", state.time); render(); return; }
    if (d.ready) { state.ready = d.ready; S.set("ready", d.ready); S.set("readyDate", todayISO()); render(); return; }
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
      state.settings = { start: get("start") || P.meta.startDefault, bw: +get("bw") || P.meta.profile.weight, hrmax: +get("hrmax") || 180 };
      S.set("settings", state.settings); state.day = suggestDay(); t.textContent = "Сохранено"; return;
    }
    if (d.resetswaps) { state.swaps = {}; S.set("swaps", {}); t.textContent = "Замены сброшены"; return; }
    if (d.export) {
      const data = { app: "upgrade-v3", version: P.meta.version, exported: new Date().toISOString(), settings: state.settings, logs: state.logs, meas: state.meas, goals: state.goals, swaps: state.swaps };
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      a.download = `upgrade-v3-${todayISO()}.json`; document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    if (t.id === "themeBtn") { state.theme = state.theme === "auto" ? "light" : state.theme === "light" ? "dark" : "auto"; S.set("theme", state.theme); applyTheme(); return; }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("lib-row")) { e.preventDefault(); toggleLib(e.target); }
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
    if (d.week !== undefined) { state.manualWeek = t.value ? +t.value : null; S.set("manualWeek", state.manualWeek); render(); return; }
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
    if (!d.log) return;
    const ctx = ctxNow();
    const key = logKey(todayISO(), ctx.day);
    const entry = state.logs[key] = state.logs[key] || { day: ctx.day, block: ctx.block, week: ctx.week, ex: {} };
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
      if (k === "settings") state.settings = Object.assign({ start: P.meta.startDefault, bw: P.meta.profile.weight, hrmax: 180 }, S.get("settings", {}));
      else if (SYNCED.includes(k)) state[k] = S.get(k, k === "meas" ? [] : {});
    });
    if (keys.includes("settings") || keys.includes("logs")) state.day = suggestDay();
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
      state.settings = Object.assign({ start: P.meta.startDefault, bw: P.meta.profile.weight, hrmax: 180 }, S.get("settings", {}));
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
