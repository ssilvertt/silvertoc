import { config } from "./config.js";
import { createBot } from "./bot.js";

async function bootstrap(): Promise<void> {
  const bot = createBot(config.telegramBotToken);

  await bot.launch();
  console.log("Telegram-бот запущен");

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    console.log(`Получен сигнал ${signal}, останавливаю бота...`);
    await bot.stop(signal);
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

bootstrap().catch((error: unknown) => {
  console.error("Ошибка запуска приложения:", error);
  process.exit(1);
});
