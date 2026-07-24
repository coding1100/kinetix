"use client";

import { ArrowDownIcon, ArrowUpIcon, CheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StatusConfigItem } from "@/lib/api/home";

const STATUS_GROUPS: { value: string; label: string }[] = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "ACTIVE", label: "Active" },
  { value: "DONE", label: "Done" },
  { value: "CLOSED", label: "Closed" },
];

// The only colors a status can be assigned - fixed palette, no free-form
// color picker.
export const STATUS_COLOR_OPTIONS = [
  "#87909E",
  "#7A7F87",
  "#4194F6",
  "#0F766E",
  "#22C55E",
  "#F57C00",
  "#EF4444",
  "#EC4899",
  "#A855F7",
  "#14B8A6",
];

const NEW_STATUS_COLOR = STATUS_COLOR_OPTIONS[0];

function ColorSwatchPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            aria-label="Status color"
            className="size-8 shrink-0 rounded-full border border-border disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: value }}
          />
        }
      />
      <PopoverContent className="w-auto p-2">
        <div className="grid grid-cols-5 gap-1.5">
          {STATUS_COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              aria-label={color}
              className="grid size-7 shrink-0 place-items-center rounded-full border border-border"
              style={{ backgroundColor: color }}
            >
              {color.toLowerCase() === value.toLowerCase() ? (
                <CheckIcon className="size-4 text-white drop-shadow" />
              ) : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function StatusConfigEditor({
  statuses,
  onChange,
  disabled,
}: {
  statuses: StatusConfigItem[];
  onChange: (next: StatusConfigItem[]) => void;
  disabled?: boolean;
}) {
  const update = (index: number, patch: Partial<StatusConfigItem>) => {
    onChange(statuses.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= statuses.length) return;
    const next = [...statuses];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(statuses.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([
      ...statuses,
      { name: "New status", color: NEW_STATUS_COLOR, statusGroup: "NOT_STARTED" },
    ]);
  };

  return (
    <div className="space-y-2">
      {statuses.map((s, index) => (
        <div key={index} className="flex items-center gap-2">
          <ColorSwatchPicker
            value={s.color}
            disabled={disabled}
            onChange={(color) => update(index, { color })}
          />
          <Input
            value={s.name}
            disabled={disabled}
            onChange={(e) => update(index, { name: e.target.value })}
            maxLength={60}
            className="flex-1"
          />
          <Select
            value={s.statusGroup}
            onValueChange={(v) => v && update(index, { statusGroup: v })}
          >
            <SelectTrigger disabled={disabled} className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_GROUPS.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={disabled || index === 0}
            onClick={() => move(index, -1)}
            aria-label="Move up"
          >
            <ArrowUpIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={disabled || index === statuses.length - 1}
            onClick={() => move(index, 1)}
            aria-label="Move down"
          >
            <ArrowDownIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={disabled || statuses.length <= 1}
            onClick={() => remove(index)}
            aria-label="Delete status"
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" disabled={disabled} onClick={add}>
        <PlusIcon className="size-4" />
        Add status
      </Button>
    </div>
  );
}
