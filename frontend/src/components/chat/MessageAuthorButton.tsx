"use client";

import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useOpenPersonProfile } from "@/hooks/use-open-person-profile";
import { cn } from "@/lib/utils";

export function MessageAuthorButton({
  authorId,
  authorName,
  children,
  className,
}: {
  authorId: string;
  authorName: string;
  children: ReactNode;
  className?: string;
}) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { openProfile, personProfileUserId } = useOpenPersonProfile();
  const isSelf = !authorId || authorId === currentUserId;
  const active = personProfileUserId === authorId;

  if (isSelf) {
    return <span className={className}>{children}</span>;
  }

  return (
    <button
      type="button"
      className={cn(
        "cursor-pointer rounded-sm text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active && "text-primary",
        className
      )}
      onClick={() => openProfile(authorId)}
      title={`View ${authorName}'s profile`}
      aria-label={`View profile for ${authorName}`}
    >
      {children}
    </button>
  );
}
