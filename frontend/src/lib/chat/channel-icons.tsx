import { createElement } from "react";
import {
  BellIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CalendarIcon,
  FlagIcon,
  HashIcon,
  HeartIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  RocketIcon,
  StarIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

// Curated glyph keys; keep in sync with backend-py/app/services/chat_service.py CHANNEL_ICONS
export const CHANNEL_ICONS = [
  "hash",
  "message-square",
  "megaphone",
  "star",
  "bell",
  "users",
  "calendar",
  "briefcase",
  "rocket",
  "heart",
  "flag",
  "book-open",
] as const;

export type ChannelIconKey = (typeof CHANNEL_ICONS)[number];

const CHANNEL_ICON_COMPONENTS: Record<ChannelIconKey, LucideIcon> = {
  hash: HashIcon,
  "message-square": MessageSquareIcon,
  megaphone: MegaphoneIcon,
  star: StarIcon,
  bell: BellIcon,
  users: UsersIcon,
  calendar: CalendarIcon,
  briefcase: BriefcaseIcon,
  rocket: RocketIcon,
  heart: HeartIcon,
  flag: FlagIcon,
  "book-open": BookOpenIcon,
};

export function channelIconComponent(icon?: string | null): LucideIcon {
  if (icon && icon in CHANNEL_ICON_COMPONENTS) {
    return CHANNEL_ICON_COMPONENTS[icon as ChannelIconKey];
  }
  return HashIcon;
}

export function ChannelGlyph({
  icon,
  className,
}: {
  icon?: string | null;
  className?: string;
}) {
  return createElement(channelIconComponent(icon), { className });
}
