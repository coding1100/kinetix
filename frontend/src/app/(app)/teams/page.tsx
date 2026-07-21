"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { TeamsGrid } from "@/components/teams/TeamsGrid";
import { PageLoader } from "@/components/ui/page-loader";

function TeamsPageInner() {
  const searchParams = useSearchParams();
  const create = searchParams.get("create") === "1";
  return <TeamsGrid initialCreateOpen={create} />;
}

export default function TeamsPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading teams" />}>
      <TeamsPageInner />
    </Suspense>
  );
}
