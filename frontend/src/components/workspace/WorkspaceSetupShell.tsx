"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { InfoIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RiseUpLogo } from "@/components/brand/RiseUpLogo";

export function WorkspaceSetupShell({
  title,
  rightHeaderText = "Welcome!",
  step,
  totalSteps,
  backHref,
  nextHref,
  nextLabel = "Next",
  nextDisabled = false,
  nextLoading = false,
  showSkip = false,
  onSkipAction,
  onNextAction,
  children,
}: {
  title: string;
  rightHeaderText?: string;
  step: number;
  totalSteps: number;
  backHref: string;
  nextHref: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  showSkip?: boolean;
  onSkipAction?: () => void;
  onNextAction?: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const progress = `${Math.max(1, step) / totalSteps * 100}%`;

  return (
    <main className="fixed inset-0 z-40 overflow-auto bg-black/40">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-4 px-5 py-4">
        <div className="mx-auto flex w-full max-w-[965px] items-center justify-between rounded-lg border border-border bg-card px-4 py-2 text-xs">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <InfoIcon className="size-3.5 text-primary" />
            Creating a new Workspace? Keep in mind info can&apos;t be transferred across Workspaces.
          </span>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/home/inbox" />}>
            Go back
          </Button>
        </div>

        <section className="mx-auto flex w-full max-w-[960px] min-h-[680px] flex-col rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between px-7 pt-5">
            <RiseUpLogo size="md" />
            <p className="text-base leading-none font-semibold text-foreground">{rightHeaderText}</p>
          </div>

          <div className="flex-1 px-7 pt-20">
            <h1 className="mb-8 text-4xl leading-tight font-semibold tracking-tight">{title}</h1>
            {children}
          </div>

          <div className="space-y-4 px-7 pb-8">
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-foreground" style={{ width: progress }} />
            </div>
            <div className="flex items-center justify-between">
              <Button variant="outline" nativeButton={false} render={<Link href={backHref} />}>
                <ChevronLeftIcon className="size-4" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                {showSkip ? (
                  <Button variant="outline" onClick={onSkipAction}>
                    Skip
                  </Button>
                ) : null}
                <Button
                  variant="default"
                  onClick={() => {
                    if (onNextAction) {
                      void onNextAction();
                      return;
                    }
                    router.push(nextHref);
                  }}
                  disabled={nextDisabled || nextLoading}
                >
                  {nextLabel}
                  {nextLabel === "Finish" ? <CheckIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function SelectPill({
  label,
  selected,
  onClickAction,
  icon: Icon,
}: {
  label: string;
  selected: boolean;
  onClickAction: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClickAction}
      className={`inline-flex items-center gap-3 rounded-full border px-5 py-3 text-sm font-medium transition ${
        selected
          ? "border-transparent bg-foreground text-background"
          : "border-border bg-background text-foreground hover:bg-muted"
      }`}
    >
      <span>{label}</span>
      {Icon ? (
        <Icon className={selected ? "size-5 text-background/80" : "size-5 text-muted-foreground"} />
      ) : null}
    </button>
  );
}
