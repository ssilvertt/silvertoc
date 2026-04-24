import { Telegraf } from "telegraf";
import type { Context } from "telegraf";

export function createBot(token: string): Telegraf<Context> {
  const bot = new Telegraf<Context>(token);

  bot.start((ctx) => {
    void ctx.reply("Привет! Я klipsik");
  });

  bot.help((ctx) => {
    void ctx.reply(
      [
        "Доступные команды:",
        "/start — запуск бота",
        "/help — помощь",
        "/ping — проверка работы",
      ].join("\n"),
    );
  });

  bot.command("ping", (ctx) => {
    void ctx.reply("pong ✅");
  });

  bot.on("text", (ctx) => {
    void ctx.reply(`Вы написали: ${ctx.message.text}`);
  });

  bot.catch((error) => {
    console.error("Ошибка в обработчике бота:", error);
  });

  return bot;
}
