"use client";

import { use } from "react";
import { SpaceSettingsView } from "@/components/home/SpaceSettingsView";

export default function SpaceSettingsPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = use(params);
  return <SpaceSettingsView spaceId={spaceId} />;
}
