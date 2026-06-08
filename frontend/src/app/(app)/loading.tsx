import { PageLoader } from "@/components/ui/page-loader";

export default function AppSegmentLoading() {
  return (
    <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <PageLoader overlay />
    </main>
  );
}
