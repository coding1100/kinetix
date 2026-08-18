"use client";

import { use } from "react";
import { ChannelHuddleView } from "@/components/chat/channel/ChannelHuddleView";

export default function ChannelHuddlePage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = use(params);
  return <ChannelHuddleView channelId={channelId} />;
}
