import { config } from "./config.js";
import { createBot, registerBotCommands } from "./bot.js";
import { BridgeState } from "./bridgeState.js";
import { startBridgeServer } from "./bridgeServer.js";

async function bootstrap(): Promise<void> {
  const bridgeState = new BridgeState(config.bridgeStateFile);
  const bot = createBot(config.telegramBotToken, bridgeState);
  const bridgeServer = startBridgeServer({
    host: config.bridgeHost,
    port: config.bridgePort,
    token: config.bridgeToken,
    bridgeState,
    sendToTelegram: async (chatId: number, message: string) => {
      await bot.telegram.sendMessage(chatId, message);
    },
  });

  await bot.launch();
  await registerBotCommands(bot);
  console.log("Telegram-бот запущен");

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    console.log(`Получен сигнал ${signal}, останавливаю бота...`);
    await new Promise<void>((resolve, reject) => {
      bridgeServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
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
