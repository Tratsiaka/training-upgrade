import asyncio, json
from playwright.async_api import async_playwright

APP = "http://localhost:8765/"
SH = str(__import__("pathlib").Path(__file__).resolve().parents[1] / "shots")


async def search(page, q):
    await page.fill("[data-libq]", q)
    await page.wait_for_timeout(250)
    found = await page.locator("#libList .small.muted").first.inner_text()
    names = await page.locator(".lib-n").all_inner_texts()
    if q == "жим":
        first_otj = next((i for i, n in enumerate(names) if n.startswith("Отжим")), None)
        found += f" (первое «Отжимания…» на позиции {first_otj} из {len(names)} показанных)"
    return found, [n.replace("\nв программе", " [прогр.]").replace(" в программе", " [прогр.]") for n in names[:5]]


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for scheme in ["light", "dark"]:
            ctx = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme=scheme, service_workers="block")
            await ctx.add_init_script("try{localStorage.setItem('upg3:noLogin','true')}catch(e){}")  # без экрана входа
            page = await ctx.new_page(); errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            reqs = []
            page.on("request", lambda r: reqs.append(r.url) if "exercises-ru" in r.url else None)
            await page.goto(APP + "?tab=library"); await page.wait_for_timeout(600)
            print(scheme, "| fetch:", [u.replace(APP, "") for u in reqs])
            names = await page.locator(".lib-n").all_inner_texts()
            print(scheme, "| first rows:", names[:6])
            print(scheme, "| placeholder:", await page.get_attribute("[data-libq]", "placeholder"))
            if scheme == "light":
                for q in ["жим", "жим лежа", "жим штанги лежа", "подъем на носки", "bench press", "бицепс гантели", "гантели", "сгибания бицепс", "тяга верхнего", "присед", "ноги", "zottman", "ё", "qwzx"]:
                    print("  search", repr(q), "→", *await search(page, q))
                await page.fill("[data-libq]", "жим штанги лежа"); await page.wait_for_timeout(250)
                await page.locator(".lib-row").first.click(); await page.wait_for_timeout(200)
                det = await page.locator(".lib-d").first.inner_text()
                print("  detail:", det.replace("\n", " | ")[:300])
                # "в программе" filter
                await page.fill("[data-libq]", ""); await page.click('[data-libbp="prog"]'); await page.wait_for_timeout(250)
                pr = await page.locator(".lib-row").all_inner_texts()
                print("  in-program:", len(pr), "|", [x.split("\n")[0] for x in pr[:4]])
                await page.click('[data-libbp="all"]'); await page.wait_for_timeout(150)
            await page.fill("[data-libq]", "жим"); await page.wait_for_timeout(250)
            await page.locator(".lib-row").nth(1).click(); await page.wait_for_timeout(200)
            await page.screenshot(path=f"{SH}/lib_ru_{scheme}.png", full_page=False)
            # how-pane on Today
            await page.goto(APP + "?tab=today"); await page.wait_for_timeout(400)
            btn = page.locator('[data-toggle="how"]').first
            if await btn.count():
                await btn.click(); await page.wait_for_timeout(150)
                hs = await page.locator('.pane[data-pane="how"]:not([hidden]) .ds').first.inner_text()
                print(scheme, "| how-pane:", hs.replace("\n", " | ")[:220], "...", hs.replace("\n", " | ")[-120:])
            else:
                print(scheme, "| how toggle not found")
            hov = await page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
            print(scheme, "| h-overflow:", hov, "| errors:", errs)
            await ctx.close()

        # PWA: library available offline after first visit
        ctx = await b.new_context(viewport={"width": 390, "height": 844})
        await ctx.add_init_script("try{localStorage.setItem('upg3:noLogin','true')}catch(e){}")  # без экрана входа
        page = await ctx.new_page()
        await page.goto(APP + "?tab=library"); await page.wait_for_timeout(500)
        await page.evaluate("navigator.serviceWorker.ready"); await page.wait_for_timeout(300)
        await page.reload(); await page.wait_for_timeout(800)  # SW now controls page, library fetched through it
        print("pwa: controlled:", await page.evaluate("!!navigator.serviceWorker.controller"), "| rows online:", await page.locator(".lib-row").count())
        await ctx.set_offline(True)
        await page.reload(); await page.wait_for_timeout(800)
        print("pwa: rows offline:", await page.locator(".lib-row").count(), "| first:", (await page.locator(".lib-n").all_inner_texts())[:2])
        keys = await page.evaluate("caches.keys().then(async ks => { const out = {}; for (const k of ks) { const c = await caches.open(k); out[k] = (await c.keys()).map(r => r.url.replace(location.origin, '')).filter(u => u.includes('exercises')); } return out; })")
        print("pwa: cached:", keys)
        await ctx.close()
        await b.close()

asyncio.run(main())
