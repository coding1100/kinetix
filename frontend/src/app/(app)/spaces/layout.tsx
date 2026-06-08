import { SpacesSidebar } from "@/components/spaces/SpacesSidebar";

export default function SpacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SpacesSidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {children}
      </main>
    </>
  );
}
