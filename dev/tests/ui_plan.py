import asyncio, json
from playwright.async_api import async_playwright
APP = "http://localhost:8765/"
SH = str(__import__("pathlib").Path(__file__).resolve().parents[1] / "shots")
OK = []; FAIL = []
def check(c, msg):
    (OK if c else FAIL).append(msg); print(("ok  " if c else "FAIL") + " " + msg)

async def rows(page):
    return await page.evaluate("Array.from(document.querySelectorAll('.prow')).map(r => r.querySelector('.code').textContent + ' ' + r.querySelector('.pr-n').textContent + ' | ' + Array.from(r.querySelectorAll('.pr-s')).map(x=>x.textContent).join(' / '))")
async def sess(page, key):
    return await page.evaluate(f"(() => {{ const s = window.__UPG.sessOf('{key}'); return s.groups.filter(g => g.items && ['pair','tri','circuit','single','giant'].includes(g.kind)).map(g => g.kind + ':' + g.items.map(it => it.weekAlt ? it.weekAlt.map(w=>w.ex).join('/') : it.ex).join(',')); }})()")
async def sheet_open(page):
    return await page.evaluate("!document.getElementById('sheet').hidden && document.getElementById('sheet').classList.contains('open')")
async def toast_text(page):
    return await page.evaluate("document.getElementById('toast').hidden ? '' : document.getElementById('toastT').textContent")
async def close_sheet(page):
    await page.click('#sheet .sheet-h [data-sa="close"]'); await page.wait_for_timeout(350)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, service_workers="block", has_touch=True)
        await ctx.add_init_script("try{localStorage.setItem('upg3:noLogin','true')}catch(e){}")  # без экрана входа
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        await page.goto(APP + "?tab=plan"); await page.wait_for_timeout(500)
        r0 = await rows(page)
        check(len(r0) == 13 and r0[0].startswith("A1 Жим ногами"), f"plan 1A rows: {len(r0)} first={r0[0][:40]}")
        # 1. params
        await page.click('[data-pi="1:0"]'); await page.wait_for_timeout(350)
        check(await sheet_open(page), "item sheet opens")
        check((await page.text_content("#sheetTitle")) == "Жим ногами", "sheet title")
        await page.click('#sheet [data-sa="sets"][data-v="1"]'); await page.wait_for_timeout(120)
        await page.click('#sheet [data-sa="reps"][data-v="8–12"]'); await page.wait_for_timeout(120)
        await page.click('#sheet [data-sa="rir"][data-v="1"]'); await page.wait_for_timeout(120)
        await page.fill('#shNote', "пауза внизу"); await page.press('#shNote', "Enter"); await page.wait_for_timeout(150)
        await page.fill('#shTempo', "2 с вниз"); await page.click('#sheet [data-sa="rir"][data-v="1–2"]'); await page.wait_for_timeout(200)
        st = await page.evaluate("JSON.stringify(window.__UPG.sessOf('1A').groups[1].items[0])")
        check('"sets":4' in st and '"reps":"8–12"' in st and '"rir":"1–2"' in st and "пауза внизу" in st and "2 с вниз" in st, "params applied live (typing then tapping chip keeps both): " + st)
        await close_sheet(page)
        check("Изменения сохранены" in await toast_text(page), "toast after close: " + await toast_text(page))
        r1 = await rows(page)
        check("4 × 8–12 · RIR 1–2 · 2 с вниз" in r1[0], "row shows new scheme: " + r1[0])
        tags = await page.locator('[data-pi="1:0"] .tag').all_inner_texts()
        check("изменено" in tags, f"tag изменено: {tags}")
        # undo
        await page.click("#toast [data-toastundo]"); await page.wait_for_timeout(200)
        r2 = await rows(page)
        check("3 × 10–12 · RIR 2 · 3 с вниз" in r2[0] and await page.evaluate("!window.__UPG.PM.edited('1A')"), "undo restores: " + r2[0])
        # 2. replace everywhere
        await page.click('[data-pi="1:0"]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="replace"]'); await page.wait_for_timeout(250)
        await page.click('#sheet [data-sa="scope"][data-v="all"]'); await page.wait_for_timeout(150)
        help_ = await page.text_content("#sheet .sh-help")
        check("3 места" in help_, "scope help: " + help_)
        await page.click('#sheet [data-sa="pick"][data-v="hack"]'); await page.wait_for_timeout(250)
        check(await sheet_open(page) and (await page.text_content("#sheetTitle")) == "Гакк-присед (тренажёр)", "back to item sheet with new exercise")
        await close_sheet(page)
        t = await toast_text(page)
        check("3 места" in t, "toast count: " + t)
        for k in ["1A", "2A", "3A", "1C", "2C", "3C"]:
            s = await sess(page, k)
            check(not any("legpress," in x or x.endswith(":legpress") or ",legpress" in x for x in s), f"no legpress in {k}: {s}")
        rev = await page.locator('[data-pi="1:0"] .tag').all_inner_texts()
        check("ваша замена" in rev, f"tag ваша замена: {rev}")
        # revert in this place only
        await page.click('[data-pi="1:0"]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="revert"]'); await page.wait_for_timeout(200)
        check((await page.text_content("#sheetTitle")) == "Жим ногами", "revert to original")
        await close_sheet(page)
        s1A = await sess(page, "1A"); s2A = await sess(page, "2A")
        check(s1A[0].startswith("pair:legpress") and "hack" in s2A[0], f"revert only here: {s1A[0]} / {s2A[0]}")
        # 3. move down across group boundary
        await page.click('[data-pi="1:1"]'); await page.wait_for_timeout(300)   # A2 deadbug
        await page.click('#sheet [data-sa="move"][data-v="1"]'); await page.wait_for_timeout(200)
        where = await page.text_content("#sheet .sh-where")
        check("B1" in where, "moved into B as B1: " + where)
        await close_sheet(page)
        s = await sess(page, "1A")
        check(s[0] == "single:legpress" and s[1].startswith("tri:deadbug,bench"), f"structure after move: {s[:2]}")
        # 4. swap places
        await page.click('[data-pi="1:0"]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="swapwith"]'); await page.wait_for_timeout(200)
        n_opts = await page.locator('#sheet [data-sa="swapto"]').count()
        await page.click('#sheet [data-sa="swapto"][data-v="3:1"]'); await page.wait_for_timeout(250)
        t = await toast_text(page)
        s = await sess(page, "1A")
        check("Поменяли местами A1 и C2" in t and s[0] == "single:hammer_curl" and "legpress" in s[2], f"swap: {t} | {s[0]} | {s[2]} ({n_opts} options)")
        # 5. group sheet: tier, rest, move, split
        await page.click('[data-pg="2"]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="tier"][data-v="std"]'); await page.wait_for_timeout(120)
        await page.click('#sheet [data-sa="rest"][data-v="3 мин"]'); await page.wait_for_timeout(120)
        g = await page.evaluate("JSON.stringify(window.__UPG.sessOf('1A').groups[2])")
        check('"tier":"std"' in g and '"rest":"3 мин"' in g, "group tier/rest")
        await page.click('#sheet [data-sa="gmove"][data-v="1"]'); await page.wait_for_timeout(150)
        await close_sheet(page)
        s = await sess(page, "1A")
        check(s[1].startswith("tri:oh_ext") and s[2].startswith("tri:deadbug"), f"group moved down: {s[:3]}")
        await page.click('[data-pg="3"]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="split"]'); await page.wait_for_timeout(300)
        s = await sess(page, "1A")
        check(s[2:5] == ["single:deadbug", "single:bench", "single:calf_legpress"], f"split: {s[2:5]}")
        # 6. Today reflects
        await page.goto(APP + "?tab=today"); await page.wait_for_timeout(400)
        await page.click('button[data-day="A"]'); await page.wait_for_timeout(200)
        await page.click('button[data-time="120"]'); await page.wait_for_timeout(200)
        names = await page.locator(".group .ex-name").all_inner_texts()
        codes = await page.locator(".group .code").all_inner_texts()
        check(names[3:5] == ["Молотковые сгибания", "Разгибания из-за головы (локоть до 90°)"] or "Молотковые сгибания" in names, f"today shows edited order: {names[:8]}")
        check(codes[:3] == ["A1", "B1", "B2"], f"today codes relabeled: {codes[:6]}")
        mine = await page.locator(".mine-note").count()
        check(mine == 1, "today notes edited session")
        # 7. today-only swap
        await page.locator('[data-rep]').first.click(); await page.wait_for_timeout(300)
        sc = await page.locator('#sheet [data-sa="scope"].on').inner_text()
        check(sc == "Сегодня", "today default scope: " + sc)
        await page.locator('#sheet [data-sa="pick"]').first.click(); await page.wait_for_timeout(300)
        t = await toast_text(page)
        first = (await page.locator(".group .ex-name").all_inner_texts())[0]
        note = await page.locator(".swap-note").count()
        check(t.startswith("Сегодня «") and note == 1, f"today swap: {t} | first={first}")
        s = await sess(page, "1A")
        check(s[0] == "single:hammer_curl", "program unchanged by today swap")
        await page.click(".swap-note [data-repback]"); await page.wait_for_timeout(200)
        check(await page.locator(".swap-note").count() == 0, "today swap reverted")
        # 8. today → program (this block)
        await page.locator('[data-rep]').first.click(); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="scope"][data-v="here"]'); await page.wait_for_timeout(150)
        await page.fill('#sheet [data-sq]', "ez"); await page.wait_for_timeout(500)
        await page.locator('#sheet [data-sa="pick"]').first.click(); await page.wait_for_timeout(300)
        s = await sess(page, "1A")
        check(s[0] == "single:ez_curl", f"today → program replace: {s[0]} toast={await toast_text(page)}")
        # 9. add from plan
        await page.goto(APP + "?tab=plan"); await page.wait_for_timeout(400)
        await page.click('[data-padd]'); await page.wait_for_timeout(300)
        await page.fill('#sheet [data-sq]', "махи гант"); await page.wait_for_timeout(700)
        await page.locator('#sheet [data-sa="addpick"]').first.click(); await page.wait_for_timeout(250)
        await page.click('#sheet [data-sa="aplace"][data-v="1"]'); await page.wait_for_timeout(120)
        await page.click('#sheet [data-sa="areps"][data-v="12–20"]'); await page.wait_for_timeout(120)
        btn = await page.text_content('#sheet [data-sa="adddo"]')
        await page.click('#sheet [data-sa="adddo"]'); await page.wait_for_timeout(300)
        s = await sess(page, "1A")
        check(s[0] == "pair:ez_curl,lat_raise_db", f"add into group A: {s[0]} ({btn.strip()}) toast={await toast_text(page)}")
        fl = await page.locator(".prow.flash").count()
        check(fl == 1, "added row flashes")
        # 10. add from library: custom exercise to all blocks of B
        await page.goto(APP + "?tab=library"); await page.wait_for_timeout(900)
        await page.fill("[data-libq]", "шраги со штангой"); await page.wait_for_timeout(500)
        await page.locator(".lib-row").first.click(); await page.wait_for_timeout(200)
        await page.click("[data-libadd]"); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="ad"][data-v="B"]'); await page.wait_for_timeout(120)
        await page.click('#sheet [data-sa="ascope"]'); await page.wait_for_timeout(120)
        await page.click('#sheet [data-sa="atier"][data-v="std"]'); await page.wait_for_timeout(120)
        await page.click('#sheet [data-sa="adddo"]'); await page.wait_for_timeout(300)
        t = await toast_text(page)
        cid = await page.evaluate("Object.keys(window.PROGRAM.exercises).find(k => k.startsWith('ds_'))")
        ok3 = True
        for k in ["1B", "2B", "3B"]:
            s = await sess(page, k); ok3 = ok3 and s[-1] == f"single:{cid}"
        check(ok3 and "во всех блоках" in t, f"library add to B all blocks: {cid} | {t}")
        ex = await page.evaluate(f"JSON.stringify(window.PROGRAM.exercises['{cid}'])")
        check('"p":["back"]' in ex or '"p":["back"' in ex, "custom muscles mapped: " + ex[:160])
        tagged = await page.locator(".lib-row .tag").count()
        check(tagged >= 1, "library marks added exercise 'в программе'")
        # 11. reorder mode: arrows + drag
        await page.goto(APP + "?tab=plan"); await page.wait_for_timeout(400)
        await page.click('[data-pd="B"]'); await page.wait_for_timeout(200)
        await page.click('[data-preorder="1"]'); await page.wait_for_timeout(300)
        n_ro = await page.locator(".ro-i").count()
        before = await sess(page, "1B")
        await page.click('[data-roi="1:0:1"]'); await page.wait_for_timeout(150)   # A1 pullup down
        after = await sess(page, "1B")
        check(after[0].startswith("pair:calf_legpress,pullup_w"), f"arrow move in reorder: {after[0]}")
        # drag the last item (custom) to the very top
        last = page.locator(".ro-i").last
        await last.scroll_into_view_if_needed()
        h = last.locator(".drag-h"); hb = await h.bounding_box()
        fb = {"y": 40}
        await page.mouse.move(hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2)
        await page.mouse.down()
        for i in range(1, 25):
            y = hb["y"] + hb["height"] / 2 + (fb["y"] + 5 - (hb["y"] + hb["height"] / 2)) * i / 24
            await page.mouse.move(hb["x"] + hb["width"] / 2, y); await page.wait_for_timeout(25)
        await page.wait_for_timeout(300)
        # keep pulling up while auto-scroll brings the top into view
        for i in range(30):
            await page.mouse.move(hb["x"] + hb["width"] / 2, 60); await page.wait_for_timeout(30)
        await page.mouse.up(); await page.wait_for_timeout(300)
        after2 = await sess(page, "1B")
        check(after2[0].startswith(f"tri:{cid},calf_legpress") or after2[0].startswith(f"pair:{cid}") or after2[0].split(":")[1].startswith(cid), f"drag to top: {after2[0]} (from {n_ro} rows)")
        await page.click('[data-preorder="0"]'); await page.wait_for_timeout(250)
        t = await toast_text(page)
        check(t == "Порядок изменён", "toast after reorder: " + t)
        # 12. reset session + persistence
        await page.click("[data-preset]"); await page.wait_for_timeout(250)
        check(await page.evaluate("!window.__UPG.PM.edited('1B')"), "reset 1B")
        await page.reload(); await page.wait_for_timeout(600)
        check(await page.evaluate("window.__UPG.PM.edited('1A') && window.__UPG.PM.edited('2B') && !window.__UPG.PM.edited('1B')"), "persisted after reload")
        # 13. analysis export reflects edits
        an = await page.evaluate("JSON.stringify(window.__UPG.buildAnalysis().program.sessions['2B'])")
        check('"edited_by_user":true' in an and cid in an and '"added_by_user":true' in an, "agent export includes edits")
        # 14. volume chart uses edits (1A has extra lat raise -> side delts)
        vol = await page.evaluate("JSON.stringify(window.__UPG.weeklyVolume(1, false).sidedelts)")
        check(vol and json.loads(vol)["d"] >= 9, "volume counts added sets: " + vol)
        hov = await page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
        check(not hov, "no horizontal overflow")
        print("console errors:", errs)
        check(not errs, "no console errors")
        print(f"\n{len(OK)} ok, {len(FAIL)} failed")
        await b.close()
asyncio.run(main())
