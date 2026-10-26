#!/usr/bin/env python3
"""Собирает PWA в docs/ (оттуда её раздаёт GitHub Pages).

Нужны: Node.js (читает src/data.js) и локальная копия базы упражнений:
  git clone --depth 1 https://github.com/hasaneyldrm/exercises-dataset vendor/exercises-dataset
  (или путь к exercises.json в переменной EXDS_JSON).
"""
import hashlib, json, os, pathlib, shutil, subprocess

root = pathlib.Path(__file__).parent
src, dist = root / "src", root / "docs"
DATASET = pathlib.Path(os.environ.get("EXDS_JSON", root / "vendor/exercises-dataset/data/exercises.json"))

if dist.exists():
    shutil.rmtree(dist)
for d in ("css", "js", "data", "icons"):
    (dist / d).mkdir(parents=True, exist_ok=True)

# 1. программа из src/data.js (публичная, без личных медицинских подробностей)
js = "global.window={};require(process.argv[1]);process.stdout.write(JSON.stringify(window.PROGRAM))"
load_program = lambda path: json.loads(subprocess.run(["node", "-e", js, str(path)], capture_output=True, text=True, check=True).stdout)
program = load_program(src / "data.js")


def diff_overlay(private, public, path=()):
    """Наложение «как из публичной программы получить личную»: список [путь, значение]."""
    if type(private) is not type(public):
        return [[list(path), private]]
    if isinstance(private, dict):
        out = []
        for k, v in private.items():
            out += diff_overlay(v, public[k], path + (k,)) if k in public else [[list(path + (k,)), v]]
        return out
    if isinstance(private, list):
        if len(private) != len(public):
            return [[list(path), private]]
        out = []
        for i, (a, b) in enumerate(zip(private, public)):
            out += diff_overlay(a, b, path + (i,))
        return out
    return [] if private == public else [[list(path), private]]


# Личная версия (private/data.private.js) в репозиторий не попадает: из неё получается
# private/overlay.json, который загружается в базу и приходит только владельцу после входа.
private_src = root / "private" / "data.private.js"
overlay_info = ""
if private_src.exists():
    private_program = load_program(private_src)
    overlay = {"v": 1, "set": diff_overlay(private_program, program)}
    (root / "private" / "overlay.json").write_text(json.dumps(overlay, ensure_ascii=False, indent=1), encoding="utf-8")
    overlay_info = f" · overlay {len(overlay['set'])} полей"

# 2. база упражнений
raw = json.loads(DATASET.read_text(encoding="utf-8"))
by_id = {x["id"]: x for x in raw}
clean = lambda s: s.replace("в°", "°")
# В базе названия только на английском; русские ведём сами (src/ds-names-ru.json, id → название).
names_ru = json.loads((src / "ds-names-ru.json").read_text(encoding="utf-8"))
no_ru = [x["id"] for x in raw if not names_ru.get(x["id"], "").strip()]
if no_ru:
    raise SystemExit(f"нет русского названия в ds-names-ru.json для {len(no_ru)} упражнений: {no_ru[:10]}…")
stale = sorted(set(names_ru) - set(by_id))
if stale:
    print(f"warning: в ds-names-ru.json есть id, которых нет в базе: {stale[:10]}")
items = [{"id": x["id"], "n": clean(x["name"]), "r": names_ru[x["id"]], "bp": x["body_part"], "eq": x["equipment"], "t": x["target"],
          "sec": x.get("secondary_muscles") or [], "s": x["instruction_steps"]["ru"], "m": x["media_id"]} for x in raw]
lib = {"v": 1, "source": "https://github.com/hasaneyldrm/exercises-dataset",
       "license": "MIT (данные). Медиа — © Gym visual — https://gymvisual.com/, в файл не включены.", "items": items}

# 3. связка упражнений программы с базой
ds_map = json.loads((src / "ds-map.json").read_text(encoding="utf-8"))
missing = []
for ex_id, ex in program["exercises"].items():
    did = ds_map.get(ex_id)
    if ex_id not in ds_map:
        missing.append(ex_id)
    if did:
        x = by_id[did]
        ex["ds"] = {"id": did, "n": clean(x["name"]), "nr": names_ru[did], "s": x["instruction_steps"]["ru"], "m": f'{did}-{x["media_id"]}'}
if missing:
    raise SystemExit(f"нет в ds-map.json: {missing}")

prog_js = "/* Сгенерировано build.py из src/data.js + exercises-dataset (MIT). */\nwindow.PROGRAM = " + json.dumps(program, ensure_ascii=False, separators=(",", ":")) + ";\n"
app_config = json.loads((src / "app-config.json").read_text(encoding="utf-8"))
config_js = "/* Сгенерировано build.py из src/app-config.json. */\nwindow.APP_CONFIG = " + json.dumps(app_config, ensure_ascii=False) + ";\n"
files = {
    "css/app.css": (src / "style.css").read_text(encoding="utf-8"),
    "js/store.js": (src / "store.js").read_text(encoding="utf-8"),
    "js/config.js": config_js,
    "js/program.js": prog_js,
    "js/sync.js": (src / "sync.js").read_text(encoding="utf-8"),
    "js/charts.js": (src / "charts.js").read_text(encoding="utf-8"),
    "js/plan.js": (src / "plan.js").read_text(encoding="utf-8"),
    "js/app.js": (src / "app.js").read_text(encoding="utf-8"),
}
lib_json = json.dumps(lib, ensure_ascii=False, separators=(",", ":"))
# База тоже входит в версию: иначе после правки одних названий service worker отдавал бы старую копию.
version = hashlib.sha1(("".join(files[k] for k in sorted(files)) + lib_json).encode()).hexdigest()[:8]

for path, text in files.items():
    (dist / path).write_text(text, encoding="utf-8")
(dist / "index.html").write_text((src / "index.tpl.html").read_text(encoding="utf-8").replace("__V__", version), encoding="utf-8")
(dist / "sw.js").write_text((src / "sw.tpl.js").read_text(encoding="utf-8").replace("__V__", version), encoding="utf-8")
(dist / "data" / "exercises-ru.json").write_text(lib_json, encoding="utf-8")
(dist / "data" / "program.json").write_text(json.dumps(program, ensure_ascii=False, indent=1), encoding="utf-8")
shutil.copy(src / "manifest.webmanifest", dist / "manifest.webmanifest")
shutil.copy(root / "THIRD_PARTY_NOTICES.md", dist / "THIRD_PARTY_NOTICES.md")
for f in ("favicon.svg", "favicon-32.png", "icon-192.png", "icon-512.png", "maskable-512.png", "apple-touch-icon.png"):
    shutil.copy(src / "icons" / f, dist / "icons" / f)
(dist / ".nojekyll").write_text("", encoding="utf-8")

total = sum(p.stat().st_size for p in dist.rglob("*") if p.is_file())
mapped = sum(1 for e in program["exercises"].values() if e.get("ds"))
print(f"version {version} · {sum(1 for p in dist.rglob('*') if p.is_file())} files · {total/1024:.0f} KB · "
      f"mapped {mapped}/{len(program['exercises'])} · sources {len(program['sources'])}{overlay_info}")
