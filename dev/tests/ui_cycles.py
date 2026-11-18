"""v4.1: чередование тренировок по неделям, цикл нагрузки у упражнения, новые шаблоны.
1) A–D, 2 в неделю: неделя 1 — A, потом B; закрыта → «Сегодня» предлагает C; неделя 2 — C, D; неделя 3 — снова A; «не по очереди» неделю
   не закрывает и цикл не двигает; дни недели (сетка, не больше pw); «Тренировок в неделю» и очередь от текущей недели; смена правил
   не переписывает прошлое (qa); одна «текущая неделя» на хабе, в «Неделях» и в очереди; пустая очередь — подсказка и «Следующая неделя».
2) Цикл нагрузки: заготовка, правка шага, максимум → вес на «Сегодня»; шаг «по выполнению» (пропуск, «не по очереди» до и после закрытия,
   повтор недели, возврат, «Начать заново», смена pw); прошлый раз на том же шаге; «Цикл пройден» и «+2,5 кг» у одного пункта;
   «Указать максимум»; замена на сегодня и постоянная; «Убрать цикл» и отмена; записанные подходы не прячутся.
3) Каждый новый шаблон создаётся из шторки, открываются «Сегодня» и хаб, ошибок нет; 360 px без горизонтальной прокрутки, светлая и тёмная;
   «Самочувствие» читается целиком на 360 и 390.
4) «Апгрейд» и его копия: ни одного нового элемента.
Скриншоты — dev/shots/v41_* (360×800, светлая и тёмная)."""
import asyncio, pathlib
from playwright.async_api import async_playwright
APP = "http://localhost:8765/"
SH = str(pathlib.Path(__file__).resolve().parents[1] / "shots")
OK = []; FAIL = []
def check(c, msg):
    (OK if c else FAIL).append(msg); print(("ok  " if c else "FAIL") + " " + msg)

NB = lambda s: (s or "").replace(" ", " ").strip()
OVER = "document.documentElement.scrollWidth - innerWidth"
TARGETS = """() => [...document.querySelectorAll('#app button, #app summary, #app input, #sheet:not([hidden]) button, #sheet:not([hidden]) input')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[hidden]'); })
  .filter(e => { const r = e.getBoundingClientRect(); return r.height < 43.5 || (r.width < 43.5 && !e.textContent.trim()); }).map(e => (e.className || e.tagName) + ' ' + (e.textContent.trim().slice(0, 16) || e.getAttribute('aria-label') || '') + ' ' + Math.round(e.getBoundingClientRect().width) + '×' + Math.round(e.getBoundingClientRect().height)).slice(0, 6)"""
CLIP = """() => [...document.querySelectorAll('#app button, #sheet:not([hidden]) button, #app .cs-t b, #app .cs-t small')].filter(e => e.offsetParent && !e.closest('[hidden]') && e.scrollWidth > e.clientWidth + 1).map(e => e.className + ' «' + e.textContent.trim().slice(0, 18) + '»').slice(0, 6)"""

# Засев: программа из шаблона (или с нуля) с id, место в цикле (и «Начать заново» k дней назад), журнал
# [дней назад, буква, неделя, упражнения?, шаги?], максимумы, замены на сегодня.
SEED = """(o) => {
  localStorage.clear(); localStorage.setItem('upg3:noLogin', 'true'); localStorage.setItem('upg3:loginHintHidden', 'true');
  const G = window.Programs, p2 = (n) => String(n).padStart(2, '0');
  const iso = (k) => { const d = new Date(); d.setDate(d.getDate() - k); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
  let r = o.tpl ? G.fromTemplate(G.TEMPLATES.find((t) => t.id === o.tpl), {}) : G.blank({ n: o.n || 4, pw: o.pw });
  r.id = o.id;
  if (o.rot !== undefined) { if (o.rot) r.rot = o.rot; else delete r.rot; }
  if (o.tm) r.tm = o.tm;
  if (o.fill) o.fill.forEach((L) => { r.plan.s['1' + L] = { t: 'Тренировка ' + L + '!', g: [{ id: 'U1', kind: 'single', tier: 'core', rest: '2 мин', items: [{ ex: 'bench', sets: 3, reps: '8–10', rir: '2' }] }] }; });
  (o.cyc ? [].concat(o.cyc) : []).forEach((c) => { const it = r.plan.s[c.key].g[0].items[0]; it.cyc = c.steps; it.sets = c.steps[0].sets; it.reps = c.steps[0].reps; });
  localStorage.setItem('upg3:progs', JSON.stringify({ [o.id]: r }));
  localStorage.setItem('upg3:curprog', JSON.stringify({ id: o.id }));
  const hist = o.restart != null ? [{ at: iso(o.restart), from: 3, to: 0, why: 'restart' }] : [];
  if (o.pos != null) localStorage.setItem('upg3:progPos', JSON.stringify({ [o.id]: { idx: o.pos, since: null, hist } }));
  const logs = {};
  (o.logs || []).forEach(([k, d, idx, ex, st]) => { const e = { day: d, block: 1, week: idx + 1, idx, prog: o.id, ex: ex || { bench: [{ w: '50', r: '8' }] } }; if (st) e.st = st; logs[`${iso(k)}_${d}@${o.id}`] = e; });
  localStorage.setItem('upg3:logs', JSON.stringify(logs));
  if (o.daySw) localStorage.setItem('upg3:daySw', JSON.stringify({ d: iso(0), m: o.daySw }));
}"""

async def seed(page, q="?tab=today", **o):
    await page.goto(APP + "?x"); await page.wait_for_timeout(120)
    await page.evaluate(SEED, o)
    await page.goto(APP + q); await page.wait_for_timeout(450)
async def text(page):
    return NB(await page.evaluate("['#app', '#sheet:not([hidden])', '#toast:not([hidden])'].map(s => document.querySelector(s)).filter(Boolean).map(e => e.innerText).join('\\n')"))
async def sel_day(page):
    return await page.evaluate("(document.querySelector('.day-seg button.on') || {}).dataset ? document.querySelector('.day-seg button.on').dataset.day : ''")
async def pos(page, pid):
    return await page.evaluate(f"(JSON.parse(localStorage.getItem('upg3:progPos') || '{{}}')['{pid}'] || {{}}).idx")
async def rec(page, pid):
    return await page.evaluate(f"JSON.parse(localStorage.getItem('upg3:progs'))['{pid}']")
async def sheet_on(page):
    return await page.evaluate("!document.getElementById('sheet').hidden && document.getElementById('sheet').classList.contains('open')")
async def close_sheet(page):
    for _ in range(4):
        if not await sheet_on(page): return
        await page.click('#sheet .sheet-h [data-sa="close"]'); await page.wait_for_timeout(300)
async def go(page, tab):
    await close_sheet(page); await page.click(f'.nav-i[data-tab="{tab}"]'); await page.wait_for_timeout(250)
async def sched(page):
    await go(page, "plan")
    if not await page.locator('[data-pv="sched"]').count(): await page.click('.nav-i[data-tab="plan"]'); await page.wait_for_timeout(200)
    await page.click('[data-pv="sched"]'); await page.wait_for_timeout(250)
async def log_set(page, d, r="8", w="50"):
    await go(page, "today")
    await page.click(f'button[data-day="{d}"]'); await page.wait_for_timeout(200)
    rr = page.locator('input[data-log][data-f="r"]').first
    if not await rr.is_visible(): await page.locator('button[data-toggle="log"]').first.click(); await page.wait_for_timeout(100)
    await page.locator('input[data-log][data-f="w"]').first.fill(w); await rr.fill(r)
    await page.locator('.set-ok').first.click(); await page.wait_for_timeout(250)
async def card(page, d):
    """Текст первой карточки упражнения тренировки d на «Сегодня»."""
    await go(page, "today"); await page.click(f'button[data-day="{d}"]'); await page.wait_for_timeout(200)
    return NB(await page.locator(".ex").first.inner_text())
async def layout(page, lab):
    small = await page.evaluate(TARGETS); over = await page.evaluate(OVER); clip = await page.evaluate(CLIP)
    check(not small and over <= 0 and not clip, f"{lab}: targets ≥ 44 {small or 'ok'}, no horizontal overflow ({over}), text fits {clip or 'ok'}")
async def toast_undo(page):
    await page.click('[data-toastundo]'); await page.wait_for_timeout(300)
async def toast_text(page):
    return NB(await page.evaluate("document.getElementById('toastT').textContent"))

PID = "pcyc00001"
ST3 = [{"sets": 4, "reps": "6", "pct": 70}, {"sets": 3, "reps": "4", "pct": 80}, {"sets": 2, "reps": "2", "pct": 90}]
L = lambda k, d, i: [k, d, i]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 360, "height": 800}, service_workers="block", has_touch=True)
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)

        # ---------- 1. чередование A–D, 2 в неделю (дни мест пустые — «любой день», чтобы не зависеть от дня недели) ----------
        R = {"pw": 2, "wd": []}
        await seed(page, tpl="heavylight4", id=PID, rot=R)
        t = await text(page)
        check(await sel_day(page) == "A" and "неделя 1 · A и B" in t, f"week 1: «Сегодня» suggests A, hero «неделя 1 · A и B» ({await sel_day(page)})")
        off = await page.evaluate("[...document.querySelectorAll('.day-seg button')].map(b => b.dataset.day + (b.classList.contains('off') ? '-' : '+')).join(' ')")
        lab = await page.evaluate("document.querySelector('.day-seg button[data-day=C]').getAttribute('aria-label')")
        check(off == "A+ B+ C- D-" and "не на этой неделе" in lab and "не на этой неделе" not in t, f"day row: C and D muted with a clear aria-label, no permanent «не на этой неделе» line ({off}; {lab})")
        await seed(page, tpl="heavylight4", id=PID, rot=R, pos=0, logs=[L(1, "A", 0)])
        check(await sel_day(page) == "B", f"A done → «Сегодня» suggests B ({await sel_day(page)})")
        await seed(page, tpl="heavylight4", id=PID, rot=R, pos=0, logs=[L(2, "A", 0), L(1, "B", 0)])
        t = await text(page)
        check(await sel_day(page) == "C" and "Неделя 1 закрыта → неделя 2" in t and "неделя 2 · C и D" in t, f"A and B done → week closed, «Сегодня» suggests C of week 2 ({await sel_day(page)})")
        # одна «текущая неделя»: хаб, «Недели» и очередь — по ней
        await go(page, "plan")
        bar = NB(await page.inner_text(".ph .prog-t"))
        check("Неделя 2 · C и D" in bar and "сделано 0 из 2" in bar, f"hub hero at a closed week: «Неделя 2 · C и D, сделано 0 из 2» ({bar})")
        tags = await page.evaluate("[...document.querySelectorAll('.sess-card')].map(c => c.dataset.pd + ':' + c.querySelector('.tag').textContent.trim())")
        check(tags == ["A:следующая неделя", "B:следующая неделя", "C:эта неделя", "D:эта неделя"], f"hub tags follow the same week {tags}")
        await page.click('[data-pv="sched"]'); await page.wait_for_timeout(250)
        t = await text(page)
        rows = await page.evaluate("[...document.querySelectorAll('.rt-row')].map(r => r.querySelector('.rt-w').textContent.replace(/\\s/g, ' ') + ':' + [...r.querySelectorAll('.day-tile')].map(x => x.textContent).join(''))")
        check("Неделя 1 закрыта. Дальше — неделя 2 (C, D): начнётся с первого подхода" in t and rows[0] == "Неделя 2сейчас:CD" and rows[1] == "Неделя 3:AB", f"«Недели»: «Неделя 1 закрыта. Дальше — неделя 2 (C, D)…»; queue from the current week {rows}")
        await log_set(page, "C")
        check(await pos(page, PID) == 1, "first set of C moves the cycle to week 2")
        await seed(page, tpl="heavylight4", id=PID, rot=R, pos=1, logs=[L(3, "A", 0), L(2, "B", 0), L(1, "C", 1)])
        check(await sel_day(page) == "D", f"week 2: after C — D ({await sel_day(page)})")
        await seed(page, tpl="heavylight4", id=PID, rot=R, pos=1, logs=[L(4, "A", 0), L(3, "B", 0), L(2, "C", 1), L(1, "D", 1)])
        t = await text(page)
        check(await sel_day(page) == "A" and "неделя 3 · A и B" in t, f"week 2 closed → week 3 starts with A again ({await sel_day(page)})")
        # день недели места: сегодняшний день — место B → «Сегодня» предлагает B, хотя A ещё не сделана (в понедельник — A)
        wd = await page.evaluate("new Date().getDay()")
        await seed(page, tpl="heavylight4", id=PID, rot={"pw": 2, "wd": [1, 4] if wd == 1 else [1, wd]}, pos=0)
        check(await sel_day(page) == ("A" if wd == 1 else "B"), f"weekday of a place: today's place → its workout ({await sel_day(page)})")
        # не по очереди: неделя 1, сделана A; записываем D — запись в неделе 1, неделя не закрыта, цикл на месте
        await seed(page, tpl="heavylight4", id=PID, rot=R, pos=0, logs=[L(1, "A", 0)])
        await page.click('button[data-day="D"]'); await page.wait_for_timeout(200)
        check("D — не на этой неделе: запишется, но неделю не закроет." in await text(page), "off-queue workout selected: «D — не на этой неделе: запишется, но неделю не закроет.»")
        await log_set(page, "D")
        lg = await page.evaluate(f"Object.entries(JSON.parse(localStorage.getItem('upg3:logs'))).filter(([k]) => k.includes('_D@{PID}')).map(([k, e]) => e.idx)")
        check(lg == [0] and (await pos(page, PID) or 0) == 0, f"off-queue D recorded in week 1 (idx {lg}), cycle not moved")
        await sched(page)
        t = await text(page)
        check("Сейчас: неделя 1 (A, B). Сделано: A — да, B — нет" in t, "«Недели»: «Сейчас: неделя 1 (A, B). Сделано: A — да, B — нет» (off-queue D does not count)")
        rows = await page.evaluate("[...document.querySelectorAll('.rt-row')].map(r => [...r.querySelectorAll('.day-tile')].map(x => x.textContent).join('') + (r.classList.contains('cur') ? '*' : ''))")
        check(rows == ["AB*", "CD"] and "Круг — 2 недели, потом снова A." in t and "Тренировок в неделю" in t, f"queue: week 1 — A, B (now), week 2 — C, D; «Круг — 2 недели, потом снова A» {rows}")
        await page.click('[data-pw="3"]'); await page.wait_for_timeout(250)
        rows = await page.evaluate("[...document.querySelectorAll('.rt-row')].map(r => [...r.querySelectorAll('.day-tile')].map(x => x.textContent).join(''))")
        check(rows == ["ABC", "DAB", "CDA", "BCD"] and (await rec(page, PID))["rot"]["pw"] == 3 and await toast_text(page) == "Очередь с этой недели: A, B, C.", f"3 a week: four rows at most; toast «Очередь с этой недели: A, B, C.» {rows}")
        await page.click('[data-pw="4"]'); await page.wait_for_timeout(250)
        r = await rec(page, PID); t = await text(page)
        check("rot" not in r and not await page.locator(".rt-row").count() and "Все 4 каждую неделю" in t, "4 a week (= all): rotation off, no queue table, «Все 4 каждую неделю»")
        await toast_undo(page)
        check((await rec(page, PID))["rot"]["pw"] == 3, "toast «Отменить» brings the rotation back")
        await page.click('[data-pw="2"]'); await page.wait_for_timeout(300)
        # дни недели: сетка как у встроенной, не больше pw
        await page.click('[data-wday="1"]'); await page.wait_for_timeout(150); await page.click('[data-wday="4"]'); await page.wait_for_timeout(150)
        check("Дни одни и те же каждую неделю, тренировки в них меняются по очереди" in await text(page), "weekday note explains rotation")
        await page.click('[data-wday="6"]'); await page.wait_for_timeout(150)
        r = await rec(page, PID); msg = NB(await page.inner_text("#wdayMsg"))
        cells = await page.evaluate("[...document.querySelectorAll('.wd')].map(c => (c.className.match(/d-([A-F])/) || [])[1] || '-').join('')")
        check(r["rot"]["wd"] == [1, 4] and "не больше, чем тренировок в неделю (2)" in msg and cells == "A--B---", f"weekdays: Mon and Thu, a third refused; cells show this week's workouts {cells} {r['rot']['wd']}")
        await layout(page, "360 schedule with rotation")
        # смена правил не переписывает прошлое: неделя 2 (C, D), C сделана, ставим 3 в неделю → эта неделя C, D, A; неделя 1 — сделана
        await seed(page, q="?tab=plan", tpl="heavylight4", id=PID, rot=R, pos=1, logs=[L(4, "A", 0), L(3, "B", 0), L(1, "C", 1)])
        await page.click('[data-pv="sched"]'); await page.wait_for_timeout(250)
        await page.click('[data-pw="3"]'); await page.wait_for_timeout(300)
        r = await rec(page, PID); t = await text(page)
        rows = await page.evaluate("[...document.querySelectorAll('.rt-row')].map(r => [...r.querySelectorAll('.day-tile')].map(x => x.textContent).join(''))")
        wk1 = await page.evaluate("document.querySelector('.cyc-cells .wk').className")
        check(r["qa"] == 1 and r["rot"]["o"] == "C" and rows[0] == "CDA" and "Сейчас: неделя 2 (C, D, A). Сделано: C — да, D — нет, A — нет" in t and await toast_text(page) == "Очередь с этой недели: C, D, A." and "done" in wk1, f"pw 2 → 3 in week 2: this week C, D, A, C done, week 1 still «сделана» ({rows}, {wk1})")
        await seed(page, q="?tab=plan", tpl="heavylight4", id=PID, rot=R, pos=1, logs=[L(4, "A", 0), L(3, "B", 0), L(1, "C", 1)])
        await page.click('[data-dayadd]'); await page.wait_for_timeout(350)
        r = await rec(page, PID)
        check(r["days"] == ["A", "B", "C", "D", "E"] and r["qa"] == 1 and r["rot"]["o"] == "C" and "Очередь с этой недели: C, D." in await toast_text(page), f"add a workout in week 2: rules from week 2, queue still starts with C ({await toast_text(page)})")
        # хаб: сводка и теги очереди
        await seed(page, q="?tab=plan", tpl="heavylight4", id=PID, rot={"pw": 2, "wd": [1, 4]})
        sub = NB(await page.evaluate("[...document.querySelectorAll('.ph .hero-sub .dl i')].map(i => i.textContent).join(' · ')"))
        check(sub == "4 тренировки · 2 в неделю · круг 2 недели", f"hub hero: «4 тренировки · 2 в неделю · круг 2 недели» ({sub})")
        tags = await page.evaluate("[...document.querySelectorAll('.sess-card')].map(c => c.dataset.pd + ':' + [...c.querySelectorAll('.tag')].map(x => x.textContent.trim()).join('|'))")
        check(tags[0].startswith("A:эта неделя|Пн") and tags[2].startswith("C:следующая неделя|Пн") and tags[3].startswith("D:следующая неделя|Чт"), f"hub tags: this week / next week with the weekday of the place {tags}")
        await layout(page, "360 hub with rotation")
        # объём при чередовании — в среднем за неделю круга (сумма × pw / n)
        avg = await page.evaluate("(() => { const v = window.__UPG.weeklyVolume(1, true); return v.chest ? v.chest.d : 0; })()")
        await page.click('[data-pv="about"]'); await page.wait_for_timeout(250)
        t = await text(page)
        await go(page, "journal"); await page.click('[data-jtab="volume"]'); await page.wait_for_timeout(250)
        check(abs(avg - 3.5) < 1e-6 and "в среднем за неделю круга" in t and "риска — план в среднем за неделю" in await text(page), f"volume with rotation: chest (4 + 3) × 2 / 4 = 3,5 a week ({avg}), labelled «в среднем»")
        # пустая очередь недели: подсказка на всю ширину, «Следующая неделя» под текстом
        await seed(page, n=4, pw=2, id=PID, fill=["A", "B"], pos=1)
        t = await text(page)
        geo = await page.evaluate("(() => { const b = document.querySelector('.banner.stack'), s = b.querySelector(':scope > span'), btn = b.querySelector('[data-cyc=next]'); return { sw: Math.round(s.getBoundingClientRect().width), bw: Math.round(b.getBoundingClientRect().width), below: btn.getBoundingClientRect().top >= s.getBoundingClientRect().bottom - 1 }; })()")
        check("В этой неделе тренировки C и D пустые" in t and geo["below"] and geo["sw"] > geo["bw"] * 0.75, f"empty queue week: hint across the card, «Следующая неделя» under the text {geo}")
        await page.click('.banner [data-cyc="next"]'); await page.wait_for_timeout(300)
        t = await text(page)
        check(await pos(page, PID) == 2 and "пустые" not in t and "неделя 3 · A и B" in t, "after «Следующая неделя» — week 3, A and B, no hint")
        await seed(page, n=3, pw=2, id=PID, fill=["A", "B", "C"], pos=1, logs=[L(3, "A", 0), L(2, "B", 0)])
        check("неделя 2 · C и A" in await text(page) and await sel_day(page) == "C", "A–C / 2: week 2 is C and A")

        # ---------- 2. цикл нагрузки: заготовка, правка шага, максимум ----------
        await seed(page, q="?tab=plan", tpl="fullbody2", id=PID)
        await page.click('[data-pd="A"]'); await page.wait_for_timeout(250)
        await page.locator('.pr-q[data-qopen]').first.click(); await page.wait_for_timeout(250)
        qe = page.locator('.qe-cyc')
        check(await qe.count() == 1 and "менять подходы и вес от раза к разу" in NB(await qe.inner_text()), "quick editor: «Цикл нагрузки — менять подходы и вес от раза к разу»")
        await qe.click(); await page.wait_for_timeout(350)
        check(await sheet_on(page) and NB(await page.inner_text("#sheetTitle")).startswith("Цикл нагрузки: ") and "каждый раз, когда сделал эту тренировку, — следующий шаг, после последнего — снова первый" in await text(page), "cycle sheet: «каждый раз, когда сделал эту тренировку, — следующий шаг…»")
        await page.click('#sheet [data-sa="cycpre"][data-v="lin4"]'); await page.wait_for_timeout(250)
        rows = await page.evaluate("[...document.querySelectorAll('#sheet .cyc-row .cyc-t')].map(x => x.textContent.replace(/\\s/g, ' '))")
        check(rows == ["1 · 4 × 8 · 70 %", "2 · 4 × 6 · 75 %", "3 · 4 × 5 · 80 %", "4 · 3 × 3 · 87,5 %"] and await page.locator("#shTm").count() == 1, f"preset «Линейный · 4»: four steps with percents, «Максимум, кг» shown {rows}")
        check(await page.locator('#sheet .cyc-row .tag.now').count() == 1 and "сейчас" in NB(await page.locator('#sheet .cyc-row').first.inner_text()), "current step marked «сейчас»")
        await page.click('#sheet [data-sa="cycstep"][data-v="1"]'); await page.wait_for_timeout(200)
        await page.click('#sheet [data-sa="cs_sets"][data-qb="s+"]'); await page.wait_for_timeout(200)
        await page.click('#sheet [data-sa="cs_pct"][data-qb="p+"]'); await page.wait_for_timeout(200)
        await page.click('#sheet [data-sa="cs_rir"][data-v="2"]'); await page.wait_for_timeout(200)
        await page.fill("#shTm", "100"); await page.press("#shTm", "Enter"); await page.wait_for_timeout(300)
        rows = await page.evaluate("[...document.querySelectorAll('#sheet .cyc-row .cyc-t')].map(x => x.textContent.replace(/\\s/g, ' '))")
        check(rows[:2] == ["1 · 4 × 8 · 70 % · 70 кг", "2 · 5 × 6 · 77,5 % · 77,5 кг · запас 2"], f"step 2 edited (5 sets, 77,5 %, запас 2), max 100 → kg in rows {rows[:2]}")
        await page.click('#sheet [data-sa="cycadd"]'); await page.wait_for_timeout(200)
        n5 = await page.locator('#sheet .cyc-row').count()
        await page.click('#sheet [data-sa="cycdel"]'); await page.wait_for_timeout(200)
        check(n5 == 5 and await page.locator('#sheet .cyc-row').count() == 4, "«Добавить шаг» copies the last, «Удалить шаг» removes it")
        await layout(page, "360 cycle sheet")
        await close_sheet(page)
        cardp = NB(await page.locator(".prow").first.inner_text())
        icon = await page.evaluate("document.querySelector('.prow .pr-cy .tag use').getAttribute('href')")
        check("шаг 1 из 4" in cardp and "4 × 8 · 70 % → 5 × 6 · 77,5 %" in cardp and icon == "#i-trending-up", f"constructor card: current step cells, «шаг 1 из 4» with its own icon ({icon}), all steps in a line")
        it = (await rec(page, PID))["plan"]["s"]["1A"]["g"][0]["items"][0]
        check(it["sets"] == 4 and it["reps"] == "8" and len(it["cyc"]) == 4 and (await rec(page, PID))["tm"] == {"legpress": 100}, "saved: item scheme = step 1, 4 steps, max 100 kg for the exercise")
        await go(page, "today")
        await page.click('button[data-day="A"]'); await page.wait_for_timeout(200)
        t = NB(await page.locator(".ex").first.inner_text())
        w = await page.locator('input[data-log][data-f="w"]').first.input_value()
        check("шаг 1 из 4" in t and "Шаг 1 из 4: 70 % от 100 кг — 70 кг." in t and w == "70" and "Первая запись" not in t, f"«Сегодня»: «шаг 1 из 4», one weight hint, set prefilled with 70 kg ({w})")
        await log_set(page, "A", r="8", w="70")
        st = await page.evaluate(f"Object.entries(JSON.parse(localStorage.getItem('upg3:logs'))).filter(([k]) => k.includes('_A@{PID}')).map(([k, e]) => e.st)")
        check(st == [{"legpress": 0}], f"set recorded: the step number is kept in the day entry (st) {st}")
        t = NB(await page.locator(".ex").first.inner_text())
        check("шаг 1 из 4" in t, "today's entry: the step does not change during the day")

        # шаг «по выполнению»
        LP = [{"sets": 4, "reps": "8", "pct": 70}, {"sets": 4, "reps": "6", "pct": 75}, {"sets": 4, "reps": "5", "pct": 80}, {"sets": 3, "reps": "3", "pct": 87.5}]
        base = dict(tpl="fullbody2", id=PID, cyc={"key": "1A", "steps": LP}, tm={"legpress": 100})
        await seed(page, pos=2, logs=[L(9, "A", 0), L(8, "B", 0), L(2, "B", 1)], **base)
        check("Шаг 2 из 4" in await card(page, "A"), "skipped A in week 2 → week 3 is A's step 2 (a skip does not burn a step)")
        await seed(page, pos=1, logs=[L(9, "A", 0), L(2, "A", 1)], **base)
        check("Шаг 2 из 4" in await card(page, "A"), "«Повторить неделю»: A done again in the same week — still step 2")
        await seed(page, pos=0, logs=[L(9, "A", 0), L(2, "A", 1)], **base)
        check("Шаг 1 из 4" in await card(page, "A"), "back to week 1 → step 1")
        await seed(page, pos=0, restart=1, logs=[L(9, "A", 0), L(5, "A", 1), L(3, "A", 2)], **base)
        check("Шаг 1 из 4" in await card(page, "A"), "«Начать заново»: entries before it do not count — step 1")
        await seed(page, pos=3, logs=[L(9, "A", 0)], **base)
        check("Шаг 2 из 4" in await card(page, "A"), "«Следующая неделя» by hand without workouts — step does not move")
        # чередование: «не по очереди» до закрытия недели — следующий шаг и потом не повторяется
        RS = dict(tpl="heavylight4", id=PID, rot=R, cyc={"key": "1A", "steps": ST3}, tm={"bench": 100})
        await seed(page, pos=2, logs=[L(9, "A", 0), L(5, "A", 1)], **RS)
        check("Шаг 3 из 3: 90 % от 100 кг — 90 кг." in await card(page, "A"), "rotation: A done off-queue in week 2 → in week 3 A goes on with step 3")
        # «не по очереди» после закрытия недели: A–F, 2 в неделю, неделя 1 (A, B) закрыта, E вне очереди → в неделе 3 (E, F) — шаг 2
        await seed(page, n=6, pw=2, id=PID, fill=list("ABCDEF"), cyc={"key": "1E", "steps": ST3}, tm={"bench": 100}, pos=0, logs=[L(3, "A", 0), L(2, "B", 0)])
        check("Шаг 1 из 3" in await card(page, "E"), "week 1 closed, E chosen off-queue → step 1, stays in week 1")
        await log_set(page, "E", w="70", r="6")
        e_idx = await page.evaluate(f"Object.entries(JSON.parse(localStorage.getItem('upg3:logs'))).filter(([k]) => k.includes('_E@{PID}')).map(([k, e]) => e.idx)")
        await page.evaluate(f"localStorage.setItem('upg3:progPos', JSON.stringify({{ {PID}: {{ idx: 2, since: null, hist: [] }} }}))"); await page.reload(); await page.wait_for_timeout(400)
        await go(page, "plan"); await page.click('[data-pd="E"]'); await page.wait_for_timeout(250)
        check(e_idx == [0] and "шаг 2 из 3" in NB(await page.locator(".prow").first.inner_text()), f"…and in week 3 E is on step 2, not step 1 again (E recorded in week {e_idx})")
        # смена «в неделю» посреди круга шаги не трогает
        await seed(page, q="?tab=plan", pos=1, logs=[L(9, "A", 0), L(8, "B", 0)], **RS)
        await page.click('[data-pd="A"]'); await page.wait_for_timeout(250)
        before = NB(await page.locator(".prow").first.inner_text())
        await sched(page); await page.click('[data-pw="3"]'); await page.wait_for_timeout(300)
        await go(page, "plan"); await page.click('[data-pd="A"]'); await page.wait_for_timeout(250)
        after = NB(await page.locator(".prow").first.inner_text())
        check("шаг 2 из 3" in before and "шаг 2 из 3" in after, "pw 2 → 3 mid-round: A's step unchanged (2 of 3)")

        # шаг без процента: прошлый раз — на этом же шаге
        DL = [{"sets": 3, "reps": "8", "rir": "3"}, {"sets": 3, "reps": "8", "rir": "2"}, {"sets": 3, "reps": "8", "rir": "1"}, {"sets": 2, "reps": "8", "rir": "4"}]
        ex = lambda w: {"legpress": [{"w": w, "r": "8"}]}
        hist = [[30, "A", 0, ex("60"), {"legpress": 0}], [23, "A", 1, ex("70"), {"legpress": 1}]]
        await seed(page, tpl="fullbody2", id=PID, cyc={"key": "1A", "steps": DL}, pos=2, logs=hist)
        t = await card(page, "A"); w = await page.locator('input[data-log][data-f="w"]').first.input_value()
        check("Шаг 3 из 4. Вес подбери по запасу повторов." in t and w == "" and "Прошлый раз" not in t, f"step 3 never done → no weight, one hint «Шаг 3 из 4. Вес подбери по запасу повторов.» (w «{w}»)")
        hist2 = hist + [[16, "A", 2, ex("80"), {"legpress": 2}], [9, "A", 3, ex("50"), {"legpress": 3}]]
        await seed(page, tpl="fullbody2", id=PID, cyc={"key": "1A", "steps": DL}, pos=4, logs=hist2)
        t = await card(page, "A"); w = await page.locator('input[data-log][data-f="w"]').first.input_value()
        check("Шаг 1 из 4." in t and "60 кг" in t and w == "60" and "Прошлый раз" in t, f"step 1 again → «прошлый раз» from step 1 (60 kg), not from step 4 (50) (w «{w}»)")

        # «Цикл пройден» — у одного пункта упражнения (самый длинный цикл, первая тренировка), «+2,5 кг» один раз за день
        logs8 = [L(60 - k, d, k) for k in range(8) for d in ("A", "B", "C")]
        await seed(page, tpl="bench3", id=PID, tm={"bench": 100}, pos=8, logs=logs8)
        tb = await card(page, "B")
        ta = await card(page, "A")
        check("Цикл пройден — начинаем снова с шага 1. Дался? Подними максимум" in ta and "Цикл пройден" not in tb, "bench in three workouts: «Цикл пройден» only on the primary item (A), not on B")
        await page.click("[data-tmup]"); await page.wait_for_timeout(300)
        ta = NB(await page.locator(".ex").first.inner_text())
        check((await rec(page, PID))["tm"]["bench"] == 102.5 and "Максимум: 102,5 кг" in ta and not await page.locator("[data-tmup]").count() and "70 % от 102,5 кг — 72,5 кг" in ta, "«+2,5 кг» → max 102,5, weight recalculated, the button is replaced by «Максимум: 102,5 кг» for today")
        await toast_undo(page)
        check((await rec(page, PID))["tm"]["bench"] == 100 and await page.locator("[data-tmup]").count() == 1, "toast «Отменить» → max 100 and the button back")
        await layout(page, "360 today with «Цикл пройден»")

        # замена на сегодня: проценты не применяются, максимум не спрашиваем
        await seed(page, tpl="sbd3", id=PID, daySw={f"{PID}:A|squat": "legpress"})
        t = await card(page, "A")
        check("Замена на сегодня — вес подбери сам." in t and not await page.locator("[data-tmset]").count() and await page.locator('input[data-log][data-f="w"]').first.input_value() == "", "swap for today: «Замена на сегодня — вес подбери сам», no «Указать максимум», no weight")
        # «Указать максимум» с «Сегодня»
        await seed(page, tpl="sbd3", id=PID)
        t = await card(page, "A")
        check("70 % от максимума" in t and await page.locator("[data-tmset]").count() == 1, "no max: «70 % от максимума» and «Указать максимум»")
        await page.click("[data-tmset]"); await page.wait_for_timeout(350)
        await page.fill("#shTm2", "120"); await page.click('#sheet [data-sa="tmsave"]'); await page.wait_for_timeout(350)
        t = NB(await page.locator(".ex").first.inner_text())
        check("Шаг 1 из 6: 70 % от 120 кг — 85 кг." in t and await page.locator('input[data-log][data-f="w"]').first.input_value() == "85", "max 120 → «85 кг» in the hint and in the set")
        an = await page.evaluate("(() => { const a = window.__UPG.buildAnalysis(); const it = a.program.sessions['1A'].groups[0].items[0]; return { lc: it.load_cycle && it.load_cycle.steps.length, max: it.load_cycle && it.load_cycle.max_kg }; })()")
        check(an == {"lc": 6, "max": 120}, f"agent export: load_cycle with steps and max {an}")
        # постоянная замена: цикл остаётся, проценты без максимума — напоминание в тосте
        await seed(page, q="?tab=plan", tpl="sbd3", id=PID, tm={"squat": 100})
        await page.click('[data-pd="A"]'); await page.wait_for_timeout(250)
        await page.locator(".pr-open").first.click(); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="replace"]'); await page.wait_for_timeout(300)
        await page.locator('#sheet [data-sa="pick"][data-v="hack"]').first.click(); await page.wait_for_timeout(350)
        it = (await rec(page, PID))["plan"]["s"]["1A"]["g"][0]["items"][0]
        check(it["ex"] == "hack" and len(it.get("cyc") or []) == 6 and "Цикл нагрузки сохранён — укажи максимум" in await toast_text(page), f"permanent replace: cycle stays, toast «Цикл нагрузки сохранён — укажи максимум» ({await toast_text(page)})")
        # убрать цикл и отменить
        await seed(page, q="?tab=plan", **base)
        await page.click('[data-pd="A"]'); await page.wait_for_timeout(250)
        await page.locator('.pr-q[data-cycopen]').first.click(); await page.wait_for_timeout(350)
        await page.click('#sheet [data-sa="cycoff"]'); await page.wait_for_timeout(350)
        it = (await rec(page, PID))["plan"]["s"]["1A"]["g"][0]["items"][0]
        check("cyc" not in it and it["sets"] == 4 and it["reps"] == "8" and "Цикл нагрузки убран" in await text(page), "«Убрать цикл»: plain scheme = step 1 stays, toast")
        await toast_undo(page)
        check(len((await rec(page, PID))["plan"]["s"]["1A"]["g"][0]["items"][0].get("cyc") or []) == 4, "toast «Отменить» brings the cycle back")
        # хаб: тег «цикл» со своей иконкой
        await go(page, "plan")
        tg = await page.evaluate("(() => { const t = [...document.querySelectorAll('[data-pd=A] .tag')].find(x => x.textContent.includes('цикл')); return t ? t.querySelector('use').getAttribute('href') : ''; })()")
        check(tg == "#i-trending-up", f"hub: workout with a load cycle has a «цикл» tag with its own icon ({tg})")
        # записанные сегодня подходы не прячутся, даже если по плану их меньше
        five = {"legpress": [{"w": "60", "r": "8"} for _ in range(5)]}
        await seed(page, tpl="fullbody2", id=PID, logs=[[0, "A", 0, five]])
        t = await card(page, "A")
        sums = await page.evaluate("(document.querySelector('.ex .ex-sum') || {}).textContent || ''")
        check(sums.count("60×8") == 5, f"5 sets logged today, 3 in the plan → all 5 shown ({sums})")

        # ---------- 3. каждый новый шаблон: создать из шторки, «Сегодня» и хаб; светлая и тёмная ----------
        for theme in ("light", "dark"):
            await page.emulate_media(color_scheme=theme)
            for tid in ("fullbody2", "heavylight4", "ulsv4", "bench3", "sbd3"):
                await seed(page, q="?tab=plan", n=3, id="pzzz00001")
                n0 = len(errs)
                await page.click('[data-pv="progs"]'); await page.wait_for_timeout(250)
                await page.click('[data-pnew]'); await page.wait_for_timeout(300)
                await page.click('#sheet [data-sa="pnkind"][data-v="tpl"]'); await page.wait_for_timeout(250)
                if tid == "fullbody2" and theme == "light":
                    heads = await page.evaluate("[...document.querySelectorAll('#sheet .tpl-h')].map(h => h.textContent.trim())")
                    cards = await page.locator('#sheet [data-sa="pntpl"]').count()
                    tg = NB(await page.locator('#sheet [data-sa="pntpl"][data-v="bench3"] .tpl-tags').inner_text())
                    tg2 = NB(await page.locator('#sheet [data-sa="pntpl"][data-v="heavylight4"] .tpl-tags').inner_text())
                    lists = await page.locator('#sheet .tpl-d').count()
                    check(cards == 8 and heads == ["Простые", "С чередованием", "С циклом нагрузки"] and "цикл 8 шагов" in tg and "2 в неделю" in tg2 and "чередование" in tg2 and lists == 0, f"templates sheet: 8 short cards under three headings, tags, no exercise lists {heads} «{tg}» «{tg2}»")
                    await layout(page, "360 templates sheet")
                await page.click(f'#sheet [data-sa="pntpl"][data-v="{tid}"]'); await page.wait_for_timeout(250)
                if tid == "heavylight4" and theme == "light":
                    await page.click('#sheet .tpl-comp summary'); await page.wait_for_timeout(150)
                    comp = await page.evaluate("[...document.querySelectorAll('#sheet .tpl-comp .tpl-d')].map(x => x.textContent)")
                    check(len(comp) == 4 and "Жим лёжа" in comp[0] and "Жим лёжа" in comp[2], f"step 2: «Состав» shows exercises by workout ({len(comp)})")
                await page.click('#sheet [data-sa="pnewdo"][data-v="go"]'); await page.wait_for_timeout(450)
                hub_ok = await page.locator(".sess-card").count() >= 2
                await layout(page, f"360 {theme} hub «{tid}»")
                await go(page, "today")
                today_ok = await page.locator(".ex").count() >= 5
                await layout(page, f"360 {theme} today «{tid}»")
                check(hub_ok and today_ok and len(errs) == n0, f"{theme}: template «{tid}» created, hub and «Сегодня» open, no console errors {errs[n0:][:2]}")
        await page.emulate_media(color_scheme="light")
        # «Самочувствие» читается целиком на 360 и 390 при 2, 3, 4 и 6 тренировках
        for w in (360, 390):
            await page.set_viewport_size({"width": w, "height": 800})
            for n in (2, 3, 4, 6):
                await seed(page, n=n, id=PID, fill=list("ABCDEF")[:n])
                fit = await page.evaluate("(() => { const b = document.querySelector('.ctl-sum .cs-t b'); return b && b.scrollWidth <= b.clientWidth + 1 && b.getBoundingClientRect().right <= document.querySelector('.ctl-sum').getBoundingClientRect().right; })()")
                check(fit, f"{w} px, {n} workouts: «Самочувствие» fits")
        await page.set_viewport_size({"width": 360, "height": 800})
        # новая программа «с нуля»: в программе и в неделю
        await seed(page, q="?tab=plan", n=3, id="pzzz00001")
        await page.click('[data-pv="progs"]'); await page.wait_for_timeout(250); await page.click('[data-pnew]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="pnkind"][data-v="blank"]'); await page.wait_for_timeout(250)
        await page.click('#sheet [data-sa="pnn"][data-v="1"]'); await page.wait_for_timeout(150)
        t = await text(page)
        check("Тренировок в программе" in t and "Тренировок в неделю" in t and "Тренировки A, B, C и D — каждую неделю." in t, "new from scratch: both steppers, 4 in the programme = 4 a week by default")
        await page.click('#sheet [data-sa="pnpw"][data-v="-1"]'); await page.wait_for_timeout(150); await page.click('#sheet [data-sa="pnpw"][data-v="-1"]'); await page.wait_for_timeout(150)
        t = await text(page)
        check("A и B на первой, C и D — на второй неделе, потом снова по кругу." in t, "2 a week: «A и B на первой, C и D — на второй неделе…»")
        await layout(page, "360 new programme step 2")
        await page.click('#sheet [data-sa="pnewdo"][data-v="go"]'); await page.wait_for_timeout(450)
        newid = await page.evaluate("window.__UPG.curId()")
        r = await rec(page, newid)
        check(r["days"] == ["A", "B", "C", "D"] and r["rot"]["pw"] == 2, f"created: 4 workouts, 2 a week {r.get('rot')}")
        # «2 в неделю» в герое «Сегодня» не разрывается
        await seed(page, tpl="heavylight4", id=PID)
        sub = await page.evaluate("document.querySelector('.th .hero-sub').innerHTML")
        check("2&nbsp;в&nbsp;неделю" in sub, "«Сегодня»: «2 в неделю» in the programme name is unbreakable")

        # ---------- 4. «Апгрейд» и копия: ничего нового ----------
        for lab in ("built-in", "copy"):
            await page.goto(APP + "?x"); await page.wait_for_timeout(100)
            await page.evaluate("() => { localStorage.clear(); localStorage.setItem('upg3:noLogin', 'true'); localStorage.setItem('upg3:loginHintHidden', 'true'); }")
            await page.goto(APP + "?tab=plan"); await page.wait_for_timeout(400)
            if lab == "copy":
                await page.evaluate("(() => { const U = window.__UPG, r = U.createProgram({ kind: 'copy', from: 'main' }); U.switchProgram(r.id); U.render(); })()"); await page.wait_for_timeout(300)
            await page.click('[data-pv="sched"]'); await page.wait_for_timeout(250)
            t1 = await text(page); pw = await page.locator("[data-pw]").count()
            await go(page, "plan"); await page.locator("[data-pd]").first.click(); await page.wait_for_timeout(250)
            await page.locator('.pr-q[data-qopen]').first.click(); await page.wait_for_timeout(250)
            t2 = await text(page); cy = await page.locator(".qe-cyc, [data-cycopen]").count()
            await go(page, "today"); t3 = await text(page)
            check(pw == 0 and cy == 0 and "Тренировок в неделю" not in t1 and "Цикл нагрузки" not in t2 and "Шаг " not in t3 and "не на этой неделе" not in t3, f"{lab}: no «Тренировок в неделю», no «Цикл нагрузки», no steps on «Сегодня»")

        check(not errs, "no console errors")
        print("errors:", errs[:5])
        await shots(b)
        await b.close()
    print(f"{len(OK)} ok, {len(FAIL)} failed")

async def shots(b):
    """dev/shots/v41_*: расписание с чередованием, хаб, «Сегодня» с шагом и весом, шторка цикла, шаблоны, новая программа шаг 2."""
    for theme in ("light", "dark"):
        ctx = await b.new_context(viewport={"width": 360, "height": 800}, service_workers="block", color_scheme=theme)
        pg = await ctx.new_page()
        snap = lambda n, full=False: pg.screenshot(path=f"{SH}/v41_{n}_{theme}.png", full_page=full)
        await seed(pg, q="?tab=plan", tpl="heavylight4", id=PID, pos=0, logs=[[1, "A", 0]], cyc={"key": "1A", "steps": ST3}, tm={"bench": 100})
        await snap("hub", True)
        await pg.click('[data-pv="sched"]'); await pg.wait_for_timeout(250); await snap("sched", True)
        await pg.click('.nav-i[data-tab="plan"]'); await pg.wait_for_timeout(200); await pg.click('[data-pd="A"]'); await pg.wait_for_timeout(250); await snap("constructor")
        await pg.locator('.pr-q[data-cycopen]').first.click(); await pg.wait_for_timeout(350)
        await pg.click('#sheet [data-sa="cycstep"][data-v="1"]'); await pg.wait_for_timeout(250); await snap("cycle_sheet")
        await close_sheet(pg)
        await pg.click('.nav-i[data-tab="today"]'); await pg.wait_for_timeout(250); await pg.click('button[data-day="C"]'); await pg.wait_for_timeout(200); await snap("today_offqueue")
        await seed(pg, tpl="heavylight4", id=PID, pos=2, logs=[[9, "A", 0]], cyc={"key": "1A", "steps": ST3}, tm={"bench": 100})
        await pg.click('button[data-day="A"]'); await pg.wait_for_timeout(200); await snap("today_step")
        logs8 = [[60 - k, d, k] for k in range(8) for d in ("A", "B", "C")]
        await seed(pg, tpl="bench3", id=PID, tm={"bench": 100}, pos=8, logs=logs8)
        await pg.click('button[data-day="A"]'); await pg.wait_for_timeout(200); await snap("today_cycle_done")
        await seed(pg, n=4, pw=2, id=PID, fill=["A", "B"], pos=1); await snap("today_empty_queue")
        await seed(pg, q="?tab=plan", n=3, id="pzzz00001")
        await pg.click('[data-pv="progs"]'); await pg.wait_for_timeout(250); await pg.click('[data-pnew]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet [data-sa="pnkind"][data-v="tpl"]'); await pg.wait_for_timeout(250); await snap("templates")
        await pg.click('#sheet [data-sa="back"]'); await pg.wait_for_timeout(200); await pg.click('#sheet [data-sa="pnkind"][data-v="blank"]'); await pg.wait_for_timeout(250)
        await pg.click('#sheet [data-sa="pnn"][data-v="1"]'); await pg.wait_for_timeout(150); await pg.click('#sheet [data-sa="pnpw"][data-v="-1"]'); await pg.wait_for_timeout(150); await pg.click('#sheet [data-sa="pnpw"][data-v="-1"]'); await pg.wait_for_timeout(150)
        await snap("new_step2")
        await ctx.close()

asyncio.run(main())
