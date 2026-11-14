import asyncio
from playwright.async_api import async_playwright
URL = "https://tratsiaka.github.io/training-upgrade/"
SH = str(__import__("pathlib").Path(__file__).resolve().parents[1] / "shots")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)
        await pg.goto(URL); await pg.wait_for_timeout(2500)
        print("version:", await pg.evaluate("document.querySelector('script[src^=\"js/app.js\"]').src.split('v=')[1]"))
        print("sign-in screen:", await pg.locator("#login.open").count(), "|", await pg.locator("#lgTitle").inner_text(), "| api:", await pg.evaluate("window.APP_CONFIG.api"))
        await pg.screenshot(path=f"{SH}/live_login.png")
        print("ping from github.io:", await pg.evaluate("window.Sync.ping()"))
        await pg.click('[data-lg="skip"]'); await pg.wait_for_timeout(500)
        print("indicator:", await pg.locator("#syncBtn").get_attribute("aria-label"), "| banner:", (await pg.locator(".banner").first.inner_text()).replace("\n", " "))
        await pg.screenshot(path=f"{SH}/live_today.png")
        await pg.wait_for_timeout(1500)
        print("sw controlled after reload:", end=" "); await pg.reload(); await pg.wait_for_timeout(1500)
        print(await pg.evaluate("!!navigator.serviceWorker.controller"), "| overlay after skip+reload:", await pg.locator("#login.open").count())
        print("errors:", errs)
        await b.close()
asyncio.run(main())
