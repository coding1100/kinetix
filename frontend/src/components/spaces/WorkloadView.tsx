"use client";

import { useEffect, useState } from "react";
import { GaugeIcon, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkloadView({ workspaceId }: { workspaceId: string }) {
  const [workload, setWorkload] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/workspaces/${workspaceId}/planning/workload`);
        if (res.ok) {
          const data = await res.json();
          setWorkload(data);
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
      <div className="mb-4">
        <h2 className="text-base font-semibold">Workload & Resource Management</h2>
        <p className="text-xs text-muted-foreground">Monitor team capacity allocation vs estimated hours across projects</p>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">Loading resource workload…</div>
      ) : workload.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">No team members found</div>
      ) : (
        <div className="space-y-3">
          {workload.map((m) => {
            const pct = Math.min(100, Math.round((m.totalEstimatedHours / m.capacityHours) * 100));
            const isOver = m.totalEstimatedHours > m.capacityHours;

            return (
              <div key={m.userId} className="flex items-center gap-4 rounded-lg border border-border bg-card p-3 shadow-xs">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                  {m.name?.[0]?.toUpperCase() || "U"}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold truncate">{m.name}</span>
                    <span className="font-medium text-muted-foreground">
                      {m.totalEstimatedHours}h / {m.capacityHours}h ({pct}%)
                    </span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        isOver ? "bg-rose-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-semibold",
                      isOver
                        ? "bg-rose-500/10 text-rose-600"
                        : pct < 40
                        ? "bg-sky-500/10 text-sky-600"
                        : "bg-emerald-500/10 text-emerald-600"
                    )}
                  >
                    {isOver ? "OVER CAPACITY" : pct < 40 ? "UNDER UTILIZED" : "OPTIMAL"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
