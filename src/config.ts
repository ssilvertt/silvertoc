const requiredEnv = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_BOT_USERNAME",
  "BRIDGE_TOKEN",
  "DATABASE_URL",
  "SESSION_SECRET",
] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Отсутствует обязательная переменная окружения: ${key}`);
  }
}

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN as string,
  telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME as string,
  bridgeToken: process.env.BRIDGE_TOKEN as string,
  bridgeHost: process.env.BRIDGE_HOST ?? "0.0.0.0",
  bridgePort: Number(process.env.BRIDGE_PORT ?? 3000),
  bridgeStateFile: process.env.BRIDGE_STATE_FILE ?? "/app/data/bridge-state.json",
  databaseUrl: process.env.DATABASE_URL as string,
  sessionSecret: process.env.SESSION_SECRET as string,
  secureCookies: (process.env.SECURE_COOKIES ?? "false") === "true",
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_IDS ?? "7620202582")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value)),
};

if (!Number.isInteger(config.bridgePort) || config.bridgePort < 1 || config.bridgePort > 65535) {
  throw new Error("BRIDGE_PORT должен быть целым числом от 1 до 65535");
}

if (config.adminTelegramIds.length === 0) {
  throw new Error("ADMIN_TELEGRAM_IDS должен содержать хотя бы один telegram id");
}
