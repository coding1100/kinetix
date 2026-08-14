"use client";

import { useState } from "react";
import { PlusIcon, TagIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { patchTask } from "@/lib/api/spaces";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { toast } from "sonner";
import { formatRequestError } from "@/lib/api/client";

const SUGGESTED_TAGS = ["Bug", "Feature", "High Priority", "Frontend", "Backend", "UX/UI", "Release"];

const TAG_COLOR_MAP: Record<string, string> = {
  Bug: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  Feature: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  "High Priority": "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  Frontend: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  Backend: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  "UX/UI": "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
  Release: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
};

export function getTagColorClass(tag: string): string {
  return TAG_COLOR_MAP[tag] || "bg-muted text-muted-foreground border-border";
}

interface TaskTagsManagerProps {
  taskId: string;
  tags?: string[];
  onTagsChange?: (tags: string[]) => void;
  canEdit?: boolean;
}

export function TaskTagsManager({
  taskId,
  tags = [],
  onTagsChange,
  canEdit = true,
}: TaskTagsManagerProps) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [saving, setSaving] = useState(false);

  async function updateTags(nextTags: string[]) {
    if (!ready || !accessToken || !workspaceId) return;
    setSaving(true);
    try {
      await patchTask(accessToken, workspaceId, taskId, { tags: nextTags });
      onTagsChange?.(nextTags);
    } catch (err) {
      toast.error(formatRequestError(err));
    } finally {
      setSaving(false);
    }
  }

  function handleAddTag(tagToAdd: string) {
    const trimmed = tagToAdd.trim();
    if (!trimmed) return;
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
    const next = [...tags, trimmed];
    onTagsChange?.(next);
    void updateTags(next);
    setInputVal("");
    setOpen(false);
  }

  function handleRemoveTag(tagToRemove: string) {
    const next = tags.filter((t) => t !== tagToRemove);
    onTagsChange?.(next);
    void updateTags(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className={`gap-1 px-2 py-0.5 text-xs font-medium ${getTagColorClass(tag)}`}
        >
          <TagIcon className="size-3 shrink-0 opacity-70" />
          <span>{tag}</span>
          {canEdit ? (
            <button
              type="button"
              onClick={() => handleRemoveTag(tag)}
              className="ml-0.5 rounded-xs hover:bg-black/10 dark:hover:bg-white/10 p-0.5 transition-colors"
              aria-label={`Remove tag ${tag}`}
            >
              <XIcon className="size-3" />
            </button>
          ) : null}
        </Badge>
      ))}

      {canEdit ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                disabled={saving}
              >
                <PlusIcon className="size-3" />
                Tag
              </Button>
            }
          />
          <PopoverContent align="start" className="w-56 p-2 space-y-2">
            <Input
              placeholder="Tag name…"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag(inputVal);
                }
              }}
              autoFocus
            />

            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Suggested Tags
              </span>
              <div className="flex flex-wrap gap-1">
                {SUGGESTED_TAGS.filter(
                  (t) => !tags.some((existing) => existing.toLowerCase() === t.toLowerCase())
                ).map((sTag) => (
                  <button
                    key={sTag}
                    type="button"
                    onClick={() => handleAddTag(sTag)}
                    className="rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    {sTag}
                  </button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
