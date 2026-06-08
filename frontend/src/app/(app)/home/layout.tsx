import { HomeSidebar } from "@/components/shell/HomeSidebar";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <HomeSidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {children}
      </main>
    </div>
  );
}
