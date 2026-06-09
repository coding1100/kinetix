export type TurnIntoBlockType =
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "blockquote"
  | "pre"
  | "banner-info"
  | "banner-success"
  | "banner-warning"
  | "banner-danger";

export type BannerVariant = "info" | "success" | "warning" | "danger";

export const TURN_INTO_OPTIONS: {
  id: TurnIntoBlockType;
  label: string;
  shortcut?: string;
  group?: "turn-into" | "banner";
}[] = [
  { id: "p", label: "Text", group: "turn-into" },
  { id: "h1", label: "Heading 1", shortcut: "Alt+Ctrl+1", group: "turn-into" },
  { id: "h2", label: "Heading 2", shortcut: "Alt+Ctrl+2", group: "turn-into" },
  { id: "h3", label: "Heading 3", shortcut: "Alt+Ctrl+3", group: "turn-into" },
  { id: "h4", label: "Heading 4", shortcut: "Alt+Ctrl+4", group: "turn-into" },
  { id: "pre", label: "Code block", group: "turn-into" },
  { id: "blockquote", label: "Quote", group: "turn-into" },
  { id: "banner-info", label: "Info banner", group: "banner" },
  { id: "banner-success", label: "Success banner", group: "banner" },
  { id: "banner-warning", label: "Warning banner", group: "banner" },
  { id: "banner-danger", label: "Danger banner", group: "banner" },
];

export function turnIntoLabel(id: TurnIntoBlockType): string {
  return TURN_INTO_OPTIONS.find((o) => o.id === id)?.label ?? "Text";
}
