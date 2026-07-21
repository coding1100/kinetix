"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { TeamDetailView } from "@/components/teams/TeamDetailView";
import { PageLoader } from "@/components/ui/page-loader";

function TeamDetailPageInner() {
  const params = useParams();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";
  return <TeamDetailView teamId={teamId} />;
}

export default function TeamDetailPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading team" />}>
      <TeamDetailPageInner />
    </Suspense>
  );
}
