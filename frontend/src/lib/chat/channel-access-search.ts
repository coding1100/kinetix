import type { WorkspaceMemberOption } from "@/lib/types/chat";

export function filterWorkspaceMembersToAdd(
  workspaceMembers: WorkspaceMemberOption[],
  channelMemberIds: ReadonlySet<string>,
  query: string
): WorkspaceMemberOption[] {
  const q = query.trim().toLowerCase();

  return workspaceMembers.filter(
    (member) =>
      !channelMemberIds.has(member.id) &&
      (!q ||
        member.fullName.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q))
  );
}
