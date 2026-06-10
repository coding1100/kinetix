"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AtSignIcon, Loader2Icon, PaperclipIcon, SmileIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type {
  ChatMessage,
  ConversationType,
  MessageAttachment,
  UpdateMessagePayload,
} from "@/lib/types/chat";
import { formatRequestError } from "@/lib/api/client";
import { normalizeEditableMessageBody } from "@/lib/chat/messages";
import { getPlainTextBeforeCursor } from "@/lib/chat/rich-text/dom";
import { EmojiPickerPopover } from "@/components/chat/emoji/EmojiPickerPopover";
import { MentionPickerPopover } from "@/components/chat/mentions/MentionPickerPopover";
import { RichComposerField } from "@/components/chat/composer/RichComposerField";
import { useRichComposerField } from "@/hooks/use-rich-composer-field";
import {
  useComposerAttachments,
  type PendingAttachment,
} from "@/hooks/use-composer-attachments";
import { useComposerImageDropPaste } from "@/hooks/use-composer-image-drop-paste";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  message: ChatMessage;
  conversationType?: ConversationType;
  conversationId?: string;
  className?: string;
  onSave: (payload: UpdateMessagePayload) => Promise<void>;
  onCancel: () => void;
};

function isImageAttachment(attachment: MessageAttachment) {
  const src = attachment.downloadUrl;
  return attachment.mimeType.startsWith("image/") && Boolean(src);
}

function pendingToDisplayAttachment(pending: PendingAttachment): MessageAttachment {
  return {
    id: pending.id,
    fileName: pending.fileName,
    mimeType: pending.mimeType ?? "application/octet-stream",
    sizeBytes: pending.sizeBytes ?? 0,
    kind: pending.kind,
    downloadUrl: pending.previewUrl ?? null,
  };
}

function InlineEditAttachmentBlock({
  attachment,
  onRemove,
}: {
  attachment: MessageAttachment;
  onRemove: () => void;
}) {
  const isImage = isImageAttachment(attachment);

  return (
    <span
      data-inline-edit-attachment={attachment.id}
      tabIndex={0}
      contentEditable={false}
      className="group relative inline-flex shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onKeyDown={(e) => {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }
      }}
    >
      {isImage ? (
        <img
          src={attachment.downloadUrl!}
          alt=""
          className="max-h-28 max-w-[min(100%,280px)] rounded-md object-contain"
          draggable={false}
        />
      ) : (
        <span className="rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
          {attachment.fileName}
        </span>
      )}
      <button
        type="button"
        tabIndex={-1}
        className="absolute -right-1.5 -top-1.5 hidden size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground group-focus-within:flex group-hover:flex"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          onRemove();
        }}
        aria-label="Remove attachment"
      >
        <XIcon className="size-3" strokeWidth={2} />
      </button>
    </span>
  );
}

export function InlineMessageEdit({
  message,
  conversationType,
  conversationId,
  className,
  onSave,
  onCancel,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [remainingAttachments, setRemainingAttachments] = useState<
    MessageAttachment[]
  >(() => message.attachments ?? []);
  const initialBody = normalizeEditableMessageBody(message.body);

  const context =
    conversationType && conversationId
      ? { type: conversationType, id: conversationId }
      : null;

  const {
    pending,
    uploading,
    uploadingItem,
    fileInputRef,
    pickFile,
    onFileInputChange,
    uploadImageFiles,
    removePending,
    clearPending,
  } = useComposerAttachments(context);

  const imageInputEnabled = Boolean(context) && !uploading && !saving;
  const { dragActive, rootProps } = useComposerImageDropPaste({
    enabled: imageInputEnabled,
    onImages: uploadImageFiles,
  });

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
    restore,
    clear,
  } = useRichComposerField();

  const displayAttachments = useMemo(
    () => [
      ...remainingAttachments,
      ...pending.map(pendingToDisplayAttachment),
    ],
    [remainingAttachments, pending]
  );

  const canSave =
    (Boolean(bodyText.trim()) || displayAttachments.length > 0) && !uploading;

  const removeAttachment = useCallback(
    (attachmentId: string) => {
      if (pending.some((item) => item.id === attachmentId)) {
        removePending(attachmentId);
      } else {
        setRemainingAttachments((prev) =>
          prev.filter((attachment) => attachment.id !== attachmentId)
        );
      }
      requestAnimationFrame(() => editorRef.current?.focus());
    },
    [editorRef, pending, removePending]
  );

  const handleCancel = () => {
    clearPending();
    setRemainingAttachments(message.attachments ?? []);
    clear();
    onCancel();
  };

  useEffect(() => {
    setRemainingAttachments(message.attachments ?? []);
    restore(initialBody);
    editorRef.current?.focus();
  }, [message.id, initialBody, restore, editorRef]);

  const handleSave = async () => {
    if (!canSave || saving || uploading) return;
    const nextBody = getBodyText().trim();
    const attachmentIds = [
      ...remainingAttachments.map((attachment) => attachment.id),
      ...pending.map((item) => item.id),
    ];
    setSaving(true);
    try {
      await onSave({
        body: nextBody,
        attachmentIds,
      });
      clearPending();
      clear();
    } catch (err) {
      const detail = formatRequestError(err);
      toast.error(`Failed to save message — ${detail}`, { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
      return;
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      const active = document.activeElement as HTMLElement | null;
      const block = active?.closest("[data-inline-edit-attachment]");
      if (block) {
        const attachmentId = block.getAttribute("data-inline-edit-attachment");
        if (attachmentId) {
          e.preventDefault();
          removeAttachment(attachmentId);
          return;
        }
      }

      if (
        e.key === "Backspace" &&
        editorRef.current &&
        editorRef.current.contains(document.activeElement)
      ) {
        const beforeCursor = getPlainTextBeforeCursor(editorRef.current);
        if (!beforeCursor && displayAttachments.length > 0) {
          e.preventDefault();
          const last = displayAttachments[displayAttachments.length - 1];
          removeAttachment(last.id);
          return;
        }
      }
    }

    handleInputKeyDown(e, () => void handleSave());
  };

  const placeholder =
    displayAttachments.length > 0 ? "Add a caption…" : "Edit message…";

  const leadingContent =
    displayAttachments.length > 0 || uploadingItem ? (
      <>
        {uploadingItem ? (
          <span className="relative inline-flex shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted/20">
            {uploadingItem.previewUrl &&
            uploadingItem.mimeType?.startsWith("image/") ? (
              <img
                src={uploadingItem.previewUrl}
                alt=""
                className="max-h-28 max-w-[min(100%,280px)] rounded-md object-contain opacity-60"
                draggable={false}
              />
            ) : (
              <span className="px-3 py-6 text-xs text-muted-foreground">
                {uploadingItem.fileName}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center rounded-md bg-background/40">
              <Loader2Icon className="size-5 animate-spin text-primary" />
            </span>
          </span>
        ) : null}
        {displayAttachments.map((attachment) => (
          <InlineEditAttachmentBlock
            key={attachment.id}
            attachment={attachment}
            onRemove={() => removeAttachment(attachment.id)}
          />
        ))}
      </>
    ) : null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(e) => void onFileInputChange(e)}
      />
      <div
        className={cn(
          "relative mt-1 overflow-hidden rounded-lg border border-primary/30 bg-card shadow-sm",
          dragActive && "ring-2 ring-primary/40",
          className
        )}
        {...rootProps}
      >
        {dragActive ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/5 text-sm font-medium text-primary"
            aria-hidden
          >
            Drop image to attach
          </div>
        ) : null}
        <RichComposerField
          segments={segments}
          draftPlain={draftPlain}
          editorRef={editorRef}
          placeholder={placeholder}
          leadingContent={leadingContent}
          mentionAutocompleteOpen={mentionAutocompleteOpen}
          mentionQuery={mentionQuery}
          conversationType={conversationType}
          conversationId={conversationId}
          onSelectMention={insertMention}
          onDismissMentionAutocomplete={dismissMentionAutocomplete}
          onKeyDown={handleKeyDown}
          onInput={syncFromEditor}
          onPasteFiles={imageInputEnabled ? uploadImageFiles : undefined}
        />

        <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-7 text-muted-foreground"
              aria-label="Attach image"
              disabled={!imageInputEnabled}
              onClick={pickFile}
            >
              <PaperclipIcon className="size-4" strokeWidth={1.5} />
            </Button>
            <MentionPickerPopover
            conversationType={conversationType}
            conversationId={conversationId}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onSelectMention={insertMention}
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 text-muted-foreground"
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
                className="size-7 text-muted-foreground"
                aria-label="Emoji"
              >
                <SmileIcon className="size-4" strokeWidth={1.5} />
              </Button>
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs"
            disabled={saving || uploading}
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 px-4 text-xs"
            disabled={!canSave || saving || uploading}
            loading={saving}
            onClick={() => void handleSave()}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}
