"""Sign-in screen, header indicator, Today banner, account sheet — screenshots + basic checks."""
import asyncio, json, urllib.request, sys
from playwright.async_api import async_playwright

APP = "http://localhost:8765/"
SH = str(__import__("pathlib").Path(__file__).resolve().parents[1] / "shots")
INIT = "try{localStorage.setItem('upg3~apiOverride', JSON.stringify('http://localhost:8791'))}catch(e){}"
SCHEME = sys.argv[1] if len(sys.argv) > 1 else "light"


def otp(email):
    return json.load(urllib.request.urlopen(f"http://localhost:8790/__test/otp?email={email}"))["code"]


def sql(q):
    req = urllib.request.Request("http://localhost:8792", data=q.encode(), method="POST")
    return json.load(urllib.request.urlopen(req))


async def main():
    import os; os.makedirs(SH, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, color_scheme=SCHEME, service_workers="block")
        await ctx.add_init_script(INIT)
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)
        await pg.goto(APP + "?tab=today"); await pg.wait_for_timeout(700)
        print("first open: overlay open:", await pg.locator("#login.open").count(), "| title:", await pg.locator("#lgTitle").inner_text(),
              "| focused:", await pg.evaluate("document.activeElement && document.activeElement.id"))
        await pg.screenshot(path=f"{SH}/login_first_{SCHEME}.png")
        # bad email
        await pg.fill("#lgEmail", "art@"); await pg.click('#lgForm [type="submit"]'); await pg.wait_for_timeout(150)
        print("bad email msg:", await pg.locator("#lgMsg").inner_text())
        await pg.fill("#lgEmail", "Art@Example.com "); await pg.press("#lgEmail", "Enter"); await pg.wait_for_timeout(600)
        print("code step:", await pg.locator("#lgCode").count(), "| focused:", await pg.evaluate("document.activeElement && document.activeElement.id"),
              "| resend:", await pg.locator('[data-lg="resend"]').inner_text())
        await pg.screenshot(path=f"{SH}/login_code_{SCHEME}.png")
        # wrong code → error, stays
        await pg.fill("#lgCode", "000000"); await pg.wait_for_timeout(700)
        print("wrong code msg:", await pg.locator("#lgMsg").inner_text(), "| still open:", await pg.locator("#login.open").count())
        await pg.screenshot(path=f"{SH}/login_wrong_{SCHEME}.png")
        # reload keeps the pending code step
        await pg.reload(); await pg.wait_for_timeout(600)
        print("after reload step code:", await pg.locator("#lgCode").count(), "| sent to:", await pg.locator(".lg-sent b").inner_text())
        # skip → Today with banner and indicator
        await pg.click('[data-lg="change"]'); await pg.wait_for_timeout(100)
        await pg.click('[data-lg="skip"]'); await pg.wait_for_timeout(400)
        ind = pg.locator("#syncBtn")
        print("skipped: overlay hidden:", await pg.locator("#login").get_attribute("hidden") is not None, "| noLogin:", await pg.evaluate("localStorage.getItem('upg3:noLogin')"),
              "| indicator:", await ind.get_attribute("class"), await ind.get_attribute("aria-label"))
        print("banner:", (await pg.locator(".banner").first.inner_text()).replace("\n", " | "))
        await pg.screenshot(path=f"{SH}/today_signedout_{SCHEME}.png")
        await pg.reload(); await pg.wait_for_timeout(600)
        print("reload after skip: overlay open:", await pg.locator("#login.open").count())
        # sign in from the banner, auto-submit on 6 digits
        await pg.click('.banner [data-login]'); await pg.wait_for_timeout(200)
        print("manual open focus:", await pg.evaluate("document.activeElement && document.activeElement.id"), "| email prefilled:", await pg.input_value("#lgEmail"))
        await pg.fill("#lgEmail", "art@example.com"); await pg.press("#lgEmail", "Enter"); await pg.wait_for_timeout(500)
        await pg.fill("#lgCode", otp("art@example.com")); await pg.wait_for_timeout(1800)
        print("signed in: overlay open:", await pg.locator("#login.open").count(), "| toast:", await pg.locator("#toastT").inner_text(),
              "| indicator:", await ind.get_attribute("class"), "|", await ind.get_attribute("aria-label"))
        print("dev token:", bool(await pg.evaluate("localStorage.getItem('upg3~dev')")), "| devices in db:", sql("select name, revoked_at from app.devices"))
        print("banner gone:", "Данные только на этом устройстве" not in await pg.locator("#app").inner_text())
        await pg.screenshot(path=f"{SH}/today_signedin_{SCHEME}.png")
        # account sheet
        await ind.click(); await pg.wait_for_timeout(700)
        print("sheet:", (await pg.locator("#sheetBody").inner_text()).replace("\n", " | "))
        await pg.click('[data-sa="ping"]'); await pg.wait_for_timeout(400)
        print("ping:", await pg.locator("#sheetBody .small.muted").first.inner_text())
        await pg.screenshot(path=f"{SH}/acct_sheet_{SCHEME}.png")
        await pg.click('[data-sa="signout"]'); await pg.wait_for_timeout(100)
        print("armed:", await pg.locator('[data-sa="signout"]').inner_text())
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
        # expired: revoke device + expire neon session → login opens by itself
        urllib.request.urlopen("http://localhost:8790/__test/expire?email=art@example.com")
        sql("update app.devices set revoked_at = now()")
        await pg.evaluate("localStorage.removeItem('upg3~jwt')")
        await pg.reload(); await pg.wait_for_timeout(1500)
        print("expired: overlay:", await pg.locator("#login.open").count(), "| title:", await pg.locator("#lgTitle").inner_text(), "| email:", await pg.input_value("#lgEmail"),
              "| skip label:", await pg.locator('[data-lg="skip"]').inner_text())
        await pg.screenshot(path=f"{SH}/login_expired_{SCHEME}.png")
        await pg.click('[data-lg="skip"]'); await pg.wait_for_timeout(300)
        print("expired banner:", (await pg.locator(".banner").first.inner_text()).replace("\n", " | "), "| indicator:", await ind.get_attribute("class"))
        await pg.screenshot(path=f"{SH}/today_expired_{SCHEME}.png")
        # settings card
        await pg.goto(APP + "?tab=settings"); await pg.wait_for_timeout(900)
        await pg.click('[data-lg="skip"]') if await pg.locator("#login.open").count() else None
        await pg.wait_for_timeout(300)
        print("settings card:", (await pg.locator("#acct").inner_text()).replace("\n", " | "))
        hov = await pg.evaluate("document.documentElement.scrollWidth > window.innerWidth")
        print("h-overflow:", hov, "| errors:", errs)
        await b.close()

asyncio.run(main())
