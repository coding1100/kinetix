"use client";

import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  ListIcon,
  LinkIcon,
  IndentIncreaseIcon,
  IndentDecreaseIcon,
  ChevronDownIcon,
  StrikethroughIcon,
  CodeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { FormatToolbarPosition } from "@/hooks/use-composer-format";
import type { TurnIntoBlockType } from "@/lib/chat/rich-text/block-types";
import { TurnIntoMenu } from "@/components/chat/composer/TurnIntoMenu";
import {
  applyBold,
  applyItalic,
  applyUnderline,
  applyTextColor,
  applyBulletList,
  applyNumberedList,
  applyIndent,
  applyOutdent,
  applyStrikethrough,
  applyInlineCode,
  applyTurnInto,
} from "@/lib/chat/rich-text/commands";

const TEXT_COLORS = [
  { label: "Default", value: "#2a2e34" },
  { label: "Gray", value: "#6b7280" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Yellow", value: "#ca8a04" },
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Pink", value: "#db2777" },
];

function ToolbarButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("size-7 text-muted-foreground hover:text-foreground", className)}
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />;
}

export function ComposerFormatToolbar({
  position,
  onFormatApplied,
  onOpenLink,
}: {
  position: FormatToolbarPosition | null;
  onFormatApplied?: () => void;
  onOpenLink: () => void;
}) {
  if (!position) return null;

  const run = (fn: () => void) => {
    fn();
    onFormatApplied?.();
  };

  const runTurnInto = (type: TurnIntoBlockType) => {
    applyTurnInto(type);
    onFormatApplied?.();
  };

  return (
    <div
      className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-full"
      style={{ top: position.top, left: position.left }}
      role="toolbar"
      aria-label="Text formatting"
    >
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-border bg-card px-1 py-0.5 shadow-md">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-0.5 px-1.5 text-xs text-muted-foreground"
                onMouseDown={(e) => e.preventDefault()}
              >
                <ListIcon className="size-3.5" />
                <ChevronDownIcon className="size-3" />
              </Button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => run(applyBulletList)}>
              Bullet list
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => run(applyNumberedList)}>
              Numbered list
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <TurnIntoMenu onSelect={runTurnInto} />

        <ToolbarDivider />

        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-xs font-semibold text-muted-foreground underline decoration-foreground/70 underline-offset-2"
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Text color"
              >
                A
              </Button>
            }
          />
          <PopoverContent align="start" className="w-auto p-2">
            <div className="grid grid-cols-5 gap-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  className="size-6 rounded-md border border-border transition-transform hover:scale-110"
                  style={{ backgroundColor: c.value }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => run(() => applyTextColor(c.value))}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <ToolbarButton label="Bold" onClick={() => run(applyBold)}>
          <BoldIcon className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => run(applyItalic)}>
          <ItalicIcon className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton label="Underline" onClick={() => run(applyUnderline)}>
          <UnderlineIcon className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" onClick={() => run(applyStrikethrough)}>
          <StrikethroughIcon className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>
        <ToolbarButton label="Inline code" onClick={() => run(applyInlineCode)}>
          <CodeIcon className="size-3.5" strokeWidth={2.5} />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton label="Decrease indent" onClick={() => run(applyOutdent)}>
          <IndentDecreaseIcon className="size-3.5" strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton label="Increase indent" onClick={() => run(applyIndent)}>
          <IndentIncreaseIcon className="size-3.5" strokeWidth={2} />
        </ToolbarButton>

        <ToolbarDivider />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 text-muted-foreground hover:text-foreground"
          aria-label="Add link"
          title="Add link"
          onMouseDown={(e) => {
            e.preventDefault();
            onOpenLink();
          }}
        >
          <LinkIcon className="size-3.5" strokeWidth={2} />
        </Button>
      </div>
    </div>
  );
}
