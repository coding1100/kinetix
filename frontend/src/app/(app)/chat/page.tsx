import { EmptyState } from "@/components/shared/EmptyState";
import { ChatEmptyActions } from "./ChatEmptyActions";

export default function ChatPage() {
  return (
    <div className="flex flex-1 flex-col bg-card">
      <EmptyState
        title="Select a conversation"
        description="Choose a channel or direct message from the sidebar"
      />
      <ChatEmptyActions />
    </div>
  );
}
