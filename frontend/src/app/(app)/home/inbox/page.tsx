import { Suspense } from "react";
import { InboxView } from "@/components/home/InboxView";
import { PageLoader } from "@/components/ui/page-loader";

export default function InboxPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading…" />}>
      <InboxView />
    </Suspense>
  );
}
