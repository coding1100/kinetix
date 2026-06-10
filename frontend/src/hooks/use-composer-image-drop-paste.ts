"use client";

import { useCallback, useRef, useState } from "react";
import { extractImageFilesFromDataTransfer } from "@/lib/chat/composer-image-files";

type Options = {
  enabled: boolean;
  onImages: (files: File[]) => void | Promise<void>;
};

export function useComposerImageDropPaste({ enabled, onImages }: Options) {
  const [dragActive, setDragActive] = useState(false);
  const depthRef = useRef(0);

  const acceptImages = useCallback(
    (files: File[]) => {
      if (!enabled || files.length === 0) return;
      void onImages(files);
    },
    [enabled, onImages]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (!enabled) return false;
      const images = extractImageFilesFromDataTransfer(e.clipboardData);
      if (images.length === 0) return false;
      e.preventDefault();
      acceptImages(images);
      return true;
    },
    [enabled, acceptImages]
  );

  const rootProps = {
    onDragEnter: (e: React.DragEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      depthRef.current += 1;
      if (extractImageFilesFromDataTransfer(e.dataTransfer).length > 0) {
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
      const images = extractImageFilesFromDataTransfer(e.dataTransfer);
      acceptImages(images);
    },
  };

  return { dragActive, rootProps, handlePaste };
}
