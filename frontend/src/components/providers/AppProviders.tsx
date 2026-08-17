"use client";

import { Suspense } from "react";
import { Modals } from "@/components/modals/Modals";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ThemeSync } from "@/components/providers/ThemeSync";
import { ChatSocketProvider } from "@/components/providers/ChatSocketProvider";
import { GlobalLoader } from "@/components/providers/GlobalLoader";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AutoUpdateProvider } from "@/components/providers/AutoUpdateProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ThemeSync />
      <TooltipProvider delay={200}>
        <AuthProvider>
          <AutoUpdateProvider>
            <ChatSocketProvider>
              {children}
            </ChatSocketProvider>
            <Suspense fallback={null}>
              <Modals />
            </Suspense>
            <GlobalLoader />
            <Toaster position="top-right" />
          </AutoUpdateProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
