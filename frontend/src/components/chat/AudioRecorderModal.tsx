"use client";

import { useEffect, useRef, useState } from "react";
import { MicIcon, SquareIcon, PlayIcon, PauseIcon, Trash2Icon, SendIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AudioRecorderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendAudio: (file: File) => void;
}

export function AudioRecorderModal({
  open,
  onOpenChange,
  onSendAudio,
}: AudioRecorderModalProps) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!open) {
      cleanup();
    }
  }, [open]);

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    setRecording(false);
    setDuration(0);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setPlaying(false);
    chunksRef.current = [];
  }

  async function startRecording() {
    cleanup();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setRecording(true);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      toast.error("Microphone access denied or not supported.");
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
    if (!audioBlob) return;
    const file = new File([audioBlob], `voice-clip-${Date.now()}.webm`, {
      type: "audio/webm",
    });
    onSendAudio(file);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MicIcon className="size-5 text-red-500" />
            Voice Clip Recording
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center space-y-6 py-6">
          <div className="flex items-center justify-center">
            {recording ? (
              <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex size-24 animate-ping rounded-full bg-red-400 opacity-30" />
                <div className="flex size-20 items-center justify-center rounded-full bg-red-500 text-white shadow-lg">
                  <MicIcon className="size-8 animate-pulse" />
                </div>
              </div>
            ) : audioUrl ? (
              <div className="flex size-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <MicIcon className="size-8" />
              </div>
            ) : (
              <div className="flex size-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MicIcon className="size-8" />
              </div>
            )}
          </div>

          <div className="text-center font-mono text-2xl font-semibold">
            {formatTime(duration)}
          </div>

          {audioUrl ? (
            <div className="w-full space-y-3 px-4">
              <audio
                ref={audioPlayerRef}
                src={audioUrl}
                onEnded={() => setPlaying(false)}
                className="hidden"
              />
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (audioPlayerRef.current) {
                      if (playing) {
                        audioPlayerRef.current.pause();
                        setPlaying(false);
                      } else {
                        audioPlayerRef.current.play();
                        setPlaying(true);
                      }
                    }
                  }}
                >
                  {playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {playing ? "Playing preview…" : "Click play to preview audio"}
                </span>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            {!recording && !audioBlob ? (
              <Button onClick={startRecording} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                <MicIcon className="size-4" />
                Start Recording
              </Button>
            ) : recording ? (
              <Button onClick={stopRecording} variant="destructive" className="gap-2">
                <SquareIcon className="size-4" />
                Stop Recording
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={cleanup} className="gap-2 text-muted-foreground">
                  <Trash2Icon className="size-4" />
                  Discard
                </Button>
                <Button onClick={handleSend} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <SendIcon className="size-4" />
                  Send Voice Clip
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
