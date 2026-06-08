"use client";

import { Suspense } from "react";
import { PeopleView } from "@/components/workspace/PeopleView";
import { PageLoader } from "@/components/ui/page-loader";

export default function PeoplePage() {
  return (
    <Suspense fallback={<PageLoader label="Loading people" />}>
      <PeopleView />
    </Suspense>
  );
}
