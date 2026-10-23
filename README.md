# Апгрейд — программа тренировок (PWA)

Личное веб-приложение с программой силовых тренировок v3: 2–3 тренировки в неделю, режимы на 60, 90 и 120 минут, три блока по 5 недель, журнал подходов и замеров, база из 1324 упражнений. Работает офлайн, ставится на телефон как приложение и синхронизирует данные через Neon (Postgres + Neon Auth + Neon Function).

## Установка на телефон

- **iPhone:** открой сайт в Safari → «Поделиться» → «На экран „Домой“».
- **Android:** Chrome предложит «Установить приложение» (или меню ⋮ → «Установить»).

## Структура репозитория

```
docs/                    готовое приложение — его раздаёт GitHub Pages
  index.html             оболочка
  css/app.css            стили (светлая и тёмная темы)
  js/store.js            хранение на устройстве (localStorage) + хуки для синхронизации
  js/config.js           адрес API (сгенерировано из src/app-config.json)
  js/program.js          программа + шаги из базы упражнений (сгенерировано)
  js/sync.js             вход по коду из письма и синхронизация с базой
  js/app.js              интерфейс
  data/program.json      программа в JSON — для будущего бэкенда
  data/exercises-ru.json база упражнений (выжимка exercises-dataset)
  sw.js                  service worker: офлайн и обновления
  manifest.webmanifest   манифест PWA
src/                     исходники
  data.js                публичная программа: упражнения, блоки, тренировки, тексты, источники
  ds-map.json            связь упражнений программы с базой exercises-dataset
  app-config.json        адрес Neon Function
  app.js, store.js, sync.js, style.css, index.tpl.html, sw.tpl.js, manifest.webmanifest, icons/
backend/                 Neon Function (TypeScript) и neon.ts
build.py                 сборка src/ → docs/
private/                 личная версия программы — в git не попадает (см. ниже)
```

## Сборка

```bash
git clone --depth 1 https://github.com/hasaneyldrm/exercises-dataset vendor/exercises-dataset
python3 build.py        # нужны Python 3 и Node.js
```

Каждая сборка получает новую версию: установленное приложение покажет «Доступна новая версия» и обновится одной кнопкой.

## Данные и синхронизация

- **На устройстве.** Всё, что вводится, сначала пишется в `localStorage` (префикс `upg3:`), поэтому приложение работает офлайн и без входа.
- **Вход.** «Ещё → Настройки → Аккаунт»: код на почту (Neon Auth, Managed Better Auth). Cookie сессии хранятся в `localStorage` (префикс `upg3~`) и ходят к функции в заголовках — сторонние cookie не нужны, поэтому вход держится и в PWA на iPhone.
- **Синхронизация.** Изменения копятся в очереди и уходят в базу, когда есть сеть. Журнал синхронизируется по тренировкам, замеры — по датам, настройки, цели и замены — целиком. Конфликты решает время изменения записи.
- **Доступ.** API пускает только участников из таблицы `app.members`; почты из `MEMBER_EMAILS` добавляются туда при первом входе.
- **Резервная копия:** «Настройки → Экспорт JSON».

## Бэкенд (Neon)

`backend/src/index.ts` — одна Neon Function:

| Путь | Что делает |
|---|---|
| `/auth/*` | прокси к Neon Auth: cookie ↔ заголовки `X-Auth-Cookies` / `X-Auth-Set-Cookies` |
| `POST /sync` | отправка изменений и получение новых (по курсору `rev`), JWT Neon Auth проверяется по JWKS |
| `GET /me` | кто вошёл и есть ли доступ |
| `GET /health` | проверка без обращения к базе |

Таблицы создаются функцией сама при первом запросе: `app.kv` (данные по пользователю и ключу) и `app.members`.

```bash
cd backend && npm install
neon link --project-id <id>              # один раз
neon deploy --env .env.local             # в файле: ALLOWED_ORIGINS, MEMBER_EMAILS
neon functions get api                   # invocation_url → src/app-config.json
```

## Личные заметки

Публичная программа (`src/data.js`) не содержит медицинских подробностей. Личная версия лежит в `private/data.private.js` (в `.gitignore`). `python3 build.py` сравнивает их и пишет `private/overlay.json` — эти поля загружаются в базу как запись `srv:overlay` владельца и после входа накладываются на программу только на его устройствах.

## Источники и лицензии

- Обоснование программы — «Ещё → Почему так» (43 исследования со ссылками).
- База упражнений: [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset). Данные (названия, мышцы, оборудование, инструкции) — MIT, см. `THIRD_PARTY_NOTICES.md`.
- Анимации упражнений — © Gym visual (https://gymvisual.com/). В репозиторий они **не** включены; приложение подгружает их по ссылке из исходного репозитория, только если пользователь сам включит это в настройках.
