"""«Сегодня»: подход одним касанием, черновики без следов в журнале, двойное касание, −/+ и удержание, свёрнутый и
развёрнутый вид, запас, выбор дня, связка без прыжков страницы и таймер, смена даты, цели касания."""
import asyncio, json, re, datetime, pathlib
from playwright.async_api import async_playwright
APP = "http://localhost:8765/"
ROOT = pathlib.Path(__file__).resolve().parents[2]
SH = str(ROOT / "dev" / "shots")
OK = []; FAIL = []
def check(c, msg):
    (OK if c else FAIL).append(msg); print(("ok  " if c else "FAIL") + " " + msg)

# Тест не зависит от настоящей даты: часы страницы подменяет init-скрипт (ниже), дата — та, что выставлена set_date.
# По умолчанию — понедельник (день A по расписанию); отдельные сценарии — воскресенье и закрытая неделя.
D = None; today = None; KEY = None
def set_date(d):
    global D, today, KEY
    D, today = d, d.isoformat(); KEY = f"{today}_A"
iso = lambda n: (D - datetime.timedelta(days=n)).isoformat()
MONDAY = datetime.date(2026, 11, 16)
set_date(MONDAY)
CLOCK = """(() => { let s = null; try { s = sessionStorage.getItem('__now'); } catch (e) { /* */ } if (!s) return;
  const R = Date; window.__off = (+s) - R.now();
  function F(...a) { if (!new.target) return new R(R.now() + window.__off).toString(); return a.length ? new R(...a) : new R(R.now() + window.__off); }
  F.now = () => R.now() + window.__off; F.parse = R.parse; F.UTC = R.UTC; F.prototype = R.prototype; window.Date = F; })();"""
noon_ms = lambda d: int(datetime.datetime(d.year, d.month, d.day, 12).timestamp() * 1000)
GAP = 650  # больше защиты от двойного касания (500 мс)
LP = [{"w": "41,25", "r": "10"}] * 3


async def fresh(page, logs=None, extra=None, day="A"):
    """Чистый профиль (+ прошлые записи и ключи), открыть «Сегодня» на нужной тренировке."""
    await page.goto(APP + "?tab=today"); await page.wait_for_timeout(150)
    await page.evaluate("ms => sessionStorage.setItem('__now', String(ms))", noon_ms(D))  # часы страницы = выбранная дата, 12:00
    await page.evaluate("""([l, x]) => { localStorage.clear(); localStorage.setItem('upg3:noLogin','true'); localStorage.setItem('upg3:loginHintHidden','true');
        if (l) localStorage.setItem('upg3:logs', JSON.stringify(l)); Object.entries(x || {}).forEach(([k, v]) => localStorage.setItem('upg3:' + k, JSON.stringify(v))); }""", [logs, extra])
    await page.reload(); await page.wait_for_timeout(350)
    await page.click(f'button[data-day="{day}"]'); await page.wait_for_timeout(120)


def past_log(ex, days=7, day="A"):
    return {f"{iso(days)}_{day}": {"day": day, "block": 1, "week": 1, "idx": 0, "ready": "ok", "time": 90, "ex": ex}}


async def logs(page):
    return json.loads(await page.evaluate("localStorage.getItem('upg3:logs') || '{}'"))


async def entry(page, key=None):
    return (await logs(page)).get(key or KEY, {})


async def sets(page, ex, key=None):
    return (await entry(page, key)).get("ex", {}).get(ex, [])


async def val(page, ex, i, f):
    return await page.input_value(f'input[data-log="{ex}"][data-i="{i}"][data-f="{f}"]')


async def focused(page):
    return await page.evaluate("document.activeElement && (document.activeElement.dataset.done || document.activeElement.dataset.rir || document.activeElement.tagName)")


async def bar_on(page):
    return await page.evaluate("!document.getElementById('tBar').hidden")


async def day_mark(page, d="A"):
    """Отметка у чипа тренировки: «сделана» (галочка) или «начата» (кольцо) — словами в aria-label."""
    b = page.locator(f'button[data-day="{d}"]')
    return (await b.get_attribute("aria-label") or "") + ("" if not await b.locator(".ok").count() else " [ok]")


async def make_cur(page, ex):
    """Партнёр по связке до своей очереди показан коротко — касание заголовка делает его текущим."""
    if await page.locator(f'.ex[data-ex="{ex}"].lite').count(): await page.click(f'.ex[data-ex="{ex}"] .ex-tap'); await page.wait_for_timeout(150)


async def tap(page, sel, wait=GAP):
    await page.click(sel); await page.wait_for_timeout(wait)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True, service_workers="block")
        await ctx.add_init_script(CLOCK)
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)

        # 1. Цель на сегодня и ✓ одним касанием: 41,25 не округляется, +1 повтор там, где было ниже верха диапазона
        await fresh(page, past_log({"legpress": LP}))
        check(await page.locator('.ex.active .ex-name').inner_text() == "Жим ногами", "active exercise = Жим ногами")
        check(await page.locator('.ex.active [data-pane="log"]').is_visible(), "active log pane is open without a tap")
        w0, r0 = await val(page, "legpress", 0, "w"), await val(page, "legpress", 0, "r")
        check((w0, r0) == ("41,25", "11"), f"prefill = target 41,25 × 11 (last time 41,25×10): {w0} × {r0}")
        check("41,25×10" in await page.locator('.ex.active .prev').inner_text(), "last time stays visible in «Прошлый раз»")
        await tap(page, '[data-done="legpress:0"]')
        check((await sets(page, "legpress"))[:1] == [{"w": "41,25", "r": "11"}], f"one tap stores prefilled w+r: {await sets(page, 'legpress')}")

        # 2. Суперсет: партнёр без отдыха, круг закончен — таймер, фокус на следующий подход
        check(await focused(page) == "deadbug:0" and not await bar_on(page), f"superset hand-off → deadbug:0 without rest (focus {await focused(page)})")
        await tap(page, '[data-done="deadbug:0"]')
        check(await bar_on(page) and "Отдых" in await page.inner_text("#fab"), f"round done → rest timer runs: {await page.inner_text('#fab')}")
        check(await focused(page) == "legpress:1", f"focus → legpress:1 ({await focused(page)})")
        cover = await page.evaluate("""() => { const bar = document.getElementById('tBar').getBoundingClientRect();
            const a = document.activeElement.getBoundingClientRect();
            const ctl = [...document.querySelectorAll('.ex.cur .set-ok, .ex.cur .stp-b, .ex.cur .ex-tools .lnk, .ex.lite .set-ok, .rir-ask [data-rir]')].filter(e => e.getClientRects().length);
            const under = ctl.filter(e => { const r = e.getBoundingClientRect(); return r.bottom > bar.top + 1 && r.top < bar.bottom; }).map(e => e.dataset.done || e.dataset.step || e.textContent);
            return { focusAbove: a.bottom <= bar.top, under, total: ctl.length }; }""")
        check(cover["focusAbove"] and not cover["under"], f"no control of the current round under the timer bar: {cover}")
        await page.screenshot(path=f"{SH}/wp1r_timer.png")
        end_ok = await page.evaluate("""() => { window.scrollTo(0, document.documentElement.scrollHeight); const bar = document.getElementById('tBar').getBoundingClientRect();
            const last = document.getElementById('app').lastElementChild.getBoundingClientRect(); return last.bottom <= bar.top; }""")
        check(end_ok, "the last block of the page scrolls above the timer bar")
        await page.evaluate("window.scrollTo(0, 0)")

        # 2b. двойное касание: второй ✓ в течение 500 мс не записывает следующий подход
        await page.evaluate("""async () => { document.querySelector('[data-done="legpress:1"]').click(); await new Promise(r => setTimeout(r, 120));
            const n = document.querySelector('[data-done="deadbug:1"]'); if (n) n.click(); }"""); await page.wait_for_timeout(GAP)
        check(len(await sets(page, "deadbug")) == 1, f"double tap ignored: deadbug sets {await sets(page, 'deadbug')}")
        check(len(await sets(page, "legpress")) == 2, "first tap of the double tap counted")
        # отмена ✓: значения, отличные от подставленной цели, остаются в строке; таймер этого ✓ — стоп
        for _ in range(2): await page.click('[data-step="deadbug:1:r:1"]')
        await page.fill('input[data-log="deadbug"][data-i="1"][data-f="w"]', "5")
        await tap(page, '[data-done="deadbug:1"]')
        check(await bar_on(page) and (await sets(page, "deadbug"))[1:] == [{"w": "5", "r": "8"}], f"deadbug:1 logged 5×8, rest restarted: {await sets(page, 'deadbug')}")
        await tap(page, '.ex[data-ex="deadbug"] .ex-tap', 150)  # партнёр — по касанию становится текущим
        await tap(page, '.ex[data-ex="deadbug"] [data-allsets]', 150)
        await tap(page, '[data-done="deadbug:1"]')
        ds = await sets(page, "deadbug")
        check(ds == [{"w": "", "r": "6"}], f"tap on done ✓ un-logs, nothing else stays in the log: {ds}")
        check(await page.get_attribute('[data-done="deadbug:1"]', "aria-pressed") == "false" and (await val(page, "deadbug", 1, "w"), await val(page, "deadbug", 1, "r")) == ("5", "8"),
              "un-logged row keeps its own values (5 × 8, not the suggestion), aria-pressed=false")
        check(not await bar_on(page), "timer from that ✓ stopped after immediate un-log")
        # развёрнутый вид: «свернуть» возвращает компактный, подтверждение правки — тоже
        check(await page.locator('.ex[data-ex="deadbug"] .sets-more').inner_text() == "свернуть", "expanded card offers «свернуть»")
        await page.screenshot(path=f"{SH}/wp1r2_expanded.png")
        await tap(page, '[data-done="deadbug:1"]')
        check(await page.locator('.ex[data-ex="deadbug"] .log.all').count() == 0, "confirming the edited set returns the card to compact view")
        if await page.locator('.ex[data-ex="legpress"].lite').count(): await tap(page, '.ex[data-ex="legpress"] .ex-tap', 150)
        await tap(page, '.ex[data-ex="legpress"] .sets-sum', 150)
        await tap(page, '.ex[data-ex="legpress"] .sets-more', 150)
        check(await page.locator('.ex[data-ex="legpress"] .log.all').count() == 0 and await page.locator('.ex[data-ex="legpress"] .sets-sum').count() == 1, "«свернуть» goes back to compact")

        # 3. черновики не оставляют в журнале строк без повторов: −/+, ввод веса, отмена, стёртые повторы
        await fresh(page)
        await page.click('[data-step="legpress:0:w:1"]'); await page.fill('input[data-log="legpress"][data-i="0"][data-f="w"]', "60")
        await page.click('[data-step="legpress:0:w:1"]'); await page.wait_for_timeout(100)
        check(KEY not in await logs(page) and not re.search("сделана|начата", await day_mark(page)), f"stepper and typed weight write nothing; day A not marked: {await logs(page)}")
        await tap(page, '[data-done="legpress:0"]')
        check(await sets(page, "legpress") == [{"w": "62,5", "r": "10"}] and "начата" in await day_mark(page) and "сделана" not in await day_mark(page) and await page.evaluate("!!window.__UPG.ctxNow().done.A"),
              f"✓ stores the set (62,5 × 10); chip A shows «начата» (not all exercises yet), the week still counts A: {await sets(page, 'legpress')} {await day_mark(page)}")
        await tap(page, '.ex[data-ex="legpress"] .ex-tap', 150); await tap(page, '.ex[data-ex="legpress"] .sets-sum', 150)
        await tap(page, '[data-done="legpress:0"]')
        check(KEY not in await logs(page) and not re.search("сделана|начата", await day_mark(page)), f"un-log of the only set removes today's entry: {await logs(page)}")
        check(await val(page, "legpress", 0, "w") == "62,5", "un-logged weight stays as a draft")
        await tap(page, '[data-done="legpress:0"]')
        await tap(page, '.ex[data-ex="legpress"] .ex-tap', 150); await tap(page, '.ex[data-ex="legpress"] .sets-sum', 150)
        await page.fill('input[data-log="legpress"][data-i="0"][data-f="r"]', ""); await page.wait_for_timeout(100)
        check(KEY not in await logs(page), f"clearing reps of the only done set removes the entry: {await logs(page)}")
        # строка-заглушка недельной давности не подменяет настоящую историю
        await fresh(page, {**past_log({"legpress": LP}, 9), **past_log({"legpress": [{"w": "43,75"}]}, 2)})
        check("41,25×10" in await page.locator('.ex[data-ex="legpress"] .prev').inner_text() and await val(page, "legpress", 0, "w") == "41,25", "a weight-only stub is ignored by «Прошлый раз» and prefill")
        # автосдвиг цикла: только при записанном подходе и откатывается, если запись дня опустела
        wk = {f"{iso(2)}_A": {"day": "A", "block": 1, "week": 1, "idx": 0, "ex": {"bench": [{"w": "100", "r": "8"}]}},
              f"{iso(1)}_B": {"day": "B", "block": 1, "week": 1, "idx": 0, "ex": {"pulldown": [{"w": "70", "r": "12"}]}}}
        await fresh(page, wk, {"cycle": {"idx": 0, "since": iso(3), "hist": []}})
        await page.click('[data-step="legpress:0:w:1"]'); await page.wait_for_timeout(100)
        c1 = json.loads(await page.evaluate("localStorage.getItem('upg3:cycle')"))
        check(c1["idx"] == 0, f"stepper does not advance the cycle: {c1['idx']}")
        await tap(page, '[data-done="legpress:0"]')
        c2 = json.loads(await page.evaluate("localStorage.getItem('upg3:cycle')"))
        check(c2["idx"] == 1 and c2["hist"][-1]["why"] == "auto", f"first set of the new week advances the cycle: {c2['idx']}")
        await tap(page, '.ex[data-ex="legpress"] .ex-tap', 150); await tap(page, '.ex[data-ex="legpress"] .sets-sum', 150)
        await tap(page, '[data-done="legpress:0"]')
        c3 = json.loads(await page.evaluate("localStorage.getItem('upg3:cycle')"))
        check(c3 == {"idx": 0, "since": iso(3), "hist": []}, f"un-logging that set rolls the auto advance back, «since» restored exactly: {c3}")

        # 4. ввод повторов: вес из строки сохраняется; после потери фокуса подход выглядит записанным и снимается одним ✓
        await fresh(page, past_log({"legpress": LP}))
        await page.fill('input[data-log="legpress"][data-i="0"][data-f="r"]', "9")
        await page.evaluate("window.Store.applyRemote({goals: {}})")  # синхронизация во время ввода
        await page.locator("h2").first.click(); await page.wait_for_timeout(250)
        check((await sets(page, "legpress"))[:1] == [{"w": "41,25", "r": "9"}], f"typing reps keeps prefilled weight: {await sets(page, 'legpress')}")
        check(await page.get_attribute(".prog", "aria-valuenow") == "1" and await page.locator('.ex[data-ex="legpress"] .ex-st').inner_text() == "1/3", "after blur the typed set shows as done (1/3), progress updated")
        if await page.locator('.ex[data-ex="legpress"].lite').count(): await tap(page, '.ex[data-ex="legpress"] .ex-tap', 150)
        check("41,25×9" in await page.locator('.ex[data-ex="legpress"] .sets-sum').inner_text(), "typed set is in the done line")
        await tap(page, '.ex[data-ex="legpress"] .sets-sum', 150)
        await tap(page, '[data-done="legpress:0"]')
        check(await sets(page, "legpress") == [] and not await bar_on(page), f"typed set un-logs with one ✓ (no re-log, no timer): {await sets(page, 'legpress')}")
        # ввод повторов и сразу ✓ этой строки — подтверждение
        await page.fill('input[data-log="legpress"][data-i="0"][data-f="r"]', "10")
        await tap(page, '[data-done="legpress:0"]')
        check(len(await sets(page, "legpress")) == 1 and await focused(page) == "deadbug:0", f"typed reps + ✓ on the same row confirms and hands off: {await focused(page)}")
        # −/+ : 41,25 + шаг = 43,75; затем повторы — вес из шага
        await make_cur(page, "legpress")
        await page.click('[data-step="legpress:1:w:1"]'); await page.wait_for_timeout(80)
        check(await val(page, "legpress", 1, "w") == "43,75", f"41,25 + step = 43,75: {await val(page, 'legpress', 1, 'w')}")
        await page.fill('input[data-log="legpress"][data-i="1"][data-f="r"]', "10"); await page.wait_for_timeout(100)
        s = await sets(page, "legpress")
        check(len(s) > 1 and s[1] == {"w": "43,75", "r": "10"}, f"stepped weight + typed reps stored together: {s[1:2]}")

        # 5. границы −/+, первый вес, удержание и залипание флага удержания
        await fresh(page)
        await page.click('[data-step="legpress:0:w:1"]'); await page.wait_for_timeout(60)
        check(await val(page, "legpress", 0, "w") == "20", f"first + on empty weight → 20: {await val(page, 'legpress', 0, 'w')}")
        await page.fill('input[data-log="legpress"][data-i="0"][data-f="w"]', "1")
        await page.click('[data-step="legpress:0:w:-1"]'); await page.wait_for_timeout(60)
        check(await val(page, "legpress", 0, "w") == "", f"weight − stops at 0 and shows empty: '{await val(page, 'legpress', 0, 'w')}'")
        for _ in range(15): await page.click('[data-step="legpress:0:r:-1"]')
        check(await val(page, "legpress", 0, "r") == "1", f"reps − stops at 1: {await val(page, 'legpress', 0, 'r')}")
        await page.fill('input[data-log="legpress"][data-i="0"][data-f="w"]', "20")
        bx = await page.locator('[data-step="legpress:0:w:1"]').bounding_box()
        await page.mouse.move(bx["x"] + 10, bx["y"] + 10); await page.mouse.down(); await page.wait_for_timeout(1600)
        await page.mouse.move(bx["x"] + 10, bx["y"] - 120); await page.mouse.up(); await page.wait_for_timeout(500)  # отпустил мимо кнопки
        held = float((await val(page, "legpress", 0, "w")).replace(",", "."))
        check(held >= 35, f"holding + auto-repeats: 20 → {held}")
        await page.click('[data-step="legpress:0:w:1"]'); await page.wait_for_timeout(60)
        after = float((await val(page, "legpress", 0, "w")).replace(",", "."))
        check(after == held + 2.5, f"after a hold released off the button the next tap still steps: {held} → {after}")
        await page.evaluate("""() => { const t = document.querySelector('[data-step="legpress:0:w:-1"]');
            t.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true})); return new Promise(r => setTimeout(() => { t.dispatchEvent(new PointerEvent('pointercancel', {bubbles: true})); r(); }, 700)); }""")
        await page.wait_for_timeout(450); v1 = await val(page, "legpress", 0, "w")
        await page.click('[data-step="legpress:0:w:-1"]'); await page.wait_for_timeout(60)
        check(await val(page, "legpress", 0, "w") != v1, f"pointercancel (scroll) does not leave the next tap swallowed: {v1} → {await val(page, 'legpress', 0, 'w')}")
        await page.fill('input[data-log="legpress"][data-i="0"][data-f="r"]', "15+4+3")
        v2 = await page.evaluate("""() => { document.querySelector('[data-step="legpress:0:r:1"]').click();  // click() не уводит фокус из поля
            return document.querySelector('input[data-log="legpress"][data-i="0"][data-f="r"]').value; }""")
        check(v2 == "15+4+3", f"non-numeric reps untouched by steppers: {v2}")

        # 6. первая запись: вес у жима спрашивается один раз за день; у упражнений без веса — никогда
        await fresh(page)
        check(await page.get_attribute('input[data-log="deadbug"][data-i="0"][data-f="w"]', "placeholder") == "доп. кг" and (await page.get_attribute('input[data-log="deadbug"][data-i="0"][data-f="w"]', "aria-label")).startswith("Доп. вес"), "bodyweight item: weight is optional («доп. кг», «Доп. вес»)")
        await tap(page, '[data-done="legpress:0"]')
        check(await page.evaluate("document.activeElement.dataset.f") == "w" and not await sets(page, "legpress"), "first-ever weighted lift: ✓ with empty kg asks for weight first")
        await tap(page, '[data-done="legpress:0"]'); await tap(page, '[data-done="deadbug:0"]')
        check(len(await sets(page, "deadbug")) == 1, f"bodyweight ✓ saves without asking for weight: {await sets(page, 'deadbug')}")
        await tap(page, '[data-done="legpress:1"]')
        check(len(await sets(page, "legpress")) == 2, f"weight asked once per exercise per day: {await sets(page, 'legpress')}")
        await fresh(page, past_log({"deadbug": [{"w": "", "r": "6"}] * 3}))
        await make_cur(page, "deadbug")
        hint = " ".join(await page.locator('.ex[data-ex="deadbug"] .hint').all_inner_texts())
        check(hint and "добавь вес" not in hint, f"no add-weight hint for bodyweight: {hint}")
        await fresh(page, None, {"time": 120}, day="B")
        fh = 'input[data-log="farmer_hold"][data-i="0"][data-f="w"]'
        await tap(page, '.ex[data-ex="farmer_hold"] .ex-tap', 150)
        head = await page.inner_text('.ex[data-ex="farmer_hold"] .log-head')
        # подпись над полями — «Вес, кг» (основной вес, не «Доп. вес»); плейсхолдер под подписью пустой, чтобы не дублировать её
        check("Вес, кг" in head and "Доп." not in head and await page.get_attribute(fh, "placeholder") == "", f"loaded hold (farmer, dumbbells): main weight label «Вес, кг», no duplicate placeholder: {head!r}")
        await page.click('[data-step="farmer_hold:0:w:1"]')
        check(await page.input_value(fh) == "20", f"loaded hold: first + → 20: {await page.input_value(fh)}")
        # майо: подставляется цель — первое число, а не прошлая запись целиком
        await fresh(page, past_log({"hammer_curl": [{"w": "14", "r": "15+4+3"}] * 2}, 7), {"cycle": {"idx": 10, "since": iso(1), "hist": []}})
        await tap(page, '.ex[data-ex="hammer_curl"] .ex-tap', 150)
        check(await val(page, "hammer_curl", 0, "r") == "15", f"myo prefill = first number only: {await val(page, 'hammer_curl', 0, 'r')}")

        # 7. запас: в свёрнутой строке законченного упражнения; после последнего подхода — сначала запас, потом итог
        await fresh(page, past_log({"legpress": LP}))
        for i in range(3):
            if i == 2: check(await page.locator('.ex[data-ex="legpress"] [data-rir]').count() == 0, "no RIR row before the last set")
            await tap(page, f'[data-done="legpress:{i}"]'); await tap(page, f'[data-done="deadbug:{i}"]')
        ask = page.locator('.ex[data-ex="legpress"] .rir-ask [data-rir="legpress:1"]')
        check(await ask.is_visible(), "finished card shows «Запас» chips while collapsed")
        await page.screenshot(path=f"{SH}/wp1r2_superset.png")
        hs = await page.evaluate("[...document.querySelectorAll('.rir-ask [data-rir]')].map(e => Math.round(e.getBoundingClientRect().height))")
        check(hs and min(hs) >= 44, f"RIR chips ≥44 px: {set(hs)}")
        await ask.click(); await page.wait_for_timeout(200)
        e = await entry(page)
        check(e.get("rir", {}).get("legpress") == "1" and "запас 1" in await page.locator('.ex[data-ex="legpress"] .ex-sum').inner_text(), f"RIR stored and folded into summary: {e.get('rir')}")
        check(await page.locator('.ex[data-ex="legpress"] .rir-ask').count() == 0 and await focused(page) != "BODY", f"RIR prompt gone, focus not lost: {await focused(page)}")
        check("41,25×11" in await page.locator('.ex[data-ex="legpress"] .ex-sum').inner_text(), "done summary keeps 2 decimals")
        # запас снимается, когда упражнение снова не закончено
        await tap(page, '.ex[data-ex="legpress"] .ex-tap', 150)
        await tap(page, '[data-done="legpress:2"]')
        check("legpress" not in (await entry(page)).get("rir", {}), f"RIR removed when the exercise is un-finished: {(await entry(page)).get('rir')}")
        # последний подход тренировки (на 60 мин): сначала запас, итог после ответа
        await fresh(page, past_log({"legpress": LP}), {"time": 60})
        n = 0
        while n < 60:
            nb = await page.evaluate("(() => { const b = document.querySelector('.ex.cur .log-row.next .set-ok') || document.querySelector('.log-row.next .set-ok'); return b ? b.dataset.done : null; })()")
            if not nb: break
            if await page.locator('[data-needw]').count(): await page.fill(f'input[data-log="{nb.split(":")[0]}"][data-i="{nb.split(":")[1]}"][data-f="w"]', "10")
            await tap(page, f'[data-done="{nb}"]'); n += 1
            rr = page.locator('.rir-ask [data-rir$=":2"]')
            if await rr.count() and await page.evaluate("document.querySelectorAll('.log-row.next').length") > 0: await rr.first.click(); await page.wait_for_timeout(120)
        last = await page.evaluate("""() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { rir: a.dataset.rir || '', inView: r.top > 60 && r.bottom < innerHeight - 62 }; }""")
        check(last["rir"] and last["inView"], f"after the session's last ✓: the RIR chips are focused and in view: {last}")
        await page.screenshot(path=f"{SH}/wp1r2_last_rir.png")
        await page.locator('.rir-ask [data-rir$=":1"]').first.click(); await page.wait_for_timeout(700)
        chk = await page.evaluate("""() => { const h = document.querySelector('#checkin h3'), r = h.getBoundingClientRect(); return { focus: document.activeElement === h, top: Math.round(r.top) }; }""")
        check(chk["focus"] and 40 < chk["top"] < 300, f"after answering RIR → «Итог тренировки» in view and focused: {chk}")

        # 8. диапазон сегодня: прошлые 8 повторов не подставляются ниже 10–12
        await fresh(page, past_log({"legpress": [{"w": "100", "r": "8"}] * 3}))
        check(await val(page, "legpress", 0, "r") == "10", f"reps prefill clamped to today's range: {await val(page, 'legpress', 0, 'r')}")

        # 9. выбранный день переживает перезагрузку и синхронизацию; dayPick — только на устройстве
        await fresh(page)
        await page.click('button[data-day="B"]'); await page.wait_for_timeout(100)
        await page.reload(); await page.wait_for_timeout(400)
        check(await page.locator('.day-seg button.on').get_attribute("data-day") == "B", "manual day survives reload")
        await page.evaluate("window.Store.applyRemote({logs: JSON.parse(localStorage.getItem('upg3:logs') || '{}'), cycle: {idx:0, since:null, hist:[]}})"); await page.wait_for_timeout(150)
        check(await page.locator('.day-seg button.on').get_attribute("data-day") == "B", "sync does not flip the day")
        sync_src = (ROOT / "src" / "sync.js").read_text(); app_src = (ROOT / "src" / "app.js").read_text()
        spec = re.findall(r"^\s{4}(\w+): \{ kind:", sync_src.split("const SPEC = {")[1].split("};")[0], re.M)
        exp = re.search(r'const data = \{ app: "upgrade-v3".*?\};', app_src).group(0)
        imp = app_src.split("if (d.import && t.files")[1].split("readAsText")[0]
        check(spec and "dayPick" not in spec and "logs" in spec, f"dayPick not in sync SPEC {spec}")
        check("dayPick" not in exp and "dayPick" not in imp, "dayPick not in backup export/import (local convenience only)")

        # 10. смена даты при открытой странице: ✓ со вчерашнего экрана не пишет в новую дату; возврат — перерисовка
        await fresh(page, past_log({"legpress": LP}))
        # часы страницы +7 дней (Date подменён обёрткой со сдвигом)
        await page.evaluate("window.__off += 7 * 864e5")  # часы страницы ушли на неделю вперёд, экран — старый
        new_day = (D + datetime.timedelta(days=7)).isoformat()
        await tap(page, '[data-done="legpress:0"]')
        lg = await logs(page)
        check(not any(k.startswith(new_day) for k in lg) and KEY not in lg, f"stale-screen ✓ after midnight stores nothing, re-renders instead: {list(lg)}")
        await page.evaluate("document.querySelector('.th h2').dataset.mark = '1'; window.__off += 864e5")
        await page.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await page.wait_for_timeout(150)
        check(await page.evaluate("!document.querySelector('.th h2').dataset.mark"), "visibilitychange on a new date re-renders")
        await page.reload(); await page.wait_for_timeout(300)

        # 11. связка без прыжков: полный круг суперсета A — карточки не сдвигаются на экране ни на пиксель,
        # даже если над ними после первого ✓ пропадает баннер (день отдыха в воскресенье, «неделя закрыта»)
        cases = [("Mon, planned A day", MONDAY, past_log({"legpress": LP, "deadbug": [{"w": "", "r": "6"}] * 3}), None, None),
                 ("Sun, rest day", datetime.date(2026, 11, 15), past_log({"legpress": LP, "deadbug": [{"w": "", "r": "6"}] * 3}), None, "по плану отдых"),
                 ("Sat, week closed", datetime.date(2026, 11, 21), None, None, "закрыта")]
        for label, d, lg0, extra, banner in cases:
            set_date(d)
            if label.startswith("Sat"):
                lg0 = {f"{iso(2)}_A": {"day": "A", "block": 1, "week": 1, "idx": 0, "ex": {"legpress": LP, "deadbug": [{"w": "", "r": "6"}] * 3}},
                       f"{iso(1)}_B": {"day": "B", "block": 1, "week": 1, "idx": 0, "ex": {"pulldown": [{"w": "70", "r": "12"}]}}}
                extra = {"cycle": {"idx": 0, "since": None, "hist": []}}
            await fresh(page, lg0, extra)
            txt0 = await page.inner_text("#app")
            if banner: check(banner.lower() in txt0.lower(), f"{label}: banner «{banner}» is shown before the first ✓")
            await page.evaluate("document.querySelector('.ex.cur').scrollIntoView({block: 'start'})"); await page.wait_for_timeout(100)
            shifts, ys = [], []
            for i in range(3):
                for ex in ("legpress", "deadbug"):
                    t0 = await page.evaluate("Math.round(document.querySelector('.ex[data-ex=\"legpress\"]').getBoundingClientRect().top)"); y0 = await page.evaluate("scrollY")
                    await tap(page, f'[data-done="{ex}:{i}"]', 900)
                    shifts.append(await page.evaluate("Math.round(document.querySelector('.ex[data-ex=\"legpress\"]').getBoundingClientRect().top)") - t0)
                    ys.append(round(await page.evaluate("scrollY") - y0))
            if banner: check(banner.lower() not in (await page.inner_text("#app")).lower(), f"{label}: banner gone after the first set")
            check(all(x == 0 for x in shifts[:-1]), f"{label}: alternating ✓ never moves the cards on screen (last ✓ goes to group B): {shifts} | scrollY Δ {ys}")
            if label.startswith("Sun"): await page.screenshot(path=f"{SH}/wp1r2_sunday.png")
        set_date(MONDAY)

        # 12. цели касания ≥ 44 px
        await fresh(page, past_log({"legpress": LP}))
        await page.evaluate("localStorage.setItem('upg3:loginHintHidden', 'false')"); await page.reload(); await page.wait_for_timeout(350)  # плашка «Войти» тоже меряется
        await page.click('#timerBtn'); await page.wait_for_timeout(100)
        await page.click('#tPanel [data-t="60"]'); await page.wait_for_timeout(100)
        hs = await page.evaluate("""() => { const q = (s) => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().height));
            return { day: q('.day-seg button'), edit: q('[data-planedit]'), ctl: q('[data-ctl]'), tools: q('.ex.cur .ex-tools .lnk'), ok: q('.set-ok'), step: q('.stp-b'),
                     panel: q('#tPanel .btn'), bar: q('#tBar button'), log: q('.log-row input'), joints: q('.checkin .chip.jt'), how: q('details.how summary'), login: q('.banner .btn') }; }""")
        small = {k: v for k, v in hs.items() if not v or min(v) < 44}
        check(not small, f"tap targets ≥44 px: {small or 'all'}")
        await page.click('#tBar [data-stop]'); await page.wait_for_timeout(100)

        # 13. день отдыха + своя версия тренировки: первый ✓ виден без прокрутки, плановых пометок на «Сегодня» нет
        set_date(datetime.date(2026, 11, 15))
        await fresh(page)
        await page.evaluate("(() => { const PM = window.__UPG.PM; PM.add('1A', 'face_pull', {}, 1); PM.setParams('1A', 1, 0, '', { sets: 4 }); })()")
        await page.reload(); await page.wait_for_timeout(350)
        r = await page.evaluate("(() => ({ ok: Math.round(document.querySelector('.set-ok').getBoundingClientRect().top), rest: !!Array.from(document.querySelectorAll('.banner')).find(b => /отдых/.test(b.textContent)), tags: Array.from(document.querySelectorAll('.ex .tag')).map(t => t.textContent), note: !!document.querySelector('.mine-note') }))()")
        check(r["rest"] and r["note"] and r["ok"] <= 480, f"rest day + customised workout: first ✓ at y={r['ok']} (≤ 480)")
        check(not {"добавлено", "изменено"} & set(r["tags"]), f"no plan-diff tags on Today: {sorted(set(r['tags']))}")
        set_date(MONDAY)
        # 13б. короткие баннеры не обрезаются: в одну строку при 360 и 375 px, без многоточия (самые длинные значения)
        BAN = """() => [...document.querySelectorAll('#app .banner')].filter(b => b.getClientRects().length).map(b => { const cs = getComputedStyle(b), lh = parseFloat(cs.lineHeight) || 18;
            const lines = Math.round((b.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth)) / lh);
            return { t: b.textContent.trim().slice(0, 50), one: b.classList.contains('one'), clip: b.scrollWidth > b.clientWidth + 1 || cs.textOverflow === 'ellipsis', lines }; })"""
        longest = {"2026-11-19_A": {"day": "A", "block": 3, "week": 4, "idx": 13, "ex": {"bss": [{"w": "20", "r": "10"}]}},
                   "2026-11-20_B": {"day": "B", "block": 3, "week": 4, "idx": 13, "ex": {"pulldown": [{"w": "70", "r": "12"}]}}}
        for w in (360, 375):
            await page.set_viewport_size({"width": w, "height": 812})
            for label, d, lg0, extra in (("rest day", datetime.date(2026, 11, 15), None, None),
                                         ("week 14 closed", datetime.date(2026, 11, 21), longest, {"cycle": {"idx": 13, "since": None, "hist": []}})):
                set_date(d); await fresh(page, lg0, extra)
                bs = await page.evaluate(BAN)
                ones = [x for x in bs if x["one"]]
                check(ones and not any(x["clip"] for x in bs) and all(x["lines"] == 1 for x in ones), f"{w}px {label}: banners not truncated, one-liners fit one line: {bs}")
        await page.set_viewport_size({"width": 375, "height": 812})
        set_date(MONDAY)
        # 14. после последнего ✓ тренировки таймер отдыха не продолжает идти
        await fresh(page, past_log({"hammer_curl": [{"w": "14", "r": "10"}] * 2}))
        await page.evaluate("(() => { const PM = window.__UPG.PM; PM.clear('1A'); PM.add('1A', 'hammer_curl', { sets: 2, reps: '10' }, 'new'); })()")
        await page.reload(); await page.wait_for_timeout(350)
        await tap(page, '[data-done="hammer_curl:0"]')
        on1 = await bar_on(page)
        await tap(page, '[data-done="hammer_curl:1"]')
        check(on1 and not await bar_on(page), f"rest timer runs between sets and stops after the last ✓ (was on: {on1})")
        # 15. круг из трёх: после круга следующий ✓ и заголовок его карточки — над таймером
        three = {"oh_ext_partial": [{"w": "20", "r": "12"}] * 3, "hammer_curl": [{"w": "14", "r": "10"}] * 3, "lat_raise_machine": [{"w": "30", "r": "15"}] * 3}
        await fresh(page, past_log(three))
        await page.evaluate("""(() => { const PM = window.__UPG.PM; PM.clear('1A'); const p = PM.add('1A', 'oh_ext_partial', { sets: 3, reps: '10–15' }, 'new');
            PM.add('1A', 'hammer_curl', { sets: 3, reps: '10–12' }, p.gi); PM.add('1A', 'lat_raise_machine', { sets: 3, reps: '12–20' }, p.gi); })()""")
        await page.reload(); await page.wait_for_timeout(350)
        for ex in ("oh_ext_partial", "hammer_curl", "lat_raise_machine"):
            await make_cur(page, ex); await tap(page, f'[data-done="{ex}:0"]', 900)
        pos = await page.evaluate("""(() => { const nb = document.querySelector('[data-done="oh_ext_partial:1"]'), bar = document.getElementById('tBar'), top = document.querySelector('.top').getBoundingClientRect().bottom;
            const head = nb.closest('.ex').querySelector('.ex-h').getBoundingClientRect(), r = nb.getBoundingClientRect(), b = bar.hidden ? innerHeight : bar.getBoundingClientRect().top;
            return { bar: !bar.hidden, ok: r.bottom <= b, head: head.top >= top - 1 && head.bottom <= b, focus: document.activeElement === nb }; })()""")
        check(pos["bar"] and pos["ok"] and pos["head"] and pos["focus"], f"3-exercise circuit: next ✓ and its card header above the timer bar: {pos}")
        await page.click('#tBar [data-stop]'); await page.wait_for_timeout(100)
        # 16. «0» повторов — не подход: день не отмечен, неделя не закрывается
        await fresh(page, {f"{today}_A": {"day": "A", "block": 1, "week": 1, "idx": 0, "ex": {"legpress": [{"w": "40", "r": "0"}]}}})
        check(not re.search("сделана|начата", await day_mark(page, "A")) and not await page.evaluate("window.__UPG.ctxNow().done.A"), "reps «0» do not count as a set")
        # 17. записанное сегодня, но не видное в карточках: замена на сегодня и связка, скрытая режимом времени
        hidden = await page.evaluate("(() => { const g = window.PROGRAM.sessions['1A'].groups.find(g => g.items && g.tier && g.tier !== 'core' && ['pair','tri','single'].includes(g.kind)); return g ? g.items[0].ex : ''; })()")
        lg = {f"{today}_A": {"day": "A", "block": 1, "week": 1, "idx": 0, "ex": {"legpress": [{"w": "40", "r": "10"}], hidden: [{"w": "10", "r": "12"}]}}}
        await fresh(page, lg, {"daySw": {"d": today, "m": {"A|legpress": "hack"}}, "time": 60})
        if not await page.locator('button[data-time="60"]').is_visible(): await page.click('[data-ctl]')
        await page.click('button[data-time="60"]'); await page.wait_for_timeout(200)
        orph = await page.locator(".orphans").inner_text() if await page.locator(".orphans").count() else ""
        check("Жим ногами — 40×10" in orph and "заменено на сегодня" in orph, "orphan card: today-swap is labelled as swapped, not removed: " + orph.replace("\n", " | "))
        check(bool(hidden) and "скрыта в режиме 60 мин" in orph, f"orphan card: logged exercise of a tier hidden in 60 min ({hidden}) is shown")

        hov = await page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
        check(not hov, "no horizontal overflow")
        print("errors:", errs)
        check(not errs, "no console errors")
        print(f"\n{len(OK)} ok, {len(FAIL)} failed")
        await b.close()
asyncio.run(main())
