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
  widthClass = "w-[320px]",
  className,
  marginClassName = "box-border flex h-full shrink-0 py-3 pr-2 pl-2",
}: PanelCardShellProps) {
  return (
    <div className={marginClassName}>
      <aside className={cn(cardBase, widthClass, className)}>{children}</aside>
    </div>
  );
}
