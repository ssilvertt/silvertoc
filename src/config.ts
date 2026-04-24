const requiredEnv = ["TELEGRAM_BOT_TOKEN", "BRIDGE_TOKEN"] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Отсутствует обязательная переменная окружения: ${key}`);
  }
}

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN as string,
  bridgeToken: process.env.BRIDGE_TOKEN as string,
  bridgeHost: process.env.BRIDGE_HOST ?? "0.0.0.0",
  bridgePort: Number(process.env.BRIDGE_PORT ?? 3000),
  bridgeStateFile: process.env.BRIDGE_STATE_FILE ?? "/app/data/bridge-state.json",
};

if (!Number.isInteger(config.bridgePort) || config.bridgePort < 1 || config.bridgePort > 65535) {
  throw new Error("BRIDGE_PORT должен быть целым числом от 1 до 65535");
}
