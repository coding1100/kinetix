"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createWorkspaceInvite } from "@/lib/api/workspace";
import { ApiError } from "@/lib/api/client";
import { SHOW_EXTENDED_INVITE_ROLES } from "@/lib/workspace/invite-flags";
import { XIcon } from "lucide-react";
import { toast } from "sonner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const INVITE_ROLE_MAP: Record<string, string> = {
  member: "MEMBER",
  "limited-member": "LIMITED_MEMBER",
  guest: "GUEST",
  admin: "ADMIN",
  "super-admin": "SUPER_ADMIN",
};

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  MEMBER: "Member",
  LIMITED_MEMBER: "Limited member",
  GUEST: "Guest",
};

type Props = {
  accessToken: string;
  workspaceId: string;
  canInviteAdmin?: boolean;
  onSuccess?: () => void;
  compact?: boolean;
};

export function WorkspaceInviteForm({
  accessToken,
  workspaceId,
  canInviteAdmin = false,
  onSuccess,
  compact = false,
}: Props) {
  const [emails, setEmails] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);

  const sendOne = async (addr: string) => {
    return createWorkspaceInvite(
      accessToken,
      workspaceId,
      addr,
      INVITE_ROLE_MAP[role] ?? "MEMBER"
    );
  };

  const commitPending = () => {
    const addr = email.trim().replace(/[,;]+$/, "");
    if (!addr) return true;
    if (!EMAIL_RE.test(addr)) {
      toast.error(`"${addr}" isn't a valid email`);
      return false;
    }
    setEmails((prev) => (prev.includes(addr) ? prev : [...prev, addr]));
    setEmail("");
    return true;
  };

  const removeChip = (addr: string) => {
    setEmails((prev) => prev.filter((e) => e !== addr));
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      if (email.trim()) {
        e.preventDefault();
        commitPending();
      } else if (e.key === "Enter") {
        void handleSend();
      }
    } else if (e.key === "Backspace" && !email && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1));
    }
  };

  const handleSend = async () => {
    const pending = email.trim().replace(/[,;]+$/, "");
    let addresses = emails;
    if (pending) {
      if (!EMAIL_RE.test(pending)) {
        toast.error(`"${pending}" isn't a valid email`);
        return;
      }
      addresses = addresses.includes(pending) ? addresses : [...addresses, pending];
    }
    if (addresses.length === 0) {
      toast.error("Enter an email address");
      return;
    }

    setLoading(true);
    // Each address is its own request, sent independently - one bad/duplicate
    // email must not stop the rest of the batch from going out.
    const succeeded: string[] = [];
    const failed: { addr: string; message: string }[] = [];
    let emailed = 0;
    let lastUrl = "";
    for (const addr of addresses) {
      try {
        const result = await sendOne(addr);
        lastUrl = result.inviteUrl;
        succeeded.push(addr);
        if (result.emailSent) emailed += 1;
      } catch (err) {
        failed.push({
          addr,
          message: err instanceof ApiError ? err.message : "Failed to send invite",
        });
      }
    }
    const sent = succeeded.length;
    if (sent > 0) {
      if (emailed === sent) {
        toast.success(
          sent === 1
            ? `Invite email sent to ${succeeded[0]}`
            : `${sent} invite emails sent`
        );
      } else if (emailed > 0) {
        toast.success(`${emailed} emailed, ${sent - emailed} saved (SMTP partial)`);
      } else if (sent === 1 && lastUrl) {
        await navigator.clipboard.writeText(lastUrl);
        toast.warning(
          "SMTP not configured — invite saved; link copied to clipboard"
        );
      } else {
        toast.success(sent === 1 ? "Invite saved" : `${sent} invites saved`);
      }
    }
    if (failed.length > 0) {
      toast.error(
        failed.length === 1
          ? `${failed[0].addr}: ${failed[0].message}`
          : `${failed.length} invites failed: ${failed.map((f) => f.addr).join(", ")}`
      );
    }
    setEmail("");
    // Keep only the failed addresses chipped so the user can fix and retry.
    setEmails(failed.map((f) => f.addr));
    if (sent > 0) onSuccess?.();
    setLoading(false);
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4 rounded-xl border border-border bg-card p-4"}>
      {!compact ? (
        <div>
          <p className="text-sm font-semibold">Invite by email</p>
          <p className="text-xs text-muted-foreground">
            Separate multiple addresses with commas. An invite email is sent when
            SMTP is configured in the API (.env). Otherwise the link is copied
            for you to share manually.
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="workspace-invite-email">Email</Label>
        <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input px-2 py-1.5 focus-within:border-ring focus-within:ring-[1px] focus-within:ring-ring/50">
          {emails.map((addr) => (
            <Badge key={addr} variant="secondary" className="gap-1 pr-1">
              {addr}
              <button
                type="button"
                aria-label={`Remove ${addr}`}
                onClick={() => removeChip(addr)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          <input
            id="workspace-invite-email"
            type="email"
            placeholder={emails.length === 0 ? "name@company.com, teammate@…" : "Add another…"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleEmailKeyDown}
            onBlur={commitPending}
            className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Invite as</Label>
        <Select value={role} onValueChange={(v) => v && setRole(v)}>
          <SelectTrigger className="w-full justify-start">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            {SHOW_EXTENDED_INVITE_ROLES ? (
              <>
                <SelectItem value="limited-member">Limited member</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
                {canInviteAdmin ? (
                  <SelectItem value="admin">Admin</SelectItem>
                ) : null}
              </>
            ) : null}
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={handleSend}
        loading={loading}
        loadingText="Sending…"
        className="w-full sm:w-auto"
      >
        Invite people
      </Button>
    </div>
  );
}
