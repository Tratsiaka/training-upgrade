(function () {
  "use strict";
  const P = window.PROGRAM;
  const S = window.Store;
  const SY = window.Sync || null;
  // Личные заметки (приходят из базы после входа) накладываются на публичную программу до первого рендера.
  if (SY && SY.overlay()) { try { SY.applyOverlay(P, SY.overlay()); } catch (e) { console.error(e); } }
  const EX = P.exercises;
  const PG = window.Programs;
  // Исходная встроенная программа (после личных заметок): P.meta/blocks/sessions подменяются на текущую программу (bindProgram).
  const BUILTIN = { meta: P.meta, blocks: P.blocks, sessions: P.sessions };
  // Правки программы (plan.js): изменённые тренировки и упражнения из базы. Создаётся после S.init() — для текущей программы.
  let PM = null;
  const sessOf = (key) => (PM ? PM.sess(key) : P.sessions[key]);
  const isStrength = (g) => window.PlanModel.isStrength(g);
  const MEDIA = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/";
  const GV = "© Gym visual — gymvisual.com";

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  /** Своё свойство объекта (не из прототипа): имена из адреса и с сервера — «constructor», «__proto__» не проходят. */
  const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);
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

  /* ---------- иконки: свой набор линейных SVG (24×24, обводка 2, скруглённые концы) ----------
     Спрайт <symbol id="i-…"> вставляется в документ один раз; icon(name, size) → <svg class="ic"><use href="#i-name"/></svg>. */
  const ICONS = {
    dumbbell: '<rect x="4.5" y="6" width="3.5" height="12" rx="1.2"/><rect x="16" y="6" width="3.5" height="12" rx="1.2"/><path d="M2 9.5v5M22 9.5v5M8 12h8"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    layers: '<path d="M12 3 2.5 7.8 12 12.6l9.5-4.8z"/><path d="m2.5 12.2 9.5 4.8 9.5-4.8"/><path d="m2.5 16.4 9.5 4.8 9.5-4.8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>',
    "bar-chart": '<path d="M3.5 20.5h17"/><path d="M7 16.5V11M12 16.5V5.5M17 16.5V8.5"/>',
    "more-horizontal": '<circle cx="5" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="19" cy="12" r="1.1"/>',
    "more-vertical": '<circle cx="12" cy="5" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="12" cy="19" r="1.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="m4.5 12.5 5 5 10-11"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    "chevron-right": '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
    "chevron-left": '<path d="M15 5.5 8.5 12l6.5 6.5"/>',
    "chevron-down": '<path d="m5.5 9 6.5 6.5L18.5 9"/>',
    "chevron-up": '<path d="M5.5 15 12 8.5l6.5 6.5"/>',
    "arrow-left": '<path d="M19.5 12h-15M11 5l-7 7 7 7"/>',
    "arrow-right": '<path d="M4.5 12h15M13 5l7 7-7 7"/>',
    "arrow-up": '<path d="M12 19.5v-15M5 11l7-7 7 7"/>',
    "arrow-down": '<path d="M12 4.5v15M5 13l7 7 7-7"/>',
    pencil: '<path d="M15.5 4.5a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3L8.5 19.5 3.5 20.5l1-5z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M3.5 6.5h17M9 6.5V4.5h6v2M18.5 6.5l-.8 13a1.5 1.5 0 0 1-1.5 1.5H7.8a1.5 1.5 0 0 1-1.5-1.5l-.8-13M10 11v6M14 11v6"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
    swap: '<path d="M16.5 3.5 20.5 7.5l-4 4M20.5 7.5h-15M7.5 12.5l-4 4 4 4M3.5 16.5h15"/>',
    "trending-up": '<path d="m3.5 17 6-6 4 4 7-7.5"/><path d="M15 7.5h5.5V13"/>',
    repeat: '<path d="m17 2.5 3.5 3.5L17 9.5"/><path d="M3.5 11.5v-1A4.5 4.5 0 0 1 8 6h12.5"/><path d="M7 21.5 3.5 18 7 14.5"/><path d="M20.5 12.5v1A4.5 4.5 0 0 1 16 18H3.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    timer: '<circle cx="12" cy="13.5" r="8"/><path d="M12 9.5v4l2.5 1.6M9.5 2.5h5M19 5.5l-1.5 1.5"/>',
    play: '<path d="M7.5 4.8v14.4a.8.8 0 0 0 1.2.7l11.3-7.2a.8.8 0 0 0 0-1.4L8.7 4.1a.8.8 0 0 0-1.2.7z"/>',
    "play-circle": '<circle cx="12" cy="12" r="9"/><path d="M10 8.6v6.8l5.6-3.4z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16.5v-5M12 7.8v.2"/>',
    star: '<path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
    "star-fill": '<path fill="currentColor" d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
    settings: '<path d="M4 7h9M19 7h1M4 17h3M13 17h7"/><circle cx="16" cy="7" r="2.6"/><circle cx="10" cy="17" r="2.6"/>',
    cloud: '<path d="M7.5 19h9.4a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6 9.4 4.8 4.8 0 0 0 7.5 19z"/>',
    "cloud-off": '<path d="M9.5 5.4A6 6 0 0 1 17.4 10.4a4.3 4.3 0 0 1 2.6 7.3M16 19H7.5A4.8 4.8 0 0 1 6 9.4"/><path d="m3 3 18 18"/>',
    refresh: '<path d="M20 11.5a8 8 0 0 0-14.6-4.2M4 3.5v4h4"/><path d="M4 12.5a8 8 0 0 0 14.6 4.2M20 20.5v-4h-4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M20 14.6A8.3 8.3 0 0 1 9.4 4a8.3 8.3 0 1 0 10.6 10.6z"/>',
    monitor: '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
    flame: '<path d="M12 21.5c3.6 0 6.5-2.7 6.5-6.3 0-3.3-1.9-5.5-3.6-7.4-.3 1.7-1.2 2.8-2.5 3.4.4-3.3-1-6.2-3.5-7.7.1 3.5-2 5.3-3.4 7.3a7.6 7.6 0 0 0-2 4.4c0 3.6 2.9 6.3 6.5 6.3z"/>',
    "heart-pulse": '<path d="M19.6 13.2c1.1-1.3 1.9-2.8 1.9-4.6A4.6 4.6 0 0 0 12 6.1a4.6 4.6 0 0 0-9.5 2.5c0 1.8.8 3.3 1.9 4.6L12 20.5z"/><path d="M3.5 12.5h4.2l1.6-2.6 2.8 4.8 1.7-2.2h6.7"/>',
    activity: '<path d="M2.5 12h4l3-8 5 16 3-8h4"/>',
    zap: '<path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z"/>',
    link: '<path d="M10 13.5a4.2 4.2 0 0 0 6 .4l3-3a4.2 4.2 0 0 0-6-6l-1.6 1.6"/><path d="M14 10.5a4.2 4.2 0 0 0-6-.4l-3 3a4.2 4.2 0 0 0 6 6l1.6-1.6"/>',
    unlink: '<path d="M15.5 13.5l3.5-3a4.2 4.2 0 0 0-6-6l-1.6 1.6M8.5 10.5l-3.5 3a4.2 4.2 0 0 0 6 6l1.6-1.6"/><path d="M4 4l2 2M20 20l-2-2M9 2.5v2.5M2.5 9H5M15 21.5V19M21.5 15H19"/>',
    "grip-vertical": '<circle cx="9" cy="5.5" r="1.1"/><circle cx="15" cy="5.5" r="1.1"/><circle cx="9" cy="12" r="1.1"/><circle cx="15" cy="12" r="1.1"/><circle cx="9" cy="18.5" r="1.1"/><circle cx="15" cy="18.5" r="1.1"/>',
    "arrow-up-down": '<path d="M7.5 20V4M3.5 8l4-4 4 4M16.5 4v16M12.5 16l4 4 4-4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    "book-open": '<path d="M12 6.8C9.5 5 6.3 4.5 3 5v14c3.3-.5 6.5 0 9 1.8 2.5-1.8 5.7-2.3 9-1.8V5c-3.3-.5-6.5 0-9 1.8zM12 6.8v14"/>',
    apple: '<path d="M12 7.6c-1.4-1-3-1.4-4.6-1C4.9 7.2 3.6 9.6 4 13c.5 4.4 3.1 7.8 5.2 7.8 1.1 0 1.7-.6 2.8-.6s1.7.6 2.8.6c2.1 0 4.7-3.4 5.2-7.8.4-3.4-.9-5.8-3.4-6.4-1.6-.4-3.2 0-4.6 1z"/><path d="M12 7.6c-.2-2.2.8-4 2.8-5"/>',
    shield: '<path d="M12 3 4.5 5.8v5.7c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V5.8z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 20.5c.6-3.7 3.9-6.3 8-6.3s7.4 2.6 8 6.3"/>',
    download: '<path d="M12 3.5v12M7 10.5l5 5 5-5M4 20.5h16"/>',
    upload: '<path d="M12 15.5v-12M7 8.5l5-5 5 5M4 20.5h16"/>',
    undo: '<path d="M9 14.5 4 9.5l5-5"/><path d="M4 9.5h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    "alert-triangle": '<path d="M10.3 4.2 2.6 17.6A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-2.9L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.5M12 17.2v.1"/>',
    "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8L16.2 9.5"/>',
    list: '<path d="M9 6h11.5M9 12h11.5M9 18h11.5M4 6h.5M4 12h.5M4 18h.5"/>',
    sparkles: '<path d="M10 3.5 11.8 8.7 17 10.5l-5.2 1.8L10 17.5l-1.8-5.2L3 10.5l5.2-1.8z"/><path d="M18 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>',
    flag: '<path d="M5 21.5v-17M5 4.5h12.5l-2.5 4.5 2.5 4.5H5"/>',
    scale: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 10a5.6 5.6 0 0 1 8 0M12 10.5l1.6-2.3"/>',
    ruler: '<rect x="2.5" y="7.5" width="19" height="9" rx="1.8"/><path d="M6.5 7.5v3M10 7.5v4.5M13.5 7.5v3M17 7.5v4.5"/>',
    send: '<path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5-7.5-4z"/>',
    "log-out": '<path d="M9.5 20.5H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h3.5M16 16.5l4.5-4.5L16 7.5M20.5 12H9.5"/>',
    smartphone: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18h2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
    wifi: '<path d="M2.5 8.8a14 14 0 0 1 19 0M5.5 12.3a9.5 9.5 0 0 1 13 0M8.6 15.7a5 5 0 0 1 6.8 0M12 19.3v.1"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="m21 16-5-5-10 9"/>',
    /* группы мышц — для плиток упражнений */
    chest: '<path d="M8.5 3.5 3 6l1.8 4.5 2.2-.8v10.8h10V9.7l2.2.8L21 6l-5.5-2.5a3.5 3.5 0 0 1-7 0z"/><path d="M8.5 11.5c1.3 1 2.4 1 3.5 0 1.1 1 2.2 1 3.5 0"/>',
    legs: '<path d="M8.5 2.5h6l.3 6.3a3 3 0 0 1-.9 2.3l-1.1 1.1.7 6.8H18a1.5 1.5 0 0 1 1.5 1.5v1h-8.3l-.9-8.6-1.6-3.2a3.5 3.5 0 0 1-.4-1.6z"/>',
    shoulders: '<path d="M3.5 19.5c0-4.6 2.6-7.5 6-8M20.5 19.5c0-4.6-2.6-7.5-6-8"/><circle cx="12" cy="7.5" r="3.5"/><path d="M8 3.5 5.5 6M16 3.5 18.5 6"/>',
    arms: '<path d="M3 18.5v-3C3 11.6 6.2 8.5 10 8.5c1.9 0 3.2.8 4 2L13 6.8c-.4-1.8.9-3.3 2.6-3.3 1.8 0 3.2 1.5 3 3.4l-.6 4.6.5 3.9a3 3 0 0 1-3 3.1z"/><path d="M8 13.5c1.4-.6 2.9-.6 4.5.3"/>',
  };
  function iconSprite() {
    return `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false" id="icSprite">${Object.keys(ICONS).map((k) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</symbol>`).join("")}</svg>`;
  }
  if (!document.getElementById("icSprite")) document.body.insertAdjacentHTML("afterbegin", iconSprite());
  /** <svg class="ic"> со ссылкой на символ спрайта. Иконка всегда декоративная: подпись — текстом рядом или в aria-label кнопки. */
  const icon = (name, size, cls) => `<svg class="ic${cls ? " " + cls : ""}" width="${size || 20}" height="${size || 20}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
  /* Группа мышц упражнения: плитка-иконка на цвете группы. */
  const MUSCLE_GROUP = { chest: "chest", back: "back", biceps: "arms", triceps: "arms", forearms: "arms", frontdelts: "shoulders", sidedelts: "shoulders", reardelts: "shoulders",
    quads: "legs", hams: "legs", glutes: "legs", adductors: "legs", calves: "legs", core: "core" };
  const BP_GROUP = { chest: "chest", back: "back", "upper arms": "arms", "lower arms": "arms", shoulders: "shoulders", neck: "shoulders", "upper legs": "legs", "lower legs": "legs", waist: "core", cardio: "cardio" };
  const GROUP_RU = { chest: "грудь", back: "спина", legs: "ноги", shoulders: "плечи", arms: "руки", core: "кор", cardio: "кардио" };
  // спина и кор узнаваемо в 22 px не рисуются — у них общая гантель, а группу видно по цвету плитки и слову в подстроке
  const GROUP_IC = { chest: "chest", back: "dumbbell", legs: "legs", shoulders: "shoulders", arms: "arms", core: "dumbbell", cardio: "heart-pulse" };
  const GENERIC_GROUP = (g) => GROUP_IC[g] === "dumbbell";
  const tileHTML = (grp, size) => grp ? `<span class="ex-tile m-${grp}" title="${esc(GROUP_RU[grp])}" aria-hidden="true">${icon(GROUP_IC[grp], size || 22)}</span>` : `<span class="ex-tile neutral" aria-hidden="true">${icon("dumbbell", size || 22)}</span>`;
  const dayTile = (d, cls) => `<span class="day-tile d-${esc(d)}${cls ? " " + cls : ""}" aria-hidden="true">${esc(d)}</span>`;

  /* ---------- state ---------- */
  const state = {};
  const T = { end: 0, id: null, state: "idle" };
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
      logs: cleanLogs(S.get("logs", {})),
      meas: S.get("meas", []),
      goals: S.get("goals", {}),
      theme: S.get("theme", "auto"),
      media: S.get("media", false),
      volBlock: null,
      volSat: false,
      open: {},        // «Сегодня»: раскрыты ли карточки вручную ("2026-11-14_A|bench": { v, sig })
      draft: {},       // «Сегодня»: повторы, выставленные −/+ до ✓ ("2026-11-14_A|bench|0|r": "9")
      allSets: {},     // «Сегодня»: карточки, где показаны все подходы, а не только следующий
      typed: {},       // «Сегодня»: подходы, записанные вводом повторов, но ещё без ✓
      askW: null,      // «Сегодня»: подход, где уже спросили вес
      dayDate: null,   // дата, для которой выбран state.day
      ctlOpen: false,  // «Сегодня»: раскрыты ли время и самочувствие
      warmOpen: false, // «Сегодня»: раскрыта ли разминка
      pv: "hub"        // «Программа»: открытый экран (см. planGo)
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
  /* ---------- текущая программа (src/programs.js) ----------
     Одна «открытая» программа на всё приложение: и «Сегодня», и редактор. Встроенная — "main" (правки в ключе plan),
     свои — записи в ключе progs. Привязка подменяет P.meta/blocks/sessions и пересоздаёт PM с io текущей программы. */
  /* Ключи: progs (записи, синхронизация prog:<id>), progPos (места своих программ, pos:<id>), curprog ({ id } — текущая).
     cycle — всегда место встроенной. Всё читается через проверку (Programs.sanitize…): битая запись не привязывается. */
  const cached = (key, clean) => { let raw, val; return () => { const v = S.get(key, null); if (v !== raw || val === undefined) { raw = v; val = clean(v); } return val; }; };
  const progsAll = cached("progs", PG.sanitizeAll);
  const posAll = cached("progPos", PG.cleanPosAll);
  let BOUND = PG.MAIN;
  /** id из curprog, записи которого пока нет (ещё не доехала с сервера): показываем «Апгрейд» и ничего не пишем. */
  let missingWant = null;
  const curId = () => BOUND;
  const curRec = () => (BOUND === PG.MAIN ? null : progsAll()[BOUND] || null);
  const isMain = () => BOUND === PG.MAIN;
  /** Своя программа (с нуля, из шаблона): один блок, недели подряд, без разгрузок и целей. */
  const isCustom = () => PG.isCustom(curRec());
  const progKind = () => (isMain() ? "main" : isCustom() ? "custom" : "copy");
  /** Запись журнала текущей программы — по ключу (у своей — «…@id»). */
  const mineK = (k) => PG.parseLogKey(k).prog === BOUND;
  const mainIO = { get: () => S.get("plan", null), set: (v) => S.set("plan", v) };
  function saveRec(rec) { const all = Object.assign({}, progsAll()); all[rec.id] = rec; S.set("progs", all); }
  const progIO = (id) => ({ get: () => (progsAll()[id] || {}).plan || null, set: (v) => { const r = progsAll()[id]; if (r) saveRec(PG.patch(r, { plan: v })); } });
  /** Упражнения из базы всех программ — в P.exercises (журнал, избранное и недавние не теряют названия). */
  function injectAllX() { const all = progsAll(); PG.injectX(EX, [PG.cleanPlan(S.get("plan", null))].concat(Object.keys(all).map((k) => all[k].plan))); }
  function bindProgram() {
    const cur = PG.current(S.get("curprog", null), progsAll());
    missingWant = cur.missing ? cur.want : null;
    BOUND = cur.id;
    PG.bind(P, BUILTIN, cur.rec);
    injectAllX();
    PM = window.PlanModel.create(P, cur.rec ? progIO(cur.id) : mainIO);
    injectAllX(); // своё (PM.inject) не перебивает упражнения других программ с тем же id — у всех одна запись базы
    // отмены и проверенная корректировка — про прежнюю программу
    lastUndo = null; planUndo = null; adjDraft = null;
    return cur;
  }
  /** id текущей есть, а записи нет: записать переход на «Апгрейд». Только когда запись точно отсутствует
      (синхронизация прошла, входа нет или запись удалили на сервере). true — переход записан. */
  function commitMissing() {
    if (!missingWant) return false;
    if (progsAll()[missingWant]) { bindProgram(); return false; }
    missingWant = null;
    S.set("curprog", { id: PG.MAIN });
    bindProgram();
    return true;
  }
  /* Дни и блоки текущей программы — одно место для всего кода. */
  const days = () => PG.daysOf(curRec());
  const blocks = () => P.blocks;
  const multiBlock = () => blocks().length > 1;
  /** Тренировка без силовых упражнений в программе (по текущему блоку). */
  const emptySess = (d, b) => { const s = PM && sessOf(`${b || 1}${d}`); return !!s && !PM.strengthIdx(s.groups).length; };
  /** Необязательная тренировка: у «Апгрейда» и копии обязательны A и B; у своей — все. */
  const optional = (d) => !isCustom() && !["A", "B"].includes(d);
  /* Чередование своей программы (rec.rot, src/programs.js): тренировок в неделю меньше, чем в программе, — очередь по кругу. */
  const rotNow = () => PG.rotOf(curRec());
  /** Тренировки недели idx по очереди: у своей с чередованием — pw букв, иначе все. */
  const weekDays = (idx) => (isCustom() ? PG.weekDays(curRec(), idx) : days());
  /** Обязательные тренировки недели idx: у своей — непустые из очереди недели (без чередования — все непустые). */
  const reqDays = (b, idx) => (isCustom() ? weekDays(idx == null ? cycleState().idx : idx) : days()).filter((d) => !optional(d) && !emptySess(d, b));
  const weeks = () => (isCustom() ? Infinity : blocks().length * P.meta.blockWeeks);
  /** Разгрузка — последняя неделя блока (только у программ с блоками). */
  const isDeload = (p) => !isCustom() && p.week === P.meta.blockWeeks;
  /** Подпись места: «блок 1, неделя 3» / у своей — «неделя 3». */
  const placeTxt = (p) => (isCustom() ? `неделя ${p.week}` : `блок ${p.block}, неделя ${p.week}`);
  /* Нумерация внутри тренировки: связки по порядку (1, 2, 3…), в суперсете — «2а», «2б». Буквы A–F — только тренировки. */
  const SUBL = ["а", "б", "в", "г", "д", "е", "ж", "з"];
  function groupNums(groups) { const out = {}; let n = 0; groups.forEach((g, gi) => { if (isStrength(g)) out[gi] = ++n; }); return out; }
  /** Код в бейдже: буква суперсета другим цветом, чтобы «1б» не читалось как «16». */
  const codeHTML = (c) => esc(c).replace(/([а-я])$/, '<i class="cl">$1</i>');
  const codeOf = (groups, N, gi, ii) => `${N[gi] || "?"}${groups[gi] && groups[gi].items && groups[gi].items.length > 1 ? SUBL[ii] || ii + 1 : ""}`;
  const DEF_DAYS = [1, 2, 6];
  const WD_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const monFirst = (d) => (d + 6) % 7;
  /** Дни недели тренировок текущей программы (с понедельника): у встроенной — settings.days, у копии — её wd (i-й день ↔ i-я тренировка),
      у своей — дни, назначенные буквам (wd = { A: 1, C: 4 }). */
  function plannedDays() {
    const rec = curRec(), rot = PG.rotOf(rec);
    if (rot) return rot.wd.slice(); // чередование: дни мест в неделе, одни и те же каждую неделю
    if (rec && PG.isCustom(rec)) return Object.values(rec.wd || {}).sort((a, b) => monFirst(a) - monFirst(b));
    if (rec) return PG.normWd(Array.isArray(rec.wd) && rec.wd.length ? rec.wd : DEF_DAYS, days().length);
    const d = Array.isArray(state.settings.days) && state.settings.days.length ? state.settings.days : DEF_DAYS;
    return d.slice().sort((a, b) => monFirst(a) - monFirst(b)).slice(0, days().length);
  }
  /** Неделя, которую показывают расписание и хаб: текущая, а если она закрыта — следующая (как «Сегодня»). */
  function qIdx() { const cyc = cycleState(); return weekClosed(cyc, weekDone(cyc)) ? cyc.idx + 1 : cyc.idx; }
  /** Через сколько недель от недели base тренировка d придёт по очереди (0 — на этой). */
  function weeksTo(d, base) { const R = PG.roundWeeks(curRec()); for (let k = 0; k < R; k++) if (weekDays(base + k).includes(d)) return k; return 0; }
  /** День недели тренировки d (0–6) или null — «любой день». При чередовании — день её места в ближайшей неделе, где она по очереди. */
  function wdOf(d) {
    const rec = curRec(), rot = PG.rotOf(rec);
    if (rot) { const w = qIdx() + weeksTo(d, qIdx()), v = rot.wd[weekDays(w).indexOf(d)]; return v == null ? null : v; }
    if (rec && PG.isCustom(rec)) { const v = (rec.wd || {})[d]; return v == null ? null : v; }
    const v = plannedDays()[days().indexOf(d)]; return v == null ? null : v;
  }
  /** Тренировка на день недели w или null. При чередовании — тренировка этой недели (qIdx) на этом месте. */
  function dayOnWd(w) {
    const rot = rotNow();
    if (rot) { const j = rot.wd.indexOf(w); return j < 0 ? null : weekDays(qIdx())[j] || null; }
    return days().find((d) => wdOf(d) === w) || null;
  }
  function posOfIdx(idx) { return PG.posOf(progKind() === "custom" ? "custom" : "up", idx, P.meta, blocks().length); }
  /** Место в цикле текущей программы: у встроенной — ключ cycle (как в выпущенной версии), у своих — progPos[id]. */
  function cycleState() { return Object.assign({ idx: 0, since: null, hist: [] }, isMain() ? S.get("cycle", {}) : posAll()[BOUND] || {}); }
  function writeCycle(val) {
    if (isMain()) { S.set("cycle", val); return; }
    const all = Object.assign({}, posAll()); all[BOUND] = val; S.set("progPos", all);
  }
  function setCycle(next, why) {
    const cur = cycleState();
    // ps — since до сдвига: откат автосдвига возвращает именно его (старые версии лишнее поле в hist не читают)
    const hist = (cur.hist || []).concat({ at: todayISO(), from: cur.idx, to: next.idx, why, ps: cur.since == null ? null : cur.since }).slice(-60);
    const val = { idx: next.idx, since: next.since, hist };
    writeCycle(val);
    return cur;
  }
  /** Какие тренировки текущей недели уже сделаны: { A: дата, B: дата, C: дата }. */
  function weekDone(cyc) {
    const done = {};
    Object.keys(state.logs).forEach((k) => {
      const { date: d, day } = PG.parseLogKey(k), e = state.logs[k];
      if (!mineK(k) || !entryHasData(e)) return; // только записи текущей программы
      if (cyc.since && d < cyc.since) return;
      if (e.idx != null && e.idx !== cyc.idx) return;
      if (!done[day] || d > done[day]) done[day] = d;
    });
    return done;
  }
  /** Обязательный день без силовых упражнений (тренировку очистили в «Плане») — делать нечего, неделю не держит. */
  function emptyDay(idx, d) { return emptySess(d, posOfIdx(idx).block); }
  /** Неделя закрыта: обязательные сделаны (или пусты), и хоть одна тренировка недели записана.
      У «Апгрейда» обязательны A и B, у своей программы — все тренировки с упражнениями. */
  function weekClosed(cyc, done) {
    // своя программа: очередь недели (без чередования — все тренировки); хоть одна из неё должна быть записана
    // неделя раньше смены правил (qa) — мягко: закрыта, если записана хоть одна тренировка
    if (isCustom() && PG.softWeek(curRec(), cyc.idx)) return days().some((d) => done[d]);
    if (isCustom()) { const q = weekDays(cyc.idx); return q.every((d) => done[d] || emptyDay(cyc.idx, d)) && q.some((d) => done[d]); }
    return days().filter((d) => !optional(d)).every((d) => done[d] || emptyDay(cyc.idx, d)) && days().some((d) => done[d]);
  }
  /** Запись тренировки d за сегодня — только если она текущей программы. */
  const todayLog = (d) => state.logs[logKey(todayISO(), d)] || null;
  function ctxNow() {
    const cyc = cycleState(), done = weekDone(cyc), day = state.day, today = todayISO();
    const closed = weekClosed(cyc, done);
    let idx = cyc.idx, next = false;
    const todayEntry = todayLog(day);
    if (todayEntry && entryHasData(todayEntry) && todayEntry.idx != null) idx = todayEntry.idx;
    // чередование: следующая неделя — только для тренировки из её очереди; остальные «не по очереди» — в текущей, цикл не двигают
    else if (closed && (rotNow() ? weekDays(cyc.idx + 1).includes(day) : !optional(day) || done[day])) { idx = cyc.idx + 1; next = true; }
    const p = posOfIdx(idx);
    const anyLog = Object.keys(state.logs).some((k) => mineK(k) && entryHasData(state.logs[k])); // записи этой программы
    const pre = !anyLog && cyc.idx === 0 && daysBetween(today, state.settings.start) > 0;
    const custom = isCustom();
    const rot = custom ? rotNow() : null, q = weekDays(idx);
    return { idx, next, done, closed, cyc, pre, block: p.block, week: p.week, n: p.n, cycle: p.cycle, day, time: +state.time, low: state.ready === "low",
      light: isDeload(p), heavy: !custom && (p.week === 1 || p.week === 3), custom, now: true, rot, q, offq: !!rot && !q.includes(day) };
  }
  /* Замены «только сегодня»: { d: дата, m: { "A|legpress": "hack" } } — локально, на следующий день пропадают. */
  function daySwaps() { const v = S.get("daySw", null); return v && v.d === todayISO() && v.m ? v.m : {}; }
  /** Ключ замены на сегодня: у своих программ — с id программы (буквы тренировок у программ одинаковые). */
  const dsKey = (day, planned) => `${isMain() ? "" : BOUND + ":"}${day}|${planned}`;
  const daySwapOf = (day, planned) => daySwaps()[dsKey(day, planned)];
  function setDaySwap(day, planned, exId) {
    const m = Object.assign({}, daySwaps()), k = dsKey(day, planned);
    if (!exId || exId === planned) delete m[k]; else m[k] = exId;
    S.set("daySw", { d: todayISO(), m });
  }

  /* ---------- logs ---------- */
  /** Ключ записи тренировки текущей программы: у встроенной — «дата_буква», у своей — «дата_буква@id». */
  function logKey(date, day) { return PG.logKey(date, day, BOUND); }
  /** Выполненный подход — тот, где записаны повторы; строка с одним весом подходом не считается нигде. */
  /** Повторы — с положительного числа: «15+4+3» засчитывается, «0» и текст без числа — нет. */
  const performed = (s) => { if (!s || s.r == null) return false; const m = String(s.r).trim().match(/^\d+(?:[.,]\d+)?/); return !!m && parseFloat(m[0].replace(",", ".")) > 0; };
  /** Журнал без битых записей: запись — объект, подходы упражнения — массив (null и прочее пропускаются, в том числе в выпущенных данных). */
  function cleanLogs(l) {
    const out = {};
    if (!l || typeof l !== "object" || Array.isArray(l)) return out;
    Object.keys(l).forEach((k) => {
      const e = l[k];
      if (!e || typeof e !== "object" || Array.isArray(e) || k === "__proto__") return;
      if (e.ex != null && (typeof e.ex !== "object" || Array.isArray(e.ex))) { out[k] = Object.assign({}, e, { ex: {} }); return; }
      if (e.ex && Object.keys(e.ex).some((id) => !Array.isArray(e.ex[id]))) {
        const ex = {}; Object.keys(e.ex).forEach((id) => { if (Array.isArray(e.ex[id])) ex[id] = e.ex[id]; });
        out[k] = Object.assign({}, e, { ex }); return;
      }
      out[k] = e;
    });
    return out;
  }
  function entryHasData(e) { return !!(e && e.ex && Object.values(e.ex).some((sets) => (sets || []).some(performed))); }
  function suggestDay() {
    const D = days();
    for (const d of D) if (entryHasData(todayLog(d))) return d;
    const cyc = cycleState(), done = weekDone(cyc), ok = (d) => !emptyDay(cyc.idx, d);
    const pd = plannedDays(), wd = new Date().getDay();
    if (isCustom()) {
      // своя: очередь недели (неделя закрыта — следующей): назначенная на этот день недели несделанная, иначе первая несделанная по очереди
      const closed = weekClosed(cyc, done), idx = closed ? cyc.idx + 1 : cyc.idx, dn = closed ? {} : done, Q = weekDays(idx);
      const okQ = (d) => !emptyDay(idx, d), planned = dayOnWd(wd);
      if (planned && Q.includes(planned) && !dn[planned] && okQ(planned)) return planned;
      // вся очередь пустая — показываем её первую тренировку: «Сегодня» подскажет добавить упражнения или перейти дальше
      if (rotNow() && !Q.some(okQ)) return Q[0];
      return Q.find((d) => !dn[d] && okQ(d)) || Q.find(okQ) || D.find(ok) || D[0];
    }
    if (!done.A && ok("A")) return "A";
    if (!done.B && ok("B")) return "B";
    if (!done.C && ok("C") && pd.length >= 3 && wd !== pd[0]) return "C";
    // пустые (очищенные в «Плане») не предлагаем; все пустые — A с карточкой «собери в «Плане»»
    return D.find(ok) || "A";
  }
  /** День при запуске: ручной выбор сегодня (если он не спорит с уже записанной тренировкой),
      иначе записанный сегодня день, иначе подсказка. Выбор хранится локально (dayPick) и не синхронизируется. */
  function pickDay() {
    const today = todayISO(), dp = S.get("dayPick", null);
    const logged = days().filter((d) => entryHasData(todayLog(d)));
    state.dayDate = today;
    if (dp && dp.date === today && (dp.prog || PG.MAIN) === BOUND && days().includes(dp.day) && (!logged.length || logged.includes(dp.day))) return dp.day;
    return suggestDay();
  }
  /** Сменился цикл или расписание — ручной выбор дня больше не актуален. */
  function resetDay() { S.set("dayPick", null); state.dayDate = todayISO(); return suggestDay(); }
  /** Запись тренировки на сегодня: создаётся при первом вводе; первая запись новой недели сдвигает цикл. */
  function todayEntry(ctx) {
    const key = logKey(todayISO(), ctx.day);
    let e = state.logs[key];
    if (!e) {
      e = state.logs[key] = { day: ctx.day, block: ctx.block, week: ctx.week, idx: ctx.idx, ready: state.ready, time: state.time, ex: {} };
      // цикл сдвигается не здесь, а при первом записанном подходе (storeSet)
    }
    if (!isMain()) e.prog = BOUND;
    return e;
  }
  /** Обновить самочувствие и режим времени в сегодняшней записи, если она уже есть. */
  function touchToday(fields) {
    const e = todayLog(state.day);
    if (e) { Object.assign(e, fields); S.set("logs", state.logs); }
  }
  /** Прошлый результат упражнения — по всем программам (упражнение одно и то же), только среди записей раньше этой тренировки:
      более ранние даты; в тот же день — запись другой программы или более ранняя буква этой. Сначала — по дате, свежие первыми. */
  function lastFor(exId, beforeKey) {
    const bd = beforeKey.slice(0, 10), bp = PG.parseLogKey(beforeKey).prog;
    const keys = Object.keys(state.logs).filter((k) => {
      if (k === beforeKey) return false;
      const d = k.slice(0, 10);
      return d < bd || (d === bd && (PG.parseLogKey(k).prog !== bp || k < beforeKey));
    }).sort((a, b) => (a.slice(0, 10) !== b.slice(0, 10) ? (a.slice(0, 10) < b.slice(0, 10) ? 1 : -1) : a < b ? 1 : -1));
    for (const k of keys) {
      const sets = state.logs[k].ex && state.logs[k].ex[exId];
      if (sets && sets.some(performed)) return { key: k, date: k.slice(0, 10), sets };
    }
    return null;
  }

  /** Прошлый результат упражнения с циклом нагрузки на шаге i: записи текущей программы раньше этой тренировки, где st[exId] === i. */
  function lastForStep(exId, beforeKey, i) {
    const keys = Object.keys(state.logs).filter((k) => k !== beforeKey && mineK(k) && k.slice(0, 10) <= beforeKey.slice(0, 10) && (k.slice(0, 10) < beforeKey.slice(0, 10) || k < beforeKey)).sort().reverse();
    for (const k of keys) {
      const e = state.logs[k], sets = e.ex && e.ex[exId];
      if (e.st && e.st[exId] === i && sets && sets.some(performed)) return { key: k, date: k.slice(0, 10), sets };
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
      if (!a || a.enabled === false || (a.prog || PG.MAIN) !== BOUND) return; // корректировка — только своей программе
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
  /** Шаг цикла нагрузки пункта своей программы: номер прохода тренировки (на «Сегодня» — по неделе записи, в «Программе» —
      ближайший раз, когда тренировка придёт) → шаг по кругу. null — цикла нет. */
  /** Дата последнего «Начать заново» текущей программы (с неё считается текущий заход) или null. */
  function restartAt() { const h = cycleState().hist || []; for (let i = h.length - 1; i >= 0; i--) if (h[i] && h[i].why === "restart") return h[i].at || null; return null; }
  /** Сколько разных недель раньше idx в текущем заходе тренировка d этой программы записана с данными — шаги идут «по выполнению»:
      пропуск шаг не сжигает, «Повторить неделю» — тот же шаг, сегодняшняя запись шаг в течение дня не меняет. */
  function doneWeeks(d, idx) {
    const rs = restartAt(), wk = new Set();
    Object.keys(state.logs).forEach((k) => {
      if (!mineK(k)) return;
      const pk = PG.parseLogKey(k), e = state.logs[k];
      if (pk.day !== d || e.idx == null || e.idx >= idx || (rs && pk.date < rs) || !entryHasData(e)) return;
      wk.add(e.idx);
    });
    return wk.size;
  }
  /** Шаг цикла нагрузки пункта своей программы: сколько раз тренировка уже сделана → шаг по кругу (на «Сегодня» — до недели записи,
      в «Программе» — до недели, которую показывает «Сегодня»). null — цикла нет. */
  function cycStep(it, ctx) {
    if (!isCustom() || !Array.isArray(it.cyc) || it.cyc.length < 2 || it.hl || it.weekAlt) return null;
    const occ = doneWeeks(ctx.day, ctx.now ? ctx.idx : qIdx()), n = it.cyc.length, i = occ % n;
    return { i, n, pass: Math.floor(occ / n) + 1, st: it.cyc[i] };
  }
  /** «Цикл пройден» с прибавкой максимума — только у одного пункта упражнения: с самым длинным циклом (при равенстве — в первой
      по алфавиту тренировке и первым по порядку). slotKey — «1A-U1-0». */
  function cycPrimary(exId, slotKey) {
    let best = null;
    days().forEach((d) => { const s = sessOf(`1${d}`); if (s) s.groups.forEach((g) => (isStrength(g) ? g.items : []).forEach((it, ii) => {
      if (it.ex === exId && Array.isArray(it.cyc) && (!best || it.cyc.length > best.n)) best = { n: it.cyc.length, k: `1${d}-${g.id}-${ii}` };
    })); });
    return !!best && best.k === slotKey;
  }
  /** Максимум упражнения своей программы (для процентов шага) или null. */
  const tmOf = (exId) => { const t = (curRec() || {}).tm; return t && t[exId] > 0 ? t[exId] : null; };
  function resolveItem(it, ctx, slotKey) {
    let b = it, variant = null;
    const cs = cycStep(it, ctx);
    if (cs) b = Object.assign({}, it, { sets: cs.st.sets, reps: cs.st.reps, rir: cs.st.rir != null ? cs.st.rir : null });
    if (it.hl) { b = Object.assign({ ex: it.ex, orig: it.orig }, ctx.heavy ? it.hl.heavy : it.hl.light); variant = ctx.heavy ? "тяжёлая неделя" : "лёгкая неделя"; }
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
    const sw = isMain() ? state.swaps[slotKey] : null;
    if (sw && EX[b.ex] && (EX[b.ex].alts || []).concat(b.ex).includes(sw)) exId = sw;
    const planned = exId;
    if (ctx.now) { const t = daySwapOf(ctx.day, planned); if (t && EX[t]) exId = t; }
    let sets = b.sets, reps = b.reps, rir = b.rir, myo = !!b.myo;
    if (myo) {
      if (ctx.light || ctx.low) { myo = false; sets = 2; reps = "12–15"; rir = ctx.light ? "3–4" : "2"; }
    } else if (ctx.light) { sets = Math.max(2, sets - 1); if (rir != null) rir = "3–4"; }
    else if (ctx.low && sets >= 3) { sets -= 1; rir = bumpRIR(rir, 1); }
    let step = null;
    if (cs) {
      // замена «только сегодня»: проценты к замене не применяем — вес подбирается сам, максимум не спрашиваем
      const swap = exId !== planned, tm = swap ? null : tmOf(exId), pct = cs.st.pct != null ? cs.st.pct : null;
      step = { i: cs.i, n: cs.n, pass: cs.pass, pct, tm, w: pct != null && !swap ? PG.stepWeight(pct, tm) : null, swap, primary: !swap && cycPrimary(planned, slotKey) };
    }
    return { exId, planned, baseId: b.ex, orig: b.orig || null, sets, reps, rir, myo, note: b.note || null, variant, tempo: b.tempo || null, adj, step };
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
    return `<button class="lnk small" data-showmedia="${esc(stem)}" data-alt="${esc(alt)}">${icon("image", 16)}Показать анимацию (${GV})</button>`;
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
  const TIER = { core: "", std: "от 90 мин", max: "только 120 мин" };
  const TIMES = [60, 90, 120];
  /** Тег у необязательной связки: «от 90 мин» / «только 120 мин» с иконкой часов; у обязательной — ничего. */
  const tierTag = (t) => TIER[t] ? `<span class="tier tag time">${icon("clock", 14)}${TIER[t]}</span>` : "";
  /** «10–12» → «повторов», «1–2» → «повтора», «1» → «повтор» (по верхней границе). */
  const repsWord = (reps) => { const m = String(reps || "").match(/(\d+)\D*$/); return m ? plural(+m[1], "повтор", "повтора", "повторов") : "повт."; };
  const nb = (t) => esc(t).replace(/ /g, "&nbsp;");
  /** Число не отрывается от слова и знака: «80&nbsp;%», «3&nbsp;мин», «2&nbsp;×&nbsp;15». */
  const nbn = (t) => esc(t).replace(/(\d)\s+(?=[%×–]|с\b|сек|мин|ч\b|км|уд|кг|повтор|подход|майо|недел|блок|трениров|упражнен|раз)/g, "$1&nbsp;").replace(/×\s+(?=\d)/g, "×&nbsp;").replace(/(\d)\s+в\s+(?=недел)/g, "$1&nbsp;в&nbsp;");
  /** Список через «·» без висячих точек: точка рисуется перед каждым пунктом, а у первого в строке срезается краем. */
  const dl = (parts, cls) => { const p = parts.filter(Boolean); return p.length ? `<span class="dl${cls ? " " + cls : ""}"><span>${p.map((x) => `<i><span>${x}</span></i>`).join("")}</span></span>` : ""; };
  const KIND = { pair: "Суперсет", tri: "Тройка по кругу", circuit: "Круг", single: "Одно упражнение" };
  function kindLabel(g, ctx) {
    if (g.kind === "circuit") return `${KIND.circuit} × ${ctx && ctx.light ? 2 : g.rounds || 3}`;
    if (g.kind === "giant") return `Круг из ${g.items.length}`;
    return KIND[g.kind] || "Суперсет";
  }

  function skillCard(block, week, title) {
    const sk = P.blocks[block - 1] && P.blocks[block - 1].skill;
    if (!sk) return "";
    const steps = sk.weeks.map((w, i) => `<span class="${i === week - 1 ? "on" : ""}" title="${esc(w)}">нед. ${i + 1}</span>`).join("");
    return `<div class="proto">
      <div class="big">${esc(title || "Навык блока")}: ${esc(sk.title)}</div>
      <div><b>Сегодня:</b> ${esc(sk.weeks[week - 1])}</div>
      <div class="skill-steps">${steps}</div>
      <div class="muted small">Цель блока: ${esc(sk.goal)}</div>
      <details class="how"><summary>${icon("play-circle", 18)}Как делать</summary><div class="how-b"><ul>${sk.cues.map((c) => `<li>${rich(c)}</li>`).join("")}</ul></div></details>
    </div>`;
  }
  function sprintProto(ctx) {
    let head, body;
    if (ctx.light) { head = "1 спринт — разгрузочная неделя"; body = "3 мин легко → 20 с быстро, но не на максимум → 3 мин легко."; }
    else if (ctx.block === 1 && ctx.week <= 2) { head = "2 × 15 с примерно на 80 %"; body = "Адаптация: 3 мин легко → 15 с быстро → 3 мин легко → 15 с → 2–3 мин заминки."; }
    else { head = "2 × 20 с — всё, что есть"; body = "3 мин легко → 20 с максимально → 3 мин легко → 20 с → 2–3 мин заминки."; }
    return `<div class="proto"><div class="big">Спринты: ${nbn(head)}</div><p>${nbn(body)}</p>
      <p class="muted small">Велотренажёр с высоким сопротивлением или эйр-байк, не бег. Двух спринтов достаточно — почему, в «Почему так». Никотин — не ближе чем за 1–2 часа.</p></div>`;
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
      <p class="muted small">По умолчанию велотренажёр или гребля. Дорожка с уклоном 8–12 % — если поясница спокойна.</p></div>`;
  }
  function z2Proto(len) {
    const v = vars();
    return `<div class="proto"><div class="big">Зона 2 · ${len || "15–20 мин"}</div>
      <p>Велотренажёр или гребля; ходьба в горку (уклон 6–10 %, 5–6 км/ч) — если спина спокойна. Разговорный темп — полными фразами, ${v.hr60}–${v.hr70} уд/мин.</p></div>`;
  }

  /* ---------- цель на сегодня: двойная прогрессия по прошлой записи ---------- */
  const numOf = (v) => { const n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : null; };
  /** Вес — до двух знаков: 41,25 остаётся 41,25 (fmtNum округляет до одного). */
  const fmtW = (n) => (Math.round(n * 100) / 100).toString().replace(".", ",");
  /** С весом ли упражнение. Без unit — да. unit "sec" с гантелями/штангой по базе (удержания) — да.
      Иначе (свой вес, время) — вес только дополнительный, если в прошлый раз его не записывал. */
  const LOAD_EQ = ["dumbbell", "barbell", "kettlebell", "cable", "leverage machine", "smith machine", "trap bar", "ez barbell", "olympic barbell", "weighted", "sled machine"];
  function loadable(ex, prev) {
    if (!ex) return false;
    if (!ex.unit) return true;
    if (ex.unit === "sec" && ex.ds && LOAD_EQ.includes(ex.ds.eq)) return true;
    return !!(prev && prev.sets.some((s) => performed(s) && numOf(s.w)));
  }
  const isInt = (v) => /^\d+$/.test(String(v == null ? "" : v).trim());
  function repRange(reps) {
    const m = String(reps || "").match(/(\d+)\s*(?:[–-]\s*(\d+))?/);
    return m ? [+m[1], +(m[2] || m[1])] : null;
  }
  function stepUp(w) { return w >= 20 ? Math.max(w + 2.5, Math.round((w * 1.025) / 2.5) * 2.5) : w + (w < 10 ? 1 : 2); }
  /** Подсказка шага цикла: процент и максимум → вес; без процента — только номер шага (прошлый раз — строкой ниже). */
  /** Подсказка шага с процентом (или замены на сегодня); "" — у шага нет процента: прогрессия по прошлому разу на этом же шаге. */
  function stepHint(r) {
    const s = r.step, head = `Шаг ${s.i + 1} из ${s.n}`;
    if (s.swap) return `${head}. Замена на сегодня — вес подбери сам.`;
    if (s.pct != null && s.w != null) return `${head}: ${fmtW(s.pct)} % от ${fmtW(s.tm)} кг — ${fmtW(s.w)} кг.`;
    if (s.pct != null && s.tm != null) return `${head}: ${fmtW(s.pct)} % от максимума.`;
    if (s.pct != null) return `${head}: ${fmtW(s.pct)} % от максимума — укажи максимум, и вес посчитается сам.`;
    return "";
  }
  function progressionHint(r, ex, prev, prevRir, ctx) {
    if (r.step) {
      const h = stepHint(r); if (h) return h;
      // шаг без процента: двойная прогрессия по прошлому разу на этом же шаге; его нет — только номер шага
      const head = `Шаг ${r.step.i + 1} из ${r.step.n}.`, g = prev ? progressionHint(Object.assign({}, r, { step: null }), ex, prev, prevRir, ctx) : "";
      return g ? `${head} ${g}` : `${head} Вес подбери по запасу повторов.`;
    }
    if (!prev || ex.unit === "sec" || r.myo) return "";
    const sets = prev.sets.filter((s) => s && numOf(s.r) != null);
    if (!sets.length) return "";
    const range = repRange(r.reps), w = numOf(sets[0].w);
    const sameW = sets.every((s) => numOf(s.w) === w);
    if (ctx.light) return w ? `Разгрузка: около ${fmtW(Math.round((w * 0.87) / 2.5) * 2.5)} кг, повторы с запасом 3–4.` : "Разгрузка: повторы с запасом 3–4.";
    if (ctx.low) return w ? `Самочувствие «так себе»: ${fmtW(w)} кг, как в прошлый раз, повторы с запасом.` : "Самочувствие «так себе»: повторы с запасом.";
    if (!range) return "";
    const [lo, hi] = range;
    const need = Math.min(r.sets || sets.length, sets.length);
    const topHit = sets.length >= (r.sets || 1) && sameW && sets.slice(0, need).every((s) => numOf(s.r) >= hi);
    if (prevRir === "0" && r.rir && !/^0/.test(String(r.rir))) return w ? `В прошлый раз был отказ — оставь ${fmtW(w)} кг и держи запас ${r.rir}.` : `В прошлый раз был отказ — держи запас ${r.rir}.`;
    if (topHit) {
      if (w) return `Цель: ${fmtW(stepUp(w))} кг × ${lo}${lo !== hi ? "–" + hi : ""} — в прошлый раз верх диапазона во всех подходах.`;
      return loadable(ex, prev) ? "Верх диапазона во всех подходах — добавь вес (2,5–5 кг) или замедли опускание." : "Верх диапазона во всех подходах — усложни вариант или замедли опускание.";
    }
    return w ? `Цель: ${fmtW(w)} кг, добавь повтор там, где было меньше ${hi}.` : `Цель: добавь повтор там, где было меньше ${hi}.`;
  }

  /* Тот же расчёт, что в подсказке, но числом: вес, «пора ли добавлять вес» (up) и «добавь повтор» (add). */
  function progPlan(r, ex, prev, prevRir, ctx) {
    // шаг цикла: вес от процента важнее двойной прогрессии; без веса шага — без совета (прошлый вес как есть)
    if (r.step && r.step.w != null) return { w: r.step.w, up: false };
    if (r.step && r.step.swap) return null;
    if (!prev || r.myo) return null;
    const sets = prev.sets.filter((s) => s && numOf(s.r) != null);
    if (!sets.length) return null;
    const w = numOf(sets[0].w);
    if (ex.unit === "sec") return { w, up: false };
    if (ctx.light) return { w: w ? Math.round((w * 0.87) / 2.5) * 2.5 : null, up: false };
    const range = repRange(r.reps);
    if (ctx.low || !range) return { w, up: false };
    const [lo, hi] = range, sameW = sets.every((s) => numOf(s.w) === w);
    if (prevRir === "0" && r.rir && !/^0/.test(String(r.rir))) return { w, up: false };
    const need = Math.min(r.sets || sets.length, sets.length);
    const topHit = sets.length >= (r.sets || 1) && sameW && sets.slice(0, need).every((s) => numOf(s.r) >= hi);
    if (topHit) return w ? { w: stepUp(w), up: true, lo } : { w, up: false };
    return { w, up: false, add: true };
  }

  /* ---------- «Сегодня»: модель тренировки — подходы, активное упражнение, прогресс ----------
     Открытые карточки, черновики −/+ и «напечатанные» подходы привязаны к записи дня (дата + A/B/C):
     на следующей неделе и в другой день они не всплывают. */
  const setDone = performed;
  const openKey = (exId) => `${logKey(todayISO(), state.day)}|${exId}`;
  const draftKey = (exId, i, f) => `${openKey(exId)}|${i}|${f}`;
  /** Шаг −/+: вес по 2,5 кг (до 20 кг — по 1), повторы по 1, секунды по 5. null — не трогать поле. */
  function stepValue(v, f, dir, o) {
    const s = String(v == null ? "" : v).trim();
    if (f === "r") {
      if (s && !isInt(s)) return null; // «15+4+3» и прочие записи не ломаем
      const min = o.sec ? 5 : 1;
      if (!s) return dir > 0 ? String(min) : null;
      return String(Math.max(min, +s + dir * (o.sec ? 5 : 1)));
    }
    if (!s) return dir > 0 ? fmtW(o.load ? 20 : 5) : null; // первый вес — сразу с разумной базы
    const n = numOf(s);
    if (n == null) return null;
    const step = dir > 0 ? (n >= 20 ? 2.5 : 1) : n > 20 ? 2.5 : 1;
    const x = Math.round((n + dir * step) * 100) / 100;
    return x <= 0 ? "" : fmtW(x);
  }
  function todayModel(ctx) {
    const sessKey = `${ctx.block}${ctx.day}`, sess = sessOf(sessKey), N = groupNums(sess.groups);
    const key = logKey(todayISO(), ctx.day), todayE = state.logs[key] || {};
    const items = [];
    sess.groups.forEach((g, gi) => {
      if (!groupVisible(g, ctx) || !isStrength(g)) return;
      g.items.forEach((it, ii) => {
        const slotKey = `${sessKey}-${g.id}-${ii}`, r = resolveItem(it, ctx, slotKey), ex = EX[r.exId];
        if (!ex) return;
        const cur = (todayE.ex && todayE.ex[r.exId]) || [];
        // записанные сегодня подходы не прячутся: строк — не меньше, чем записано (план мог стать короче)
        let lastDone = -1; cur.forEach((x, i) => { if (setDone(x)) lastDone = i; });
        const nSets = Math.max(r.sets || 1, 1, lastDone + 1);
        let doneN = 0, nextI = -1;
        for (let i = 0; i < nSets; i++) { if (setDone(cur[i])) doneN++; else if (nextI < 0) nextI = i; }
        // цикл нагрузки: «прошлый раз» — последняя запись этой программы на этом же шаге
        const prev = r.step ? lastForStep(r.exId, key, r.step.i) : lastFor(r.exId, key);
        const prevRir = prev && state.logs[prev.key] && state.logs[prev.key].rir ? state.logs[prev.key].rir[r.exId] : null;
        items.push({ g, gi, ii, it, r, ex, code: codeOf(sess.groups, N, gi, ii), slotKey, slot: `${sessKey}:${gi}:${ii}`, cur, nSets, doneN, nextI, full: doneN >= nSets, prev, prevRir });
      });
    });
    const active = items.find((m) => !m.full) || null;
    // текущее упражнение связки: куда ушёл фокус после ✓, иначе с наименьшим числом подходов
    let cur = null;
    if (active) {
      const g = items.filter((m) => m.gi === active.gi && !m.full), c = state.curEx;
      cur = (c && c.k === key && g.find((m) => m.r.exId === c.id)) || g.reduce((a, m) => (m.doneN < a.doneN ? m : a), g[0]);
    }
    const sets = items.reduce((a, m) => a + m.nSets, 0), setsDone = items.reduce((a, m) => a + Math.min(m.doneN, m.nSets), 0);
    return { items, active, cur, sets, setsDone, exDone: items.filter((m) => m.full).length };
  }
  /** Раскрыта ли карточка. Ручное решение действует, пока у упражнения не поменялись подходы,
      поэтому устаревшее «свернуть» не прячет активное упражнение. По умолчанию раскрыты активное,
      его партнёры по связке и начатые. */
  const openSig = (m) => `${m.doneN}/${m.nSets}`;
  function isOpen(m, M) {
    const o = state.open[openKey(m.r.exId)];
    if (o && o.sig === "carry") o.sig = openSig(m); // перенесено с заменённого упражнения
    if (o && o.sig === openSig(m)) return o.v;
    return !m.full && (M.active === m || (!!M.active && M.active.gi === m.gi) || m.doneN > 0);
  }
  /** Что подставить в поля подхода i — цель на сегодня, а не копия прошлого раза.
      Вес: прошлый подход сегодня (даже пустой) → цель прогрессии → прошлая тренировка.
      Повторы: как в прошлый раз (+1, если цель — добавить повтор) в пределах сегодняшнего диапазона;
      истории нет — низ диапазона. Прошлые цифры видны в строке «Прошлый раз». */
  function suggestSet(m, i, plan) {
    const { cur, prev, r } = m;
    let tp = null;
    for (let k = i - 1; k >= 0; k--) if (setDone(cur[k])) { tp = cur[k]; break; }
    const pSets = prev ? prev.sets.filter(setDone) : [];
    const p = prev && setDone(prev.sets[i]) ? prev.sets[i] : pSets[pSets.length - 1] || null;
    const w = tp ? tp.w || "" : plan && plan.w != null ? fmtW(plan.w) : (p && p.w) || "";
    const range = repRange(r.reps);
    let reps = "";
    if (r.myo) { const f = String((p && p.r) || "").match(/\d+/); reps = f ? f[0] : range ? String(range[0]) : ""; }
    else if (plan && plan.up) reps = String(plan.lo);
    else if (p && isInt(p.r)) reps = String(+p.r + (plan && plan.add && range && +p.r < range[1] ? 1 : 0));
    else if (tp && tp.r) reps = String(tp.r);
    else if (p && p.r) reps = String(p.r);
    else if (range) reps = String(range[0]);
    if (range && !r.myo && isInt(reps)) reps = String(Math.min(range[1], Math.max(range[0], +reps)));
    return { w: String(w), r: reps };
  }
  const setTxt = (s) => (s.w ? `${s.w}×${s.r}` : String(s.r));

  /** Метки суставов у упражнений программы → «береги колено». */
  const JOINT_TAG = { "колено": "колено", "колени": "колени", "локоть": "локоть", "поясница": "поясницу", "плечо": "плечо", "спина": "спину" };
  /** Под подсказкой шага: «Указать максимум» (процент без максимума) или «Новый круг цикла» с «+2,5 кг». */
  /** Прибавки максимума сегодня (локально): после «+2,5 кг» кнопка в этот день больше не показывается. */
  const tmUpToday = () => { const v = S.get("tmUp", null); return v && v.d === todayISO() && Array.isArray(v.ex) ? v.ex : []; };
  function setTmUp(exId, on) { const l = tmUpToday().filter((x) => x !== exId); if (on) l.push(exId); S.set("tmUp", { d: todayISO(), ex: l }); }
  /** Под подсказкой шага: «Указать максимум» (процент без максимума) или «Цикл пройден» с «+2,5 кг» (первый шаг нового прохода). */
  function stepMore(r) {
    const s = r.step; if (!s || s.swap) return "";
    if (s.pct != null && s.tm == null) return `<div class="cyc-act"><button class="btn tonal" data-tmset="${esc(r.exId)}">${icon("target", 18)}Указать максимум</button></div>`;
    if (s.tm != null && s.primary && s.i === 0 && s.pass >= 2) {
      if (tmUpToday().includes(r.exId)) return `<div class="cyc-act"><span class="small">Максимум: ${fmtW(s.tm)}&nbsp;кг</span></div>`;
      return `<div class="cyc-act"><span class="small">Цикл пройден — начинаем снова с шага 1. Дался? Подними максимум</span><button class="btn" data-tmup="${esc(r.exId)}" aria-label="Прибавить к максимуму 2,5 кг">${icon("plus", 18)}2,5&nbsp;кг</button></div>`;
    }
    return "";
  }
  function itemHTML(m, ctx, M) {
    const { r, ex, it, code, slot, cur, nSets, prev, prevRir } = m;
    const todaySw = r.exId !== r.planned;
    const side = ex.side ? " на сторону" : "";
    let scheme;
    // части схемы — неразрывными кусками: строка переносится между ними, а теги встают в тот же ряд
    if (r.myo) scheme = `<span class="sp"><b>${r.sets}</b> ${plural(r.sets, "майо-подход", "майо-подхода", "майо-подходов")}</span>`;
    else {
      const sec = ex.unit === "sec" || /с$/.test(String(r.reps || ""));
      const reps = esc(r.reps);
      // разделитель «·» — в конце куска, а не в начале: при переносе строка не начинается с точки
      const parts = [`<b>${r.sets}</b>&nbsp;${plural(r.sets, "подход", "подхода", "подходов")} по&nbsp;<b>${reps}</b>${side}`].concat(r.rir != null ? [`запас&nbsp;${esc(r.rir)}`] : [], r.tempo ? [nbn(r.tempo)] : []);
      scheme = dl(parts);
    }
    const prio = !ctx.custom && ex.m && ex.m.p.some((mu) => P.muscles[mu] && P.muscles[mu].pr === 1); // приоритеты — у «Апгрейда»
    const tags = [];
    if (r.variant) tags.push(`<span class="tag">${icon("activity", 14)}${esc(r.variant)}</span>`);
    if (r.step) tags.push(`<span class="tag now">${icon("trending-up", 14)}шаг ${r.step.i + 1} из ${r.step.n}</span>`);
    if (r.adj) tags.push(`<span class="tag adj" title="${esc(r.adj.why || r.adj.title)}">корректировка</span>`);
    if (!todaySw && r.orig && EX[r.orig] && !ctx.custom) tags.push(`<span class="tag mine" title="${esc(`В программе было: ${EX[r.orig].n}`)}">ваша замена</span>`);
    if (prio) tags.push(`<span class="tag prio" title="Приоритетная мышца">${icon("star-fill", 14)}приоритет</span>`);
    (ex.tags || []).forEach((t) => tags.push(JOINT_TAG[t] ? `<span class="tag warn" title="Упражнение нагружает этот сустав — следи за ощущениями">${icon("shield", 14)}береги ${esc(JOINT_TAG[t])}</span>` : `<span class="tag">${esc(t)}</span>`));
    if (m.g.items.length === 1) { if (m.g.rest) tags.unshift(`<span class="tag">${icon("timer", 14)}отдых ${nb(m.g.rest)}</span>`); if (tierTag(m.g.tier)) tags.unshift(tierTag(m.g.tier)); }
    const swap = slot ? `<button class="lnk swap-b" data-rep="${esc(slot)}" aria-label="Заменить упражнение">${icon("swap", 18)}Замена</button>` : "";
    const swapNote = todaySw && EX[r.planned] ? `<div class="ex-note swap-note">${icon("swap", 16)}<span>Сегодня вместо «${esc(EX[r.planned].n)}»</span><button class="lnk small" data-repback="${esc(slot)}">${icon("undo", 16)}вернуть</button></div>` : "";
    const cues = (ex.cues || []).length ? `<div class="how-sub">Важно для тебя</div><ul>${ex.cues.map((c) => `<li>${rich(c)}</li>`).join("")}</ul>` : "";
    const how = `<div class="how-b pane" data-pane="how" hidden>${cues}${ex.why ? `<div class="why">${rich(ex.why)}</div>` : ""}${dsHTML(ex)}</div>`;

    const k = openKey(r.exId), load = loadable(ex, prev), sec = ex.unit === "sec";
    const todayE = state.logs[logKey(todayISO(), ctx.day)] || {};
    const hint = progressionHint(r, ex, prev, prevRir, ctx);
    const plan = progPlan(r, ex, prev, prevRir, ctx);
    const rirNow = todayE.rir ? todayE.rir[r.exId] : null;
    const isActive = M.active === m;
    const open = isOpen(m, M);
    // партнёр по связке, чья очередь ещё не пришла: только заголовок и строка подхода — связка влезает в экран
    const lite = open && !m.full && !!M.cur && M.cur !== m && !!M.active && M.active.gi === m.gi;
    const all = m.full || (!lite && !!state.allSets[k]);
    const unitR = sec ? "сек" : "повторы";
    // спросить вес перед первой записью — только у упражнений с весом и только без истории
    // и только раз за день: если уже записал подход этого упражнения без веса — больше не спрашивать
    const needW = load && !prev && !cur.some((s) => setDone(s) && !String(s.w || "").trim());
    const rirChips = () => ["0", "1", "2", "3+"].map((v) => `<button class="chip ${rirNow === v ? "on" : ""}" data-rir="${esc(r.exId)}:${v}" aria-pressed="${rirNow === v}">${v}</button>`).join("");
    const stp = (i, f, dir, lab, dis) => `<button class="stp-b" data-step="${esc(r.exId)}:${i}:${f}:${dir}" aria-label="${lab}"${dis ? " disabled" : ""}>${icon(dir > 0 ? "plus" : "minus", 22)}</button>`;
    const rowHTML = (i, steps) => {
      const c = cur[i] || {}, done = setDone(c), sug = done ? null : suggestSet(m, i, plan);
      const dw = state.draft[draftKey(r.exId, i, "w")], dr = state.draft[draftKey(r.exId, i, "r")];
      const wv = done ? c.w || "" : dw != null ? dw : sug.w;
      const rv = done ? c.r : dr != null ? dr : sug.r;
      const wSug = !done && dw == null && wv !== "", rSug = !done && dr == null && rv !== "";
      let h = `<div class="log-row${done ? " done" : ""}${i === m.nextI ? " next" : ""}"><span class="n">${i + 1}</span>
        <input inputmode="decimal" class="${wSug ? "sug" : ""}" placeholder="${m.doneN || lite ? (load ? "кг" : "доп. кг") : ""}" value="${esc(wv)}" data-log="${r.exId}" data-i="${i}" data-f="w"${needW ? ' data-needw="1"' : ""}${load ? ' data-load="1"' : ""} aria-label="${load ? "Вес" : "Доп. вес"}, подход ${i + 1}">
        <span class="x">×</span>
        <input inputmode="numeric" class="${rSug ? "sug" : ""}" placeholder="${m.doneN || lite ? unitR : ""}" value="${esc(rv)}" data-log="${r.exId}" data-i="${i}" data-f="r" aria-label="${sec ? "Секунды" : "Повторы"}, подход ${i + 1}">
        <button class="set-ok" data-done="${esc(r.exId)}:${i}" aria-label="${done ? `Подход ${i + 1} записан, нажми — отменить` : `Записать подход ${i + 1}`}" aria-pressed="${done}">${icon("check", 22)}</button></div>`;
      // −/+ под следующим подходом: поправить вес или повторы без клавиатуры (зажми — быстрее)
      if (steps) {
        const rDis = r.myo || (rv !== "" && !isInt(rv));
        h += `<div class="step-row"><span></span><span class="stp">${stp(i, "w", -1, "Меньше вес")}${stp(i, "w", 1, "Больше вес")}</span><span></span>
          <span class="stp">${stp(i, "r", -1, sec ? "Меньше секунд" : "Меньше повторов", rDis)}${stp(i, "r", 1, sec ? "Больше секунд" : "Больше повторов", rDis)}</span><span></span></div>`;
      }
      return h;
    };
    const head = `<div class="log-head" aria-hidden="true"><span></span><span>${load ? "Вес, кг" : "Доп. вес, кг"}</span><span></span><span>${sec ? "Секунды" : "Повторы"}</span><span></span></div>`;
    let rows = "", left = 0;
    if (lite) {
      if (m.nextI >= 0) rows = rowHTML(m.nextI, false);
    } else if (all) {
      for (let i = 0; i < nSets; i++) rows += rowHTML(i, i === m.nextI);
    } else {
      // компактно: сделанные подходы — одной строкой, дальше один редактируемый подход и «ещё N»
      const doneSets = [];
      for (let i = 0; i < nSets; i++) { if (setDone(cur[i])) doneSets.push(cur[i]); else if (i !== m.nextI) left++; }
      if (doneSets.length) rows += `<button class="sets-sum" data-allsets="${esc(r.exId)}" aria-label="Сделано: ${esc(doneSets.map(setTxt).join(", "))}. Показать все подходы"><span class="ss-ok" aria-hidden="true">${icon("check-circle", 18)}</span>${doneSets.map((s) => `<span class="ss">${esc(setTxt(s))}</span>`).join("")}<span class="ss-ed">${icon("pencil", 14)}править</span></button>`;
      if (m.nextI >= 0) rows += rowHTML(m.nextI, true);
    }
    // подписи «Вес, кг / Повторы» — над первой строкой, пока у упражнения нет записанных сегодня подходов
    if (!lite && rows && !m.doneN) rows = rows.replace(/<div class="log-row/, head + '<div class="log-row');
    const rirPick = sec || !m.full || !open ? "" : `<div class="rir-pick"><span title="Сколько повторов оставалось в запасе в последнем подходе">В запасе</span>${rirChips()}</div>`;
    // одинаковые подходы — одной записью «41,25×10 — 3 подхода»: строка «Прошлый раз» помещается в одну строку
    const pTxt = prev ? prev.sets.filter(setDone).map(setTxt) : [];
    const prevTxt = prev ? `Прошлый раз (${fmtDate(prev.date)}): ${pTxt.length > 1 && pTxt.every((x) => x === pTxt[0]) ? `${pTxt[0]} — ${pTxt.length} ${plural(pTxt.length, "подход", "подхода", "подходов")}` : pTxt.join(", ")}` : m.doneN || r.step ? "" : load ? "Первая запись — вес подберёшь по запасу повторов." : "Первая запись — повторы с запасом."; // у шага цикла про вес — одна подсказка
    const more = left ? `<button class="lnk small sets-more" data-allsets="${esc(r.exId)}" aria-label="Показать ещё ${left} ${plural(left, "подход", "подхода", "подходов")}">ещё ${left}${icon("chevron-down", 18)}</button>`
      : all && !m.full ? `<button class="lnk small sets-more" data-allsets="${esc(r.exId)}">свернуть</button>` : "";
    const sum = m.full ? cur.slice(0, nSets).filter(setDone).map(setTxt).join(" · ") + (rirNow ? ` · запас ${rirNow}` : "") : "";
    const st = m.full ? `<span class="okc">${icon("check", 18)}</span>` : m.doneN ? `${m.doneN}/${nSets}` : "";
    // упражнение закончено, а запас не отмечен — спросить прямо в свёрнутой строке, одним касанием
    const rirAsk = m.full && !open && !rirNow && !sec ? `<div class="rir-ask"><span>Запас</span>${rirChips()}</div>` : "";
    const myoNote = r.myo ? `<div class="ex-note">12–20 до отказа, затем мини-подходы по 3–5 через 15 с.</div>` : "";
    const body = lite ? `<div class="ex-b pane" data-pane="log"><div class="log">${rows}</div></div>` : `<div class="ex-b pane" data-pane="log" ${open ? "" : "hidden"}>
        ${myoNote}${r.note ? `<div class="ex-note">${esc(r.note)}</div>` : ""}
        ${r.adj && r.adj.why ? `<div class="ex-note adj-why">${esc(r.adj.title)}: ${esc(r.adj.why)}</div>` : ""}
        <div class="log${all ? " all" : ""}">${hint ? `<div class="hint">${icon(r.step ? "trending-up" : "sparkles", 18)}<span>${esc(hint)}</span></div>` : ""}${stepMore(r)}${rows}${rirPick}<div class="prev">${esc(prevTxt)} <span class="saved" data-saved="${r.exId}">сохранено</span></div></div>
        <div class="ex-tools"><button class="lnk" data-toggle="how" aria-expanded="false">${icon("play-circle", 18)}Как делать</button>${swap}${more}</div>${how}
      </div>`;

    return `<div class="ex${m.full ? " done" : ""}${isActive ? " active" : ""}${open ? " open" : ""}${lite ? " lite" : ""}${M.cur === m ? " cur" : ""}" data-ex="${esc(r.exId)}">
      <div class="ex-h"><button class="ex-tap" data-toggle="log" aria-expanded="${open}">
        ${tileHTML(exGroup(r.exId))}
        <span class="ex-main"><span class="ex-ttl"><span class="code" title="Место в тренировке">${codeHTML(code)}</span> <span class="ex-name">${esc(ex.n)}</span></span>
          <span class="ex-sub">${m.full ? `<span class="ex-sum">${esc(sum)}</span>` : `<span class="scheme">${scheme}</span>`}${tags.length ? `<span class="tags">${tags.join("")}</span>` : ""}</span></span>
        <span class="ex-st" aria-hidden="true">${st}</span>
      </button></div>
      ${rirAsk}${swapNote}${body}</div>`;
  }

  function groupHTML(g, ctx, sessKey, gi, letter, M) {
    const tier = tierTag(g.tier);
    if (g.kind === "warmup") {
      const lines = g.items.map((it) => {
        if (it.skill) return `<div class="ex">${skillCard(ctx.block, ctx.week)}</div>`;
        if (it.text) return `<div class="ex"><div class="ex-note">${esc(it.text)}</div></div>`;
        const e = EX[it.ex];
        return `<div class="ex"><div class="ex-name">${esc(e.n)} · ${esc(it.dose)}</div><div class="ex-note">${esc((e.cues || []).join(". "))}</div></div>`;
      }).join("");
      return `<details class="group warm" data-warm="1"${state.warmOpen ? " open" : ""}><summary class="group-h"><span class="gl tile" style="color:var(--warn)">${icon("flame", 22)}</span><div class="gt"><b>Разминка</b> · ${g.min} мин</div>${tier}<span class="car" aria-hidden="true">${icon("chevron-down", 20)}</span></summary><div class="group-b">${lines}</div></details>`;
    }
    if (g.kind === "sprint") return `<section class="group fixed"><div class="group-h"><span class="gl tile" style="color:var(--warn)">${icon("zap", 22)}</span><div class="gt"><b>Финиш</b> · 10 мин</div>${tier}</div><div class="group-b"><div class="ex">${sprintProto(ctx)}</div></div></section>`;
    if (g.kind === "n4x4") return ctx.low
      ? `<section class="group fixed"><div class="group-h"><span class="gl tile" style="color:var(--m-cardio)">${icon("heart-pulse", 22)}</span><div class="gt"><b>Кардио</b> · вместо интервалов</div>${tier}</div><div class="group-b"><div class="ex">${z2Proto("30 мин, первые 5 — разминка")}</div></div></section>`
      : `<section class="group fixed"><div class="group-h"><span class="gl tile" style="color:var(--m-cardio)">${icon("activity", 22)}</span><div class="gt"><b>Мотор</b> · VO₂max</div>${tier}</div><div class="group-b"><div class="ex">${n4Proto(ctx)}</div></div></section>`;
    if (g.kind === "z2") return `<section class="group fixed"><div class="group-h"><span class="gl tile" style="color:var(--m-cardio)">${icon("heart-pulse", 22)}</span><div class="gt"><b>Кардио</b> · зона 2</div>${tier}</div><div class="group-b"><div class="ex">${z2Proto()}</div></div></section>`;
    if (g.kind === "skill") return `<section class="group fixed"><div class="group-h"><span class="gl tile" style="color:var(--info)">${icon("target", 22)}</span><div class="gt"><b>Навык</b> · 5 мин</div>${tier}</div><div class="group-b"><div class="ex">${skillCard(ctx.block, ctx.week, "Практика")}</div></div></section>`;
    const L = letter || g.id;
    const items = M.items.filter((m) => m.gi === gi).map((m) => itemHTML(m, ctx, M)).join("");
    // связка из нескольких — общая шапка «Суперсет · отдых 90 с» и линия слева; одиночное — без шапки, отдых и режим — тегами в карточке
    const multi = g.items.length > 1;
    if (!multi) return `<section class="group single" data-gl="${esc(L)}"><div class="group-b">${items}</div></section>`;
    return `<section class="group multi" data-gl="${esc(L)}"><div class="group-h"><span class="gl">${icon("link", 16)}</span><div class="gt"><b>${esc(kindLabel(g, ctx))}</b>${g.rest ? ` · отдых&nbsp;${nb(g.rest)}` : ""}</div>${tier}</div><div class="group-b">${items}</div></section>`;
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
      sec += act.reduce((a, r) => a + (r.myo ? 100 : 50) * (EX[r.exId] && EX[r.exId].side ? 2 : 1), 0) + (act.length - 1) * 20 + (k < rounds ? restSec(g.rest) : 0);
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
  /** Баннер с иконкой по смыслу: cls — accent / warn / danger / "" (инфо), + slim, one, row. */
  const BAN_IC = { accent: "info", warn: "alert-triangle", danger: "alert-triangle", "": "info" };
  function ban(cls, html, btns, ic) {
    const kind = (cls.match(/\b(accent|warn|danger)\b/) || [""])[0];
    return `<div class="banner ${cls}${btns ? " row" : ""}">${icon(ic || BAN_IC[kind], 20)}<span>${html}</span>${btns ? `<span class="row-btns">${btns}</span>` : ""}</div>`;
  }
  function installBanner() {
    if (isStandalone() || S.get("installHintClosed", false)) return "";
    const close = `<button class="icon-btn" data-closehint="1" aria-label="Скрыть">${icon("x", 20)}</button>`;
    if (installEvt) return ban("accent slim", "<b>Установи как приложение</b> — откроется с экрана «Домой», работает без сети.", `<button class="btn primary" data-install="1">${icon("download", 18)}Установить</button>${close}`, "smartphone");
    if (isIOS) return ban("accent slim", "<b>Установи на iPhone:</b> в Safari нажми «Поделиться» → «На экран „Домой“».", close, "smartphone");
    return "";
  }
  const updateBanner = () => waitingSW ? ban("accent", "<b>Доступна новая версия приложения.</b>", `<button class="btn primary" data-update="1">${icon("refresh", 18)}Обновить</button>`, "sparkles") : "";

  /* ---------- tab: today ---------- */
  function renderToday() {
    if (state.dayDate !== todayISO() || !days().includes(state.day)) { state.day = pickDay(); state.curEx = null; } // пережили полночь или сменилась программа
    state.renderDate = todayISO();
    const ctx = ctxNow();
    const blk = P.blocks[ctx.block - 1];
    const custom = ctx.custom;
    const sessKey = `${ctx.block}${ctx.day}`;
    const sess = sessOf(sessKey);
    const wd = new Date().getDay();
    // «Войди» и «Установи» — не срочные: под тренировкой, чтобы первое упражнение было на первом экране.
    // Истёкший вход и отказ в доступе — наверху: изменения не уходят в облако.
    // «Нет входа» — один раз сразу под героем, с «Скрыть» (запоминается на этом устройстве); истёкший вход и отказ — наверху
    const syncLow = bannerKey() === "off";
    const banners = [syncLow ? "" : syncBanner(), updateBanner(), undoBanner()];
    const underHero = syncLow && !S.get("loginHintHidden", false) ? syncBanner() : "";
    const lowBanners = installBanner();
    const pd = plannedDays(), hasToday = days().some((d) => entryHasData(todayLog(d)));
    // пустая тренировка (и ничего не записано): только пустое состояние с кнопкой — без «≈ 0 мин», итога и баннера про отдых
    const emptyS = !PM.strengthIdx(sess.groups).length && !entryHasData(todayLog(ctx.day));
    if (ctx.pre) banners.push(ban("accent slim", `Старт — ${WD[parseISO(state.settings.start).getDay()]}, ${fmtDate(state.settings.start)}. Можно начать и раньше.`, "", "calendar"));
    else if (!pd.includes(wd) && !hasToday && !emptyS) banners.push(ban("slim one", "По плану отдых — тренировка ниже.", "", "calendar"));
    // чередование: все тренировки очереди недели пустые — подсказка и переход дальше, а не тупик
    if (ctx.rot && ctx.q.every((d) => emptySess(d, 1))) banners.push(ban("warn stack", `В этой неделе ${ctx.q.length > 1 ? `тренировки ${andList(ctx.q)} пустые` : `тренировка ${ctx.q[0]} пустая`} — добавь упражнения или переходи дальше.`, `<button class="btn" data-cyc="next">${icon("arrow-right", 18)}Следующая неделя</button>`));
    if (ctx.next) banners.push(ban("accent slim one", custom ? `Неделя ${ctx.n - 1} закрыта → неделя ${ctx.n}.` : `Неделя ${ctx.n - 1 || weeks()} закрыта → неделя ${ctx.week} блока ${ctx.block}.`, "", "check-circle"));
    if (ctx.light) banners.push(ban("warn", "<b>Разгрузочная неделя.</b> Веса −10–15 %, подходов на один меньше, запас 3–4 повтора. Загляни в «Прогресс»: первая и последняя тренировка блока по каждому упражнению — это и есть прогресс блока."));
    else banners.push(fatigueBanner(ctx));
    // выбор времени — только если в тренировке есть связки «от 90 мин» / «только 120 мин»
    const timed = sess.groups.some((g) => g.tier === "std" || g.tier === "max");
    const modeNote = ctx.low
      ? `<p class="ctl-note"><b>Режим «так себе».</b> На подход меньше, +1 повтор в запасе${custom ? "" : ", без спринтов и бонусов, интервалы — в зоне 2"}. Пришёл и сделал основное — тренировка засчитана. Завтра режим сам вернётся в «норм».</p>`
      : timed && ctx.time <= 60 ? `<p class="ctl-note">60 минут — только упражнения «всегда». Руки, икры и база всё равно получают нагрузку.</p>` : "";

    const dayBtn = (d, i) => {
      const w = ctx.rot ? (ctx.q.includes(d) ? ctx.rot.wd[ctx.q.indexOf(d)] : null) : wdOf(d), sub = w != null ? WD_SHORT[w] : "";
      const full = w != null ? WD[w] + (optional(d) ? ", по желанию" : "") : optional(d) ? "по желанию" : "любой день";
      // засчитана для недели — по-прежнему ctx.done; показ: сегодняшняя, где записаны не все упражнения, — «начата»
      // сегодняшняя, где записаны не все упражнения и не нажато «Закончить», — «начата»
      const dd = ctx.next ? null : ctx.done[d], fin = !!(todayLog(d) || {}).fin;
      const st = !dd ? "" : dd === todayISO() && !fin && !(d === ctx.day && M.items.length && M.exDone >= M.items.length) ? "go" : "ok";
      const off = !!ctx.rot && !ctx.q.includes(d); // чередование: не на этой неделе — приглушена, но выбрать можно
      return `<button data-day="${d}" class="d-${d}${ctx.day === d ? " on" : ""}${st ? " " + st : ""}${off ? " off" : ""}" title="${esc(off ? "не на этой неделе" : full)}" aria-pressed="${ctx.day === d}" aria-label="Тренировка ${d}: ${esc(off ? "не на этой неделе, можно сделать вне очереди" : full)}${st === "ok" ? ", сделана" : st === "go" ? ", начата" : ""}"><b>${d}</b>${sub ? `<small>${sub}</small>` : ""}${st === "ok" ? `<span class="ok">${icon("check", 12)}</span>` : st === "go" ? `<span class="go"></span>` : ""}</button>`;
    };
    const timeBtn = (t) => `<button data-time="${t}" class="${ctx.time === t ? "on" : ""}" aria-pressed="${ctx.time === t}">${t}&nbsp;мин</button>`;
    const letters = groupNums(sess.groups);
    const M = todayModel(ctx);
    const groups = sess.groups.map((g, gi) => (groupVisible(g, ctx) ? groupHTML(g, ctx, sessKey, gi, letters[gi], M) : "")).join("");
    const est = estMinutes(sess, ctx, sessKey);
    const pct = M.sets ? Math.round((M.setsDone / M.sets) * 100) : 0;
    const prog = emptyS ? "" : M.items.length ? `<div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="${M.sets}" aria-valuenow="${M.setsDone}" aria-label="Сделано подходов">
        <div class="prog-t"><span><b>${M.exDone} из ${M.items.length}</b> ${plural(M.items.length, "упражнения", "упражнений", "упражнений")}</span><span>≈&nbsp;${est}&nbsp;мин</span></div>
        <div class="prog-bar"><i style="width:${pct}%"></i></div></div>` : `<div class="prog"><div class="prog-t"><span>≈ ${est} мин</span></div></div>`;
    const open = !!state.ctlOpen;
    // день не тот, что обычно в этот день недели, — коротко объяснить почему
    const dpk = S.get("dayPick", null), wdDay = dayOnWd(wd);
    let why = "";
    // сегодняшняя запись — в прежней неделе, а цикл уже сдвинули вручную: сказать прямо
    const te = todayLog(ctx.day), cycIdx = ctx.cyc.idx;
    const weekNote = te && entryHasData(te) && te.idx != null && te.idx !== cycIdx ? `Сегодняшняя запись — в ${custom ? `неделе ${ctx.n}` : `неделе ${ctx.week} блока ${ctx.block}`}; цикл уже на ${custom ? `неделе ${posOfIdx(cycIdx).n}` : `неделе ${posOfIdx(cycIdx).week} блока ${posOfIdx(cycIdx).block}`}.` : "";
    if (ctx.offq) why = `${ctx.day} — не на этой неделе: запишется, но неделю не закроет.`;
    else if (!(dpk && dpk.date === todayISO()) && !hasToday && !ctx.pre && wdDay && wdDay !== ctx.day) {
      why = ctx.done[wdDay] && !ctx.next ? `Тренировка ${wdDay} на этой неделе уже сделана — сегодня тренировка ${ctx.day}.`
        : optional(wdDay) ? `Сегодня тренировка ${ctx.day}: её на этой неделе ещё не было, а ${wdDay} — по желанию.`
        : `Сегодня тренировка ${ctx.day}: её на этой неделе ещё не было (по расписанию — ${wdDay}).`;
    }

    return `
      ${banners.join("")}
      <section class="hero th">
        <div class="th-row hero-top">${dayTile(ctx.day)}<div class="hero-t"><h2>${esc(sess.title)}</h2><span class="hero-sub">${dl([nbn(P.meta.name || "Апгрейд")].concat(custom ? [`неделя&nbsp;${ctx.n}${ctx.rot ? ` · ${andList(ctx.q)}` : ""}`] : [`блок&nbsp;${ctx.block}`, `неделя&nbsp;${ctx.week}&nbsp;из&nbsp;${P.meta.blockWeeks}`, ctx.light ? "разгрузка" : "", ctx.cycle > 1 ? `круг&nbsp;${ctx.cycle}` : ""]))}</span></div><button class="icon-btn hero-edit" data-planedit="${sessKey}" aria-label="Изменить тренировку ${ctx.day}" title="Изменить тренировку">${icon("pencil", 20)}</button></div>
        <div class="th-ctl${days().length > 3 || !timed ? " many" : ""}">
          <div class="day-seg" role="group" aria-label="Тренировка">${days().map((d, i) => dayBtn(d, i)).join("")}</div>
          <button class="ctl-sum" data-ctl="1" aria-expanded="${open}" aria-controls="ctlMore" aria-label="${timed ? `Время и самочувствие: ${ctx.time} минут, ` : "Самочувствие: "}${ctx.low ? "так себе" : "норм"}">${icon(timed ? "clock" : "activity", 20)}<span class="cs-t"><b>${timed ? `${ctx.time}&nbsp;мин` : "Самочувствие"}</b><small class="${ctx.low ? "low" : ""}">${ctx.low ? "так&nbsp;себе" : "норм"}</small></span><span class="car" aria-hidden="true">${icon("chevron-down", 18)}</span></button>
        </div>
        ${why ? `<p class="th-why">${esc(why)}</p>` : ""}
        ${weekNote ? `<p class="th-why">${esc(weekNote)}</p>` : ""}
        <div class="ctl-more" id="ctlMore" ${open ? "" : "hidden"}>
          ${timed ? `<div class="ctl-row"><span class="fl">Время</span><div class="seg" role="group" aria-label="Время, минут">${TIMES.map(timeBtn).join("")}</div></div>` : ""}
          <div class="ctl-row"><span class="fl">Самочувствие</span><div class="seg" role="group" aria-label="Самочувствие">
              <button data-ready="ok" class="${!ctx.low ? "on" : ""}" aria-pressed="${!ctx.low}">Норм</button>
              <button data-ready="low" class="${ctx.low ? "on" : ""}" aria-pressed="${ctx.low}">Так себе</button>
            </div></div>
          ${modeNote || `<p class="ctl-note">Норм — тренировка как обычно. «Так себе» облегчит её: подходом меньше, запас больше.</p>`}
          <div class="weekbar"><span>${custom ? `Неделя ${ctx.n}` : `Блок ${ctx.block} · неделя ${ctx.week} из ${P.meta.blockWeeks}${ctx.light ? " · разгрузка" : ""}`}</span><button class="lnk" data-tab="plan" data-cycfocus="1">${icon("calendar", 18)}${custom ? "Расписание и недели" : "Управлять циклом"}</button></div>
        </div>
        ${!open && modeNote && ctx.low ? `<p class="ctl-note slim">Режим «так себе»: облегчённая версия.</p>` : ""}
        ${prog}
      </section>
      ${underHero}
      ${sess.note && optional(ctx.day) ? ban("slim", esc(sess.note)) : ""}
      ${todayEmptyHTML(sess, sessKey)}
      ${groups}
      ${emptyS ? "" : finishHTML(ctx, M)}
      ${orphansHTML(ctx, sess, sessKey)}
      ${PM.edited(sessKey) && !custom ? `<p class="small muted mine-note">${icon("pencil", 16)}Твоя версия тренировки — изменена в «Программе».</p>` : ""}
      ${lowBanners}
      ${emptyS ? "" : checkinHTML(ctx)}
      ${isMain() && blk && blk.targets && blk.targets.length ? `<section class="card soft"><h3>${icon("flag", 20)}Цели блока «${esc(blk.name)}»</h3>${goalsHTML(ctx.block)}</section>` : ""}
      <p class="muted small">Подходы сохраняются на устройстве сразу${SY && SY.signedIn() ? " и уходят в базу, когда есть сеть" : ""}. Резервная копия — в <button class="lnk small inl" data-tab="settings">${icon("settings", 16)}настройках</button>.</p>`;
  }

  /** «Закончить тренировку»: после первого записанного подхода; отметка fin в записи дня. Итог показывается после отметки
      или сам, когда записаны все упражнения режима. Правила засчитывания недели от отметки не зависят. */
  function finishHTML(ctx, M) {
    const e = todayLog(ctx.day);
    if (!e || !entryHasData(e)) return "";
    const all = M.items.length && M.exDone >= M.items.length;
    if (!e.fin && !all) return `<div class="fin-w"><button class="btn tonal wide" data-finish="1">${icon("check-circle", 20)}Закончить тренировку</button></div>`;
    const ex = Object.values(e.ex || {}).filter((s) => (s || []).some(performed)).length;
    const sets = Object.values(e.ex || {}).reduce((a, s) => a + (s || []).filter(performed).length, 0);
    return `<section class="card fin-card" role="status"><span class="fin-ic" aria-hidden="true">${icon("check", 24)}</span><div class="fin-t"><b>Тренировка записана</b><small>${dl([numW(ex, "упражнение", "упражнения", "упражнений"), numW(sets, "подход", "подхода", "подходов")])}</small></div>
      ${e.fin ? `<button class="btn ghost" data-finish="0">${icon("undo", 18)}Продолжить</button>` : ""}</section>`;
  }
  /** «Сегодня» для тренировки без силовых упражнений: сказать прямо и дать собрать её в «Плане». */
  function todayEmptyHTML(sess, sessKey) {
    if (PM.strengthIdx(sess.groups).length) return "";
    return `<section class="card t-empty empty"><span class="empty-ic">${icon("dumbbell", 28)}</span><b>В этой тренировке пока нет упражнений</b><p class="small muted">Собери её в «Программе» — или выбери другую тренировку выше.</p><button class="btn primary wide" data-planedit="${sessKey}">${icon("plus", 20)}Собрать тренировку</button></section>`;
  }
  /** Подходы, записанные сегодня по упражнениям, которых в тренировке уже нет (её скопировали поверх или очистили), —
      только для чтения, чтобы записанное не пропадало из виду. */
  /** Подходы, записанные сегодня, но не видные в карточках: упражнение убрали из тренировки (скопировали поверх,
      очистили), заменили на сегодня или его связку прячет режим времени. Только для чтения — записанное не пропадает из виду. */
  function orphansHTML(ctx, sess, sessKey) {
    const e = state.logs[logKey(todayISO(), ctx.day)];
    if (!e || !e.ex) return "";
    const shown = new Set(), hidden = new Set(), swapped = {};
    sess.groups.forEach((g) => {
      if (!isStrength(g)) return;
      g.items.forEach((it, ii) => {
        const r = resolveItem(it, ctx, `${sessKey}-${g.id}-${ii}`);
        (groupVisible(g, ctx) ? shown : hidden).add(r.exId);
        if (r.planned && r.planned !== r.exId) swapped[r.planned] = r.exId;
      });
    });
    const why = (id) => swapped[id] ? `заменено на сегодня на «${exName(swapped[id])}»` : hidden.has(id) ? `связка скрыта в режиме ${ctx.time} мин` : "убрано из тренировки";
    const rows = Object.keys(e.ex).filter((id) => !shown.has(id)).map((id) => {
      const sets = (e.ex[id] || []).filter(performed);
      if (!sets.length) return "";
      return `<li><b>${esc(exName(id))}</b> — ${sets.map((x) => esc(x.w != null && String(x.w).trim() !== "" ? `${String(x.w).replace(".", ",")}×${x.r}` : `${x.r}`)).join(" · ")} <span class="muted small">(${esc(why(id))})</span></li>`;
    }).filter(Boolean);
    return rows.length ? `<section class="card soft orphans"><h3>${icon("list", 20)}Ещё записано сегодня</h3><ul>${rows.join("")}</ul><p class="small muted">Эти подходы не видны в карточках выше — записи остаются в журнале.</p></section>` : "";
  }

  /* ---------- итог тренировки ---------- */
  const JOINTS = [["knee", "Колени"], ["back", "Спина"], ["elbow", "Локти"], ["shoulder", "Плечи"]];
  const JOINT_LV = ["", "дискомфорт", "боль"];
  /** Чип сустава: состояние словом и цветом — «Колени · дискомфорт» (янтарь), «· боль» (красный). */
  const jointChip = (n, lv) => `${lv ? icon(lv === 2 ? "alert-triangle" : "info", 16) : icon("shield", 16)}${n}${lv ? ` · ${JOINT_LV[lv]}` : " · в порядке"}`;
  function checkinHTML(ctx) {
    const e = state.logs[logKey(todayISO(), ctx.day)] || {};
    const s = e.s || {}, j = s.joints || {};
    const chips = JOINTS.map(([k, n]) => {
      const lv = +j[k] || 0;
      return `<button class="chip jt lv${lv}" data-joint="${k}" aria-pressed="${lv > 0}" aria-label="${n}: ${JOINT_LV[lv] || "в порядке"}">${jointChip(n, lv)}</button>`;
    }).join("");
    return `<section class="card checkin" id="checkin">
      <h3 tabindex="-1">${icon("check-circle", 20)}Итог тренировки</h3>
      <p class="small muted">Что-то беспокоило? Касание — дискомфорт, ещё одно — боль, третье — сбросить. По этим отметкам приложение подскажет ${ctx.custom ? "облегчить неделю" : "разгрузку, а агент учтёт их в корректировках"}.</p>
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
    if (!r.length || S.get("fatigueSkip", -1) === `${BOUND}:${ctx.cyc.idx}` || (isMain() && S.get("fatigueSkip", -1) === ctx.cyc.idx)) return "";
    // у своей программы разгрузок нет — только совет
    if (ctx.custom) return ban("warn", `<b>Похоже на накопленную усталость:</b> ${esc(r.join("; "))}. Сделай эту неделю полегче: веса −10–15 %, подходом меньше, запас 3–4 повтора.`, `<button class="btn ghost" data-fatigueskip="1">Понятно</button>`);
    return ban("warn", `<b>Похоже на накопленную усталость:</b> ${esc(r.join("; "))}. Можно сделать разгрузку сейчас, а блок продолжить после неё.`, `<button class="btn primary" data-cyc="deload">Разгрузка</button><button class="btn ghost" data-fatigueskip="1">Не сейчас</button>`);
  }
  function goalsHTML(block) {
    const g = state.goals["b" + block] || [];
    return `<div class="goals">${P.blocks[block - 1].targets.map((t, i) => `<label><input type="checkbox" data-goal="${block}:${i}" ${g[i] ? "checked" : ""}><span>${esc(t)}</span></label>`).join("")}</div>`;
  }

  /* ---------- tab: plan ---------- */
  /** Плановый объём недели: обязательные тренировки + (withOpt) необязательные; у своей программы — все. */
  function weeklyVolume(block, withOpt) {
    const vol = {};
    const add = (m, k, v) => { vol[m] = vol[m] || { d: 0, i: 0 }; vol[m][k] += v; };
    days().filter((d) => withOpt || !optional(d)).forEach((day) => {
      const s = sessOf(`${block}${day}`); if (!s) return;
      s.groups.forEach((g) => {
        if (!g.items || g.kind === "warmup" || g.tier === "max") return;
        g.items.forEach((it) => {
          const b = it.hl ? Object.assign({ ex: it.ex }, it.hl.heavy) : it.weekAlt ? it.weekAlt[0] : it;
          const adj = adjFor(b.ex, `${block}${day}`);
          const ex = EX[adj && adj.replace_with && EX[adj.replace_with] ? adj.replace_with : b.ex];
          if (!ex || !ex.m) return;
          const cs = b === it ? cycStep(it, { day, plan: true }) : null; // цикл нагрузки — подходы текущего шага
          const sets = adj && adj.sets != null ? +adj.sets : b.myo ? (b.eff || 2) : cs ? cs.st.sets : b.sets;
          ex.m.p.forEach((m) => add(m, "d", sets));
          ex.m.s.forEach((m) => add(m, "i", sets));
        });
      });
    });
    // чередование: в среднем за неделю круга — сумма по всем тренировкам × pw / n
    const rot = isCustom() ? rotNow() : null;
    if (rot) Object.keys(vol).forEach((m) => { vol[m].d *= rot.pw / days().length; vol[m].i *= rot.pw / days().length; });
    return vol;
  }
  function volumeChart(block, withSat) {
    const vol = weeklyVolume(block, withSat);
    const rows = Object.keys(P.muscles).filter((m) => !P.muscles[m].hide).map((m) => {
      const v = vol[m] || { d: 0, i: 0 };
      return { n: P.muscles[m].n, pr: P.muscles[m].pr, d: v.d, i: v.i, t: v.d + v.i * 0.5 };
    });
    const max = Math.max(...rows.map((r) => r.t), 1);
    const col = { 1: "var(--p1)", 2: "var(--p2)", 3: "var(--p3)", 0: "var(--p0)" }, custom = isCustom();
    const bars = rows.map((r) => {
      const w = (r.t / max) * 100;
      if (custom) r.pr = 0; // у своей программы приоритетов мышц нет
      const tip = `${r.n}: ${fmtNum(r.t)} подх./нед.${rotNow() && custom ? " в среднем" : ""} — прямые ${fmtNum(r.d)}, косвенные ${fmtNum(r.i)} × 0,5`;
      return `<div class="bar-row" title="${esc(tip)}"><div class="bar-lab">${esc(r.n)}</div>
        <div class="bar-track"><div class="bar" style="width:max(3px, calc(${w}% - 40px));background:${col[r.pr]}"></div>
        <span class="bar-val" style="left:max(3px, calc(${w}% - 40px))">${fmtNum(r.t)}</span></div></div>`;
    }).join("");
    return `<div class="chart" role="img" aria-label="Подходы в неделю по мышцам">${bars}</div>
      ${custom ? "" : `<div class="legend"><span><i style="background:var(--p1)"></i>Приоритет 1 — руки, икры</span><span><i style="background:var(--p2)"></i>Приоритет 2 — дельты</span><span><i style="background:var(--p3)"></i>Приоритет 3 — спина</span><span><i style="background:var(--p0)"></i>Остальное</span></div>`}`;
  }
  /* ---------- цикл: карточка и действия ---------- */
  let lastUndo = null;
  function undoBanner() {
    if (!lastUndo || Date.now() - lastUndo.at > 180000) return "";
    return ban("", esc(lastUndo.label), `<button class="btn" data-undo="1">${icon("undo", 18)}Отменить</button>`, "check-circle");
  }
  const wkName = (idx) => { const p = posOfIdx(idx); return isCustom() ? `неделя ${p.n}` : `неделя ${p.week} блока ${p.block}${isDeload(p) ? " (разгрузка)" : ""}`; };
  function cycleAction(kind, arg) {
    const cyc = cycleState(), cur = posOfIdx(cyc.idx), bw = P.meta.blockWeeks;
    const blockStart = cyc.idx - (cur.week - 1), custom = isCustom();
    let to = cyc.idx, label;
    if (kind === "next") { to = cyc.idx + 1; label = `Дальше: ${wkName(to)}.`; }
    else if (kind === "repeat") { label = `${wkName(to)[0].toUpperCase() + wkName(to).slice(1)} начнётся заново.`; }
    else if (kind === "restart") { to = 0; label = "Начали заново: неделя 1."; }
    else if (custom && (kind === "deload" || kind === "nextblock")) return; // у своей программы нет блоков и разгрузок
    else if (kind === "deload") { to = blockStart + bw - 1; label = `Разгрузка сейчас: ${wkName(to)}. После неё — следующий блок.`; }
    else if (kind === "nextblock") { to = blockStart + bw; label = `Начат блок ${posOfIdx(to).block} «${P.blocks[posOfIdx(to).block - 1].name}».`; }
    else if (kind === "goto") { to = custom ? +arg - 1 : cyc.idx - (cur.n - 1) + (+arg - 1); label = `Перешли: ${wkName(to)}.`; }
    else return;
    const prev = setCycle({ idx: to, since: todayISO() }, kind);
    if (days().some((d) => entryHasData(todayLog(d)))) label += " Сегодняшняя записанная тренировка остаётся в прежней неделе.";
    lastUndo = { prev, label, at: Date.now(), prog: BOUND };
    state.day = resetDay();
    render();
  }
  /** Номер недели записи: старые записи без idx — по блоку и неделе встроенной программы. */
  const idxOfE = (e) => (e.idx != null ? e.idx : e.block && e.week ? (e.block - 1) * BUILTIN.meta.blockWeeks + e.week - 1 : null);
  /** Тренировки по неделям программы — только записи текущей программы. */
  function idxSessions() {
    const by = {};
    Object.keys(state.logs).forEach((k) => {
      const e = state.logs[k];
      if (!mineK(k) || !entryHasData(e)) return;
      const idx = idxOfE(e);
      if (idx == null) return;
      (by[idx] = by[idx] || new Set()).add(PG.parseLogKey(k).day);
    });
    return by;
  }
  /** «3 тренировки», «1 день», «5 недель» — число с неразрывным пробелом и словом в нужной форме. */
  const numW = (n, one, few, many) => `${n}\u00a0${plural(n, one, few, many)}`;
  function plural(n, one, few, many) { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many; }
  function cycleCard(ctx) {
    const cyc = ctx.cyc, cur = posOfIdx(cyc.idx), base = cyc.idx - (cur.n - 1), by = idxSessions(), custom = isCustom();
    // недели, через которые перешли вручную («Следующая неделя», «Следующий блок», «Разгрузка сейчас», выбор недели), — не «пропущены»
    const manual = new Set();
    (cyc.hist || []).forEach((h) => { if (h && h.why !== "auto" && h.to > h.from) for (let x = h.from; x < h.to; x++) manual.add(x); });
    const bw = P.meta.blockWeeks;
    // своя программа: «сделана» — все тренировки очереди этой недели (при чередовании очередь у каждой недели своя)
    // неделя раньше смены правил — «сделана», если записана хоть одна тренировка (её очередь не известна)
    const soft = (idx) => custom && PG.softWeek(curRec(), idx);
    const needOf = (idx) => (soft(idx) ? 1 : custom ? Math.max(1, reqDays(1, idx).length) : 2);
    const cntOf = (idx, s) => (custom && !soft(idx) ? weekDays(idx).filter((d) => s.has(d)).length : s.size);
    const cell = (idx, num, lab0, dl) => {
      const s = by[idx], n = s ? cntOf(idx, s) : 0, all = s ? s.size : 0, need = needOf(idx);
      const st = idx < cyc.idx ? (n >= need ? "done" : all ? "part" : manual.has(idx) ? "skip" : "miss") : idx === cyc.idx ? "cur" : "fut";
      const lab = `${lab0}: ${st === "cur" ? "сейчас" : st === "fut" ? "впереди" : st === "skip" ? "перешли дальше вручную" : all ? `тренировок ${all}` : "пропущена"}`;
      return `<span class="wk ${st}${dl ? " dl" : ""}" title="${esc(lab)}" aria-label="${esc(lab)}">${num}</span>`;
    };
    const curQ = custom ? weekDays(cyc.idx) : days();
    const doneTxt = curQ.map((d) => `${d}&nbsp;— ${ctx.done[d] && !ctx.next ? "да" : "нет"}`).join(", ");
    const legend = `<div class="legend"><span><i class="lg done"></i>сделана</span><span><i class="lg part"></i>частично</span><span><i class="lg miss"></i>пропущена</span><span><i class="lg cur"></i>сейчас</span>${custom ? "" : `<span><i class="lg dl"></i>разгрузка</span>`}</div>`;
    const more = (btns, go) => `<details class="cyc-more"${state.cycMore ? " open" : ""} data-cycmore="1"><summary>Ещё действия${icon("chevron-down", 18)}</summary>
        <div class="ex-tools cyc-btns">${btns}</div>${go}</details>`;
    if (custom) {
      // своя программа: недели подряд — последние 8 недель, без блоков и разгрузок
      const from = Math.max(0, cyc.idx - 6), cells = Array.from({ length: 8 }, (_, i) => cell(from + i, from + i + 1, `Неделя ${from + i + 1}`, false)).join("");
      const opts = Array.from({ length: cyc.idx + 1 }, (_, i) => `<option value="${i + 1}" ${i === cyc.idx ? "selected" : ""}>Неделя ${i + 1}</option>`).join("");
      return `<section class="card cycle" id="cycle">
      <h3>${icon("repeat", 20)}Недели</h3>
      <div class="cyc one" role="group" aria-label="Недели программы"><div class="cyc-b"><div class="cyc-cells w8">${cells}</div></div></div>
      ${legend}
      ${ctx.closed ? `<p class="small"><b>Неделя ${cur.n} закрыта.</b> Дальше — неделя ${cur.n + 1}${rotNow() ? ` (${weekDays(cyc.idx + 1).join(", ")})` : ""}: начнётся с первого подхода.</p>`
        : `<p class="small"><b>Сейчас:</b> неделя ${cur.n}${rotNow() && !soft(cyc.idx) ? ` (${curQ.join(", ")})` : ""}. Сделано: ${soft(cyc.idx) ? days().filter((d) => ctx.done[d]).join(", ") || "пока ничего" : doneTxt}.</p>`}
      <button class="btn primary cyc-main" data-cyc="next">${icon("arrow-right", 20)}Следующая неделя</button>
      ${more(`<button class="btn" data-cyc="repeat">Повторить неделю</button><button class="btn" data-cyc="restart">Начать заново</button>`, cyc.idx > 0 ? `<label class="small cyc-go">Вернуться к неделе <select data-cycgo="1" aria-label="Вернуться к неделе">${opts}</select></label>` : "")}
    </section>
      <details class="card acc"><summary><h3>Как считаются недели</h3></summary><div class="acc-b"><p class="small">${rotNow() ? `Тренировки идут по очереди, ${rotNow().pw} в неделю: ${esc(rotPhrase(days().length, rotNow().pw))} Неделя закрывается, когда сделаны тренировки её очереди с упражнениями. Другую тренировку можно сделать и вне очереди — она запишется, но неделю не закроет.` : `Неделя закрывается, когда сделаны все тренировки с упражнениями (${days().join(", ")}).`} Пропуски не сбивают программу — она ждёт на той же неделе. Недели идут подряд: «Неделя 1», «Неделя 2» и дальше.</p></div></details>`;
    }
    const cyc3 = blocks().map((b, bi) => {
      const cells = Array.from({ length: bw }, (_, w) => cell(base + bi * bw + w, w + 1, `Блок ${b.id}, неделя ${w + 1}${w === bw - 1 ? " — разгрузка" : ""}`, w === bw - 1)).join("");
      return `<div class="cyc-b"><div class="cyc-cells" style="--n:${bw}">${cells}</div><small>${esc(b.name)}</small></div>`;
    }).join("");
    const toDeload = bw - cur.week;
    const dlTxt = isDeload(cur) ? "Сейчас разгрузка." : `Разгрузка — через ${toDeload}&nbsp;${plural(toDeload, "неделю", "недели", "недель")} выполнения.`;
    const opts = Array.from({ length: weeks() }, (_, i) => `<option value="${i + 1}" ${i + 1 === cur.n ? "selected" : ""}>Блок ${Math.floor(i / bw) + 1} · неделя ${(i % bw) + 1}${i % bw === bw - 1 ? " · разгрузка" : ""}</option>`).join("");
    const req = days().filter((x) => !optional(x)), opt = days().filter(optional);
    return `<section class="card cycle" id="cycle">
      <h3>${icon("repeat", 20)}Цикл${cur.cycle > 1 ? ` · круг ${cur.cycle}` : ""}</h3>
      <div class="cyc" role="group" aria-label="Недели программы" style="--n:${blocks().length}">${cyc3}</div>
      ${legend}
      <p class="small"><b>Сейчас:</b> блок&nbsp;${cur.block} «${esc(P.blocks[cur.block - 1].name)}», неделя ${cur.week}&nbsp;из&nbsp;${bw}. Сделано: ${doneTxt}. ${dlTxt}</p>
      <button class="btn primary cyc-main" data-cyc="next">${icon("arrow-right", 20)}Следующая неделя</button>
      ${more(`<button class="btn" data-cyc="repeat">Повторить неделю</button>${!isDeload(cur) ? `<button class="btn" data-cyc="deload">Разгрузка сейчас</button>` : ""}<button class="btn" data-cyc="nextblock">Следующий блок</button>`,
        `<label class="small cyc-go">Перейти к неделе <select data-cycgo="1" aria-label="Перейти к неделе">${opts}</select></label>`)}
    </section>
      <details class="card acc"><summary><h3>Как считаются недели</h3></summary><div class="acc-b"><p class="small">Неделя закрывается, когда сделаны ${req.join(" и ")}${opt.length ? `; ${opt.join(", ")} — по желанию` : ""}. Пропуски не сбивают программу — она ждёт на той же неделе. Разгрузка — каждая ${bw}-я неделя блока; накопилась усталость — сделай её раньше.</p></div></details>`;
  }
  /** Сетка недели: 7 ячеек ≥ 44 px, в ячейке — плитка-буква на цвете тренировки или прочерк. У своей программы тап — шторка
      «Что в этот день»; у встроенной и копии — включить или снять день (i-й день ↔ i-я тренировка). */
  function weekGrid() {
    const custom = isCustom() && !rotNow(); // при чередовании — как у встроенной: тап включает или снимает день
    return [1, 2, 3, 4, 5, 6, 0].map((wd) => {
      const d = dayOnWd(wd), what = d ? `тренировка ${d}${optional(d) ? ", по желанию" : ""}` : "отдых";
      return `<button class="wd${d ? ` on d-${d}` : ""}${d && optional(d) ? " opt" : ""}" ${custom ? `data-wcell="${wd}"` : `data-wday="${wd}"`} ${custom ? 'aria-haspopup="dialog"' : `aria-pressed="${!!d}"`} aria-label="${WD[wd]}: ${what}${custom ? ". Выбрать, что в этот день" : ""}">${d ? dayTile(d, "sm") : `<span class="wd-rest" aria-hidden="true">—</span>`}<small>${WD_SHORT[wd]}</small></button>`;
    }).join("");
  }
  /** Подпись под сеткой: у своей — какие тренировки без дня. */
  function weekGridNote() {
    const rot = rotNow();
    if (rot) return `Дни одни и те же каждую неделю, тренировки в них меняются по очереди — в ячейках эта неделя. Нажми на день — сделать его тренировочным или выходным, не больше ${numW(rot.pw, "дня", "дней", "дней")}.`;
    if (!isCustom()) return `Нажми на день — сделать его тренировочным или выходным. ${Cap(numW(days().length, "день", "дня", "дней"))} максимум: ${days().join(", ")} идут по порядку недели.`;
    const free = days().filter((d) => wdOf(d) == null);
    return free.length ? `Без дня: ${free.join(", ")} — в любой свободный день. Нажми на день недели — выбрать, что в этот день.` : "У каждой тренировки свой день. Нажми на день недели — поменять.";
  }
  /** Дни недели: не больше, чем тренировок; i-й выбранный день ↔ i-я тренировка. У встроенной — settings.days, у своих — wd записи. */
  function toggleWeekday(wd) {
    const rot = rotNow();
    if (rot) {
      // чередование: дни мест в неделе (rot.wd), не больше «тренировок в неделю»; пусто можно — «любой день»
      const pd = rot.wd.slice(), i = pd.indexOf(wd);
      if (i >= 0) pd.splice(i, 1);
      else if (pd.length >= rot.pw) return `Дней — не больше, чем тренировок в неделю (${rot.pw}). Сначала сними один из них.`;
      else pd.push(wd);
      const r = PG.setRotWd(curRec(), pd);
      if (!r.error) saveRec(r.rec);
      state.day = resetDay();
      return "";
    }
    let pd = plannedDays().slice();
    const i = pd.indexOf(wd), n = days().length;
    if (i >= 0) { if (pd.length === 1) return "Нужен хотя бы один день."; pd.splice(i, 1); }
    else {
      if (pd.length >= n) return n === 3 && !isCustom() ? "Максимум три дня: A, B и C. Сначала сними один из них." : `Дней — не больше, чем тренировок (${n}: ${days().join(", ")}). Сначала сними один из них.`;
      pd.push(wd);
    }
    pd = pd.sort((a, b) => monFirst(a) - monFirst(b));
    const rec = curRec();
    if (rec) saveRec(PG.patch(rec, { wd: pd }));
    else { state.settings = Object.assign({}, state.settings, { days: pd }); S.set("settings", state.settings); }
    state.day = resetDay();
    return "";
  }

  /* ---------- «Программа»: спуск вглубь вместо вкладок ----------
     Экраны (state.pv): "hub" — корень вкладки (герой программы, тренировки по блокам, «Управление»);
     "sess" — конструктор тренировки state.pb + state.pd; "sched" — расписание и цикл; "about" — о программе;
     "progs" — все программы (этап C). Вложенные экраны — с «назад» в шапке и системной «назад» (см. planGo / planBack).
     state.pFrom — вкладка, откуда пришли прямой ссылкой («Изменить» на «Сегодня»): «назад» вернёт туда. */
  const planKey = () => `${state.pb}${state.pd}`;
  const PV_TITLES = { sched: "Расписание и цикл", about: "О программе", progs: "Все программы" };
  const planSub = () => state.tab === "plan" && ((state.pv || "hub") !== "hub" || !!state.reorder);
  /** Блок и тренировка по умолчанию — текущие; неизвестные (сменилась программа) — тоже на текущие. */
  function planInit(ctx) {
    if (!state.pb || !blocks().some((b) => b.id === state.pb)) state.pb = ctx.block;
    if (!state.pd || !days().includes(state.pd)) state.pd = days().includes(ctx.day) ? ctx.day : days()[0];
    if (state.pv === "sess" && !sessOf(planKey())) state.pv = "hub";
  }
  function renderPlan() {
    const ctx = ctxNow();
    planInit(ctx);
    const v = state.pv || "hub";
    return v === "sess" ? planSess(ctx) : v === "sched" ? planSched(ctx) : v === "about" ? planAbout(ctx) : v === "progs" ? planProgs(ctx) : planHub(ctx);
  }
  /** Перейти на экран «Программы». o: { b, d, from, flash }. Хаб помнит прокрутку. */
  function planGo(pv, o) {
    o = o || {};
    hideToast(); // сообщение — про прежний экран
    if (state.tab === "plan" && (state.pv || "hub") === "hub" && pv !== "hub") state.hubY = window.scrollY;
    if (o.b != null) state.pb = +o.b;
    if (o.d) state.pd = o.d;
    state.pFrom = pv === "hub" ? null : o.from !== undefined ? o.from : state.pFrom;
    Object.assign(state, { pv, qe: null, reorder: false, flash: o.flash || null });
    if (state.tab !== "plan") { state.tab = "plan"; S.set("tab", "plan"); }
    render();
    window.scrollTo(0, pv === "hub" ? state.hubY || 0 : 0);
    state.flash = null;
    if (layered()) pushGuard(); else dropGuard();
  }
  /** На уровень выше: из режима «Порядок» — в список; с экрана — в хаб или туда, откуда пришли. */
  function planBack() {
    if (state.reorder) { endReorder(); return; }
    const from = state.pFrom;
    if (from && from !== "plan" && own(TITLES, from)) {
      const y = state.pFromY || 0;
      Object.assign(state, { pFrom: null, pv: "hub", qe: null });
      go(from);
      // прокрутку возвращаем после перерисовки и снятия страховочной записи истории
      window.scrollTo(0, y); requestAnimationFrame(() => window.scrollTo(0, y)); setTimeout(() => window.scrollTo(0, y), 60);
      return;
    }
    planGo("hub");
  }
  function planCtx(b, d, cur) {
    return { block: b, week: b === cur.block ? cur.week : 1, day: d, time: 120, low: false, light: false, heavy: !isCustom(), plan: true };
  }
  /** Название упражнения; id, которого нет в программе (запись из будущей версии, битые данные), — «Упражнение недоступно». */
  const exName = (id) => (EX[id] ? EX[id].n : "Упражнение недоступно");
  function musclesText(id) {
    const e = EX[id]; if (!e || !e.m) return "";
    const nm = (m) => (P.muscles[m] ? P.muscles[m].n.toLowerCase() : "");
    const p = e.m.p.map(nm).filter(Boolean), s = e.m.s.map(nm).filter(Boolean);
    return p.join(", ") + (s.length ? ` · помогают: ${s.join(", ")}` : "");
  }
  /** Подписанные значения карточки: три ячейки «3 / подхода», «10–12 / повторов», «2 / запас». */
  function schemeCells(p) {
    const cell = (v, l) => `<span class="pc"><b>${v}</b><small>${l}</small></span>`;
    if (p.myo) return cell(p.sets, plural(p.sets, "майо-подход", "майо-подхода", "майо-подходов"));
    const reps = String(p.reps == null ? "" : p.reps).trim(), r = parseReps(reps, false);
    const out = [cell(p.sets, plural(p.sets, "подход", "подхода", "подходов"))];
    if (reps) out.push(r ? cell(r.a === r.b ? r.a : `${r.a}–${r.b}`, r.sec ? plural(r.b, "секунда", "секунды", "секунд") : repsWord(reps)) : cell(esc(reps), "повторы"));
    if (p.rir != null && p.rir !== "") out.push(cell(esc(p.rir), "запас"));
    return out.join("");
  }
  /** Темп и «на сторону» — тегами под ячейками. */
  const schemeTags = (p, ex) => [ex && ex.side && !p.myo ? `<span class="tag">на сторону</span>` : "", p.tempo ? `<span class="tag">${icon("clock", 14)}${esc(p.tempo)}</span>` : ""].join("");
  /** Основные группы мышц тренировки: «ноги · грудь · руки». */
  function sessMuscles(s) {
    const cnt = {};
    PM.strengthIdx(s.groups).forEach((gi) => s.groups[gi].items.forEach((it) => { const g = exGroup(PM.exIds(it)[0]); if (g) cnt[g] = (cnt[g] || 0) + 1; }));
    return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 3).map((g) => GROUP_RU[g]);
  }
  /** Упражнений в тренировке при режиме времени ctx.time — по тому же правилу, что «Сегодня» и estMinutes. */
  const sessCount = (s, ctx) => s.groups.reduce((a, g) => a + (isStrength(g) && groupVisible(g, ctx) ? g.items.length : 0), 0);
  /** День недели тренировки по расписанию: «Пн», без дня — «любой день». */
  const dayWd = (d) => { const w = wdOf(d); return w != null ? WD_SHORT[w] : "любой день"; };
  /** Как называть тренировку в тексте: «тренировка B, блок 1» (голая буква — только на плитке). */
  const SLOT_CASE = { nom: "тренировка", gen: "тренировки", dat: "тренировке", acc: "тренировку" };
  const slotName = (k, c) => `${SLOT_CASE[c || "nom"]} ${k[1]}${multiBlock() ? `, блок ${k[0]}` : ""}`;
  const Cap = (s) => s[0].toUpperCase() + s.slice(1);
  /** «A», «A и B», «A, B и C». */
  const andList = (l) => (l.length < 2 ? l.join("") : `${l.slice(0, -1).join(", ")} и ${l[l.length - 1]}`);
  /** Сводка программы: «3 блока по 5 недель · 3 тренировки в неделю» / «4 тренировки в неделю». rec — запись (по умолчанию текущая). */
  function progParts(rec) {
    const r = rec === undefined ? curRec() : rec, custom = PG.isCustom(r), nd = PG.daysOf(r).length;
    const nb2 = custom ? 1 : BUILTIN.blocks.length, bw = BUILTIN.meta.blockWeeks, rot = PG.rotOf(r);
    // чередование: «4 тренировки · 2 в неделю · круг 2 недели»
    if (rot) { const R = PG.roundWeeks(r); return [`${nd}&nbsp;${plural(nd, "тренировка", "тренировки", "тренировок")}`, `${rot.pw}&nbsp;в&nbsp;неделю`, `круг&nbsp;${R}&nbsp;${plural(R, "неделя", "недели", "недель")}`]; }
    return (nb2 > 1 ? [`${nb2}&nbsp;${plural(nb2, "блок", "блока", "блоков")} по&nbsp;${bw}&nbsp;${plural(bw, "неделе", "недели", "недель")}`] : []).concat(`${nd}&nbsp;${plural(nd, "тренировка", "тренировки", "тренировок")} в&nbsp;неделю`);
  }
  const progSummary = () => progParts().join(" · ").replace(/&nbsp;/g, " ");
  function progHero(ctx) {
    const menu = `<button class="icon-btn" data-pmenu="1" aria-label="Действия с программой">${icon("more-vertical", 22)}</button>`;
    let bar;
    // неделя цикла (как в «Расписании»), а не неделя сегодняшней записи
    const cp = posOfIdx(ctx.cyc.idx);
    if (ctx.custom) {
      // своя программа: недели подряд — полоса показывает, сколько тренировок этой недели сделано
      // та же неделя, что на «Сегодня»: закрыта текущая — уже следующая (в ней пока ничего не сделано)
      const qi = qIdx(), done = qi === ctx.cyc.idx ? ctx.done : {}, soft = PG.softWeek(curRec(), qi);
      const req = soft ? days().filter((d) => done[d]) : reqDays(1, qi), dn = req.filter((d) => done[d]).length, tot = req.length, pct = tot ? Math.round((dn / tot) * 100) : 0;
      bar = `<div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="${tot}" aria-valuenow="${dn}" aria-label="Тренировок за неделю">
        <div class="prog-t"><span><b>Неделя&nbsp;${qi + 1}</b>${ctx.rot && !soft ? ` · ${andList(weekDays(qi))}` : ""}</span><span>${tot ? `сделано ${dn}&nbsp;из&nbsp;${tot}` : "тренировки пустые"}</span></div>
        <div class="prog-bar"><i style="width:${pct}%"></i></div></div>`;
    } else {
      const n = cp.n, W = weeks(), pct = Math.round((n / W) * 100);
      bar = `<div class="prog" role="progressbar" aria-valuemin="1" aria-valuemax="${W}" aria-valuenow="${n}" aria-label="Неделя программы">
        <div class="prog-t"><span><b>Блок&nbsp;${cp.block}</b>, неделя ${cp.week}&nbsp;из&nbsp;${P.meta.blockWeeks}${isDeload(cp) ? ", разгрузка" : ""}</span><span>${n}&nbsp;из&nbsp;${W}&nbsp;нед.</span></div>
        <div class="prog-bar"><i style="width:${pct}%"></i></div></div>`;
    }
    return `<section class="hero ph">
      <div class="hero-top"><span class="ph-ic" aria-hidden="true">${icon(progIcon(BOUND), 24)}</span><div class="hero-t"><h2>${nbd(P.meta.name || "Апгрейд")}</h2><span class="hero-sub">${dl(progParts())}</span></div>${menu}</div>
      ${bar}
      <button class="btn tonal wide ph-all" data-pv="progs">${icon("layers", 18)}Все программы</button>
    </section>`;
  }
  /** Сегменты блоков: «Блок 1» (+ название в хабе), у текущего — подпись «сейчас», у изменённой тренировки — карандаш. */
  function blockSeg(cls, cur, sel, withName, edKey) {
    if (blocks().length < 2) return "";
    return `<div class="seg bseg ${cls}" role="group" aria-label="${withName ? "Блок" : "Эта тренировка в блоке"}">${blocks().map((x) => {
      const now = x.id === cur, ed = edKey && PM.edited(`${x.id}${edKey}`);
      return `<button data-pb="${x.id}" class="${sel === x.id ? "on" : ""}" aria-pressed="${sel === x.id}" aria-label="Блок ${x.id} «${esc(x.name)}»${now ? ", сейчас" : ""}${ed ? ", есть твои правки" : ""}">${now ? `<span class="now-b">сейчас</span>` : ""}<span class="bs-t">Блок&nbsp;${x.id}${ed ? `<span class="ed" title="Есть твои правки">${icon("pencil", 12)}</span>` : ""}</span>${withName ? `<small>${esc(x.name)}</small>` : ""}</button>`;
    }).join("")}</div>`;
  }
  /* --- хаб --- */
  function planHub(ctx) {
    const b = state.pb, pc = planCtx(b, state.pd, ctx), t = TIMES.includes(+state.time) ? +state.time : 90, custom = isCustom();
    const rotQ = custom && !!rotNow(), qi = rotQ ? qIdx() : 0;
    const cards = days().map((d) => {
      const key = `${b}${d}`, s = sessOf(key); if (!s) return "";
      const c = Object.assign({}, pc, { day: d, time: t });
      const n = sessCount(s, c), mus = sessMuscles(s), ed = !custom && PM.edited(key), est = estMinutes(s, c, key);
      const sub = n ? dl([`${n}&nbsp;${plural(n, "упражнение", "упражнения", "упражнений")}`, `≈&nbsp;${est}&nbsp;мин`]) : `<span class="sc-empty">${icon("plus", 14)}Пусто — добавь упражнения</span>`;
      // чередование: когда тренировка по очереди — «эта неделя» / «следующая неделя» / «через 2 недели»; цикл нагрузки — тег «цикл»
      const k = rotQ ? weeksTo(d, qi) : -1, when = k < 0 ? "" : k === 0 ? "эта неделя" : k === 1 ? "следующая неделя" : `через ${numW(k, "неделю", "недели", "недель")}`;
      const hasCyc = custom && PM.strengthIdx(s.groups).some((gi) => s.groups[gi].items.some((it) => Array.isArray(it.cyc)));
      const tags = `${when ? `<span class="tag${k === 0 ? " now" : ""}">${esc(when)}</span>` : ""}<span class="tag">${icon("calendar", 14)}${dayWd(d)}</span>${hasCyc ? `<span class="tag">${icon("trending-up", 14)}цикл</span>` : ""}${optional(d) ? `<span class="tag">по желанию</span>` : ""}${ed ? `<span class="tag mine">${icon("pencil", 14)}изменена</span>` : ""}`;
      // пустая тренировка своей программы — сразу кнопка первого шага
      const add = "";
      return `<div class="sess-w"><button class="sess-card" data-pd="${d}" aria-label="Тренировка ${d}: ${esc(s.title)}${ed ? ", изменена" : ""}${n ? "" : ", пусто"}">${dayTile(d)}
        <span class="sc-main"><b class="sc-t">${esc(s.title)}</b><span class="sc-sub">${sub}</span><span class="tags sc-tags">${tags}</span>${mus.length ? `<span class="sc-mus">${dl(mus.map(esc))}</span>` : ""}</span>${icon("chevron-right", 20)}</button>${add}</div>`;
    }).join("");
    const nd = days().length;
    const addDay = custom ? (nd < PG.MAX_DAYS ? `<button class="btn wide sess-add" data-dayadd="1">${icon("plus", 20)}Добавить тренировку</button>` : `<p class="small muted sess-max">${icon("info", 16, "inl")} Это максимум — ${PG.MAX_DAYS} тренировок${rotQ ? " в программе" : " в неделю"}.</p>`) : "";
    const wds = plannedDays().map((x) => WD_SHORT[x]).join("\u00a0· ") || "дни не выбраны";
    const manage = [["sched", custom ? "Расписание и недели" : "Расписание и цикл", custom ? `${wds} — неделя ${posOfIdx(ctx.cyc.idx).n}` : `${wds} — неделя ${posOfIdx(ctx.cyc.idx).week}\u00a0из\u00a0${P.meta.blockWeeks}`, "calendar", "rl-blue", "pv"],
      ["about", "О программе", custom ? "Описание и объём по мышцам" : "Цели блоков, объём по мышцам, как это устроено", "book-open", "rl-violet", "pv"]];
    return `${progHero(ctx)}
      ${planUndoBanner()}
      <h2 class="sec-h">${icon("dumbbell", 18)}<span>Тренировки</span></h2>
      ${blockSeg("pb-seg", ctx.block, b, true)}
      <div class="sess-list">${cards}</div>
      ${addDay}
      <h2 class="sec-h">${icon("settings", 18)}<span>Управление</span></h2>
      <nav class="menu" aria-label="Управление программой">${manage.map(rowLink).join("")}</nav>`;
  }
  /* --- все программы --- */
  /** Место программы в цикле — неделя цикла (как в «Расписании»): у встроенной — cycle, у своих — progPos[id].
      Начата — если есть записи журнала этой программы или у места есть since. */
  function placeOf(id) {
    const rec = id === PG.MAIN ? null : progsAll()[id], k = PG.kind(rec);
    const saved = id === BOUND ? cycleState() : id === PG.MAIN ? PG.cleanPos(S.get("cycle", null)) : posAll()[id];
    const p = PG.posOf(k === "custom" ? "custom" : "up", saved ? +saved.idx || 0 : 0, BUILTIN.meta, BUILTIN.blocks.length);
    const logged = Object.keys(state.logs).some((key) => PG.parseLogKey(key).prog === id && entryHasData(state.logs[key]));
    return { p, started: logged || !!(saved && (saved.since || saved.idx > 0)), txt: k === "custom" ? `неделя\u00a0${p.n}` : `блок\u00a0${p.block}, неделя\u00a0${p.week}` };
  }
  /** Одна строка места — одинаково во всех местах: «сейчас: …» / «остановился: …» / «ещё не начата». */
  const placeLine = (id) => { const pl = placeOf(id); return pl.started ? `${id === BOUND ? "сейчас" : "остановился"}: ${pl.txt}` : "ещё не начата"; };
  const progName = (id) => (id === PG.MAIN ? BUILTIN.meta.name || "Апгрейд" : (progsAll()[id] || {}).name || "Программа");
  /** Иконка программы — одна и та же везде: встроенная, копия и своя различаются. */
  const progIcon = (id) => { const r = id === PG.MAIN ? null : progsAll()[id]; return !r ? "layers" : r.base === "upgrade" ? "copy" : "dumbbell"; };
  /** Название без повторов: «Моя программа 2», «Апгрейд (копия 2)». */
  function uniqName(name) {
    const taken = new Set([BUILTIN.meta.name || "Апгрейд"].concat(Object.values(progsAll()).map((r) => r.name)));
    const base = PG.cleanName(name) || "Моя программа";
    if (!taken.has(base)) return base;
    const m = /^(.*) \(копия(?: (\d+))?\)$/.exec(base);
    for (let i = 2; i < 100; i++) {
      const v = m ? `${m[1]} (копия ${i})` : `${base.slice(0, PG.NAME_MAX - 3)} ${i}`;
      if (!taken.has(v) && v.length <= PG.NAME_MAX) return v;
    }
    return base;
  }
  /** Неразрывный пробел перед тире: строка не начинается с «—». */
  const nbd = (s) => esc(s).replace(/ — /g, "&nbsp;— ");
  /** Программы для списка: текущая первой, затем встроенная, свои — по дате создания (восстановленная после отмены — на прежнем месте). */
  function progList() {
    const all = progsAll();
    const own = Object.keys(all).sort((a, b) => String(all[a].created || all[a].at || "").localeCompare(String(all[b].created || all[b].at || "")) || a.localeCompare(b));
    return [BOUND].concat([PG.MAIN].concat(own).filter((id) => id !== BOUND));
  }
  function planProgs() {
    const ids = progList(), full = PG.count(progsAll()) >= PG.MAX;
    const card = (id) => {
      const rec = id === PG.MAIN ? null : progsAll()[id], cur = id === BOUND;
      const kindTxt = id === PG.MAIN ? "встроенная" : rec.base === "upgrade" ? "копия «Апгрейда»" : "";
      const sub = dl(progParts(rec).concat(kindTxt ? [kindTxt] : []));
      const menu = `<button class="icon-btn" data-pitem="${esc(id)}" aria-label="Действия: «${esc(progName(id))}»">${icon("more-vertical", 22)}</button>`;
      const right = cur ? `<span class="tag now pg-now">${icon("check", 14)}Текущая</span>${menu}` : `<button class="btn tonal pg-go" data-pswitch="${esc(id)}" aria-label="Перейти на «${esc(progName(id))}»">Перейти</button>${menu}`;
      return `<section class="card pg-card${cur ? " cur" : ""}" data-prog="${esc(id)}">
        <div class="pg-top"><span class="ph-ic" aria-hidden="true">${icon(progIcon(id), 22)}</span><b class="pg-n">${nbd(progName(id))}</b><span class="pg-r">${right}</span><span class="pg-t"><small>${sub}</small><small class="pg-where">${nbn(placeLine(id))}</small></span></div>
        ${rec && rec.note ? `<p class="small muted pg-note">${nbd(rec.note)}</p>` : ""}</section>`;
    };
    return `<button class="btn primary wide pg-new" data-pnew="1" ${full ? "disabled" : ""}>${icon("plus", 20)}Новая программа</button>
      ${full ? `<p class="small muted">Это максимум — ${numW(PG.MAX, "своя программа", "своих программы", "своих программ")}. Удали лишнюю, чтобы создать новую.</p>` : ""}
      <div class="pg-list">${ids.map(card).join("")}</div>
      ${ids.length === 1 ? emptyHTML("sparkles", "Своих программ пока нет", "Создай с нуля, из шаблона или копией «Апгрейда». Переход между программами не теряет место в цикле.") : `<p class="small muted pg-foot">Редактируется текущая программа. Чтобы править другую — перейди на неё: место в цикле каждой программы запоминается.</p>`}`;
  }
  /* --- экран тренировки (конструктор) --- */
  /* Карточка упражнения: плитка, номер и название (тап — шторка упражнения), «⋮» — то же меню;
     подписанные значения с карандашом — встроенный редактор прямо под карточкой. У одиночного — строка отдыха. */
  /** «4 × 8 · 70 %» — шаг цикла коротко. */
  const stepTxt = (x) => `${x.sets} × ${x.reps}${x.pct != null ? ` · ${fmtW(x.pct)} %` : ""}`;
  /** Может ли у пункта быть цикл нагрузки: своя программа, обычный пункт (не тяжёлая/лёгкая и не чередование упражнений). */
  const cycOk = (it) => isCustom() && !!it && !it.hl && !it.weekAlt;
  function prowHTML(key, it, gi, ii, code, single) {
    const vs = PM.variants(it), first = EX[vs[0].ex] || {};
    const title = it.weekAlt ? vs.map((v) => exName(v.ex)).join(" / ") : exName(vs[0].ex);
    // цикл нагрузки: ячейки текущего шага, тег «шаг 2 из 4» и все шаги мелко (текущий выделен)
    const cs = cycOk(it) ? cycStep(it, { day: key[1], plan: true }) : null;
    const lines = cs ? `<span class="pr-s"><span class="pcs">${schemeCells(cs.st)}</span><span class="tags pr-cy"><span class="tag now">${icon("trending-up", 14)}шаг ${cs.i + 1} из ${cs.n}</span></span><span class="pr-steps">${it.cyc.map((x, i) => (i === cs.i ? `<b>${esc(stepTxt(x))}</b>` : esc(stepTxt(x)))).join(" → ")}</span></span>`
      : vs.map((v) => `<span class="pr-s">${vs.length > 1 ? `<span class="pr-v">${esc(v.label)}</span>` : ""}<span class="pcs">${schemeCells(v.p)}</span></span>`).join("");
    const stags = schemeTags(vs[0].p, first);
    const notes = vs.map((v) => v.p.note).filter(Boolean);
    const tags = [], marks = !isCustom(); // у своей программы нет исходной версии — всё «добавлено», метки не нужны
    if (marks && vs.some((v) => PM.exHolder(it, v.key).orig)) tags.push(`<span class="tag mine">ваша замена</span>`);
    if (marks && it.add) tags.push(`<span class="tag mine">добавлено</span>`);
    else if (marks && it.chg) tags.push(`<span class="tag mine">изменено</span>`);
    if (vs.some((v) => adjFor(v.ex, key))) tags.push(`<span class="tag adj">корректировка агента</span>`);
    if (vs.some((v) => !EX[v.ex])) tags.push(`<span class="tag warn">${icon("alert-triangle", 14)}нет в этой версии — замени или убери</span>`);
    const fl = state.flash === `${gi}:${ii}` ? " flash" : "";
    const q = state.qe, open = !!(q && q.key === key && q.gi === gi && q.ii === ii);
    const rest = single ? `<button class="pr-rest" data-pg="${gi}" aria-label="Отдых ${esc(single.rest || "не задан")}${single.tier !== "core" ? `, ${esc(TIER[single.tier] || "")}` : ""}: изменить отдых, режим времени, место">${icon("timer", 16)}<span>отдых ${single.rest ? nb(single.rest) : "—"}</span>${tierTag(single.tier)}${icon("chevron-right", 18)}</button>` : "";
    return `<div class="prow${fl}${open ? " qe-on" : ""}">
      <div class="pr-top"><button class="pr-open" data-pi="${gi}:${ii}" aria-label="${esc(code)} ${esc(title)}: заменить, темп, место, убрать">${tileHTML(exGroup(vs[0].ex))}<span class="pr-main"><span class="pr-n"><span class="code">${codeHTML(code)}</span> ${esc(title)}</span>${tags.length ? `<span class="tags">${tags.join("")}</span>` : ""}</span></button>
        <button class="icon-btn pr-more" data-pi="${gi}:${ii}" aria-label="Действия: ${esc(title)}">${icon("more-vertical", 20)}</button></div>
      <button class="pr-q" ${cs ? `data-cycopen="${gi}:${ii}" aria-haspopup="dialog" aria-label="${esc(code)}: цикл нагрузки, шаг ${cs.i + 1} из ${cs.n} — изменить"` : `data-qopen="${gi}:${ii}" aria-expanded="${open}" aria-label="${esc(code)}: подходы, повторы и запас — изменить здесь"`}><span class="pr-qs">${lines}${stags ? `<span class="tags pr-st">${stags}</span>` : ""}</span><span class="pr-ed" aria-hidden="true">${icon(open && !cs ? "x" : "pencil", 18)}</span></button>
      ${notes.length ? `<p class="pr-note pr-note-out">${nbn(notes[0])}</p>` : ""}
      ${rest}
      ${open ? qeRowHTML(key, it, gi, ii) : ""}</div>`;
  }
  /** Быстрый редактор держится за упражнение, а не за номер строки: после любого изменения плана не из него
      (синхронизация, импорт, сброс, отмена, шторка) он закрывается, а не правит то, что оказалось на этом месте. */
  function qeResolve(key) {
    const q = state.qe;
    if (!q) return;
    if (q.key !== key || PM.rev() !== q.rev) { state.qe = null; return; }
    const it = PM.item(q.key, q.gi, q.ii);
    if (!it || PM.exIds(it).join("/") !== q.ident) state.qe = null;
  }
  function qeOpen(key, gi, ii, v) {
    const it = PM.item(key, gi, ii); if (!it) { state.qe = null; return; }
    state.qe = { key, gi, ii, v: v || "", ident: PM.exIds(it).join("/"), saved: JSON.parse(JSON.stringify(it)), rev: PM.rev(), changed: false };
  }
  /** Открыть встроенный редактор упражнения и показать его целиком (из карточки или из шторки). */
  function qeShow(gi, ii, v) {
    qeOpen(planKey(), gi, ii, v); render(); focusSel(`.pr-q[data-qopen="${gi}:${ii}"]`);
    revealQe();
  }
  /** Открытый редактор — целиком между шапкой и липкой панелью (если не влезает — верх карточки под шапкой). */
  function revealQe() {
    const row = state.qe && document.querySelector(".prow.qe-on"); if (!row) return;
    const top = (document.querySelector(".top") || { offsetHeight: 0 }).offsetHeight + 8;
    const bar = document.querySelector(".plan-acts"), nav = document.querySelector(".nav");
    const bottom = Math.min(bar ? bar.getBoundingClientRect().top : innerHeight, nav ? nav.getBoundingClientRect().top : innerHeight) - 8;
    const r = row.getBoundingClientRect();
    let dy = r.bottom > bottom ? r.bottom - bottom : 0;
    if (r.top - dy < top) dy = r.top - top;
    if (r.top < top && dy >= 0) dy = Math.min(dy, r.top - top);
    if (dy) window.scrollBy({ top: dy, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  function qeRowHTML(key, it, gi, ii) {
    const q = state.qe, vs = PM.variants(it), v = vs.find((x) => x.key === q.v) || vs[0], ex = EX[v.ex] || {};
    const varSeg = vs.length > 1 ? `<div class="seg qe-var" role="tablist" aria-label="Вариант">${vs.map((x) => `<button data-qv="${x.key}" class="${x.key === v.key ? "on" : ""}" role="tab" aria-selected="${x.key === v.key}">${esc(x.label)}${it.weekAlt ? `<small>${esc(exName(x.ex))}</small>` : ""}</button>`).join("")}</div>` : "";
    const adj = adjFor(v.ex, key);
    return `<div class="qe-box" data-qk="${gi}:${ii}:${v.key}">${varSeg}
      ${adj ? `<p class="small qe-adj">Действует корректировка агента «${esc(adj.title)}» — на тренировке она главнее.</p>` : ""}
      ${qeHTML(v.p, { attr: "qe", act: { sets: "sets", reps: "reps", rir: "rir" }, sec: ex.unit === "sec", tid: "qeReps", tfield: 'data-qf="reps"', presets: true })}
      ${v.p.myo ? `<p class="small muted">Майо-подход: 12–20 до отказа, затем мини-подходы по 3–5 через 15&nbsp;с.</p>` : ""}
      ${cycOk(it) && !v.p.myo ? `<button class="btn sh-row qe-cyc" data-cycopen="${gi}:${ii}" aria-haspopup="dialog">${icon("trending-up", 22)}<span>Цикл нагрузки<small>менять подходы и вес от раза к разу</small></span>${icon("chevron-right", 20)}</button>` : ""}
      <div class="qe-foot"><button class="lnk" data-pi="${gi}:${ii}">Настройки${icon("chevron-right", 18)}</button><span class="row-btns"><button class="btn ghost" data-qundo="1" ${q.changed ? "" : "disabled"}>${icon("undo", 18)}Отменить</button><button class="btn tonal" data-qopen="${gi}:${ii}">${icon("check", 18)}Готово</button></span></div></div>`;
  }
  /** Правка из быстрого редактора — сразу в программу. Отмена — кнопкой в редакторе, только этого упражнения. */
  function qeSet(a, v) {
    const q = state.qe; if (!q || q.key !== planKey()) return false;
    qeResolve(q.key); if (!state.qe) { render(); return false; }
    const it = PM.item(q.key, q.gi, q.ii), vs = PM.variants(it), vk = (vs.find((x) => x.key === q.v) || vs[0]).key, p = PM.paramHolder(it, vk);
    PM.setParams(q.key, q.gi, q.ii, vk, a === "sets" ? { sets: (p.sets || 1) + +v } : { [a]: v });
    q.rev = PM.rev(); q.changed = true;
    return true;
  }
  function qeApply(a, v, t) {
    if (!qeSet(a, v)) return;
    render();
    if (t && t.tagName === "BUTTON") refocusQe(t, ".qe-box");
  }
  function qeUndo() {
    const q = state.qe; if (!q) return;
    qeResolve(q.key); if (!state.qe) { render(); return; }
    PM.putItem(q.key, q.gi, q.ii, q.saved);
    q.rev = PM.rev(); q.changed = false;
    render(); focusSel(`.qe-box [data-qopen]`);
  }
  /** Суперсет — общая шапка «Суперсет · отдых 90 с» и цветная линия слева; одиночное упражнение — одна карточка. */
  function pgroupHTML(key, s, g, gi, N) {
    const multi = g.items.length > 1;
    const rows = g.items.map((it, ii) => prowHTML(key, it, gi, ii, codeOf(s.groups, N, gi, ii), multi ? null : g)).join("");
    if (!multi) return `<section class="pgroup single">${rows}</section>`;
    return `<section class="pgroup multi">
      <button class="pg-h" data-pg="${gi}" aria-label="Суперсет ${N[gi]}: ${esc(kindLabel(g))}${g.rest ? `, отдых ${esc(g.rest)}` : ""} — изменить отдых, режим времени, порядок"><span class="gl">${icon("link", 18)}</span><span class="gt">${dl([`<b>${esc(kindLabel(g))}</b>`, g.rest ? `отдых&nbsp;${nb(g.rest)}` : ""])}</span>${tierTag(g.tier)}${icon("chevron-right", 18)}</button>
      ${rows}</section>`;
  }
  const FIXED = { warmup: ["flame", "Разминка", "warn"], sprint: ["zap", "Финиш: спринты", "warn"], n4x4: ["activity", "Мотор: интервалы", "cardio"], z2: ["heart-pulse", "Кардио: зона 2", "cardio"], skill: ["target", "Навык блока", "info"] };
  /** Разминка и финиш — компактная свёрнутая строка; раскрыть — что именно делать. */
  function pfixedHTML(g, pctx, sessKey) {
    const [ic, name, tone] = FIXED[g.kind] || ["dumbbell", g.kind, ""];
    const min = Math.round(groupMinutes(g, pctx, sessKey));
    let body = "";
    if (g.kind === "warmup") body = g.items.map((it) => it.skill ? skillCard(pctx.block, pctx.week) : it.text ? `<p class="small">${nbn(it.text)}</p>` : EX[it.ex] ? `<p class="small"><b>${esc(EX[it.ex].n)}</b>: ${nbn(it.dose || "")}</p>` : "").join("");
    else if (g.kind === "sprint") body = sprintProto(pctx);
    else if (g.kind === "n4x4") body = n4Proto(pctx);
    else if (g.kind === "z2") body = z2Proto();
    else if (g.kind === "skill") body = skillCard(pctx.block, pctx.week, "Практика");
    return `<details class="pfixed t-${tone}"><summary><span class="gl soft" aria-hidden="true">${icon(ic, 20)}</span><span class="gt">${dl([`<b>${name}</b>`, min ? `${min}&nbsp;мин` : ""])}${g.tier !== "core" && TIER[g.tier] ? `<span class="pf-tier">${tierTag(g.tier)}</span>` : ""}</span>${icon("chevron-down", 18)}</summary><div class="pf-b">${body}</div></details>`;
  }
  function reorderHTML(key, s, N) {
    const si = PM.strengthIdx(s.groups), rows = [];
    si.forEach((gi, pos) => {
      const g = s.groups[gi], what = g.items.length > 1 ? "Суперсет" : "Упражнение";
      rows.push(`<div class="ro-g" data-gi="${gi}"><span class="gl">${N[gi]}</span><span class="gt">${esc(kindLabel(g))}</span>
        <button class="ro-b" data-rog="${gi}:-1" aria-label="${what} ${N[gi]} выше" ${pos === 0 ? "disabled" : ""}>${icon("chevron-up", 22)}</button><button class="ro-b" data-rog="${gi}:1" aria-label="${what} ${N[gi]} ниже" ${pos === si.length - 1 ? "disabled" : ""}>${icon("chevron-down", 22)}</button></div>`);
      g.items.forEach((it, ii) => {
        const nm = PM.exIds(it).map(exName).join(" / ");
        const top = pos === 0 && ii === 0, bottom = pos === si.length - 1 && ii === g.items.length - 1;
        rows.push(`<div class="ro-i${state.flash === `${gi}:${ii}` ? " flash" : ""}" data-gi="${gi}" data-ii="${ii}"><span class="drag-h" title="Перетащить" aria-hidden="true">${icon("grip-vertical", 20)}</span><span class="code">${codeHTML(codeOf(s.groups, N, gi, ii))}</span><span class="ro-n">${esc(nm)}</span>
          <button class="ro-b" data-roi="${gi}:${ii}:-1" aria-label="${esc(nm)} выше" ${top ? "disabled" : ""}>${icon("chevron-up", 22)}</button><button class="ro-b" data-roi="${gi}:${ii}:1" aria-label="${esc(nm)} ниже" ${bottom ? "disabled" : ""}>${icon("chevron-down", 22)}</button></div>`);
      });
    });
    return `<div class="ro-head"><div><b>Порядок упражнений</b><div class="small muted">Перетащи за ручку слева или нажимай стрелки. Через границу суперсета упражнение переходит в соседний.</div></div><button class="btn primary" data-preorder="0">${icon("check", 18)}Готово</button></div>
      <div class="ro-list" id="roList" data-key="${key}">${rows.join("")}</div>`;
  }
  function endReorder() {
    state.reorder = false; state.flash = null; render();
    const snap = state.reorderSnap; state.reorderSnap = null;
    if (snap && snap !== PM.snapshot()) { const rev = PM.rev(); toast("Порядок изменён", () => restorePlan(snap, rev)); }
    focusSel("[data-preorder='1']");
    if (!layered()) dropGuard();
  }
  function planSess(ctx) {
    const b = state.pb, d = state.pd, key = planKey(), s = sessOf(key);
    qeResolve(key);
    const N = groupNums(s.groups), pctx = planCtx(b, d, ctx), t = TIMES.includes(+state.time) ? +state.time : 90;
    const mins = {}; TIMES.forEach((x) => { mins[x] = estMinutes(s, Object.assign({}, pctx, { time: x }), key); });
    const nStr = PM.strengthIdx(s.groups).length;
    const info = isCustom() ? null : PM.forkInfo(key);
    const timed = s.groups.some((g) => g.tier === "std" || g.tier === "max");
    // название — один раз, в шапке (с карандашом); под шапкой — одна строка: плитка, время, «Подробнее»; ниже — блоки
    const head = `<section class="psess-h">
        <div class="ps-row">${dayTile(d, "sm")}<span class="ps-time">${nStr ? dl([timed ? `≈&nbsp;${mins[t]}&nbsp;мин при&nbsp;${t}&nbsp;минутах` : `≈&nbsp;${mins[t]}&nbsp;мин`, optional(d) ? "по&nbsp;желанию" : ""]) : dl([`тренировка&nbsp;${d}`, optional(d) ? "по&nbsp;желанию" : ""])}</span>
          ${nStr ? `<button class="lnk ps-more" data-psmore="1" aria-expanded="${!!state.psMore}" aria-controls="psMore">Подробнее${icon(state.psMore ? "chevron-up" : "chevron-down", 18)}</button>` : ""}</div>
        <div class="ps-more-b" id="psMore"${state.psMore && nStr ? "" : " hidden"}>
          <p class="small">${timed ? `По режимам времени: 60&nbsp;мин — ≈&nbsp;${mins[60]}, 90 — ≈&nbsp;${mins[90]}, 120 — ≈&nbsp;${mins[120]}. В 60 минут остаются только упражнения «всегда»; режим выбираешь на «Сегодня».` : "Все упражнения — «всегда». Сделай у суперсета или упражнения «от 90 мин» — и на «Сегодня» появится выбор времени: 60, 90 или 120 минут."}</p>
          <p class="small"><b>Запас</b> — сколько повторов осталось в запасе в конце подхода: «запас&nbsp;2» — мог бы сделать ещё два.</p>
          ${s.note ? `<p class="small">${esc(s.note)}</p>` : ""}
          ${info ? `<p class="small">Это твоя версия тренировки${info.ver && info.ver !== P.meta.version ? `; программа с тех пор обновилась до v${esc(P.meta.version)}` : ""}. Вернуть исходную — меню ${icon("more-vertical", 14, "inl")} вверху.</p>` : ""}</div>
        ${s.note ? `<p class="small muted psess-note">${esc(s.note)}</p>` : ""}
        ${blockSeg("ps-blk", ctx.block, b, false, d)}
      </section>`;
    if (state.reorder) return head + reorderHTML(key, s, N);
    const list = s.groups.map((g, gi) => (isStrength(g) ? pgroupHTML(key, s, g, gi, N) : pfixedHTML(g, pctx, key))).join("");
    const empty = nStr ? "" : `<section class="card pempty">${emptyHTML("dumbbell", "Упражнений пока нет", "Собери тренировку с нуля: добавь первое упражнение, а дальше — «Добавить и выбрать ещё».", `<button class="btn primary wide" data-padd="1">${icon("plus", 20)}Добавить упражнение</button>`)}</section>`;
    return `${head}
      ${planUndoBanner()}
      ${empty}
      ${list}
      ${nStr ? `<p class="small muted plan-hint">Правки сразу видны на «Сегодня».</p>
      <div class="plan-acts${state.qe ? " qe-open" : ""}"><button class="btn primary" data-padd="1">${icon("plus", 20)}Добавить упражнение</button><button class="btn" data-preorder="1">${icon("arrow-up-down", 18)}Порядок</button></div>` : ""}`;
  }
  /* --- расписание и цикл: сначала дни, затем цикл --- */
  /** «Тренировок в неделю» (своя программа): сегмент 1 … n и при чередовании — таблица круга. */
  function rotCard(ctx) {
    const rec = curRec(), D = days(), n = D.length, rot = rotNow(), pw = rot ? rot.pw : n;
    if (n < 2) return "";
    const seg = `<div class="seg pw-seg" role="radiogroup" aria-label="Тренировок в неделю">${D.map((_, i) => { const v = i + 1, on = v === pw; return `<button data-pw="${v}" class="${on ? "on" : ""}" role="radio" aria-checked="${on}" aria-label="${v} в неделю${v === n ? " — все каждую неделю" : " — по очереди"}">${v}</button>`; }).join("")}</div>`;
    let body = `<p class="small muted pw-note">Все ${n} каждую неделю. Выбери меньше — тренировки пойдут по очереди, например ${esc(rotPhrase(n, Math.min(2, n - 1)))}</p>`;
    if (rot) {
      // от недели, которую показывает «Сегодня», вперёд: не больше 4 строк, плитки и названия в одну строку
      const R = PG.roundWeeks(rec), qi = qIdx(), rows = [];
      for (let k = 0; k < Math.min(R, 4); k++) {
        const w = qi + k, q = weekDays(w);
        rows.push(`<li class="rt-row${k ? "" : " cur"}"><span class="rt-w">Неделя&nbsp;${w + 1}${k ? "" : `<small>сейчас</small>`}</span><span class="rt-d">${q.map((d) => `<span class="rt-x">${dayTile(d, "sm")}<span>${esc(sessOf(`1${d}`).title)}</span></span>`).join("")}</span></li>`);
      }
      body = `<p class="small muted pw-note">По очереди: ${pw} из ${n} в неделю.</p><ol class="rt" aria-label="Очередь тренировок по неделям">${rows.join("")}</ol>${R > 4 ? `<p class="small muted">…и снова по кругу.</p>` : ""}
        <p class="small muted">Круг — ${numW(R, "неделя", "недели", "недель")}, потом снова ${weekDays(qi)[0]}.</p>`;
    }
    return `<section class="card rot-card"><h3>${icon("repeat", 20)}Тренировок в неделю</h3>${seg}${body}</section>`;
  }
  /** Что получится при чередовании: «A и B на первой неделе, C и D — на второй, потом снова по кругу». */
  function rotPhrase(n, pw) {
    if (pw >= n) return `все тренировки каждую неделю.`;
    const D = PG.LETTERS.slice(0, n).split(""), R = n / gcd(n, pw), ORD = ["первой", "второй", "третьей", "четвёртой", "пятой", "шестой"];
    const wk = (i) => andList(Array.from({ length: pw }, (_, j) => D[(i * pw + j) % n]));
    const shown = Math.min(R, 3), parts = Array.from({ length: shown }, (_, i) => `${wk(i)}${i ? " —" : ""} на ${ORD[i]}`);
    return `${parts.join(", ")} неделе${R > shown ? ", и так далее" : ""}, потом снова по кругу.`;
  }
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  function planSched(ctx) {
    return `${undoBanner()}
      ${isCustom() ? rotCard(ctx) : ""}
      <section class="card">
        <h3>${icon("calendar", 20)}Дни тренировок</h3>
        <div class="week-grid" role="group" aria-label="Дни тренировок">${weekGrid()}</div>
        <p class="small muted" id="wdayMsg" role="status">${esc(weekGridNote())}</p>
      </section>
      ${cycleCard(ctx)}
      <details class="card acc"><summary><h3>Если пропустил</h3></summary><div class="acc-b"><p class="small">Следующая тренировка предложится в любой другой день — программа ждёт на той же неделе. ${isCustom() ? "Обязательны все тренировки, в которых есть упражнения." : `Тренировки ${days().filter((x) => !optional(x)).join(" и ")} обязательны${days().some(optional) ? `, ${days().filter(optional).join(", ")} — по желанию` : ""}.`}</p></div></details>`;
  }
  /* --- о программе --- */
  function planAbout(ctx) {
    if (!state.volBlock || !blocks().some((b) => b.id === state.volBlock)) state.volBlock = ctx.block;
    const opt = days().filter(optional), multi = multiBlock();
    const vol = `<h2 class="sec-h">${icon("bar-chart", 18)}<span>Объём по мышцам</span></h2>
      <section class="card">
        ${multi || opt.length ? `<div class="vol-ctl">${multi ? `<div class="seg" role="group" aria-label="Блок">${blocks().map((b) => `<button data-volblock="${b.id}" class="${state.volBlock === b.id ? "on" : ""}" aria-pressed="${state.volBlock === b.id}">Блок&nbsp;${b.id}</button>`).join("")}</div>` : ""}
          ${opt.length ? `<label class="chk"><input type="checkbox" data-volsat="1" ${state.volSat ? "checked" : ""}> с ${opt.map((x) => `тренировкой ${x}`).join(" и ")}</label>` : ""}</div>` : ""}
        ${volumeChart(state.volBlock, state.volSat || !opt.length)}
        <p class="small muted" style="margin-top:8px">Рабочие подходы ${isCustom() && rotNow() ? "в среднем за неделю круга (тренировки идут по очереди)" : "в неделю"}${days().some((d) => (sessOf(`${state.volBlock}${d}`) || { groups: [] }).groups.some((g) => g.tier === "std" || g.tier === "max")) ? " в режиме 90 минут" : ""}, с учётом твоих правок. Косвенная работа (например, бицепс в подтягиваниях) считается за половину подхода — такой счёт точнее всего предсказывает рост. <span class="src-l">Источник: ${rich("{pelland26}")}</span></p>
      </section>`;
    if (isCustom()) {
      // своя программа: описание и объём; блоков, навыков, целей и «Как это устроено» нет
      const rec = curRec(), n = days().length;
      return `
      <p class="muted about-lead">${n}&nbsp;${plural(n, "тренировка", "тренировки", "тренировок")}${rotNow() ? `, ${rotNow().pw}&nbsp;в&nbsp;неделю по очереди` : " в неделю"}: ${days().map((d) => `${d} — «${esc(sessOf(`1${d}`).title)}»`).join(", ")}. Недели идут подряд, неделя закрывается, когда сделаны ${rotNow() ? "тренировки её очереди" : "все тренировки"} с упражнениями.</p>
      <h2 class="sec-h">${icon("book-open", 18)}<span>Описание</span></h2>
      <section class="card about-note">${rec.note ? `<p>${esc(rec.note)}</p>` : `<p class="muted">Описания пока нет — для чего эта программа, на сколько недель, что важно.</p>`}
        <button class="btn ghost" data-pedit="note">${icon("pencil", 18)}${rec.note ? "Изменить описание" : "Добавить описание"}</button></section>
      ${vol}`;
    }
    const blks = blocks().map((b) => `<details class="card acc blk${b.id === ctx.block ? " cur" : ""}"${b.id === ctx.block ? " open" : ""}>
        <summary><span class="blk-t"><b>Блок ${b.id}: ${esc(b.name)}</b><small>${dl([`недели&nbsp;${esc(b.weeks)}`, b.id === ctx.block ? "сейчас" : ""])}</small></span></summary>
        <div class="acc-b"><p>${esc(b.theme)}</p>
        ${b.skill ? `<p class="small"><b>Навык:</b> ${esc(b.skill.title)} — ${esc(b.skill.goal)}.</p>` : ""}
        ${isMain() && b.targets && b.targets.length ? `<div class="small"><b>Цели блока:</b>${goalsHTML(b.id)}</div>` : ""}</div></details>`).join("");
    const rec = curRec();
    return `
      <p class="muted about-lead">${progParts().join(", ")}. После последней недели — пересмотр по журналу или второй круг с заменами упражнений.</p>
      ${rec ? `<section class="card about-note">${rec.note ? `<p>${esc(rec.note)}</p>` : `<p class="muted">Это копия «Апгрейда»: блоки и недели те же, правки и расписание — свои.</p>`}<button class="btn ghost" data-pedit="note">${icon("pencil", 18)}${rec.note ? "Изменить описание" : "Добавить описание"}</button></section>` : ""}
      <h2 class="sec-h">${icon("flag", 18)}<span>${isMain() ? "Блоки и цели" : "Блоки"}</span></h2>
      ${blks}
      ${vol}
      <details class="card acc"><summary><h3>Как это устроено</h3></summary><div class="acc-b">${rich(P.content.how)}</div></details>
      <details class="card acc"><summary><h3>Нюансы</h3></summary><div class="acc-b">${rich(P.content.progression)}</div></details>`;
  }
  /** Сбросить все правки программы (меню героя и «Настройки»): возвращает функцию отмены. */
  function resetAllEdits() {
    const snap = PM.snapshot(), day = S.get("daySw", null);
    // замены «только сегодня» — только этой программы (у своих ключ «id:буква|…», у встроенной — без префикса)
    const m = Object.assign({}, daySwaps()); Object.keys(m).forEach((k) => { if (isMain() ? !/^p[0-9a-z]{8}:/.test(k) : k.indexOf(BOUND + ":") === 0) delete m[k]; });
    PM.resetAll(); S.set("daySw", day ? { d: day.d, m } : null); if (isMain()) { state.swaps = {}; S.set("swaps", {}); } state.qe = null;
    const rev = PM.rev();
    return () => { if (restorePlan(snap, rev)) { S.set("daySw", day); render(); } };
  }

  /* --- отмена правок плана ---
     Откат к снимку — только если план с тех пор не менялся: иначе пропала бы правка, пришедшая с другого устройства. */
  function restorePlan(snap, rev) {
    if (rev != null && PM.rev() !== rev) { toast("План уже изменился — отменить нельзя"); return false; }
    PM.restore(snap); state.qe = null; planUndo = null;
    render();
    if (SH.open) { SH.top = false; renderSheet(); }
    return true;
  }
  /** Копирование, очистка и сброс тренировки: отменить можно 3 минуты, баннером в «Плане». */
  let planUndo = null;
  function setPlanUndo(snap, label) { planUndo = { snap, label, rev: PM.rev(), at: Date.now() }; return () => undoPlanOp(); }
  function undoPlanOp() { const u = planUndo; if (!u) { toast("Отменять уже нечего"); return; } if (restorePlan(u.snap, u.rev)) toast("Отменено"); }
  function planUndoBanner() {
    const u = planUndo;
    if (!u || Date.now() - u.at > 180000 || PM.rev() !== u.rev) return "";
    return ban("p-undo", esc(u.label), `<button class="btn" data-pundo="1">${icon("undo", 18)}Отменить</button>`, "check-circle");
  }

  /* ---------- шторка: правка упражнений и связок ----------
     Открывается снизу; изменения применяются сразу, а после закрытия их можно отменить одним касанием. */
  const SH = { open: false, kind: null, o: null, stack: [], q: "", fromSel: null, snap: null, changed: false, msg: "", top: true };
  const REPS_PRE = ["5–8", "6–8", "8–10", "8–12", "10–12", "10–15", "12–15", "12–20", "15–20"];
  const SEC_PRE = ["20–30 с", "30–40 с", "30–45 с", "45–60 с"];
  const RIR_PRE = ["0", "0–1", "1", "1–2", "2", "2–3", "3"];
  const REST_PRE = ["30 с", "45 с", "60 с", "60–90 с", "90 с", "2 мин", "2–3 мин", "3 мин"];
  /* --- подходы, повторы и запас одним компактным блоком: строка плана, шторка упражнения, добавление --- */
  /** "10–12" → {a:10, b:12}; "30–40 с" → секунды; свободный текст ("8 на сторону", "до отказа") → null. */
  function parseReps(s, sec) {
    const m = /^\s*(\d{1,3})\s*(?:[–—-]\s*(\d{1,3}))?\s*(с|сек)?\s*$/.exec(String(s == null ? "" : s));
    if (!m) return null;
    const a = +m[1], b = m[2] != null ? +m[2] : a;
    return { a: Math.min(a, b), b: Math.max(a, b), sec: !!m[3] || !!sec };
  }
  const normDash = (v) => String(v).replace(/(\d)\s*[-—–]\s*(\d)/g, "$1–$2");
  const fmtReps = (a, b, sec) => (a === b ? String(a) : `${a}–${b}`) + (sec ? " с" : "");
  /** Повторы после шага границы which ("a" — от, "b" — до) на dir; секунды — шагом 5. */
  function repsNext(r, which, dir) {
    const st = r.sec ? 5 : 1, lo = r.sec ? 5 : 1, hi = r.sec ? 600 : 100;
    const step = (x) => Math.max(lo, Math.min(hi, r.sec && x % st ? (dir > 0 ? Math.ceil(x / st) : Math.floor(x / st)) * st : x + dir * st));
    let a = r.a, b = r.b;
    if (which === "a") { a = step(a); if (a > b) b = a; } else { b = step(b); if (b < a) a = b; }
    return fmtReps(a, b, r.sec);
  }
  const RIR_Q = ["0", "0–1", "1", "1–2", "2", "2–3", "3"];
  /** После перерисовки вернуть фокус на ту же кнопку блока (−/+ или готовый вариант). */
  function refocusQe(t, scope) {
    const qb = t.dataset.qb, v = t.dataset.v;
    const el = document.querySelector(qb ? `${scope} [data-qb="${qb}"]` : `${scope} .qe .chip[data-v="${v == null ? "" : v.replace(/"/g, "")}"]`);
    if (el && !el.disabled) el.focus({ preventScroll: true });
  }
  /** o: attr — data-атрибут кнопок ("sa" в шторке, "qe" в строке плана), act — {sets, reps, rir} имена действий,
      sec — секунды, tid/tfield — id и атрибут текстового поля (если повторы — свободный текст), noRir, presets. */
  function qeHTML(p, o) {
    const A = o.attr, act = o.act, sets = p.sets || 1;
    const btn = (a, v, qb, lab, dis, txt) => `<button data-${A}="${a}" data-v="${esc(v)}" data-qb="${qb}" aria-label="${esc(lab)}" ${dis ? "disabled" : ""}>${txt}</button>`;
    const MI = icon("minus", 20), PL = icon("plus", 20);
    const rows = [`<div class="qe-r"><span class="fl">${p.myo ? "Майо-подходы" : "Подходы"}</span><div class="stepper">${btn(act.sets, -1, "s-", "Меньше подходов", sets <= 1, MI)}<b aria-live="polite">${sets}</b>${btn(act.sets, 1, "s+", "Больше подходов", sets >= 10, PL)}</div></div>`];
    if (!p.myo) {
      const r = parseReps(p.reps, o.sec), sec = r ? r.sec : o.sec, lab = sec ? "Секунды" : "Повторы";
      if (r) {
        const lo = r.sec ? 5 : 1, hi = r.sec ? 600 : 100;
        rows.push(`<div class="qe-r"><span class="fl">${lab}</span><div class="qe-rng" role="group" aria-label="${lab}: от и до">
          <div class="stepper">${btn(act.reps, repsNext(r, "a", -1), "a-", "Нижнюю границу меньше", r.a <= lo, MI)}<b>${r.a}</b>${btn(act.reps, repsNext(r, "a", 1), "a+", "Нижнюю границу больше", r.a >= hi, PL)}</div>
          <span class="qe-dash" aria-hidden="true">–</span>
          <div class="stepper">${btn(act.reps, repsNext(r, "b", -1), "b-", "Верхнюю границу меньше", r.b <= lo, MI)}<b>${r.b}</b>${btn(act.reps, repsNext(r, "b", 1), "b+", "Верхнюю границу больше", r.b >= hi, PL)}</div></div></div>`);
      } else rows.push(`<div class="qe-r"><label class="fl" for="${o.tid}">${lab}</label><input id="${o.tid}" class="inp qe-txt" ${o.tfield} value="${esc(p.reps || "")}" maxlength="20" autocomplete="off" enterkeyhint="done"></div>`);
      if (o.presets) rows.push(`<div class="chips qe-pre" role="group" aria-label="Готовые диапазоны">${(sec ? SEC_PRE : REPS_PRE).map((x) => `<button class="chip ${normDash(p.reps || "") === x ? "on" : ""}" data-${A}="${act.reps}" data-v="${x}">${x}</button>`).join("")}</div>`);
      if (!o.noRir) {
        const cur = p.rir == null ? "" : String(p.rir);
        const vals = [""].concat(RIR_Q, cur && !RIR_Q.includes(cur) ? [cur] : []);
        rows.push(`<div class="qe-r"><span class="fl" title="Сколько повторов осталось в запасе в конце подхода">Запас</span><div class="chips qe-rir" role="radiogroup" aria-label="Запас повторов: сколько осталось в конце подхода">${vals.map((x) => `<button class="chip ${cur === x ? "on" : ""}" role="radio" aria-checked="${cur === x}" data-${A}="${act.rir}" data-v="${esc(x)}"${x ? "" : ' aria-label="Без запаса"'}>${esc(x || "—")}</button>`).join("")}</div></div>`);
      }
    }
    return `<div class="qe">${rows.join("")}</div>`;
  }
  function openSheet(kind, o, fromSel) {
    const el = $("#sheet");
    if (!SH.open) Object.assign(SH, { fromSel: fromSel || null, snap: PM.snapshot(), daySnap: S.get("daySw", null), tmSnap: curRec() ? (curRec().tm || null) : undefined, changed: false, msg: "", stack: [], added: 0 });
    if (state.qe) { state.qe = null; render(); }
    hideToast(); // тост не лежит поверх шторки
    Object.assign(SH, { open: true, kind, o: Object.assign({}, o), q: "", top: true });
    el.hidden = false;
    document.body.classList.add("sheet-on");
    pushGuard();
    renderSheet();
    requestAnimationFrame(() => { el.classList.add("open"); const t = (kind === "add" && $("#sheet [data-sq]")) || (kind === "day" && o && o.focus === "title" && $("#shTitle")) || $("#sheetTitle"); if (t) t.focus({ preventScroll: true }); });
  }
  function sheetGo(kind, o) { SH.stack.push({ kind: SH.kind, o: SH.o }); Object.assign(SH, { kind, o: Object.assign({}, o), q: "", top: true }); renderSheet(); }
  function sheetBack() { const p = SH.stack.pop(); if (!p) { closeSheet(); return; } Object.assign(SH, { kind: p.kind, o: p.o, q: "", top: true }); renderSheet(); }
  /** msg === false — закрыть молча; иначе показать сообщение с отменой (по умолчанию — откат к состоянию на момент открытия). */
  function closeSheet(msg, undo) {
    if (!SH.open) return;
    const el = $("#sheet"), snap = SH.snap, daySnap = SH.daySnap, tmSnap = SH.tmSnap, recId = BOUND;
    SH.open = false; el.classList.remove("open"); document.body.classList.remove("sheet-on");
    dropGuard();
    setTimeout(() => { if (!SH.open) { el.hidden = true; $("#sheetBody").innerHTML = ""; } }, 240);
    render();
    const rev = PM.rev();
    // отмена шторки возвращает и максимумы (шторка цикла нагрузки), если они менялись
    const tmBack = () => { const r = recId === BOUND && curRec(); if (r && tmSnap !== undefined && JSON.stringify(r.tm || null) !== JSON.stringify(tmSnap)) { const n = PG.patch(r, {}); if (tmSnap) n.tm = tmSnap; else delete n.tm; saveRec(n); } };
    if (msg !== false && (msg || SH.changed)) toast(msg || SH.msg || "Изменения сохранены", undo || (() => { if (restorePlan(snap, rev)) { S.set("daySw", daySnap); tmBack(); render(); } }));
    const back = SH.fromSel && document.querySelector(SH.fromSel);
    if (back) back.focus({ preventScroll: true });
    state.flash = null;
  }
  function sheetChanged(msg) { SH.changed = true; if (msg) SH.msg = msg; SH.top = false; render(); renderSheet(); }
  function renderSheet() {
    const fn = { item: sheetItem, group: sheetGroup, replace: sheetReplace, swapwith: sheetSwapWith, add: sheetAdd, addplace: sheetAddPlace, day: sheetDay, copy: sheetCopy, prog: sheetProg, account: sheetAccount, eq: sheetEq,
      pedit: sheetPEdit, pswitch: sheetPSwitch, cyc: sheetCyc, tm: sheetTm, pnew: sheetPNew, ptpl: sheetPTpl, pnew2: sheetPNew2, wdpick: sheetWdPick, grpick: sheetGrPick }[SH.kind];
    const out = fn ? fn(SH.o) : null;
    if (!out) { closeSheet(SH.changed ? undefined : false); return; }
    $("#sheetTitle").textContent = out.title;
    $("#sheetBack").hidden = !SH.stack.length;
    const body = $("#sheetBody"), y = body.scrollTop;
    const fx = body.querySelector(".pk-f"), fl = fx ? fx.scrollLeft : 0;
    body.innerHTML = out.html;
    body.scrollTop = SH.top ? 0 : y;
    const f2 = body.querySelector(".pk-f"); if (f2) { f2.scrollLeft = fl; chipIntoView(f2); }
    SH.top = false;
  }
  function sheetItem(o) {
    const s = sessOf(o.key), g = s.groups[o.gi], it = g && g.items && g.items[o.ii];
    if (!it) return null;
    const L = groupNums(s.groups), code = codeOf(s.groups, L, o.gi, o.ii);
    const vs = PM.variants(it), v = vs.find((x) => x.key === o.v) || vs[0];
    const ex = EX[v.ex] || { n: exName(v.ex) }, p = v.p, h = PM.exHolder(it, v.key), sec = ex.unit === "sec";
    if (p.myo) o.myoSeen = true;
    const others = g.items.filter((_, i) => i !== o.ii).map((x) => exName(PM.exIds(x)[0]));
    const where = `${code}: ${slotName(o.key)}${others.length ? `, суперсет с «${others.join("», «")}»` : ""}`;
    const varSeg = vs.length > 1 ? `<div class="seg sh-var" role="tablist" aria-label="Вариант">${vs.map((x) => `<button data-sa="var" data-v="${x.key}" class="${x.key === v.key ? "on" : ""}" role="tab" aria-selected="${x.key === v.key}">${esc(x.label)}${it.weekAlt ? `<small>${esc(exName(x.ex))}</small>` : ""}</button>`).join("")}</div>` : "";
    const adj = adjFor(v.ex, o.key);
    const si = PM.strengthIdx(s.groups), first = si[0] === o.gi && o.ii === 0, last = si[si.length - 1] === o.gi && o.ii === g.items.length - 1;
    // суперсеты называются по партнёрам — и выбранный, и остальные
    const mates = { items: g.items.filter((_, i) => i !== o.ii) };
    const grp = (g.items.length > 1 ? [`<button class="chip" data-sa="togroup" data-v="new">Отдельно</button>`] : [])
      .concat(si.map((x) => x === o.gi ? (g.items.length > 1 ? `<button class="chip on" aria-pressed="true" data-sa="noop">${icon("link", 16)}в суперсете с ${esc(grpWith(mates))}</button>` : "") : `<button class="chip" data-sa="togroup" data-v="${x}">в суперсет с ${esc(grpWith(s.groups[x]))}</button>`)).join("");
    const r = !p.myo && parseReps(p.reps, sec);
    // Сверху — замена; подходы, повторы и запас — встроенным редактором на карточке (кнопка ниже). Остальное — в «Ещё».
    const html = `
      <p class="sh-where">${esc(where)}</p>
      ${varSeg}
      <div class="sh-acts"><button class="btn primary" data-sa="replace">${icon("swap", 20)}Заменить</button>${si.length > 1 || g.items.length > 1 ? `<button class="btn" data-sa="grpick">${icon("link", 18)}В суперсет…</button>` : ""}<button class="btn" data-sa="params">${icon("pencil", 18)}Подходы и повторы</button></div>
      ${h.orig && EX[h.orig] && !isCustom() ? `<button class="btn ghost sh-revert" data-sa="revert" title="Вернуть «${esc(exName(h.orig))}»">${icon("undo", 18)}<span>Вернуть «${esc(exName(h.orig))}»</span></button>` : ""}
      ${adj ? `<p class="sh-adj small"><span>Агент «${esc(adj.title)}»${adj.sets != null ? `: подходов ${esc(adj.sets)}` : ""}${adj.reps ? `, повторы ${esc(adj.reps)}` : ""}${adj.replace_with ? `, замена на «${esc(exName(adj.replace_with))}»` : ""} — на тренировке главнее.</span> <button class="lnk small" data-sa="settings">Корректировки</button></p>` : ""}
      ${p.myo ? `<p class="small muted">Майо-подход: 12–20 повторов до отказа, затем мини-подходы по 3–5 через 15&nbsp;с.</p>` : ""}
      <details class="sh-more" data-shmore="1" ${o.more ? "open" : ""}><summary>Ещё<small>${ex.src === "ds" ? "считать, " : ""}темп, подсказка, место</small>${icon("chevron-down", 20)}</summary>
        ${musclesText(v.ex) ? `<p class="small muted sh-mus">${esc(musclesText(v.ex))}</p>` : ""}
        ${ex.src === "ds" ? `<div class="fld"><span class="fl">Считать</span><div class="seg sh-unit" role="radiogroup" aria-label="Как считать">${[["reps", "Повторы"], ["sec", "Секунды"]].map(([k, n]) => `<button role="radio" aria-checked="${(sec ? "sec" : "reps") === k}" data-sa="unit" data-v="${k}" class="${(sec ? "sec" : "reps") === k ? "on" : ""}">${n}</button>`).join("")}</div></div>` : ""}
        ${!p.myo ? `<div class="fld col"><label class="fl" for="shReps">${sec ? "Время" : "Повторы"} своими словами</label><input id="shReps" class="inp" data-sf="reps" value="${esc(p.reps || "")}" maxlength="20" autocomplete="off" enterkeyhint="done" placeholder="Например: 8 на сторону"></div>` : ""}
        ${o.myoSeen ? `<label class="chk sh-myo"><input type="checkbox" data-sf="myo" ${p.myo ? "checked" : ""}> Майо-повторы</label>` : ""}
        <div class="fld col"><label class="fl" for="shTempo">Темп</label><input id="shTempo" class="inp" data-sf="tempo" value="${esc(p.tempo || "")}" maxlength="40" placeholder="Например: 3 с вниз" autocomplete="off" enterkeyhint="done"></div>
        <div class="fld col"><label class="fl" for="shNote">Подсказка на тренировке</label><input id="shNote" class="inp" data-sf="note" value="${esc(p.note || "")}" maxlength="200" placeholder="Например: пауза 1 с внизу" autocomplete="off" enterkeyhint="done"></div>
        <div class="fl sh-gl">Место в тренировке</div>
        <div class="sh-grid">
          <button class="btn" data-sa="move" data-v="-1" ${first ? "disabled" : ""}>${icon("arrow-up", 18)}Выше</button>
          <button class="btn" data-sa="move" data-v="1" ${last ? "disabled" : ""}>${icon("arrow-down", 18)}Ниже</button>
          <button class="btn" data-sa="swapwith">${icon("arrow-up-down", 18)}Поменять местами</button>
        </div>
        <div class="fl sh-gl">Суперсет</div>
        <div class="chips wrap sh-groups" role="group" aria-label="Суперсет">${grp}</div>
      </details>
      <button class="btn danger wide sh-remove" data-sa="remove">${icon("trash", 18)}Убрать упражнение</button>`;
    return { title: it.weekAlt ? exName(v.ex) : ex.n, html };
  }
  /** «В суперсет…»: с каким упражнением (по партнёрам) или отдельно; после выбора шторка закрывается, тост с «Отменить». */
  function sheetGrPick(o) {
    const s = sessOf(o.key), g = s.groups[o.gi], it = g && g.items && g.items[o.ii];
    if (!it) return null;
    const si = PM.strengthIdx(s.groups), nm = exName(PM.exIds(it)[0]);
    const rows = si.filter((x) => x !== o.gi).map((x) => `<button class="pk" data-sa="grto" data-v="${x}">${tileHTML(exGroup(PM.exIds(s.groups[x].items[0])[0]), 20)}<span class="pk-n">с ${esc(grpWith(s.groups[x]))}<small>${s.groups[x].items.length > 1 ? `суперсет: ${esc(s.groups[x].items.map((y) => exName(PM.exIds(y)[0])).join(", "))}` : "сейчас отдельно"}</small></span></button>`);
    if (g.items.length > 1) rows.unshift(`<button class="pk" data-sa="grto" data-v="new"><span class="ex-tile neutral" aria-hidden="true">${icon("unlink", 20)}</span><span class="pk-n">Отдельно<small>выйти из суперсета с ${esc(grpWith({ items: g.items.filter((_, i) => i !== o.ii) }))}</small></span></button>`);
    return { title: `«${nm}» в суперсет`, html: rows.length ? `<p class="small muted sh-help">Упражнения суперсета делаются по кругу, отдых — после круга.</p><div class="pk-list">${rows.join("")}</div>` : `<p class="small muted">В тренировке одно упражнение — объединять не с чем.</p>` };
  }
  /** «в суперсет с «Жим лёжа»» — суперсет называем по его упражнениям, а не номером. */
  const grpWith = (g) => { const n = g.items.map((it) => exName(PM.exIds(it)[0])); return `«${n[0]}»${n.length > 1 ? ` и ещё ${n.length - 1}` : ""}`; };
  function sheetGroup(o) {
    const s = sessOf(o.key), g = s.groups[o.gi];
    if (!isStrength(g)) return null;
    const L = groupNums(s.groups), si = PM.strengthIdx(s.groups), pos = si.indexOf(o.gi);
    const names = g.items.map((it, ii) => `<li><span class="code">${codeHTML(codeOf(s.groups, L, o.gi, ii))}</span>${esc(PM.exIds(it).map(exName).join(" / "))}</li>`).join("");
    const tiers = [["core", "Всегда", "60 · 90 · 120"], ["std", "От 90 мин", "90 · 120"], ["max", "Только 120", "120 мин"]];
    const html = `
      <ul class="sh-list">${names}</ul>
      <div class="fld col"><span class="fl">Когда делать</span>
        <div class="seg sh-tier" role="radiogroup" aria-label="Когда делать">${tiers.map(([k, n, sub]) => `<button role="radio" aria-checked="${g.tier === k}" data-sa="tier" data-v="${k}" class="${g.tier === k ? "on" : ""}">${n}<small>${sub}</small></button>`).join("")}</div>
        <p class="small muted">Режим времени выбираешь на «Сегодня»: в 60 минут остаётся только «всегда».</p></div>
      <div class="fld col"><label class="fl" for="shRest">${g.items.length > 1 ? "Отдых после круга" : "Отдых между подходами"}</label>
        <input id="shRest" class="inp" data-sf="rest" value="${esc(g.rest || "")}" maxlength="24" autocomplete="off" enterkeyhint="done">
        <div class="chips pre">${REST_PRE.map((x) => `<button class="chip ${g.rest === x ? "on" : ""}" data-sa="rest" data-v="${x}">${x}</button>`).join("")}</div></div>
      ${g.kind === "circuit" ? `<div class="fld"><span class="fl">Кругов</span><div class="stepper"><button data-sa="rounds" data-v="-1" aria-label="Меньше кругов">${icon("minus", 20)}</button><b>${g.rounds || 3}</b><button data-sa="rounds" data-v="1" aria-label="Больше кругов">${icon("plus", 20)}</button></div></div>` : ""}
      <h3 class="sh-h">${icon("arrow-up-down", 18)}Порядок</h3>
      <div class="sh-grid">
        <button class="btn" data-sa="gmove" data-v="-1" ${pos <= 0 ? "disabled" : ""}>${icon("arrow-up", 18)}Выше</button>
        <button class="btn" data-sa="gmove" data-v="1" ${pos >= si.length - 1 ? "disabled" : ""}>${icon("arrow-down", 18)}Ниже</button>
        ${g.items.length > 1 ? `<button class="btn" data-sa="split">${icon("unlink", 18)}Разделить на отдельные упражнения</button>` : ""}
      </div>
      <button class="btn danger wide" data-sa="gremove">${icon("trash", 18)}${g.items.length > 1 ? "Убрать суперсет целиком" : "Убрать упражнение"}</button>`;
    return { title: g.items.length > 1 ? `Суперсет ${L[o.gi]}${g.kind !== "pair" ? ` · ${kindLabel(g).toLowerCase()}` : ""}` : `Упражнение ${L[o.gi]}: отдых и место`, html };
  }
  function sheetSwapWith(o) {
    const s = sessOf(o.key), L = groupNums(s.groups), cur = s.groups[o.gi] && s.groups[o.gi].items[o.ii];
    if (!cur) return null;
    const rows = [];
    s.groups.forEach((g, gi) => {
      if (!isStrength(g)) return;
      g.items.forEach((it, ii) => {
        const me = gi === o.gi && ii === o.ii;
        rows.push(`<button class="pk ${me ? "me" : ""}" data-sa="swapto" data-v="${gi}:${ii}" ${me ? "disabled" : ""}>${tileHTML(exGroup(PM.exIds(it)[0]), 20)}<span class="code">${codeHTML(codeOf(s.groups, L, gi, ii))}</span><span class="pk-n">${esc(PM.exIds(it).map(exName).join(" / "))}${me ? "<small>это упражнение</small>" : ""}</span></button>`);
      });
    });
    return { title: "Поменять местами", html: `<p class="small muted">«${esc(exName(PM.exIds(cur)[0]))}» встанет на место выбранного, а выбранное — на его место. Связки и отдых остаются как были.</p><div class="pk-list">${rows.join("")}</div>` };
  }
  /* --- поиск упражнений для замены и добавления --- */
  function similarIds(id) {
    const e = EX[id]; if (!e) return [];
    const prim = new Set((e.m && e.m.p) || []), out = (e.alts || []).slice();
    Object.keys(EX).forEach((k) => { const x = EX[k]; if (k !== id && x.m && x.m.p.some((m) => prim.has(m)) && !out.includes(k)) out.push(k); });
    return out.filter((k) => k !== id && EX[k] && EX[k].m);
  }
  function progSearch(q) {
    const words = fold(q).split(/\s+/).filter(Boolean).map(stem);
    if (!words.length) return [];
    return Object.keys(EX).filter((id) => EX[id].m).map((id) => {
      const e = EX[id], nm = fold(e.n), hay = `${nm} ${fold(musclesText(id))} ${e.ds ? fold(`${e.ds.n} ${e.ds.nr || ""}`) : ""}`;
      if (!words.every((w) => hay.includes(w))) return null;
      return [nm.startsWith(fold(q)) ? 0 : words.every((w) => nm.includes(w)) ? 1 : 2, id];
    }).filter(Boolean).sort((a, b) => a[0] - b[0] || exName(a[1]).localeCompare(exName(b[1]), "ru")).map((x) => x[1]).slice(0, 8);
  }
  /* --- избранное и недавние: только на этом устройстве (ключи favs и recentEx не синхронизируются) ---
     Ключ упражнения — id программы; запись базы без однозначной привязки к программе — "ds_<id>", как у добавленных из базы. */
  /** Годный ключ избранного: строка разумной длины, известное упражнение (программа, добавленное, запись базы, когда база загружена). */
  const favOk = (k) => typeof k === "string" && k.length <= 40 && /^[\w-]+$/.test(k) && (!!EX[k] || (/^ds_\d{1,6}$/.test(k) && (!LIB.items || !!libById(k.slice(3)))));
  const favs = () => { const v = S.get("favs", []); return Array.isArray(v) ? Array.from(new Set(v.filter(favOk))) : []; };
  const isFav = (k) => favs().includes(k);
  function toggleFav(k) {
    const f = favs(), i = f.indexOf(k);
    if (i >= 0) f.splice(i, 1); else f.unshift(k);
    S.set("favs", f.slice(0, 300));
    return i < 0;
  }
  const libKey = (dsId) => PM.progOf(dsId) || "ds_" + dsId;
  const libById = (dsId) => (LIB.items ? LIB.items.find((x) => x.id === dsId) : null);
  /** Выбранное при добавлении и замене — в начало списка «Недавние» (до 12). */
  function pushRecent(id) {
    if (!id) return;
    const r = (S.get("recentEx", []) || []).filter((x) => x && x.id && x.id !== id);
    r.unshift({ id, at: new Date().toISOString() });
    S.set("recentEx", r.slice(0, 12));
  }
  /** Недавние: выбранные в подборе + сделанные за 4 недели (по журналу), свежие первыми, без повторов. */
  function recentIds() {
    const at = new Map(), today = todayISO(), put = (id, t) => { if (EX[id] && (!at.has(id) || at.get(id) < t)) at.set(id, t); };
    (S.get("recentEx", []) || []).forEach((x) => { if (x && x.id) put(x.id, x.at || ""); });
    Object.keys(state.logs).forEach((k) => {
      const date = k.split("_")[0], e = state.logs[k];
      if (!e || !e.ex || daysBetween(date, today) >= 28) return;
      Object.keys(e.ex).forEach((id) => { if ((e.ex[id] || []).some(performed)) put(id, date); });
    });
    return Array.from(at.keys()).sort((a, b) => (at.get(a) < at.get(b) ? 1 : -1)).slice(0, 12);
  }
  /** Группы мышц, как на вкладке «Упражнения», — для фильтра без набора текста. */
  const BPS = [["upper arms", "Руки"], ["shoulders", "Плечи"], ["chest", "Грудь"], ["back", "Спина"], ["upper legs", "Бёдра"], ["lower legs", "Икры"], ["waist", "Кор"], ["lower arms", "Предплечья"], ["cardio", "Кардио"]];
  const MUSCLE_BP = { chest: "chest", back: "back", biceps: "upper arms", triceps: "upper arms", frontdelts: "shoulders", sidedelts: "shoulders", reardelts: "shoulders", quads: "upper legs", hams: "upper legs", glutes: "upper legs", adductors: "upper legs", calves: "lower legs", core: "waist", forearms: "lower arms" };
  const exBp = (id) => { const e = EX[id]; return e && e.m && e.m.p[0] ? MUSCLE_BP[e.m.p[0]] || null : null; };
  /** Группа мышц для плитки: по главной мышце упражнения программы, у записи базы — по зоне тела. */
  const exGroup = (id) => { const e = EX[id]; if (!e) return null; if (e.m && e.m.p[0] && MUSCLE_GROUP[e.m.p[0]]) return MUSCLE_GROUP[e.m.p[0]]; return e.ds && e.ds.bp ? BP_GROUP[e.ds.bp] || null : null; };
  const starIc = (on) => icon(on ? "star-fill" : "star", 22);
  const favLab = (on) => `${icon(on ? "star-fill" : "star", 18)}${on ? "В избранном" : "В избранное"}`;
  function starBtn(k, name, attr) {
    const on = isFav(k);
    return `<button class="star${on ? " on" : ""}" ${attr}="${attr === "data-sa" ? "fav" : esc(k)}"${attr === "data-sa" ? ` data-v="${esc(k)}"` : ""} aria-pressed="${on}" aria-label="${on ? "Убрать из избранного" : "В избранное"}: ${esc(name)}">${starIc(on)}</button>`;
  }
  /** Контекст подбора: что уже стоит в тренировке, фильтр, недавние. */
  let PK = { inSess: new Set(), recent: [], f: "all" };
  function pkCtx(key, f) {
    const inSess = new Set();
    const s = key && sessOf(key);
    if (s) s.groups.forEach((g) => { if (isStrength(g)) g.items.forEach((it) => PM.exIds(it).forEach((id) => inSess.add(id))); });
    PK = { inSess, recent: recentIds(), f: f || "all" };
  }
  const passProg = (id) => PK.f === "all" || (PK.f === "fav" ? isFav(id) : PK.f === "recent" ? PK.recent.includes(id) : exBp(id) === PK.f);
  const passLib = (x) => PK.f === "all" || (PK.f === "fav" ? isFav(libKey(x.id)) : PK.f === "recent" ? PK.recent.includes(libKey(x.id)) : x.bp === PK.f);
  function pkRow(act, id, sub, label, ic) {
    const inS = PK.inSess.has(id);
    return `<div class="pk-w"><button class="pk" data-sa="${act}" data-v="${esc(id)}">${ic ? `<span class="ex-tile neutral" aria-hidden="true">${icon(ic, 20)}</span>` : tileHTML(exGroup(id), 20)}<span class="pk-n">${esc(label || exName(id))}<small>${dl([inS ? `<b class="pk-in">уже в тренировке</b>` : "", esc(sub || musclesText(id).split(" · ")[0])])}</small></span></button>${starBtn(id, label || exName(id), "data-sa")}</div>`;
  }
  function libPkRow(act, x) {
    return `<div class="pk-w"><button class="pk" data-sa="${act}" data-v="${esc(x.id)}">${tileHTML(BP_GROUP[x.bp] || null, 20)}<span class="pk-n">${esc(libName(x))}<small>${dl([esc(ru(MU_RU, x.t)), esc(ru(EQ_RU, x.eq)), PM.progOf(x.id) ? "есть в программе" : ""])}</small></span></button>${starBtn(libKey(x.id), libName(x), "data-sa")}</div>`;
  }
  /** Строка по ключу избранного/недавнего: упражнение программы или запись базы. */
  function keyRow(k, actProg, actLib) {
    if (EX[k]) return pkRow(actProg, k);
    if (/^ds_/.test(k)) {
      const x = libById(k.slice(3)); if (x) return libPkRow(actLib, x);
      // база ещё грузится: строка-заглушка той же высоты — когда придут данные, список не сдвинется под пальцем
      if (!LIB.items && !LIB.error) { loadLib(); return `<div class="pk-w pk-wait"><button class="pk" disabled><span class="pk-n">Загружаю из базы…<small>&nbsp;</small></span></button></div>`; }
    }
    return "";
  }
  /** «Избранное» и «Недавние» над списком (пустой поиск). */
  function quickSections(actProg, actLib, exclude) {
    const fav = favs().filter((k) => !exclude.includes(k)).map((k) => keyRow(k, actProg, actLib)).filter(Boolean);
    const rec = PK.recent.filter((k) => !exclude.includes(k) && !favs().includes(k)).map((k) => keyRow(k, actProg, actLib)).filter(Boolean);
    return (fav.length ? `<div class="pk-h">${icon("star", 16)}Избранное</div>${fav.join("")}` : "") + (rec.length ? `<div class="pk-h">${icon("clock", 16)}Недавние</div>${rec.join("")}` : "");
  }
  /** Список при выбранном фильтре и пустом поиске. */
  function filteredListHTML(actProg, actLib, exclude) {
    if (PK.f === "fav" || PK.f === "recent") {
      const keys = (PK.f === "fav" ? favs() : PK.recent).filter((k) => !exclude.includes(k));
      const rows = keys.map((k) => keyRow(k, actProg, actLib)).filter(Boolean);
      return rows.length ? rows.join("") : `<p class="small muted pk-foot">${PK.f === "fav" ? "Пока пусто: нажми на звезду у упражнения — оно появится здесь." : "Пока пусто: здесь будут выбранные и сделанные за 4 недели упражнения."}</p>`;
    }
    const prog = Object.keys(EX).filter((id) => EX[id].m && !exclude.includes(id) && exBp(id) === PK.f).sort((a, b) => exName(a).localeCompare(exName(b), "ru"));
    const skip = new Set(prog.map((id) => EX[id].ds && EX[id].ds.id).filter(Boolean));
    let lib = "";
    if (!LIB.items) loadLib();
    else lib = LIB.items.filter((x) => x.bp === PK.f && !skip.has(x.id) && !PM.progOf(x.id)).slice(0, 40).map((x) => libPkRow(actLib, x)).join("");
    return (prog.length ? `<div class="pk-h">Из программы</div>${prog.map((id) => pkRow(actProg, id)).join("")}` : "") + (lib ? `<div class="pk-h">База упражнений</div>${lib}` : "") || `<p class="small muted">Ничего не нашлось.</p>`;
  }
  function pickChips(f) {
    const items = [["all", "Все"], ["fav", "Избранное"], ["recent", "Недавние"]].concat(BPS);
    return `<div class="chips pk-f" role="group" aria-label="Показать">${items.map(([k, n]) => `<button class="chip${f === k ? " on" : ""}" data-sa="pf" data-v="${k}" aria-pressed="${f === k}">${k === "fav" ? icon(f === k ? "star-fill" : "star", 16) : k === "recent" ? icon("clock", 16) : ""}${n}</button>`).join("")}</div>`;
  }
  /** Выбранный фильтр — в видимой части прокручиваемого ряда. */
  function chipIntoView(box) {
    const on = box && box.querySelector(".chip.on"); if (!on) return;
    if (on.offsetLeft < box.scrollLeft) box.scrollLeft = on.offsetLeft - 16;
    else if (on.offsetLeft + on.offsetWidth > box.scrollLeft + box.clientWidth) box.scrollLeft = on.offsetLeft + on.offsetWidth - box.clientWidth + 16;
  }
  function libResultsHTML(q, act, skip) {
    if (!LIB.items) { loadLib(); return LIB.error ? `<p class="small muted">База упражнений не загрузилась (${esc(LIB.error)}).</p>` : `<p class="small muted">Загружаю базу упражнений…</p>`; }
    const res = libFiltered(q, true).filter((x) => !skip.has(x.id) && passLib(x)).slice(0, 30);
    if (!res.length) return "";
    return `<div class="pk-h">База упражнений</div>` + res.map((x) => libPkRow(act, x)).join("");
  }
  function searchResultsHTML(q, actProg, actLib, exclude) {
    const prog = progSearch(q).filter((id) => !exclude.includes(id) && passProg(id));
    const skip = new Set(prog.map((id) => EX[id].ds && EX[id].ds.id).filter(Boolean));
    const out = (prog.length ? `<div class="pk-h">Из программы</div>` + prog.map((id) => pkRow(actProg, id)).join("") : "") + libResultsHTML(q, actLib, skip);
    return out || `<p class="small muted">Ничего не нашлось${PK.f !== "all" ? " с этим фильтром — попробуй «Все»" : ". Попробуй короче или по-английски"}.</p>`;
  }
  /** Упражнение по программе в этом месте; для «Сегодня» — с учётом корректировок агента. */
  function slotPlanned(o) {
    const g = sessOf(o.key).groups[o.gi], it = g.items[o.ii];
    return o.mode === "today" ? resolveItem(it, ctxNow(), `${o.key}-${g.id}-${o.ii}`).planned : PM.exHolder(it, o.v || "").ex;
  }
  function sheetReplace(o) {
    const s = sessOf(o.key), g = s.groups[o.gi], it = g && g.items && g.items[o.ii];
    if (!it) return null;
    const h = PM.exHolder(it, o.v || ""), planned = slotPlanned(o), day = o.key[1];
    const cur = o.mode === "today" ? daySwapOf(day, planned) || planned : planned;
    if (!o.scope) o.scope = o.mode === "today" ? "today" : "here";
    const n = PM.count(h.ex);
    const opts = o.mode === "today" ? [["today", "Только сегодня"], ["here", "В этой тренировке"], ["all", "Везде", n]] : [["here", "Только в этой тренировке"], ["all", "Во всех местах программы", n]];
    const help = {
      today: "Только эта тренировка — программа не меняется, завтра всё как было.",
      here: `Насовсем в программе: ${slotName(o.key)}.`,
      all: `Насовсем во всех блоках и тренировках, где стоит «${exName(h.ex)}» — ${n} ${plural(n, "место", "места", "мест")}.`
    };
    const html = `
      <div class="seg sh-scope" role="radiogroup" aria-label="Где заменить">${opts.map(([k, lab, cnt]) => `<button role="radio" aria-checked="${o.scope === k}" data-sa="scope" data-v="${k}" class="${o.scope === k ? "on" : ""}"${cnt ? ` aria-label="${esc(lab)}: ${cnt} ${plural(cnt, "место", "места", "мест")}"` : ""}>${esc(lab)}${cnt ? `<span class="badge">${cnt}</span>` : ""}</button>`).join("")}</div>
      <p class="small muted sh-help">${esc(help[o.scope])}</p>
      <div class="search-w">${icon("search", 20)}<input class="search" type="search" data-sq="replace" placeholder="Название или мышца" value="${esc(SH.q)}" autocomplete="off" enterkeyhint="search" aria-label="Поиск упражнения"></div>
      ${pickChips(o.f || "all")}
      <div class="pk-list" id="pickList">${replaceListHTML(o, h, planned, cur)}</div>`;
    return { title: `Заменить «${exName(cur)}»`, html };
  }
  function replaceListHTML(o, h, planned, cur) {
    const q = SH.q.trim();
    pkCtx(o.key, o.f);
    if (q) return searchResultsHTML(q, "pick", "pickds", [cur]);
    if (PK.f !== "all") return filteredListHTML("pick", "pickds", [cur, planned]);
    const rows = [];
    if (o.mode === "today" && cur !== planned) rows.push(pkRow("pick", planned, "как в программе — вернуть", exName(planned), "undo"));
    else if (h.orig && EX[h.orig] && o.scope !== "today" && !isCustom()) rows.push(pkRow("pick", h.orig, "исходное упражнение программы — вернуть", exName(h.orig), "undo"));
    const sim = similarIds(planned).filter((id) => id !== cur && id !== h.orig);
    if (sim.length) rows.push(`<div class="pk-h">Похожие — та же мышца</div>` + sim.slice(0, 8).map((id) => pkRow("pick", id)).join(""));
    rows.push(quickSections("pick", "pickds", [cur, planned]));
    if (sim.length > 8) rows.push(`<div class="pk-h">Ещё похожие</div>` + sim.slice(8).map((id) => pkRow("pick", id)).join(""));
    rows.push(`<p class="small muted pk-foot">Нет подходящего? Начни вводить название — поищу и среди 1324 упражнений базы.</p>`);
    return rows.join("");
  }
  function sheetAdd(o) {
    const q = SH.q.trim();
    pkCtx(`${o.b}${o.d}`, o.f);
    let list;
    if (q) list = searchResultsHTML(q, "addpick", "addpickds", []);
    else if (PK.f !== "all") list = filteredListHTML("addpick", "addpickds", []);
    else {
      const by = {};
      Object.keys(EX).forEach((id) => { const e = EX[id]; if (e.m && e.m.p.length) (by[e.m.p[0]] = by[e.m.p[0]] || []).push(id); });
      const helpers = (id) => { const e = EX[id]; return e.m.s.length ? "помогают: " + e.m.s.map((m) => (P.muscles[m] ? P.muscles[m].n.toLowerCase() : m)).join(", ") : " "; };
      list = quickSections("addpick", "addpickds", []) + Object.keys(P.muscles).filter((m) => by[m]).map((m) => `<div class="pk-h">${esc(P.muscles[m].n)}</div>` + by[m].sort((a, b) => exName(a).localeCompare(exName(b), "ru")).map((id) => pkRow("addpick", id, helpers(id))).join("")).join("")
        + `<p class="small muted pk-foot">Здесь упражнения программы. Начни вводить название — поищу и среди 1324 упражнений базы.</p>`;
    }
    const where = o.scope === "all" ? `тренировку ${o.d} во всех блоках` : slotName(`${o.b}${o.d}`, "acc");
    return { title: "Добавить упражнение", html: `
      ${o.last ? `<p class="sh-ok" role="status">${icon("check-circle", 18)}<span>«${esc(o.last)}» — в ${esc(where)}${SH.added > 1 ? ` · добавлено ${SH.added}` : ""}. Выбери следующее или закрой.</span></p>` : ""}
      <div class="search-w">${icon("search", 20)}<input class="search" type="search" data-sq="add" placeholder="Название или мышца" value="${esc(SH.q)}" autocomplete="off" enterkeyhint="search" aria-label="Поиск упражнения"></div>
      ${pickChips(o.f || "all")}
      <div class="pk-list" id="pickList">${list}</div>` };
  }
  function sheetAddPlace(o) {
    const def = o.ex ? EX[o.ex] : o.ds ? window.PlanModel.exerciseFromLib(o.ds) : null;
    if (!def) return null;
    const sec = def.unit === "sec";
    if (o.sets == null) Object.assign(o, { sets: 3, reps: sec ? "30–40 с" : "10–12", rir: sec ? "" : "1–2" });
    o.scope = o.scope || "here"; o.tier = o.tier || "core"; if (o.place == null) o.place = "new";
    const key = `${o.b}${o.d}`, s = sessOf(key), L = groupNums(s.groups), si = PM.strengthIdx(s.groups);
    if (o.place !== "new" && !si.includes(+o.place)) o.place = "new";
    const seg = (act, items, curV) => items.map(([v, lab, sub]) => `<button data-sa="${act}" data-v="${v}" class="${String(curV) === String(v) ? "on" : ""}" aria-pressed="${String(curV) === String(v)}">${esc(lab)}${sub ? `<small>${esc(sub)}</small>` : ""}</button>`).join("");
    const places = o.scope === "all" || !si.length ? "" : `<div class="fld col"><span class="fl">Куда</span><div class="chips wrap">${[`<button class="chip ${o.place === "new" ? "on" : ""}" data-sa="aplace" data-v="new">Отдельно, в конец</button>`].concat(si.map((gi) => `<button class="chip ${String(o.place) === String(gi) ? "on" : ""}" data-sa="aplace" data-v="${gi}">в суперсет с ${esc(grpWith(s.groups[gi]))}</button>`)).join("")}</div></div>`;
    const tiers = o.place === "new" || o.scope === "all" ? `<div class="fld col"><span class="fl">Когда делать</span><div class="seg sh-tier">${seg("atier", [["core", "Всегда", "60 · 90 · 120"], ["std", "От 90 мин", "90 · 120"], ["max", "Только 120", "120 мин"]], o.tier)}</div></div>` : "";
    // с экрана тренировки она уже выбрана: строка «в тренировку …» + «изменить»; из «Упражнений» — выбор тренировки и блока
    const where = o.fix && !o.where
      ? `<p class="sh-into">${icon("dumbbell", 18)}<span>В ${esc(slotName(key, "acc"))}${s.title !== PM.baseTitle(key) || !isCustom() ? ` — «${esc(s.title)}»` : ""}</span><button class="lnk small" data-sa="awhere">изменить</button></p>`
      : `<div class="fld col"><span class="fl">Тренировка</span><div class="seg${days().length > 3 ? " seg-grid" : ""}">${seg("ad", days().map((x) => [x, days().length > 3 ? x : `Тренировка ${x}`, sessOf(`${o.b}${x}`).title]), o.d)}</div></div>
      ${multiBlock() ? `<div class="fld col"><span class="fl">Блок</span><div class="seg">${seg("ab", blocks().map((b) => [b.id, `Блок ${b.id}`, b.name]), o.scope === "all" ? "" : o.b)}<button data-sa="ascope" data-v="${o.scope === "all" ? "here" : "all"}" class="${o.scope === "all" ? "on" : ""}" aria-pressed="${o.scope === "all"}">Все<small>${blocks().map((b) => b.id).join("&nbsp;· ")}</small></button></div></div>` : ""}`;
    const own = parseReps(o.reps, sec) ? `<div class="fld col"><label class="fl" for="shARepsT">${sec ? "Время" : "Повторы"} своими словами</label><input id="shARepsT" class="inp" data-af="reps" value="${esc(o.reps)}" maxlength="20" autocomplete="off" enterkeyhint="done" placeholder="Например: 8 на сторону"></div>` : "";
    const html = `
      ${def.m && def.m.p.length ? `<p class="small muted sh-mus">${esc(def.m.p.map((m) => P.muscles[m] ? P.muscles[m].n.toLowerCase() : m).join(", "))}</p>` : ""}
      ${where}
      ${places}
      ${qeHTML({ sets: o.sets, reps: o.reps, rir: o.rir || null }, { attr: "sa", act: { sets: "asets", reps: "areps", rir: "arir" }, sec, noRir: sec, tid: "shAReps", tfield: 'data-af="reps"', presets: true })}
      ${tiers || own ? `<details class="sh-more sh-add-more" data-shmore="1" ${o.more ? "open" : ""}><summary>Ещё<small>${[tiers ? "когда делать" : "", own ? "повторы своими словами" : ""].filter(Boolean).join(", ")}</small>${icon("chevron-down", 20)}</summary>${tiers}${own}</details>` : ""}
      <div class="sh-add2">
        <button class="btn primary" data-sa="adddo">${icon("check", 20)}${o.fix && !o.where ? "Добавить" : o.scope === "all" ? `Добавить в тренировку ${o.d} во все блоки` : `Добавить в ${slotName(key, "acc")}`}</button>
        <button class="btn" data-sa="addmore">${icon("plus", 20)}Добавить и выбрать ещё</button>
      </div>`;
    return { title: `Добавить «${def.n}»`, html };
  }
  /* --- тренировка целиком: «Действия» у названия --- */
  const FIXED_RU = { warmup: "разминка", sprint: "спринты", n4x4: "интервалы 4×4", z2: "кардио в зоне 2", skill: "навык блока" };
  /** Что в тренировке останется после замены силовой части: «разминка, спринты и кардио в зоне 2». */
  function fixedList(key) {
    const names = Array.from(new Set(sessOf(key).groups.filter((g) => !isStrength(g)).map((g) => FIXED_RU[g.kind] || g.kind)));
    return names.length > 1 ? `${names.slice(0, -1).join(", ")} и ${names[names.length - 1]}` : names[0] || "";
  }
  /** Сколько подходов уже записано сегодня по этой тренировке (блок и день). */
  function loggedToday(key) {
    const e = todayLog(key[1]);
    if (!e || !e.ex) return 0;
    const blk = e.idx != null ? posOfIdx(e.idx).block : ctxNow().block;
    if (String(blk) !== key[0]) return 0;
    return Object.values(e.ex).reduce((a, sets) => a + (sets || []).filter(performed).length, 0);
  }
  const loggedNote = (keys) => keys.map((k) => [k, loggedToday(k)]).filter((x) => x[1]).map(([k, n]) => `Сегодня по ${slotName(k, "dat")} уже ${plural(n, "записан", "записано", "записано")} ${n} ${plural(n, "подход", "подхода", "подходов")} — записи останутся в журнале.`).join(" ");
  function sheetDay(o) {
    const s = sessOf(o.key);
    if (!s) return null;
    const d = o.key[1], base = PM.baseTitle(o.key), nStr = PM.strengthIdx(s.groups).length, own = PM.titled(o.key), fx = fixedList(o.key);
    const keep = fx ? `${fx[0].toUpperCase()}${fx.slice(1)} ${/ и /.test(fx) ? "останутся" : "останется"}.` : "";
    const conf = (text, act, ic, lab, no) => `<div class="banner warn sh-confirm"><p>${text}</p><div class="row-btns"><button class="btn danger" data-sa="${act}">${icon(ic, 18)}${lab}</button><button class="btn" data-sa="${no}">Не надо</button></div></div>`;
    const clear = o.arm === "clear"
      ? conf(`Убрать все упражнения из ${esc(slotName(o.key, "gen"))}? ${esc(keep)} ${esc(loggedNote([o.key]))} Отменить можно сразу после.`, "dcleardo", "trash", "Очистить", "dclear0")
      : `<button class="btn sh-row danger" data-sa="dclear" ${nStr ? "" : "disabled"}>${icon("trash", 22)}<span>Очистить тренировку<small>${nStr ? `собрать с нуля${fx ? `; ${esc(fx)} — останется` : ""}` : "упражнений уже нет"}</small></span></button>`;
    const f = PM.forkInfo(o.key), upd = f && f.ver && f.ver !== P.meta.version ? `; программа обновилась до v${esc(P.meta.version)}` : "";
    const custom = isCustom();
    const reset = custom || !(PM.edited(o.key) || own) ? "" : o.arm === "reset"
      ? conf(`Вернуть ${esc(slotName(o.key, "acc"))} как в программе? Твои правки и название этой тренировки пропадут. Отменить можно сразу после.`, "dresetdo", "undo", "Сбросить", "dclear0")
      : `<button class="btn sh-row" data-sa="dreset">${icon("undo", 22)}<span>Сбросить к исходной<small>убрать твои правки и название этой тренировки${upd}</small></span></button>`;
    // порядок: скопировать, сбросить, очистить (опасное — последним); подтверждение не уводит другие пункты под край
    const html = `
      <div class="fld col"><label class="fl" for="shTitle">Название</label>
        <input id="shTitle" class="inp" data-sf="title" value="${esc(s.title)}" placeholder="${esc(base)}" maxlength="60" autocomplete="off" enterkeyhint="done">
        ${own ? `<button class="lnk small sh-tl" data-sa="dtitle0">${icon("undo", 16)}Вернуть «${esc(base)}»</button>` : `<span class="small muted">Оставь пустым — вернётся «${esc(base)}».</span>`}</div>
      <div class="sh-col">
        <button class="btn sh-row" data-sa="dcopy" ${nStr ? "" : "disabled"}>${icon("copy", 22)}<span>Скопировать в…<small>${nStr ? `силовую часть — в другие тренировки${multiBlock() ? " и блоки" : ""}` : "копировать нечего: в тренировке нет упражнений"}</small></span></button>
        ${reset}
        ${clear}
        ${custom ? dayDelHTML(o, d) : ""}
      </div>`;
    return { title: multiBlock() ? `Тренировка ${d} · блок ${o.key[0]}` : `Тренировка ${d}`, html };
  }
  /** Удалить тренировку своей программы (кроме последней): с подтверждением; журнал остаётся, отмена — в тосте. */
  function dayDelHTML(o, d) {
    if (days().length <= 1) return `<button class="btn sh-row danger" disabled>${icon("trash", 22)}<span>Удалить тренировку<small>это последняя тренировка программы</small></span></button>`;
    const ttl = sessOf(o.key).title;
    if (o.arm === "del") return `<div class="banner warn sh-confirm"><p>Удалить ${ttl === `Тренировка ${d}` ? `«${esc(ttl)}»` : `тренировку ${d} «${esc(ttl)}»`} из программы? Записи в журнале останутся. Отменить можно сразу после.</p><div class="row-btns"><button class="btn danger" data-sa="ddeldo">${icon("trash", 18)}Удалить</button><button class="btn" data-sa="dclear0">Не надо</button></div></div>`;
    return `<button class="btn sh-row danger" data-sa="ddel">${icon("trash", 22)}<span>Удалить тренировку<small>остальные буквы не меняются; журнал останется</small></span></button>`;
  }
  /** Меню программы («⋮» героя хаба и карточки в «Все программы»): переименовать, описание, дублировать, сбросить правки, удалить — что применимо.
      o.id — программа (по умолчанию текущая). Встроенную нельзя переименовать и удалить; текущую нельзя удалить — сначала перейти на другую. */
  function sheetProg(o) {
    const id = o.id || BOUND, rec = id === PG.MAIN ? null : progsAll()[id];
    if (id !== PG.MAIN && !rec) return null;
    const cur = id === BOUND, k = PG.kind(rec), rows = [];
    const row = (sa, ic, lab, sub, dis, cls) => `<button class="btn sh-row${cls ? " " + cls : ""}" data-sa="${sa}" ${dis ? "disabled" : ""}>${icon(ic, 22)}<span>${lab}<small>${sub}</small></span></button>`;
    if (rec) {
      rows.push(row("pren", "pencil", "Переименовать", esc(rec.name)));
      rows.push(row("pnote", "book-open", "Описание", rec.note ? esc(rec.note.length > 60 ? rec.note.slice(0, 60) + "…" : rec.note) : "для чего программа, что важно"));
    }
    const full = PG.count(progsAll()) >= PG.MAX;
    rows.push(row("pdup", "copy", "Дублировать", full ? `уже ${PG.MAX} своих программ — удали лишнюю` : `копия «${esc(progName(id))}» — с правками и расписанием, место в цикле с начала`, full));
    if (cur && k !== "custom") {
      const n = PM.editedKeys().length;
      rows.push(o.arm === "reset"
        ? `<div class="banner warn sh-confirm"><p>Сбросить все правки программы — ${n}&nbsp;${plural(n, "тренировку", "тренировки", "тренировок")}${isMain() ? " и замены" : ""}? Журнал останется. Отменить можно сразу после.</p><div class="row-btns"><button class="btn danger" data-sa="presetdo">${icon("undo", 18)}Сбросить</button><button class="btn" data-sa="preset0">Не надо</button></div></div>`
        : row("preset", "undo", "Сбросить правки программы", n ? `изменено ${n}&nbsp;${plural(n, "тренировка", "тренировки", "тренировок")} — вернуть как в исходной` : "правок нет — программа как в исходной", !n, "danger"));
    }
    if (rec) {
      rows.push(cur ? row("pdel", "trash", "Удалить", "это текущая программа — сначала перейди на другую в «Все программы»", true, "danger")
        : o.arm === "del" ? `<div class="banner warn sh-confirm"><p>Удалить программу «${esc(rec.name)}»? Записи в журнале останутся. Отменить можно сразу после.</p><div class="row-btns"><button class="btn danger" data-sa="pdeldo">${icon("trash", 18)}Удалить</button><button class="btn" data-sa="preset0">Не надо</button></div></div>`
        : row("pdel", "trash", "Удалить", "журнал останется", false, "danger"));
    }
    const go = !cur ? `<button class="btn primary wide sh-go" data-sa="pgoto" data-v="${esc(id)}">${icon("arrow-right", 20)}Перейти на эту программу</button>` : "";
    return { title: progName(id), html: `${go}<div class="sh-col">${rows.join("")}</div>` };
  }
  /** Переименовать или описание программы: o.id, o.f — "name" | "note". */
  function sheetPEdit(o) {
    const rec = progsAll()[o.id]; if (!rec) return null;
    const name = o.f === "name";
    const fld = name
      ? `<input id="shPName" class="inp" data-pf="name" data-cnt="${PG.NAME_MAX}" value="${esc(o.v != null ? o.v : rec.name)}" maxlength="${PG.NAME_MAX}" autocomplete="off" enterkeyhint="done">`
      : `<textarea id="shPName" class="inp adj-in" data-pf="note" data-cnt="${PG.NOTE_MAX}" rows="4" maxlength="${PG.NOTE_MAX}" placeholder="Например: 8 недель на силу, потом пересмотр">${esc(o.v != null ? o.v : rec.note || "")}</textarea>`;
    const len = String(o.v != null ? o.v : name ? rec.name : rec.note || "").length;
    return { title: name ? "Переименовать" : "Описание", html: `
      <div class="fld col"><label class="fl" for="shPName">${name ? "Название" : "Описание программы"}</label>${fld}
        <span class="small muted cnt" aria-live="polite">${len} / ${name ? PG.NAME_MAX : PG.NOTE_MAX}${name ? "" : " · видно в «О программе» и в списке программ"}</span></div>
      <button class="btn primary wide sh-save" data-sa="pfsave">${icon("check", 20)}Сохранить</button>` };
  }
  /** «Что в этот день» (своя программа): отдых или тренировка; выбор переносит тренировку с её прежнего дня. */
  function sheetWdPick(o) {
    if (!isCustom()) return null;
    const cur = dayOnWd(o.wd);
    const row = (v, tile, lab, sub, on) => `<button class="pk wdp${on ? " on" : ""}" data-sa="wdset" data-v="${v}" aria-pressed="${on}">${tile}<span class="pk-n">${lab}<small>${sub}</small></span>${on ? icon("check", 20) : ""}</button>`;
    const rows = [row("", `<span class="ex-tile neutral" aria-hidden="true">${icon("moon", 20)}</span>`, "Отдых", "без тренировки", !cur)]
      .concat(days().map((d) => { const w = wdOf(d); return row(d, dayTile(d, "sm"), esc(sessOf(`1${d}`).title), w == null ? "без дня" : w === o.wd ? "в этот день" : `сейчас — ${WD[w]}; перенесётся сюда`, d === cur); }));
    return { title: `${Cap(WD[o.wd])}: что в этот день`, html: `<div class="pk-list">${rows.join("")}</div>` };
  }
  /** Подтверждение перехода на программу o.id. */
  function sheetPSwitch(o) {
    if (o.id !== PG.MAIN && !progsAll()[o.id]) return null;
    const here = placeOf(BOUND), there = placeOf(o.id);
    return { title: `Перейти на «${progName(o.id)}»?`, html: `
      <p class="small">«Сегодня» покажет её тренировки${there.started ? ` — с того места, где остановился: ${esc(there.txt)}` : ""}. ${here.started ? `«${esc(progName(BOUND))}» запомнит место (${esc(here.txt)}) — вернёшься туда же.` : `«${esc(progName(BOUND))}» пока не начата — потом начнёшь её с начала.`}</p>
      <p class="small muted">Журнал общий: записи всех программ остаются, прогресс по упражнениям — по всем.</p>
      <div class="sh-add2"><button class="btn primary" data-sa="pswitchdo">${icon("arrow-right", 20)}Перейти</button><button class="btn" data-sa="close">Отмена</button></div>` };
  }
  /** Новая программа, шаг 1: с нуля, из шаблона, копия текущей. */
  function sheetPNew() {
    if (PG.count(progsAll()) >= PG.MAX) return { title: "Новая программа", html: ban("warn", `Не больше ${PG.MAX} своих программ — удали лишнюю, чтобы создать новую.`) };
    const row = (v, ic, lab, sub) => `<button class="btn sh-row pn-row" data-sa="pnkind" data-v="${v}">${icon(ic, 22)}<span>${lab}<small>${sub}</small></span>${icon("chevron-right", 20)}</button>`;
    return { title: "Новая программа", html: `
      <p class="small muted sh-help">Шаг 1 из 2 — с чего начать.</p>
      <div class="sh-col">
        ${row("blank", "plus", "С нуля", "пустые тренировки — соберёшь сам: 1–6 в неделю")}
        ${row("tpl", "sparkles", "Из шаблона", `${PG.TEMPLATES.length} шаблонов: от фулбоди до силовых циклов`)}
        ${row("copy", "copy", "Копия текущей", `«${esc(progName(BOUND))}» со всеми правками и расписанием`)}
      </div>` };
  }
  /** Список шаблонов: описание и состав по дням. */
  const TPL_GRP = [["simple", "Простые"], ["rot", "С чередованием"], ["cyc", "С циклом нагрузки"]];
  function sheetPTpl() {
    const tags = (x) => {
      const out = [], n = x.days.length, mx = Math.max(0, ...[].concat(...x.days.map((d) => d.ex.map((e) => (e[5] ? e[5].length : 0)))));
      out.push(x.rot ? `${x.rot.pw}&nbsp;в&nbsp;неделю` : `${n}&nbsp;в&nbsp;неделю`);
      if (x.rot) out.push("чередование");
      if (mx) out.push(`цикл ${mx}&nbsp;${plural(mx, "шаг", "шага", "шагов")}`);
      return `<span class="tags tpl-tags">${out.map((t) => `<span class="tag">${t}</span>`).join("")}</span>`;
    };
    // коротко: название, теги, описание и ряд тренировок; состав по упражнениям — на шаге 2 («Состав»)
    const card = (x) => `<button class="pk tpl" data-sa="pntpl" data-v="${x.id}"><span class="tpl-t"><b>${nbd(x.name)}</b>${tags(x)}<small>${esc(x.note)}</small>
      <span class="tpl-row">${x.days.map((d, i) => `<span class="tpl-n">${dayTile(PG.LETTERS[i], "sm")}<span>${esc(d.t)}</span></span>`).join("")}</span></span>${icon("chevron-right", 20)}</button>`;
    const secs = TPL_GRP.map(([g, h]) => { const l = PG.TEMPLATES.filter((x) => x.grp === g); return l.length ? `<h3 class="sec-h tpl-h"><span>${h}</span></h3><div class="tpl-list">${l.map(card).join("")}</div>` : ""; }).join("");
    return { title: "Шаблоны", html: `<p class="small muted sh-help">Упражнения и подходы можно поменять потом — это обычная своя программа.</p>${secs}` };
  }
  /** Новая программа, шаг 2: название и (для «с нуля») число тренировок. */
  function sheetPNew2(o) {
    const tpl = o.kind === "tpl" ? PG.TEMPLATES.find((x) => x.id === o.tpl) : null;
    if (o.name == null) o.name = uniqName(o.kind === "copy" ? `${progName(BOUND)} (копия)` : tpl ? tpl.name : "Моя программа");
    if (o.n == null) o.n = 3;
    if (o.pw == null || o.pw > o.n) o.pw = o.n;
    const what = o.kind === "copy" ? `Копия «${esc(progName(BOUND))}»${isCustom() ? "" : " — блоки и недели как у «Апгрейда», правки и расписание свои"}.` : tpl ? `Шаблон «${esc(tpl.name)}»: ${tpl.days.length} ${plural(tpl.days.length, "тренировка", "тренировки", "тренировок")} — ${tpl.days.map((d) => esc(d.t)).join(", ")}${tpl.rot ? `; ${tpl.rot.pw} в неделю по очереди` : ""}.` : "Тренировки будут пустыми — добавишь упражнения сам.";
    return { title: "Новая программа", html: `
      <p class="small muted sh-help">Шаг 2 из 2. ${what}</p>
      ${tpl ? `<details class="tpl-comp"><summary>Состав${icon("chevron-down", 18)}</summary><div class="tpl-days">${tpl.days.map((d, i) => `<span class="tpl-d">${dayTile(PG.LETTERS[i], "sm")}<span><b>${esc(d.t)}</b> — ${esc(d.ex.map((e) => exName(e[0])).join(", "))}</span></span>`).join("")}</div></details>` : ""}
      <div class="fld col"><label class="fl" for="shPNew">Название</label><input id="shPNew" class="inp" data-pf="newname" data-cnt="${PG.NAME_MAX}" value="${esc(o.name)}" maxlength="${PG.NAME_MAX}" autocomplete="off" enterkeyhint="done"><span class="small muted cnt" aria-live="polite">${o.name.length} / ${PG.NAME_MAX}</span></div>
      ${o.kind === "blank" ? `<div class="fld pn-n"><span class="fl">Тренировок в программе</span><div class="stepper"><button data-sa="pnn" data-v="-1" aria-label="Меньше тренировок" ${o.n <= 1 ? "disabled" : ""}>${icon("minus", 20)}</button><b aria-live="polite">${o.n}</b><button data-sa="pnn" data-v="1" aria-label="Больше тренировок" ${o.n >= PG.MAX_DAYS ? "disabled" : ""}>${icon("plus", 20)}</button></div></div>
        <div class="fld pn-n"><span class="fl">Тренировок в неделю</span><div class="stepper"><button data-sa="pnpw" data-v="-1" aria-label="Меньше в неделю" ${o.pw <= 1 ? "disabled" : ""}>${icon("minus", 20)}</button><b aria-live="polite">${o.pw}</b><button data-sa="pnpw" data-v="1" aria-label="Больше в неделю" ${o.pw >= o.n ? "disabled" : ""}>${icon("plus", 20)}</button></div></div>
        <p class="small muted pn-what">${o.pw >= o.n ? `${o.n === 1 ? "Тренировка A" : `Тренировки ${andList(PG.LETTERS.slice(0, o.n).split(""))}`} — каждую неделю.` : Cap(rotPhrase(o.n, o.pw))} Добавить или удалить тренировки можно и потом.</p>` : ""}
      <div class="sh-add2"><button class="btn primary" data-sa="pnewdo" data-v="go">${icon("check", 20)}Создать и перейти</button><button class="btn" data-sa="pnewdo" data-v="only">Только создать</button></div>` };
  }
  /* --- цикл нагрузки упражнения своей программы: заготовки, шаги, максимум --- */
  const CYC_PRE = {
    lin4: ["Линейный · 4", [{ sets: 4, reps: "8", pct: 70 }, { sets: 4, reps: "6", pct: 75 }, { sets: 4, reps: "5", pct: 80 }, { sets: 3, reps: "3", pct: 87.5 }]],
    wave3: ["Волна · 3", [{ sets: 3, reps: "8", pct: 72.5 }, { sets: 3, reps: "5", pct: 80 }, { sets: 3, reps: "3", pct: 87.5 }]],
    dl4: ["С разгрузкой · 4", [{ sets: 3, reps: "8", rir: "3" }, { sets: 3, reps: "8", rir: "2" }, { sets: 3, reps: "8", rir: "1" }, { sets: 2, reps: "8", rir: "4" }]],
    hl2: ["Тяжёлая / лёгкая · 2", [{ sets: 4, reps: "4–6", rir: "1" }, { sets: 3, reps: "10–12", rir: "3" }]]
  };
  /** Максимум упражнения своей программы: kg — число или null (убрать). */
  function saveTm(exId, kg) { const rec = curRec(); if (!rec) return; const r = PG.setTm(rec, exId, kg); if (!r.error) saveRec(r.rec); }
  const parseKg = (v) => { const n = numOf(v); return n != null && n >= 1 && n <= 1000 ? Math.round(n * 2) / 2 : null; };
  function sheetCyc(o) {
    const it = PM.item(o.key, o.gi, o.ii);
    if (!cycOk(it)) return null;
    const exId = it.ex, ex = EX[exId] || {}, sec = ex.unit === "sec", c = it.cyc;
    const lead = `<p class="small sh-help">Нагрузка меняется по шагам: каждый раз, когда сделал эту тренировку, — следующий шаг, после последнего — снова первый.</p>`;
    const chips = `<div class="chips wrap cyc-pre" role="group" aria-label="Заготовки">${Object.keys(CYC_PRE).map((k) => `<button class="chip" data-sa="cycpre" data-v="${k}">${CYC_PRE[k][0]}</button>`).join("")}</div>`;
    if (!c) return { title: `Цикл нагрузки: ${exName(exId)}`, html: `${lead}<p class="small muted">Выбери заготовку — шаги потом можно поправить.</p>${chips}
      <div class="sh-col"><button class="btn sh-row" data-sa="cycown">${icon("plus", 22)}<span>Свои шаги<small>два шага из текущей схемы ${esc(stepTxt(it))} — дальше правишь</small></span></button></div>` };
    const cs = cycStep(it, { day: o.key[1], plan: true }), tm = tmOf(exId), anyPct = c.some((x) => x.pct != null);
    const MI = icon("minus", 20), PL = icon("plus", 20);
    const rows = c.map((x, i) => {
      const kg = x.pct != null && tm ? PG.stepWeight(x.pct, tm) : null, on = o.open === i;
      const txt = `${i + 1} · ${x.sets} × ${x.reps}${x.pct != null ? ` · ${fmtW(x.pct)} %${kg != null ? ` · ${fmtW(kg)} кг` : ""}` : ""}${x.rir != null ? ` · запас ${x.rir}` : ""}`;
      const head = `<button class="cyc-row${on ? " on" : ""}" data-sa="cycstep" data-v="${i}" aria-expanded="${on}"><span class="cyc-t">${esc(txt)}</span>${i === cs.i ? `<span class="tag now">сейчас</span>` : ""}${icon(on ? "chevron-up" : "chevron-down", 18)}</button>`;
      if (!on) return `<li>${head}</li>`;
      const pct = x.pct;
      const pctRow = `<div class="qe-r"><span class="fl">% от максимума</span><div class="stepper"><button data-sa="cs_pct" data-v="${pct == null ? "" : Math.max(30, pct - 2.5)}" data-qb="p-" aria-label="Меньше процент" ${pct == null || pct <= 30 ? "disabled" : ""}>${MI}</button><b aria-live="polite">${pct == null ? "—" : fmtW(pct)}</b><button data-sa="cs_pct" data-v="${pct == null ? 70 : Math.min(110, pct + 2.5)}" data-qb="p+" aria-label="Больше процент" ${pct != null && pct >= 110 ? "disabled" : ""}>${PL}</button></div></div>
        ${pct != null ? `<button class="lnk small" data-sa="cs_pct" data-v="">${icon("x", 16)}без процента</button>` : `<p class="small muted">Необязательно: с процентом вес шага посчитается от максимума.</p>`}`;
      return `<li>${head}<div class="cyc-ed">${qeHTML(x, { attr: "sa", act: { sets: "cs_sets", reps: "cs_reps", rir: "cs_rir" }, sec, tid: "shCycReps", tfield: 'data-sf="cyreps"', presets: true })}${pctRow}
        <button class="btn sh-row danger cyc-del" data-sa="cycdel" ${c.length <= PM_MIN ? "disabled" : ""}>${icon("trash", 22)}<span>Удалить шаг<small>${c.length <= PM_MIN ? "шагов не меньше двух" : `шаг ${i + 1}`}</small></span></button></div></li>`;
    }).join("");
    const tmFld = anyPct ? `<div class="fld col cyc-tm"><label class="fl" for="shTm">Максимум, кг</label><input id="shTm" class="inp" inputmode="decimal" data-sf="tm" value="${tm ? fmtW(tm) : ""}" placeholder="например, 100" autocomplete="off" enterkeyhint="done"><span class="small muted">Лучший вес на 1 повтор; от него считаются проценты.</span></div>` : "";
    return { title: `Цикл нагрузки: ${exName(exId)}`, html: `${lead}${tmFld}
      <ol class="cyc-list" aria-label="Шаги">${rows}</ol>
      <button class="btn wide cyc-add" data-sa="cycadd" ${c.length >= PM_MAX ? "disabled" : ""}>${icon("plus", 20)}Добавить шаг</button>
      <details class="cyc-premore"><summary>Заменить шаги заготовкой${icon("chevron-down", 18)}</summary>${chips}</details>
      <div class="sh-col"><button class="btn sh-row danger" data-sa="cycoff">${icon("x", 22)}<span>Убрать цикл<small>останется обычная схема — шаг 1</small></span></button></div>` };
  }
  const PM_MIN = PG.CYC_MIN, PM_MAX = PG.CYC_MAX;
  /** «Указать максимум» с «Сегодня»: одно поле. */
  function sheetTm(o) {
    if (!isCustom()) return null;
    const tm = tmOf(o.ex);
    return { title: `Максимум: ${exName(o.ex)}`, html: `
      <div class="fld col"><label class="fl" for="shTm2">Максимум, кг</label><input id="shTm2" class="inp" inputmode="decimal" data-tmf="1" value="${tm ? fmtW(tm) : ""}" placeholder="например, 100" autocomplete="off" enterkeyhint="done">
        <span class="small muted">Лучший вес на 1 повтор; от него считаются проценты шагов.</span></div>
      <div class="sh-add2"><button class="btn primary" data-sa="tmsave">${icon("check", 20)}Сохранить</button>${tm ? `<button class="btn" data-sa="tmdel">Убрать</button>` : `<button class="btn" data-sa="close">Отмена</button>`}</div>` };
  }
  function saveTmSheet() {
    const f = $("#shTm2"), ex = SH.o.ex, old = tmOf(ex), kg = parseKg(f ? f.value : "");
    if (kg == null) { toast("Нужен вес от 1 до 1000 кг"); if (f) f.focus(); return; }
    saveTm(ex, kg);
    closeSheet(`Максимум «${exName(ex)}» — ${fmtW(kg)} кг`, () => { saveTm(ex, old); render(); });
  }
  function sheetCopy(o) {
    const s = sessOf(o.key);
    if (!s) return null;
    o.to = (o.to || []).filter((k) => k !== o.key);
    const n = PM.strengthIdx(s.groups).reduce((a, gi) => a + s.groups[gi].items.length, 0);
    if (!n) return { title: "Скопировать тренировку", html: `<p class="small muted">В этой тренировке нет упражнений — копировать нечего.</p>` };
    const mb = multiBlock();
    const rows = blocks().map((bl) => `<div class="cp-row${mb ? "" : " one"}" style="--n:${days().length}">${mb ? `<span class="cp-b">Блок ${bl.id}</span>` : ""}${days().map((x) => {
      const k = `${bl.id}${x}`, me = k === o.key, on = o.to.includes(k);
      return `<button class="cp-c${on ? " on" : ""}${me ? " me" : ""}" data-sa="cto" data-v="${k}" aria-pressed="${on}" aria-label="Тренировка ${x}${mb ? `, блок ${bl.id}` : ""}${me ? " — отсюда" : ""}" ${me ? "disabled" : ""}><b>${x}${PM.edited(k) && !me && !isCustom() ? `<i class="ed" title="Есть твои правки"></i>` : ""}</b><small>${me ? "отсюда" : esc(sessOf(k).title)}</small></button>`;
    }).join("")}</div>`).join("");
    const dayAll = blocks().map((bl) => `${bl.id}${o.key[1]}`).filter((k) => k !== o.key);
    const sorted = o.to.slice().sort(), allOn = dayAll.every((k) => o.to.includes(k)), list = sorted.map(slotName).join("; ");
    const logged = loggedNote(sorted);
    const html = `
      <p class="small muted sh-help">Отсюда: ${esc(slotName(o.key))} — «${esc(s.title)}», ${n} ${plural(n, "упражнение", "упражнения", "упражнений")}.</p>
      ${mb || o.to.length ? `<div class="chips wrap cp-quick">${mb ? `<button class="chip${allOn ? " on" : ""}" data-sa="cquick" data-v="day" aria-pressed="${allOn}">Тренировка ${o.key[1]} во всех блоках</button>` : ""}${o.to.length ? `<button class="chip" data-sa="cquick" data-v="none">Снять выбор</button>` : ""}</div>` : ""}
      <div class="cp-grid" role="group" aria-label="Куда скопировать">${rows}</div>
      ${o.to.length ? ban("warn small cp-warn", `Силовая часть заменится целиком: ${esc(list)} — их упражнения и правки пропадут. ${isCustom() ? "" : "Разминка, интервалы, кардио и навык у них останутся свои. "} ${esc(logged)} Отменить можно сразу после — пока не внесёшь другие правки, до 3 минут.`) : `<p class="small muted cp-warn">Выбери, куда скопировать.</p>`}
      <button class="btn primary wide" data-sa="cdo" ${o.to.length ? "" : "disabled"}>${icon("copy", 20)}${o.to.length ? `${logged ? "Всё равно скопировать" : "Скопировать"} в ${o.to.length} ${plural(o.to.length, "тренировку", "тренировки", "тренировок")}` : "Скопировать"}</button>`;
    return { title: "Скопировать тренировку", html };
  }
  function updatePickList() {
    const box = $("#pickList"); if (!box || !SH.open) return;
    const body = $("#sheetBody"), y = body ? body.scrollTop : 0;
    updatePickListIn(box);
    if (body) body.scrollTop = y;
  }
  function updatePickListIn(box) {
    if (SH.kind === "replace") {
      const s = sessOf(SH.o.key), it = s.groups[SH.o.gi].items[SH.o.ii], h = PM.exHolder(it, SH.o.v || ""), planned = slotPlanned(SH.o);
      box.innerHTML = replaceListHTML(SH.o, h, planned, SH.o.mode === "today" ? daySwapOf(SH.o.key[1], planned) || planned : planned);
    } else if (SH.kind === "add") {
      const tmp = document.createElement("div"); tmp.innerHTML = sheetAdd(SH.o).html;
      box.innerHTML = tmp.querySelector("#pickList").innerHTML;
    }
  }
  /** Выбор упражнения в шторке замены. */
  function pickReplace(exId) {
    const o = SH.o, planned = slotPlanned(o);
    if (exId !== planned) pushRecent(exId);
    if (o.mode === "today") { const g = sessOf(o.key).groups[o.gi]; carryOpen(resolveItem(g.items[o.ii], ctxNow(), `${o.key}-${g.id}-${o.ii}`).exId, exId); }
    if (o.mode === "today" && (o.scope === "today" || exId === planned)) {
      const prev = S.get("daySw", null);
      setDaySwap(o.key[1], planned, exId);
      const msg = exId === planned ? `Вернул «${exName(planned)}»` : `Сегодня «${exName(exId)}» вместо «${exName(planned)}»`;
      closeSheet(msg, () => { S.set("daySw", prev); render(); });
      return;
    }
    if (exId === planned) { if (SH.stack.length) sheetBack(); else closeSheet(); return; }
    const n = PM.replace(o.key, o.gi, o.ii, o.v || "", exId, o.scope === "all");
    if (o.mode === "today") setDaySwap(o.key[1], planned, null);
    const msg = o.scope === "all" ? `«${exName(exId)}» вместо «${exName(planned)}» — ${n} ${plural(n, "место", "места", "мест")}` : `«${exName(exId)}» вместо «${exName(planned)}» в ${slotName(o.key, "dat")}`;
    // цикл нагрузки остаётся у пункта; проценты без максимума нового упражнения — напомнить
    const it2 = PM.item(o.key, o.gi, o.ii), cycNote = isCustom() && it2 && Array.isArray(it2.cyc) && it2.cyc.some((x) => x.pct != null) && !tmOf(exId) ? ". Цикл нагрузки сохранён — укажи максимум" : "";
    SH.changed = true; // после выбора шторка закрывается; «Отменить» в тосте вернёт всё, как было при её открытии
    closeSheet(msg + cycNote);
  }
  /* ---------- программы: создать, перейти, удалить, тренировки своей программы ---------- */
  /** Источник копии: встроенная — её правки (plan) и расписание (settings.days); своя — запись. */
  function srcOf(id) {
    if (id === PG.MAIN) return { id: PG.MAIN, name: BUILTIN.meta.name || "Апгрейд", plan: S.get("plan", null), wd: Array.isArray(state.settings.days) && state.settings.days.length ? state.settings.days : DEF_DAYS };
    return progsAll()[id] || null;
  }
  /** o: { kind: "blank" | "tpl" | "copy", n, tpl, name, from } → запись или null (с сообщением). */
  function createProgram(o) {
    let rec = null;
    const tpl = o.kind === "tpl" ? PG.TEMPLATES.find((x) => x.id === o.tpl) : null, src = o.kind === "copy" ? srcOf(o.from || BOUND) : null;
    const name = uniqName(o.name || (tpl ? tpl.name : src ? `${src.name || "Апгрейд"} (копия)` : "Моя программа"));
    if (o.kind === "blank") rec = PG.blank({ name, n: o.n, pw: o.pw });
    else if (tpl) rec = PG.fromTemplate(tpl, { name, version: BUILTIN.meta.version });
    else if (src) rec = PG.copyOf(src, { name });
    if (!rec) { toast("Не получилось создать программу"); return null; }
    const r = PG.add(progsAll(), rec);
    if (r.error) { toast(`Не получилось: ${r.error}`); return null; }
    S.set("progs", r.progs); injectAllX();
    return rec;
  }
  /** Отмена создания: программа удаляется, если на неё уже не перешли. */
  function undoCreate(id) { const r = PG.remove(progsAll(), id, BOUND); if (r.error) { toast(`Не получилось отменить: ${r.error}`); return; } S.set("progs", r.progs); render(); }
  /** Перейти на программу to: одна запись curprog (места всех программ лежат отдельно и не трогаются). Возвращает id прежней. */
  function switchProgram(to) {
    const from = BOUND;
    if (to === from || (to !== PG.MAIN && !progsAll()[to])) return from;
    S.set("curprog", { id: to });
    bindProgram();
    Object.assign(state, { pb: null, pd: null, qe: null, reorder: false, volBlock: null, jvol: 0 });
    state.day = resetDay();
    return from;
  }
  /** Переход из интерфейса: хаб новой программы и тост с «Отменить». */
  function doSwitch(to) {
    const from = switchProgram(to);
    if (from === to) return;
    planGo("hub");
    // отмена — только пока в новой программе ничего не записано
    const n0 = Object.keys(state.logs).filter(mineK).length;
    toast(`Теперь «${progName(to)}»`, () => {
      if (BOUND !== to || Object.keys(state.logs).filter(mineK).length !== n0) { toast("Не отменить: в программе уже есть записи"); return; }
      if (from === PG.MAIN || progsAll()[from]) { switchProgram(from); planGo("hub"); }
    }, "switch");
  }
  /** Удалить программу (не текущую и не встроенную) вместе с её местом в цикле и корректировками; журнал остаётся.
      Упражнения из базы (plan.x), которых нет у встроенной, переносятся в её plan — журнал не теряет названий.
      { name, fn } для отмены (запись, место, корректировки; перенос упражнений не откатывается) или null. */
  function deleteProgram(id) {
    const r = PG.remove(progsAll(), id, BOUND);
    if (r.error) { toast(`Не получилось: ${r.error}`); return null; }
    const pos = posAll()[id], adjAll = S.get("adjust", []) || [], adj = adjAll.filter((a) => a && a.prog === id);
    const raw = S.get("plan", null), base = raw && typeof raw === "object" ? raw : {}, add = {};
    Object.keys(r.removed.plan.x).forEach((x) => { if (!(base.x && base.x[x])) add[x] = r.removed.plan.x[x]; });
    if (Object.keys(add).length) { S.set("plan", Object.assign({ v: 1, s: {} }, base, { x: Object.assign({}, base.x, add) })); if (isMain()) PM.reload(); }
    S.set("progs", r.progs);
    if (pos) { const all = Object.assign({}, posAll()); delete all[id]; S.set("progPos", all); }
    if (adj.length) S.set("adjust", adjAll.filter((a) => !(a && a.prog === id)));
    return { name: r.removed.name, fn: () => {
      if (progsAll()[id]) return;
      saveRec(PG.patch(r.removed, {}));
      if (pos) S.set("progPos", Object.assign({}, posAll(), { [id]: pos }));
      if (adj.length) S.set("adjust", (S.get("adjust", []) || []).concat(adj));
      injectAllX(); render();
    } };
  }
  /** Сохранить название или описание из шторки «Переименовать» / «Описание»; отмена возвращает только это поле. */
  function savePField() {
    const o = SH.o, rec = progsAll()[o.id], f = $("#shPName"); if (!rec || !f) return;
    const field = o.f === "name" ? "name" : "note", old = rec[field];
    if (field === "name") {
      const v = PG.cleanName(f.value);
      if (!v) { toast("Нужно название"); f.focus(); return; }
      saveRec(PG.patch(rec, { name: v }));
    } else {
      const v = PG.cleanNote(f.value), next = PG.patch(rec, {});
      if (v) next.note = v; else delete next.note;
      saveRec(next);
    }
    if (o.id === BOUND) bindProgram();
    closeSheet(field === "name" ? "Программа переименована" : "Описание сохранено", () => {
      const cur = progsAll()[o.id]; if (!cur) return;
      const n = PG.patch(cur, {});
      if (old) n[field] = old; else delete n[field];
      saveRec(n); if (o.id === BOUND) bindProgram(); render();
    });
  }
  /** Буквы с записями журнала текущей программы на этой неделе — новой тренировке их не даём (записи не «переходят» к ней). */
  function busyLetters() {
    const idx = cycleState().idx, out = new Set();
    Object.keys(state.logs).forEach((k) => { const e = state.logs[k]; if (mineK(k) && entryHasData(e) && e.idx === idx) out.add(PG.parseLogKey(k).day); });
    return Array.from(out);
  }
  /** «＋ Добавить тренировку» в своей программе: первая свободная буква без записей этой недели, сразу экран новой тренировки. */
  /* Смена правил своей программы (в неделю, добавить или удалить тренировку) не переписывает прошлое: новые правила — с недели,
     которую показывает «Сегодня» (qa), очередь этой недели начинается с её прежней первой буквы (Programs.rebase). */
  const rebased = (old, next) => PG.rebase(old, next, qIdx());
  /** Правила (rot, qa) — как в записи src: для отмены. */
  function keepRules(next, src) { const n = Object.assign({}, next); if (src.rot) n.rot = src.rot; else delete n.rot; if (src.qa != null) n.qa = src.qa; else delete n.qa; return n; }
  /** « Очередь с этой недели: C, D, A» — если у программы уже есть записи и тренировки идут по очереди. */
  const queueNote = () => (rotNow() && Object.keys(state.logs).some((k) => mineK(k) && entryHasData(state.logs[k])) ? ` Очередь с этой недели: ${weekDays(qIdx()).join(", ")}.` : "");
  function addDayAct() {
    const rec = curRec(); if (!rec) return;
    const r = PG.addDay(rec, null, busyLetters());
    if (r.error) { toast(`Не получилось: ${r.error}`); return; }
    saveRec(rebased(rec, r.rec)); bindProgram();
    planGo("sess", { b: 1, d: r.d });
    toast(`Добавлена тренировка ${r.d}.${queueNote()}`, () => { const cur = progsAll()[rec.id]; if (!cur || cur.id !== BOUND) return; const back = PG.removeDay(cur, r.d); if (!back.error) { saveRec(keepRules(back.rec, rec)); bindProgram(); planGo("hub"); } });
  }
  /** Удалить тренировку своей программы: журнал остаётся; отмена возвращает эту тренировку (содержимое, название, день недели). */
  function removeDayAct(d) {
    const rec = curRec(); if (!rec) return;
    const r = PG.removeDay(rec, d);
    if (r.error) { toast(`Не получилось: ${r.error}`); return; }
    saveRec(rebased(rec, r.rec)); bindProgram();
    if (state.day === d) state.day = resetDay();
    planGo("hub");
    toast(`Тренировка ${d} удалена.${queueNote()}`, () => {
      const cur = progsAll()[rec.id]; if (!cur) return;
      const back = PG.restoreDay(cur, r.removed);
      if (back.error) { toast(`Не получилось отменить: ${back.error}`); return; }
      saveRec(keepRules(back.rec, rec)); if (rec.id === BOUND) { bindProgram(); planGo("hub"); } else render();
    });
  }
  function sheetAction(t) {
    const a = t.dataset.sa, v = t.dataset.v, o = SH.o;
    if (a === "close") { closeSheet(); return; }
    if (a === "back") { sheetBack(); return; }
    if (a === "noop") return;
    if (SH.kind === "account") { accountAction(a, t); return; }
    if (a === "eqset") { LIB.eq = v; LIB.limit = 40; closeSheet(false); render(); focusSel("[data-libeqopen]"); return; }
    if (a === "settings") { closeSheet(); go("settings"); const el = $("#adjust"); if (el) el.scrollIntoView({ block: "start" }); return; }
    // избранное и фильтр подбора: звезда не выбирает упражнение
    if (a === "fav") {
      const on = toggleFav(v);
      document.querySelectorAll(`#sheet .star[data-v="${v.replace(/"/g, "")}"]`).forEach((b) => { b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); b.innerHTML = starIc(on); b.setAttribute("aria-label", b.getAttribute("aria-label").replace(/^[^:]+/, on ? "Убрать из избранного" : "В избранное")); });
      if (o && o.f === "fav") updatePickList();
      return;
    }
    if (a === "pf") { o.f = v; SH.top = false; renderSheet(); return; }
    // поиск и выбор
    if (a === "pick") { pickReplace(v); return; }
    if (a === "pickds") { const x = LIB.items && LIB.items.find((i) => i.id === v); if (x) pickReplace(PM.exFromLib(x)); return; }
    if (a === "scope") { o.scope = v; renderSheet(); return; }
    if (a === "addpick") { sheetGo("addplace", { ex: v, b: o.b, d: o.d, scope: o.scope, tier: o.tier, f: o.f, fix: o.fix }); return; }
    if (a === "addpickds") {
      const x = LIB.items && LIB.items.find((i) => i.id === v); if (!x) return;
      const pid = PM.progOf(x.id);
      sheetGo("addplace", Object.assign(pid ? { ex: pid } : { ds: x }, { b: o.b, d: o.d, scope: o.scope, tier: o.tier, f: o.f, fix: o.fix }));
      return;
    }
    // добавление
    if (SH.kind === "addplace") {
      if (a === "ad") o.d = v;
      else if (a === "ab") { o.b = +v; o.scope = "here"; }
      else if (a === "ascope") o.scope = v;
      else if (a === "awhere") o.where = true;
      else if (a === "aplace") o.place = v === "new" ? "new" : +v;
      else if (a === "atier") o.tier = v;
      else if (a === "asets") o.sets = Math.max(1, Math.min(10, o.sets + +v));
      else if (a === "areps") o.reps = v;
      else if (a === "arir") o.rir = v;
      else if (a === "adddo" || a === "addmore") {
        const exId = o.ex || PM.exFromLib(o.ds), sec = EX[exId].unit === "sec";
        pushRecent(exId);
        const params = { sets: o.sets, reps: o.reps || (sec ? "30–40 с" : "10–12"), rir: sec || !o.rir ? null : o.rir };
        const keys = o.scope === "all" ? blocks().map((b) => `${b.id}${o.d}`) : [`${o.b}${o.d}`];
        let pos = null;
        keys.forEach((k) => { const r = PM.add(k, exId, params, k === `${o.b}${o.d}` && o.place !== "new" ? +o.place : "new", o.tier); if (k === `${o.b}${o.d}` || !pos) pos = r; });
        if (state.tab === "plan") { state.pv = "sess"; state.pb = o.scope === "all" ? state.pb || o.b : o.b; state.pd = o.d; state.flash = pos ? `${pos.gi}:${pos.ii}` : null; }
        SH.changed = true; SH.added = (SH.added || 0) + 1;
        const msg = SH.added > 1 ? `Добавлено упражнений: ${SH.added}` : `Добавлено «${exName(exId)}»: ${o.scope === "all" ? `тренировка ${o.d} во всех блоках` : slotName(`${o.b}${o.d}`)}`;
        if (a === "adddo") { closeSheet(msg); return; }
        // «Добавить и выбрать ещё»: назад к поиску, тренировка и блок запоминаются, место — снова «отдельно, в конец»
        SH.msg = msg;
        const next = { b: o.b, d: o.d, scope: o.scope, tier: o.tier, f: o.f, last: exName(exId), fix: o.fix && !o.where };
        const prev = SH.stack[SH.stack.length - 1];
        if (prev && prev.kind === "add") { Object.assign(prev.o, next); sheetBack(); }
        else { SH.stack = []; Object.assign(SH, { kind: "add", o: next, q: "", top: true }); renderSheet(); }
        render();
        const sq = $("#sheet [data-sq]"); if (sq) { sq.value = ""; sq.focus({ preventScroll: true }); }
        return;
      }
      SH.top = false; renderSheet(); if (a === "asets" || a === "areps" || a === "arir") refocusQe(t, "#sheetBody"); return;
    }
    // меню программы
    if (SH.kind === "prog") {
      const id = o.id || BOUND;
      if (a === "pren" || a === "pnote") { sheetGo("pedit", { id, f: a === "pren" ? "name" : "note" }); focusSel("#shPName"); return; }
      if (a === "pdup") { const rec = createProgram({ kind: "copy", from: id }); if (rec) { closeSheet(false); render(); toast(`Создана «${rec.name}»`, () => undoCreate(rec.id)); } return; }
      if (a === "pgoto") { sheetGo("pswitch", { id: v }); return; }
      if (a === "preset") { o.arm = "reset"; SH.top = false; renderSheet(); const b = $("#sheet [data-sa='presetdo']"); if (b) b.focus({ preventScroll: true }); return; }
      if (a === "pdel") { o.arm = "del"; SH.top = false; renderSheet(); const b = $("#sheet [data-sa='pdeldo']"); if (b) b.focus({ preventScroll: true }); return; }
      if (a === "preset0") { o.arm = null; SH.top = false; renderSheet(); return; }
      if (a === "presetdo") { const undo = resetAllEdits(); closeSheet("Программа снова как в исходной версии", undo); return; }
      if (a === "pdeldo") { const undo = deleteProgram(id); closeSheet(false); render(); if (undo) toast(`Программа «${undo.name}» удалена`, undo.fn); return; }
      return;
    }
    if (SH.kind === "pedit" && a === "pfsave") { savePField(); return; }
    if (SH.kind === "grpick" && a === "grto") {
      const s = sessOf(o.key), it = s.groups[o.gi] && s.groups[o.gi].items[o.ii]; if (!it) { closeSheet(); return; }
      const nm = exName(PM.exIds(it)[0]), target = v === "new" ? null : s.groups[+v];
      const msg = target ? `«${nm}» — в суперсете с ${grpWith(target)}` : `«${nm}» — отдельно`;
      const pos = PM.toGroup(o.key, o.gi, o.ii, v === "new" ? "new" : +v);
      if (pos) { state.flash = `${pos.gi}:${pos.ii}`; SH.changed = true; }
      closeSheet(pos ? msg : false);
      return;
    }
    if (SH.kind === "wdpick" && a === "wdset") {
      const rec = curRec(), wd = o.wd; if (!rec) { closeSheet(false); return; }
      let r = { rec };
      if (v) r = PG.setWd(rec, v, wd);
      else { const d = dayOnWd(wd); if (d) r = PG.setWd(rec, d, null); }
      if (!r.error) { saveRec(r.rec); state.day = resetDay(); }
      closeSheet(false); focusSel(`[data-wcell="${wd}"]`);
      return;
    }
    if (SH.kind === "pswitch" && a === "pswitchdo") { const id = o.id; closeSheet(false); doSwitch(id); return; }
    if (SH.kind === "pnew" && a === "pnkind") { if (v === "tpl") sheetGo("ptpl", {}); else sheetGo("pnew2", { kind: v }); return; }
    if (SH.kind === "ptpl" && a === "pntpl") { sheetGo("pnew2", { kind: "tpl", tpl: v }); return; }
    if (SH.kind === "pnew2") {
      if (a === "pnn") { const was = o.n; o.n = Math.max(1, Math.min(PG.MAX_DAYS, (o.n || 3) + +v)); if (o.pw >= was || o.pw > o.n) o.pw = o.n; SH.top = false; renderSheet(); focusSel(`#sheet [data-sa="pnn"][data-v="${v}"]`, '#sheet [data-sa="pnn"]'); return; }
      if (a === "pnpw") { o.pw = Math.max(1, Math.min(o.n, (o.pw || o.n) + +v)); SH.top = false; renderSheet(); focusSel(`#sheet [data-sa="pnpw"][data-v="${v}"]`, '#sheet [data-sa="pnpw"]'); return; }
      if (a === "pnewdo") {
        const f = $("#shPNew"); if (f) o.name = f.value;
        const rec = createProgram({ kind: o.kind, tpl: o.tpl, n: o.n, pw: o.pw, name: o.name, from: BOUND });
        if (!rec) return;
        closeSheet(false);
        if (v === "go") doSwitch(rec.id);
        else { render(); toast(`Программа «${rec.name}» создана — перейти можно в «Все программы»`, () => undoCreate(rec.id)); }
        return;
      }
    }
    if (SH.kind === "tm") { if (a === "tmsave") { saveTmSheet(); return; } if (a === "tmdel") { const ex = o.ex, old = tmOf(ex); saveTm(ex, null); closeSheet("Максимум убран", () => { saveTm(ex, old); render(); }); return; } return; }
    if (SH.kind === "cyc") { cycAction(a, v, t); return; }
    // тренировка целиком
    if (SH.kind === "day") {
      const name = slotName(o.key);
      if (a === "dcopy") { sheetGo("copy", { key: o.key, to: [] }); return; }
      if (a === "dclear") { o.arm = "clear"; SH.top = false; renderSheet(); const b = $("#sheet [data-sa='dcleardo']"); if (b) b.focus({ preventScroll: true }); return; }
      if (a === "dclear0") { o.arm = null; SH.top = false; renderSheet(); return; }
      if (a === "dcleardo") {
        const snap = PM.snapshot(), msg = `${name[0].toUpperCase()}${name.slice(1)} очищена`;
        PM.clear(o.key); setPlanUndo(snap, msg); closeSheet(false); return; // отмена — баннером в «Плане», без тоста
      }
      if (a === "dreset") { o.arm = "reset"; SH.top = false; renderSheet(); const b = $("#sheet [data-sa='dresetdo']"); if (b) b.focus({ preventScroll: true }); return; }
      if (a === "dresetdo") {
        const snap = PM.snapshot(), msg = `Тренировка ${o.key[1]}, блок ${o.key[0]} — снова как в программе`;
        PM.reset(o.key); setPlanUndo(snap, msg); closeSheet(false); return;
      }
      if (a === "dtitle0") { PM.setTitle(o.key, ""); sheetChanged("Название — как в программе"); return; }
      if (a === "ddel") { o.arm = "del"; SH.top = false; renderSheet(); const b = $("#sheet [data-sa='ddeldo']"); if (b) b.focus({ preventScroll: true }); return; }
      if (a === "ddeldo") { const d = o.key[1]; closeSheet(false); removeDayAct(d); return; }
      return;
    }
    if (SH.kind === "copy") {
      if (a === "cto") { o.to = o.to.includes(v) ? o.to.filter((k) => k !== v) : o.to.concat(v); }
      else if (a === "cquick") {
        const day = blocks().map((bl) => `${bl.id}${o.key[1]}`).filter((k) => k !== o.key);
        o.to = v === "none" || day.every((k) => o.to.includes(k)) ? (v === "none" ? [] : o.to.filter((k) => !day.includes(k))) : Array.from(new Set(o.to.concat(day)));
      } else if (a === "cdo" && o.to.length) {
        const to = o.to.slice().sort(), snap = PM.snapshot(), n = PM.copy(o.key, to);
        const msg = `Скопировано: ${slotName(o.key)} → ${to.map((k) => slotName(k)).join("; ")}${n !== to.length ? ` (${n})` : ""}`;
        setPlanUndo(snap, msg); closeSheet(false);
        return;
      }
      SH.top = false; renderSheet();
      const f = t.dataset.v && $(`#sheet [data-sa="${a}"][data-v="${t.dataset.v}"]`); if (f) f.focus({ preventScroll: true });
      return;
    }
    // пункт программы
    if (SH.kind === "item" || SH.kind === "swapwith") {
      const s = sessOf(o.key), it = s.groups[o.gi] && s.groups[o.gi].items[o.ii];
      if (!it) { closeSheet(); return; }
      const vs = PM.variants(it), vk = (vs.find((x) => x.key === o.v) || vs[0]).key, p = PM.paramHolder(it, vk);
      if (a === "var") { o.v = v; SH.top = false; renderSheet(); return; }
      if (a === "unit") {
        const id = PM.exHolder(it, vk).ex; PM.setUnit(id, v);
        if (v === "sec" && !/с$/.test(String(p.reps || ""))) PM.setParams(o.key, o.gi, o.ii, vk, { reps: "30–40 с", rir: null });
        else if (v !== "sec" && /с$/.test(String(p.reps || ""))) PM.setParams(o.key, o.gi, o.ii, vk, { reps: "10–12", rir: "1–2" });
        sheetChanged(); return;
      }
      if (a === "replace") { sheetGo("replace", { key: o.key, gi: o.gi, ii: o.ii, v: vk, mode: "plan" }); return; }
      if (a === "grpick") { sheetGo("grpick", { key: o.key, gi: o.gi, ii: o.ii }); return; }
      if (a === "params") { const { gi, ii } = o; closeSheet(); qeShow(gi, ii, vk); return; }
      if (a === "revert") { PM.revert(o.key, o.gi, o.ii, vk); sheetChanged(); return; }
      if (a === "sets" || a === "reps" || a === "rir") {
        PM.setParams(o.key, o.gi, o.ii, vk, a === "sets" ? { sets: (p.sets || 1) + +v } : { [a]: v });
        sheetChanged(); refocusQe(t, "#sheetBody"); return;
      }
      if (a === "move") {
        const pos = PM.move(o.key, o.gi, o.ii, +v);
        if (pos) { Object.assign(o, pos); state.flash = `${pos.gi}:${pos.ii}`; sheetChanged(); }
        return;
      }
      if (a === "togroup") {
        const pos = PM.toGroup(o.key, o.gi, o.ii, v === "new" ? "new" : +v);
        if (pos) { Object.assign(o, pos); state.flash = `${pos.gi}:${pos.ii}`; sheetChanged(); }
        return;
      }
      if (a === "swapwith") { sheetGo("swapwith", { key: o.key, gi: o.gi, ii: o.ii }); return; }
      if (a === "swapto") {
        const [gi, ii] = v.split(":").map(Number), L = groupNums(s.groups);
        const msg = `Поменяли местами ${codeOf(s.groups, L, o.gi, o.ii)} и ${codeOf(s.groups, L, gi, ii)}`;
        PM.swapWith(o.key, { gi: o.gi, ii: o.ii }, { gi, ii });
        state.flash = `${gi}:${ii}`; SH.changed = true;
        closeSheet(msg); return;
      }
      if (a === "remove") { const nm = exName(PM.exIds(it)[0]); PM.remove(o.key, o.gi, o.ii); SH.changed = true; closeSheet(`Убрано «${nm}»`); return; }
    }
    // связка
    if (SH.kind === "group") {
      if (a === "tier") { PM.setGroup(o.key, o.gi, { tier: v }); sheetChanged(); return; }
      if (a === "rest") { PM.setGroup(o.key, o.gi, { rest: v }); sheetChanged(); return; }
      if (a === "rounds") { const g = sessOf(o.key).groups[o.gi]; PM.setGroup(o.key, o.gi, { rounds: (g.rounds || 3) + +v }); sheetChanged(); return; }
      if (a === "gmove") { const t2 = PM.moveGroup(o.key, o.gi, +v); if (t2 != null) { o.gi = t2; sheetChanged(); } return; }
      if (a === "split") { PM.split(o.key, o.gi); SH.changed = true; closeSheet("Связка разделена"); return; }
      if (a === "gremove") { PM.removeGroup(o.key, o.gi); SH.changed = true; closeSheet("Связка убрана"); return; }
    }
  }
  /** Действия шторки цикла нагрузки: каждая правка — сразу в программу (отмена — в тосте после закрытия). */
  function cycAction(a, v, t) {
    const o = SH.o, it = PM.item(o.key, o.gi, o.ii);
    if (!cycOk(it)) { closeSheet(); return; }
    const steps = it.cyc ? JSON.parse(JSON.stringify(it.cyc)) : null, set = (c) => { if (PM.setCyc(o.key, o.gi, o.ii, c)) SH.changed = true; };
    if (a === "cycpre" && CYC_PRE[v]) { set(CYC_PRE[v][1]); o.open = null; SH.msg = `Цикл нагрузки: ${CYC_PRE[v][0]}`; }
    else if (a === "cycown") { const b = { sets: it.sets || 3, reps: it.reps || "8–12" }; if (it.rir != null && it.rir !== "") b.rir = it.rir; set([b, Object.assign({}, b)]); o.open = 1; }
    else if (a === "cycstep") o.open = o.open === +v ? null : +v;
    else if (a === "cycadd" && steps) { steps.push(Object.assign({}, steps[steps.length - 1])); set(steps); o.open = steps.length - 1; }
    else if (a === "cycdel" && steps && o.open != null && steps.length > PM_MIN) { steps.splice(o.open, 1); set(steps); o.open = null; }
    else if (a === "cycoff") { set(null); closeSheet("Цикл нагрузки убран"); return; }
    else if (/^cs_/.test(a) && steps && o.open != null && steps[o.open]) {
      const st = steps[o.open];
      if (a === "cs_sets") st.sets = Math.max(1, Math.min(10, (st.sets || 1) + +v));
      else if (a === "cs_reps") st.reps = v;
      else if (a === "cs_rir") { if (v) st.rir = v; else delete st.rir; }
      else if (a === "cs_pct") { if (v === "") delete st.pct; else st.pct = +v; }
      set(steps);
    } else return;
    SH.top = false; render(); renderSheet();
    if (t && (t.dataset.qb || a === "cs_reps" || a === "cs_rir")) refocusQe(t, "#sheetBody");
    else if (a === "cycstep") focusSel(`#sheet [data-sa="cycstep"][data-v="${v}"]`);
  }
  function sheetField(t) {
    const o = SH.o, f = t.dataset.sf, af = t.dataset.af;
    const mark = () => { const box = t.closest(".fld"); if (box) box.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.v === normDash(t.value.trim()))); };
    const redraw = (kind) => afterTap(() => { if (SH.open && SH.kind === kind) { SH.top = false; renderSheet(); } });
    if (af && SH.kind === "addplace") { o[af] = normDash(t.value.trim()); mark(); redraw("addplace"); return; }
    if (!f) return;
    if (SH.kind === "day") {
      if (f === "title") { PM.setTitle(o.key, t.value); SH.changed = true; SH.msg = t.value.trim() ? "Тренировка переименована" : "Название — как в программе"; afterTap(() => { render(); if (SH.open && SH.kind === "day") { SH.top = false; renderSheet(); } }); }
      return;
    }
    if (SH.kind === "cyc") {
      const o2 = SH.o, it = PM.item(o2.key, o2.gi, o2.ii); if (!cycOk(it) || !it.cyc) return;
      if (f === "tm") { const kg = t.value.trim() ? parseKg(t.value) : null; if (t.value.trim() && kg == null) { toast("Нужен вес от 1 до 1000 кг"); return; } saveTm(it.ex, kg); SH.changed = true; redraw("cyc"); render(); }
      if (f === "cyreps" && o2.open != null) { const c = JSON.parse(JSON.stringify(it.cyc)); if (t.value.trim()) { c[o2.open].reps = t.value.trim(); if (PM.setCyc(o2.key, o2.gi, o2.ii, c)) SH.changed = true; render(); redraw("cyc"); } }
      return;
    }
    if (SH.kind === "group") { if (f === "rest") { PM.setGroup(o.key, o.gi, { rest: t.value }); SH.changed = true; render(); mark(); } return; }
    if (SH.kind !== "item") return;
    const it = sessOf(o.key).groups[o.gi].items[o.ii], vs = PM.variants(it), vk = (vs.find((x) => x.key === o.v) || vs[0]).key;
    if (f === "myo") { PM.setParams(o.key, o.gi, o.ii, vk, { myo: t.checked }); sheetChanged(); return; }
    PM.setParams(o.key, o.gi, o.ii, vk, { [f]: t.value });
    SH.changed = true; render(); mark();
    if (f === "reps") redraw("item"); // поля −/+ и готовые диапазоны — по новому значению, после нажатия
  }
  let sqTimer = null;
  function mountOverlays() {
    document.body.insertAdjacentHTML("beforeend", `
      <div class="sheet" id="sheet" hidden>
        <div class="sheet-bg" data-sa="close"></div>
        <div class="sheet-p" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
          <div class="sheet-grab" aria-hidden="true"><i></i></div>
          <div class="sheet-h"><button class="icon-btn sheet-back" id="sheetBack" data-sa="back" aria-label="Назад" hidden>${icon("arrow-left", 22)}</button><h2 class="sheet-t" id="sheetTitle" tabindex="-1"></h2><button class="icon-btn" data-sa="close" aria-label="Закрыть">${icon("x", 22)}</button></div>
          <div class="sheet-b" id="sheetBody"></div>
        </div>
      </div>
      <div class="login" id="login" role="dialog" aria-modal="true" aria-labelledby="lgTitle" hidden></div>
      <div class="toast" id="toast" role="status" aria-live="polite" hidden><span id="toastIc"></span><span id="toastT"></span><button class="btn" data-toastundo="1" hidden>${icon("undo", 18)}Отменить</button></div>`);
    const sh = $("#sheet");
    sh.addEventListener("click", (e) => { const t = e.target.closest("[data-sa]"); if (t && !t.disabled) sheetAction(t); });
    sh.addEventListener("change", (e) => { if (e.target.matches("[data-sf],[data-af]")) sheetField(e.target); });
    sh.addEventListener("input", (e) => {
      const t = e.target;
      if (t.dataset.sq) { clearTimeout(sqTimer); sqTimer = setTimeout(() => { SH.q = t.value; updatePickList(); }, 120); }
      else if (t.dataset.af && SH.kind === "addplace") SH.o[t.dataset.af] = t.value.trim();
      else if (t.dataset.pf === "newname" && SH.kind === "pnew2") SH.o.name = t.value;
      else if (t.dataset.pf && SH.kind === "pedit") SH.o.v = t.value;
      if (t.dataset.cnt) { const c = t.parentElement.querySelector(".cnt"); if (c) c.textContent = c.textContent.replace(/^\d+/, String(t.value.length)); }
      else if (t.dataset.sf === "title" && SH.kind === "day") { PM.setTitle(SH.o.key, t.value); SH.changed = true; SH.msg = t.value.trim() ? "Тренировка переименована" : "Название — как в программе"; }
    });
    sh.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || !e.target.matches(".inp") || e.target.tagName === "TEXTAREA") return;
      e.preventDefault(); e.target.blur();
      if (e.target.dataset.pf === "name" && SH.kind === "pedit") { savePField(); return; }
      if (e.target.dataset.tmf && SH.kind === "tm") { saveTmSheet(); return; }
      // переименование: «Готово» на клавиатуре — название сохранено, шторка закрывается
      if (e.target.dataset.sf === "title" && SH.kind === "day") { PM.setTitle(SH.o.key, e.target.value); SH.changed = true; closeSheet(e.target.value.trim() ? "Тренировка переименована" : "Название — как в программе"); }
    });
    // смахнуть шторку вниз
    let sw = null;
    sh.addEventListener("pointerdown", (e) => {
      if (!e.target.closest(".sheet-grab,.sheet-h") || e.target.closest("button")) return;
      sw = { y: e.clientY, id: e.pointerId, dy: 0, p: sh.querySelector(".sheet-p") };
      sw.p.style.transition = "none";
      try { sh.setPointerCapture(e.pointerId); } catch (err) { /* ок */ }
    });
    sh.addEventListener("pointermove", (e) => { if (!sw || e.pointerId !== sw.id) return; sw.dy = Math.max(0, e.clientY - sw.y); sw.p.style.transform = `translateY(${sw.dy}px)`; });
    const endSw = (e) => { if (!sw || e.pointerId !== sw.id) return; const { p, dy } = sw; sw = null; p.style.transition = ""; p.style.transform = ""; if (dy > 90) closeSheet(); };
    sh.addEventListener("pointerup", endSw); sh.addEventListener("pointercancel", endSw);
    const lg = $("#login");
    lg.addEventListener("submit", (e) => { e.preventDefault(); loginSubmit(); });
    lg.addEventListener("click", (e) => { const b = e.target.closest("[data-lg]"); if (b && !b.disabled) loginAction(b.dataset.lg); });
    lg.addEventListener("input", (e) => {
      const t = e.target;
      if (t.id === "lgEmail") { LG.email = t.value; if (LG.err) loginMsg("", false); return; }
      if (t.id !== "lgCode") return;
      const v = t.value.replace(/\D/g, "").slice(0, 8);
      if (v !== t.value) t.value = v;
      LG.code = v;
      if (LG.err) loginMsg("", false);
      if (v.length === 6 && !LG.busy) loginSubmit(); // код Neon Auth — 6 цифр: входим без лишнего нажатия
    });
    $("#toast").addEventListener("click", (e) => { if (e.target.closest("[data-toastundo]") && toastUndo) { const u = toastUndo; hideToast(); u(); } });
  }

  /* ---------- сообщение с отменой ---------- */
  let toastTimer = null, toastUndo = null, toastTag = "";
  /** Сообщение с «Отменить»; tag — что отменяется ("switch" — переход: после записи подхода отмену не предлагаем). */
  function toast(msg, undo, tag) {
    const el = $("#toast"); if (!el) return;
    $("#toastT").textContent = msg; toastUndo = undo || null; toastTag = tag || "";
    $("#toastIc").innerHTML = icon(/^(Не |Отменять уже|План уже|План обновился)/.test(msg) ? "info" : "check-circle", 20);
    el.querySelector("[data-toastundo]").hidden = !undo;
    el.hidden = false; requestAnimationFrame(() => el.classList.add("on"));
    clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 5000);
  }
  function hideToast() {
    const el = $("#toast"); if (!el) return;
    el.classList.remove("on"); toastUndo = null; toastTag = ""; clearTimeout(toastTimer);
    setTimeout(() => { if (!el.classList.contains("on")) el.hidden = true; }, 220);
  }

  /* ---------- перетаскивание в режиме «Порядок» ---------- */
  let drag = null, scrollRAF = 0;
  function dragTo(y) {
    const { row, list } = drag;
    let before = null;
    for (const r of Array.from(list.children)) { if (r === row) continue; const b = r.getBoundingClientRect(); if (y < b.top + b.height / 2) { before = r; break; } }
    if (before && before === list.firstElementChild) before = before.nextElementSibling; // выше первой связки нельзя
    if (before === row) return;
    if (before ? row.nextElementSibling !== before : list.lastElementChild !== row) { list.insertBefore(row, before); drag.moved = true; }
  }
  function autoScroll() {
    cancelAnimationFrame(scrollRAF);
    const step = () => {
      if (!drag) return;
      const y = drag.y, top = 110, bottom = window.innerHeight - 150;
      const dy = y < top ? -Math.ceil((top - y) / 5) : y > bottom ? Math.ceil((y - bottom) / 5) : 0;
      if (dy) { window.scrollBy(0, dy); dragTo(y); scrollRAF = requestAnimationFrame(step); }
    };
    scrollRAF = requestAnimationFrame(step);
  }
  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const { row, list, moved } = drag;
    drag = null; cancelAnimationFrame(scrollRAF);
    row.classList.remove("dragging"); list.classList.remove("dragging");
    if (!moved) return;
    const layout = []; let cur = null;
    Array.from(list.children).forEach((r) => {
      if (r.classList.contains("ro-g")) { cur = { gi: +r.dataset.gi, items: [] }; layout.push(cur); }
      else if (cur) cur.items.push([+r.dataset.gi, +r.dataset.ii]);
    });
    let flash = null;
    layout.forEach((g) => g.items.forEach(([a, b], idx) => {
      if (a === +row.dataset.gi && b === +row.dataset.ii) flash = `${g.gi - layout.filter((x) => x.gi < g.gi && !x.items.length).length}:${idx}`;
    }));
    PM.arrange(list.dataset.key, layout);
    state.flash = flash;
    render();
    state.flash = null;
  }
  document.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".drag-h"); if (!h) return;
    const row = h.closest(".ro-i"), list = h.closest("#roList"); if (!row || !list) return;
    e.preventDefault();
    drag = { row, list, id: e.pointerId, y: e.clientY, moved: false };
    row.classList.add("dragging"); list.classList.add("dragging");
    try { list.setPointerCapture(e.pointerId); } catch (err) { /* без захвата тоже работает */ }
  });
  document.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    drag.y = e.clientY; dragTo(drag.y); autoScroll();
  }, { passive: false });
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", endDrag);

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
  /** Добавленным из базы раньше не хватало оборудования (ds.eq) — дополнить в памяти; в план попадёт со следующей правкой. */
  let eqPending = false;
  const needEq = () => Object.values(PM.customs()).some((d) => d && d.ds && d.ds.id && !d.ds.eq);
  function backfillEq() {
    if (!LIB.items) return;
    Object.values(PM.customs()).forEach((d) => { if (d && d.ds && d.ds.id && !d.ds.eq) { const x = libById(d.ds.id); if (x && x.eq) d.ds.eq = x.eq; } });
  }
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
        LIB.loading = false; backfillEq(); if (state.tab === "library") render(); else if (state.tab === "today" && eqPending) { eqPending = false; softRender(); }
        updatePickList();
      })
      .catch((e) => { LIB.loading = false; LIB.error = String(e.message || e); if (state.tab === "library") render(); updatePickList(); });
  }
  // Поиск по русскому и английскому названию, мышцам, оборудованию; «е» находит «ё».
  // Порядок: название начинается с запроса → запрос с начала слова → все слова в названии с начала слов →
  // все слова где-то в названии («жим» внутри «отжиманий») → английское название → остальное
  // (по доле слов в названии и совпадению целевой мышцы).
  /** ds-id упражнений, которые сейчас стоят в программе (с учётом правок). */
  function usedDs() {
    const out = new Set();
    PM.usedIds().forEach((id) => { const e = EX[id]; if (e && e.ds) out.add(e.ds.id); });
    return out;
  }
  function libFiltered(qArg, any) {
    const raw = qArg != null ? qArg : LIB.q;
    const q = fold(raw.trim()).replace(/\s+/g, " "), words = q ? q.split(" ").map(stem) : [];
    const used = !any && LIB.bp === "prog" ? usedDs() : null;
    const fav = !any && LIB.bp === "fav" ? new Set(favs()) : null;
    const out = [];
    LIB.items.forEach((x) => {
      if (!any) {
        if (used && !used.has(x.id)) return;
        if (fav && !fav.has(libKey(x.id))) return;
        if (LIB.bp !== "all" && LIB.bp !== "prog" && LIB.bp !== "fav" && x.bp !== LIB.bp) return;
        if (LIB.eq !== "all" && x.eq !== LIB.eq) return;
      }
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
  /* Строка базы: сама строка открывает карточку, звезда — рядом с ней (не внутри), у обоих свой фокус. */
  function libRow(x) {
    const inProg = LIB.used && LIB.used.has(x.id), names = progByDs[x.id];
    return `<div class="lib-item"><div class="lib-row" data-libid="${x.id}" role="button" tabindex="0" aria-expanded="false">${tileHTML(BP_GROUP[x.bp] || null)}<div>
      <div class="lib-n">${esc(libName(x))}${inProg ? ` <span class="tag now">${icon("check", 14)}в программе</span>` : ""}</div>
      <div class="lib-m">${esc(ru(MU_RU, x.t))} · ${esc(ru(EQ_RU, x.eq))}${names ? ` · ${esc(names.join(", "))}` : ""}</div></div></div>${starBtn(libKey(x.id), libName(x), "data-fav")}</div>`;
  }
  /** Упражнение программы без однозначной записи базы (в избранном) — та же строка, карточка как на «Сегодня». */
  function libProgRow(id) {
    const e = EX[id];
    return `<div class="lib-item"><div class="lib-row" data-libprog="${esc(id)}" role="button" tabindex="0" aria-expanded="false">${tileHTML(exGroup(id))}<div>
      <div class="lib-n">${esc(e.n)} <span class="tag now">${icon("check", 14)}в программе</span></div>
      <div class="lib-m">${esc(musclesText(id).split(" · ")[0] || "упражнение программы")}</div></div></div>${starBtn(id, e.n, "data-fav")}</div>`;
  }
  function libProgDetail(id) {
    const ex = EX[id], on = isFav(id);
    const cues = (ex.cues || []).length ? `<div class="how-sub">Важно для тебя</div><ul>${ex.cues.map((c) => `<li>${rich(c)}</li>`).join("")}</ul>` : "";
    return `<div class="lib-d">
      <div class="lib-acts"><button class="btn lib-fav${on ? " on" : ""}" data-fav="${esc(id)}" aria-pressed="${on}">${favLab(on)}</button></div>
      ${cues}${ex.why ? `<div class="why">${rich(ex.why)}</div>` : ""}${dsHTML(ex)}</div>`;
  }
  /** Строка избранного по ключу: запись базы (если ключ к ней однозначно ведёт), иначе упражнение программы. */
  function favLibRow(k) {
    const e = EX[k], dsId = /^ds_/.test(k) ? k.slice(3) : e && e.ds && PM.progOf(e.ds.id) === k ? e.ds.id : null;
    const x = dsId && libById(dsId);
    if (x) return { html: libRow(x), name: libName(x), hay: `${x._r} ${x._n} ${x._h}`, eq: x.eq };
    if (e) return { html: libProgRow(k), name: e.n, hay: fold(`${e.n} ${musclesText(k)}`), eq: null };
    return null;
  }
  function libDetail(x) {
    // действия — сверху карточки: в тренировку, избранное, анимация; ниже — описание и шаги базы
    const k = libKey(x.id), on = isFav(k), stem = `${x.id}-${x.m}`;
    return `<div class="lib-d">
      <div class="lib-acts"><button class="btn tonal" data-libadd="${esc(x.id)}">${icon("plus", 18)}В тренировку</button><button class="btn lib-fav${on ? " on" : ""}" data-fav="${esc(k)}" aria-pressed="${on}">${favLab(on)}</button>${x.m && !state.media ? `<button class="btn" data-showmedia="${esc(stem)}" data-alt="${esc(libName(x))}" data-into=".lib-media">${icon("image", 18)}Анимация</button>` : ""}</div>
      <div class="lib-media">${state.media ? mediaBlock(stem, libName(x)) : ""}</div>
      <div class="small muted">Зона: ${esc(ru(BP_RU, x.bp))} · цель: ${esc(ru(MU_RU, x.t))}${x.sec.length ? ` · помогают: ${esc(x.sec.map((m) => ru(MU_RU, m)).join(", "))}` : ""} · ${esc(ru(EQ_RU, x.eq))}</div>
      <ol>${x.s.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      ${x.r ? `<div class="small muted en">Оригинал: <span lang="en">${esc(x.n)}</span></div>` : ""}</div>`;
  }
  /** Пустое состояние: крупная иконка в мягком круге, заголовок, 1–2 строки, кнопка (по желанию). */
  const emptyHTML = (ic, title, text, btn, cls) => `<div class="empty${cls ? " " + cls : ""}"><span class="empty-ic">${icon(ic, 28)}</span><b>${title}</b>${text ? `<p>${text}</p>` : ""}${btn || ""}</div>`;
  function libListHTML() {
    if (!LIB.items) return LIB.error ? emptyHTML("wifi", "Не получилось загрузить базу", `${esc(LIB.error)}. При первом открытии нужна сеть.`) : `<div class="empty">Загружаю базу упражнений…</div>`;
    LIB.used = usedDs();
    if (LIB.bp === "fav") {
      const all = favs();
      if (!all.length) return emptyHTML("star", "Избранного пока нет", "Нажми на звезду у упражнения — оно появится здесь и первым в списке, когда добавляешь упражнение в тренировку.", "", "lib-favempty");
      const words = fold(LIB.q.trim()).split(/\s+/).filter(Boolean).map(stem);
      const rows = all.map(favLibRow).filter((r) => r && words.every((w) => r.hay.includes(w)) && (LIB.eq === "all" || r.eq === LIB.eq));
      return `<div class="small muted" style="margin:4px 0 8px">В избранном: ${rows.length}</div>${rows.length ? `<div class="lib-list">${rows.map((r) => r.html).join("")}</div>` : emptyHTML("search", "Ничего не нашлось", "Попробуй короче или по-английски.")}`;
    }
    const f = libFiltered();
    const rows = f.slice(0, LIB.limit).map(libRow).join("");
    return `<div class="small muted" style="margin:4px 0 8px">Найдено: ${f.length}</div>${rows ? `<div class="lib-list">${rows}</div>` : emptyHTML("search", "Ничего не нашлось", "Попробуй короче, по-английски или сбрось фильтр.")}
      ${f.length > LIB.limit ? `<button class="btn" style="width:100%;margin-top:10px" data-libmore="1">${icon("chevron-down", 18)}Показать ещё</button>` : ""}`;
  }
  function renderLibrary() {
    loadLib();
    const bps = [["all", "Все"], ["fav", "Избранное"], ["prog", "В программе"]].concat(BPS);
    // «Оборудование» — чип в том же ряду; по касанию — шторка с вариантами
    const eqChip = `<button class="chip${LIB.eq !== "all" ? " on" : ""}" data-libeqopen="1" aria-haspopup="dialog">${icon("dumbbell", 16)}${LIB.eq === "all" ? "Оборудование" : esc(ru(EQ_RU, LIB.eq))}${icon("chevron-down", 16)}</button>`;
    return `
      <div class="lib-tools">
        <div class="search-w">${icon("search", 20)}<input type="search" class="search" placeholder="Название или мышца" value="${esc(LIB.q)}" data-libq="1" aria-label="Поиск упражнения"></div>
        <div class="chips" role="group" aria-label="Фильтр">${bps.map(([k, n]) => `<button class="chip ${LIB.bp === k ? "on" : ""}" data-libbp="${k}" aria-pressed="${LIB.bp === k}">${k === "fav" ? icon(LIB.bp === k ? "star-fill" : "star", 16) : ""}${n}</button>`).join("")}${eqChip}</div>
      </div>
      <div id="libList">${libListHTML()}</div>
      <p class="small muted" style="margin-top:14px">База: <a class="a-tall" href="https://github.com/hasaneyldrm/exercises-dataset" target="_blank" rel="noopener">exercises-dataset</a> — 1324 упражнения, инструкции на русском (данные по лицензии MIT). Названия перевели для приложения, искать можно и по-английски. Анимации — ${GV}; в приложение не скопированы и подгружаются по ссылке, только если ты их включишь.</p>`;
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
  /** Строка-ссылка: цветная плитка-иконка, заголовок, подпись, шеврон. item = [tab, заголовок, подпись, иконка, класс цвета]. */
  const rowLink = ([id, t, d, ic, cls, attr]) => `<button class="row-link menu-i" data-${attr || "tab"}="${id}"><span class="rl-ic ${cls || ""}">${icon(ic, 22)}</span><span class="rl-t"><b>${esc(t)}</b><small>${esc(d)}</small></span>${icon("chevron-right", 20)}</button>`;
  function renderMore() {
    const n = Object.keys(P.sources).length;
    const bodyMenu = P.meta.bodyMenu || ["Суставы и сигналы", "Светофор нагрузки, красные флаги"];
    const items = [["cardio", "Кардио и движение", "Шаги, спринты, интервалы 4×4, микродозы", "heart-pulse", "m-cardio"], ["body", bodyMenu[0], bodyMenu[1], "shield", "rl-warn"],
      ["food", "Питание", "Белок, углеводы без гарниров, фазы", "apple", "m-core"], ["science", "Почему так", `Принципы и ${n} ${plural(n, "источник", "источника", "источников")}`, "book-open", "rl-blue"],
      ["settings", "Настройки", "Тема, аккаунт, данные, анализ агентом", "settings", "rl-gray"]];
    return `<nav class="menu" aria-label="Ещё">${items.map(rowLink).join("")}</nav>
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
    if (SY && SY.configured() && !SY.signedIn()) return "Вход не выполнен — данные только на этом устройстве.";
    switch (st.state) {
      case "syncing": return "Синхронизация…";
      case "offline": return st.pending ? `Нет сети — изменений в очереди: ${st.pending}. Уйдут, когда появится связь.` : "Нет сети. Данные на устройстве в порядке.";
      case "denied": return "У этого аккаунта пока нет доступа к синхронизации.";
      case "expired": return `Вход истёк — войди снова.${st.pending ? ` Изменений ждут отправки: ${st.pending}.` : ""} Данные на устройстве на месте.`;
      case "error": return `Не получилось синхронизировать: ${st.error || "ошибка"}. Попробую ещё раз.`;
      case "signedout": return "Вход не выполнен — данные только на этом устройстве.";
      default: return st.pending ? `Изменений в очереди: ${st.pending}` : `Синхронизировано ${agoText(st.last)}`;
    }
  }
  function footText() {
    if (!SY || !SY.configured() || !SY.signedIn()) return "Данные хранятся на этом устройстве.";
    return `Данные синхронизируются: ${SY.Auth.user().email}.`;
  }
  function renderAccount() {
    if (!SY || !SY.configured()) {
      return `<section class="card" id="acct"><p class="small">Синхронизация пока не настроена — всё хранится на этом устройстве.</p></section>`;
    }
    const user = SY.Auth.user(), st = SY.status();
    if (!user) return `<section class="card" id="acct">
      <p class="small">Вход не выполнен — журнал и программа хранятся только на этом устройстве. Войди по коду из письма: данные будут в облаке и на всех твоих устройствах.</p>
      <div class="ex-tools"><button class="btn primary" data-login="1">${icon("mail", 18)}Войти</button></div></section>`;
    return `<section class="card" id="acct">
      <div class="acc-user">${`<span class="ex-tile neutral">${icon("user", 20)}</span>`}<span>Вход: <b>${esc(user.email)}</b></span></div>
      <p class="small" id="syncStatus" role="status">${esc(syncText(st))}</p>
      <div class="ex-tools">${st.state === "expired" ? `<button class="btn primary" data-login="1">${icon("mail", 18)}Войти снова</button>` : `<button class="btn tonal" data-sync="now">${icon("refresh", 18)}Синхронизировать</button>`}<button class="btn" data-acc="1">${icon("smartphone", 18)}Устройства и выход</button></div></section>`;
  }

  /* ---------- вход: экран при запуске, при истечении входа и по кнопке ---------- */
  const LG = { open: false, step: "email", email: "", code: "", busy: false, msg: "", err: false, cool: 0, reason: "first", expAt: 0, timer: null };
  const needLogin = () => !!(SY && SY.configured() && !SY.signedIn() && !S.get("noLogin", false));
  // Код ответа показываем только для неожиданных ошибок: по нему проще понять, что сломалось.
  const errText = (e) => { const m = (e && e.message) || "Что-то пошло не так"; return e && e.status && ![400, 401, 429].includes(e.status) ? `${m} (код ${e.status})` : m; };
  const coolLeft = () => Math.max(0, Math.ceil((LG.cool - Date.now()) / 1000));
  function openLogin(reason) {
    if (!SY || !SY.configured()) return;
    if (SH.open) closeSheet(false);
    const pend = SY.Auth.pendingEmail(), user = SY.Auth.user();
    Object.assign(LG, { open: true, reason: reason || "manual", step: pend ? "code" : "email", email: pend || (user && user.email) || SY.Auth.lastEmail() || "", code: "", busy: false, msg: "", err: false });
    renderLogin();
    const el = $("#login");
    el.hidden = false; document.body.classList.add("login-on");
    requestAnimationFrame(() => {
      el.classList.add("open");
      const f = $(LG.step === "code" ? "#lgCode" : "#lgEmail");
      if (f && (reason === "manual" || LG.step === "code")) f.focus(); else { const t = $("#lgTitle"); if (t) t.focus({ preventScroll: true }); }
    });
  }
  function closeLogin() {
    LG.open = false; clearInterval(LG.timer);
    const el = $("#login"); if (!el) return;
    el.classList.remove("open"); document.body.classList.remove("login-on");
    setTimeout(() => { if (!LG.open) el.hidden = true; }, 220);
    render();
  }
  function loginMsg(text, err) { LG.msg = text; LG.err = !!err; const m = $("#lgMsg"); if (m) { m.textContent = text; m.classList.toggle("err", !!err); } }
  function renderLogin() {
    const el = $("#login"); if (!el) return;
    const expired = LG.reason === "expired", left = coolLeft();
    const form = LG.step === "email"
      ? `<label class="lg-l" for="lgEmail">Почта</label>
        <input class="inp lg-inp" id="lgEmail" type="email" name="email" autocomplete="email" inputmode="email" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(LG.email)}" enterkeyhint="send" ${LG.busy ? "disabled" : ""}>
        <button class="btn primary lg-btn" type="submit" ${LG.busy ? "disabled" : ""}>${icon("send", 20)}${LG.busy ? "Отправляю…" : "Получить код"}</button>`
      : `<p class="lg-sent">${icon("mail", 18)}<span>Код отправлен на <b>${esc(LG.email)}</b>. Письмо обычно приходит за минуту — загляни и в «Спам».</span></p>
        <label class="lg-l" for="lgCode">Код из письма</label>
        <input class="inp lg-inp lg-code" id="lgCode" name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="8" value="${esc(LG.code)}" enterkeyhint="done" ${LG.busy ? "disabled" : ""}>
        <button class="btn primary lg-btn" type="submit" ${LG.busy ? "disabled" : ""}>${icon("check", 20)}${LG.busy ? "Вхожу…" : "Войти"}</button>
        <div class="lg-row"><button class="lnk" type="button" data-lg="resend" ${left || LG.busy ? "disabled" : ""}>${left ? `Новый код через ${left} с` : "Прислать новый код"}</button><button class="lnk" type="button" data-lg="change">${icon("pencil", 16)}Другая почта</button></div>`;
    el.innerHTML = `<div class="lg-in">
      <div class="lg-logo">${icon("dumbbell", 32)}</div>
      <h1 class="lg-t" id="lgTitle" tabindex="-1">${expired ? "Войди снова" : "Вход"}</h1>
      <p class="lg-lead">${expired ? "Вход на этом устройстве истёк. Данные на месте — после входа все изменения уйдут в облако." : "Журнал, программа и твои правки хранятся в облаке и одинаковы на телефоне и компьютере. Пароль не нужен — пришлём код на почту."}</p>
      <form class="lg-form lg-card" id="lgForm" novalidate>${form}</form>
      <p class="lg-msg${LG.err ? " err" : ""}" id="lgMsg" role="status" aria-live="polite">${esc(LG.msg)}</p>
      <div class="lg-foot"><button class="lnk" type="button" data-lg="skip">${LG.reason === "first" ? "Продолжить без входа" : "Позже"}</button>
        <p class="small muted">${LG.reason === "first" ? "Без входа всё хранится только на этом устройстве." : "Пока не войдёшь, изменения копятся на этом устройстве."}</p></div>
    </div>`;
  }
  function startCool() {
    clearInterval(LG.timer);
    LG.timer = setInterval(() => {
      const b = document.querySelector('#login [data-lg="resend"]'); if (!b) { clearInterval(LG.timer); return; }
      const left = coolLeft();
      b.disabled = left > 0 || LG.busy;
      b.textContent = left ? `Новый код через ${left} с` : "Прислать новый код";
      if (!left) clearInterval(LG.timer);
    }, 1000);
  }
  async function loginSubmit() {
    if (LG.busy) return;
    if (LG.step === "email") {
      const v = (($("#lgEmail") || {}).value || "").trim().toLowerCase();
      LG.email = v;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { loginMsg("Проверь адрес почты", true); return; }
      Object.assign(LG, { busy: true, msg: "Отправляю код…", err: false }); renderLogin();
      try {
        await SY.Auth.sendCode(v);
        Object.assign(LG, { busy: false, step: "code", code: "", cool: Date.now() + 30000, msg: "", err: false });
        renderLogin(); startCool();
        const c = $("#lgCode"); if (c) c.focus();
      } catch (e) { LG.busy = false; renderLogin(); loginMsg(errText(e), true); }
      return;
    }
    const code = (LG.code || (($("#lgCode") || {}).value || "")).replace(/\D/g, "");
    if (code.length < 4) { loginMsg("Введи цифры из письма", true); return; }
    Object.assign(LG, { busy: true, code, msg: "Проверяю код…", err: false }); renderLogin();
    try {
      await SY.Auth.verifyCode(code);
      LG.busy = false; S.set("noLogin", false);
      const st = SY.status();
      closeLogin();
      toast(st.state === "ok" ? "Вход выполнен — данные в облаке" : `Вход выполнен. ${syncText(st)}`);
    } catch (e) {
      LG.busy = false; renderLogin(); loginMsg(errText(e), true);
      const c = $("#lgCode"); if (c) { c.focus(); c.select(); }
    }
  }
  async function loginAction(a) {
    if (a === "change") { SY.Auth.cancelCode(); Object.assign(LG, { step: "email", code: "", msg: "", err: false }); renderLogin(); const f = $("#lgEmail"); if (f) f.focus(); return; }
    if (a === "resend") {
      if (coolLeft() || LG.busy) return;
      Object.assign(LG, { busy: true, msg: "Отправляю новый код…", err: false }); renderLogin();
      try { await SY.Auth.sendCode(LG.email); Object.assign(LG, { busy: false, cool: Date.now() + 30000, msg: "Отправил новый код.", err: false }); renderLogin(); startCool(); }
      catch (e) { LG.busy = false; renderLogin(); loginMsg(errText(e), true); }
      return;
    }
    if (a === "skip") { if (LG.reason === "first") S.set("noLogin", true); closeLogin(); }
  }

  /* ---------- индикатор синхронизации в шапке и шторка аккаунта ---------- */
  const CLOUD = '<path d="M7.5 18.5h9.6a4 4 0 0 0 .4-7.98A6 6 0 0 0 6.1 9.1a4.7 4.7 0 0 0 1.4 9.4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';
  const SYNC_IC = {
    ok: CLOUD + '<path d="m9.7 14 1.8 1.8 3.3-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    syncing: CLOUD + '<g class="spin"><path d="M9.6 14.2a2.5 2.5 0 0 1 4.3-1.9M14.4 14.6a2.5 2.5 0 0 1-4.3 1.9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></g>',
    pending: CLOUD + '<path d="M12 16.6v-4.4M10.2 13.9 12 12.1l1.8 1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    off: CLOUD + '<path d="M4.5 4.5l15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    user: '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 20.5c.6-3.7 3.9-6.3 8-6.3s7.4 2.6 8 6.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    warn: CLOUD + '<path d="M12 11.6v2.6M12 16.4v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };
  function syncVisual() {
    if (!SY || !SY.configured()) return null;
    const st = SY.status();
    if (!SY.signedIn()) return { ic: "user", cls: S.get("noLogin", false) ? "muted" : "warn", label: "Нет входа — данные только на этом устройстве. Войти" };
    switch (st.state) {
      case "syncing": return { ic: "syncing", cls: "", label: "Синхронизация…" };
      case "offline": return { ic: st.pending ? "pending" : "off", cls: "muted", label: syncText(st) };
      case "expired": return { ic: "warn", cls: "warn", label: "Вход истёк — войти снова" };
      case "denied": case "error": return { ic: "warn", cls: "danger", label: syncText(st) };
      default: return st.pending ? { ic: "pending", cls: "", label: syncText(st) } : { ic: "ok", cls: "ok", label: syncText(st) };
    }
  }
  function updateSyncBtn() {
    const b = $("#syncBtn"); if (!b) return;
    const v = syncVisual();
    if (!v) { b.hidden = true; return; }
    b.hidden = false;
    b.className = `icon-btn sync-ind ${v.cls}`;
    b.setAttribute("aria-label", v.label); b.title = v.label;
    b.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">${SYNC_IC[v.ic]}</svg>`;
  }
  const bannerKey = () => (!SY || !SY.configured() ? "" : !SY.signedIn() ? "off" : ({ expired: "exp", denied: "den" })[SY.status().state] || "");
  function syncBanner() {
    const k = bannerKey(), st = SY ? SY.status() : {};
    if (k === "off") return ban("slim login-hint", "<b>Данные только на этом устройстве.</b>", `<button class="btn tonal" data-login="1">Войти</button><button class="icon-btn" data-hidelogin="1" aria-label="Скрыть">${icon("x", 20)}</button>`, "user");
    if (k === "exp") return ban("warn", `<b>Вход истёк.</b> ${st.pending ? `Изменений ждут отправки: ${st.pending}.` : "Новые изменения не уходят в облако."}`, `<button class="btn primary" data-login="1">Войти</button>`, "cloud-off");
    if (k === "den") return ban("warn", "У этого аккаунта пока нет доступа к синхронизации — данные хранятся на устройстве.", "", "cloud-off");
    return "";
  }
  function syncBtnClick() {
    if (!SY || !SY.configured()) return;
    if (!SY.signedIn() || SY.status().state === "expired") { openLogin("manual"); return; }
    openAccount("#syncBtn");
  }
  const ACC = { devices: null, err: "", ping: "", armed: 0 };
  function openAccount(fromSel) {
    Object.assign(ACC, { devices: null, err: "", ping: "", armed: 0 });
    openSheet("account", {}, fromSel);
    loadDevices();
  }
  async function loadDevices() {
    try { ACC.devices = await SY.Auth.devices(); ACC.err = ""; } catch (e) { ACC.err = errText(e); }
    if (SH.open && SH.kind === "account") { SH.top = false; renderSheet(); }
  }
  function devicesHTML() {
    if (ACC.err) return `<p class="small muted">Не получилось загрузить список: ${esc(ACC.err)}</p>`;
    if (!ACC.devices) return `<p class="small muted">Загружаю…</p>`;
    if (!ACC.devices.length) return `<p class="small muted">Пока нигде — устройство появится здесь после следующей синхронизации.</p>`;
    return `<ul class="dev-list">${ACC.devices.map((d) => `<li><span class="ex-tile neutral" aria-hidden="true">${icon(/компьютер|mac|windows|linux/i.test(d.name || "") ? "monitor" : "smartphone", 20)}</span><div><b>${esc(d.name || "Устройство")}</b>${d.current ? ` <span class="tag now">${icon("check", 14)}это устройство</span>` : ""}<small>синхронизация ${esc(agoText(Date.parse(d.last)))} · вход ${esc(fmtDate(isoOf(new Date(d.created))))}</small></div></li>`).join("")}</ul>`;
  }
  /** Фильтр «Оборудование» в «Упражнениях». */
  function sheetEq() {
    const eqs = ["all"].concat(Object.keys(EQ_RU));
    return { title: "Оборудование", html: `<div class="pk-list">${eqs.map((k) => `<button class="pk eq-o${LIB.eq === k ? " on" : ""}" data-sa="eqset" data-v="${esc(k)}" aria-pressed="${LIB.eq === k}"><span class="pk-n">${k === "all" ? "Любое" : esc(ru(EQ_RU, k))}</span>${LIB.eq === k ? icon("check", 20) : ""}</button>`).join("")}</div>` };
  }
  function sheetAccount() {
    if (!SY || !SY.signedIn()) return null;
    const user = SY.Auth.user(), st = SY.status(), le = SY.lastError();
    const bad = ["error", "denied", "expired"].includes(st.state);
    const armed = ACC.armed && Date.now() - ACC.armed < 4000;
    return { title: "Синхронизация", html: `
      <p class="acc-user"><span class="ex-tile neutral" aria-hidden="true">${icon("user", 20)}</span><span>Вход: <b>${esc(user.email)}</b></span></p>
      <p class="acc-st${bad ? " err" : ""}" role="status">${icon(bad ? "alert-triangle" : st.state === "offline" ? "cloud-off" : "cloud", 18)}<span>${esc(syncText(st))}</span></p>
      ${le && bad ? `<p class="small muted">Ошибка: ${esc(le.msg)}${le.st ? ` (код ${le.st})` : ""}, ${esc(agoText(le.at))}.</p>` : ""}
      <div class="sh-acts">${st.state === "expired" ? `<button class="btn primary" data-sa="relogin">${icon("mail", 18)}Войти снова</button>` : `<button class="btn primary" data-sa="syncnow" ${st.state === "syncing" ? "disabled" : ""}>${icon("refresh", 18)}Синхронизировать сейчас</button>`}<button class="btn" data-sa="ping">${icon("wifi", 18)}Проверить связь</button></div>
      ${ACC.ping ? `<p class="small muted">${esc(ACC.ping)}</p>` : ""}
      <h3 class="sh-h">${icon("smartphone", 18)}Где выполнен вход</h3>
      ${devicesHTML()}
      <p class="small muted">${SY.hasDevice() ? "Вход на этом устройстве держится полгода с последнего открытия приложения. " : ""}Синхронизация идёт при каждом открытии приложения, после изменений и раз в 5 минут.</p>
      <button class="btn danger wide" data-sa="signout">${icon("log-out", 18)}<span>${armed ? "Точно выйти на этом устройстве?" : "Выйти на этом устройстве"}</span></button>` };
  }

  async function accountAction(a, t) {
    const again = () => { if (SH.open && SH.kind === "account") { SH.top = false; renderSheet(); } };
    if (a === "relogin") { closeSheet(false); openLogin("manual"); return; }
    if (a === "syncnow") { await SY.syncNow(); loadDevices(); return; }
    if (a === "ping") {
      ACC.ping = "Проверяю связь…"; again();
      try { const r = await SY.ping(); ACC.ping = r.ok ? `Сервер на связи${r.relay ? " через прокси" : ""}, ответ за ${r.ms} мс.` : "Сервер ответил с ошибкой — попробуй позже."; }
      catch (e) { ACC.ping = errText(e); }
      again(); return;
    }
    if (a === "signout") {
      if (!(ACC.armed && Date.now() - ACC.armed < 4000)) {
        ACC.armed = Date.now(); again();
        setTimeout(() => { if (ACC.armed && Date.now() - ACC.armed >= 4000) { ACC.armed = 0; again(); } }, 4100);
        return;
      }
      ACC.armed = 0; t.disabled = true; (t.querySelector("span") || t).textContent = "Выхожу…";
      await SY.Auth.signOut(); // дальше страница перезагрузится с публичной программой
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
    if (pts.length < 2) return `<svg class="spark" width="84" height="26" aria-hidden="true"></svg>`;
    const ys = pts.map((p) => p.score), mn = Math.min(...ys), mx = Math.max(...ys), rg = mx - mn || 1;
    const d = pts.map((p, i) => `${(i / (pts.length - 1)) * 80 + 2},${22 - ((p.score - mn) / rg) * 18}`).join(" ");
    return `<svg class="spark" width="84" height="26" viewBox="0 0 84 26" aria-hidden="true"><polyline points="${d}" fill="none" style="stroke:var(--series)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }
  const CH = window.Charts || null;
  const JT = [["progress", "Тренировки", "dumbbell"], ["volume", "Объём", "bar-chart"], ["body", "Тело", "scale"]];
  function renderJournal() {
    const jt = state.jtab || "progress";
    const seg = `<div class="seg jseg" role="tablist" aria-label="Разделы прогресса">${JT.map(([k, n, ic]) => `<button data-jtab="${k}" class="${jt === k ? "on" : ""}" role="tab" aria-selected="${jt === k}">${icon(ic, 16)}${n}</button>`).join("")}</div>`;
    return seg + (jt === "volume" ? journalVolume() : jt === "body" ? journalBody() : journalProgress());
  }

  /* --- регулярность и упражнения --- */
  function adherenceHTML() {
    const cyc = cycleState(), by = idxSessions(), today = todayISO(), list = sessionsByDate();
    const from = Math.max(0, cyc.idx - 9), cols = [];
    const custom = isCustom();
    for (let i = from; i <= cyc.idx; i++) { const p = posOfIdx(i); cols.push({ n: by[i] ? by[i].size : 0, block: p.block, week: p.week, cur: i === cyc.idx }); }
    // «тренировок за 4 недели» и «дней с последней» — по всем программам; регулярность по неделям — по текущей
    const last28 = list.filter((x) => daysBetween(x.date, today) < 28).length;
    const req = custom ? reqDays(1, cyc.idx) : ["A", "B"], need = custom ? Math.max(1, req.length) : 2;
    let closed = 0;
    // своя программа: неделя закрыта — сделаны непустые тренировки её очереди (при чередовании у каждой недели своя очередь)
    for (let i = 0; i < cyc.idx; i++) { const s = by[i]; if (s && (custom ? (PG.softWeek(curRec(), i) ? s.size > 0 : reqDays(1, i).filter((d) => s.has(d)).length >= Math.max(1, reqDays(1, i).length)) : s.has("A") && s.has("B"))) closed++; }
    const since = list.length ? daysBetween(list[0].date, today) : null;
    const MAXN = Math.max(3, days().length), BAR = 56, BASE = 20;
    // подпись столбика — неделя блока; над первой неделей каждого блока — «Б1», «Б2»…; у своей программы — номер недели
    const colsHTML = cols.map((c, i) => `<div class="col ${c.cur ? "cur" : ""}" title="${custom ? `Неделя ${c.week}` : `Блок ${c.block}, неделя ${c.week}`}: тренировок ${c.n}"><div class="ba"><span class="cv">${c.n || ""}</span><i style="height:${Math.round((Math.min(c.n, MAXN) / MAXN) * BAR)}px"></i></div><small>${c.week}</small><em>${!custom && (c.week === 1 || i === 0) ? `Блок&nbsp;${c.block}` : ""}</em></div>`).join("");
    const head = `<h2 class="sec-h">${icon("calendar", 18)}<span>Регулярность</span></h2>`;
    if (!list.length) return head + `<section class="card">${emptyHTML("calendar", "Тренировок пока нет", "Здесь будет видно, сколько раз в неделю ты тренируешься и сколько недель закрыто.", `<button class="btn tonal" data-tab="today">${icon("dumbbell", 18)}К тренировке</button>`)}</section>`;
    return `${head}
      <div class="stats">
        <div class="stat">${icon("dumbbell", 20)}<b>${last28}</b><span>${plural(last28, "тренировка", "тренировки", "тренировок")} за 4 недели</span></div>
        <div class="stat">${icon("check-circle", 20)}<b>${closed}</b><span>${plural(closed, "неделя закрыта", "недели закрыто", "недель закрыто")}</span></div>
        <div class="stat">${icon("clock", 20)}${since === 0 ? `<b>Сегодня</b><span>последняя тренировка</span>` : `<b>${since}</b><span>${plural(since, "день", "дня", "дней")} с последней</span>`}</div>
      </div>
      <section class="card">
      <h3>Тренировок в неделю</h3>
      <div class="cols" role="img" aria-label="Тренировок в неделю программы за последние ${numW(cols.length, "неделю", "недели", "недель")}">${colsHTML}<div class="target" style="bottom:${BASE + 16 + Math.round((need / MAXN) * BAR)}px"><span>${custom ? `${need} в неделю` : "A + B"}</span></div></div>
      <p class="small muted">${custom ? `Столбик — тренировки в неделе программы «${esc(P.meta.name)}», цифра — номер недели.` : "Столбик — тренировки в неделе программы, цифра — неделя блока."} Пунктир — сколько тренировок в неделю обязательно (${need}).</p>
    </section>`;
  }
  function exerciseDetail(id, arr) {
    const ex = EX[id], weighted = arr.some((p) => p.w > 0);
    const pts = arr.map((p) => ({ d: p.date, v: weighted ? Math.round(p.score * 10) / 10 : p.r, note: weighted ? `${fmtW(p.w)} × ${fmtNum(p.r)}` : `${fmtNum(p.r)} повт.` }));
    const chart = CH && pts.length ? CH.slot({ height: 190, unit: weighted ? "кг" : "", digits: weighted ? 0 : 0, label: `${ex ? ex.n : id}: ${weighted ? "расчётный максимум" : "повторы"} по тренировкам`, series: [{ name: weighted ? "максимум" : "повторы", color: "var(--series)", points: pts, main: true }] }) : "";
    const rows = arr.slice().reverse().map((p) => `<tr><td>${fmtDate(p.date)}</td><td>${weighted ? `${fmtW(p.w)} × ${fmtNum(p.r)}` : `${fmtNum(p.r)} повт.`}</td>${weighted ? `<td>${Math.round(p.score)}</td>` : ""}</tr>`).join("");
    return `<div class="exp-detail">
      <div class="small muted">${weighted ? "Расчётный максимум на один повтор по лучшему подходу тренировки, кг" : "Лучший подход тренировки, повторы"}</div>
      ${chart}
      <details class="tbl"><summary>Таблица</summary><div class="tbl-wrap"><table class="t"><thead><tr><th>Дата</th><th>Лучший подход</th>${weighted ? "<th>Макс.</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div></details>
    </div>`;
  }
  function journalProgress() {
    const prog = progressData();
    const ids = Object.keys(prog).sort((a, b) => prog[b][prog[b].length - 1].date.localeCompare(prog[a][prog[a].length - 1].date));
    const progHTML = ids.length ? ids.map((id) => {
      const arr = prog[id], first = arr[0], last = arr[arr.length - 1];
      const pct = first.score ? ((last.score - first.score) / first.score) * 100 : 0;
      const pr = Math.round(pct * 10) / 10;
      const dl = arr.length < 2 ? "" : !pr ? `<span class="delta flat">без изменений</span>` : `<span class="delta ${pr > 0 ? "up" : "down"}">${icon(pr > 0 ? "arrow-up" : "arrow-down", 13)}${fmtNum(Math.abs(pr))} %</span>`;
      const lastTxt = last.w > 0 ? `${fmtW(last.w)} × ${fmtNum(last.r)} · макс. ≈ ${Math.round(last.score)} кг` : `${fmtNum(last.r)} ${plural(Math.round(last.r), "повтор", "повтора", "повторов")}`;
      const open = state.jex === id;
      return `<div class="prog-row exp-row" data-jex="${esc(id)}" role="button" tabindex="0" aria-expanded="${open}">${tileHTML(exGroup(id), 20)}<div class="nm">${esc(EX[id] ? EX[id].n : id)}</div>${spark(arr)}<div class="meta">${lastTxt} · ${arr.length} ${plural(arr.length, "тренировка", "тренировки", "тренировок")} ${dl}</div></div>${open ? exerciseDetail(id, arr) : ""}`;
    }).join("") : emptyHTML("bar-chart", "Пока пусто", "Записывай подходы на «Сегодня» — здесь появится динамика по каждому упражнению.", `<button class="btn tonal" data-tab="today">${icon("dumbbell", 18)}К тренировке</button>`);
    return `${adherenceHTML()}
      <h2 class="sec-h">${icon("bar-chart", 18)}<span>Прогресс по упражнениям</span></h2>
      <section class="card">${progHTML}
        ${ids.length ? `<p class="small muted" style="margin-top:8px">Нажми на упражнение — откроется график. «Макс.» — расчётный вес на один повтор по лучшему подходу тренировки (формула Эпли): так видно рост, даже когда меняются повторы.</p>` : ""}</section>`;
  }

  /* --- объём: факт против плана --- */
  function actualVolume(idx) {
    const vol = {}, add = (m, v) => { vol[m] = (vol[m] || 0) + v; };
    Object.keys(state.logs).forEach((k) => {
      const e = state.logs[k];
      if (!entryHasData(e)) return;
      if (!mineK(k)) return;
      const ei = idxOfE(e);
      if (ei !== idx) return;
      Object.entries(e.ex || {}).forEach(([id, sets]) => {
        const ex = EX[id];
        if (!ex || !ex.m) return;
        const n = (sets || []).filter(performed).length;
        ex.m.p.forEach((m) => add(m, n));
        ex.m.s.forEach((m) => add(m, n * 0.5));
      });
    });
    return vol;
  }
  function journalVolume() {
    const cyc = cycleState(), back = state.jvol || 0, idx = Math.max(0, cyc.idx - back), pos = posOfIdx(idx);
    const opt = days().filter(optional), withOpt = !opt.length || plannedDays().length > days().length - opt.length;
    const act = actualVolume(idx), plan = weeklyVolume(pos.block, withOpt);
    const rows = Object.keys(P.muscles).filter((m) => !P.muscles[m].hide).map((m) => {
      const pv = plan[m] || { d: 0, i: 0 };
      return { m, n: P.muscles[m].n, pr: isCustom() ? 0 : P.muscles[m].pr, a: act[m] || 0, p: pv.d + pv.i * 0.5 };
    }).sort((x, y) => (x.pr || 9) - (y.pr || 9));
    const max = Math.max(1, ...rows.map((r) => Math.max(r.a, r.p)));
    const bars = rows.map((r) => {
      const w = (r.a / max) * 100, tp = (r.p / max) * 100;
      const tip = `${r.n}: ${fmtNum(r.a)} из ${fmtNum(r.p)} по плану`;
      return `<div class="vbar-row" title="${esc(tip)}"><div class="bar-lab ${r.pr && r.pr <= 2 ? "pri" : ""}">${esc(r.n)}</div>
        <div class="vbar-track"><div class="vbar ${r.a ? "" : "zero"}" style="width:${w}%"></div>${r.p ? `<div class="vtick" style="left:${tp}%"></div>` : ""}</div>
        <span class="vval">${fmtNum(r.a)}<span class="muted"> / ${fmtNum(r.p)}</span></span></div>`;
    }).join("");
    const btn = (v, lab) => `<button data-jvol="${v}" class="chip${back === v ? " on" : ""}" aria-pressed="${back === v}">${lab}</button>`;
    const empty = !Object.keys(act).length;
    return `<section class="card">
      <h3>${icon("bar-chart", 20)}Подходы по мышцам</h3>
      <div class="chart-ctl"><div class="chips wrap" role="group" aria-label="Неделя">${btn(0, "Текущая")}${btn(1, "Прошлая")}${btn(2, "2 нед. назад")}</div></div>
      <p class="small muted">${isCustom() ? `Неделя ${pos.n}` : `Блок ${pos.block}, неделя ${pos.week}${isDeload(pos) ? " (разгрузка)" : ""}`}. Полоса — сделано, риска — план${isCustom() ? (rotNow() ? " в среднем за неделю" : "") : " в режиме 90 минут"}${opt.length && withOpt ? ` с тренировкой ${opt.join(", ")}` : ""}.</p>
      ${empty ? ban("slim", "В этой неделе программы ещё нет записанных подходов — риски показывают план.", "", "info") : ""}
      <div class="chart" role="img" aria-label="Подходы по мышцам: сделано и план">${bars}</div>
      <p class="small muted" style="margin-top:8px">${isCustom() ? "" : "Жирным — приоритетные мышцы. "}Число справа — сделано / по плану. Прямая работа считается за подход, косвенная (бицепс в тягах) — за половину. <span class="src-l">Источник: ${rich("{pelland26}")}</span></p>
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
    const measRows = meas.map((m) => `<tr><td>${fmtDate(m.date)}</td><td>${cell(m.w, "w")}</td><td>${cell(m.waist, "waist")}</td><td>${cell(m.arm, "arm")}</td><td>${cell(m.calf, "calf")}</td><td>${cell(m.bf, "bf")}</td><td><button class="icon-btn del" data-delmeas="${esc(m.date)}" aria-label="Удалить замер ${esc(fmtDate(m.date))}">${icon("trash", 18)}</button></td></tr>`).join("");
    return `
      <section class="card">
        <h3>${icon("ruler", 20)}Новый замер</h3>
        <div class="form-grid" id="measForm">
          <label>Дата<input type="date" name="date" value="${todayISO()}"></label>
          <label>Вес, кг<input inputmode="decimal" name="w" placeholder="${esc(state.settings.bw || "")}"></label>
          <label>Талия, см<input inputmode="decimal" name="waist" placeholder="по пупку"></label>
          <label>Рука, см<input inputmode="decimal" name="arm" placeholder="в напряжении"></label>
          <label>Икра, см<input inputmode="decimal" name="calf" placeholder="самое широкое место"></label>
          <label>Жир, %<input inputmode="decimal" name="bf" placeholder="калипер"></label>
        </div>
        <div style="margin-top:12px"><button class="btn primary" data-addmeas="1">${icon("check", 18)}Сохранить замер</button></div>
        <p class="small muted" style="margin-top:8px">Вес — утром, 3–4 раза в неделю (смотри среднее). Талия — раз в 2 недели, рука и икра — раз в месяц, утром до нагрузки.</p>
      </section>
      ${weightChart || smalls ? `<section class="card">${weightChart}${smalls ? `<div class="small-multiples">${smalls}</div>` : ""}</section>` : `<section class="card">${emptyHTML("scale", "Графиков пока нет", "Они появятся после двух замеров.")}</section>`}
      ${meas.length ? `<section class="card"><h3>${icon("list", 20)}Все замеры</h3><div class="tbl-wrap"><table class="t"><thead><tr><th>Дата</th><th>Вес</th><th>Талия</th><th>Рука</th><th>Икра</th><th>Жир</th><th></th></tr></thead><tbody>${measRows}</tbody></table></div><p class="small muted">В скобках — изменение от первого замера.</p></section>` : ""}`;
  }

  /* ---------- анализ агентом: экспорт и корректировки ---------- */
  const ADJ_FORMAT = "upgrade.adjust.v1";
  const AGENT_PROMPT = `Ты — тренер-аналитик. Это выгрузка из моего приложения «Апгрейд»: программа силовых тренировок (3 блока по 5 недель, 5-я неделя блока — разгрузка; неделя закрывается, когда сделаны тренировки A и B, C — по желанию), журнал подходов (вес × повторы; RIR — запас повторов в последнем подходе), самочувствие перед тренировкой (ok / low), отметки суставов после тренировки (1 — дискомфорт, 2 — боль), заметки и замеры тела.

Что сделать:
1. Коротко оцени последние недели: прогресс в основных упражнениях (лучшие подходы, расчётный 1ПМ), объём по мышцам против плана (weekly_summary), регулярность, сигналы усталости и жалобы суставов. Опирайся на цифры из данных.
2. Если нужно, предложи корректировки программы на ближайшие 2–4 недели. Если менять нечего — так и скажи.
3. Корректировки верни отдельным блоком кода JSON строго в формате upgrade.adjust.v1 (описание — в поле adjust_format). Я вставлю его в приложение: «Ещё → Настройки → Корректировки».

Программа в выгрузке уже с моими правками (edited_by_user, replaced_from, added_by_user) — опирайся на неё. Правила: используй только id упражнений из program.exercises (для замены — желательно из списка alts); не больше 6 изменений за раз; уважай ограничения из athlete.context_notes и отметки суставов; каждое изменение объясни в поле why одним-двумя предложениями. Разгрузку или повтор недели предлагай через поле cycle.`;
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
  /** Инструкция агенту под текущую программу: у своей — без блоков и разгрузок. */
  function agentPrompt() {
    if (!isCustom()) return AGENT_PROMPT;
    const d = days(), rot = rotNow();
    const how = rot ? `${d.length} ${plural(d.length, "тренировка", "тренировки", "тренировок")} (${d.join(", ")}), ${rot.pw} в неделю по очереди (program.rotation); без блоков и разгрузок, недели идут подряд; неделя закрывается, когда сделаны тренировки её очереди`
      : `${d.length} ${plural(d.length, "тренировка", "тренировки", "тренировок")} в неделю: ${d.join(", ")}; без блоков и разгрузок, недели идут подряд; неделя закрывается, когда сделаны все тренировки с упражнениями`;
    return AGENT_PROMPT.replace("программа силовых тренировок (3 блока по 5 недель, 5-я неделя блока — разгрузка; неделя закрывается, когда сделаны тренировки A и B, C — по желанию)",
      `своя программа силовых тренировок «${P.meta.name}» (${how}; у некоторых упражнений цикл нагрузки — load_cycle)`)
      .replace("Разгрузку или повтор недели предлагай через поле cycle.", "Повтор недели предлагай через поле cycle (repeat_week); блоков и разгрузок в этой программе нет — облегчение предлагай изменениями подходов и запаса.");
  }
  const stripHTML = (h) => String(h || "").replace(/<li>/g, "\n• ").replace(/<\/(h3|p|section)>/g, "\n").replace(/<[^>]+>/g, "").replace(/\{\{?\w+\}?\}/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  function buildAnalysis() {
    const cyc = cycleState(), cur = posOfIdx(cyc.idx), done = weekDone(cyc), pd = plannedDays(), custom = isCustom(), opt = days().filter(optional);
    const used = new Set();
    const sessions = {};
    Object.keys(P.sessions).forEach((key) => {
      const s = sessOf(key);
      sessions[key] = { title: s.title, edited_by_user: PM.edited(key), groups: s.groups.filter((g) => g.items && g.kind !== "warmup").map((g) => ({ id: g.id, kind: g.kind, tier: g.tier, rest: g.rest || null,
        items: g.items.filter((it) => it.ex || it.hl || it.weekAlt).map((it) => {
          const one = (b) => { if (b.ex) used.add(b.ex); return { exercise: b.ex, sets: b.sets, reps: b.reps, rir: b.rir == null ? null : b.rir, note: b.note || null, myo: !!b.myo, replaced_from: b.orig || undefined }; };
          // цикл нагрузки: шаги по разу на каждый проход тренировки, текущий — по ближайшему проходу
          const cs = custom ? cycStep(it, { day: key[1], plan: true }) : null;
          if (cs) return Object.assign(one(it), { load_cycle: { steps: it.cyc.map((x) => ({ sets: x.sets, reps: x.reps, rir: x.rir == null ? null : x.rir, pct_of_max: x.pct == null ? null : x.pct })), current_step: cs.i + 1, cycles_completed: cs.pass - 1, max_kg: tmOf(it.ex) } }, it.add ? { added_by_user: true } : {});
          if (it.hl) return Object.assign(one({ ex: it.ex, orig: it.orig }), { heavy_week: one(Object.assign({ ex: it.ex }, it.hl.heavy)), light_week: one(Object.assign({ ex: it.ex }, it.hl.light)) });
          if (it.weekAlt) return { alternating_by_week: it.weekAlt.map(one) };
          return Object.assign(one(it), it.add ? { added_by_user: true } : {});
        }) })) };
    });
    const exercises = {};
    Object.keys(EX).forEach((id) => {
      const e = EX[id];
      if (!e.m) return;
      exercises[id] = { name: e.n, primary: e.m.p, secondary: e.m.s, alts: e.alts || [], tags: e.tags || [], in_program: used.has(id), unit: e.unit || "kg×reps", source: e.src === "ds" ? "добавлено пользователем из базы exercises-dataset" : undefined };
    });
    const log = Object.keys(state.logs).filter((k) => entryHasData(state.logs[k]) || (state.logs[k].s && (state.logs[k].s.note || state.logs[k].s.joints))).sort().map((k) => {
      const e = state.logs[k];
      return { date: k.slice(0, 10), program: PG.parseLogKey(k).prog, session: e.day || PG.parseLogKey(k).day, block: e.block, week: e.week, week_index: e.idx, readiness: e.ready || null, time_mode_min: e.time || null,
        joints: (e.s && e.s.joints) || {}, note: (e.s && e.s.note) || "",
        exercises: Object.entries(e.ex || {}).map(([id, sets]) => ({ id, name: EX[id] ? EX[id].n : id, sets: (sets || []).filter(performed).map((x) => ({ kg: numOf(x.w), reps: numOf(x.r) })), rir_last_set: e.rir && e.rir[id] != null ? e.rir[id] : null })).filter((x) => x.sets.length) };
    });
    // недели — только текущей программы (у остальных своя нумерация)
    const wks = Array.from(new Set(Object.keys(state.logs).filter((k) => mineK(k) && entryHasData(state.logs[k])).map((k) => state.logs[k].idx).filter((x) => x != null))).sort((a, b) => a - b);
    const weekly = wks.map((i) => {
      const p = posOfIdx(i), plan = weeklyVolume(p.block, !opt.length || pd.length >= days().length), act = actualVolume(i), by = idxSessions();
      const planned = {};
      Object.keys(plan).forEach((m) => { planned[m] = plan[m].d + plan[m].i * 0.5; });
      return { week_index: i, block: p.block, week: p.week, deload: isDeload(p), sessions: Array.from(by[i] || []).sort(), hard_sets: act, planned_sets: planned };
    });
    const progress = {};
    const pdata = progressData();
    Object.keys(pdata).forEach((id) => { progress[id] = pdata[id].map((x) => ({ date: x.date, best: x.w > 0 ? `${x.w}×${x.r}` : `${x.r}`, e1rm: x.w > 0 ? Math.round(x.score * 10) / 10 : null })); });
    return {
      format: "upgrade.analysis.v1",
      generated_at: new Date().toISOString(),
      instructions: agentPrompt(),
      adjust_format: ADJ_SPEC,
      athlete: {
        settings: { program_start: state.settings.start, body_weight_kg: +state.settings.bw || null, hr_max: +state.settings.hrmax || null, training_days: pd.map((d) => WD_SHORT[d]) },
        profile: P.meta.profile,
        priorities: Object.keys(P.muscles).filter((m) => P.muscles[m].pr).map((m) => ({ muscle: m, name: P.muscles[m].n, priority: P.muscles[m].pr })),
        context_notes: stripHTML(P.content.body)
      },
      program: {
        id: BOUND, name: P.meta.name, kind: progKind() === "main" ? "builtin" : progKind(), note: (curRec() || {}).note || undefined,
        version: P.meta.version,
        workouts: days(), required: days().filter((d) => !optional(d)), optional: opt,
        rotation: custom && rotNow() ? { per_week: rotNow().pw, queue: days(), this_week: weekDays(cyc.idx), round_weeks: PG.roundWeeks(curRec()), weekdays: rotNow().wd.map((d) => WD_SHORT[d]) } : undefined,
        position: custom ? { cycle: 1, block: 1, week: cur.n, week_index: cyc.idx, deload: false, done_this_week: Object.keys(done), deload_in_weeks: null }
          : { cycle: cur.cycle, block: cur.block, week: cur.week, week_index: cyc.idx, deload: isDeload(cur), done_this_week: Object.keys(done), deload_in_weeks: isDeload(cur) ? 0 : P.meta.blockWeeks - cur.week },
        cycle_history: cyc.hist || [],
        blocks: custom ? [] : P.blocks.map((b) => ({ id: b.id, name: b.name, theme: b.theme, targets: b.targets })),
        sessions, exercises,
        rules: custom ? "Двойная прогрессия: верх диапазона во всех подходах при нужном RIR → +2,5–5 % веса. Блоков и разгрузок нет, недели идут подряд. Цикл нагрузки (load_cycle): каждый раз, когда тренировка сделана, — следующий шаг, после последнего — снова первый (пропуск шаг не сдвигает); вес шага = pct_of_max × max_kg / 100. Самочувствие «так себе»: подходом меньше, RIR +1."
          : "Двойная прогрессия: верх диапазона во всех подходах при нужном RIR → +2,5–5 % веса. Разгрузка: веса −10–15 %, подходов на один меньше, RIR 3–4. Самочувствие «так себе»: подходом меньше, RIR +1."
      },
      adjustments_active: (S.get("adjust", []) || []).filter((a) => a && a.enabled !== false && (a.prog || PG.MAIN) === BOUND),
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
    let cycle = ["deload_now", "repeat_week", "next_block"].includes(obj.cycle) ? obj.cycle : null;
    if (cycle && isCustom() && cycle !== "repeat_week") { warnings.push("В этой программе нет блоков и разгрузок — действие с циклом пропускаю."); cycle = null; }
    if (!changes.length && !cycle) errors.push("Нет изменений: пустой список changes.");
    if (changes.length > 20) errors.push("Слишком много изменений за раз (больше 20).");
    const inProg = new Set();
    Object.keys(P.sessions).forEach((key) => sessOf(key).groups.forEach((g) => (g.items || []).forEach((it) => {
      const add = (b) => b && b.ex && inProg.add(`${key}|${b.ex}`);
      add(it); if (it.hl) add({ ex: it.ex }); if (it.weekAlt) it.weekAlt.forEach(add);
    })));
    const clean = changes.slice(0, 20).map((c, i) => {
      const n = i + 1, out = {};
      if (!c || typeof c !== "object") { errors.push(`№${n}: не объект.`); return null; }
      if (!EX[c.exercise]) { errors.push(`№${n}: неизвестное упражнение «${c.exercise}».`); return null; }
      out.exercise = c.exercise;
      const sess = c.session == null || c.session === "" ? "*" : String(c.session);
      // дни и блоки — текущей программы: A–F, номер блока не больше числа блоков
      const D = days(), nb = blocks().length, m = /^(?:([1-9])?([A-F]))$/.exec(sess);
      if (sess !== "*" && (!m || !D.includes(m[2]) || (m[1] && +m[1] > nb))) { errors.push(`№${n}: session должно быть *, ${D.join(", ")}${nb > 1 ? ` или вида 2${D[0]}` : ""}.`); return null; }
      out.session = sess;
      if (Array.isArray(c.blocks)) out.blocks = c.blocks.map(Number).filter((b) => b >= 1 && b <= nb);
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
    const where = c.session === "*" ? "все тренировки" : c.session.length === 1 ? `тренировка ${c.session}` : `тренировка ${c.session[1]}, блок ${c.session[0]}`;
    const parts = [];
    if (c.replace_with) parts.push(`замена на «${EX[c.replace_with].n}»`);
    if (c.sets != null) parts.push(`подходов: ${c.sets}`);
    if (c.reps) parts.push(`повторы: ${c.reps}`);
    if (c.rir) parts.push(`запас ${c.rir}`);
    if (c.note) parts.push(`подсказка: «${c.note}»`);
    return `<li><b>${esc(EX[c.exercise].n)}</b> (${where}${c.blocks && c.blocks.length && multiBlock() ? `, блоки ${c.blocks.join(", ")}` : ""}): ${esc(parts.join(", "))}${c.why ? `<div class="small muted">${esc(c.why)}</div>` : ""}</li>`;
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
    const all = S.get("adjust", []) || [], list = all.filter((a) => a && (a.prog || PG.MAIN) === BOUND), other = all.length - list.length;
    const foot = other ? `<p class="small muted">Ещё ${other} ${plural(other, "корректировка", "корректировки", "корректировок")} — у других программ; действуют, когда программа текущая.</p>` : "";
    if (!list.length) return `<p class="small muted">Активных корректировок нет — программа идёт как задумано.</p>${foot}`;
    return list.map((a) => `<div class="adj-item ${a.enabled === false ? "off" : ""}">
      <div><b>${esc(a.title)}</b> <span class="small muted">${a.created ? fmtDate(a.created.slice(0, 10)) : ""} · изменений: ${(a.changes || []).length}</span>
        ${a.reason ? `<div class="small muted">${esc(a.reason)}</div>` : ""}</div>
      <div class="row-btns"><label class="chk"><input type="checkbox" data-adjtoggle="${esc(a.id)}" ${a.enabled === false ? "" : "checked"}> вкл.</label><button class="btn ghost small" data-adjdel="${esc(a.id)}" aria-label="Удалить корректировку">${icon("trash", 18)}</button></div>
    </div>`).join("") + foot;
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
      const text = `${agentPrompt()}\n\nДанные (JSON):\n\`\`\`json\n${JSON.stringify(f.data)}\n\`\`\``;
      try { await navigator.clipboard.writeText(text); msg(`Скопировано (${Math.round(text.length / 1024)} КБ) — вставь в чат с агентом.${text.length > 150000 ? " Данных много: надёжнее отправить файлом." : ""}`); }
      catch (e) { msg("Не получилось скопировать — скачай файл.", true); }
    }
  }

  /* ---------- tab: settings ---------- */
  /** Секция настроек: заголовок с иконкой и содержимое. */
  const setSec = (ic, title, html, id) => `<div class="set-sec"${id ? ` id="${id}-sec"` : ""}><h2 class="sec-h">${icon(ic, 18)}<span>${title}</span></h2>${html}</div>`;
  function renderSettings() {
    const th = [["auto", "Авто", "monitor"], ["light", "Светлая", "sun"], ["dark", "Тёмная", "moon"]];
    return `${setSec("sun", "Оформление", `<section class="card">
        <div class="seg theme-seg" role="radiogroup" aria-label="Тема">${th.map(([k, n, ic]) => `<button role="radio" aria-checked="${state.theme === k}" data-themeset="${k}" class="${state.theme === k ? "on" : ""}">${icon(ic, 18)}${n}</button>`).join("")}</div>
      </section>`)}
      ${setSec("cloud", "Аккаунт и синхронизация", renderAccount())}
      ${setSec("calendar", `Программа «${esc(P.meta.name || "Апгрейд")}»`, `<section class="card">
        ${isMain() ? `<div class="form-grid" id="startForm"><label>Старт программы<input type="date" name="start" value="${esc(state.settings.start)}"></label></div>` : `<p class="small muted">Это текущая программа. Переименовать, описать, дублировать — в «Программе», меню у названия.</p>`}
        <div class="ex-tools" style="margin-top:12px">${isMain() ? `<button class="btn tonal" data-saveset="1">${icon("check", 18)}Сохранить</button>` : ""}${isCustom() ? `<button class="btn" data-tab="plan">${icon("layers", 18)}К программе</button>` : `<button class="btn danger" data-resetplan="1">${icon("undo", 18)}<span>Сбросить правки программы</span></button>`}</div>
      </section>`)}
      ${setSec("scale", "Для расчётов", `<section class="card">
        <div class="form-grid" id="setForm">
          <label>Вес для расчётов, кг<input inputmode="decimal" name="bw" value="${esc(state.settings.bw)}"></label>
          <label>Макс. пульс, уд/мин<input inputmode="numeric" name="hrmax" value="${esc(state.settings.hrmax)}"></label>
        </div>
        <div class="ex-tools" style="margin-top:12px"><button class="btn tonal" data-saveset="1">${icon("check", 18)}Сохранить</button></div>
      </section>`)}
      ${setSec("download", "Данные", `<section class="card">
        <p class="small">${SY && SY.signedIn() ? "Журнал, замеры, цикл, цели, программы с правками и корректировки синхронизируются с базой. Копия в файле — на всякий случай: в ней все данные." : "Без входа всё хранится только на этом устройстве. Сохрани копию в файл — в ней все данные, из неё всё можно восстановить."}</p>
        <div class="ex-tools"><button class="btn" data-export="1">${icon("download", 18)}Сохранить копию в файл</button><label class="btn" style="cursor:pointer">${icon("upload", 18)}Восстановить из файла<input type="file" accept="application/json,.json" data-import="1" hidden></label></div>
      </section>`)}
      ${setSec("sparkles", "Анализ агентом", `<section class="card" id="agents">
        <p class="small">Выгрузи данные для ChatGPT, Claude или своего агента. В файле уже есть инструкция: что проанализировать и в каком формате вернуть корректировки программы.</p>
        <div class="ex-tools"><button class="btn tonal" data-agentexport="file">${icon("download", 18)}Скачать для анализа</button>${navigator.canShare ? `<button class="btn" data-agentexport="share">${icon("send", 18)}Поделиться</button>` : ""}<button class="btn" data-agentexport="copy">${icon("copy", 18)}Скопировать для чата</button></div>
        <p class="small muted" id="agentMsg" role="status"></p>
      </section>`)}
      ${setSec("settings", "Корректировки", `<section class="card" id="adjust">
        <p class="small">Вставь ответ агента — блок кода с корректировками из его ответа. Перед применением покажу, что изменится; любую корректировку можно выключить или удалить.</p>
        <p class="small muted">Формат блока — ${ADJ_FORMAT}, агент знает его из выгрузки.</p>
        <textarea class="adj-in" id="adjIn" rows="4" aria-label="Ответ агента (JSON)" placeholder="Вставь сюда ответ агента"></textarea>
        <div class="ex-tools" style="margin-top:8px"><button class="btn tonal" data-adjcheck="1">${icon("check", 18)}Проверить</button></div>
        <div id="adjPreview">${adjPreviewHTML(adjDraft)}</div>
        <h4>Активные</h4>
        <div class="adj-list">${adjListHTML()}</div>
      </section>`)}
      ${setSec("image", "Анимации упражнений", `<section class="card">
        <label class="switch-row"><span>Показывать анимации<small>${GV}</small></span><input type="checkbox" class="switch" data-media="1" role="switch" ${state.media ? "checked" : ""}></label>
        <p class="small muted" style="margin-top:6px">Анимации принадлежат Gym visual и распространяются в exercises-dataset с их разрешения. Сюда они не скопированы — подгружаются по ссылке из исходного репозитория и только на этом устройстве, если включишь. Для публичного использования условия Gym visual требуют собственной лицензии.</p>
      </section>`)}
      ${setSec("smartphone", "Приложение", `<section class="card">
        ${isStandalone() ? `<p class="small">Установлено и работает без сети.</p>` : installEvt ? `<button class="btn primary" data-install="1">${icon("download", 18)}Установить на устройство</button>` : `<p class="small">${isIOS ? "В Safari: «Поделиться» → «На экран „Домой“»." : "В меню браузера: «Установить приложение» или «Добавить на главный экран»."}</p>`}
        <p class="small muted">Апгрейд · программа v${esc(P.meta.version)}</p>
      </section>`)}`;
  }

  /* ---------- main render ---------- */
  const TITLES = { today: "Сегодня", plan: "Программа", library: "Упражнения", journal: "Прогресс", more: "Ещё", cardio: "Кардио и движение", body: "Суставы и сигналы", food: "Питание", science: "Почему так", settings: "Настройки" };
  const SUB_OF_MORE = ["cardio", "body", "food", "science", "settings"];
  // внутренние ключи вкладок прежние (plan, journal) — их хранит S "tab" и адреса ?tab=
  const NAV = [["today", "Сегодня", "dumbbell"], ["plan", "Программа", "layers"], ["library", "Упражнения", "search"], ["journal", "Прогресс", "bar-chart"], ["more", "Ещё", "more-horizontal"]];
  function render() {
    const sub = SUB_OF_MORE.includes(state.tab);
    if (state.tab === "plan") planInit(ctxNow());
    const psub = state.tab === "plan" && (state.pv || "hub") !== "hub";
    $("#title").textContent = psub ? (state.pv === "sess" ? (sessOf(planKey()) || {}).title || "Тренировка" : state.pv === "sched" && isCustom() ? "Расписание и недели" : PV_TITLES[state.pv] || "Программа")
      : state.tab === "body" && P.meta.bodyMenu ? P.meta.bodyMenu[0] : TITLES[state.tab] || "Апгрейд";
    // «назад»: из подраздела «Ещё» — в «Ещё»; с экрана «Программы» — в хаб или во вкладку, откуда пришли по ссылке
    const backTo = sub ? "Ещё" : psub ? (state.pFrom && own(TITLES, state.pFrom) ? TITLES[state.pFrom] : "Программа") : "";
    const bk = $("#back");
    bk.hidden = !backTo;
    if (backTo && bk.dataset.to !== backTo) { bk.dataset.to = backTo; bk.innerHTML = `${icon("arrow-left", 18)}${esc(backTo)}`; bk.setAttribute("aria-label", `Назад: «${backTo}»`); }
    const hm = $("#hdrMenu"), hr = $("#hdrRen"), onSess = psub && state.pv === "sess" && !state.reorder;
    if (hm) hm.hidden = !onSess;
    if (hr) hr.hidden = !onSess;
    document.querySelector(".top").classList.toggle("sub-on", sub || psub);
    document.querySelector(".top").classList.toggle("sess-on", onSess);
    $("#offline").hidden = navigator.onLine !== false || !!(SY && SY.configured() && SY.signedIn());
    updateSyncBtn();
    $("#nav").innerHTML = NAV.map(([id, n, ic]) => {
      const on = state.tab === id || (id === "more" && sub);
      return `<button class="nav-i ${on ? "on" : ""}" data-tab="${id}" aria-current="${on ? "page" : "false"}"><span class="nav-pill">${icon(ic, 24)}</span><span>${n}</span></button>`;
    }).join("");
    const fn = { today: renderToday, plan: renderPlan, library: renderLibrary, journal: renderJournal, more: renderMore, cardio: renderCardio, body: renderBody, food: renderFood, science: renderScience, settings: renderSettings }[state.tab] || renderToday;
    // фокус на ✓, −/+ или чипе переживает перерисовку (например, после синхронизации)
    const a = document.activeElement, keep = a && a.dataset && a.closest && a.closest("#app")
      ? ["done", "step", "rir", "allsets", "ctl", "day", "time", "ready"].map((k) => (a.dataset[k] != null ? `[data-${k}="${a.dataset[k]}"]` : "")).find(Boolean) : "";
    // «Сегодня» → «Сегодня»: верхняя видимая карточка остаётся на месте, даже если над ней пропал или появился
    // баннер (день отдыха, «неделя закрыта», вход) или свернулась законченная карточка — кнопки не уезжают из-под пальца
    const anc = state.tab === "today" && state.shownTab === "today" ? todayAnchor() : null;
    $("#app").innerHTML = fn();
    state.shownTab = state.tab;
    if (anc) { const el = document.querySelector(`#app .ex[data-ex="${anc.id}"]`); if (el) { const dy = Math.round(el.getBoundingClientRect().top - anc.top); if (dy) window.scrollBy(0, dy); } }
    if (CH) CH.mount($("#app"));
    const top = document.querySelector(".top"); if (top) document.documentElement.style.setProperty("--top-h", top.offsetHeight + "px");
    if (keep) focusSel(keep);
    const tb = $("#timerBtn"); if (tb) tb.hidden = state.tab !== "today";
    document.body.classList.toggle("acts-on", !!document.querySelector("#app .plan-acts:not(.qe-open)")); // тост — над липкой панелью
    if (state.tab !== "today" && T.state === "idle") $("#tPanel").classList.remove("open");
    syncURL();
  }
  /** Адрес следует за экраном: ?tab=… , для «Программы» — &s=1A или &pv=sched (перезагрузка открывает тот же экран). */
  function syncURL() {
    try {
      const q = state.tab !== "plan" ? `?tab=${state.tab}` : state.pv === "sess" ? `?tab=plan&s=${planKey()}` : own(PV_TITLES, state.pv) ? `?tab=plan&pv=${state.pv}` : "?tab=plan";
      if (location.search !== q) history.replaceState(history.state, "", location.pathname + q + location.hash);
    } catch (e) { /* без истории */ }
  }
  /* Клавиатура телефона: пока она открыта, нижнее меню и липкая панель не съедают место над полем ввода. */
  let kbBase = 0; // высота экрана без клавиатуры (запоминаем, пока никто не печатает)
  function kbCheck() {
    const vv = window.visualViewport, a = document.activeElement; if (!vv) return;
    const typing = !!(a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && !/^(checkbox|radio|file|button)$/.test(a.type || ""))));
    if (!typing || vv.height > kbBase) kbBase = Math.max(vv.height, typing ? kbBase : 0);
    document.body.classList.toggle("kb-on", typing && vv.height < kbBase * 0.8);
  }
  if (window.visualViewport) window.visualViewport.addEventListener("resize", kbCheck);
  document.addEventListener("focusin", () => setTimeout(kbCheck, 300));
  document.addEventListener("focusout", () => setTimeout(kbCheck, 50));
  /** Первая карточка упражнения, видимая под шапкой: { id, top }. */
  function todayAnchor() {
    const top = document.querySelector(".top"), line = top ? top.getBoundingClientRect().bottom : 0;
    const el = [...document.querySelectorAll("#app .ex[data-ex]")].find((e) => e.getBoundingClientRect().bottom > line + 1);
    return el ? { id: el.dataset.ex, top: el.getBoundingClientRect().top } : null;
  }
  function go(tab) {
    hideToast();
    if (state.tab === "plan" && tab !== "plan" && (state.pv || "hub") === "hub") state.hubY = window.scrollY;
    if (tab !== "plan") state.reorder = false;
    state.pFrom = null; // прямая ссылка из другой вкладки больше не действует
    state.tab = tab; S.set("tab", tab); render();
    window.scrollTo(0, tab === "plan" && (state.pv || "hub") === "hub" ? state.hubY || 0 : 0);
    if (layered()) pushGuard(); else dropGuard();
  }

  /* ---------- системная «назад» (Android, жест): закрывает шторку и таймер, из подраздела «Ещё» — на уровень выше ----------
     Пока что-то открыто, в истории лежит одна «страховочная» запись; «назад» снимает её и закрывает верхний слой.
     Закрыли кнопкой — запись убираем сами (history.back), чтобы следующее «назад» не тратилось впустую. */
  let navGuard = false, skipPop = false;
  // с любой вкладки, кроме «Сегодня», системная «назад» ведёт на «Сегодня»; с «Сегодня» — выход из приложения
  const layered = () => SH.open || state.tab !== "today" || planSub() || $("#tPanel").classList.contains("open");
  function pushGuard() { if (navGuard) return; try { history.pushState({ upg: 1 }, ""); navGuard = true; } catch (e) { /* без истории */ } }
  function dropGuard() {
    setTimeout(() => { if (navGuard && !layered() && history.state && history.state.upg) { navGuard = false; skipPop = true; history.back(); } }, 0);
  }
  window.addEventListener("popstate", () => {
    if (skipPop) { skipPop = false; syncURL(); return; }
    navGuard = false;
    if (LG.open) return;
    if (SH.open) { if (SH.stack.length) sheetBack(); else closeSheet(); }
    else if ($("#tPanel").classList.contains("open")) $("#tPanel").classList.remove("open");
    else if (planSub()) planBack();
    else if (SUB_OF_MORE.includes(state.tab)) go("more");
    else if (state.tab !== "today") go("today");
    if (layered()) pushGuard();
  });
  const parseSlot = (v) => { const [key, gi, ii] = String(v).split(":"); return [key, +gi, +ii]; };
  function focusSel(a, b) {
    const x = document.querySelector(a), y = b ? document.querySelector(b) : null;
    const ok = (e) => e && !e.disabled && e.getClientRects().length > 0; // скрытые (в свёрнутой панели) — мимо
    const el = ok(x) ? x : ok(y) ? y : null;
    if (el) el.focus({ preventScroll: true });
  }

  /* ---------- «Сегодня»: подход одним касанием ----------
     В logs попадают только выполненные подходы — с повторами, и всегда целиком (вес и повторы, вместе
     с подставленной целью). Вес и повторы незаписанного подхода (ввод, −/+, отменённый подход) живут
     в черновике state.draft. Запись дня создаётся и цикл сдвигается только при записи подхода.
     ✓ — дальше: в связке — следующее упражнение того же подхода (без отдыха); круг закончен — таймер
     отдыха группы и первое несделанное упражнение; всё сделано — запас и итог тренировки.
     ✓ на записанном подходе отменяет запись. */
  let lastOk = { at: 0, key: "", timer: false };
  function rowVals(row) { return { w: row.querySelector('[data-f="w"]').value.trim(), r: row.querySelector('[data-f="r"]').value.trim() }; }
  function curSet(exId, i) { const e = state.logs[logKey(todayISO(), state.day)]; return (e && e.ex && e.ex[exId] && e.ex[exId][i]) || null; }
  /** Экран нарисован вчера (приложение пережило полночь) — сначала перерисовать, а не писать в новую дату. */
  const dayChanged = () => !!state.renderDate && state.renderDate !== todayISO();
  /** Записать выполненный подход i. Первая запись новой недели сдвигает цикл. */
  function storeSet(exId, i, v) {
    const ctx = ctxNow(), entry = todayEntry(ctx);
    const arr = entry.ex[exId] = entry.ex[exId] || [];
    arr[i] = v;
    // цикл нагрузки: номер шага — в записи дня (по нему потом ищется «прошлый раз на этом шаге»)
    const sm = todayModel(ctx).items.find((x) => x.r.exId === exId);
    if (sm && sm.r.step) { entry.st = Object.assign({}, entry.st, { [exId]: sm.r.step.i }); }
    for (let j = 0; j < arr.length; j++) if (!arr[j]) arr[j] = {};
    if (ctx.next) setCycle({ idx: ctx.idx, since: todayISO() }, "auto");
    S.set("logs", state.logs);
    if (toastTag === "switch") hideToast(); // подход в новой программе записан — отмены перехода больше нет
  }
  /** Убрать подход i. Хвосты без повторов срезаются, запас упражнения сбрасывается (оно больше не закончено);
      если в записи дня не осталось подходов — запись удаляется (заметка и суставы её сохраняют),
      а сдвиг цикла, сделанный этой записью сегодня, откатывается. */
  function removeSet(exId, i) {
    const key = logKey(todayISO(), state.day), entry = state.logs[key];
    if (!entry || !entry.ex || !entry.ex[exId]) return;
    const arr = entry.ex[exId];
    arr[i] = {};
    while (arr.length && !performed(arr[arr.length - 1])) arr.pop();
    if (!arr.length) delete entry.ex[exId];
    if (entry.rir) { delete entry.rir[exId]; if (!Object.keys(entry.rir).length) delete entry.rir; }
    if (!entryHasData(entry)) {
      const s = entry.s || {};
      if (!s.note && !(s.joints && Object.keys(s.joints).length)) delete state.logs[key];
      rollbackAuto(entry.idx);
    }
    S.set("logs", state.logs);
  }
  /** Откатить автосдвиг цикла, если он сделан сегодня и в той неделе не осталось ни одной тренировки. */
  function rollbackAuto(idx) {
    const cyc = cycleState(), h = cyc.hist || [], last = h[h.length - 1];
    if (!last || last.why !== "auto" || last.at !== todayISO() || last.to !== cyc.idx || idx !== cyc.idx) return;
    if (Object.keys(state.logs).some((k) => mineK(k) && entryHasData(state.logs[k]) && state.logs[k].idx === cyc.idx)) return; // только записи этой программы
    let since = null;
    if ("ps" in last) since = last.ps;
    else for (let j = h.length - 2; j >= 0; j--) if (h[j].to === last.from) { since = h[j].at; break; }
    writeCycle({ idx: last.from, since, hist: h.slice(0, -1) });
  }
  /** Карточка показывает ✓ кнопку целиком над нижней панелью и таймером? */
  function inView(el) {
    const r = el.getBoundingClientRect(), top = document.querySelector(".top"), bar = $("#tBar"), nav = $("#nav");
    const t = top ? top.getBoundingClientRect().bottom : 0;
    let b = window.innerHeight - (nav ? nav.getBoundingClientRect().height : 0);
    if (bar && !bar.hidden) b = Math.min(b, bar.getBoundingClientRect().top);
    return r.top >= t + 4 && r.bottom <= b - 4;
  }
  const motion = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
  const todayE = () => state.logs[logKey(todayISO(), state.day)] || {};
  function goCheckin() {
    const c = $("#checkin"); if (!c) return;
    c.scrollIntoView({ block: "start", behavior: motion() });
    const h = c.querySelector("h3"); if (h) h.focus({ preventScroll: true });
  }
  /** Фокус на ✓ следующего подхода; прокрутить, только если его не видно. */
  function focusNextOk() {
    const nb = document.querySelector(".ex.cur .log-row.next .set-ok") || document.querySelector(".ex.active .log-row.next .set-ok");
    if (!nb) { if (!todayModel(ctxNow()).active) goCheckin(); return; }
    nb.focus({ preventScroll: true });
    const card = nb.closest(".ex"), head = card && card.querySelector(".ex-h");
    if (!inView(nb) || (head && !inView(head))) { if (card) card.scrollIntoView({ block: "start", behavior: motion() }); }
  }
  function confirmSet(btn) {
    if (dayChanged()) { render(); return; }
    const [exId, iStr] = btn.dataset.done.split(":"), i = +iStr, key = `${openKey(exId)}|${i}`, now = Date.now();
    // двойное касание: следующий ✓ уже под пальцем — не записывать и не отменять ещё раз
    if (now - lastOk.at < 500) return;
    const row = btn.closest(".log-row"), wIn = row.querySelector('[data-f="w"]'), rIn = row.querySelector('[data-f="r"]');
    const c = curSet(exId, i), typed = !!state.typed[key];
    if (setDone(c) && !typed) { unlogSet(exId, i, key, c); return; }
    const { w, r: rv } = rowVals(row);
    if (!rv) { rIn.focus(); return; }
    // первая запись упражнения с весом: пустой вес — спросить один раз, второе касание сохранит как есть
    if (!w && wIn.dataset.needw && state.askW !== key) { state.askW = key; wIn.focus(); return; }
    state.askW = null; delete state.typed[key]; delete state.allSets[openKey(exId)];
    wakeAudio();
    storeSet(exId, i, Object.assign({}, setDone(c) ? c : {}, { w, r: rv }));
    delete state.draft[draftKey(exId, i, "w")]; delete state.draft[draftKey(exId, i, "r")];
    lastOk = { at: now, key, timer: false };
    const M = todayModel(ctxNow()), m = M.items.find((x) => x.r.exId === exId);
    if (!m) { render(); return; }
    const grp = M.items.filter((x) => x.gi === m.gi);
    let next = null, rest = true;
    if (grp.length > 1) {
      const k = grp.indexOf(m);
      for (let s = 1; s < grp.length && !next; s++) {
        const x = grp[(k + s) % grp.length];
        if (x.nSets > i && !setDone(x.cur[i])) next = x;
      }
      if (next) rest = false; // тот же круг связки — без отдыха
    }
    if (!next) next = grp.find((x) => !x.full) || M.items.find((x) => !x.full) || null;
    state.curEx = next ? { k: logKey(todayISO(), state.day), id: next.r.exId } : null;
    if (next) state.open[openKey(next.r.exId)] = { v: true, sig: openSig(next) };
    render();
    // новый круг уже идёт — старый отдых не должен пищать посреди подхода
    if (!rest && T.state !== "idle") stopTimer();
    if (rest && next) { startTimer(Math.round(restSec(m.g.rest))); lastOk.timer = true; }
    const behavior = motion(), needRir = m.full && !(todayE().rir || {})[exId] && m.ex.unit !== "sec";
    const fin = needRir ? document.querySelector(`.ex[data-ex="${exId}"]`) : null;
    if (!next) {
      if (T.state !== "idle") stopTimer(); // подходов больше нет — отдых от прошлого подхода не должен пищать
      // тренировка закончена: сначала запас последнего упражнения, итог — после ответа
      if (fin) { if (!inView(fin)) fin.scrollIntoView({ block: "center", behavior }); focusSel(`.ex[data-ex="${exId}"] .rir-ask [data-rir]`); return; }
      goCheckin();
      return;
    }
    const nb = document.querySelector(`[data-done="${next.r.exId}:${next.nextI}"]`);
    if (!nb) return;
    nb.focus({ preventScroll: true });
    // упражнение закончено и ждёт отметку запаса — держим его строку на экране вместе со следующим ✓
    if (fin && next !== m && !(inView(fin) && inView(nb))) { fin.scrollIntoView({ block: "start", behavior }); return; }
    // всё видно (✓ и заголовок карточки над таймером и меню) — страница не прыгает
    const head = next !== m && nb.closest(".ex") ? nb.closest(".ex").querySelector(".ex-h") : null;
    if (inView(nb) && (!head || inView(head))) return;
    if (next === m) nb.scrollIntoView({ block: "center", behavior });
    else { const card = nb.closest(".ex"); if (card) card.scrollIntoView({ block: "start", behavior }); }
  }
  function unlogSet(exId, i, key, c) {
    // значения (и пустой вес тоже) остаются в строке как черновик — подставленная цель их не перебивает
    state.draft[draftKey(exId, i, "w")] = c.w || "";
    state.draft[draftKey(exId, i, "r")] = c.r || "";
    removeSet(exId, i);
    if (lastOk.key === key && lastOk.timer && Date.now() - lastOk.at < 20000) stopTimer(); // отменили сразу — и отдых не нужен
    lastOk = { at: Date.now(), key: "", timer: false };
    state.allSets[openKey(exId)] = true; // отменённая строка остаётся на виду для правки
    render();
    focusSel(`[data-done="${exId}:${i}"]`);
  }
  /** −/+ : в незаписанном подходе — только черновик, в записанном — правка записи. false — ничего не изменилось. */
  function doStep(t) {
    if (dayChanged()) { render(); return false; }
    const [exId, i, f, dir] = t.dataset.step.split(":");
    const inp = document.querySelector(`input[data-log="${exId}"][data-i="${i}"][data-f="${f}"]`);
    if (!inp) return false;
    const ex = EX[exId], wIn = document.querySelector(`input[data-log="${exId}"][data-i="${i}"][data-f="w"]`);
    const v = stepValue(inp.value, f, +dir, { sec: !!ex && ex.unit === "sec", load: !!(wIn && wIn.dataset.load) });
    if (v == null || v === inp.value) return false;
    inp.value = v; inp.classList.remove("sug");
    if (inp.closest(".log-row.done")) inp.dispatchEvent(new Event("input", { bubbles: true }));
    else state.draft[draftKey(exId, i, f)] = v;
    return true;
  }
  // зажатая −/+ повторяет шаг, всё быстрее; короткое касание обрабатывает обычный click.
  // Флаг held гасит click сразу после удержания и снимается сам, как бы удержание ни закончилось.
  let hold = null;
  const stopHold = () => {
    if (!hold) return;
    clearTimeout(hold.id);
    const t = hold.t; hold = null;
    if (t.dataset.held) setTimeout(() => { delete t.dataset.held; }, 350);
  };
  document.addEventListener("pointerdown", (e) => {
    const t = e.target.closest && e.target.closest("[data-step]");
    if (!t || t.disabled) return;
    stopHold(); delete t.dataset.held;
    let delay = 320;
    const run = () => { if (!hold) return; t.dataset.held = "1"; if (!doStep(t)) { stopHold(); return; } delay = Math.max(55, delay * 0.82); hold.id = setTimeout(run, delay); };
    hold = { t, id: setTimeout(run, 450) };
  });
  ["pointerup", "pointercancel", "touchcancel", "scroll"].forEach((ev) => document.addEventListener(ev, stopHold, true));
  document.addEventListener("contextmenu", (e) => { if (e.target.closest && e.target.closest("[data-step]")) e.preventDefault(); });
  document.addEventListener("focusin", (e) => { const t = e.target; if (t.classList && t.classList.contains("sug") && t.select) setTimeout(() => { try { t.select(); } catch (err) { /* */ } }, 0); });
  document.addEventListener("toggle", (e) => {
    const d = e.target.dataset; if (!d) return;
    if (d.warm) state.warmOpen = e.target.open;
    if (d.cycmore) state.cycMore = e.target.open;
    if (d.shmore && SH.open && SH.o) SH.o.more = e.target.open; // «Ещё» в шторке упражнения остаётся раскрытым после правки
  }, true);
  /** Перенести раскрытость карточки на новое упражнение при замене. */
  function carryOpen(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    const o = state.open[openKey(fromId)];
    if (o) state.open[openKey(toId)] = { v: o.v, sig: "carry" };
  }

  /* ---------- events ---------- */
  let savedTimer = null;
  document.addEventListener("click", (e) => {
    if (e.target.closest("#sheet,#toast,#login")) return;
    const row = e.target.closest(".lib-row");
    if (row && !e.target.closest("button,a")) { toggleLib(row); return; }
    const t = e.target.closest("button,[data-tab],[data-jex]");
    if (!t) return;
    const d = t.dataset;
    if (d.fav) {
      const on = toggleFav(d.fav);
      document.querySelectorAll(`[data-fav="${d.fav.replace(/"/g, "")}"]`).forEach((b) => {
        b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on));
        if (b.classList.contains("lib-fav")) b.innerHTML = favLab(on);
        else { b.innerHTML = starIc(on); b.setAttribute("aria-label", b.getAttribute("aria-label").replace(/^[^:]+/, on ? "Убрать из избранного" : "В избранное")); }
      });
      if (state.tab === "library" && LIB.bp === "fav" && !on) { const el = $("#libList"); if (el) el.innerHTML = libListHTML(); }
      return;
    }
    if (t.id === "syncBtn") { syncBtnClick(); return; }
    if (d.login && SY) { openLogin("manual"); return; }
    if (d.acc && SY) { openAccount("[data-acc]"); return; }
    if (d.jtab) { state.jtab = d.jtab; render(); return; }
    if (d.jvol !== undefined) { state.jvol = +d.jvol; render(); return; }
    if (d.jex) { state.jex = state.jex === d.jex ? null : d.jex; render(); const r = document.querySelector(`[data-jex="${d.jex}"]`); if (r && state.jex) r.focus({ preventScroll: true }); return; }
    if (d.sync === "now" && SY) { SY.syncNow(); return; }
    if (d.toggle) {
      const exEl = t.closest(".ex"), pane = exEl.querySelector(`[data-pane="${d.toggle}"]`);
      if (pane) {
        pane.hidden = !pane.hidden; t.setAttribute("aria-expanded", String(!pane.hidden)); t.classList.toggle("on", !pane.hidden);
        if (d.toggle === "log" && exEl.classList.contains("lite")) {
          state.curEx = { k: logKey(todayISO(), state.day), id: exEl.dataset.ex }; render(); focusSel(`.ex[data-ex="${exEl.dataset.ex}"] .ex-tap`); return;
        }
        if (d.toggle === "log" && exEl.dataset.ex) {
          const m = todayModel(ctxNow()).items.find((x) => x.r.exId === exEl.dataset.ex);
          if (m && m.full && !pane.hidden) { state.open[openKey(m.r.exId)] = { v: true, sig: openSig(m) }; render(); focusSel(`.ex[data-ex="${m.r.exId}"] .ex-tap`); return; }
          if (m) state.open[openKey(m.r.exId)] = { v: !pane.hidden, sig: openSig(m) };
          exEl.classList.toggle("open", !pane.hidden);
        }
      }
      return;
    }
    if (d.ctl) { state.ctlOpen = !state.ctlOpen; render(); focusSel("[data-ctl]"); return; }
    if (d.done) { confirmSet(t); return; }
    if (d.step) { if (d.held) { delete d.held; return; } doStep(t); return; }
    if (d.allsets) { const k = openKey(d.allsets); state.allSets[k] = !state.allSets[k]; render(); focusSel(`.ex[data-ex="${d.allsets}"] [data-allsets]`, `.ex[data-ex="${d.allsets}"] .set-ok`); return; }
    if (d.pv) { planGo(d.pv); return; }
    if (d.psmore) { state.psMore = !state.psMore; render(); focusSel("[data-psmore]"); return; }
    if (d.pb) { state.pb = +d.pb; state.reorder = false; state.qe = null; render(); focusSel(`[data-pb="${d.pb}"]`); return; }
    if (d.pd) { planGo("sess", { d: d.pd }); return; }
    if (d.pren) { openSheet("day", { key: planKey(), focus: "title" }, "[data-pren]"); return; }
    if (d.pmenu) { openSheet("prog", {}, "[data-pmenu]"); return; }
    if (d.pitem) { openSheet("prog", { id: d.pitem }, `[data-pitem="${d.pitem}"]`); return; }
    if (d.pswitch) { openSheet("pswitch", { id: d.pswitch }, `[data-pswitch="${d.pswitch}"]`); return; }
    if (d.pnew) { openSheet("pnew", {}, "[data-pnew]"); return; }
    if (d.pedit) { if (curRec()) { openSheet("pedit", { id: BOUND, f: d.pedit }, `[data-pedit="${d.pedit}"]`); focusSel("#shPName"); } return; }
    if (d.dayadd) { addDayAct(); return; }
    if (d.finish !== undefined) {
      if (dayChanged()) { render(); return; }
      const e = todayLog(state.day); if (!e) return;
      if (d.finish === "1") e.fin = new Date().toISOString(); else delete e.fin;
      S.set("logs", state.logs); render();
      focusSel(d.finish === "1" ? '[data-finish="0"]' : '[data-finish="1"]');
      if (d.finish === "1") { const c = document.querySelector(".fin-card"); if (c) c.scrollIntoView({ block: "center", behavior: motion() }); }
      return;
    }
    if (d.cycopen) { const [gi, ii] = d.cycopen.split(":").map(Number); state.qe = null; openSheet("cyc", { key: planKey(), gi, ii, open: null }, `.pr-q[data-cycopen="${d.cycopen}"]`); return; }
    if (d.tmset) { openSheet("tm", { ex: d.tmset }, `[data-tmset="${d.tmset}"]`); focusSel("#shTm2"); return; }
    if (d.tmup) {
      const ex = d.tmup, old = tmOf(ex); if (old == null) return;
      saveTm(ex, Math.min(1000, old + 2.5)); setTmUp(ex, true); render();
      toast(`Максимум «${exName(ex)}» — ${fmtW(tmOf(ex))} кг`, () => { saveTm(ex, old); setTmUp(ex, false); render(); });
      return;
    }
    if (d.pw) {
      const rec = curRec(); if (!rec || !isCustom()) return;
      const r = PG.setRot(rec, +d.pw); if (r.error) { toast(r.error); return; }
      saveRec(rebased(rec, r.rec)); state.day = resetDay(); render(); focusSel(`[data-pw="${d.pw}"]`);
      const now = rotNow(), note = queueNote();
      toast(note ? note.trim() : now ? `${now.pw} в неделю — по очереди` : "Все тренировки каждую неделю", () => { const cur = curRec(); if (!cur) return; saveRec(keepRules(PG.patch(cur, {}), rec)); state.day = resetDay(); render(); });
      return;
    }
    if (d.wcell !== undefined) { openSheet("wdpick", { wd: +d.wcell }, `[data-wcell="${d.wcell}"]`); return; }
    if (d.paddto) { planGo("sess", { d: d.paddto }); openSheet("add", { b: state.pb, d: d.paddto, fix: true }, "[data-padd]"); return; }
    if (d.pi) { const [gi, ii] = d.pi.split(":").map(Number); openSheet("item", { key: planKey(), gi, ii, v: (state.qe && state.qe.gi === gi && state.qe.ii === ii && state.qe.v) || "" }, `.pr-open[data-pi="${d.pi}"]`); return; }
    if (d.qopen) {
      const [gi, ii] = d.qopen.split(":").map(Number), k = planKey(), q = state.qe;
      if (q && q.key === k && q.gi === gi && q.ii === ii) state.qe = null; else qeOpen(k, gi, ii);
      render(); focusSel(`.pr-q[data-qopen="${d.qopen}"]`);
      revealQe();
      return;
    }
    if (d.qundo) { qeUndo(); return; }
    if (d.pundo) { undoPlanOp(); return; }
    if (d.qv !== undefined && state.qe) { state.qe.v = d.qv; render(); focusSel(`[data-qv="${d.qv}"]`); return; }
    if (d.qe) { qeApply(d.qe, d.v, t); return; }
    if (d.pday) { openSheet("day", { key: planKey() }, "[data-pday]"); return; }
    if (d.pg !== undefined) { openSheet("group", { key: planKey(), gi: +d.pg }, `[data-pg="${d.pg}"]`); return; }
    if (d.padd) { openSheet("add", { b: state.pb, d: state.pd, fix: true }, "[data-padd]"); return; }
    if (d.preorder !== undefined) {
      if (d.preorder === "1") { state.reorder = true; state.qe = null; state.reorderSnap = PM.snapshot(); render(); const h = $(".ro-head"); if (h) h.scrollIntoView({ block: "start" }); focusSel("[data-preorder='0']"); pushGuard(); return; }
      endReorder();
      return;
    }
    if (d.preset) {
      const snap = PM.snapshot(), msg = `Тренировка ${d.preset[1]}, блок ${d.preset[0]} — снова как в программе`;
      PM.reset(d.preset); setPlanUndo(snap, msg); render(); focusSel("[data-pundo]");
      return;
    }
    if (d.roi) {
      const [gi, ii, dir] = d.roi.split(":").map(Number), pos = PM.move(planKey(), gi, ii, dir);
      if (pos) { state.flash = `${pos.gi}:${pos.ii}`; render(); focusSel(`[data-roi="${pos.gi}:${pos.ii}:${dir}"]`, `[data-roi="${pos.gi}:${pos.ii}:${-dir}"]`); }
      return;
    }
    if (d.rog) {
      const [gi, dir] = d.rog.split(":").map(Number), to = PM.moveGroup(planKey(), gi, dir);
      if (to != null) { render(); focusSel(`[data-rog="${to}:${dir}"]`, `[data-rog="${to}:${-dir}"]`); }
      return;
    }
    if (d.planedit) { const m = /^(\d+)([A-F])$/.exec(d.planedit); if (!m) return; state.pFromY = window.scrollY; planGo("sess", { b: +m[1], d: m[2], from: state.tab }); return; }
    if (d.rep) {
      const [key, gi, ii] = parseSlot(d.rep), it = sessOf(key).groups[gi].items[ii], ctx = ctxNow();
      openSheet("replace", { key, gi, ii, v: it.weekAlt ? (ctx.heavy ? "0" : "1") : "", mode: "today" }, `[data-rep="${d.rep}"]`);
      return;
    }
    if (d.repback) {
      const [key, gi, ii] = parseSlot(d.repback), g = sessOf(key).groups[gi], ctx = ctxNow();
      const r = resolveItem(g.items[ii], ctx, `${key}-${g.id}-${ii}`), prev = S.get("daySw", null);
      carryOpen(r.exId, r.planned);
      setDaySwap(key[1], r.planned, null); render(); focusSel(`[data-rep="${d.repback}"]`, `.ex[data-ex="${r.planned}"] .ex-tap`);
      toast(`Вернул «${exName(r.planned)}»`, () => { S.set("daySw", prev); render(); });
      return;
    }
    if (d.libadd) {
      const x = LIB.items && LIB.items.find((i) => i.id === d.libadd); if (!x) return;
      const ctx = ctxNow(), pid = PM.progOf(x.id), at = { b: ctx.block, d: ctx.day || "A" };
      openSheet("addplace", pid ? Object.assign({ ex: pid }, at) : Object.assign({ ds: x }, at), `[data-libadd="${d.libadd}"]`);
      return;
    }
    if (d.cycfocus) { state.pFromY = window.scrollY; planGo("sched", { from: state.tab }); return; }
    if (d.tab) {
      // повторное касание «Программы» в нижнем меню — к корню вкладки
      if (d.tab === "plan" && state.tab === "plan" && t.classList.contains("nav-i")) { if ((state.pv || "hub") === "hub" && !state.reorder) { state.hubY = 0; window.scrollTo(0, 0); } else planGo("hub"); return; }
      go(d.tab); return;
    }
    if (t.id === "back") { if (state.tab === "plan") planBack(); else go("more"); return; }
    if (d.day) { state.day = d.day; state.dayDate = todayISO(); S.set("dayPick", { date: todayISO(), day: d.day, prog: BOUND }); render(); return; }
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
      const item = { id: "a" + Date.now().toString(36), title: a.title, reason: a.reason, created: new Date().toISOString(), source: "import", enabled: true, changes: a.changes };
      if (!isMain()) item.prog = BOUND; // корректировка — к текущей программе (нет поля — встроенная)
      list.push(item);
      S.set("adjust", list);
      adjDraft = null; render();
      const m = $("#agentMsg"); if (m) m.textContent = "";
      const el2 = $("#adjust"); if (el2) el2.scrollIntoView({ block: "start" });
      return;
    }
    if (d.adjcycle) { const map = { deload_now: "deload", repeat_week: "repeat", next_block: "nextblock" }; if (map[d.adjcycle]) cycleAction(map[d.adjcycle]); return; }
    if (d.adjdel) {
      if (t.dataset.armed !== "1") { t.dataset.armed = "1"; t.classList.add("danger"); t.innerHTML = `${icon("trash", 18)}Удалить?`; setTimeout(() => { if (t.isConnected) { t.dataset.armed = ""; t.classList.remove("danger"); t.innerHTML = icon("trash", 18); } }, 4000); return; }
      S.set("adjust", (S.get("adjust", []) || []).filter((a) => a.id !== d.adjdel)); render(); return;
    }
    if (d.undo && lastUndo) { if (lastUndo.prog === BOUND) writeCycle(lastUndo.prev); lastUndo = null; state.day = resetDay(); render(); return; }
    if (d.fatigueskip) { S.set("fatigueSkip", isMain() ? ctxNow().cyc.idx : `${BOUND}:${ctxNow().cyc.idx}`); render(); return; }
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
      t.innerHTML = jointChip(name, lv); t.setAttribute("aria-label", `${name}: ${JOINT_LV[lv] || "в порядке"}`);
      return;
    }
    if (d.rir) {
      if (dayChanged()) { render(); return; }
      const [exId, val] = d.rir.split(":");
      const ctx = ctxNow(), e = todayEntry(ctx);
      e.rir = e.rir || {};
      if (e.rir[exId] === val) delete e.rir[exId]; else e.rir[exId] = val;
      S.set("logs", state.logs);
      const ask = !!t.closest(".rir-ask");
      render(); // выбранный запас складывается в строку «… · запас 1»
      if (ask) focusNextOk(); // из свёрнутой строки — дальше к следующему подходу или к итогу
      else focusSel(`[data-rir="${d.rir}"]`, `.ex[data-ex="${exId}"] .ex-tap`);
      return;
    }
    if (d.volblock) { state.volBlock = +d.volblock; render(); return; }
    if (d.libbp) { LIB.bp = d.libbp; LIB.limit = 40; render(); return; }
    if (d.libmore) { LIB.limit += 40; $("#libList").innerHTML = libListHTML(); return; }
    if (d.showmedia) { const box = d.into && t.closest(".lib-d") ? t.closest(".lib-d").querySelector(d.into) : null; if (box) { box.innerHTML = mediaBlock(d.showmedia, d.alt || "", true); t.remove(); } else t.outerHTML = mediaBlock(d.showmedia, d.alt || "", true); return; }
    if (d.libeqopen) { openSheet("eq", {}, "[data-libeqopen]"); return; }
    if (d.install && installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; render(); }); return; }
    if (d.closehint) { S.set("installHintClosed", true); render(); return; }
    if (d.hidelogin) { S.set("loginHintHidden", true); render(); toast("Скрыто. Войти можно в «Настройках» или по значку в шапке"); return; }
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
      // поля — в двух карточках («Программа» — старт, только у встроенной; «Для расчётов» — вес и пульс); нет поля — значение прежнее
      const get = (n) => { const el = document.querySelector(`#app [name="${n}"]`); return el ? el.value.trim().replace(",", ".") : null; };
      const oldStart = state.settings.start, st = get("start"), bw = get("bw"), hr = get("hrmax");
      state.settings = Object.assign({}, state.settings, { start: st == null ? oldStart : st || P.meta.startDefault, bw: bw == null ? state.settings.bw : +bw || P.meta.profile.weight, hrmax: hr == null ? state.settings.hrmax : +hr || 180 });
      S.set("settings", state.settings);
      if (state.settings.start !== oldStart) state.day = resetDay(); // выбор дня сбрасывает только смена расписания
      t.innerHTML = `${icon("check", 18)}Сохранено`; return;
    }
    if (d.resetplan) {
      const lab = t.querySelector("span") || t;
      if (t.dataset.armed !== "1") { t.dataset.armed = "1"; lab.textContent = "Точно сбросить все правки?"; setTimeout(() => { if (t.isConnected) { t.dataset.armed = ""; lab.textContent = "Сбросить правки программы"; } }, 4000); return; }
      const undo = resetAllEdits();
      t.dataset.armed = ""; lab.textContent = "Правки сброшены";
      toast("Программа снова как в исходной версии", undo);
      return;
    }
    if (d.export) {
      const data = { app: "upgrade-v3", version: P.meta.version, exported: new Date().toISOString(), settings: state.settings, logs: state.logs, meas: state.meas, goals: state.goals, swaps: state.swaps, cycle: S.get("cycle", null), adjust: S.get("adjust", []), plan: S.get("plan", null), progs: progsAll(), progPos: posAll(), curprog: { id: PG.curOf(S.get("curprog", null)) }, favs: favs() };
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      a.download = `upgrade-v3-${todayISO()}.json`; document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    if (d.themeset) { state.theme = d.themeset; S.set("theme", state.theme); applyTheme(); render(); focusSel(`[data-themeset="${d.themeset}"]`); return; }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches && e.target.matches("[data-qf]")) { e.preventDefault(); e.target.blur(); return; }
    if (e.key === "Escape" && state.qe && !SH.open && !LG.open) {
      const sel = `.pr-q[data-qopen="${state.qe.gi}:${state.qe.ii}"]`;
      e.preventDefault(); state.qe = null; render(); focusSel(sel); return;
    }
    if (LG.open) {
      if (e.key === "Escape" && !LG.busy) { e.preventDefault(); closeLogin(); return; }
      if (e.key === "Tab") trapFocus(e, $("#login"));
      return;
    }
    if (SH.open) {
      if (e.key === "Escape") { e.preventDefault(); if (SH.stack.length) sheetBack(); else closeSheet(); return; }
      if (e.key === "Tab") trapFocus(e, $("#sheet"));
      return;
    }
    if (e.key === "Escape" && planSub() && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || "")) { e.preventDefault(); planBack(); return; }
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("lib-row")) { e.preventDefault(); toggleLib(e.target); }
    if ((e.key === "Enter" || e.key === " ") && e.target.dataset && e.target.dataset.jex) { e.preventDefault(); e.target.click(); }
  });
  function trapFocus(e, box) {
    const f = Array.from(box.querySelectorAll("button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex='-1'])")).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === f.length - 1 || i === -1)) { e.preventDefault(); f[0].focus(); }
  }
  function toggleLib(row) {
    const host = row.closest(".lib-item") || row, nx = host.nextElementSibling;
    if (nx && nx.classList.contains("lib-d")) { nx.remove(); row.setAttribute("aria-expanded", "false"); return; }
    if (row.dataset.libprog && EX[row.dataset.libprog]) { host.insertAdjacentHTML("afterend", libProgDetail(row.dataset.libprog)); row.setAttribute("aria-expanded", "true"); return; }
    const x = LIB.items && LIB.items.find((i) => i.id === row.dataset.libid);
    if (x) { host.insertAdjacentHTML("afterend", libDetail(x)); row.setAttribute("aria-expanded", "true"); }
  }
  document.addEventListener("change", (e) => {
    const t = e.target, d = t.dataset;
    if (d.cycgo) { cycleAction("goto", t.value); return; }
    if (d.qf) { afterTap(render); return; } // значение уже записано на input; перерисовка — когда палец поднят и нажатие прошло
    if (d.adjtoggle) { S.set("adjust", (S.get("adjust", []) || []).map((a) => a.id === d.adjtoggle ? Object.assign({}, a, { enabled: t.checked }) : a)); render(); return; }
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
          if (j.logs) state.logs = cleanLogs(Object.assign({}, state.logs, j.logs));
          if (Array.isArray(j.meas)) { const byDate = {}; state.meas.concat(j.meas).forEach((m) => { byDate[m.date] = m; }); state.meas = Object.values(byDate); }
          if (j.goals) state.goals = Object.assign({}, state.goals, j.goals);
          if (j.swaps) state.swaps = Object.assign({}, state.swaps, j.swaps);
          if (j.settings) state.settings = Object.assign({}, state.settings, j.settings);
          ["logs", "meas", "goals", "swaps", "settings"].forEach((k) => S.set(k, state[k]));
          if (j.cycle && typeof j.cycle.idx === "number") S.set("cycle", j.cycle);
          if (Array.isArray(j.adjust)) S.set("adjust", j.adjust);
          if (j.plan && typeof j.plan === "object") S.set("plan", j.plan);
          // свои программы и их места: из копии добавляются и заменяют те же id (проверенные, не больше лимита); текущая — из копии
          const ip = PG.sanitizeAll(j.progs);
          if (Object.keys(ip).length) {
            const all = Object.assign({}, progsAll());
            Object.keys(ip).forEach((id) => { if (all[id] || PG.count(all) < PG.MAX) all[id] = ip[id]; });
            S.set("progs", all);
          }
          const pp = PG.cleanPosAll(j.progPos);
          if (Object.keys(pp).length) S.set("progPos", Object.assign({}, posAll(), pp));
          if (j.curprog && typeof j.curprog === "object") S.set("curprog", { id: PG.curOf(j.curprog) });
          bindProgram();
          commitMissing(); // текущей из копии нет среди программ — на «Апгрейд»
          state.day = pickDay();
          // избранное не синхронизируется — перенести на другое устройство можно только копией; объединяем, свои — первыми
          if (Array.isArray(j.favs)) S.set("favs", Array.from(new Set(favs().concat(j.favs.filter(favOk)))).slice(0, 300));
          render();
        } catch (err) { alert("Не получилось прочитать файл: " + err.message); }
      };
      r.readAsText(t.files[0]);
    }
  });
  let qTimer = null;
  document.addEventListener("input", (e) => {
    const t = e.target, d = t.dataset;
    if (d.qf) {
      if (t.value.trim() && qeSet(d.qf, t.value)) { const u = document.querySelector(".qe-box [data-qundo]"); if (u) u.disabled = false; }
      return;
    }
    if (d.libq) { clearTimeout(qTimer); qTimer = setTimeout(() => { LIB.q = t.value; LIB.limit = 40; const el = $("#libList"); if (el) el.innerHTML = libListHTML(); }, 150); return; }
    if (d.note) {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => { const e = todayEntry(ctxNow()); e.s = e.s || {}; e.s.note = t.value.slice(0, 500); S.set("logs", state.logs); }, 400);
      return;
    }
    if (!d.log) return;
    t.classList.remove("sug");
    if (dayChanged()) { render(); return; }
    const i = +d.i, row = t.closest(".log-row"), key = `${openKey(d.log)}|${i}`;
    const c = curSet(d.log, i), done = setDone(c), v = row ? rowVals(row) : { w: "", r: "" };
    if (d.f === "r" && v.r) {
      // повторы введены — подход записан целиком: вес из строки (с подставленной целью) тоже
      if (!done) state.typed[key] = true;
      storeSet(d.log, i, Object.assign({}, done ? c : {}, { w: v.w, r: v.r }));
      delete state.draft[draftKey(d.log, i, "w")]; delete state.draft[draftKey(d.log, i, "r")];
      const wIn = row && row.querySelector('[data-f="w"]'); if (wIn) wIn.classList.remove("sug");
    } else if (d.f === "r") {
      // повторы стёрты — подхода больше нет; вес остаётся в строке черновиком
      delete state.typed[key];
      state.draft[draftKey(d.log, i, "w")] = v.w; state.draft[draftKey(d.log, i, "r")] = "";
      if (done) removeSet(d.log, i);
      return;
    } else if (done) storeSet(d.log, i, Object.assign({}, c, { w: v.w }));
    else { state.draft[draftKey(d.log, i, "w")] = v.w; return; } // вес без повторов в запись не попадает
    const s = document.querySelector(`[data-saved="${d.log}"]`);
    if (s) { s.classList.add("on"); clearTimeout(savedTimer); savedTimer = setTimeout(() => s.classList.remove("on"), 1200); }
  });
  window.addEventListener("resize", () => { const top = document.querySelector(".top"); if (top) document.documentElement.style.setProperty("--top-h", top.offsetHeight + "px"); });
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
  /* Отложенная перерисовка не должна подменять кнопку под пальцем: ждём, пока палец поднимется (и пройдёт click).
     Подход, записанный вводом повторов, выглядит записанным, как только поле теряет фокус; ✓ этой же строки
     в этот момент — подтверждение (таймер, дальше), а не отмена. */
  let ptrDown = false, tapOk = null;
  /** Выполнить после того, как палец поднят и click по кнопке прошёл (перерисовка не должна съесть нажатие). */
  const tapQueue = [];
  function afterTap(fn) { if (ptrDown) tapQueue.push(fn); else fn(); }
  const flushRender = () => {
    if (rebindPending && !editing() && !ptrDown) { remoteProgs(["progs"]); if (SH.open && SH.kind !== "account") closeSheet(false); renderPending = true; }
    if (renderPending && !editing() && !ptrDown) { renderPending = false; render(); }
  };
  document.addEventListener("pointerdown", (e) => { ptrDown = true; const b = e.target.closest && e.target.closest("[data-done]"); tapOk = b ? b.dataset.done : null; }, true);
  ["pointerup", "pointercancel"].forEach((ev) => document.addEventListener(ev, () => setTimeout(() => {
    ptrDown = false;
    if (tapOk) { const [ex, i] = tapOk.split(":"), k = `${openKey(ex)}|${i}`; if (state.typed[k]) { delete state.typed[k]; renderPending = true; } }
    tapOk = null; flushRender();
    while (tapQueue.length) tapQueue.shift()();
  }, 0), true));
  document.addEventListener("focusout", (e) => {
    const t = e.target, d = t && t.dataset;
    if (d && d.log && d.f === "r") {
      const k = `${openKey(d.log)}|${d.i}`, id = `${d.log}:${d.i}`, rel = e.relatedTarget;
      const toOk = tapOk === id || !!(rel && rel.dataset && rel.dataset.done === id);
      if (state.typed[k] && !toOk) { delete state.typed[k]; const row = t.closest(".log-row"); if (row) row.classList.add("done"); renderPending = true; }
    }
    setTimeout(flushRender, 60);
  });
  // вернулись в приложение на следующий день — перерисовать до первого касания
  const dateCheck = () => { if (state.tab === "today" && dayChanged()) render(); };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") dateCheck(); });
  window.addEventListener("focus", dateCheck);
  /** Программы после данных с сервера: curprog (текущая), progs (записи), progPos (места). Перепривязка посреди ввода
      подхода откладывается до конца ввода (иначе подход ушёл бы в другую программу). true — план или программа поменялись. */
  let rebindPending = false;
  function remoteProgs(keys) {
    const was = BOUND, wasDays = days().join(""), cur = PG.current(S.get("curprog", null), progsAll());
    const vanished = was !== PG.MAIN && keys.includes("progs") && !progsAll()[was];
    if ((vanished || cur.id !== was) && editing()) { rebindPending = true; return false; }
    rebindPending = false;
    let changed = false;
    if (vanished) {
      // запись привязанной программы удалили на другом устройстве — она точно пропала: переход на «Апгрейд» записывается
      bindProgram();
      if (commitMissing() || !isMain()) toast(isMain() ? "Программу удалили на другом устройстве — теперь «Апгрейд»" : `Программу удалили на другом устройстве — теперь «${progName(BOUND)}»`);
      changed = true;
    } else if (cur.id !== was || (cur.missing && cur.want !== missingWant)) { bindProgram(); changed = true; }
    else if (keys.includes("progs") && !isMain()) { PG.bind(P, BUILTIN, curRec()); PM.reload(); injectAllX(); changed = true; }
    else if (keys.includes("progs")) injectAllX();
    if (BOUND !== was || days().join("") !== wasDays) { changed = true; Object.assign(state, { qe: null, reorder: false }); if (BOUND !== was || !days().includes(state.day)) state.day = pickDay(); }
    return changed;
  }
  S.onRemote((keys) => {
    keys.forEach((k) => {
      if (k === "settings") state.settings = settingsFromStore();
      else if (k === "logs") state.logs = cleanLogs(S.get("logs", {}));
      else if (SYNCED.includes(k)) state[k] = S.get(k, k === "meas" ? [] : {});
    });
    let planChanged = keys.includes("plan") && isMain();
    if (planChanged && PM) PM.reload();
    if (keys.includes("curprog") || keys.includes("progs") || rebindPending) planChanged = remoteProgs(keys) || planChanged;
    if (planChanged) state.qe = null;
    if (keys.includes("swaps") && PM && isMain() && Object.keys(state.swaps || {}).length) { PM.migrateSwaps(state.swaps); state.swaps = {}; S.set("swaps", {}); }
    // шторки, привязанные к номеру связки/упражнения, после изменения плана с другого устройства закрываем — иначе покажут другое упражнение
    if (planChanged && SH.open) {
      if (["item", "group", "day", "copy", "addplace", "swapwith", "replace", "add"].includes(SH.kind)) { closeSheet(false); toast("План обновился с другого устройства — открой упражнение заново"); }
      else renderSheet();
    }
    // день при синхронизации не меняется: человек посреди тренировки не должен оказаться в другой
    softRender();
  });
  if (SY) {
    let lastBanner = bannerKey();
    SY.onStatus((st) => {
      const el = $("#syncStatus"); if (el) el.textContent = syncText(st);
      const f = $("#syncFoot"); if (f) f.textContent = footText();
      updateSyncBtn();
      if (SH.open && SH.kind === "account") { SH.top = false; renderSheet(); }
      // текущая программа неизвестна (запись не доехала): после завершённого прохода синхронизации её точно нет — на «Апгрейд»
      if (st.state === "ok" && missingWant && commitMissing()) { toast("Программы, выбранной на другом устройстве, нет — теперь «Апгрейд»"); softRender(); }
      const bk = bannerKey();
      if (bk !== lastBanner) { lastBanner = bk; if (state.tab === "today" || state.tab === "settings") softRender(); }
      // вход истёк — экран входа сам, но не чаще раза в 12 часов, если нажали «Позже»
      if (st.state === "expired" && !LG.open && Date.now() - LG.expAt > 12 * 3600 * 1000) { LG.expAt = Date.now(); openLogin("expired"); }
    });
    SY.onOverlay((ov) => {
      if (!ov) { location.reload(); return; } // вышли из аккаунта — вернуть публичную программу
      // заметки — про встроенную программу: накладываем на её исходные данные, а не на подменённую текущую
      const view = Object.assign({}, P, BUILTIN);
      SY.applyOverlay(view, ov);
      Object.assign(BUILTIN, { meta: view.meta, blocks: view.blocks, sessions: view.sessions });
      ["exercises", "muscles", "content", "sources"].forEach((k) => { if (view[k] !== P[k]) Object.assign(P[k], view[k]); });
      state.settings = settingsFromStore();
      bindProgram();
      softRender();
    });
  }

  /* ---------- theme ---------- */
  function applyTheme() {
    const r = document.documentElement;
    if (!["auto", "light", "dark"].includes(state.theme)) state.theme = "auto"; // прежнее сохранённое значение (ключ theme) уважаем как есть
    if (state.theme === "auto") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", state.theme);
    const dark = state.theme === "dark" || (state.theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute("content", dark ? "#0C0E12" : "#F3F5F8");
  }

  /* ---------- rest timer ----------
     Таймер — полоса над нижней панелью: видна, пока идёт отдых и пока не нажали «Готово», и не закрывает
     поля подхода (страница снизу с запасом). В покое — кнопка в шапке на «Сегодня». */
  const TIMER_IC = icon("timer", 22);
  const fmtT = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
  let audio = null;
  /** Звук на телефоне разрешён только после касания — будим AudioContext в ✓ и в кнопках таймера. */
  function wakeAudio() {
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      if (!audio) audio = new C();
      if (audio.state === "suspended") audio.resume();
    } catch (e) { /* без звука */ }
  }
  function beep() {
    try {
      wakeAudio(); const c = audio; if (!c) return;
      [0, 0.25, 0.5].forEach((t) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.15); });
    } catch (e) { /* без звука */ }
  }
  function timerUI() {
    const bar = $("#tBar"), fab = $("#fab"); if (!bar || !fab) return;
    bar.hidden = T.state === "idle";
    bar.classList.toggle("done", T.state === "done");
    document.body.classList.toggle("tbar-on", T.state !== "idle");
    if (T.state === "done") { fab.innerHTML = `${TIMER_IC}<span>Отдых окончен — к подходу</span>`; fab.setAttribute("aria-label", "Отдых окончен. Нажми, чтобы скрыть"); }
    else if (T.state === "run") { const left = fmtT((T.end - Date.now()) / 1000); fab.innerHTML = `${TIMER_IC}<span>Отдых <b class="num">${left}</b></span>`; fab.setAttribute("aria-label", `Отдых, осталось ${left}. Открыть таймер`); }
    $("#tPlus").hidden = T.state !== "run"; $("#tStop").hidden = T.state === "idle";
  }
  function tick() {
    const left = (T.end - Date.now()) / 1000;
    if (left <= 0) {
      clearInterval(T.id); T.id = null; T.state = "done"; $("#tBig").textContent = "0:00"; $("#fab").classList.remove("run");
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]); beep();
      timerUI();
      return;
    }
    $("#tBig").textContent = fmtT(left);
    const b = $("#fab b"); if (b) b.textContent = fmtT(left); else timerUI();
  }
  function startTimer(sec) { T.end = Date.now() + sec * 1000; clearInterval(T.id); T.id = setInterval(tick, 250); T.state = "run"; $("#fab").classList.add("run"); timerUI(); tick(); }
  function stopTimer() { clearInterval(T.id); T.id = null; T.state = "idle"; $("#fab").classList.remove("run"); $("#tBig").textContent = "0:00"; timerUI(); }
  function initTimer() {
    T.state = "idle";
    const tb = $("#timerBtn"); if (tb) tb.innerHTML = TIMER_IC;
    timerUI();
    const togglePanel = () => { if ($("#tPanel").classList.toggle("open")) pushGuard(); else dropGuard(); };
    $("#fab").addEventListener("click", () => { wakeAudio(); if (T.state === "done") { stopTimer(); return; } togglePanel(); });
    if (tb) tb.addEventListener("click", () => { wakeAudio(); togglePanel(); });
    const act = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      wakeAudio();
      if (b.dataset.t) startTimer(+b.dataset.t);
      if (b.dataset.plus) { if (T.state === "run") { T.end += 15000; tick(); } else startTimer(15); }
      if (b.dataset.stop !== undefined) stopTimer();
      if (b.dataset.close !== undefined) { $("#tPanel").classList.remove("open"); dropGuard(); }
    };
    $("#tPanel").addEventListener("click", act);
    $("#tBar").addEventListener("click", (e) => { if (e.target.closest("#fab")) return; act(e); });
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
  // прокрутку при «назад» ведём сами (хаб помнит свою), браузер её не восстанавливает
  try { history.scrollRestoration = "manual"; } catch (e) { /* старые браузеры */ }
  S.init().then(() => {
    loadState();
    // старые постоянные замены — во встроенную программу (до привязки текущей: P ещё встроенная)
    if (Object.keys(state.swaps || {}).length) { window.PlanModel.create(P, mainIO).migrateSwaps(state.swaps); state.swaps = {}; S.set("swaps", {}); }
    bindProgram();
    // неизвестный id текущей: без входа записываем переход сразу; со входом — после первого прохода синхронизации (SY.onStatus)
    if (missingWant && !(SY && SY.configured() && SY.signedIn()) && commitMissing()) setTimeout(() => toast("Выбранной программы нет — теперь «Апгрейд»"), 400);
    if (needEq()) { eqPending = true; setTimeout(loadLib, 0); }
    else if (favs().some((k) => /^ds_/.test(k) && !EX[k])) setTimeout(loadLib, 0); // избранное из базы — к первому открытию подбора уже загружено
    mountOverlays();
    const sp = new URLSearchParams(location.search), qp = sp.get("tab");
    state.tab = qp && own(TITLES, qp) ? qp : S.get("tab", "today");
    if (!own(TITLES, state.tab)) state.tab = "today";
    // прямые адреса экранов «Программы»: ?tab=plan&s=1A — тренировка, ?tab=plan&pv=sched — расписание
    if (state.tab === "plan") {
      const m = /^(\d+)([A-F])$/.exec(sp.get("s") || ""), pv = sp.get("pv");
      if (m && sessOf(m[0])) Object.assign(state, { pv: "sess", pb: +m[1], pd: m[2] });
      else if (own(PV_TITLES, pv)) state.pv = pv;
    }
    state.day = pickDay();
    applyTheme();
    try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme); } catch (e) { /* старые браузеры */ }
    initTimer();
    render();
    // страховочная запись от прошлой загрузки (перезагрузили на вложенном экране) — эта страница её не ставила
    // это и есть страховочная запись прошлой загрузки (перезагрузили на вложенном экране) — берём её, а не ставим ещё одну:
    // иначе каждая перезагрузка добавляла бы «мёртвый» шаг назад
    let onGuard = false;
    try { onGuard = !!(history.state && history.state.upg); } catch (e) { /* без истории */ }
    if (onGuard) { navGuard = true; if (!layered()) dropGuard(); } else if (layered()) pushGuard();
    initSW();
    if (SY) SY.start();
    if (needLogin()) openLogin("first");
  });
  window.__UPG = { state, ctxNow, render, planGo, weeklyVolume, resolveItem, estMinutes, groupVisible, suggestDay, LIB, sessOf, get PM() { return PM; }, buildAnalysis,
    curId, days, plannedDays, switchProgram, createProgram, deleteProgram, progsAll, weekDays, qIdx, cycleState };
})();
