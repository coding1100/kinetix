import { appleEmojiImageUrl } from "@/lib/chat/emoji/apple-emoji";

/** Renders a single emoji as the same Apple-style image the picker shows,
 * instead of relying on the OS's emoji font (which on Windows renders a
 * visibly different, non-Apple glyph for the same Unicode character). */
export function AppleEmoji({
  emoji,
  size = 16,
  className,
}: {
  emoji: string;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={appleEmojiImageUrl(emoji)}
      alt={emoji}
      width={size}
      height={size}
      className={className}
      style={{ display: "inline-block", verticalAlign: "-0.2em" }}
      draggable={false}
    />
  );
}
