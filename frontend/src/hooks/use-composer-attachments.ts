"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadChatAttachment } from "@/lib/chat/upload-attachment";
import type { AttachmentKind, ConversationType } from "@/lib/types/chat";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";

export type PendingAttachment = {
  id: string;
  fileName: string;
  kind: AttachmentKind;
  mimeType?: string;
  sizeBytes?: number;
  previewUrl?: string;
};

function imagePreviewUrl(blob: Blob, mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return URL.createObjectURL(blob);
  }
  return undefined;
}

export function useComposerAttachments(
  context: { type: ConversationType; id: string } | null
) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingItem, setUploadingItem] = useState<{
    fileName: string;
    kind: AttachmentKind;
    mimeType?: string;
    sizeBytes?: number;
    previewUrl?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  const trackPreview = useCallback((url?: string) => {
    if (url) previewUrlsRef.current.add(url);
  }, []);

  const revokePreview = useCallback((url?: string) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    previewUrlsRef.current.delete(url);
  }, []);

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const uploadBlob = useCallback(
    async (blob: Blob, fileName: string, mimeType: string, kind: AttachmentKind) => {
      if (!ready || !context) {
        toast.error("Select a conversation first");
        return null;
      }

      const previewUrl = imagePreviewUrl(blob, mimeType);
      trackPreview(previewUrl);

      setUploading(true);
      setUploadingItem({
        fileName,
        kind,
        mimeType,
        sizeBytes: blob.size,
        previewUrl,
      });

      try {
        const attachmentId = await uploadChatAttachment(
          accessToken,
          workspaceId,
          context,
          blob,
          fileName,
          mimeType,
          kind
        );
        setPending((prev) => [
          ...prev,
          {
            id: attachmentId,
            fileName,
            kind,
            mimeType,
            sizeBytes: blob.size,
            previewUrl,
          },
        ]);
        return attachmentId;
      } catch (err) {
        revokePreview(previewUrl);
        toast.error(
          err instanceof Error ? err.message : "Failed to upload attachment"
        );
        return null;
      } finally {
        setUploading(false);
        setUploadingItem(null);
      }
    },
    [ready, context, accessToken, workspaceId, trackPreview, revokePreview]
  );

  const uploadFile = useCallback(
    async (file: File, kind: AttachmentKind = "file") => {
      return uploadBlob(file, file.name, file.type || "application/octet-stream", kind);
    },
    [uploadBlob]
  );

  const pickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      await uploadFile(file, "file");
    },
    [uploadFile]
  );

  const removePending = useCallback(
    (id: string) => {
      setPending((prev) => {
        const removed = prev.find((p) => p.id === id);
        revokePreview(removed?.previewUrl);
        return prev.filter((p) => p.id !== id);
      });
    },
    [revokePreview]
  );

  const clearPending = useCallback(() => {
    setPending((prev) => {
      prev.forEach((p) => revokePreview(p.previewUrl));
      return [];
    });
  }, [revokePreview]);

  const attachmentIds = pending.map((p) => p.id);

  return {
    pending,
    uploading,
    uploadingItem,
    attachmentIds,
    fileInputRef,
    pickFile,
    onFileInputChange,
    uploadBlob,
    uploadFile,
    removePending,
    clearPending,
  };
}
