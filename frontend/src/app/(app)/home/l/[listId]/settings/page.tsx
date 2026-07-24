"use client";

import { use } from "react";
import { ListSettingsView } from "@/components/home/ListSettingsView";

export default function ListSettingsPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = use(params);
  return <ListSettingsView listId={listId} />;
}
