import asyncio, json
from playwright.async_api import async_playwright
APP = "http://localhost:8765/"
SH = str(__import__("pathlib").Path(__file__).resolve().parents[1] / "shots")
OK = []; FAIL = []
def check(c, msg):
    (OK if c else FAIL).append(msg); print(("ok  " if c else "FAIL") + " " + msg)
STR = "['pair','tri','circuit','single','giant'].includes(g.kind)"
TODAY = "(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })()"

async def item(page, key, gi, ii):
    return await page.evaluate(f"JSON.parse(JSON.stringify(window.__UPG.sessOf('{key}').groups[{gi}].items[{ii}]))")
async def exlist(page, key):
    return await page.evaluate(f"window.__UPG.sessOf('{key}').groups.filter(g => g.items && {STR}).map(g => g.items.map(it => it.weekAlt ? it.weekAlt.map(w => w.ex).join('/') : it.ex).join(','))")
async def kinds(page, key):
    return await page.evaluate(f"window.__UPG.sessOf('{key}').groups.map(g => g.kind).join(',')")
async def edited(page, key):
    return await page.evaluate(f"window.__UPG.PM.edited('{key}')")
async def toast_text(page):
    return await page.evaluate("document.getElementById('toast').hidden ? '' : document.getElementById('toastT').textContent")
async def sheet_open(page):
    return await page.evaluate("!document.getElementById('sheet').hidden && document.getElementById('sheet').classList.contains('open')")
async def close_sheet(page):
    await page.click('#sheet .sheet-h [data-sa="close"]'); await page.wait_for_timeout(350)
async def pick(page, b, d):
    await page.click(f'[data-pb="{b}"]'); await page.click(f'[data-pd="{d}"]'); await page.wait_for_timeout(150)
async def fresh(page, extra=None, logs=None, tab="plan"):
    await page.goto(APP + "?tab=" + tab); await page.wait_for_timeout(150)
    await page.evaluate("""([x, l]) => { localStorage.clear(); localStorage.setItem('upg3:noLogin','true');
        if (l) localStorage.setItem('upg3:logs', JSON.stringify(l));
        Object.entries(x || {}).forEach(([k, v]) => localStorage.setItem('upg3:' + k, JSON.stringify(v))); }""", [extra, logs])
    await page.reload(); await page.wait_for_timeout(450)
async def sheet_fit(page):
    return await page.evaluate("""(() => { const p = document.querySelector('#sheet .sheet-p').getBoundingClientRect(), bd = document.getElementById('sheetBody'),
        rm = document.querySelector('#sheet [data-sa="remove"]').getBoundingClientRect();
        return { h: Math.round(p.height), top: Math.round(p.top), scroll: bd.scrollHeight, client: bd.clientHeight, removeBottom: Math.round(rm.bottom), vh: innerHeight }; })()""")
CHIPS_OK = """(sel) => Array.from(document.querySelectorAll(sel)).map(box => { const b = box.getBoundingClientRect(), cs = Array.from(box.querySelectorAll('.chip'));
    return { n: cs.length, first: cs[0] && cs[0].textContent, scroll: box.scrollWidth - box.clientWidth, lines: new Set(cs.map(c => Math.round(c.getBoundingClientRect().top))).size,
      hidden: cs.filter(c => { const r = c.getBoundingClientRect(); return r.right > b.right + 1 || r.left < b.left - 1; }).map(c => c.textContent),
      onVisible: cs.filter(c => c.classList.contains('on')).every(c => { const r = c.getBoundingClientRect(); return r.right <= b.right + 1 && r.width > 0; }) }; })"""
SMALL = """(sel) => Array.from(document.querySelectorAll(sel)).filter(x => x.offsetParent).map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), x.textContent.trim().slice(0, 18)]; }).filter(s => s[0] < 44 || s[1] < 44)"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 375, "height": 812}, service_workers="block", has_touch=True)
        await ctx.add_init_script("try{localStorage.setItem('upg3:noLogin','true')}catch(e){}")  # без экрана входа
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        await fresh(page)

        # 1. быстрый редактор в строке: подходы за 2 касания, без тостов, отмена — в редакторе
        await page.click('[data-qopen="1:0"]'); await page.wait_for_timeout(150)
        check(await page.locator(".qe-box").count() == 1 and not await sheet_open(page), "scheme tap opens inline editor, no sheet")
        check(await page.locator('.qe-box [data-qundo]').is_disabled(), "footer undo disabled before any change")
        await page.click('.qe-box [data-qb="s+"]'); await page.wait_for_timeout(150)
        it = await item(page, "1A", 1, 0)
        check(it["sets"] == 4 and it.get("chg") == 1, f"sets +1 in 2 taps: {it['sets']}")
        check(await toast_text(page) == "" and not await page.locator('.qe-box [data-qundo]').is_disabled(), "no toast per tap; footer undo enabled")
        small = await page.evaluate(SMALL, ".qe-box button:not(.lnk)")
        check(not small, f"inline controls >= 44x44: {small}")
        await page.screenshot(path=f"{SH}/wp2r_inline.png")
        ch = await page.evaluate(CHIPS_OK, ".qe-box .qe-pre, .qe-box .qe-rir")
        check(all(c["scroll"] <= 0 and not c["hidden"] and c["onVisible"] and c["lines"] <= 2 for c in ch) and ch[1]["first"] == "—", f"chip rows wrap (≤2 lines), selected visible, «—» first: {ch}")
        await page.click('.qe-box .chip[data-qe="reps"][data-v="8–10"]'); await page.wait_for_timeout(120)
        check((await item(page, "1A", 1, 0))["reps"] == "8–10", "reps preset 10–12 → 8–10 in one tap")
        await page.click('.qe-box [data-qb="b+"]'); await page.wait_for_timeout(100)
        await page.click('.qe-box [data-qb="a-"]'); await page.wait_for_timeout(100)
        check((await item(page, "1A", 1, 0))["reps"] == "7–11", "reps range steppers: 7–11")
        for _ in range(4):
            await page.click('.qe-box [data-qb="b-"]'); await page.wait_for_timeout(80)
        check((await item(page, "1A", 1, 0))["reps"] == "7", "min = max → single value '7'")
        await page.click('.qe-box [data-qb="a+"]'); await page.wait_for_timeout(80)
        check((await item(page, "1A", 1, 0))["reps"] == "8", "raising min above max pushes max: '8'")
        await page.click('.qe-box .chip[data-qe="rir"][data-v="0–1"]'); await page.wait_for_timeout(100)
        check((await item(page, "1A", 1, 0))["rir"] == "0–1", "RIR chip")
        await page.click('.qe-box .chip[data-qe="rir"][data-v=""]'); await page.wait_for_timeout(100)
        check((await item(page, "1A", 1, 0))["rir"] is None, "RIR — clears")
        await page.click('.qe-box [data-qundo]'); await page.wait_for_timeout(200)
        it = await item(page, "1A", 1, 0)
        check(it["sets"] == 3 and it["reps"] == "10–12" and it["rir"] == "2" and not await edited(page, "1A") and await page.locator('.qe-box [data-qundo]').is_disabled(), "footer undo restores this exercise (workout not edited)")
        # один открытый редактор, «Готово», Escape
        await page.click('[data-qopen="1:1"]'); await page.wait_for_timeout(120)
        qk = await page.locator(".qe-box").get_attribute("data-qk")
        check(await page.locator(".qe-box").count() == 1 and qk.startswith("1:1"), "only one inline editor open: " + qk)
        await page.click('.qe-box [data-qopen="1:1"]'); await page.wait_for_timeout(120)
        check(await page.locator(".qe-box").count() == 0, "«Готово» closes editor")
        await page.click('[data-qopen="1:1"]'); await page.wait_for_timeout(120)
        await page.keyboard.press("Escape"); await page.wait_for_timeout(120)
        check(await page.locator(".qe-box").count() == 0, "Escape closes editor")
        # свободный текст: ввёл и сразу нажал — значение сохранено и нажатие сработало
        await page.evaluate("window.__UPG.PM.setParams('1A', 1, 1, '', { reps: '6 на сторону' })")
        await page.click('[data-pd="B"]'); await page.click('[data-pd="A"]'); await page.wait_for_timeout(100)
        await page.click('[data-qopen="1:1"]'); await page.wait_for_timeout(120)
        check(await page.locator('.qe-box #qeReps').count() == 1 and await page.input_value('#qeReps') == "6 на сторону" and await page.locator('.qe-box [data-qb="a+"]').count() == 0, "free-text reps → text field, no steppers")
        await page.fill('#qeReps', ""); await page.type('#qeReps', "8 на сторону")
        await page.click('.qe-box [data-qopen="1:1"]'); await page.wait_for_timeout(200)
        check((await item(page, "1A", 1, 1))["reps"] == "8 на сторону" and await page.locator(".qe-box").count() == 0, "type then tap «Готово»: saved AND closed")
        await page.click('[data-qopen="1:1"]'); await page.wait_for_timeout(120)
        await page.fill('#qeReps', ""); await page.type('#qeReps', "10 на сторону")
        await page.click('.qe-box .chip[data-qe="rir"][data-v="2"]'); await page.wait_for_timeout(200)
        it = await item(page, "1A", 1, 1)
        check(it["reps"] == "10 на сторону" and it["rir"] == "2", f"type then tap RIR chip: both saved {it['reps']} / {it['rir']}")
        await page.keyboard.press("Escape")
        # варианты по неделям (2B: становая / румынская)
        await pick(page, 2, "B")
        loc = await page.evaluate("(() => { const gs = window.__UPG.sessOf('2B').groups; for (let gi = 0; gi < gs.length; gi++) { const ii = (gs[gi].items || []).findIndex(it => it.weekAlt); if (ii >= 0) return gi + ':' + ii; } })()")
        gi, ii = map(int, loc.split(":"))
        await page.click(f'[data-qopen="{loc}"]'); await page.wait_for_timeout(120)
        check(await page.locator('.qe-box [data-qv]').count() == 2, "weekAlt: variant switch in inline editor")
        w0 = (await item(page, "2B", gi, ii))["weekAlt"]
        await page.click('.qe-box [data-qv="1"]'); await page.wait_for_timeout(100)
        await page.click('.qe-box [data-qb="s+"]'); await page.wait_for_timeout(120)
        w1 = (await item(page, "2B", gi, ii))["weekAlt"]
        check(w1[1]["sets"] == w0[1]["sets"] + 1 and w1[0]["sets"] == w0[0]["sets"], f"weekAlt variant 2 sets only: {w0[1]['sets']}→{w1[1]['sets']}")
        # секунды: шаг 5
        await pick(page, 3, "A")
        await page.click('[data-qopen="1:1"]'); await page.wait_for_timeout(120)
        lab = await page.locator('.qe-box .qe-r .fl').nth(1).inner_text()
        await page.click('.qe-box [data-qb="b+"]'); await page.wait_for_timeout(120)
        check(lab == "Секунды" and (await item(page, "3A", 1, 1))["reps"] == "10–15 с", f"seconds step 5: {lab} {(await item(page, '3A', 1, 1))['reps']}")
        await page.click('.pr-open[data-pi="1:0"]'); await page.wait_for_timeout(350)
        check(await sheet_open(page) and await page.locator(".qe-box").count() == 0, "name tap opens full sheet (inline editor closes)")
        await close_sheet(page)
        # редактор у нижнего края — прокручивается над нижним меню
        await pick(page, 1, "A")
        await page.evaluate("window.scrollTo(0, 0)"); await page.wait_for_timeout(100)
        last = await page.evaluate("(() => { const nav = document.querySelector('.nav').getBoundingClientRect().top; const qs = Array.from(document.querySelectorAll('.pr-q')).filter(q => q.getBoundingClientRect().bottom < nav); return qs[qs.length - 1].dataset.qopen; })()")
        await page.click(f'[data-qopen="{last}"]'); await page.wait_for_timeout(700)
        pos = await page.evaluate("(() => ({ box: Math.round(document.querySelector('.qe-box').getBoundingClientRect().bottom), nav: Math.round(document.querySelector('.nav').getBoundingClientRect().top) }))()")
        check(pos["box"] <= pos["nav"], f"editor opened near the bottom scrolls above the nav: {pos}")
        await page.keyboard.press("Escape")

        # 2. редактор держится за упражнение: изменение плана снаружи закрывает его, правок чужого упражнения нет
        await fresh(page)
        await page.click('[data-qopen="2:0"]'); await page.wait_for_timeout(120)   # Жим лёжа
        await page.evaluate("""(() => { const g = JSON.parse(JSON.stringify(window.PROGRAM.sessions['1A'].groups)); g[1].items.splice(0, 2);
            window.Store.applyRemote({ plan: { v: 1, s: { '1A': { g, at: new Date().toISOString(), ver: 'x' } }, x: {} } }); })()""")
        await page.wait_for_timeout(250)
        check(await page.locator(".qe-box").count() == 0, "remote plan change (items removed above) closes the editor")
        before = json.dumps(await page.evaluate("window.__UPG.sessOf('1A').groups"))
        check(await page.locator('.qe-box [data-qb="s+"]').count() == 0 and json.dumps(await page.evaluate("window.__UPG.sessOf('1A').groups")) == before, "no edit lands on another exercise")
        # отмена в редакторе — только своего упражнения, чужую правку не трогает
        await fresh(page)
        await page.evaluate("window.__UPG.PM.setParams('1A', 1, 1, '', { sets: 5 })")
        await page.click('[data-pd="B"]'); await page.click('[data-pd="A"]'); await page.wait_for_timeout(100)
        await page.click('[data-qopen="1:0"]'); await page.click('.qe-box [data-qb="s+"]'); await page.wait_for_timeout(120)
        await page.click('.qe-box [data-qundo]'); await page.wait_for_timeout(150)
        check((await item(page, "1A", 1, 0))["sets"] == 3 and (await item(page, "1A", 1, 1))["sets"] == 5, "item-scoped undo keeps the other exercise's edit")
        await page.click('.qe-box [data-qb="s+"]'); await page.wait_for_timeout(120)
        await page.evaluate("""(() => { const d = JSON.parse(localStorage.getItem('upg3:plan')); d.s['2B'] = { g: JSON.parse(JSON.stringify(window.PROGRAM.sessions['2B'].groups)), at: new Date().toISOString(), ver: 'x' };
            d.s['2B'].g[1].items[0].sets = 9; window.Store.applyRemote({ plan: d }); })()""")
        await page.wait_for_timeout(250)
        check(await page.locator(".qe-box").count() == 0 and (await item(page, "2B", 1, 0))["sets"] == 9 and (await item(page, "1A", 1, 0))["sets"] == 4, "concurrent remote change kept; editor closed so its undo can't discard it")

        # 3. шторка упражнения: худший случай (варианты + «Вернуть» + корректировка агента)
        await fresh(page, extra={"adjust": [{"id": "t1", "title": "Плечо", "enabled": True, "changes": [{"exercise": "machine_press", "sets": 2}]}]})
        await page.evaluate("window.__UPG.PM.replace('1A', 2, 0, '', 'machine_press', false)")
        await page.click('[data-pd="B"]'); await page.click('[data-pd="A"]'); await page.wait_for_timeout(100)
        await page.click('.pr-open[data-pi="2:0"]'); await page.wait_for_timeout(400)
        parts = await page.evaluate("[!!document.querySelector('#sheet .sh-var'), !!document.querySelector('#sheet [data-sa=revert]'), !!document.querySelector('#sheet .sh-adj')]")
        f = await sheet_fit(page)
        check(all(parts) and f["scroll"] <= f["client"] + 1 and f["removeBottom"] <= f["vh"], f"worst-case sheet fits 375×812 without scroll {parts}: {f}")
        small = await page.evaluate(SMALL, "#sheet .sh-var button, #sheet .sh-adj .lnk, #sheet .sheet-h .icon-btn:not([hidden]), #sheet .qe button")
        check(not small, f"sheet targets >= 44: {small}")
        await page.screenshot(path=f"{SH}/wp2r_sheet_worst.png")
        await page.click('#sheet .sh-more summary'); await page.wait_for_timeout(120)
        small = await page.evaluate(SMALL, "#sheet .sh-groups .chip")
        check(not small, f"связка chips >= 44: {small}")
        await close_sheet(page)
        await page.set_viewport_size({"width": 360, "height": 740}); await page.wait_for_timeout(150)
        await page.click('.pr-open[data-pi="2:0"]'); await page.wait_for_timeout(400)
        await page.evaluate("document.getElementById('sheetBody').scrollTop = 1e5"); await page.wait_for_timeout(100)
        rb = await page.evaluate("Math.round(document.querySelector('#sheet [data-sa=remove]').getBoundingClientRect().bottom)")
        check(rb <= 740, f"360×740: «Убрать» reachable by scrolling the sheet (bottom {rb})")
        await close_sheet(page)
        await page.set_viewport_size({"width": 375, "height": 812})
        # «Ещё» закрыт по умолчанию и не закрывается от правки
        await page.click('.pr-open[data-pi="1:0"]'); await page.wait_for_timeout(350)
        check(await page.locator('#sheet .sh-more').get_attribute("open") is None, "«Ещё» collapsed by default")
        await page.click('#sheet .sh-more summary'); await page.wait_for_timeout(120)
        await page.click('#sheet [data-qb="s+"]'); await page.wait_for_timeout(150)
        check(await page.locator('#sheet .sh-more').get_attribute("open") is not None, "«Ещё» stays open after a change while sheet is open")
        acts = await page.evaluate("Array.from(document.querySelectorAll('#sheet [data-sa]')).map(x => x.dataset.sa)")
        check(all(a in acts for a in ["replace", "sets", "reps", "rir", "move", "swapwith", "togroup", "remove"]), "sheet keeps actions: " + ",".join(sorted(set(acts))))
        await close_sheet(page)

        # 4. копирование: только силовая часть, у получателя свои разминка/интервалы/финиш
        await fresh(page)
        await page.click('[data-qopen="1:0"]'); await page.click('.qe-box [data-qb="s+"]'); await page.keyboard.press("Escape"); await page.wait_for_timeout(100)
        src = await exlist(page, "1A")
        warm2A = json.dumps(await page.evaluate("window.PROGRAM.sessions['2A'].groups[0]"))
        await page.click('[data-pday]'); await page.wait_for_timeout(350)
        check((await page.text_content("#sheetTitle")) == "Тренировка A · блок 1", "«Действия» opens the day menu")
        await page.click('#sheet [data-sa="dcopy"]'); await page.wait_for_timeout(250)
        check(await page.locator('#sheet [data-sa="cto"][data-v="1A"]').is_disabled() and await page.locator('#sheet [data-sa="cdo"]').is_disabled(), "source disabled; copy disabled until a target is picked")
        await page.click('#sheet [data-sa="cquick"][data-v="day"]'); await page.click('#sheet [data-sa="cto"][data-v="1C"]'); await page.wait_for_timeout(150)
        on = await page.evaluate("Array.from(document.querySelectorAll('#sheet .cp-c.on')).map(x => x.dataset.v)")
        warn = await page.text_content('#sheet .cp-warn')
        check(on == ["1C", "2A", "3A"] and "Силовая часть заменится" in warn and "останутся свои" in warn, f"targets + warning: {on} | {warn}")
        await page.screenshot(path=f"{SH}/wp2r_copy.png")
        await page.click('#sheet [data-sa="cdo"]'); await page.wait_for_timeout(350)
        t = await page.locator('.p-undo').inner_text() if await page.locator('.p-undo').count() else ""
        check(t.startswith("Скопировано: A, блок 1 → C, блок 1; A, блок 2; A, блок 3") and await toast_text(page) == "", "copy: undo banner (no toast on top): " + t)
        check(await exlist(page, "2A") == src and await exlist(page, "1C") == src, "strength part equals source")
        check(await kinds(page, "1C") == "n4x4,pair,pair,tri,pair,pair,pair,skill", "A → C keeps C's intervals and skill: " + await kinds(page, "1C"))
        check(json.dumps(await page.evaluate("window.__UPG.sessOf('2A').groups[0]")) == warm2A, "A1 → A2 keeps block 2's own warm-up")
        await pick(page, 2, "A")
        tags = await page.evaluate("Array.from(document.querySelectorAll('.prow')).slice(0, 2).map(r => Array.from(r.querySelectorAll('.tag')).map(t => t.textContent).join('+'))")
        check(tags == ["изменено", "добавлено"], f"2A markers: legpress (other scheme) изменено, deadbug (not in 2A) добавлено: {tags}")
        await pick(page, 3, "A")
        tags3 = await page.evaluate("""(() => { const base = new Set(); window.PROGRAM.sessions['3A'].groups.forEach(g => (g.items || []).forEach(it => (it.weekAlt ? it.weekAlt.map(w => w.ex) : [it.ex]).forEach(x => base.add(x))));
            const s = window.__UPG.sessOf('3A'); const rows = Array.from(document.querySelectorAll('.prow'));
            let k = 0, bad = []; s.groups.forEach(g => { if (!['pair','tri','circuit','single','giant'].includes(g.kind)) return; g.items.forEach(it => { const tags = Array.from(rows[k++].querySelectorAll('.tag')).map(t => t.textContent);
              const ok = base.has(it.ex) ? !tags.includes('добавлено') && (tags.includes('изменено') || !it.chg) : tags.includes('добавлено'); if (!ok) bad.push(it.ex + ':' + tags.join('+')); }); });
            return { n: k, bad }; })()""")
        check(tags3["n"] == 13 and not tags3["bad"], f"3A markers: not in 3A program → добавлено, in it → never добавлено (изменено when params differ): {tags3}")
        # баннер «Отменить» живёт 3 минуты и переживает смену вкладки
        await page.click('.nav [data-tab="today"]'); await page.wait_for_timeout(200); await page.click('.nav [data-tab="plan"]'); await page.wait_for_timeout(200)
        check(await page.locator('.p-undo [data-pundo]').count() == 1, "undo banner survives tab switch")
        await page.click('.p-undo [data-pundo]'); await page.wait_for_timeout(250)
        check(not await edited(page, "2A") and not await edited(page, "3A") and not await edited(page, "1C") and await edited(page, "1A") and await page.locator('.p-undo').count() == 0, "banner undo reverts the whole copy")
        # C → A: у A остаются разминка и финиш
        await page.evaluate("window.__UPG.PM.copy('1C', ['1A'])")
        check(await kinds(page, "1A") == "warmup,pair,pair,tri,sprint,z2", "C → A keeps A's warm-up and finishers: " + await kinds(page, "1A"))
        # снаружи изменили план — баннер пропадает
        await page.evaluate("window.__UPG.PM.reset('1A')")
        await pick(page, 1, "A")
        await page.click('[data-pday]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="dclear"]'); await page.click('#sheet [data-sa="dcleardo"]'); await page.wait_for_timeout(300)
        check(await page.locator('.p-undo').count() == 1, "clear shows the undo banner")
        await page.evaluate("(() => { const d = JSON.parse(localStorage.getItem('upg3:plan')); d.s['3C'] = { g: window.PROGRAM.sessions['3C'].groups, at: 'x', ver: 'x' }; window.Store.applyRemote({ plan: d }); })()")
        await page.wait_for_timeout(250)
        check(await page.locator('.p-undo').count() == 0, "external plan change invalidates the undo banner")
        # пустой источник: копировать нечего; очистка пустой — без изменений
        await page.click('[data-pday]'); await page.wait_for_timeout(300)
        check(await page.locator('#sheet [data-sa="dcopy"]').is_disabled() and "копировать нечего" in await page.text_content('#sheet [data-sa="dcopy"]'), "copy disabled for an empty source, with reason")
        await close_sheet(page)
        snap = await page.evaluate("window.__UPG.PM.snapshot()")
        n0 = await page.evaluate("window.__UPG.PM.clear('1A')")
        check(n0 == 0 and await page.evaluate("window.__UPG.PM.snapshot()") == snap, "PM.clear on an empty workout is a no-op")

        # 5. копия и очистка поверх сегодняшней тренировки с записанными подходами
        today = await page.evaluate(TODAY)
        logs = {f"{today}_A": {"day": "A", "block": 1, "week": 1, "idx": 0, "ready": "ok", "time": 90, "ex": {"legpress": [{"w": "41,25", "r": "11"}, {"w": "40", "r": "10"}]}}}
        await fresh(page, logs=logs)
        await pick(page, 1, "B")
        await page.click('[data-pday]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="dcopy"]'); await page.click('#sheet [data-sa="cto"][data-v="1A"]'); await page.wait_for_timeout(150)
        warn = await page.text_content('#sheet .cp-warn'); btn = await page.text_content('#sheet [data-sa="cdo"]')
        check("Сегодня по A, блок 1 уже записано 2 подхода" in warn and btn.startswith("Всё равно скопировать"), f"copy over today's logged workout warns: {warn} | {btn}")
        await page.click('#sheet [data-sa="cdo"]'); await page.wait_for_timeout(300)
        await page.click('.nav [data-tab="today"]'); await page.wait_for_timeout(300)
        await page.click('button[data-day="A"]'); await page.wait_for_timeout(200)
        orph = await page.locator(".orphans").inner_text() if await page.locator(".orphans").count() else ""
        check("Ещё записано сегодня" in orph and "Жим ногами — 41,25×11 · 40×10" in orph and "убрано из тренировки" in orph, "Today shows logged sets of removed exercises: " + orph.replace("\n", " | "))
        await page.locator(".orphans").scroll_into_view_if_needed()
        await page.screenshot(path=f"{SH}/wp2r_today_orphans.png")
        await page.click('[data-planedit]'); await page.wait_for_timeout(300)
        await page.click('[data-pday]'); await page.wait_for_timeout(300); await page.click('#sheet [data-sa="dclear"]'); await page.wait_for_timeout(120)
        conf = await page.text_content('#sheet .sh-confirm')
        check("уже записано 2 подхода" in conf and "Разминка, спринты и кардио в зоне 2 останутся" in conf, "clear confirm: logged sets + what stays: " + conf)
        await close_sheet(page)
        await pick(page, 1, "C")
        await page.click('[data-pday]'); await page.wait_for_timeout(300); await page.click('#sheet [data-sa="dclear"]'); await page.wait_for_timeout(120)
        conf = await page.text_content('#sheet .sh-confirm')
        check("Интервалы 4×4 и навык блока останутся" in conf and "азминк" not in conf, "clear text for C derived from its blocks: " + conf)
        await close_sheet(page)

        # 6. пустая B: «Сегодня» с карточкой, неделя закрывается по A
        await fresh(page, logs=logs)
        await page.evaluate("window.__UPG.PM.clear('1B')")
        c1 = await page.evaluate("window.__UPG.ctxNow().closed")
        await page.evaluate("window.__UPG.PM.reset('1B')")
        c0 = await page.evaluate("window.__UPG.ctxNow().closed")
        check(c1 is True and c0 is False, f"empty mandatory B does not block closing the week (A done): closed={c1}, with B back={c0}")
        await fresh(page, tab="today")
        await page.evaluate("window.__UPG.PM.clear('1B')")
        c2 = await page.evaluate("window.__UPG.ctxNow().closed")
        check(c2 is False, "nothing logged → week not closed even with an empty B")
        await page.click('button[data-day="A"]'); await page.click('button[data-day="B"]'); await page.wait_for_timeout(250)
        check(await page.locator(".t-empty [data-planedit]").count() == 1 and await page.locator(".group .ex[data-ex]").count() == 0 and not errs, "Today: empty-state card with a button to «План»")
        await page.screenshot(path=f"{SH}/wp2r_today_empty.png")
        await page.click(".t-empty [data-planedit]"); await page.wait_for_timeout(300)
        check(await page.locator('[data-pd].on').get_attribute("data-pd") == "B" and await page.locator(".pempty").count() == 1, "card opens «План» on that block/day")

        # 7. собрать с нуля: поиск в фокусе сразу, «ещё», свой вариант повторов, связка
        await page.click('.pempty [data-padd]'); await page.wait_for_timeout(350)
        check(await page.evaluate("document.activeElement && document.activeElement.matches('#sheet [data-sq]')"), "add sheet: search focused on first open")
        names = []
        for i in range(3):
            await page.locator('#sheet [data-sa="addpick"]').nth(i * 3).click(); await page.wait_for_timeout(250)
            names.append((await page.text_content("#sheetTitle"))[len("Добавить «"):-1])
            if i == 1:
                await page.click('#sheet .sh-own summary'); await page.fill('#shARepsT', ""); await page.type('#shARepsT', "8 на сторону")
            if i < 2:
                await page.click('#sheet [data-sa="addmore"]'); await page.wait_for_timeout(300)
                focus = await page.evaluate("document.activeElement && document.activeElement.matches('#sheet [data-sq]') && document.activeElement.value === ''")
                check(names[-1] in await page.locator('#sheet .sh-ok').inner_text() and focus, f"add more #{i + 1}: back to picker, search cleared+focused")
            else:
                await page.click('#sheet [data-sa="adddo"]'); await page.wait_for_timeout(350)
        check(await page.locator(".prow").count() == 3 and (await item(page, "1B", 2, 0))["reps"] == "8 на сторону", "free-text reps while adding (typed then tapped «…выбрать ещё»)")
        check(await kinds(page, "1B") == "warmup,single,single,single,sprint,z2", "added after warm-up, before finisher: " + await kinds(page, "1B"))
        await page.click('.pr-open[data-pi="2:0"]'); await page.wait_for_timeout(300)
        await page.click('#sheet .sh-more summary'); await page.click('#sheet [data-sa="togroup"][data-v="1"]'); await page.wait_for_timeout(200)
        await close_sheet(page)
        check(await kinds(page, "1B") == "warmup,pair,single,sprint,z2" and (await exlist(page, "1B"))[0].count(",") == 1, "superset composed via «В связку A»: " + await kinds(page, "1B"))

        # 8. переименование: только название — не «изменено»; ввёл и сразу нажал кнопку
        await pick(page, 1, "C")
        await page.click('[data-pday]'); await page.wait_for_timeout(350)
        await page.fill('#shTitle', ""); await page.type('#shTitle', "Руки и мотор")
        await page.click('#sheet [data-sa="dcopy"]'); await page.wait_for_timeout(300)
        check((await page.text_content("#sheetTitle")) == "Скопировать тренировку" and await page.evaluate("window.__UPG.sessOf('1C').title") == "Руки и мотор", "type title then tap «Скопировать в…»: saved AND opened")
        await close_sheet(page)
        h2 = await page.text_content(".psess-h h2")
        stored = await page.evaluate("JSON.parse(localStorage.getItem('upg3:plan')).s['1C']")
        check(h2 == "C · Руки и мотор" and not await edited(page, "1C") and stored.get("t") == "Руки и мотор" and stored.get("to") and isinstance(stored.get("g"), list), "rename only: title stored with groups, not reported as edited")
        check(await page.locator('[data-pd="C"] i.ed').count() == 0 and await page.locator(".psess-h ~ .banner").count() == 0, "no edited dot/«Твоя версия» on the renamed day")
        await page.evaluate("window.__UPG.PM.setTitle('3C', 'Только имя')"); await pick(page, 3, "C")
        check(await page.locator('[data-pb="3"] i.ed').count() == 0 and await page.locator('[data-pd="C"] i.ed').count() == 0, "title-only rename: no dot on the block or the day")
        await page.evaluate("window.__UPG.PM.reset('3C')"); await pick(page, 1, "C")
        check(await page.locator('[data-pb="2"] i.ed').count() == 0, "block dot only where there are changes")
        await page.click('[data-qopen="1:0"]'); await page.click('.qe-box [data-qb="s+"]'); await page.keyboard.press("Escape"); await page.wait_for_timeout(120)
        check(await edited(page, "1C") and await page.evaluate("window.__UPG.sessOf('1C').title") == "Руки и мотор", "real edit after rename: edited, title kept")
        await page.goto(APP + "?tab=today"); await page.wait_for_timeout(400)
        await page.click('button[data-day="C"]'); await page.wait_for_timeout(200)
        check((await page.text_content(".th-row h2")) == "C · Руки и мотор", "rename shown on Today")
        await page.click('[data-planedit]'); await page.wait_for_timeout(300)
        await page.click('[data-pday]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="dreset"]'); await page.wait_for_timeout(350)
        check(not await edited(page, "1C") and (await page.text_content(".psess-h h2")) == "C · Мотор + памп", "reset clears edits and title")

        # 9. подсказка дня не ведёт в пустую тренировку
        ago = lambda n: page.evaluate(f"(() => {{ const d = new Date(); d.setDate(d.getDate() - {n}); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }})()")
        d2, d1 = await ago(2), await ago(1)
        wk = {f"{d2}_A": {"day": "A", "block": 1, "week": 1, "idx": 0, "ex": {"legpress": [{"w": "40", "r": "10"}]}}, f"{d1}_B": {"day": "B", "block": 1, "week": 1, "idx": 0, "ex": {"pulldown": [{"w": "50", "r": "10"}]}}}
        await fresh(page, logs=wk)
        await page.evaluate("window.__UPG.PM.clear('1C')")
        s1 = await page.evaluate("window.__UPG.suggestDay()")
        await fresh(page)
        await page.evaluate("window.__UPG.PM.clear('1A')")
        s2 = await page.evaluate("window.__UPG.suggestDay()")
        await page.evaluate("['1A','1B','1C'].forEach(k => window.__UPG.PM.clear(k))")
        s3 = await page.evaluate("window.__UPG.suggestDay()")
        check(s1 != "C" and s2 == "B" and s3 == "A", f"suggestDay skips empty days (empty C → {s1}, empty A → {s2}, all empty → {s3})")
        # тост не лежит поверх шторки; очистка — только баннер
        await fresh(page)
        await page.click('[data-pday]'); await page.wait_for_timeout(300)
        await page.click('#sheet [data-sa="dclear"]'); await page.click('#sheet [data-sa="dcleardo"]'); await page.wait_for_timeout(300)
        check(await toast_text(page) == "" and await page.locator('.p-undo').count() == 1, "clear: no toast, undo banner instead")
        await page.click('.pempty [data-padd]'); await page.wait_for_timeout(400)
        await page.locator('#sheet [data-sa="addpick"]').first.click(); await page.wait_for_timeout(300)
        bt = await page.evaluate("""(() => ['adddo', 'addmore'].map(a => { const b = document.querySelector(`#sheet [data-sa="${a}"]`).getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
            const hit = document.elementFromPoint(x, y); return { bottom: Math.round(b.bottom), hit: !!hit && !!hit.closest(`[data-sa="${a}"]`) }; }))()""")
        check(all(x["hit"] and x["bottom"] <= 812 for x in bt), f"add-place buttons sticky and tappable without scrolling at 375×812: {bt}")
        await page.screenshot(path=f"{SH}/final_addplace_sticky.png")
        await page.click('#sheet [data-sa="adddo"]'); await page.wait_for_timeout(350)
        t = await toast_text(page)
        await page.click('.pr-open[data-pi="1:0"]'); await page.wait_for_timeout(350)
        check(bool(t) and await toast_text(page) == "", f"toast hides when a sheet opens (was «{t}»)")
        # шторка упражнения закрывается, если план изменился на другом устройстве
        await page.evaluate("(() => { const d = JSON.parse(localStorage.getItem('upg3:plan')); d.s['2B'] = { g: window.PROGRAM.sessions['2B'].groups, at: 'x', ver: 'x' }; window.Store.applyRemote({ plan: d }); })()")
        await page.wait_for_timeout(350)
        check(not await sheet_open(page) and "План обновился" in await toast_text(page), "item sheet closes on an external plan change, with a notice")

        # 10. ширины 360–412
        await fresh(page)
        await page.click('[data-qopen="1:0"]'); await page.wait_for_timeout(150)
        for w in (360, 375, 412):
            await page.set_viewport_size({"width": w, "height": 800}); await page.wait_for_timeout(150)
            ov = await page.evaluate("""(() => { const box = document.querySelector('.pgroup').getBoundingClientRect();
                const clip = Array.from(document.querySelectorAll('.qe-box button, .pday, .pr-q')).filter(x => x.getBoundingClientRect().right > box.right + 0.5).length;
                return { page: document.documentElement.scrollWidth > innerWidth, clip }; })()""")
            ch = await page.evaluate(CHIPS_OK, ".qe-box .qe-pre, .qe-box .qe-rir")
            check(not ov["page"] and ov["clip"] == 0 and all(not c["hidden"] and c["lines"] <= 2 for c in ch), f"no overflow at {w}px, chips ≤2 lines: {ov} {[c['lines'] for c in ch]}")
        await page.set_viewport_size({"width": 375, "height": 812})
        print("console errors:", errs)
        check(not errs, "no console errors")

        dark = await b.new_context(viewport={"width": 375, "height": 812}, service_workers="block", has_touch=True, color_scheme="dark")
        await dark.add_init_script("try{localStorage.setItem('upg3:noLogin','true')}catch(e){}")
        dp = await dark.new_page()
        await dp.goto(APP + "?tab=plan"); await dp.wait_for_timeout(500)
        await dp.click('[data-qopen="1:0"]'); await dp.click('.qe-box [data-qb="s+"]'); await dp.wait_for_timeout(150)
        await dp.screenshot(path=f"{SH}/wp2r_inline_dark.png")
        await dp.evaluate("""(() => { localStorage.setItem('upg3:adjust', JSON.stringify([{ id: 't1', title: 'Плечо', enabled: true, changes: [{ exercise: 'machine_press', sets: 2 }] }])); })()""")
        await dp.reload(); await dp.wait_for_timeout(400)
        await dp.evaluate("window.__UPG.PM.replace('1A', 2, 0, '', 'machine_press', false)")
        await dp.click('[data-pd="B"]'); await dp.click('[data-pd="A"]'); await dp.wait_for_timeout(100)
        await dp.click('.pr-open[data-pi="2:0"]'); await dp.wait_for_timeout(400)
        await dp.screenshot(path=f"{SH}/wp2r_sheet_worst_dark.png")
        bg = await dp.evaluate("getComputedStyle(document.body).backgroundColor")
        check(bg != "rgb(244, 245, 242)", "dark theme applied: " + bg)
        print(f"\n{len(OK)} ok, {len(FAIL)} failed")
        await b.close()
asyncio.run(main())
