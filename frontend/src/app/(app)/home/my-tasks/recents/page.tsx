"use client";

import { Suspense, useState } from "react";
import { MyTasksPageShell } from "@/components/home/MyTasksPageShell";
import { MyTasksRecentsList } from "@/components/home/MyTasksRecentsList";
import { fetchRecents } from "@/lib/api/home";
import { useHomeQuery } from "@/hooks/use-home-query";

const BASE_PATH = "/home/my-tasks/recents";

function RecentsContent() {
  const [refreshKey] = useState(0);
  const { data: recents, loading, error } = useHomeQuery(
    (token, ws) => fetchRecents(token, ws).then((r) => r.data),
    [refreshKey]
  );

  return (
    <MyTasksPageShell
      title="Recents"
      subtitle="Items you've opened recently across your workspace."
      basePath={BASE_PATH}
      showToolbar={false}
    >
      <MyTasksRecentsList
        recents={recents ?? undefined}
        loading={loading}
        error={error}
      />
    </MyTasksPageShell>
  );
}

export default function RecentsPage() {
  return (
    <Suspense fallback={null}>
      <RecentsContent />
    </Suspense>
  );
}
