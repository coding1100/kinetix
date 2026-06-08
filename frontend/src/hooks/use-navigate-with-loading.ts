"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLoadingStore } from "@/stores/loading-store";

export function useNavigateWithLoading() {
  const router = useRouter();
  const showLoading = useLoadingStore((s) => s.showLoading);

  return useCallback(
    (href: string, message = "Loading…") => {
      showLoading(message);
      router.push(href);
    },
    [router, showLoading]
  );
}
