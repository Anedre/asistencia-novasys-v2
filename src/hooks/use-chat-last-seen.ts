"use client";

/**
 * useChatLastSeen — lightweight, *real* unread tracking for the messages list.
 *
 * The chat data model has no server-side read receipts, so we derive a genuine
 * unread signal from data we already have: each channel's `LastMessageAt`,
 * compared against the last time the viewer opened that channel (persisted in
 * `localStorage`). No mock counts — a channel is "unread" only when a message
 * actually arrived after you last looked at it.
 *
 * We can't know an exact unread *count* without loading every channel's
 * messages, so this exposes a boolean per channel (rendered as an accent dot).
 * If exact counts are ever needed, that requires a per-member `LastReadAt` on
 * the backend.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "nva:chat:lastSeen:v1";

type SeenMap = Record<string, string>; // channelId -> ISO timestamp last seen

function readMap(): SeenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SeenMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: SeenMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private-mode write failures */
  }
}

export interface ChatLastSeen {
  /** True once localStorage has hydrated (prevents a first-paint flash). */
  ready: boolean;
  /** Move a channel's "seen" marker forward to `at` (defaults to now). */
  markSeen: (channelId: string, at?: string) => void;
  /**
   * Record a baseline for channels we've never tracked, so pre-existing history
   * is treated as already read (avoids flagging everything on first load).
   * Pass each channel's current `LastMessageAt`.
   */
  seed: (entries: Array<{ id: string; at?: string }>) => void;
  /** True when `lastMessageAt` is newer than the stored seen marker. */
  isUnread: (channelId: string, lastMessageAt?: string) => boolean;
}

export function useChatLastSeen(): ChatLastSeen {
  const [map, setMap] = useState<SeenMap>({});
  const [ready, setReady] = useState(false);
  const ref = useRef<SeenMap>({});

  useEffect(() => {
    const initial = readMap();
    ref.current = initial;
    setMap(initial);
    setReady(true);
  }, []);

  const persist = useCallback((next: SeenMap) => {
    ref.current = next;
    setMap(next);
    writeMap(next);
  }, []);

  const markSeen = useCallback(
    (channelId: string, at?: string) => {
      const stamp = at ?? new Date().toISOString();
      const current = ref.current[channelId];
      if (current && current >= stamp) return; // only ever move forward
      persist({ ...ref.current, [channelId]: stamp });
    },
    [persist],
  );

  const seed = useCallback(
    (entries: Array<{ id: string; at?: string }>) => {
      let changed = false;
      const next = { ...ref.current };
      for (const { id, at } of entries) {
        if (next[id] === undefined) {
          next[id] = at ?? new Date().toISOString();
          changed = true;
        }
      }
      if (changed) persist(next);
    },
    [persist],
  );

  const isUnread = useCallback(
    (channelId: string, lastMessageAt?: string) => {
      if (!lastMessageAt) return false;
      const seen = map[channelId];
      if (seen === undefined) return false; // not yet seeded → treat as read
      return new Date(lastMessageAt).getTime() > new Date(seen).getTime();
    },
    [map],
  );

  return { ready, markSeen, seed, isUnread };
}
