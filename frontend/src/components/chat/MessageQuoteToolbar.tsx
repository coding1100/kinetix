"use client";

import { QuoteIcon } from "lucide-react";
import { createPortal } from "react-dom";
import { useMessageQuoteSelection } from "@/hooks/use-message-quote-selection";
import { cn } from "@/lib/utils";

export function MessageQuoteToolbar() {
  const { selection, applyQuote } = useMessageQuoteSelection();

  if (!selection || typeof document === "undefined") return null;

  return createPortal(
    <div
      data-message-quote-toolbar
      className="pointer-events-none fixed z-50"
      style={{
        top: selection.top,
        left: selection.left,
        transform: "translate(-50%, -100%)",
      }}
    >
      <button
        type="button"
        className={cn(
          "pointer-events-auto inline-flex items-center gap-1.5 rounded-md",
          "bg-[#2a2e34] px-2.5 py-1.5 text-xs font-medium text-white shadow-md",
          "hover:bg-[#1f2328]"
        )}
        onMouseDown={(e) => e.preventDefault()}
        onClick={applyQuote}
      >
        <QuoteIcon className="size-3.5" strokeWidth={2} />
        Quote
      </button>
    </div>,
    document.body
  );
}
