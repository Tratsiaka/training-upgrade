# Апгрейд — личное приложение для тренировок

PWA с программой силовых тренировок: «Сегодня», «План» (редактор программы), «Упражнения» (база на 1324), «Журнал», «Ещё».
Сайт — GitHub Pages из `docs/`: https://tratsiaka.github.io/training-upgrade/. Данные — на устройстве (localStorage) и в Neon
(Postgres + Neon Auth + Neon Function). Подробности для людей — в `README.md`, планы — в `ROADMAP.md`.
Локальное (где лежат ключи, устройства владельца) — в `CLAUDE.local.md`, он не в git.

Интерфейс и тексты — по-русски, телефон в первую очередь, светлая и тёмная тема. Пишем коротко и по делу.

## Структура

| Где | Что |
|---|---|
| `src/app.js` | весь интерфейс: вкладки, шторки, экран входа, индикатор синхронизации |
| `src/plan.js` | `PlanModel` — правки программы (замены, связки, порядок, параметры); хранятся в ключе `plan` |
| `src/sync.js` | вход по коду из письма, токен устройства, синхронизация, запасной адрес API |
| `src/store.js`, `src/charts.js`, `src/style.css`, `src/index.tpl.html`, `src/sw.tpl.js` | хранилище, графики, стили, шаблоны |
| `src/data.js` | публичная программа (без медицинских подробностей) |
| `src/ds-map.json`, `src/ds-names-ru.json` | связь упражнений с базой и русские названия базы |
| `src/app-config.json` | адреса API: `api` (Neon Function) и `relay` (прокси, пока пусто) |
| `build.py` | собирает `src/` → `docs/` и считает версию (хэш) |
| `backend/` | Neon Function (`src/index.ts`) и конфиг Neon (`neon.ts`) |
| `relay/` | прокси для Vercel — для сетей, откуда Neon недоступен |
| `private/` | личная версия программы (`data.private.js`) → `overlay.json`; **в git не попадает** |
| `vendor/exercises-dataset/` | база упражнений (MIT), в git не попадает |
| `dev/` | локальный стенд и тесты, см. `dev/README.md` |

## Сборка и публикация

- `python3 build.py` (нужен Node: читает `src/data.js`). База упражнений — `vendor/exercises-dataset/data/exercises.json`,
  коммит `7455efae41b330c265e7cd4b78dfa848e7ce5ebd` из https://github.com/hasaneyldrm/exercises-dataset. Новая версия базы может
  сломать сборку: каждому id нужно русское название в `src/ds-names-ru.json`.
- `docs/` хранится в git: коммить его вместе с `src/`. После push в `main` GitHub Pages обновляется примерно за минуту.
  Проверка: `curl -s https://tratsiaka.github.io/training-upgrade/ | grep -o 'app.js?v=[0-9a-f]*'` — версия как в выводе `build.py`.
- Иконки: картинки с метаданными C2PA меняют хэш при пересохранении — без нужды не трогать.

## Бэкенд (Neon)

- Org и проект — в `backend/.neon`, ветка `main` (`br-calm-hill-b9257iw9`), база `neondb`. Адрес функции — в `src/app-config.json`.
- Деплой: `cd backend && NEON_API_KEY=… npx -y neonctl@9.1.0 deploy --env deploy.env --no-env-pull -y` (ключ — см. `CLAUDE.local.md`).
  В `deploy.env` (не в git) — `ALLOWED_ORIGINS`, `MEMBER_EMAILS`, `ALLOW_LOCALHOST`.
- Эндпоинты: `/auth/*` (прокси к Neon Auth, cookie ходят в заголовках `X-Auth-Cookies` / `X-Auth-Set-Cookies`), `/sync`, `/me`,
  `/device`, `/devices`, `/device/revoke`, `/health`. Таблицы создаются функцией сама: `app.kv`, `app.members`, `app.devices`, `app.private_overlays`.
- **Neon отвечает 403 на любые запросы из Беларуси и России** (сайт, API функции, консоль). Отсюда — VPN для деплоя и консоли,
  а для приложения — `relay/` (см. «Открытые задачи»).

## Синхронизация и данные

- Устройство — источник правды, база — синхронизация. Ключи: `settings`, `swaps`, `goals`, `cycle`, `adjust`, `plan` (целиком),
  `log:<дата>_<день>`, `meas:<дата>`; служебный `srv:overlay` — личные заметки владельца, накладываются на программу только у него.
- `app.kv(user_id, key, value, deleted, updated_at, rev)`: побеждает более позднее `updated_at`, устройства забирают записи с `rev` больше своего курсора.
- Вход: код на почту → устройство получает токен (`Authorization: Device …`, в базе только sha-256, 180 дней с последнего использования).
  Без токена — JWT Neon Auth; без сессии — экран «Войди снова». Синхронизация при открытии, возврате в приложение, после правок, раз в 5 минут.
- Адреса API пробуются по очереди (`api`, `relay`), первым — тот, что ответил в прошлый раз (`upg3~via`).

### Править программу пользователя прямо в базе

1. Строка подключения — через Neon API (`GET /api/v2/projects/<id>/connection_uri?branch_id=…&database_name=neondb&role_name=neondb_owner&pooled=true`
   с ключом Neon) только в переменную `DATABASE_URL`; в файлы проекта не писать. Запросы: `node dev/stack/q.mjs "select …"`.
2. Текущий `plan` сохранить в `private/plan-backups/<дата>.json`.
3. Изменения делать через `PlanModel` (загрузить данные в локальную копию приложения и вызвать методы `window.__UPG.PM`), а не руками в JSON.
4. Записать: `update app.kv set value = $1, updated_at = now(), rev = nextval('app.kv_rev') where user_id = $2 and key = 'plan'`.
   Телефон заберёт при следующей синхронизации; если на нём есть несинхронизированная правка `plan` новее — победит она.

## Проверка

`dev/run.sh setup` один раз, затем `dev/run.sh up`, `dev/run.sh ui`, `dev/run.sh sync`, `dev/run.sh down`. Тесты печатают результат
(`ok` / `FAIL`, `errors: []`, `48 ok, 0 failed`) — читай вывод, код выхода почти всегда 0. Перед публикацией прогоняй оба набора.

## Правила

- Личные медицинские подробности — только в `private/` и в базе (`srv:overlay`). Не в `src/`, `docs/`, README, коммитах и тестах.
- Почты пользователей — только в `backend/deploy.env` и в базе. В тестах — `art@example.com`, `stranger@example.com`.
- Ключи не печатать, не коммитить и не копировать в проект (где они лежат — в `CLAUDE.local.md`).
- Чужие входы, тестовые аккаунты и письма с кодами на настоящие адреса — не создавать: пользователь входит сам.

## Состояние на ноябрь 2026

- v3.3 — редактор программы и новый «План». После неё: экран входа при запуске, токены устройств, индикатор синхронизации в шапке,
  шторка «Синхронизация» (устройства, проверка связи, выход), запасной адрес API и понятная ошибка при блокировке.

## Открытые задачи

- **Прокси на Vercel**: импортировать репозиторий в Vercel с Root Directory `relay`, адрес `https://….vercel.app` записать в
  `src/app-config.json` → `relay`, собрать, опубликовать. Тогда синхронизация из Беларуси пойдёт без VPN. `vercel.app` из Минска открывается.
- Возможно позже: вход через Google или Apple, открыть приложение другим людям.
- Пункты «Дальше» в `ROADMAP.md`.
