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
        page.on("console", lambda m: errs.append(m.text))
        await page.goto(APP + "?tab=plan"); await page.wait_for_timeout(500)
        await page.evaluate("""() => { ['pointerdown','pointermove','pointerup','pointercancel'].forEach(t => document.addEventListener(t, e => { if (t !== 'pointermove' || Math.random() < 0.05) console.log(t, e.pointerType, e.target.className, e.clientY); }, true)); }""")
        await page.click('[data-preorder="1"]'); await page.wait_for_timeout(300)
        last = page.locator(".ro-i").last
        await last.scroll_into_view_if_needed()
        h = last.locator(".drag-h"); hb = await h.bounding_box()
        print("handle", hb)
        await page.mouse.move(hb["x"] + 10, hb["y"] + 10)
        await page.mouse.down()
        for i in range(1, 15):
            await page.mouse.move(hb["x"] + 10, max(60, hb["y"] + 10 - i * 60)); await page.wait_for_timeout(30)
        for i in range(60):
            await page.mouse.move(hb["x"] + 10, 60 + (i % 2)); await page.wait_for_timeout(30)
        print("scrollY", await page.evaluate("scrollY"))
        await page.mouse.up(); await page.wait_for_timeout(300)
        print(await page.evaluate("JSON.stringify(window.__UPG.sessOf('1A').groups.filter(g=>g.items&&g.kind!=='warmup').map(g=>g.items.map(i=>i.ex)))"))
        print("\n".join(errs[:40]))
        await b.close()
asyncio.run(main())
