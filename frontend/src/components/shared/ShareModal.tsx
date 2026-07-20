"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { XIcon } from "lucide-react";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import { useHomeQuery } from "@/hooks/use-home-query";
import { fetchWorkspaceMembers } from "@/lib/api/chat";
import {
  addShareMember,
  fetchShareMembers,
  removeShareMember,
  type ShareMemberDto,
  type ShareResourceType,
} from "@/lib/api/spaces";
import { formatRequestError } from "@/lib/api/client";
import {
  avatarColorClassForKey,
  avatarInitialFromName,
} from "@/lib/user-display";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type PermissionLevel = "VIEW" | "COMMENT" | "EDIT";

const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  VIEW: "Can view",
  COMMENT: "Can comment",
  EDIT: "Can edit",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: ShareResourceType;
  resourceId: string;
  resourceName: string;
};

export function ShareModal({
  open,
  onOpenChange,
  resourceType,
  resourceId,
  resourceName,
}: Props) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [members, setMembers] = useState<ShareMemberDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [permission, setPermission] = useState<PermissionLevel>("EDIT");
  const [submitting, setSubmitting] = useState(false);

  const workspaceMembersQuery = useHomeQuery(
    (token, ws) => fetchWorkspaceMembers(token, ws).then((r) => r.data),
    []
  );

  useEffect(() => {
    if (!open || !ready) return;
    let cancelled = false;
    setLoading(true);
    fetchShareMembers(accessToken, workspaceId, resourceType, resourceId)
      .then((res) => {
        if (!cancelled) setMembers(res.data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(formatRequestError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, ready, accessToken, workspaceId, resourceType, resourceId]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setPermission("EDIT");
    }
  }, [open]);

  const memberUserIds = useMemo(
    () => new Set((members ?? []).map((m) => m.userId).filter(Boolean)),
    [members]
  );
  const memberEmails = useMemo(
    () =>
      new Set(
        (members ?? [])
          .map((m) => m.email?.toLowerCase())
          .filter((e): e is string => Boolean(e))
      ),
    [members]
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = (workspaceMembersQuery.data ?? []).filter(
      (m) =>
        !memberUserIds.has(m.id) && !memberEmails.has(m.email.toLowerCase())
    );
    if (!q) return pool;
    return pool.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [workspaceMembersQuery.data, memberUserIds, memberEmails, query]);

  const isEmailInput = /\S+@\S+\.\S+/.test(query.trim());

  async function addMember(
    input:
      | { userId: string; permissionLevel: PermissionLevel }
      | { email: string; permissionLevel: PermissionLevel }
  ) {
    if (!ready) return;
    setSubmitting(true);
    try {
      const res = await addShareMember(
        accessToken,
        workspaceId,
        resourceType,
        resourceId,
        input
      );
      setMembers(res.data);
      setQuery("");
      toast.success("Shared");
    } catch (err) {
      toast.error(formatRequestError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(target: string) {
    if (!ready || !target) return;
    try {
      await removeShareMember(
        accessToken,
        workspaceId,
        resourceType,
        resourceId,
        target
      );
      setMembers((prev) =>
        (prev ?? []).filter((m) => (m.userId ?? m.email) !== target)
      );
    } catch (err) {
      toast.error(formatRequestError(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share &quot;{resourceName}&quot;</DialogTitle>
          <DialogDescription>
            Add people by name or email. Someone who hasn&apos;t accepted
            their workspace invite yet can still be added — they get access
            the moment they join.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="share-query">Add people</Label>
            <Input
              id="share-query"
              placeholder="Name or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isEmailInput) {
                  void addMember({
                    email: query.trim(),
                    permissionLevel: permission,
                  });
                }
              }}
            />
          </div>
          <Select
            value={permission}
            onValueChange={(v) => v && setPermission(v as PermissionLevel)}
          >
            <SelectTrigger className="w-32 justify-start">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIEW">Can view</SelectItem>
              <SelectItem value="COMMENT">Can comment</SelectItem>
              <SelectItem value="EDIT">Can edit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>
            {query.trim()
              ? "Matching people"
              : "Workspace members without access"}
          </Label>
          <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
            {candidates.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={submitting}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted/50 disabled:opacity-50"
                  onClick={() =>
                    void addMember({ userId: m.id, permissionLevel: permission })
                  }
                >
                  <Avatar className="size-7">
                    <AvatarFallback
                      className={cn(
                        "text-xs font-semibold",
                        avatarColorClassForKey(m.id, m.fullName)
                      )}
                    >
                      {avatarInitialFromName(m.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{m.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {m.email}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {candidates.length === 0 && isEmailInput ? (
              <li>
                <button
                  type="button"
                  disabled={submitting}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50 disabled:opacity-50"
                  onClick={() =>
                    void addMember({
                      email: query.trim(),
                      permissionLevel: permission,
                    })
                  }
                >
                  Share with &quot;{query.trim()}&quot;
                </button>
              </li>
            ) : null}
            {candidates.length === 0 && !isEmailInput && query.trim() ? (
              <li className="px-2 py-3 text-sm text-muted-foreground">
                No matches. Type a full email to invite someone by address.
              </li>
            ) : null}
            {candidates.length === 0 && !query.trim() ? (
              <li className="px-2 py-3 text-sm text-muted-foreground">
                Everyone in the workspace already has access.
              </li>
            ) : null}
          </ul>
        </div>

        <div className="space-y-1">
          <Label>Who has access</Label>
          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
            {loading ? (
              <li className="px-1 py-3 text-sm text-muted-foreground">
                Loading…
              </li>
            ) : null}
            {!loading && (members ?? []).length === 0 ? (
              <li className="px-1 py-3 text-sm text-muted-foreground">
                Not shared with anyone yet.
              </li>
            ) : null}
            {(members ?? []).map((m) => (
              <li
                key={m.userId ?? m.email}
                className="flex items-center gap-2.5 rounded-md px-1 py-1.5"
              >
                <Avatar className="size-7">
                  <AvatarFallback
                    className={cn(
                      "text-xs font-semibold",
                      avatarColorClassForKey(
                        m.userId ?? m.email ?? "",
                        m.name ?? m.email ?? "?"
                      )
                    )}
                  >
                    {avatarInitialFromName(m.name ?? m.email ?? "?")}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {m.name ?? m.email}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {m.status === "INVITED"
                      ? "Invited · not joined yet"
                      : PERMISSION_LABELS[m.permissionLevel]}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${m.name ?? m.email}`}
                  onClick={() => void handleRemove(m.userId ?? m.email ?? "")}
                >
                  <XIcon className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
