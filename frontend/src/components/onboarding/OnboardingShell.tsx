"use client";

import { Card, CardContent } from "@/components/ui/card";
import { RiseUpLogo } from "@/components/brand/RiseUpLogo";
import { OnboardingStepHeader } from "@/components/onboarding/OnboardingStepHeader";

export function OnboardingShell({
  title,
  subtitle,
  step,
  total = 5,
  children,
}: {
  title: string;
  subtitle: string;
  step: number;
  total?: number;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-2xl space-y-4">
        <div className="flex justify-center pb-1">
          <RiseUpLogo size="md" />
        </div>
        <OnboardingStepHeader title={title} subtitle={subtitle} step={step} total={total} />
        <Card className="py-0">
          <CardContent className="space-y-5 py-5">{children}</CardContent>
        </Card>
      </section>
    </main>
  );
}
