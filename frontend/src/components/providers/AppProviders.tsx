"use client";

import { Suspense } from "react";
import { Modals } from "@/components/modals/Modals";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ThemeSync } from "@/components/providers/ThemeSync";
import { ChatSocketProvider } from "@/components/providers/ChatSocketProvider";
import { DesktopNotificationPrompt } from "@/components/providers/DesktopNotificationPrompt";
import { GlobalLoader } from "@/components/providers/GlobalLoader";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AutoUpdateProvider } from "@/components/providers/AutoUpdateProvider";
import { ExternalLinkProvider } from "@/components/providers/ExternalLinkProvider";
import { UnreadBadgeSync } from "@/components/providers/UnreadBadgeSync";
import { KnowledgeAssistantSheet } from "@/components/shell/topbar/KnowledgeAssistantSheet";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ThemeSync />
      <TooltipProvider delay={200}>
        <AuthProvider>
          <AutoUpdateProvider>
            <ExternalLinkProvider>
              <ChatSocketProvider>
                {children}
              </ChatSocketProvider>
              <UnreadBadgeSync />
              <DesktopNotificationPrompt />
              <Suspense fallback={null}>
                <Modals />
              </Suspense>
              <KnowledgeAssistantSheet />
              <GlobalLoader />
              <Toaster position="top-right" />
            </ExternalLinkProvider>
          </AutoUpdateProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

