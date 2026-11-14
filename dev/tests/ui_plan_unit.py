import asyncio
from playwright.async_api import async_playwright
APP = "http://localhost:8765/"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, service_workers="block", has_touch=True)
        await ctx.add_init_script("try{localStorage.setItem('upg3:noLogin','true')}catch(e){}")  # без экрана входа
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.goto(APP + "?tab=library"); await page.wait_for_timeout(900)
        await page.fill("[data-libq]", "farmers walk"); await page.wait_for_timeout(400)
        await page.locator(".lib-row").first.click(); await page.wait_for_timeout(200)
        print("lib row:", await page.locator(".lib-row .lib-n").first.inner_text())
        await page.click("[data-libadd]"); await page.wait_for_timeout(300)
        print("add sheet title:", await page.text_content("#sheetTitle"), "| reps label:", await page.text_content('label[for="shAReps"]'))
        await page.click('#sheet [data-sa="adddo"]'); await page.wait_for_timeout(300)
        await page.goto(APP + "?tab=plan"); await page.wait_for_timeout(400)
        await page.click('[data-pb="1"]'); await page.click('[data-pd="A"]'); await page.wait_for_timeout(200)
        last = page.locator(".prow").last
        print("last row:", (await last.inner_text()).replace("\n", " | "))
        await last.click(); await page.wait_for_timeout(300)
        units = await page.locator('#sheet [data-sa="unit"]').count()
        print("unit toggle shown:", units)
        if units:
            await page.click('#sheet [data-sa="unit"][data-v="reps"]'); await page.wait_for_timeout(200)
            print("after reps:", await page.input_value("#shReps"), "| label:", await page.text_content('label[for="shReps"]'))
            await page.click('#sheet [data-sa="unit"][data-v="sec"]'); await page.wait_for_timeout(200)
            print("after sec:", await page.input_value("#shReps"))
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        await page.click('[data-pd="C"]'); await page.wait_for_timeout(200)
        print("C note:", await page.locator(".psess-note").count())
        print("errors:", errs)
        await b.close()
asyncio.run(main())
