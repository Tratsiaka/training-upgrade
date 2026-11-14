#!/usr/bin/env bash
# Локальный стенд и тесты. Запуск из корня проекта: dev/run.sh <команда>
#   setup  — зависимости (npm для dev/ и backend/, Playwright для Python)
#   up     — собрать сайт и поднять всё: сайт :8765, стенд :8790–8792, имитация блокировки и прокси :8793/:8794
#   down   — остановить
#   ui     — UI-тесты (нужен только сайт)
#   sync   — вход, синхронизация, устройства, прокси (нужен весь стенд)
#   all    — up + ui + sync
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEV="$ROOT/dev"; LOGS="$DEV/.logs"; mkdir -p "$LOGS" "$DEV/shots"
cd "$ROOT"

# Запустить в фоне насовсем: лог в dev/.logs, без лишних дескрипторов — чтобы терминал
# или инструмент, который вызвал скрипт, не ждал окончания сервера.
spawn() {
  local name=$1 dir=$2; shift 2
  ( cd "$dir" || exit 1
    for fd in $(ls /dev/fd); do [ "$fd" -gt 2 ] 2>/dev/null && eval "exec $fd>&-" 2>/dev/null; done
    nohup "$@" >"$LOGS/$name.log" 2>&1 </dev/null &
    echo $! >"$LOGS/$name.pid" )
}
up() {
  down >/dev/null 2>&1 || true
  python3 build.py
  spawn http "$ROOT" python3 -m http.server 8765 --directory "$ROOT/docs"
  spawn stack "$DEV" node stack/start.mjs
  sleep 4
  spawn relay "$DEV" node stack/relay_emu.mjs
  sleep 2
  tail -n1 "$LOGS/stack.log"; tail -n1 "$LOGS/relay.log"
}
down() {
  for p in http stack relay; do
    [ -f "$LOGS/$p.pid" ] && kill "$(cat "$LOGS/$p.pid")" 2>/dev/null || true
    rm -f "$LOGS/$p.pid"
  done
  echo "остановлено"
}
run() { echo "== $1"; (cd "$DEV/tests" && "${@:2}"); }
ui() {
  run "модель плана" node plan_model_test.cjs
  for t in ui_core ui_agents ui_journal ui_library_names ui_plan ui_plan_more ui_plan_unit ui_plan_drag; do run "$t" python3 "$t.py"; done
}
# Каждый тест синхронизации ждёт чистую базу — перед ним стенд перезапускается.
restack() {
  [ -f "$LOGS/stack.pid" ] && kill "$(cat "$LOGS/stack.pid")" 2>/dev/null || true
  sleep 1
  spawn stack "$DEV" node stack/start.mjs
  sleep 4
}
sync() {
  run "прокси (unit)" node relay_unit.mjs
  restack; run "токены устройств (API)" node api_device_test.mjs
  restack; run "синхронизация двух устройств" python3 e2e_sync.py
  restack; run "экран входа" python3 ui_auth.py light
  restack; run "блокировка Neon → прокси" python3 ui_relay.py
}

case "${1:-}" in
  setup) (cd "$DEV" && npm install) && (cd "$ROOT/backend" && npm install) && python3 -m pip install --user playwright && python3 -m playwright install chromium ;;
  up) up ;;
  down) down ;;
  ui) ui ;;
  sync) sync ;;
  all) up && ui && sync ;;
  *) sed -n '2,9p' "$0"; exit 1 ;;
esac
