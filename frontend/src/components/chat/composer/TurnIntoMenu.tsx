"use client";

import {
  TypeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  CodeIcon,
  QuoteIcon,
  BookmarkIcon,
  ChevronDownIcon,
  CheckIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TurnIntoBlockType } from "@/lib/chat/rich-text/block-types";
import { turnIntoLabel } from "@/lib/chat/rich-text/block-types";

const ICONS: Partial<Record<TurnIntoBlockType, React.ReactNode>> = {
  p: <TypeIcon className="size-4" strokeWidth={1.75} />,
  h1: <Heading1Icon className="size-4" strokeWidth={1.75} />,
  h2: <Heading2Icon className="size-4" strokeWidth={1.75} />,
  h3: <Heading3Icon className="size-4" strokeWidth={1.75} />,
  h4: <Heading4Icon className="size-4" strokeWidth={1.75} />,
  pre: <CodeIcon className="size-4" strokeWidth={1.75} />,
  blockquote: <QuoteIcon className="size-4" strokeWidth={1.75} />,
};

const BANNER_OPTIONS: { id: TurnIntoBlockType; label: string; swatch: string }[] =
  [
    { id: "banner-info", label: "Info", swatch: "bg-sky-400" },
    { id: "banner-success", label: "Success", swatch: "bg-emerald-400" },
    { id: "banner-warning", label: "Warning", swatch: "bg-amber-400" },
    { id: "banner-danger", label: "Danger", swatch: "bg-rose-400" },
  ];

export function TurnIntoMenu({
  activeType = "p",
  onSelect,
}: {
  activeType?: TurnIntoBlockType;
  onSelect: (type: TurnIntoBlockType) => void;
}) {
  const mainTypes: TurnIntoBlockType[] = [
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "pre",
    "blockquote",
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 max-w-[5.5rem] gap-0.5 px-1.5 text-xs text-muted-foreground"
            onMouseDown={(e) => e.preventDefault()}
          >
            <span className="truncate">{turnIntoLabel(activeType)}</span>
            <ChevronDownIcon className="size-3 shrink-0" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">
            Turn into
          </DropdownMenuLabel>
          {mainTypes.map((type) => (
            <DropdownMenuItem
              key={type}
              onClick={() => onSelect(type)}
              className="gap-2"
            >
              <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                {ICONS[type]}
              </span>
              <span className="flex-1">{turnIntoLabel(type)}</span>
              {type === "h1" && (
                <span className="text-[10px] text-muted-foreground">Alt+Ctrl+1</span>
              )}
              {type === "h2" && (
                <span className="text-[10px] text-muted-foreground">Alt+Ctrl+2</span>
              )}
              {type === "h3" && (
                <span className="text-[10px] text-muted-foreground">Alt+Ctrl+3</span>
              )}
              {type === "h4" && (
                <span className="text-[10px] text-muted-foreground">Alt+Ctrl+4</span>
              )}
              {activeType === type ? (
                <CheckIcon className="size-3.5 text-primary" strokeWidth={2.5} />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <BookmarkIcon className="size-4 text-muted-foreground" strokeWidth={1.75} />
            Banners
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            {BANNER_OPTIONS.map((banner) => (
              <DropdownMenuItem
                key={banner.id}
                onClick={() => onSelect(banner.id)}
                className="gap-2"
              >
                <span
                  className={`size-3 shrink-0 rounded-sm ${banner.swatch}`}
                  aria-hidden
                />
                {banner.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
