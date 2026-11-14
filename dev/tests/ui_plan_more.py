import asyncio
from playwright.async_api import async_playwright
APP = "http://localhost:8765/"
SH = str(__import__("pathlib").Path(__file__).resolve().parents[1] / "shots")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, service_workers="block", has_touch=True)
        await ctx.add_init_script("try{localStorage.setItem('upg3:noLogin','true')}catch(e){}")  # без экрана входа
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        await page.goto(APP + "?tab=today"); await page.wait_for_timeout(400)
        await page.click('button[data-day="B"]'); await page.wait_for_timeout(150)
        await page.locator('[data-rep]').first.click(); await page.wait_for_timeout(350)
        await page.screenshot(path=f"{SH}/r_today_sheet.png")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        # Изменить → plan B
        await page.click('[data-planedit]'); await page.wait_for_timeout(300)
        print("planedit →", await page.locator('[data-pd].on').get_attribute("data-pd"), await page.locator('[data-pb].on').get_attribute("data-pb"), "| ptab:", await page.locator('[data-ptab].on').get_attribute("data-ptab"))
        # library add
        await page.goto(APP + "?tab=library"); await page.wait_for_timeout(900)
        await page.fill("[data-libq]", "тяга т-грифа"); await page.wait_for_timeout(400)
        await page.locator(".lib-row").first.click(); await page.wait_for_timeout(200)
        await page.click("[data-libadd]"); await page.wait_for_timeout(350)
        await page.screenshot(path=f"{SH}/r_lib_add.png")
        await page.click('#sheet [data-sa="adddo"]'); await page.wait_for_timeout(400)
        print("toast:", await page.text_content("#toastT"))
        await page.screenshot(path=f"{SH}/r_lib_toast.png")
        # settings: reset all (two taps)
        await page.goto(APP + "?tab=settings"); await page.wait_for_timeout(300)
        print("edited before:", await page.evaluate("window.__UPG.PM.editedKeys()"))
        await page.click("[data-resetplan]"); await page.wait_for_timeout(100)
        print("armed:", await page.text_content("[data-resetplan]"))
        await page.click("[data-resetplan]"); await page.wait_for_timeout(200)
        print("edited after:", await page.evaluate("window.__UPG.PM.editedKeys()"), "| toast:", await page.text_content("#toastT"))
        await page.click("#toast [data-toastundo]"); await page.wait_for_timeout(200)
        print("after undo:", await page.evaluate("window.__UPG.PM.editedKeys()"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
