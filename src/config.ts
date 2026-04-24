const requiredEnv = ["TELEGRAM_BOT_TOKEN"] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Отсутствует обязательная переменная окружения: ${key}`);
  }
}

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN as string,
};
