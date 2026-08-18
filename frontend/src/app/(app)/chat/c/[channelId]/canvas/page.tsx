"use client";

import { use } from "react";
import { ChannelCanvasView } from "@/components/chat/channel/ChannelCanvasView";

export default function ChannelCanvasPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = use(params);
  return <ChannelCanvasView channelId={channelId} />;
}
