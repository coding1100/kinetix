"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { RISEUP_BOLT_PATH } from "@/components/brand/riseup-bolt";

export function RiseUpAnimatedMark({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `${uid}-loader-grad`;

  return (
    <div
      className={cn("relative grid size-20 place-items-center", className)}
      aria-hidden
    >
      <div className="riseup-loader-glow absolute inset-0 rounded-full bg-primary/25 blur-2xl" />
      <div className="riseup-loader-ring-outer absolute inset-0 rounded-full border border-primary/10" />
      <div className="riseup-loader-ring absolute inset-2 rounded-full border border-primary/20" />
      <svg
        viewBox="0 0 24 24"
        className={cn(
          "riseup-loader-mark relative size-14 drop-shadow-[0_4px_16px_rgba(124,77,255,0.45)]",
          iconClassName
        )}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="6"
            y1="3"
            x2="18"
            y2="21"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#c084fc">
              <animate
                attributeName="stop-color"
                values="#c084fc;#a855f7;#7c4dff;#c084fc"
                dur="3s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="50%" stopColor="#7c4dff">
              <animate
                attributeName="stop-color"
                values="#7c4dff;#8b5cf6;#6366f1;#7c4dff"
                dur="3s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#4338ca">
              <animate
                attributeName="stop-color"
                values="#4338ca;#5b21b6;#4f46e5;#4338ca"
                dur="3s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>
        <path d={RISEUP_BOLT_PATH} fill={`url(#${gradientId})`} />
      </svg>
    </div>
  );
}
