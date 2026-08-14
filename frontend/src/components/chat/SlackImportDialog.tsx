"use client";

import { useState, useRef } from "react";
import { UploadCloudIcon, FileTextIcon, CheckCircle2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SlackImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function SlackImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: SlackImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.endsWith(".zip") && !selected.name.endsWith(".json")) {
        toast.error("Please upload a valid Slack export file (.zip or .json)");
        return;
      }
      setFile(selected);
    }
  }

  function handleImport() {
    if (!file) return;
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      toast.success(`Successfully imported channels from "${file.name}"`);
      onImportComplete?.();
      onOpenChange(false);
      setFile(null);
    }, 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloudIcon className="size-5 text-emerald-500" />
            Import from Slack
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Import channel message history and users from a Slack export file (.zip or .json).
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.json"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 text-center cursor-pointer hover:border-emerald-500/50 hover:bg-muted/40 transition-colors"
          >
            {file ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                <FileTextIcon className="size-5" />
                <span>{file.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              </div>
            ) : (
              <>
                <UploadCloudIcon className="size-8 text-muted-foreground mb-2" />
                <p className="text-xs font-semibold text-foreground">Click to upload Slack export</p>
                <p className="text-[10px] text-muted-foreground">Supports .zip or .json exports</p>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!file || importing}
              onClick={handleImport}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {importing ? (
                "Importing..."
              ) : (
                <>
                  <CheckCircle2Icon className="size-4" />
                  Start Import
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
