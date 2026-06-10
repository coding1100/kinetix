"use client";

import { useMemo } from "react";
import { SearchIcon, ReplyIcon, SettingsIcon } from "lucide-react";
import type { DirectMessage } from "@/lib/types/chat";
import { useChatStore, type DmDetailsView } from "@/stores/chat-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/auth-store";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { otherGroupParticipants } from "@/lib/chat/group-dm-display";

const RAIL_ACTIONS: {
  view: Exclude<DmDetailsView, "members">;
  label: string;
  icon: typeof SearchIcon;
}[] = [
  { view: "search", label: "Search messages", icon: SearchIcon },
  { view: "replies", label: "Replies", icon: ReplyIcon },
];

const AVATAR_RING = "ring-1 ring-card";
const VISIBLE_MEMBER_AVATARS = 3;

function RailIconButton({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: typeof SearchIcon;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              "size-8 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              active &&
                "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
            )}
            onClick={onClick}
            aria-label={label}
            aria-pressed={active}
          >
            <Icon className="size-4" strokeWidth={1.5} />
          </Button>
        }
      />
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

export function DmDetailsRail({ dm }: { dm?: DirectMessage | null }) {
  const { dmDetailsView, toggleDmDetailsView } = useChatStore();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isGroup = Boolean(dm?.isGroup);

  const { preview, showCountBadge, displayCount } = useMemo(() => {
    const others = otherGroupParticipants(dm?.participants, currentUserId);
    const displayCount = dm?.participants?.length ?? others.length;
    const preview = others.slice(0, VISIBLE_MEMBER_AVATARS).map((m) => ({
      id: m.id,
      name: m.fullName,
    }));
    const showCountBadge = displayCount > VISIBLE_MEMBER_AVATARS;
    return { preview, showCountBadge, displayCount };
  }, [dm?.participants, currentUserId]);

  const membersActive = dmDetailsView === "members";
  const settingsActive = dmDetailsView === "settings";

  return (
    <div
      className="flex w-14 shrink-0 items-start justify-center px-3 py-3"
      aria-label="Direct message details"
    >
      <nav className="flex w-9 flex-col items-center gap-1.5 rounded-md border border-border px-1 py-1 shadow-none">
        {isGroup ? (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    className={cn(
                      "h-auto w-full flex-col gap-0 rounded-md px-0 py-0.5",
                      membersActive && ""
                    )}
                    onClick={() => toggleDmDetailsView("members")}
                    aria-label="Members"
                    aria-pressed={membersActive}
                  >
                    <div className="flex flex-col items-center">
                      {preview.map((member, i) => (
                        <Avatar
                          key={member.id}
                          size="sm"
                          className={cn(
                            "size-6",
                            AVATAR_RING,
                            i > 0 && "-mt-1.5"
                          )}
                        >
                          <AvatarFallback
                            className={cn(
                              "text-[9px] font-semibold",
                              avatarColorClassForKey(member.id, member.name)
                            )}
                          >
                            {avatarInitialFromName(member.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {showCountBadge ? (
                        <Avatar
                          size="sm"
                          className={cn("-mt-1.5 size-6", AVATAR_RING)}
                        >
                          <AvatarFallback className="bg-muted text-[9px] font-medium text-muted-foreground">
                            {displayCount > 99 ? "99+" : displayCount}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                    </div>
                  </Button>
                }
              />
              <TooltipContent side="left">
                {displayCount > 0
                  ? `${displayCount} member${displayCount === 1 ? "" : "s"}`
                  : "Members"}
              </TooltipContent>
            </Tooltip>

            <Separator className="w-6" />
          </>
        ) : null}

        <div className="flex flex-col items-center gap-0">
          {RAIL_ACTIONS.map(({ view, label, icon }) => (
            <RailIconButton
              key={view}
              label={label}
              icon={icon}
              active={dmDetailsView === view}
              onClick={() => toggleDmDetailsView(view)}
            />
          ))}
        </div>

        <RailIconButton
          label="Settings"
          icon={SettingsIcon}
          active={settingsActive}
          onClick={() => toggleDmDetailsView("settings")}
        />
      </nav>
    </div>
  );
}
