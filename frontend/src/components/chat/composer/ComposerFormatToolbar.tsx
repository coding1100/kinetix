"use client";

import { useState } from "react";
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  ListIcon,
  ListOrderedIcon,
  LinkIcon,
  IndentIncreaseIcon,
  IndentDecreaseIcon,
  MinusIcon,
  ChevronDownIcon,
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
import {
  applyBold,
  applyItalic,
  applyUnderline,
  applyOverline,
  applyTextColor,
  applyBulletList,
  applyNumberedList,
  applyIndent,
  applyOutdent,
  applyLink,
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
}: {
  position: FormatToolbarPosition | null;
  onFormatApplied?: () => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  if (!position) return null;

  const run = (fn: () => void) => {
    fn();
    onFormatApplied?.();
  };

  const submitLink = () => {
    applyLink(linkUrl);
    setLinkUrl("");
    setLinkOpen(false);
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
        <ToolbarButton label="Overline" onClick={() => run(applyOverline)}>
          <span className="text-xs font-semibold leading-none [text-decoration:overline]">
            O
          </span>
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton label="Decrease indent" onClick={() => run(applyOutdent)}>
          <IndentDecreaseIcon className="size-3.5" strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton label="Increase indent" onClick={() => run(applyIndent)}>
          <IndentIncreaseIcon className="size-3.5" strokeWidth={2} />
        </ToolbarButton>

        <ToolbarDivider />

        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 text-muted-foreground"
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Add link"
              >
                <LinkIcon className="size-3.5" strokeWidth={2} />
              </Button>
            }
          />
          <PopoverContent align="end" className="w-72 space-y-2 p-3">
            <p className="text-xs font-medium text-foreground">Add link</p>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitLink();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-7 w-full"
              disabled={!linkUrl.trim()}
              onClick={submitLink}
            >
              Apply
            </Button>
          </PopoverContent>
        </Popover>

        <ToolbarButton
          label="More"
          onClick={() => run(applyBulletList)}
          className="hidden"
        >
          <MinusIcon className="size-3.5" />
        </ToolbarButton>
      </div>
    </div>
  );
}
