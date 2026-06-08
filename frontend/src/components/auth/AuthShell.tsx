"use client";

import { RiseUpLogo } from "@/components/brand/RiseUpLogo";
import { cn } from "@/lib/utils";

export function AuthShell({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className={cn("w-full max-w-md space-y-5", className)}>
        <div className="flex justify-center">
          <RiseUpLogo size="lg" />
        </div>
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </header>
        {children}
      </section>
    </main>
  );
}
