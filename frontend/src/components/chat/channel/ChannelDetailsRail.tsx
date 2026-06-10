"use client";

import { useMemo } from "react";
import {
  SearchIcon,
  ReplyIcon,
  SettingsIcon,
} from "lucide-react";
import {
  useChatStore,
  type ChannelDetailsView,
} from "@/stores/chat-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChannelMembers } from "@/hooks/use-channel-members";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";

const RAIL_ACTIONS: {
  view: Exclude<ChannelDetailsView, "followers" | "settings">;
  label: string;
  icon: typeof SearchIcon;
}[] = [
  { view: "search", label: "Search Channel", icon: SearchIcon },
  { view: "replies", label: "Replies", icon: ReplyIcon },
];

const AVATAR_RING = "ring-1 ring-card";
const VISIBLE_FOLLOWER_AVATARS = 3;

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

export function ChannelDetailsRail({ channelId }: { channelId: string }) {
  const { channelDetailsView, toggleChannelDetailsView } = useChatStore();
  const { members } = useChannelMembers(channelId);

  const { preview, showCountBadge, displayCount, usingFollowers } = useMemo(() => {
    const following = members.filter((m) => m.isFollowing);
    const useFollowers = following.length > 0;
    const source = useFollowers ? following : members;
    const displayCount = source.length;
    const preview = source.slice(0, VISIBLE_FOLLOWER_AVATARS).map((m) => ({
      id: m.id,
      name: m.fullName,
    }));
    // ClickUp: up to 3 avatars; total count badge only when more than 3 people
    const showCountBadge = displayCount > VISIBLE_FOLLOWER_AVATARS;
    return { preview, showCountBadge, displayCount, usingFollowers: useFollowers };
  }, [members]);

  const settingsActive = channelDetailsView === "settings";
  const followersActive = channelDetailsView === "followers";

  return (
    <div
      className="flex w-14 shrink-0 items-start justify-center py-3 px-3"
      aria-label="Channel details"
    >
      <nav className="flex w-9 flex-col items-center gap-1.5 rounded-md border border-border px-1 py-1 shadow-none">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                className={cn(
                  "h-auto w-full flex-col gap-0 rounded-md px-0 py-0.5",
                  followersActive && ""
                )}
                onClick={() => toggleChannelDetailsView("followers")}
                aria-label="Followers"
                aria-pressed={followersActive}
              >
                <div className="flex flex-col items-center">
                  {preview.map((f, i) => (
                    <Avatar
                      key={f.id}
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
                          avatarColorClassForKey(f.id, f.name)
                        )}
                      >
                        {avatarInitialFromName(f.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {showCountBadge && (
                    <Avatar size="sm" className={cn("-mt-1.5 size-6", AVATAR_RING)}>
                      <AvatarFallback className="bg-muted text-[9px] font-medium text-muted-foreground">
                        {displayCount > 99 ? "99+" : displayCount}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              </Button>
            }
          />
          <TooltipContent side="left">
            {usingFollowers
              ? `${displayCount} follower${displayCount === 1 ? "" : "s"}`
              : displayCount > 0
                ? `${displayCount} with access`
                : "Followers"}
          </TooltipContent>
        </Tooltip>

        <Separator className="w-6" />

        <div className="flex flex-col items-center gap-0">
          {RAIL_ACTIONS.map(({ view, label, icon }) => (
            <RailIconButton
              key={view}
              label={label}
              icon={icon}
              active={channelDetailsView === view}
              onClick={() => toggleChannelDetailsView(view)}
            />
          ))}
        </div>

        <RailIconButton
          label="Settings"
          icon={SettingsIcon}
          active={settingsActive}
          onClick={() => toggleChannelDetailsView("settings")}
        />
      </nav>
    </div>
  );
}
