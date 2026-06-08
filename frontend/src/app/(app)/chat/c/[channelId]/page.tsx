import { Suspense } from "react";
import { ConversationView } from "@/components/chat/ConversationView";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center">Loading...</div>}>
      <ConversationView type="channel" id={channelId} />
    </Suspense>
  );
}
