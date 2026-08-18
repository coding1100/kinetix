"use client";

import { useEffect, useState } from "react";
import { FolderKanbanIcon, PlusIcon, CheckCircle2Icon, AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PortfoliosView({ workspaceId }: { workspaceId: string }) {
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/workspaces/${workspaceId}/portfolios`);
        if (res.ok) {
          const data = await res.json();
          setPortfolios(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (workspaceId) load();
  }, [workspaceId]);

  return (
    <div className="flex flex-1 flex-col overflow-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Portfolios Layer</h2>
          <p className="text-xs text-muted-foreground">High-level executive tracking across multiple lists & initiatives</p>
        </div>
        <Button size="sm" className="gap-1.5">
          <PlusIcon className="size-3.5" />
          New Portfolio
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">Loading portfolios…</div>
      ) : portfolios.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
          <FolderKanbanIcon className="size-8 text-muted-foreground/60 mb-2" />
          <h3 className="text-sm font-medium">No Portfolios created</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Group lists into executive dashboards to track rollups and completion health.</p>
          <Button size="sm" variant="outline">Create your first Portfolio</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {portfolios.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="size-3 rounded-full" style={{ backgroundColor: p.color || "#4194F6" }} />
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  ON TRACK
                </span>
              </div>
              <h3 className="mt-2 text-sm font-semibold">{p.name}</h3>
              <p className="text-xs text-muted-foreground">{p.description || "No description provided"}</p>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs font-medium text-muted-foreground mb-1">
                  <span>Progress Rollup</span>
                  <span className="font-semibold text-foreground">75%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: "75%" }} />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                <span>{p.listIds?.length || 0} Linked Lists</span>
                <span className="font-medium text-foreground">12 Active Tasks</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
