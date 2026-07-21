import { TeamsSidebar } from "@/components/teams/TeamsSidebar";

export default function TeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TeamsSidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {children}
      </main>
    </>
  );
}
