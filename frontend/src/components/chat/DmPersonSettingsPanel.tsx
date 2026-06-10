"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  XIcon,
  CircleUserIcon,
  FlagIcon,
  PhoneIcon,
  CircleIcon,
  MailIcon,
  ClockIcon,
  PaperclipIcon,
  ChevronRightIcon,
  MailOpenIcon,
  StarIcon,
  CircleXIcon,
} from "lucide-react";
import type { ChatMessage, DirectMessage, MessageAttachment } from "@/lib/types/chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PanelCardShell } from "@/components/shared/PanelCardShell";
import { useChatStore } from "@/stores/chat-store";
import { usePersonProfileMember } from "@/hooks/use-person-profile-member";
import { useUserPresence } from "@/stores/presence-store";
import type { PresenceStatus } from "@/stores/profile-store";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { patchSidebarDm, removeDmFromSidebar } from "@/lib/chat/sidebar-dm";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageLoader } from "@/components/ui/page-loader";

function formatLocalTime() {
  return new Date().toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(presence: PresenceStatus) {
  if (presence === "online") return "Online";
  if (presence === "away") return "Away";
  if (presence === "busy") return "Busy";
  return "Last online recently";
}

function collectAttachments(messages: ChatMessage[]): MessageAttachment[] {
  const items: MessageAttachment[] = [];
  for (const msg of messages) {
    if (msg.attachments?.length) {
      items.push(...msg.attachments);
    }
  }
  return items;
}

function SettingsCard({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      {title ? (
        <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      ) : null}
      {children}
    </div>
  );
}

function InfoRow({
  icon,
  value,
}: {
  icon: ReactNode;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate text-sm text-foreground">{value}</span>
    </div>
  );
}

function OptionRow({
  icon,
  label,
  subtext,
  shortcut,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  subtext?: string;
  shortcut?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-start gap-3 rounded-md px-1 py-2 text-left transition-colors hover:bg-muted/40"
      onClick={onClick}
    >
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-foreground">{label}</span>
        {subtext ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {subtext}
          </span>
        ) : null}
      </span>
      {shortcut ? (
        <span className="text-xs text-muted-foreground">{shortcut}</span>
      ) : (
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

function OneToOneSettings({
  dmId,
  dm,
  messages,
  otherUserId,
  onMarkUnread,
}: {
  dmId: string;
  dm: DirectMessage;
  messages: ChatMessage[];
  otherUserId: string;
  onMarkUnread: () => void | Promise<void>;
}) {
  const router = useRouter();
  const setDmDetailsView = useChatStore((s) => s.setDmDetailsView);
  const openPersonProfile = useChatStore((s) => s.openPersonProfile);
  const sidebarStarred = useChatStore(
    (s) => s.sidebarListsCache?.dms.find((d) => d.id === dmId)?.starred
  );
  const { member, loading } = usePersonProfileMember(otherUserId);
  const presence = useUserPresence(otherUserId, "offline");
  const [filesExpanded, setFilesExpanded] = useState(false);

  const displayName = member?.fullName ?? dm.name;
  const attachments = useMemo(() => collectAttachments(messages), [messages]);
  const starred = sidebarStarred ?? dm.starred ?? false;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "u" || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      void onMarkUnread();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onMarkUnread]);

  const handleFavorite = () => {
    const next = !starred;
    patchSidebarDm(dmId, { starred: next });
    toast.success(next ? "Added to favorites" : "Removed from favorites");
  };

  const handleCloseDm = () => {
    removeDmFromSidebar(dmId);
    setDmDetailsView(null);
    toast.success("DM closed. Will reappear with new messages.");
    router.push("/chat");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <PageLoader />
      </div>
    );
  }

  return (
    <>
      <div className="flex h-12 shrink-0 items-center justify-end px-3 pt-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 rounded-full"
          onClick={() => setDmDetailsView(null)}
          aria-label="Close settings"
        >
          <XIcon className="size-4" strokeWidth={1.5} />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-4 pb-4">
          <div className="flex flex-col items-center text-center">
            <Avatar className="size-20">
              {member?.avatarUrl ? (
                <AvatarImage src={member.avatarUrl} alt={displayName} />
              ) : null}
              <AvatarFallback
                className={cn(
                  "text-2xl font-semibold",
                  avatarColorClassForKey(otherUserId, displayName)
                )}
              >
                {avatarInitialFromName(displayName)}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-3 text-lg font-semibold">{displayName}</h2>

            <div className="mt-4 flex w-full justify-center gap-6">
              <button
                type="button"
                className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => openPersonProfile(otherUserId)}
              >
                <span className="flex size-10 items-center justify-center rounded-full border border-border bg-background">
                  <CircleUserIcon className="size-4" strokeWidth={1.75} />
                </span>
                Profile
              </button>
              <button
                type="button"
                className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => toast("Priorities (coming soon)")}
              >
                <span className="flex size-10 items-center justify-center rounded-full border border-border bg-background">
                  <FlagIcon className="size-4" strokeWidth={1.75} />
                </span>
                Priorities
              </button>
              <button
                type="button"
                className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => toast("SyncUp (coming soon)")}
              >
                <span className="flex size-10 items-center justify-center rounded-full border border-border bg-background">
                  <PhoneIcon className="size-4" strokeWidth={1.75} />
                </span>
                SyncUp
              </button>
            </div>
          </div>

          <SettingsCard>
            <InfoRow
              icon={<CircleIcon className="size-4" strokeWidth={1.75} />}
              value={statusLabel(presence)}
            />
            <InfoRow
              icon={<MailIcon className="size-4" strokeWidth={1.75} />}
              value={member?.email ?? "—"}
            />
            <InfoRow
              icon={<ClockIcon className="size-4" strokeWidth={1.75} />}
              value={formatLocalTime()}
            />
          </SettingsCard>

          <SettingsCard title={`Files (${attachments.length})`}>
            {attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No files shared yet.</p>
            ) : (
              <>
                <div className="flex gap-2">
                  {(filesExpanded ? attachments : attachments.slice(0, 5)).map(
                    (file) => (
                      <div
                        key={file.id}
                        className="flex size-12 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30"
                        title={file.fileName}
                      >
                        <PaperclipIcon className="size-4 text-muted-foreground" />
                      </div>
                    )
                  )}
                </div>
                {attachments.length > 5 ? (
                  <button
                    type="button"
                    className="mt-3 flex w-full items-center justify-between text-sm text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setFilesExpanded((v) => !v)}
                  >
                    {filesExpanded ? "Show fewer files" : "View all files"}
                    <ChevronRightIcon className="size-4" />
                  </button>
                ) : null}
              </>
            )}
          </SettingsCard>

          <SettingsCard title="Options">
            <OptionRow
              icon={<MailOpenIcon className="size-4" strokeWidth={1.75} />}
              label="Mark as unread"
              shortcut="U"
              onClick={() => void onMarkUnread()}
            />
            <OptionRow
              icon={
                <StarIcon
                  className={cn(
                    "size-4",
                    starred && "fill-amber-400 text-amber-400"
                  )}
                  strokeWidth={1.75}
                />
              }
              label={starred ? "Remove from favorites" : "Favorite"}
              onClick={handleFavorite}
            />
            <OptionRow
              icon={<CircleXIcon className="size-4" strokeWidth={1.75} />}
              label="Close DM"
              subtext="Will reappear with new messages"
              onClick={handleCloseDm}
            />
          </SettingsCard>
        </div>
      </ScrollArea>
    </>
  );
}

function GroupSettings({
  dmId,
  dm,
  onMarkUnread,
}: {
  dmId: string;
  dm: DirectMessage;
  onMarkUnread: () => void | Promise<void>;
}) {
  const router = useRouter();
  const setDmDetailsView = useChatStore((s) => s.setDmDetailsView);
  const sidebarStarred = useChatStore(
    (s) => s.sidebarListsCache?.dms.find((d) => d.id === dmId)?.starred
  );
  const starred = sidebarStarred ?? dm.starred ?? false;
  const memberCount = dm.participants?.length ?? dm.members?.length ?? 0;

  const handleFavorite = () => {
    const next = !starred;
    patchSidebarDm(dmId, { starred: next });
    toast.success(next ? "Added to favorites" : "Removed from favorites");
  };

  const handleCloseDm = () => {
    removeDmFromSidebar(dmId);
    setDmDetailsView(null);
    toast.success("DM closed. Will reappear with new messages.");
    router.push("/chat");
  };

  return (
    <>
      <div className="flex h-12 shrink-0 items-center justify-between px-4 pt-1">
        <span className="text-sm font-semibold">Group settings</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 rounded-full"
          onClick={() => setDmDetailsView(null)}
          aria-label="Close settings"
        >
          <XIcon className="size-4" strokeWidth={1.5} />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-4 pb-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold">
              {dm.participants?.length
                ? dm.participants
                    .map((p) => p.fullName)
                    .join(", ")
                : dm.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {memberCount} member{memberCount === 1 ? "" : "s"}
            </p>
          </div>
          <SettingsCard title="Options">
            <OptionRow
              icon={<MailOpenIcon className="size-4" strokeWidth={1.75} />}
              label="Mark as unread"
              shortcut="U"
              onClick={() => void onMarkUnread()}
            />
            <OptionRow
              icon={
                <StarIcon
                  className={cn(
                    "size-4",
                    starred && "fill-amber-400 text-amber-400"
                  )}
                  strokeWidth={1.75}
                />
              }
              label={starred ? "Remove from favorites" : "Favorite"}
              onClick={handleFavorite}
            />
            <OptionRow
              icon={<CircleXIcon className="size-4" strokeWidth={1.75} />}
              label="Close DM"
              subtext="Will reappear with new messages"
              onClick={handleCloseDm}
            />
          </SettingsCard>
        </div>
      </ScrollArea>
    </>
  );
}

export function DmPersonSettingsPanel({
  dmId,
  dm,
  messages,
  otherUserId,
  onMarkUnread,
}: {
  dmId: string;
  dm: DirectMessage | null;
  messages: ChatMessage[];
  otherUserId?: string;
  onMarkUnread: () => void | Promise<void>;
}) {
  const resolvedDm: DirectMessage =
    dm ?? {
      id: dmId,
      name: "Direct message",
      isGroup: false,
      lastMessage: "",
      lastAt: new Date().toISOString(),
      unread: 0,
    };

  return (
    <PanelCardShell
      widthClass="w-[340px]"
      marginClassName="box-border flex h-full shrink-0 py-3 pl-2 pr-1"
    >
      {resolvedDm.isGroup ? (
        <GroupSettings dmId={dmId} dm={resolvedDm} onMarkUnread={onMarkUnread} />
      ) : otherUserId ? (
        <OneToOneSettings
          dmId={dmId}
          dm={resolvedDm}
          messages={messages}
          otherUserId={otherUserId}
          onMarkUnread={onMarkUnread}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
          Loading conversation details…
        </div>
      )}
    </PanelCardShell>
  );
}
