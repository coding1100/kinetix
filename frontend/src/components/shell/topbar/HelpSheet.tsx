"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useTopBarStore } from "@/stores/topbar-store";

const SHORTCUTS = [
  { keys: "Ctrl + K", action: "Focus global search (browser default)" },
  { keys: "Esc", action: "Close search results / panels" },
  { keys: "—", action: "Use Chat shortcuts menu for new DM or channel" },
];

const LINKS = [
  { label: "Inbox", href: "/home/inbox" },
  { label: "My Tasks — Today", href: "/home/my-tasks/today" },
  { label: "People & invites", href: "/people" },
  { label: "Profile", href: "/profile" },
  { label: "Settings", href: "/settings" },
];

export function HelpSheet() {
  const router = useRouter();
  const activeSheet = useTopBarStore((s) => s.activeSheet);
  const closeSheet = useTopBarStore((s) => s.closeSheet);
  const open = activeSheet === "help";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeSheet()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Help</SheetTitle>
          <SheetDescription>
            Quick links and shortcuts for Kinetix.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 overflow-y-auto px-1">
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Go to
            </h3>
            <ul className="space-y-1">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-start"
                    nativeButton={false}
                    render={
                      <Link
                        href={link.href}
                        onClick={() => closeSheet()}
                      />
                    }
                  >
                    {link.label}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Keyboard shortcuts
            </h3>
            <ul className="space-y-2">
              {SHORTCUTS.map((row) => (
                <li
                  key={row.keys}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {row.keys}
                  </kbd>
                  <span className="text-right text-muted-foreground">{row.action}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Support
            </h3>
            <p className="text-sm text-muted-foreground">
              Workspace owners can manage members and invites under People. For
              account and notification preferences, open Settings.
            </p>
            <Button
              className="mt-3 w-full"
              variant="outline"
              onClick={() => {
                closeSheet();
                router.push("/settings");
              }}
            >
              Open Settings
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
