const MAX_QUEUE_SIZE = 100;

export class BridgeState {
  private readonly enabledChatIds = new Set<number>();
  private readonly queuesByChatId = new Map<number, string[]>();

  enableForChat(chatId: number): void {
    this.enabledChatIds.add(chatId);
  }

  disableForChat(chatId: number): void {
    this.enabledChatIds.delete(chatId);
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
}
