import type { ChatMessage } from "@/lib/types/chat";

export type MessageRun = {
  authorId: string;
  authorName: string;
  messages: ChatMessage[];
};

/** Consecutive messages from the same author become one visual block (ClickUp/Slack style). */
export function buildMessageRuns(messages: ChatMessage[]): MessageRun[] {
  const runs: MessageRun[] = [];

  for (const msg of messages) {
    const last = runs[runs.length - 1];
    if (last && last.authorId === msg.authorId) {
      last.messages.push(msg);
      continue;
    }
    runs.push({
      authorId: msg.authorId,
      authorName: msg.authorName,
      messages: [msg],
    });
  }

  return runs;
}
