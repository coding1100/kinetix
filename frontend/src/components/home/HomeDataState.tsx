"use client";

import { PageLoader } from "@/components/ui/page-loader";

export function HomeDataState({
  loading,
  error,
  empty,
  emptyMessage = "Nothing here yet.",
  children,
}: {
  loading: boolean;
  error: string | null;
  empty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageLoader label="Loading…" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>;
}
