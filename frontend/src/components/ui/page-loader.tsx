"use client";

import { RiseUpAnimatedMark } from "@/components/brand/RiseUpLoader";
import { cn } from "@/lib/utils";

function PageLoader({
  label = "Loading…",
  className,
  fullHeight = true,
  overlay = false,
}: {
  label?: string;
  className?: string;
  fullHeight?: boolean;
  /** Blurred overlay centered on the parent (parent must be `position: relative`). */
  overlay?: boolean;
}) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-5">
      <RiseUpAnimatedMark />
      <p className="riseup-loader-label text-sm font-medium tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );

  if (overlay) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
        className={cn(
          "absolute inset-0 z-40 flex items-center justify-center",
          "bg-background/45 backdrop-blur-md supports-backdrop-filter:bg-background/35",
          className
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex flex-col items-center justify-center",
        fullHeight && "min-h-[240px] w-full flex-1",
        className
      )}
    >
      {content}
    </div>
  );
}

export { PageLoader };
