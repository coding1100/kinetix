"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EmojiClickData } from "emoji-picker-react";
import { EmojiStyle } from "emoji-picker-react";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export function EmojiPickerPopover({
  trigger,
  onSelectEmoji,
  onOpenChange,
}: {
  trigger: React.ReactElement;
  onSelectEmoji: (emoji: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" sideOffset={6} className="w-auto p-0">
        <EmojiPicker
          width={320}
          height={380}
          searchPlaceHolder="Search emoji"
          emojiStyle={EmojiStyle.NATIVE}
          lazyLoadEmojis
          onEmojiClick={(emojiData: EmojiClickData) => {
            onSelectEmoji(emojiData.emoji);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
