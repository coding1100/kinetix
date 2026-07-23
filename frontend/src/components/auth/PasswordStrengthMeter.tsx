"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES, passwordStrength } from "@/lib/password";

const STRENGTH_COPY: Record<string, { label: string; barClass: string; bars: number }> = {
  empty: { label: "", barClass: "bg-muted", bars: 0 },
  weak: { label: "Weak", barClass: "bg-destructive", bars: 1 },
  fair: { label: "Fair", barClass: "bg-amber-500", bars: 2 },
  good: { label: "Good", barClass: "bg-yellow-500", bars: 3 },
  strong: { label: "Strong", barClass: "bg-emerald-500", bars: 4 },
};

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = passwordStrength(password);
  const { label, barClass, bars } = STRENGTH_COPY[strength];

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full bg-muted transition-colors",
                i < bars && barClass
              )}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {PASSWORD_RULES.map((rule) => {
          const passed = rule.test(password);
          return (
            <li
              key={rule.key}
              className={cn(
                "flex items-center gap-1 text-xs",
                passed ? "text-emerald-600" : "text-muted-foreground"
              )}
            >
              {passed ? (
                <CheckIcon className="size-3" />
              ) : (
                <XIcon className="size-3" />
              )}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
