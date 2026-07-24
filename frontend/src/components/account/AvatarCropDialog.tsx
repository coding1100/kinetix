"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const OUTPUT_SIZE = 256;

/**
 * Confirmation modal shown after the user picks an image from their desktop.
 * Lets them zoom to frame a square crop, then exports a normalized JPEG so the
 * backend only ever stores a small square avatar.
 */
export function AvatarCropDialog({
  file,
  open,
  onCancel,
  onConfirm,
  saving,
}: {
  file: File | null;
  open: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  saving?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!file) {
      setImage(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = url;
    setZoom(1);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    // Cover-fit the square, then apply the user's zoom, drawing centered.
    const base = Math.max(OUTPUT_SIZE / image.width, OUTPUT_SIZE / image.height);
    const scale = base * zoom;
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, (OUTPUT_SIZE - w) / 2, (OUTPUT_SIZE - h) / 2, w, h);
  }, [image, zoom]);

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust your photo</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Zoom to frame your avatar, then save.
          </p>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <canvas
            ref={canvasRef}
            width={OUTPUT_SIZE}
            height={OUTPUT_SIZE}
            className="size-40 rounded-full border border-border bg-muted object-cover"
          />
          <div className="flex w-full items-center gap-3">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
              aria-label="Zoom"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={saving} loadingText="Saving…">
            Save photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
