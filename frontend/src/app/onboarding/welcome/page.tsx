import Link from "next/link";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/button";

export default function OnboardingWelcomePage() {
  return (
    <OnboardingShell
      step={1}
      title="Welcome to your workspace"
      subtitle="Set up your workspace in a few quick steps."
    >
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>We will help you configure basics like workspace profile, invites, and modules.</p>
        <p>You can change all settings later from Workspace Settings.</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/home/inbox" />}>
          Skip setup
        </Button>
        <Button nativeButton={false} render={<Link href="/onboarding/workspace" />}>
          Start setup
        </Button>
      </div>
    </OnboardingShell>
  );
}
