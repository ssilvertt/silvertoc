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
cd /Users/silvert/WebstormProjects/silvertoc
docker compose -f docker-compose.yml -f docker-compose.frontend.yml up --build -d
```

Важно: команда должна быть без квадратных скобок и без ссылок, просто текст как выше.

Если вы уже находитесь в папке `frontend/`, используйте:

```bash
docker compose -f ../docker-compose.yml -f ../docker-compose.frontend.yml up --build -d
```

После этого:

- `https://silvert.software/` -> React
- `https://silvert.software/bridge/*` -> bot backend

Если контейнер `silvert-nginx` уходит в `Restarting`, сначала проверьте лог:

```bash
docker logs --tail 100 silvert-nginx
```

## Let's Encrypt (HTTPS)

1. Запустите стек в HTTP-режиме (чтобы работал ACME challenge):

```bash
cd ~/silvertoc
docker compose -f docker-compose.yml -f docker-compose.frontend.yml up --build -d
```

2. Выпустите сертификат:

```bash
docker compose --profile tools run --rm certbot certonly \
	--webroot -w /var/www/certbot \
	-d silvert.software \
	--email your@email.com \
	--agree-tos --no-eff-email
```

3. Включите SSL-конфиг nginx:

```bash
cp ./nginx/default.with-frontend.ssl.conf ./nginx/default.with-frontend.conf
docker compose -f docker-compose.yml -f docker-compose.frontend.yml restart nginx
```

4. Проверка:

```bash
curl -I https://silvert.software
curl https://silvert.software/bridge/health
```

5. Автопродление (cron на VPS):

```bash
crontab -e
```

Добавьте строку:

```cron
0 3 * * * cd ~/silvertoc && docker compose --profile tools run --rm certbot renew --webroot -w /var/www/certbot && docker compose -f docker-compose.yml -f docker-compose.frontend.yml restart nginx
```

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
