import { Suspense } from "react";
import { HomeSidebar } from "@/components/shell/HomeSidebar";
import { PageLoader } from "@/components/ui/page-loader";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <Suspense fallback={<PageLoader label="Loading…" className="w-[260px] shrink-0" />}>
        <HomeSidebar />
      </Suspense>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {children}
      </main>
    </div>
  );
}
