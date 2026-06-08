import { Suspense } from "react";
import { ConversationView } from "@/components/chat/ConversationView";

export default async function DmPage({
  params,
}: {
  params: Promise<{ dmId: string }>;
}) {
  const { dmId } = await params;
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center">Loading...</div>}>
      <ConversationView type="dm" id={dmId} />
    </Suspense>
  );
}
