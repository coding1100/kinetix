import type { NotificationDto } from "@/lib/api/home";
import type { Task } from "@/lib/types/task";

export type AssistantContext = {
  unreadNotifications: number;
  notifications: NotificationDto[];
  tasksDueSoon: Task[];
  reminders: { id: string; title: string; due: string }[];
};

const PROMPTS: { match: RegExp; reply: (ctx: AssistantContext) => string }[] = [
  {
    match: /inbox|notification|unread/i,
    reply: (ctx) => {
      if (ctx.unreadNotifications === 0) {
        return "You have no unread notifications. Check Inbox for older activity.";
      }
      const latest = ctx.notifications
        .filter((n) => n.unread)
        .slice(0, 3)
        .map((n) => `• ${n.title}`)
        .join("\n");
      return `You have ${ctx.unreadNotifications} unread notification(s).\n${latest || ""}`.trim();
    },
  },
  {
    match: /due|today|calendar|task/i,
    reply: (ctx) => {
      if (ctx.tasksDueSoon.length === 0) {
        return "No tasks with due dates in the next two weeks. Open Calendar from the top bar to browse your schedule.";
      }
      const lines = ctx.tasksDueSoon
        .slice(0, 5)
        .map((t) => `• ${t.name} (${t.dueDate ?? "due soon"}) — ${t.space}`);
      return `Upcoming tasks:\n${lines.join("\n")}`;
    },
  },
  {
    match: /remind/i,
    reply: (ctx) => {
      if (ctx.reminders.length === 0) {
        return "No reminders on your list. Add them from Home → My Tasks → Reminders.";
      }
      return ctx.reminders
        .slice(0, 5)
        .map((r) => `• ${r.title} — ${r.due}`)
        .join("\n");
    },
  },
  {
    match: /help|what can you/i,
    reply: () =>
      "Ask about your inbox, due tasks, or reminders. Examples:\n• What's unread in my inbox?\n• What tasks are due soon?\n• Show my reminders",
  },
];

export function buildAssistantReply(
  message: string,
  ctx: AssistantContext
): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "Type a question about your workspace — inbox, tasks, or reminders.";
  }
  for (const { match, reply } of PROMPTS) {
    if (match.test(trimmed)) return reply(ctx);
  }
  return (
    "I can summarize your inbox, upcoming tasks, and reminders. Try:\n" +
    "• What's unread?\n• Tasks due this week\n• My reminders"
  );
}
