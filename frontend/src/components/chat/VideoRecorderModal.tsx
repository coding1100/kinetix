"use client";

import { useEffect, useRef, useState } from "react";
import { VideoIcon, SquareIcon, PlayIcon, PauseIcon, Trash2Icon, SendIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface VideoRecorderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendVideo: (file: File) => void;
}

export function VideoRecorderModal({
  open,
  onOpenChange,
  onSendVideo,
}: VideoRecorderModalProps) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open && !videoBlob) {
      void startCamera();
    } else if (!open) {
      cleanup();
    }
  }, [open]);

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setRecording(false);
    setDuration(0);
    setVideoBlob(null);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
    chunksRef.current = [];
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        void videoPreviewRef.current.play();
      }
    } catch (err) {
      toast.error("Camera or Microphone access denied.");
    }
  }

  function startRecording() {
    if (!streamRef.current) return;
    try {
      const mediaRecorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setVideoBlob(blob);
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
      };

      mediaRecorder.start(100);
      setRecording(true);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error("Could not start video recording.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }

  function handleSend() {
    if (!videoBlob) return;
    const file = new File([videoBlob], `video-clip-${Date.now()}.webm`, {
      type: "video/webm",
    });
    onSendVideo(file);
    onOpenChange(false);
    cleanup();
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <VideoIcon className="size-5 text-purple-500" />
            Video Clip Recording
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center space-y-4 py-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-inner">
            {videoUrl ? (
              <video src={videoUrl} controls className="size-full object-cover" />
            ) : (
              <video
                ref={videoPreviewRef}
                muted
                playsInline
                className="size-full object-cover"
              />
            )}

            {recording ? (
              <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-mono font-medium text-white shadow">
                <span className="size-2 animate-ping rounded-full bg-white" />
                REC {formatTime(duration)}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            {!recording && !videoBlob ? (
              <Button onClick={startRecording} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
                <VideoIcon className="size-4" />
                Start Recording
              </Button>
            ) : recording ? (
              <Button onClick={stopRecording} variant="destructive" className="gap-2">
                <SquareIcon className="size-4" />
                Stop Recording
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    cleanup();
                    void startCamera();
                  }}
                  className="gap-2 text-muted-foreground"
                >
                  <Trash2Icon className="size-4" />
                  Re-record
                </Button>
                <Button onClick={handleSend} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <SendIcon className="size-4" />
                  Send Video Clip
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
