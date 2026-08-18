"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MessageSquareIcon, NotebookPenIcon, RadioTowerIcon } from "lucide-react";

const SURFACE_TABS = [
  { href: "", label: "Messages", icon: MessageSquareIcon },
  { href: "/canvas", label: "Canvas", icon: NotebookPenIcon },
  { href: "/huddle", label: "Huddle", icon: RadioTowerIcon },
] as const;

export function ChannelSurfaceNav({
  channelId,
  active,
  className,
}: {
  channelId: string;
  active: "messages" | "canvas" | "huddle";
  className?: string;
}) {
  return (
    <nav className={cn("flex items-center gap-1 border-b border-border px-4 py-2", className)}>
      {SURFACE_TABS.map((tab) => {
        const href = `/chat/c/${channelId}${tab.href}`;
        const isActive = active === (tab.label.toLowerCase() as typeof active);
        const Icon = tab.icon;
        return (
          <Button
            key={tab.label}
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            nativeButton={false}
            render={<Link href={href} aria-current={isActive ? "page" : undefined} />}
            className="h-8 gap-1.5 px-3"
          >
            <Icon className="size-4" />
            {tab.label}
          </Button>
        );
      })}
    </nav>
  );
}
