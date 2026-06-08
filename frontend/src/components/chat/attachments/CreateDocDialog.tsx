"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateDocDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (title: string, content: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    onOpenChange(false);
    setTitle("");
    setContent("");
  };

  const handleCreate = async () => {
    const trimmedTitle = title.trim() || "Untitled doc";
    if (!content.trim()) return;
    setSaving(true);
    try {
      await onCreate(trimmedTitle, content);
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create doc</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Doc title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-content">Content</Label>
            <Textarea
              id="doc-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your doc…"
              rows={8}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            loadingText="Creating…"
            disabled={!content.trim()}
            onClick={() => void handleCreate()}
          >
            Create & attach
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
