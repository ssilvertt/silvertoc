# Silvertoc (кратко)

## Основные папки

- `src/` — Node.js/TS код Telegram-бота
- `opencomputers/` — Lua-скрипт для робота OpenComputers
- `frontend/` — React сайт
- `nginx/` — конфиги nginx

## Быстрый запуск

```bash
cd ~/silvertoc
docker compose -f docker-compose.yml -f docker-compose.frontend.yml up --build -d
```

## Полезные команды

```bash
docker compose -f docker-compose.yml -f docker-compose.frontend.yml ps
docker compose -f docker-compose.yml -f docker-compose.frontend.yml logs -f nginx
docker compose -f docker-compose.yml -f docker-compose.frontend.yml logs -f telegram-bot
docker compose -f docker-compose.yml -f docker-compose.frontend.yml down
```

## URL

- Сайт: `http://silvert.software/`
- Bridge health: `http://silvert.software/bridge/health`
