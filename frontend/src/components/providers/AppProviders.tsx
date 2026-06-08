"use client";

import { Modals } from "@/components/modals/Modals";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ThemeSync } from "@/components/providers/ThemeSync";
import { ChatSocketProvider } from "@/components/providers/ChatSocketProvider";
import { GlobalLoader } from "@/components/providers/GlobalLoader";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ThemeSync />
      <TooltipProvider delay={200}>
        <AuthProvider>
          <ChatSocketProvider>
            {children}
          </ChatSocketProvider>
          <Modals />
          <GlobalLoader />
          <Toaster position="bottom-center" richColors />
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
