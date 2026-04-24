import { Telegraf } from "telegraf";
import type { Context } from "telegraf";
import type { BridgeState } from "./bridgeState.js";

export const telegramCommands = [
  { command: "start", description: "Запуск бота" },
  { command: "help", description: "Помощь" },
  { command: "ping", description: "Проверка работы" },
  { command: "oc_mode_on", description: "Включить режим OpenComputers" },
  { command: "oc_mode_off", description: "Выключить режим OpenComputers" },
  { command: "oc_mode_status", description: "Показать статус режима" },
] as const;

export async function registerBotCommands(bot: Telegraf<Context>): Promise<void> {
  await bot.telegram.setMyCommands([...telegramCommands]);
}

export function createBot(token: string, bridgeState: BridgeState): Telegraf<Context> {
  const bot = new Telegraf<Context>(token);

  bot.start((ctx) => {
    void ctx.reply("Привет! Я klipsik");
  });

  bot.help((ctx) => {
    void ctx.reply(
      [
        "Доступные команды:",
        ...telegramCommands.map((item) => `/${item.command} — ${item.description}`),
      ].join("\n"),
    );
  });

  bot.command("ping", (ctx) => {
    void ctx.reply("pong ✅");
  });

  bot.command("oc_mode_on", (ctx) => {
    const chatId = ctx.chat.id;
    bridgeState.enableForChat(chatId);
    void ctx.reply("Режим OpenComputers включен. Новые сообщения будут отправляться в очередь для робота.");
  });

  bot.command("oc_mode_off", (ctx) => {
    const chatId = ctx.chat.id;
    bridgeState.disableForChat(chatId);
    void ctx.reply("Режим OpenComputers выключен.");
  });

  bot.command("oc_mode_status", (ctx) => {
    const chatId = ctx.chat.id;
    const enabled = bridgeState.isEnabledForChat(chatId);
    const queueSize = bridgeState.size(chatId);
    void ctx.reply(`Режим: ${enabled ? "включен" : "выключен"}. Очередь: ${queueSize}`);
  });

  bot.on("text", (ctx) => {
    const text = ctx.message.text;
    const chatId = ctx.chat.id;

    if (!bridgeState.isEnabledForChat(chatId)) {
      void ctx.reply(`Вы написали: ${text}`);
      return;
    }

    const queueSize = bridgeState.enqueue(chatId, text);
    void ctx.reply(`Сообщение поставлено в очередь для OpenComputers. В очереди: ${queueSize}`);
  });

  bot.catch((error) => {
    console.error("Ошибка в обработчике бота:", error);
  });

  return bot;
}
