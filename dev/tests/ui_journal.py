import asyncio, json, sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from seed import make
from playwright.async_api import async_playwright

APP = "http://localhost:8765/"
SH = str(__import__("pathlib").Path(__file__).resolve().parents[1] / "shots")

async def main():
    logs, meas, cycle = make()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for scheme in ["light", "dark"]:
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme=scheme, service_workers="block")
            await ctx.add_init_script("try{localStorage.setItem('upg3:noLogin','true')}catch(e){}")  # без экрана входа
            page = await ctx.new_page(); errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            await page.goto(APP + "?tab=journal"); await page.wait_for_timeout(200)
            await page.evaluate("([l, m, c]) => { localStorage.setItem('upg3:logs', JSON.stringify(l)); localStorage.setItem('upg3:meas', JSON.stringify(m)); localStorage.setItem('upg3:cycle', JSON.stringify(c)); }", [logs, meas, cycle])
            await page.goto(APP + "?tab=journal"); await page.wait_for_timeout(400)
            print(scheme, "stats:", (await page.locator(".stats").inner_text()).replace("\n", " "))
            await page.screenshot(path=f"{SH}/j_progress_{scheme}.png", full_page=True)
            # open bench detail chart
            await page.click('[data-jex="bench"]'); await page.wait_for_timeout(300)
            box = page.locator(".chart-box").first
            print(scheme, "chart svg:", await box.locator("svg").count(), "| points:", await box.locator("circle.dot").count())
            bb = await box.bounding_box()
            await page.mouse.move(bb["x"] + bb["width"] * 0.5, bb["y"] + bb["height"] * 0.5); await page.wait_for_timeout(150)
            print(scheme, "tooltip:", (await box.locator(".chart-tip").inner_text()).replace("\n", " | "), "| visible:", await box.locator(".chart-tip").is_visible())
            await page.screenshot(path=f"{SH}/j_bench_{scheme}.png", full_page=False, clip={"x": 0, "y": max(0, bb["y"] - 120), "width": 390, "height": 420})
            # keyboard
            await box.focus(); await page.keyboard.press("ArrowLeft"); await page.wait_for_timeout(80)
            print(scheme, "keyboard tooltip:", (await box.locator(".chart-tip").inner_text()).replace("\n", " | "))
            # volume tab
            await page.click('[data-jtab="volume"]'); await page.wait_for_timeout(200)
            await page.click('[data-jvol="1"]'); await page.wait_for_timeout(150)
            rows = await page.locator(".vbar-row").all_inner_texts()
            print(scheme, "volume rows:", [r.replace("\n", " ") for r in rows[:6]])
            await page.screenshot(path=f"{SH}/j_volume_{scheme}.png", full_page=True)
            # body tab
            await page.click('[data-jtab="body"]'); await page.wait_for_timeout(300)
            print(scheme, "body charts:", await page.locator(".chart-box").count(), "| legend:", await page.locator(".legend").first.inner_text())
            await page.screenshot(path=f"{SH}/j_body_{scheme}.png", full_page=True)
            hov = await page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
            print(scheme, "h-overflow:", hov, "| errors:", errs)
            await ctx.close()
        await b.close()

asyncio.run(main())
