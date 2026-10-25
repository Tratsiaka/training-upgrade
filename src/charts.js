/* Графики без библиотек: SVG рисуется после вставки в страницу, под реальную ширину.
   Правила dataviz: линии 2px, точки r=4 с кольцом цвета фона, сетка — сплошные волоски,
   подписи — цветом текста, не цветом серии; одна серия — без легенды; касание/наведение
   показывает перекрестие и значения; у каждого графика есть таблица (её строит приложение). */
(function () {
  "use strict";
  const specs = new Map();
  let seq = 0;
  const NS = "http://www.w3.org/2000/svg";
  const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const fmtDay = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]}`; };
  const fmtNum = (n, digits) => {
    const p = Math.pow(10, digits == null ? 1 : digits);
    return (Math.round(n * p) / p).toString().replace(".", ",");
  };
  const t = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };

  function niceTicks(min, max, count) {
    if (min === max) { const pad = Math.abs(min) * 0.05 || 1; min -= pad; max += pad; }
    const span = max - min, raw = span / Math.max(1, count - 1);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) || 10 * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
    return { lo, hi, ticks, step };
  }

  /** spec: { series:[{name, color, points:[{d:'YYYY-MM-DD', v:Number}], dots:true|false, line:true|false, main:true}],
              unit:'кг', digits:1, label:'…', height:180 } */
  function slot(spec) {
    const id = "ch" + (++seq);
    specs.set(id, spec);
    if (specs.size > 60) specs.delete(specs.keys().next().value);
    const label = spec.label ? ` aria-label="${spec.label.replace(/"/g, "&quot;")}"` : "";
    return `<div class="chart-box" data-chart="${id}" role="img"${label} tabindex="0" style="height:${spec.height || 180}px"></div>`;
  }

  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(n);
    return n;
  }

  function draw(box) {
    const spec = specs.get(box.dataset.chart);
    if (!spec) return;
    box.textContent = "";
    const W = Math.max(160, Math.round(box.clientWidth)), H = spec.height || 180;
    const all = spec.series.flatMap((s) => s.points);
    if (!all.length) return;
    const unit = spec.unit || "", digits = spec.digits == null ? 1 : spec.digits;
    const vals = all.map((p) => p.v), yt = niceTicks(Math.min(...vals), Math.max(...vals), 4);
    const tickW = Math.max(...yt.ticks.map((v) => fmtNum(v, digits).length)) * 6.6 + 8;
    const m = { l: Math.max(30, tickW), r: 14, t: 12, b: 24 };
    const times = all.map((p) => t(p.d)), t0 = Math.min(...times), t1 = Math.max(...times);
    const x = (iso) => (t1 === t0 ? (m.l + W - m.r) / 2 : m.l + ((t(iso) - t0) / (t1 - t0)) * (W - m.l - m.r));
    const y = (v) => m.t + (1 - (v - yt.lo) / (yt.hi - yt.lo || 1)) * (H - m.t - m.b);

    const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: "chart-svg", "aria-hidden": "true" }, box);
    const grid = el("g", { class: "grid" }, svg);
    yt.ticks.forEach((v) => {
      el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, grid);
      const tx = el("text", { x: m.l - 6, y: y(v) + 3.5, "text-anchor": "end", class: "tick" }, grid);
      tx.textContent = fmtNum(v, digits);
    });
    const firstD = all.reduce((a, p) => (t(p.d) < t(a) ? p.d : a), all[0].d);
    const lastD = all.reduce((a, p) => (t(p.d) > t(a) ? p.d : a), all[0].d);
    [[firstD, "start"], [lastD, "end"]].forEach(([d, anchor], i) => {
      if (i === 1 && d === firstD) return;
      const tx = el("text", { x: i === 0 ? Math.max(m.l, x(d)) : Math.min(W - m.r, x(d)), y: H - 6, "text-anchor": t1 === t0 ? "middle" : anchor, class: "tick" }, svg);
      tx.textContent = fmtDay(d);
    });

    spec.series.forEach((s) => {
      const pts = s.points.slice().sort((a, b) => t(a.d) - t(b.d));
      if (s.line !== false && pts.length > 1) {
        el("path", { d: pts.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(""), class: "ln", style: `stroke:${s.color}` }, svg);
      }
      if (s.dots !== false) pts.forEach((p) => el("circle", { cx: x(p.d), cy: y(p.v), r: s.r || 4, class: "dot", style: `fill:${s.color}` }, svg));
    });

    // подпись последней точки главной серии — единственная прямая подпись
    const main = spec.series.find((s) => s.main) || spec.series[0];
    const mp = main.points.slice().sort((a, b) => t(a.d) - t(b.d));
    if (mp.length) {
      const lp = mp[mp.length - 1], lx = x(lp.d), ly = y(lp.v);
      const tx = el("text", { x: lx > W - 60 ? lx - 8 : lx + 8, y: ly < m.t + 14 ? ly + 16 : ly - 9, "text-anchor": lx > W - 60 ? "end" : "start", class: "endlab" }, svg);
      tx.textContent = `${fmtNum(lp.v, digits)}${unit ? " " + unit : ""}`;
    }

    // слой взаимодействия
    const cross = el("line", { y1: m.t, y2: H - m.b, class: "cross", visibility: "hidden" }, svg);
    const marks = spec.series.map((s) => el("circle", { r: 5, class: "dot", style: `fill:${s.color}`, visibility: "hidden" }, svg));
    const tip = document.createElement("div");
    tip.className = "chart-tip"; tip.hidden = true; box.appendChild(tip);
    const dates = Array.from(new Set(all.map((p) => p.d))).sort((a, b) => t(a) - t(b));
    let cur = -1;
    function show(i) {
      if (i < 0 || i >= dates.length) return;
      cur = i;
      const d = dates[i], cx = x(d);
      cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
      tip.textContent = "";
      const head = document.createElement("div"); head.className = "tip-d"; head.textContent = fmtDay(d); tip.appendChild(head);
      spec.series.forEach((s, k) => {
        const p = s.points.find((q) => q.d === d);
        if (!p) { marks[k].setAttribute("visibility", "hidden"); return; }
        marks[k].setAttribute("cx", cx); marks[k].setAttribute("cy", y(p.v)); marks[k].setAttribute("visibility", "visible");
        const row = document.createElement("div"); row.className = "tip-r";
        const key = document.createElement("i"); key.style.background = s.color; row.appendChild(key);
        const b = document.createElement("b"); b.textContent = `${fmtNum(p.v, digits)}${unit ? " " + unit : ""}`; row.appendChild(b);
        if (spec.series.length > 1 || p.note) { const sp = document.createElement("span"); sp.textContent = p.note || s.name; row.appendChild(sp); }
        tip.appendChild(row);
      });
      tip.hidden = false;
      const tw = tip.offsetWidth;
      tip.style.left = `${Math.min(Math.max(4, cx - tw / 2), W - tw - 4)}px`;
      tip.style.top = "2px";
    }
    function hide() { cur = -1; tip.hidden = true; cross.setAttribute("visibility", "hidden"); marks.forEach((mk) => mk.setAttribute("visibility", "hidden")); }
    function nearest(clientX) {
      const r = svg.getBoundingClientRect(), px = clientX - r.left;
      let best = 0, bd = Infinity;
      dates.forEach((d, i) => { const dd = Math.abs(x(d) - px); if (dd < bd) { bd = dd; best = i; } });
      return best;
    }
    box.addEventListener("pointermove", (e) => show(nearest(e.clientX)));
    box.addEventListener("pointerdown", (e) => show(nearest(e.clientX)));
    box.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hide(); });
    box.addEventListener("blur", hide);
    box.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); show(cur < 0 ? dates.length - 1 : Math.min(dates.length - 1, cur + 1)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); show(cur < 0 ? dates.length - 1 : Math.max(0, cur - 1)); }
      else if (e.key === "Escape") hide();
    });
  }

  function mount(root) {
    (root || document).querySelectorAll(".chart-box[data-chart]").forEach((box) => { try { draw(box); } catch (e) { console.error(e); } });
  }
  let rt = null;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => mount(document), 200); });

  window.Charts = { slot, mount, niceTicks, fmtDay };
})();
