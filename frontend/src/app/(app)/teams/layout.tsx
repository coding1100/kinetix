"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TeamsSidebar } from "@/components/teams/TeamsSidebar";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

export default function TeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!FEATURE_FLAGS.teams) router.replace("/home/inbox");
  }, [router]);

  if (!FEATURE_FLAGS.teams) return null;

  return (
    <>
      <TeamsSidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {children}
      </main>
    </>
  );
}
