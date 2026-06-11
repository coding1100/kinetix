import type { ChatMessage } from "@/lib/types/chat";

/** Own message with the latest read watermark — only this row shows read avatars. */
export function lastReadOwnMessageId(messages: ChatMessage[]): string | null {
  let lastId: string | null = null;
  let lastAt = -Infinity;

  for (const message of messages) {
    if (!message.isSelf || !(message.readByUserIds?.length ?? 0)) continue;
    const at = new Date(message.createdAt).getTime();
    if (Number.isNaN(at)) continue;
    if (at >= lastAt) {
      lastAt = at;
      lastId = message.id;
    }
  }

  return lastId;
}
