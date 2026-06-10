import type { DirectMessage, DmParticipant } from "@/lib/types/chat";

type WorkspaceMemberLike = {
  id: string;
  fullName: string;
  email?: string;
};

export function otherGroupParticipants(
  participants: DmParticipant[] | undefined,
  currentUserId?: string | null
): DmParticipant[] {
  if (!participants?.length) return [];
  if (!currentUserId) return participants;
  return participants.filter((p) => p.id !== currentUserId);
}

export function resolveGroupDmTitle(
  dm: Pick<DirectMessage, "name" | "isGroup" | "participants">,
  currentUserId?: string | null
): string {
  if (!dm.isGroup) return dm.name;

  const others = otherGroupParticipants(dm.participants, currentUserId);
  if (others.length) {
    return others.map((p) => p.fullName).join(", ");
  }

  const custom = dm.name?.trim();
  if (custom && custom.toLowerCase() !== "group chat") {
    return custom;
  }

  return dm.name || "Group chat";
}

export function enrichGroupDm(
  dm: DirectMessage,
  workspaceMembers: WorkspaceMemberLike[],
  currentUserId?: string | null
): DirectMessage {
  if (!dm.isGroup) return dm;

  if (dm.participants?.length) {
    return {
      ...dm,
      name: resolveGroupDmTitle(dm, currentUserId),
    };
  }

  const custom = dm.name?.trim();
  const isGenericName = !custom || custom.toLowerCase() === "group chat";
  let participants: DmParticipant[] = [];

  if (!isGenericName && custom.includes(",")) {
    const names = custom.split(",").map((s) => s.trim()).filter(Boolean);
    participants = names.map((name) => {
      const member = workspaceMembers.find(
        (m) =>
          m.fullName === name ||
          m.fullName.toLowerCase() === name.toLowerCase()
      );
      return member
        ? { id: member.id, fullName: member.fullName }
        : { id: `name:${name}`, fullName: name };
    });
  } else if (dm.members?.length) {
    participants = dm.members
      .map((firstName) => {
        const member = workspaceMembers.find(
          (m) =>
            m.fullName.split(" ")[0] === firstName ||
            m.fullName === firstName
        );
        return member
          ? { id: member.id, fullName: member.fullName }
          : null;
      })
      .filter((p): p is DmParticipant => p !== null);
  }

  if (participants.length === 0) {
    return dm;
  }

  const enriched = { ...dm, participants };
  return {
    ...enriched,
    name: resolveGroupDmTitle(enriched, currentUserId),
  };
}

export function enrichGroupDms(
  dms: DirectMessage[],
  workspaceMembers: WorkspaceMemberLike[],
  currentUserId?: string | null
): DirectMessage[] {
  return dms.map((dm) => enrichGroupDm(dm, workspaceMembers, currentUserId));
}
