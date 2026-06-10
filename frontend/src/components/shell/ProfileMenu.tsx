"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  UserIcon,
  SettingsIcon,
  BellIcon,
  PaletteIcon,
  CommandIcon,
  DownloadIcon,
  CircleHelpIcon,
  BugIcon,
  VolumeXIcon,
  SmileIcon,
  ListPlusIcon,
  BriefcaseIcon,
  TimerIcon,
  NotebookIcon,
  VideoIcon,
  AlarmClockIcon,
  FileTextIcon,
  PenToolIcon,
  UsersIcon,
  LayoutDashboardIcon,
  SparklesIcon,
  Trash2Icon,
  LogOutIcon,
  PinIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarWithPresence, PresenceDot } from "@/components/shared/AvatarWithPresence";
import { logout } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth-store";
import { useLoadingStore } from "@/stores/loading-store";
import { useSettingsStore } from "@/stores/settings-store";
import {
  presenceLabel,
  useProfileStore,
  type PresenceStatus,
} from "@/stores/profile-store";
import { useTopBarStore } from "@/stores/topbar-store";
import { cn } from "@/lib/utils";
import {
  avatarColorClassForKey,
  avatarInitial,
} from "@/lib/user-display";
import { PROFILE_MENU_VISIBILITY } from "@/lib/profile-menu-config";
import type { AuthUser } from "@/lib/api/auth";

type ToolItem = {
  id: string;
  label: string;
  icon: ReactNode;
  action: () => void;
  pinnable?: boolean;
};

function displayName(user: AuthUser | null) {
  if (user?.fullName?.trim()) return user.fullName.trim();
  if (user?.email) {
    const local = user.email.split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return "User";
}

function ProfileAvatar({
  user,
  presence,
  size = "sm",
  showPresence = true,
}: {
  user: AuthUser | null;
  presence: PresenceStatus;
  size?: "sm" | "lg";
  showPresence?: boolean;
}) {
  const dim = size === "lg" ? "size-10" : "size-7";
  return (
    <AvatarWithPresence
      presence={presence}
      showPresence={showPresence}
      dotSize={size === "lg" ? "md" : "sm"}
      borderClass="border-popover"
    >
      <Avatar className={dim}>
        {user?.avatarUrl ? (
          <AvatarImage src={user.avatarUrl} alt={displayName(user)} />
        ) : null}
        <AvatarFallback
          className={cn(
            "text-[10px] font-semibold uppercase",
            size === "lg" && "text-sm",
            avatarColorClassForKey(user?.id, user?.fullName ?? user?.email)
          )}
        >
          {avatarInitial(user?.fullName, user?.email)}
        </AvatarFallback>
      </Avatar>
    </AvatarWithPresence>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <DropdownMenuItem
      className="gap-2.5 py-2"
      onClick={onClick}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1">{label}</span>
      {trailing}
    </DropdownMenuItem>
  );
}

export function ProfileMenu() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);
  const showLoading = useLoadingStore((s) => s.showLoading);
  const openSheet = useTopBarStore((s) => s.openSheet);
  const setDesktopNotifications = useSettingsStore(
    (s) => s.setDesktopNotifications
  );

  const statusText = useProfileStore((s) => s.statusText);
  const setStatusText = useProfileStore((s) => s.setStatusText);
  const presence = useProfileStore((s) => s.presence);
  const setPresence = useProfileStore((s) => s.setPresence);
  const setMutedUntil = useProfileStore((s) => s.setMutedUntil);
  const pinnedToolIds = useProfileStore((s) => s.pinnedToolIds);
  const togglePinnedTool = useProfileStore((s) => s.togglePinnedTool);
  const [open, setOpen] = useState(false);
  const [statusDraft, setStatusDraft] = useState(statusText);

  useEffect(() => {
    if (open) setStatusDraft(statusText);
  }, [open, statusText]);

  const name = displayName(user);

  const applyMute = (minutes: number | null, label: string) => {
    if (minutes === null) {
      setMutedUntil(null);
      setDesktopNotifications(true);
      toast.success("Notifications unmuted");
      return;
    }
    if (minutes === -1) {
      setMutedUntil(-1);
      setDesktopNotifications(false);
      toast.success("Notifications muted until you turn them back on");
      return;
    }
    setMutedUntil(Date.now() + minutes * 60_000);
    setDesktopNotifications(false);
    toast.success(`Notifications muted — ${label}`);
  };

  const handleLogout = async () => {
    setOpen(false);
    showLoading("");
    try {
      await logout();
    } catch {
      /* clear locally */
    }
    clearSession();
    toast.success("Logged out");
    router.push("/auth/login");
  };

  const closeAnd = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  const personalTools: ToolItem[] = [
    {
      id: "create-task",
      label: "Create task",
      icon: <ListPlusIcon className="size-4" />,
      pinnable: true,
      action: () => router.push("/spaces"),
    },
    {
      id: "my-work",
      label: "My Work",
      icon: <BriefcaseIcon className="size-4" />,
      action: () => router.push("/home/my-tasks"),
    },
    {
      id: "track-time",
      label: "Track Time",
      icon: <TimerIcon className="size-4" />,
      action: () => router.push("/home/my-tasks/today"),
    },
    {
      id: "notepad",
      label: "Notepad",
      icon: <NotebookIcon className="size-4" />,
      action: () => toast("Notepad — coming soon"),
    },
    {
      id: "record-clip",
      label: "Record a Clip",
      icon: <VideoIcon className="size-4" />,
      pinnable: true,
      action: () => toast("Clip recording — coming soon"),
    },
    {
      id: "create-reminder",
      label: "Create Reminder",
      icon: <AlarmClockIcon className="size-4" />,
      action: () => router.push("/home/my-tasks/reminders"),
    },
    {
      id: "create-doc",
      label: "Create Doc",
      icon: <FileTextIcon className="size-4" />,
      pinnable: true,
      action: () => router.push("/home/posts"),
    },
    {
      id: "create-whiteboard",
      label: "Create Whiteboard",
      icon: <PenToolIcon className="size-4" />,
      action: () => toast("Whiteboards — coming soon"),
    },
    {
      id: "view-people",
      label: "View People",
      icon: <UsersIcon className="size-4" />,
      action: () => router.push("/people"),
    },
    {
      id: "create-dashboard",
      label: "Create Dashboard",
      icon: <LayoutDashboardIcon className="size-4" />,
      pinnable: true,
      action: () => toast("Dashboards — coming soon"),
    },
    {
      id: "ai-notetaker",
      label: "AI Notetaker",
      icon: <SparklesIcon className="size-4" />,
      action: () => openSheet("ai"),
    },
  ];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label="Profile menu"
          >
            <ProfileAvatar user={user} presence={presence} />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[300px] overflow-hidden p-0"
      >
        <div className="border-b border-border px-3 py-3">
          <div className="flex items-center gap-3">
            <ProfileAvatar user={user} presence={presence} size="lg" />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="truncate text-left text-sm font-semibold hover:underline"
                onClick={closeAnd(() => router.push("/profile"))}
              >
                {name}
              </button>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="h-auto gap-1 px-0 py-0 text-xs text-muted-foreground shadow-none ring-0 hover:bg-transparent data-popup-open:bg-transparent">
                  {presenceLabel(presence)}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {(
                    [
                      ["online", "Online"],
                      ["away", "Away"],
                      ["busy", "Busy"],
                      ["offline", "Offline"],
                    ] as const
                  ).map(([value, label]) => (
                    <DropdownMenuCheckboxItem
                      key={value}
                      checked={presence === value}
                      onCheckedChange={() => setPresence(value)}
                    >
                      <PresenceDot presence={value} size="sm" inline className="mr-2" />
                      {label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </div>
          </div>
          <div className="relative mt-3">
            <SmileIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9 text-sm"
              placeholder="Set status"
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value)}
              onBlur={() => setStatusText(statusDraft.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setStatusText(statusDraft.trim());
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>
          {statusText ? (
            <p className="mt-1.5 truncate text-xs text-muted-foreground">
              {statusText}
            </p>
          ) : null}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="mt-2 w-full gap-2.5 py-2">
              <VolumeXIcon className="size-4 text-muted-foreground" />
              Mute notifications
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => applyMute(30, "30 minutes")}>
                For 30 minutes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyMute(60, "1 hour")}>
                For 1 hour
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyMute(8 * 60, "8 hours")}>
                For 8 hours
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => applyMute(-1, "until turned on")}>
                Until I turn back on
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => applyMute(null, "")}>
                Unmute
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </div>

        <div className="p-1">
          <MenuRow
            icon={<UserIcon className="size-4" />}
            label="Profile"
            onClick={closeAnd(() => router.push("/profile"))}
          />
          <MenuRow
            icon={<SettingsIcon className="size-4" />}
            label="Settings"
            onClick={closeAnd(() => router.push("/settings"))}
          />
          <MenuRow
            icon={<BellIcon className="size-4" />}
            label="Notifications"
            onClick={closeAnd(() => router.push("/settings"))}
          />
          {PROFILE_MENU_VISIBILITY.themes ? (
            <MenuRow
              icon={<PaletteIcon className="size-4" />}
              label="Themes"
              onClick={closeAnd(() => router.push("/settings"))}
            />
          ) : null}
          <MenuRow
            icon={<CommandIcon className="size-4" />}
            label="Keyboard shortcuts"
            onClick={closeAnd(() => openSheet("help"))}
          />
          <MenuRow
            icon={<DownloadIcon className="size-4" />}
            label="Download Kinetix"
            onClick={() => toast("Desktop app — coming soon")}
            trailing={<ExternalLinkIcon className="size-3.5 text-muted-foreground" />}
          />
          <DropdownMenuItem
            className="gap-2.5 py-2"
            onClick={closeAnd(() => openSheet("help"))}
          >
            <CircleHelpIcon className="size-4 text-muted-foreground" />
            <span className="flex-1">Help</span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                toast("Thanks — feedback noted");
              }}
              aria-label="Report a bug"
            >
              <BugIcon className="size-4" />
            </Button>
          </DropdownMenuItem>
        </div>

        {PROFILE_MENU_VISIBILITY.personalTools ? (
          <>
            <DropdownMenuSeparator className="m-0" />
            <DropdownMenuGroup className="max-h-[220px] overflow-y-auto p-1 pb-2">
              <p className="px-2 pt-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Personal Tools
              </p>
              {personalTools.map((tool) => {
                const pinned = pinnedToolIds.includes(tool.id);
                return (
                  <DropdownMenuItem
                    key={tool.id}
                    className="gap-2.5 py-2"
                    onClick={closeAnd(tool.action)}
                  >
                    <span className="text-muted-foreground">{tool.icon}</span>
                    <span className="flex-1">{tool.label}</span>
                    {tool.pinnable ? (
                      <button
                        type="button"
                        className={cn(
                          "rounded p-0.5 text-muted-foreground hover:text-foreground",
                          pinned && "text-primary"
                        )}
                        aria-label={pinned ? "Unpin" : "Pin to toolbar"}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          togglePinnedTool(tool.id);
                        }}
                      >
                        <PinIcon
                          className={cn("size-3.5", pinned && "fill-current")}
                        />
                      </button>
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </>
        ) : null}

        <DropdownMenuSeparator className="m-0" />
        <div className="p-1">
          <MenuRow
            icon={<Trash2Icon className="size-4" />}
            label="Trash"
            onClick={closeAnd(() => toast("Trash is empty"))}
          />
          <DropdownMenuItem
            variant="destructive"
            className="gap-2.5 py-2"
            onClick={() => void handleLogout()}
          >
            <LogOutIcon className="size-4" />
            Log out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
