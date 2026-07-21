"use client";

import type { ReactNode } from "react";

export function HomePageShell({
  title,
  subtitle,
  headerRight,
  tabs,
  toolbar,
  children,
}: {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  tabs?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {headerRight ? (
            <div className="flex shrink-0 items-center gap-2">{headerRight}</div>
          ) : null}
        </div>
      </div>

      {tabs}

      {toolbar}

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
