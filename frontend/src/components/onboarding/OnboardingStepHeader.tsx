"use client";

export function OnboardingStepHeader({
  title,
  subtitle,
  step,
  total,
}: {
  title: string;
  subtitle: string;
  step: number;
  total: number;
}) {
  const progress = Math.min(100, Math.round((step / total) * 100));
  return (
    <header className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        Step {step} of {total}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </header>
  );
}
