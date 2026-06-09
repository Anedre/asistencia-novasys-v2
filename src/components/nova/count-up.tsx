"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Target value to count up to. */
  value: number;
  /** Animation duration in ms. */
  duration?: number;
  /** Decimal places to show (default 0 = integer). */
  decimals?: number;
  className?: string;
}

/**
 * Animated number that eases from its previous value up to `value`.
 * - SSR-safe: server and first client render both show 0, then the client
 *   animates on mount (no hydration mismatch).
 * - Respects prefers-reduced-motion (jumps straight to the value).
 * - Plain integers only by default — pass `decimals` for fractional values.
 */
export function CountUp({ value, duration = 900, decimals = 0, className }: Props) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const to = Number.isFinite(value) ? value : 0;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || fromRef.current === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    const from = fromRef.current;
    let raf = 0;
    let startTs = 0;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const shown =
    decimals > 0 ? display.toFixed(decimals) : Math.round(display).toString();

  return <span className={className}>{shown}</span>;
}
