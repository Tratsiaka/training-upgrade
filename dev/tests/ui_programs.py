"""Несколько программ (этап C, доработка): «Все программы», «Новая программа» (с нуля / шаблон / копия), переход с подтверждением и
«Отменить», весь путь «с нуля → упражнения → расписание по буквам → «Сегодня» → «Закончить тренировку» → назад на «Апгрейд» на то же
место», одна буква в один день в двух программах (ключ журнала «дата_буква@id»), данные выпущенной версии рядом со своей программой,
битые записи, неизвестная текущая программа, «назад» после перезагрузки и со вкладок, адреса с именами из прототипа, переименование,
описание, удаление с отменой, буква после удаления посреди недели, 1 и 6 тренировок, суперсет из шторки, тосты, числительные,
цели касания и переполнение на 360/375, нет «блок»/«разгрузка»/«из 5»/«приоритет» на своей программе.
Скриншоты dev/shots/v4c2_* (360×740 и 375×812, обе темы)."""
import asyncio, re, pathlib, json
from playwright.async_api import async_playwright
APP = "http://localhost:8765/"
SH = str(pathlib.Path(__file__).resolve().parents[1] / "shots")
OK = []; FAIL = []
def check(c, msg):
    (OK if c else FAIL).append(msg); print(("ok  " if c else "FAIL") + " " + msg)

TARGETS = """() => { const els = [...document.querySelectorAll('button, summary, select, input:not([type=checkbox]):not([type=hidden])')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[hidden]') && getComputedStyle(e).visibility !== 'hidden'; });
  return els.filter(e => { const r = e.getBoundingClientRect(); return r.height < 43.5 || (r.width < 43.5 && !e.textContent.trim()); }).map(e => (e.className || e.tagName) + ' ' + (e.textContent.trim().slice(0, 16) || e.getAttribute('aria-label') || '') + ' ' + Math.round(e.getBoundingClientRect().width) + '×' + Math.round(e.getBoundingClientRect().height)).slice(0, 6); }"""
OVER = "document.documentElement.scrollWidth - innerWidth"
CLIP = """() => [...document.querySelectorAll('#app button, #app .chip, #sheet:not([hidden]) button')].filter(e => e.offsetParent && !e.closest('[hidden]') && e.scrollWidth > e.clientWidth + 1).map(e => e.className + ' «' + e.textContent.trim().slice(0, 18) + '»').slice(0, 6)"""
# висячая «·» в списках dl(): точка — первый видимый знак строки
HANG = """() => [...document.querySelectorAll('#app .dl i')].filter(i => i.offsetParent).filter(i => { const p = i.previousElementSibling; return p && Math.abs(p.getBoundingClientRect().top - i.getBoundingClientRect().top) > 4 && getComputedStyle(i, '::before').content.includes('·') && i.getBoundingClientRect().left - i.parentElement.getBoundingClientRect().left > 6; }).map(i => i.textContent).slice(0, 4)"""
# «блок 1», «блока 2», «блоки», «разгрузка», «из 5», «приоритет» (названия вроде «тяга нижнего блока» — не про блоки программы)
FORBIDDEN = re.compile(r"\bблок(?:и\b|\s*\d|а\s+\d|ов\b)|разгруз|\bиз\s5\b|\bБ\d\b|приоритет|агент учт", re.I)
BARE = re.compile(r"(?<![А-Яа-яЁё])(в|во|из|по|к|с) [A-F](?![A-Za-z0-9])")
NB = lambda s: (s or "").replace(" ", " ").strip()
TODAY = "(() => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })()"

async def text(page):
    return NB(await page.evaluate("['#app', '.top', '#sheet:not([hidden])', '#toast:not([hidden])'].map(s => document.querySelector(s)).filter(Boolean).map(e => e.innerText).join('\\n')"))
async def toast(page):
    return await page.evaluate("document.getElementById('toast').hidden || !document.getElementById('toast').classList.contains('on') ? '' : document.getElementById('toastT').textContent")
async def fresh(page, q="?tab=plan", seed=None):
    await page.goto(APP + "?x"); await page.wait_for_timeout(100)
    await page.evaluate("(s) => { localStorage.clear(); localStorage.setItem('upg3:noLogin', 'true'); localStorage.setItem('upg3:loginHintHidden', 'true'); for (const k in (s || {})) localStorage.setItem('upg3:' + k, JSON.stringify(s[k])); }", seed or {})
    await page.goto(APP + q); await page.wait_for_timeout(450)
async def sheet_on(page):
    return await page.evaluate("!document.getElementById('sheet').hidden && document.getElementById('sheet').classList.contains('open')")
async def close_sheet(page):
    for _ in range(4):
        if not await sheet_on(page): return
        await page.click('#sheet .sheet-h [data-sa="close"]'); await page.wait_for_timeout(300)
async def hub(page):
    await close_sheet(page)
    for _ in range(3):
        if await page.locator(".sess-list").count(): return
        await page.click('.nav-i[data-tab="plan"]'); await page.wait_for_timeout(200)
async def progs(page):
    await hub(page); await page.click('[data-pv="progs"]'); await page.wait_for_timeout(250)
async def switch_to(page, pid):
    await progs(page); await page.click(f'[data-pswitch="{pid}"]'); await page.wait_for_timeout(350)
    await page.click('#sheet [data-sa="pswitchdo"]'); await page.wait_for_timeout(450)
async def add_two(page, d):
    """С хаба: карточка тренировки d → «Добавить упражнение» → два упражнения (второе — «Добавить и выбрать ещё»)."""
    await hub(page)
    await page.click(f'[data-pd="{d}"]'); await page.wait_for_timeout(250)
    await page.locator("[data-padd]").first.click(); await page.wait_for_timeout(350)
    await page.locator('#sheet [data-sa="addpick"]').nth(0).click(); await page.wait_for_timeout(200)
    await page.click('#sheet [data-sa="addmore"]'); await page.wait_for_timeout(250)
    await page.locator('#sheet [data-sa="addpick"]').nth(3).click(); await page.wait_for_timeout(200)
    await page.click('#sheet [data-sa="adddo"]'); await page.wait_for_timeout(350)
async def log_day(page, d, w="20", r="10"):
    """«Сегодня»: выбрать тренировку d и записать первый подход (вводом повторов)."""
    await close_sheet(page)
    await page.click('.nav-i[data-tab="today"]'); await page.wait_for_timeout(200)
    await page.click(f'button[data-day="{d}"]'); await page.wait_for_timeout(200)
    rr = page.locator('input[data-log][data-f="r"]').first
    if not await rr.is_visible(): await page.locator('button[data-toggle="log"]').first.click(); await page.wait_for_timeout(100)
    await page.locator('input[data-log][data-f="w"]').first.fill(w)
    await rr.fill(r); await page.wait_for_timeout(150)
    await page.locator("h3").first.click(); await page.wait_for_timeout(150)
async def custom_clean(page, lab):
    t = await text(page); bad = FORBIDDEN.findall(t); bare = BARE.findall(t)
    check(not bad and not bare, f"{lab}: no «блок»/«разгрузка»/«из 5»/«приоритет» on a custom programme {sorted(set(bad))[:4] or 'ok'}, no bare letter after a preposition {bare[:3] or 'ok'}")
async def layout(page, lab):
    small = await page.evaluate(TARGETS); over = await page.evaluate(OVER); clip = await page.evaluate(CLIP); hang = await page.evaluate(HANG)
    check(not small and over <= 0 and not clip and not hang, f"{lab}: targets ≥ 44 {small or 'ok'}, no horizontal overflow ({over}), text fits buttons {clip or 'ok'}, no hanging «·» {hang or 'ok'}")
def logs(page): return page.evaluate("JSON.parse(localStorage.getItem('upg3:logs') || '{}')")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 375, "height": 812}, service_workers="block", has_touch=True)
        await ctx.add_init_script("try{localStorage.setItem('upg3:noLogin','true')}catch(e){}")
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        today = None

        # 0. «Апгрейд» на неделе 3 — к ней вернёмся; сетка недели встроенной: ячейки ≥ 44 и буквы на цвете тренировки
        await fresh(page)
        today = await page.evaluate(TODAY)
        await page.click('[data-pv="sched"]'); await page.wait_for_timeout(200)
        grid = await page.evaluate("[...document.querySelectorAll('.wd')].map(c => ({ w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height), d: (c.className.match(/d-([A-F])/) || [])[1] || '' }))")
        check(len(grid) == 7 and all(c["w"] >= 44 and c["h"] >= 44 for c in grid) and [c["d"] for c in grid] == ["A", "B", "", "", "", "C", ""], f"built-in week grid: 7 cells ≥ 44 px, letters on workout colours (Mon A, Tue B, Sat C): {grid}")
        await page.click('[data-cyc="next"]'); await page.wait_for_timeout(150); await page.click('[data-cyc="next"]'); await page.wait_for_timeout(150)
        check(await page.evaluate("JSON.parse(localStorage.getItem('upg3:cycle')).idx") == 2, "built-in moved to week 3 (key cycle — as in the released version)")

        # 1. «Все программы»: одна встроенная, главная — «Новая программа», пустое состояние, «⋮» и у текущей
        await progs(page)
        one = await page.evaluate("""(() => ({ n: document.querySelectorAll('.pg-card').length, cur: !!document.querySelector('.pg-card.cur .tag.now'), menu: !!document.querySelector('.pg-card.cur [data-pitem]'),
            main: [...document.querySelectorAll('#app .btn.primary')].map(b => b.textContent.trim()), empty: !!document.querySelector('#app .empty'), title: document.getElementById('title').textContent }))()""")
        check(one["n"] == 1 and one["cur"] and one["menu"] and one["main"] == ["Новая программа"] and one["empty"] and one["title"] == "Все программы", f"all programmes: built-in with «Текущая» and ⋮, primary «Новая программа», empty state: {one}")
        check("сейчас: блок 1, неделя 3" in await text(page), "built-in card: «сейчас: блок 1, неделя 3»")
        await layout(page, "375 all programmes (one)")

        # 2. «Новая программа»: шаг 1 — три варианта; «С нуля» → шаг 2 — название со счётчиком, степпер 1–6, числительные
        await page.click('[data-pnew]'); await page.wait_for_timeout(350)
        kinds = await page.evaluate("[...document.querySelectorAll('#sheet [data-sa=pnkind]')].map(b => b.dataset.v)")
        check(kinds == ["blank", "tpl", "copy"] and "3 шаблона: фулбоди, верх/низ, тяни-толкай-ноги" in await text(page), f"step 1: from scratch, template («3 шаблона: …»), copy: {kinds}")
        await page.click('#sheet [data-sa="pnkind"][data-v="blank"]'); await page.wait_for_timeout(250)
        st2 = await page.evaluate("""(() => ({ name: document.getElementById('shPNew').value, n: document.querySelector('#sheet .stepper b').textContent, cnt: document.querySelector('#sheet .cnt').textContent,
            prim: [...document.querySelectorAll('#sheet .btn.primary')].map(b => b.textContent.trim()), sec: [...document.querySelectorAll('#sheet [data-sa=pnewdo]:not(.primary)')].map(b => b.textContent.trim()) }))()""")
        check(st2["name"] == "Моя программа" and st2["n"] == "3" and st2["cnt"] == "13 / 40" and st2["prim"] == ["Создать и перейти"] and st2["sec"] == ["Только создать"], f"step 2: name prefilled with counter «13 / 40», 3 workouts, two actions: {st2}")
        for _ in range(2): await page.click('#sheet [data-sa="pnn"][data-v="-1"]'); await page.wait_for_timeout(100)
        check("Тренировка A. Добавить" in await text(page), "numerals: one workout → «Тренировка A.»")
        for _ in range(2): await page.click('#sheet [data-sa="pnn"][data-v="1"]'); await page.wait_for_timeout(100)
        await page.fill("#shPNew", "Тест с нуля")
        check(await page.inner_text("#sheet .cnt") == "11 / 40", "counter follows the input")
        await layout(page, "375 new programme step 2")
        await page.click('#sheet [data-sa="pnewdo"][data-v="go"]'); await page.wait_for_timeout(450)
        cid = await page.evaluate("window.__UPG.curId()")
        hero = await page.evaluate("""(() => { const h = document.querySelector('.hero.ph'); return { name: h.querySelector('h2').textContent, sub: h.querySelector('.hero-sub').innerText, prog: h.querySelector('.prog-t').innerText,
            cards: document.querySelectorAll('.sess-card').length, empty: document.querySelectorAll('.sc-empty').length, extra: document.querySelectorAll('.sc-add, [data-paddto]').length, addDay: !!document.querySelector('[data-dayadd]') }; })()""")
        check(re.match(r"^p[0-9a-z]{8}$", cid) and hero["name"] == "Тест с нуля" and NB(hero["sub"]) == "3 тренировки в неделю" and "Неделя 1" in NB(hero["prog"]) and hero["cards"] == 3 and hero["empty"] == 3 and hero["extra"] == 0 and hero["addDay"],
              f"created and switched: hub — «3 тренировки в неделю», «Неделя 1», 3 empty cards (one «Пусто — добавь упражнения», no extra buttons): {hero}")
        check(await page.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('upg3:curprog')))") == json.dumps({"id": cid}, separators=(",", ":")) and "prog" not in (await page.evaluate("JSON.parse(localStorage.getItem('upg3:settings') || '{}')")),
              "switching = one curprog record; settings untouched")
        t0 = await toast(page)
        tb = await page.evaluate("(() => { const b = document.querySelector('#toast [data-toastundo]'); return b && !b.hidden && getComputedStyle(b).boxShadow === 'none'; })()")
        check(t0 == "Теперь «Тест с нуля»" and tb, f"short toast with a text «Отменить»: «{t0}»")
        await page.click('.nav-i[data-tab="journal"]'); await page.wait_for_timeout(200)
        check(await toast(page) == "", "toast hidden when the screen changes")
        await hub(page)
        await custom_clean(page, "custom hub (empty)")
        await layout(page, "375 custom hub (empty)")

        # 3. упражнения в три тренировки; суперсет из шторки упражнения
        for d in "ABC": await add_two(page, d)
        await hub(page)
        cards = await page.evaluate("[...document.querySelectorAll('.sess-card')].map(c => ({ sub: c.querySelector('.sc-sub').innerText, tags: c.querySelector('.sc-tags').innerText }))")
        check(all("2 упражнения" in NB(c["sub"]) for c in cards) and not any("изменена" in c["tags"] or "по желанию" in c["tags"] for c in cards), f"three workouts with 2 exercises each, no «изменена»/«по желанию»: {cards}")
        await page.click('[data-pd="A"]'); await page.wait_for_timeout(250)
        await page.locator(".pr-open").first.click(); await page.wait_for_timeout(350)
        acts = await page.evaluate("[...document.querySelectorAll('#sheet .sh-acts .btn')].map(b => b.textContent.trim())")
        check(acts[:2] == ["Заменить", "В суперсет…"] and "Убрать упражнение" in await text(page), f"exercise sheet: «В суперсет…» next to «Заменить», «Убрать упражнение»: {acts}")
        await page.click('#sheet [data-sa="grpick"]'); await page.wait_for_timeout(250)
        opts = await page.evaluate("[...document.querySelectorAll('#sheet [data-sa=grto]')].map(b => b.querySelector('.pk-n').firstChild.textContent.trim())")
        check(len(opts) == 1 and opts[0].startswith("с «"), f"superset picker names the partner: {opts}")
        await page.click('#sheet [data-sa="grto"]'); await page.wait_for_timeout(400)
        t1 = await toast(page)
        check(not await sheet_on(page) and "в суперсете с «" in t1 and await page.locator(".pgroup.multi").count() == 1 and await page.locator("#toast [data-toastundo]:not([hidden])").count() == 1, f"superset made: sheet closed, toast «{t1}» with «Отменить»")
        await page.locator(".pr-open").first.click(); await page.wait_for_timeout(300)
        await page.click('#sheet details.sh-more summary'); await page.wait_for_timeout(150)
        chip = await page.evaluate("(document.querySelector('#sheet .sh-groups .chip.on') || {}).textContent || ''")
        check(chip.strip().startswith("в суперсете с «"), f"selected superset chip named by the partner: «{chip.strip()}»")
        await page.click('#sheet [data-sa="grpick"]'); await page.wait_for_timeout(250)
        await page.click('#sheet [data-sa="grto"][data-v="new"]'); await page.wait_for_timeout(400)
        check(await page.locator(".pgroup.multi").count() == 0 and "отдельно" in await toast(page), "«В суперсет…» → «Отдельно» splits it back")
        await page.click("#hdrMenu"); await page.wait_for_timeout(350)
        acts = await page.evaluate("[...document.querySelectorAll('#sheet [data-sa]')].map(b => b.dataset.sa)")
        check("ddel" in acts and "dreset" not in acts and await page.evaluate("document.getElementById('sheetTitle').textContent") == "Тренировка A", f"workout ⋮: «Удалить тренировку», no reset, title without a block: {acts}")
        await close_sheet(page)

        # 4. расписание по буквам: сетка 7 × ≥ 44, тап — «Что в этот день», один день — одна тренировка
        await hub(page); await page.click('[data-pv="sched"]'); await page.wait_for_timeout(250)
        check(await page.inner_text("#title") == "Расписание и недели", "custom schedule title «Расписание и недели»")
        cells = await page.evaluate("[...document.querySelectorAll('[data-wcell]')].map(c => ({ wd: c.dataset.wcell, d: (c.className.match(/d-([A-F])/) || [])[1] || '', w: Math.round(c.getBoundingClientRect().width) }))")
        check([c["d"] for c in cells] == ["A", "", "B", "", "C", "", ""] and all(c["w"] >= 44 for c in cells), f"default: A Mon, B Wed, C Fri; cells ≥ 44: {cells}")
        await page.click('[data-wcell="2"]'); await page.wait_for_timeout(300)
        rows = await page.evaluate("[...document.querySelectorAll('#sheet [data-sa=wdset]')].map(b => b.dataset.v + ':' + b.querySelector('small').textContent)")
        check(await page.evaluate("document.getElementById('sheetTitle').textContent") == "Вторник: что в этот день" and rows[0] == ":без тренировки" and "C:сейчас — пятница; перенесётся сюда" in rows, f"«Что в этот день»: rest + workouts with their days: {rows}")
        await page.click('#sheet [data-sa="wdset"][data-v="C"]'); await page.wait_for_timeout(300)
        await page.click('[data-wcell="3"]'); await page.wait_for_timeout(300); await page.click('#sheet [data-sa="wdset"][data-v=""]'); await page.wait_for_timeout(300)
        cells = await page.evaluate("[...document.querySelectorAll('[data-wcell]')].map(c => (c.className.match(/d-([A-F])/) || [])[1] || '-').join('')")
        note = NB(await page.inner_text("#wdayMsg"))
        check(cells == "AC-----" and note.startswith("Без дня: B — в любой свободный день"), f"C moved to Tue, Wed — rest: {cells}; note «{note[:40]}»")
        check(await page.evaluate("JSON.stringify(window.__UPG.progsAll()[window.__UPG.curId()].wd)") == '{"A":1,"C":2}', "weekdays stored by letter: { A: 1, C: 2 }")
        cyc = await page.evaluate("({ main: [...document.querySelectorAll('#cycle .btn.primary')].map(b => b.textContent.trim()), cells: document.querySelectorAll('#cycle .wk').length, more: [...document.querySelectorAll('#cycle [data-cyc]')].map(b => b.dataset.cyc) })")
        check(cyc["main"] == ["Следующая неделя"] and cyc["cells"] == 8 and "restart" in cyc["more"] and "deload" not in cyc["more"], f"custom cycle: weeks in a row, no deload/next block: {cyc}")
        await custom_clean(page, "custom schedule")
        await layout(page, "375 custom schedule")
        await hub(page)
        wd = await page.evaluate("[...document.querySelectorAll('.sess-card .sc-tags')].map(t => t.innerText.trim())")
        check(wd == ["Пн", "любой день", "Вт"], f"hub days by letter, B — «любой день»: {wd}")
        await page.click('[data-pv="about"]'); await page.wait_for_timeout(250)
        check(await page.locator("#app .legend").count() == 0 and "Описание" in await text(page), "custom «О программе»: description, volume without the priority legend")
        await custom_clean(page, "custom about")

        # 5. «Сегодня»: три тренировки, без выбора времени и меток «Апгрейда»; «Закончить тренировку»; журнал — ключ «…@id»
        await page.click('.nav-i[data-tab="today"]'); await page.wait_for_timeout(250)
        await page.click('button[data-day="A"]'); await page.wait_for_timeout(200)
        td = await page.evaluate("""(() => ({ days: [...document.querySelectorAll('.day-seg button')].map(b => b.dataset.day), sub: [...document.querySelectorAll('.hero-sub .dl i')].map(i => i.textContent).join(' · '), ctl: document.querySelector('.ctl-sum').innerText,
            tags: [...document.querySelectorAll('#app .ex .tag')].map(t => t.textContent.trim()), ph: (document.querySelector('.log-row input[data-f=w]') || {}).placeholder, fin: !!document.querySelector('[data-finish]') }))()""")
        check(td["days"] == ["A", "B", "C"] and NB(td["sub"]) == "Тест с нуля · неделя 1" and "Самочувствие" in td["ctl"] and not any(t in ("приоритет", "спина", "грудь", "руки", "ноги") for t in td["tags"]) and td["ph"] == "" and not td["fin"],
              f"Today: A–C, «Тест с нуля · неделя 1», no time, no «приоритет»/muscle tags, empty placeholder under the label, no «Закончить» yet: {td}")
        await custom_clean(page, "custom Today")
        await log_day(page, "A")
        st = await page.evaluate("({ fin: !!document.querySelector('[data-finish=\"1\"]'), first: [...document.querySelectorAll('.prev')].some(p => p.offsetParent && p.textContent.includes('Первая запись') && p.closest('.ex').querySelector('.sets-sum')) })")
        check(st["fin"] and not st["first"], f"after the first set: «Закончить тренировку», no «Первая запись» hint on the logged exercise: {st}")
        await page.click('[data-finish="1"]'); await page.wait_for_timeout(250)
        fc = await page.evaluate("({ t: (document.querySelector('.fin-card') || {}).innerText || '', ok: !!document.querySelector('.day-seg button[data-day=\"A\"] .ok') })")
        check("Тренировка записана" in fc["t"] and "1 упражнение" in NB(fc["t"]) and "1 подход" in NB(fc["t"]) and fc["ok"], f"«Закончить»: summary «Тренировка записана · 1 упражнение · 1 подход», tick on chip A: {fc}")
        k = f"{today}_A@{cid}"
        L = await logs(page)
        check(k in L and L[k].get("prog") == cid and L[k].get("fin") and f"{today}_A" not in L, f"journal key «date_A@id» with prog and fin; no built-in key touched: {list(L)}")
        await page.click('[data-finish="0"]'); await page.wait_for_timeout(200)
        check("fin" not in (await logs(page))[k] and await page.locator('[data-finish="1"]').count() == 1, "«Продолжить» removes the mark")
        await log_day(page, "B")
        wk = await page.evaluate("(() => { const c = window.__UPG.ctxNow(); return [c.closed, c.idx]; })()")
        check(wk == [False, 0], f"A and B done, C has exercises → week 1 not closed: {wk}")
        await log_day(page, "C")
        check(await page.evaluate("window.__UPG.ctxNow().closed"), "A, B, C done → week 1 closed")
        # следующий день: записи — вчерашние; «Сегодня» уже на неделе 2
        await page.evaluate("""(() => { const L = JSON.parse(localStorage.getItem('upg3:logs')), d = new Date(Date.now() - 86400000), p = (n) => String(n).padStart(2, '0');
            const y = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, out = {}; Object.keys(L).forEach((k) => { out[y + k.slice(10)] = L[k]; }); localStorage.setItem('upg3:logs', JSON.stringify(out)); localStorage.removeItem('upg3:dayPick'); })()""")
        await page.goto(APP + "?tab=today"); await page.wait_for_timeout(400)
        ban = NB(await page.inner_text("#app")); hsub = NB(await page.evaluate("[...document.querySelectorAll('.hero-sub .dl i')].map(i => i.textContent).join(' · ')"))
        check("Неделя 1 закрыта → неделя 2." in ban and hsub == "Тест с нуля · неделя 2", "next day: «Неделя 1 закрыта → неделя 2.», hero «неделя 2»")
        await page.click('.nav-i[data-tab="journal"]'); await page.wait_for_timeout(250)
        await custom_clean(page, "custom Progress")
        cols = await page.evaluate("document.querySelector('.cols .target span') && document.querySelector('.cols .target span').textContent")
        check(cols == "3 в неделю" and "Пунктир — сколько тренировок в неделю обязательно (3)" in await text(page), f"Progress: target — all workouts of the programme: «{cols}»")
        await page.click('[data-jtab="volume"]'); await page.wait_for_timeout(200)
        await custom_clean(page, "custom Progress volume")

        # 6. назад на «Апгрейд»: подтверждение — один заголовок с местами; та же неделя; в тот же день — тренировка A «Апгрейда»
        await progs(page)
        first = await page.evaluate("document.querySelector('.pg-card').dataset.prog")
        check(first == cid, "current programme pinned first in the list")
        go = await page.evaluate("""(() => { const c = document.querySelector('.pg-card[data-prog="main"]'), g = c.querySelector('.pg-go'), n = c.querySelector('.pg-n'); return { w: Math.round(g.getBoundingClientRect().width), same: Math.abs(g.getBoundingClientRect().top - n.getBoundingClientRect().top) < 30 }; })()""")
        check(go["w"] < 140 and go["same"], f"«Перейти» — compact button in the card header: {go}")
        await page.click('[data-pswitch="main"]'); await page.wait_for_timeout(350)
        conf = NB(await page.inner_text("#sheetBody")); ttl = await page.inner_text("#sheetTitle")
        check(ttl == "Перейти на «Апгрейд»?" and "Перейти на" not in conf and "блок 1, неделя 3" in conf and "«Тест с нуля» запомнит место (неделя 1)" in conf, f"confirmation: one title «{ttl}», places: «{conf[:160]}»")
        await layout(page, "375 switch confirmation")
        await page.click('#sheet [data-sa="pswitchdo"]'); await page.wait_for_timeout(450)
        back = NB(await page.inner_text(".hero.ph .prog-t"))
        check(await page.evaluate("window.__UPG.curId()") == "main" and "Блок 1, неделя 3 из 5" in back, f"back on «Апгрейд» at the same place: «{back}»")
        await page.click("#toast [data-toastundo]"); await page.wait_for_timeout(350)
        check(await page.evaluate("window.__UPG.curId()") == cid, "«Отменить» right away → back on the custom programme")
        await switch_to(page, "main")
        await log_day(page, "A", "60", "8")
        L = await logs(page)
        mk = f"{today}_A"
        own = [x for x in L if x.endswith("@" + cid)]
        check(mk in L and "prog" not in L[mk] and len(own) == 3 and all(L[x]["prog"] == cid for x in own), f"same day, letter A in both: built-in «{mk}» without prog, 3 custom entries intact: {sorted(L)}")
        done = await page.evaluate("JSON.stringify(window.__UPG.ctxNow().done)")
        check(done == json.dumps({"A": today}, separators=(",", ":")), f"built-in week counts only its own entry: {done}")
        check(await toast(page) == "", "after a set in the new programme the switch toast is gone (no undo after writes)")
        await page.click('.nav-i[data-tab="journal"]'); await page.wait_for_timeout(250)
        await page.click('[data-jtab="progress"]'); await page.wait_for_timeout(200)
        stat = await page.evaluate("parseInt(document.querySelector('.stats .stat b').textContent)")
        check(stat == 4, f"«тренировок за 4 недели» — across programmes (3 custom + 1 built-in): {stat}")
        await switch_to(page, cid); await page.click('.nav-i[data-tab="today"]'); await page.wait_for_timeout(250)
        await page.click('button[data-day="A"]'); await page.wait_for_timeout(200)
        check(await page.locator(".sets-sum").count() == 0 and await page.locator(".log-row.done").count() == 0 and not await page.evaluate(f"!!window.__UPG.state.logs['{today}_A@{cid}']"), "custom Today on the same day: the built-in A sets are not shown as done, no custom entry created")
        await switch_to(page, "main")

        # 7. шаблон: состав по дням коротко, «Только создать»
        await progs(page); await page.click('[data-pnew]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="pnkind"][data-v="tpl"]'); await page.wait_for_timeout(250)
        tpl = await page.evaluate("[...document.querySelectorAll('#sheet .pk.tpl')].map(c => ({ n: c.querySelector('.tpl-t > b').textContent, d: c.querySelectorAll('.tpl-d').length, more: [...c.querySelectorAll('.tpl-d')].every(x => x.textContent.includes('и ещё')) }))")
        check([x["n"] for x in tpl] == ["Фулбоди · 3 дня", "Верх / низ · 4 дня", "Тяни — толкай — ноги · 3 дня"] and [x["d"] for x in tpl] == [3, 4, 3] and all(x["more"] for x in tpl), f"templates: 3 exercises per day + «и ещё N»: {tpl}")
        await layout(page, "375 templates")
        await page.click('#sheet [data-sa="pntpl"][data-v="upperlower4"]'); await page.wait_for_timeout(250)
        await page.click('#sheet [data-sa="pnewdo"][data-v="only"]'); await page.wait_for_timeout(350)
        tid = await page.evaluate("Object.keys(window.__UPG.progsAll()).find(k => window.__UPG.progsAll()[k].name.startsWith('Верх'))")
        check(await page.evaluate("window.__UPG.curId()") == "main" and await page.locator(".pg-card").count() == 3, "«Только создать»: stays on «Апгрейд», list has 3 programmes")
        await layout(page, "375 all programmes (several)")

        # 8. переименовать и описание (⋮), удалить с отменой — на прежнее место
        order0 = await page.evaluate("[...document.querySelectorAll('.pg-card')].map(c => c.dataset.prog)")
        await page.click(f'[data-pitem="{tid}"]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="pren"]'); await page.wait_for_timeout(250)
        check(await page.inner_text("#sheet .cnt") == "18 / 40", "rename: counter «18 / 40»")
        await page.fill("#shPName", "Верх-низ осень — зима"); await page.click('#sheet [data-sa="pfsave"]'); await page.wait_for_timeout(350)
        check("Верх-низ осень — зима" in NB(await page.inner_text("#app")), "renamed from the card menu")
        await page.click(f'[data-pitem="{tid}"]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="pnote"]'); await page.wait_for_timeout(250)
        await page.fill("#shPName", "Осенний цикл на 8 недель"); await page.click('#sheet [data-sa="pfsave"]'); await page.wait_for_timeout(350)
        check("Осенний цикл на 8 недель" in await page.inner_text("#app"), "description shown on the card")
        await page.click("#toast [data-toastundo]"); await page.wait_for_timeout(300)
        rec = await page.evaluate(f"window.__UPG.progsAll()['{tid}']")
        check(rec["name"] == "Верх-низ осень — зима" and rec.get("note") == PROG_NOTE, f"undo of the description restores only the description: {rec['name']} / {rec.get('note')}")
        await page.click(f'[data-pitem="{tid}"]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="pdel"]'); await page.wait_for_timeout(200); await page.click('#sheet [data-sa="pdeldo"]'); await page.wait_for_timeout(350)
        check(await page.locator(".pg-card").count() == 2 and "удалена" in await toast(page), "programme deleted, toast with «Отменить»")
        await page.click("#toast [data-toastundo]"); await page.wait_for_timeout(300)
        order1 = await page.evaluate("[...document.querySelectorAll('.pg-card')].map(c => c.dataset.prog)")
        check(order1 == order0, f"restored to its old place in the list: {order1}")

        # 9. имена без повторов; копия: блоки как у «Апгрейда», своё расписание
        n1 = await page.evaluate("window.__UPG.createProgram({ kind: 'copy', from: 'main' }).name")
        n2 = await page.evaluate("window.__UPG.createProgram({ kind: 'copy', from: 'main' }).name")
        n3 = await page.evaluate("window.__UPG.createProgram({ kind: 'blank', n: 2 }).name")
        n4 = await page.evaluate("window.__UPG.createProgram({ kind: 'blank', n: 2 }).name")
        check([n1, n2, n3, n4] == ["Апгрейд (копия)", "Апгрейд (копия 2)", "Моя программа", "Моя программа 2"], f"names without repeats: {[n1, n2, n3, n4]}")
        cpid = await page.evaluate("Object.keys(window.__UPG.progsAll()).find(k => window.__UPG.progsAll()[k].name === 'Апгрейд (копия)')")
        await page.evaluate("window.__UPG.render()")
        await switch_to(page, cpid)
        hc = await page.evaluate("({ sub: document.querySelector('.hero.ph .hero-sub').innerText, seg: !!document.querySelector('.bseg'), opt: document.querySelectorAll('.sess-card .sc-tags')[2].innerText })")
        check("3 блока по 5 недель" in NB(hc["sub"]) and hc["seg"] and "по желанию" in hc["opt"], f"copy behaves like «Апгрейд»: {hc}")
        await page.click('[data-pv="sched"]'); await page.wait_for_timeout(200); await page.click('[data-wday="2"]'); await page.wait_for_timeout(150)
        check(await page.evaluate("JSON.stringify((JSON.parse(localStorage.getItem('upg3:settings')) || {}).days || null)") == "null" and await page.evaluate("JSON.stringify(window.__UPG.progsAll()[window.__UPG.curId()].wd)") == "[1,6]", "copy: own schedule, built-in settings.days untouched")
        await page.click('[data-cyc="next"]'); await page.wait_for_timeout(150)
        check(await page.evaluate(f"JSON.parse(localStorage.getItem('upg3:progPos'))['{cpid}'].idx") == 1 and await page.evaluate("JSON.parse(localStorage.getItem('upg3:cycle')).idx") == 2, "copy's week in progPos[id]; key cycle stays the built-in's")

        # 10. одна и шесть тренировок; буква после удаления посреди недели; отмена возвращает день недели
        await progs(page); await page.click('[data-pnew]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="pnkind"][data-v="blank"]'); await page.wait_for_timeout(250)
        for _ in range(2): await page.click('#sheet [data-sa="pnn"][data-v="-1"]'); await page.wait_for_timeout(120)
        await page.fill("#shPNew", "Одна"); await page.click('#sheet [data-sa="pnewdo"][data-v="go"]'); await page.wait_for_timeout(400)
        check(await page.locator(".sess-card").count() == 1 and "1 тренировка в неделю" in NB(await page.inner_text(".hero.ph")), "one workout: «1 тренировка в неделю»")
        await page.click('[data-pd="A"]'); await page.wait_for_timeout(200); await page.click("#hdrMenu"); await page.wait_for_timeout(300)
        check(await page.locator('#sheet .btn.sh-row.danger[disabled]').filter(has_text="Удалить тренировку").count() == 1, "the last workout cannot be deleted")
        await close_sheet(page)
        for i in range(3):
            await hub(page); await page.click("[data-dayadd]"); await page.wait_for_timeout(300)
        await add_two(page, "D"); await log_day(page, "D")
        await hub(page); await page.click('[data-pd="D"]'); await page.wait_for_timeout(200); await page.click("#hdrMenu"); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="ddel"]'); await page.wait_for_timeout(200)
        check("Удалить «Тренировка D» из программы?" in await page.inner_text("#sheetBody"), "default name: «Удалить «Тренировка D»?» without repeating the letter")
        await page.click('#sheet [data-sa="ddeldo"]'); await page.wait_for_timeout(400)
        await page.click("[data-dayadd]"); await page.wait_for_timeout(300); await hub(page)
        letters = await page.evaluate("[...document.querySelectorAll('.sess-card .day-tile')].map(t => t.textContent).join('')")
        check(letters == "ABCE", f"D deleted mid-week with a journal entry → the new workout gets E, not D: {letters}")
        await page.click("[data-dayadd]"); await page.wait_for_timeout(300); await page.click("[data-dayadd]") if await page.locator("[data-dayadd]").count() else None
        await hub(page)
        while await page.locator("[data-dayadd]").count():
            await page.click("[data-dayadd]"); await page.wait_for_timeout(300); await hub(page)
        letters = await page.evaluate("[...document.querySelectorAll('.sess-card .day-tile')].map(t => t.textContent).join('')")
        check(letters == "ABCDEF" and "максимум" in await page.inner_text("#app"), f"six workouts A–F (D free again only when nothing else is left): {letters}")
        oid = await page.evaluate("window.__UPG.curId()")
        await page.evaluate(f"(() => {{ const U = window.__UPG, r = U.progsAll()['{oid}']; window.Store.set('progs', Object.assign({{}}, window.Store.get('progs'), {{ '{oid}': Object.assign({{}}, r, {{ wd: {{ A: 1, C: 3, E: 5 }} }}) }})); U.render(); }})()")
        await page.click('[data-pd="C"]'); await page.wait_for_timeout(200); await page.click("#hdrMenu"); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="ddel"]'); await page.wait_for_timeout(200); await page.click('#sheet [data-sa="ddeldo"]'); await page.wait_for_timeout(400)
        wd1 = await page.evaluate(f"JSON.stringify(window.__UPG.progsAll()['{oid}'].wd)")
        check(wd1 == '{"A":1,"E":5}', f"deleting C keeps the other workouts' weekdays: {wd1}")
        await page.click("#toast [data-toastundo]"); await page.wait_for_timeout(350)
        wd2 = await page.evaluate(f"JSON.stringify(window.__UPG.progsAll()['{oid}'].wd)")
        check(wd2 == '{"A":1,"C":3,"E":5}' and await page.locator('.sess-card[data-pd="C"]').count() == 1, f"undo: C back with its weekday: {wd2}")
        for w, h in ((375, 812), (360, 740)):
            await page.set_viewport_size({"width": w, "height": h})
            await page.click('.nav-i[data-tab="today"]'); await page.wait_for_timeout(250)
            seg = await page.evaluate("(() => { const s = document.querySelector('.day-seg'), hr = document.querySelector('.hero.th'); const H = hr.getBoundingClientRect(), inner = H.right - parseFloat(getComputedStyle(hr).paddingRight); const bs = [...s.children]; return { n: bs.length, fit: Math.max(...bs.map(b => b.getBoundingClientRect().right)) <= inner + .5, minw: Math.min(...bs.map(b => b.getBoundingClientRect().width)) }; })()")
            check(seg["n"] == 6 and seg["fit"] and seg["minw"] >= 44, f"{w}px Today with 6 workouts: buttons fit inside the hero padding, ≥ 44 px: {seg}")
            await page.click('button[data-day="F"]'); await page.wait_for_timeout(200)
            emp = await page.evaluate("({ est: /≈\\s*0\\s*мин/.test(document.getElementById('app').innerText), checkin: !!document.getElementById('checkin'), rest: document.getElementById('app').innerText.includes('По плану отдых'), btn: document.querySelectorAll('#app .t-empty .btn').length })")
            check(not emp["est"] and not emp["checkin"] and not emp["rest"] and emp["btn"] == 1, f"{w}px empty workout on Today: only the empty state with one button: {emp}")
            await layout(page, f"{w} Today (6 workouts)")
            await hub(page); await layout(page, f"{w} custom hub (6 workouts)")
            await page.click('[data-pd="F"]'); await page.wait_for_timeout(200)
            check(await page.locator(".ps-more").count() == 0 and not re.search(r"≈\s*0\s*мин", await page.inner_text("#app")), f"{w}px empty workout screen: no «≈ 0 мин», no «Подробнее»")
            await page.click('[data-padd]'); await page.wait_for_timeout(300)
            await page.locator('#sheet [data-sa="addpick"]').nth(0).click(); await page.wait_for_timeout(200)
            if await page.locator('#sheet [data-sa="awhere"]').count(): await page.click('#sheet [data-sa="awhere"]'); await page.wait_for_timeout(150)
            await layout(page, f"{w} add sheet with 6 workouts")
            await close_sheet(page)
            await hub(page); await page.click('[data-pv="sched"]'); await page.wait_for_timeout(200)
            await layout(page, f"{w} custom schedule (6 workouts)")
            await page.click('[data-wcell="0"]'); await page.wait_for_timeout(300); await layout(page, f"{w} «Что в этот день»"); await close_sheet(page)
            await progs(page); await layout(page, f"{w} all programmes")
        await page.set_viewport_size({"width": 375, "height": 812})

        # 11. выгрузка для агента — по текущей программе
        an = await page.evaluate("(() => { const a = window.__UPG.buildAnalysis(); return { kind: a.program.kind, w: a.program.workouts.join(''), blocks: a.program.blocks.length, deload: a.program.position.deload }; })()")
        check(an["kind"] == "custom" and an["w"] == "ABCDEF" and an["blocks"] == 0 and an["deload"] is False, f"analysis export describes the current programme: {an}")

        # 12. настройки: раздел — с названием текущей программы, «Старт» — только у встроенной
        await page.click('.nav-i[data-tab="more"]'); await page.wait_for_timeout(150); await page.click('.menu-i[data-tab="settings"]'); await page.wait_for_timeout(200)
        sec = await page.evaluate("[...document.querySelectorAll('#app .sec-h')].map(h => h.textContent.trim())")
        check("Программа «Одна»" in sec and await page.locator('#app [name="start"]').count() == 0 and await page.locator("[data-resetplan]").count() == 0, f"settings: «Программа «Одна»», no built-in-only fields: {sec}")
        await switch_to(page, "main")
        await page.click('.nav-i[data-tab="more"]'); await page.wait_for_timeout(150); await page.click('.menu-i[data-tab="settings"]'); await page.wait_for_timeout(200)
        check(await page.locator('#app [name="start"]').count() == 1 and await page.locator("[data-resetplan]").count() == 1, "settings on «Апгрейд»: start date and reset edits")

        # 13. системная «назад»: со вкладок — на «Сегодня», с «Сегодня» — выход; перезагрузка на вложенном экране без «мёртвого» шага
        p2 = await ctx.new_page(); p2.on("pageerror", lambda e: errs.append(str(e)))
        await p2.goto("about:blank"); await p2.goto(APP + "?tab=today"); await p2.wait_for_timeout(400)
        await p2.click('.nav-i[data-tab="library"]'); await p2.wait_for_timeout(300)
        await p2.go_back(); await p2.wait_for_timeout(300)
        check(await p2.evaluate("window.__UPG.state.tab") == "today" and p2.url.startswith(APP), "system back from «Упражнения» → «Сегодня» (in the app)")
        await p2.click('.nav-i[data-tab="plan"]'); await p2.wait_for_timeout(200); await p2.click('[data-pv="sched"]'); await p2.wait_for_timeout(250)
        h0 = await p2.evaluate("history.length")
        await p2.reload(); await p2.wait_for_timeout(500)
        h1 = await p2.evaluate("history.length")
        check(h1 == h0 and await p2.evaluate("window.__UPG.state.pv") == "sched", f"reload on a nested screen does not add a history step: {h0} → {h1}")
        await p2.go_back(); await p2.wait_for_timeout(300)
        check(await p2.evaluate("window.__UPG.state.tab + ':' + (window.__UPG.state.pv || 'hub')") == "plan:hub", "back after reload → hub")
        await p2.go_back(); await p2.wait_for_timeout(300)
        check(await p2.evaluate("window.__UPG.state.tab") == "today", "back from the hub → «Сегодня»")
        await p2.go_back(); await p2.wait_for_timeout(400)
        check(not p2.url.startswith(APP), f"back from «Сегодня» leaves the app: {p2.url}")
        for q, want in (("?tab=constructor", "Сегодня"), ("?tab=toString", "Сегодня"), ("?tab=plan&pv=__proto__", "Программа"), ("?tab=plan&pv=constructor", "Программа")):
            await p2.goto(APP + q); await p2.wait_for_timeout(350)
            t = await p2.inner_text("#title")
            check(t == want and "object" not in (await p2.inner_text("#app"))[:200], f"address {q} → «{t}»")
        await p2.close()

        # 14. данные выпущенной версии рядом со своей программой; битые записи; неизвестная текущая программа
        legacy_logs = {"2026-11-10_A": {"day": "A", "block": 1, "week": 5, "idx": 4, "ex": {"bench": [{"w": "60", "r": "8"}]}}, "2026-11-11_B": {"day": "B", "block": 1, "week": 5, "ex": {"rdl": [{"w": "80", "r": "8"}]}}}
        okr = {"name": "Своя", "base": None, "days": ["A", "B"], "wd": {"A": 1}, "plan": {"v": 1, "s": {}, "x": {}}}
        await fresh(page, "?tab=plan", {"settings": {"start": "2026-10-26", "days": [1, 2, 6]}, "cycle": {"idx": 4, "since": "2026-11-10", "hist": []}, "logs": legacy_logs,
                                         "plan": {"v": 1, "s": {"1A": {"t": "Мой низ", "to": "x", "g": []}}, "x": {}}, "progs": {"pok000001": okr}, "curprog": {"id": "pok000001"}})
        check(await page.evaluate("window.__UPG.curId()") == "pok000001", "released data + own programme: own one is current")
        await switch_to(page, "main")
        lg = await page.evaluate("({ prog: document.querySelector('.hero.ph .prog-t').innerText, done: JSON.stringify(window.__UPG.ctxNow().done), title: window.__UPG.sessOf('1A').title })")
        check("Блок 1, неделя 5 из 5" in NB(lg["prog"]) and lg["done"] == '{"A":"2026-11-10","B":"2026-11-11"}' and lg["title"] == "Мой низ", f"released cycle/journal/plan of «Апгрейд» work as before (week 5; A, and B without idx since the week start; renamed 1A): {lg}")
        bad_cases = {
            "progs-array": {"progs": [1, 2]},
            "prog-string": {"progs": {"pbad00001": "x"}, "curprog": {"id": "pbad00001"}},
            "days-garbage": {"progs": {"pbad00001": {"name": "n", "days": ["Z", 5, None, "AB"], "plan": {"s": {}}}}, "curprog": {"id": "pbad00001"}},
            "days-string": {"progs": {"pbad00001": {"name": "n", "days": "ABC", "plan": {}}}, "curprog": {"id": "pbad00001"}},
            "plan-garbage": {"progs": {"pbad00001": {"name": "n", "days": ["A"], "plan": {"s": {"1A": {"g": "zzz"}, "1B": {"g": [{"kind": "single", "items": [{"ex": "nonexist", "sets": "x"}]}]}}}}}, "curprog": {"id": "pbad00001"}},
            "base-other": {"progs": {"pbad00001": {"name": 123, "note": {"a": 1}, "base": "zzz", "days": ["A"], "wd": ["x", 9], "plan": {}}}, "curprog": {"id": "pbad00001"}},
            "pos-garbage": {"progPos": "zzz", "progs": {"pok000001": okr}, "curprog": {"id": "pok000001"}},
            "pos-garbage2": {"progPos": {"pok000001": {"idx": "abc", "hist": 5}}, "progs": {"pok000001": okr}, "curprog": {"id": "pok000001"}},
            "proto-id": {"progs": {"__proto__": okr, "main": okr}, "curprog": {"id": "__proto__"}},
        }
        for name, seed in bad_cases.items():
            e0 = len(errs)
            await fresh(page, "?tab=today", seed)
            r = {"cur": await page.evaluate("window.__UPG.curId()"), "len": await page.evaluate("document.getElementById('app').innerText.length")}
            for tab in ("plan", "journal", "today"):
                await page.click(f'.nav-i[data-tab="{tab}"]'); await page.wait_for_timeout(120)
            await page.evaluate("window.__UPG.planGo('progs')"); await page.wait_for_timeout(120)
            check(len(errs) == e0 and r["len"] > 100, f"broken data «{name}»: app works, no JS errors: {r} {errs[e0:e0 + 1]}")
        await fresh(page, "?tab=plan", {"curprog": {"id": "pnope0000"}})
        check(await page.evaluate("window.__UPG.curId()") == "main" and await page.evaluate("JSON.parse(localStorage.getItem('upg3:curprog')).id") == "main", "unknown current programme, not signed in → «Апгрейд», written once")
        await page.reload(); await page.wait_for_timeout(400)
        check(await page.evaluate("window.__UPG.curId()") == "main", "after restart still «Апгрейд»")

        # 15. переход с другого устройства посреди ввода подхода — перепривязка после ввода; удаление программы сохраняет названия упражнений из базы
        await fresh(page, "?tab=today", {"progs": {"pok000001": okr}})
        await page.click('button[data-day="A"]'); await page.wait_for_timeout(150)
        inp = page.locator('input[data-log][data-f="r"]').first
        if not await inp.is_visible(): await page.locator('button[data-toggle="log"]').first.click(); await page.wait_for_timeout(100)
        await inp.focus()
        await page.evaluate("window.Store.applyRemote({ curprog: { id: 'pok000001' } })"); await page.wait_for_timeout(150)
        mid = await page.evaluate("window.__UPG.curId()")
        await page.locator("h3").first.click(); await page.wait_for_timeout(300)
        check(mid == "main" and await page.evaluate("window.__UPG.curId()") == "pok000001", f"remote switch while typing a set: deferred until the input loses focus ({mid} → pok000001)")
        await page.evaluate("""(() => { const all = Object.assign({}, window.Store.get('progs')), r = all.pok000001;
            all.pok000002 = Object.assign({}, r, { id: 'pok000002', plan: { v: 1, s: {}, x: { ds_0095: { n: 'Шраги со штангой', src: 'ds', m: { p: ['back'], s: [] } } } } }); window.Store.set('progs', all); })()""")
        await page.evaluate("window.__UPG.switchProgram('main'); window.__UPG.deleteProgram('pok000002')")
        check(await page.evaluate("(window.Store.get('plan') || {}).x && window.Store.get('plan').x.ds_0095 && window.PROGRAM.exercises.ds_0095.n") == "Шраги со штангой", "deleted programme's dataset exercises move to the built-in plan.x — journal keeps their names")

        # 16. упражнение, которого нет в этой версии; битый журнал; «Прошлый раз» по всем программам; подсказка о старте — по своей программе
        e0 = len(errs)
        unk = {"name": "Неизвестное", "base": None, "days": ["A"], "wd": {}, "plan": {"v": 1, "s": {"1A": {"g": [{"id": "U1", "kind": "single", "tier": "core", "items": [{"ex": "nonexist", "sets": 3}]}, {"id": "U2", "kind": "single", "tier": "core", "items": [{"ex": "bench", "sets": 3, "reps": "8"}]}]}}, "x": {}}}
        await fresh(page, "?tab=today", {"progs": {"punk00001": unk}, "curprog": {"id": "punk00001"}, "plan": {"v": 1, "s": {"1B": {"g": [{"id": "U1", "kind": "single", "tier": "core", "items": [{"ex": "nonexist2", "sets": 2}]}]}}, "x": {}}})
        check(await page.locator('.ex[data-ex="bench"]').count() == 1, "Today with an unknown exercise in the workout: renders, known exercise shown")
        await page.click('.nav-i[data-tab="plan"]'); await page.wait_for_timeout(200); await page.click('[data-pd="A"]'); await page.wait_for_timeout(250)
        tag = await page.evaluate("[...document.querySelectorAll('#app .prow')].map(r => r.querySelector('.pr-n').textContent + '|' + [...r.querySelectorAll('.tag')].map(x => x.textContent).join(','))")
        check(any("Упражнение недоступно" in x and "замени или убери" in x for x in tag), f"workout screen: placeholder «Упражнение недоступно» with a hint: {tag}")
        await page.locator(".pr-open").first.click(); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="remove"]'); await page.wait_for_timeout(300)
        check(await page.locator("#app .prow").count() == 1, "the unavailable exercise can be removed from its sheet")
        await switch_to(page, "main")
        await page.click('.nav-i[data-tab="today"]'); await page.wait_for_timeout(200); await page.click('button[data-day="B"]'); await page.wait_for_timeout(200)
        await page.click('.nav-i[data-tab="plan"]'); await page.wait_for_timeout(200); await page.click('[data-pd="B"]'); await page.wait_for_timeout(200)
        check(len(errs) == e0, f"unknown exercise in the built-in plan: Today and the workout screen work, no JS errors {errs[e0:e0 + 1]}")
        e0 = len(errs)
        await fresh(page, "?tab=today", {"logs": {"2026-11-10_A": None, "2026-11-11_B": {"day": "B", "idx": 0, "ex": {"bench": None, "rdl": [{"w": "60", "r": "8"}]}}, "2026-11-12_C": {"day": "C", "ex": "zzz"}}})
        await page.click('.nav-i[data-tab="journal"]'); await page.wait_for_timeout(250)
        check(len(errs) == e0 and "Румынская тяга" in await page.inner_text("#app"), f"journal entry null / exercise sets null: Today and Progress work, valid sets shown {errs[e0:e0 + 1]}")
        await fresh(page, "?tab=today", {"logs": {f"{today}_A@pok000001": {"day": "A", "idx": 0, "prog": "pok000001", "ex": {"bench": [{"w": "70", "r": "6"}]}}, "2026-11-01_A": {"day": "A", "idx": 0, "ex": {"bench": [{"w": "50", "r": "8"}]}}}, "progs": {"pok000001": okr}})
        await page.click('button[data-day="A"]'); await page.wait_for_timeout(200)
        prev = await page.evaluate("(document.querySelector('.ex[data-ex=\"bench\"] .prev') || {}).textContent || ''")
        check("70×6" in prev, f"«Прошлый раз» on «Апгрейд» — today's entry of another programme counts (by date, across programmes): «{prev.strip()[:60]}»")
        fut = "2099-01-05"
        await fresh(page, "?tab=today", {"settings": {"start": fut}, "logs": {"2026-11-01_A": {"day": "A", "idx": 0, "ex": {"bench": [{"w": "50", "r": "8"}]}}}, "progs": {"pok000001": okr}, "curprog": {"id": "pok000001"}})
        check("Старт —" in await page.inner_text("#app"), "start hint on a new programme: counted by its own journal entries")

        await shots(b)
        check(not errs, f"no JS errors: {errs[:4]}")
        print(f"{len(OK)} ok, {len(FAIL)} failed")
        await b.close()

PROG_NOTE = "Верх и низ по очереди: каждая мышца — дважды в неделю, 6–7 упражнений за тренировку."

async def shots(b):
    """dev/shots/v4c2_*: исправленные места — «Все программы», шаг 2 со счётчиком, шаблоны, подтверждение перехода, хаб своей (пустой),
    расписание по буквам и «Что в этот день», «Сегодня» с «Закончить» и итогом, пустая тренировка, шторка упражнения и «В суперсет…»,
    тост над липкой панелью, «Прогресс», настройки."""
    for (w, h) in ((375, 812), (360, 740)):
        for theme in ("light", "dark"):
            ctx = await b.new_context(viewport={"width": w, "height": h}, service_workers="block", color_scheme=theme)
            await ctx.add_init_script("try{localStorage.setItem('upg3:noLogin','true');localStorage.setItem('upg3:loginHintHidden','true')}catch(e){}")
            pg = await ctx.new_page(); tag = f"{w}_{theme}"
            snap = lambda n: pg.screenshot(path=f"{SH}/v4c2_{n}_{tag}.png")
            await fresh(pg)
            await pg.evaluate("""(() => { const U = window.__UPG; U.createProgram({ kind: 'tpl', tpl: 'upperlower4', name: 'Моя сплит-программа на осень и всю зиму' }); U.createProgram({ kind: 'copy', from: 'main' }); U.render(); })()""")
            await progs(pg); await snap("progs")
            await pg.click('[data-pnew]'); await pg.wait_for_timeout(300); await snap("new_step1")
            await pg.click('#sheet [data-sa="pnkind"][data-v="tpl"]'); await pg.wait_for_timeout(250); await snap("templates")
            await pg.click('#sheet [data-sa="back"]'); await pg.wait_for_timeout(200); await pg.click('#sheet [data-sa="pnkind"][data-v="blank"]'); await pg.wait_for_timeout(250); await snap("new_step2")
            await close_sheet(pg)
            sp = await pg.evaluate("Object.keys(window.__UPG.progsAll()).find(k => window.__UPG.progsAll()[k].name.startsWith('Моя сплит'))")
            await pg.click(f'[data-pswitch="{sp}"]'); await pg.wait_for_timeout(350); await snap("switch_confirm")
            await pg.click('#sheet [data-sa="pswitchdo"]'); await pg.wait_for_timeout(400)
            await pg.click('[data-pd="A"]'); await pg.wait_for_timeout(250)
            await pg.locator(".pr-open").first.click(); await pg.wait_for_timeout(350); await snap("exercise_sheet")
            await pg.click('#sheet [data-sa="grpick"]'); await pg.wait_for_timeout(250); await snap("superset_pick")
            await pg.locator('#sheet [data-sa="grto"]').first.click(); await pg.wait_for_timeout(400); await snap("toast_over_panel")
            await hub(pg); await pg.click('[data-pv="sched"]'); await pg.wait_for_timeout(250); await snap("sched_letters")
            await pg.click('[data-wcell="3"]'); await pg.wait_for_timeout(300); await snap("wd_pick")
            await close_sheet(pg)
            await pg.click('.nav-i[data-tab="today"]'); await pg.wait_for_timeout(250)
            await pg.click('button[data-day="B"]'); await pg.wait_for_timeout(200); await snap("today_custom")
            await log_day(pg, "B")
            await pg.evaluate("document.querySelector('[data-finish]') && document.querySelector('[data-finish]').scrollIntoView({ block: 'center' })"); await pg.wait_for_timeout(150); await snap("today_finish_btn")
            await pg.click('[data-finish="1"]'); await pg.wait_for_timeout(300); await snap("today_finished")
            await pg.evaluate("""(() => { const U = window.__UPG, id = U.createProgram({ kind: 'blank', n: 6, name: 'Шесть дней' }).id; U.switchProgram(id); U.render(); })()""")
            await pg.wait_for_timeout(250); await pg.click('.nav-i[data-tab="today"]'); await pg.wait_for_timeout(250); await snap("today_empty6")
            await hub(pg); await snap("hub_empty")
            await pg.click('.nav-i[data-tab="journal"]'); await pg.wait_for_timeout(250); await snap("progress")
            await pg.click('.nav-i[data-tab="more"]'); await pg.wait_for_timeout(150); await pg.click('.menu-i[data-tab="settings"]'); await pg.wait_for_timeout(250)
            await pg.evaluate("[...document.querySelectorAll('.sec-h')].find(h => h.textContent.includes('Программа')).scrollIntoView()"); await pg.wait_for_timeout(100); await snap("settings_prog")
            await ctx.close()

asyncio.run(main())
