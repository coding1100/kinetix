"use client";

import { TerminalIcon, SmileIcon, Trash2Icon, BellIcon, Edit3Icon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export interface SlashCommand {
  command: string;
  description: string;
  icon: React.ReactNode;
  action: (currentText: string) => { text?: string; executeCommand?: string };
}

const COMMANDS: SlashCommand[] = [
  {
    command: "/shrug",
    description: "Append ¯\\_(ツ)_/¯",
    icon: <SmileIcon className="size-4 text-amber-500" />,
    action: (text) => ({ text: text ? `${text} ¯\\_(ツ)_/¯` : "¯\\_(ツ)_/¯" }),
  },
  {
    command: "/tableflip",
    description: "Append (╯°□°)╯︵ ┻━┻",
    icon: <SmileIcon className="size-4 text-red-500" />,
    action: (text) => ({ text: text ? `${text} (╯°□°)╯︵ ┻━┻` : "(╯°□°)╯︵ ┻━┻" }),
  },
  {
    command: "/unflip",
    description: "Append ┬─┬ノ( º _ ºノ)",
    icon: <SmileIcon className="size-4 text-blue-500" />,
    action: (text) => ({ text: text ? `${text} ┬─┬ノ( º _ ºノ)` : "┬─┬ノ( º _ ºノ)" }),
  },
  {
    command: "/clear",
    description: "Clear message input",
    icon: <Trash2Icon className="size-4 text-slate-400" />,
    action: () => ({ text: "" }),
  },
  {
    command: "/remind",
    description: "Create a reminder /remind <text>",
    icon: <BellIcon className="size-4 text-purple-500" />,
    action: (text) => ({ text: text.startsWith("/remind") ? text : "/remind " }),
  },
  {
    command: "/topic",
    description: "Set channel topic /topic <text>",
    icon: <Edit3Icon className="size-4 text-emerald-500" />,
    action: (text) => ({ text: text.startsWith("/topic") ? text : "/topic " }),
  },
];

interface SlashCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentText: string;
  onSelectCommand: (newText: string) => void;
}

export function SlashCommandPalette({
  open,
  onOpenChange,
  currentText,
  onSelectCommand,
}: SlashCommandPaletteProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger className="hidden" />
      <PopoverContent align="start" className="w-64 p-1 shadow-lg">
        <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5 text-xs font-medium text-muted-foreground">
          <TerminalIcon className="size-3.5" />
          Slash Commands
        </div>
        <div className="max-h-56 space-y-0.5 overflow-y-auto p-1">
          {COMMANDS.map((cmd) => (
            <button
              key={cmd.command}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted transition-colors"
              onClick={() => {
                const result = cmd.action(currentText);
                if (result.text !== undefined) {
                  onSelectCommand(result.text);
                }
                onOpenChange(false);
              }}
            >
              {cmd.icon}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{cmd.command}</p>
                <p className="truncate text-[10px] text-muted-foreground">{cmd.description}</p>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
