"""v3.2 core: sweep all weeks/days/modes, session-based weeks, cycle controls, days, RIR, check-in, hints."""
import asyncio, re, json, datetime
from playwright.async_api import async_playwright

APP = "http://localhost:8765/"
SH = str(__import__("pathlib").Path(__file__).resolve().parents[1] / "shots")
bad = re.compile(r"undefined|NaN|null|\{\{|\{[a-z0-9]+\}|\[object")
today = datetime.date.today()
iso = lambda d: d.isoformat()


async def open_ctl(page):
    """Время и самочувствие на «Сегодня» спрятаны за строкой «90 мин · Норм ▾» — раскрыть, если свёрнуты."""
    if not await page.locator('button[data-time="90"]').is_visible():
        await page.click('[data-ctl]'); await page.wait_for_timeout(60)


async def to_hub(page):
    """Хаб «Программы»: нижнее меню, повторное касание «Программы» — к корню вкладки."""
    for _ in range(3):
        if await page.locator('.sess-list').count(): return
        await page.click('.nav-i[data-tab="plan"]'); await page.wait_for_timeout(80)


async def open_sched(page):
    await to_hub(page); await page.click('[data-pv="sched"]'); await page.wait_for_timeout(80)
    if not await page.locator('select[data-cycgo]').is_visible():  # редкие действия цикла — под «Ещё действия»
        await page.click('#cycle .cyc-more summary'); await page.wait_for_timeout(60)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
        await ctx.add_init_script("try{localStorage.setItem('upg3:noLogin','true')}catch(e){}")  # без экрана входа
        page = await ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)

        # 1) sweep: every week via the cycle selector × days × time × readiness
        await page.goto(APP + "?tab=plan"); await page.wait_for_timeout(400)
        problems = []
        for wk in ["1", "2", "5", "6", "9", "10", "11", "15"]:
            await open_sched(page)
            await page.select_option('select[data-cycgo]', wk); await page.wait_for_timeout(60)
            await page.click('.nav-i[data-tab="today"]'); await page.wait_for_timeout(60)
            await open_ctl(page)
            for d in "ABC":
                for t in ["60", "90", "120"]:
                    for rd in ["ok", "low"]:
                        await page.click(f'button[data-day="{d}"]'); await page.click(f'button[data-time="{t}"]'); await page.click(f'button[data-ready="{rd}"]')
                        txt = await page.locator("#app").inner_text()
                        m = bad.findall(txt)
                        if m: problems.append((wk, d, t, rd, m[:3]))
        await page.click('button[data-ready="ok"]')
        for tab in ["plan", "library", "journal", "more"]:
            await page.click(f'.nav-i[data-tab="{tab}"]'); await page.wait_for_timeout(500 if tab == "library" else 100)
            m = bad.findall(await page.locator("#app").inner_text())
            if m: problems.append((tab, m[:5]))
            if tab == "plan":
                for sub in ["sched", "about", "progs"]:
                    await to_hub(page); await page.click(f'[data-pv="{sub}"]'); await page.wait_for_timeout(80)
                    m = bad.findall(await page.locator("#app").inner_text() + await page.locator("#title").inner_text())
                    if m: problems.append(("plan", sub, m[:5]))
                visited = []
                for blk in ["1", "2", "3"]:
                    for dd in ["A", "B", "C"]:
                        await to_hub(page); await page.click(f'[data-pb="{blk}"]'); await page.click(f'[data-pd="{dd}"]'); await page.wait_for_timeout(60)
                        # именно экран тренировки этого блока и дня (а не хаб): адрес ?s=1A и шапка экрана тренировки
                        here = await page.evaluate("location.search")
                        if here == f"?tab=plan&s={blk}{dd}" and await page.locator(".psess-h").count(): visited.append(blk + dd)
                        m = bad.findall(await page.locator("#app").inner_text() + await page.locator("#title").inner_text())
                        if m: problems.append(("plan", blk, dd, m[:5]))
                print("workout screens checked:", len(visited), visited)
                if len(visited) != 9: problems.append(("plan: not every workout screen was opened", visited))
                await to_hub(page)
        for tab in ["cardio", "body", "food", "science", "settings"]:
            await page.click(f'.menu-i[data-tab="{tab}"]'); await page.wait_for_timeout(80)
            m = bad.findall(await page.locator("#app").inner_text())
            if m: problems.append((tab, m[:5]))
            await page.click("#back")
        print("sweep problems:", problems)

        # 2) session-based weeks: fresh state, A two days ago + B yesterday → next A opens week 2
        await page.evaluate("localStorage.clear()")
        d2, d1 = iso(today - datetime.timedelta(days=2)), iso(today - datetime.timedelta(days=1))
        logs = {f"{d2}_A": {"day": "A", "block": 1, "week": 1, "idx": 0, "ready": "ok", "time": 90, "ex": {"bench": [{"w": "100", "r": "8"}, {"w": "100", "r": "8"}, {"w": "100", "r": "8"}]}},
                f"{d1}_B": {"day": "B", "block": 1, "week": 1, "idx": 0, "ready": "low", "time": 90, "ex": {"pulldown": [{"w": "70", "r": "12"}]}, "s": {"joints": {"knee": 2}}}}
        await page.evaluate("(l) => { localStorage.setItem('upg3:logs', JSON.stringify(l)); localStorage.setItem('upg3:cycle', JSON.stringify({idx:0, since:null, hist:[]})); }", logs)
        await page.goto(APP + "?tab=today"); await page.wait_for_timeout(400)
        txt = await page.locator("#app").inner_text()
        print("suggested day:", await page.locator('.day-seg button.on[data-day]').inner_text(), "| next-week banner:", "закрыта" in txt, "| sub:", " ".join((await page.locator(".hero-sub").inner_text()).replace("\xa0", " ").split()))
        await page.click('button[data-day="C"]'); await page.wait_for_timeout(80)
        print("C stays in week 1:", "неделя 1 из" in (" ".join((await page.locator(".hero-sub").inner_text()).replace("\xa0", " ").split())))  # строка героя: «Апгрейд · блок 1 · неделя 1 из 5»
        await page.click('button[data-day="A"]'); await page.wait_for_timeout(80)
        if not await page.locator('input[data-log][data-f="w"]').first.is_visible():
            await page.locator('button[data-toggle="log"]').first.click()
        await page.locator('input[data-log][data-f="w"]').first.fill("120")
        await page.locator('input[data-log][data-f="r"]').first.fill("10"); await page.wait_for_timeout(200)  # подход = вес + повторы
        cyc = json.loads(await page.evaluate("localStorage.getItem('upg3:cycle')"))
        print("after first set of new week → cycle:", {k: cyc[k] for k in ("idx", "since")}, "| hist:", cyc["hist"][-1])
        await page.reload(); await page.wait_for_timeout(300)
        print("after reload: day", await page.locator('.day-seg button.on[data-day]').inner_text().__await__() if False else await page.locator('.day-seg button.on[data-day]').inner_text(), "| sub:", " ".join((await page.locator(".hero-sub").inner_text()).replace("\xa0", " ").split()), "| banner gone:", "закрыта" not in await page.locator("#app").inner_text())

        # 3) cycle controls + undo
        await open_sched(page); await page.wait_for_timeout(40)
        await page.screenshot(path=f"{SH}/v32_plan.png", full_page=False)
        await page.click('button[data-cyc="deload"]'); await page.wait_for_timeout(100)
        cyc = json.loads(await page.evaluate("localStorage.getItem('upg3:cycle')"))
        print("deload now → idx", cyc["idx"], "| undo banner:", await page.locator('[data-undo]').count())
        await page.click('[data-undo]'); await page.wait_for_timeout(100)
        print("undo → idx", json.loads(await page.evaluate("localStorage.getItem('upg3:cycle')"))["idx"])
        await page.click('button[data-cyc="nextblock"]'); await page.wait_for_timeout(100)
        print("next block → idx", json.loads(await page.evaluate("localStorage.getItem('upg3:cycle')"))["idx"], "| now:", await page.evaluate("(() => { const c = window.__UPG.ctxNow(); return `блок ${c.block} · неделя ${c.week} из 5`; })()"))  # подзаголовка в шапке больше нет
        await page.select_option('select[data-cycgo]', "2"); await page.wait_for_timeout(100)

        # 4) days: Ср (3) → max 3 message; remove Сб; add Чт
        await page.click('button[data-wday="3"]'); await page.wait_for_timeout(80)
        print("4th day message:", await page.locator("#wdayMsg").inner_text())
        await page.click('button[data-wday="6"]'); await page.wait_for_timeout(80)
        await page.click('button[data-wday="4"]'); await page.wait_for_timeout(80)
        print("days now:", json.loads(await page.evaluate("localStorage.getItem('upg3:settings')"))["days"], "| grid:", (await page.locator(".week-grid").inner_text()).replace("\n", " "))
        await page.click('.nav-i[data-tab="today"]'); await page.wait_for_timeout(80)
        print("day buttons:", (await page.locator('.day-seg').first.inner_text()).replace("\n", " "))

        # 5) RIR chip, joints, note, hint
        await page.click('button[data-day="A"]'); await page.wait_for_timeout(80)
        first_ex = page.locator(".ex").filter(has=page.locator('button[data-toggle="log"]')).first
        # запас спрашивается, когда упражнение закончено: добить подходы ✓ (между касаниями > 500 мс)
        for _ in range(10):
            if await first_ex.locator('.rir-ask [data-rir$=":1"]').count(): break
            await first_ex.locator('.set-ok[aria-pressed="false"]').first.click(); await page.wait_for_timeout(650)
        await first_ex.locator('.rir-ask [data-rir$=":1"]').click(); await page.wait_for_timeout(80)
        await page.locator('[data-joint="elbow"]').click(); await page.locator('[data-joint="elbow"]').click()
        await page.locator('[data-joint="back"]').click()
        await page.fill('textarea[data-note]', "сон 6 часов"); await page.wait_for_timeout(600)
        e = json.loads(await page.evaluate("localStorage.getItem('upg3:logs')"))[f"{iso(today)}_A"]
        print("entry rir:", e.get("rir"), "| joints:", e.get("s", {}).get("joints"), "| note:", e.get("s", {}).get("note"), "| ready/time:", e.get("ready"), e.get("time"))
        await open_ctl(page)
        await page.click('button[data-ready="low"]'); await page.wait_for_timeout(80)
        print("ready persisted:", json.loads(await page.evaluate("localStorage.getItem('upg3:logs')"))[f"{iso(today)}_A"]["ready"])
        await page.click('button[data-ready="ok"]')
        # hint from previous top-of-range bench (3x8 at 100, range 6–8 heavy / 8–12 light)
        hints = await page.locator(".hint").all_inner_texts()
        print("hints:", hints[:3])
        await page.screenshot(path=f"{SH}/v32_today.png", full_page=True)

        # 6) fatigue banner: two low sessions in last three
        await page.evaluate("""() => { const l = JSON.parse(localStorage.getItem('upg3:logs')); Object.values(l).forEach((e) => { e.ready = 'low'; }); localStorage.setItem('upg3:logs', JSON.stringify(l)); }""")
        await page.goto(APP + "?tab=today"); await page.wait_for_timeout(300)
        txt = await page.locator("#app").inner_text()
        print("fatigue banner:", "накопленную усталость" in txt)
        await page.click('[data-fatigueskip]'); await page.wait_for_timeout(80)
        print("fatigue dismissed:", "накопленную усталость" not in await page.locator("#app").inner_text())
        print("errors:", errs)
        await b.close()

asyncio.run(main())
