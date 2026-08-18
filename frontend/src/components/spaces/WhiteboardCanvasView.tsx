"use client";

import { useEffect, useState } from "react";
import { PresentationIcon, PlusIcon, SaveIcon, SquareIcon, StickyNoteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WhiteboardCanvasView({
  workspaceId,
  spaceId,
}: {
  workspaceId: string;
  spaceId?: string;
}) {
  const [whiteboards, setWhiteboards] = useState<any[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/workspaces/${workspaceId}/whiteboards`);
        if (res.ok) {
          const data = await res.json();
          setWhiteboards(data);
          if (data.length > 0) setSelectedBoard(data[0]);
        }
      } catch (err) {
        console.error(err);
      }
    }
    if (workspaceId) load();
  }, [workspaceId]);

  async function handleCreateNew() {
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/whiteboards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Project Concept Mindmap",
          spaceId,
          canvasData: {
            nodes: [
              { id: "1", type: "sticky", title: "User Onboarding", color: "#FEF08A", x: 100, y: 120 },
              { id: "2", type: "sticky", title: "API Gateway", color: "#BAE6FD", x: 340, y: 120 },
            ],
          },
        }),
      });
      if (res.ok) {
        const newBoard = await res.json();
        setWhiteboards((prev) => [newBoard, ...prev]);
        setSelectedBoard(newBoard);
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-4">
      {/* Header Bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PresentationIcon className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">{selectedBoard?.name || "Visual Whiteboards"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="xs" onClick={handleCreateNew} className="gap-1">
            <PlusIcon className="size-3" />
            New Whiteboard
          </Button>
        </div>
      </div>

      {/* Interactive Visual Canvas Container */}
      <div className="relative flex flex-1 overflow-hidden rounded-lg border border-border bg-neutral-950 p-6">
        {/* Grid Background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        {/* Nodes rendering */}
        {selectedBoard?.canvasData?.nodes?.map((node: any) => (
          <div
            key={node.id}
            className="absolute rounded-lg p-3 shadow-md border border-neutral-700 text-neutral-900 font-medium text-xs w-44 cursor-move transition-transform"
            style={{
              backgroundColor: node.color || "#FEF08A",
              left: `${node.x}px`,
              top: `${node.y}px`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-neutral-700 uppercase">
              <StickyNoteIcon className="size-3" />
              Note
            </div>
            {node.title}
          </div>
        )) || (
          <div className="m-auto text-center text-xs text-muted-foreground">
            No active Whiteboard canvas selected. Click "New Whiteboard" to start brainstorming visually.
          </div>
        )}
      </div>
    </div>
  );
}
