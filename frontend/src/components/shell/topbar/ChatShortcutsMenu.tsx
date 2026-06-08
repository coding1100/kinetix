"use client";

import { useRouter } from "next/navigation";
import {
  MessageSquareIcon,
  HashIcon,
  MessageCircleIcon,
  InboxIcon,
  PlusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUiStore } from "@/stores/ui-store";
import { useShellStore } from "@/stores/shell-store";

export function ChatShortcutsMenu() {
  const router = useRouter();
  const openModal = useUiStore((s) => s.openModal);
  const setSecondaryPanelOpen = useShellStore((s) => s.setSecondaryPanelOpen);

  const goChat = () => {
    setSecondaryPanelOpen(true);
    router.push("/chat");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Chat shortcuts">
            <MessageSquareIcon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Chat shortcuts</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={goChat}>
          <MessageSquareIcon className="size-4" />
          Open Chat
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openModal("new-dm")}>
          <MessageCircleIcon className="size-4" />
          New direct message
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openModal("new-channel")}>
          <PlusIcon className="size-4" />
          New channel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/chat/channels")}>
          <HashIcon className="size-4" />
          Browse channels
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/home/inbox")}>
          <InboxIcon className="size-4" />
          Chat inbox
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/home/replies")}>
          <MessageSquareIcon className="size-4" />
          Replies
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/home/chat-activity")}>
          <MessageCircleIcon className="size-4" />
          Chat activity
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
