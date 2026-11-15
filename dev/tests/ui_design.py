"""Дизайн-система v4 (этап A): контраст токенов в обеих темах, цели касания ≥ 44 px на пяти вкладках, без горизонтальной
прокрутки на 360 и 375 px, без текстовых глифов вместо иконок, aria-label у иконочных кнопок, иконки спрайта на месте,
шапка и навигация, тема в «Настройках», системная «назад», первая карточка «Сегодня» без прокрутки."""
import asyncio, json, re, datetime, pathlib
from playwright.async_api import async_playwright
APP = "http://localhost:8765/"
SH = str(pathlib.Path(__file__).resolve().parents[1] / "shots")
OK = []; FAIL = []
def check(c, msg):
    (OK if c else FAIL).append(msg); print(("ok  " if c else "FAIL") + " " + msg)

MONDAY = datetime.date(2026, 11, 16)
CLOCK = """(() => { let s = null; try { s = sessionStorage.getItem('__now'); } catch (e) { /* */ } if (!s) return;
  const R = Date; window.__off = (+s) - R.now();
  function F(...a) { if (!new.target) return new R(R.now() + window.__off).toString(); return a.length ? new R(...a) : new R(R.now() + window.__off); }
  F.now = () => R.now() + window.__off; F.parse = R.parse; F.UTC = R.UTC; F.prototype = R.prototype; window.Date = F; })();"""
NOON = int(datetime.datetime(MONDAY.year, MONDAY.month, MONDAY.day, 12).timestamp() * 1000)

# ---- контраст (WCAG 2) ----
def lum(hexc):
    h = hexc.strip().lstrip("#")
    if len(h) == 3: h = "".join(c * 2 for c in h)
    ch = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    ch = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in ch]
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
def ratio(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)

SURF = ["bg", "surface", "surface-2", "surface-3"]
TEXT_PAIRS = ([("text", s) for s in SURF] + [("muted", s) for s in SURF] + [("faint", s) for s in SURF[:3]]
              + [("accent-text", s) for s in ("bg", "surface", "accent-soft")] + [("accent-ink", "accent")]
              + [("warn", "warn-soft"), ("warn", "surface"), ("danger", "danger-soft"), ("danger", "surface"), ("info", "info-soft"), ("info", "surface")]
              + [("text", s) for s in ("accent-soft", "warn-soft", "danger-soft", "info-soft")] + [("bg", "text")]
              + [("ink-on-color", f"d-{d}") for d in "abcdef"] + [("text", f"d-{d}-soft") for d in "abcdef"])
GRAPHIC_PAIRS = ([("border-strong", s) for s in ("bg", "surface", "surface-2")] + [("accent", "surface"), ("accent", "bg")]
                 + [(f"d-{d}", "surface") for d in "abcdef"] + [(f"d-{d}", f"d-{d}-soft") for d in "abcdef"]
                 + [(f"m-{m}", f"m-{m}-soft") for m in ("chest", "back", "legs", "shoulders", "arms", "core", "cardio")]
                 + [("series", "surface"), ("p1", "surface"), ("p2", "surface")])

GLYPHS = "✎⇄⋯↑↓⇅↩＋✕›‹★☆✓✔⚡♥✦▾▸◂⌫⧉↺≡"
TABS = ["today", "plan", "library", "journal", "more"]

# Элементы, на которые нажимают, и их размер; иконочные кнопки (без текста) — с подписью для чтения с экрана.
TARGETS = """(scope) => { const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden]'); };
  const root = scope ? document.querySelector(scope) : document;
  const els = [...root.querySelectorAll('button, [role=button], a.btn, select, summary, input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), textarea, label.chk, label.btn')].filter(vis)
    .filter(e => !e.closest('#icSprite') && !e.matches('.cite'));
  const small = els.filter(e => { const r = e.getBoundingClientRect(); const txt = e.textContent.trim(); return r.height < 43.5 || (r.width < 43.5 && !txt); })
    .map(e => { const r = e.getBoundingClientRect(); return (e.className || e.tagName) + ' ' + (e.textContent.trim().slice(0, 18) || e.getAttribute('aria-label') || '') + ' ' + Math.round(r.width) + '×' + Math.round(r.height); });
  const unlabeled = els.filter(e => e.matches('button, [role=button]') && !e.textContent.trim() && !(e.getAttribute('aria-label') || '').trim() && !e.getAttribute('aria-labelledby'))
    .map(e => (e.className || e.tagName) + ' ' + e.outerHTML.slice(0, 60));
  return { n: els.length, small: small.slice(0, 12), unlabeled: unlabeled.slice(0, 8) }; }"""
GLYPH_SCAN = """(g) => { const sel = ['#app', '.top', '.nav', '#sheet:not([hidden])', '#tBar:not([hidden])', '#tPanel.open', '#login:not([hidden])', '#toast:not([hidden])'];
  const txt = sel.map(s => document.querySelector(s)).filter(Boolean).map(e => e.innerText).join('\\n');
  return [...new Set([...txt].filter(c => g.includes(c)))].join(''); }"""
# Качество оформления по реальным элементам (после замечаний критика):
#  clip — обрезанные подписи у сегментов и чипов (scrollWidth > clientWidth);
#  accent — сплошная заливка акцентом не у главной кнопки / главной ✓ (и не у служебных: полоса прогресса, клетки цикла);
#  ph — плейсхолдер ниже 4,5:1 к фону поля; border — граница поля ниже 3:1 к фону вокруг;
#  cite — цель касания ссылки-источника < 44 px; cb — чекбокс без цели 44 px (сам или его подпись);
#  dot — строка цели на «Сегодня» начинается с разделителя «·».
QUALITY = r"""() => { const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'); };
  const rgb = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const L = (c) => [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (e, self) => { for (let n = self ? e : e.parentElement; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c && c.a > 0.5) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
  const name = (e) => (e.className && typeof e.className === 'string' ? e.className.split(' ')[0] : e.tagName) + ' «' + (e.textContent || e.placeholder || '').trim().slice(0, 16) + '»';
  const clip = [...document.querySelectorAll('.seg button, .chip')].filter(vis).filter(e => e.scrollWidth > e.clientWidth + 1).map(name);
  const acc = rgb(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().replace(/^#(..)(..)(..)$/, (m, a, b, c) => `rgb(${parseInt(a, 16)}, ${parseInt(b, 16)}, ${parseInt(c, 16)})`));
  const okAcc = '.btn.primary, .log-row.next .set-ok, .prog-bar i, .wk.done, .legend i, .sync-ind';
  const accent = [...document.querySelectorAll('body *')].filter(vis).filter(e => { const c = rgb(getComputedStyle(e).backgroundColor); return c && c.a > 0.9 && acc && c.r === acc.r && c.g === acc.g && c.b === acc.b && !e.matches(okAcc); }).map(name);
  const fields = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), textarea, select')].filter(vis);
  const ph = fields.filter(e => e.placeholder).map(e => [e, ratio(rgb(getComputedStyle(e, '::placeholder').color), bgOf(e, true))]).filter(x => x[1] < 4.5).map(x => name(x[0]) + ' ' + x[1].toFixed(2));
  const border = fields.map(e => { const cs = getComputedStyle(e); const w = parseFloat(cs.borderTopWidth); return [e, w > 0 ? ratio(rgb(cs.borderTopColor), bgOf(e)) : 1]; }).filter(x => x[1] < 3).map(x => name(x[0]) + ' ' + x[1].toFixed(2));
  const cite = [...document.querySelectorAll('a.cite')].filter(vis).filter(e => e.getBoundingClientRect().height < 43.5).map(name);
  const cb = [...document.querySelectorAll('input[type=checkbox]')].filter(vis).filter(e => { const l = e.closest('label'); return Math.max(e.getBoundingClientRect().height, l ? l.getBoundingClientRect().height : 0) < 43.5; }).map(e => name(e.closest('label') || e));
  const dot = [...document.querySelectorAll('.ex-sub .sp')].filter(vis).filter(e => e.textContent.trim().startsWith('·')).map(name);
  return { clip, accent: [...new Set(accent)].slice(0, 6), ph, border, cite: cite.slice(0, 4), cb, dot }; }"""
QBAD = lambda q: {k: v for k, v in q.items() if v}

MISSING_ICONS = """() => [...document.querySelectorAll('use')].map(u => u.getAttribute('href')).filter(h => h && h.startsWith('#') && !document.getElementById(h.slice(1)))"""


async def fresh(page, tab="today", extra=None):
    await page.goto(APP + "?tab=" + tab); await page.wait_for_timeout(120)
    await page.evaluate("ms => sessionStorage.setItem('__now', String(ms))", NOON)
    await page.evaluate("""(x) => { localStorage.clear(); localStorage.setItem('upg3:noLogin', 'true'); if (!x || !('loginHintHidden' in x)) localStorage.setItem('upg3:loginHintHidden', 'true');
        Object.entries(x || {}).forEach(([k, v]) => localStorage.setItem('upg3:' + k, JSON.stringify(v))); }""", extra)
    await page.goto(APP + "?tab=" + tab); await page.wait_for_timeout(450)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True, service_workers="block")
        await ctx.add_init_script(CLOCK)
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)

        # 1. контраст пар токенов в обеих темах
        await fresh(page)
        for theme in ("light", "dark"):
            await page.evaluate("t => document.documentElement.setAttribute('data-theme', t)", theme)
            names = sorted({n for pr in TEXT_PAIRS + GRAPHIC_PAIRS for n in pr})
            tok = await page.evaluate("ns => Object.fromEntries(ns.map(n => [n, getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim()]))", names)
            bad_hex = [n for n, v in tok.items() if not re.fullmatch(r"#[0-9a-fA-F]{6}", v)]
            check(not bad_hex, f"{theme}: tokens are plain hex colours: {bad_hex or 'all'}")
            if bad_hex: continue
            low_t = [f"{a}/{b_}={ratio(tok[a], tok[b_]):.2f}" for a, b_ in TEXT_PAIRS if ratio(tok[a], tok[b_]) < 4.5]
            low_g = [f"{a}/{b_}={ratio(tok[a], tok[b_]):.2f}" for a, b_ in GRAPHIC_PAIRS if ratio(tok[a], tok[b_]) < 3]
            check(not low_t, f"{theme}: text/background pairs ≥ 4.5:1 ({len(TEXT_PAIRS)} pairs): {low_t or 'all'}")
            check(not low_g, f"{theme}: icons/field borders ≥ 3:1 ({len(GRAPHIC_PAIRS)} pairs): {low_g or 'all'}")
            # слои различимы: поверхности не сливаются (поверхность-2 и -3 отличаются от карточки)
            steps = [round(ratio(tok[x], tok[y]), 2) for x, y in (("bg", "surface"), ("surface", "surface-2"), ("surface-2", "surface-3"))]
            check(all(s >= 1.06 for s in steps), f"{theme}: neighbouring surfaces differ: {steps}")
        await page.evaluate("document.documentElement.removeAttribute('data-theme')")

        # 2. шапка и навигация
        nav = await page.evaluate("[...document.querySelectorAll('.nav-i')].map(n => n.textContent.trim())")
        check(nav == ["Сегодня", "Программа", "Упражнения", "Прогресс", "Ещё"], f"bottom nav labels: {nav}")
        pill = await page.evaluate("(() => { const on = document.querySelector('.nav-i.on .nav-pill'), off = document.querySelector('.nav-i:not(.on) .nav-pill'); return [getComputedStyle(on).backgroundColor, getComputedStyle(off).backgroundColor]; })()")
        check(pill[0] != pill[1] and pill[1] in ("rgba(0, 0, 0, 0)", "transparent"), f"active tab has a pill under the icon: {pill}")
        hdr = await page.evaluate("({ theme: !!document.getElementById('themeBtn'), sub: !!document.getElementById('sub'), btns: [...document.querySelectorAll('.top button:not([hidden])')].map(b => b.id) })")
        check(not hdr["theme"] and not hdr["sub"], f"header: no theme switch, no truncated subtitle: {hdr}")

        # 3. первая карточка упражнения без прокрутки (375×812, понедельник, тренировка A)
        top = await page.evaluate("Math.round(document.querySelector('#app .ex[data-ex]').getBoundingClientRect().top)")
        check(top <= 360, f"first exercise card on Today: top = {top} px (≤ 360)")
        await page.screenshot(path=f"{SH}/ui_design_today.png")
        hero = await page.evaluate("(() => { const h = document.querySelector('.hero'); return { tile: h.querySelector('.day-tile').textContent, sub: h.querySelector('.hero-sub').textContent.replace(/\u00a0/g, ' '), edit: !!h.querySelector('[data-planedit]'), chips: h.querySelectorAll('[data-day]').length, time: !!h.querySelector('[data-ctl] .ic') }; })()")
        check(hero["tile"] == "A" and "блок 1" in hero["sub"] and "неделя 1 из 5" in hero["sub"] and hero["edit"] and hero["chips"] == 3 and hero["time"], f"hero card: day tile, programme line, day chips, time button with icon, edit: {hero}")
        head = await page.evaluate("(() => { const h = document.querySelector('#app .ex[data-ex] .log-head'); return h ? h.innerText.replace(/\\s+/g, ' ').trim() : ''; })()")
        check(bool(re.search(r"(Вес|Доп\. вес), кг", head)) and bool(re.search(r"Повторы|Секунды", head)), f"set row has field labels above (not cipher placeholders): «{head}»")
        core = await page.evaluate("[...document.querySelectorAll('#app .tag, #app .tier')].map(t => t.textContent.trim()).filter(t => /ядро/i.test(t))")
        check(not core, f"no «ЯДРО» badge on Today: {core}")
        tiles = await page.evaluate("[...document.querySelectorAll('#app .ex[data-ex] .ex-tile')].map(t => [...t.classList].find(c => c.startsWith('m-')) || 'none')")
        check(tiles and all(t != "none" for t in tiles), f"exercise tiles coloured by muscle group: {sorted(set(tiles))}")
        await page.click('[data-ctl]'); await page.wait_for_timeout(100)
        await page.click('[data-time="90"]'); await page.wait_for_timeout(100)
        tags = await page.evaluate("[...document.querySelectorAll('#app .tier')].map(t => t.textContent.trim())")
        with_ic = await page.evaluate("[...document.querySelectorAll('#app .tier')].every(t => t.querySelector('.ic'))")
        check(tags and set(tags) <= {"от 90 мин", "только 120 мин"} and with_ic, f"optional groups tagged «от 90 мин» / «только 120 мин» with a clock icon: {sorted(set(tags))}")

        # 4. пять вкладок: цели касания, aria-label, глифы, иконки, переполнение (360 и 375)
        for w, h in ((375, 812), (360, 740)):
            await page.set_viewport_size({"width": w, "height": h})
            for tab in TABS:
                await fresh(page, tab)
                if tab == "library": await page.wait_for_timeout(500)
                views = [tab] + (["today:ctl"] if tab == "today" else [])
                if tab == "journal": views = ["journal:progress", "journal:volume", "journal:body"]
                if tab == "plan": views = ["plan:hub", "plan:sess", "plan:sched", "plan:about", "plan:progs"]
                for v in views:
                    if v.startswith("plan:"):
                        sub = v.split(":")[1]
                        if sub != "hub":
                            await page.click('.nav-i[data-tab="plan"]'); await page.wait_for_timeout(150)  # к хабу
                            await page.click('[data-pd="A"]' if sub == "sess" else f'[data-pv="{sub}"]'); await page.wait_for_timeout(250)
                    elif v == "today:ctl":
                        await page.click('[data-ctl]'); await page.wait_for_timeout(150)
                    elif ":" in v:
                        kind, sub = v.split(":")
                        await page.click(f'[data-jtab="{sub}"]'); await page.wait_for_timeout(250)
                    r = await page.evaluate(TARGETS, None)
                    over = await page.evaluate("document.documentElement.scrollWidth - innerWidth")
                    gl = await page.evaluate(GLYPH_SCAN, GLYPHS)
                    miss = await page.evaluate(MISSING_ICONS)
                    check(not r["small"] and not r["unlabeled"] and over <= 0 and not gl and not miss,
                          f"{w}px {v}: {r['n']} targets ≥44 px {r['small'] or 'ok'}, icon buttons labelled {r['unlabeled'] or 'ok'}, overflow {over}, glyphs «{gl}», missing icons {miss}")
                    q = QBAD(await page.evaluate(QUALITY))
                    check(not q, f"{w}px {v}: no clipped segments/chips, solid accent only on the main button, placeholders ≥4.5, field borders ≥3, cite/checkbox targets ≥44, no leading «·»: {q or 'ok'}")
            # подразделы «Ещё»
            await fresh(page, "more")
            for sub in ["cardio", "body", "food", "science", "settings"]:
                await page.click(f'.menu-i[data-tab="{sub}"]'); await page.wait_for_timeout(150)
                r = await page.evaluate(TARGETS, None)
                over = await page.evaluate("document.documentElement.scrollWidth - innerWidth")
                gl = await page.evaluate(GLYPH_SCAN, GLYPHS)
                check(not r["small"] and not r["unlabeled"] and over <= 0 and not gl, f"{w}px more/{sub}: targets {r['small'] or 'ok'}, labels {r['unlabeled'] or 'ok'}, overflow {over}, glyphs «{gl}»")
                q = QBAD(await page.evaluate(QUALITY))
                check(not q, f"{w}px more/{sub}: segments, accent, placeholders, borders, cite/checkbox targets: {q or 'ok'}")
                await page.click("#back"); await page.wait_for_timeout(120)
            labels = await page.evaluate("[...document.querySelectorAll('.nav-i > span:last-child')].map(s => s.scrollWidth <= s.parentElement.clientWidth + 0.5)")
            check(all(labels), f"{w}px: nav labels fit their items: {labels}")

        # 4б. тёмная тема: те же проверки качества на экранах с полями ввода
        await page.set_viewport_size({"width": 360, "height": 740})
        for tab, prep in (("today", "[data-ctl]"), ("library", None), ("journal", '[data-jtab="body"]'), ("settings", None), ("today", None)):
            await fresh(page, tab, {"theme": "dark"})
            if tab == "library": await page.wait_for_timeout(500)
            if prep: await page.click(prep); await page.wait_for_timeout(200)
            q = QBAD(await page.evaluate(QUALITY))
            check(not q, f"dark 360px {tab}{' + ' + prep if prep else ''}: quality {q or 'ok'}")

        # 4в. «Нет входа» — сразу под героем, с «Скрыть», скрытие запоминается
        await page.set_viewport_size({"width": 375, "height": 812})
        await fresh(page, "today", {"loginHintHidden": False})
        pos = await page.evaluate("(() => { const b = document.querySelector('.banner.login-hint'); return b ? { afterHero: b.previousElementSibling && b.previousElementSibling.classList.contains('hero'), n: document.querySelectorAll('.banner.login-hint').length, user: !!b.querySelector('use[href=\"#i-user\"]') } : null; })()")
        if await page.evaluate("!!(window.Sync && window.Sync.configured())"):
            check(pos and pos["afterHero"] and pos["n"] == 1 and pos["user"], f"«data only on this device» banner: once, right under the hero, user icon: {pos}")
            await page.click("[data-hidelogin]"); await page.wait_for_timeout(150); await page.reload(); await page.wait_for_timeout(400)
            check(await page.locator(".banner.login-hint").count() == 0, "«Скрыть» hides the sign-in banner for good (this device)")
            ind = await page.evaluate("document.querySelector('#syncBtn use, #syncBtn circle') ? document.getElementById('syncBtn').innerHTML.includes('circle') : false")
            check(ind, "header indicator for «no sign-in» is a person, not a crossed cloud")
        else:
            check(True, "sign-in banner: sync not configured — skipped")

        # 4г. «Упражнения»: список одной поверхностью, оборудование — чипом со шторкой
        await fresh(page, "library"); await page.wait_for_timeout(500)
        lst = await page.evaluate("(() => { const l = document.querySelector('.lib-list'); const r = l && l.querySelector('.lib-row'); return { list: !!l, rowShadow: r ? getComputedStyle(r).boxShadow : '', h: r ? Math.round(r.getBoundingClientRect().height) : 0, select: !!document.querySelector('#app select') }; })()")
        check(lst["list"] and lst["rowShadow"] == "none" and lst["h"] >= 56 and not lst["select"], f"library list is one surface with dividers, rows ≥ 56 px, no system select: {lst}")
        await page.click("[data-libeqopen]"); await page.wait_for_timeout(350)
        await page.locator('#sheet [data-sa="eqset"]').nth(2).click(); await page.wait_for_timeout(400)
        eq = await page.evaluate("({ label: document.querySelector('[data-libeqopen]').textContent.trim(), on: document.querySelector('[data-libeqopen]').classList.contains('on'), eq: window.__UPG.LIB.eq })")
        check(eq["eq"] != "all" and eq["on"] and eq["label"] != "Оборудование", f"equipment chip → sheet → filter applied: {eq}")
        await page.locator(".lib-row").first.click(); await page.wait_for_timeout(200)
        acts = await page.evaluate("(() => { const d = document.querySelector('.lib-d'); return d && d.firstElementChild.classList.contains('lib-acts') ? [...d.firstElementChild.querySelectorAll('button')].map(b => b.textContent.trim()) : []; })()")
        check("В тренировку" in acts and any("избранн" in a for a in acts), f"opened exercise: actions row on top: {acts}")

        # 5. шторки: замена на «Сегодня», упражнение, связка, тренировка, добавление, таймер
        await page.set_viewport_size({"width": 375, "height": 812})
        await fresh(page)
        async def sheet_ok(label):
            await page.wait_for_timeout(350)
            r = await page.evaluate(TARGETS, "#sheet")
            gl = await page.evaluate(GLYPH_SCAN, GLYPHS)
            over = await page.evaluate("document.getElementById('sheetBody').scrollWidth - document.getElementById('sheetBody').clientWidth")
            q = QBAD(await page.evaluate(QUALITY))
            check(not r["small"] and not r["unlabeled"] and not gl and over <= 0 and not q, f"sheet {label}: targets {r['small'] or 'ok'}, labels {r['unlabeled'] or 'ok'}, glyphs «{gl}», overflow {over}, quality {q or 'ok'}")
        await page.locator("[data-rep]").first.click(); await sheet_ok("replace (Today)")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        await page.click("#timerBtn"); await page.wait_for_timeout(100)
        await page.click('#tPanel [data-t="60"]'); await page.wait_for_timeout(150)
        tb = await page.evaluate(TARGETS, "#tBar")
        check(not tb["small"] and not tb["unlabeled"] and not await page.evaluate(GLYPH_SCAN, GLYPHS), f"timer bar: {tb}")
        await page.click("#tBar [data-stop]"); await page.wait_for_timeout(100)
        await page.click('.nav [data-tab="plan"]'); await page.wait_for_timeout(250)
        await page.click("[data-pmenu]"); await sheet_ok("programme menu (hub)")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        await page.click('[data-pd="A"]'); await page.wait_for_timeout(250)
        await page.click('.pr-open[data-pi="1:0"]'); await sheet_ok("exercise (plan)")
        await page.click('#sheet .sh-more summary'); await sheet_ok("exercise «Ещё» (plan)")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        await page.click('[data-pg="1"]'); await sheet_ok("group (plan)")
        await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        await page.click("[data-pday]"); await sheet_ok("workout actions (plan)")
        await page.click('#sheet [data-sa="dcopy"]'); await sheet_ok("copy (plan)")
        await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        await page.click("[data-padd]"); await sheet_ok("add (plan)")
        await page.locator('#sheet [data-sa="addpick"]').first.click(); await sheet_ok("add place (plan)")
        await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.wait_for_timeout(300)
        await page.click('[data-qopen="1:0"]'); await page.wait_for_timeout(200)
        r = await page.evaluate(TARGETS, ".qe-box")
        check(not r["small"] and not r["unlabeled"] and not await page.evaluate(GLYPH_SCAN, GLYPHS), f"plan quick editor: {r['small'] or 'ok'} {r['unlabeled'] or ''}")

        # 6. системная «назад»: закрывает шторку, из подраздела «Ещё» — на уровень выше
        await fresh(page)
        await page.locator("[data-rep]").first.click(); await page.wait_for_timeout(350)
        await page.evaluate("history.back()"); await page.wait_for_timeout(350)
        check(await page.evaluate("!document.getElementById('sheet').classList.contains('open')") and await page.evaluate("location.pathname") == "/", "back gesture closes the sheet and stays in the app")
        await page.click('.nav [data-tab="more"]'); await page.click('.menu-i[data-tab="settings"]'); await page.wait_for_timeout(150)
        await page.evaluate("history.back()"); await page.wait_for_timeout(300)
        check(await page.evaluate("window.__UPG.state.tab") == "more", "back gesture from «Настройки» returns to «Ещё»")
        await page.click('.menu-i[data-tab="food"]'); await page.wait_for_timeout(150); await page.click("#back"); await page.wait_for_timeout(300)
        await page.click(".nav [data-tab='today']"); await page.wait_for_timeout(150)
        check(await page.evaluate("!(history.state && history.state.upg)"), "closing by button leaves no extra history entry")

        # 7. тема — в «Настройках»: как в системе / светлая / тёмная; прежнее сохранённое значение уважается
        await fresh(page, "settings", {"theme": "dark"})
        st = await page.evaluate("({ attr: document.documentElement.getAttribute('data-theme'), on: (document.querySelector('[data-themeset].on') || {}).dataset?.themeset, meta: document.querySelector('meta[name=theme-color]').content })")
        check(st["attr"] == "dark" and st["on"] == "dark" and st["meta"].upper() == "#0C0E12", f"stored theme «dark» respected: {st}")
        await page.click('[data-themeset="light"]'); await page.wait_for_timeout(100)
        st = await page.evaluate("({ attr: document.documentElement.getAttribute('data-theme'), saved: localStorage.getItem('upg3:theme'), meta: document.querySelector('meta[name=theme-color]').content })")
        check(st["attr"] == "light" and json.loads(st["saved"]) == "light" and st["meta"].upper() == "#F3F5F8", f"theme → light: {st}")
        await page.click('[data-themeset="auto"]'); await page.wait_for_timeout(100)
        check(await page.evaluate("!document.documentElement.hasAttribute('data-theme') && JSON.parse(localStorage.getItem('upg3:theme')) === 'auto'"), "theme → as in system")
        segs = await page.evaluate("[...document.querySelectorAll('[data-themeset]')].map(b => b.textContent.trim())")
        check(segs == ["Авто", "Светлая", "Тёмная"], f"theme segments: {segs}")

        # 8. экран входа: без глифов, цели касания
        await fresh(page, "today", {"noLogin": False})
        await page.evaluate("localStorage.setItem('upg3~apiOverride', JSON.stringify('http://localhost:8791'))"); await page.reload(); await page.wait_for_timeout(600)
        if await page.locator("#login.open").count():
            r = await page.evaluate(TARGETS, "#login")
            check(not r["small"] and not r["unlabeled"] and not await page.evaluate(GLYPH_SCAN, GLYPHS), f"sign-in screen: {r['small'] or 'ok'} {r['unlabeled'] or ''}")
        else:
            check(True, "sign-in screen: not shown (API not configured) — skipped")

        print("errors:", [e for e in errs if "Failed to load resource" not in e])
        check(not [e for e in errs if "Failed to load resource" not in e], "no console errors")
        print(f"\n{len(OK)} ok, {len(FAIL)} failed")
        await b.close()
asyncio.run(main())
