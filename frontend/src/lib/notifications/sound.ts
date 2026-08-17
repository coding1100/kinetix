"use client";

import { useSettingsStore, type SoundPreset } from "@/stores/settings-store";

export const SOUND_PRESETS: { id: SoundPreset; label: string; description: string }[] = [
  { id: "chime", label: "Default Chime", description: "Clean, bright workspace dual chime" },
  { id: "pop", label: "Pop", description: "Quick, subtle rubber pop" },
  { id: "ping", label: "Crystal Ping", description: "High-pitch crisp bell ping" },
  { id: "soft", label: "Subtle Soft", description: "Gentle low marimba tone" },
  { id: "bell", label: "Classic Bell", description: "Resonant brass bell chime" },
  { id: "breeze", label: "Breeze Chord", description: "Elegant ascending 3-note chord" },
];

let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;
const DEDUPE_MS = 350;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

// Unlock audio context on user gesture so background sounds work seamlessly
if (typeof window !== "undefined") {
  const unlockEvents = ["pointerdown", "keydown", "touchstart"];
  const unlockHandler = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
    unlockEvents.forEach((ev) => window.removeEventListener(ev, unlockHandler));
  };
  unlockEvents.forEach((ev) => window.addEventListener(ev, unlockHandler));
}

function synthesizeSound(preset: SoundPreset) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  switch (preset) {
    case "chime": {
      // Harmonic dual tone (E5 -> B5)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now); // E5

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(987.77, now + 0.08); // B5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.28);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.28);
      break;
    }
    case "pop": {
      // Pitch drop pop (600Hz -> 180Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.07);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
      break;
    }
    case "ping": {
      // High crystal ping (C6 with C7 overtone)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1046.5, now); // C6
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(2093.0, now); // C7

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.35);
      osc2.start(now);
      osc2.stop(now + 0.35);
      break;
    }
    case "soft": {
      // Warm marimba G4 -> C5
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(392.0, now); // G4
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.06); // C5

      filter.type = "lowpass";
      filter.frequency.value = 1200;

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
      break;
    }
    case "bell": {
      // Classic brass bell D5 + A5
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880.0, now); // A5

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.42);
      osc2.start(now);
      osc2.stop(now + 0.42);
      break;
    }
    case "breeze": {
      // 3-note ascending chord (D5 -> F#5 -> A5)
      const notes = [587.33, 739.99, 880.0];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.05);

        gain.gain.setValueAtTime(0.001, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.2, now + i * 0.05 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.25);
      });
      break;
    }
  }
}

/**
 * Plays the user's selected notification sound preset.
 * Guaranteed to deduplicate rapid back-to-back events (prevents double playing).
 */
export function playNotificationSound(targetPreset?: SoundPreset, ignoreEnabled = false) {
  if (typeof window === "undefined") return;

  const { soundEnabled, soundPreset } = useSettingsStore.getState();
  if (!ignoreEnabled && !soundEnabled) return;

  const now = Date.now();
  if (now - lastPlayedAt < DEDUPE_MS && !targetPreset) {
    return; // Prevent duplicate sound firing from rapid socket/store events
  }
  lastPlayedAt = now;

  const preset = targetPreset ?? soundPreset ?? "chime";
  try {
    synthesizeSound(preset);
  } catch (err) {
    console.warn("[notification sound] failed to play sound", err);
  }
}
