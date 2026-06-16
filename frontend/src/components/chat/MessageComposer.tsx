"use client";

import { useEffect, useState } from "react";
import { useChatStore } from "@/stores/chat-store";
import {
  PlusIcon,
  PaperclipIcon,
  AtSignIcon,
  SmileIcon,
  VideoIcon,
  MicIcon,
  SquareCheckBigIcon,
  FilePlusIcon,
  MonitorUpIcon,
  SendIcon,
  ChevronDownIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatRequestError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUiStore } from "@/stores/ui-store";
import { EmojiPickerPopover } from "@/components/chat/emoji/EmojiPickerPopover";
import type { ConversationType, SendMessagePayload } from "@/lib/types/chat";
import { useComposerAttachments } from "@/hooks/use-composer-attachments";
import { useComposerFileDropPaste } from "@/hooks/use-composer-file-drop-paste";
import { ComposerAttachmentChips } from "@/components/chat/attachments/ComposerAttachmentChips";
import { CreateDocDialog } from "@/components/chat/attachments/CreateDocDialog";
import { MediaRecorderDialog } from "@/components/chat/attachments/MediaRecorderDialog";
import { SHOW_EXTENDED_COMPOSER_TOOLS } from "@/lib/chat/composer-flags";
import { MentionPickerPopover } from "@/components/chat/mentions/MentionPickerPopover";
import { RichComposerField } from "@/components/chat/composer/RichComposerField";
import { useRichComposerField } from "@/hooks/use-rich-composer-field";
import { useMentionChannels } from "@/hooks/use-mention-channels";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";
import {
  emitTypingStart,
  emitTypingStop,
} from "@/lib/socket/chat-typing";

function ToolbarDivider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />;
}

type MessageComposerProps = {
  recipientLabel: string;
  compact?: boolean;
  className?: string;
  conversationType?: ConversationType;
  conversationId?: string;
  onSend?: (payload: SendMessagePayload) => Promise<void>;
};

export function MessageComposer({
  recipientLabel,
  compact = false,
  className,
  conversationType,
  conversationId,
  onSend,
}: MessageComposerProps) {
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState("message");
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
    insertQuote,
    insertEmoji,
    handleInputKeyDown,
    syncFromEditor,
    clear: clearMentions,
    restore: restoreMentions,
  } = useRichComposerField();
  const pendingComposerQuote = useChatStore((s) => s.pendingComposerQuote);
  const clearComposerQuote = useChatStore((s) => s.clearComposerQuote);
  const [docOpen, setDocOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [clipOpen, setClipOpen] = useState(false);
  const openModal = useUiStore((s) => s.openModal);
  const { workspaceId } = useWorkspaceApi();
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
    uploadFiles,
    removePending,
    clearPending,
  } = useComposerAttachments(context);

  const fileInputEnabled = Boolean(context) && !uploading;
  const { dragActive, rootProps } = useComposerFileDropPaste({
    enabled: fileInputEnabled,
    onFiles: uploadFiles,
  });

  const placeholder = compact
    ? "Reply in thread..."
    : `Write to ${recipientLabel}`;

  const canSend = Boolean(bodyText.trim() || attachmentIds.length > 0);

  useEffect(() => {
    if (!workspaceId || !conversationType || !conversationId) return;
    if (!bodyText.trim()) {
      emitTypingStop(workspaceId, conversationType, conversationId);
      return;
    }
    emitTypingStart(workspaceId, conversationType, conversationId);
    const timer = window.setTimeout(() => {
      emitTypingStop(workspaceId, conversationType, conversationId);
    }, 2800);
    return () => {
      window.clearTimeout(timer);
      emitTypingStop(workspaceId, conversationType, conversationId);
    };
  }, [bodyText, workspaceId, conversationType, conversationId]);

  useEffect(() => {
    if (!pendingComposerQuote || pendingComposerQuote.target !== "main") {
      return;
    }
    insertQuote({
      quoteText: pendingComposerQuote.quoteText,
      authorName: pendingComposerQuote.authorName,
    });
    clearComposerQuote();
    editorRef.current?.focus();
  }, [pendingComposerQuote, insertQuote, clearComposerQuote, editorRef]);

  const handleSend = async () => {
    if (!canSend || sending || uploading) return;
    const messageBody = getBodyText().trim();

    setSending(true);
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
    if (workspaceId && conversationType && conversationId) {
      emitTypingStop(workspaceId, conversationType, conversationId);
    }
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
        toast.success("Message sent (mock)");
      }
    } catch (err) {
      restoreMentions(messageBody);
      const detail = formatRequestError(err);
      console.error("[send message]", err);
      toast.error(`Failed to send message — ${detail}`, { duration: 8000 });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    handleInputKeyDown(e, () => void handleSend());
  };

  const iconBtn = (
    label: string,
    Icon: typeof PaperclipIcon,
    onClick?: () => void,
    disabled?: boolean
  ) => (
    <Tooltip>
      <TooltipTrigger
        render={
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
        }
      />
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );

  const handleCreateDoc = async (title: string, content: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const fileName = `${title.replace(/\s+/g, "-").toLowerCase()}.md`;
    await uploadBlob(blob, fileName, "text/markdown", "doc");
  };

  const handleRecorded = async (blob: Blob, fileName: string, kind: "video" | "clip") => {
    await uploadBlob(blob, fileName, "video/webm", kind);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
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

      <div
        className={cn(
          "shrink-0 bg-card",
          compact ? "px-2 py-2" : "border-t border-border px-34 py-3",
          className
        )}
      >
        <div
          className={cn(
            "relative rounded-md border border-border bg-card transition-shadow",
            dragActive && "ring-2 ring-primary/40"
          )}
          {...rootProps}
        >
          {dragActive ? (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md bg-primary/5 text-sm font-medium text-primary"
              aria-hidden
            >
              Drop files to attach
            </div>
          ) : null}
          <ComposerAttachmentChips
            items={pending}
            uploadingItem={uploadingItem}
            onRemove={removePending}
          />
          <RichComposerField
            segments={segments}
            draftPlain={draftPlain}
            editorRef={editorRef}
            placeholder={placeholder}
            compact={compact}
            mentionAutocompleteOpen={mentionAutocompleteOpen}
            mentionQuery={mentionQuery}
            conversationType={conversationType}
            conversationId={conversationId}
            onSelectMention={insertMention}
            onDismissMentionAutocomplete={dismissMentionAutocomplete}
            onKeyDown={handleKeyDown}
            onInput={syncFromEditor}
            onPasteFiles={fileInputEnabled ? uploadFiles : undefined}
          />

          <div className="flex items-center justify-between gap-2 px-2 pb-2">
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
                  className="size-7 shrink-0 rounded-full border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                  aria-label="Attach file"
                  disabled={uploading}
                  onClick={pickFile}
                >
                  <PlusIcon className="size-3.5" strokeWidth={1.5} />
                </Button>

                <ToolbarDivider />

                <Select value={mode} onValueChange={(v) => v && setMode(v)}>
                  <SelectTrigger
                    size="sm"
                    className="h-7 shrink-0 gap-1 border-0 bg-transparent px-1.5 text-xs font-medium shadow-none focus-visible:ring-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="message">Message</SelectItem>
                    <SelectItem value="post">Post</SelectItem>
                    <SelectItem value="reply">Reply</SelectItem>
                  </SelectContent>
                </Select>
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

                <ToolbarDivider />

                {iconBtn("Create task", SquareCheckBigIcon)}
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
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "size-7",
                  canSend
                    ? "text-primary hover:text-primary"
                    : "text-muted-foreground"
                )}
                disabled={!canSend || uploading}
                loading={sending}
                aria-label="Send"
                onClick={() => void handleSend()}
              >
                <SendIcon className="size-4" strokeWidth={1.5} />
              </Button>

              <ToolbarDivider />

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 text-muted-foreground"
                      aria-label="Send options"
                    >
                      <ChevronDownIcon className="size-4" strokeWidth={1.5} />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => openModal("schedule-message")}>
                    Schedule message
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast("Send later — Phase 3")}>
                    Send later
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
