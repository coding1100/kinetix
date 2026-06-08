"use client";

import { ChevronDownIcon } from "lucide-react";
import type { ChatJumpOption } from "@/lib/chat/dates";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const JUMP_ITEMS: { option: ChatJumpOption; label: string }[] = [
  { option: "today", label: "Today" },
  { option: "yesterday", label: "Yesterday" },
  { option: "last-week", label: "Last week" },
  { option: "last-month", label: "Last month" },
  { option: "first", label: "First message" },
];

export function ChatDateDivider({
  label,
  onJump,
}: {
  label: string;
  onJump: (option: ChatJumpOption) => void;
}) {
  return (
    <div className="relative my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" aria-hidden />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 gap-1 rounded-full border-border bg-card px-3 text-xs font-medium shadow-none hover:bg-muted/50"
            >
              {label}
              <ChevronDownIcon className="size-3.5 opacity-60" />
            </Button>
          }
        />
        <DropdownMenuContent align="center" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[10px] font-semibold tracking-wide text-muted-foreground">
              JUMP TO
            </DropdownMenuLabel>
            {JUMP_ITEMS.map((item) => (
              <DropdownMenuItem
                key={item.option}
                onClick={() => onJump(item.option)}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}
