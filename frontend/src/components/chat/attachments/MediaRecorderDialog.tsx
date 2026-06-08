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

type RecorderMode = "video" | "clip";

export function MediaRecorderDialog({
  open,
  mode,
  onOpenChange,
  onRecorded,
}: {
  open: boolean;
  mode: RecorderMode;
  onOpenChange: (open: boolean) => void;
  onRecorded: (blob: Blob, fileName: string) => Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopTracks = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  };

  useEffect(() => {
    if (!open) {
      recorder?.stop();
      stopTracks();
      setRecorder(null);
      setChunks([]);
      setRecording(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const start = async () => {
      try {
        const media =
          mode === "clip"
            ? await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
              })
            : await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
              });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(media);
        if (videoRef.current) {
          videoRef.current.srcObject = media;
        }
        const rec = new MediaRecorder(media, {
          mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
            ? "video/webm;codecs=vp9"
            : "video/webm",
        });
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) setChunks((prev) => [...prev, e.data]);
        };
        setRecorder(rec);
      } catch {
        setError(
          mode === "clip"
            ? "Screen recording permission denied"
            : "Camera permission denied"
        );
      }
    };
    void start();
    return () => {
      cancelled = true;
    };
  }, [open, mode]);

  const handleClose = () => onOpenChange(false);

  const startRecording = () => {
    if (!recorder) return;
    setChunks([]);
    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    recorder?.stop();
    setRecording(false);
  };

  const handleSave = async () => {
    if (chunks.length === 0) return;
    setSaving(true);
    try {
      const blob = new Blob(chunks, { type: "video/webm" });
      const fileName =
        mode === "clip"
          ? `screen-recording-${Date.now()}.webm`
          : `video-clip-${Date.now()}.webm`;
      await onRecorded(blob, fileName);
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "clip" ? "Record clip" : "Video clip"}
          </DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="aspect-video w-full rounded-lg border border-border bg-black object-cover"
          />
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {!recording ? (
              <Button disabled={!recorder || !!error} onClick={startRecording}>
                Start recording
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopRecording}>
                Stop
              </Button>
            )}
            <Button
              loading={saving}
              loadingText="Uploading…"
              disabled={recording || chunks.length === 0}
              onClick={() => void handleSave()}
            >
              Attach
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
