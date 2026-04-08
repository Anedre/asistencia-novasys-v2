"use client";

/**
 * Notification sound player with global mute toggle.
 *
 * Sounds are synthesized on the fly with Web Audio API (OscillatorNode +
 * GainNode) to avoid shipping any audio assets. Each sound type has its own
 * little melody designed to be recognizable but not intrusive.
 *
 * Preference is persisted in localStorage under `notif-sound-enabled`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationSound, NotificationType } from "@/lib/types/api";

const STORAGE_KEY = "notif-sound-enabled";
const THROTTLE_MS = 2000;

/** Map a notification type to its default sound if the row doesn't specify one. */
export function defaultSoundFor(type: NotificationType): NotificationSound {
  switch (type) {
    case "REQUEST_APPROVED":
      return "approval";
    case "REQUEST_REJECTED":
      return "reject";
    case "NEW_MESSAGE":
      return "message";
    case "NEW_POST":
      return "post";
    case "BIRTHDAY_TODAY":
    case "BIRTHDAY_UPCOMING":
    case "WORK_ANNIVERSARY":
      return "celebrate";
    default:
      return "system";
  }
}

/**
 * Describes a sound as a sequence of (frequency, duration, delay) tones.
 * Durations and delays are in seconds, frequencies in Hz.
 */
type Tone = { freq: number; dur: number; delay: number; type?: OscillatorType };

const SOUND_PATTERNS: Record<NotificationSound, Tone[]> = {
  // short ping, two ascending notes
  message: [
    { freq: 880, dur: 0.08, delay: 0 },
    { freq: 1175, dur: 0.1, delay: 0.09 },
  ],
  // cheerful ascending arpeggio
  approval: [
    { freq: 523, dur: 0.08, delay: 0 },
    { freq: 659, dur: 0.08, delay: 0.08 },
    { freq: 784, dur: 0.14, delay: 0.16 },
  ],
  // descending minor motif
  reject: [
    { freq: 523, dur: 0.1, delay: 0 },
    { freq: 415, dur: 0.14, delay: 0.1 },
  ],
  // soft single neutral tone
  post: [{ freq: 659, dur: 0.12, delay: 0, type: "triangle" }],
  // festive three-note riff
  celebrate: [
    { freq: 784, dur: 0.09, delay: 0, type: "triangle" },
    { freq: 988, dur: 0.09, delay: 0.09, type: "triangle" },
    { freq: 1175, dur: 0.14, delay: 0.18, type: "triangle" },
    { freq: 1568, dur: 0.18, delay: 0.3, type: "triangle" },
  ],
  // plain alert tone
  system: [{ freq: 600, dur: 0.16, delay: 0 }],
};

function readPref(): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === null ? true : v === "true";
}

function playPattern(pattern: Tone[]) {
  if (typeof window === "undefined") return;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.15; // keep it polite
  masterGain.connect(ctx.destination);

  const startTime = ctx.currentTime;
  for (const tone of pattern) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = tone.type ?? "sine";
    osc.frequency.value = tone.freq;

    // Simple AD envelope so we don't get pops.
    const t0 = startTime + tone.delay;
    const t1 = t0 + tone.dur;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(1, t0 + 0.01);
    env.gain.linearRampToValueAtTime(0, t1);

    osc.connect(env).connect(masterGain);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }

  // Close the context after the longest tone finishes.
  const totalMs =
    Math.max(...pattern.map((t) => (t.delay + t.dur) * 1000)) + 200;
  setTimeout(() => {
    ctx.close().catch(() => undefined);
  }, totalMs);
}

export function useNotificationSound() {
  const [enabled, setEnabledState] = useState<boolean>(true);
  const lastPlayedAt = useRef(0);

  // Hydrate from storage on mount (avoids SSR mismatch).
  useEffect(() => {
    setEnabledState(readPref());
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
    }
  }, []);

  const play = useCallback(
    (sound: NotificationSound) => {
      if (!enabled) return;
      const now = Date.now();
      if (now - lastPlayedAt.current < THROTTLE_MS) return;
      lastPlayedAt.current = now;
      try {
        playPattern(SOUND_PATTERNS[sound] ?? SOUND_PATTERNS.system);
      } catch {
        /* ignore — audio can fail if the user hasn't interacted yet */
      }
    },
    [enabled]
  );

  return { play, enabled, setEnabled };
}
