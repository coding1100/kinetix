"use client";

import { CalendarSheet } from "@/components/shell/topbar/CalendarSheet";
import { HelpSheet } from "@/components/shell/topbar/HelpSheet";
import { AiAssistantSheet } from "@/components/shell/topbar/AiAssistantSheet";

export function TopBarSheets() {
  return (
    <>
      <CalendarSheet />
      <HelpSheet />
      <AiAssistantSheet />
    </>
  );
}
