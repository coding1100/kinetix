"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { openDirectMessageForUser } from "@/lib/chat/open-direct-message";

export function useOpenDirectMessage() {
  const router = useRouter();
  const [openingUserId, setOpeningUserId] = useState<string | null>(null);

  const openDirectMessage = useCallback(
    async (userId: string) => {
      setOpeningUserId(userId);
      try {
        await openDirectMessageForUser(userId, router);
      } finally {
        setOpeningUserId(null);
      }
    },
    [router]
  );

  return { openDirectMessage, openingUserId };
}
