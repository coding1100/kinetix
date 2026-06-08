import Link from "next/link";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/button";

export default function OnboardingCompletePage() {
  return (
    <OnboardingShell
      step={5}
      title="You are all set"
      subtitle="Your workspace is ready. Start from Home or jump to Chat."
    >
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Setup completed successfully.</p>
        <p className="text-muted-foreground">
          You can revisit members, modules, and preferences anytime in settings.
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/onboarding/modules" />}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/chat" />}>
            Go to Chat
          </Button>
          <Button nativeButton={false} render={<Link href="/home/inbox" />}>
            Go to Home
          </Button>
        </div>
      </div>
    </OnboardingShell>
  );
}
