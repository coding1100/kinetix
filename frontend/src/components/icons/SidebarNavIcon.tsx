import { cn } from "@/lib/utils";
import { getHomeSidebarIcon } from "@/components/icons/home-sidebar-icons";

export function SidebarNavIcon({
  itemId,
  href,
  active = false,
  size = "md",
  className,
}: {
  itemId: string;
  href?: string;
  active?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const def = getHomeSidebarIcon(itemId, href);
  if (!def) return null;

  const Icon = def.icon;
  return (
    <Icon
      className={cn(
        "shrink-0",
        size === "sm" ? "size-3.5" : "size-4",
        active ? "text-primary" : "text-muted-foreground",
        className
      )}
      strokeWidth={1.75}
    />
  );
}
