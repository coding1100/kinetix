"use client";

import { useState } from "react";
import { MailIcon, CopyIcon, CheckIcon, InfoIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface EmailToChannelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelName: string;
  channelId: string;
}

export function EmailToChannelModal({
  open,
  onOpenChange,
  channelName,
  channelId,
}: EmailToChannelModalProps) {
  const [copied, setCopied] = useState(false);
  const emailAddress = `c-${channelName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${channelId.slice(0, 6)}@inbound.kinetix.app`;

  function handleCopy() {
    void navigator.clipboard.writeText(emailAddress);
    setCopied(true);
    toast.success("Channel email address copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailIcon className="size-5 text-blue-500" />
            Email to #{channelName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Send emails directly into this channel. Anyone in your workspace can send emails to this address.
          </p>

          <div className="flex items-center gap-2">
            <Input
              value={emailAddress}
              readOnly
              className="font-mono text-xs bg-muted/40 font-medium"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="gap-1.5 shrink-0"
            >
              {copied ? <CheckIcon className="size-4 text-emerald-500" /> : <CopyIcon className="size-4" />}
              {copied ? "Copied" : "Copy Address"}
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <InfoIcon className="size-4 text-blue-500" />
              How it works
            </div>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              <li>The email subject line becomes the message title in the channel.</li>
              <li>Email body text and file attachments will be automatically posted as channel messages.</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
