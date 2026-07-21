"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatarWithPresence } from "@/components/shared/AvatarWithPresence";
import type { TeamDetail } from "@/lib/api/teams";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";

export function TeamMembersPanel({
  team,
  manage,
  busy,
  onAddMember,
  onRemoveMember,
}: {
  team: TeamDetail;
  manage: boolean;
  busy: boolean;
  onAddMember: () => void;
  onRemoveMember: (userId: string) => void;
}) {
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Team members</h2>
          <p className="text-sm text-muted-foreground">
            {team.memberCount} member{team.memberCount === 1 ? "" : "s"} in this team
          </p>
        </div>
        {manage ? (
          <Button size="sm" onClick={onAddMember}>
            Add member
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              {manage ? (
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {team.members.map((m) => (
              <tr
                key={m.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <UserAvatarWithPresence
                      name={m.fullName}
                      avatarUrl={m.avatarUrl}
                      presence="offline"
                      avatarClassName="size-8"
                      showPresence={false}
                      fallbackClassName={avatarColorClassForKey(m.id, m.fullName)}
                      fallback={avatarInitialFromName(m.fullName)}
                    />
                    <span className="font-medium">{m.fullName}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {m.role.toLowerCase()}
                  </Badge>
                </td>
                {manage ? (
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => onRemoveMember(m.id)}
                    >
                      Remove
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
