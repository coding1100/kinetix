"use client";

import { useState } from "react";
import {
  MailIcon,
  ClockIcon,
  UsersIcon,
  MessageCircleIcon,
  UserIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserPresence } from "@/stores/presence-store";
import {
  presenceDotClass,
  presenceOfflineDotClass,
} from "@/stores/profile-store";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageLoader } from "@/components/ui/page-loader";
import { usePersonProfileMember } from "@/hooks/use-person-profile-member";
import { useOpenPersonProfile } from "@/hooks/use-open-person-profile";
import { useOpenDirectMessage } from "@/hooks/use-open-direct-message";
import { ROLE_LABELS } from "@/components/workspace/WorkspaceInviteForm";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { cn, PKT_TIME_ZONE } from "@/lib/utils";

function formatLocalTime() {
  return new Date()
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: PKT_TIME_ZONE,
    })
    .toLowerCase();
}

/** The profile card itself, shared between the click/hover Popover version
 * (below) and the composer's hover-peek portal (ComposerMentionHoverPeek),
 * which can't use PopoverTrigger since the mention isn't a React element -
 * it's a plain DOM chip spliced into a contenteditable. */
export function UserProfileCardContent({
  userId,
  channelId,
  onNavigate,
}: {
  userId: string;
  channelId?: string;
  /** Called after "View profile" navigates - lets the hover-peek portal close itself. */
  onNavigate?: () => void;
}) {
  const { member, loading } = usePersonProfileMember(userId, channelId);
  const livePresence = useUserPresence(userId, "offline");
  const presence = member?.isDisabled ? "offline" : livePresence;
  const { openProfile } = useOpenPersonProfile();
  const { openDirectMessage, openingUserId } = useOpenDirectMessage();

  const displayName = member?.fullName ?? "Member";
  const teamLabel =
    member?.workspaceRole && ROLE_LABELS[member.workspaceRole]
      ? ROLE_LABELS[member.workspaceRole]
      : "Workspace member";
  const messaging = openingUserId === userId;

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <PageLoader />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <p className="min-w-0 truncate text-lg font-semibold leading-tight">
          {displayName}
          {member?.isDisabled && (
            <span className="text-destructive"> (deactivated)</span>
          )}
        </p>
        <span className="relative inline-flex shrink-0">
          <Avatar className="size-10">
            {member?.avatarUrl ? (
              <AvatarImage src={member.avatarUrl} alt={displayName} />
            ) : null}
            <AvatarFallback
              className={cn(
                "text-sm font-semibold",
                avatarColorClassForKey(userId, displayName)
              )}
            >
              {avatarInitialFromName(displayName)}
            </AvatarFallback>
          </Avatar>
          <span
            aria-hidden
            className={cn(
              "absolute right-0.5 bottom-0.5 z-10 size-2.5 rounded-full border-2 border-popover",
              presence === "offline"
                ? presenceOfflineDotClass()
                : presenceDotClass(presence)
            )}
          />
        </span>
      </div>

      <Separator />

      <div className="space-y-2.5 px-4 py-3">
        <div className="flex items-center gap-2.5 text-sm">
          <MailIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate">{member?.email ?? "—"}</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm">
          <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
          <span>{formatLocalTime()} local time</span>
        </div>
        <div className="flex items-center gap-2.5 text-sm">
          <UsersIcon className="size-4 shrink-0 text-muted-foreground" />
          <span>{teamLabel}</span>
        </div>
      </div>

      <Separator />

      <div className="flex gap-2 p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => void openDirectMessage(userId)}
          disabled={messaging}
        >
          <MessageCircleIcon className="size-3.5" />
          Chat
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => {
            openProfile(userId);
            onNavigate?.();
          }}
        >
          <UserIcon className="size-3.5" />
          View profile
        </Button>
      </div>
    </>
  );
}

/** Small hover-card style peek at a member's profile — used for @mention clicks. */
export function UserProfilePeek({
  userId,
  channelId,
  trigger,
}: {
  userId: string;
  channelId?: string;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} openOnHover delay={200} closeDelay={150} />
      <PopoverContent align="start" className="w-80 gap-0 overflow-hidden p-0">
        <UserProfileCardContent
          userId={userId}
          channelId={channelId}
          onNavigate={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
