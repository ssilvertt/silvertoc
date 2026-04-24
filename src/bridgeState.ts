import fs from "node:fs";
import path from "node:path";

const MAX_QUEUE_SIZE = 100;

export class BridgeState {
  private readonly stateFilePath: string;
  private readonly enabledChatIds = new Set<number>();
  private readonly queuesByChatId = new Map<number, string[]>();

  constructor(stateFilePath: string) {
    this.stateFilePath = stateFilePath;
    this.loadState();
  }

  enableForChat(chatId: number): void {
    this.enabledChatIds.add(chatId);
    this.persistState();
  }

  disableForChat(chatId: number): void {
    this.enabledChatIds.delete(chatId);
    this.persistState();
  }

  isEnabledForChat(chatId: number): boolean {
    return this.enabledChatIds.has(chatId);
  }

  enqueue(chatId: number, message: string): number {
    const queue = this.queuesByChatId.get(chatId) ?? [];
    queue.push(message);

    while (queue.length > MAX_QUEUE_SIZE) {
      queue.shift();
    }

    this.queuesByChatId.set(chatId, queue);
    return queue.length;
  }

  pull(chatId: number): string | null {
    const queue = this.queuesByChatId.get(chatId);
    if (!queue || queue.length === 0) {
      return null;
    }

    const message = queue.shift() ?? null;

    if (queue.length === 0) {
      this.queuesByChatId.delete(chatId);
    } else {
      this.queuesByChatId.set(chatId, queue);
    }

    return message;
  }

  size(chatId: number): number {
    return this.queuesByChatId.get(chatId)?.length ?? 0;
  }

  private loadState(): void {
    try {
      if (!fs.existsSync(this.stateFilePath)) {
        return;
      }

      const raw = fs.readFileSync(this.stateFilePath, "utf-8");
      const parsed = JSON.parse(raw) as { enabledChatIds?: number[] };
      const chatIds = parsed.enabledChatIds ?? [];

      for (const value of chatIds) {
        if (Number.isInteger(value)) {
          this.enabledChatIds.add(value);
        }
      }
    } catch (error) {
      console.error("Не удалось загрузить состояние bridge режима:", error);
    }
  }

  private persistState(): void {
    try {
      const dir = path.dirname(this.stateFilePath);
      fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(
        this.stateFilePath,
        JSON.stringify({ enabledChatIds: [...this.enabledChatIds] }, null, 2),
        "utf-8",
      );
    } catch (error) {
      console.error("Не удалось сохранить состояние bridge режима:", error);
    }
  }
}
