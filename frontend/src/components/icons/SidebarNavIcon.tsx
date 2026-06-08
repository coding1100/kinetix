import { cn } from "@/lib/utils";
import { getHomeSidebarIcon } from "@/components/icons/home-sidebar-icons";

export function SidebarNavIcon({
  itemId,
  href,
  active = false,
  className,
}: {
  itemId: string;
  href?: string;
  active?: boolean;
  className?: string;
}) {
  const def = getHomeSidebarIcon(itemId, href);
  if (!def) return null;

  const Icon = def.icon;
  return (
    <Icon
      className={cn(
        "size-4 shrink-0",
        active ? "text-primary" : "text-muted-foreground",
        className
      )}
      strokeWidth={1.75}
    />
  );
}
