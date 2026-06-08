"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export function StormSparkMark({
  className,
  showCloud = true,
}: {
  className?: string;
  showCloud?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const boltGradId = `${uid}-bolt-grad`;
  const glowFilterId = `${uid}-bolt-glow`;

  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("overflow-visible", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={boltGradId} x1="18" y1="10" x2="30" y2="40">
          <stop offset="0%" stopColor="#e9d5ff" />
          <stop offset="40%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#7c4dff" />
        </linearGradient>
        <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {showCloud ? (
        <g className="riseup-storm-cloud">
          <ellipse cx="20" cy="14" rx="9" ry="5.5" fill="currentColor" className="text-muted-foreground/35" />
          <ellipse cx="28" cy="13" rx="10" ry="6" fill="currentColor" className="text-muted-foreground/45" />
          <ellipse cx="24" cy="16" rx="12" ry="6.5" fill="currentColor" className="text-muted-foreground/30" />
        </g>
      ) : null}

      <path
        className="riseup-storm-lightning"
        d="M24 17 L20 26 H23 L19 36 L29 24 H25 L28 17 Z"
        fill={`url(#${boltGradId})`}
        filter={`url(#${glowFilterId})`}
      />

      <circle className="riseup-storm-spark riseup-storm-spark-1" cx="31" cy="22" r="1.2" fill="#e9d5ff" />
      <circle className="riseup-storm-spark riseup-storm-spark-2" cx="17" cy="30" r="1" fill="#c084fc" />
      <circle className="riseup-storm-spark riseup-storm-spark-3" cx="33" cy="28" r="0.9" fill="#a855f7" />
      <circle className="riseup-storm-spark riseup-storm-spark-4" cx="15" cy="24" r="0.8" fill="#ddd6fe" />
    </svg>
  );
}
