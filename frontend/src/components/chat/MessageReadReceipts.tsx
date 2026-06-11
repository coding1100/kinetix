"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";

export type ReadReceiptMember = {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
};

export function MessageReadReceipts({
  readByUserIds,
  membersById,
}: {
  readByUserIds: string[];
  membersById: Record<string, ReadReceiptMember>;
}) {
  const readers = readByUserIds
    .map((id) => {
      const member = membersById[id];
      return (
        member ?? {
          id,
          fullName: "Member",
          avatarUrl: null,
        }
      );
    })
    .filter((m, index, arr) => arr.findIndex((x) => x.id === m.id) === index);

  if (readers.length === 0) return null;

  const label = readers.map((r) => r.fullName).join(", ");

  return (
    <div className="flex items-center" aria-label={`Seen by ${label}`}>
      <div className="flex items-center -space-x-1">
        {readers.map((reader) => (
          <Tooltip key={reader.id}>
            <TooltipTrigger
              className="rounded-full"
              aria-label={`Seen by ${reader.fullName}`}
            >
              <Avatar className="size-4 ring-2 ring-background">
                {reader.avatarUrl ? (
                  <AvatarImage src={reader.avatarUrl} alt={reader.fullName} />
                ) : null}
                <AvatarFallback
                  className={avatarColorClassForKey(
                    reader.id,
                    reader.fullName
                  )}
                >
                  <span className="text-[8px] font-semibold leading-none">
                    {avatarInitialFromName(reader.fullName)}
                  </span>
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Seen by {reader.fullName}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
