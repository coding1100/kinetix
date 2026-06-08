"use client";

import { RiseUpAnimatedMark } from "@/components/brand/RiseUpLoader";
import { cn } from "@/lib/utils";

function LoadingOverlay({
  open,
  label = "Loading…",
  className,
  fullScreen = true,
  showLabel = true,
}: {
  open: boolean;
  label?: string;
  className?: string;
  fullScreen?: boolean;
  showLabel?: boolean;
}) {
  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label || "Loading"}
      className={cn(
        "z-50 flex items-center justify-center bg-background/45 backdrop-blur-md supports-backdrop-filter:bg-background/35",
        fullScreen ? "fixed inset-0" : "absolute inset-0 rounded-[inherit]",
        className
      )}
    >
      <div className="flex flex-col items-center gap-5">
        <RiseUpAnimatedMark />
        {showLabel && label ? (
          <p className="riseup-loader-label text-sm font-medium tracking-wide text-muted-foreground">
            {label}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export { LoadingOverlay };
