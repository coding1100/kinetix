"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AppWindowIcon,
  BoxIcon,
  CheckIcon,
  SearchIcon,
  SettingsIcon,
  UserPlusIcon,
  UsersIcon,
  WandSparklesIcon,
  PlusIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetSessionScopedState } from "@/lib/auth/reset-session-scoped-state";
import {
  selectActiveWorkspace,
  useAuthStore,
  workspaceInitials,
} from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const manageItems = [
  { label: "Apps", icon: AppWindowIcon },
  { label: "Templates", icon: BoxIcon },
  { label: "Custom Fields", icon: SettingsIcon },
  { label: "Automations", icon: WandSparklesIcon },
];

export function WorkspaceSwitcherPopup({
  onClose,
}: {
  onClose?: () => void;
}) {
  const workspaces = useAuthStore((s) => s.workspaces);
  const activeWorkspace = useAuthStore(selectActiveWorkspace);
  const setActiveWorkspace = useAuthStore((s) => s.setActiveWorkspace);
  const [search, setSearch] = useState("");

  if (!activeWorkspace && workspaces.length === 0) {
    return (
      <div className="w-[320px] p-4 text-sm text-muted-foreground">
        No workspaces yet.
      </div>
    );
  }

  const current = activeWorkspace ?? workspaces[0]!;
  const filteredWorkspaces = search.trim()
    ? workspaces.filter((workspace) =>
        workspace.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : workspaces;

  return (
    <div className="w-[320px] space-y-3 p-2">
      <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <div className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-primary text-white">
          <span className="text-xs font-bold">
            {workspaceInitials(current.name)}
          </span>
        </div>
        <div>
          <p className="text-base font-semibold">{current.name}</p>
          <p className="text-sm capitalize text-muted-foreground">
            {current.role.toLowerCase().replace("_", " ")} · Active
          </p>
        </div>
      </div>

      {workspaces.length > 1 ? (
        <div className="space-y-1">
          <p className="px-1 text-xs font-medium text-muted-foreground">
            Switch workspace
          </p>
          <div className="relative px-1 pb-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Search workspaces"
              className="h-8 pl-7 text-sm"
            />
          </div>
          {filteredWorkspaces.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              No workspaces found
            </p>
          ) : null}
          {filteredWorkspaces.map((workspace) => {
            const isActive = workspace.id === current.id;
            return (
              <Button
                key={workspace.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-2",
                  isActive && "bg-accent"
                )}
                onClick={() => {
                  onClose?.();
                  if (workspace.id === current.id) return;
                  resetSessionScopedState();
                  setActiveWorkspace(workspace.id);
                  toast.success(`Switched to ${workspace.name}`);
                }}
              >
                <span className="grid size-6 place-items-center rounded bg-muted text-[10px] font-bold">
                  {workspaceInitials(workspace.name)}
                </span>
                <span className="flex-1 truncate text-left">
                  {workspace.name}
                </span>
                {isActive ? <CheckIcon className="size-4 text-primary" /> : null}
              </Button>
            );
          })}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="justify-center"
          nativeButton={false}
          render={<Link href="/people" onClick={() => onClose?.()} />}
        >
          <UsersIcon className="size-4" />
          People
        </Button>
        <Button
          variant="outline"
          className="justify-center"
          nativeButton={false}
          render={<Link href="/people?invite=1" onClick={() => onClose?.()} />}
        >
          <UserPlusIcon className="size-4" />
          Invite
        </Button>
      </div>

      <Button
        variant="outline"
        className="w-full justify-center"
        nativeButton={false}
        render={<Link href="/workspace/settings" onClick={() => onClose?.()} />}
      >
        <SettingsIcon className="size-4" />
        Workspace settings
      </Button>

      <div className="space-y-1">
        <p className="px-1 text-xs font-medium text-muted-foreground">Manage</p>
        {manageItems.map(({ label, icon: Icon }) => (
          <Button
            key={label}
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              onClose?.();
              toast(`${label} — Phase 3`);
            }}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
      </div>

      <Button
        variant="outline"
        nativeButton={false}
        render={
          <Link
            href="/workspace/create/use-case"
            onClick={() => onClose?.()}
          />
        }
        className="w-full justify-center"
      >
        <PlusIcon className="size-4" />
        Create Workspace
      </Button>
    </div>
  );
}
