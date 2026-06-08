"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function InviteMemberList() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((row) => (
        <div key={row} className="grid grid-cols-[1fr_130px] gap-2">
          <div className="space-y-1.5">
            <Label htmlFor={`invite-email-${row}`}>Email</Label>
            <Input id={`invite-email-${row}`} type="email" placeholder="name@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select defaultValue={row === 0 ? "admin" : "member"}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}
