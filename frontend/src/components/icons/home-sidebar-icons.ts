import type { LucideIcon } from "lucide-react";
import {
  InboxIcon,
  MessageSquareReplyIcon,
  MessageSquareQuoteIcon,
  MessagesSquareIcon,
  SendIcon,
  MegaphoneIcon,
  HashIcon,
  LayersIcon,
  ListChecksIcon,
  ListTodoIcon,
  StarIcon,
  LayoutGridIcon,
  UserRoundCheckIcon,
  CalendarClockIcon,
  ListOrderedIcon,
  BellIcon,
  HistoryIcon,
} from "lucide-react";

export type SidebarIconDef = { icon: LucideIcon };

/** Home sidebar + My Tasks sub-nav (shadcn / Lucide icon set). */
const HOME_SIDEBAR_ICONS: Record<string, SidebarIconDef> = {
  inbox: { icon: InboxIcon },
  replies: { icon: MessageSquareReplyIcon },
  "assigned-comments": { icon: MessageSquareQuoteIcon },
  "chat-activity": { icon: MessagesSquareIcon },
  "drafts-sent": { icon: SendIcon },
  posts: { icon: MegaphoneIcon },
  channels: { icon: HashIcon },
  spaces: { icon: LayersIcon },
  "all-tasks": { icon: ListChecksIcon },
  "my-tasks": { icon: ListTodoIcon },
  favorites: { icon: StarIcon },
};

const MY_TASKS_ICONS: Record<string, SidebarIconDef> = {
  "/home/my-tasks": { icon: LayoutGridIcon },
  "/home/my-tasks/assigned": { icon: UserRoundCheckIcon },
  "/home/my-tasks/today": { icon: CalendarClockIcon },
  "/home/my-tasks/personal": { icon: ListTodoIcon },
  "/home/my-tasks/lineup": { icon: ListOrderedIcon },
  "/home/my-tasks/reminders": { icon: BellIcon },
  "/home/my-tasks/recents": { icon: HistoryIcon },
};

export function getHomeSidebarIcon(
  itemId: string,
  href?: string
): SidebarIconDef | undefined {
  if (itemId === "my-tasks" && href && MY_TASKS_ICONS[href]) {
    return MY_TASKS_ICONS[href];
  }
  return HOME_SIDEBAR_ICONS[itemId];
}
