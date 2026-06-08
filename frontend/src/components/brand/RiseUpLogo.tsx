import { useId } from "react";
import { cn } from "@/lib/utils";
import { RISEUP_BOLT_PATH } from "@/components/brand/riseup-bolt";
import { APP_NAME } from "@/lib/brand";

type RiseUpLogoProps = {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: { icon: "size-7", text: "text-sm" },
  md: { icon: "size-9", text: "text-xl" },
  lg: { icon: "size-11", text: "text-2xl" },
};

export function RiseUpMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const s = sizeMap[size];
  const gradientId = useId().replace(/:/g, "");

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(
        s.icon,
        "shrink-0 drop-shadow-[0_2px_10px_rgba(124,77,255,0.4)]",
        className
      )}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
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
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="45%" stopColor="#7c4dff" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <path d={RISEUP_BOLT_PATH} fill={`url(#${gradientId})`} />
    </svg>
  );
}

export function RiseUpLogo({
  className,
  showWordmark = true,
  size = "md",
}: RiseUpLogoProps) {
  const s = sizeMap[size];
  return (
    <div className={cn("inline-flex items-center gap-0", className)}>
      <RiseUpMark size={size} className="-mr-[5px]" />
      {showWordmark ? (
        <span
          className={cn(
            s.text,
            "bg-gradient-to-r from-violet-600 to-primary bg-clip-text font-semibold tracking-tight text-transparent"
          )}
        >
          {APP_NAME}
        </span>
      ) : null}
    </div>
  );
}
