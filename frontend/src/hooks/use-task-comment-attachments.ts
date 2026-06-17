"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { pastedFileDisplayName } from "@/lib/chat/composer-image-files";
import { uploadTaskAttachment } from "@/lib/tasks/upload-task-attachment";
import type { AttachmentKind } from "@/lib/types/chat";
import { useWorkspaceApi } from "@/hooks/use-workspace-api";

export type PendingTaskAttachment = {
  id: string;
  fileName: string;
  kind: AttachmentKind;
  mimeType?: string;
  sizeBytes?: number;
  previewUrl?: string;
};

function attachmentKindForMime(mimeType: string): AttachmentKind {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
}

function imagePreviewUrl(blob: Blob, mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return URL.createObjectURL(blob);
  }
  return undefined;
}

export function useTaskCommentAttachments(taskId: string | null) {
  const { accessToken, workspaceId, ready } = useWorkspaceApi();
  const [pending, setPending] = useState<PendingTaskAttachment[]>([]);
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
    async (blob: Blob, fileName: string, mimeType: string) => {
      if (!ready || !taskId) {
        toast.error("Task not ready for attachment upload");
        return null;
      }

      const previewUrl = imagePreviewUrl(blob, mimeType);
      trackPreview(previewUrl);

      const kind = attachmentKindForMime(mimeType);

      setUploading(true);
      setUploadingItem({ fileName, kind, mimeType, sizeBytes: blob.size, previewUrl });

      try {
        const file = new File([blob], fileName, { type: mimeType });
        const attachmentId = await uploadTaskAttachment(
          accessToken,
          workspaceId,
          taskId,
          file
        );
        setPending((prev) => [
          ...prev,
          { id: attachmentId, fileName, kind, mimeType, sizeBytes: blob.size, previewUrl },
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
    [ready, taskId, accessToken, workspaceId, trackPreview, revokePreview]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      return uploadBlob(file, file.name, file.type || "application/octet-stream");
    },
    [uploadBlob]
  );

  const pickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      e.target.value = "";
      for (const file of files) {
        await uploadFile(file);
      }
    },
    [uploadFile]
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const fileName = pastedFileDisplayName(file, i);
        const mime = file.type || "application/octet-stream";
        await uploadBlob(file, fileName, mime);
      }
    },
    [uploadBlob]
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
    uploadFiles,
    removePending,
    clearPending,
  };
}
