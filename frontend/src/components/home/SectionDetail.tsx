"use client";

import Link from "next/link";
import { useHomeSidebarStore } from "@/stores/home-sidebar-store";
import { EmptyState } from "@/components/shared/EmptyState";

export function SectionDetail({ sectionId }: { sectionId: string }) {
  const sections = useHomeSidebarStore((s) => s.sections);
  const items = useHomeSidebarStore((s) => s.items);
  const section = sections.find((s) => s.id === sectionId);
  const pinned = items.filter((i) => i.pinned);

  if (!section) {
    return (
      <EmptyState
        title="Section not found"
        description="Create a section from Customize Home Sidebar."
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="mb-4 text-sm text-muted-foreground">
        Pinned items from your Home sidebar appear here.
      </p>
      <ul className="space-y-2">
        {pinned.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="block rounded-lg border border-border bg-card px-4 py-3 hover:border-primary"
            >
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.href}</p>
            </Link>
          </li>
        ))}
      </ul>
      {pinned.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Pin items via Customize Home Sidebar to populate this section.
        </p>
      ) : null}
    </div>
  );
}
