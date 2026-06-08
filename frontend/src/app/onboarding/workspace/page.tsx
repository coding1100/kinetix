import Link from "next/link";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function OnboardingWorkspacePage() {
  return (
    <OnboardingShell
      step={2}
      title="Workspace details"
      subtitle="Name your workspace and set default preferences."
    >
      <div className="space-y-1.5">
        <Label htmlFor="workspace-name">Workspace name</Label>
        <Input id="workspace-name" placeholder="Acme Product Team" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="workspace-logo">Logo URL (optional)</Label>
        <Input id="workspace-logo" placeholder="https://example.com/logo.png" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Timezone</Label>
          <Select defaultValue="asia-karachi">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asia-karachi">Asia/Karachi (UTC+5)</SelectItem>
              <SelectItem value="utc">UTC</SelectItem>
              <SelectItem value="america-newyork">America/New_York</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Week starts on</Label>
          <Select defaultValue="monday">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monday">Monday</SelectItem>
              <SelectItem value="sunday">Sunday</SelectItem>
              <SelectItem value="saturday">Saturday</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" nativeButton={false} render={<Link href="/onboarding/welcome" />}>
          Back
        </Button>
        <Button nativeButton={false} render={<Link href="/onboarding/invite" />}>
          Continue
        </Button>
      </div>
    </OnboardingShell>
  );
}
