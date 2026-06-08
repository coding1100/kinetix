"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  selectIsLoading,
  useLoadingStore,
} from "@/stores/loading-store";

function RouteLoadingReset() {
  const pathname = usePathname();
  const resetLoading = useLoadingStore((s) => s.resetLoading);

  useEffect(() => {
    resetLoading();
  }, [pathname, resetLoading]);

  return null;
}

export function GlobalLoader() {
  const isLoading = useLoadingStore(selectIsLoading);
  const message = useLoadingStore((s) => s.message);

  return (
    <>
      <RouteLoadingReset />
      <LoadingOverlay open={isLoading} label={message} />
    </>
  );
}
