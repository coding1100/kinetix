"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPost } from "@/lib/api/home";
import { ApiError } from "@/lib/api/client";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";

export function NewPostButton() {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState("announcements");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!ready) return;
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error("Write something to post");
      return;
    }
    setLoading(true);
    try {
      await createPost(accessToken, workspaceId, {
        channel: channel.trim(),
        content: trimmed,
      });
      toast.success("Post published");
      setContent("");
      setOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        New Post
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New post</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="post-channel">Channel</Label>
              <Input
                id="post-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="announcements"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-content">Message</Label>
              <Textarea
                id="post-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={loading} loadingText="Publishing…">
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
