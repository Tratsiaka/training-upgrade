import asyncio, json, sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from seed import make
from playwright.async_api import async_playwright

APP = "http://localhost:8765/"
SH = str(__import__("pathlib").Path(__file__).resolve().parents[1] / "shots")
ADJ = {
    "format": "upgrade.adjust.v1", "title": "Больше трицепса, щадим локоть", "reason": "Трицепс отстаёт от плана.",
    "cycle": "deload_now",
    "changes": [
        {"exercise": "oh_ext_partial", "session": "*", "sets": 4, "reps": "12–15", "why": "Объём трицепса ниже плана."},
        {"exercise": "face_pull", "replace_with": "rev_pecdeck", "why": "Локти."},
        {"exercise": "bench", "session": "A", "note": "Пауза 1 с на груди", "why": "Контроль нижней точки."},
    ],
}

async def main():
    logs, meas, cycle = make()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True, service_workers="block", permissions=["clipboard-read", "clipboard-write"])
        await ctx.add_init_script("try{localStorage.setItem('upg3:noLogin','true')}catch(e){}")  # без экрана входа
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        await page.goto(APP + "?tab=settings"); await page.wait_for_timeout(200)
        await page.evaluate("([l, m, c]) => { localStorage.setItem('upg3:logs', JSON.stringify(l)); localStorage.setItem('upg3:meas', JSON.stringify(m)); localStorage.setItem('upg3:cycle', JSON.stringify(c)); }", [logs, meas, cycle])
        await page.goto(APP + "?tab=settings"); await page.wait_for_timeout(400)

        # export file
        async with page.expect_download() as dl:
            await page.click('[data-agentexport="file"]')
        d = await dl.value; data = json.load(open(await d.path()))
        print("export format:", data["format"], "| keys:", list(data.keys()))
        print("  log sessions:", len(data["log"]), "| weekly:", len(data["weekly_summary"]), "| measurements:", len(data["measurements"]), "| exercises:", len(data["program"]["exercises"]), "| sessions:", list(data["program"]["sessions"].keys())[:4])
        print("  position:", data["program"]["position"], "| days:", data["athlete"]["settings"]["training_days"])
        print("  first log:", json.dumps(data["log"][0], ensure_ascii=False)[:260])
        print("  weekly[0]:", json.dumps(data["weekly_summary"][0], ensure_ascii=False)[:200])
        print("  context notes chars:", len(data["athlete"]["context_notes"]), "| msg:", await page.locator("#agentMsg").inner_text())
        # copy for chat
        await page.click('[data-agentexport="copy"]'); await page.wait_for_timeout(300)
        clip = await page.evaluate("navigator.clipboard.readText()")
        print("clipboard starts:", clip[:40].replace("\n", " "), "| has json block:", "```json" in clip, "| msg:", await page.locator("#agentMsg").inner_text())

        # bad JSON
        await page.fill("#adjIn", "{oops"); await page.click("[data-adjcheck]"); await page.wait_for_timeout(100)
        print("bad json →", await page.locator("#adjPreview").inner_text())
        # good JSON wrapped in agent prose
        await page.fill("#adjIn", "Вот корректировки:\n```json\n" + json.dumps(ADJ, ensure_ascii=False) + "\n```")
        await page.click("[data-adjcheck]"); await page.wait_for_timeout(100)
        prev = await page.locator("#adjPreview").inner_text()
        print("preview:\n ", prev.replace("\n", "\n  ")[:900])
        await page.screenshot(path=f"{SH}/adj_preview.png", full_page=False)
        await page.click("[data-adjapply]"); await page.wait_for_timeout(200)
        print("active list:", (await page.locator(".adj-list").inner_text()).replace("\n", " | "))
        # Today A shows corrections (block 2 week 2 per seed cycle idx 6)
        await page.goto(APP + "?tab=today"); await page.wait_for_timeout(300)
        await page.click('button[data-day="A"]'); await page.wait_for_timeout(100)
        exs = page.locator(".ex").filter(has=page.locator(".tag.adj"))
        n = await exs.count()
        print("exercises with correction tag:", n)
        for i in range(n):
            print("   ", (await exs.nth(i).locator(".ex-name").inner_text()), "|", await exs.nth(i).locator(".scheme").inner_text(), "|", (await exs.nth(i).locator(".adj-why").all_inner_texts())[:1])
        # toggle off
        await page.goto(APP + "?tab=settings"); await page.wait_for_timeout(200)
        await page.uncheck("[data-adjtoggle]"); await page.wait_for_timeout(100)
        await page.goto(APP + "?tab=today"); await page.wait_for_timeout(200)
        await page.click('button[data-day="A"]'); await page.wait_for_timeout(100)
        print("after toggle off, tags:", await page.locator(".tag.adj").count())
        # cycle suggestion button from preview
        await page.goto(APP + "?tab=settings"); await page.wait_for_timeout(200)
        await page.fill("#adjIn", json.dumps({"format": "upgrade.adjust.v1", "title": "Разгрузка", "cycle": "deload_now", "changes": []}))
        await page.click("[data-adjcheck]"); await page.wait_for_timeout(100)
        await page.click("[data-adjcycle]"); await page.wait_for_timeout(100)
        print("cycle after agent deload:", json.loads(await page.evaluate("localStorage.getItem('upg3:cycle')"))["idx"])
        # delete (two taps)
        await page.goto(APP + "?tab=settings"); await page.wait_for_timeout(200)
        await page.click("[data-adjdel]"); await page.click("[data-adjdel]"); await page.wait_for_timeout(100)
        print("after delete:", await page.locator(".adj-list").inner_text())
        print("errors:", errs)
        await b.close()

asyncio.run(main())
