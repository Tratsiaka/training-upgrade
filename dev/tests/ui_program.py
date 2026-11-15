"""«Программа» (этап B): хаб без вложенных вкладок, экран тренировки, «Расписание и цикл», «О программе», «Все программы»;
навигация вглубь и назад (кнопка в шапке, history.back, прямые ссылки, адрес экрана), подписанные значения, одинаковая
нумерация с «Сегодня», шторки (добавить, упражнение, замена, переименование), цели касания, переполнение текста в кнопках,
висячие «·», мелкий шрифт на 360/375."""
import asyncio, re, pathlib
from playwright.async_api import async_playwright
APP = "http://localhost:8765/"
SH = str(pathlib.Path(__file__).resolve().parents[1] / "shots")
OK = []; FAIL = []
def check(c, msg):
    (OK if c else FAIL).append(msg); print(("ok  " if c else "FAIL") + " " + msg)

# Ряды переключателей на экране: сегменты и ряды чипов-переключателей (кнопки с aria-pressed / role=tab|radio).
TOGGLE_ROWS = """() => [...document.querySelectorAll('#app .seg, #app .chips')].filter(r => r.offsetParent && !r.closest('.qe-box, #sheet')
  && r.querySelector('button[aria-pressed], button[role=tab], button[role=radio]')).map(r => r.className)"""
TARGETS = """(scope) => { const root = document.querySelector(scope) || document;
  const els = [...root.querySelectorAll('button, summary, select, input:not([type=checkbox]):not([type=hidden])')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[hidden]'); });
  return els.filter(e => { const r = e.getBoundingClientRect(); return r.height < 43.5 || (r.width < 43.5 && !e.textContent.trim()); }).map(e => (e.className || e.tagName) + ' ' + (e.textContent.trim().slice(0, 16) || e.getAttribute('aria-label') || '') + ' ' + Math.round(e.getBoundingClientRect().width) + '×' + Math.round(e.getBoundingClientRect().height)).slice(0, 8); }"""
# Текст не вылезает из кнопок, сегментов и чипов (P0: «Блок 1 / 2 / 3» наезжали друг на друга)
TEXT_FIT = """(scope) => [...document.querySelectorAll(scope)].flatMap(r => [...r.querySelectorAll('button, .chip, .tag')]).filter(e => e.offsetParent && !e.closest('[hidden]'))
  .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className + ' «' + e.textContent.trim().slice(0, 20) + '» ' + e.scrollWidth + '>' + e.clientWidth).slice(0, 6)"""
# Висячая «·»: точка — первый или последний видимый знак строки
HANGING = """(scope) => { const out = []; const roots = [...document.querySelectorAll(scope)];
  roots.forEach(root => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const t = n.textContent; if (!n.parentElement || !n.parentElement.offsetParent) continue;
      for (let i = 0; i < t.length; i++) { if (t[i] !== '·') continue;
        const rr = (a, b) => { const r = document.createRange(); r.setStart(n, a); r.setEnd(n, b); const q = r.getClientRects(); return q.length ? q[0] : null; };
        const me = rr(i, i + 1); if (!me) continue;
        let j = i - 1; while (j >= 0 && /\\s/.test(t[j])) j--; let k = i + 1; while (k < t.length && /\\s/.test(t[k])) k++;
        const prev = j >= 0 ? rr(j, j + 1) : null, next = k < t.length ? rr(k, k + 1) : null;
        const first = !prev ? false : Math.abs(prev.top - me.top) > 4, last = !next ? false : Math.abs(next.top - me.top) > 4;
        if (first || last) out.push(t.slice(Math.max(0, i - 12), i + 12)); } } });
  return out.slice(0, 6); }"""
# Видимый текст мельче 12 px
SMALL_FONT = """(scope) => [...document.querySelectorAll(scope)].flatMap(r => [...r.querySelectorAll('*')]).filter(e => e.offsetParent && [...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()))
  .filter(e => parseFloat(getComputedStyle(e).fontSize) < 12).map(e => e.className + ' «' + e.textContent.trim().slice(0, 16) + '» ' + getComputedStyle(e).fontSize).slice(0, 6)"""
JARGON = re.compile(r"RIR|ЯДРО|\bядро\b", re.I)
BARE_LETTER = re.compile(r"(?<![А-Яа-яЁё])(в|во|из|по|к) [A-F](?![A-Za-z0-9])")
NB = lambda s: (s or "").replace(" ", " ").strip()

async def ui_text(page):
    return await page.evaluate("['#app', '.top', '#sheet:not([hidden])', '#toast:not([hidden])'].map(s => document.querySelector(s)).filter(Boolean).map(e => e.innerText).join('\\n')")
async def to_hub(page):
    for _ in range(3):
        if await page.locator('.sess-list').count(): return
        await page.click('.nav-i[data-tab="plan"]'); await page.wait_for_timeout(150)
async def title(page):
    return NB(await page.text_content("#title"))
async def back_label(page):
    return "" if await page.locator("#back[hidden]").count() else NB(await page.inner_text("#back"))
async def sheet_open(page):
    return await page.evaluate("!document.getElementById('sheet').hidden && document.getElementById('sheet').classList.contains('open')")
async def toast_text(page):
    return await page.evaluate("document.getElementById('toast').hidden ? '' : document.getElementById('toastT').textContent")
async def fresh(page, q="?tab=plan"):
    await page.goto(APP + q); await page.wait_for_timeout(150)
    await page.evaluate("() => { localStorage.clear(); localStorage.setItem('upg3:noLogin', 'true'); }")
    await page.goto(APP + q); await page.wait_for_timeout(450)
async def quality(page, scope, lab):
    fit = await page.evaluate(TEXT_FIT, scope); hang = await page.evaluate(HANGING, scope); small = await page.evaluate(SMALL_FONT, scope)
    check(not fit and not hang and not small, f"{lab}: text fits buttons {fit or 'ok'}, no hanging «·» {hang or 'ok'}, font ≥ 12 px {small or 'ok'}")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 375, "height": 812}, service_workers="block", has_touch=True)
        await ctx.add_init_script("try{localStorage.setItem('upg3:noLogin','true')}catch(e){}")
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)

        # 1. хаб: герой, «Тренировки» (один ряд сегментов блоков + карточки), «Управление»; без вкладок
        await fresh(page)
        hero = await page.evaluate("""(() => { const h = document.querySelector('.hero.ph'); return h && { name: h.querySelector('h2').textContent, sub: [...h.querySelectorAll('.hero-sub .dl i')].map(i => i.textContent),
            prog: h.querySelector('.prog-t').textContent, bar: !!h.querySelector('.prog-bar i'), all: !!h.querySelector('.btn.tonal[data-pv="progs"] .ic'), menu: !!h.querySelector('[data-pmenu][aria-label]') }; })()""")
        check(hero and hero["name"] == "Апгрейд" and [NB(x) for x in hero["sub"]] == ["3 блока по 5 недель", "3 тренировки в неделю"] and "Блок 1, неделя 1 из 5" in NB(hero["prog"]) and hero["bar"] and hero["all"] and hero["menu"],
              f"hub hero: name, summary parts (number glued to word), cycle progress, tonal «Все программы», ⋮: {hero}")
        glued = await page.evaluate("[...document.querySelectorAll('.hero-sub .dl i')].every(i => !/\\d /.test(i.textContent))")
        check(glued, "summary: numbers joined to words with &nbsp;")
        secs = await page.evaluate("[...document.querySelectorAll('#app .sec-h')].map(h => h.textContent.trim())")
        check(secs == ["Тренировки", "Управление"], f"hub sections: {secs}")
        check(await page.locator("[data-ptab], .ptabs").count() == 0, "no «Тренировки / Расписание / О программе» tabs")
        rows = await page.evaluate(TOGGLE_ROWS)
        check(rows == ["seg bseg pb-seg"], f"hub: one row of block segments, no other toggle rows: {rows}")
        seg = await page.evaluate("[...document.querySelectorAll('.pb-seg button')].map(c => ({ t: c.querySelector('.bs-t').textContent, n: (c.querySelector('small') || {}).textContent, now: !!c.querySelector('.now-b'), w: Math.round(c.getBoundingClientRect().width) }))")
        check(len(seg) == 3 and [NB(s["t"]) for s in seg] == ["Блок 1", "Блок 2", "Блок 3"] and all(s["n"] for s in seg) and [s["now"] for s in seg] == [True, False, False] and max(s["w"] for s in seg) - min(s["w"] for s in seg) <= 1,
              f"block segments: three equal columns «Блок N» + name, current labelled «сейчас»: {seg}")
        cards = await page.evaluate("[...document.querySelectorAll('.sess-card')].map(c => ({ d: c.dataset.pd, tile: c.querySelector('.day-tile').textContent, t: c.querySelector('.sc-t').textContent, sub: [...c.querySelectorAll('.sc-sub .dl i')].map(i => i.textContent), tags: [...c.querySelectorAll('.sc-tags .tag')].map(t => t.textContent), mus: (c.querySelector('.sc-mus') || {}).textContent || '', chev: !!c.querySelector(':scope > .ic') }))")
        okc = len(cards) == 3 and all(c["tile"] == c["d"] and len(c["sub"]) == 2 and re.match(r"^\d+ упражнени", NB(c["sub"][0])) and re.match(r"^≈ \d+ мин$", NB(c["sub"][1])) and re.match(r"^(Пн|Вт|Ср|Чт|Пт|Сб|Вс|любой день)$", NB(c["tags"][0])) and c["mus"] and c["chev"] for c in cards)
        check(okc and "по желанию" in cards[2]["tags"], f"workout cards: tile, title, «11 упражнений · ≈ 85 мин», day and «по желанию» as tags, muscle groups, chevron: {[(c['sub'], c['tags']) for c in cards]}")
        links = await page.evaluate("[...document.querySelectorAll('#app .menu .row-link')].map(r => [r.dataset.pv, r.querySelector('b').textContent, r.querySelector('small').textContent])")
        check([[a, b_, NB(c)] for a, b_, c in links] == [["sched", "Расписание и цикл", "Пн · Вт · Сб — неделя 1 из 5"], ["about", "О программе", "Цели блоков, объём по мышцам, как это устроено"]], f"«Управление» row links: {links}")
        hub_n = {c["d"]: int(re.match(r"\d+", NB(c["sub"][0])).group()) for c in cards}
        await page.click('[data-pb="2"]'); await page.wait_for_timeout(150)
        sw = await page.evaluate("(() => { const s = window.__UPG.sessOf('2A'); const c = document.querySelector('.sess-card[data-pd=\"A\"]'); return c.querySelector('.sc-t').textContent === s.title; })()")
        check(await page.locator('[data-pb="2"].on').count() == 1 and sw, "block segment switches the cards to block 2")
        await page.click('[data-pb="1"]'); await page.wait_for_timeout(100)
        await quality(page, "#app", "375px hub")
        await page.screenshot(path=f"{SH}/ui_program_hub.png")

        # 2. хаб → тренировка → назад (кнопкой), прокрутка хаба сохраняется; адрес следует за экраном
        await page.evaluate("window.scrollTo(0, 260)"); await page.wait_for_timeout(100)
        y0 = await page.evaluate("Math.round(scrollY)")
        await page.click('[data-pd="B"]'); await page.wait_for_timeout(250)
        sb = await page.evaluate("window.__UPG.sessOf('1B').title")
        check(await title(page) == sb and await back_label(page) == "Программа" and await page.locator(".psess-h").count() == 1 and await page.evaluate("scrollY") == 0,
              f"card → workout screen: header «{await title(page)}», back «{await back_label(page)}»")
        check(await page.evaluate("location.search") == "?tab=plan&s=1B", f"address follows the screen: {await page.evaluate('location.search')}")
        check(sb not in await page.inner_text("#app") and await page.locator("#hdrRen:not([hidden])").count() == 1, "workout name shown once — in the header, with a rename pencil")
        check(await page.evaluate("!!(history.state && history.state.upg)"), "workout screen puts one guard entry into history")
        await page.click("#back"); await page.wait_for_timeout(250)
        y1 = await page.evaluate("Math.round(scrollY)")
        check(await page.locator(".sess-list").count() == 1 and await title(page) == "Программа" and await back_label(page) == "" and abs(y1 - y0) <= 2 and await page.evaluate("location.search") == "?tab=plan", f"back button → hub, scroll restored {y0} → {y1}, address ?tab=plan")
        await page.click(".nav [data-tab='today']"); await page.wait_for_timeout(150)
        check(await page.evaluate("!(history.state && history.state.upg)"), "closing by button leaves no extra history entry")
        await page.click(".nav [data-tab='plan']"); await page.wait_for_timeout(150)

        # 3. системная «назад»: шторка → экран тренировки → хаб; режим «Порядок» — тоже слой
        await page.click('[data-pd="A"]'); await page.wait_for_timeout(250)
        await page.click('.pr-open[data-pi="1:0"]'); await page.wait_for_timeout(350)
        await page.evaluate("history.back()"); await page.wait_for_timeout(350)
        check(not await sheet_open(page) and await page.locator(".psess-h").count() == 1, "history.back closes the sheet first, stays on the workout")
        await page.click('[data-preorder="1"]'); await page.wait_for_timeout(250)
        await page.evaluate("history.back()"); await page.wait_for_timeout(300)
        check(await page.locator(".ro-list").count() == 0 and await page.locator(".psess-h").count() == 1 and await page.locator("[data-padd]").count() >= 1, "history.back leaves «Порядок», stays on the workout")
        await page.evaluate("history.back()"); await page.wait_for_timeout(300)
        check(await page.locator(".sess-list").count() == 1 and await page.evaluate("location.pathname") == "/", "history.back → hub, still in the app")
        await page.click('[data-pd="A"]'); await page.wait_for_timeout(200)
        await page.keyboard.press("Escape"); await page.wait_for_timeout(250)
        check(await page.locator(".sess-list").count() == 1, "Escape on the workout screen → hub")

        # 4. экраны «Управления» и «Все программы»
        for pv, ttl in (("sched", "Расписание и цикл"), ("about", "О программе"), ("progs", "Все программы")):
            await to_hub(page); await page.click(f'[data-pv="{pv}"]'); await page.wait_for_timeout(250)
            rows = await page.evaluate(TOGGLE_ROWS)
            check(await title(page) == ttl and await back_label(page) == "Программа" and len(rows) <= 1 and await page.evaluate("location.search") == f"?tab=plan&pv={pv}", f"{pv}: header «{await title(page)}», back, ≤ 1 toggle row {rows}, address")
            if pv == "sched":
                first = await page.evaluate("document.querySelector('#app > .card h3').textContent.trim()")
                main = await page.evaluate("[...document.querySelectorAll('#cycle .btn.primary')].map(b => b.textContent.trim())")
                folded = await page.evaluate("[...document.querySelectorAll('#cycle details.cyc-more [data-cyc]')].map(b => b.dataset.cyc)")
                check(first == "Дни тренировок" and main == ["Следующая неделя"] and set(folded) >= {"repeat", "nextblock"} and await page.locator("#app details.acc").count() >= 2, f"sched: «Дни тренировок» first, «Следующая неделя» — main action, rest under «Ещё действия» {folded}")
                wk = await page.evaluate("(() => { const c = document.querySelector('.wk'); const r = c.getBoundingClientRect(); return [Math.round(r.height), parseFloat(getComputedStyle(c).fontSize)]; })()")
                check(wk[0] >= 32 and wk[1] >= 13, f"week cells bigger: {wk}")
                await page.click('[data-cyc="next"]'); await page.wait_for_timeout(200)
                st = await page.evaluate("[...document.querySelectorAll('.wk')].slice(0, 2).map(c => c.className)")
                check("skip" in st[0] and "miss" not in st[0] and "cur" in st[1], f"after «Следующая неделя» week 1 is not marked missed: {st}")
                await page.click('[data-undo]'); await page.wait_for_timeout(150)
                miss = await page.evaluate("""(() => { const lum = (c) => { const v = c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
                    const el = document.querySelector('.legend .lg.miss'); const sh = getComputedStyle(el).boxShadow; const col = sh.match(/rgba?\\([^)]+\\)/)[0], bg = getComputedStyle(document.querySelector('#cycle')).backgroundColor;
                    const a = lum(col), b = lum(bg); return Math.round(((Math.max(a, b) + .05) / (Math.min(a, b) + .05)) * 10) / 10; })()""")
                check(miss >= 3, f"missed week marked with an amber outline (contrast {miss}:1 ≥ 3)")
                over = await page.evaluate("(() => { const g = document.querySelector('.week-grid').getBoundingClientRect(); return [...document.querySelectorAll('.wd')].filter(x => x.getBoundingClientRect().right > g.right + 0.5 || x.scrollWidth > x.clientWidth + 1).length; })()")
                check(over == 0, f"weekday buttons fit the card: {over} overflow")
            if pv == "about":
                acc = await page.evaluate("[...document.querySelectorAll('#app details.acc')].map(d => d.open)")
                check(len(acc) >= 5 and acc.count(True) == 1, f"about: blocks and texts as accordions, only the current block open: {acc}")
                vc = await page.evaluate("(() => { const s = document.querySelector('.vol-ctl .seg'), c = document.querySelector('.vol-ctl .chk'); const r = s.getBoundingClientRect(), k = c.getBoundingClientRect(), card = s.closest('.card').getBoundingClientRect(); return { full: r.width >= card.width - 34, below: k.top >= r.bottom - 1, inline: s.getAttribute('style') }; })()")
                check(vc["full"] and vc["below"] and not vc["inline"], f"about: block segments full width, checkbox below: {vc}")
                check("Объём по мышцам" in [NB(x) for x in await page.evaluate("[...document.querySelectorAll('#app .sec-h')].map(h => h.textContent)")], "about: section named «Объём по мышцам», as in the hub")
            if pv == "progs":
                check("Текущая" in await page.inner_text("#app") and await page.locator("#app .empty").count() == 1, "all programmes: current programme + empty state (stage C)")
            await page.evaluate("history.back()"); await page.wait_for_timeout(250)
            check(await page.locator(".sess-list").count() == 1, f"{pv}: history.back → hub")
        # меню героя: только действия с программой; сброс с подтверждением
        await page.evaluate("window.__UPG.PM.setParams('1A', 1, 0, '', { sets: 5 })"); await page.evaluate("window.__UPG.render()")
        await page.click("[data-pmenu]"); await page.wait_for_timeout(350)
        acts = await page.evaluate("[...document.querySelectorAll('#sheet [data-sa]')].map(b => b.dataset.sa)")
        check("pgo" not in acts and "preset" in acts, f"programme ⋮ menu: only programme actions, no duplicate of «Управление»: {acts}")
        await page.click('#sheet [data-sa="preset"]'); await page.wait_for_timeout(150)
        await page.click('#sheet [data-sa="presetdo"]'); await page.wait_for_timeout(350)
        check(not await page.evaluate("window.__UPG.PM.edited('1A')") and "исходной" in await toast_text(page), "programme ⋮ → reset all edits (confirm), toast")
        await page.click("#toast [data-toastundo]"); await page.wait_for_timeout(200)
        check(await page.evaluate("window.__UPG.PM.edited('1A')"), "reset undone from the toast")

        # 5. прямые ссылки: «Изменить» на «Сегодня», «Управлять циклом», «назад» — туда, откуда пришли (и на ту же прокрутку)
        await fresh(page, "?tab=today")
        day = await page.evaluate("window.__UPG.state.day")
        await page.evaluate("window.scrollTo(0, 120)"); await page.wait_for_timeout(120)
        ty = await page.evaluate("Math.round(scrollY)")
        # нажатие без автопрокрутки Playwright к кнопке: палец жмёт то, что видно
        await page.evaluate("document.querySelector('.hero [data-planedit]').click()"); await page.wait_for_timeout(300)
        check(await page.evaluate("window.__UPG.state.tab") == "plan" and await page.text_content(".psess-h .day-tile") == day and await back_label(page) == "Сегодня" and await page.locator(".nav-i.on[data-tab='plan']").count() == 1,
              f"Today «Изменить» → workout {day} directly, back says «{await back_label(page)}»")
        await page.evaluate("history.back()"); await page.wait_for_timeout(400)
        ty2 = await page.evaluate("Math.round(scrollY)")
        check(await page.evaluate("window.__UPG.state.tab") == "today" and abs(ty2 - ty) <= 2, f"history.back from there → Today, scroll kept {ty} → {ty2}")
        await page.evaluate("window.scrollTo(0, 120)"); await page.wait_for_timeout(120)
        await page.evaluate("document.querySelector('.hero [data-planedit]').click()"); await page.wait_for_timeout(300)
        await page.click("#back"); await page.wait_for_timeout(400)
        ty3 = await page.evaluate("Math.round(scrollY)")
        check(abs(ty3 - ty) <= 2, f"back button → Today, scroll kept {ty} → {ty3}")
        await page.click(".nav [data-tab='plan']"); await page.wait_for_timeout(200)
        check(await page.locator(".sess-list").count() == 1, "Программа afterwards opens on the hub")
        await page.click(".nav [data-tab='today']"); await page.wait_for_timeout(150)
        if not await page.locator('[data-cycfocus]').is_visible(): await page.click('[data-ctl]'); await page.wait_for_timeout(100)
        await page.click('[data-cycfocus]'); await page.wait_for_timeout(300)
        check(await title(page) == "Расписание и цикл" and await back_label(page) == "Сегодня", "Today «Управлять циклом» → «Расписание и цикл»")
        await page.click("#back"); await page.wait_for_timeout(250)
        check(await page.evaluate("window.__UPG.state.tab") == "today", "back button → Today")
        # на «Сегодня» при 90 минутах столько же упражнений, сколько в хабе
        await page.click('button[data-day="A"]'); await page.wait_for_timeout(150)
        if not await page.locator('button[data-time="90"]').is_visible(): await page.click('[data-ctl]')
        await page.click('button[data-time="90"]'); await page.wait_for_timeout(200)
        tn = await page.locator("#app .ex[data-ex]").count()
        check(tn == hub_n["A"], f"hub count equals Today at 90 min: hub {hub_n['A']}, Today {tn}")
        # «Упражнения» → «Добавить в тренировку»: шторка добавления прямо там, с выбором тренировки
        await page.goto(APP + "?tab=library"); await page.wait_for_timeout(900)
        await page.locator(".lib-row").first.click(); await page.wait_for_timeout(200)
        await page.click("[data-libadd]"); await page.wait_for_timeout(350)
        check(await sheet_open(page) and (await page.text_content("#sheetTitle")).startswith("Добавить «") and await page.locator('#sheet [data-sa="ad"]').count() >= 2, "library «Добавить в тренировку» → add sheet with workout/block choice")
        await page.evaluate("history.back()"); await page.wait_for_timeout(300)
        check(not await sheet_open(page) and await page.evaluate("window.__UPG.state.tab") == "library", "history.back closes it, stays in «Упражнения»")
        # прямой адрес экрана и перезагрузка на нём
        await page.goto(APP + "?tab=plan&s=2B"); await page.wait_for_timeout(400)
        check(await page.text_content(".psess-h .day-tile") == "B" and await page.locator('.ps-blk [data-pb="2"].on').count() == 1, "?tab=plan&s=2B opens that workout")
        await page.reload(); await page.wait_for_timeout(400)
        check(await page.text_content(".psess-h .day-tile") == "B", "reload keeps the screen")

        # 6. экран тренировки: подписанные ячейки, суперсет, разминка/финиш, панель, меню ⋮, нумерация как на «Сегодня»
        await page.goto(APP + "?tab=plan&s=1A"); await page.wait_for_timeout(400)
        cells = await page.evaluate("[...document.querySelectorAll('.prow')].map(r => [...r.querySelectorAll('.pr-s')].map(s => [...s.querySelectorAll('.pc')].map(c => [c.querySelector('b').textContent, c.querySelector('small').textContent])))")
        bad = [c for card in cells for line in card for c in [line] if not line or not re.search(r"подход", line[0][1]) or len(line) > 3]
        has_rir = any(any(x[1] == "запас" for x in line) for card in cells for line in card)
        check(cells and not bad and has_rir, f"cards: three labelled cells «3 / подхода · 10–12 / повторов · 2 / запас»: {cells[0]} bad={bad[:2]}")
        grid = await page.evaluate("getComputedStyle(document.querySelector('.pcs')).gridTemplateColumns.split(' ').length")
        check(grid == 3, f"cells laid out as a 3-column grid: {grid}")
        var2 = await page.evaluate("[...document.querySelectorAll('.prow')].filter(r => r.querySelectorAll('.pr-s').length > 1).map(r => [...r.querySelectorAll('.pr-v')].map(v => v.textContent))")
        check(var2 and all(len(v) == 2 for v in var2), f"week variants: two cell rows with variant labels: {var2[:1]}")
        bg = await page.evaluate("(() => { const q = getComputedStyle(document.querySelector('.pr-qs')).backgroundColor, s2 = getComputedStyle(document.documentElement).getPropertyValue('--surface-2').trim(); const d = document.createElement('i'); d.style.color = s2; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return [q, c]; })()")
        check(bg[0] == bg[1], f"values block is neutral (surface-2), tonal only when the editor is open: {bg}")
        sup = await page.evaluate("[...document.querySelectorAll('.pgroup.multi')].map(g => ({ head: g.querySelector(':scope > .pg-h').textContent.trim(), line: getComputedStyle(g, '::before').width, link: !!g.querySelector('.pg-h .gl .ic') }))")
        check(sup and all(s["head"].startswith(("Суперсет", "Тройка", "Круг")) and "отдых" in s["head"] and s["line"] == "3px" and s["link"] for s in sup), f"supersets: header «Суперсет · отдых 90 с» with link icon, coloured line: {sup[:2]}")
        single = await page.evaluate("[...document.querySelectorAll('.pgroup.single')].map(g => [!!g.querySelector('.pg-h'), (g.querySelector('.pr-rest') || {}).textContent || ''])")
        check(all(not h and "отдых" in r for h, r in single), f"single exercise: no superset header, rest as a line in the card: {single[:2]}")
        fx = await page.evaluate("[...document.querySelectorAll('details.pfixed')].map(d => [d.open, !!d.querySelector('summary .gl .ic')])")
        check(len(fx) >= 2 and all(not o and ic for o, ic in fx), f"warm-up and finishers: compact folded rows with icons: {fx}")
        acts = await page.evaluate("(() => { const a = document.querySelector('.plan-acts'); if (!a) return null; const r = a.getBoundingClientRect(); return { pos: getComputedStyle(a).position, primary: a.querySelector('.btn.primary[data-padd]').textContent.trim(), order: a.querySelector('[data-preorder]').textContent.trim(), bottom: Math.round(r.bottom), nav: Math.round(document.querySelector('.nav').getBoundingClientRect().top) }; })()")
        check(acts and acts["pos"] == "sticky" and acts["primary"] == "Добавить упражнение" and acts["order"] == "Порядок" and acts["bottom"] <= acts["nav"], f"sticky bar «Добавить упражнение» + «Порядок» above the nav: {acts}")
        check(NB(await page.text_content(".plan-hint")) == "Правки сразу видны на «Сегодня».", "short hint under the list")
        first_ex = await page.evaluate("Math.round(document.querySelector('.prow').getBoundingClientRect().top)")
        check(first_ex <= 300, f"compact head: first exercise card top = {first_ex} px (≤ 300)")
        tiles = await page.evaluate("({ badge: document.querySelectorAll('#app .tile-w').length, inName: [...document.querySelectorAll('.prow')].every(r => r.querySelector('.pr-n .code')), size: parseFloat(getComputedStyle(document.querySelector('.pr-n .code')).fontSize) })")
        check(tiles["badge"] == 0 and tiles["inName"] and tiles["size"] >= 13, f"number left of the name (13 px), no badge on the tile: {tiles}")
        bs = await page.evaluate("[...document.querySelectorAll('.ps-blk button')].map(b => ({ now: (b.querySelector('.now-b') || {}).textContent || '', dot: b.querySelectorAll('i.now, i.ed').length }))")
        check(bs and bs[0]["now"] == "сейчас" and not any(x["dot"] for x in bs), f"block segments: «сейчас» as text, no unlabelled dots: {bs}")
        check(await page.locator("#hdrMenu:not([hidden])").count() == 1, "⋮ in the header on the workout screen")
        await page.click("#hdrMenu"); await page.wait_for_timeout(350)
        acts = await page.evaluate("[...document.querySelectorAll('#sheet [data-sa], #sheet [data-sf]')].map(b => b.dataset.sa || b.dataset.sf)")
        check(all(a in acts for a in ["title", "dcopy", "dclear"]) and "Оставь пустым" in await page.inner_text("#sheet"), f"header ⋮: rename, copy to…, clear (+ reset when edited): {acts}")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        await page.click("#hdrRen"); await page.wait_for_timeout(400)
        check(await page.evaluate("document.activeElement && document.activeElement.id === 'shTitle'"), "header pencil → rename field focused")
        await page.fill("#shTitle", "Ноги и жим"); await page.press("#shTitle", "Enter"); await page.wait_for_timeout(400)
        check(not await sheet_open(page) and await title(page) == "Ноги и жим" and await page.evaluate("window.__UPG.sessOf('1A').title") == "Ноги и жим", "Enter on the keyboard saves the name and closes the sheet")
        await page.evaluate("window.__UPG.PM.setTitle('1A', '')"); await page.evaluate("window.__UPG.render()")
        rows = await page.evaluate(TOGGLE_ROWS)
        check(rows == ["seg bseg ps-blk"], f"workout screen: the only segment row is «Блок 1 · 2 · 3»: {rows}")
        await page.click('[data-pb="3"]'); await page.wait_for_timeout(150)
        check(await title(page) == await page.evaluate("window.__UPG.sessOf('3A').title") and await page.text_content(".psess-h .day-tile") == "A", "block segment → the same workout in block 3")
        await page.click('[data-pb="1"]'); await page.wait_for_timeout(150)
        tline = NB(await page.inner_text(".ps-time"))
        check(re.search(r"≈ \d+ мин при 90 минутах", tline) and await page.locator("#psMore[hidden]").count() == 1, f"one time figure for the current mode: «{tline}», details folded")
        await page.click("[data-psmore]"); await page.wait_for_timeout(150)
        check(await page.locator("#psMore:not([hidden])").count() == 1 and "запас" in await page.inner_text("#psMore"), "«Подробнее» shows the other modes and explains «запас»")
        await page.click("[data-psmore]"); await page.wait_for_timeout(100)
        await quality(page, "#app", "375px workout")
        plan_codes = await page.evaluate("[...document.querySelectorAll('.prow .code')].map(c => c.textContent)")
        check(plan_codes[:3] == ["1а", "1б", "2а"] and not any(re.match(r"^[A-F]\d", c) for c in plan_codes), f"constructor codes: number + а/б in a superset: {plan_codes[:6]}")
        check("связк" not in (await page.inner_text("#app")).lower(), "workout screen says «суперсет», not «связка»")
        # шторка упражнения: без повторного редактора; «Подходы и повторы» → встроенный редактор
        await page.click('.pr-open[data-pi="1:0"]'); await page.wait_for_timeout(350)
        check(await page.locator("#sheet .qe, #sheet [data-sa='sets']").count() == 0 and await page.locator("#sheet .btn.primary[data-sa='replace']").count() == 1, "exercise sheet: «Заменить» main, no duplicate steppers")
        await page.click('#sheet .sh-more summary'); await page.wait_for_timeout(100)
        st = await page.inner_text("#sheet")
        check("связк" not in st.lower() and "в суперсет с «" in st and not JARGON.findall(st), "exercise sheet: «в суперсет с «…»», no «связка», no jargon")
        await quality(page, "#sheet", "exercise sheet")
        await page.click('#sheet [data-sa="params"]'); await page.wait_for_timeout(450)
        check(not await sheet_open(page) and await page.locator('.prow.qe-on .qe-box').count() == 1, "«Подходы и повторы» → inline editor on the card")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(150)
        # шторка суперсета
        await page.click('[data-pg="1"]'); await page.wait_for_timeout(350)
        check(not JARGON.findall(await ui_text(page)) and (await page.text_content("#sheetTitle")).startswith("Суперсет 1") and "связк" not in (await page.inner_text("#sheet")).lower(), "superset sheet titled «Суперсет 1», no «связка», no jargon")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        # шторка «Добавить» с экрана тренировки: тренировка уже выбрана, «Когда делать» под «Ещё», суперсет — по имени
        await page.click(".plan-acts [data-padd]"); await page.wait_for_timeout(400)
        await page.locator('#sheet [data-sa="addpick"]').first.click(); await page.wait_for_timeout(300)
        add = await page.evaluate("({ seg: document.querySelectorAll('#sheet [data-sa=\"ad\"], #sheet [data-sa=\"ab\"]').length, into: (document.querySelector('#sheet .sh-into') || {}).textContent || '', tier: !!document.querySelector('#sheet .sh-add-more:not([open]) [data-sa=\"atier\"]'), places: [...document.querySelectorAll('#sheet [data-sa=\"aplace\"]')].map(b => b.textContent.trim()), btns: document.querySelectorAll('#sheet button:not([disabled])').length })")
        check(add["seg"] == 0 and "В тренировку A, блок 1" in NB(add["into"]) and add["tier"] and add["places"][0] == "Отдельно, в конец" and all(x.startswith("в суперсет с «") for x in add["places"][1:]), f"add sheet from the workout: no workout/block picker, «Когда делать» under «Ещё», «в суперсет с «…»»: {add}")
        await quality(page, "#sheet", "add sheet")
        await page.click('#sheet [data-sa="awhere"]'); await page.wait_for_timeout(150)
        check(await page.locator('#sheet [data-sa="ad"]').count() >= 2, "«изменить» shows the workout and block choice")
        txt = await page.inner_text("#sheet")
        check(not BARE_LETTER.findall(txt), f"no bare workout letter after a preposition in the add sheet: {BARE_LETTER.findall(txt)}")
        await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        # замена: подписи, после выбора — шторка закрыта, тост с «Отменить»
        await page.click('.pr-open[data-pi="1:0"]'); await page.wait_for_timeout(350)
        await page.click('#sheet [data-sa="replace"]'); await page.wait_for_timeout(400)
        labs = await page.evaluate("[...document.querySelectorAll('#sheet [data-sa=\"scope\"]')].map(b => b.childNodes[0].textContent.trim())")
        check(labs == ["Только в этой тренировке", "Во всех местах программы"], f"replace scope labels: {labs}")
        await quality(page, "#sheet", "replace sheet")
        await page.locator('#pickList .pk[data-sa="pick"]').first.click(); await page.wait_for_timeout(400)
        t = await toast_text(page)
        check(not await sheet_open(page) and "вместо" in t and not BARE_LETTER.findall(t) and await page.locator("#toast [data-toastundo]:not([hidden])").count() == 1, f"replace: sheet closes, toast with «Отменить»: «{t}»")
        await page.click("#toast [data-toastundo]"); await page.wait_for_timeout(250)
        check(not await page.evaluate("window.__UPG.PM.edited('1A')"), "replace undone from the toast")
        # копирование и очистка — тексты без голых букв
        await page.click("#hdrMenu"); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="dclear"]'); await page.wait_for_timeout(150)
        txt = await page.inner_text("#sheet")
        check("из тренировки A, блок 1" in txt and not BARE_LETTER.findall(txt), f"clear confirmation names the workout in words: {BARE_LETTER.findall(txt)}")
        await page.click('#sheet [data-sa="dclear0"]'); await page.click('#sheet [data-sa="dcopy"]'); await page.wait_for_timeout(250)
        txt = await page.inner_text("#sheet")
        check(not BARE_LETTER.findall(txt) and "Тренировка A во всех блоках" in txt, "copy sheet: workouts named in words")
        await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        # клавиатура телефона: пока она открыта, нижнее меню и липкая панель спрятаны
        await page.click('[data-qopen="1:1"]'); await page.wait_for_timeout(150)
        await page.evaluate("window.__UPG.PM.setParams('1A', 1, 1, '', { reps: '6 на сторону' })"); await page.evaluate("window.__UPG.render()")
        await page.click('[data-qopen="1:1"]'); await page.wait_for_timeout(150)
        await page.focus("#qeReps")
        await page.set_viewport_size({"width": 375, "height": 480}); await page.wait_for_timeout(450)
        kb = await page.evaluate("({ on: document.body.classList.contains('kb-on'), nav: getComputedStyle(document.querySelector('.nav')).display, bar: getComputedStyle(document.querySelector('.plan-acts')).display })")
        await page.evaluate("document.activeElement.blur()"); await page.set_viewport_size({"width": 375, "height": 812}); await page.wait_for_timeout(300)
        kb2 = await page.evaluate("document.body.classList.contains('kb-on')")
        check(kb["on"] and kb["nav"] == "none" and kb["bar"] == "none" and not kb2, f"keyboard open (visualViewport shrinks): nav and sticky bar hidden, back after: {kb} / {kb2}")
        await page.evaluate("window.__UPG.PM.reset('1A')")
        # нумерация одинаковая: «1а, 1б, 2…» в конструкторе и на «Сегодня» (120 мин — видны все суперсеты); номер — в строке названия
        await page.goto(APP + "?tab=today"); await page.wait_for_timeout(400)
        await page.click('button[data-day="A"]'); await page.wait_for_timeout(150)
        if not await page.locator('button[data-time="120"]').is_visible(): await page.click('[data-ctl]')
        await page.click('button[data-time="120"]'); await page.wait_for_timeout(200)
        today_codes = await page.evaluate("[...document.querySelectorAll('#app .ex[data-ex] .code')].map(c => c.textContent)")
        check(today_codes == plan_codes, f"Today uses the same numbering: {today_codes[:6]}")
        check(await page.evaluate("document.querySelectorAll('#app .tile-w').length === 0 && [...document.querySelectorAll('#app .ex[data-ex] .code')].every(c => c.closest('.ex-ttl'))"), "Today: number next to the name, no badge on the tile")
        await quality(page, "#app .ex[data-ex] .ex-sub", "Today scheme lines")
        await page.screenshot(path=f"{SH}/ui_program_today_codes.png")

        # 7. состояние переживает перерисовку (синхронизация) и смену вкладки
        await page.goto(APP + "?tab=plan"); await page.wait_for_timeout(400)
        await page.click('[data-pb="2"]'); await page.click('[data-pd="C"]'); await page.wait_for_timeout(200)
        await page.evaluate("window.Store.applyRemote({ goals: { b1: [true] } })"); await page.wait_for_timeout(300)
        check(await page.text_content(".psess-h .day-tile") == "C" and await page.locator('.ps-blk [data-pb="2"].on').count() == 1, "remote change re-renders the same workout screen (2C)")
        await page.click(".nav [data-tab='journal']"); await page.wait_for_timeout(150); await page.click(".nav [data-tab='plan']"); await page.wait_for_timeout(200)
        check(await page.text_content(".psess-h .day-tile") == "C" and await back_label(page) == "Программа", "tab switch and back: still on 2C")
        await to_hub(page)
        check(await page.locator('[data-pb="2"].on').count() == 1, "hub keeps the chosen block")

        # 8. нет жаргона, цели касания ≥ 44, без переполнения, текст влезает в кнопки, без висячих «·», шрифт ≥ 12 — на всех экранах (360 и 375)
        for w, h in ((375, 812), (360, 740)):
            await page.set_viewport_size({"width": w, "height": h})
            for q, prep, lab in (("?tab=plan", None, "hub"), ("?tab=plan&s=1A", None, "workout"), ("?tab=plan&s=1A", "qe", "workout + editor"), ("?tab=plan&s=1A", "fixed", "workout + warm-up open"),
                                 ("?tab=plan&s=1A", "order", "reorder"), ("?tab=plan&s=1C", None, "workout C"), ("?tab=plan&pv=sched", None, "sched"), ("?tab=plan&pv=about", None, "about"), ("?tab=plan&pv=progs", None, "progs")):
                await page.goto(APP + q); await page.wait_for_timeout(350)
                if prep == "qe": await page.click('[data-qopen="1:0"]'); await page.wait_for_timeout(150)
                if prep == "fixed": await page.click("details.pfixed summary"); await page.wait_for_timeout(150)
                if prep == "order": await page.click('[data-preorder="1"]'); await page.wait_for_timeout(200)
                small = await page.evaluate(TARGETS, "#app") + await page.evaluate(TARGETS, ".top")
                over = await page.evaluate("document.documentElement.scrollWidth - innerWidth")
                txt = await ui_text(page)
                jar = JARGON.findall(txt); bare = BARE_LETTER.findall(txt)
                check(not small and over <= 0 and not jar and not bare, f"{w}px {lab}: targets ≥44 {small or 'ok'}, overflow {over}, jargon {jar or 'none'}, bare letters {bare or 'none'}")
                await quality(page, "#app", f"{w}px {lab}")

        print("console errors:", errs)
        check(not errs, "no console errors")
        print(f"\n{len(OK)} ok, {len(FAIL)} failed")
        await b.close()
asyncio.run(main())
