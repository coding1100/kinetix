"use client";

import { useEffect } from "react";
import { PaperclipIcon, AtSignIcon, SmileIcon, SendHorizontalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmojiPickerPopover } from "@/components/chat/emoji/EmojiPickerPopover";
import { MentionPickerPopover } from "@/components/chat/mentions/MentionPickerPopover";
import { RichComposerField } from "@/components/chat/composer/RichComposerField";
import { ComposerAttachmentChips } from "@/components/chat/attachments/ComposerAttachmentChips";
import { useRichComposerField } from "@/hooks/use-rich-composer-field";
import { useTaskCommentAttachments } from "@/hooks/use-task-comment-attachments";
import { useComposerFileDropPaste } from "@/hooks/use-composer-file-drop-paste";
import { bodyToComposerHtml } from "@/lib/chat/rich-text/sanitize";
import type { PendingAttachment } from "@/hooks/use-composer-attachments";
import type { MentionMember } from "@/hooks/use-mention-members";

function ToolbarDivider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />;
}

type TaskCommentComposerProps = {
  taskId: string | null;
  workspaceMembers?: MentionMember[];
  placeholder?: string;
  className?: string;
  compact?: boolean;
  initialBody?: string;
  sending?: boolean;
  onCancel?: () => void;
  onSubmit: (body: string, attachmentIds: string[]) => Promise<void>;
};

export function TaskCommentComposer({
  taskId,
  workspaceMembers,
  placeholder = "Write a comment…",
  className,
  compact = false,
  initialBody,
  sending = false,
  onCancel,
  onSubmit,
}: TaskCommentComposerProps) {
  const {
    segments,
    draftPlain,
    bodyText,
    getBodyText,
    editorRef,
    pickerOpen,
    setPickerOpen,
    mentionQuery,
    mentionAutocompleteOpen,
    dismissMentionAutocomplete,
    insertMention,
    insertEmoji,
    handleInputKeyDown,
    syncFromEditor,
    clear: clearComposer,
  } = useRichComposerField();

  useEffect(() => {
    if (!initialBody || !editorRef.current) return;
    const html = bodyToComposerHtml(initialBody);
    editorRef.current.innerHTML = html;
    syncFromEditor();
  }, [initialBody, editorRef, syncFromEditor]);

  const {
    pending,
    uploading,
    uploadingItem,
    attachmentIds,
    fileInputRef,
    pickFile,
    onFileInputChange,
    uploadFiles,
    removePending,
    clearPending,
  } = useTaskCommentAttachments(taskId);

  const fileInputEnabled = Boolean(taskId) && !uploading;
  const { dragActive, rootProps } = useComposerFileDropPaste({
    enabled: fileInputEnabled,
    onFiles: uploadFiles,
  });

  const canSend = Boolean(bodyText.trim() || attachmentIds.length > 0);

  const handleSend = async () => {
    if (!canSend || sending || uploading) return;
    const body = getBodyText().trim();
    const ids = [...attachmentIds];
    clearComposer();
    clearPending();
    await onSubmit(body, ids);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    handleInputKeyDown(e, () => void handleSend());
  };

  // Cast pending to PendingAttachment[] — compatible since kind is present
  const pendingAsChat = pending as unknown as PendingAttachment[];

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void onFileInputChange(e)}
      />

      <div className={cn("rounded-lg border border-border bg-background shadow-sm", compact && "shadow-none", className)}>
        <div
          className={cn(
            "relative rounded-t-lg transition-shadow",
            dragActive && "ring-2 ring-inset ring-primary/40"
          )}
          {...rootProps}
        >
          {dragActive ? (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-t-lg bg-primary/5 text-sm font-medium text-primary"
              aria-hidden
            >
              Drop files to attach
            </div>
          ) : null}

          <ComposerAttachmentChips
            items={pendingAsChat}
            uploadingItem={uploadingItem}
            onRemove={removePending}
          />

          <RichComposerField
            segments={segments}
            draftPlain={draftPlain}
            editorRef={editorRef}
            placeholder={placeholder}
            mentionAutocompleteOpen={mentionAutocompleteOpen}
            mentionQuery={mentionQuery}
            members={workspaceMembers}
            onSelectMention={insertMention}
            onDismissMentionAutocomplete={dismissMentionAutocomplete}
            onKeyDown={handleKeyDown}
            onInput={syncFromEditor}
            onPasteFiles={fileInputEnabled ? uploadFiles : undefined}
          />
        </div>

        <div className={cn("flex items-center justify-between border-t border-border px-2", compact ? "py-1" : "py-1.5")}>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    aria-label="Attach file"
                    disabled={uploading || !taskId}
                    onClick={pickFile}
                  >
                    <PaperclipIcon className="size-4" strokeWidth={1.5} />
                  </Button>
                }
              />
              <TooltipContent side="top">Attach file</TooltipContent>
            </Tooltip>

            <ToolbarDivider />

            <MentionPickerPopover
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              members={workspaceMembers}
              onSelectMention={insertMention}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="Mention"
                >
                  <AtSignIcon className="size-4" strokeWidth={1.5} />
                </Button>
              }
            />

            <EmojiPickerPopover
              onSelectEmoji={insertEmoji}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="Emoji"
                >
                  <SmileIcon className="size-4" strokeWidth={1.5} />
                </Button>
              }
            />
          </div>

          <div className="flex items-center gap-1">
            {onCancel ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={onCancel}
              >
                Cancel
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon-sm"
              className={cn(
                "size-7",
                canSend ? "text-primary hover:text-primary" : "text-muted-foreground"
              )}
              variant="ghost"
              disabled={!canSend || uploading}
              loading={sending}
              aria-label="Send comment"
              onClick={() => void handleSend()}
            >
              <SendHorizontalIcon className="size-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
