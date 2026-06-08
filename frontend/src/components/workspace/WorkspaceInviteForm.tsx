"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";

export const INVITE_ROLE_MAP: Record<string, string> = {
  member: "MEMBER",
  "limited-member": "LIMITED_MEMBER",
  guest: "GUEST",
  admin: "ADMIN",
};

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
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

  const handleSend = async () => {
    const raw = email.trim();
    if (!raw) {
      toast.error("Enter an email address");
      return;
    }
    const addresses = raw
      .split(/[,;\s]+/)
      .map((a) => a.trim())
      .filter(Boolean);
    if (addresses.length === 0) {
      toast.error("Enter a valid email");
      return;
    }

    setLoading(true);
    let sent = 0;
    let emailed = 0;
    let lastUrl = "";
    try {
      for (const addr of addresses) {
        const result = await sendOne(addr);
        lastUrl = result.inviteUrl;
        sent += 1;
        if (result.emailSent) emailed += 1;
      }
      if (emailed === sent && sent > 0) {
        toast.success(
          sent === 1
            ? `Invite email sent to ${addresses[0]}`
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
        toast.success(
          sent === 1 ? "Invite saved" : `${sent} invites saved`
        );
      }
      setEmail("");
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to send invite"
      );
    } finally {
      setLoading(false);
    }
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
        <Input
          id="workspace-invite-email"
          type="email"
          placeholder="name@company.com, teammate@…"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSend();
          }}
        />
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
