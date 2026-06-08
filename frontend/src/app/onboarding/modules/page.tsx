import Link from "next/link";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { ModuleToggleGrid } from "@/components/onboarding/ModuleToggleGrid";
import { Button } from "@/components/ui/button";

export default function OnboardingModulesPage() {
  return (
    <OnboardingShell
      step={4}
      title="Enable modules"
      subtitle="Pick the workspace areas you want visible by default."
    >
      <ModuleToggleGrid />
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/onboarding/invite" />}>
          Back
        </Button>
        <Button nativeButton={false} render={<Link href="/onboarding/complete" />}>
          Continue
        </Button>
      </div>
    </OnboardingShell>
  );
}
