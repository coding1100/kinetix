"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function MessageEditInline({
  initialBody,
  saving,
  onSave,
  onCancel,
}: {
  initialBody: string;
  saving?: boolean;
  onSave: (body: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialBody);

  return (
    <div className="mt-1 space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="min-h-[72px] resize-y text-sm"
        disabled={saving}
        autoFocus
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-7"
          disabled={!text.trim()}
          loading={saving}
          loadingText="Saving…"
          onClick={() => void onSave(text.trim())}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
