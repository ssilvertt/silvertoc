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
  await bot.telegram.setMyCommands([...telegramCommands], { scope: { type: "all_private_chats" } });
  await bot.telegram.setMyCommands([...telegramCommands], { scope: { type: "all_group_chats" } });
  await bot.telegram.setMyCommands([...telegramCommands], { scope: { type: "all_chat_administrators" } });
  await bot.telegram.setChatMenuButton({ menuButton: { type: "commands" } });
}

function getHelpText(): string {
  return [
    "Доступные команды:",
    ...telegramCommands.map((item) => `/${item.command} — ${item.description}`),
  ].join("\n");
}

export function createBot(token: string, bridgeState: BridgeState, botUsername?: string): Telegraf<Context> {
  const bot = new Telegraf<Context>(token);

  const normalizedBotUsername = botUsername?.replace(/^@/, "").toLowerCase();

  const commandNameFromText = (text: string): string | null => {
    if (!text.startsWith("/")) {
      return null;
    }

    const firstToken = text.trim().split(/\s+/)[0] ?? "";
    const commandToken = firstToken.slice(1);
    if (!commandToken) {
      return null;
    }

    const [name, mentionedUsername] = commandToken.toLowerCase().split("@");

    if (mentionedUsername && normalizedBotUsername && mentionedUsername !== normalizedBotUsername) {
      return null;
    }

    return name;
  };

  const enableOcMode = (chatId: number): string => {
    bridgeState.enableForChat(chatId);
    return "Режим OpenComputers включен. Новые сообщения будут отправляться в очередь для робота.";
  };

  const disableOcMode = (chatId: number): string => {
    bridgeState.disableForChat(chatId);
    return "Режим OpenComputers выключен.";
  };

  const ocModeStatus = (chatId: number): string => {
    const enabled = bridgeState.isEnabledForChat(chatId);
    const queueSize = bridgeState.size(chatId);
    return `Режим: ${enabled ? "включен" : "выключен"}. Очередь: ${queueSize}`;
  };

  bot.start((ctx) => {
    void ctx.reply(getHelpText());
  });

  bot.help((ctx) => {
    void ctx.reply(getHelpText());
  });

  bot.on("text", (ctx) => {
    const text = ctx.message.text;
    const chatId = ctx.chat.id;
    const command = commandNameFromText(text);

    if (command === "start" || command === "help") {
      return;
    }

    if (command === "ping") {
      void ctx.reply("pong ✅");
      return;
    }

    if (command === "oc_mode_on") {
      void ctx.reply(enableOcMode(chatId));
      return;
    }

    if (command === "oc_mode_off") {
      void ctx.reply(disableOcMode(chatId));
      return;
    }

    if (command === "oc_mode_status") {
      void ctx.reply(ocModeStatus(chatId));
      return;
    }

    if (command !== null) {
      void ctx.reply("Неизвестная команда. Используйте /help");
      return;
    }

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
