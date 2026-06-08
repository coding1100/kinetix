"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** Page-level tabs (Inbox, Chat activity, etc.) — bold label + bottom underline when active. */
export function PageTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <Tabs
      value={active}
      onValueChange={(v) => v && onChange(v as T)}
      className={cn("w-full", className)}
    >
      <TabsList variant="line" className="px-6">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/** Shared underline tab button row for non-Radix/Base-UI tab state. */
export function UnderlineTabBar<T extends string>({
  tabs,
  active,
  onChange,
  className,
  size = "default",
}: {
  tabs: { id: T; label: string; disabled?: boolean }[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  size?: "default" | "compact";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex items-center gap-0 border-b border-border",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            title={tab.disabled ? "Coming soon" : undefined}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={cn(
              "relative -mb-px border-0 bg-transparent transition-colors outline-none",
              size === "compact" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2.5 text-sm",
              "font-medium text-muted-foreground hover:text-foreground",
              isActive && "font-semibold text-foreground",
              isActive &&
                "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
              tab.disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
