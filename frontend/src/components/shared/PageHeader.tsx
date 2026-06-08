import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  children,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("shrink-0 bg-card", className)}>
      <header className="flex h-14 items-center justify-between px-6">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </header>
      <Separator />
    </div>
  );
}
