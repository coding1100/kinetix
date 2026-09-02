import { cn } from "@/lib/utils";

const cardBase =
  "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm";

type PanelCardShellProps = {
  children: React.ReactNode;
  /** Tailwind width class, e.g. w-[300px] */
  widthClass?: string;
  className?: string;
  /** Outer margin wrapper */
  marginClassName?: string;
};

export function PanelCardShell({
  children,
  widthClass = "w-full md:w-[320px]",
  className,
  marginClassName = "box-border flex h-full shrink-0 p-2 md:py-3 md:pr-2 md:pl-2 w-full md:w-auto",
}: PanelCardShellProps) {
  return (
    <div className={cn("fixed inset-0 z-50 bg-background/95 p-2 md:static md:z-auto md:bg-transparent md:p-0", marginClassName)}>
      <aside className={cn(cardBase, "w-full h-full", widthClass, className)}>{children}</aside>
    </div>
  );
}
