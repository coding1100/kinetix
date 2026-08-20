import type { ChatMessage } from "@/lib/types/chat";

export type MessageRun = {
  authorId: string;
  authorName: string;
  messages: ChatMessage[];
};

const MAX_RUN_TIME_DIFF_MS = 5 * 60 * 1000; // 5 minutes threshold

/** Consecutive messages from the same author sent within 5 minutes become one visual block (ClickUp/Slack style). */
export function buildMessageRuns(messages: ChatMessage[]): MessageRun[] {
  const runs: MessageRun[] = [];

  for (const msg of messages) {
    const lastRun = runs[runs.length - 1];
    const lastMsg = lastRun?.messages[lastRun.messages.length - 1];

    if (lastRun && lastMsg && lastRun.authorId === msg.authorId) {
      const timeDiff =
        new Date(msg.createdAt).getTime() - new Date(lastMsg.createdAt).getTime();
      if (!isNaN(timeDiff) && timeDiff >= 0 && timeDiff <= MAX_RUN_TIME_DIFF_MS) {
        lastRun.messages.push(msg);
        continue;
      }
    }

    runs.push({
      authorId: msg.authorId,
      authorName: msg.authorName,
      messages: [msg],
    });
  }

  return runs;
}
