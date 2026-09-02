"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

// HomeSidebar hides itself on mobile below md on every /home/* route except
// /home and /home/inbox (see isHomeRoot there) - without this, drilling into
// My Tasks, a Space, Channels, Favorites, or All Tasks left mobile users with
// no sidebar and no way back except the OS back gesture. This renders a
// single "Back to Home" bar for exactly those non-root routes, mounted once
// in home/layout.tsx rather than duplicated per page. /home/l/[listId] is
// excluded - it already has its own back button in SpacesListToolbar,
// wired to the correct origin (Home vs. Spaces) via backHref.
const HOME_ROOT_PATHS = new Set(["/home", "/home/inbox"]);

export function HomeMobileBackBar() {
  const pathname = usePathname();

  if (HOME_ROOT_PATHS.has(pathname)) return null;
  if (pathname.startsWith("/home/l/")) return null;

  return (
    <div className="flex shrink-0 items-center border-b border-border px-3 py-2 md:hidden">
      <Link
        href="/home"
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Home
      </Link>
    </div>
  );
}
