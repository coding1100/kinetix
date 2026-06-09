"use client";

import { useState } from "react";
import {
  PlusIcon,
  PaperclipIcon,
  AtSignIcon,
  UserIcon,
  SmileIcon,
  VideoIcon,
  MicIcon,
  FilePlusIcon,
  MonitorUpIcon,
  MoreHorizontalIcon,
  SendIcon,
  ChevronDownIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmojiPickerPopover } from "@/components/chat/emoji/EmojiPickerPopover";
import type { ConversationType, SendMessagePayload } from "@/lib/types/chat";
import { useComposerAttachments } from "@/hooks/use-composer-attachments";
import { ComposerAttachmentChips } from "@/components/chat/attachments/ComposerAttachmentChips";
import { CreateDocDialog } from "@/components/chat/attachments/CreateDocDialog";
import { MediaRecorderDialog } from "@/components/chat/attachments/MediaRecorderDialog";
import { SHOW_EXTENDED_COMPOSER_TOOLS } from "@/lib/chat/composer-flags";
import { MentionPickerPopover } from "@/components/chat/mentions/MentionPickerPopover";
import { MentionComposerField } from "@/components/chat/mentions/MentionComposerField";
import { useComposerMentionField } from "@/hooks/use-composer-mention-field";
import { useMentionChannels } from "@/hooks/use-mention-channels";

function ToolbarDivider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />;
}

export function ThreadReplyComposer({
  alsoSendChannelLabel,
  conversationType,
  conversationId,
  onSend,
}: {
  alsoSendChannelLabel?: string;
  conversationType?: ConversationType;
  conversationId?: string;
  onSend?: (payload: SendMessagePayload) => Promise<void>;
}) {
  const [alsoSend, setAlsoSend] = useState(true);
  const [sending, setSending] = useState(false);
  const {
    segments,
    draft,
    setDraft,
    bodyText,
    inputRef,
    pickerOpen,
    setPickerOpen,
    mentionQuery,
    mentionAutocompleteOpen,
    insertMention,
    insertEmoji,
    handleInputKeyDown,
    clear: clearMentions,
    restore: restoreMentions,
  } = useComposerMentionField();
  const [docOpen, setDocOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [clipOpen, setClipOpen] = useState(false);
  useMentionChannels();

  const context =
    conversationType && conversationId
      ? { type: conversationType, id: conversationId }
      : null;

  const {
    pending,
    uploading,
    uploadingItem,
    attachmentIds,
    fileInputRef,
    pickFile,
    onFileInputChange,
    uploadBlob,
    removePending,
    clearPending,
  } = useComposerAttachments(context);

  const canSend = Boolean(bodyText.trim() || attachmentIds.length > 0);

  const handleSend = async () => {
    if (!canSend || sending || uploading) return;
    setSending(true);
    const messageBody = bodyText.trim();
    const ids = [...attachmentIds];
    const optimisticAttachments = pending.map(
      ({ id, fileName, kind, mimeType, sizeBytes }) => ({
        id,
        fileName,
        kind,
        mimeType: mimeType ?? "application/octet-stream",
        sizeBytes: sizeBytes ?? 0,
      })
    );
    clearMentions();
    clearPending();
    try {
      if (onSend) {
        await onSend({
          body: messageBody,
          attachmentIds: ids.length ? ids : undefined,
          optimisticAttachments: optimisticAttachments.length
            ? optimisticAttachments
            : undefined,
        });
      } else {
        toast.success("Reply sent (mock)");
      }
    } catch {
      restoreMentions(messageBody);
      toast.error("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    handleInputKeyDown(e, () => void handleSend());
  };

  const iconBtn = (
    label: string,
    Icon: typeof PaperclipIcon,
    onClick?: () => void,
    disabled?: boolean
  ) => (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="size-7 text-muted-foreground hover:text-foreground"
      aria-label={label}
      disabled={disabled}
      onClick={onClick ?? (() => toast(`${label} — coming soon`))}
    >
      <Icon className="size-4" strokeWidth={1.5} />
    </Button>
  );

  const handleCreateDoc = async (title: string, content: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const fileName = `${title.replace(/\s+/g, "-").toLowerCase()}.md`;
    await uploadBlob(blob, fileName, "text/markdown", "doc");
  };

  const handleRecorded = async (
    blob: Blob,
    fileName: string,
    kind: "video" | "clip"
  ) => {
    await uploadBlob(blob, fileName, "video/webm", kind);
  };

  return (
    <div className="shrink-0 px-3 pb-3">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => void onFileInputChange(e)}
      />
      <CreateDocDialog
        open={docOpen}
        onOpenChange={setDocOpen}
        onCreate={handleCreateDoc}
      />
      <MediaRecorderDialog
        open={videoOpen}
        mode="video"
        onOpenChange={setVideoOpen}
        onRecorded={(blob, name) => handleRecorded(blob, name, "video")}
      />
      <MediaRecorderDialog
        open={clipOpen}
        mode="clip"
        onOpenChange={setClipOpen}
        onRecorded={(blob, name) => handleRecorded(blob, name, "clip")}
      />

      <div className="rounded-md border border-border bg-card">
        <ComposerAttachmentChips
          items={pending}
          uploadingItem={uploadingItem}
          onRemove={removePending}
        />
        <MentionComposerField
          segments={segments}
          draft={draft}
          onDraftChange={setDraft}
          inputRef={inputRef}
          placeholder="Reply..."
          compact
          mentionAutocompleteOpen={mentionAutocompleteOpen}
          mentionQuery={mentionQuery}
          conversationType={conversationType}
          conversationId={conversationId}
          onSelectMention={insertMention}
          onKeyDown={handleKeyDown}
        />

        {alsoSendChannelLabel && (
          <label className="flex cursor-pointer items-center gap-2 px-3 pb-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={alsoSend}
              onChange={(e) => setAlsoSend(e.target.checked)}
              className="size-3.5 rounded border-border accent-primary"
            />
            <span>
              Also send to{" "}
              <span className="font-medium text-foreground">
                #{alsoSendChannelLabel}
              </span>
            </span>
          </label>
        )}

        <div className="flex items-center justify-between gap-1 px-2 pb-2">
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            <div
              className={cn(
                "flex items-center gap-0.5",
                !SHOW_EXTENDED_COMPOSER_TOOLS && "hidden"
              )}
              aria-hidden={!SHOW_EXTENDED_COMPOSER_TOOLS}
            >
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="size-7 shrink-0 rounded-full border-border bg-muted/40"
                aria-label="Attach file"
                disabled={uploading}
                onClick={pickFile}
              >
                <PlusIcon className="size-3.5" strokeWidth={1.5} />
              </Button>
            </div>
            {iconBtn("Attach file", PaperclipIcon, pickFile, uploading)}
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
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="Mention"
                >
                  <AtSignIcon className="size-4" strokeWidth={1.5} />
                </Button>
              }
            />
            <div
              className={cn(!SHOW_EXTENDED_COMPOSER_TOOLS && "hidden")}
              aria-hidden={!SHOW_EXTENDED_COMPOSER_TOOLS}
            >
              {iconBtn("People", UserIcon)}
            </div>
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
            <div
              className={cn(
                "flex items-center gap-0.5",
                !SHOW_EXTENDED_COMPOSER_TOOLS && "hidden"
              )}
              aria-hidden={!SHOW_EXTENDED_COMPOSER_TOOLS}
            >
              {iconBtn(
                "Video clip",
                VideoIcon,
                () => setVideoOpen(true),
                uploading
              )}
              {iconBtn("Voice clip", MicIcon)}
              {iconBtn(
                "Create doc",
                FilePlusIcon,
                () => setDocOpen(true),
                uploading
              )}
              {iconBtn(
                "Record clip",
                MonitorUpIcon,
                () => setClipOpen(true),
                uploading
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 text-muted-foreground"
                    aria-label="More"
                  >
                    <MoreHorizontalIcon className="size-4" strokeWidth={1.5} />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={pickFile}>Attach file</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDocOpen(true)}>
                  Create doc
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setVideoOpen(true)}>
                  Video clip
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setClipOpen(true)}>
                  Record clip
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn(
                "size-7",
                canSend ? "text-primary" : "text-muted-foreground"
              )}
              disabled={!canSend || uploading}
              loading={sending}
              aria-label="Send reply"
              onClick={() => void handleSend()}
            >
              <SendIcon className="size-4" strokeWidth={1.5} />
            </Button>
            <ToolbarDivider />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-7 text-muted-foreground"
              aria-label="Send options"
            >
              <ChevronDownIcon className="size-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
