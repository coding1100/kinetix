"use client";

import { useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";

export function useOpenPersonProfile() {
  const openPersonProfile = useChatStore((s) => s.openPersonProfile);
  const personProfileUserId = useChatStore((s) => s.personProfileUserId);

  const openProfile = useCallback(
    (userId: string) => {
      openPersonProfile(userId);
    },
    [openPersonProfile]
  );

  return { openProfile, personProfileUserId };
}
