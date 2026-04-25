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
- `BRIDGE_PORT` — порт bridge API, по умолчанию `3000`
- `BRIDGE_STATE_FILE` — файл состояния режима (по умолчанию `/app/data/bridge-state.json`)

## Запуск

```bash
pnpm install
pnpm build
docker compose up --build -d
```

## OpenComputers скрипт

Скрипт для робота лежит в [opencomputers/bridge_chatbox.lua](opencomputers/bridge_chatbox.lua).

Перед запуском в скрипте укажите:

- `BRIDGE_BASE_URL` (например, `http://silvert.software:3000`)
- `BRIDGE_TOKEN`
- `TELEGRAM_CHAT_IDS` (массив chat id, можно несколько)

Требуется:

- Internet Card
- компонент `chat_box` (Computronics)

## Двунаправленный мост

- Telegram -> Minecraft: робот опрашивает `/oc/pull-text`
- Minecraft -> Telegram: робот отправляет в `/oc/push-text`

После изменений перезапустите контейнер:

```bash
docker compose up --build -d
```
