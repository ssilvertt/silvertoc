# Telegram Bot + OpenComputers Bridge

## Команды бота

- `/oc_mode_on` — включить режим моста для текущего чата
- `/oc_mode_off` — выключить режим моста
- `/oc_mode_status` — проверить статус и размер очереди

Пока режим включен, любое текстовое сообщение в этом чате уходит в очередь для робота OpenComputers.

Также поддерживается обратный поток: сообщения из Minecraft-чата отправляются в Telegram через bridge API.

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните:

- `TELEGRAM_BOT_TOKEN` — токен Telegram-бота
- `BRIDGE_TOKEN` — секретный токен для робота (любой длинный случайный)
- `BRIDGE_HOST` — обычно `0.0.0.0`
- `BRIDGE_PORT` — внутренний порт bridge API (по умолчанию `3000`)
- `BRIDGE_STATE_FILE` — файл состояния режима (по умолчанию `/app/data/bridge-state.json`)

## Архитектура с Nginx

- наружу открыт только `80` (и позже `443`)
- бот работает внутри Docker-сети на `telegram-bot:3000`
- bridge API доступен снаружи как `/bridge/*`

Проверка:

- [Bridge health](bridge/health) (на домене: `http://silvert.software/bridge/health`)

## Запуск backend + nginx

```bash
docker compose up --build -d
```

## React на том же домене

Да, лучше класть в эту же папку проекта, в отдельную директорию `frontend/`.

Когда React готов:

1. Добавьте проект в `frontend/`
2. Убедитесь, что в `frontend/Dockerfile` контейнер отдает сайт на `80` порту
3. Запустите с overlay-конфигом:

```bash
docker compose -f docker-compose.yml -f docker-compose.frontend.yml up --build -d
```

После этого:

- `https://silvert.software/` -> React
- `https://silvert.software/bridge/*` -> bot backend

## OpenComputers скрипт

Скрипт для робота: [opencomputers/bridge_chatbox.lua](opencomputers/bridge_chatbox.lua)

В нем укажите:

- `BRIDGE_BASE_URL` (например, `http://silvert.software/bridge`)
- `BRIDGE_TOKEN`
- `TELEGRAM_CHAT_IDS` (массив chat id, можно несколько)

Требуется:

- Internet Card
- компонент `chat_box` (Computronics)

## Двунаправленный мост

- Telegram -> Minecraft: робот опрашивает `/oc/pull-text`
- Minecraft -> Telegram: робот отправляет в `/oc/push-text`
