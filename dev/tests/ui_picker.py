import asyncio, json, re, tempfile, os
from pathlib import Path
from playwright.async_api import async_playwright
APP = "http://localhost:8765/"
ROOT = Path(__file__).resolve().parents[2]
SH = str(ROOT / "dev" / "shots")
OK = []; FAIL = []
def check(c, msg):
    (OK if c else FAIL).append(msg); print(("ok  " if c else "FAIL") + " " + msg)
ISO = "((n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })"

async def fresh(page, tab="plan", extra=None, logs=None):
    await page.goto(APP + "?tab=" + tab); await page.wait_for_timeout(150)
    await page.evaluate("""([x, l]) => { localStorage.clear(); localStorage.setItem('upg3:noLogin','true');
        if (l) localStorage.setItem('upg3:logs', JSON.stringify(l));
        Object.entries(x || {}).forEach(([k, v]) => localStorage.setItem('upg3:' + k, JSON.stringify(v))); }""", [extra, logs])
    await page.reload(); await page.wait_for_timeout(700 if tab == "library" else 450)
async def sheet_title(page):
    return await page.text_content("#sheetTitle")
async def sections(page):
    return await page.evaluate("Array.from(document.querySelectorAll('#pickList .pk-h')).map(h => h.textContent)")
async def section_rows(page, name):
    return await page.evaluate("""(name) => { const out = []; let on = false;
        document.querySelectorAll('#pickList > *').forEach(el => { if (el.classList.contains('pk-h')) on = el.textContent === name; else if (on && el.classList.contains('pk-w')) out.push(el.querySelector('.pk').dataset.v); });
        return out; }""", name)
async def favs(page):
    return json.loads(await page.evaluate("localStorage.getItem('upg3:favs') || '[]'"))
async def open_add(page):
    await page.click('[data-padd]'); await page.wait_for_timeout(450)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 375, "height": 812}, service_workers="block", has_touch=True)
        await ctx.add_init_script("try{localStorage.setItem('upg3:noLogin','true')}catch(e){}")
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)

        # 1. «Упражнения»: звезда в строке, в карточке, чип «Избранное», пустое состояние
        await fresh(page, "library")
        await page.click('[data-libbp="fav"]'); await page.wait_for_timeout(200)
        empty = await page.locator(".lib-favempty").inner_text() if await page.locator(".lib-favempty").count() else ""
        check("Избранного пока нет" in empty and "звезд" in empty and await page.locator(".lib-favempty .empty-ic .ic").count() == 1, "library «Избранное»: empty state with an icon and a hint: " + empty)
        chips = await page.evaluate("Array.from(document.querySelectorAll('[data-libbp]')).map(c => c.dataset.libbp).slice(0, 3)")
        check(chips == ["all", "fav", "prog"], f"«Избранное» chip right after «Все»: {chips}")
        await page.click('[data-libbp="all"]'); await page.wait_for_timeout(200)
        row = page.locator(".lib-item").nth(1)
        name1 = await row.locator(".lib-n").inner_text()
        k1 = await row.locator(".star").get_attribute("data-fav")
        await row.locator(".star").click(); await page.wait_for_timeout(150)
        check(await row.locator(".star").get_attribute("aria-pressed") == "true" and await row.locator(".lib-row").get_attribute("aria-expanded") == "false", "row star toggles on and does not open the row")
        nested = await page.evaluate("document.querySelectorAll('.lib-row button, .lib-row [tabindex]').length")
        check(nested == 0, "library star is a sibling of the row, not nested inside it")
        check(await favs(page) == [k1], f"favs stored newest first: {await favs(page)}")
        # звезда в открытой карточке упражнения
        await page.locator(".lib-row").nth(4).click(); await page.wait_for_timeout(150)
        det = page.locator(".lib-d .lib-fav")
        k2 = await det.get_attribute("data-fav")
        await det.click(); await page.wait_for_timeout(150)
        check(await det.inner_text() == "В избранном" and await det.locator('use[href="#i-star-fill"]').count() == 1 and await page.locator(f'.lib-item .star[data-fav="{k2}"]').get_attribute("aria-pressed") == "true", "detail star toggles and syncs the row star")
        await page.reload(); await page.wait_for_timeout(700)
        check(await favs(page) == [k2, k1] and await page.locator(f'.lib-item .star[data-fav="{k1}"]').get_attribute("aria-pressed") == "true", "favourites persist across reload")
        await page.click('[data-libbp="fav"]'); await page.wait_for_timeout(200)
        n = await page.locator(".lib-row").count()
        check(n == 2 and name1 in await page.locator(".lib-row .lib-n").all_inner_texts(), f"«Избранное» chip lists only favourites: {n}")
        await page.fill("[data-libq]", "zzzz"); await page.wait_for_timeout(400)
        check(await page.locator(".lib-row").count() == 0, "«Избранное» combines with search")
        await page.fill("[data-libq]", ""); await page.wait_for_timeout(400)
        await page.locator(".lib-item .star").first.click(); await page.wait_for_timeout(200)
        check(await page.locator(".lib-row").count() == 1, "un-starring in «Избранное» removes the row")
        await page.locator(".lib-item .star").first.click(); await page.wait_for_timeout(200)
        check(await page.locator(".lib-favempty").count() == 1, "last un-star → empty state")
        # программа: звезда у «Жим ногами» (упражнение программы с привязкой к базе)
        await page.click('[data-libbp="all"]'); await page.fill("[data-libq]", "жим ногами"); await page.wait_for_timeout(450)
        lp = await page.evaluate("Array.from(document.querySelectorAll('.lib-item .star')).map(s => s.dataset.fav).find(k => k === 'legpress') || ''")
        if lp: await page.click('.lib-item .star[data-fav="legpress"]'); await page.wait_for_timeout(150)
        check(lp == "legpress" and "legpress" in await favs(page), "base row linked to a program exercise stars the program id")
        await page.fill("[data-libq]", ""); await page.wait_for_timeout(300)
        for w in (360, 375, 412):
            await page.set_viewport_size({"width": w, "height": 800}); await page.wait_for_timeout(150)
            r = await page.evaluate("""(() => { const rows = Array.from(document.querySelectorAll('.lib-item')).slice(0, 40);
                const before = rows.map(r => { r.querySelector('.star').style.display = 'none'; return r.querySelector('.lib-n').getBoundingClientRect().height; });
                const after = rows.map(r => { r.querySelector('.star').style.display = ''; return r.querySelector('.lib-n').getBoundingClientRect().height; });
                const s = rows[0].querySelector('.star').getBoundingClientRect();
                return { over: document.documentElement.scrollWidth > innerWidth, taller: after.filter((h, i) => h > before[i] + 0.5).length, star: [Math.round(s.width), Math.round(s.height)] }; })()""")
            check(not r["over"] and r["taller"] == 0 and r["star"][0] >= 44 and r["star"][1] >= 44, f"library {w}px: no overflow, star doesn't wrap names, 44px star: {r}")
        await page.set_viewport_size({"width": 375, "height": 812})
        await page.evaluate("window.scrollTo(0,0)")
        await page.click('[data-libbp="fav"]'); await page.wait_for_timeout(150)
        await page.click('[data-libbp="all"]'); await page.wait_for_timeout(150)
        await page.locator(".lib-item .star").nth(0).click(); await page.locator(".lib-item .star").nth(2).click(); await page.wait_for_timeout(150)
        await page.screenshot(path=f"{SH}/wp3_library_favs.png")
        # избранное с id программы: без записи базы и с неоднозначной привязкой — тоже в «Избранном», звезда одна и та же
        await fresh(page, "library", extra={"favs": ["beltsquat", "oh_ext_partial", "pushdown", "ghost_id", "x" * 80]})
        await page.click('[data-libbp="fav"]'); await page.wait_for_timeout(250)
        favrows = await page.evaluate("Array.from(document.querySelectorAll('.lib-item')).map(i => ({ k: i.querySelector('.star').dataset.fav, on: i.querySelector('.star').getAttribute('aria-pressed') }))")
        check([x["k"] for x in favrows] == ["beltsquat", "oh_ext_partial", "pushdown"] and all(x["on"] == "true" for x in favrows) and await page.locator(".lib-favempty").count() == 0, f"program-only and ambiguous-link favourites listed; dangling/oversized ids dropped: {favrows}")
        await page.locator('.lib-row[data-libprog="oh_ext_partial"]').click(); await page.wait_for_timeout(150)
        check(await page.locator('.lib-d .lib-fav[data-fav="oh_ext_partial"]').get_attribute("aria-pressed") == "true", "program row opens a detail with the same star")
        await page.screenshot(path=f"{SH}/final_library_favs.png")
        await page.goto(APP + "?tab=plan"); await page.wait_for_timeout(400)
        await page.click('[data-pd="A"]'); await open_add(page)
        st = await page.evaluate("Array.from(document.querySelectorAll('#pickList .pk-w')).filter(w => w.querySelector('.pk').dataset.v === 'oh_ext_partial').map(w => w.querySelector('.star').getAttribute('aria-pressed'))")
        check(st and all(x == "true" for x in st), f"same exercise, same star in the picker: {st}")
        await page.click('#sheet .sheet-h [data-sa="close"]'); await page.wait_for_timeout(300)

        # 2. подбор: избранное и недавние сверху, звезда не выбирает, исключения, «уже в тренировке»
        logs = {f"__D3___A": {"day": "A", "block": 1, "week": 1, "idx": 0, "ex": {"pullup_w": [{"w": "", "r": "8"}]}},
                f"__D40___B": {"day": "B", "block": 1, "week": 1, "idx": 0, "ex": {"face_pull": [{"w": "10", "r": "15"}]}}}
        d3 = await page.evaluate(f"{ISO}(3)"); d40 = await page.evaluate(f"{ISO}(40)")
        logs = {k.replace("__D3__", d3).replace("__D40__", d40): v for k, v in logs.items()}
        # запись базы без привязки к программе (в сборке часть записей привязана к упражнениям программы)
        await fresh(page, "plan&s=1A"); await open_add(page); await page.wait_for_timeout(600)
        await page.fill('#sheet [data-sq]', "жим")  # база подгружается при первом поиске
        await page.wait_for_function("window.__UPG.LIB.items && window.__UPG.LIB.items.length > 0", timeout=15000)
        DS = await page.evaluate("window.__UPG.LIB.items.find(x => x.bp === 'shoulders' && !window.__UPG.PM.progOf(x.id)).id")
        await page.click('#sheet .sheet-h [data-sa="close"]'); await page.wait_for_timeout(300)
        await fresh(page, "plan", extra={"favs": ["hammer_curl", "ds_" + DS], "recentEx": [{"id": "legext", "at": "2020-01-01T00:00:00Z"}]}, logs=logs)
        await page.click('[data-pd="A"]'); await page.wait_for_timeout(150)
        await open_add(page)
        await page.wait_for_timeout(500)
        sec = await sections(page)
        favr = await section_rows(page, "Избранное"); rec = await section_rows(page, "Недавние")
        check(sec[:2] == ["Избранное", "Недавние"], f"empty search: «Избранное» and «Недавние» on top: {sec[:3]}")
        check(favr == ["hammer_curl", DS], f"favourites: program + base exercise: {favr}")
        check(rec[0] == "pullup_w" and "legext" in rec and "face_pull" not in rec, f"recents: journal (3 days) first, picked earlier after, 40 days ago excluded: {rec}")
        mark = await page.evaluate("document.querySelector('#pickList .pk[data-v=\"hammer_curl\"] .pk-in') ? document.querySelector('#pickList .pk[data-v=\"hammer_curl\"] .pk-in').textContent : ''")
        check(mark == "уже в тренировке", "exercise already in this workout is marked")
        star = page.locator('#pickList .pk-w:has(.pk[data-v="legext"]) .star').first
        await star.click(); await page.wait_for_timeout(200)
        check(await sheet_title(page) == "Добавить упражнение" and "legext" in await favs(page), "star tap in the picker stars and does not pick")
        small = await page.evaluate("Array.from(document.querySelectorAll('#sheet .star, #sheet .pk-f .chip')).filter(x => x.offsetParent).map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }).filter(s => s[0] < 44 || s[1] < 44)")
        check(not small, f"picker stars and chips >= 44: {small[:4]}")
        await page.screenshot(path=f"{SH}/wp3_picker.png")
        # выбор из избранного — запись базы
        await page.click(f'#pickList .pk[data-sa="addpickds"][data-v="{DS}"]'); await page.wait_for_timeout(300)
        check((await sheet_title(page)).startswith("Добавить «"), "pick from favourites (base exercise) → place step")
        await page.click('#sheet [data-sa="addmore"]'); await page.wait_for_timeout(400)
        rec2 = await section_rows(page, "Недавние")
        check(await sheet_title(page) == "Добавить упражнение", "add more → back to picker")
        cid = "ds_" + DS
        favr2 = await section_rows(page, "Избранное")
        inmark = await page.evaluate("(c) => document.querySelector(`#pickList .pk[data-v=\"${c}\"] .pk-in`) !== null", cid)
        check(await page.evaluate("(c) => !!window.PROGRAM.exercises[c]", cid) and cid in favr2 and inmark, f"added base favourite becomes a program exercise, marked in workout: {favr2}")
        # фильтры: «Руки», вместе с поиском, сохраняются между добавлениями
        await page.click('#sheet .pk-f [data-v="upper arms"]'); await page.wait_for_timeout(500)
        ids = await page.evaluate("Array.from(document.querySelectorAll('#pickList .pk')).map(x => x.dataset.v)")
        prog_ok = await page.evaluate("(ids) => ids.filter(i => window.PROGRAM.exercises[i]).every(i => ['biceps','triceps'].includes(window.PROGRAM.exercises[i].m.p[0]))", ids)
        check(len(ids) > 5 and prog_ok and "legpress" not in ids, f"chip «Руки» filters without typing ({len(ids)} rows)")
        await page.fill('#sheet [data-sq]', "сгиб"); await page.wait_for_timeout(700)
        ids2 = await page.evaluate("Array.from(document.querySelectorAll('#pickList .pk')).map(x => x.dataset.v)")
        allarms = await page.evaluate("(ids) => ids.every(i => window.PROGRAM.exercises[i] ? ['biceps','triceps'].includes(window.PROGRAM.exercises[i].m.p[0]) : true)", ids2)
        libarms = await page.evaluate("(ids) => Array.from(document.querySelectorAll('#pickList .pk[data-sa=addpickds]')).every(x => (window.__UPG.LIB.items.find(i => i.id === x.dataset.v) || {}).bp === 'upper arms')", ids2)
        check(len(ids2) > 0 and allarms and libarms, f"filter combines with search ({len(ids2)} rows)")
        await page.fill('#sheet [data-sq]', ""); await page.wait_for_timeout(300)
        await page.locator('#pickList .pk[data-sa="addpick"]').first.click(); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="addmore"]'); await page.wait_for_timeout(400)
        check(await page.locator('#sheet .pk-f .chip.on').get_attribute("data-v") == "upper arms", "filter kept through «Добавить и выбрать ещё»")
        await page.click('#sheet .pk-f [data-v="cardio"]'); await page.wait_for_timeout(300)
        vis = await page.evaluate("(() => { const box = document.querySelector('#sheet .pk-f'), b = box.getBoundingClientRect(), c = box.querySelector('.chip.on').getBoundingClientRect(); return c.left >= b.left - 1 && c.right <= b.right + 1; })()")
        check(vis, "last chip selected → scrolled into view")
        await page.click('#sheet .pk-f [data-v="fav"]'); await page.wait_for_timeout(300)
        fl = await page.evaluate("Array.from(document.querySelectorAll('#pickList .pk')).map(x => x.dataset.v)")
        check("legext" in fl and "hammer_curl" in fl and "pullup_w" not in fl, f"«Избранное» filter: {fl}")
        await page.click('#sheet .pk-f [data-v="recent"]'); await page.wait_for_timeout(300)
        rl = await page.evaluate("Array.from(document.querySelectorAll('#pickList .pk')).map(x => x.dataset.v)")
        check("pullup_w" in rl and rl[0] != "pullup_w", f"«Недавние» filter, freshly picked first: {rl[:4]}")
        await page.click('#sheet .sheet-h [data-sa="close"]'); await page.wait_for_timeout(350)

        # 3. замена: похожие первыми, затем избранное/недавние; заменяемое исключено; выбор работает
        await page.evaluate("window.__UPG.PM.reset('1A')"); await page.evaluate("window.__UPG.render()"); await page.wait_for_timeout(150)
        await page.evaluate("(c) => localStorage.setItem('upg3:favs', JSON.stringify(['legpress', 'hammer_curl', c]))", cid)
        await page.reload(); await page.wait_for_timeout(500)
        if await page.locator('.sess-list').count(): await page.click('[data-pd="A"]'); await page.wait_for_timeout(150)  # перезагрузка открывает тот же экран
        await page.click('.pr-open[data-pi="1:0"]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="replace"]'); await page.wait_for_timeout(500)
        sec = await sections(page)
        favr = await section_rows(page, "Избранное")
        check(sec[0].startswith("Похожие") and "Избранное" in sec and sec.index("Избранное") > 0, f"replace: alternatives first, then favourites: {sec}")
        check("legpress" not in favr and "hammer_curl" in favr, f"replaced exercise excluded from favourites: {favr}")
        await page.click('#pickList .pk[data-sa="pick"][data-v="hammer_curl"]'); await page.wait_for_timeout(350)
        ex0 = await page.evaluate("window.__UPG.sessOf('1A').groups[1].items[0].ex")
        rec = json.loads(await page.evaluate("localStorage.getItem('upg3:recentEx')"))
        check(ex0 == "hammer_curl" and rec[0]["id"] == "hammer_curl", f"pick from favourites in replace works and is recorded: {ex0}")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        # «Сегодня» → заменить: тоже с избранным
        await page.goto(APP + "?tab=today"); await page.wait_for_timeout(400)
        await page.click('button[data-day="B"]'); await page.wait_for_timeout(150)
        await page.locator('[data-rep]').first.click(); await page.wait_for_timeout(500)
        check("Избранное" in await sections(page), "Today replace sheet shows favourites too")
        planB = await page.evaluate("JSON.stringify(window.__UPG.sessOf('1B').groups)")
        pk = await page.locator('#pickList .pk[data-sa="pick"]').nth(1).get_attribute("data-v")
        await page.locator('#pickList .pk[data-sa="pick"]').nth(1).click(); await page.wait_for_timeout(350)
        rec = json.loads(await page.evaluate("localStorage.getItem('upg3:recentEx')"))
        check(rec[0]["id"] == pk and await page.evaluate("JSON.stringify(window.__UPG.sessOf('1B').groups)") == planB and "B|" in await page.evaluate("localStorage.getItem('upg3:daySw')"), f"Today replace «только сегодня»: recorded as recent ({pk}), program unchanged")
        await page.locator('[data-rep]').first.click(); await page.wait_for_timeout(450)
        await page.click('#sheet [data-sa="scope"][data-v="here"]'); await page.wait_for_timeout(150)
        pk2 = await page.locator('#pickList .pk[data-sa="pick"]').nth(1).get_attribute("data-v")
        await page.locator('#pickList .pk[data-sa="pick"]').nth(1).click(); await page.wait_for_timeout(350)
        rec = json.loads(await page.evaluate("localStorage.getItem('upg3:recentEx')"))
        check(rec[0]["id"] == pk2 and pk2 in await page.evaluate("JSON.stringify(window.__UPG.sessOf('1B').groups)"), f"Today replace «насовсем»: program changed and recorded ({pk2})")

        # 4. ключи только на устройстве: не в синхронизации; избранное — в резервной копии
        sync_src = (ROOT / "src" / "sync.js").read_text(); app_src = (ROOT / "src" / "app.js").read_text()
        spec = re.findall(r"^\s{4}(\w+): \{ kind:", sync_src.split("const SPEC = {")[1].split("};")[0], re.M)
        check(spec and "favs" not in spec and "recentEx" not in spec and "plan" in spec, f"favs/recentEx not in sync SPEC {spec}")
        await page.goto(APP + "?tab=settings"); await page.wait_for_timeout(400)
        async with page.expect_download() as dl:
            await page.click('[data-export]')
        data = json.loads(Path(await (await dl.value).path()).read_text())
        check(isinstance(data.get("favs"), list) and "hammer_curl" in data["favs"] and "recentEx" not in data, f"export file: favs included, recentEx not ({len(data.get('favs', []))} favs)")
        tmp = os.path.join(tempfile.mkdtemp(), "backup.json")
        own = await favs(page)
        Path(tmp).write_text(json.dumps({"app": "upgrade-v3", "favs": ["face_pull", "hammer_curl", "y" * 200, 42, "no_such_exercise", "<b>x</b>", "ds_99999999"]}))
        await page.set_input_files('[data-import]', tmp); await page.wait_for_timeout(400)
        f2 = await favs(page)
        check(set(own) | {"face_pull"} == set(f2) and len(f2) == len(set(f2)) and f2.index("face_pull") >= len(own), f"import merges valid favourites after your own, drops malformed/unknown ids: {f2}")

        # 5. ширины и тёмная тема
        await page.goto(APP + "?tab=plan&s=1A"); await page.wait_for_timeout(400)
        await open_add(page); await page.wait_for_timeout(400)
        for w in (360, 375, 412):
            await page.set_viewport_size({"width": w, "height": 800}); await page.wait_for_timeout(150)
            ov = await page.evaluate("document.documentElement.scrollWidth > innerWidth || document.getElementById('sheetBody').scrollWidth > document.getElementById('sheetBody').clientWidth")
            check(not ov, f"picker: no horizontal overflow at {w}px")
        await page.set_viewport_size({"width": 375, "height": 812})
        print("console errors:", errs)
        check(not errs, "no console errors")
        dark = await b.new_context(viewport={"width": 375, "height": 812}, service_workers="block", has_touch=True, color_scheme="dark")
        await dark.add_init_script("try{localStorage.setItem('upg3:noLogin','true'); localStorage.setItem('upg3:favs', JSON.stringify(['hammer_curl','legext']))}catch(e){}")
        dp = await dark.new_page()
        await dp.goto(APP + "?tab=plan&s=1A"); await dp.wait_for_timeout(500)
        await dp.click('[data-padd]'); await dp.wait_for_timeout(500)
        await dp.screenshot(path=f"{SH}/wp3_picker_dark.png")
        con = await dp.evaluate("""(() => { const lum = (c) => { const v = c.match(/\\d+(\\.\\d+)?/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
            const bg = getComputedStyle(document.querySelector('.sheet-p')).backgroundColor, on = getComputedStyle(document.querySelector('#sheet .star.on')).color, off = getComputedStyle(document.querySelector('#sheet .star:not(.on)')).color;
            const r = (a, b) => { const x = lum(a), y = lum(b); return Math.round(((Math.max(x, y) + .05) / (Math.min(x, y) + .05)) * 10) / 10; };
            return { on: r(on, bg), off: r(off, bg), differ: on !== off }; })()""")
        check(con["on"] >= 3 and con["off"] >= 3 and con["differ"], f"dark theme: star on/off legible and distinct: {con}")
        print(f"\n{len(OK)} ok, {len(FAIL)} failed")
        await b.close()
asyncio.run(main())
