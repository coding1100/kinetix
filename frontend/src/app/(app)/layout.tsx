import { GlobalNav } from "@/components/shell/GlobalNav";
import { TopBar } from "@/components/shell/TopBar";
import { ChatSidebarPrefetch } from "@/components/shell/ChatSidebarPrefetch";
import { AuthGate } from "@/components/providers/AuthGate";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <GlobalNav />
        <AuthGate>
          <ChatSidebarPrefetch />
          <div className="flex min-h-0 min-w-0 flex-1">{children}</div>
        </AuthGate>
      </div>
    </div>
  );
}
