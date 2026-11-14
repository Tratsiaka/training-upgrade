"""Neon blocked (403 without CORS) → the app falls back to the relay; clear messages when nothing answers."""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright

APP = "http://localhost:8765/"
SH = str(__import__("pathlib").Path(__file__).resolve().parents[1] / "shots")


def init(bases):
    return "try{localStorage.setItem('upg3~apiOverride', JSON.stringify(%s))}catch(e){}" % json.dumps(bases)


def otp(email):
    return json.load(urllib.request.urlopen(f"http://localhost:8790/__test/otp?email={email}"))["code"]


def sql(q):
    return json.load(urllib.request.urlopen(urllib.request.Request("http://localhost:8792", data=q.encode(), method="POST")))


async def try_login(b, bases, email="art@example.com", shot=None):
    ctx = await b.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
    await ctx.add_init_script(init(bases))
    pg = await ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(APP + "?tab=today"); await pg.wait_for_timeout(500)
    await pg.fill("#lgEmail", email); await pg.press("#lgEmail", "Enter")
    await pg.wait_for_timeout(1500)
    step_code = await pg.locator("#lgCode").count()
    if step_code:
        await pg.fill("#lgCode", otp(email)); await pg.wait_for_timeout(2000)
    msg = await pg.locator("#lgMsg").inner_text() if await pg.locator("#lgMsg").count() else ""
    if shot: await pg.screenshot(path=f"{SH}/{shot}.png")
    return ctx, pg, step_code, msg, errs


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # 1. Belarus without VPN: Neon blocked, relay works
        ctx, pg, step, msg, errs = await try_login(b, ["http://localhost:8794", "http://localhost:8793"])
        print("blocked+relay: code step:", bool(step), "| overlay open:", await pg.locator("#login.open").count(), "| via:", await pg.evaluate("localStorage.getItem('upg3~via')"),
              "| status:", await pg.locator("#syncBtn").get_attribute("aria-label"), "| device:", bool(await pg.evaluate("localStorage.getItem('upg3~dev')")))
        await pg.click('button[data-day="A"]')
        if not await pg.locator('input[data-log][data-f="w"]').first.is_visible():
            await pg.locator('button[data-toggle="log"]').first.click()
        await pg.locator('input[data-log][data-f="w"]').first.fill("150"); await pg.wait_for_timeout(3500)
        print("log reached DB via relay:", "150" in json.dumps(sql("select value from app.kv where key like 'log:%'")))
        hits0 = json.load(urllib.request.urlopen("http://localhost:8793/__hits"))["hits"]
        await pg.reload(); await pg.wait_for_timeout(1500)
        hits1 = json.load(urllib.request.urlopen("http://localhost:8793/__hits"))["hits"]
        print("after reload: status:", await pg.locator("#syncBtn").get_attribute("aria-label"), "| relay hits on open:", hits1 - hits0)
        await pg.click("#syncBtn"); await pg.wait_for_timeout(800)
        await pg.click('[data-sa="ping"]'); await pg.wait_for_timeout(500)
        print("ping:", await pg.locator("#sheetBody .small.muted").first.inner_text(), "| devices:", await pg.locator(".dev-list li").count(), "| errors:", errs)
        await ctx.close()
        # 2. Neon blocked and relay down → explain the block
        ctx, pg, step, msg, errs = await try_login(b, ["http://localhost:8794", "http://localhost:8799"], shot="login_blocked")
        print("blocked, relay down: code step:", bool(step), "| message:", msg)
        await ctx.close()
        # 3. nothing answers
        ctx, pg, step, msg, errs = await try_login(b, ["http://localhost:8798", "http://localhost:8799"])
        print("nothing answers: message:", msg)
        await ctx.close()
        # 4. VPN on: direct works first
        ctx, pg, step, msg, errs = await try_login(b, ["http://localhost:8791", "http://localhost:8793"])
        print("direct ok: via:", await pg.evaluate("localStorage.getItem('upg3~via')"), "| status:", await pg.locator("#syncBtn").get_attribute("aria-label"))
        # VPN turned off later: direct now blocked → falls back to relay by itself
        await pg.evaluate("localStorage.setItem('upg3~apiOverride', JSON.stringify(['http://localhost:8794','http://localhost:8793'])); localStorage.setItem('upg3~via', JSON.stringify('http://localhost:8794'))")
        await pg.evaluate("window.Sync.syncNow()"); await pg.wait_for_timeout(1500)
        print("VPN off later: via:", await pg.evaluate("localStorage.getItem('upg3~via')"), "| status:", await pg.locator("#syncBtn").get_attribute("aria-label"), "| errors:", errs)
        await ctx.close()
        await b.close()

asyncio.run(main())
