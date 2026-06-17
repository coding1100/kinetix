"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ConversationType } from "@/lib/types/chat";
import type { MentionSelection } from "@/lib/chat/mention-types";
import type { MentionMember } from "@/hooks/use-mention-members";
import { MentionPickerContent } from "./MentionPickerContent";

export function MentionPickerPopover({
  trigger,
  conversationType,
  conversationId,
  members,
  open,
  onOpenChange,
  onSelectMention,
}: {
  trigger: React.ReactElement;
  conversationType?: ConversationType;
  conversationId?: string;
  members?: MentionMember[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelectMention: (selection: MentionSelection) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const pickerOpen = isControlled ? open : internalOpen;

  const setPickerOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80 overflow-hidden bg-card p-0 shadow-lg"
      >
        <MentionPickerContent
          conversationType={conversationType}
          conversationId={conversationId}
          members={members}
          onSelect={(selection) => {
            onSelectMention(selection);
            setPickerOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
