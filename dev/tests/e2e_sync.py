"""End-to-end: two devices, email-code login via the function proxy, sync, offline queue,
membership, overlay, session expiry, sign-out. Uses the local stack (start.mjs)."""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright

APP = "http://localhost:8765/"
SH = str(__import__("pathlib").Path(__file__).resolve().parents[1] / "shots")
INIT = "try{localStorage.setItem('upg3~apiOverride', JSON.stringify('http://localhost:8791'))}catch(e){}"


def otp(email):
    return json.load(urllib.request.urlopen(f"http://localhost:8790/__test/otp?email={email}"))["code"]


def sql(q):
    req = urllib.request.Request("http://localhost:8792", data=q.encode(), method="POST")
    return json.load(urllib.request.urlopen(req))


async def login(page, email):
    """Вход через экран входа: он открывается сам (первый запуск, истёкший вход) или по кнопке «Войти»."""
    await page.goto(APP + "?tab=settings"); await page.wait_for_timeout(1200)
    if not await page.locator("#login.open").count():
        await page.click('#acct [data-login]'); await page.wait_for_timeout(200)
    if not await page.locator("#lgEmail").count():
        await page.click('[data-lg="change"]'); await page.wait_for_timeout(100)
    await page.fill("#lgEmail", email)
    await page.click('#lgForm [type="submit"]'); await page.wait_for_selector("#lgCode")
    await page.fill("#lgCode", otp(email))  # 6 цифр — вход без нажатия кнопки
    await page.wait_for_timeout(1800)
    if await page.locator("#login.open").count():
        print("  login overlay still open:", await page.locator("#lgMsg").inner_text())


def devices(email):
    return sql(f"select name, revoked_at is not null as revoked from app.devices where email = '{email}' order by created_at")


async def status(page):
    el = page.locator("#syncStatus")
    return (await el.inner_text()) if await el.count() else (await page.locator("#acct").inner_text())


async def main():
    import os; os.makedirs(SH, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        ctxA = await b.new_context(viewport={"width": 390, "height": 844})
        ctxB = await b.new_context(viewport={"width": 1100, "height": 900})
        for c in (ctxA, ctxB):
            await c.add_init_script(INIT)
        A = await ctxA.new_page(); B = await ctxB.new_page()
        for pg in (A, B):
            pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)

        # A: data before login (should be uploaded on first login)
        await A.goto(APP + "?tab=today"); await A.wait_for_timeout(400)
        print("first start shows sign-in:", await A.locator("#login.open").count() == 1, "| title:", await A.locator("#lgTitle").inner_text())
        await A.click('[data-lg="skip"]'); await A.wait_for_timeout(300)
        await A.click('button[data-day="A"]')
        await A.locator('button[data-toggle="log"]').first.click()
        await A.locator('input[data-log][data-f="w"]').first.fill("140")
        await A.locator('input[data-log][data-f="r"]').first.fill("10")
        await A.wait_for_timeout(300)

        await login(A, "art@example.com")
        print("A status after login:", await status(A), "| device token:", bool(await A.evaluate("localStorage.getItem('upg3~dev')")), "| devices:", devices("art@example.com"))
        await A.screenshot(path=f"{SH}/acct_signed_in.png")
        rows = sql("select key, value from app.kv order by rev")
        print("server keys after A login:", [r["key"] for r in rows])

        # B logs in → gets A's data
        await login(B, "art@example.com")
        print("B status:", await status(B), "| devices:", devices("art@example.com"))
        logs_b = await B.evaluate("Object.keys(window.Store.get('logs', {}))")
        print("B logs from server:", logs_b)

        # B adds a measurement → A pulls it
        await B.click('.nav-i[data-tab="journal"]'); await B.wait_for_timeout(200)
        await B.click('[data-jtab="body"]'); await B.wait_for_timeout(100)
        await B.fill('#measForm [name="w"]', "88,4"); await B.fill('#measForm [name="waist"]', "90")
        await B.click('button[data-addmeas]'); await B.wait_for_timeout(3500)
        print("server has meas:", [r["key"] for r in sql("select key from app.kv where key like 'meas:%'")])
        await A.goto(APP + "?tab=journal"); await A.wait_for_timeout(1500)
        await A.click('[data-jtab="body"]'); await A.wait_for_timeout(200)
        print("A sees B's measurement:", "88,4" in await A.locator("#app").inner_text())
        # cycle + adjustments sync from A to B
        await A.goto(APP + "?tab=plan"); await A.wait_for_timeout(300)
        await A.click('[data-ptab="sched"]'); await A.wait_for_timeout(150)
        await A.click('button[data-cyc="deload"]'); await A.wait_for_timeout(300)
        await A.evaluate("window.Store.set('adjust', [{id:'t1', title:'Тест', enabled:true, changes:[{exercise:'bench', session:'*', sets:2}]}])")
        # правка программы на A: замена в 1A и упражнение из базы в 2B
        await A.evaluate("window.__UPG.PM.replace('1A', 1, 0, '', 'hack', false)")
        await A.evaluate("window.__UPG.PM.add('2B', window.__UPG.PM.exFromLib({id:'0095', n:'barbell shrug', r:'Шраги со штангой', t:'traps', sec:['shoulders'], s:['шаг 1'], m:'xyz'}), {sets:3, reps:'10–12'}, 'new', 'std')")
        await A.wait_for_timeout(3500)
        await B.evaluate("window.Sync.syncNow()"); await B.wait_for_timeout(1500)
        print("B got cycle idx:", await B.evaluate("(window.Store.get('cycle')||{}).idx"), "| B got adjust:", await B.evaluate("(window.Store.get('adjust')||[]).length"))
        print("B got plan edit:", await B.evaluate("window.__UPG.sessOf('1A').groups[1].items[0].ex"), "| B custom:", await B.evaluate("(window.PROGRAM.exercises['ds_0095']||{}).n"),
              "| B 2B last:", await B.evaluate("(() => { const g = window.__UPG.sessOf('2B').groups.filter(g => g.items && g.kind !== 'warmup'); return g[g.length-1].items[0].ex; })()"))
        await B.goto(APP + "?tab=plan"); await B.wait_for_timeout(600)
        print("B plan shows edit:", "Гакк-присед" in await B.locator("#app").inner_text())
        print("server plan key:", [r["key"] for r in sql("select key from app.kv where key = 'plan'")])
        await A.evaluate("window.__UPG.PM.revert('1A', 1, 0, '')"); await A.wait_for_timeout(300)

        # offline queue on A
        await ctxA.set_offline(True)
        await A.goto(APP + "?tab=today") if False else None
        await A.click('.nav-i[data-tab="today"]'); await A.wait_for_timeout(200)
        await A.click('button[data-day="A"]')
        await A.locator('input[data-log][data-f="w"]').nth(1).fill("142,5")
        await A.locator('input[data-log][data-f="r"]').nth(1).fill("8")
        await A.wait_for_timeout(3500)
        await A.click('.nav-i[data-tab="more"]'); await A.click('.menu-i[data-tab="settings"]'); await A.wait_for_timeout(200)
        print("A offline status:", await status(A), '| pending:', await A.evaluate("localStorage.getItem('upg3~pending')"))
        await ctxA.set_offline(False)
        await A.evaluate("window.dispatchEvent(new Event('online'))"); await A.wait_for_timeout(2500)
        print("A back online status:", await status(A))
        v = sql("select value from app.kv where key like 'log:%'")
        print("server got offline set:", "142,5" in json.dumps(v, ensure_ascii=False))

        # conflict: same log entry edited on B later → wins on A
        await B.goto(APP + "?tab=today"); await B.wait_for_timeout(1200)
        await B.click('button[data-day="A"]')
        if not await B.locator('input[data-log][data-f="w"]').first.is_visible():
            await B.locator('button[data-toggle="log"]').first.click()
        await B.locator('input[data-log][data-f="w"]').first.fill("145"); await B.wait_for_timeout(3500)
        await A.evaluate("window.Sync.syncNow()"); await A.wait_for_timeout(1500)
        print("A has B's newer weight 145:", await A.evaluate("JSON.stringify(window.Store.get('logs')).includes('\"145\"')"))

        # overlay for the owner
        sql("""insert into app.private_overlays(email, overlay) values ('art@example.com', '{"v":1,"set":[[["meta","bodyMenu"],["Заметка владельца (тест)","личное"]],[["meta","profile","weight"],77]]}'::jsonb)""")
        await A.evaluate("window.Sync.syncNow()"); await A.wait_for_timeout(1500)
        await A.click('#back') if await A.locator('#back').is_visible() else None
        await A.click('.nav-i[data-tab="more"]'); await A.wait_for_timeout(200)
        print("overlay applied (menu):", "Заметка владельца (тест)" in await A.locator(".menu").inner_text())
        await A.goto(APP + "?tab=more"); await A.wait_for_timeout(800)
        print("overlay survives reload:", "Заметка владельца (тест)" in await A.locator(".menu").inner_text())

        # stranger gets denied
        ctxC = await b.new_context(); await ctxC.add_init_script(INIT); C = await ctxC.new_page()
        await login(C, "stranger@example.com")
        print("stranger status:", await status(C), "| stranger devices:", devices("stranger@example.com"))
        await C.goto(APP + "?tab=today"); await C.wait_for_timeout(1200)
        print("stranger Today banner:", (await C.locator(".banner").first.inner_text())[:80], "| indicator:", await C.locator("#syncBtn").get_attribute("class"))

        # Neon session expiry on A: the device token keeps sync going
        urllib.request.urlopen("http://localhost:8790/__test/expire?email=art@example.com")
        await A.evaluate("localStorage.removeItem('upg3~jwt')")
        await A.goto(APP + "?tab=settings"); await A.wait_for_timeout(300)
        await A.evaluate("window.Sync.syncNow()"); await A.wait_for_timeout(1200)
        print("A after Neon session expiry (device token):", await status(A), "| login shown:", await A.locator("#login.open").count())
        await A.evaluate("window.Store.set('goals', Object.assign({}, window.Store.get('goals', {}), {e2e: 1}))"); await A.wait_for_timeout(3500)
        print("A change reaches server via device token:", "e2e" in json.dumps(sql("select value from app.kv where key = 'goals'")))
        # device revoked too → "войди снова" opens by itself on the next open
        sql("update app.devices set revoked_at = now() where email = 'art@example.com'")
        await A.goto(APP + "?tab=today"); await A.wait_for_timeout(1500)
        print("A after device revoke: sign-in open:", await A.locator("#login.open").count(), "| title:", await A.locator("#lgTitle").inner_text(),
              "| email prefilled:", await A.input_value("#lgEmail"), "| banner:", (await A.locator(".banner").first.inner_text())[:40])
        await login(A, "art@example.com")
        print("A re-login status:", await status(A), "| devices:", devices("art@example.com"))

        # sign out on B: two-step button, page reload, public program back
        await B.goto(APP + "?tab=today"); await B.wait_for_timeout(1500)
        print("B (Neon session expired earlier, device token alive):", await B.locator("#syncBtn").get_attribute("aria-label"))
        await B.click("#syncBtn"); await B.wait_for_timeout(800)
        print("B account sheet devices:", await B.locator(".dev-list li").count())
        await B.click('[data-sa="signout"]'); await B.click('[data-sa="signout"]')
        await B.wait_for_timeout(2500)
        print("B after sign-out: sign-in screen:", await B.locator("#login.open").count(), "| devices:", devices("art@example.com"))
        await B.goto(APP + "?tab=more"); await B.wait_for_timeout(500)
        print("B after sign-out menu public:", "Суставы и сигналы" in await B.locator(".menu").inner_text(), "| foot:", await B.locator("#syncFoot").inner_text())
        print("B keeps local data:", await B.evaluate("Object.keys(window.Store.get('logs', {})).length"))
        await A.screenshot(path=f"{SH}/acct_A.png")
        print("errors:", errs[:6])
        await b.close()

asyncio.run(main())
