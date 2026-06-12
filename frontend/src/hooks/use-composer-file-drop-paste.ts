"use client";

import { useCallback, useRef, useState } from "react";
import { extractFilesFromDataTransfer } from "@/lib/chat/composer-image-files";

type Options = {
  enabled: boolean;
  onFiles: (files: File[]) => void | Promise<void>;
};

export function useComposerFileDropPaste({ enabled, onFiles }: Options) {
  const [dragActive, setDragActive] = useState(false);
  const depthRef = useRef(0);

  const acceptFiles = useCallback(
    (files: File[]) => {
      if (!enabled || files.length === 0) return;
      void onFiles(files);
    },
    [enabled, onFiles]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!enabled) return false;
      const files = extractFilesFromDataTransfer(e.clipboardData);
      if (files.length === 0) return false;
      e.preventDefault();
      acceptFiles(files);
      return true;
    },
    [enabled, acceptFiles]
  );

  const rootProps = {
    onDragEnter: (e: React.DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      depthRef.current += 1;
      if (extractFilesFromDataTransfer(e.dataTransfer).length > 0) {
        setDragActive(true);
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      depthRef.current = Math.max(0, depthRef.current - 1);
      if (depthRef.current === 0) setDragActive(false);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
    },
    onDrop: (e: React.DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      depthRef.current = 0;
      setDragActive(false);
      acceptFiles(extractFilesFromDataTransfer(e.dataTransfer));
    },
  };

  return { dragActive, rootProps, handlePaste };
}

/** @deprecated Use useComposerFileDropPaste */
export function useComposerImageDropPaste({
  enabled,
  onImages,
}: {
  enabled: boolean;
  onImages: (files: File[]) => void | Promise<void>;
}) {
  return useComposerFileDropPaste({ enabled, onFiles: onImages });
}
