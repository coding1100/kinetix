import { cn } from "@/lib/utils";

const cardBase =
  "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm";

// Always applied, regardless of what a caller passes for spacing below —
// this is what makes the panel a full-screen sheet on mobile and a static
// inline panel on desktop. A caller cannot opt out of the mobile-safe
// overlay by passing marginSpacingClassName; they can only customize the
// desktop-only spacing inside it.
const overlayBase =
  "fixed inset-0 z-50 bg-background/95 p-2 md:static md:z-auto md:bg-transparent md:p-0";

type PanelCardShellProps = {
  children: React.ReactNode;
  /**
   * Desktop-only panel width, e.g. "md:w-[340px]" — always prefix with
   * `md:` (or a wider breakpoint). The panel is always full-width on
   * mobile (below md) so it can render as a full-screen sheet; there is
   * no way to opt out of that via this prop.
   */
  widthClass?: string;
  className?: string;
  /** Desktop-only spacing applied inside the always-mobile-safe overlay wrapper, e.g. "md:py-3 md:pr-2 md:pl-2". */
  marginSpacingClassName?: string;
};

export function PanelCardShell({
  children,
  widthClass = "md:w-[320px]",
  className,
  marginSpacingClassName = "md:py-3 md:pr-2 md:pl-2",
}: PanelCardShellProps) {
  return (
    <div className={cn(overlayBase, "box-border flex h-full shrink-0 w-full md:w-auto", marginSpacingClassName)}>
      <aside className={cn(cardBase, "w-full h-full", widthClass, className)}>{children}</aside>
    </div>
  );
}
