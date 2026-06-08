import Link from "next/link";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { InviteMemberList } from "@/components/onboarding/InviteMemberList";
import { Button } from "@/components/ui/button";

export default function OnboardingInvitePage() {
  return (
    <OnboardingShell
      step={3}
      title="Invite your team"
      subtitle="Add teammates now or skip and invite later."
    >
      <InviteMemberList />
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/onboarding/workspace" />}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/onboarding/modules" />}>
            Skip
          </Button>
          <Button nativeButton={false} render={<Link href="/onboarding/modules" />}>
            Continue
          </Button>
        </div>
      </div>
    </OnboardingShell>
  );
}
