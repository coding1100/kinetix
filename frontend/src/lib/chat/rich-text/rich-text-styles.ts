/** Shared Tailwind classes for rich message HTML in composer + message view. */
export const RICH_TEXT_CONTENT_CLASS =
  "[&_div]:block [&_p]:block [&_br]:content-[''] " +
  "[&_a]:text-primary [&_a]:underline " +
  "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 " +
  "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_p]:my-0.5 " +
  "[&_h1]:my-1 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight " +
  "[&_h2]:my-1 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:leading-tight " +
  "[&_h3]:my-1 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-snug " +
  "[&_h4]:my-1 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:leading-snug " +
  "[&_blockquote]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:italic " +
  "[&_pre]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:px-3 [&_pre]:py-2 [&_pre]:font-mono [&_pre]:text-[13px] " +
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] " +
  "[&_s]:line-through [&_strike]:line-through [&_del]:line-through " +
  "[&_[data-banner]]:my-1 [&_[data-banner]]:rounded-md [&_[data-banner]]:px-3 [&_[data-banner]]:py-2 " +
  "[&_[data-banner=info]]:bg-sky-50 [&_[data-banner=info]]:text-sky-950 " +
  "[&_[data-banner=success]]:bg-emerald-50 [&_[data-banner=success]]:text-emerald-950 " +
  "[&_[data-banner=warning]]:bg-amber-50 [&_[data-banner=warning]]:text-amber-950 " +
  "[&_[data-banner=danger]]:bg-rose-50 [&_[data-banner=danger]]:text-rose-950";
