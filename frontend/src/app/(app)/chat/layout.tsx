import { ChatSidebar } from "@/components/shell/ChatSidebar";
import { ChatSidebarPrefetch } from "@/components/shell/ChatSidebarPrefetch";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ChatSidebarPrefetch />
      <ChatSidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>
    </>
  );
}
